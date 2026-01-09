import { executeSql } from "@/db/db";
import { fetchAll, fetchOne } from "./helpers";
import type { IncomeEntry } from "./types";

export async function listIncomeEntries(): Promise<IncomeEntry[]> {
  return fetchAll<IncomeEntry>("SELECT * FROM income_entries ORDER BY start_date DESC");
}

export async function getIncomeEntry(id: number): Promise<IncomeEntry | null> {
  return fetchOne<IncomeEntry>("SELECT * FROM income_entries WHERE id = ?", [id]);
}

export async function createIncomeEntry(entry: Omit<IncomeEntry, "id">): Promise<number> {
  const result = await executeSql(
    `INSERT INTO income_entries (name, amount, start_date, recurrence_frequency, recurrence_interval, one_shot, note, active, wallet_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    [
      entry.name,
      entry.amount,
      entry.start_date,
      entry.recurrence_frequency,
      entry.recurrence_interval,
      entry.one_shot,
      entry.note,
      entry.active,
      entry.wallet_id,
    ]
  );
  return result.insertId ?? 0;
}

export async function updateIncomeEntry(id: number, entry: Omit<IncomeEntry, "id">): Promise<void> {
  await executeSql(
    `UPDATE income_entries
     SET name = ?, amount = ?, start_date = ?, recurrence_frequency = ?, recurrence_interval = ?, one_shot = ?, note = ?, active = ?, wallet_id = ?
     WHERE id = ?`,
    [
      entry.name,
      entry.amount,
      entry.start_date,
      entry.recurrence_frequency,
      entry.recurrence_interval,
      entry.one_shot,
      entry.note,
      entry.active,
      entry.wallet_id,
      id,
    ]
  );
}

export async function deleteIncomeEntry(id: number): Promise<void> {
  await executeSql("DELETE FROM income_entries WHERE id = ?", [id]);
}

export function normalizeRecurrence(
  frequency: IncomeEntry["recurrence_frequency"],
  interval: IncomeEntry["recurrence_interval"]
): { recurrence_frequency: IncomeEntry["recurrence_frequency"]; recurrence_interval: IncomeEntry["recurrence_interval"] } {
  if (!frequency) return { recurrence_frequency: null, recurrence_interval: null };
  return {
    recurrence_frequency: frequency,
    recurrence_interval: interval && interval > 0 ? interval : 1,
  };
}
