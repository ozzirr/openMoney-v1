import { executeSql, runSqlBatch } from "@/db/db";
import { fetchAll, fetchOne } from "./helpers";
import type { Currency, Wallet, WalletType } from "./types";

export const DEFAULT_WALLET_COLOR = "#9B7BFF";

export async function listWallets(activeOnly = false): Promise<Wallet[]> {
  const where = activeOnly ? "WHERE active = 1" : "";
  return fetchAll<Wallet>(
    `SELECT
       id,
       name,
       type,
       currency,
       tag,
       active,
       sort_order AS sortOrder,
       color
     FROM wallets ${where}
     ORDER BY
       CASE LOWER(type) WHEN 'liquidity' THEN 0 ELSE 1 END,
       COALESCE(sort_order, 999999) ASC,
       id ASC`
  );
}

export async function getWallet(id: number): Promise<Wallet | null> {
  return fetchOne<Wallet>("SELECT * FROM wallets WHERE id = ?", [id]);
}

async function getNextSortOrder(type: WalletType): Promise<number> {
  const result = await executeSql("SELECT MAX(sort_order) AS maxOrder FROM wallets WHERE type = ?", [type]);
  const row = result.rows.item(0) as { maxOrder: number | null };
  return row?.maxOrder ?? -1;
}

export async function createWallet(
  name: string,
  type: WalletType,
  currency: Currency,
  tag: string | null,
  active = 1,
  color = DEFAULT_WALLET_COLOR
): Promise<number> {
  const nextOrder = (await getNextSortOrder(type)) + 1;
  const result = await executeSql(
    "INSERT INTO wallets (name, type, currency, tag, active, sort_order, color) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [name, type, currency, tag, active, nextOrder, color]
  );
  return result.insertId ?? 0;
}

export async function updateWallet(
  id: number,
  name: string,
  type: WalletType,
  currency: Currency,
  tag: string | null,
  active: number,
  color = DEFAULT_WALLET_COLOR
): Promise<void> {
  await executeSql(
    "UPDATE wallets SET name = ?, type = ?, currency = ?, tag = ?, active = ?, color = ? WHERE id = ?",
    [name, type, currency, tag, active, color, id]
  );
}

export async function renameWallet(id: number, name: string): Promise<void> {
  await executeSql("UPDATE wallets SET name = ? WHERE id = ?", [name, id]);
}

export async function setWalletTag(id: number, tag: string | null): Promise<void> {
  await executeSql("UPDATE wallets SET tag = ? WHERE id = ?", [tag, id]);
}

export async function setWalletCurrency(id: number, currency: Currency): Promise<void> {
  await executeSql("UPDATE wallets SET currency = ? WHERE id = ?", [currency, id]);
}

export async function deleteWallet(id: number): Promise<void> {
  await executeSql("DELETE FROM snapshot_lines WHERE wallet_id = ?", [id]);
  await executeSql("UPDATE income_entries SET wallet_id = NULL WHERE wallet_id = ?", [id]);
  await executeSql("UPDATE expense_entries SET wallet_id = NULL WHERE wallet_id = ?", [id]);
  await executeSql("DELETE FROM wallets WHERE id = ?", [id]);
}

export async function ensureDefaultWallets(): Promise<void> {
  const wallets = await listWallets();
  if (wallets.length > 0) return;
  await createWallet("Liquidità", "LIQUIDITY", "EUR", "Liquidità", 1);
  await createWallet("Investimenti", "INVEST", "EUR", "Investimenti", 1);
}

export async function updateWalletSortOrders(updates: { id: number; sortOrder: number }[]): Promise<void> {
  if (updates.length === 0) return;
  const statements = updates.map((update) => ({
    sql: "UPDATE wallets SET sort_order = ? WHERE id = ?",
    args: [update.sortOrder, update.id],
  }));
  try {
    await runSqlBatch(statements);
  } catch (error) {
    throw error;
  }
}
