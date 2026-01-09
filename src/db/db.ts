import * as SQLite from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import { migrations } from "./migrations";

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("mymoney.db").catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

type SqlArgs = (string | number | null)[];

type RowList<T = unknown> = {
  length: number;
  item: (index: number) => T;
};

export type SqlResult<T = unknown> = {
  rows: RowList<T>;
  insertId?: number;
  rowsAffected?: number;
};

function isQueryReturningRows(sql: string): boolean {
  const upper = sql.trim().toUpperCase();
  return upper.startsWith("SELECT") || upper.startsWith("PRAGMA");
}

export async function executeSql(sql: string, args: SqlArgs = []): Promise<SqlResult> {
  const db = await getDb();
  if (isQueryReturningRows(sql)) {
    const rows = await db.getAllAsync<unknown>(sql, args);
    return {
      rows: {
        length: rows.length,
        item: (index: number) => rows[index],
      },
    };
  }

  const result = await db.runAsync(sql, args);
  return {
    rows: {
      length: 0,
      item: () => {
        throw new Error("No rows available.");
      },
    },
    insertId: result.lastInsertRowId,
    rowsAffected: result.changes,
  };
}

export async function runSqlBatch(statements: { sql: string; args?: SqlArgs }[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const statement of statements) {
      await db.runAsync(statement.sql, statement.args ?? []);
    }
  });
}

async function getUserVersion(): Promise<number> {
  const result = await executeSql("PRAGMA user_version");
  return (result.rows.item(0) as { user_version: number }).user_version;
}

async function setUserVersion(version: number): Promise<void> {
  await executeSql(`PRAGMA user_version = ${version}`);
}

export async function runMigrations(): Promise<void> {
  const currentVersion = await getUserVersion();
  let version = currentVersion;
  for (const migration of migrations) {
    if (migration.version > version) {
      await runSqlBatch(migration.statements);
      version = migration.version;
      await setUserVersion(version);
    }
  }
}

export async function withTransaction(fn: (db: SQLiteDatabase) => Promise<void>): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(() => fn(db));
}
