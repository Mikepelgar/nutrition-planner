import { _electron as electron } from 'playwright-core'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ELECTRON_BIN = path.join(ROOT, 'node_modules/electron/dist/electron.exe')

const app = await electron.launch({ executablePath: ELECTRON_BIN, args: [ROOT], timeout: 30_000 })
await new Promise(r => setTimeout(r, 5000))
const page = app.windows().find(w => !w.url().startsWith('devtools://')) ?? await app.firstWindow()

// Go to Log tab
await page.evaluate(() => [...document.querySelectorAll('nav button')].find(b => b.textContent?.includes('Log'))?.click())
await new Promise(r => setTimeout(r, 800))
await page.screenshot({ path: path.join(ROOT, 'scripts/log-collapsed.png') })

// Expand the first row
await page.evaluate(() => {
  const cards = document.querySelectorAll('.bg-gray-900 button')
  cards[0]?.click()
})
await new Promise(r => setTimeout(r, 1500)) // wait for nutrient fetch
await page.screenshot({ path: path.join(ROOT, 'scripts/log-expanded.png') })

await app.close()
console.log('Done')
