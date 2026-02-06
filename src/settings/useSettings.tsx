import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getPreference, setPreference } from "@/repositories/preferencesRepo";

const SHOW_INVESTMENTS_KEY = "settings.showInvestments";
const DEFAULT_SHOW_INVESTMENTS = true;
const SCROLL_BOUNCE_KEY = "settings.scrollBounce";
const DEFAULT_SCROLL_BOUNCE = false;

type SettingsContextValue = {
  showInvestments: boolean;
  setShowInvestments: (next: boolean) => Promise<void>;
  scrollBounceEnabled: boolean;
  setScrollBounceEnabled: (next: boolean) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

type SettingsProviderProps = {
  children: React.ReactNode;
};

export function SettingsProvider({ children }: SettingsProviderProps): JSX.Element {
  const [showInvestments, setShowInvestmentsState] = useState(DEFAULT_SHOW_INVESTMENTS);
  const [scrollBounceEnabled, setScrollBounceEnabledState] = useState(DEFAULT_SCROLL_BOUNCE);

  useEffect(() => {
    let active = true;
    (async () => {
      const [investmentsPref, bouncePref] = await Promise.all([
        getPreference(SHOW_INVESTMENTS_KEY),
        getPreference(SCROLL_BOUNCE_KEY),
      ]);
      if (!active) return;
      const investmentsValue = investmentsPref ? investmentsPref.value === "true" : DEFAULT_SHOW_INVESTMENTS;
      const bounceValue = bouncePref ? bouncePref.value === "true" : DEFAULT_SCROLL_BOUNCE;
      setShowInvestmentsState(investmentsValue);
      setScrollBounceEnabledState(bounceValue);
    })();
    return () => {
      active = false;
    };
  }, []);

  const setShowInvestments = useCallback(async (next: boolean) => {
    await setPreference(SHOW_INVESTMENTS_KEY, next ? "true" : "false");
    setShowInvestmentsState(next);
  }, []);

  const setScrollBounceEnabled = useCallback(async (next: boolean) => {
    await setPreference(SCROLL_BOUNCE_KEY, next ? "true" : "false");
    setScrollBounceEnabledState(next);
  }, []);

  return (
    <SettingsContext.Provider
      value={{ showInvestments, setShowInvestments, scrollBounceEnabled, setScrollBounceEnabled }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
