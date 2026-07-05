# Nutrition Planner

A privacy-first **desktop nutrition tracker** (Windows / macOS / Linux) built with
Electron, React, TypeScript, and a local SQLite database of ~2M USDA & branded
foods. Track food, macros, and 35 micronutrients against personalized targets;
log exercise, weight, and water; plan meals; and get AI coaching — all stored
locally on your machine.

> Tracking tool only — not medical advice.

## Features

- **Food logging** with FTS5 search across ~2M USDA + branded foods, barcode
  lookup, custom foods, saved meals/recipes, meal sections, and copy-day.
- **Personalized targets** — Mifflin-St Jeor TDEE with diet-aware macro splits
  (keto, low-carb, high-protein, low-fat…), custom goals, or fully manual targets.
- **Dashboard** — calorie ring, macros, top nutrient gaps, water, weight, streak.
- **Progress** — weight/calorie/macro/water trend charts, goal projection,
  achievements, and an AI weekly review.
- **Exercise** — log activities (MET-based calorie estimates) that feed your
  calorie budget.
- **Planner** — week view + AI day-plan that respects your diet and allergens.
- **AI coaching** across 10 providers (Anthropic, OpenAI, Groq, Gemini, Ollama…),
  context-aware of your profile, diet, restrictions, log, and activity.
- **Local-first & private** — no accounts, no telemetry; API keys encrypted via
  `safeStorage`; daily local backups; data export (CSV/JSON).
- **Reminders** — optional desktop notifications for meals and water.

## Quick start (development)

Requirements: **Node.js 22**.

```bash
npm install
npm run dev
```

> **Native module note:** `better-sqlite3` is a native addon and must match the
> runtime's ABI. `npm install` rebuilds it for Electron automatically
> (`postinstall`). If you run the Node scripts in `scripts/` directly, rebuild for
> Node first (`npm rebuild better-sqlite3`), then back to Electron
> (`npx @electron/rebuild -f -w better-sqlite3`) before `npm run dev`.
> Current Electron is 41 (NODE_MODULE_VERSION 145).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Run the app in development |
| `npm run typecheck` | TypeScript checks (main + renderer) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests (macros, units, nutrient/progress math) |
| `npm run build` | Build main/preload/renderer bundles |
| `npm run build:win` | Rebuild native deps + build + package a Windows installer |
| `npm run db:*` | Download / import / verify the USDA database (build-time) |

## AI configuration

Each user can add their own provider API key in **Settings** (encrypted locally).
Optionally, you can ship a developer-embedded key so AI works out of the box:

1. Put your Anthropic key in a local `.env` (gitignored, never committed):
   ```
   BUILTIN_ANTHROPIC_API_KEY=sk-ant-...
   ```
2. It is compiled into the **main process bundle only** (never the renderer) at
   build time. Traffic against it is soft-rate-limited per install
   (`src/main/constants/ai-limits.ts`). Leave the variable empty for dev builds.

## Data & privacy

All data is stored locally (SQLite in the OS user-data folder). The only data that
leaves the device is what you send to your chosen AI provider when using AI
features. See [PRIVACY.md](PRIVACY.md).

## Attributions

Food data from **USDA FoodData Central** (public domain) and **Open Food Facts**
(ODbL — attribution + share-alike). See [NOTICES.md](NOTICES.md). **If you
redistribute the bundled database commercially, review the ODbL obligations.**

## Releasing

Auto-update and code-signing are **pre-wired but inert** until you supply
credentials.

1. **Set the publish target.** In `electron-builder.yml` (and `dev-app-update.yml`),
   replace `[GITHUB_OWNER]` / `[GITHUB_REPO]` with your GitHub repo.
2. **Code-sign (recommended).** Provide a certificate via environment variables at
   build time so installers aren't flagged by SmartScreen/Gatekeeper:
   - Windows: `CSC_LINK` (path/base64 of your `.pfx`) + `CSC_KEY_PASSWORD`
   - macOS: `CSC_LINK` + `CSC_KEY_PASSWORD` (Developer ID); to notarize, set
     `notarize: true` in `electron-builder.yml` and `APPLE_ID` /
     `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`.
3. **Publish a release.** Bump `version` in `package.json`, then:
   ```bash
   set GH_TOKEN=...        # a token with repo release scope
   npm run build:win -- --publish always
   ```
   electron-builder uploads the installer + update metadata to a GitHub Release.
4. **Updates apply automatically** in packaged builds: the app checks on launch,
   downloads in the background, and shows a "Restart & install" prompt
   (Settings → About also has a manual "Check for updates").

Without a certificate, builds still work but are **unsigned** (users see a
publisher warning). Without a publish feed, the updater is simply inert.

## License

See [LICENSE](LICENSE) — currently a **placeholder**; choose and finalize your
terms (and fill in copyright holder) before distributing.
