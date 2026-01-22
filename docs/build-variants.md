# Build Variants

OpenMoney ships in two EAS build variants that share source but differ in bundle identifiers and runtime limits.

| Variant | APP_VARIANT env | Bundle ID / Package | Limits |
| --- | --- | --- | --- |
| Free | `free` | `com.ozzirr.openmoney` / `com.ozzirr.openmoney` | Liquidity wallets: 2 · Investment wallets: 1 |
| Pro | `pro` | `com.ozzirr.openmoneypro` / `com.ozzirr.openmoneypro` | Unlimited |

Run the following to build each variant:

- `eas build -p ios --profile free`
- `eas build -p ios --profile pro`
- `eas build -p android --profile free`
- `eas build -p android --profile pro`
