import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useTranslation } from "react-i18next";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  selectedRange: T;
  onChangeRange: (range: T) => void;
  options: Option<T>[];
  showLabel?: boolean;
  label?: string;
  accessibilityLabel?: string;
};

export default function RangeSelector({
  selectedRange,
  onChangeRange,
  options,
  showLabel = true,
  label,
  accessibilityLabel,
}: Props<string>): JSX.Element {
  const { tokens } = useDashboardTheme();
  const { t } = useTranslation();
  const selectedLabel = useMemo(
    () => options.find((opt) => opt.value === selectedRange)?.label ?? "",
    [options, selectedRange]
  );
  const cycleRange = useCallback(() => {
    if (options.length === 0) return;
    const currentIndex = options.findIndex((opt) => opt.value === selectedRange);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % options.length : 0;
    onChangeRange(options[nextIndex].value);
  }, [onChangeRange, options, selectedRange]);

  return (
    <>
      <View style={styles.wrapper}>
        <Pressable
          onPress={cycleRange}
          hitSlop={6}
          style={({ pressed }) => [
            styles.selectorRow,
            !showLabel && styles.selectorRowCompact,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        accessibilityRole="button"
        accessibilityLabel={
          accessibilityLabel ??
          t("dashboard.range.accessibility", {
            defaultValue: "Seleziona intervallo KPI",
          })
        }
      >
        {showLabel ? (
          <Text style={[styles.selectorLabel, { color: tokens.colors.muted }]}>
            {label ?? t("dashboard.range.label")}
          </Text>
        ) : null}
          <View style={styles.selectorValue}>
            <Text
              style={[
                styles.selectorValueText,
                !showLabel && styles.selectorValueTextCompact,
                { color: tokens.colors.accent },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {selectedLabel}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={tokens.colors.accent} />
          </View>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    alignSelf: "flex-start",
    overflow: "visible",
  },
  selectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: 0,
    maxWidth: "100%",
    alignSelf: "flex-start",
    gap: 4,
    position: "relative",
    zIndex: 1,
  },
  selectorRowCompact: {
    minWidth: 0,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "transparent",
  },
  selectorValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "80%",
    flexShrink: 1,
  },
  selectorValueText: {
    fontSize: 13,
    fontWeight: "600",
  },
  selectorValueTextCompact: {
    fontSize: 13,
  },
});
