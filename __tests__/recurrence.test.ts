import { listOccurrencesInRange } from "@/domain/recurrence";
import type { IncomeEntry } from "@/repositories/types";

describe("recurrence", () => {
  test("monthly clamped for end-of-month", () => {
    const entry: IncomeEntry = {
      id: 1,
      name: "Stipendio",
      amount: 1000,
      start_date: "2025-01-31",
      recurrence_frequency: "MONTHLY",
      recurrence_interval: 1,
      one_shot: 0,
    };

    const dates = listOccurrencesInRange(entry, "2025-02-01", "2025-03-31");
    expect(dates).toEqual(["2025-02-28", "2025-03-31"]);
  });

  test("one-shot in range", () => {
    const entry: IncomeEntry = {
      id: 2,
      name: "Bonus",
      amount: 500,
      start_date: "2025-06-15",
      recurrence_frequency: null,
      recurrence_interval: null,
      one_shot: 1,
    };

    const dates = listOccurrencesInRange(entry, "2025-06-01", "2025-06-30");
    expect(dates).toEqual(["2025-06-15"]);
  });
});
