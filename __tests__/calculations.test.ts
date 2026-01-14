import { breakdownByWallet, breakdownInvestByTag, snapshotSeries, totalsByWalletType } from "@/domain/calculations";
import { sampleSnapshots, sampleSnapshotLinesBySnapshot } from "./fixtures/sampleData";

describe("calculations helpers with sample data", () => {
  test("totals by wallet type reflect latest snapshot", () => {
    const snapshotLines = sampleSnapshotLinesBySnapshot[3];
    const totals = totalsByWalletType(snapshotLines);

    expect(totals).toEqual({ liquidity: 3000, investments: 1600, netWorth: 4600 });
  });

  test("snapshotSeries builds a timeline of totals", () => {
    const series = snapshotSeries(sampleSnapshots, sampleSnapshotLinesBySnapshot);

    expect(series).toEqual([
      { date: "2024-12-01", total: 4000 },
      { date: "2025-01-01", total: 4320 },
      { date: "2025-02-01", total: 4600 },
    ]);
  });

  test("breakdown by wallet groups entries by wallet name", () => {
    const breakdown = breakdownByWallet(sampleSnapshotLinesBySnapshot[2]);

    expect(breakdown).toEqual([
      { label: "Conto corrente", value: 2700 },
      { label: "Fondo investimenti", value: 1400 },
      { label: "Pocket cash", value: 220 },
    ]);
  });

  test("breakdownInvestByTag sums investments per tag", () => {
    const breakdown = breakdownInvestByTag(sampleSnapshotLinesBySnapshot[3]);

    expect(breakdown).toEqual([{ label: "ETF", value: 1600 }]);
  });
});
