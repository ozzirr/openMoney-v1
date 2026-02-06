import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  LayoutAnimation,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
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
import type { DashboardData, KpiDeltaRange } from "@/ui/dashboard/types";
import { buildDashboardData, buildKpiDeltaForRange, createMockDashboardData } from "@/ui/dashboard/adapter";
import KPIStrip from "@/ui/dashboard/components/KPIStrip";
import RangeSelector from "@/ui/dashboard/components/RangeSelector";
import PortfolioLineChartCard from "@/ui/dashboard/components/PortfolioLineChartCard";
import DonutDistributionCard from "@/ui/dashboard/components/DonutDistributionCard";
import CashflowOverviewCard from "@/ui/dashboard/components/CashflowOverviewCard";
import CategoriesBreakdownCard from "@/ui/dashboard/components/CategoriesBreakdownCard";
import RecurrencesTableCard from "@/ui/dashboard/components/RecurrencesTableCard";
import PressScale from "@/ui/dashboard/components/PressScale";
import Skeleton from "@/ui/dashboard/components/Skeleton";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import AppBackground from "@/ui/components/AppBackground";
import LimitReachedModal from "@/ui/components/LimitReachedModal";
import { GlassCardContainer, SmallOutlinePillButton } from "@/ui/components/EntriesUI";
import CoachTipCard from "@/ui/components/CoachTipCard";
import GlassBlur from "@/ui/components/GlassBlur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/settings/useSettings";
import { onDataChanged, onDataReset } from "@/app/dataEvents";

type Nav = {
  navigate: (name: string, params?: Record<string, unknown>) => void;
  setParams?: (params: Record<string, unknown>) => void;
};

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SECTION_STATE_KEY = "dashboard.section.states";
const SECTION_ORDER_KEY = "dashboard.section.order";
const DEFAULT_SECTION_STATES: Record<string, boolean> = {
  andamento: true,
  distribuzione: false,
  cashflow: false,
  categories: false,
  prossimi: false,
};

type SectionId = "andamento" | "distribuzione" | "cashflow" | "categories" | "prossimi";

const SECTION_ORDER: SectionId[] = [
  "andamento",
  "distribuzione",
  "cashflow",
  "categories",
  "prossimi",
];

type SectionAccordionProps = {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  locked?: boolean;
  lockedSubtitle?: string;
  onLockedPress?: () => void;
};

const SectionAccordion = ({
  title,
  open,
  onToggle,
  children,
  locked = false,
  lockedSubtitle,
  onLockedPress,
}: SectionAccordionProps): JSX.Element => {
  const { tokens } = useDashboardTheme();
  const handleToggle = () => {
    if (locked) {
      onLockedPress?.();
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };
  const isOpen = !locked && open;
  return (
    <View style={styles.section}>
      <GlassCardContainer style={locked ? styles.lockedCard : undefined}>
        <PressScale
          style={[styles.cardHeader, { borderColor: tokens.colors.glassBorder }]}
          onPress={handleToggle}
        >
          <View style={styles.cardTitleBlock}>
            <Text style={[styles.accordionTitle, { color: tokens.colors.text }]}>{title}</Text>
            {locked && lockedSubtitle ? (
              <Text style={[styles.lockedSubtitle, { color: tokens.colors.muted }]}>{lockedSubtitle}</Text>
            ) : null}
          </View>
          {locked ? (
            <MaterialCommunityIcons name="lock-outline" size={20} color={tokens.colors.muted} />
          ) : (
            <Text style={[styles.accordionIcon, { color: tokens.colors.muted }]}>{isOpen ? "−" : "+"}</Text>
          )}
        </PressScale>
        {isOpen && <View style={styles.accordionContent}>{children}</View>}
      </GlassCardContainer>
    </View>
  );
};

export default function DashboardScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const { tokens, isDark } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [walletsCount, setWalletsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prompted, setPrompted] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [sectionStates, setSectionStates] = useState<Record<string, boolean>>(DEFAULT_SECTION_STATES);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>(SECTION_ORDER);
  const [orderLoaded, setOrderLoaded] = useState(false);
  const [reorderVisible, setReorderVisible] = useState(false);
  const reorderAnim = useRef(new Animated.Value(0)).current;
  const [showPrivacyCard, setShowPrivacyCard] = useState(false);
  const [kpiDeltaRange, setKpiDeltaRange] = useState<KpiDeltaRange>("28D");
  const [availableRanges, setAvailableRanges] = useState<KpiDeltaRange[]>([]);
  const [sectionAvailability, setSectionAvailability] = useState<Record<SectionId, boolean>>({
    andamento: true,
    distribuzione: true,
    cashflow: true,
    categories: true,
    prossimi: true,
  });
  const [orderedSections, setOrderedSections] = useState<SectionId[]>(SECTION_ORDER);
  const [lockedModal, setLockedModal] = useState<{
    visible: boolean;
    sectionId: SectionId | null;
    message: string;
  }>({ visible: false, sectionId: null, message: "" });
  const { t } = useTranslation();
  const { showInvestments, scrollBounceEnabled } = useSettings();
  const kpiRangeOptions = useMemo(() => {
    const labels: Record<KpiDeltaRange, string> = {
      "7D": t("dashboard.range.options.last7Days"),
      "28D": t("dashboard.range.options.last28Days"),
      "3M": t("dashboard.range.options.last3Months"),
      "6M": t("dashboard.range.options.last6Months"),
      "12M": t("dashboard.range.options.last12Months"),
    };
    return availableRanges.map((value) => ({ value, label: labels[value] }));
  }, [availableRanges, t]);

  const normalizeSectionOrder = useCallback((value?: unknown): SectionId[] => {
    const base = Array.isArray(value)
      ? (value.filter((id) => SECTION_ORDER.includes(id as SectionId)) as SectionId[])
      : [];
    const unique = base.filter((id, index) => base.indexOf(id) === index);
    SECTION_ORDER.forEach((id) => {
      if (!unique.includes(id)) unique.push(id);
    });
    return unique;
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const wallets = await listWallets(true);
      setWalletsCount(wallets.length);

      const [snapshots, incomeEntries, expenseEntries, expenseCategories, pref, profile, privacyPref] = await Promise.all([
        listSnapshots(),
        listIncomeEntries(),
        listExpenseEntries(),
        listExpenseCategories(),
        getPreference("chart_points"),
        getPreference("profile_name"),
        getPreference("privacy_tooltip_dismissed"),
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
      const data = buildDashboardData(
        {
          latestLines,
          snapshots,
          snapshotLines,
          incomeEntries,
          expenseEntries,
          expenseCategories,
          chartPoints,
          wallets,
        },
        showInvestments,
        kpiDeltaRange
      );
      setDashboard(data);
      const rangeCandidates: KpiDeltaRange[] = ["7D", "28D", "3M", "6M", "12M"];
      const rangesWithData = rangeCandidates.filter((range) => {
        const result = buildKpiDeltaForRange(range, snapshots, data.portfolioSeries, snapshotLines);
        return result.status === "OK";
      });
      setAvailableRanges(rangesWithData);
      if (rangesWithData.length > 0 && !rangesWithData.includes(kpiDeltaRange)) {
        setKpiDeltaRange(rangesWithData[0]);
      }
      const hasRecurring =
        incomeEntries.some((entry) => entry.recurrence_frequency && entry.one_shot === 0) ||
        expenseEntries.some((entry) => entry.recurrence_frequency && entry.one_shot === 0);
      const hasCashflowData = data.cashflow.months.some((month) => month.income !== 0 || month.expense !== 0);
      setSectionAvailability({
        andamento: snapshots.length >= 2,
        distribuzione: data.distributions.length > 0,
        cashflow: hasRecurring || hasCashflowData,
        categories: data.categories.length > 0,
        prossimi: data.recurrences.length > 0,
      });

      const ask = await getPreference("ask_snapshot_on_start");
      setProfileName(profile?.value?.trim() ?? "");
      setShowPrivacyCard(privacyPref?.value !== "true");
      if (!prompted && ask?.value === "true") {
        const today = todayIso();
        if (!latestSnapshot || latestSnapshot.date !== today) {
          setPrompted(true);
          navigation.navigate("Snapshot", { openNew: true });
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il caricamento.");
      setDashboard(createMockDashboardData(showInvestments));
      setAvailableRanges([]);
    }
  }, [kpiDeltaRange, navigation, prompted, showInvestments]);

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
    let canceled = false;
    getPreference(SECTION_ORDER_KEY).then((pref) => {
      if (canceled) return;
      if (pref?.value) {
        try {
          const parsed = JSON.parse(pref.value);
          setSectionOrder(normalizeSectionOrder(parsed));
        } catch {
          // ignore invalid value
        }
      }
      setOrderLoaded(true);
    });
    return () => {
      canceled = true;
    };
  }, [normalizeSectionOrder]);

  useEffect(() => {
    if (!sectionsLoaded) return;
    setPreference(SECTION_STATE_KEY, JSON.stringify(sectionStates)).catch(() => {});
  }, [sectionStates, sectionsLoaded]);

  useEffect(() => {
    if (!orderLoaded) return;
    setPreference(SECTION_ORDER_KEY, JSON.stringify(sectionOrder)).catch(() => {});
  }, [orderLoaded, sectionOrder]);

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

  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load])
  );

  useEffect(() => {
    const subscription = onDataReset(() => {
      void load();
    });
    return () => subscription.remove();
  }, [load]);

  useEffect(() => {
    const subscription = onDataChanged(() => {
      void load();
    });
    return () => subscription.remove();
  }, [load]);

  const dismissPrivacyCard = useCallback(() => {
    setShowPrivacyCard(false);
    setPreference("privacy_tooltip_dismissed", "true").catch(() => {});
  }, []);

  const handlePrivacyLearnMore = useCallback(() => {
    const url = "https://github.com/ozzirr/balance-app-v1";
    Linking.openURL(url).catch(() => {
      Alert.alert(t("dashboard.privacy.title"), t("dashboard.privacy.body"), [
        { text: t("common.close") },
      ]);
    });
  }, [t]);

  const emptyState = walletsCount === 0 && !loading;
  const lockedSubtitle = t("dashboard.locked.subtitle", { defaultValue: "Nessun dato disponibile" });

  useEffect(() => {
    if (loading || !dashboard) return;
    const baseOrder = normalizeSectionOrder(sectionOrder);
    const available = baseOrder.filter((key) => sectionAvailability[key]);
    const locked = baseOrder.filter((key) => !sectionAvailability[key]);
    setOrderedSections([...available, ...locked]);
  }, [dashboard, loading, normalizeSectionOrder, sectionAvailability, sectionOrder]);

  const openReorderSheet = useCallback(() => {
    setReorderVisible(true);
    requestAnimationFrame(() => {
      Animated.timing(reorderAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  }, [reorderAnim]);

  const closeReorderSheet = useCallback(() => {
    Animated.timing(reorderAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setReorderVisible(false);
      }
    });
  }, [reorderAnim]);

  const reorderTranslateY = reorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [64, 0],
  });

  const bringSectionToTop = useCallback(
    (sectionId: SectionId) => {
      setSectionOrder((prev) => {
        const next = normalizeSectionOrder(prev);
        const index = next.indexOf(sectionId);
        if (index <= 0) return next;
        const item = next[index];
        return [item, ...next.slice(0, index), ...next.slice(index + 1)];
      });
    },
    [normalizeSectionOrder]
  );

  const sectionLabels: Record<SectionId, string> = useMemo(
    () => ({
      andamento: t("dashboard.section.trend"),
      distribuzione: t("dashboard.section.distribution"),
      cashflow: t("dashboard.section.cashflow"),
      categories: t("dashboard.section.categories"),
      prossimi: t("dashboard.section.recurrences"),
    }),
    [t]
  );

  const canReorderSections = sectionOrder.length > 1;
  const reorderSheetBackground =
    Platform.OS === "android"
      ? tokens.colors.surface2
      : isDark
      ? "rgba(15, 18, 30, 0.78)"
      : "rgba(169, 124, 255, 0.5)";
  const reorderSheetBorder =
    Platform.OS === "android" ? tokens.colors.border : isDark ? tokens.colors.border : "rgba(169, 124, 255, 0.5)";
  const reorderBlurIntensity = 35;
  const reorderOverlayTint = isDark ? "rgba(0,0,0,0.92)" : "rgba(0,0,0,0.8)";

  const handleLockedPress = useCallback((sectionId: SectionId, message: string) => {
    setLockedModal({ visible: true, sectionId, message });
  }, []);

  const closeLockedModal = useCallback(() => {
    setLockedModal((prev) => ({ ...prev, visible: false }));
  }, []);

  const lockedCta = useMemo(() => {
    if (!lockedModal.sectionId) {
      return {
        label: t("common.close", { defaultValue: "Chiudi" }),
        onPress: closeLockedModal,
      };
    }
    if (lockedModal.sectionId === "andamento" || lockedModal.sectionId === "distribuzione") {
      return {
        label: t("dashboard.locked.ctaSnapshot", { defaultValue: "Aggiungi snapshot" }),
        onPress: () => {
          closeLockedModal();
          navigation.navigate("Snapshot", { openNew: true });
        },
      };
    }
    if (lockedModal.sectionId === "categories") {
      return {
        label: t("dashboard.locked.ctaBalance", { defaultValue: "Vai a Balance" }),
        onPress: () => {
          closeLockedModal();
          navigation.navigate("Balance", { entryType: "expense" });
        },
      };
    }
    return {
      label: t("dashboard.locked.ctaBalance", { defaultValue: "Vai a Balance" }),
      onPress: () => {
        closeLockedModal();
        navigation.navigate("Balance");
      },
    };
  }, [closeLockedModal, lockedModal.sectionId, navigation, t]);

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
    <View style={styles.screenRoot}>
      <AppBackground>
        <ScrollView
          bounces={scrollBounceEnabled}
          alwaysBounceVertical={scrollBounceEnabled}
          overScrollMode={scrollBounceEnabled ? "always" : "never"}
          contentContainerStyle={[
            styles.container,
            {
              paddingTop: headerHeight + 12,
              paddingBottom: 160 + insets.bottom,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {loading && !dashboard && skeleton}

          {error && !loading ? (
            <PremiumCard>
              <Text style={[styles.errorTitle, { color: tokens.colors.text }]}>{t("dashboard.errorTitle")}</Text>
              <Text style={[styles.errorBody, { color: tokens.colors.muted }]}>{error}</Text>
            </PremiumCard>
          ) : null}

          {emptyState ? (
            <CoachTipCard
              lines={[t("dashboard.emptyBody")]}
              ctaLabel={t("dashboard.emptyCta", { defaultValue: "Configura Balance" })}
              onPress={() => navigation.navigate("Wallet", { startSetup: true })}
              ctaColor={tokens.colors.accent}
            />
          ) : null}

          {dashboard ? (
            <>
              <View style={styles.greetingBlock}>
                <View style={styles.greetingRow}>
                  <Text style={[styles.greetingText, { color: tokens.colors.text }]}>
                    {profileName
                      ? t("dashboard.greetingWithName", { name: profileName })
                      : t("dashboard.greeting")}
                  </Text>
                </View>
                <View style={styles.kpiBlock}>
                  <KPIStrip items={dashboard.kpis} />
                  {kpiRangeOptions.length > 1 ? (
                    <View style={styles.rangeRow}>
                      <RangeSelector
                        selectedRange={kpiDeltaRange}
                        onChangeRange={setKpiDeltaRange}
                        options={kpiRangeOptions}
                        showLabel={false}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
              {showPrivacyCard && (
                <CoachTipCard
                leadingIcon={<MaterialCommunityIcons name="shield-lock-outline" size={20} color={tokens.colors.accent} />}
                title={t("dashboard.privacy.title")}
                lines={[t("dashboard.privacy.body")]}
                lineNumberOfLines={2}
                actions={
                  <View style={styles.privacyActions}>
                    <PressScale onPress={handlePrivacyLearnMore} style={styles.privacyLink}>
                      <Text style={[styles.privacyLinkText, { color: tokens.colors.accent }]}>
                        {t("dashboard.privacy.learnMore")}
                      </Text>
                    </PressScale>
                    <PressScale onPress={dismissPrivacyCard}>
                      <Text style={[styles.privacyDismiss, { color: tokens.colors.text }]}>
                        {t("dashboard.privacy.dismiss")}
                      </Text>
                    </PressScale>
                  </View>
                }
                />
              )}

              {orderedSections.map((sectionId) => {
                const isAvailable = sectionAvailability[sectionId];
                if (sectionId === "andamento") {
                  return (
                  <SectionAccordion
                    key={sectionId}
                    title={t("dashboard.section.trend")}
                    open={sectionStates.andamento}
                    onToggle={() => handleToggleSection("andamento")}
                    locked={!isAvailable}
                    lockedSubtitle={lockedSubtitle}
                    onLockedPress={() =>
                      handleLockedPress(
                        "andamento",
                        t("dashboard.locked.trend", {
                          defaultValue:
                            "Aggiungi almeno 2 snapshot in date diverse per vedere l’andamento nel tempo.",
                        })
                      )
                    }
                  >
                    <PortfolioLineChartCard
                      data={dashboard.portfolioSeries}
                      walletSeries={dashboard.walletSeries}
                      hideHeader
                      noCard
                      modes={showInvestments ? undefined : ["total"]}
                    />
                  </SectionAccordion>
                );
              }
              if (sectionId === "distribuzione") {
                return (
                  <SectionAccordion
                    key={sectionId}
                    title={t("dashboard.section.distribution")}
                    open={sectionStates.distribuzione}
                    onToggle={() => handleToggleSection("distribuzione")}
                    locked={!isAvailable}
                    lockedSubtitle={lockedSubtitle}
                    onLockedPress={() =>
                      handleLockedPress(
                        "distribuzione",
                        t("dashboard.locked.distribution", {
                          defaultValue:
                            "Aggiungi il tuo primo snapshot per vedere la distribuzione del patrimonio.",
                        })
                      )
                    }
                  >
                    <DonutDistributionCard items={dashboard.distributions} hideHeader noCard />
                  </SectionAccordion>
                );
              }
              if (sectionId === "cashflow") {
                return (
                  <SectionAccordion
                    key={sectionId}
                    title={t("dashboard.section.cashflow")}
                    open={sectionStates.cashflow}
                    onToggle={() => handleToggleSection("cashflow")}
                    locked={!isAvailable}
                    lockedSubtitle={lockedSubtitle}
                    onLockedPress={() =>
                      handleLockedPress(
                        "cashflow",
                        t("dashboard.locked.cashflow", {
                          defaultValue:
                            "Inserisci entrate e/o uscite ricorrenti per attivare il Cash Flow.",
                        })
                      )
                    }
                  >
                    <CashflowOverviewCard cashflow={dashboard.cashflow} hideHeader noCard />
                  </SectionAccordion>
                );
              }
              if (sectionId === "categories") {
                return (
                  <SectionAccordion
                    key={sectionId}
                    title={t("dashboard.section.categories")}
                    open={sectionStates.categories}
                    onToggle={() => handleToggleSection("categories")}
                    locked={!isAvailable}
                    lockedSubtitle={lockedSubtitle}
                    onLockedPress={() =>
                      handleLockedPress(
                        "categories",
                        t("dashboard.locked.categories", {
                          defaultValue:
                            "Aggiungi almeno una spesa per vedere il grafico per categoria.",
                        })
                      )
                    }
                  >
                    <CategoriesBreakdownCard items={dashboard.categories} hideHeader noCard />
                  </SectionAccordion>
                );
              }
              return (
                <SectionAccordion
                  key={sectionId}
                  title={t("dashboard.section.recurrences")}
                  open={sectionStates.prossimi}
                  onToggle={() => handleToggleSection("prossimi")}
                  locked={!isAvailable}
                  lockedSubtitle={lockedSubtitle}
                  onLockedPress={() =>
                    handleLockedPress(
                      "prossimi",
                      t("dashboard.locked.recurrences", {
                        defaultValue:
                          "Aggiungi entrate o uscite ricorrenti per vedere i prossimi movimenti.",
                      })
                    )
                  }
                >
                  <RecurrencesTableCard
                    rows={dashboard.recurrences}
                    hideHeader
                    noCard
                    onPressRow={(row) =>
                      navigation.navigate("Balance", {
                        entryType: row.type,
                        formMode: "edit",
                        entryId: row.entryId,
                      })
                    }
                  />
                </SectionAccordion>
              );
              })}
              {canReorderSections && (
                <View style={styles.orderToggleRow}>
                  <PressScale onPress={openReorderSheet} style={styles.orderToggleLink}>
                    <Text style={[styles.orderToggleText, { color: tokens.colors.accent }]}>
                      {t("dashboard.reorder.edit", { defaultValue: "Modifica ordine" })}
                    </Text>
                  </PressScale>
                </View>
              )}
            </>
          ) : null}
        </ScrollView>
        <Modal
          visible={reorderVisible && canReorderSections}
          transparent
          animationType="none"
          presentationStyle="overFullScreen"
          onRequestClose={closeReorderSheet}
        >
          <View style={styles.reorderOverlay} pointerEvents="box-none">
            <Pressable style={StyleSheet.absoluteFill} onPress={closeReorderSheet}>
              <Animated.View
                pointerEvents="none"
                style={[styles.reorderOverlayDim, { backgroundColor: reorderOverlayTint, opacity: reorderAnim }]}
              />
            </Pressable>
            <Animated.View
              pointerEvents="auto"
              style={[
                styles.reorderSheet,
                {
                  backgroundColor: reorderSheetBackground,
                  borderColor: reorderSheetBorder,
                  paddingBottom: insets.bottom + 12,
                  transform: [{ translateY: reorderTranslateY }],
                  opacity: reorderAnim,
                },
              ]}
            >
              <GlassBlur intensity={reorderBlurIntensity} tint={isDark ? "dark" : "light"} fallbackColor="transparent" />
              <View style={styles.reorderSheetHeader}>
                <Text style={[styles.reorderSheetTitle, { color: tokens.colors.text }]}>
                  {t("dashboard.reorder.title", { defaultValue: "Modifica ordine" })}
                </Text>
                <SmallOutlinePillButton
                  label={t("dashboard.reorder.done", { defaultValue: "Fatto" })}
                  onPress={closeReorderSheet}
                  color={tokens.colors.accent}
                />
              </View>
              <Text style={[styles.orderHint, { color: tokens.colors.muted }]}>
                {t("dashboard.reorder.hint", { defaultValue: "Tocca la freccia per portare in alto." })}
              </Text>
              <ScrollView
                style={styles.reorderScroll}
                contentContainerStyle={styles.reorderList}
                showsVerticalScrollIndicator={false}
              >
                {normalizeSectionOrder(sectionOrder).map((sectionId, index) => (
                  <View
                    key={sectionId}
                    style={[
                      styles.reorderRow,
                      {
                        borderColor: tokens.colors.glassBorder,
                        backgroundColor: tokens.colors.glassBg,
                      },
                    ]}
                  >
                    <View style={styles.reorderRowContent}>
                      <Text style={[styles.reorderRowLabel, { color: tokens.colors.text }]} numberOfLines={1}>
                        {sectionLabels[sectionId]}
                      </Text>
                    </View>
                    <PressScale
                      onPress={() => {
                        if (index > 0) bringSectionToTop(sectionId);
                      }}
                      style={[styles.reorderAction, { opacity: index === 0 ? 0.4 : 1 }]}
                      disabled={index === 0}
                    >
                      <MaterialCommunityIcons name="arrow-up" size={18} color={tokens.colors.accent} />
                    </PressScale>
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>
        <LimitReachedModal
          visible={lockedModal.visible}
          onClose={closeLockedModal}
          onUpgrade={lockedCta.onPress}
          title={t("dashboard.locked.title", { defaultValue: "Come sbloccarla" })}
          subtitle={lockedModal.message}
          ctaLabel={lockedCta.label}
          secondaryLabel={t("common.close", { defaultValue: "Chiudi" })}
          benefits={[]}
          iconName="lock-outline"
        />
      </AppBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    gap: 10,
  },
  screenRoot: {
    flex: 1,
  },
  section: {
    gap: 10,
    marginTop: 3,
  },
  greetingBlock: {
    gap: 10,
  },
  kpiBlock: {
    gap: 0,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: 12,
  },
  rangeRow: {
    alignItems: "flex-end",
    alignSelf: "flex-end",
    marginBottom: 6,
  },
  privacyActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  privacyLink: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  privacyLinkText: {
    fontSize: 12,
    fontWeight: "600",
  },
  privacyDismiss: {
    fontSize: 12,
    fontWeight: "600",
  },
  orderToggleRow: {
    alignItems: "flex-end",
    paddingTop: 4,
    paddingRight: 6,
  },
  orderToggleLink: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  orderToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  lockedSubtitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  accordionIcon: {
    fontSize: 24,
  },
  cardWrapper: {
    padding: 0,
  },
  accordionContent: {
    marginTop: 8,
    gap: 12,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  greetingText: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.25,
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 180,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  reorderOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  reorderOverlayDim: {
    ...StyleSheet.absoluteFillObject,
  },
  reorderSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    borderWidth: 1,
    overflow: "hidden",
    elevation: 24,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    gap: 12,
  },
  reorderSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reorderSheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  orderHint: {
    fontSize: 12,
  },
  reorderScroll: {
    maxHeight: 420,
  },
  reorderList: {
    paddingVertical: 4,
    gap: 10,
  },
  reorderRow: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
  },
  reorderRowContent: {
    flex: 1,
    flexDirection: "column",
  },
  reorderRowLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  reorderAction: {
    padding: 6,
    borderRadius: 6,
  },
  errorBody: {
    marginTop: 6,
  },
  lockedCard: {
    opacity: 0.7,
  },
});
