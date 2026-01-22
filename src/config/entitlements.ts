import Constants from "expo-constants";

type AppVariant = "free" | "pro";

type VariantLimits = {
  liquidityWallets: number | null;
  investmentWallets: number | null;
};

type LimitValue = number | null;
type LimitKey = keyof VariantLimits;

const FALLBACK_LIMITS: VariantLimits = {
  liquidityWallets: 2,
  investmentWallets: 1,
};

const configExtra = Constants.expoConfig?.extra;

const resolvedVariant: AppVariant = configExtra?.appVariant === "pro" ? "pro" : "free";

const configExtraLimits = (configExtra?.limits ?? {}) as Partial<Record<LimitKey, unknown>>;

const isLimitValue = (value: unknown): value is LimitValue => typeof value === "number" || value === null;

const isEmptyObject = (value: unknown): value is Record<string, never> =>
  typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;

const resolveLimit = (value: unknown, fallback: LimitValue): LimitValue => {
  if (isLimitValue(value)) return value;
  if (resolvedVariant === "pro" && isEmptyObject(value)) return null;
  return fallback;
};

export const APP_VARIANT: AppVariant = resolvedVariant;

export const LIMITS: VariantLimits = {
  liquidityWallets: resolveLimit(configExtraLimits.liquidityWallets, FALLBACK_LIMITS.liquidityWallets),
  investmentWallets: resolveLimit(
    configExtraLimits.investmentWallets,
    FALLBACK_LIMITS.investmentWallets
  ),
};
