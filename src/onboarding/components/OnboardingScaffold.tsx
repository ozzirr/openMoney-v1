import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import AppBackground from "@/ui/components/AppBackground";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  children: React.ReactNode;
};

export const ONBOARDING_CARD_MIN_HEIGHT = 520;

export default function OnboardingScaffold({ children }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { padding: tokens.spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 16,
  },
});
