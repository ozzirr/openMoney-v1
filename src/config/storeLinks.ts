import { Linking, Platform } from "react-native";

const IOS_PRO_STORE_URL = "https://apps.apple.com/app/openmoney-pro/idTODO"; // TODO: replace with actual App Store URL
const ANDROID_PRO_STORE_URL = "https://play.google.com/store/apps/details?id=com.ozzirr.openmoneypro"; // TODO: replace with actual Play Store URL

const PRO_STORE_LINKS = {
  ios: IOS_PRO_STORE_URL,
  android: ANDROID_PRO_STORE_URL,
};

export async function openProStoreLink(): Promise<void> {
  const url = Platform.OS === "android" ? PRO_STORE_LINKS.android : PRO_STORE_LINKS.ios;
  if (!url) {
    throw new Error("Store link missing");
  }

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error("Unsupported store URL");
  }

  await Linking.openURL(url);
}
