import { createWidget, createLiveActivity, type WidgetEnvironment, type LiveActivityEnvironment } from 'expo-widgets';
import { Text, VStack, HStack, Image } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';

export interface WidgetProps {
  title: string;
  timeString: string;
  hasAlarm: boolean;
}

export function NextAlarmWidgetComponent(props: WidgetProps, environment: WidgetEnvironment) {
  'widget';
  
  const { widgetFamily } = environment;

  // 1. Accessory Inline (Lock screen inline)
  if (widgetFamily === 'accessoryInline') {
    return (
      <Text>
        {props.hasAlarm ? `⏰ ${props.timeString}` : 'No Alarm'}
      </Text>
    );
  }

  // 2. Accessory Rectangular (Lock screen widget)
  if (widgetFamily === 'accessoryRectangular') {
    return (
      <VStack alignment="leading">
        <Text>⏰ Next Alarm</Text>
        <Text>{props.hasAlarm ? `${props.timeString} - ${props.title}` : 'None'}</Text>
      </VStack>
    );
  }

  // 3. System Small (Small Home Screen widget)
  if (widgetFamily === 'systemSmall') {
    return (
      <VStack alignment="leading" spacing={8}>
        <Text>⏰ Alarm</Text>
        {props.hasAlarm ? (
          <VStack alignment="leading" spacing={2}>
            <Text>{props.timeString}</Text>
            <Text>{props.title}</Text>
          </VStack>
        ) : (
          <Text>None Scheduled</Text>
        )}
      </VStack>
    );
  }

  // 4. Default System Medium (Medium Home Screen widget)
  return (
    <HStack spacing={16}>
      <VStack alignment="leading" spacing={4}>
        <Text>⏰ Upcoming Alarm</Text>
        <Text>Wakey App</Text>
      </VStack>
      <VStack alignment="leading" spacing={4}>
        {props.hasAlarm ? (
          <VStack alignment="leading" spacing={2}>
            <Text>{props.timeString}</Text>
            <Text>{props.title}</Text>
          </VStack>
        ) : (
          <Text>No Upcoming Alarms</Text>
        )}
      </VStack>
    </HStack>
  );
}

// Register the widget. Name matches app.json NextAlarmWidget config exactly.
export const nextAlarmWidget = createWidget('NextAlarmWidget', NextAlarmWidgetComponent);


// --- Snooze Live Activity ---

export interface SnoozeCountdownProps {
  fireDate: number; // epoch timestamp
  title: string;
}

export function SnoozeCountdownComponent(props: SnoozeCountdownProps, environment: LiveActivityEnvironment) {
  'widget';
  
  const accentColor = '#F59E0B'; // Alarm yellow/orange tint
  const startDate = new Date();
  const endDate = new Date(props.fireDate);

  return {
    banner: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <HStack spacing={8}>
          <Image systemName="clock.arrow.2.circlepath" color={accentColor} />
          <Text modifiers={[font({ weight: 'bold' }), foregroundStyle(accentColor)]}>
            {props.title} (Snoozed)
          </Text>
        </HStack>
        <HStack spacing={4}>
          <Text>Next Alarm: </Text>
          <Text 
            timerInterval={{ lower: startDate, upper: endDate }} 
            countsDown={true} 
            modifiers={[font({ weight: 'bold' })]}
          />
        </HStack>
      </VStack>
    ),
    compactLeading: (
      <Image systemName="clock.arrow.2.circlepath" color={accentColor} />
    ),
    compactTrailing: (
      <Text timerInterval={{ lower: startDate, upper: endDate }} countsDown={true} />
    ),
    minimal: (
      <Image systemName="clock.arrow.2.circlepath" color={accentColor} />
    ),
    expandedLeading: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Image systemName="clock.arrow.2.circlepath" color={accentColor} />
        <Text modifiers={[font({ size: 10 })]}>Snoozed</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ weight: 'bold', size: 18 }), foregroundStyle(accentColor)]}>
          <Text timerInterval={{ lower: startDate, upper: endDate }} countsDown={true} />
        </Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ weight: 'medium' })]}>{props.title}</Text>
      </VStack>
    ),
  };
}

export const snoozeCountdownActivity = createLiveActivity('SnoozeCountdown', SnoozeCountdownComponent);
