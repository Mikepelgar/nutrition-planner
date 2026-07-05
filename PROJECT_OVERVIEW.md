# Nutrition Planner — Project Overview

A privacy-first **desktop nutrition tracking application** for Windows, macOS, and
Linux. Log daily food intake (meals, custom foods, recipes, barcode scans), track
macros and 35 micronutrients against personalized targets, log exercise, weight, and
water, view trend charts and goal projections, plan meals, and get context-aware AI
coaching from any of 10 major providers — with **everything stored locally on the
user's own machine**.

> ⚠️ **Tracking tool only — not medical advice.**

---

## 1. Goal & Philosophy

Most nutrition apps require an account, run in the cloud, monetize user data, and gate
useful features behind subscriptions. Nutrition Planner is the opposite:

- **Local-first.** All data lives in a SQLite database in the OS user-data folder.
  There are no accounts, no servers, and no telemetry.
- **Private by default.** The only data that ever leaves the device is what the user
  explicitly sends to their chosen AI provider when using AI features. API keys are
  encrypted at rest via the OS keychain (`safeStorage`).
- **Complete out of the box.** It ships with ~2 million foods (USDA + branded) so
  search works offline with no external API calls for core tracking.
- **Bring-your-own-AI.** Users can plug in their own key from any of 10 providers, or
  use an optional developer-embedded key that works with zero setup (soft
  rate-limited per install).
- **Personalized.** Targets are derived from the user's body metrics, activity level,
  goal, and diet — or set manually — and the AI is briefed with the *same* numbers the
  UI shows, so guidance is always consistent.

The intended user is anyone who wants serious, data-rich nutrition tracking without
handing their health data to a cloud service.

---

## 2. Feature Catalog

### Food logging
- **Full-text search** over ~2M USDA + branded foods using SQLite **FTS5** (two
  parallel prefix queries — whole foods and branded — merged and ranked by
  popularity), with OR and LIKE fallbacks.
- **Barcode lookup** — enter a UPC/GTIN to resolve a branded food directly.
- **Custom foods** — user-defined foods stored with a negative `fdc_id`, auto-indexed
  into FTS so they appear in normal search.
- **Saved meals / recipes** — snapshot a day's meal section as a reusable recipe and
  log it back in one action.
- **Meal sections** — every entry is tagged Breakfast / Lunch / Dinner / Snacks, with
  per-meal calorie subtotals; the active meal defaults by time of day.
- **Copy day / copy meal** — duplicate a previous day's log (or a single meal) onto
  another date.
- **Smart serving units** — sensible default portions per food type (egg → 50 g,
  liquids → 1 cup, proteins → 4 oz, branded → label serving, else 100 g) with unit
  conversion to grams.

### Targets & macros
- **Mifflin-St Jeor BMR × activity multiplier → TDEE.**
- **Goal-aware calories** — maintain/recomp = TDEE, bulk = +surplus, cut = −deficit
  (floor 1200 kcal).
- **Diet-aware macro splits** — keto, low-carb, high-protein, low-fat, paleo,
  Mediterranean, vegetarian, vegan, balanced. Protein targets scale by goal and diet.
- **Custom / manual targets** — override the formula with explicit calorie + macro
  numbers.
- A single pure module (`src/shared/macros.ts`) computes all of this and is shared by
  both the UI and the AI prompt builder, so they can never diverge.

### Dashboard, History & Progress
- **Dashboard** — calorie ring (remaining = target + exercise − food), macro bars, top
  3 nutrient gaps, water quick-add, weight log with goal note, logging streak, and
  quick-action buttons.
- **History** — Daily / Weekly / Monthly / Yearly views with expandable per-nutrient
  breakdowns.
- **Progress** — SVG line/bar trend charts for weight, calories-vs-target, protein, and
  water over 30/90/365 days; goal-weight projection with ETA; achievements and streaks;
  and an **AI weekly review** (7-day summary).

### Exercise & Planner
- **Exercise** — log workouts with MET-based calorie estimates that feed back into the
  daily calorie budget.
- **Planner** — a 7-day week strip (tap a day to log for that date) plus an **AI
  "plan my day"** that respects the user's diet and allergens (text suggestions).

### Tracking & data
- **Weight and water** logging with historical ranges.
- **Reminders** — optional desktop notifications for meals and water on a configurable
  schedule.
- **Data export** to CSV / JSON.
- **Daily automatic backup** of user data (profile, food log, weight, water,
  favorites, settings), keeping the last 7 days.

### AI coaching
- **10 providers** — Anthropic, OpenAI, Groq, DeepSeek, Mistral, Gemini, xAI,
  Perplexity, Together, and local Ollama.
- **Context-aware** — the AI is briefed with the user's profile, goal semantics, diet
  and its macro rationale, daily targets, today's food log, calories burned via
  exercise, nutrient gaps, nutrients over safe limits, and hard restrictions
  (allergens + avoid-foods).
- **Streaming responses**, plus specialized flows for the weekly review and full-day
  meal plan.

---

## 3. Data Sources

| Source | Contents | Size | Vintage | License |
|---|---|---|---|---|
| **USDA SR Legacy** | Whole foods | ~7,800 | 2019 | Public domain |
| **USDA Foundation** | Whole foods | ~1,000 | 2024 | Public domain |
| **USDA Branded** | Packaged/branded foods | ~2,000,000 | 2025 | Public domain |
| **Open Food Facts** | Branded popularity (`unique_scans_n` via GTIN) | — | — | **ODbL** (attribution + share-alike) |

- **Branded popularity** is scored from Open Food Facts scan counts, matched by GTIN.
- **USDA popularity** uses keyword tiers (800 foundation → 700 primary cuts → 600
  secondary → 300 neutral → 50 niche) so common whole foods rank above obscure ones.

> ⚠️ **ODbL note:** the Open Food Facts data carries share-alike obligations. Review
> them before redistributing the bundled database commercially.

---

## 4. Tech Stack & Libraries

### Runtime dependencies
| Library | Version | Role |
|---|---|---|
| **electron** | ^41.7.2 | Desktop shell (Chromium + Node). Pinned to 41 — see ABI note below. |
| **react** / **react-dom** | ^18.3.1 | Renderer UI framework |
| **typescript** | ^5.7.3 | Language across main + renderer |
| **better-sqlite3** | ^12.10.0 | Synchronous embedded SQLite (native addon) + FTS5 search |
| **zustand** | ^5.0.3 | Lightweight renderer state management |
| **@anthropic-ai/sdk** | ^0.52.0 | Anthropic AI provider |
| **openai** | ^6.42.0 | All non-Anthropic providers (via base-URL overrides) |
| **lucide-react** | ^0.469.0 | Icon set |
| **electron-log** | ^5.4.4 | Main-process file logging + crash capture |
| **electron-updater** | ^6.8.9 | Auto-update (inert until publish creds set) |
| **@electron-toolkit/preload**, **@electron-toolkit/utils** | ^3 / ^4 | Preload + main helpers |
| **tailwindcss** | ^3.4.17 | Utility-first styling (dev-time, compiled) |

### Development & tooling
| Library | Version | Role |
|---|---|---|
| **electron-vite** | ^3.0.0 | Build tooling / dev server (react-ts scaffold) |
| **vite** | ^6.3.5 | Underlying bundler |
| **electron-builder** | ^26.15.2 | Packaging (NSIS / dmg / AppImage / deb) |
| **@electron/rebuild** | (via npx) | Rebuild native modules for the Electron ABI |
| **eslint** + **typescript-eslint** + **eslint-plugin-react-hooks** | ^9 / ^8 / ^5 | Linting (flat config) |
| **prettier** | ^3.8.4 | Formatting |
| **vitest** | ^2.1.9 | Unit tests for pure logic |
| **csv-parse** | ^5.5.6 | Parse USDA CSVs during import |
| **adm-zip** | ^0.5.16 | Unpack downloaded USDA archives |
| **autoprefixer** / **postcss** | ^10 / ^8 | Tailwind CSS pipeline |

---

## 5. Architecture

Nutrition Planner follows Electron's standard three-process model, with a shared pure
layer to keep the UI and AI consistent.

```
┌─────────────────────────────────────────────────────────────┐
│  Main process (Node)                                         │
│  • SQLite access (better-sqlite3)  • AI provider calls       │
│  • IPC handlers  • logging/crash capture  • reminders        │
│  • auto-update  • window security                            │
└───────────────▲─────────────────────────────────────────────┘
                │  contextBridge (window.api), typed IPC
┌───────────────┴─────────────────────────────────────────────┐
│  Preload (isolated)  — exposes a narrow, typed API surface   │
└───────────────▲─────────────────────────────────────────────┘
                │
┌───────────────┴─────────────────────────────────────────────┐
│  Renderer (React + Tailwind + Zustand)  — 8-tab UI           │
└─────────────────────────────────────────────────────────────┘

        src/shared/  ← PURE modules imported by BOTH sides
        (macros.ts, progress.ts) — single source of truth
```

**Key architectural decisions**
- **Shared pure modules.** `src/shared/macros.ts` (TDEE + diet-aware macro engine) and
  `src/shared/progress.ts` (streaks, goal projection, achievements) are imported by the
  main process *and* the renderer. This fixed an old class of bug where the AI saw
  different targets than the UI.
- **All AI traffic runs in the main process.** The renderer makes no external network
  calls at all, which lets the production Content-Security-Policy be strict.
- **Typed IPC surface** — every renderer→main call goes through a validated handler.

**Security hardening** (`src/main/index.ts`)
- `sandbox: true`, `contextIsolation: true`, no `nodeIntegration`.
- Strict **Content-Security-Policy** in production.
- `will-navigate` guard and `setWindowOpenHandler` → `shell.openExternal`.
- **IPC input validation** (`src/main/ipc/validate.ts`) guards every handler that
  reaches SQL or the filesystem.

**Observability**
- `electron-log` writes `userData/logs/main.log`; global `uncaughtException` /
  `unhandledRejection` handlers; every `ipcMain.handle` is wrapped so handler errors are
  logged before re-throwing.
- The renderer has a top-level `ErrorBoundary`, per-tab boundaries, and window-level
  error handlers.

### IPC channels (summary)
Renderer → Main (`invoke`): `food:*`, `plan:*`, `profile:*`, `log:*`, `quickadd:*`,
`favorites:*`, `ai:*`, `weight:*`, `water:*`, `customfood:*`, `savedmeal:*`,
`exercise:*`, `reminders:*`, `export:data`, `app:version`, `update:*`.
Main → Renderer (push): `ai:chunk`, `ai:done`, `ai:error`, `update:available`,
`update:downloaded`, `download:progress`.

---

## 6. Database

### File locations
| Purpose | Path |
|---|---|
| Source of truth (build scripts write here) | `resources/nutrition.db` (~1.7 GB) |
| Runtime copy (Electron reads this) | `%APPDATA%\nutrition-planner\nutrition.db` |
| Daily user-data backup (7 kept) | `%APPDATA%\nutrition-planner\backups\userdata-YYYY-MM-DD.json` |
| Logs | `%APPDATA%\nutrition-planner\logs\main.log` |

On first launch (and whenever `resources/nutrition.db` is newer), `database.ts` copies
the source DB into the user-data folder. Additive migrations run on every startup.

> ⚠️ **Migration caveat:** packaged builds do **not** bundle the `db/migrations/*.sql`
> files — only the *inline* migration code in `runMigrations()` runs in production. Every
> new column/table must be added inline (guarded `ALTER`, `CREATE TABLE IF NOT EXISTS`,
> or a guarded rebuild), with the `.sql` files kept in sync only for fresh dev DBs.

### Core schema
- **`food`** — USDA foods *and* user custom foods (negative `fdc_id`), with
  description, brand, serving info, GTIN, and popularity score.
- **`food_nutrient`** — per-100 g nutrient amounts.
- **`food_portion`** — USDA household portions.
- **`food_fts`** — external-content FTS5 index over `food`, kept current by an
  after-insert trigger (so custom foods are searchable with no query changes).
- **`user_profile`** — singleton row: metrics, activity, goal, diet type, allergens,
  avoid-foods, unit system, and custom-target overrides.
- **`plan` / `plan_entry`** — one row per date; logged food items tagged by meal.
- **`favorite_food`, `weight_log`, `water_log`, `exercise`** — tracking tables.
- **`saved_meal` / `saved_meal_item`** — recipes (cascade delete).
- **`settings`** — key/value store for AI provider/key/model, key source, built-in
  usage counters, and reminders config.

---

## 7. AI System

### Providers
Ten providers, unified behind two SDKs: Anthropic uses `@anthropic-ai/sdk`; the other
nine (OpenAI, Groq, DeepSeek, Mistral, Gemini, xAI, Perplexity, Together, Ollama) use
the `openai` SDK with per-provider base URLs.

### Two key modes (`ai_key_source`)
- **`custom`** — the user's own key, saved per provider (encrypted via `safeStorage`),
  unlimited and billed to them.
- **`builtin`** — an optional developer-embedded Anthropic key compiled into the **main
  bundle only** (`__BUILTIN_API_KEY__`, injected from `.env`'s
  `BUILTIN_ANTHROPIC_API_KEY` at build time). Pinned to a Haiku model and
  **soft-rate-limited locally** (per-install daily/monthly caps tracked in `settings`).
  Left empty in dev/from-source builds, in which case the app falls back to
  bring-your-own-key.

### Prompt construction (`services/ai.service.ts`)
- **System prompt:** profile, goal semantics (cut/maintain/gain/recomp), diet + its
  macro rationale, daily targets, suggestion style, and a **hard restrictions** block
  (allergens + avoid-foods → "never suggest these").
- **User message:** today's food log, calories burned via exercise, nutrient gaps
  (< 80% RDI), and nutrients over the upper limit.
- **Streaming** via a shared `streamChat` helper (one `AbortController` per message).
  Also powers `startWeeklyReview` (Progress tab) and `startMealPlan` (Planner tab),
  which reuse the same rate-limit gate.

---

## 8. Tooling & Workflow

### Commands
```bash
npm install        # postinstall rebuilds better-sqlite3 for Electron
npm run dev        # launch in development

npm run typecheck  # tsc (main + renderer)
npm run lint       # eslint .
npm run test       # vitest (pure-logic unit tests)
npm run format     # prettier --write

npm run build:win  # rebuild native deps + build + package Windows installer

# Node-side DB scripts (rebuild for Node ABI first)
npm rebuild better-sqlite3
npm run db:download / db:import / db:verify / db:popularity
```

### Native-module ABI rule
`better-sqlite3` is a native addon and must match the runtime's
`NODE_MODULE_VERSION`: **Electron 41 = ABI 145**, Node 22 = ABI 127. `npm install` and
`build:win` rebuild it for Electron automatically. To run plain `node scripts/*.mjs`,
rebuild for Node (`npm rebuild better-sqlite3`), then switch back with
`npx @electron/rebuild -f -w better-sqlite3` before `npm run dev`. Kill all Electron
processes before rebuilding (Windows file lock).

### Quality gate & CI
- ESLint 9 flat config + Prettier; Vitest unit tests live next to their modules
  (`macros`, `units`, `nutrientProgress`, `unitConversion`, `progress`).
- GitHub Actions (`.github/workflows/ci.yml`): typecheck + lint + test on Ubuntu, plus
  a Windows `electron-vite build` job. Uses `npm ci --ignore-scripts` (checks don't
  need the native module).

### Build scripts (`scripts/`)
| Script | Purpose |
|---|---|
| `download-usda.mjs` | Download USDA zips to `resources/usda-raw/` |
| `import-usda.mjs` | Parse CSVs → `resources/nutrition.db` |
| `build-fts.mjs` | Rebuild FTS5 in batches |
| `import-popularity.mjs` | GTIN column + Open Food Facts scoring |
| `fix-usda-scores.mjs` | Keyword popularity tiers for SR Legacy/Foundation |
| `verify-db.mjs` | Row-count / FTS sanity checks |

### Packaging & release
- **electron-builder** (`electron-builder.yml`): appId `com.nutritionplanner.app`;
  Windows NSIS one-click installer, macOS dmg, Linux AppImage/deb; `asarUnpack`s the
  resources and better-sqlite3; excludes `resources/usda-raw/**` and `.env`.
- **Auto-update + code-signing are pre-wired but inert** until credentials are
  supplied: `publish` uses `[GITHUB_OWNER]/[GITHUB_REPO]` placeholders, and signing
  reads `CSC_LINK` / `CSC_KEY_PASSWORD` (Windows/macOS) plus Apple notarization vars.
  Unsigned builds still run but trigger SmartScreen/Gatekeeper warnings.

---

## 9. Source File Map

```
src/
├── shared/                      # PURE modules shared by main + renderer (+ *.test.ts)
│   ├── macros.ts                # BMR/TDEE/diet-aware macro engine + custom targets
│   └── progress.ts              # streak, goal projection, achievements
├── main/
│   ├── index.ts                 # bootstrap, security, logging, crash handlers,
│   │                            #   IPC registration, updater, reminders
│   ├── constants/{rdi.ts, ai-limits.ts}
│   ├── db/
│   │   ├── database.ts          # singleton, auto-sync, inline migrations, backup
│   │   ├── settings.helpers.ts  # get/set + encrypt/decrypt (safeStorage)
│   │   ├── migrations/{001_schema.sql, 002_fts.sql}
│   │   └── queries/*.queries.ts # food, plan, profile, nutrient, log, quickadd,
│   │                            #   favorites, customFood, savedMeal, tracking, exercise
│   ├── ipc/*.ipc.ts + validate.ts
│   └── services/
│       ├── ai.service.ts        # streamChat + chat/weeklyReview/mealPlan
│       ├── ai-usage.service.ts  # built-in key usage tracking
│       ├── tdee.service.ts      # re-exports shared/macros
│       ├── reminders.service.ts # notification scheduler
│       └── updater.service.ts   # electron-updater (inert until creds)
├── preload/{index.ts, index.d.ts}   # contextBridge window.api + types
└── renderer/src/
    ├── App.tsx                  # 8-tab nav; onboarding gate; update banner
    ├── pages/                   # Home, Dashboard(Add), Log(History), Progress,
    │                            #   Exercise, Planner, Chat, Settings
    ├── components/              # profile, food, charts, nutrients, plan, chat, ui
    ├── hooks/                   # useFoodSearch, useNutrientTotals, useRangeData, useAiStream
    ├── store/                   # usePlanStore, useProfileStore, useChatStore
    └── lib/                     # types, unitConversion, units, nutrientProgress, formatters
```

### Navigation (8 tabs)
Dashboard · Add (daily log) · History · Progress · Exercise · Planner · AI Chat ·
Settings. A first-launch gate blocks the app behind onboarding until a profile is
saved (targets/TDEE need it).

---

## 10. Project Status

### Complete
- ~2M-food USDA + branded dataset with FTS5 search, calorie fallback, and popularity
  scoring.
- Custom foods, recipes/saved meals, barcode lookup, copy-day, meal sections.
- Diet types + allergens/avoid-foods, metric/imperial units, custom-or-formula targets.
- Dashboard, History, Progress (charts/goals/achievements/weekly-AI), budget-aware
  Exercise, AI Planner.
- Weight & water tracking, CSV/JSON export, daily auto-backup.
- AI: 10 providers, built-in embedded key with soft rate-limit, diet/allergen/
  activity-aware prompts, weekly review + meal plan.
- Reminders, onboarding gate, security hardening, logging + crash handling,
  ESLint/Prettier, Vitest, CI.
- Electron 41 (0 `npm audit` vulnerabilities), better-sqlite3 12, electron-builder 26.
- Release scaffolding (updater + signing/publish config, inert) + legal doc drafts.

### Known follow-ups
- **Fill legal placeholders** — `LICENSE` (copyright holder), `PRIVACY.md`,
  `NOTICES.md`; set the GitHub repo and obtain a code-signing certificate before
  public distribution.
- **Electron 42 upgrade is blocked** on a `better-sqlite3` prebuilt for ABI 146 (or
  local MSVC build tools) — hence the pin to Electron 41.
- **Meal-planner suggestions are text-only** — the AI day-plan can't reliably map
  suggestions to USDA ids, so it doesn't auto-insert into the log.

---

*This overview is a standalone summary of the project. For terse build/runtime notes
see `CLAUDE.md`; for getting-started instructions see `README.md`.*
