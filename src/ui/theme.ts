import React from "react";

export type ThemeMode = "light" | "dark" | "system";

export const ThemeContext = React.createContext<{
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}>({
  mode: "light",
  setMode: () => {},
});
