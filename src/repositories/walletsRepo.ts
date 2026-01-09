import { executeSql } from "@/db/db";
import { fetchAll, fetchOne } from "./helpers";
import type { Currency, Wallet, WalletType } from "./types";

export async function listWallets(activeOnly = false): Promise<Wallet[]> {
  const where = activeOnly ? "WHERE active = 1" : "";
  return fetchAll<Wallet>(`SELECT * FROM wallets ${where} ORDER BY id ASC`);
}

export async function getWallet(id: number): Promise<Wallet | null> {
  return fetchOne<Wallet>("SELECT * FROM wallets WHERE id = ?", [id]);
}

export async function createWallet(
  name: string,
  type: WalletType,
  currency: Currency,
  tag: string | null,
  active = 1
): Promise<number> {
  const result = await executeSql(
    "INSERT INTO wallets (name, type, currency, tag, active) VALUES (?, ?, ?, ?, ?)",
    [name, type, currency, tag, active]
  );
  return result.insertId ?? 0;
}

export async function updateWallet(
  id: number,
  name: string,
  type: WalletType,
  currency: Currency,
  tag: string | null,
  active: number
): Promise<void> {
  await executeSql(
    "UPDATE wallets SET name = ?, type = ?, currency = ?, tag = ?, active = ? WHERE id = ?",
    [name, type, currency, tag, active, id]
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
