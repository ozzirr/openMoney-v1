import { Linking, Platform } from "react-native";
import i18n from "i18next";

export const PRO_WAITLIST_URL = "https://YOUR_DOMAIN/pro-waitlist";

function resolveLocaleParam(): "it" | "en" {
  const language = i18n.resolvedLanguage ?? i18n.language ?? "it";
  const normalized = String(language).toLowerCase();
  return normalized.startsWith("en") ? "en" : "it";
}

function buildProWaitlistUrl(): string {
  const locale = resolveLocaleParam();
  const params = [
    "src=app",
    "screen=wallet_limit",
    "variant=free",
    `platform=${Platform.OS}`,
    `locale=${locale}`,
  ].join("&");
  return `${PRO_WAITLIST_URL}?${params}`;
}

export async function openProWaitlistLink(): Promise<void> {
  const url = buildProWaitlistUrl();
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error("Unsupported waitlist URL");
  }
  await Linking.openURL(url);
}
