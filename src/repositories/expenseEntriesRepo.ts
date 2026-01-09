import { executeSql } from "@/db/db";
import { fetchAll, fetchOne } from "./helpers";
import type { ExpenseEntry } from "./types";

export async function listExpenseEntries(): Promise<ExpenseEntry[]> {
  return fetchAll<ExpenseEntry>("SELECT * FROM expense_entries ORDER BY start_date DESC");
}

export async function getExpenseEntry(id: number): Promise<ExpenseEntry | null> {
  return fetchOne<ExpenseEntry>("SELECT * FROM expense_entries WHERE id = ?", [id]);
}

export async function createExpenseEntry(entry: Omit<ExpenseEntry, "id">): Promise<number> {
  const result = await executeSql(
    `INSERT INTO expense_entries (name, amount, start_date, recurrence_frequency, recurrence_interval, one_shot, note, active, wallet_id, expense_category_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
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
      entry.expense_category_id,
    ]
  );
  return result.insertId ?? 0;
}

export async function updateExpenseEntry(id: number, entry: Omit<ExpenseEntry, "id">): Promise<void> {
  await executeSql(
    `UPDATE expense_entries
     SET name = ?, amount = ?, start_date = ?, recurrence_frequency = ?, recurrence_interval = ?, one_shot = ?, note = ?, active = ?, wallet_id = ?, expense_category_id = ?
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
      entry.expense_category_id,
      id,
    ]
  );
}

export async function deleteExpenseEntry(id: number): Promise<void> {
  await executeSql("DELETE FROM expense_entries WHERE id = ?", [id]);
}
