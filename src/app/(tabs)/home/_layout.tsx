import { useTheme } from '@/hooks/use-theme';
import { Stack } from "expo-router";

export default function Layout() {
    const theme = useTheme();

    return (
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
                    presentation: 'formSheet',
                    sheetAllowedDetents: [0.75],
                    sheetGrabberVisible: true,
                    headerTransparent: true,
                    headerTitle: "New Alarm",
                }} 
            />
        </Stack>
    );
}