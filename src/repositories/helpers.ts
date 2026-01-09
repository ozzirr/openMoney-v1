import { executeSql } from "@/db/db";

export async function fetchAll<T>(sql: string, args: (string | number | null)[] = []): Promise<T[]> {
  const result = await executeSql(sql, args);
  const items: T[] = [];
  for (let i = 0; i < result.rows.length; i += 1) {
    items.push(result.rows.item(i) as T);
  }
  return items;
}

export async function fetchOne<T>(sql: string, args: (string | number | null)[] = []): Promise<T | null> {
  const result = await executeSql(sql, args);
  if (result.rows.length === 0) return null;
  return result.rows.item(0) as T;
}
