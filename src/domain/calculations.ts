import type { Snapshot, SnapshotLineDetail, WalletType } from "@/repositories/types";

export type BreakdownItem = { label: string; value: number };
export type SnapshotPoint = { date: string; total: number };
export type SnapshotTotals = { liquidity: number; investments: number; netWorth: number };

export function totalFromSnapshot(lines: SnapshotLineDetail[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}

export function totalsByWalletType(lines: SnapshotLineDetail[]): SnapshotTotals {
  const totals = lines.reduce(
    (acc, line) => {
      if (line.wallet_type === "INVEST") {
        acc.investments += line.amount;
      } else {
        acc.liquidity += line.amount;
      }
      return acc;
    },
    { liquidity: 0, investments: 0 }
  );
  return { ...totals, netWorth: totals.liquidity + totals.investments };
}

export function breakdownByWallet(lines: SnapshotLineDetail[]): BreakdownItem[] {
  const map = new Map<string, number>();
  lines.forEach((line) => {
    const label = line.wallet_name ?? "Sconosciuto";
    map.set(label, (map.get(label) ?? 0) + line.amount);
  });
  return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
}

export function breakdownInvestByTag(lines: SnapshotLineDetail[]): BreakdownItem[] {
  const map = new Map<string, number>();
  lines.forEach((line) => {
    if (line.wallet_type !== "INVEST") return;
    const label = line.wallet_tag ?? "Altro";
    map.set(label, (map.get(label) ?? 0) + line.amount);
  });
  return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
}

export function snapshotSeries(
  snapshots: Snapshot[],
  linesBySnapshot: Record<number, SnapshotLineDetail[]>,
  limit = 12
): SnapshotPoint[] {
  const series = snapshots
    .map((snapshot) => ({
      date: snapshot.date,
      total: totalFromSnapshot(linesBySnapshot[snapshot.id] ?? []),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return series.slice(-limit);
}

export function sumByWalletType(lines: SnapshotLineDetail[], type: WalletType): number {
  return lines.reduce((sum, line) => (line.wallet_type === type ? sum + line.amount : sum), 0);
}
