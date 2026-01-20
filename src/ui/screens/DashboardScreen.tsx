import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutAnimation, Platform, RefreshControl, ScrollView, StyleSheet, UIManager, View } from "react-native";
import { Text } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { listWallets } from "@/repositories/walletsRepo";
import { getLatestSnapshot, listSnapshotLines, listSnapshots } from "@/repositories/snapshotsRepo";
import { listIncomeEntries } from "@/repositories/incomeEntriesRepo";
import { listExpenseEntries } from "@/repositories/expenseEntriesRepo";
import { listExpenseCategories } from "@/repositories/expenseCategoriesRepo";
import { getPreference, setPreference } from "@/repositories/preferencesRepo";
import type { SnapshotLineDetail } from "@/repositories/types";
import { todayIso } from "@/utils/dates";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import type { DashboardData } from "@/ui/dashboard/types";
import { buildDashboardData, createMockDashboardData } from "@/ui/dashboard/adapter";
import KPIStrip from "@/ui/dashboard/components/KPIStrip";
import PortfolioLineChartCard from "@/ui/dashboard/components/PortfolioLineChartCard";
import DonutDistributionCard from "@/ui/dashboard/components/DonutDistributionCard";
import CashflowOverviewCard from "@/ui/dashboard/components/CashflowOverviewCard";
import CategoriesBreakdownCard from "@/ui/dashboard/components/CategoriesBreakdownCard";
import RecurrencesTableCard from "@/ui/dashboard/components/RecurrencesTableCard";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import PressScale from "@/ui/dashboard/components/PressScale";
import Skeleton from "@/ui/dashboard/components/Skeleton";

type Nav = {
  navigate: (name: string, params?: Record<string, unknown>) => void;
};

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SECTION_STATE_KEY = "dashboard.section.states";
const DEFAULT_SECTION_STATES: Record<string, boolean> = {
  andamento: true,
  distribuzione: false,
  cashflow: false,
  categories: false,
  prossimi: false,
};

type SectionAccordionProps = {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

const SectionAccordion = ({ title, open, onToggle, children }: SectionAccordionProps): JSX.Element => {
  const { tokens } = useDashboardTheme();
  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };
  return (
    <View style={styles.section}>
      <PremiumCard style={styles.cardWrapper}>
        <PressScale
          style={[
            styles.cardHeader,
            {
              borderColor: tokens.colors.border,
              backgroundColor: tokens.colors.surface2,
            },
          ]}
          onPress={handleToggle}
        >
          <Text style={[styles.accordionTitle, { color: tokens.colors.text }]}>{title}</Text>
          <Text style={[styles.accordionIcon, { color: tokens.colors.muted }]}>{open ? "−" : "+"}</Text>
        </PressScale>
        {open && <View style={styles.accordionContent}>{children}</View>}
      </PremiumCard>
    </View>
  );
};

export default function DashboardScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const { tokens } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [walletsCount, setWalletsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prompted, setPrompted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [sectionStates, setSectionStates] = useState<Record<string, boolean>>(DEFAULT_SECTION_STATES);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const wallets = await listWallets(true);
      setWalletsCount(wallets.length);

      const [snapshots, incomeEntries, expenseEntries, expenseCategories, pref, profile] = await Promise.all([
        listSnapshots(),
        listIncomeEntries(),
        listExpenseEntries(),
        listExpenseCategories(),
        getPreference("chart_points"),
        getPreference("profile_name"),
      ]);

      const latestSnapshot = await getLatestSnapshot();
      let latestLines: SnapshotLineDetail[] = [];
      if (latestSnapshot) {
        latestLines = await listSnapshotLines(latestSnapshot.id);
      }

      const snapshotLines: Record<number, SnapshotLineDetail[]> = {};
      await Promise.all(
        snapshots.map(async (snapshot) => {
          snapshotLines[snapshot.id] = await listSnapshotLines(snapshot.id);
        })
      );

      const chartPointsRaw = pref ? Number(pref.value) : 6;
      const chartPoints = Number.isFinite(chartPointsRaw) ? Math.min(12, Math.max(3, chartPointsRaw)) : 6;
      const data = buildDashboardData({
        latestLines,
        snapshots,
        snapshotLines,
        incomeEntries,
        expenseEntries,
        expenseCategories,
        chartPoints,
      });
      setDashboard(data);

      const ask = await getPreference("ask_snapshot_on_start");
      setProfileName(profile?.value?.trim() ?? "");
      if (!prompted && ask?.value === "true") {
        const today = todayIso();
        if (!latestSnapshot || latestSnapshot.date !== today) {
          setPrompted(true);
          navigation.navigate("Snapshot", { openNew: true });
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il caricamento.");
      setDashboard(createMockDashboardData());
    }
  }, [navigation, prompted]);

  useEffect(() => {
    let canceled = false;
    getPreference(SECTION_STATE_KEY).then((pref) => {
      if (canceled) return;
      if (pref?.value) {
        try {
          const parsed = JSON.parse(pref.value);
          if (parsed && typeof parsed === "object") {
            setSectionStates((prev) => ({
              ...prev,
              ...parsed,
            }));
          }
        } catch {
          // ignore invalid value
        }
      }
      setSectionsLoaded(true);
    });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!sectionsLoaded) return;
    setPreference(SECTION_STATE_KEY, JSON.stringify(sectionStates)).catch(() => {});
  }, [sectionStates, sectionsLoaded]);

  const handleToggleSection = useCallback((key: string) => {
    setSectionStates((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const emptyState = walletsCount === 0 && !loading;

  const skeleton = useMemo(
    () => (
      <View style={styles.section}>
        <Skeleton height={140} radius={tokens.radius.md} />
        <Skeleton height={220} radius={tokens.radius.md} />
        <Skeleton height={220} radius={tokens.radius.md} />
      </View>
    ),
    [tokens.radius.md]
  );

  return (
    <View style={[styles.screen, { backgroundColor: tokens.colors.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: headerHeight + 6,
            paddingBottom: 160 + insets.bottom,
          },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !dashboard && skeleton}

        {error && !loading ? (
          <PremiumCard>
            <Text style={[styles.errorTitle, { color: tokens.colors.text }]}>Impossibile caricare la dashboard</Text>
            <Text style={[styles.errorBody, { color: tokens.colors.muted }]}>{error}</Text>
          </PremiumCard>
        ) : null}

        {emptyState ? (
          <PremiumCard>
            <Text style={[styles.emptyTitle, { color: tokens.colors.text }]}>Nessun dato disponibile</Text>
            <Text style={[styles.emptyBody, { color: tokens.colors.muted }]}>Crea almeno un wallet per iniziare.</Text>
          </PremiumCard>
        ) : null}

        {dashboard ? (
          <>
            <View style={styles.greetingBlock}>
              <Text style={[styles.greetingText, { color: tokens.colors.text }]}>
                {profileName ? `Ciao ${profileName}` : "Ciao"}
              </Text>
              <KPIStrip items={dashboard.kpis} />
            </View>

            <SectionAccordion
              title="Andamento nel tempo"
              open={sectionStates.andamento}
              onToggle={() => handleToggleSection("andamento")}
            >
              <PortfolioLineChartCard data={dashboard.portfolioSeries} hideHeader noCard />
            </SectionAccordion>

            <SectionAccordion
              title="Distribuzione patrimonio"
              open={sectionStates.distribuzione}
              onToggle={() => handleToggleSection("distribuzione")}
            >
              <DonutDistributionCard items={dashboard.distributions} hideHeader noCard />
            </SectionAccordion>

            <SectionAccordion
              title="Cash Flow. Panoramica"
              open={sectionStates.cashflow}
              onToggle={() => handleToggleSection("cashflow")}
            >
              <CashflowOverviewCard cashflow={dashboard.cashflow} hideHeader noCard />
            </SectionAccordion>

            <SectionAccordion
              title="Spese per categoria"
              open={sectionStates.categories}
              onToggle={() => handleToggleSection("categories")}
            >
              <CategoriesBreakdownCard items={dashboard.categories} hideHeader noCard />
            </SectionAccordion>

            <SectionAccordion
              title="Prossimi movimenti"
              open={sectionStates.prossimi}
              onToggle={() => handleToggleSection("prossimi")}
            >
              <RecurrencesTableCard
                rows={dashboard.recurrences}
                hideHeader
                noCard
                onPressRow={(row) =>
                  navigation.navigate("Entrate/Uscite", {
                    entryType: row.type,
                    formMode: "edit",
                    entryId: row.entryId,
                  })
                }
              />
            </SectionAccordion>
          </>
        ) : null}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
    gap: 10,
  },
  section: {
    gap: 10,
    marginTop: 3,
  },
  greetingBlock: {
    gap: 10,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  accordionIcon: {
    fontSize: 24,
  },
  cardWrapper: {
    padding: 0,
  },
  accordionContent: {
    marginTop: 8,
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  greetingText: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.25,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyBody: {
    marginTop: 6,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  errorBody: {
    marginTop: 6,
  },
});
