import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import Chip from "@/ui/dashboard/components/Chip";
import PressScale from "@/ui/dashboard/components/PressScale";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { formatEUR, formatShortDate } from "@/ui/dashboard/formatters";
import type { RecurrenceRow } from "@/ui/dashboard/types";

type Props = {
  rows: RecurrenceRow[];
  onPressRow?: (row: RecurrenceRow) => void;
};

export default function RecurrencesTableCard({ rows, onPressRow }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  return (
    <PremiumCard>
      <SectionHeader title="Prossimi movimenti programmati" />
      {rows.length === 0 ? (
        <Text style={[styles.empty, { color: tokens.colors.muted }]}>Nessun movimento programmato.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.table}>
          <View>
            <View style={styles.headerRow}>
              <Text
                style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellAmount, styles.headerAmount]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Importo
              </Text>
              <Text
                style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellDate]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Data
              </Text>
              <Text
                style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellType]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Tipo
              </Text>
              <Text
                style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellCategory]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Categoria
              </Text>
              <Text
                style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellDesc]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Descrizione
              </Text>
            </View>
            {rows.map((item, index) => {
              const amountColor = item.type === "income" ? tokens.colors.green : tokens.colors.red;
              return (
                <React.Fragment key={item.id}>
                  <PressScale onPress={() => onPressRow?.(item)} style={styles.row}>
                    <Text style={[styles.cell, styles.cellAmount, { color: amountColor }]}>
                      {formatEUR(item.amount)}
                    </Text>
                    <Text style={[styles.cell, { color: tokens.colors.text }, styles.cellDate]}>
                      {formatShortDate(item.date)}
                    </Text>
                    <View style={[styles.cell, styles.cellType]}>
                      <Chip
                        label={item.type === "income" ? "Entrata" : "Uscita"}
                        tone={item.type === "income" ? "green" : "red"}
                      />
                    </View>
                    <Text style={[styles.cell, { color: tokens.colors.text }, styles.cellCategory]} numberOfLines={1}>
                      {item.category}
                    </Text>
                    <Text style={[styles.cell, { color: tokens.colors.muted }, styles.cellDesc]} numberOfLines={1}>
                      {item.description}
                    </Text>
                  </PressScale>
                  {index < rows.length - 1 ? (
                    <View style={[styles.separator, { backgroundColor: tokens.colors.border }]} />
                  ) : null}
                </React.Fragment>
              );
            })}
          </View>
        </ScrollView>
      )}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  table: {
    gap: 12,
    paddingBottom: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
    flexWrap: "nowrap",
  },
  headerCell: {
    fontSize: 12,
    fontWeight: "600",
    minWidth: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    flexWrap: "nowrap",
    width: 470,
  },
  cell: {
    fontSize: 12,
    minWidth: 0,
  },
  cellDate: {
    width: 64,
    flexShrink: 0,
    marginRight: 6,
  },
  cellType: {
    width: 100,
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 6,
    marginRight: 0,
  },
  cellCategory: {
    width: 140,
    flexShrink: 1,
    marginRight: 6,
  },
  cellDesc: {
    width: 150,
    flexShrink: 1,
    marginRight: 6,
  },
  cellAmount: {
    width: 88,
    textAlign: "left",
    fontWeight: "700",
    flexShrink: 0,
  },
  headerAmount: {
    textAlign: "left",
  },
  separator: {
    height: 1,
  },
  empty: {},
});
