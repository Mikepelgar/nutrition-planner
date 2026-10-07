# Nutrition Planner

A desktop nutrition tracker that keeps all of its data on your own machine. It logs
food against a bundled ~2-million-row USDA and branded-food database, derives calorie
and macro targets from your body metrics and goal, scores 35 micronutrients against
age/sex-specific DRI values, and can brief an LLM with exactly the same numbers the UI
is showing you.

It exists because the mainstream trackers all sync your health data to a server, make
an account mandatory to open the app at all, and put micronutrient detail behind a
subscription. Here the food database ships inside the app and your log never leaves
it: tracking, targets, charts, and history all work offline with no account. The AI
coaching is the one networked feature — it needs a sign-in and sends that question's
context to a proxy — and everything else keeps working whether or not you use it.

Windows, macOS, and Linux (Electron). Tracking tool only — not medical advice.

## How it works

### Process model

```
renderer (sandboxed, no Node)
   │  window.api.*            contextBridge, preload/index.ts
   ▼
preload  ──ipcRenderer.invoke──▶  main process
                                    ├── better-sqlite3 ──▶ SQLite in userData/
                                    └── HTTPS + user JWT ─▶ Supabase Edge Function
                                                              ├── quota (Postgres)
                                                              └── OpenAI
```

The renderer never touches SQLite, the filesystem, or the network. Every capability it
has is an explicit IPC channel listed in `src/preload/index.ts`, and every payload that
reaches a SQL statement passes through `src/main/ipc/validate.ts` first. The window
runs with `sandbox: true`, `contextIsolation: true`, no `nodeIntegration`, a production
CSP of `'self'`, a `will-navigate` guard, and `setWindowOpenHandler` routing external
links to the system browser.

Putting all AI traffic in the main process is what makes that CSP possible: the
renderer needs no external network access at all. The main process holds no provider
key either — see below — only a session token, encrypted at rest with Electron's
`safeStorage`.

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
5. **Coaching** — the main process gathers the raw rows and posts them to the proxy,
   which validates them, meters the request, and runs `src/shared/aiContext.ts` to build
   the system prompt: profile, targets, diet rules, today's log, exercise burn, nutrient
   gaps below 80% RDI, and anything over its upper limit.

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

**The client is never trusted with the prompt.** The app sends the Edge Function
structured context — numbers and enums, validated against a schema on arrival — and the
*server* runs `buildSystemPrompt` to assemble the briefing. Accepting a ready-made
prompt would have made the proxy a general-purpose model for anyone holding an account,
and it would have put the allergen restrictions under the caller's control. The prompt
builders are shared source, copied into the function by `npm run sync:shared` with a CI
check that fails on drift.

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
(`sanitizeUserText` / `fenceUserData` in `src/shared/aiContext.ts`), and that now runs
server-side where a modified client cannot skip it. History is capped at 12 turns,
consecutive same-role turns are merged (providers reject non-alternating roles), and
older log entries collapse into a summary line so a heavy logging day can't blow the
context budget.

**A key you ship is a key you have given away.** The app used to compile a provider key
into its own bundle and meter it with counters in the user's SQLite file — both
recoverable or editable by anyone who installed it (`asar extract`, then grep; or one
`UPDATE` statement). The fix was structural rather than clever: the key moved to
Supabase secrets, the quota moved into Postgres behind a `SECURITY DEFINER` function
keyed on `auth.uid()`, and the client kept nothing worth stealing. The usage table has a
select policy and no write policy at all, so no client can increment its own allowance.

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
| `npm run sync:shared` | Copy the shared prompt modules into the Edge Function |
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
supabase/       migrations (schema + RLS + quota function) and the ai-chat
                Edge Function; _shared/ is generated by npm run sync:shared
```

## AI configuration

AI runs through a Supabase Edge Function that holds the provider key, so nothing
secret ships in the installer. Users sign in with Google or GitHub; the app never sees
a password, and the OAuth callback returns through the `nutrition-planner://` protocol
handler.

To stand up your own backend:

```bash
npx supabase link --project-ref <your-project-ref>
npm run supabase:push                        # schema, RLS policies, quota function
npx supabase secrets set OPENAI_API_KEY=...  # the one real secret; server-side only
npm run supabase:deploy                      # syncs shared modules, deploys ai-chat
```

Then put the project URL and anon key in `.env` (see `.env.example`) so they compile
into the build. Neither is a secret — the anon key grants exactly what the row-level
security policies allow, which is why every policy is written to be safe in the hands
of a hostile client. In the Supabase dashboard, add `nutrition-planner://auth-callback`
to the allowed redirect URLs and enable the Google/GitHub providers.

Cost and the allowance live in the database, not in code: `ai_limits` holds the daily
and monthly caps that `consume_ai_quota()` enforces and Settings displays, and
`global_usage` carries a hard monthly ceiling as a circuit breaker. The model is a
server-side setting (`AI_MODEL`, default `gpt-5-mini`), so changing it needs no client
release. A build with no `.env` reports AI as unconfigured and every other feature works
normally.

Local development without spending money: `npm run supabase:start`, then
`npm run supabase:serve` with `OPENAI_BASE_URL` pointed at any OpenAI-compatible server.

## Data and privacy

Your food log, profile, weights, and exercise history live in SQLite under the OS
user-data folder — `%APPDATA%\nutrition-planner` on Windows — alongside daily backups
(`backups/userdata-*.json`) and `electron-log` output (`logs/main.log`, which records
sizes and error codes, never log or conversation content). None of it is uploaded,
and there is no telemetry, analytics, or advertising.

Only if you sign in to use AI, the server stores:

- **An account** — an id and the email your OAuth provider (Google or GitHub)
  supplies. No password is created; sign-in happens in your own browser. The refresh
  token is encrypted at rest on your machine with Electron `safeStorage`.
- **Usage counters** — request counts and dates that enforce the free allowance.
  Row-level security limits each account to its own rows, and no client can write
  them.

Using an AI feature sends that question's context — profile summary, targets, diet
and restrictions, the day's log, nutrient gaps, calories burned — to the proxy,
which forwards it to OpenAI and streams the answer back. The proxy does not store
request or reply content; OpenAI's own retention is governed by its terms. Skip the
AI features and nothing about you leaves the machine.

You can export your data (Settings → Data), sign out (Settings → AI), or delete
everything local by removing the user-data folder. To delete your account and its
usage counters, contact [YOUR CONTACT EMAIL OR WEBSITE].

## Attributions

Whole-food and branded nutrition data comes from
[USDA FoodData Central](https://fdc.nal.usda.gov/) (SR Legacy, Foundation, Branded),
which is in the public domain:

> U.S. Department of Agriculture, Agricultural Research Service. FoodData Central.

Branded-food popularity signals are derived from
[Open Food Facts](https://world.openfoodfacts.org/), available under the
[Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/1-0/):

> Contains information from Open Food Facts, made available under the ODbL.

The ODbL requires attribution and is share-alike: a publicly distributed database
derived from Open Food Facts data must also be made available under the ODbL. The
bundled `resources/nutrition.db` includes such data, so review those obligations
before redistributing it.

Third-party packages are used under their own licenses, included with each package
in `node_modules`.

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
