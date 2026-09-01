import { ipcMain } from 'electron'
import { signIn, signOut, getAuthStatus, type OAuthProvider } from '../services/auth.service'
import { asEnum } from './validate'

const PROVIDERS = ['google', 'github'] as const

export function registerAuthIPC(): void {
  // Returns once the browser has been opened, not once sign-in completes — the
  // callback arrives asynchronously through the protocol handler, which pushes
  // 'auth:changed' to the renderer.
  ipcMain.handle('auth:signIn', async (_event, payload: { provider: string }) => {
    const provider = asEnum(payload?.provider, 'provider', PROVIDERS) as OAuthProvider
    await signIn(provider)
    return { success: true }
  })

  ipcMain.handle('auth:signOut', async () => {
    await signOut()
    return { success: true }
  })

  ipcMain.handle('auth:status', () => getAuthStatus())
}
