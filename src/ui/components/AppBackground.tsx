import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

type Props = {
  children: React.ReactNode;
};

export default function AppBackground({ children }: Props): JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.orbTop, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(120,96,255,0.08)" }]} />
      <View style={[styles.orbBottom, { backgroundColor: isDark ? "rgba(120,96,255,0.12)" : "rgba(120,96,255,0.18)" }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  orbTop: {
    position: "absolute",
    top: -120,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  orbBottom: {
    position: "absolute",
    bottom: -140,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(120,96,255,0.12)",
  },
});
