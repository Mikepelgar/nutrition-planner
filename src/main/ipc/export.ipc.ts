import { ipcMain, dialog } from 'electron'
import { writeFileSync } from 'fs'
import { getDb } from '../db/database'
import { getProfile } from '../db/queries/profile.queries'
import { asEnum } from './validate'

interface ExportRow {
  date: string
  meal: string
  food: string
  amount: number
  unit: string
  grams: number
}

export function registerExportIPC(): void {
  ipcMain.handle('export:data', async (_e, p: { format: 'json' | 'csv' }) => {
    const format = asEnum(p?.format, 'format', ['json', 'csv'] as const)
    const db = getDb()
    const entries = db.prepare(`
      SELECT pl.date AS date, pe.meal AS meal, pe.food_description AS food,
             pe.serving_amount AS amount, pe.serving_unit AS unit, pe.grams AS grams
      FROM plan_entry pe
      JOIN plan pl ON pl.id = pe.plan_id
      ORDER BY pl.date ASC, pe.position ASC
    `).all() as ExportRow[]

    const stamp = new Date().toISOString().slice(0, 10)
    const res = await dialog.showSaveDialog({
      defaultPath: `nutrition-export-${stamp}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }]
    })
    if (res.canceled || !res.filePath) return { success: false }

    if (format === 'csv') {
      const header = 'date,meal,food,amount,unit,grams'
      const rows = entries.map(e =>
        [e.date, e.meal, `"${String(e.food).replace(/"/g, '""')}"`, e.amount, e.unit, Math.round(e.grams)].join(',')
      )
      writeFileSync(res.filePath, [header, ...rows].join('\n'), 'utf8')
    } else {
      const profile = getProfile(db)
      const weight = db.prepare('SELECT date, weight_kg AS weightKg FROM weight_log ORDER BY date ASC').all()
      const payload = { exportedAt: new Date().toISOString(), profile, entries, weight }
      writeFileSync(res.filePath, JSON.stringify(payload, null, 2), 'utf8')
    }
    return { success: true, path: res.filePath }
  })
}
