import { executeSql } from "@/db/db";
import { fetchAll, fetchOne } from "./helpers";
import type { Preference } from "./types";

export async function listPreferences(): Promise<Preference[]> {
  return fetchAll<Preference>("SELECT * FROM preferences ORDER BY key ASC");
}

export async function getPreference(key: string): Promise<Preference | null> {
  return fetchOne<Preference>("SELECT * FROM preferences WHERE key = ?", [key]);
}

export async function setPreference(key: string, value: string): Promise<void> {
  await executeSql(
    "INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

export async function deletePreference(key: string): Promise<void> {
  await executeSql("DELETE FROM preferences WHERE key = ?", [key]);
}
