import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MD3DarkTheme, MD3LightTheme, Provider as PaperProvider } from "react-native-paper";
import { enableScreens } from "react-native-screens";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { runMigrations } from "@/db/db";
import { ensureDefaultWallets } from "@/repositories/walletsRepo";
import { getPreference } from "@/repositories/preferencesRepo";
import DashboardScreen from "@/ui/screens/DashboardScreen";
import EntriesScreen from "@/ui/screens/EntriesScreen";
import SnapshotScreen from "@/ui/screens/SnapshotScreen";
import SettingsScreen from "@/ui/screens/SettingsScreen";
import { ThemeContext } from "@/ui/theme";
import GlassTabBar from "@/ui/components/GlassTabBar";
import AppBackground from "@/ui/components/AppBackground";

enableScreens(false);

const Tab = createBottomTabNavigator();

export default function App(): JSX.Element {
  const [ready, setReady] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    let mounted = true;
    runMigrations()
      .then(async () => {
        await ensureDefaultWallets();
        const pref = await getPreference("theme");
        if (mounted && pref?.value === "dark") {
          setThemeMode("dark");
        }
        if (mounted) setReady(true);
      })
      .catch(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) return <></>;

  const paperTheme = themeMode === "dark" ? MD3DarkTheme : MD3LightTheme;
  const navTheme = themeMode === "dark" ? DarkTheme : DefaultTheme;

  return (
    <ThemeContext.Provider value={{ mode: themeMode, setMode: setThemeMode }}>
      <PaperProvider theme={paperTheme}>
        <AppBackground>
          <NavigationContainer theme={navTheme}>
            <Tab.Navigator
              screenOptions={({ route }) => ({
                headerTitleAlign: "center",
                tabBarStyle: { display: "none" },
              })}
              tabBar={(props) => <GlassTabBar {...props} />}
            >
              <Tab.Screen name="Dashboard" component={DashboardScreen} />
              <Tab.Screen name="Snapshot" component={SnapshotScreen} />
              <Tab.Screen name="Entrate/Uscite" component={EntriesScreen} />
              <Tab.Screen name="Impostazioni" component={SettingsScreen} />
            </Tab.Navigator>
          </NavigationContainer>
        </AppBackground>
      </PaperProvider>
    </ThemeContext.Provider>
  );
}
