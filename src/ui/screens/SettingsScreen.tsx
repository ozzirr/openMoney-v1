import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Platform, RefreshControl, ScrollView } from "react-native";
import { Button, Card, List, SegmentedButtons, Switch, Text, TextInput } from "react-native-paper";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { exportToFile, importFromFile, importFromJson } from "@/importExport";
import { runMigrations } from "@/db/db";
import GlassCard from "@/ui/components/GlassCard";
import { createWallet, deleteWallet, ensureDefaultWallets, listWallets, updateWallet } from "@/repositories/walletsRepo";
import { getPreference, setPreference } from "@/repositories/preferencesRepo";
import { withTransaction } from "@/db/db";
import { ThemeContext } from "@/ui/theme";
import type { Wallet, Currency } from "@/repositories/types";

export default function SettingsScreen(): JSX.Element {
  const [message, setMessage] = useState<string | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletEdits, setWalletEdits] = useState<Record<number, { name: string; tag: string; currency: Currency }>>({});
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

  const [askSnapshot, setAskSnapshot] = useState(true);
  const [prefillSnapshot, setPrefillSnapshot] = useState(true);
  const [chartMonths, setChartMonths] = useState(6);
  const { mode, setMode } = useContext(ThemeContext);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [walletList] = await Promise.all([listWallets()]);
    setWallets(walletList);
    const edits: Record<number, { name: string; tag: string; currency: Currency }> = {};
    walletList.forEach((wallet) => {
      edits[wallet.id] = {
        name: wallet.name,
        tag: wallet.tag ?? "",
        currency: wallet.currency,
      };
    });
    setWalletEdits(edits);

    const ask = await getPreference("ask_snapshot_on_start");
    const prefill = await getPreference("prefill_snapshot");
    const points = await getPreference("chart_points");
    setAskSnapshot(ask ? ask.value === "true" : true);
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
    const fileName = "mymoney-export.json";
    try {
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
        await exportToFile(fileUri);
        setMessage("Export completato.");
        return;
      }
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDir) {
        setMessage("Permesso necessario per salvare il file.");
        return;
      }
      const path = `${baseDir}${fileName}`;
      await exportToFile(path);
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

  const toggleWalletActive = async (wallet: Wallet) => {
    await updateWallet(
      wallet.id,
      wallet.name,
      wallet.type,
      wallet.currency,
      wallet.tag,
      wallet.active === 1 ? 0 : 1
    );
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

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 16 }}
      alwaysBounceVertical
      bounces
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <GlassCard>
        <Card.Title title="Wallet" />
        <Card.Content style={{ gap: 12 }}>
          <SegmentedButtons
            value={tab}
            onValueChange={(value) => setTab(value as "LIQUIDITY" | "INVEST")}
            buttons={[
              { value: "LIQUIDITY", label: "Liquidità" },
              { value: "INVEST", label: "Investimenti" },
            ]}
          />

          {tab === "LIQUIDITY" && (
            <>
              {!showAddWallet.LIQUIDITY && (
                <Button mode="contained" onPress={() => setShowAddWallet((prev) => ({ ...prev, LIQUIDITY: true }))}>
                  Aggiungi wallet
                </Button>
              )}
              {showAddWallet.LIQUIDITY && (
                <GlassCard style={{ marginTop: 8 }}>
                  <Card.Title title="Nuovo wallet liquidità" />
                  <Card.Content style={{ gap: 8 }}>
                    <TextInput
                      label="Nome"
                      value={newWalletDraft.name}
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
                    />
                  </Card.Content>
                  <Card.Actions>
                    <Button onPress={() => addWallet("LIQUIDITY")}>Aggiungi</Button>
                    <Button onPress={() => setShowAddWallet((prev) => ({ ...prev, LIQUIDITY: false }))}>
                      Annulla
                    </Button>
                  </Card.Actions>
                </GlassCard>
              )}

              {liquidityWallets.map((wallet) => (
                <List.Accordion
                  key={wallet.id}
                  title={walletEdits[wallet.id]?.name ?? wallet.name}
                  description={`${walletEdits[wallet.id]?.currency ?? wallet.currency}${
                    wallet.active === 0 ? " • disattivo" : ""
                  }`}
                  left={(props) => <List.Icon {...props} icon="wallet" />}
                  style={{ marginTop: 8 }}
                >
                  <Card.Content style={{ gap: 8 }}>
                    <TextInput
                      label="Nome"
                      value={walletEdits[wallet.id]?.name ?? wallet.name}
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
                    />
                    <Card.Actions>
                      <Button
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
                        }}
                      >
                        Salva
                      </Button>
                      <Button onPress={() => toggleWalletActive(wallet)}>
                        {wallet.active === 1 ? "Disattiva" : "Attiva"}
                      </Button>
                      <Button
                        onPress={async () => {
                          await deleteWallet(wallet.id);
                          await load();
                        }}
                      >
                        Elimina
                      </Button>
                    </Card.Actions>
                  </Card.Content>
                </List.Accordion>
              ))}
            </>
          )}

          {tab === "INVEST" && (
            <>
              {!showAddWallet.INVEST && (
                <Button mode="contained" onPress={() => setShowAddWallet((prev) => ({ ...prev, INVEST: true }))}>
                  Aggiungi wallet
                </Button>
              )}
              {showAddWallet.INVEST && (
                <GlassCard style={{ marginTop: 8 }}>
                  <Card.Title title="Nuovo wallet investimenti" />
                  <Card.Content style={{ gap: 8 }}>
                    <TextInput
                      label="Broker"
                      value={newWalletDraft.name}
                      onChangeText={(value) => setNewWalletDraft((prev) => ({ ...prev, name: value }))}
                    />
                    <TextInput
                      label="Tipo investimento"
                      value={newWalletDraft.tag}
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
                    />
                  </Card.Content>
                  <Card.Actions>
                    <Button onPress={() => addWallet("INVEST")}>Aggiungi</Button>
                    <Button onPress={() => setShowAddWallet((prev) => ({ ...prev, INVEST: false }))}>
                      Annulla
                    </Button>
                  </Card.Actions>
                </GlassCard>
              )}

              {investmentWallets.map((wallet) => (
                <List.Accordion
                  key={wallet.id}
                  title={walletEdits[wallet.id]?.name ?? wallet.name}
                  description={`${walletEdits[wallet.id]?.currency ?? wallet.currency}${
                    walletEdits[wallet.id]?.tag || wallet.tag ? ` • ${walletEdits[wallet.id]?.tag ?? wallet.tag}` : ""
                  }${wallet.active === 0 ? " • disattivo" : ""}`}
                  left={(props) => <List.Icon {...props} icon="wallet" />}
                  style={{ marginTop: 8 }}
                >
                  <Card.Content style={{ gap: 8 }}>
                    <TextInput
                      label="Broker"
                      value={walletEdits[wallet.id]?.name ?? wallet.name}
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
                    />
                    <Card.Actions>
                      <Button
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
                        }}
                      >
                        Salva
                      </Button>
                      <Button onPress={() => toggleWalletActive(wallet)}>
                        {wallet.active === 1 ? "Disattiva" : "Attiva"}
                      </Button>
                      <Button
                        onPress={async () => {
                          await deleteWallet(wallet.id);
                          await load();
                        }}
                      >
                        Elimina
                      </Button>
                    </Card.Actions>
                  </Card.Content>
                </List.Accordion>
              ))}
            </>
          )}
        </Card.Content>
      </GlassCard>

      <GlassCard>
        <Card.Title title="Preferenze" />
        <Card.Content style={{ gap: 8 }}>
          <Card.Content style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Switch
              value={mode === "dark"}
              onValueChange={(value) => {
                const next = value ? "dark" : "light";
                setMode(next);
                updatePreference("theme", next);
              }}
            />
            <Text>Tema scuro</Text>
          </Card.Content>
          <Card.Content style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Switch
              value={askSnapshot}
              onValueChange={(value) => {
                setAskSnapshot(value);
                updatePreference("ask_snapshot_on_start", String(value));
              }}
            />
            <Text>Chiedi snapshot all'avvio</Text>
          </Card.Content>
          <Card.Content style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Switch
              value={prefillSnapshot}
              onValueChange={(value) => {
                setPrefillSnapshot(value);
                updatePreference("prefill_snapshot", String(value));
              }}
            />
            <Text>Precompila snapshot</Text>
          </Card.Content>
          <Card.Content style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
            <Text>Mesi nel grafico</Text>
            <Button
              mode="outlined"
              onPress={() => {
                const next = Math.max(3, chartMonths - 1);
                setChartMonths(next);
                updatePreference("chart_points", String(next));
              }}
            >
              -
            </Button>
            <Text>{chartMonths}</Text>
            <Button
              mode="outlined"
              onPress={() => {
                const next = Math.min(12, chartMonths + 1);
                setChartMonths(next);
                updatePreference("chart_points", String(next));
              }}
            >
              +
            </Button>
          </Card.Content>
        </Card.Content>
      </GlassCard>

      <GlassCard>
        <Card.Title title="Dati" />
        <Card.Content style={{ gap: 8 }}>
          {message && <Text>{message}</Text>}
          <Button mode="contained" onPress={exportData}>Esporta</Button>
          <Button mode="outlined" onPress={importData}>Importa</Button>
          <Button mode="outlined" onPress={pasteFromClipboard}>Incolla JSON dagli appunti</Button>
          <Button mode="outlined" onPress={resetData}>Reset</Button>
        </Card.Content>
      </GlassCard>
    </ScrollView>
  );
}
