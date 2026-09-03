/**
 * OAuth sign-in for a desktop app, over a loopback redirect.
 *
 *   signInWithOAuth({ skipBrowserRedirect: true })  → an authorize URL
 *   shell.openExternal(url)                         → the user's real browser
 *   provider → Supabase → http://127.0.0.1:PORT/auth-callback?code=…
 *   the local server below                          → exchangeCodeForSession
 *
 * The obvious alternative — registering a `nutrition-planner://` scheme and
 * catching the callback through the OS — does not survive contact with real
 * browsers. Chrome refuses to launch an external protocol from a server
 * redirect without a user gesture, and does it silently: the tab just goes
 * blank. It only appears to work for a user who is not yet signed in to the
 * provider, because their click on "Authorize" supplies the gesture.
 *
 * A loopback address is an ordinary HTTP URL, so nothing special happens at the
 * browser boundary. This is also what RFC 8252 recommends for native apps.
 *
 * The port is fixed so the redirect URL can be allowlisted exactly in the
 * Supabase dashboard; an ephemeral port would force a wildcard entry, which
 * would let any local port receive auth codes.
 */
import { app, shell, BrowserWindow } from 'electron'
import { createServer, type Server } from 'http'
import log from 'electron-log/main'
import { getSupabase, isConfigured } from './supabase'

/** Unusual enough to be free, stable enough to allowlist. */
export const CALLBACK_PORT = 54331
const CALLBACK_PATH = '/auth-callback'
export const CALLBACK_URL = `http://127.0.0.1:${CALLBACK_PORT}${CALLBACK_PATH}`

export type OAuthProvider = 'google' | 'github'

export interface AuthStatus {
  signedIn: boolean
  email: string | null
  configured: boolean
}

/** Shown in the browser tab the user is left looking at. */
function resultPage(title: string, detail: string): string {
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#0b0f14;color:#e6edf3">
<div style="text-align:center;max-width:28rem;padding:2rem">
<h1 style="font-size:1.25rem;margin:0 0 .5rem">${title}</h1>
<p style="color:#8b949e;margin:0">${detail}</p></div>`
}

let server: Server | null = null

function stopServer(): void {
  server?.close()
  server = null
}

/**
 * Serves exactly one callback, then shuts down. Leaving a listener running
 * between sign-ins would be a standing local endpoint that anything on the
 * machine could post codes at.
 */
function listenForCallback(win: BrowserWindow | null): Promise<void> {
  stopServer()

  return new Promise((resolve, reject) => {
    server = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', CALLBACK_URL)
      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404).end()
        return
      }

      const code = url.searchParams.get('code')
      // Present whenever more than one sign-in has been started without
      // finishing; each attempt leaves its own PKCE verifier behind, and the
      // flow id is what tells the exchange which one belongs to this code.
      const flowId = url.searchParams.get('sb_flow_id')
      const providerError = url.searchParams.get('error_description') ?? url.searchParams.get('error')

      const finish = (title: string, detail: string): void => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(resultPage(title, detail))
        setImmediate(stopServer)
      }

      if (providerError) {
        log.error('provider returned an error:', providerError)
        win?.webContents.send('auth:changed', { signedIn: false, error: providerError })
        finish('Sign-in failed', providerError)
        reject(new Error(providerError))
        return
      }

      if (!code) {
        log.warn('callback carried no code')
        finish('Sign-in failed', 'The provider sent no authorization code.')
        reject(new Error('No authorization code'))
        return
      }

      log.info(`auth callback received (flow=${flowId ? 'yes' : 'no'})`)
      const { error } = await getSupabase().auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined
      )

      if (error) {
        log.error('code exchange failed:', error.message)
        win?.webContents.send('auth:changed', { signedIn: false, error: error.message })
        finish('Sign-in failed', error.message)
        reject(new Error(error.message))
        return
      }

      log.info('signed in')
      win?.webContents.send('auth:changed', await getAuthStatus())
      finish('Signed in', 'You can close this tab and return to Nutrition Planner.')
      resolve()
    })

    server.on('error', (err) => {
      log.error('callback server failed to start:', err.message)
      reject(err)
    })

    // Loopback only: binding 0.0.0.0 would expose the callback to the network.
    server.listen(CALLBACK_PORT, '127.0.0.1', () => {
      log.info(`listening for auth callback on ${CALLBACK_URL}`)
    })
  })
}

export async function signIn(provider: OAuthProvider): Promise<void> {
  const { data, error } = await getSupabase().auth.signInWithOAuth({
    provider,
    options: { redirectTo: CALLBACK_URL, skipBrowserRedirect: true }
  })
  if (error) throw new Error(error.message)
  if (!data.url) throw new Error('No authorization URL returned')

  const win = BrowserWindow.getAllWindows()[0] ?? null
  // Start listening before the browser opens, or a fast provider round trip can
  // arrive before there is anything to receive it.
  void listenForCallback(win).catch(() => {
    /* already reported to the renderer and the log */
  })

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

/** Single-instance lock, kept for its own sake: two copies sharing one SQLite
 *  file and one reminder scheduler is its own bug. */
export function claimSingleInstance(): boolean {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return false
  }
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
  return true
}

app.on('will-quit', stopServer)
