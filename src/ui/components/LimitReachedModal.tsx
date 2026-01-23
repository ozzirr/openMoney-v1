import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Modal, Portal, Text, Button } from "react-native-paper";
import { BlurView } from "expo-blur";
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
};

const LinearGradient: React.ComponentType<any> | undefined = undefined;

export default function LimitReachedModal({
  visible,
  onClose,
  onUpgrade,
  title,
  subtitle,
  benefits,
}: Props): JSX.Element {
  const { tokens, shadows } = useDashboardTheme();
  const { t } = useTranslation();

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  const resolvedTitle = title ?? t("wallets.actions.limitModalTitle");
  const resolvedSubtitle = subtitle ?? t("wallets.actions.limitModalSubtitle");
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
    const label = t("wallets.actions.limitUpgradeCta");
    if (LinearGradient) {
      const Gradient = LinearGradient;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onUpgrade}
          style={{ width: "100%" }}
        >
          <Gradient
            colors={[tokens.colors.accentPurple, tokens.colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientButton}
          >
            <Text style={[styles.ctaText, { color: "#FFFFFF" }]}>{label}</Text>
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
        {label}
      </Button>
    );
  };

  const overlayTint = `${tokens.colors.accentPurple}22`;

  return (
    <Portal>
      {visible ? (
        <BlurView
          pointerEvents="none"
          intensity={40}
          tint={tokens.colors.bg === "#0A0C11" ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Modal
        visible={visible}
        onDismiss={onClose}
        dismissable
        style={styles.modal}
        contentContainerStyle={styles.content}
        theme={{ colors: { backdrop: "rgba(8,12,24,0.55)" } }}
      >
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: tokens.colors.modalGlassBg,
              borderColor: tokens.colors.modalBorder,
              opacity,
              transform: [{ scale }],
              ...shadows.card,
            },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: overlayTint }]}>
            <View style={[styles.iconInner, { backgroundColor: tokens.colors.modalBorder }]}>
              <MaterialCommunityIcons name="wallet-outline" size={32} color={tokens.colors.accent} />
            </View>
          </View>
          <Text variant="titleLarge" style={[styles.title, { color: tokens.colors.text }]}>
            {resolvedTitle}
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: tokens.colors.muted }]}>
            {resolvedSubtitle}
          </Text>

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

          {renderPrimaryCta()}

          <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondary}>
            <Text variant="bodyLarge" style={{ color: tokens.colors.accent }}>
              {t("wallets.actions.limitMaybeLater")}
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
