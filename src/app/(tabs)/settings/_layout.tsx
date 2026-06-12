import { useTheme } from '@/hooks/use-theme';
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack } from "expo-router";

export default function Layout() {
    const theme = useTheme();

    return (
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
    );
}