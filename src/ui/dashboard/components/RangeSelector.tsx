import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DarkTheme } from "@react-navigation/native";
import type { KpiDeltaRange } from "@/ui/dashboard/types";

type Option = { value: KpiDeltaRange; label: string };

type Props = {
  selectedRange: KpiDeltaRange;
  onChangeRange: (range: KpiDeltaRange) => void;
  options: Option[];
  showLabel?: boolean;
};

export default function RangeSelector({
  selectedRange,
  onChangeRange,
  options,
  showLabel = true,
}: Props): JSX.Element {
  const { tokens, isDark } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selectedLabel = useMemo(
    () => options.find((opt) => opt.value === selectedRange)?.label ?? "",
    [options, selectedRange]
  );
  const sheetBackground = isDark ? "rgba(15, 18, 30, 0.55)" : "rgba(169, 124, 255, 0.32)";
  const sheetBorder = isDark ? DarkTheme.colors.border : "rgba(169, 124, 255, 0.5)";
  const blurIntensity = 35;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={({ pressed }) => [
          styles.selectorRow,
          !showLabel && styles.selectorRowCompact,
          {
            borderColor: tokens.colors.glassBorder,
            backgroundColor: tokens.colors.glassBg,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Periodo: ${selectedLabel}`}
      >
        {showLabel ? (
          <Text style={[styles.selectorLabel, { color: tokens.colors.muted }]}>Periodo</Text>
        ) : null}
        <View style={styles.selectorValue}>
          <Text
            style={[
              styles.selectorValueText,
              !showLabel && styles.selectorValueTextCompact,
              { color: tokens.colors.text },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {selectedLabel}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={18} color={tokens.colors.muted} />
        </View>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} pointerEvents="auto">
          <View style={styles.overlayDim} pointerEvents="none" />
            <Pressable
              onPress={() => undefined}
              style={[
                styles.sheet,
                {
                  backgroundColor: sheetBackground,
                  borderColor: sheetBorder,
                  paddingBottom: insets.bottom + 12,
                },
              ]}
            >
            <BlurView intensity={blurIntensity} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <Text style={[styles.sheetTitle, { color: tokens.colors.text }]}>Cambia intervallo</Text>
            <Text style={[styles.sheetSubtitle, { color: tokens.colors.muted }]}>
              Scegli l’intervallo per il confronto dei KPI. Esempio: con “Ultimi 7 giorni” confronti
              il tuo ultimo snapshot con quello di 7 giorni fa, se esistente, altrimenti con il più vicino disponibile.
            </Text>
            <View style={styles.sheetList}>
              {options.map((option, index) => {
                const selected = option.value === selectedRange;
                const isLast = index === options.length - 1;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onChangeRange(option.value);
                      setOpen(false);
                    }}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.sheetRow,
                      {
                        borderColor: tokens.colors.glassBorder,
                        backgroundColor: selected
                          ? `${tokens.colors.accent}22`
                          : pressed
                          ? `${tokens.colors.glassBorder}33`
                          : "transparent",
                        borderBottomWidth: isLast ? 0 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.sheetLabel, { color: tokens.colors.text }]}>{option.label}</Text>
                    {selected ? (
                      <MaterialCommunityIcons name="check" size={18} color={tokens.colors.accent} style={styles.checkIcon} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    minWidth: 180,
    maxWidth: "100%",
    alignSelf: "flex-start",
  },
  selectorRowCompact: {
    minHeight: 34,
    minWidth: 150,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  selectorValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "70%",
    flexShrink: 1,
  },
  selectorValueText: {
    fontSize: 12,
    fontWeight: "600",
  },
  selectorValueTextCompact: {
    fontSize: 11,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlayDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    padding: 18,
    overflow: "hidden",
    elevation: 24,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  sheetSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: -6,
    marginBottom: 8,
  },
  sheetList: {
    gap: 0,
  },
  sheetRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 0,
  },
  sheetLabel: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    flex: 1,
  },
  checkIcon: {
    position: "absolute",
    right: 12,
  },
});
