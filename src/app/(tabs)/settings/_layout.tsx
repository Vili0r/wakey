import { useTheme } from '@/hooks/use-theme';
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack } from "expo-router";
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function Layout() {
    const theme = useTheme();
    const isDark = useColorScheme() === 'dark';

    return (
        <>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack screenOptions={{ contentStyle: { backgroundColor: theme.background } }}>
            <Stack.Screen
                name="index"
                options={{
                    title: 'Settings',
                    headerStyle: { backgroundColor: theme.background },
                    headerShadowVisible: false,
                    headerTransparent: true,
                    headerLargeStyle: { backgroundColor: "transparent" },
                    headerBlurEffect: isLiquidGlassAvailable() ? undefined : "dark",
                }}
            />
        </Stack>
      </>
    );
}