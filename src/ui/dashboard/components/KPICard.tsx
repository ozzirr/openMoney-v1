import React, { useEffect, useMemo, useRef, useState } from "react";
import { LayoutAnimation, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import PressScale from "@/ui/dashboard/components/PressScale";
import { GlassCardContainer } from "@/ui/components/EntriesUI";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { formatEUR, formatPct } from "@/ui/dashboard/formatters";
import type { KPIItem } from "@/ui/dashboard/types";

type Props = {
  item: KPIItem;
  emphasizeValue?: boolean;
};

export default function KPICard({ item, emphasizeValue = false }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const [expanded, setExpanded] = useState(false);
  const [displayValue, setDisplayValue] = useState(item.value);
  const animationRef = useRef<number | null>(null);
  const icon = useMemo(() => {
    if (item.id === "liquidity") return "cash";
    if (item.id === "investments") return "trending-up";
    return "shield-star";
  }, [item.id]);
  const deltaIsPositive = item.deltaValue >= 0;
  const deltaColor = deltaIsPositive ? tokens.colors.green : tokens.colors.red;

  const onToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  useEffect(() => {
    const from = displayValue;
    const to = item.value;
    const duration = 700;
    const start = Date.now();

    const tick = () => {
      const now = Date.now();
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (to - from) * eased;
      setDisplayValue(next);
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(tick);
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [item.value]);

  return (
    <PressScale onPress={onToggle} style={styles.pressable}>
      <GlassCardContainer style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={[styles.label, { color: tokens.colors.muted }]}>{item.label}</Text>
          <MaterialCommunityIcons name={icon} size={16} color={item.accent ?? tokens.colors.accent} />
        </View>
        <Text
          style={[
            styles.value,
            { color: tokens.colors.text },
            emphasizeValue ? styles.valueEmphasis : null,
          ]}
        >
          {formatEUR(displayValue)}
        </Text>
        <View style={styles.deltaRow}>
          <Text style={[styles.deltaValue, { color: deltaColor }]}>
            {deltaIsPositive ? "+" : ""}
            {formatEUR(item.deltaValue)}
          </Text>
          <Text style={[styles.deltaPct, { color: deltaColor }]}>
            {deltaIsPositive ? "+" : ""}
            {formatPct(item.deltaPct)}
          </Text>
        </View>
        {expanded && item.breakdown?.length ? (
          <View style={styles.breakdown}>
            {item.breakdown.slice(0, 4).map((row) => (
              <View key={row.label} style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: tokens.colors.muted }]}>{row.label}</Text>
                <Text style={[styles.breakdownValue, { color: tokens.colors.text }]}>{formatEUR(row.value)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </GlassCardContainer>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flexGrow: 1,
    flexBasis: "48%",
  },
  card: {
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  value: {
    fontSize: 24,
    fontWeight: "700",
  },
  valueEmphasis: {
    fontSize: 24,
    fontWeight: "800",
  },
  deltaRow: {
    flexDirection: "row",
    gap: 8,
  },
  deltaValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  deltaPct: {
    fontSize: 13,
  },
  breakdown: {
    marginTop: 12,
    gap: 6,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  breakdownLabel: {
    fontSize: 12,
  },
  breakdownValue: {
    fontSize: 12,
  },
});
