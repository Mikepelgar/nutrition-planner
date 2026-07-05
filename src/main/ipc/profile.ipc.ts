import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { getProfile, saveProfile } from '../db/queries/profile.queries'
import type { UserProfile } from '../../renderer/src/lib/types'

export function registerProfileIPC(): void {
  ipcMain.handle('profile:get', () => {
    return getProfile(getDb())
  })

  ipcMain.handle('profile:save', (_event, profile: UserProfile) => {
    return saveProfile(getDb(), profile)
  })
}
