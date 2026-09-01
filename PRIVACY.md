# Privacy Policy — Nutrition Planner

_Last updated: 2026-09-01 · Applies to the Nutrition Planner desktop application._

> This is a starting-point policy. Review it with the specifics of your
> distribution (and local legal requirements) before publishing.

## Summary

Your nutrition data lives on **your own computer** in a local database. There is
no sync, no analytics, and no advertising, and the app works entirely offline for
food logging, targets, charts, exercise, weight, and water.

The AI features are the exception, and they are not local. Using them requires an
account and sends the relevant context to a service the developer operates, which
forwards it to an AI provider. If you never use the AI features, no data about you
leaves your machine and you never need an account.

## What is stored on your device

In the app's user-data folder (`%APPDATA%/nutrition-planner` on Windows) as a
SQLite database:

- Your profile (age, sex, height, weight, activity, goal, diet, allergens, units)
- Your food log and favorites
- Weight, water, and exercise entries
- App settings and reminder preferences
- Your sign-in session, if you use AI — the refresh token is encrypted at rest
  using your operating system's secure storage (`Electron safeStorage`)
- A daily local backup of the above (`backups/userdata-*.json`)
- Application logs (`logs/main.log`) — these record sizes and error codes, never
  the content of your food log or AI conversations

## What is stored on the server

Only if you sign in to use AI:

- **Your account** — an identifier and the email address supplied by the OAuth
  provider you signed in with (Google or GitHub). No password is created, and the
  app never sees your provider credentials; sign-in happens in your own browser.
- **Usage counters** — how many AI requests you have made today and this month,
  which is what enforces the free allowance. These are counts and dates, not
  content.

Row-level security policies mean each account can read only its own rows, and the
usage counters are not writable by any client at all.

**Your food log, profile, weight, and exercise history are never uploaded**, and
there is no copy of your nutrition data on the server.

## What is sent when you use AI

When you use AI Chat, the Weekly Review, or the Meal Planner, the app sends the
context needed to answer that one question: your profile summary, daily targets,
diet and restrictions, that day's food log, nutrient gaps, calories burned, and
your question. This goes to the developer's proxy, which forwards it to the AI
provider (currently **OpenAI**) and streams the answer back.

The proxy does not store the content of your requests or the model's replies; it
records only the counters described above, plus error diagnostics that exclude
request content. **The AI provider's own handling is governed by its privacy
policy and terms** — data sent there is subject to that provider's retention.

If you do not want any of this to leave your device, do not use the AI features.
Everything else in the app continues to work.

## The food database

The bundled food database is built from public datasets (USDA FoodData Central and
Open Food Facts — see `NOTICES.md`). It contains no personal data about you.

## Your control

- Export your data at any time (Settings → Data).
- Sign out (Settings → AI) to end the session; the stored token is removed.
- Delete your local data by removing the app's user-data folder. Uninstalling
  removes the application; the data folder can be deleted separately.
- To delete your account and its usage counters, contact the address below.

## Contact

[YOUR CONTACT EMAIL OR WEBSITE]
