/// <reference types="react" />
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Switch, Text, TextInput } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { exportToJson, importFromFile, importFromJson } from "@/importExport";
import type { ExportPayload } from "@/importExport/types";
import { runMigrations, withTransaction } from "@/db/db";
import { emitDataReset } from "@/app/dataEvents";
import { loadSampleData as seedSampleData } from "@/seed/sampleData";
import { getPreference, setPreference } from "@/repositories/preferencesRepo";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { ThemeContext } from "@/ui/theme";
import { useOnboardingFlow } from "@/onboarding/flowContext";
import type { StorageAccessFrameworkIO } from "expo-file-system";
import SecuritySettingsSection from "@/security/SecuritySettingsSection";
import {
  getSecurityConfig,
  setBiometryEnabled,
  getAutoLockEnabled,
  setAutoLockEnabled,
} from "@/security/securityStorage";
import { isBiometryAvailable } from "@/security/securityBiometry";
import { handleSecurityToggle as handleSecurityToggleFlow } from "@/security/securityFlowsEnableOnly";
import { openSetOrChangePinFlow } from "@/security/securityFlowsPinOnly";
import { useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { disableSecurityFlow } from "@/security/securityFlowsDisableOnly";
import { handleBiometryToggle as handleBiometryToggleFlow } from "@/security/securityFlowsBiometryOnly";
import type { SecurityModalStackParamList } from "@/security/securityFlowsTypes";
import { useTranslation } from "react-i18next";
import { STORAGE_KEY, SupportedLanguage } from "@/i18n";
import { useSettings } from "@/settings/useSettings";
import {
  setDisplayName,
  setHasInvestments,
  setInitialSeedDone,
  setOnboardingCompleted,
} from "@/onboarding/onboardingStorage";
import AppBackground from "@/ui/components/AppBackground";
import { GlassCardContainer, PrimaryPillButton, SegmentedControlPill, SmallOutlinePillButton } from "@/ui/components/EntriesUI";
import { MaterialCommunityIcons } from "@expo/vector-icons";

function findSecurityModalNavigation(
  navigation: NavigationProp<ParamListBase>
): NavigationProp<SecurityModalStackParamList> | undefined {
  let current: NavigationProp<ParamListBase> | undefined = navigation;
  while (current) {
    const state = current.getState?.();
    if (state?.routeNames?.includes("SetPinModal") && state.routeNames.includes("VerifyPinModal")) {
      return current as NavigationProp<SecurityModalStackParamList>;
    }
    current = current.getParent?.();
  }
  return undefined;
}

export default function SettingsScreen(): JSX.Element {
  const { tokens } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [profileName, setProfileName] = useState("");
  const [prefillSnapshot, setPrefillSnapshot] = useState(true);
  const [chartMonths, setChartMonths] = useState(6);
  const [securityEnabled, setSecurityEnabledState] = useState(false);
  const [biometryEnabled, setBiometryEnabledState] = useState(false);
  const [pinHashExists, setPinHashExists] = useState(false);
  const [biometryAvailable, setBiometryAvailable] = useState(false);
  const [autoLockEnabled, setAutoLockEnabledState] = useState(false);
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const securityModalNavigation = useMemo(
    () => findSecurityModalNavigation(navigation),
    [navigation]
  );
  const { mode, setMode } = useContext(ThemeContext);
  const { requestReplay } = useOnboardingFlow();
  const { t, i18n } = useTranslation();
  const { showInvestments, setShowInvestments } = useSettings();

  const currentLanguage = (i18n.resolvedLanguage ?? i18n.language ?? "it") as SupportedLanguage;

  const handleLanguageChange = useCallback(
    async (next: SupportedLanguage) => {
      if (next === currentLanguage) return;
      await AsyncStorage.setItem(STORAGE_KEY, next);
      await i18n.changeLanguage(next);
    },
    [currentLanguage, i18n]
  );

  const load = useCallback(async () => {
    const [name, prefill, points] = await Promise.all([
      getPreference("profile_name"),
      getPreference("prefill_snapshot"),
      getPreference("chart_points"),
    ]);
    setProfileName(name?.value ?? "");
    setPrefillSnapshot(prefill ? prefill.value === "true" : true);
    const parsedPoints = points ? Number(points.value) : 6;
    const safePoints = Number.isFinite(parsedPoints) ? Math.min(12, Math.max(3, parsedPoints)) : 6;
    setChartMonths(safePoints);
  }, []);

  const updatePreference = async (key: string, value: string) => {
    await setPreference(key, value);
  };

  const confirmWipeAndReplace = async (titleKey: string, bodyKey: string): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(
        t(titleKey),
        t(bodyKey),
        [
          { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
          { text: t("common.confirm"), style: "destructive", onPress: () => resolve(true) },
        ],
        { cancelable: true }
      );
    });

  const importData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const confirmed = await confirmWipeAndReplace(
        "alerts.settings.import.title",
        "alerts.settings.import.body"
      );
      if (!confirmed) return;
      await importFromFile(result.assets[0].uri);
    } catch (error) {
      console.warn(error);
    }
  };

  const exportData = async () => {
  const fileName = "balance-export.json";
    try {
      const payload = (await exportToJson()) as ExportPayload;
      const json = JSON.stringify(payload, null, 2);
      const storageAccess =
        (FileSystem as typeof FileSystem & { StorageAccessFramework?: StorageAccessFrameworkIO }).StorageAccessFramework;
      if (Platform.OS === "android" && storageAccess?.requestDirectoryPermissionsAsync) {
        const permission = await storageAccess.requestDirectoryPermissionsAsync();
        if (!permission.granted || !permission.directoryUri) {
          return;
        }
        const fileUri = await storageAccess.createFileAsync(
          permission.directoryUri,
          fileName,
          "application/json"
        );
        if (storageAccess.writeAsStringAsync) {
          await storageAccess.writeAsStringAsync(fileUri, json);
        } else {
          await LegacyFileSystem.writeAsStringAsync(fileUri, json);
        }
        return;
      }
      const cacheDir =
        (FileSystem as typeof FileSystem & { cacheDirectory?: string }).cacheDirectory ??
        LegacyFileSystem.cacheDirectory;
      const docDir =
        (FileSystem as typeof FileSystem & { documentDirectory?: string }).documentDirectory ??
        LegacyFileSystem.documentDirectory;
      let baseDir =
        cacheDir ??
        docDir ??
        (FileSystem as typeof FileSystem & { temporaryDirectory?: string }).temporaryDirectory ??
        LegacyFileSystem.temporaryDirectory;
      if (!baseDir && FileSystem.getInfoAsync) {
        if (docDir) {
          const info = await FileSystem.getInfoAsync(docDir);
          if (info.exists) baseDir = docDir;
        }
        if (!baseDir && cacheDir) {
          const info = await FileSystem.getInfoAsync(cacheDir);
          if (info.exists) baseDir = cacheDir;
        }
      }
      if (!baseDir) {
        return;
      }
      const path = `${baseDir}${fileName}`;
      await LegacyFileSystem.writeAsStringAsync(path, json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: "application/json",
          dialogTitle: t("alerts.settings.export.title"),
        });
        return;
      }
    } catch (error) {
      console.warn(error);
    }
  };

  const confirmReset = async (): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(
        t("alerts.settings.reset.title"),
        t("alerts.settings.reset.body"),
        [
          { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
          { text: t("settings.reset"), style: "destructive", onPress: () => resolve(true) },
        ],
        { cancelable: true }
      );
    });

  const resetData = async () => {
    const confirmed = await confirmReset();
    if (!confirmed) return;
    await withTransaction(async (db) => {
      const tables = [
        "snapshot_lines",
        "snapshots",
        "income_entries",
        "expense_entries",
        "wallets",
        "expense_categories",
        "preferences",
      ];
      for (const table of tables) {
        await db.runAsync(`DELETE FROM ${table}`);
      }
    });
    await setDisplayName("");
    await setHasInvestments(false);
    await setInitialSeedDone(false);
    await setOnboardingCompleted(false);
    await setShowInvestments(false);
    requestReplay();
    emitDataReset();
  };

  const loadSampleDataHandler = useCallback(async () => {
    try {
      await seedSampleData();
    } catch (error) {
      console.warn(error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refreshSecurityState = useCallback(async () => {
    const config = await getSecurityConfig();
    const available = await isBiometryAvailable();
    if (!available && config.biometryEnabled) {
      await setBiometryEnabled(false);
    }
    setSecurityEnabledState(config.securityEnabled);
    setBiometryEnabledState(available ? config.biometryEnabled : false);
    setPinHashExists(Boolean(config.pinHash));
    setBiometryAvailable(available);
    setAutoLockEnabledState(config.autoLockEnabled);
  }, []);

  useEffect(() => {
    refreshSecurityState();
  }, [refreshSecurityState]);

  const handleSecurityToggle = useCallback(
    async (next: boolean) => {
      if (!securityModalNavigation) {
        return;
      }
      await handleSecurityToggleFlow(
        next,
        securityModalNavigation as NavigationProp<Pick<SecurityModalStackParamList, "SetPinModal">>
      );
      await refreshSecurityState();
    },
    [refreshSecurityState, securityModalNavigation]
  );

  const handleBiometryToggle = useCallback(
    async (next: boolean) => {
      await handleBiometryToggleFlow(next, securityEnabled);
      await refreshSecurityState();
    },
    [refreshSecurityState, securityEnabled]
  );

  const handleAutoLockToggle = useCallback(async (next: boolean) => {
    await setAutoLockEnabled(next);
    setAutoLockEnabledState(next);
  }, []);

  const handleChangeOrSetPin = useCallback(() => {
    if (!securityModalNavigation) {
      return;
    }
    void openSetOrChangePinFlow(securityModalNavigation);
  }, [securityModalNavigation]);

  const handleDisableCode = useCallback(() => {
    if (!securityModalNavigation) {
      return;
    }
    void disableSecurityFlow(
      securityModalNavigation as NavigationProp<Pick<SecurityModalStackParamList, "VerifyPinModal">>
    );
  }, [securityModalNavigation]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void refreshSecurityState();
      return undefined;
    }, [load, refreshSecurityState])
  );

  const inputProps = {
    mode: "outlined" as const,
    outlineColor: tokens.colors.glassBorder,
    activeOutlineColor: tokens.colors.accent,
    textColor: tokens.colors.text,
    style: { backgroundColor: tokens.colors.glassBg },
  };
  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { gap: tokens.spacing.md, paddingBottom: 160 + insets.bottom, paddingTop: headerHeight + 12 },
        ]}
      >
        <GlassCardContainer contentStyle={styles.cardContent}>
            <SectionHeader title={t("settings.profile.title")} />
            <TextInput
              label={t("settings.profile.nameLabel")}
              value={profileName}
              {...inputProps}
              onChangeText={(value) => {
                setProfileName(value);
                void updatePreference("profile_name", value.trim());
              }}
            />
        </GlassCardContainer>

        <GlassCardContainer contentStyle={styles.cardContent}>
            <SectionHeader title={t("settings.preferences.title")} />
            <View style={styles.row}>
              <Text style={[styles.label, { color: tokens.colors.text }]}>{t("settings.preferences.darkTheme")}</Text>
              <Switch
                value={mode === "dark"}
                onValueChange={(value) => {
                  const next = value ? "dark" : "light";
                  setMode(next);
                  updatePreference("theme", next);
                }}
                color={tokens.colors.accent}
              />
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: tokens.colors.text }]}>{t("settings.preferences.prefillSnapshot")}</Text>
              <Switch
                value={prefillSnapshot}
                onValueChange={(value) => {
                  setPrefillSnapshot(value);
                  updatePreference("prefill_snapshot", String(value));
                }}
                color={tokens.colors.accent}
              />
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: tokens.colors.text }]}>{t("settings.preferences.showInvestments")}</Text>
              <Switch
                value={showInvestments}
                onValueChange={(value) => {
                  void setShowInvestments(value);
                }}
                color={tokens.colors.accent}
              />
            </View>
            <View style={[styles.row, styles.counterRow]}>
              <Text style={[styles.label, { color: tokens.colors.text }]}>{t("settings.preferences.monthsInChart")}</Text>
              <View style={styles.counterControls}>
                <SmallOutlinePillButton
                  label=""
                  icon={<MaterialCommunityIcons name="minus" size={16} color={tokens.colors.text} />}
                  color={tokens.colors.text}
                  onPress={() => {
                    const next = Math.max(3, chartMonths - 1);
                    setChartMonths(next);
                    updatePreference("chart_points", String(next));
                  }}
                />
                <Text style={[styles.counterValue, { color: tokens.colors.text }]}>{chartMonths}</Text>
                <SmallOutlinePillButton
                  label=""
                  icon={<MaterialCommunityIcons name="plus" size={16} color={tokens.colors.text} />}
                  color={tokens.colors.text}
                  onPress={() => {
                    const next = Math.min(12, chartMonths + 1);
                    setChartMonths(next);
                    updatePreference("chart_points", String(next));
                  }}
                />
              </View>
            </View>
            <View style={styles.languageRow}>
              <Text style={[styles.label, { color: tokens.colors.text }]}>{t("settings.preferences.languageLabel")}</Text>
              <View style={styles.segmentControl}>
                <SegmentedControlPill
                  value={currentLanguage}
                  onChange={(value) => {
                    void handleLanguageChange(value as SupportedLanguage);
                  }}
                  options={[
                    { value: "it", label: t("settings.preferences.language.it") },
                    { value: "en", label: t("settings.preferences.language.en") },
                  ]}
                />
              </View>
            </View>
        </GlassCardContainer>

        <SecuritySettingsSection
          securityEnabled={securityEnabled}
          biometryEnabled={biometryEnabled}
          pinHashExists={pinHashExists}
          biometryAvailable={biometryAvailable}
          onRequestEnableSecurity={handleSecurityToggle}
          onRequestChangeOrSetPin={handleChangeOrSetPin}
          onRequestDisableSecurity={handleDisableCode}
          onToggleBiometry={handleBiometryToggle}
          autoLockEnabled={autoLockEnabled}
          onToggleAutoLock={handleAutoLockToggle}
        />

        <GlassCardContainer contentStyle={styles.cardContent}>
            <SectionHeader title={t("settings.data.title")} />
            <PrimaryPillButton label={t("settings.data.export")} onPress={exportData} color={tokens.colors.accent} />
            <SmallOutlinePillButton label={t("settings.data.import")} onPress={importData} color={tokens.colors.text} fullWidth />
            <SmallOutlinePillButton
              label={t("settings.data.loadTestData")}
              onPress={loadSampleDataHandler}
              color={tokens.colors.text}
              fullWidth
            />
        </GlassCardContainer>

        <GlassCardContainer contentStyle={styles.cardContent}>
            <SectionHeader title={t("settings.onboarding.title")} />
            <View
              style={[
                styles.onboardingRow,
                { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.glassBg },
              ]}
            >
              <View style={styles.onboardingText}>
                <Text style={[styles.onboardingSubtitle, { color: tokens.colors.muted }]}>
                  {t("settings.onboarding.subtitle")}
                </Text>
              </View>
              <SmallOutlinePillButton
                label={t("settings.onboarding.reviewAction")}
                onPress={requestReplay}
                color={tokens.colors.accent}
              />
            </View>
        </GlassCardContainer>

        <View style={styles.resetContainer}>
          <SmallOutlinePillButton label={t("settings.reset")} onPress={resetData} color={tokens.colors.red} fullWidth />
        </View>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 16,
  },
  cardContent: {
    gap: 12,
  },
  resetContainer: {
    marginTop: 4,
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  counterRow: {
    alignItems: "center",
  },
  counterControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  counterValue: {
    minWidth: 24,
    textAlign: "center",
    fontWeight: "700",
  },
  onboardingRow: {
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    gap: 12,
  },
  onboardingText: {
    flex: 1,
  },
  onboardingTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  onboardingSubtitle: {
    fontSize: 12,
  },
  languageRow: {
    gap: 10,
  },
  segmentControl: {
    width: "100%",
  },
});
