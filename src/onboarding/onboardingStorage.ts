import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@openmoney/onboardingCompleted";
const NAME_KEY = "@openmoney/displayName";
const HAS_INVESTMENTS_KEY = "@openmoney/hasInvestments";
const INITIAL_SEED_KEY = "@openmoney/initialSeedDone";

export async function getOnboardingCompleted(): Promise<boolean> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  return value === "true";
}

export async function setOnboardingCompleted(value: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, value ? "true" : "false");
}

export async function getDisplayName(): Promise<string> {
  return (await AsyncStorage.getItem(NAME_KEY)) ?? "";
}

export async function setDisplayName(value: string): Promise<void> {
  await AsyncStorage.setItem(NAME_KEY, value.trim());
}

export async function getHasInvestments(): Promise<boolean> {
  const value = await AsyncStorage.getItem(HAS_INVESTMENTS_KEY);
  return value === "true";
}

export async function setHasInvestments(value: boolean): Promise<void> {
  await AsyncStorage.setItem(HAS_INVESTMENTS_KEY, value ? "true" : "false");
}

export async function getInitialSeedDone(): Promise<boolean> {
  const value = await AsyncStorage.getItem(INITIAL_SEED_KEY);
  return value === "true";
}

export async function setInitialSeedDone(value: boolean): Promise<void> {
  await AsyncStorage.setItem(INITIAL_SEED_KEY, value ? "true" : "false");
}
