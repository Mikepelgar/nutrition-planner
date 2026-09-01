# Nutrition Planner

A desktop nutrition tracker that keeps all of its data on your own machine. It logs
food against a bundled ~2-million-row USDA and branded-food database, derives calorie
and macro targets from your body metrics and goal, scores 35 micronutrients against
age/sex-specific DRI values, and can brief an LLM with exactly the same numbers the UI
is showing you.

It exists because the mainstream trackers all require an account, sync health data to
a server, and put micronutrient detail behind a subscription. This one has no account,
no server, and no telemetry. The food database ships inside the app, so search works
offline; the only bytes that ever leave the machine are the AI context you explicitly
send to a provider you configured yourself.

Windows, macOS, and Linux (Electron). Tracking tool only — not medical advice.

## How it works

### Process model

```
renderer (sandboxed, no Node)
   │  window.api.*            contextBridge, preload/index.ts
   ▼
preload  ──ipcRenderer.invoke──▶  main process
                                    ├── better-sqlite3 ──▶ SQLite in userData/
                                    └── provider SDK   ──▶ AI provider (HTTPS)
```

The renderer never touches SQLite, the filesystem, or the network. Every capability it
has is an explicit IPC channel listed in `src/preload/index.ts`, and every payload that
reaches a SQL statement passes through `src/main/ipc/validate.ts` first. The window
runs with `sandbox: true`, `contextIsolation: true`, no `nodeIntegration`, a production
CSP of `'self'`, a `will-navigate` guard, and `setWindowOpenHandler` routing external
links to the system browser.

Putting all AI traffic in the main process is what makes that CSP possible: the
renderer needs no external network access at all, and provider API keys never exist in
renderer memory. They are encrypted at rest with Electron's `safeStorage`.

### One logged food, end to end

1. **Search** (`food:search`) runs two FTS5 prefix queries — one over whole foods
   (SR Legacy + Foundation, capped at 8 results), one over branded foods — and merges
   them, ranking by a precomputed `popularity_score` with an exact-prefix bonus so
   "chicken" surfaces *Chicken, breast* rather than *Fat, chicken*. A strict AND match
   is tried first, then OR, then a `LIKE` scan that is only affordable because the
   whole-food set is ~8K rows (`src/main/db/queries/food.queries.ts`).
2. **Serving** — `getSmartDefault` picks a plausible default portion per food type
   (egg → 50 g, liquids → 1 cup, proteins → 4 oz, branded → the label serving, else
   100 g) and `toGrams` normalises the user's edit
   (`src/renderer/src/lib/unitConversion.ts`).
3. **Log** (`plan:addEntry`) writes a `plan_entry` row holding the resolved grams, so
   later target or serving-logic changes never retroactively rewrite history.
4. **Totals** — nutrient rows are stored per 100 g, so totals sum grams per `fdc_id`
   first and scale once. Summing per entry instead was a real bug: the same food logged
   twice in a day kept only the last entry's grams and undercounted micronutrients
   (regression test in `src/main/db/queries/nutrient.queries.test.ts`).
5. **Coaching** — `src/shared/aiContext.ts` assembles the profile, targets, diet rules,
   today's log, exercise burn, nutrient gaps below 80% RDI, and anything over its upper
   limit into a provider-neutral system prompt plus message list.

### Design decisions

**One macro engine, imported by both processes.** `src/shared/macros.ts` is pure and
dependency-free; the renderer's profile store and the main process's AI briefing both
import it. That resolved a class of bug where the coach reasoned against different
targets than the ones on screen. `src/shared/rdi.ts` does the same for the DRI table —
`src/main/constants/rdi.ts` is a re-export, not a second copy.

**Migrations must be written inline.** Packaged builds do not ship
`db/migrations/*.sql`; only the code inside `runMigrations()` runs in production. Every
schema change is therefore an additive `ALTER` in a try/catch, a
`CREATE TABLE IF NOT EXISTS`, or a guarded one-time table rebuild — the `.sql` files
exist only for fresh dev databases. Getting this wrong once reduced a development
database to a single table.

**The bundled food database is a cache; the user's rows are the data.** `database.ts`
copies `resources/nutrition.db` into `userData/` on first launch and whenever the
bundled file is newer by mtime. A daily JSON snapshot backs up *only* the user-owned
tables (profile, log, weight, water, favorites, settings), keeping the last 7 — backing
up the 2M static food rows daily would cost hundreds of MB to protect data that can
simply be re-copied.

**Provider abstraction is one field wide.** Nine of the ten providers speak the OpenAI
wire format, so they differ only by base URL; the sole real divergence — Anthropic's
top-level `system` parameter versus an OpenAI `role: 'system'` message — lives in
`streamChat` and nowhere else. Prompt building stays provider-neutral.

### The parts that took real work

**Ranking two million rows without a search server.** FTS5 `rank` alone puts junk
first; popularity alone buries exact matches. The shipped ordering is a three-key sort
(exact-prefix, then `popularity_score`, then `rank`) over two separately-capped
queries, with popularity backfilled offline — branded foods scored from Open Food Facts
scan counts joined on GTIN, whole foods scored by keyword tier
(`scripts/import-popularity.mjs`, `scripts/fix-usda-scores.mjs`).

**Energy missing from the source data.** Many branded rows carry macros but no nutrient
1008. Calories are therefore synthesised from `4·protein + 4·carbs + 9·fat` in two
places that must agree: `getFoodDetail` injects a synthetic nutrient row, and
`CAL_SUBQUERY` mirrors the same arithmetic in SQL so search results and logged totals
can't disagree.

**Native-module ABI.** `better-sqlite3` must match the runtime's
`NODE_MODULE_VERSION` — Electron 41 is 145, Node 22 is 127 — so the same working copy
needs different builds for `npm run dev` and for `node scripts/*.mjs`. The project is
pinned to Electron 41 because no `better-sqlite3` 12.10 prebuilt exists for Electron
42's ABI 146, and without one `@electron/rebuild` falls back to compiling from source.

**Treating logged food as untrusted input to the model.** Food names and avoid-food
entries are user-typed text flowing into a prompt. They are sanitised and wrapped in
labelled data blocks that the system prompt instructs the model to read as data only
(`sanitizeUserText` / `fenceUserData` in `src/shared/aiContext.ts`). History is capped
at 12 turns, consecutive same-role turns are merged (providers reject non-alternating
roles), and older log entries collapse into a summary line so a heavy logging day can't
blow the context budget.

## Running it

Requires Node.js 22.

```bash
npm install     # postinstall rebuilds better-sqlite3 against Electron's ABI
npm run dev
```

The food database is not in the repo (~2 GB). Build it once before the app is useful:

```bash
npm rebuild better-sqlite3          # switch the native module to the Node ABI
npm run db:download -- all          # USDA CSV archives → resources/usda-raw/
npm run db:import -- all            # parse → resources/nutrition.db, builds FTS5
npm run db:popularity               # Open Food Facts scan counts → popularity_score
node scripts/fix-usda-scores.mjs    # keyword popularity tiers for whole foods
npm run db:verify                   # row counts + FTS sanity check
npx @electron/rebuild -f -w better-sqlite3   # switch back to the Electron ABI
```

The import is long-running; if it finishes loading rows but dies before indexing, run
`node scripts/build-fts.mjs` rather than starting over. Kill any running Electron
process before either rebuild — Windows holds a file lock on the `.node` binary.

`database.ts` picks the rebuilt database up automatically on the next launch, because
it re-copies whenever `resources/nutrition.db` is newer than the copy in `userData/`.

| Command | Purpose |
|---|---|
| `npm run dev` | Run the app in development |
| `npm run typecheck` | `tsc --noEmit` over main and renderer projects |
| `npm run lint` | ESLint 9 (flat config) |
| `npm run test` | Vitest — macros, DRI progress, unit conversion, AI context assembly |
| `npm run build` | Bundle main / preload / renderer |
| `npm run build:win` | Native rebuild, bundle, and package a Windows NSIS installer |

CI runs typecheck, lint, and tests on Ubuntu plus a Windows bundle build, using
`npm ci --ignore-scripts` — none of those steps load the native module.

## Layout

```
src/shared/     pure modules imported by BOTH processes (macros, DRI table,
                AI context assembly, goal projection) with their unit tests
src/main/       Electron main: window + security setup, SQLite access, IPC
                handlers, AI transport, reminders, updater
src/preload/    the entire renderer API surface, one contextBridge object
src/renderer/   React UI — pages, components, zustand stores, display helpers
scripts/        offline database build pipeline (Node ABI, not shipped)
```

## AI configuration

Add a provider key in Settings and it is encrypted with `safeStorage` and stored
per-provider; ten providers are supported (Anthropic through its own SDK, the rest via
the OpenAI SDK plus a base URL, including a local Ollama).

Distributed builds can also carry an embedded Anthropic key so the AI features work
with no setup. `BUILTIN_ANTHROPIC_API_KEY` in a gitignored `.env` is compiled into the
**main bundle only** via `define` in `electron.vite.config.ts`, pinned to a
cost-efficient model, and soft-rate-limited per install (20/day, 200/month —
`src/main/constants/ai-limits.ts`). Builds from source leave it empty and fall back to
bring-your-own-key.

## Data and privacy

Everything lives in SQLite under the OS user-data folder — `%APPDATA%\nutrition-planner`
on Windows — alongside daily backups and `electron-log` output. No accounts, no
telemetry, and CSV/JSON export from Settings. The only outbound requests are the AI
calls you initiate. See [PRIVACY.md](PRIVACY.md).

## Attributions

Food data from [USDA FoodData Central](https://fdc.nal.usda.gov/) (public domain) and
[Open Food Facts](https://world.openfoodfacts.org/) (ODbL — attribution and
share-alike). See [NOTICES.md](NOTICES.md); the ODbL terms apply to any redistribution
of the bundled database.

## Releasing

`npm run build:win` produces an NSIS installer. Auto-update via `electron-updater` is
wired to this repo's GitHub Releases and activates once `GH_TOKEN` is present at
publish time:

```bash
npm run build:win -- --publish always
```

Packaged builds check for updates on launch and show a restart prompt when one has
downloaded; Settings → About has a manual check. Installers are unsigned until
`CSC_LINK` and `CSC_KEY_PASSWORD` are supplied at build time, so SmartScreen and
Gatekeeper will warn on first run.

## License

MIT — see [LICENSE](LICENSE).
