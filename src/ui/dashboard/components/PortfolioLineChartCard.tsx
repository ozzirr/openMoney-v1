import React, { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "react-native-paper";
import {
  VictoryArea,
  VictoryAxis,
  VictoryChart,
  VictoryLine,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from "victory-native";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import { PillChip } from "@/ui/components/EntriesUI";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { formatCompact, formatEUR, formatMonthLabel } from "@/ui/dashboard/formatters";
import type { PortfolioPoint, WalletSeries } from "@/ui/dashboard/types";
import { useTranslation } from "react-i18next";

type Mode = "total" | "liquidity" | "investments";

type Props = {
  data: PortfolioPoint[];
  walletSeries?: WalletSeries[];
  hideHeader?: boolean;
  noCard?: boolean;
  modes?: ("total" | "liquidity" | "investments")[];
};

const WALLET_FILTER_ALL = "all" as const;
type WalletFilter = number | typeof WALLET_FILTER_ALL | null;
type WalletFilterState = {
  liquidity: WalletFilter;
  investments: WalletFilter;
};

const STORAGE_KEY = "dashboard_portfolio_filters_v1";

export default function PortfolioLineChartCard({
  data,
  walletSeries,
  hideHeader = false,
  noCard = false,
  modes,
}: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const { t } = useTranslation();
  const availableModes = useMemo(
    () => (modes ?? ["total", "liquidity", "investments"]) as Mode[],
    [modes]
  );
  const [mode, setMode] = useState<Mode>(availableModes[0]);
  const [walletFilterByMode, setWalletFilterByMode] = useState<WalletFilterState>({
    liquidity: null,
    investments: null,
  });
  const [hasLoadedPrefs, setHasLoadedPrefs] = useState(false);
  const { width } = useWindowDimensions();

  const walletSeriesByMode = useMemo(() => {
    if (!walletSeries) return [];
    if (mode === "liquidity") return walletSeries.filter((item) => item.type === "LIQUIDITY");
    if (mode === "investments") return walletSeries.filter((item) => item.type === "INVEST");
    return [];
  }, [mode, walletSeries]);

  const walletFilter =
    mode === "liquidity"
      ? walletFilterByMode.liquidity
      : mode === "investments"
        ? walletFilterByMode.investments
        : null;

  // Ensure mode is always one of the available options
  useEffect(() => {
    if (!availableModes.includes(mode)) {
      setMode(availableModes[0]);
    }
  }, [availableModes, mode]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          const parsed = JSON.parse(raw) as {
            mode?: Mode;
            walletFilterByMode?: Partial<WalletFilterState>;
          };
          if (parsed.mode && availableModes.includes(parsed.mode)) {
            setMode(parsed.mode);
          }
          if (parsed.walletFilterByMode) {
            setWalletFilterByMode((prev) => ({
              liquidity: parsed.walletFilterByMode?.liquidity ?? prev.liquidity,
              investments: parsed.walletFilterByMode?.investments ?? prev.investments,
            }));
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHasLoadedPrefs(true);
      });

    return () => {
      active = false;
    };
  }, [availableModes]);

  useEffect(() => {
    if (!hasLoadedPrefs) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode,
        walletFilterByMode,
      })
    ).catch(() => {});
  }, [hasLoadedPrefs, mode, walletFilterByMode]);

  useEffect(() => {
    if (mode !== "liquidity" && mode !== "investments") return;
    if (!walletSeriesByMode.length) {
      return;
    }
    const exists =
      walletFilter === WALLET_FILTER_ALL ||
      (walletFilter !== null && walletSeriesByMode.some((wallet) => wallet.walletId === walletFilter));
    if (!exists) {
      setWalletFilterByMode((prev) => ({
        ...prev,
        [mode === "liquidity" ? "liquidity" : "investments"]: walletSeriesByMode[0]?.walletId ?? null,
      }));
    }
  }, [mode, walletFilter, walletSeriesByMode]);

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        x: point.date,
        y: mode === "total" ? point.total : mode === "liquidity" ? point.liquidity : point.investments,
      })),
    [data, mode]
  );

  const showWalletFilters = (mode === "liquidity" || mode === "investments") && walletSeriesByMode.length > 0;

  const toAlpha = (color: string, alpha: string) => {
    if (color.startsWith("#") && color.length === 7) {
      return `${color}${alpha}`;
    }
    return color;
  };

  const displaySeries = useMemo(() => {
    if (!showWalletFilters) {
      return [
        {
          id: mode,
          color: tokens.colors.accent,
          showArea: true,
          data: chartData,
        },
      ];
    }

    if (walletFilter === WALLET_FILTER_ALL) {
      return [
        {
          id: mode,
          color: tokens.colors.accent,
          showArea: true,
          data: chartData,
        },
      ];
    }

    const selected = walletSeriesByMode.find((wallet) => wallet.walletId === walletFilter);
    if (!selected) {
      return [
        {
          id: mode,
          color: tokens.colors.accent,
          showArea: true,
          data: chartData,
        },
      ];
    }

    return [
      {
        id: `wallet-${selected.walletId}`,
        color: selected.color,
        showArea: true,
        data: selected.points.map((point) => ({
          x: point.date,
          y: point.value,
          walletName: selected.name,
        })),
      },
    ];
  }, [chartData, mode, showWalletFilters, tokens.colors.accent, walletFilter, walletSeriesByMode]);

  const seriesValues = useMemo(
    () => displaySeries.flatMap((series) => series.data.map((point) => point.y ?? 0)),
    [displaySeries]
  );
  const highestValue = seriesValues.reduce((max, value) => Math.max(max, value), 0);
  const lowestValue = seriesValues.reduce((min, value) => Math.min(min, value), highestValue || 0);
  const range = Math.max(0, highestValue - lowestValue);
  const padding = range === 0 ? Math.max(highestValue * 0.05, 1) : range * 0.15;
  const domainMin = Math.max(0, lowestValue - padding);
  const domainMax = highestValue > 0 ? highestValue + padding : 1;
  const chartHeight = 260;

  const visibleWidth = Math.max(width - 64, 0);
  const pointSpacing = 70;
  const chartPaddingLeft = 15;
  const chartPaddingRight = 35;
  const pointCount = displaySeries[0]?.data.length ?? 0;
  const chartWidth = Math.max(
    visibleWidth,
    Math.max(pointCount - 1, 0) * pointSpacing + chartPaddingLeft + chartPaddingRight
  );
  const chartOffset = Math.max(chartWidth - visibleWidth, 0);

  const content = (
    <>
      {!hideHeader && <SectionHeader title={t("dashboard.portfolio.header")} />}
      {availableModes.length > 1 && (
        <View style={styles.toggleRow}>
          {availableModes.map((item) => {
            const label =
              item === "total"
                ? t("dashboard.portfolio.toggle.total")
                : item === "liquidity"
                  ? t("dashboard.portfolio.toggle.liquidity")
                  : t("dashboard.portfolio.toggle.investments");
            const active = item === mode;
            return (
              <PillChip
                key={item}
                label={label}
                selected={active}
                onPress={() => setMode(item)}
              />
            );
          })}
        </View>
      )}
      {showWalletFilters && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          contentContainerStyle={styles.walletScroll}
        >
          <PillChip
            label={t("common.all", { defaultValue: "Tutti" })}
            selected={walletFilter === WALLET_FILTER_ALL}
            onPress={() =>
              setWalletFilterByMode((prev) => ({
                ...prev,
                [mode === "liquidity" ? "liquidity" : "investments"]: WALLET_FILTER_ALL,
              }))
            }
          />
          {walletSeriesByMode.map((wallet) => (
            <PillChip
              key={wallet.walletId}
              label={wallet.name}
              selected={walletFilter === wallet.walletId}
              onPress={() =>
                setWalletFilterByMode((prev) => ({
                  ...prev,
                  [mode === "liquidity" ? "liquidity" : "investments"]: wallet.walletId,
                }))
              }
            />
          ))}
        </ScrollView>
      )}
      {displaySeries.length === 0 || displaySeries[0].data.length === 0 ? (
        <Text style={[styles.empty, { color: tokens.colors.muted }]}>{t("dashboard.portfolio.empty")}</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          contentContainerStyle={[styles.chartScroll, { justifyContent: "flex-end" }]}
          contentOffset={{ x: chartOffset }}
        >
          <VictoryChart
            width={chartWidth}
            height={chartHeight}
            padding={{ left: chartPaddingLeft, right: chartPaddingRight, top: 18, bottom: 30 }}
            domain={{ y: [domainMin, domainMax] }}
            containerComponent={
              <VictoryVoronoiContainer
                voronoiBlacklist={displaySeries.map((series) => `area-${series.id}`)}
                labels={({ datum }) => {
                  const valueLabel = formatEUR(datum.y);
                  return `${valueLabel}`;
                }}
                labelComponent={
                  <VictoryTooltip
                    renderInPortal={false}
                    constrainToVisibleArea
                    flyoutStyle={{ fill: tokens.colors.surface2, stroke: tokens.colors.border, strokeWidth: 1 }}
                    style={{ fill: tokens.colors.text, fontSize: 13, fontWeight: "600" }}
                    cornerRadius={14}
                    pointerLength={0}
                    flyoutPadding={{ top: 6, bottom: 6, left: 10, right: 10 }}
                    dy={-12}
                  />
                }
              />
            }
          >
            <VictoryAxis
              tickFormat={(tick) => formatMonthLabel(String(tick))}
              style={{
                axis: { stroke: "transparent" },
                tickLabels: { fontSize: 11, fill: tokens.colors.muted, padding: 6 },
              }}
            />
            <VictoryAxis
              dependentAxis
              orientation="right"
              tickFormat={(tick) => formatCompact(Number(tick))}
              style={{
                axis: { stroke: "transparent" },
                grid: { stroke: tokens.colors.border },
                tickLabels: { fontSize: 11, fill: tokens.colors.muted, padding: 6 },
              }}
            />
            {displaySeries.map((series) =>
              series.showArea ? (
                <VictoryArea
                  key={`${series.id}-area`}
                  name={`area-${series.id}`}
                  data={series.data}
                  interpolation="natural"
                  style={{ data: { fill: toAlpha(series.color, "3B") } }}
                />
              ) : null
            )}
            {displaySeries.map((series) => (
              <VictoryLine
                key={series.id}
                data={series.data}
                interpolation="natural"
                style={{ data: { stroke: series.color, strokeWidth: 2.5 } }}
              />
            ))}
          </VictoryChart>
        </ScrollView>
      )}
    </>
  );

  if (noCard) {
    return <>{content}</>;
  }

  return (
    <View>
      <PremiumCard>{content}</PremiumCard>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  walletScroll: {
    gap: 8,
    marginBottom: 8,
    paddingRight: 4,
  },
  empty: {
    fontSize: 13,
  },
  chartScroll: {
    paddingRight: 4,
  },
});
