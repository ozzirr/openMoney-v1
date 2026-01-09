import type {
  ExpenseCategory,
  ExpenseEntry,
  IncomeEntry,
  Snapshot,
  SnapshotLine,
  Wallet,
} from "@/repositories/types";

export type ExportPayload = {
  version: number;
  wallets: Wallet[];
  expense_categories: ExpenseCategory[];
  income_entries: IncomeEntry[];
  expense_entries: ExpenseEntry[];
  snapshots: Snapshot[];
  snapshot_lines: SnapshotLine[];
};
