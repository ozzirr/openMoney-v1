import * as FileSystem from "expo-file-system/legacy";
import { executeSql, withTransaction } from "@/db/db";
import type { ExportPayload } from "./types";
import { isIsoDate } from "@/utils/dates";
import type { SnapshotLine } from "@/repositories/types";
import { DEFAULT_WALLET_COLOR } from "@/repositories/walletsRepo";

const REQUIRED_KEYS: (keyof ExportPayload)[] = [
  "version",
  "wallets",
  "expense_categories",
  "income_entries",
  "expense_entries",
  "snapshots",
  "snapshot_lines",
];

export function validateExportPayload(payload: ExportPayload): string[] {
  const errors: string[] = [];
  for (const key of REQUIRED_KEYS) {
    if (!(key in payload)) {
      errors.push(`Campo mancante: ${String(key)}`);
    }
  }

  const requiredFields: { list: Record<string, unknown>[]; fields: string[]; label: string }[] = [
    { list: payload.wallets ?? [], fields: ["id", "name", "type", "currency"], label: "wallets" },
    { list: payload.expense_categories ?? [], fields: ["id", "name"], label: "expense_categories" },
    { list: payload.income_entries ?? [], fields: ["id", "name", "amount", "start_date"], label: "income_entries" },
    { list: payload.expense_entries ?? [], fields: ["id", "name", "amount", "start_date", "expense_category_id"], label: "expense_entries" },
    { list: payload.snapshots ?? [], fields: ["id", "date"], label: "snapshots" },
    { list: payload.snapshot_lines ?? [], fields: ["id", "snapshot_id", "wallet_id", "amount"], label: "snapshot_lines" },
  ];

  requiredFields.forEach((group) => {
    group.list.forEach((row, index) => {
      group.fields.forEach((field) => {
        if (row[field] === undefined || row[field] === null) {
          errors.push(`Campo mancante in ${group.label}[${index}]: ${field}`);
        }
      });
    });
  });

  const dateFields: { list: { date?: string; start_date?: string }[]; label: string; key: "date" | "start_date" }[] = [
    { list: payload.income_entries ?? [], label: "income_entries", key: "start_date" },
    { list: payload.expense_entries ?? [], label: "expense_entries", key: "start_date" },
    { list: payload.snapshots ?? [], label: "snapshots", key: "date" },
  ];

  for (const field of dateFields) {
    field.list.forEach((row, index) => {
      const value = row[field.key];
      if (!value || !isIsoDate(value)) {
        errors.push(`Data non valida in ${field.label}[${index}]: ${value}`);
      }
    });
  }

  return errors;
}

export async function exportToJson(): Promise<ExportPayload> {
  const tables = [
    "wallets",
    "expense_categories",
    "income_entries",
    "expense_entries",
    "snapshots",
    "snapshot_lines",
  ] as const;

  const payload: Partial<ExportPayload> = { version: 1 };

  for (const table of tables) {
    const result = await executeSql(`SELECT * FROM ${table}`);
    const rows: unknown[] = [];
    for (let i = 0; i < result.rows.length; i += 1) {
      rows.push(result.rows.item(i));
    }
    (payload as Record<string, unknown>)[table] = rows;
  }

  return payload as ExportPayload;
}

export async function exportToFile(filePath: string): Promise<void> {
  const payload = await exportToJson();
  await FileSystem.writeAsStringAsync(filePath, JSON.stringify(payload, null, 2));
}

export async function importFromJson(payload: ExportPayload): Promise<void> {
  const errors = validateExportPayload(payload);
  if (errors.length) {
    throw new Error(errors.join("\n"));
  }

  await withTransaction(async (db) => {
    const tables = [
      "snapshot_lines",
      "snapshots",
      "income_entries",
      "expense_entries",
      "wallets",
      "expense_categories",
    ];

    for (const table of tables) {
      await db.runAsync(`DELETE FROM ${table}`);
    }

    for (const row of payload.wallets) {
      await db.runAsync(
        "INSERT INTO wallets (id, name, type, currency, tag, active, color) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [row.id, row.name, row.type, row.currency, row.tag, row.active, row.color ?? DEFAULT_WALLET_COLOR]
      );
    }

    for (const row of payload.expense_categories) {
      await db.runAsync("INSERT INTO expense_categories (id, name, active) VALUES (?, ?, ?)", [
        row.id,
        row.name,
        row.active ?? 1,
      ]);
    }

    for (const row of payload.income_entries) {
      await db.runAsync(
        `INSERT INTO income_entries
        (id, name, amount, start_date, recurrence_frequency, recurrence_interval, one_shot, note, active, wallet_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.name,
          row.amount,
          row.start_date,
          row.recurrence_frequency,
          row.recurrence_interval,
          row.one_shot,
          row.note,
          row.active,
          row.wallet_id,
        ]
      );
    }

    for (const row of payload.expense_entries) {
      await db.runAsync(
        `INSERT INTO expense_entries
        (id, name, amount, start_date, recurrence_frequency, recurrence_interval, one_shot, note, active, wallet_id, expense_category_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.name,
          row.amount,
          row.start_date,
          row.recurrence_frequency,
          row.recurrence_interval,
          row.one_shot,
          row.note,
          row.active,
          row.wallet_id,
          row.expense_category_id,
        ]
      );
    }

    for (const row of payload.snapshots) {
      await db.runAsync("INSERT INTO snapshots (id, date) VALUES (?, ?)", [row.id, row.date]);
    }

    for (const row of payload.snapshot_lines as SnapshotLine[]) {
      await db.runAsync(
        `INSERT INTO snapshot_lines
        (id, snapshot_id, wallet_id, amount)
        VALUES (?, ?, ?, ?)`,
        [row.id, row.snapshot_id, row.wallet_id, row.amount]
      );
    }
  });
}

export async function importFromFile(filePath: string): Promise<void> {
  const content = await FileSystem.readAsStringAsync(filePath);
  const payload = JSON.parse(content) as ExportPayload;
  await importFromJson(payload);
}
