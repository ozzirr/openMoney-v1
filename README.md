# Balance

<p align="center">
  <img src="assets/icon.png" width="96" alt="Balance app icon" />
</p>

**Balance** è un’app di finanza personale offline‑first costruita con React Native ed Expo.  
Tutti i dati restano sul dispositivo: niente cloud, niente account, niente tracking.

## Punti chiave
- **Offline‑first**: dati locali, sempre disponibili.
- **Privacy**: nessun server, nessun profilo, nessun tracciamento.
- **Snapshot & KPI**: andamento patrimonio nel tempo.
- **Cash Flow**: panoramica di entrate/uscite ricorrenti.
- **Categorie**: spese per categoria e filtri rapidi.
- **Multi‑lingua**: IT/EN/PT.

## Anteprima
<p align="center">
  <img src="assets/onboarding/onboarding-1.png" width="220" alt="Onboarding 1" />
  <img src="assets/onboarding/onboarding-2.png" width="220" alt="Onboarding 2" />
  <img src="assets/onboarding/onboarding-3.png" width="220" alt="Onboarding 3" />
</p>

## Funzionalita principali
- **Wallet multipli** con colori e valuta.
- **Entrate/Uscite** ricorrenti con cadenza.
- **Snapshot mensili** per misurare il patrimonio.
- **Grafici** per andamento e distribuzione.
- **Export/Import** dati in JSON.

## Avvio rapido
```bash
npm install
npm run start
```

Comandi utili:
- iOS: `npm run ios`
- Android: `npm run android`
- Web: `npm run web`

## Struttura progetto
- `src/app` → entrypoint navigazione
- `src/ui` → UI e componenti
- `src/db` → storage locale (SQLite)
- `src/i18n` → traduzioni
- `docs` → note di progetto

## Localizzazione
Le traduzioni vivono in `src/i18n/locales/{it,en,pt}.json`.  
Quando aggiungi una nuova stringa, aggiorna **tutti** i file lingua.

## Contributing
Guida rapida in `CONTRIBUTING.md`.

## Licenza
Questo progetto e rilasciato con **AGPL-3.0-only**.  
Vedi `LICENSE`.

**Nota branding**: nome, logo e asset “Balance” non sono concessi in licenza senza permesso.

---

# Balance (English)

<p align="center">
  <img src="assets/icon.png" width="96" alt="Balance app icon" />
</p>

**Balance** is an offline-first personal finance app built with React Native and Expo.  
All data stays on-device: no cloud, no accounts, no tracking.

## Highlights
- **Offline-first**: local data, always available.
- **Privacy**: no servers, no profiles, no tracking.
- **Snapshots & KPIs**: net worth over time.
- **Cash Flow**: recurring income/expense overview.
- **Categories**: spending by category and quick filters.
- **Multi-language**: IT/EN/PT.

## Preview
<p align="center">
  <img src="assets/onboarding/onboarding-1.png" width="220" alt="Onboarding 1" />
  <img src="assets/onboarding/onboarding-2.png" width="220" alt="Onboarding 2" />
  <img src="assets/onboarding/onboarding-3.png" width="220" alt="Onboarding 3" />
</p>

## Core features
- **Multiple wallets** with colors and currency.
- **Recurring entries** for income/expenses.
- **Monthly snapshots** to track net worth.
- **Charts** for trends and distribution.
- **Data export/import** in JSON.

## Quick start
```bash
npm install
npm run start
```

Useful commands:
- iOS: `npm run ios`
- Android: `npm run android`
- Web: `npm run web`

## Project structure
- `src/app` → navigation entrypoint
- `src/ui` → UI and components
- `src/db` → local storage (SQLite)
- `src/i18n` → translations
- `docs` → project notes

## Localization
Translations live in `src/i18n/locales/{it,en,pt}.json`.  
When adding new copy, update **all** locale files.

## Contributing
See `CONTRIBUTING.md`.

## License
This project is licensed under **AGPL-3.0-only**.  
See `LICENSE`.

**Branding note**: the Balance name, logo, and brand assets are not licensed for reuse without permission.
