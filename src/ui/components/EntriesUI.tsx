import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme, Text } from "react-native-paper";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import type { StyleProp, ViewStyle } from "react-native";

type SegmentOption<T> = {
  value: T;
  label: string;
  tint?: string;
};

type SegmentedControlPillProps<T> = {
  value: T;
  options: SegmentOption<T>[];
  onChange: (next: T) => void;
};

export function SegmentedControlPill<T>({ value, options, onChange }: SegmentedControlPillProps<T>): JSX.Element {
  const paperTheme = useTheme();
  const { tokens } = useDashboardTheme();
  const tint = paperTheme.dark ? "dark" : "light";
  return (
    <View style={[styles.segmentWrap, { borderColor: tokens.colors.glassBorder }]}>
      <BlurView intensity={35} tint={tint} style={StyleSheet.absoluteFill} />
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={`${option.value}`}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              {
                backgroundColor: active
                  ? option.tint ?? `${tokens.colors.glassBorder}44`
                  : "transparent",
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text style={[styles.segmentLabel, { color: tokens.colors.text }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type FrequencyPillGroupProps = {
  value: string;
  onChange: (next: string) => void;
  options: SegmentOption<string>[];
};

export function FrequencyPillGroup({ value, onChange, options }: FrequencyPillGroupProps): JSX.Element {
  return (
    <SegmentedControlPill value={value} onChange={onChange} options={options} />
  );
}

export function GlassCardContainer({
  children,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}): JSX.Element {
  const paperTheme = useTheme();
  const { tokens } = useDashboardTheme();
  const tint = paperTheme.dark ? "dark" : "light";
  return (
    <View
      style={[
        styles.glassCard,
        { borderColor: tokens.colors.glassBorder },
        { width: "100%", alignSelf: "stretch" },
        style,
      ]}
    >
      <BlurView intensity={32} tint={tint} style={StyleSheet.absoluteFill} />
      <View
        style={[
          styles.glassInner,
          { backgroundColor: tokens.colors.glassBg },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function PrimaryPillButton({
  label,
  onPress,
  color,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  color: string;
  disabled?: boolean;
}): JSX.Element {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryPill,
        {
          backgroundColor: color,
          opacity: disabled ? 0.6 : pressed ? 0.92 : 1,
        },
      ]}
    >
      <Text style={styles.primaryPillText}>{label}</Text>
    </Pressable>
  );
}

export function SmallOutlinePillButton({
  label,
  onPress,
  color,
  icon,
}: {
  label: string;
  onPress: () => void;
  color: string;
  icon?: React.ReactNode;
}): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallOutline,
        { borderColor: color, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {icon ? <View style={styles.smallOutlineIcon}>{icon}</View> : null}
      <Text style={[styles.smallOutlineText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function PillChip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}): JSX.Element {
  const { tokens } = useDashboardTheme();
  const tint = color ?? tokens.colors.accent;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? tint : tokens.colors.glassBorder,
          backgroundColor: selected ? `${tint}33` : tokens.colors.glassBg,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: tokens.colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function DatePill({ day, month }: { day: string; month: string }): JSX.Element {
  const { tokens } = useDashboardTheme();
  return (
    <View style={[styles.datePill, { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.glassBg }]}>
      <Text style={[styles.dateDay, { color: tokens.colors.text }]}>{day}</Text>
      <Text style={[styles.dateMonth, { color: tokens.colors.muted }]}>{month}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  segmentWrap: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentLabel: {
    fontWeight: "600",
    fontSize: 15,
  },
  glassCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  glassInner: {
    padding: 16,
    borderRadius: 18,
  },
  primaryPill: {
    width: "100%",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryPillText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  smallOutline: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 72,
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
  },
  smallOutlineIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: "center",
  },
  chipText: {
    fontWeight: "600",
    fontSize: 13,
  },
  smallOutlineText: {
    fontWeight: "700",
    fontSize: 13,
  },
  datePill: {
    width: 56,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dateDay: {
    fontWeight: "800",
    fontSize: 16,
  },
  dateMonth: {
    fontWeight: "600",
    fontSize: 12,
  },
});
