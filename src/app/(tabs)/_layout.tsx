import AppTabs from '@/components/app-tabs';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { RevenueCatProvider } from '../../../providers/RevenueCat';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return (
    <RevenueCatProvider>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AppTabs />
      </ThemeProvider>
    </RevenueCatProvider>
  );
}
