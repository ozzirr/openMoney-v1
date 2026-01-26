import * as LocalAuthentication from "expo-local-authentication";

let authenticateCallCount = 0;

export type BiometryHardwareInfo = {
  hasHardware: boolean;
  hasEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
};

export async function getBiometryHardwareInfo(): Promise<BiometryHardwareInfo> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const hasEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return {
      hasHardware,
      hasEnrolled,
      supportedTypes,
    };
  } catch (error) {
    console.warn("[FaceID] Hardware check error", error);
    return {
      hasHardware: false,
      hasEnrolled: false,
      supportedTypes: [],
    };
  }
}

export async function isBiometryAvailable(): Promise<boolean> {
  try {
    const info = await getBiometryHardwareInfo();
    return info.hasHardware && info.hasEnrolled;
  } catch {
    return false;
  }
}

export async function authenticateForUnlock(): Promise<{ success: boolean; error?: string }> {
  authenticateCallCount += 1;
  const callId = authenticateCallCount;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Sblocca Balance",
      cancelLabel: "Annulla",
      disableDeviceFallback: true,
      fallbackLabel: "",
    });
    if (result.success) {
      return { success: true };
    }
    return { success: false, error: result.errorCode ?? "authentication_failed" };
  } catch (error) {
    console.warn(`[FaceID] authenticateAsync call #${callId} -> exception`, error);
    return { success: false, error: (error as Error).message ?? "authentication_error" };
  }
}
