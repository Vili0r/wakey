const { withDangerousMod, withXcodeProject, IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// The expo-widgets plugin wipes and regenerates ios/<target>/index.swift on
// every prebuild, so the AlarmKit live-activity UI cannot live there by hand —
// it would survive a normal `expo run:ios` but vanish on `expo prebuild --clean`
// (fresh checkouts, CI, EAS). This plugin re-injects it into the generated
// bundle. We deliberately do NOT link the ExpoAlarmKit module into the widget
// extension: it depends on ExpoModulesCore (React runtime) which cannot build
// in an app extension. ActivityKit matches a live activity to its widget UI by
// the metadata type's *name*, so the extension declares its own `AlarmData`
// (kept in sync with the one in ExpoAlarmKitModule.swift).
const ALARM_LIVE_ACTIVITY_SWIFT = `
@available(iOS 26.0, *)
struct AlarmLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: AlarmAttributes<AlarmData>.self) { context in
      VStack(alignment: .leading, spacing: 8) {
        HStack {
          Image(systemName: "alarm.fill")
            .foregroundColor(.orange)
          Text(context.attributes.presentation.alert.title)
            .font(.headline)
            .foregroundColor(.white)
        }
        switch context.state.mode {
        case .paused:
          Text("Paused")
            .font(.subheadline)
            .foregroundColor(.gray)
        case .countdown:
          Text("Snoozed")
            .font(.subheadline)
            .foregroundColor(.gray)
        default:
          EmptyView()
        }
      }
      .padding()
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Image(systemName: "alarm.fill")
            .foregroundColor(.orange)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text("Alarm")
            .foregroundColor(.orange)
        }
        DynamicIslandExpandedRegion(.bottom) {
          Text(context.attributes.presentation.alert.title)
            .font(.headline)
        }
      } compactLeading: {
        Image(systemName: "alarm.fill")
          .foregroundColor(.orange)
      } compactTrailing: {
        Text("Alarm")
          .foregroundColor(.orange)
      } minimal: {
        Image(systemName: "alarm.fill")
          .foregroundColor(.orange)
      }
    }
  }
}
`;

// Idempotently rewrite the expo-widgets-generated index.swift to register the
// AlarmKit live activity. Returns the patched source.
const injectAlarmLiveActivity = (source) => {
  if (source.includes('struct AlarmLiveActivity')) return source; // already patched

  let out = source;

  // 1. Imports + the shared AlarmData metadata type, after the ExpoWidgets import.
  out = out.replace(
    /(internal import ExpoWidgets\n)/,
    `$1internal import ActivityKit\ninternal import AlarmKit\n\n@available(iOS 26.0, *)\nstruct AlarmData: AlarmMetadata {}\n`,
  );

  // 2. Register the widget in the bundle body (next to the generated
  //    WidgetLiveActivity() entry).
  out = out.replace(
    /( *)(WidgetLiveActivity\(\))/,
    `$1$2\n$1if #available(iOS 26.0, *) {\n$1  AlarmLiveActivity()\n$1}`,
  );

  // 3. Append the widget definition.
  return `${out}\n${ALARM_LIVE_ACTIVITY_SWIFT}`;
};

const withAlarmKit = (config) => {
  // 1. Update Podfile deployment target and copy custom sound files
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfileContent = await fs.promises.readFile(podfilePath, 'utf8');
      
      // Replace platform definition
      podfileContent = podfileContent.replace(
        /platform :ios, .*/,
        "platform :ios, '17.0'"
      );
      
      await fs.promises.writeFile(podfilePath, podfileContent, 'utf8');

      // Copy sound files from assets/sounds/ to ios/wakey/Supporting/sounds/
      const sourceSoundsDir = path.join(config.modRequest.projectRoot, 'assets', 'sounds');
      const destSoundsDir = path.join(config.modRequest.platformProjectRoot, 'wakey', 'Supporting', 'sounds');
      
      if (fs.existsSync(sourceSoundsDir)) {
        if (!fs.existsSync(destSoundsDir)) {
          fs.mkdirSync(destSoundsDir, { recursive: true });
        }
        
        const files = fs.readdirSync(sourceSoundsDir);
        for (const file of files) {
          const srcFile = path.join(sourceSoundsDir, file);
          const destFile = path.join(destSoundsDir, file);
          if (fs.lstatSync(srcFile).isFile()) {
            fs.copyFileSync(srcFile, destFile);
          }
        }
      }
      
      return config;
    }
  ]);
  
  // 2. Update Xcode project deployment target and add copied sound files to resources group
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    
    // Set deployment target
    const buildConfigurations = xcodeProject.pbxXCBuildConfigurationSection();
    for (const key in buildConfigurations) {
      const buildConfig = buildConfigurations[key];
      if (typeof buildConfig === 'object' && buildConfig.buildSettings) {
        if (buildConfig.buildSettings.IPHONEOS_DEPLOYMENT_TARGET) {
          buildConfig.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '17.0';
        }
      }
    }
    
    // Reference sound files in xcode project
    const sourceSoundsDir = path.join(config.modRequest.projectRoot, 'assets', 'sounds');
    if (fs.existsSync(sourceSoundsDir)) {
      const files = fs.readdirSync(sourceSoundsDir);
      
      // Ensure group exists in Xcode project
      const groupName = "Supporting/sounds";
      IOSConfig.XcodeUtils.ensureGroupRecursively(xcodeProject, groupName);
      
      for (const file of files) {
        const srcFile = path.join(sourceSoundsDir, file);
        if (fs.lstatSync(srcFile).isFile()) {
          // Xcode filepath must be relative to the ios directory
          const relativePath = path.join('wakey', 'Supporting', 'sounds', file);
          
          // Add resource to group and target
          IOSConfig.XcodeUtils.addResourceFileToGroup({
            filepath: relativePath,
            groupName: groupName,
            project: xcodeProject,
            isBuildFile: true,
          });
        }
      }
    }
    
    return config;
  });

  // 3. Re-inject the AlarmKit live activity into the expo-widgets-generated
  //    index.swift. expo-widgets regenerates the whole target dir each prebuild,
  //    so this must run AFTER its file generation. Config-plugin dangerous mods
  //    run LIFO (the last-registered plugin runs first — see withMod.js), so
  //    withAlarmKit.js must be listed BEFORE expo-widgets in app.json to run
  //    after it here.
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const indexPath = path.join(
        config.modRequest.platformProjectRoot,
        'ExpoWidgetsTarget',
        'index.swift',
      );
      if (!fs.existsSync(indexPath)) {
        throw new Error(
          `[withAlarmKit] ${indexPath} not found. Dangerous mods run LIFO, so withAlarmKit.js must be listed BEFORE expo-widgets in app.json plugins to run after its file generation.`,
        );
      }
      const source = await fs.promises.readFile(indexPath, 'utf8');
      await fs.promises.writeFile(indexPath, injectAlarmLiveActivity(source), 'utf8');
      return config;
    },
  ]);

  return config;
};

module.exports = withAlarmKit;
module.exports.injectAlarmLiveActivity = injectAlarmLiveActivity;
