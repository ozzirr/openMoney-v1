import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "react-native-paper";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: "light" | "dark";
  radius?: number;
  backgroundColor?: string;
  borderColor?: string;
  pointerEvents?: ViewProps["pointerEvents"];
};

export default function GlassSurface({
  children,
  style,
  intensity = 32,
  tint,
  radius,
  backgroundColor,
  borderColor,
  pointerEvents,
}: Props): JSX.Element {
  const paperTheme = useTheme();
  const { tokens } = useDashboardTheme();
  const resolvedTint = tint ?? (paperTheme.dark ? "dark" : "light");
  const resolvedRadius = radius ?? tokens.radius.md;
  const resolvedBackground = backgroundColor ?? tokens.colors.glassBg;
  const resolvedBorder = borderColor ?? tokens.colors.glassBorder;
  const isAndroid = Platform.OS === "android";
  const androidBackground =
    resolvedBackground === tokens.colors.glassBg
      ? tokens.colors.surface
      : resolvedBackground === tokens.colors.modalGlassBg
      ? tokens.colors.surface2
      : resolvedBackground;
  const androidBorder =
    resolvedBorder === tokens.colors.glassBorder || resolvedBorder === tokens.colors.modalBorder
      ? tokens.colors.border
      : resolvedBorder;
  const finalBackground = isAndroid ? androidBackground : resolvedBackground;
  const finalBorder = isAndroid ? androidBorder : resolvedBorder;

  return (
    <View
      pointerEvents={pointerEvents}
      style={[
        styles.base,
        {
          borderRadius: resolvedRadius,
          backgroundColor: finalBackground,
          borderColor: finalBorder,
        },
        style,
      ]}
    >
      <View style={[styles.clip, { borderRadius: resolvedRadius }]}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={intensity}
            tint={resolvedTint}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        ) : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
  clip: {
    overflow: "hidden",
  },
});
