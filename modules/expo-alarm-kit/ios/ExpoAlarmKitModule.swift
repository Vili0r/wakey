import ExpoModulesCore
import AlarmKit
import AppIntents
import SwiftUI

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
// 1. Concrete AlarmMetadata conformance
@available(iOS 26.0, *)
public struct AlarmData: AlarmMetadata {
    // Empty metadata container conforming to AlarmMetadata
}

// 2. Structs for JS parameter mapping (Record conformance)
struct AlarmOptions: Record {
  @Field var id: String = ""
  @Field var date: String = ""
  @Field var title: String = ""
  @Field var soundName: String? = nil
  @Field var launchAppOnDismiss: Bool = false
  @Field var launchAppOnSnooze: Bool = false
  @Field var doSnoozeIntent: Bool = false
  @Field var snoozeDuration: Double? = nil
  @Field var tintColor: String? = nil
}

struct RepeatingAlarmOptions: Record {
  @Field var id: String = ""
  @Field var hour: Int = 0
  @Field var minute: Int = 0
  @Field var weekdays: [Int] = []
  @Field var title: String = ""
  @Field var soundName: String? = nil
  @Field var launchAppOnDismiss: Bool = false
  @Field var launchAppOnSnooze: Bool = false
  @Field var doSnoozeIntent: Bool = false
  @Field var snoozeDuration: Double? = nil
  @Field var tintColor: String? = nil
}

// 3. Shared Helpers for Intents
@available(iOS 26.0, *)
struct AlarmStopHelper {
  static func performStop(alarmId: String, payload: String) async throws {
    // FLAG_APP_GROUP_ID_MATCHING: App Group ID used as suiteName
    let appGroupId = "group.com.tsouvili.wakey"
    guard let uuid = UUID(uuidString: alarmId) else {
      return
    }

    // Stop the alarm using AlarmKit manager
    try AlarmManager.shared.stop(id: uuid)

    // Remove from local persisted cache
    if let defaults = UserDefaults(suiteName: appGroupId) {
      var array = defaults.array(forKey: "scheduled_alarms") as? [[String: Any]] ?? []
      array.removeAll { ($0["id"] as? String) == alarmId }
      defaults.set(array, forKey: "scheduled_alarms")
      
      // Save launch payload
      let payloadDict: [String: String] = [
        "alarmId": alarmId,
        "payload": payload
      ]
      defaults.set(payloadDict, forKey: "launch_payload")
      defaults.synchronize()
    }

    // Dispatch notification center event for active apps
    NotificationCenter.default.post(
      name: Notification.Name("ExpoAlarmKit_LaunchPayloadReceived"),
      object: nil,
      userInfo: ["alarmId": alarmId, "payload": payload]
    )
  }
}

@available(iOS 26.0, *)
struct AlarmSnoozeHelper {
  static func performSnooze(alarmId: String, snoozeDuration: Double, payload: String) async throws {
    // FLAG_APP_GROUP_ID_MATCHING: App Group ID used as suiteName
    let appGroupId = "group.com.tsouvili.wakey"
    guard let uuid = UUID(uuidString: alarmId) else {
      return
    }

    // Cancel current active alarm
    try? AlarmManager.shared.cancel(id: uuid)

    // Read original configuration from UserDefaults to reschedule alarm
    var title = "Alarm (Snoozed)"
    var soundName = ""
    var launchAppOnDismiss = false
    var launchAppOnSnooze = false
    var tintColorHex: String? = nil
    
    guard let defaults = UserDefaults(suiteName: appGroupId) else {
      return
    }
    
    var array = defaults.array(forKey: "scheduled_alarms") as? [[String: Any]] ?? []
    if let record = array.first(where: { ($0["id"] as? String) == alarmId }) {
      title = (record["title"] as? String) ?? title
      soundName = (record["soundName"] as? String) ?? ""
      launchAppOnDismiss = (record["launchAppOnDismiss"] as? Bool) ?? false
      launchAppOnSnooze = (record["launchAppOnSnooze"] as? Bool) ?? false
      tintColorHex = record["tintColor"] as? String
    }

    // Calculate snooze fire date
    let newDate = Date().addingTimeInterval(snoozeDuration)

    // Build configuration to reschedule
    let schedule = Alarm.Schedule.fixed(newDate)
    
    let stopButtonLabel = LocalizedStringResource(stringLiteral: "Dismiss")
    let stopButton = AlarmButton(text: stopButtonLabel, textColor: .white, systemImageName: "checkmark.circle")
    
    let stopIntent: any LiveActivityIntent
    if launchAppOnDismiss {
      stopIntent = AlarmStopOpenAppIntent(alarmId: alarmId, payload: "dismiss")
    } else {
      stopIntent = AlarmStopBackgroundIntent(alarmId: alarmId, payload: "dismiss")
    }

    // Reschedule support for snooze-again
    let secondaryButton = AlarmButton(
      text: LocalizedStringResource(stringLiteral: "Snooze"),
      textColor: .white,
      systemImageName: "clock.arrow.2.circlepath"
    )
    
    let alertPresentation = AlarmPresentation.Alert(
      title: LocalizedStringResource(stringLiteral: title),
      stopButton: stopButton,
      secondaryButton: secondaryButton,
      secondaryButtonBehavior: .custom
    )
    
    // Snooze intent is always background intent, dropping launch-app-on-snooze!
    let secondaryIntent = AlarmSnoozeBackgroundIntent(alarmId: alarmId, snoozeDuration: snoozeDuration, payload: "snooze")
    
    let finalTintColor: Color = (tintColorHex != nil && !tintColorHex!.isEmpty) ? Color(hex: tintColorHex!) : .orange
    
    let attributes = AlarmAttributes<AlarmData>(
      presentation: AlarmPresentation(alert: alertPresentation),
      metadata: nil,
      tintColor: finalTintColor
    )
    
    let configuration = AlarmManager.AlarmConfiguration<AlarmData>(
      schedule: schedule,
      attributes: attributes,
      stopIntent: stopIntent,
      secondaryIntent: secondaryIntent,
      sound: !soundName.isEmpty ? .named(soundName) : .default
    )

    // Reschedule in AlarmManager
    _ = try await AlarmManager.shared.schedule(id: uuid, configuration: configuration)

    // Update persisted list with snoozed alarm firing date
    array.removeAll { ($0["id"] as? String) == alarmId }
    
    let formatter = ISO8601DateFormatter()
    let dateString = formatter.string(from: newDate)
    
    let record: [String: Any] = [
      "id": alarmId,
      "title": title,
      "type": "one-time",
      "date": dateString,
      "soundName": soundName,
      "launchAppOnDismiss": launchAppOnDismiss,
      "launchAppOnSnooze": launchAppOnSnooze,
      "doSnoozeIntent": true,
      "snoozeDuration": snoozeDuration,
      "tintColor": tintColorHex ?? ""
    ]
    array.append(record)
    defaults.set(array, forKey: "scheduled_alarms")
    
    // Save launch payload including fireDate and title for the Live Activity countdown
    let payloadDict: [String: String] = [
      "alarmId": alarmId,
      "payload": payload,
      "fireDate": dateString,
      "title": title
    ]
    defaults.set(payloadDict, forKey: "launch_payload")
    defaults.synchronize()

    // Dispatch notification center event for active apps
    NotificationCenter.default.post(
      name: Notification.Name("ExpoAlarmKit_LaunchPayloadReceived"),
      object: nil,
      userInfo: [
        "alarmId": alarmId,
        "payload": payload,
        "fireDate": dateString,
        "title": title
      ]
    )
  }
}

// 4. Custom App Intents
@available(iOS 26.0, *)
public struct AlarmStopBackgroundIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "Dismiss Alarm"
  public static var supportedModes: IntentModes = [.background]

  @Parameter(title: "Alarm ID")
  public var alarmId: String

  @Parameter(title: "Payload")
  public var payload: String

  public init() {}
  public init(alarmId: String, payload: String) {
    self.alarmId = alarmId
    self.payload = payload
  }

  public func perform() async throws -> some IntentResult {
    try await AlarmStopHelper.performStop(alarmId: alarmId, payload: payload)
    return .result()
  }
}

@available(iOS 26.0, *)
public struct AlarmStopOpenAppIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "Dismiss Alarm and Open App"
  public static var openAppWhenRun: Bool = true
  public static var supportedModes: IntentModes = [.foreground(.immediate)]

  @Parameter(title: "Alarm ID")
  public var alarmId: String

  @Parameter(title: "Payload")
  public var payload: String

  public init() {}
  public init(alarmId: String, payload: String) {
    self.alarmId = alarmId
    self.payload = payload
  }

  public func perform() async throws -> some IntentResult {
    try await AlarmStopHelper.performStop(alarmId: alarmId, payload: payload)
    return .result()
  }
}

@available(iOS 26.0, *)
public struct AlarmSnoozeBackgroundIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "Snooze Alarm"
  public static var supportedModes: IntentModes = [.background]

  @Parameter(title: "Alarm ID")
  public var alarmId: String

  @Parameter(title: "Snooze Duration")
  public var snoozeDuration: Double

  @Parameter(title: "Payload")
  public var payload: String

  public init() {}
  public init(alarmId: String, snoozeDuration: Double, payload: String) {
    self.alarmId = alarmId
    self.snoozeDuration = snoozeDuration
    self.payload = payload
  }

  public func perform() async throws -> some IntentResult {
    try await AlarmSnoozeHelper.performSnooze(alarmId: alarmId, snoozeDuration: snoozeDuration, payload: payload)
    return .result()
  }
}



// 5. Main Module definition mapping to JS
public class ExpoAlarmKitModule: Module {
  
  // FLAG_APP_GROUP_ID_MATCHING: App Group ID is defined here as a constant.
  // Must match entitlements, JS/TS calls, and iOS capabilities identically.
  private let appGroupId = "group.com.tsouvili.wakey"
  
  private var observer: NSObjectProtocol?

  private func getPersistedAlarms() -> [[String: Any]] {
    // FLAG_APP_GROUP_ID_MATCHING: App Group ID used as suiteName
    guard let defaults = UserDefaults(suiteName: appGroupId),
          let array = defaults.array(forKey: "scheduled_alarms") as? [[String: Any]] else {
      return []
    }
    return array
  }

  private func savePersistedAlarms(_ alarms: [[String: Any]]) {
    // FLAG_APP_GROUP_ID_MATCHING: App Group ID used as suiteName
    guard let defaults = UserDefaults(suiteName: appGroupId) else {
      return
    }
    defaults.set(alarms, forKey: "scheduled_alarms")
  }

  public func definition() -> ModuleDefinition {
    // Registers the name of the module
    Name("ExpoAlarmKit")

    // Event definition to support active app event emission
    Events("onLaunchPayloadReceived")

    OnCreate {
      // Listen to AppIntent execution notifications when app is active
      self.observer = NotificationCenter.default.addObserver(
        forName: Notification.Name("ExpoAlarmKit_LaunchPayloadReceived"),
        object: nil,
        queue: .main
      ) { [weak self] notification in
        guard let self = self else { return }
        if let userInfo = notification.userInfo as? [String: String] {
          self.sendEvent("onLaunchPayloadReceived", userInfo)
        }
      }
    }

    OnDestroy {
      if let observer = self.observer {
        NotificationCenter.default.removeObserver(observer)
      }
    }

    // Configure function called from JavaScript/TypeScript
    Function("configure") { (appGroupId: String) in
      // FLAG_APP_GROUP_ID_MATCHING:
      // The appGroupId string must match exactly: "group.com.tsouvili.wakey"
      // It is used as the suiteName for sharing data within the App Group.
      let expectedAppGroupId = "group.com.tsouvili.wakey"
      if appGroupId != expectedAppGroupId {
        NSLog("[ExpoAlarmKit] Warning: App Group ID mismatch! Got: %@, Expected: %@", appGroupId, expectedAppGroupId)
      }
      
      let defaults = UserDefaults(suiteName: appGroupId)
      if defaults != nil {
        NSLog("[ExpoAlarmKit] Successfully initialized UserDefaults suiteName: %@", appGroupId)
      } else {
        NSLog("[ExpoAlarmKit] Error: Failed to initialize UserDefaults suiteName: %@", appGroupId)
      }
    }

    AsyncFunction("requestAuthorization") { (promise: Promise) in
      if #available(iOS 26.0, *) {
        Task {
          do {
            let state = try await AlarmManager.shared.requestAuthorization()
            switch state {
            case .authorized:
              promise.resolve("authorized")
            case .denied:
              promise.resolve("denied")
            case .notDetermined:
              promise.resolve("notDetermined")
            @unknown default:
              promise.resolve("notDetermined")
            }
          } catch {
            promise.reject("ERR_AUTHORIZATION_FAILED", error.localizedDescription)
          }
        }
      } else {
        promise.resolve("notSupported")
      }
    }

    AsyncFunction("scheduleAlarm") { (options: AlarmOptions, promise: Promise) in
      if #available(iOS 26.0, *) {
        Task {
          do {
            guard let uuid = UUID(uuidString: options.id) else {
              promise.reject("ERR_INVALID_ID", "Alarm ID must be a valid UUID string")
              return
            }
            
            let formatterWithMs = ISO8601DateFormatter()
            formatterWithMs.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let formatterWithoutMs = ISO8601DateFormatter()
            formatterWithoutMs.formatOptions = [.withInternetDateTime]
            
            guard let date = formatterWithMs.date(from: options.date) ?? formatterWithoutMs.date(from: options.date) else {
              promise.reject("ERR_INVALID_DATE", "Date must be an ISO8601 formatted string")
              return
            }
            
            NSLog("[ExpoAlarmKit] scheduling alarm: ID=%@, Title=%@, Date=%@", options.id, options.title, options.date)
            let schedule = Alarm.Schedule.fixed(date)
            
            let stopButtonLabel = LocalizedStringResource(stringLiteral: "Dismiss")
            let stopButton = AlarmButton(text: stopButtonLabel, textColor: .white, systemImageName: "checkmark.circle")
            
            let alertPresentation: AlarmPresentation.Alert
            
            let snoozeDuration = options.snoozeDuration ?? 540.0 // Default 9 minutes (540 seconds)
            let launchAppOnDismiss = options.launchAppOnDismiss
            let launchAppOnSnooze = options.launchAppOnSnooze
            
            // Configure stop/dismiss intents based on foreground launch choice
            let stopIntent: any LiveActivityIntent
            if launchAppOnDismiss {
              stopIntent = AlarmStopOpenAppIntent(alarmId: options.id, payload: "dismiss")
            } else {
              stopIntent = AlarmStopBackgroundIntent(alarmId: options.id, payload: "dismiss")
            }

            // Configure secondary snooze intent using .custom button behavior
            var secondaryIntent: (any LiveActivityIntent)? = nil
            if options.doSnoozeIntent {
              let secondaryButton = AlarmButton(
                text: LocalizedStringResource(stringLiteral: "Snooze"),
                textColor: .white,
                systemImageName: "clock.arrow.2.circlepath"
              )
              // FLAG_PRESENTATION_CUSTOM_EDIT: Must use secondaryButton and secondaryButtonBehavior: .custom
              alertPresentation = AlarmPresentation.Alert(
                title: LocalizedStringResource(stringLiteral: options.title),
                stopButton: stopButton,
                secondaryButton: secondaryButton,
                secondaryButtonBehavior: .custom
              )
              // Snooze intent is always background intent, dropping launch-app-on-snooze!
              secondaryIntent = AlarmSnoozeBackgroundIntent(alarmId: options.id, snoozeDuration: snoozeDuration, payload: "snooze")
            } else {
              alertPresentation = AlarmPresentation.Alert(
                title: LocalizedStringResource(stringLiteral: options.title),
                stopButton: stopButton
              )
            }
            
            let finalTintColor: Color = (options.tintColor != nil && !options.tintColor!.isEmpty) ? Color(hex: options.tintColor!) : .orange
            
            let attributes = AlarmAttributes<AlarmData>(
              presentation: AlarmPresentation(alert: alertPresentation),
              metadata: nil,
              tintColor: finalTintColor
            )
            
            let soundName = options.soundName ?? ""
            let configuration = AlarmManager.AlarmConfiguration<AlarmData>(
              schedule: schedule,
              attributes: attributes,
              stopIntent: stopIntent,
              secondaryIntent: secondaryIntent,
              sound: !soundName.isEmpty ? .named(soundName) : .default
            )
            
            _ = try await AlarmManager.shared.schedule(id: uuid, configuration: configuration)
            NSLog("[ExpoAlarmKit] Successfully scheduled alarm ID=%@ natively!", options.id)
            
            // Update persistence in UserDefaults
            var alarms = self.getPersistedAlarms()
            alarms.removeAll { ($0["id"] as? String) == options.id }
            
            let record: [String: Any] = [
              "id": options.id,
              "title": options.title,
              "type": "one-time",
              "date": options.date,
              "soundName": soundName,
              "launchAppOnDismiss": launchAppOnDismiss,
              "launchAppOnSnooze": launchAppOnSnooze,
              "doSnoozeIntent": options.doSnoozeIntent,
              "snoozeDuration": snoozeDuration,
              "tintColor": options.tintColor ?? ""
            ]
            alarms.append(record)
            self.savePersistedAlarms(alarms)
            
            promise.resolve(true)
          } catch {
            NSLog("[ExpoAlarmKit] ERROR scheduling alarm: %@", error.localizedDescription)
            promise.reject("ERR_SCHEDULE_FAILED", error.localizedDescription)
          }
        }
      } else {
        promise.reject("ERR_NOT_SUPPORTED", "AlarmKit is only supported on iOS 26.0 or later")
      }
    }

    AsyncFunction("scheduleRepeatingAlarm") { (options: RepeatingAlarmOptions, promise: Promise) in
      if #available(iOS 26.0, *) {
        Task {
          do {
            guard let uuid = UUID(uuidString: options.id) else {
              promise.reject("ERR_INVALID_ID", "Alarm ID must be a valid UUID string")
              return
            }
            
            let relativeTime = Alarm.Schedule.Relative.Time(hour: options.hour, minute: options.minute)
            
            let swiftWeekdays = options.weekdays.compactMap { weekdayInt -> Locale.Weekday? in
              switch weekdayInt {
              case 0: return .sunday
              case 1: return .monday
              case 2: return .tuesday
              case 3: return .wednesday
              case 4: return .thursday
              case 5: return .friday
              case 6: return .saturday
              default: return nil
              }
            }
            
            let recurrence = Alarm.Schedule.Relative.Recurrence.weekly(swiftWeekdays)
            let relativeSchedule = Alarm.Schedule.Relative(time: relativeTime, repeats: recurrence)
            let schedule = Alarm.Schedule.relative(relativeSchedule)
            
            let stopButtonLabel = LocalizedStringResource(stringLiteral: "Dismiss")
            let stopButton = AlarmButton(text: stopButtonLabel, textColor: .white, systemImageName: "checkmark.circle")
            
            let alertPresentation: AlarmPresentation.Alert
            
            let snoozeDuration = options.snoozeDuration ?? 540.0 // Default 9 minutes
            let launchAppOnDismiss = options.launchAppOnDismiss
            let launchAppOnSnooze = options.launchAppOnSnooze
            
            // Configure stop/dismiss intents based on foreground launch choice
            let stopIntent: any LiveActivityIntent
            if launchAppOnDismiss {
              stopIntent = AlarmStopOpenAppIntent(alarmId: options.id, payload: "dismiss")
            } else {
              stopIntent = AlarmStopBackgroundIntent(alarmId: options.id, payload: "dismiss")
            }

            // Configure secondary snooze intent using .custom button behavior
            var secondaryIntent: (any LiveActivityIntent)? = nil
            if options.doSnoozeIntent {
              let secondaryButton = AlarmButton(
                text: LocalizedStringResource(stringLiteral: "Snooze"),
                textColor: .white,
                systemImageName: "clock.arrow.2.circlepath"
              )
              // FLAG_PRESENTATION_CUSTOM_EDIT: Must use secondaryButton and secondaryButtonBehavior: .custom
              alertPresentation = AlarmPresentation.Alert(
                title: LocalizedStringResource(stringLiteral: options.title),
                stopButton: stopButton,
                secondaryButton: secondaryButton,
                secondaryButtonBehavior: .custom
              )
              // Snooze intent is always background intent, dropping launch-app-on-snooze!
              secondaryIntent = AlarmSnoozeBackgroundIntent(alarmId: options.id, snoozeDuration: snoozeDuration, payload: "snooze")
            } else {
              alertPresentation = AlarmPresentation.Alert(
                title: LocalizedStringResource(stringLiteral: options.title),
                stopButton: stopButton
              )
            }
            
            let finalTintColor: Color = (options.tintColor != nil && !options.tintColor!.isEmpty) ? Color(hex: options.tintColor!) : .orange
            
            let attributes = AlarmAttributes<AlarmData>(
              presentation: AlarmPresentation(alert: alertPresentation),
              metadata: nil,
              tintColor: finalTintColor
            )
            
            let soundName = options.soundName ?? ""
            let configuration = AlarmManager.AlarmConfiguration<AlarmData>(
              schedule: schedule,
              attributes: attributes,
              stopIntent: stopIntent,
              secondaryIntent: secondaryIntent,
              sound: !soundName.isEmpty ? .named(soundName) : .default
            )
            
            _ = try await AlarmManager.shared.schedule(id: uuid, configuration: configuration)
            
            // Update persistence in UserDefaults
            var alarms = self.getPersistedAlarms()
            alarms.removeAll { ($0["id"] as? String) == options.id }
            
            let record: [String: Any] = [
              "id": options.id,
              "title": options.title,
              "type": "repeating",
              "hour": options.hour,
              "minute": options.minute,
              "weekdays": options.weekdays,
              "soundName": soundName,
              "launchAppOnDismiss": launchAppOnDismiss,
              "launchAppOnSnooze": launchAppOnSnooze,
              "doSnoozeIntent": options.doSnoozeIntent,
              "snoozeDuration": snoozeDuration,
              "tintColor": options.tintColor ?? ""
            ]
            alarms.append(record)
            self.savePersistedAlarms(alarms)
            
            promise.resolve(true)
          } catch {
            promise.reject("ERR_SCHEDULE_FAILED", error.localizedDescription)
          }
        }
      } else {
        promise.reject("ERR_NOT_SUPPORTED", "AlarmKit is only supported on iOS 26.0 or later")
      }
    }

    AsyncFunction("cancelAlarm") { (id: String, promise: Promise) in
      if #available(iOS 26.0, *) {
        do {
          guard let uuid = UUID(uuidString: id) else {
            promise.reject("ERR_INVALID_ID", "Alarm ID must be a valid UUID string")
            return
          }
          
          try AlarmManager.shared.cancel(id: uuid)
          
          // Update persistence in UserDefaults
          var alarms = self.getPersistedAlarms()
          alarms.removeAll { ($0["id"] as? String) == id }
          self.savePersistedAlarms(alarms)
          
          promise.resolve(true)
        } catch {
          promise.reject("ERR_CANCEL_FAILED", error.localizedDescription)
        }
      } else {
        // Fallback for older versions: update local storage
        var alarms = self.getPersistedAlarms()
        alarms.removeAll { ($0["id"] as? String) == id }
        self.savePersistedAlarms(alarms)
        promise.resolve(true)
      }
    }

    AsyncFunction("stopAlarm") { (id: String, promise: Promise) in
      if #available(iOS 26.0, *) {
        do {
          try await AlarmStopHelper.performStop(alarmId: id, payload: "dismiss")
          promise.resolve(true)
        } catch {
          promise.reject("ERR_STOP_FAILED", error.localizedDescription)
        }
      } else {
        promise.resolve(true)
      }
    }

    Function("getAllAlarms") { () -> [[String: Any]] in
      // Retrieve direct from App Group UserDefaults as source of truth
      return self.getPersistedAlarms()
    }

    Function("getLaunchPayload") { () -> [String: String]? in
      // FLAG_APP_GROUP_ID_MATCHING: App Group ID used as suiteName
      guard let defaults = UserDefaults(suiteName: "group.com.tsouvili.wakey"),
            let payload = defaults.dictionary(forKey: "launch_payload") as? [String: String] else {
        return nil
      }
      
      // Read and clear payload queue
      defaults.removeObject(forKey: "launch_payload")
      defaults.synchronize()
      
      return payload
    }
  }
}
