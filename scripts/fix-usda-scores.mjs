/**
 * Replaces the portion-count USDA scores with keyword-based tier scores.
 * Run: node scripts/fix-usda-scores.mjs
 */
import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', 'resources', 'nutrition.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')

console.log('Updating USDA popularity scores with keyword tiers …')

db.exec(`
  UPDATE food SET popularity_score =
    CASE
      -- Foundation foods: curated set of commonly eaten whole foods → top tier
      WHEN data_type = 'foundation_food' THEN 800

      -- Primary cuts — the first thing someone means when they type "chicken"
      WHEN data_type = 'sr_legacy_food' AND (
           lower(description) LIKE '%breast%'
        OR lower(description) LIKE '%thigh%'
        OR lower(description) LIKE '%drumstick%'
        OR lower(description) LIKE '%, wing%'
        OR lower(description) LIKE '%, whole,%'
        OR lower(description) LIKE '%, whole'
        OR lower(description) LIKE '%neck%'
      ) THEN 700

      -- Secondary whole-food forms (still useful, just less iconic)
      WHEN data_type = 'sr_legacy_food' AND (
           lower(description) LIKE '%fillet%'
        OR lower(description) LIKE '%ribeye%'
        OR lower(description) LIKE '%tenderloin%'
        OR lower(description) LIKE '%sirloin%'
        OR lower(description) LIKE '%loin%'
        OR lower(description) LIKE '%, ground,%'
        OR lower(description) LIKE '%, ground'
        OR lower(description) LIKE '%steak%'
        OR lower(description) LIKE '%chop%'
        OR lower(description) LIKE '%roast,%'
        OR lower(description) LIKE '%roast'
        OR lower(description) LIKE '%patties%'
        OR lower(description) LIKE '%cutlet%'
        OR lower(description) LIKE '%strip%'
      ) THEN 600

      -- Niche, byproduct, or heavily processed → low tier
      WHEN data_type = 'sr_legacy_food' AND (
           lower(description) LIKE '%spread%'
        OR lower(description) LIKE '%meatless%'
        OR lower(description) LIKE '%, fat%'
        OR lower(description) LIKE '%, feet%'
        OR lower(description) LIKE '%frankf%'
        OR lower(description) LIKE '%extract%'
        OR lower(description) LIKE '%giblets%'
        OR lower(description) LIKE '%gizzard%'
        OR lower(description) LIKE '%tallow%'
        OR lower(description) LIKE '%lard%'
        OR lower(description) LIKE '%liver%'
        OR lower(description) LIKE '%kidney%'
        OR lower(description) LIKE '%tripe%'
        OR lower(description) LIKE '%tongue%'
        OR lower(description) LIKE '%blood%'
        OR lower(description) LIKE '%brain%'
        OR lower(description) LIKE '%back,%'
        OR lower(description) LIKE '%, back'
        OR lower(description) LIKE '%carcass%'
        OR lower(description) LIKE '%rib,%'
        OR lower(description) LIKE '%heart%'
        OR lower(description) LIKE '%skin%'
        OR lower(description) LIKE '%, ns as%'
      ) THEN 50

      -- All other SR Legacy foods → neutral tier
      ELSE 300
    END
  WHERE data_type IN ('sr_legacy_food', 'foundation_food')
`)

const counts = db.prepare(`
  SELECT popularity_score, COUNT(*) as n
  FROM food
  WHERE data_type IN ('sr_legacy_food', 'foundation_food')
  GROUP BY popularity_score
  ORDER BY popularity_score DESC
`).all()

console.log('Score distribution:')
for (const row of counts) console.log(`  score ${row.popularity_score}: ${row.n} foods`)

db.exec('ANALYZE')
db.close()
console.log('\nDone. Restart the dev server.')
