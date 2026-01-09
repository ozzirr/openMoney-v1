import { executeSql } from "@/db/db";
import { fetchAll, fetchOne } from "./helpers";
import type { ExpenseCategory } from "./types";

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  return fetchAll<ExpenseCategory>(
    "SELECT id, name, COALESCE(active, 1) AS active FROM expense_categories ORDER BY name ASC"
  );
}

export async function getExpenseCategory(id: number): Promise<ExpenseCategory | null> {
  return fetchOne<ExpenseCategory>("SELECT * FROM expense_categories WHERE id = ?", [id]);
}

export async function createExpenseCategory(name: string): Promise<number> {
  const result = await executeSql("INSERT INTO expense_categories (name, active) VALUES (?, 1)", [name]);
  return result.insertId ?? 0;
}

export async function updateExpenseCategory(id: number, name: string): Promise<void> {
  await executeSql("UPDATE expense_categories SET name = ? WHERE id = ?", [name, id]);
}

export async function setExpenseCategoryActive(id: number, active: number): Promise<void> {
  await executeSql("UPDATE expense_categories SET active = ? WHERE id = ?", [active, id]);
}

export async function deleteExpenseCategory(id: number): Promise<void> {
  await executeSql("DELETE FROM expense_categories WHERE id = ?", [id]);
}
