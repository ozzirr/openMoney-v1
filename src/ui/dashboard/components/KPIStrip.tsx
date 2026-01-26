import React from "react";
import { StyleSheet, View } from "react-native";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import type { KPIItem } from "@/ui/dashboard/types";
import KPICard from "@/ui/dashboard/components/KPICard";

type Props = {
  items: KPIItem[];
};

export default function KPIStrip({ items }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  return (
    <View style={[styles.row, { gap: tokens.spacing.sm }]}>
      {items.map((item) => (
        <KPICard
          key={item.id}
          item={item}
          emphasizeValue={item.id === "netWorth"}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
