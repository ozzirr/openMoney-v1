# Balance App / iOS Android

Balance is an open-source, offline-first personal finance app built with React Native and Expo. It keeps every wallet, transaction, and insight on your device while still offering a polished native experience.

## Quick start

```bash
git clone xxx
cd balance-app-v1
npm ci
npx expo start
```

- Scan the QR code with Expo Go (iOS/Android) to preview.
- Run `APP_VARIANT=free|pro npm run <script>` to target each variant with the proper limits.

## Contribution

1. Fork the repo and create a branch from `main`.
2. Make your change and include tests if needed.
3. Open a PR with a concise summary.

We care about clean TypeScript, privacy, and offline readiness. Thanks for improving Balance!

## Localization (it/en)

Balance uses `i18next` with `react-i18next` and loads the locales defined in `src/i18n/locales/{it,en}.json`. The initializer in `src/i18n/index.ts` reads the saved language (`settings.language`), falls back to the device locale, and exposes `t()` via `useTranslation()`.

To add a new key, add it to both locale files and reference `t("namespace.key")` in the UI. To support another language, extend `SUPPORTED_LANGUAGES`, add the JSON resource, and ensure `initI18n` can resolve the new locale.
