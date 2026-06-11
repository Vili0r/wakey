const { withDangerousMod, withXcodeProject, IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

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
        "platform :ios, '26.0'"
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
          buildConfig.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '26.0';
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
  
  return config;
};

module.exports = withAlarmKit;
