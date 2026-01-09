import { executeSql, withTransaction } from "@/db/db";
import { fetchAll, fetchOne } from "./helpers";
import type { Snapshot, SnapshotLine, SnapshotLineDetail } from "./types";

export async function listSnapshots(): Promise<Snapshot[]> {
  return fetchAll<Snapshot>("SELECT * FROM snapshots ORDER BY date DESC");
}

export async function getSnapshot(id: number): Promise<Snapshot | null> {
  return fetchOne<Snapshot>("SELECT * FROM snapshots WHERE id = ?", [id]);
}

export async function getSnapshotByDate(date: string): Promise<Snapshot | null> {
  return fetchOne<Snapshot>("SELECT * FROM snapshots WHERE date = ?", [date]);
}

export async function getLatestSnapshot(): Promise<Snapshot | null> {
  return fetchOne<Snapshot>("SELECT * FROM snapshots ORDER BY date DESC LIMIT 1");
}

export async function createSnapshot(date: string): Promise<number> {
  const result = await executeSql("INSERT INTO snapshots (date) VALUES (?)", [date]);
  return result.insertId ?? 0;
}

export async function deleteSnapshot(id: number): Promise<void> {
  await executeSql("DELETE FROM snapshot_lines WHERE snapshot_id = ?", [id]);
  await executeSql("DELETE FROM snapshots WHERE id = ?", [id]);
}

export async function listSnapshotLines(snapshotId: number): Promise<SnapshotLineDetail[]> {
  return fetchAll<SnapshotLineDetail>(
    `SELECT sl.*, w.name AS wallet_name, w.type AS wallet_type, w.tag AS wallet_tag
     FROM snapshot_lines sl
     LEFT JOIN wallets w ON w.id = sl.wallet_id
     WHERE sl.snapshot_id = ?
     ORDER BY sl.id ASC`,
    [snapshotId]
  );
}

export async function createSnapshotLine(line: Omit<SnapshotLine, "id">): Promise<number> {
  const result = await executeSql(
    `INSERT INTO snapshot_lines (snapshot_id, wallet_id, amount)
     VALUES (?, ?, ?)` ,
    [line.snapshot_id, line.wallet_id, line.amount]
  );
  return result.insertId ?? 0;
}

export async function createSnapshotWithLines(
  date: string,
  lines: Omit<SnapshotLine, "id" | "snapshot_id">[]
): Promise<number> {
  let snapshotId = 0;
  await withTransaction(async (db) => {
    const result = await db.runAsync("INSERT INTO snapshots (date) VALUES (?)", [date]);
    snapshotId = result.lastInsertRowId ?? 0;
    for (const line of lines) {
      await db.runAsync(
        "INSERT INTO snapshot_lines (snapshot_id, wallet_id, amount) VALUES (?, ?, ?)",
        [snapshotId, line.wallet_id, line.amount]
      );
    }
  });
  return snapshotId;
}

export async function updateSnapshotWithLines(
  snapshotId: number,
  date: string,
  lines: Omit<SnapshotLine, "id" | "snapshot_id">[]
): Promise<number> {
  await withTransaction(async (db) => {
    await db.runAsync("UPDATE snapshots SET date = ? WHERE id = ?", [date, snapshotId]);
    await db.runAsync("DELETE FROM snapshot_lines WHERE snapshot_id = ?", [snapshotId]);
    for (const line of lines) {
      await db.runAsync(
        "INSERT INTO snapshot_lines (snapshot_id, wallet_id, amount) VALUES (?, ?, ?)",
        [snapshotId, line.wallet_id, line.amount]
      );
    }
  });
  return snapshotId;
}

export async function deleteSnapshotLine(id: number): Promise<void> {
  await executeSql("DELETE FROM snapshot_lines WHERE id = ?", [id]);
}
