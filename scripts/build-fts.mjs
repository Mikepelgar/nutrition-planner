/**
 * Rebuilds the FTS5 search index and creates indexes on an already-populated nutrition.db.
 * Run this if the main import completed data but crashed before buildFts().
 */
import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', 'resources', 'nutrition.db')

console.log('Opening database:', DB_PATH)
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('busy_timeout = 30000')

const foodCount = db.prepare('SELECT COUNT(*) as n FROM food').get().n
console.log(`Building FTS5 index over ${foodCount.toLocaleString()} foods …`)

db.exec(`DROP TABLE IF EXISTS food_fts;`)

db.exec(`
  CREATE VIRTUAL TABLE food_fts USING fts5(
    description, brand_owner,
    content = 'food', content_rowid = 'fdc_id',
    tokenize = 'porter unicode61'
  );
`)

console.log('Inserting into FTS5 (this takes a few minutes for 2M foods) …')

// Insert in batches to avoid OOM
const BATCH = 50000
let offset = 0
const stmt = db.prepare('SELECT fdc_id, description, brand_owner FROM food LIMIT ? OFFSET ?')
const insert = db.prepare('INSERT INTO food_fts(rowid, description, brand_owner) VALUES (?, ?, ?)')
const insertBatch = db.transaction((rows) => {
  for (const r of rows) insert.run(r.fdc_id, r.description, r.brand_owner ?? '')
})

while (offset < foodCount) {
  const rows = stmt.all(BATCH, offset)
  if (rows.length === 0) break
  insertBatch(rows)
  offset += rows.length
  process.stdout.write(`\r  ${offset.toLocaleString()} / ${foodCount.toLocaleString()} inserted`)
}
console.log('\nFTS5 index built.')

db.exec(`
  CREATE TRIGGER IF NOT EXISTS food_fts_insert AFTER INSERT ON food BEGIN
    INSERT INTO food_fts(rowid, description, brand_owner)
    VALUES (new.fdc_id, new.description, COALESCE(new.brand_owner, ''));
  END;
`)

console.log('Building indexes …')
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
console.log('\nDone! Run: node scripts/verify-db.mjs')
