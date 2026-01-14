import { withTransaction } from "@/db/db";
import type { Currency, RecurrenceFrequency, WalletType } from "@/repositories/types";

type SampleWallet = {
  name: string;
  type: WalletType;
  currency: Currency;
  tag: string | null;
};

type SampleIncomeEntry = {
  name: string;
  amount: number;
  start_date: string;
  recurrence_frequency: RecurrenceFrequency | null;
  recurrence_interval: number | null;
  one_shot: number;
  note: string | null;
  walletName: string;
};

type SampleExpenseEntry = SampleIncomeEntry & {
  expenseCategory: string;
};

type SampleSnapshotLine = {
  walletName: string;
  amount: number;
};

type SampleSnapshot = {
  date: string;
  lines: SampleSnapshotLine[];
};

const sampleWallets: SampleWallet[] = [
  { name: "Conto corrente", type: "LIQUIDITY", currency: "EUR", tag: "Casa" },
  { name: "Pocket cash", type: "LIQUIDITY", currency: "EUR", tag: "Cash" },
  { name: "Broker ETF", type: "INVEST", currency: "EUR", tag: "ETF" },
];

const sampleExpenseCategories = [
  { name: "Casa", color: "#F97316" },
  { name: "Spesa", color: "#5C9DFF" },
  { name: "Auto", color: "#22D3EE" },
];

const sampleIncomeEntries: SampleIncomeEntry[] = [
  {
    name: "Stipendio",
    amount: 2400,
    start_date: "2024-01-31",
    recurrence_frequency: "MONTHLY",
    recurrence_interval: 1,
    one_shot: 0,
    note: "Netto mensile",
    walletName: "Conto corrente",
  },
  {
    name: "Freelance UX",
    amount: 800,
    start_date: "2024-02-15",
    recurrence_frequency: "MONTHLY",
    recurrence_interval: 2,
    one_shot: 0,
    note: "Project work",
    walletName: "Pocket cash",
  },
  {
    name: "Bonus aziendale",
    amount: 1200,
    start_date: "2025-02-10",
    recurrence_frequency: null,
    recurrence_interval: null,
    one_shot: 1,
    note: "Una tantum",
    walletName: "Broker ETF",
  },
];

const sampleExpenseEntries: SampleExpenseEntry[] = [
  {
    name: "Affitto",
    amount: 700,
    start_date: "2024-01-01",
    recurrence_frequency: "MONTHLY",
    recurrence_interval: 1,
    one_shot: 0,
    note: null,
    walletName: "Conto corrente",
    expenseCategory: "Casa",
  },
  {
    name: "Spesa settimanale",
    amount: 120,
    start_date: "2024-01-05",
    recurrence_frequency: "WEEKLY",
    recurrence_interval: 1,
    one_shot: 0,
    note: "Supermercato",
    walletName: "Pocket cash",
    expenseCategory: "Spesa",
  },
  {
    name: "Assicurazione auto",
    amount: 240,
    start_date: "2024-07-20",
    recurrence_frequency: "YEARLY",
    recurrence_interval: 1,
    one_shot: 0,
    note: "Polizza privata",
    walletName: "Broker ETF",
    expenseCategory: "Auto",
  },
];

const sampleSnapshots: SampleSnapshot[] = [
  {
    date: "2024-12-01",
    lines: [
      { walletName: "Conto corrente", amount: 2500 },
      { walletName: "Broker ETF", amount: 1200 },
      { walletName: "Pocket cash", amount: 300 },
    ],
  },
  {
    date: "2025-01-01",
    lines: [
      { walletName: "Conto corrente", amount: 2700 },
      { walletName: "Broker ETF", amount: 1400 },
      { walletName: "Pocket cash", amount: 220 },
    ],
  },
  {
    date: "2025-02-01",
    lines: [
      { walletName: "Conto corrente", amount: 2600 },
      { walletName: "Broker ETF", amount: 1600 },
      { walletName: "Pocket cash", amount: 400 },
    ],
  },
];

export async function loadSampleData(): Promise<void> {
  await withTransaction(async (db) => {
    const tablesToClear = [
      "snapshot_lines",
      "snapshots",
      "income_entries",
      "expense_entries",
      "wallets",
      "expense_categories",
    ];
    for (const table of tablesToClear) {
      await db.runAsync(`DELETE FROM ${table}`);
    }

    const walletIds: Record<string, number> = {};
    for (const wallet of sampleWallets) {
      const result = await db.runAsync(
        "INSERT INTO wallets (name, type, currency, tag, active) VALUES (?, ?, ?, ?, 1)",
        [wallet.name, wallet.type, wallet.currency, wallet.tag]
      );
      walletIds[wallet.name] = result.lastInsertRowId ?? 0;
    }

    const categoryIds: Record<string, number> = {};
    for (const category of sampleExpenseCategories) {
      const result = await db.runAsync(
        "INSERT INTO expense_categories (name, color, active) VALUES (?, ?, 1)",
        [category.name, category.color]
      );
      categoryIds[category.name] = result.lastInsertRowId ?? 0;
    }

    for (const entry of sampleIncomeEntries) {
      await db.runAsync(
        `INSERT INTO income_entries
         (name, amount, start_date, recurrence_frequency, recurrence_interval, one_shot, note, active, wallet_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          entry.name,
          entry.amount,
          entry.start_date,
          entry.recurrence_frequency,
          entry.recurrence_interval,
          entry.one_shot,
          entry.note,
          walletIds[entry.walletName] ?? null,
        ]
      );
    }

    for (const entry of sampleExpenseEntries) {
      await db.runAsync(
        `INSERT INTO expense_entries
         (name, amount, start_date, recurrence_frequency, recurrence_interval, one_shot, note, active, wallet_id, expense_category_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          entry.name,
          entry.amount,
          entry.start_date,
          entry.recurrence_frequency,
          entry.recurrence_interval,
          entry.one_shot,
          entry.note,
          walletIds[entry.walletName] ?? null,
          categoryIds[entry.expenseCategory] ?? null,
        ]
      );
    }

    for (const snapshot of sampleSnapshots) {
      const snapshotResult = await db.runAsync("INSERT INTO snapshots (date) VALUES (?)", [snapshot.date]);
      const snapshotId = snapshotResult.lastInsertRowId ?? 0;
      for (const line of snapshot.lines) {
        const walletId = walletIds[line.walletName];
        if (!walletId) continue;
        await db.runAsync(
          "INSERT INTO snapshot_lines (snapshot_id, wallet_id, amount) VALUES (?, ?, ?)",
          [snapshotId, walletId, line.amount]
        );
      }
    }
  });
}
