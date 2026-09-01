/**
 * OAuth sign-in for a desktop app.
 *
 * There is no browser to redirect, so the flow bounces through the OS:
 *
 *   signInWithOAuth({ skipBrowserRedirect: true })  → an authorize URL
 *   shell.openExternal(url)                         → the user's real browser
 *   provider → Supabase → nutrition-planner://auth-callback?code=…
 *   the OS hands that URL back to this process      → exchangeCodeForSession
 *
 * How the callback arrives differs by platform, and both paths are needed:
 * Windows and Linux launch a *second* instance of the app with the URL in argv
 * (caught by the single-instance lock), while macOS delivers it to the running
 * instance as an `open-url` event.
 *
 * The auth code is single-use and expires after five minutes, so a stale
 * callback is a failure rather than a security problem — but the PKCE verifier
 * living only in this process is what makes the scheme safe to register at all.
 */
import { app, shell, BrowserWindow } from 'electron'
import { resolve } from 'path'
import log from 'electron-log/main'
import { getSupabase, isConfigured } from './supabase'

export const PROTOCOL = 'nutrition-planner'
const CALLBACK_URL = `${PROTOCOL}://auth-callback`

export type OAuthProvider = 'google' | 'github'

export interface AuthStatus {
  signedIn: boolean
  email: string | null
  configured: boolean
}

/**
 * Registers the app as the handler for nutrition-planner://.
 *
 * In development the executable is Electron itself, so the app path has to be
 * passed explicitly or Windows registers `electron.exe` and the callback opens
 * a bare Electron instead of this project.
 */
export function registerProtocol(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [resolve(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL)
  }
}

function extractCode(url: string): string | null {
  try {
    return new URL(url).searchParams.get('code')
  } catch {
    return null
  }
}

async function completeSignIn(url: string, win: BrowserWindow | null): Promise<void> {
  const code = extractCode(url)
  if (!code) {
    log.warn('auth callback carried no code')
    return
  }
  const { error } = await getSupabase().auth.exchangeCodeForSession(code)
  if (error) {
    log.error('code exchange failed:', error.message)
    win?.webContents.send('auth:changed', { signedIn: false, error: error.message })
    return
  }
  log.info('signed in')
  win?.webContents.send('auth:changed', await getAuthStatus())
}

/**
 * Wires up callback delivery on every platform. Must run before app.whenReady
 * so the single-instance lock is claimed before a second launch can race it.
 */
export function initAuthCallbacks(getWindow: () => BrowserWindow | null): void {
  if (!app.requestSingleInstanceLock()) {
    // A second launch — almost always the OAuth callback itself. Hand the URL to
    // the running instance (via second-instance below) and exit immediately.
    app.quit()
    return
  }

  // Windows / Linux: the callback URL arrives as an argument to a new instance.
  app.on('second-instance', (_event, argv) => {
    const win = getWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
    const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`))
    if (url) void completeSignIn(url, win)
  })

  // macOS: delivered to the already-running instance.
  app.on('open-url', (event, url) => {
    event.preventDefault()
    void completeSignIn(url, getWindow())
  })
}

export async function signIn(provider: OAuthProvider): Promise<void> {
  const { data, error } = await getSupabase().auth.signInWithOAuth({
    provider,
    options: { redirectTo: CALLBACK_URL, skipBrowserRedirect: true }
  })
  if (error) throw new Error(error.message)
  if (!data.url) throw new Error('No authorization URL returned')

  // Deliberately the system browser, never a BrowserWindow: the user needs to
  // see the provider's real address bar and certificate, and an in-app window
  // asking for a Google password is indistinguishable from a phishing page.
  await shell.openExternal(data.url)
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut()
  if (error) throw new Error(error.message)
}

export async function getAuthStatus(): Promise<AuthStatus> {
  if (!isConfigured()) return { signedIn: false, email: null, configured: false }
  const { data } = await getSupabase().auth.getSession()
  return {
    signedIn: Boolean(data.session),
    email: data.session?.user.email ?? null,
    configured: true
  }
}
