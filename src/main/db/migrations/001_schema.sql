PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS food (
  fdc_id              INTEGER PRIMARY KEY,
  data_type           TEXT NOT NULL,
  description         TEXT NOT NULL,
  brand_owner         TEXT,
  brand_name          TEXT,
  serving_size        REAL,
  serving_size_unit   TEXT,
  household_serving   TEXT
);

CREATE INDEX IF NOT EXISTS idx_food_data_type ON food(data_type);

CREATE TABLE IF NOT EXISTS food_nutrient (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  fdc_id        INTEGER NOT NULL REFERENCES food(fdc_id),
  nutrient_id   INTEGER NOT NULL,
  nutrient_name TEXT NOT NULL,
  unit_name     TEXT NOT NULL,
  amount        REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_food_nutrient_fdc ON food_nutrient(fdc_id);
CREATE INDEX IF NOT EXISTS idx_food_nutrient_nid ON food_nutrient(nutrient_id);

CREATE TABLE IF NOT EXISTS food_portion (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  fdc_id              INTEGER NOT NULL REFERENCES food(fdc_id),
  amount              REAL NOT NULL,
  measure_unit        TEXT NOT NULL,
  portion_description TEXT,
  gram_weight         REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_food_portion_fdc ON food_portion(fdc_id);

CREATE TABLE IF NOT EXISTS user_profile (
  id              INTEGER PRIMARY KEY CHECK(id = 1),
  age             INTEGER NOT NULL,
  sex             TEXT NOT NULL,
  height_cm       REAL NOT NULL,
  weight_kg       REAL NOT NULL,
  activity_level  TEXT NOT NULL,
  goal            TEXT NOT NULL,
  goal_kcal       INTEGER,
  diet_type       TEXT NOT NULL DEFAULT 'balanced',
  allergens       TEXT NOT NULL DEFAULT '[]',
  avoid_foods     TEXT NOT NULL DEFAULT '[]',
  goal_weight_kg  REAL,
  unit_system     TEXT NOT NULL DEFAULT 'metric',
  use_custom_targets INTEGER NOT NULL DEFAULT 0,
  custom_calories REAL,
  custom_protein_g REAL,
  custom_carbs_g  REAL,
  custom_fat_g    REAL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plan (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_plan_date ON plan(date);

CREATE TABLE IF NOT EXISTS plan_entry (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id          INTEGER NOT NULL REFERENCES plan(id) ON DELETE CASCADE,
  fdc_id           INTEGER NOT NULL REFERENCES food(fdc_id),
  food_description TEXT NOT NULL,
  serving_unit     TEXT NOT NULL,
  serving_amount   REAL NOT NULL,
  grams            REAL NOT NULL,
  position         INTEGER NOT NULL DEFAULT 0,
  meal             TEXT NOT NULL DEFAULT 'snack',
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_plan_entry_plan ON plan_entry(plan_id);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weight_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL UNIQUE,
  weight_kg   REAL NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS water_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL UNIQUE,
  ml          INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_meal (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_meal_item (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  saved_meal_id    INTEGER NOT NULL REFERENCES saved_meal(id) ON DELETE CASCADE,
  fdc_id           INTEGER NOT NULL,
  food_description TEXT NOT NULL,
  serving_unit     TEXT NOT NULL,
  serving_amount   REAL NOT NULL,
  grams            REAL NOT NULL
);
