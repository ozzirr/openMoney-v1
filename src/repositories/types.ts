export type WalletType = "LIQUIDITY" | "INVEST";
export type Currency = "EUR" | "USD" | "GBP";
export type RecurrenceFrequency = "WEEKLY" | "MONTHLY" | "YEARLY";

export type Wallet = {
  id: number;
  name: string;
  type: WalletType;
  currency: Currency;
  tag: string | null;
  active: number;
  color: string;
  sortOrder: number;
};

export type ExpenseCategory = {
  id: number;
  name: string;
  color: string;
  active: number;
};

export type IncomeEntry = {
  id: number;
  name: string;
  amount: number;
  start_date: string;
  recurrence_frequency: RecurrenceFrequency | null;
  recurrence_interval: number | null;
  one_shot: number;
  note: string | null;
  active: number;
  wallet_id: number | null;
};

export type ExpenseEntry = {
  id: number;
  name: string;
  amount: number;
  start_date: string;
  recurrence_frequency: RecurrenceFrequency | null;
  recurrence_interval: number | null;
  one_shot: number;
  note: string | null;
  active: number;
  wallet_id: number | null;
  expense_category_id: number;
};

export type Snapshot = {
  id: number;
  date: string;
};

export type SnapshotLine = {
  id: number;
  snapshot_id: number;
  wallet_id: number;
  amount: number;
};

export type SnapshotLineDetail = SnapshotLine & {
  wallet_name: string | null;
  wallet_type: WalletType | null;
  wallet_tag: string | null;
};

export type Preference = {
  key: string;
  value: string;
};
