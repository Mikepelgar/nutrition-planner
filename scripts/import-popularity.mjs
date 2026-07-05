/**
 * Adds popularity scores to the nutrition database:
 *   - Branded foods: Open Food Facts unique_scans_n (barcode scan count)
 *   - Whole foods:   USDA portion-definition count (proxy for commonality)
 *
 * Run: node scripts/import-popularity.mjs
 * Prerequisites: USDA data already imported (import-usda.mjs)
 *
 * Time estimate: ~35–50 min (mostly Phase 3–4: 2 GB OFF download + parse)
 */
import Database from 'better-sqlite3'
import { parse } from 'csv-parse'
import { createReadStream, createWriteStream, existsSync, readdirSync } from 'fs'
import { createGunzip } from 'zlib'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAW_DIR   = join(__dirname, '..', 'resources', 'usda-raw')
const DB_PATH   = join(__dirname, '..', 'resources', 'nutrition.db')
const OFF_GZ    = join(RAW_DIR,   'openfoodfacts.csv.gz')
const OFF_URL   = 'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz'

const MIN_SCANS  = 5      // ignore products with fewer scans (noise filter)
const BATCH_SIZE = 2000

// ── helpers ──────────────────────────────────────────────────────────────────

function findBrandedCsv() {
  const dir = join(RAW_DIR, 'extracted', 'branded')
  if (!existsSync(dir)) return null
  const sub = readdirSync(dir, { withFileTypes: true }).find(e => e.isDirectory())
  if (!sub) return null
  const p = join(dir, sub.name, 'branded_food.csv')
  return existsSync(p) ? p : null
}

/** Strip leading zeros so "00012345" === "12345" for matching. */
function normalizeGtin(g) {
  if (!g) return null
  const s = g.toString().trim().replace(/^0+/, '')
  return s || null
}

function streamCsv(filePath, delimiter, onRecord) {
  return new Promise((resolve, reject) => {
    const p = parse({ columns: true, skip_empty_lines: true, trim: true,
                      relax_column_count: true, delimiter })
    p.on('readable', () => { let r; while ((r = p.read()) !== null) onRecord(r) })
    p.on('error', reject)
    p.on('end', resolve)
    createReadStream(filePath).pipe(p)
  })
}

function streamGzCsv(filePath, delimiter, onRecord, pickColumns = null) {
  return new Promise((resolve, reject) => {
    const p = parse({
      columns: true,
      skip_empty_lines: true,
      trim: false,                    // skip trimming all 150 OFF columns
      relax_column_count: true,
      relax_quotes: true,
      skip_records_with_error: true,
      delimiter,
      // Slim each record to only the fields we need *before* it is emitted —
      // this prevents holding 150-column OFF objects in memory
      on_record: pickColumns ? (r) => pickColumns(r) : undefined
    })
    p.on('readable', () => { let r; while ((r = p.read()) !== null) onRecord(r) })
    p.on('skip', () => { /* malformed row — ignore */ })
    p.on('error', reject)
    p.on('end', resolve)
    createReadStream(filePath).pipe(createGunzip()).pipe(p)
  })
}

async function downloadFile(url, dest) {
  console.log(`  Downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  const total = parseInt(res.headers.get('content-length') ?? '0')
  let received = 0
  const out = createWriteStream(dest)
  const reader = res.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    out.write(value)
    received += value.length
    if (total) process.stdout.write(
      `\r  ${((received / total) * 100).toFixed(1)}%  (${(received / 1e6).toFixed(0)} / ${(total / 1e6).toFixed(0)} MB)`
    )
  }
  await new Promise(r => out.end(r))
  console.log(`\n  Saved to ${dest}`)
}

// ── main ─────────────────────────────────────────────────────────────────────

console.log('Opening database:', DB_PATH)
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('synchronous  = NORMAL')
db.pragma('busy_timeout = 30000')

// ── Phase 1: schema migration ────────────────────────────────────────────────
console.log('\n[1/5] Ensuring schema columns exist …')
try { db.exec('ALTER TABLE food ADD COLUMN gtin_upc TEXT') }
catch { /* already exists */ }
try { db.exec('ALTER TABLE food ADD COLUMN popularity_score INTEGER NOT NULL DEFAULT 0') }
catch { /* already exists */ }
console.log('  OK')

// ── Phase 2: USDA GTIN population ────────────────────────────────────────────
const brandedCsv = findBrandedCsv()
if (!brandedCsv) {
  console.error('ERROR: branded_food.csv not found. Run import-usda.mjs branded first.')
  process.exit(1)
}
console.log(`\n[2/5] Reading GTINs from ${brandedCsv} …`)

const writeGtin  = db.prepare('UPDATE food SET gtin_upc = ? WHERE fdc_id = ?')
const flushGtins = db.transaction(rows => { for (const r of rows) writeGtin.run(r[0], r[1]) })

let buf = [], gtinTotal = 0
await streamCsv(brandedCsv, ',', r => {
  const gtin  = normalizeGtin(r.gtin_upc)
  const fdcId = parseInt(r.fdc_id)
  if (!gtin || !fdcId || isNaN(fdcId)) return
  buf.push([gtin, fdcId])
  if (buf.length >= BATCH_SIZE) {
    flushGtins(buf); gtinTotal += buf.length; buf = []
    process.stdout.write(`\r  ${gtinTotal.toLocaleString()} GTINs`)
  }
})
if (buf.length) { flushGtins(buf); gtinTotal += buf.length }
console.log(`\r  ${gtinTotal.toLocaleString()} GTINs written`)

db.exec('CREATE INDEX IF NOT EXISTS idx_food_gtin ON food(gtin_upc) WHERE gtin_upc IS NOT NULL')
console.log('  GTIN index created')

// ── Phase 3: download Open Food Facts ────────────────────────────────────────
console.log('\n[3/5] Open Food Facts …')
if (existsSync(OFF_GZ)) {
  console.log(`  Already cached: ${OFF_GZ}`)
} else {
  await downloadFile(OFF_URL, OFF_GZ)
}

// ── Phase 4: parse OFF → popularity_score ────────────────────────────────────
console.log('\n[4/5] Streaming Open Food Facts CSV (10–20 min) …')

// Load gtin → scanCount into memory (~50–100 MB for 1–2M qualifying products)
const gtinScores = new Map()
let offRows = 0

// Only keep the 2 columns we need — drops 150+ others before they hit memory
const offPick = r => ({ code: r.code, scans: r.unique_scans_n ?? r['unique-scans-n'] ?? '0' })

await streamGzCsv(OFF_GZ, '\t', r => {
  offRows++
  if (offRows % 250_000 === 0) {
    process.stdout.write(
      `\r  ${(offRows / 1e6).toFixed(2)}M rows read  |  ${gtinScores.size.toLocaleString()} products matched`
    )
  }
  const gtin = normalizeGtin(r.code)
  if (!gtin) return
  const raw   = r.scans ?? '0'
  const scans = Math.min(parseInt(raw.replace(/,/g, '')) || 0, 1_000_000)
  if (scans >= MIN_SCANS) gtinScores.set(gtin, scans)
}, offPick)  // ← slim each record to 2 fields before it enters the stream
console.log(
  `\n  Finished: ${(offRows / 1e6).toFixed(2)}M OFF rows  |  ` +
  `${gtinScores.size.toLocaleString()} products with ≥${MIN_SCANS} scans`
)

// Batch-update our food table
const writeScore  = db.prepare('UPDATE food SET popularity_score = ? WHERE gtin_upc = ?')
const flushScores = db.transaction(rows => { for (const r of rows) writeScore.run(r[0], r[1]) })

buf = []; let scoreUpdates = 0
for (const [gtin, score] of gtinScores) {
  buf.push([score, gtin])
  if (buf.length >= BATCH_SIZE) { flushScores(buf); scoreUpdates += buf.length; buf = [] }
}
if (buf.length) { flushScores(buf); scoreUpdates += buf.length }
console.log(`  ${scoreUpdates.toLocaleString()} branded foods scored`)

// ── Phase 5: score USDA whole foods by portion count ─────────────────────────
console.log('\n[5/5] Scoring USDA whole foods by portion-definition count …')
db.exec(`
  UPDATE food
  SET popularity_score = MIN(
    (SELECT COUNT(*) * 30 FROM food_portion WHERE food_portion.fdc_id = food.fdc_id),
    900
  )
  WHERE data_type IN ('sr_legacy_food', 'foundation_food')
`)
const { n: usdaScored } = db.prepare(`
  SELECT COUNT(*) AS n FROM food
  WHERE data_type IN ('sr_legacy_food','foundation_food') AND popularity_score > 0
`).get()
console.log(`  ${usdaScored} USDA foods scored (max 900, step 30 per defined portion)`)

// ── Final: index + analyze ────────────────────────────────────────────────────
console.log('\nBuilding popularity index …')
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_food_popularity
    ON food(popularity_score DESC) WHERE popularity_score > 0;
  ANALYZE;
`)
db.pragma('foreign_keys = ON')
db.close()

console.log('\nDone! Run the app to see updated search ranking.')
console.log('(Restart dev server if it is already running)')
