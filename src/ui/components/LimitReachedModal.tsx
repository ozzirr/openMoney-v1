import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { Modal, Portal, Text, Button } from "react-native-paper";
import GlassBlur from "@/ui/components/GlassBlur";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useTranslation } from "react-i18next";

type Props = {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  title?: string;
  subtitle?: string;
  benefits?: string[];
  ctaLabel?: string;
  secondaryLabel?: string;
  iconName?: string;
};

const LinearGradient: React.ComponentType<any> | undefined = undefined;

export default function LimitReachedModal({
  visible,
  onClose,
  onUpgrade,
  title,
  subtitle,
  benefits,
  ctaLabel,
  secondaryLabel,
  iconName,
}: Props): JSX.Element {
  const { tokens, shadows, isDark } = useDashboardTheme();
  const { t } = useTranslation();

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  const resolvedTitle = title ?? t("wallets.actions.limitModalTitle");
  const resolvedSubtitle = subtitle ?? t("wallets.actions.limitModalSubtitle");
  const resolvedSecondaryLabel = secondaryLabel ?? t("wallets.actions.limitMaybeLater");
  const resolvedIconName = iconName ?? "wallet-outline";
  const resolvedBenefits = useMemo(
    () =>
      benefits ?? [
        t("wallets.actions.limitBenefitUnlimited"),
        t("wallets.actions.limitBenefitInsights"),
        t("wallets.actions.limitBenefitControl"),
      ],
    [benefits, t]
  );

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          stiffness: 220,
          damping: 18,
          mass: 0.7,
        }),
      ]).start();
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.96, duration: 140, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, visible]);

  const renderPrimaryCta = () => {
    const resolvedCtaLabel = ctaLabel ?? t("wallets.actions.limitUpgradeCta");
    if (LinearGradient) {
      const Gradient = LinearGradient;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={resolvedCtaLabel}
          onPress={onUpgrade}
          style={{ width: "100%" }}
        >
          <Gradient
            colors={[tokens.colors.accentPurple, tokens.colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientButton}
          >
            <Text style={[styles.ctaText, { color: "#FFFFFF" }]}>{resolvedCtaLabel}</Text>
          </Gradient>
        </Pressable>
      );
    }

    return (
      <Button
        mode="contained"
        buttonColor={tokens.colors.accent}
        textColor="#FFFFFF"
        onPress={onUpgrade}
        style={styles.fallbackButton}
        contentStyle={{ paddingVertical: 10 }}
      >
        {resolvedCtaLabel}
      </Button>
    );
  };

  const iconTint = `${tokens.colors.accentPurple}22`;
  const shouldShowBenefits = resolvedBenefits.length > 0;
  const overlayTint = isDark ? "rgba(0,0,0,0.92)" : "rgba(0,0,0,0.8)";
  const cardBackground =
    Platform.OS === "android"
      ? tokens.colors.surface2
      : isDark
      ? "rgba(15, 18, 30, 0.78)"
      : "rgba(169, 124, 255, 0.5)";
  const cardBorder =
    Platform.OS === "android" ? tokens.colors.border : isDark ? "rgba(255,255,255,0.12)" : "rgba(169, 124, 255, 0.5)";
  const blurTint = isDark ? "dark" : "light";
  const blurIntensity = 35;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        dismissable
        style={styles.modal}
        contentContainerStyle={styles.content}
        theme={{ colors: { backdrop: overlayTint } }}
      >
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: cardBackground,
              borderColor: cardBorder,
              opacity,
              transform: [{ scale }],
              ...shadows.card,
            },
          ]}
        >
          <GlassBlur intensity={blurIntensity} tint={blurTint} fallbackColor="transparent" />
          <View style={[styles.iconWrap, { backgroundColor: iconTint }]}>
            <View style={[styles.iconInner, { backgroundColor: tokens.colors.modalBorder }]}>
              <MaterialCommunityIcons name={resolvedIconName} size={32} color={tokens.colors.accent} />
            </View>
          </View>
          <Text variant="titleLarge" style={[styles.title, { color: tokens.colors.text }]}>
            {resolvedTitle}
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: tokens.colors.muted }]}>
            {resolvedSubtitle}
          </Text>

          {shouldShowBenefits ? (
            <View style={styles.benefits}>
              {resolvedBenefits.map((item) => (
                <View key={item} style={styles.benefitRow}>
                  <View style={[styles.checkIcon, { backgroundColor: tokens.colors.accentPurple }]}>
                    <MaterialIcons name="check" size={16} color="#FFFFFF" />
                  </View>
                  <Text variant="bodyLarge" style={{ color: tokens.colors.text }}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {renderPrimaryCta()}

          <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondary}>
            <Text variant="bodyLarge" style={{ color: tokens.colors.accent }}>
              {resolvedSecondaryLabel}
            </Text>
          </Pressable>
        </Animated.View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: "center",
  },
  content: {
    padding: 24,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  iconInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  title: {
    textAlign: "center",
    fontWeight: "700",
  },
  subtitle: {
    textAlign: "center",
  },
  benefits: {
    width: "100%",
    gap: 10,
    marginTop: 4,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  gradientButton: {
    width: "100%",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  fallbackButton: {
    width: "100%",
    borderRadius: 999,
  },
  ctaText: {
    fontWeight: "700",
    fontSize: 16,
  },
  secondary: {
    paddingVertical: 6,
  },
});
