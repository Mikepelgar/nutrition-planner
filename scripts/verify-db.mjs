import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', 'resources', 'nutrition.db')

const db = new Database(DB_PATH, { readonly: true })

const tables = ['food', 'food_nutrient', 'food_portion']
for (const t of tables) {
  const { count } = db.prepare(`SELECT COUNT(*) AS count FROM ${t}`).get()
  console.log(`${t}: ${count.toLocaleString()} rows`)
}

const byType = db.prepare(`SELECT data_type, COUNT(*) AS count FROM food GROUP BY data_type ORDER BY count DESC`).all()
console.log('\nFood by dataset:')
for (const row of byType) console.log(`  ${row.data_type}: ${row.count.toLocaleString()}`)

// Sample search
const sample = db.prepare(`
  SELECT f.fdc_id, f.description, fn.amount
  FROM food_fts
  JOIN food f ON food_fts.rowid = f.fdc_id
  JOIN food_nutrient fn ON fn.fdc_id = f.fdc_id AND fn.nutrient_id = 1008
  WHERE food_fts MATCH '"chicken"* "breast"*'
  ORDER BY rank LIMIT 3
`).all()
console.log('\nSample search "chicken breast":')
for (const r of sample) console.log(`  [${r.fdc_id}] ${r.description} — ${r.amount} kcal/100g`)

db.close()
