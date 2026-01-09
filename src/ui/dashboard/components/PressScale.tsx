import React from "react";
import { Pressable, StyleSheet } from "react-native";
import type { PressableProps, ViewStyle, StyleProp } from "react-native";

type Props = PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function PressScale({ children, style, ...props }: Props): JSX.Element {
  return (
    <Pressable {...props} style={({ pressed }) => [style, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
