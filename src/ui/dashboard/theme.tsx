import React from "react";
import { createDashboardTokens, dashboardShadows } from "@/ui/dashboard/tokens";
import type { DashboardTokens } from "@/ui/dashboard/tokens";

type DashboardTheme = {
  tokens: DashboardTokens;
  shadows: typeof dashboardShadows;
  isDark: boolean;
};

const DashboardThemeContext = React.createContext<DashboardTheme>({
  tokens: createDashboardTokens(true),
  shadows: dashboardShadows,
  isDark: true,
});

export function DashboardThemeProvider({
  isDark,
  children,
}: {
  isDark: boolean;
  children: React.ReactNode;
}): JSX.Element {
  const tokens = createDashboardTokens(isDark);
  return (
    <DashboardThemeContext.Provider
      value={{
        tokens,
        shadows: dashboardShadows,
        isDark,
      }}
    >
      {children}
    </DashboardThemeContext.Provider>
  );
}

export function useDashboardTheme(): DashboardTheme {
  return React.useContext(DashboardThemeContext);
}
