# Privacy Policy — Nutrition Planner

_Last updated: [DATE] · Applies to the Nutrition Planner desktop application._

> This is a starting-point policy. Review it with the specifics of your
> distribution (and local legal requirements) before publishing.

## Summary

Nutrition Planner is a **local-first** desktop app. Your nutrition data lives on
**your own computer**. We (the developer) do not operate a server that collects,
stores, or sees your data. The only time data leaves your device is when **you**
use the AI Chat / AI features, which send the relevant context to the AI provider
you have configured.

## What is stored, and where

All of the following is stored **locally** in the app's user-data folder on your
machine (e.g. `%APPDATA%/nutrition-planner` on Windows) in a SQLite database:

- Your profile (age, sex, height, weight, activity, goal, diet, allergens, units)
- Your food log, custom foods, saved meals, and favorites
- Weight, water, and exercise entries
- App settings and reminder preferences
- A daily local backup of the above (`backups/userdata-*.json`)
- Application logs (`logs/main.log`)

There is **no telemetry, analytics, advertising, or account system.**

## API keys

If you add your own AI provider API key, it is **encrypted at rest** using your
operating system's secure storage (`Electron safeStorage`) and stored only on
your device. It is never transmitted anywhere except, as required, to that
provider when you make an AI request.

## Data sent to AI providers

When you use AI Chat, the Weekly Review, or the Meal Planner, the app sends to the
AI provider you selected (e.g. Anthropic, OpenAI, or another configured provider —
or the developer's built-in key, if enabled) the context needed to answer:
your profile summary, daily targets, the relevant food log, nutrient gaps, and
calories burned. **Your use of a third-party AI provider is also governed by that
provider's privacy policy and terms.** If you do not want any data to leave your
device, do not use the AI features.

## The food database

The bundled food database is built from public datasets (USDA FoodData Central and
Open Food Facts — see `NOTICES.md`). It contains no personal data about you.

## Your control

You can export your data (Settings → Data) or delete it by removing the app's
user-data folder. Uninstalling removes the application; your data folder can be
deleted separately.

## Contact

[YOUR CONTACT EMAIL OR WEBSITE]
