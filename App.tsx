// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Balance contributors

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MD3DarkTheme, MD3LightTheme, Provider as PaperProvider } from "react-native-paper";
import { enableScreens } from "react-native-screens";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import GlassBlur from "@/ui/components/GlassBlur";
import * as SplashScreen from "expo-splash-screen";
import AnimatedSplashOverlay from "@/ui/splash/AnimatedSplashOverlay";
import { useAppBootstrap } from "@/app/useAppBootstrap";
import DashboardScreen from "@/ui/screens/DashboardScreen";
import EntriesScreen from "@/ui/screens/EntriesScreen";
import SnapshotScreen from "@/ui/screens/SnapshotScreen";
import WalletScreen from "@/ui/screens/WalletScreen";
import SettingsScreen from "@/ui/screens/SettingsScreen";
import { ThemeContext } from "@/ui/theme";
import GlassTabBar from "@/ui/components/GlassTabBar";
import AppBackground from "@/ui/components/AppBackground";
import AppBootScreen from "@/ui/components/AppBootScreen";
import { DashboardThemeProvider } from "@/ui/dashboard/theme";
import ProfileButton from "@/components/header/ProfileButton";
import OnboardingNavigator from "@/onboarding/OnboardingNavigator";
import { OnboardingFlowProvider } from "@/onboarding/flowContext";
import { getOnboardingCompleted, setOnboardingCompleted } from "@/onboarding/onboardingStorage";
import { StatusBar } from "expo-status-bar";
import SecurityGate from "@/security/SecurityGate";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SetPinModal from "@/security/modals/SetPinModal";
import VerifyPinModal from "@/security/modals/VerifyPinModal";
import { getSecurityConfig } from "@/security/securityStorage";
import type { SecurityModalStackParamList } from "@/security/securityFlowsTypes";
import { initI18n } from "@/i18n";
import i18n from "i18next";
import { SettingsProvider } from "@/settings/useSettings";

enableScreens(false);

const Tab = createBottomTabNavigator();
type RootStackParamList = SecurityModalStackParamList & {
  MainContent: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

let splashPrevented = false;
if (!splashPrevented) {
  void SplashScreen.preventAutoHideAsync();
  splashPrevented = true;
}

export default function App(): JSX.Element {
  const { ready, error, themeMode, setThemeMode, retry } = useAppBootstrap();
  const [i18nReady, setI18nReady] = useState(false);
  const [onboardingCompleted, setOnboardingCompletedState] = useState<boolean | null>(null);
  const [manualOnboarding, setManualOnboarding] = useState(false);
  const [seedOnCompleteRequested, setSeedOnCompleteRequested] = useState(false);

  useEffect(() => {
    let mounted = true;
    void initI18n()
      .catch((error) => {
        console.warn("Failed to initialize localization:", error);
      })
      .finally(() => {
        if (mounted) {
          setI18nReady(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getOnboardingCompleted().then((value) => {
      if (mounted) setOnboardingCompletedState(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setManualOnboarding(false);
    setSeedOnCompleteRequested(false);
    void setOnboardingCompleted(true);
    setOnboardingCompletedState(true);
  }, []);

  const requestManualOnboarding = useCallback((options?: { seed?: boolean }) => {
    setManualOnboarding(true);
    setSeedOnCompleteRequested(Boolean(options?.seed));
  }, []);

  const [securityReady, setSecurityReady] = useState(false);
  const [overlayActive, setOverlayActive] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const splashHiddenRef = useRef(false);

  useEffect(() => {
    let active = true;
    getSecurityConfig()
      .then(() => {
        if (active) {
          setSecurityReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setSecurityReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const appReady = ready && securityReady;
  useEffect(() => {
    if (!appReady || !overlayVisible) {
      return;
    }
    let active = true;

    const revealApp = async () => {
      if (!splashHiddenRef.current) {
        try {
          await SplashScreen.hideAsync();
        } catch (error) {
          console.warn("Failed to hide native splash screen:", error);
        } finally {
          splashHiddenRef.current = true;
        }
      }

      if (active) {
        setOverlayActive(true);
      }
    };

    void revealApp();

    return () => {
      active = false;
    };
  }, [appReady, overlayVisible]);

  const handleSplashComplete = useCallback(() => {
    setOverlayActive(false);
    setOverlayVisible(false);
  }, []);

  const paperTheme =
    themeMode === "dark"
      ? {
          ...MD3DarkTheme,
          colors: {
            ...MD3DarkTheme.colors,
            primary: "#A97CFF",
            secondary: "#6BA3FF",
          },
        }
      : {
          ...MD3LightTheme,
          colors: {
            ...MD3LightTheme.colors,
            primary: "#A97CFF",
            secondary: "#A97CFF",
          },
        };
  const navTheme = themeMode === "dark" ? DarkTheme : DefaultTheme;
  const headerBlurTint = themeMode === "dark" ? "dark" : "light";
  const headerOverlay =
    themeMode === "dark" ? "rgba(15, 18, 30, 0.55)" : "rgba(169, 124, 255, 0.32)";
  const headerBorder = themeMode === "dark" ? navTheme.colors.border : "rgba(169, 124, 255, 0.5)";
  const isFirstOnboarding = onboardingCompleted !== true && !manualOnboarding;
  const shouldSeedOnComplete = isFirstOnboarding || seedOnCompleteRequested;

  if (!i18nReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeContext.Provider value={{ mode: themeMode, setMode: setThemeMode }}>
        <PaperProvider theme={paperTheme}>
          <View style={{ flex: 1 }}>
            <SecurityGate>
              <DashboardThemeProvider isDark={paperTheme.dark}>
                <SettingsProvider>
                  <AppBackground>
                    <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
                    {!ready ? (
                      <AppBootScreen status="loading" />
                    ) : error ? (
                      <AppBootScreen status="error" error={error} onRetry={retry} />
                    ) : (
                      <OnboardingFlowProvider value={{ requestReplay: requestManualOnboarding }}>
                        <NavigationContainer theme={navTheme}>
                          <RootStack.Navigator screenOptions={{ headerShown: false }}>
                            <RootStack.Screen name="MainContent">
                              {() =>
                                !onboardingCompleted || manualOnboarding ? (
                                  <OnboardingNavigator
                                    onComplete={handleOnboardingComplete}
                                    shouldSeedOnComplete={shouldSeedOnComplete}
                                  />
                                ) : (
                                  <Tab.Navigator
                                    screenOptions={({ route }) => ({
                                      headerTitleAlign: "center",
                                      headerTransparent: true,
                                      headerBackground: () =>
                                        Platform.OS === "android" ? (
                                          <View
                                            style={[
                                              StyleSheet.absoluteFill,
                                              {
                                                borderBottomWidth: 1,
                                                borderBottomColor: headerBorder,
                                                backgroundColor: paperTheme.dark ? "#141923" : "#FFFFFF",
                                              },
                                            ]}
                                          />
                                        ) : (
                                          <GlassBlur
                                            intensity={35}
                                            tint={headerBlurTint}
                                            fallbackColor="transparent"
                                            style={[
                                              StyleSheet.absoluteFill,
                                              {
                                                borderBottomWidth: 1,
                                                borderBottomColor: headerBorder,
                                                backgroundColor: headerOverlay,
                                              },
                                            ]}
                                          />
                                        ),
                                      headerLeft: () => (
                                        <ProfileButton
                                          isSettingsScreen={route.name === "Impostazioni"}
                                          position="left"
                                        />
                                      ),
                                      tabBarStyle: { display: "none" },
                                    })}
                                    tabBar={(props) => <GlassTabBar {...props} />}
                                  >
                                    <Tab.Screen name="Dashboard" component={DashboardScreen} />
                                    <Tab.Screen name="Snapshot" component={SnapshotScreen} />
                                    <Tab.Screen name="Wallet" component={WalletScreen} />
                                    <Tab.Screen
                                      name="Balance"
                                      component={EntriesScreen}
                                      options={{ tabBarLabel: "Balance" }}
                                    />
                                    <Tab.Screen
                                      name="Impostazioni"
                                      component={SettingsScreen}
                                      options={{ tabBarButton: () => null }}
                                    />
                                  </Tab.Navigator>
                                )
                              }
                            </RootStack.Screen>
                            <RootStack.Group screenOptions={{ presentation: "modal", headerShown: false }}>
                              <RootStack.Screen name="SetPinModal" component={SetPinModal} />
                              <RootStack.Screen name="VerifyPinModal" component={VerifyPinModal} />
                            </RootStack.Group>
                          </RootStack.Navigator>
                        </NavigationContainer>
                      </OnboardingFlowProvider>
                    )}
                  </AppBackground>
                </SettingsProvider>
              </DashboardThemeProvider>
            </SecurityGate>
            <AnimatedSplashOverlay
              visible={overlayVisible}
              active={overlayActive}
              themeMode={themeMode}
              onAnimationComplete={handleSplashComplete}
            />
          </View>
        </PaperProvider>
      </ThemeContext.Provider>
    </GestureHandlerRootView>
  );
}
