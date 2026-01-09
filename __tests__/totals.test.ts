import { totalsByWalletType } from "@/domain/calculations";
import type { SnapshotLineDetail } from "@/repositories/types";

describe("totals", () => {
  test("totalsByWalletType sums by wallet type", () => {
    const lines: SnapshotLineDetail[] = [
      {
        id: 1,
        snapshot_id: 1,
        wallet_id: 1,
        amount: 100,
        wallet_name: "Banca 1",
        wallet_type: "LIQUIDITY",
        wallet_tag: "Casa",
      },
      {
        id: 2,
        snapshot_id: 1,
        wallet_id: 2,
        amount: 300,
        wallet_name: "Broker 1",
        wallet_type: "INVEST",
        wallet_tag: "Crypto",
      },
    ];

    const totals = totalsByWalletType(lines);
    expect(totals.liquidity).toBe(100);
    expect(totals.investments).toBe(300);
    expect(totals.netWorth).toBe(400);
  });
});
