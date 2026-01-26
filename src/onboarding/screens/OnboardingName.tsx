import React, { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Text, TextInput, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { GlassCardContainer, PrimaryPillButton, SmallOutlinePillButton } from "@/ui/components/EntriesUI";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { getDisplayName, setDisplayName } from "@/onboarding/onboardingStorage";
import OnboardingScaffold, { ONBOARDING_CARD_MIN_HEIGHT } from "@/onboarding/components/OnboardingScaffold";

type Props = {
  onNext: () => void;
  onSkip: () => void;
};

export default function OnboardingName({ onNext, onSkip }: Props): JSX.Element {
  const { t } = useTranslation();
  const { tokens } = useDashboardTheme();
  const paperTheme = useTheme();
  const [name, setName] = useState("");

  useEffect(() => {
    let active = true;
    getDisplayName()
      .then((value) => {
        if (active && value) {
          setName(value);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleContinue = async (skip?: boolean) => {
    await setDisplayName(name.trim());
    if (skip) {
      onSkip();
    } else {
      onNext();
    }
  };

  return (
    <OnboardingScaffold>
      <GlassCardContainer contentStyle={{ minHeight: ONBOARDING_CARD_MIN_HEIGHT }}>
        <View style={styles.cardContent}>
          <View>
            <View style={styles.heroWrap}>
              <Image
                source={require("../../../assets/onboarding/onboarding-2.png")}
                style={styles.heroImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.header}>
              <Text style={[styles.title, { color: tokens.colors.text }]}>{t("onboardingV2.name.title")}</Text>
              <Text style={[styles.subtitle, { color: tokens.colors.muted }]}>{t("onboardingV2.name.subtitle")}</Text>
            </View>
            <View style={{ marginTop: 16, gap: 12 }}>
              <TextInput
                mode="outlined"
                value={name}
                onChangeText={setName}
                placeholder={t("onboardingV2.name.placeholder")}
                outlineColor={tokens.colors.glassBorder}
                activeOutlineColor={tokens.colors.accent}
                style={[styles.input, { backgroundColor: tokens.colors.glassBg }]}
                textColor={tokens.colors.text}
                selectionColor={tokens.colors.accent}
                theme={{
                  ...paperTheme,
                  colors: { ...paperTheme.colors, background: tokens.colors.glassBg },
                }}
              />
            </View>
          </View>
          <View style={styles.actions}>
            <PrimaryPillButton
              label={t("onboardingV2.common.continue")}
              onPress={() => handleContinue(false)}
              color={tokens.colors.accent}
            />
            <View style={{ height: 12 }} />
            <SmallOutlinePillButton
              label={t("onboardingV2.common.skip")}
              onPress={() => handleContinue(true)}
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
    width: 180,
    height: 140,
  },
  cardContent: {
    flex: 1,
    minHeight: ONBOARDING_CARD_MIN_HEIGHT,
    justifyContent: "space-between",
  },
  actions: {
    marginTop: 16,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
  },
  input: {
    borderRadius: 14,
  },
});
