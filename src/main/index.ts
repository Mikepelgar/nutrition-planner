import { app, BrowserWindow, shell, session, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import log from 'electron-log/main'
import { getDb, closeDb } from './db/database'
import { registerFoodIPC } from './ipc/food.ipc'
import { registerPlanIPC } from './ipc/plan.ipc'
import { registerProfileIPC } from './ipc/profile.ipc'
import { registerAiIPC } from './ipc/ai.ipc'
import { registerAuthIPC } from './ipc/auth.ipc'
import { registerLogIPC } from './ipc/log.ipc'
import { registerQuickAddIPC } from './ipc/quickadd.ipc'
import { registerFavoritesIPC } from './ipc/favorites.ipc'
import { registerTrackingIPC } from './ipc/tracking.ipc'
import { registerExportIPC } from './ipc/export.ipc'
import { registerExerciseIPC } from './ipc/exercise.ipc'
import { registerRemindersIPC } from './ipc/reminders.ipc'
import { startReminders } from './services/reminders.service'
import { initUpdater, registerUpdaterIPC } from './services/updater.service'
import { registerProtocol, initAuthCallbacks } from './services/auth.service'

// Logging & global crash handling
log.initialize()
log.transports.file.level = 'info'
log.transports.console.level = is.dev ? 'debug' : 'warn'
log.info(`Nutrition Planner ${app.getVersion()} starting (dev=${is.dev})`)

process.on('uncaughtException', (err) => {
  log.error('uncaughtException:', err)
  if (app.isReady()) dialog.showErrorBox('Unexpected error', String((err as Error)?.message ?? err))
})
process.on('unhandledRejection', (reason) => {
  log.error('unhandledRejection:', reason)
})

/**
 * Wrap `ipcMain.handle` once so every handler's failures are logged centrally
 * (then re-thrown so the renderer still receives the rejection as before).
 * A single chokepoint avoids touching every IPC module.
 */
function installIpcErrorLogging(): void {
  const original = ipcMain.handle.bind(ipcMain)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ipcMain.handle = ((channel: string, listener: (...a: any[]) => any) => {
    original(channel, async (event, ...args) => {
      try {
        return await listener(event, ...args)
      } catch (err) {
        log.error(`IPC "${channel}" failed:`, err)
        throw err
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any
}

// Held at module scope so the OAuth callback can reach the window from outside
// whenReady — the callback can arrive before or after the window exists.
let mainWindow: BrowserWindow | null = null

// Both must run before whenReady: the single-instance lock has to be claimed
// before a callback launch can race it, and the protocol has to be registered
// for the OS to route nutrition-planner:// back here at all.
registerProtocol()
initAuthCallbacks(() => mainWindow)

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    backgroundColor: '#030712',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Hardened defaults: renderer is sandboxed and context-isolated, with no
      // Node integration. The preload only uses contextBridge + ipcRenderer,
      // which are sandbox-safe.
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  win.on('ready-to-show', () => win.show())

  // Open external links in the system browser; never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Block navigation away from the app's own content; route external URLs to
  // the system browser instead.
  win.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if ((is.dev && devUrl && url.startsWith(devUrl)) || url.startsWith('file://')) return
    event.preventDefault()
    shell.openExternal(url)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

/**
 * Strict Content-Security-Policy for production. The renderer makes NO external
 * network requests (all AI traffic goes through the main process via the SDKs),
 * so 'self' suffices. Skipped in dev, where Vite's HMR needs inline/eval/ws.
 */
function applyContentSecurityPolicy(): void {
  if (is.dev) return
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data:; font-src 'self' data:; connect-src 'self'; " +
            "object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        ]
      }
    })
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.nutritionplanner.app')

  applyContentSecurityPolicy()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Log all IPC handler errors centrally — must run before any handler registers.
  installIpcErrorLogging()

  // Init DB and register all IPC handlers
  try {
    getDb()
  } catch (err) {
    log.error('Database init failed:', err)
    dialog.showErrorBox('Database error', 'The nutrition database could not be opened. See logs for details.')
  }
  registerFoodIPC()
  registerPlanIPC()
  registerProfileIPC()
  registerAiIPC()
  registerAuthIPC()
  registerLogIPC()
  registerQuickAddIPC()
  registerFavoritesIPC()
  registerTrackingIPC()
  registerExportIPC()
  registerExerciseIPC()
  registerRemindersIPC()
  ipcMain.handle('app:version', () => app.getVersion())
  registerUpdaterIPC()
  startReminders()

  mainWindow = createWindow()
  initUpdater(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') app.quit()
})
