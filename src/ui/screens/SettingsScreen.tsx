/// <reference types="react" />
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Button, SegmentedButtons, Switch, Text, TextInput } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { exportToJson, importFromFile, importFromJson } from "@/importExport";
import type { ExportPayload } from "@/importExport/types";
import { runMigrations, withTransaction } from "@/db/db";
import { emitDataReset } from "@/app/dataEvents";
import { loadSampleData as seedSampleData } from "@/seed/sampleData";
import { ensureDefaultWallets } from "@/repositories/walletsRepo";
import { getPreference, setPreference } from "@/repositories/preferencesRepo";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
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
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { disableSecurityFlow } from "@/security/securityFlowsDisableOnly";
import { handleBiometryToggle as handleBiometryToggleFlow } from "@/security/securityFlowsBiometryOnly";
import type { SecurityModalStackParamList } from "@/security/securityFlowsTypes";
import { useTranslation } from "react-i18next";
import { STORAGE_KEY, SupportedLanguage } from "@/i18n";
import { useSettings } from "@/settings/useSettings";

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
  const [refreshing, setRefreshing] = useState(false);
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

  const pasteFromClipboard = async () => {
    try {
      const copy = (await Clipboard.getStringAsync())?.trim();
      if (!copy) return;
      const confirmed = await confirmWipeAndReplace(
        "alerts.settings.pasteJson.title",
        "alerts.settings.pasteJson.body"
      );
      if (!confirmed) return;
      let payload: unknown;
      try {
        payload = JSON.parse(copy);
      } catch {
        return;
      }
      await runMigrations();
      await importFromJson(payload);
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
      ];
      for (const table of tables) {
        await db.runAsync(`DELETE FROM ${table}`);
      }
    });
    await ensureDefaultWallets();
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

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const inputProps = {
    mode: "outlined" as const,
    outlineColor: tokens.colors.border,
    activeOutlineColor: tokens.colors.accent,
    textColor: tokens.colors.text,
    style: { backgroundColor: tokens.colors.surface2 },
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.colors.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { gap: tokens.spacing.md, paddingBottom: 160 + insets.bottom, paddingTop: headerHeight + 12 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.accent} />}
      >
        <PremiumCard>
          <SectionHeader title={t("settings.profile.title")} />
          <View style={styles.form}>
            <TextInput
              label={t("settings.profile.nameLabel")}
              value={profileName}
              {...inputProps}
              onChangeText={(value) => {
                setProfileName(value);
                void updatePreference("profile_name", value.trim());
              }}
            />
          </View>
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title={t("settings.preferences.title")} />
          <View style={styles.sectionContent}>
            <View style={styles.row}>
              <Switch
                value={mode === "dark"}
                onValueChange={(value) => {
                  const next = value ? "dark" : "light";
                  setMode(next);
                  updatePreference("theme", next);
                }}
              />
              <Text style={{ color: tokens.colors.text }}>{t("settings.preferences.darkTheme")}</Text>
            </View>
            <View style={styles.row}>
              <Switch
                value={prefillSnapshot}
                onValueChange={(value) => {
                  setPrefillSnapshot(value);
                  updatePreference("prefill_snapshot", String(value));
                }}
              />
              <Text style={{ color: tokens.colors.text }}>{t("settings.preferences.prefillSnapshot")}</Text>
            </View>
            <View style={styles.row}>
              <Switch
                value={showInvestments}
                onValueChange={(value) => {
                  void setShowInvestments(value);
                }}
                color={tokens.colors.accent}
              />
              <Text style={{ color: tokens.colors.text }}>{t("settings.preferences.showInvestments")}</Text>
            </View>
            <View style={[styles.row, { gap: 12, marginTop: 8 }]}>
              <Text style={{ color: tokens.colors.text }}>{t("settings.preferences.monthsInChart")}</Text>
              <Button
                mode="outlined"
                textColor={tokens.colors.text}
                onPress={() => {
                  const next = Math.max(3, chartMonths - 1);
                  setChartMonths(next);
                  updatePreference("chart_points", String(next));
                }}
              >
                -
              </Button>
              <Text style={{ color: tokens.colors.text }}>{chartMonths}</Text>
              <Button
                mode="outlined"
                textColor={tokens.colors.text}
                onPress={() => {
                  const next = Math.min(12, chartMonths + 1);
                  setChartMonths(next);
                  updatePreference("chart_points", String(next));
                }}
              >
                +
              </Button>
            </View>
            <View style={[styles.languageRow, { marginTop: 12 }]}>
              <Text style={{ color: tokens.colors.text }}>
                {t("settings.preferences.languageLabel")}
              </Text>
              <SegmentedButtons
                value={currentLanguage}
                onValueChange={(value) => {
                  void handleLanguageChange(value as SupportedLanguage);
                }}
                buttons={[
                  { value: "it", label: t("settings.preferences.language.it") },
                  { value: "en", label: t("settings.preferences.language.en") },
                ]}
                style={styles.languageControls}
              />
            </View>
          </View>
        </PremiumCard>

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

        <PremiumCard>
          <SectionHeader title={t("settings.data.title")} />
          <View style={styles.sectionContent}>
            <Button mode="contained" buttonColor={tokens.colors.accent} onPress={exportData}>
              {t("settings.data.export")}
            </Button>
            <Button
              mode="outlined"
              textColor={tokens.colors.accent}
              style={{ borderColor: tokens.colors.accent }}
              onPress={importData}
            >
              {t("settings.data.import")}
            </Button>
            <Button
              mode="outlined"
              textColor={tokens.colors.accent}
              onPress={pasteFromClipboard}
              style={{ borderColor: tokens.colors.accent }}
            >
              {t("settings.data.pasteJsonFromClipboard")}
            </Button>
            <Button
              mode="outlined"
              textColor={tokens.colors.accent}
              style={{ borderColor: tokens.colors.accent }}
              onPress={loadSampleDataHandler}
            >
              {t("settings.data.loadTestData")}
            </Button>
            <View style={[styles.onboardingRow, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface2 }]}>
              <View style={styles.onboardingText}>
                <Text style={[styles.onboardingTitle, { color: tokens.colors.text }]}>
                  {t("settings.onboarding.title")}
                </Text>
                <Text style={[styles.onboardingSubtitle, { color: tokens.colors.muted }]}>
                  {t("settings.onboarding.subtitle")}
                </Text>
              </View>
              <Button mode="text" textColor={tokens.colors.accent} onPress={requestReplay}>
                {t("settings.onboarding.reviewAction")}
              </Button>
            </View>
            <Button mode="outlined" textColor={tokens.colors.red} onPress={resetData}>
              {t("settings.reset")}
            </Button>
          </View>
        </PremiumCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 16,
  },
  form: {
    gap: 12,
  },
  sectionContent: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  onboardingRow: {
    borderRadius: 12,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  languageControls: {
    flex: 1,
  },
});
