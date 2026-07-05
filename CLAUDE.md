# Nutrition Planner — Project Checkpoint

Desktop nutrition tracking app built with Electron + React + TypeScript + SQLite.
Log daily food intake (meals, custom foods, recipes, barcode), track macros + 35
micronutrients against personalized targets, log exercise/weight/water, see trend
charts and goal projections, plan meals, and get context-aware AI coaching from any
major provider — all stored locally on the user's machine.

> Tracking tool only — not medical advice.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Desktop shell | **Electron 41** via `electron-vite` (react-ts scaffold) |
| Frontend | React 18 + TypeScript + Tailwind CSS |
| State | Zustand |
| Local database | SQLite via **better-sqlite3 12** + FTS5 full-text search |
| AI | `@anthropic-ai/sdk` (Anthropic) + `openai` (all other providers) |
| Icons | Lucide React |
| Logging | `electron-log` (main-process file log + crash capture) |
| Auto-update | `electron-updater` (configured; inert until publish creds set) |
| Quality | ESLint 9 (flat config) + Prettier + Vitest |
| Packaging | electron-builder 26 (Windows NSIS / mac dmg / linux) |

---

## Running the App

```bash
npm install        # postinstall rebuilds better-sqlite3 for Electron automatically
npm run dev        # launch in development

# Quality gate
npm run typecheck  # tsc (main + renderer)
npm run lint       # eslint .
npm run test       # vitest (pure-logic unit tests)
npm run format     # prettier --write

# Node-side DB scripts (import/verify) — see Scripts section
npm rebuild better-sqlite3   # rebuild for Node ABI first
node scripts/<script>.mjs

# Windows installer
npm run build:win  # @electron/rebuild + electron-vite build + electron-builder --win
```

> **Native-module ABI rule.** `better-sqlite3` is a native addon and must match the
> runtime's NODE_MODULE_VERSION. **Electron 41 = ABI 145**, Node 22 = ABI 127.
> - `npm install` / `build:win` rebuild it for Electron automatically.
> - To run plain `node scripts/*.mjs`, `npm rebuild better-sqlite3` (Node ABI), then
>   `npx @electron/rebuild -f -w better-sqlite3` to switch back before `npm run dev`.
> - **`@electron/rebuild` uses better-sqlite3's prebuilt binary when one exists for
>   the target Electron ABI** (no C++ toolchain needed). It only *compiles from
>   source* when no prebuilt exists — e.g. **Electron 42 (ABI 146) has no
>   better-sqlite3 12.10 prebuilt yet**, which is why the project is pinned to
>   Electron 41. Bumping further needs either a new better-sqlite3 prebuild or local
>   MSVC build tools.
> - Kill all Electron processes before rebuilding (Windows file lock).

---

## Quality, Security & Observability

- **Lint/format:** `eslint.config.mjs` (typescript-eslint + react-hooks, `no-undef`
  off for TS) and `.prettierrc`. `npm run lint` is 0-errors (a few intentional
  `react-hooks/exhaustive-deps` warnings on mount-only effects remain).
- **Tests:** `vitest.config.ts`; pure-logic unit tests live next to their modules
  (`*.test.ts`) — macros, units, nutrient-progress, unitConversion, progress.
- **CI:** `.github/workflows/ci.yml` — typecheck + lint + test on Ubuntu, plus a
  Windows `electron-vite build` job. Uses `npm ci --ignore-scripts` (checks don't
  need the native module).
- **Electron security** (`src/main/index.ts`): `sandbox: true`, `contextIsolation`,
  no `nodeIntegration`, a strict **Content-Security-Policy** (production only — the
  renderer makes no external calls; all AI traffic is in the main process), a
  `will-navigate` guard, and `setWindowOpenHandler` → `shell.openExternal`.
- **IPC validation:** `src/main/ipc/validate.ts` (`asString/asNumber/asInt/asEnum/asDate`)
  guards handlers that reach SQL/fs (barcode, search, export, custom-food, dates).
- **Logging & crashes:** `electron-log` writes `userData/logs/main.log`; global
  `uncaughtException`/`unhandledRejection` handlers; `ipcMain.handle` is wrapped once
  so every handler error is logged (then re-thrown). Renderer has a top-level
  `ErrorBoundary` + `window` error handlers, plus per-tab boundaries.

---

## Database

### Location
- **Source of truth (scripts write here):** `resources/nutrition.db`
- **Runtime copy (Electron reads this):** `%APPDATA%\nutrition-planner\nutrition.db`
- **Daily user-data backup:** `%APPDATA%\nutrition-planner\backups\userdata-YYYY-MM-DD.json`
  (profile, food log, weight, water, favorites, settings — **not** the 2M-row food
  data, which is re-copied from `resources`). Written once/day on launch; last 7 kept.
- **Logs:** `%APPDATA%\nutrition-planner\logs\main.log`

`database.ts` copies `resources → userData` on first launch and whenever
`resources/nutrition.db` is newer (mtime). Additive migrations run every startup in
`runMigrations()`.

> ⚠️ **Packaged builds do NOT bundle `db/migrations/*.sql`** — only the *inline* code
> in `runMigrations()` runs in production. **Add every new column/table inline**
> (`ALTER … ` in try/catch, `CREATE TABLE IF NOT EXISTS`, or a guarded table rebuild),
> not only in `001_schema.sql`. (A from-source dev DB once got reduced to a single
> table because of this.) The `001_schema.sql` / `002_fts.sql` files are kept in sync
> for source/dev fresh DBs.

### Schema

```sql
food            -- USDA foods AND user "custom_food" rows (negative fdc_id)
  fdc_id PK, data_type, description, brand_owner, brand_name,
  serving_size, serving_size_unit, household_serving, gtin_upc, popularity_score

food_nutrient   -- per-100g nutrient amounts (fdc_id FK, nutrient_id, name, unit, amount)
food_portion    -- USDA household portions
food_fts        -- external-content FTS5 over food(description, brand_owner);
                -- AFTER-INSERT trigger food_fts_insert auto-indexes new rows
                -- (so custom foods are searchable with no query changes)

user_profile    -- singleton (id = 1); goal CHECK relaxed to allow 'recomp'
  age, sex, height_cm, weight_kg, activity_level, goal, goal_kcal,
  diet_type       -- 'balanced' | keto | low_carb | high_protein | low_fat | paleo | mediterranean | vegetarian | vegan
  allergens       -- JSON array of allergen keys
  avoid_foods     -- JSON array of free-text foods to avoid
  goal_weight_kg  -- nullable
  unit_system     -- 'metric' | 'imperial' (display only; data stored metric)
  use_custom_targets, custom_calories, custom_protein_g, custom_carbs_g, custom_fat_g
  updated_at

plan            -- one row per ISO date (id PK, date UNIQUE)
plan_entry      -- logged food items
  id PK, plan_id FK, fdc_id FK, food_description, serving_unit, serving_amount,
  grams, position, meal   -- meal: breakfast|lunch|dinner|snack (default 'snack')

favorite_food   -- user-starred foods (fdc_id UNIQUE, serving, grams, created_at)

weight_log      -- (id, date UNIQUE, weight_kg, created_at)
water_log       -- (id, date UNIQUE, ml, updated_at)
exercise        -- (id, date, name, calories_burned, duration_min, created_at); idx on date
saved_meal      -- recipes (id, name, created_at)
saved_meal_item -- (id, saved_meal_id FK CASCADE, fdc_id, food_description, serving_unit, serving_amount, grams)

settings        -- key/value store. Keys in use:
  -- ai_provider, {provider}_api_key (encrypted via safeStorage), ai_model
  -- ai_key_source ('builtin' | 'custom')
  -- builtin_usage_date, builtin_usage_daily_count, builtin_usage_month, builtin_usage_monthly_count
  -- reminders (JSON: enabled, mealsEnabled, meals{breakfast,lunch,dinner}, waterEnabled, waterIntervalHours)
```

### Data Sources
- **SR Legacy** (~7,800 whole foods, USDA 2019), **Foundation** (~1,000, USDA 2024),
  **Branded** (~2M, USDA 2025).
- Branded popularity: Open Food Facts `unique_scans_n` via GTIN. USDA popularity:
  keyword tiers (see Food Search).

---

## Scripts (`scripts/`)

| Script | Purpose |
|---|---|
| `download-usda.mjs` | Download USDA zips to `resources/usda-raw/` |
| `import-usda.mjs` | Parse CSVs → `resources/nutrition.db` |
| `build-fts.mjs` | Rebuild FTS5 in 50K batches |
| `import-popularity.mjs` | GTIN column + Open Food Facts scoring |
| `fix-usda-scores.mjs` | Keyword popularity tiers for SR Legacy/Foundation |
| `verify-db.mjs` | Row-count / FTS sanity checks |
| `launch-screenshot.mjs` | Dev tool: Playwright launch + screenshot (needs `playwright-core`) |

`npm rebuild better-sqlite3` before running any script (Node ABI).

---

## TDEE & Macros — single source of truth

`src/shared/macros.ts` is a **pure** module imported by BOTH the main process
(`services/tdee.service.ts` re-exports it, used to brief the AI) and the renderer
(`store/useProfileStore.ts`). This fixed an old bug where the AI saw different
targets than the UI.

- Mifflin-St Jeor BMR × activity multiplier → TDEE.
- Goal calories: **maintain/recomp** = TDEE, **bulk** = +`goalKcal` (def 300),
  **cut** = −`goalKcal` (def 500, floor 1200).
- Protein g/kg: maintain 1.6, bulk 2.0, cut/recomp 2.2 (high-protein diet → 2.4).
- **Diet-aware splits** (`DIET_RULES`): keto caps carbs ~25 g (fat fills remainder),
  low_carb ~20% carbs, low_fat ~15% fat, high_protein bumps protein; paleo/
  mediterranean/vegetarian/vegan ≈ balanced (and act as AI constraints).
- **Custom targets:** if `useCustomTargets` + all four custom values set,
  `calcMacroTargets` returns them verbatim (skips the formula).
- `DIET_LABELS` exported for UI + AI prompt.
- Unit tests: `src/shared/macros.test.ts`.

---

## Food Search & Custom Foods

- Two parallel FTS5 queries (whole foods incl. **`custom_food`** + branded), merged.
  `"word"*` prefix syntax; OR fallback; LIKE fallback for the small USDA set.
- **Calorie fallback:** `getFoodDetail` injects a synthetic nutrient 1008 from macros
  (`p×4 + c×4 + f×9`) when energy is missing; `CAL_SUBQUERY` mirrors it in search.
- **Barcode lookup:** `findFoodByBarcode(upc)` → `food.gtin_upc` → `getFoodDetail`.
  Search tab has an "Enter a barcode" input → opens `ServingPicker` or offers custom food.
- **Custom foods** (`db/queries/customFood.queries.ts`): stored as `food` +
  `food_nutrient` rows with `data_type='custom_food'` and a **negative `fdc_id`**
  (USDA ids are positive). The insert trigger indexes them in FTS automatically;
  delete maintains FTS via the external-content `'delete'` command and is blocked if
  the food is referenced by `plan_entry`. Managed in the Add page **"My foods"** tab.
- USDA popularity tiers (800 foundation / 700 primary cuts / 600 secondary / 300
  neutral / 50 niche). `node scripts/fix-usda-scores.mjs` reapplies.

### Recipes / Saved Meals & Copy Day
- `saved_meal` + `saved_meal_item` (`db/queries/savedMeal.queries.ts`): snapshot a
  day's meal section as a recipe; **log it** expands into `plan_entry` rows under the
  active meal. UI: Add page **"Meals"** tab + "Save as meal" on meal headers.
- **Copy day/meal:** `plan.queries.copyEntries` + `plan:copyDay`/`plan:copyMeal`;
  the Add page has a "Copy previous day / from [date]" control.

---

## Serving Units, Meals & Display Units
- `getSmartDefault(food)` / `normalizeSizeUnit` / `toGrams` in `lib/unitConversion.ts`
  (egg→50g, liquids→1 cup, protein→4 oz, branded→label serving, else 100g).
- **Meal sections:** the plan store tracks an `activeMeal` (default by time of day);
  new foods are tagged with it; the Add page groups entries by Breakfast/Lunch/
  Dinner/Snacks with per-meal calorie subtotals.
- **Units (`lib/units.ts`):** `unit_system` preference converts **display only** —
  weight kg↔lb, height cm↔ft/in, water ml↔fl oz. Macros/calories stay g/kcal.

---

## Nutrient Progress Bars
Three-state algorithm in `lib/nutrientProgress.ts` (normal / over-rdi / excess).
RDI/UL constants: `main/constants/rdi.ts` (35 nutrients × 8 age/sex brackets).
Client mirror: inline helpers in `useNutrientTotals.ts` and `LogPage.tsx`.

---

## AI

### Providers & the built-in (embedded) key
10 providers (Anthropic via its SDK; others via the OpenAI SDK + base URLs):
Anthropic (`claude-sonnet-4-5`), OpenAI (`gpt-4o`), Groq, DeepSeek, Mistral,
Gemini (`gemini-2.0-flash`), xAI (`grok-3`), Perplexity, Together, Ollama (local).

**Two key modes** (`ai_key_source`):
- **`custom`** — user's own key, saved per-provider (encrypted via `safeStorage`),
  unlimited, billed to them.
- **`builtin`** — a developer-embedded **Anthropic** key compiled into the **main
  bundle only** (`__BUILTIN_API_KEY__`, injected from `.env`'s
  `BUILTIN_ANTHROPIC_API_KEY` via `electron.vite.config.ts` `define`). Pinned to
  `claude-haiku-4-5` and **soft-rate-limited** locally (20/day, 200/month —
  `constants/ai-limits.ts`, tracked in `settings` by `ai-usage.service.ts`). Empty in
  dev/from-source builds → falls back to bring-your-own-key.

Settings has an **AI Access** toggle (built-in vs own key) + provider/key/model +
live usage. ChatPage shows the matching banner (built-in usage / limit reached / no key).

### Prompt context (`services/ai.service.ts`)
- **System prompt** includes: profile, **goal semantics** (cut/maintain/gain/recomp),
  **diet** + its macro rationale, daily targets, **suggestion style**, and a **HARD
  RESTRICTIONS** block (allergens + avoid-foods → "never suggest these").
- **User message** includes: today's food log, **calories burned via exercise**,
  nutrient gaps (<80% RDI), and nutrients over UL.
- Modes: cut / maintain / **gain** (`bulk`) / **recomp**. Styles: standard / budget /
  quick-prep (`convenience`) / high_protein / whole_foods / vegetarian / low_sodium.
- Streaming via a shared `streamChat` helper (`AbortController` per `messageId` in
  `activeStreams`). Also: **`startWeeklyReview`** (Progress tab — 7-day summary) and
  **`startMealPlan`** (Planner tab — full-day plan respecting diet/allergens). Both
  reuse the rate-limit gate via `resolveAi` in `ai.ipc.ts`.

---

## Reminders
`services/reminders.service.ts` runs a 30s tick that fires Electron `Notification`s
at configured meal times and a water interval (8am–9pm). Prefs stored as the
`reminders` JSON setting; configured in **Settings → Reminders**.

---

## Navigation (Sidebar Tabs)

| Tab | Icon | Description |
|---|---|---|
| Dashboard | LayoutDashboard | Today overview: calorie ring, macros, top gaps, water, weight, streak, quick actions |
| Add | CalendarDays | Daily food log for any date; meal sections; copy-day |
| History | BarChart2 | `LogPage` — Daily/Weekly/Monthly/Yearly with expandable nutrient breakdown |
| Progress | TrendingUp | Trend charts + goal projection + achievements + weekly AI review |
| Exercise | Dumbbell | Log workouts (MET-based kcal) that add to the calorie budget |
| Planner | CalendarRange | 7-day week strip + AI "plan my day" |
| AI Chat | MessageSquare | Streaming AI coaching (goal/style pills) |
| Settings | Settings | Profile, diet, restrictions, targets, AI, reminders, data, about |

> **First-launch gate:** `App.tsx` blocks the app behind the onboarding `ProfileForm`
> until a profile is saved (targets/TDEE need it). The profile lives entirely inside
> **Settings** now (the standalone Profile tab and `ProfilePage.tsx` were removed; the
> form is `components/profile/ProfileForm.tsx`).

### Add Page — food sub-tabs
**Search** (FTS) · **Recent** (14d) · **Previous** (all-time) · **★ Faves** ·
**My foods** (custom foods) · **Meals** (saved recipes). Plus an "Add to:" meal
selector and a barcode input.

### Dashboard / Progress / Planner specifics
- **Dashboard** (`HomePage.tsx`): calorie ring (`remaining = target + exerciseKcal −
  food`), macro bars, top 3 nutrient gaps, water quick-add, weight log + goal note,
  logging streak, quick-action buttons.
- **Progress** (`ProgressPage.tsx`): range selector (30/90/365d); SVG `LineChart`/
  `BarChart` for weight, calories-vs-target, protein, water; goal-weight projection
  + ETA (`shared/progress.ts`); achievements/streak; weekly AI review.
- **Planner** (`PlannerPage.tsx`): 7-day strip (tap a day → Add for that date) + AI
  day-plan (text suggestions; no auto-insert — can't reliably map to USDA ids).

---

## IPC Channels

**Renderer → Main** (`ipcRenderer.invoke`):
`food:search` · `food:detail` · `food:byBarcode` · `plan:getOrCreate` ·
`plan:getEntries` · `plan:addEntry` (incl. `meal`) · `plan:updateEntry` ·
`plan:deleteEntry` · `plan:copyDay` · `plan:copyMeal` · `profile:get` · `profile:save` ·
`log:getDailyLogs` · `log:getNutrientBreakdown` · `quickadd:getRecent` ·
`favorites:get|getIds|toggle` · `ai:startStream` · `ai:cancelStream` · `ai:saveKey` ·
`ai:setKeySource` · `ai:hasKey` · `ai:weeklyReview` · `ai:planDay` ·
`weight:set|getRange|latest` · `water:get|getRange|add` ·
`customfood:create|list|delete` · `savedmeal:list|createFromDay|log|delete` ·
`exercise:add|getForDate|delete|caloriesForDate|getRange` · `reminders:get|set` ·
`export:data` · `app:version` · `update:check|install`

**Main → Renderer** (push): `ai:chunk` · `ai:done` · `ai:error` ·
`update:available` · `update:downloaded` · `download:progress`

`ai:hasKey` returns `{ hasKey, provider, model, keySource, usage?, builtinAvailable }`.

---

## Source File Map

```
src/
├── shared/                      # PURE modules shared by main + renderer (+ *.test.ts)
│   ├── macros.ts                # BMR/TDEE/diet-aware macro engine + custom targets
│   └── progress.ts              # streak, goal time-to-go projection, achievements
├── main/
│   ├── index.ts                 # bootstrap, security (sandbox/CSP/nav), logging,
│   │                            #   crash handlers, IPC registration, updater, reminders
│   ├── constants/{rdi.ts, ai-limits.ts}   # DRI table; built-in model + soft limits
│   ├── types/global.d.ts        # declare const __BUILTIN_API_KEY__
│   ├── db/
│   │   ├── database.ts          # singleton, auto-sync, inline migrations, daily backup
│   │   ├── settings.helpers.ts  # get/set + encrypt/decrypt (safeStorage)
│   │   ├── migrations/{001_schema.sql, 002_fts.sql}
│   │   └── queries/{food, plan, profile, nutrient, log, quickadd, favorites,
│   │                 customFood, savedMeal, tracking, exercise}.queries.ts
│   ├── ipc/
│   │   ├── {food, plan, profile, ai, log, quickadd, favorites, customfood,
│   │   │    savedmeal, tracking, exercise, reminders, export}.ipc.ts
│   │   └── validate.ts          # IPC input guards
│   └── services/
│       ├── ai.service.ts        # streamChat + chat / weeklyReview / mealPlan; prompt builders
│       ├── ai-usage.service.ts  # built-in key daily/monthly usage (check + consume)
│       ├── tdee.service.ts      # re-exports shared/macros
│       ├── reminders.service.ts # notification scheduler
│       └── updater.service.ts   # electron-updater (inert until creds)
├── preload/{index.ts, index.d.ts}   # contextBridge window.api + types
└── renderer/src/
    ├── App.tsx                  # 8-tab nav; onboarding gate; update banner; ErrorBoundary
    ├── main.tsx                 # root ErrorBoundary + window error handlers
    ├── pages/
    │   ├── HomePage.tsx         # Dashboard
    │   ├── DashboardPage.tsx    # the "Add" tab (food log; meal sections; copy-day)
    │   ├── LogPage.tsx          # History
    │   ├── ProgressPage.tsx     # trends/goals/achievements/weekly AI
    │   ├── ExercisePage.tsx     # activity logging (MET presets)
    │   ├── PlannerPage.tsx      # week strip + AI day-plan
    │   ├── ChatPage.tsx         # AI chat
    │   └── SettingsPage.tsx     # profile+diet+restrictions+targets+AI+reminders+data+about
    ├── components/
    │   ├── profile/ProfileForm.tsx     # shared by onboarding + Settings
    │   ├── food/{FoodSearch, FoodResultItem, ServingPicker, RecentFoods,
    │   │         CustomFoods, CustomFoodForm, SavedMeals}.tsx
    │   ├── charts/{LineChart, BarChart}.tsx
    │   ├── nutrients/{NutrientPanel, NutrientBar}.tsx
    │   ├── plan/PlanEntry.tsx
    │   ├── chat/ChatMessage.tsx
    │   └── ui/{Button, Input, Select, Spinner, Skeleton, ErrorBoundary}.tsx
    ├── hooks/{useFoodSearch, useNutrientTotals, useRangeData, useAiStream}.ts
    ├── store/{usePlanStore, useProfileStore, useChatStore}.ts
    └── lib/{types, unitConversion, units, nutrientProgress, formatters}.ts
```

Root config: `eslint.config.mjs`, `.prettierrc`, `vitest.config.ts`,
`.github/workflows/ci.yml`, `electron.vite.config.ts` (key injection),
`electron-builder.yml`, `dev-app-update.yml`, `.env` (gitignored).

---

## Packaging & Release

`electron-builder.yml`: appId `com.nutritionplanner.app`; `asarUnpack` resources +
better-sqlite3; excludes `resources/usda-raw/**` and `.env`; NSIS one-click installer.

**Auto-update + signing are pre-wired but inert** until credentials are supplied:
- `publish` (GitHub Releases) + Windows/macOS code-sign config use placeholders
  (`[GITHUB_OWNER]/[GITHUB_REPO]`) and env vars (`CSC_LINK`/`CSC_KEY_PASSWORD`,
  `GH_TOKEN`). `updater.service.ts` auto-checks on launch in production and shows a
  "Restart & install" banner; Settings → About has a manual check.
- See **README.md → Releasing** for the steps. Unsigned builds trigger
  SmartScreen/Gatekeeper warnings.

---

## Legal & Docs (placeholders — finalize before distribution)
- `LICENSE` — placeholder (proprietary default + commented MIT); fill `[COPYRIGHT HOLDER]`.
- `PRIVACY.md` — local-first; AI features send context to the chosen provider; keys
  encrypted; no telemetry.
- `NOTICES.md` — USDA (public domain) + **Open Food Facts (ODbL — attribution +
  share-alike)**. ⚠️ Review ODbL obligations before redistributing the bundled DB
  commercially.
- `README.md` — features, dev/build, ABI notes, releasing.
- In-app **About** (Settings) — version (`app:version`), attributions, update check.

---

## What's Complete
- ~2M-food USDA + branded data, FTS5 search, calorie fallback, popularity scoring
- Custom foods, recipes/saved meals, barcode lookup, copy-day, meal sections
- Diet types + allergens/avoid-foods, units (metric/imperial), custom or formula targets
- Dashboard, History, **Progress** (charts/goals/achievements/weekly-AI), **Exercise**
  (budget-aware), **Planner** (AI day-plan)
- Weight & water tracking, data export (CSV/JSON), daily auto-backup
- AI: 10 providers, built-in embedded key with soft rate-limit, diet/allergen/
  activity-aware prompts, weekly review + meal plan
- Reminders (desktop notifications), onboarding gate
- Security hardening, electron-log + crash handling, ESLint/Prettier, Vitest, CI
- Electron 41 (0 `npm audit` vulnerabilities), better-sqlite3 12, electron-builder 26
- Release scaffolding (electron-updater + signing/publish config, inert) + legal docs

## Known follow-ups
- Fill license/privacy/notice placeholders + GitHub repo + a code-signing cert.
- Electron 42 blocked on a better-sqlite3 prebuilt for ABI 146 (or local build tools).
- Meal-planner suggestions are text only (no auto-insert to the log).
