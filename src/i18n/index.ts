import { initReactI18next } from "react-i18next";
import i18n from "i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

import it from "./locales/it.json";
import en from "./locales/en.json";

export const STORAGE_KEY = "appLanguage";
export const SUPPORTED_LANGUAGES = ["it", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const RESOURCES = {
  it: { translation: it },
  en: { translation: en },
};

let initPromise: Promise<void> | null = null;

function resolveSupportedLanguage(language?: string | null): SupportedLanguage {
  if (!language) {
    return "it";
  }
  const normalized = language.toLowerCase();
  if (normalized.startsWith("en")) {
    return "en";
  }
  return "it";
}

async function loadInitialLanguage(): Promise<SupportedLanguage> {
  const savedLanguage = await AsyncStorage.getItem(STORAGE_KEY);
  if (savedLanguage && SUPPORTED_LANGUAGES.includes(savedLanguage as SupportedLanguage)) {
    return savedLanguage as SupportedLanguage;
  }
  return resolveSupportedLanguage(Localization.locale);
}

export function initI18n(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }
  initPromise = (async () => {
    const finalLanguage = await loadInitialLanguage();
    if (!i18n.isInitialized) {
      await i18n.use(initReactI18next).init({
        resources: RESOURCES,
        lng: finalLanguage,
        fallbackLng: "it",
        supportedLngs: [...SUPPORTED_LANGUAGES],
        debug: false,
        interpolation: {
          escapeValue: false,
        },
        returnNull: false,
        saveMissing: false,
        missingKeyHandler: __DEV__
          ? (lng, ns, key) => {
              // eslint-disable-next-line no-console
              console.warn(`[i18n] Missing key: ${lng}.${ns}.${key}`);
            }
          : undefined,
      });
    }
  })();
  return initPromise;
}
