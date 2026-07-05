import Database from 'better-sqlite3'
import { app } from 'electron'
import log from 'electron-log/main'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, copyFileSync, statSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { is } from '@electron-toolkit/utils'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  const userDbPath = join(app.getPath('userData'), 'nutrition.db')
  const bundledDb = is.dev
    ? join(app.getAppPath(), 'resources', 'nutrition.db')
    : join(process.resourcesPath, 'nutrition.db')

  // Copy pre-built food database from resources into userData on first run,
  // or whenever the bundled DB has been updated (e.g. after running import scripts).
  if (existsSync(bundledDb)) {
    const shouldCopy =
      !existsSync(userDbPath) ||
      statSync(bundledDb).mtimeMs > statSync(userDbPath).mtimeMs
    if (shouldCopy) {
      copyFileSync(bundledDb, userDbPath)
      log.info(`Copied bundled database → ${userDbPath}`)
    }
  }

  db = new Database(userDbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)

  backupOnce(db)

  return db
}

/**
 * Once-per-day snapshot of the user's *own* data (profile, food log, weight,
 * water, favorites, settings) into userData/backups, retaining the last 7.
 *
 * Deliberately excludes the ~2M-row USDA food dataset — that's static and
 * re-copied from resources on demand, so backing it up daily would waste
 * hundreds of MB. The small user data is the irreplaceable part; this is cheap
 * insurance against a repeat of a wiped database. Synchronous + tiny, so it
 * never meaningfully delays startup.
 */
function backupOnce(database: Database.Database): void {
  try {
    const dir = join(app.getPath('userData'), 'backups')
    mkdirSync(dir, { recursive: true })
    const today = new Date().toISOString().slice(0, 10)
    const dest = join(dir, `userdata-${today}.json`)
    if (existsSync(dest)) return

    const snapshot = {
      exportedAt: new Date().toISOString(),
      profile: database.prepare('SELECT * FROM user_profile WHERE id = 1').get() ?? null,
      entries: database.prepare(
        'SELECT pl.date AS date, pe.* FROM plan_entry pe JOIN plan pl ON pl.id = pe.plan_id ORDER BY pl.date, pe.position'
      ).all(),
      weight: database.prepare('SELECT * FROM weight_log ORDER BY date').all(),
      water: database.prepare('SELECT * FROM water_log ORDER BY date').all(),
      favorites: database.prepare('SELECT * FROM favorite_food').all(),
      settings: database.prepare('SELECT * FROM settings').all()
    }
    writeFileSync(dest, JSON.stringify(snapshot), 'utf8')
    log.info(`User-data backup written → ${dest}`)

    const backups = readdirSync(dir)
      .filter(f => f.startsWith('userdata-') && f.endsWith('.json'))
      .sort()
    for (const f of backups.slice(0, -7)) {
      try { unlinkSync(join(dir, f)) } catch { /* ignore */ }
    }
  } catch (err) {
    log.warn('User-data backup failed (non-fatal):', err)
  }
}

function runMigrations(database: Database.Database): void {
  const migrationsDir = join(__dirname, 'migrations')

  for (const file of ['001_schema.sql', '002_fts.sql']) {
    const path = join(migrationsDir, file)
    if (existsSync(path)) {
      const sql = readFileSync(path, 'utf-8')
      database.exec(sql)
    }
  }

  // Additive migrations — safe to re-run (errors mean column already exists)
  try { database.exec('ALTER TABLE user_profile ADD COLUMN goal_kcal INTEGER') } catch { /* already exists */ }
  // Meal section for logged entries (Breakfast/Lunch/Dinner/Snacks). ADD COLUMN
  // with DEFAULT backfills existing rows.
  try { database.exec("ALTER TABLE plan_entry ADD COLUMN meal TEXT NOT NULL DEFAULT 'snack'") } catch { /* already exists */ }

  // Favorites table (CREATE IF NOT EXISTS is idempotent)
  database.exec(`
    CREATE TABLE IF NOT EXISTS favorite_food (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      fdc_id          INTEGER NOT NULL UNIQUE,
      food_description TEXT NOT NULL,
      serving_unit    TEXT NOT NULL,
      serving_amount  REAL NOT NULL,
      grams           REAL NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Weight and water tracking — one row per day (upserted).
  database.exec(`
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
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      saved_meal_id   INTEGER NOT NULL REFERENCES saved_meal(id) ON DELETE CASCADE,
      fdc_id          INTEGER NOT NULL,
      food_description TEXT NOT NULL,
      serving_unit    TEXT NOT NULL,
      serving_amount  REAL NOT NULL,
      grams           REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS exercise (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      date            TEXT NOT NULL,
      name            TEXT NOT NULL,
      calories_burned REAL NOT NULL,
      duration_min    REAL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_exercise_date ON exercise(date);
  `)

  // Modern user_profile schema: adds dietary-preference columns and relaxes the
  // legacy goal CHECK (which only allowed maintain/bulk/cut) so 'recomp' is
  // valid. CHECK constraints can't be dropped via ALTER in SQLite, so legacy
  // tables are rebuilt once (guarded by the diet_type column being absent).
  const PROFILE_SCHEMA = `(
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
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  )`
  database.exec(`CREATE TABLE IF NOT EXISTS user_profile ${PROFILE_SCHEMA}`)

  const profileCols = (database.prepare('PRAGMA table_info(user_profile)').all() as Array<{ name: string }>)
    .map(c => c.name)
  if (!profileCols.includes('diet_type')) {
    const goalKcalExpr = profileCols.includes('goal_kcal') ? 'goal_kcal' : 'NULL'
    const updatedExpr = profileCols.includes('updated_at') ? 'updated_at' : "datetime('now')"
    database.exec(`
      CREATE TABLE user_profile_new ${PROFILE_SCHEMA};
      INSERT INTO user_profile_new
        (id, age, sex, height_cm, weight_kg, activity_level, goal, goal_kcal, updated_at)
        SELECT id, age, sex, height_cm, weight_kg, activity_level, goal,
               ${goalKcalExpr}, ${updatedExpr}
        FROM user_profile;
      DROP TABLE user_profile;
      ALTER TABLE user_profile_new RENAME TO user_profile;
    `)
  }

  // Manual macro-target overrides + unit-system preference. Added AFTER the
  // rebuild above so the columns survive it (the rebuild only copies base cols).
  for (const sql of [
    'ALTER TABLE user_profile ADD COLUMN use_custom_targets INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE user_profile ADD COLUMN custom_calories REAL',
    'ALTER TABLE user_profile ADD COLUMN custom_protein_g REAL',
    'ALTER TABLE user_profile ADD COLUMN custom_carbs_g REAL',
    'ALTER TABLE user_profile ADD COLUMN custom_fat_g REAL',
    "ALTER TABLE user_profile ADD COLUMN unit_system TEXT NOT NULL DEFAULT 'metric'"
  ]) {
    try { database.exec(sql) } catch { /* column already exists */ }
  }
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
