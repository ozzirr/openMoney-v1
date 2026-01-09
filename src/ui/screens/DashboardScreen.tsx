import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Card, Text, FAB, useTheme } from "react-native-paper";
import GlassCard from "@/ui/components/GlassCard";
import { useNavigation } from "@react-navigation/native";
import { VictoryAxis, VictoryChart, VictoryLegend, VictoryLine, VictoryPie, VictoryTheme } from "victory-native";
import { listWallets } from "@/repositories/walletsRepo";
import { getLatestSnapshot, listSnapshotLines, listSnapshots } from "@/repositories/snapshotsRepo";
import { listIncomeEntries } from "@/repositories/incomeEntriesRepo";
import { listExpenseEntries } from "@/repositories/expenseEntriesRepo";
import { listExpenseCategories } from "@/repositories/expenseCategoriesRepo";
import { getPreference } from "@/repositories/preferencesRepo";
import { breakdownByWallet, breakdownInvestByTag, snapshotSeries, totalsByWalletType } from "@/domain/calculations";
import { averageMonthlyTotals, totalsForMonth } from "@/domain/finance";
import { listOccurrencesInRange, upcomingOccurrences } from "@/domain/recurrence";
import type { SnapshotLineDetail } from "@/repositories/types";
import { todayIso } from "@/utils/dates";
import { addDays } from "@/utils/recurrence";

type Nav = {
  navigate: (name: string, params?: Record<string, unknown>) => void;
};

export default function DashboardScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const [walletsCount, setWalletsCount] = useState(0);
  const [latestLines, setLatestLines] = useState<SnapshotLineDetail[]>([]);
  const [chartData, setChartData] = useState<{ x: string; y: number }[]>([]);
  const [expenseDistribution, setExpenseDistribution] = useState<{ label: string; value: number }[]>([]);
  const [monthTotals, setMonthTotals] = useState({ income: 0, expense: 0, net: 0 });
  const [monthAverage, setMonthAverage] = useState({ income: 0, expense: 0, net: 0 });
  const [upcoming, setUpcoming] = useState<string[]>([]);
  const [fabOpen, setFabOpen] = useState(false);
  const [prompted, setPrompted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const chartColors = ["#2E86AB", "#F6AE2D", "#F26419", "#33658A", "#55D6BE", "#7D5BA6"];
  const legendLabelColor = theme.colors.onSurface ?? "#E6E6E6";

  const formatMonthLabel = (value: string) => {
    const [year, month] = value.split("-");
    const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    const index = Number(month) - 1;
    const label = months[index] ?? month;
    return `${label} ${year?.slice(-2) ?? ""}`.trim();
  };

  const formatValue = (value: number) => value.toFixed(2);

  const renderDonut = (items: { label: string; value: number }[]) => {
    if (items.length === 0) return <Text>Nessun dato disponibile.</Text>;
    const data = items.map((item, index) => ({
      x: item.label?.trim() || "Senza nome",
      y: item.value,
      color: chartColors[index % chartColors.length],
    }));

    return (
      <View style={{ alignItems: "center" }}>
        <VictoryPie
          height={210}
          innerRadius={60}
          padAngle={1}
          cornerRadius={4}
          colorScale={data.map((item) => item.color)}
          data={data}
          labels={() => ""}
        />
        <VictoryLegend
          orientation="vertical"
          gutter={12}
          style={{ labels: { fill: legendLabelColor, fontSize: 12 } }}
          data={data.map((item, index) => ({
            name: `${item.x} • ${formatValue(items[index].value)}`,
            symbol: { fill: item.color },
          }))}
        />
      </View>
    );
  };

  const load = useCallback(async () => {
    const wallets = await listWallets(true);
    setWalletsCount(wallets.length);

    const latestSnapshot = await getLatestSnapshot();
    if (latestSnapshot) {
      const lines = await listSnapshotLines(latestSnapshot.id);
      setLatestLines(lines);
    } else {
      setLatestLines([]);
    }

    const snapshots = await listSnapshots();
    const lineMap: Record<number, SnapshotLineDetail[]> = {};
    await Promise.all(
      snapshots.map(async (snapshot) => {
        lineMap[snapshot.id] = await listSnapshotLines(snapshot.id);
      })
    );

    const pref = await getPreference("chart_points");
    const chartPointsRaw = pref ? Number(pref.value) : 6;
    const chartPoints = Number.isFinite(chartPointsRaw) ? Math.min(12, Math.max(3, chartPointsRaw)) : 6;
    const series = snapshotSeries(snapshots, lineMap, chartPoints).map((point) => ({
      x: point.date,
      y: point.total,
    }));
    setChartData(series);

    const ask = await getPreference("ask_snapshot_on_start");
    if (!prompted && ask?.value === "true") {
      const today = todayIso();
      if (!latestSnapshot || latestSnapshot.date !== today) {
        setPrompted(true);
        navigation.navigate("Snapshot", { openNew: true });
      }
    }

    const income = await listIncomeEntries();
    const expense = await listExpenseEntries();
    const categories = await listExpenseCategories();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    setMonthTotals(totalsForMonth(income, expense, year, month));
    setMonthAverage(averageMonthlyTotals(income, expense, year, month, 3));

    const next = upcomingOccurrences(income, expense, 8).map(
      (occurrence) => `${occurrence.date} • ${occurrence.type} • ${occurrence.amount.toFixed(2)}`
    );
    setUpcoming(next);

    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
    const nextStart = `${nextMonth.y}-${String(nextMonth.m).padStart(2, "0")}-01`;
    const end = addDays(nextStart, -1);
    const categoryMap = new Map<number, string>();
    categories.forEach((cat) => categoryMap.set(cat.id, cat.name));
    const distribution = new Map<string, number>();
    expense.forEach((entry) => {
      const dates = listOccurrencesInRange(entry, start, end);
      if (dates.length === 0) return;
      const label = entry.expense_category_id ? categoryMap.get(entry.expense_category_id) ?? "Senza categoria" : "Senza categoria";
      distribution.set(label, (distribution.get(label) ?? 0) + dates.length * entry.amount);
    });
    setExpenseDistribution(
      Array.from(distribution.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
    );
  }, [navigation, prompted]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const totals = useMemo(() => totalsByWalletType(latestLines), [latestLines]);
  const walletBreakdown = useMemo(() => breakdownByWallet(latestLines), [latestLines]);
  const investBreakdown = useMemo(() => breakdownInvestByTag(latestLines), [latestLines]);
  const showWalletEmpty = walletsCount === 0;

  return (
    <>
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 16 }}
      alwaysBounceVertical
      bounces
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
        {showWalletEmpty && (
          <GlassCard>
            <Card.Title title="Nessun dato" />
            <Card.Content>
              <Text>Crea almeno un wallet per vedere la dashboard.</Text>
            </Card.Content>
          </GlassCard>
        )}

        {!showWalletEmpty && (
          <>
            {latestLines.length === 0 ? (
              <GlassCard>
                <Card.Title title="KPI" />
                <Card.Content>
                  <Text>Inserisci almeno uno snapshot per vedere i KPI.</Text>
                </Card.Content>
              </GlassCard>
            ) : (
              <GlassCard>
                <Card.Title title="KPI" />
                <Card.Content>
                  <Text>Liquidità: {totals.liquidity.toFixed(2)}</Text>
                  <Text>Investimenti: {totals.investments.toFixed(2)}</Text>
                  <Text>Patrimonio: {totals.netWorth.toFixed(2)}</Text>
                </Card.Content>
              </GlassCard>
            )}

            <GlassCard>
              <Card.Title title="Andamento snapshot" />
              <Card.Content>
                {chartData.length === 0 ? (
                  <Text>Nessun dato disponibile.</Text>
                ) : (
                  <VictoryChart theme={VictoryTheme.material} height={220}>
                    <VictoryAxis
                      tickFormat={(tick) => formatMonthLabel(String(tick))}
                      style={{ tickLabels: { fontSize: 10, padding: 4 } }}
                    />
                    <VictoryLine data={chartData} />
                  </VictoryChart>
                )}
              </Card.Content>
            </GlassCard>

            <GlassCard>
              <Card.Title title="Distribuzione wallet" />
              <Card.Content>
                {renderDonut(walletBreakdown)}
              </Card.Content>
            </GlassCard>

            <GlassCard>
              <Card.Title title="Investimenti per tag" />
              <Card.Content>
                {renderDonut(investBreakdown)}
              </Card.Content>
            </GlassCard>

            <GlassCard>
              <Card.Title title="Questo mese" />
              <Card.Content>
                <Text>Entrate: {monthTotals.income.toFixed(2)}</Text>
                <Text>Uscite: {monthTotals.expense.toFixed(2)}</Text>
                <Text>Media 3 mesi: {(monthAverage.income - monthAverage.expense).toFixed(2)}</Text>
              </Card.Content>
            </GlassCard>

            <GlassCard>
              <Card.Title title="Distribuzione spese mese" />
              <Card.Content>
                {renderDonut(expenseDistribution)}
              </Card.Content>
            </GlassCard>

            <GlassCard>
              <Card.Title title="Prossime ricorrenze" />
              <Card.Content>
                {upcoming.length === 0 && <Text>Nessuna ricorrenza trovata.</Text>}
                {upcoming.map((item, index) => (
                  <Text key={`${item}-${index}`}>{item}</Text>
                ))}
              </Card.Content>
            </GlassCard>
          </>
        )}
      </ScrollView>

      <FAB.Group
        open={fabOpen}
        visible
        icon={fabOpen ? "close" : "plus"}
        actions={[
          {
            icon: "file-plus",
            label: "Nuovo Snapshot",
            onPress: () => navigation.navigate("Snapshot", { openNew: true }),
          },
          {
            icon: "cash-plus",
            label: "Nuova Entrata",
            onPress: () => navigation.navigate("Entrate/Uscite", { mode: "income" }),
          },
          {
            icon: "cash-minus",
            label: "Nuova Uscita",
            onPress: () => navigation.navigate("Entrate/Uscite", { mode: "expense" }),
          },
        ]}
        onStateChange={({ open }) => setFabOpen(open)}
      />
    </>
  );
}
