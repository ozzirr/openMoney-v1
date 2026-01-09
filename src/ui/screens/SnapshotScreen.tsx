import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, RefreshControl, ScrollView } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, Card, Text, TextInput } from "react-native-paper";
import GlassCard from "@/ui/components/GlassCard";
import { useRoute } from "@react-navigation/native";
import {
  createSnapshotWithLines,
  getSnapshotByDate,
  listSnapshotLines,
  listSnapshots,
  updateSnapshotWithLines,
  deleteSnapshot,
} from "@/repositories/snapshotsRepo";
import { listWallets } from "@/repositories/walletsRepo";
import { getPreference } from "@/repositories/preferencesRepo";
import type { Snapshot, SnapshotLineDetail, Wallet } from "@/repositories/types";
import { isIsoDate, todayIso } from "@/utils/dates";
import { totalsByWalletType } from "@/domain/calculations";

type DraftLine = {
  walletId: number;
  amount: string;
};

export default function SnapshotScreen(): JSX.Element {
  const route = useRoute();
  const openNew = (route.params as { openNew?: boolean } | undefined)?.openNew;
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [lines, setLines] = useState<SnapshotLineDetail[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [prefillSnapshot, setPrefillSnapshot] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<number | null>(null);
  const [snapshotDate, setSnapshotDate] = useState(todayIso());
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = useCallback(async () => {
    const [snap, walletList] = await Promise.all([
      listSnapshots(),
      listWallets(true),
    ]);
    setSnapshots(snap);
    setWallets(walletList);
    const prefill = await getPreference("prefill_snapshot");
    setPrefillSnapshot(prefill ? prefill.value === "true" : true);
    if (snap.length > 0 && selectedSnapshotId === null) {
      setSelectedSnapshotId(snap[0].id);
    }
  }, [selectedSnapshotId]);

  const loadLines = useCallback(async (snapshotId?: number) => {
    const targetId = snapshotId ?? selectedSnapshotId;
    if (!targetId) {
      setLines([]);
      return;
    }
    const data = await listSnapshotLines(targetId);
    setLines(data);
  }, [selectedSnapshotId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadLines();
  }, [loadLines]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    await loadLines();
    setRefreshing(false);
  }, [load, loadLines]);

  useEffect(() => {
    if (openNew) {
      openNewSnapshot();
    }
  }, [openNew]);

  const openNewSnapshot = async () => {
    setError(null);
    setEditingSnapshotId(null);
    const latest = snapshots[0];
    let initialLines: DraftLine[] = [];
    if (latest && prefillSnapshot) {
      const latestLines = await listSnapshotLines(latest.id);
      const latestMap = new Map<number, string>();
      latestLines.forEach((line) => {
        latestMap.set(line.wallet_id, line.amount.toString());
      });
      initialLines = orderedWallets.map((wallet) => ({
        walletId: wallet.id,
        amount: latestMap.get(wallet.id) ?? "0",
      }));
    }

    if (initialLines.length === 0) {
      initialLines = orderedWallets.map((wallet) => ({
        walletId: wallet.id,
        amount: "0",
      }));
    }

    setDraftLines(initialLines);
    setSnapshotDate(todayIso());
    setShowForm(true);
  };

  const openEditSnapshot = async (snapshotId: number) => {
    setError(null);
    const snapshot = snapshots.find((item) => item.id === snapshotId);
    if (!snapshot) {
      return;
    }
    const snapshotLines = await listSnapshotLines(snapshotId);
    const lineMap = new Map<number, string>();
    snapshotLines.forEach((line) => {
      lineMap.set(line.wallet_id, line.amount.toString());
    });
    const initialLines = orderedWallets.map((wallet) => ({
      walletId: wallet.id,
      amount: lineMap.get(wallet.id) ?? "0",
    }));
    setDraftLines(initialLines);
    setSnapshotDate(snapshot.date);
    setEditingSnapshotId(snapshotId);
    setShowForm(true);
  };

  const updateDraftLine = (index: number, patch: Partial<DraftLine>) => {
    setDraftLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const toIsoDate = (value: Date): string => {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const datePickerValue = snapshotDate && isIsoDate(snapshotDate) ? new Date(snapshotDate) : new Date();

  const confirmOverwrite = () =>
    new Promise<boolean>((resolve) => {
      Alert.alert(
        "Snapshot già esistente",
        "Esiste già uno snapshot per questa data. Vuoi sovrascriverlo?",
        [
          { text: "Annulla", style: "cancel", onPress: () => resolve(false) },
          { text: "Sovrascrivi", style: "destructive", onPress: () => resolve(true) },
        ]
      );
    });

  const saveSnapshot = async () => {
    setError(null);
    if (!isIsoDate(snapshotDate)) {
      setError("Data non valida (YYYY-MM-DD).");
      return;
    }
    const cleaned = draftLines
      .map((line) => ({
        wallet_id: line.walletId,
        amount: Number(line.amount.replace(",", ".").trim()),
      }))
      .filter((line) => Number.isFinite(line.amount));

    if (cleaned.length === 0) {
      setError("Inserisci almeno una linea valida.");
      return;
    }

    const existing = await getSnapshotByDate(snapshotDate);
    if (existing && existing.id !== editingSnapshotId) {
      const ok = await confirmOverwrite();
      if (!ok) {
        return;
      }
      await deleteSnapshot(existing.id);
    }

    const id = editingSnapshotId
      ? await updateSnapshotWithLines(editingSnapshotId, snapshotDate, cleaned)
      : await createSnapshotWithLines(snapshotDate, cleaned);
    setShowForm(false);
    setEditingSnapshotId(null);
    setSelectedSnapshotId(id);
    await load();
    await loadLines(id);
  };

  const totals = useMemo(() => totalsByWalletType(lines), [lines]);
  const orderedWallets = useMemo(() => {
    const liquidity = wallets.filter((wallet) => wallet.type === "LIQUIDITY");
    const invest = wallets.filter((wallet) => wallet.type === "INVEST");
    return [...liquidity, ...invest];
  }, [wallets]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 16 }}
      alwaysBounceVertical
      bounces
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <GlassCard>
        <Card.Title title="Snapshot" />
        <Card.Content>
          <Button onPress={openNewSnapshot}>Nuovo Snapshot</Button>
        </Card.Content>
      </GlassCard>

      {showForm && (
        <GlassCard>
          <Card.Title title={editingSnapshotId ? "Modifica snapshot" : "Nuovo snapshot"} />
          <Card.Content style={{ gap: 8 }}>
            <TextInput
              label="Data"
              value={snapshotDate}
              editable={false}
              onPressIn={() => setShowDatePicker(true)}
            />
            {showDatePicker && (
              <DateTimePicker
                value={datePickerValue}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, selected) => {
                  if (selected) {
                    setSnapshotDate(toIsoDate(selected));
                  }
                  setShowDatePicker(false);
                }}
              />
            )}
            {draftLines.map((line, index) => {
              const wallet = orderedWallets.find((item) => item.id === line.walletId);
              const walletTitle = wallet
                ? wallet.type === "INVEST"
                  ? `${wallet.tag || "Tipo investimento"} - ${wallet.name} - ${wallet.currency}`
                  : `${wallet.name} - ${wallet.currency}`
                : `Wallet #${line.walletId}`;
              return (
                <GlassCard key={`${line.walletId}-${index}`} style={{ marginTop: 8 }}>
                  <Card.Title title={walletTitle} />
                  <Card.Content style={{ gap: 8 }}>
                    <TextInput
                      keyboardType="decimal-pad"
                      value={line.amount}
                      onChangeText={(value) => updateDraftLine(index, { amount: value })}
                    />
                  </Card.Content>
                </GlassCard>
              );
            })}
            {error && <Text style={{ color: "crimson" }}>{error}</Text>}
          </Card.Content>
          <Card.Actions>
            <Button onPress={saveSnapshot}>Salva</Button>
            <Button onPress={() => setShowForm(false)}>Chiudi</Button>
          </Card.Actions>
        </GlassCard>
      )}

      <GlassCard>
        <Card.Title title="Lista snapshot" />
        <Card.Content>
          {snapshots.length === 0 && <Text>Nessuno snapshot.</Text>}
          {snapshots.map((snapshot) => (
            <Button
              key={snapshot.id}
              onPress={() => {
                setSelectedSnapshotId(snapshot.id);
                void openEditSnapshot(snapshot.id);
              }}
              mode={snapshot.id === selectedSnapshotId ? "contained" : "text"}
            >
              {snapshot.date}
            </Button>
          ))}
        </Card.Content>
      </GlassCard>

      <GlassCard>
        <Card.Title title="Dettaglio" />
        <Card.Content>
          {lines.length === 0 && <Text>Nessuna linea.</Text>}
          {lines.map((line) => (
            <Text key={line.id}>
              {line.wallet_name ?? "Sconosciuto"} • {line.amount.toFixed(2)}
            </Text>
          ))}
          {lines.length > 0 && (
            <>
              <Text>Liquidità: {totals.liquidity.toFixed(2)}</Text>
              <Text>Investimenti: {totals.investments.toFixed(2)}</Text>
              <Text>Patrimonio: {totals.netWorth.toFixed(2)}</Text>
            </>
          )}
        </Card.Content>
      </GlassCard>

    </ScrollView>
  );
}
