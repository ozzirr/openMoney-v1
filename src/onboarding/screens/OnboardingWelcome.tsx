import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { GlassCardContainer, PrimaryPillButton, SmallOutlinePillButton } from "@/ui/components/EntriesUI";
import OnboardingScaffold, { ONBOARDING_CARD_MIN_HEIGHT } from "@/onboarding/components/OnboardingScaffold";

type Props = {
  onNext: () => void;
  onSkip: () => void;
};

export default function OnboardingWelcome({ onNext, onSkip }: Props): JSX.Element {
  const { t } = useTranslation();
  const { tokens } = useDashboardTheme();

  const bullets = [
    t("onboardingV2.welcome.bullet1"),
    t("onboardingV2.welcome.bullet2"),
    t("onboardingV2.welcome.bullet3"),
  ];

  return (
    <OnboardingScaffold>
      <GlassCardContainer contentStyle={{ minHeight: ONBOARDING_CARD_MIN_HEIGHT }}>
        <View style={styles.cardContent}>
          <View>
            <View style={styles.heroWrap}>
              <Image
                source={require("../../../assets/onboarding/onboarding-1.png")}
                style={styles.heroImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.header}>
              <Text style={[styles.title, { color: tokens.colors.text }]}>{t("onboardingV2.welcome.title")}</Text>
              <Text style={[styles.subtitle, { color: tokens.colors.muted }]}>
                {t("onboardingV2.welcome.subtitle")}
              </Text>
            </View>
            <View style={styles.list}>
              {bullets.map((item, idx) => (
                <Text key={idx} style={[styles.bullet, { color: tokens.colors.text }]}>
                  • {item}
                </Text>
              ))}
            </View>
          </View>
          <View style={styles.actions}>
            <PrimaryPillButton
              label={t("onboardingV2.common.continue")}
              onPress={onNext}
              color={tokens.colors.accent}
            />
            <View style={{ height: 12 }} />
            <SmallOutlinePillButton
              label={t("onboardingV2.common.skip")}
              onPress={onSkip}
              color={tokens.colors.accent}
            />
          </View>
        </View>
      </GlassCardContainer>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    alignItems: "center",
    marginBottom: 12,
  },
  heroImage: {
    width: 160,
    height: 140,
  },
  cardContent: {
    flex: 1,
    minHeight: ONBOARDING_CARD_MIN_HEIGHT,
    justifyContent: "space-between",
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
  },
  list: {
    marginTop: 12,
    gap: 8,
  },
  bullet: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
  },
  actions: {
    marginTop: 18,
  },
});
