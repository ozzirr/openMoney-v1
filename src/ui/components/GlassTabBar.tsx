import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, useTheme } from "react-native-paper";

const ICONS: Record<string, string> = {
  Dashboard: "view-dashboard",
  Snapshot: "calendar-text",
  "Entrate/Uscite": "cash-multiple",
  Impostazioni: "cog",
};

export default function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps): JSX.Element {
  const theme = useTheme();
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <BlurView intensity={35} tint="dark" style={[styles.bar, { borderColor: theme.colors.outline }]}>
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label = options.tabBarLabel ?? options.title ?? route.name;
            const isFocused = state.index === index;
            const onPress = () => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const icon = ICONS[route.name] ?? "circle-outline";

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={[styles.item, isFocused && styles.itemActive]}
              >
                <MaterialCommunityIcons
                  name={icon}
                  size={22}
                  color={isFocused ? theme.colors.primary : theme.colors.onSurface}
                />
                <Text
                  variant="labelSmall"
                  style={{ color: isFocused ? theme.colors.primary : theme.colors.onSurface }}
                >
                  {String(label)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: "center",
  },
  bar: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 6,
    marginHorizontal: 20,
    maxWidth: 360,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    gap: 2,
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 22,
    minWidth: 56,
  },
  itemActive: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
});
