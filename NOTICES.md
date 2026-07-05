# Notices & Attributions — Nutrition Planner

## Food data

### USDA FoodData Central
Whole-food and branded nutrition data is sourced from the U.S. Department of
Agriculture's **FoodData Central** (SR Legacy, Foundation Foods, and Branded
Foods datasets). USDA FoodData Central data is in the **public domain** in the
United States. Courtesy citation:

> U.S. Department of Agriculture, Agricultural Research Service. FoodData Central.
> https://fdc.nal.usda.gov/

### Open Food Facts (ODbL)
Branded-food popularity signals are derived from **Open Food Facts**, which is
made available under the **Open Database License (ODbL) v1.0**:
https://opendatacommons.org/licenses/odbl/1-0/

> Contains information from Open Food Facts (https://world.openfoodfacts.org),
> made available under the Open Database License (ODbL).

⚠️ **Important — ODbL obligations.** The ODbL requires **attribution** and is a
**share-alike** license: if you publicly distribute a database that is derived
from or includes Open Food Facts data, you must make that derived database
available under the ODbL as well. Because the shipped `resources/nutrition.db`
incorporates OFF-derived data, **review your ODbL obligations before
redistributing the database commercially.** This document is attribution, not
legal advice — consult the ODbL text and, if needed, a lawyer.

## Third-party software

This application is built on open-source software, including (non-exhaustive):

- **Electron** (MIT) — desktop runtime
- **React** & **React DOM** (MIT) — UI
- **better-sqlite3** (MIT) — local database
- **Zustand** (MIT) — state management
- **Tailwind CSS** (MIT) — styling
- **Lucide** (ISC) — icons
- **electron-vite**, **Vite** (MIT) — build tooling
- **electron-log** (MIT) — logging
- **@anthropic-ai/sdk**, **openai** (MIT / Apache-2.0) — AI provider SDKs

Each library is the property of its respective authors and is used under its own
license. Full license texts are available in each package within `node_modules`,
or from the projects' repositories. To regenerate a complete bill of materials,
run a license-checker against `node_modules` before release.
