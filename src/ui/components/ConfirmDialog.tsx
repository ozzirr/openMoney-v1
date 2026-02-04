import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { Button, Modal, Portal, Text } from "react-native-paper";
import GlassBlur from "@/ui/components/GlassBlur";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
  confirmColor?: string;
};

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  loading = false,
  error,
  confirmColor,
}: Props): JSX.Element {
  const { tokens, shadows, isDark } = useDashboardTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
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
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.96, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, visible]);

  const overlayTint = isDark ? "rgba(0,0,0,0.92)" : "rgba(0,0,0,0.8)";
  const blurTint = isDark ? "dark" : "light";
  const blurIntensity = 35;
  const cardBackground =
    Platform.OS === "android"
      ? tokens.colors.surface2
      : isDark
      ? "rgba(15, 18, 30, 0.78)"
      : "rgba(169, 124, 255, 0.5)";
  const cardBorder =
    Platform.OS === "android" ? tokens.colors.border : isDark ? "rgba(255,255,255,0.12)" : "rgba(169, 124, 255, 0.5)";

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={loading ? undefined : onCancel}
        dismissable={!loading}
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
          <Text variant="titleMedium" style={[styles.title, { color: tokens.colors.text }]}>
            {title}
          </Text>
          <Text variant="bodyMedium" style={[styles.message, { color: tokens.colors.muted }]}>
            {message}
          </Text>
          {error ? <Text style={[styles.error, { color: tokens.colors.expense }]}>{error}</Text> : null}
          <View style={styles.actions}>
            <Button
              mode="outlined"
              textColor={tokens.colors.text}
              onPress={onCancel}
              disabled={loading}
              style={[styles.actionButton, styles.actionSecondary]}
              contentStyle={styles.actionContent}
            >
              {cancelLabel}
            </Button>
            <Button
              mode="contained"
              buttonColor={confirmColor ?? tokens.colors.expense}
              textColor="#0B0B0B"
              onPress={onConfirm}
              loading={loading}
              disabled={loading}
              style={[styles.actionButton, styles.actionPrimary]}
              contentStyle={styles.actionContent}
            >
              {confirmLabel}
            </Button>
          </View>
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
    alignSelf: "center",
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    gap: 16,
    alignItems: "center",
    overflow: "hidden",
  },
  title: {
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    textAlign: "center",
  },
  error: {
    textAlign: "center",
    fontSize: 12,
  },
  actions: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  actionButton: {
    flex: 1,
    borderRadius: 999,
    overflow: "hidden",
  },
  actionPrimary: {
    borderRadius: 999,
  },
  actionSecondary: {
    borderRadius: 999,
  },
  actionContent: {
    paddingVertical: 10,
  },
});
