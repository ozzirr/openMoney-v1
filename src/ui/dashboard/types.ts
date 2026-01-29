export type KPIItem = {
  id: string;
  label: string;
  value: number;
  deltaValue: number;
  deltaPct: number;
  deltaStatus?: "OK" | "NO_DATA";
  accent?: string;
  breakdown?: { label: string; value: number }[];
};

export type KpiDeltaRange = "1D" | "7D" | "28D" | "3M" | "6M" | "12M";

export const KPI_DELTA_RANGE_LABELS: Record<KpiDeltaRange, string> = {
  "1D": "Oggi vs precedente",
  "7D": "Ultimi 7 giorni",
  "28D": "Ultimi 28 giorni",
  "3M": "Ultimi 3 mesi",
  "6M": "Ultimi 6 mesi",
  "12M": "Ultimi 12 mesi",
};

export function getKpiDeltaRangeLabel(range: KpiDeltaRange): string {
  return KPI_DELTA_RANGE_LABELS[range];
}

export type PortfolioPoint = {
  date: string;
  total: number;
  liquidity: number;
  investments: number;
};

export type DistributionItem = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export type CashflowMonth = {
  month: string;
  income: number;
  expense: number;
};

export type CashflowSummary = {
  avgIncome: number;
  avgExpense: number;
  avgSavings: number;
  months: CashflowMonth[];
};

export type CategoryRow = {
  id: string;
  label: string;
  value: number;
  color: string;
  pct: number;
};

export type RecurrenceRow = {
  id: string;
  entryId: number;
  date: string;
  type: "income" | "expense";
  category: string;
  categoryColor?: string;
  description: string;
  amount: number;
  recurring: boolean;
  frequencyKey?: string | null;
};

export type DashboardData = {
  kpis: KPIItem[];
  portfolioSeries: PortfolioPoint[];
  distributions: DistributionItem[];
  cashflow: CashflowSummary;
  categories: CategoryRow[];
  recurrences: RecurrenceRow[];
};
