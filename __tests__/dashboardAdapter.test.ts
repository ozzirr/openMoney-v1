import { buildKpiDeltaForRange } from "@/ui/dashboard/adapter";
import type { Snapshot, SnapshotLineDetail } from "@/repositories/types";
import type { PortfolioPoint } from "@/ui/dashboard/types";

const makeLine = (
  snapshotId: number,
  walletType: "LIQUIDITY" | "INVEST",
  amount: number
): SnapshotLineDetail => ({
  id: Number(`${snapshotId}${walletType === "LIQUIDITY" ? "1" : "2"}`),
  snapshot_id: snapshotId,
  wallet_id: walletType === "LIQUIDITY" ? 1 : 2,
  amount,
  wallet_name: walletType === "LIQUIDITY" ? "Cash" : "Invest",
  wallet_type: walletType,
  wallet_tag: null,
});

describe("buildKpiDeltaForRange", () => {
  test("1D: uses latest snapshot vs previous snapshot", () => {
    const snapshots: Snapshot[] = [
      { id: 2, date: "2026-01-29" },
      { id: 1, date: "2026-01-28" },
    ];
    const snapshotLinesById: Record<number, SnapshotLineDetail[]> = {
      1: [makeLine(1, "LIQUIDITY", 100), makeLine(1, "INVEST", 50)],
      2: [makeLine(2, "LIQUIDITY", 120), makeLine(2, "INVEST", 40)],
    };

    const result = buildKpiDeltaForRange("1D", snapshots, [], snapshotLinesById);
    expect(result.status).toBe("OK");
    expect(result.deltas.liquidity.deltaAbs).toBe(20);
    expect(result.deltas.investments.deltaAbs).toBe(-10);
    expect(result.deltas.total.deltaAbs).toBe(10);
    expect(result.deltas.liquidity.deltaPct).toBeCloseTo(0.2, 5);
    expect(result.deltas.investments.deltaPct).toBeCloseTo(-0.2, 5);
    expect(result.deltas.total.deltaPct).toBeCloseTo(10 / 150, 5);
  });

  test("28D: selects closest snapshot on or before target date", () => {
    const snapshots: Snapshot[] = [
      { id: 3, date: "2026-01-29" },
      { id: 2, date: "2026-01-10" },
      { id: 1, date: "2025-12-31" },
    ];
    const snapshotLinesById: Record<number, SnapshotLineDetail[]> = {
      3: [makeLine(3, "LIQUIDITY", 200), makeLine(3, "INVEST", 100)],
      2: [makeLine(2, "LIQUIDITY", 180), makeLine(2, "INVEST", 90)],
      1: [makeLine(1, "LIQUIDITY", 150), makeLine(1, "INVEST", 80)],
    };

    const result = buildKpiDeltaForRange("28D", snapshots, [], snapshotLinesById);
    expect(result.status).toBe("OK");
    expect(result.meta?.startDate).toBe("2025-12-31");
    expect(result.meta?.endDate).toBe("2026-01-29");
    expect(result.deltas.total.deltaAbs).toBe(70);
  });

  test("28D: returns NO_DATA when start snapshot is missing", () => {
    const snapshots: Snapshot[] = [{ id: 1, date: "2026-01-29" }];
    const snapshotLinesById: Record<number, SnapshotLineDetail[]> = {
      1: [makeLine(1, "LIQUIDITY", 120), makeLine(1, "INVEST", 40)],
    };

    const result = buildKpiDeltaForRange("28D", snapshots, [], snapshotLinesById);
    expect(result.status).toBe("NO_DATA");
  });

  test("3M: uses monthly portfolio series with missing months", () => {
    const portfolioSeries: PortfolioPoint[] = [
      { date: "2025-10-01", total: 100, liquidity: 60, investments: 40 },
      { date: "2025-12-01", total: 120, liquidity: 70, investments: 50 },
      { date: "2026-01-01", total: 130, liquidity: 75, investments: 55 },
    ];

    const result = buildKpiDeltaForRange("3M", [], portfolioSeries, {});
    expect(result.status).toBe("OK");
    expect(result.deltas.total.deltaAbs).toBe(30);
    expect(result.deltas.liquidity.deltaAbs).toBe(15);
    expect(result.deltas.investments.deltaAbs).toBe(15);
    expect(result.meta?.startDate).toBe("2025-10-01");
    expect(result.meta?.endDate).toBe("2026-01-01");
  });
});
