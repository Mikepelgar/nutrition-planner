import { autoUpdater } from 'electron-updater'
import { ipcMain, type BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import log from 'electron-log/main'

/**
 * Auto-update wiring. Inert until a `publish` feed + a published release exist
 * (configured in electron-builder.yml). Disabled entirely in dev. Errors are
 * non-fatal (logged), so a missing feed never crashes the app.
 */
export function initUpdater(win: BrowserWindow): void {
  if (is.dev) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autoUpdater.logger = log as any
  autoUpdater.autoDownload = true
  autoUpdater.on('update-available', (info) => win.webContents.send('update:available', { version: info.version }))
  autoUpdater.on('update-downloaded', (info) => win.webContents.send('update:downloaded', { version: info.version }))
  autoUpdater.on('error', (err) => log.warn('Updater error (non-fatal):', err?.message ?? err))
  autoUpdater.checkForUpdates().catch((e) => log.warn('Update check failed (no publish feed yet?):', e?.message ?? e))
}

export function registerUpdaterIPC(): void {
  ipcMain.handle('update:check', async () => {
    if (is.dev) return { status: 'dev' as const }
    try {
      const r = await autoUpdater.checkForUpdates()
      return { status: 'checked' as const, version: r?.updateInfo?.version }
    } catch (e) {
      return { status: 'error' as const, message: (e as Error).message }
    }
  })
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall()
    return { success: true }
  })
}
