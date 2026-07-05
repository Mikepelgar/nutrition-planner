/**
 * Downloads USDA FoodData Central CSV datasets.
 * Run: node scripts/download-usda.mjs [sr|foundation|branded|all]
 */
import { createWriteStream, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAW_DIR = join(__dirname, '..', 'resources', 'usda-raw')
mkdirSync(RAW_DIR, { recursive: true })

const DATASETS = {
  sr: {
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',
    file: 'sr_legacy.zip'
  },
  foundation: {
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip',
    file: 'foundation.zip'
  },
  branded: {
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_branded_food_csv_2026-04-30.zip',
    file: 'branded.zip'
  }
}

const arg = process.argv[2] ?? 'sr'
const targets = arg === 'all' ? Object.keys(DATASETS) : [arg]

for (const key of targets) {
  const ds = DATASETS[key]
  if (!ds) { console.error(`Unknown dataset: ${key}`); process.exit(1) }

  const dest = join(RAW_DIR, ds.file)
  if (existsSync(dest)) {
    console.log(`[${key}] Already downloaded: ${ds.file}`)
    continue
  }

  console.log(`[${key}] Downloading ${ds.url} …`)
  const res = await fetch(ds.url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${ds.url}`)

  const total = parseInt(res.headers.get('content-length') ?? '0')
  let received = 0
  const out = createWriteStream(dest)
  const reader = res.body.getReader()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    out.write(value)
    received += value.length
    if (total) {
      process.stdout.write(`\r[${key}] ${((received / total) * 100).toFixed(1)}% (${(received / 1e6).toFixed(1)} MB)`)
    }
  }
  out.end()
  console.log(`\n[${key}] Saved to ${dest}`)
}

console.log('\nDone. Run: node scripts/import-usda.mjs')
