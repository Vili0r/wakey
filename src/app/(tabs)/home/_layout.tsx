import { useTheme } from '@/hooks/use-theme';
import { Stack, useRouter } from "expo-router";
import { Button, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function Layout() {
    const router = useRouter();
    const theme = useTheme();
    const isDark = useColorScheme() === 'dark';

    return (
        <>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack screenOptions={{ contentStyle: { backgroundColor: theme.background } }}>
            <Stack.Screen
                name="index"
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="new-alarm"
                options={{
                    contentStyle: { backgroundColor: theme.background },
                    headerShown: true,
                    presentation: 'modal',
                    headerTransparent: true,
                    headerTitle: "New Alarm",
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
                    sheetAllowedDetents: [0.85],
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