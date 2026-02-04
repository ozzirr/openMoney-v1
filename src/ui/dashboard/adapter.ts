import { breakdownByWallet, totalsByWalletType } from "@/domain/calculations";
import { averageMonthlyTotals, totalsForMonth } from "@/domain/finance";
import { listOccurrencesInRange, upcomingOccurrences } from "@/domain/recurrence";
import type { ExpenseCategory, ExpenseEntry, IncomeEntry, Snapshot, SnapshotLineDetail, Wallet } from "@/repositories/types";
import { DEFAULT_WALLET_COLOR } from "@/repositories/walletsRepo";
import { orderWalletsForUI } from "@/domain/walletOrdering";
import { addDays, addMonthsClamped, getFrequencyKey } from "@/utils/recurrence";
import i18n from "i18next";
import type {
  CashflowMonth,
  CashflowSummary,
  CategoryRow,
  DashboardData,
  DistributionItem,
  KPIItem,
  KpiDeltaRange,
  PortfolioPoint,
  RecurrenceRow,
  WalletSeries,
} from "./types";

type DashboardInput = {
  latestLines: SnapshotLineDetail[];
  snapshots: Snapshot[];
  snapshotLines: Record<number, SnapshotLineDetail[]>;
  incomeEntries: IncomeEntry[];
  expenseEntries: ExpenseEntry[];
  expenseCategories: ExpenseCategory[];
  chartPoints: number;
  wallets: Wallet[];
};

const palette = ["#9B7BFF", "#5C9DFF", "#F6C177", "#66D19E", "#C084FC", "#FF8FAB", "#6EE7B7", "#94A3B8"];

function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function buildPortfolioSeries(
  snapshots: Snapshot[],
  snapshotLines: Record<number, SnapshotLineDetail[]>,
  latestLines: SnapshotLineDetail[],
  limit: number
): PortfolioPoint[] {
  const snapshotByMonth = new Map<string, Snapshot>();
  snapshots.forEach((snapshot) => {
    const monthKey = snapshot.date.slice(0, 7);
    const existing = snapshotByMonth.get(monthKey);
    if (!existing || snapshot.date > existing.date) {
      snapshotByMonth.set(monthKey, snapshot);
    }
  });

  const now = new Date();
  const safeLimit = Math.max(1, Math.min(12, limit));
  const monthKeys: string[] = Array.from({ length: safeLimit }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });

  const currentMonthKey = monthKeys[0];
  const totalsForMonth = (monthKey: string): ReturnType<typeof totalsByWalletType> | null => {
    const snapshot = snapshotByMonth.get(monthKey);
    if (snapshot) {
      const lines = snapshotLines[snapshot.id] ?? [];
      return totalsByWalletType(lines);
    }
    if (monthKey === currentMonthKey && latestLines.length > 0) {
      return totalsByWalletType(latestLines);
    }
    return null;
  };

  const points: PortfolioPoint[] = [];
  monthKeys
    .slice()
    .reverse()
    .forEach((monthKey) => {
      const totals = totalsForMonth(monthKey);
      if (!totals) return;
      points.push({
        date: `${monthKey}-01`,
        total: totals.netWorth,
        liquidity: totals.liquidity,
        investments: totals.investments,
      });
    });
  return points;
}

function buildWalletSeries(
  portfolio: PortfolioPoint[],
  snapshots: Snapshot[],
  snapshotLines: Record<number, SnapshotLineDetail[]>,
  latestLines: SnapshotLineDetail[],
  wallets: Wallet[]
): WalletSeries[] {
  const activeWallets = wallets.filter((wallet) => wallet.active !== 0);
  if (activeWallets.length === 0 || portfolio.length === 0) return [];

  const snapshotByMonth = new Map<string, Snapshot>();
  snapshots.forEach((snapshot) => {
    const monthKey = snapshot.date.slice(0, 7);
    const existing = snapshotByMonth.get(monthKey);
    if (!existing || snapshot.date > existing.date) {
      snapshotByMonth.set(monthKey, snapshot);
    }
  });

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const linesByMonth = new Map<string, SnapshotLineDetail[]>();
  const getLinesForMonth = (monthKey: string): SnapshotLineDetail[] => {
    const cached = linesByMonth.get(monthKey);
    if (cached) return cached;
    const snapshot = snapshotByMonth.get(monthKey);
    if (snapshot) {
      const lines = snapshotLines[snapshot.id] ?? [];
      linesByMonth.set(monthKey, lines);
      return lines;
    }
    if (monthKey === currentMonthKey && latestLines.length > 0) {
      linesByMonth.set(monthKey, latestLines);
      return latestLines;
    }
    linesByMonth.set(monthKey, []);
    return [];
  };

  return activeWallets.map((wallet) => ({
    walletId: wallet.id,
    name: wallet.name,
    type: wallet.type,
    color: wallet.color ?? DEFAULT_WALLET_COLOR,
    points: portfolio.map((point) => {
      const monthKey = point.date.slice(0, 7);
      const lines = getLinesForMonth(monthKey);
      const value = lines.reduce((sum, line) => (line.wallet_id === wallet.id ? sum + line.amount : sum), 0);
      return { date: point.date, value };
    }),
  }));
}

function buildKpis(
  latestLines: SnapshotLineDetail[],
  portfolio: PortfolioPoint[],
  showInvestments = true,
  range: KpiDeltaRange = "28D",
  snapshots: Snapshot[] = [],
  snapshotLines: Record<number, SnapshotLineDetail[]> = {}
): KPIItem[] {
  const totals = totalsByWalletType(latestLines);
  const deltaResult = buildKpiDeltaForRange(range, snapshots, portfolio, snapshotLines);
  const deltaTotal = deltaResult.deltas.total.deltaAbs;
  const deltaLiquidity = deltaResult.deltas.liquidity.deltaAbs;
  const deltaInvest = deltaResult.deltas.investments.deltaAbs;
  const toBreakdown = (lines: SnapshotLineDetail[]) =>
    breakdownByWallet(lines)
      .filter((item) => item.label)
      .sort((a, b) => b.value - a.value)
      .map((item) => ({ label: item.label, value: item.value }));
  const liquidityBreakdown = toBreakdown(latestLines.filter((line) => line.wallet_type !== "INVEST"));
  const investBreakdown = toBreakdown(latestLines.filter((line) => line.wallet_type === "INVEST"));
  const netWorthBreakdown = toBreakdown(latestLines);

  const liquidityItem: KPIItem = {
    id: "liquidity",
    label: i18n.t("dashboard.kpi.liquidity"),
    value: totals.liquidity,
    deltaValue: deltaLiquidity,
    deltaPct: deltaResult.deltas.liquidity.deltaPct,
    deltaStatus: deltaResult.status,
    accent: palette[0],
    breakdown: liquidityBreakdown,
  };
  const investItem: KPIItem = {
    id: "investments",
    label: i18n.t("dashboard.kpi.investments"),
    value: totals.investments,
    deltaValue: deltaInvest,
    deltaPct: deltaResult.deltas.investments.deltaPct,
    deltaStatus: deltaResult.status,
    accent: palette[1],
    breakdown: investBreakdown,
  };
  const netWorthItem: KPIItem = {
    id: "netWorth",
    label: i18n.t("dashboard.kpi.netWorth"),
    value: totals.netWorth,
    deltaValue: deltaTotal,
    deltaPct: deltaResult.deltas.total.deltaPct,
    deltaStatus: deltaResult.status,
    accent: palette[3],
    breakdown: netWorthBreakdown,
  };

  const items: KPIItem[] = [];
  if (showInvestments) {
    items.push(liquidityItem, investItem, netWorthItem);
  } else {
    items.push(liquidityItem);
  }
  return items;
}

type DeltaPair = { deltaAbs: number; deltaPct: number };
type KpiDeltaStatus = "OK" | "NO_DATA";
type KpiDeltaResult = {
  status: KpiDeltaStatus;
  deltas: {
    liquidity: DeltaPair;
    investments: DeltaPair;
    total: DeltaPair;
  };
  meta?: { startDate: string; endDate: string };
};

const EMPTY_DELTA: DeltaPair = { deltaAbs: 0, deltaPct: 0 };

function monthKeyFromIso(iso: string): string {
  return iso.slice(0, 7);
}

function shiftMonthKey(monthKey: string, months: number): string {
  return addMonthsClamped(`${monthKey}-01`, months).slice(0, 7);
}

function findSnapshotBefore(snapshots: Snapshot[], isoDate: string): Snapshot | null {
  for (const snapshot of snapshots) {
    if (snapshot.date < isoDate) return snapshot;
  }
  return null;
}

function findSnapshotOnOrBefore(snapshots: Snapshot[], isoDate: string): Snapshot | null {
  for (const snapshot of snapshots) {
    if (snapshot.date <= isoDate) return snapshot;
  }
  return null;
}

function totalsFromSnapshotLines(lines: SnapshotLineDetail[] | undefined | null) {
  if (!lines) return null;
  const totals = totalsByWalletType(lines);
  return {
    liquidity: totals.liquidity,
    investments: totals.investments,
    total: totals.netWorth,
  };
}

function deltaFromTotals(endTotals: ReturnType<typeof totalsFromSnapshotLines>, startTotals: ReturnType<typeof totalsFromSnapshotLines>): KpiDeltaResult {
  if (!endTotals || !startTotals) {
    return {
      status: "NO_DATA",
      deltas: { liquidity: EMPTY_DELTA, investments: EMPTY_DELTA, total: EMPTY_DELTA },
    };
  }
  const calc = (end: number, start: number): DeltaPair => ({
    deltaAbs: end - start,
    deltaPct: start === 0 ? 0 : (end - start) / start,
  });
  return {
    status: "OK",
    deltas: {
      liquidity: calc(endTotals.liquidity, startTotals.liquidity),
      investments: calc(endTotals.investments, startTotals.investments),
      total: calc(endTotals.total, startTotals.total),
    },
  };
}

// Selezione delta: 1D = ultimo snapshot vs precedente; 7D/28D = ultimo snapshot vs snapshot <= end-7/28g;
// 3M/6M/12M = ultimo punto mensile vs punto mensile <= target month.
export function buildKpiDeltaForRange(
  range: KpiDeltaRange,
  snapshots: Snapshot[],
  portfolioSeries: PortfolioPoint[],
  snapshotLinesById: Record<number, SnapshotLineDetail[]>
): KpiDeltaResult {
  if (range === "1D" || range === "7D" || range === "28D") {
    const endSnapshot = snapshots[0];
    if (!endSnapshot) {
      return { status: "NO_DATA", deltas: { liquidity: EMPTY_DELTA, investments: EMPTY_DELTA, total: EMPTY_DELTA } };
    }
    const endTotals = totalsFromSnapshotLines(snapshotLinesById[endSnapshot.id]);
    const startSnapshot =
      range === "1D"
        ? findSnapshotBefore(snapshots, endSnapshot.date)
        : findSnapshotOnOrBefore(snapshots, addDays(endSnapshot.date, range === "7D" ? -7 : -28));
    if (!startSnapshot) {
      return { status: "NO_DATA", deltas: { liquidity: EMPTY_DELTA, investments: EMPTY_DELTA, total: EMPTY_DELTA } };
    }
    const startTotals = totalsFromSnapshotLines(snapshotLinesById[startSnapshot.id]);
    const result = deltaFromTotals(endTotals, startTotals);
    return {
      ...result,
      meta: { startDate: startSnapshot.date, endDate: endSnapshot.date },
    };
  }

  if (portfolioSeries.length < 2) {
    return { status: "NO_DATA", deltas: { liquidity: EMPTY_DELTA, investments: EMPTY_DELTA, total: EMPTY_DELTA } };
  }
  const endPoint = portfolioSeries[portfolioSeries.length - 1];
  const endKey = monthKeyFromIso(endPoint.date);
  const monthsBack = range === "3M" ? -3 : range === "6M" ? -6 : -12;
  const targetMonth = shiftMonthKey(endKey, monthsBack);
  const startPoint = [...portfolioSeries].reverse().find((point) => monthKeyFromIso(point.date) <= targetMonth);
  if (!startPoint) {
    return { status: "NO_DATA", deltas: { liquidity: EMPTY_DELTA, investments: EMPTY_DELTA, total: EMPTY_DELTA } };
  }
  const calc = (end: number, start: number): DeltaPair => ({
    deltaAbs: end - start,
    deltaPct: start === 0 ? 0 : (end - start) / start,
  });
  return {
    status: "OK",
    deltas: {
      liquidity: calc(endPoint.liquidity, startPoint.liquidity),
      investments: calc(endPoint.investments, startPoint.investments),
      total: calc(endPoint.total, startPoint.total),
    },
    meta: { startDate: startPoint.date, endDate: endPoint.date },
  };
}

function buildDistribution(latestLines: SnapshotLineDetail[], wallets: Wallet[]): DistributionItem[] {
  if (wallets.length === 0) return [];
  const walletTotals = new Map<number, number>();
  latestLines.forEach((line) => {
    if (!line.wallet_id) return;
    walletTotals.set(line.wallet_id, (walletTotals.get(line.wallet_id) ?? 0) + line.amount);
  });
  const orderedWallets = orderWalletsForUI(wallets);
  return orderedWallets
    .map((wallet) => ({
      wallet,
      value: walletTotals.get(wallet.id) ?? 0,
    }))
    .filter((item) => item.value !== 0)
    .map((item) => ({
      id: `${item.wallet.id}`,
      label: item.wallet.name,
      value: item.value,
      color: item.wallet.color ?? palette[item.wallet.id % palette.length],
    }));
}

function buildCashflow(
  income: IncomeEntry[],
  expense: ExpenseEntry[],
  monthsToShow: number
): CashflowMonth[] {
  const now = new Date();
  const months: CashflowMonth[] = [];
  const totalMonths = Math.min(12, Math.max(3, Math.floor(monthsToShow)));
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  for (let i = 0; i < totalMonths; i += 1) {
    const totals = totalsForMonth(income, expense, year, month);
    months.unshift({
      month: toMonthKey(year, month),
      income: totals.income,
      expense: totals.expense,
    });
    month -= 1;
    if (month <= 0) {
      month = 12;
      year -= 1;
    }
  }
  return months;
}

function buildCategories(expense: ExpenseEntry[], categories: ExpenseCategory[]): CategoryRow[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const nextStart = `${nextMonth.y}-${String(nextMonth.m).padStart(2, "0")}-01`;
  const end = addDays(nextStart, -1);
  const categoryMap = new Map<number, { label: string; color: string }>();
  categories.forEach((cat) => categoryMap.set(cat.id, { label: cat.name, color: cat.color }));
  const totals = new Map<number, number>();
  expense.forEach((entry) => {
    const dates = listOccurrencesInRange(entry, start, end);
    if (dates.length === 0) return;
    const categoryId = entry.expense_category_id ?? -1;
    totals.set(categoryId, (totals.get(categoryId) ?? 0) + dates.length * entry.amount);
  });
  const totalValue = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(totals.entries())
    .map(([categoryId, value], index) => {
      const info = categoryMap.get(categoryId);
      const label = info?.label ?? i18n.t("dashboard.categories.uncategorized");
      return {
        id: `${label}-${index}`,
        label,
        value,
        color: info?.color ?? palette[index % palette.length],
        pct: totalValue === 0 ? 0 : value / totalValue,
      };
    })
    .sort((a, b) => b.value - a.value);
}

function buildRecurrences(
  incomeEntries: IncomeEntry[],
  expenseEntries: ExpenseEntry[],
  categories: ExpenseCategory[]
): RecurrenceRow[] {
  const categoryMap = new Map<number, { label: string; color: string }>();
  categories.forEach((cat) => categoryMap.set(cat.id, { label: cat.name, color: cat.color }));
  const incomeMap = new Map<number, IncomeEntry>();
  const expenseMap = new Map<number, ExpenseEntry>();
  incomeEntries.forEach((entry) => incomeMap.set(entry.id, entry));
  expenseEntries.forEach((entry) => expenseMap.set(entry.id, entry));
  return upcomingOccurrences(incomeEntries, expenseEntries, 8).map((occurrence, index) => {
    const entry = occurrence.type === "income" ? incomeMap.get(occurrence.entryId) : expenseMap.get(occurrence.entryId);
    const recurring = Boolean(entry?.recurrence_frequency && entry.one_shot === 0);
    const info =
      occurrence.type === "expense"
        ? categoryMap.get((entry as ExpenseEntry | undefined)?.expense_category_id ?? -1)
        : null;
    const expenseFallback = i18n.t("dashboard.recurrences.category.expense");
    const incomeFallback = i18n.t("dashboard.recurrences.category.income");
    const category = occurrence.type === "expense" ? info?.label ?? expenseFallback : incomeFallback;
    const frequencyKey = getFrequencyKey(occurrence.frequency);
    return {
      id: `${occurrence.entryId}-${index}`,
      entryId: occurrence.entryId,
      date: occurrence.date,
      type: occurrence.type,
      category,
      categoryColor: info?.color,
      description: occurrence.name,
      amount: occurrence.amount,
      recurring,
      frequencyKey,
    };
  });
}

export function buildDashboardData(
  input: DashboardInput,
  showInvestments = true,
  range: KpiDeltaRange = "28D"
): DashboardData {
  const hasInvestmentWallets = input.wallets.some((wallet) => wallet.type === "INVEST");
  const shouldShowInvestments = showInvestments && hasInvestmentWallets;
  const portfolio = buildPortfolioSeries(
    input.snapshots,
    input.snapshotLines,
    input.latestLines,
    input.chartPoints
  );
  const walletSeries = buildWalletSeries(
    portfolio,
    input.snapshots,
    input.snapshotLines,
    input.latestLines,
    input.wallets
  );
  const kpis = buildKpis(
    input.latestLines,
    portfolio,
    shouldShowInvestments,
    range,
    input.snapshots,
    input.snapshotLines
  );
  const distributions = buildDistribution(input.latestLines, input.wallets);
  const cashflowMonths = buildCashflow(input.incomeEntries, input.expenseEntries, input.chartPoints);
  const averages = averageMonthlyTotals(
    input.incomeEntries,
    input.expenseEntries,
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    input.chartPoints
  );
  return {
    kpis,
    portfolioSeries: portfolio,
    walletSeries,
    distributions,
    cashflow: {
      avgIncome: averages.income,
      avgExpense: averages.expense,
      avgSavings: averages.net,
      months: cashflowMonths,
    },
    categories: buildCategories(input.expenseEntries, input.expenseCategories),
    recurrences: buildRecurrences(input.incomeEntries, input.expenseEntries, input.expenseCategories),
  };
}

export function createMockDashboardData(showInvestments = true): DashboardData {
  const baseKpis: KPIItem[] = [
    { id: "liquidity", label: i18n.t("dashboard.mock.kpi.liquidity"), value: 16450, deltaValue: 420, deltaPct: 0.026 },
    { id: "investments", label: i18n.t("dashboard.mock.kpi.investments"), value: 32800, deltaValue: -620, deltaPct: -0.018 },
    { id: "netWorth", label: i18n.t("dashboard.mock.kpi.netWorth"), value: 49250, deltaValue: -200, deltaPct: -0.004 },
  ];
  const kpis = showInvestments
    ? baseKpis
    : baseKpis.filter((item) => item.id === "liquidity");
  const portfolioSeries: PortfolioPoint[] = [
    { date: "2024-11-01", total: 46800, liquidity: 15800, investments: 31000 },
    { date: "2024-12-01", total: 47200, liquidity: 16050, investments: 31150 },
    { date: "2025-01-01", total: 48500, liquidity: 16400, investments: 32100 },
    { date: "2025-02-01", total: 49250, liquidity: 16450, investments: 32800 },
  ];
  const walletSeries: WalletSeries[] = [
    {
      walletId: 1,
      name: "Liquidità",
      type: "LIQUIDITY",
      color: palette[0],
      points: portfolioSeries.map((point) => ({ date: point.date, value: point.liquidity })),
    },
    {
      walletId: 2,
      name: "Investimenti",
      type: "INVEST",
      color: palette[1],
      points: portfolioSeries.map((point) => ({ date: point.date, value: point.investments })),
    },
  ];
  const distributions: DistributionItem[] = [
    { id: "cash", label: i18n.t("dashboard.mock.distributions.cash"), value: 4200, color: palette[0] },
    { id: "bank", label: i18n.t("dashboard.mock.distributions.bank"), value: 8450, color: palette[1] },
    { id: "broker", label: i18n.t("dashboard.mock.distributions.broker"), value: 32800, color: palette[2] },
  ];
  const cashflow: CashflowSummary = {
    avgIncome: 2450,
    avgExpense: 1680,
    avgSavings: 770,
    months: [
      { month: "2024-12", income: 2350, expense: 1700 },
      { month: "2025-01", income: 2500, expense: 1750 },
      { month: "2025-02", income: 2600, expense: 1650 },
    ],
  };
  const categories: CategoryRow[] = [
    { id: "c1", label: i18n.t("dashboard.mock.categories.home"), value: 520, pct: 0.32, color: palette[3] },
    { id: "c2", label: i18n.t("dashboard.mock.categories.food"), value: 420, pct: 0.26, color: palette[4] },
    { id: "c3", label: i18n.t("dashboard.mock.categories.transport"), value: 310, pct: 0.19, color: palette[5] },
    { id: "c4", label: i18n.t("dashboard.mock.categories.other"), value: 240, pct: 0.15, color: palette[6] },
  ];
  const recurrences: RecurrenceRow[] = [
    {
      id: "r1",
      entryId: 1,
      date: "2025-02-16",
      type: "income",
      category: i18n.t("dashboard.mock.recurrences.incomeCategory"),
      description: i18n.t("dashboard.mock.recurrences.salary"),
      amount: 2100,
      recurring: true,
    },
    {
      id: "r2",
      entryId: 2,
      date: "2025-02-20",
      type: "expense",
      category: i18n.t("dashboard.mock.recurrences.homeCategory"),
      description: i18n.t("dashboard.mock.recurrences.rent"),
      amount: 850,
      recurring: true,
    },
    {
      id: "r3",
      entryId: 3,
      date: "2025-02-22",
      type: "expense",
      category: i18n.t("dashboard.mock.recurrences.foodCategory"),
      description: i18n.t("dashboard.mock.recurrences.expense"),
      amount: 120,
      recurring: false,
    },
  ];
  return {
    kpis,
    portfolioSeries,
    walletSeries,
    distributions,
    cashflow,
    categories,
    recurrences,
  };
}
