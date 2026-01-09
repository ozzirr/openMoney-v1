import React, { useCallback, useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { Button, Card, Text, TextInput } from "react-native-paper";
import { createSnapshot, listSnapshots, listSnapshotLines, createSnapshotLine } from "@/repositories/snapshotsRepo";
import type { Snapshot, SnapshotLineDetail } from "@/repositories/types";
import { isIsoDate } from "@/utils/dates";

export default function SnapshotScreen(): JSX.Element {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [lines, setLines] = useState<SnapshotLineDetail[]>([]);
  const [snapshotDate, setSnapshotDate] = useState("");
  const [lineContainerId, setLineContainerId] = useState("");
  const [lineInvestCategoryId, setLineInvestCategoryId] = useState("");
  const [lineAmount, setLineAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    const data = await listSnapshots();
    setSnapshots(data);
    if (data.length > 0 && selectedSnapshotId === null) {
      setSelectedSnapshotId(data[0].id);
    }
  }, [selectedSnapshotId]);

  const loadLines = useCallback(async () => {
    if (!selectedSnapshotId) {
      setLines([]);
      return;
    }
    const data = await listSnapshotLines(selectedSnapshotId);
    setLines(data);
  }, [selectedSnapshotId]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  useEffect(() => {
    loadLines();
  }, [loadLines]);

  const addSnapshot = async () => {
    setError(null);
    if (!isIsoDate(snapshotDate)) {
      setError("Inserisci una data valida (YYYY-MM-DD)." );
      return;
    }
    const id = await createSnapshot(snapshotDate);
    setSnapshotDate("");
    setSelectedSnapshotId(id);
    await loadSnapshots();
    await loadLines();
  };

  const addLine = async () => {
    setError(null);
    if (!selectedSnapshotId) {
      setError("Seleziona uno snapshot.");
      return;
    }
    if (!lineContainerId.trim() || !lineAmount.trim()) {
      setError("Container ID e importo sono obbligatori.");
      return;
    }
    const containerId = Number(lineContainerId);
    const amount = Number(lineAmount);
    if (!Number.isFinite(containerId) || !Number.isFinite(amount)) {
      setError("Container ID e importo devono essere numerici.");
      return;
    }
    const investCategoryId = lineInvestCategoryId ? Number(lineInvestCategoryId) : null;
    await createSnapshotLine({
      snapshot_id: selectedSnapshotId,
      container_id: containerId,
      invest_category_id: investCategoryId,
      amount,
    });
    setLineContainerId("");
    setLineInvestCategoryId("");
    setLineAmount("");
    await loadLines();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Card>
        <Card.Title title="Crea snapshot" />
        <Card.Content style={{ gap: 8 }}>
          <TextInput
            label="Data (YYYY-MM-DD)"
            value={snapshotDate}
            onChangeText={setSnapshotDate}
          />
          {error && <Text style={{ color: "crimson" }}>{error}</Text>}
        </Card.Content>
        <Card.Actions>
          <Button onPress={addSnapshot}>Crea</Button>
        </Card.Actions>
      </Card>

      <Card>
        <Card.Title title="Snapshot disponibili" />
        <Card.Content>
          {snapshots.length === 0 && <Text>Nessuno snapshot.</Text>}
          {snapshots.map((snapshot) => (
            <Button
              key={snapshot.id}
              onPress={() => setSelectedSnapshotId(snapshot.id)}
              mode={snapshot.id === selectedSnapshotId ? "contained" : "text"}
            >
              {snapshot.date}
            </Button>
          ))}
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Aggiungi linea" />
        <Card.Content style={{ gap: 8 }}>
          <TextInput
            label="Container ID"
            keyboardType="numeric"
            value={lineContainerId}
            onChangeText={setLineContainerId}
          />
          <TextInput
            label="Categoria invest ID (opzionale)"
            keyboardType="numeric"
            value={lineInvestCategoryId}
            onChangeText={setLineInvestCategoryId}
          />
          <TextInput
            label="Importo"
            keyboardType="decimal-pad"
            value={lineAmount}
            onChangeText={setLineAmount}
          />
        </Card.Content>
        <Card.Actions>
          <Button onPress={addLine}>Aggiungi linea</Button>
        </Card.Actions>
      </Card>

      <Card>
        <Card.Title title="Linee snapshot" />
        <Card.Content>
          {lines.length === 0 && <Text>Nessuna linea.</Text>}
          {lines.map((line) => (
            <Text key={line.id}>
              {line.container_name ?? "Sconosciuto"} • {line.amount.toFixed(2)}
            </Text>
          ))}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}
