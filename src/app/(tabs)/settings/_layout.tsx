import { useTheme } from '@/hooks/use-theme';
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from 'expo-status-bar';
import { Button, useColorScheme } from 'react-native';

export default function Layout() {
    const theme = useTheme();
    const isDark = useColorScheme() === 'dark';
    const router = useRouter();

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
            <Stack.Screen
                name="privacy"
                options={{
                    title: 'Privacy & Data',
                    headerStyle: { backgroundColor: theme.background },
                    headerShadowVisible: false,
                    headerTransparent: true,
                    headerLargeStyle: { backgroundColor: "transparent" },
                    headerBlurEffect: isLiquidGlassAvailable() ? undefined : "dark",
                }}
            />
            <Stack.Screen
                name="sounds"
                options={{
                    contentStyle: { backgroundColor: theme.background },
                    headerShown: true,
                    presentation: 'formSheet',
                    sheetAllowedDetents: [0.75],
                    sheetGrabberVisible: true,
                    title: '',
                    headerRight: () => (
                        <Button title="Done" onPress={() => router.dismiss()} color={theme.text} />
                    ),
                }}
            />
            <Stack.Screen
                name="challenge"
                options={{
                    contentStyle: { backgroundColor: theme.background },
                    headerShown: true,
                    presentation: 'formSheet',
                    sheetAllowedDetents: [0.9],
                    sheetGrabberVisible: true,
                    title: '',
                    headerRight: () => (
                        <Button title="Done" onPress={() => router.dismiss()} color={theme.text} />
                    ),
                }}
            />
        </Stack>
      </>
    );
}