import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Button, List, SegmentedButtons, Switch, Text, TextInput } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import * as FileSystem from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { exportToFile, exportToJson, importFromFile, importFromJson } from "@/importExport";
import { runMigrations } from "@/db/db";
import { loadSampleData as seedSampleData } from "@/seed/sampleData";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import PressScale from "@/ui/dashboard/components/PressScale";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { createWallet, deleteWallet, ensureDefaultWallets, listWallets, updateWallet } from "@/repositories/walletsRepo";
import {
  listExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
} from "@/repositories/expenseCategoriesRepo";
import { getPreference, setPreference } from "@/repositories/preferencesRepo";
import { withTransaction } from "@/db/db";
import { ThemeContext } from "@/ui/theme";
import type { Wallet, Currency, ExpenseCategory } from "@/repositories/types";

type CategoryEdit = {
  name: string;
  color: string;
};

const presetColors = [
  "#9B7BFF",
  "#5C9DFF",
  "#F6C177",
  "#66D19E",
  "#C084FC",
  "#FF8FAB",
  "#6EE7B7",
  "#94A3B8",
  "#F97316",
  "#22D3EE",
];

function nextPresetColor(current: string): string {
  const index = presetColors.indexOf(current);
  if (index === -1) return presetColors[0];
  return presetColors[(index + 1) % presetColors.length];
}

export default function SettingsScreen(): JSX.Element {
  const { tokens } = useDashboardTheme();
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [message, setMessage] = useState<string | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletEdits, setWalletEdits] = useState<Record<number, { name: string; tag: string; currency: Currency }>>({});
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoryEdits, setCategoryEdits] = useState<Record<number, CategoryEdit>>({});
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(presetColors[0]);
  const [expandedCategoryId, setExpandedCategoryId] = useState<number | null>(null);
  const [tab, setTab] = useState<"LIQUIDITY" | "INVEST">("LIQUIDITY");
  const [newWalletDraft, setNewWalletDraft] = useState<{ name: string; tag: string; currency: Currency }>({
    name: "",
    tag: "",
    currency: "EUR",
  });
  const [showAddWallet, setShowAddWallet] = useState<{ LIQUIDITY: boolean; INVEST: boolean }>({
    LIQUIDITY: false,
    INVEST: false,
  });
  const [expandedWalletId, setExpandedWalletId] = useState<number | null>(null);

  const [prefillSnapshot, setPrefillSnapshot] = useState(true);
  const [chartMonths, setChartMonths] = useState(6);
  const { mode, setMode } = useContext(ThemeContext);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [walletList, expenseCats] = await Promise.all([listWallets(), listExpenseCategories()]);
    setWallets(walletList);
    setCategories(expenseCats);
    const edits: Record<number, { name: string; tag: string; currency: Currency }> = {};
    walletList.forEach((wallet) => {
      edits[wallet.id] = {
        name: wallet.name,
        tag: wallet.tag ?? "",
        currency: wallet.currency,
      };
    });
    setWalletEdits(edits);

    const categoryEditsMap: Record<number, CategoryEdit> = {};
    expenseCats.forEach((cat) => {
      categoryEditsMap[cat.id] = { name: cat.name, color: cat.color };
    });
    setCategoryEdits(categoryEditsMap);

    const prefill = await getPreference("prefill_snapshot");
    const points = await getPreference("chart_points");
    setPrefillSnapshot(prefill ? prefill.value === "true" : true);
    const parsedPoints = points ? Number(points.value) : 6;
    const safePoints = Number.isFinite(parsedPoints) ? Math.min(12, Math.max(3, parsedPoints)) : 6;
    setChartMonths(safePoints);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const exportData = async () => {
    setMessage(null);
    const fileName = "openMoney-export.json";
    try {
      const payload = await exportToJson();
      const json = JSON.stringify(payload, null, 2);
      if (Platform.OS === "android" && FileSystem.StorageAccessFramework?.requestDirectoryPermissionsAsync) {
        const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permission.granted || !permission.directoryUri) {
          setMessage("Permesso necessario per salvare il file.");
          return;
        }
        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permission.directoryUri,
          fileName,
          "application/json"
        );
        if (FileSystem.StorageAccessFramework.writeAsStringAsync) {
          await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, json);
        } else {
          await LegacyFileSystem.writeAsStringAsync(fileUri, json);
        }
        setMessage("Export completato.");
        return;
      }
      const cacheDir = FileSystem.cacheDirectory ?? LegacyFileSystem.cacheDirectory;
      const docDir = FileSystem.documentDirectory ?? LegacyFileSystem.documentDirectory;
      let baseDir = cacheDir ?? docDir ?? FileSystem.temporaryDirectory ?? LegacyFileSystem.temporaryDirectory;
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
        setMessage("Impossibile salvare il file su questo dispositivo.");
        return;
      }
      const path = `${baseDir}${fileName}`;
      await LegacyFileSystem.writeAsStringAsync(path, json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: "Esporta dati" });
        setMessage("Export completato.");
        return;
      }
      setMessage(`Export completato: ${path}`);
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const confirmWipeAndReplace = async (): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(
        "Conferma import",
        "L'import sostituirà tutti i dati esistenti. Vuoi continuare?",
        [
          { text: "Annulla", style: "cancel", onPress: () => resolve(false) },
          { text: "Continua", style: "destructive", onPress: () => resolve(true) },
        ],
        { cancelable: true }
      );
    });

  const importData = async () => {
    setMessage(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const confirmed = await confirmWipeAndReplace();
      if (!confirmed) return;
      await importFromFile(result.assets[0].uri);
      setMessage("Import completato.");
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const pasteFromClipboard = async () => {
    setMessage(null);
    try {
      const text = (await Clipboard.getStringAsync())?.trim();
      if (!text) {
        setMessage("Appunti vuoti.");
        return;
      }
      const confirmed = await confirmWipeAndReplace();
      if (!confirmed) return;
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        setMessage("JSON non valido.");
        return;
      }
      await runMigrations();
      await importFromJson(payload);
      setMessage("Import completato dagli appunti.");
      await load();
    } catch (error) {
      const message = (error as Error).message;
      setMessage(message.includes("Could not open database") ? "Database non disponibile. Riprova tra poco." : message);
    }
  };

  const confirmReset = async (): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(
        "Conferma reset",
        "Questa azione cancellerà tutti i dati. Vuoi continuare?",
        [
          { text: "Annulla", style: "cancel", onPress: () => resolve(false) },
          { text: "Reset", style: "destructive", onPress: () => resolve(true) },
        ],
        { cancelable: true }
      );
    });

  const resetData = async () => {
    setMessage(null);
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
    await load();
    setMessage("Reset completato.");
  };

  const loadSampleDataHandler = useCallback(async () => {
    setMessage(null);
    try {
      await seedSampleData();
      await load();
      setMessage("Dati di esempio caricati.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }, [load]);

  const addWallet = async (type: "LIQUIDITY" | "INVEST") => {
    if (!newWalletDraft.name.trim()) return;
    await createWallet(
      newWalletDraft.name.trim(),
      type,
      newWalletDraft.currency,
      type === "INVEST" ? newWalletDraft.tag.trim() || null : null,
      1
    );
    setNewWalletDraft({ name: "", tag: "", currency: "EUR" });
    setShowAddWallet((prev) => ({ ...prev, [type]: false }));
    await load();
  };

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    await createExpenseCategory(newCategory.trim(), newCategoryColor);
    setNewCategory("");
    setNewCategoryColor(presetColors[0]);
    await load();
  };

  const saveCategory = async (id: number) => {
    const edit = categoryEdits[id];
    const name = edit?.name?.trim();
    if (!name || !edit?.color) return;
    await updateExpenseCategory(id, name, edit.color);
    await load();
  };

  const removeCategory = async (id: number) => {
    await deleteExpenseCategory(id);
    await load();
  };

  const updatePreference = async (key: string, value: string) => {
    await setPreference(key, value);
    setMessage("Preferenze salvate.");
  };

  const liquidityWallets = useMemo(
    () => wallets.filter((wallet) => wallet.type === "LIQUIDITY"),
    [wallets]
  );
  const investmentWallets = useMemo(
    () => wallets.filter((wallet) => wallet.type === "INVEST"),
    [wallets]
  );

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
        alwaysBounceVertical
        bounces
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.accent} />}
      >
        <PremiumCard>
          <SectionHeader title="Wallet" />
          <View style={styles.sectionContent}>
            <SegmentedButtons
              value={tab}
              onValueChange={(value) => setTab(value as "LIQUIDITY" | "INVEST")}
              buttons={[
                { value: "LIQUIDITY", label: "Liquidità" },
                { value: "INVEST", label: "Investimenti" },
              ]}
              style={{ backgroundColor: tokens.colors.surface2 }}
            />

            {tab === "LIQUIDITY" && (
              <>
                {!showAddWallet.LIQUIDITY && (
                  <Button
                    mode="contained"
                    buttonColor={tokens.colors.accent}
                    onPress={() => setShowAddWallet((prev) => ({ ...prev, LIQUIDITY: true }))}
                  >
                    Aggiungi wallet
                  </Button>
                )}
                {showAddWallet.LIQUIDITY && (
                  <PremiumCard style={{ backgroundColor: tokens.colors.surface2 }}>
                    <SectionHeader title="Nuovo wallet liquidità" />
                    <View style={styles.sectionContent}>
                      <TextInput
                        label="Nome"
                        value={newWalletDraft.name}
                        {...inputProps}
                        onChangeText={(value) => setNewWalletDraft((prev) => ({ ...prev, name: value }))}
                      />
                      <SegmentedButtons
                        value={newWalletDraft.currency}
                        onValueChange={(value) => setNewWalletDraft((prev) => ({ ...prev, currency: value as Currency }))}
                        buttons={[
                          { value: "EUR", label: "EUR" },
                          { value: "USD", label: "USD" },
                          { value: "GBP", label: "GBP" },
                        ]}
                        style={{ backgroundColor: tokens.colors.surface }}
                      />
                    </View>
                    <View style={styles.actionsRow}>
                      <Button mode="contained" buttonColor={tokens.colors.accent} onPress={() => addWallet("LIQUIDITY")}>
                        Aggiungi
                      </Button>
                      <Button mode="outlined" textColor={tokens.colors.text} onPress={() => setShowAddWallet((prev) => ({ ...prev, LIQUIDITY: false }))}>
                        Annulla
                      </Button>
                    </View>
                  </PremiumCard>
                )}

                {liquidityWallets.map((wallet) => (
                  <List.Accordion
                    key={wallet.id}
                    title={walletEdits[wallet.id]?.name ?? wallet.name}
                    description={`${walletEdits[wallet.id]?.currency ?? wallet.currency}`}
                    left={(props) => <List.Icon {...props} icon="wallet" />}
                    style={{ marginTop: 8, backgroundColor: tokens.colors.surface2 }}
                    titleStyle={{ color: tokens.colors.text }}
                    descriptionStyle={{ color: tokens.colors.muted }}
                    expanded={expandedWalletId === wallet.id}
                    onPress={() => setExpandedWalletId((prev) => (prev === wallet.id ? null : wallet.id))}
                  >
                    <View style={styles.sectionContent}>
                      <TextInput
                        label="Nome"
                        value={walletEdits[wallet.id]?.name ?? wallet.name}
                        {...inputProps}
                        onChangeText={(value) =>
                          setWalletEdits((prev) => ({
                            ...prev,
                            [wallet.id]: { ...prev[wallet.id], name: value },
                          }))
                        }
                      />
                      <SegmentedButtons
                        value={walletEdits[wallet.id]?.currency ?? wallet.currency}
                        onValueChange={(value) =>
                          setWalletEdits((prev) => ({
                            ...prev,
                            [wallet.id]: { ...prev[wallet.id], currency: value as Currency },
                          }))
                        }
                        buttons={[
                          { value: "EUR", label: "EUR" },
                          { value: "USD", label: "USD" },
                          { value: "GBP", label: "GBP" },
                        ]}
                        style={{ backgroundColor: tokens.colors.surface }}
                      />
                      <View style={styles.actionsRow}>
                        <Button
                          mode="contained"
                          buttonColor={tokens.colors.accent}
                          onPress={async () => {
                            const edit = walletEdits[wallet.id];
                            if (!edit) return;
                            await updateWallet(
                              wallet.id,
                              edit.name,
                              wallet.type,
                              edit.currency,
                              null,
                              wallet.active
                            );
                            await load();
                            setExpandedWalletId(null);
                          }}
                        >
                          Salva
                        </Button>
                        <Button
                          mode="outlined"
                          textColor={tokens.colors.red}
                          onPress={async () => {
                            await deleteWallet(wallet.id);
                            await load();
                            setExpandedWalletId(null);
                          }}
                        >
                          Elimina
                        </Button>
                      </View>
                    </View>
                  </List.Accordion>
                ))}
              </>
            )}

            {tab === "INVEST" && (
              <>
                {!showAddWallet.INVEST && (
                  <Button
                    mode="contained"
                    buttonColor={tokens.colors.accent}
                    onPress={() => setShowAddWallet((prev) => ({ ...prev, INVEST: true }))}
                  >
                    Aggiungi wallet
                  </Button>
                )}
                {showAddWallet.INVEST && (
                  <PremiumCard style={{ backgroundColor: tokens.colors.surface2 }}>
                    <SectionHeader title="Nuovo wallet investimenti" />
                    <View style={styles.sectionContent}>
                      <TextInput
                        label="Broker"
                        value={newWalletDraft.name}
                        {...inputProps}
                        onChangeText={(value) => setNewWalletDraft((prev) => ({ ...prev, name: value }))}
                      />
                      <TextInput
                        label="Tipo investimento"
                        value={newWalletDraft.tag}
                        {...inputProps}
                        onChangeText={(value) => setNewWalletDraft((prev) => ({ ...prev, tag: value }))}
                      />
                      <SegmentedButtons
                        value={newWalletDraft.currency}
                        onValueChange={(value) => setNewWalletDraft((prev) => ({ ...prev, currency: value as Currency }))}
                        buttons={[
                          { value: "EUR", label: "EUR" },
                          { value: "USD", label: "USD" },
                          { value: "GBP", label: "GBP" },
                        ]}
                        style={{ backgroundColor: tokens.colors.surface }}
                      />
                    </View>
                    <View style={styles.actionsRow}>
                      <Button mode="contained" buttonColor={tokens.colors.accent} onPress={() => addWallet("INVEST")}>
                        Aggiungi
                      </Button>
                      <Button mode="outlined" textColor={tokens.colors.text} onPress={() => setShowAddWallet((prev) => ({ ...prev, INVEST: false }))}>
                        Annulla
                      </Button>
                    </View>
                  </PremiumCard>
                )}

                {investmentWallets.map((wallet) => (
                  <List.Accordion
                    key={wallet.id}
                    title={walletEdits[wallet.id]?.name ?? wallet.name}
                    description={`${walletEdits[wallet.id]?.currency ?? wallet.currency}${
                      walletEdits[wallet.id]?.tag || wallet.tag ? ` • ${walletEdits[wallet.id]?.tag ?? wallet.tag}` : ""
                    }`}
                    left={(props) => <List.Icon {...props} icon="wallet" />}
                    style={{ marginTop: 8, backgroundColor: tokens.colors.surface2 }}
                    titleStyle={{ color: tokens.colors.text }}
                    descriptionStyle={{ color: tokens.colors.muted }}
                    expanded={expandedWalletId === wallet.id}
                    onPress={() => setExpandedWalletId((prev) => (prev === wallet.id ? null : wallet.id))}
                  >
                    <View style={styles.sectionContent}>
                      <TextInput
                        label="Broker"
                        value={walletEdits[wallet.id]?.name ?? wallet.name}
                        {...inputProps}
                        onChangeText={(value) =>
                          setWalletEdits((prev) => ({
                            ...prev,
                            [wallet.id]: { ...prev[wallet.id], name: value },
                          }))
                        }
                      />
                      <TextInput
                        label="Tipo investimento"
                        value={walletEdits[wallet.id]?.tag ?? wallet.tag ?? ""}
                        {...inputProps}
                        onChangeText={(value) =>
                          setWalletEdits((prev) => ({
                            ...prev,
                            [wallet.id]: { ...prev[wallet.id], tag: value },
                          }))
                        }
                      />
                      <SegmentedButtons
                        value={walletEdits[wallet.id]?.currency ?? wallet.currency}
                        onValueChange={(value) =>
                          setWalletEdits((prev) => ({
                            ...prev,
                            [wallet.id]: { ...prev[wallet.id], currency: value as Currency },
                          }))
                        }
                        buttons={[
                          { value: "EUR", label: "EUR" },
                          { value: "USD", label: "USD" },
                          { value: "GBP", label: "GBP" },
                        ]}
                        style={{ backgroundColor: tokens.colors.surface }}
                      />
                      <View style={styles.actionsRow}>
                        <Button
                          mode="contained"
                          buttonColor={tokens.colors.accent}
                          onPress={async () => {
                            const edit = walletEdits[wallet.id];
                            if (!edit) return;
                            await updateWallet(
                              wallet.id,
                              edit.name,
                              wallet.type,
                              edit.currency,
                              edit.tag || null,
                              wallet.active
                            );
                            await load();
                            setExpandedWalletId(null);
                          }}
                        >
                          Salva
                        </Button>
                        <Button
                          mode="outlined"
                          textColor={tokens.colors.red}
                          onPress={async () => {
                            await deleteWallet(wallet.id);
                            await load();
                            setExpandedWalletId(null);
                          }}
                        >
                          Elimina
                        </Button>
                      </View>
                    </View>
                  </List.Accordion>
                ))}
              </>
            )}
          </View>
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Categorie spesa" />
          <View style={styles.sectionContent}>
            <View style={styles.colorLine}>
              <TextInput
                label="Nuova categoria"
                value={newCategory}
                {...inputProps}
                style={[styles.categoryNameInput, inputProps.style]}
                onChangeText={setNewCategory}
              />
              <PressScale
                onPress={() => setNewCategoryColor((prev) => nextPresetColor(prev))}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: newCategoryColor, borderColor: tokens.colors.text },
                ]}
              />
            </View>
            <Button mode="contained" buttonColor={tokens.colors.accent} onPress={addCategory}>
              Aggiungi
            </Button>
            {categories.length === 0 ? (
              <Text style={{ color: tokens.colors.muted }}>Nessuna categoria configurata.</Text>
            ) : null}
            {categories.map((cat) => (
              <List.Accordion
                key={cat.id}
                title={categoryEdits[cat.id]?.name ?? cat.name}
                description="Attiva"
                left={(props) => <List.Icon {...props} icon="tag" />}
                style={{ marginTop: 8, backgroundColor: tokens.colors.surface2 }}
                titleStyle={{ color: tokens.colors.text }}
                descriptionStyle={{ color: tokens.colors.muted }}
                expanded={expandedCategoryId === cat.id}
                onPress={() => setExpandedCategoryId((prev) => (prev === cat.id ? null : cat.id))}
              >
                <View style={styles.sectionContent}>
                  <View style={styles.colorLine}>
                    <TextInput
                      label="Nome categoria"
                      value={categoryEdits[cat.id]?.name ?? cat.name}
                      {...inputProps}
                      style={[styles.categoryNameInput, { backgroundColor: tokens.colors.surface }]}
                      onChangeText={(value) =>
                        setCategoryEdits((prev) => ({
                          ...prev,
                          [cat.id]: {
                            name: value,
                            color: prev[cat.id]?.color ?? cat.color,
                          },
                        }))
                      }
                    />
                    <PressScale
                      onPress={() =>
                        setCategoryEdits((prev) => {
                          const current = prev[cat.id]?.color ?? cat.color;
                          return {
                            ...prev,
                            [cat.id]: {
                              name: prev[cat.id]?.name ?? cat.name,
                              color: nextPresetColor(current),
                            },
                          };
                        })
                      }
                      style={[
                        styles.colorSwatch,
                        {
                          backgroundColor: categoryEdits[cat.id]?.color ?? cat.color,
                          borderColor: tokens.colors.text,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.actionsRow}>
                    <Button
                      mode="contained"
                      buttonColor={tokens.colors.accent}
                      onPress={async () => {
                        await saveCategory(cat.id);
                        setExpandedCategoryId(null);
                      }}
                    >
                      Salva
                    </Button>
                    <Button
                      mode="outlined"
                      textColor={tokens.colors.red}
                      onPress={async () => {
                        await removeCategory(cat.id);
                        setExpandedCategoryId(null);
                      }}
                    >
                      Elimina
                    </Button>
                  </View>
                </View>
              </List.Accordion>
            ))}
          </View>
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Preferenze" />
          {message && <Text style={{ color: tokens.colors.muted }}>{message}</Text>}
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
              <Text style={{ color: tokens.colors.text }}>Tema scuro</Text>
            </View>
            <View style={styles.row}>
              <Switch
                value={prefillSnapshot}
                onValueChange={(value) => {
                  setPrefillSnapshot(value);
                  updatePreference("prefill_snapshot", String(value));
                }}
              />
              <Text style={{ color: tokens.colors.text }}>Precompila snapshot</Text>
            </View>
            <View style={[styles.row, { gap: 12, marginTop: 8 }]}>
              <Text style={{ color: tokens.colors.text }}>Mesi nel grafico</Text>
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
          </View>
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Dati" />
          <View style={styles.sectionContent}>
            <Button
              mode="outlined"
              textColor={tokens.colors.text}
              onPress={() => navigation.navigate("Profilo")}
            >
              Modifica profilo
            </Button>
            <Button mode="contained" buttonColor={tokens.colors.accent} onPress={exportData}>
              Esporta
            </Button>
            <Button mode="outlined" textColor={tokens.colors.text} onPress={importData}>
              Importa
            </Button>
            <Button mode="outlined" textColor={tokens.colors.text} onPress={pasteFromClipboard}>
              Incolla JSON dagli appunti
            </Button>
            <Button mode="contained" buttonColor={tokens.colors.accent} onPress={loadSampleDataHandler}>
              Carica dati di test
            </Button>
            <Button mode="outlined" textColor={tokens.colors.red} onPress={resetData}>
              Reset
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
  sectionContent: {
    gap: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    flexWrap: "wrap",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  categoryNameInput: {
    flex: 1,
    minWidth: 160,
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
  },
});
