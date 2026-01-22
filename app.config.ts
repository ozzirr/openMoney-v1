import type { ConfigContext, ExpoConfig } from "@expo/config";

type AppVariant = "free" | "pro";

type VariantLimits = {
  liquidityWallets: number | null;
  investmentWallets: number | null;
};

const APP_VARIANT: AppVariant = process.env.APP_VARIANT === "pro" ? "pro" : "free";

const VARIANT_LIMITS: Record<AppVariant, VariantLimits> = {
  free: {
    liquidityWallets: 2,
    investmentWallets: 1,
  },
  pro: {
    liquidityWallets: null,
    investmentWallets: null,
  },
};

const VARIANT_CONFIG: Record<AppVariant, {
  name: string;
  slug: string;
  scheme: string;
  iosBundleIdentifier: string;
  androidPackage: string;
}> = {
  free: {
    name: "OpenMoney",
    slug: "openmoney",
    scheme: "openmoney",
    iosBundleIdentifier: "com.ozzirr.openmoney",
    androidPackage: "com.ozzirr.openmoney",
  },
  pro: {
    name: "OpenMoney Pro",
    slug: "openmoney-pro",
    scheme: "openmoneypro",
    iosBundleIdentifier: "com.ozzirr.openmoneypro",
    androidPackage: "com.ozzirr.openmoneypro",
  },
};

const BASE_PLUGINS = ["expo-sqlite", "@react-native-community/datetimepicker"];

const FACE_ID_USAGE_DESCRIPTION = "Usiamo Face ID per proteggere l'accesso a OpenMoney.";

export default function ({ config }: ConfigContext): ExpoConfig {
  const variant = VARIANT_CONFIG[APP_VARIANT];
  const mergedPlugins = Array.from(new Set([...(config.plugins ?? []), ...BASE_PLUGINS]));
  const variantLimits = VARIANT_LIMITS[APP_VARIANT];
  const iosConfig = config.ios ?? {};
  const { infoPlist: iosInfoPlist = {}, ...iosRest } = iosConfig;
  const iosInfoPlistRest = { ...iosInfoPlist };
  delete iosInfoPlistRest.NSFaceIDUsageDescription;

  return {
    ...config,
    name: variant.name,
    slug: variant.slug,
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    scheme: variant.scheme,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0B0E1A",
    },
    ios: {
      ...iosRest,
      supportsTablet: true,
      bundleIdentifier: variant.iosBundleIdentifier,
      buildNumber: "1",
      infoPlist: {
        ...iosInfoPlistRest,
        NSFaceIDUsageDescription: FACE_ID_USAGE_DESCRIPTION,
      },
    },
    android: {
      ...(config.android ?? {}),
      package: variant.androidPackage,
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      ...(config.web ?? {}),
      favicon: "./assets/favicon.png",
    },
    plugins: mergedPlugins,
    extra: {
      ...(config.extra ?? {}),
      appVariant: APP_VARIANT,
      limits: {
        liquidityWallets: variantLimits.liquidityWallets,
        investmentWallets: variantLimits.investmentWallets,
      },
      eas: {
        ...(config.extra?.eas ?? {}),
        projectId: "0627a453-652a-412b-abcc-dd3938dfe879",
      },
    },
  };
}
