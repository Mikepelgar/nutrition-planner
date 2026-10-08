# Nutrition Planner

A desktop nutrition tracker built with Electron, React, TypeScript and SQLite. It searches about
2.1 million USDA food records offline, sets calorie and macro targets from your body metrics,
goal and diet type, and tracks vitamins and minerals against Dietary Reference Intakes. Your food
log stays on your machine. There's an optional AI coach that runs through a small Supabase
backend.

It runs from source. Packaging is set up in `electron-builder.yml`, but nothing has been released
yet. It's a tracking tool, not medical advice.

## Why it exists

Most nutrition trackers need an account, store your health data on their servers, and charge for
micronutrient detail. Here the food database ships with the app, so search, logging, targets,
charts and history all work offline with no account. The AI chat is the only feature that uses
the network.

## Features

- Food search, barcode lookup, favorites, and copying a previous day's log
- Calorie and macro targets from your profile, or targets you set yourself
- Vitamin and mineral tracking against age- and sex-specific Dietary Reference Intakes
- Weight, water and exercise logging; exercise calories raise that day's target
- Trend charts, a goal-weight projection, and daily to yearly history
- Meal and water reminders as desktop notifications
- CSV and JSON export, plus an automatic daily backup
- AI chat, a weekly review and day planning. The chat can suggest foods to log, and nothing is
  saved until you confirm.

## How it works

```
renderer (React, sandboxed, no Node)
   |  window.api, defined in src/preload/index.ts
   v
main process
   |-- better-sqlite3 --------> SQLite in the OS user-data folder
   '-- HTTPS + session token -> Supabase Edge Function (ai-chat)
                                  |-- per-user quota in Postgres
                                  '-- OpenAI
```

The React UI runs sandboxed with no Node access and talks to the main process over IPC. The main
process reads and writes SQLite with `better-sqlite3` and makes the AI calls, so the UI never
touches the network.

The AI coach runs through a Supabase Edge Function, so the OpenAI key stays on the server and
never ships with the app. You sign in with Google or GitHub in your browser, and the app receives
the callback on `http://127.0.0.1:54331/auth-callback`. Usage limits are enforced in Postgres:
20 requests a day and 200 a month by default. The model is `gpt-5-mini` unless you change it on
the server.

### Logging a food

1. **Search** (`food:search`) runs two FTS5 queries, one over about 8,000 whole foods and one over
   the branded foods, and merges and ranks the results (see below).
2. **Serving.** `getSmartDefault` picks a starting portion (an egg is 50 g, drinks are 1 cup,
   branded foods use the label serving), and `toGrams` converts your edit to grams
   (`src/renderer/src/lib/unitConversion.ts`).
3. **Log.** `plan:addEntry` saves the entry with its grams, so later changes to targets or serving
   logic don't rewrite past days.
4. **Totals.** Nutrients are stored per 100 g. `getFoodNutrientTotals` adds up the grams for each
   food, then scales once.
5. **AI context.** When you ask the coach something, the main process sends the day's log and
   targets to the Edge Function, which builds the prompt with the same `src/shared/` code the UI
   uses for its targets.

### How targets are calculated

`src/shared/macros.ts` estimates resting calories with the Mifflin-St Jeor formula and multiplies
by your activity level. Maintain and recomp eat at that number, bulk adds 300 calories and cut
subtracts 500 (never below 1,200); both amounts can be changed. Protein is 1.6 to 2.2 g per kg
depending on the goal (2.4 on the high-protein diet), and fat and carbs split the rest based on
your diet type. For example, keto caps carbs at 25 g, and balanced sets fat to 25% of calories.

## Common problems and how they're solved

**Search ranking.** FTS rank alone puts odd matches first, and popularity alone buries exact
ones. Results are sorted by whether the name starts with the first word you typed, then by a
popularity score, then by FTS rank. That puts "Chicken, breast" above "Fat, chicken". Popularity
is computed offline: Open Food Facts scan counts matched on barcode for branded foods, and keyword
tiers for whole foods (`scripts/fix-usda-scores.mjs`).

**Missing calories.** Many branded foods list protein, carbs and fat but no energy value. The app
computes 4 × protein + 4 × carbs + 9 × fat in both the food-detail query and the search query
(`CAL_SUBQUERY`), so search results and logged totals show the same number.

**Barcodes without leading zeros.** The USDA import stored barcodes as numbers, so a code printed
as 049000042566 is stored as 49000042566. `normalizeBarcode` (`src/shared/barcode.ts`) strips
spaces, dashes and leading zeros before the lookup. When several rows share a code, the most
scanned and newest one wins.

**Food names in AI prompts.** Food names and foods to avoid are typed by the user and end up in
a prompt. `sanitizeUserText` and `fenceUserData` (`src/shared/aiContext.ts`) clean them and wrap
them in labeled blocks that the prompt tells the model to read as data only. This runs on the
server, so a modified app can't skip it.

**Native module versions.** `better-sqlite3` has to be built for whichever runtime loads it:
Electron 41 for the app, Node 22 for the database scripts. That's why the setup below rebuilds it
twice. The project stays on Electron 41 because there's no prebuilt `better-sqlite3` binary for
Electron 42 yet.

## Running it

Requires Node.js 22.

```bash
npm install
npm run dev
```

The food database (about 1.7 GB) isn't in the repo, so you build it once. The scripts run under
plain Node, so rebuild `better-sqlite3` for Node first and switch it back for Electron at the end.
Close the app before rebuilding, since Windows locks the file.

```bash
npm rebuild better-sqlite3
npm run db:download -- all
npm run db:import -- all
npm run db:popularity
node scripts/fix-usda-scores.mjs
npm run db:verify
npx @electron/rebuild -f -w better-sqlite3
```

If the import stops before indexing, run `node scripts/build-fts.mjs` instead of starting over.

CI runs `npm run typecheck`, `npm run lint` and `npm run test` on pushes to main and on pull
requests.

### AI backend

The app works without it; the AI features just show as unconfigured. To set one up:

1. Create a Supabase project and link it with `npx supabase link`.
2. Run `npm run supabase:push` to create the tables and quota function.
3. Set your OpenAI key as the `OPENAI_API_KEY` secret with `npx supabase secrets set`.
4. Run `npm run supabase:deploy` to deploy the Edge Function.
5. Copy `.env.example` to `.env` and add the project URL and anon key from the dashboard.
6. In the dashboard, turn on Google and GitHub sign-in and add
   `http://127.0.0.1:54331/auth-callback` as a redirect URL.

## What could change

- The local tables assume a single user, so syncing or a web version would need a `user_id` on
  each of them.
- Barcodes should be stored as text at import, which would remove the zero-stripping workaround.
- The History page doesn't add exercise calories to the daily target yet, unlike the Dashboard.

## Privacy

Your profile, food log, weight, water and exercise are stored in SQLite in your OS user-data
folder and never uploaded. There's no telemetry. If you use the AI features, that request's data
goes to the Edge Function and then to OpenAI. The backend stores your account id, email and usage
counts, but not your messages.

## Data sources

Food data comes from [USDA FoodData Central](https://fdc.nal.usda.gov/), which is in the public
domain. Popularity scores use data from [Open Food Facts](https://world.openfoodfacts.org/),
licensed under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/). If you
share a database built from it publicly, it has to be under the same license.

## License

MIT. See [LICENSE](LICENSE).
