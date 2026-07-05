/**
 * Imports USDA FoodData Central CSV datasets into SQLite.
 * Run: node scripts/import-usda.mjs [sr|foundation|branded|all]
 *
 * Requires: npm install (csv-parse and better-sqlite3 must be installed)
 */
import Database from 'better-sqlite3'
import { parse } from 'csv-parse'
import { createReadStream, mkdirSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { execSync } from 'child_process'
import AdmZip from 'adm-zip'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

const RAW_DIR = join(__dirname, '..', 'resources', 'usda-raw')
const EXTRACT_DIR = join(RAW_DIR, 'extracted')
const DB_PATH = join(__dirname, '..', 'resources', 'nutrition.db')

mkdirSync(EXTRACT_DIR, { recursive: true })
mkdirSync(join(__dirname, '..', 'resources'), { recursive: true })

// Nutrient IDs to capture
const NUTRIENT_IDS = new Set([
  1008, 2047, 2048, 1003, 1004, 1005, 1079, 2000, 1258, 1292, 1293, 1257, 1253,
  1162, 1106, 1114, 1109, 1185, 1165, 1166, 1167, 1175, 1177, 1178,
  1176, 1170, 1180, 1087, 1089, 1090, 1091, 1095, 1098, 1101, 1103,
  1093, 1092
])

const BATCH_SIZE = 500

function openDb() {
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = OFF')
  db.pragma('synchronous = NORMAL')
  db.pragma('busy_timeout = 30000')

  db.exec(`
    CREATE TABLE IF NOT EXISTS food (
      fdc_id INTEGER PRIMARY KEY, data_type TEXT NOT NULL,
      description TEXT NOT NULL, brand_owner TEXT, brand_name TEXT,
      serving_size REAL, serving_size_unit TEXT, household_serving TEXT
    );
    CREATE TABLE IF NOT EXISTS food_nutrient (
      id INTEGER PRIMARY KEY AUTOINCREMENT, fdc_id INTEGER NOT NULL,
      nutrient_id INTEGER NOT NULL, nutrient_name TEXT NOT NULL,
      unit_name TEXT NOT NULL, amount REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS food_portion (
      id INTEGER PRIMARY KEY AUTOINCREMENT, fdc_id INTEGER NOT NULL,
      amount REAL NOT NULL, measure_unit TEXT NOT NULL,
      portion_description TEXT, gram_weight REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK(id = 1), age INTEGER NOT NULL,
      sex TEXT NOT NULL, height_cm REAL NOT NULL, weight_kg REAL NOT NULL,
      activity_level TEXT NOT NULL, goal TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS plan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS plan_entry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL, fdc_id INTEGER NOT NULL,
      food_description TEXT NOT NULL, serving_unit TEXT NOT NULL,
      serving_amount REAL NOT NULL, grams REAL NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `)
  return db
}

async function streamCsv(filePath, onRecord) {
  return new Promise((resolve, reject) => {
    const parser = parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true })
    parser.on('readable', () => {
      let record
      while ((record = parser.read()) !== null) onRecord(record)
    })
    parser.on('error', reject)
    parser.on('end', resolve)
    createReadStream(filePath).pipe(parser)
  })
}

function extractZip(zipFile, outDir) {
  if (!existsSync(zipFile)) {
    console.log(`  Skipping (not downloaded): ${zipFile}`)
    return null
  }
  // Skip extraction if already extracted
  const existing = readdirSync(outDir, { withFileTypes: true }).find(e => e.isDirectory())
  if (existing) {
    console.log(`  Already extracted: ${existing.name}`)
    return join(outDir, existing.name)
  }
  console.log(`  Extracting ${zipFile} …`)
  const zip = new AdmZip(zipFile)
  zip.extractAllTo(outDir, true)
  const entries = readdirSync(outDir, { withFileTypes: true })
  const subdir = entries.find(e => e.isDirectory())
  return subdir ? join(outDir, subdir.name) : outDir
}

async function importDataset(db, dataDir, dataType) {
  if (!dataDir || !existsSync(dataDir)) {
    console.log(`  No data directory for ${dataType}, skipping.`)
    return
  }

  const foodFile = join(dataDir, 'food.csv')
  const nutrientFile = join(dataDir, 'food_nutrient.csv')
  const nutrientMasterFile = join(dataDir, 'nutrient.csv')
  const portionFile = join(dataDir, 'food_portion.csv')
  const brandedFile = join(dataDir, 'branded_food.csv')

  // Load nutrient master map
  const nutrientNames = new Map()
  if (existsSync(nutrientMasterFile)) {
    await streamCsv(nutrientMasterFile, r => {
      const id = parseInt(r.id)
      if (NUTRIENT_IDS.has(id)) nutrientNames.set(id, { name: r.name, unit: r.unit_name })
    })
  }

  // Insert foods
  console.log(`  Inserting foods (${dataType}) …`)
  const insertFood = db.prepare(`
    INSERT OR IGNORE INTO food (fdc_id, data_type, description) VALUES (?, ?, ?)
  `)
  let foodCount = 0
  const insertFoodBatch = db.transaction((rows) => {
    for (const r of rows) insertFood.run(r.fdc_id, r.data_type, r.description)
  })
  let batch = []
  await streamCsv(foodFile, r => {
    batch.push({ fdc_id: parseInt(r.fdc_id), data_type: r.data_type, description: r.description })
    if (batch.length >= BATCH_SIZE) {
      insertFoodBatch(batch); foodCount += batch.length; batch = []
      process.stdout.write(`\r    foods: ${foodCount}`)
    }
  })
  if (batch.length) { insertFoodBatch(batch); foodCount += batch.length }
  console.log(`\r    foods: ${foodCount} inserted`)

  // Update branded info
  if (dataType === 'branded_food' && existsSync(brandedFile)) {
    console.log('  Updating branded info …')
    const updateBranded = db.prepare(`
      UPDATE food SET brand_owner=?, brand_name=?, serving_size=?, serving_size_unit=?, household_serving=?
      WHERE fdc_id=?
    `)
    const updateBatch = db.transaction((rows) => {
      for (const r of rows) {
        updateBranded.run(
          r.brand_owner || null, r.brand_name || null,
          r.serving_size ? parseFloat(r.serving_size) : null,
          r.serving_size_unit || null,
          r.household_serving_fulltext || null,
          parseInt(r.fdc_id)
        )
      }
    })
    let brandBatch = []
    let brandCount = 0
    await streamCsv(brandedFile, r => {
      brandBatch.push(r)
      if (brandBatch.length >= BATCH_SIZE) {
        updateBatch(brandBatch); brandCount += brandBatch.length; brandBatch = []
        process.stdout.write(`\r    branded info: ${brandCount}`)
      }
    })
    if (brandBatch.length) { updateBatch(brandBatch); brandCount += brandBatch.length }
    console.log(`\r    branded info: ${brandCount} updated`)
  }

  // Insert nutrients
  console.log('  Inserting nutrients …')
  const insertNutrient = db.prepare(`
    INSERT INTO food_nutrient (fdc_id, nutrient_id, nutrient_name, unit_name, amount) VALUES (?, ?, ?, ?, ?)
  `)
  const insertNutrientBatch = db.transaction((rows) => {
    for (const r of rows) insertNutrient.run(...r)
  })
  let nBatch = []
  let nCount = 0
  await streamCsv(nutrientFile, r => {
    const nutrientId = parseInt(r.nutrient_id)
    if (!NUTRIENT_IDS.has(nutrientId)) return
    const meta = nutrientNames.get(nutrientId) ?? { name: `Nutrient ${nutrientId}`, unit: '' }
    const amount = parseFloat(r.amount)
    if (isNaN(amount)) return
    const fdcId = parseInt(r.fdc_id)
    if (!fdcId || isNaN(fdcId)) return
    nBatch.push([fdcId, nutrientId, meta.name, meta.unit, amount])
    if (nBatch.length >= 2000) {
      insertNutrientBatch(nBatch); nCount += nBatch.length; nBatch = []
      process.stdout.write(`\r    nutrients: ${nCount}`)
    }
  })
  if (nBatch.length) { insertNutrientBatch(nBatch); nCount += nBatch.length }
  console.log(`\r    nutrients: ${nCount} inserted`)

  // Insert portions
  if (existsSync(portionFile)) {
    console.log('  Inserting portions …')
    const insertPortion = db.prepare(`
      INSERT INTO food_portion (fdc_id, amount, measure_unit, portion_description, gram_weight) VALUES (?, ?, ?, ?, ?)
    `)
    const insertPortionBatch = db.transaction((rows) => {
      for (const r of rows) insertPortion.run(...r)
    })
    let pBatch = []
    let pCount = 0
    await streamCsv(portionFile, r => {
      const gw = parseFloat(r.gram_weight)
      if (isNaN(gw) || gw <= 0) return
      const fdcId = parseInt(r.fdc_id)
      if (!fdcId || isNaN(fdcId)) return
      pBatch.push([
        fdcId, parseFloat(r.amount) || 1,
        r.measure_unit_name || r.measure_unit || 'serving',
        r.portion_description || null, gw
      ])
      if (pBatch.length >= BATCH_SIZE) {
        insertPortionBatch(pBatch); pCount += pBatch.length; pBatch = []
        process.stdout.write(`\r    portions: ${pCount}`)
      }
    })
    if (pBatch.length) { insertPortionBatch(pBatch); pCount += pBatch.length }
    console.log(`\r    portions: ${pCount} inserted`)
  }
}

async function buildFts(db) {
  console.log('Building FTS5 index …')
  db.exec(`
    DROP TABLE IF EXISTS food_fts;
    CREATE VIRTUAL TABLE food_fts USING fts5(
      description, brand_owner,
      content = 'food', content_rowid = 'fdc_id',
      tokenize = 'porter unicode61'
    );
    INSERT INTO food_fts(rowid, description, brand_owner)
    SELECT fdc_id, description, COALESCE(brand_owner, '') FROM food;
    CREATE TRIGGER IF NOT EXISTS food_fts_insert AFTER INSERT ON food BEGIN
      INSERT INTO food_fts(rowid, description, brand_owner)
      VALUES (new.fdc_id, new.description, COALESCE(new.brand_owner, ''));
    END;
  `)
  console.log('FTS5 index built.')
}

// ---- Main ----
const arg = process.argv[2] ?? 'sr'
const targets = arg === 'all' ? ['sr', 'foundation', 'branded'] : [arg]

console.log('Opening database:', DB_PATH)
const db = openDb()

for (const key of targets) {
  const zipMap = { sr: 'sr_legacy.zip', foundation: 'foundation.zip', branded: 'branded.zip' }
  const typeMap = { sr: 'sr_legacy_food', foundation: 'foundation_food', branded: 'branded_food' }
  const zipFile = join(RAW_DIR, zipMap[key])
  const extractOut = join(EXTRACT_DIR, key)
  mkdirSync(extractOut, { recursive: true })

  console.log(`\n=== ${key.toUpperCase()} ===`)
  const dataDir = extractZip(zipFile, extractOut)
  if (dataDir) await importDataset(db, dataDir, typeMap[key])
}

await buildFts(db)

console.log('\nBuilding indexes …')
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_food_data_type ON food(data_type);
  CREATE INDEX IF NOT EXISTS idx_food_nutrient_fdc ON food_nutrient(fdc_id);
  CREATE INDEX IF NOT EXISTS idx_food_nutrient_nid ON food_nutrient(nutrient_id);
  CREATE INDEX IF NOT EXISTS idx_food_portion_fdc ON food_portion(fdc_id);
  CREATE INDEX IF NOT EXISTS idx_plan_date ON plan(date);
  CREATE INDEX IF NOT EXISTS idx_plan_entry_plan ON plan_entry(plan_id);
  ANALYZE;
`)
db.pragma('foreign_keys = ON')
db.close()

console.log('\nImport complete! Run: node scripts/verify-db.mjs')
