import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Food
  foodSearch: (payload: { query: string; limit?: number; offset?: number }) =>
    ipcRenderer.invoke('food:search', payload),
  foodDetail: (payload: { fdcId: number }) =>
    ipcRenderer.invoke('food:detail', payload),
  foodByBarcode: (payload: { upc: string }) =>
    ipcRenderer.invoke('food:byBarcode', payload),

  // Plan
  planGetOrCreate: (payload: { date: string }) =>
    ipcRenderer.invoke('plan:getOrCreate', payload),
  planGetEntries: (payload: { planId: number }) =>
    ipcRenderer.invoke('plan:getEntries', payload),
  planAddEntry: (payload: { planId: number; fdcId: number; servingUnit: string; servingAmount: number; grams: number; meal?: string }) =>
    ipcRenderer.invoke('plan:addEntry', payload),
  planUpdateEntry: (payload: { entryId: number; servingUnit: string; servingAmount: number; grams: number; meal?: string }) =>
    ipcRenderer.invoke('plan:updateEntry', payload),
  planDeleteEntry: (payload: { entryId: number }) =>
    ipcRenderer.invoke('plan:deleteEntry', payload),
  planCopyDay: (payload: { sourceDate: string; targetDate: string }) =>
    ipcRenderer.invoke('plan:copyDay', payload),

  // Profile
  profileGet: () =>
    ipcRenderer.invoke('profile:get'),
  profileSave: (profile: unknown) =>
    ipcRenderer.invoke('profile:save', profile),

  // AI
  aiStartStream: (payload: {
    messageId: string
    prompt: string
    mode: string
    style: string
    budgetMode?: boolean
    easyPrepMode?: boolean
    date: string
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
  }) =>
    ipcRenderer.invoke('ai:startStream', payload),
  aiCancelStream: (payload: { messageId: string }) =>
    ipcRenderer.invoke('ai:cancelStream', payload),
  aiWeeklyReview: (payload: { messageId: string; date: string }) =>
    ipcRenderer.invoke('ai:weeklyReview', payload),
  aiPlanDay: (payload: { messageId: string; date: string; mode?: string; style?: string; budgetMode?: boolean; easyPrepMode?: boolean }) =>
    ipcRenderer.invoke('ai:planDay', payload),
  aiGetContext: (payload: { date: string; mode: string; style: string; budgetMode?: boolean; easyPrepMode?: boolean }) =>
    ipcRenderer.invoke('ai:getContext', payload),
  aiStatus: () =>
    ipcRenderer.invoke('ai:status'),

  // Account (AI runs through the hosted proxy, which needs a signed-in user)
  authSignIn: (payload: { provider: 'google' | 'github' }) =>
    ipcRenderer.invoke('auth:signIn', payload),
  authSignOut: () =>
    ipcRenderer.invoke('auth:signOut'),
  authStatus: () =>
    ipcRenderer.invoke('auth:status'),

  // Quick Add
  quickAddGetRecent: (payload?: { cutoffDate?: string }) =>
    ipcRenderer.invoke('quickadd:getRecent', payload),

  // Favorites
  favoritesGet: () =>
    ipcRenderer.invoke('favorites:get'),
  favoritesGetIds: () =>
    ipcRenderer.invoke('favorites:getIds'),
  favoritesToggle: (payload: { fdcId: number; foodDescription: string; servingUnit: string; servingAmount: number; grams: number }) =>
    ipcRenderer.invoke('favorites:toggle', payload),

  // Log
  logGetDailyLogs: (payload: { startDate: string; endDate: string }) =>
    ipcRenderer.invoke('log:getDailyLogs', payload),
  logGetNutrientBreakdown: (payload: { startDate: string; endDate: string }) =>
    ipcRenderer.invoke('log:getNutrientBreakdown', payload),

  // Weight & water tracking
  weightSet: (payload: { date: string; weightKg: number }) =>
    ipcRenderer.invoke('weight:set', payload),
  weightGetRange: (payload: { startDate: string; endDate: string }) =>
    ipcRenderer.invoke('weight:getRange', payload),
  weightLatest: () =>
    ipcRenderer.invoke('weight:latest'),
  waterGet: (payload: { date: string }) =>
    ipcRenderer.invoke('water:get', payload),
  waterGetRange: (payload: { startDate: string; endDate: string }) =>
    ipcRenderer.invoke('water:getRange', payload),
  waterAdd: (payload: { date: string; deltaMl: number }) =>
    ipcRenderer.invoke('water:add', payload),

  // Exercise
  exerciseAdd: (payload: { date: string; name: string; caloriesBurned: number; durationMin?: number }) =>
    ipcRenderer.invoke('exercise:add', payload),
  exerciseGetForDate: (payload: { date: string }) =>
    ipcRenderer.invoke('exercise:getForDate', payload),
  exerciseDelete: (payload: { id: number }) =>
    ipcRenderer.invoke('exercise:delete', payload),
  exerciseCaloriesForDate: (payload: { date: string }) =>
    ipcRenderer.invoke('exercise:caloriesForDate', payload),
  exerciseGetRange: (payload: { startDate: string; endDate: string }) =>
    ipcRenderer.invoke('exercise:getRange', payload),

  // App
  appVersion: () => ipcRenderer.invoke('app:version'),

  // Updates
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  onUpdateAvailable: (cb: (data: { version: string }) => void) => {
    const handler = (_: unknown, data: { version: string }) => cb(data)
    ipcRenderer.on('update:available', handler)
    return () => ipcRenderer.removeListener('update:available', handler)
  },
  onUpdateDownloaded: (cb: (data: { version: string }) => void) => {
    const handler = (_: unknown, data: { version: string }) => cb(data)
    ipcRenderer.on('update:downloaded', handler)
    return () => ipcRenderer.removeListener('update:downloaded', handler)
  },

  // Reminders
  remindersGet: () => ipcRenderer.invoke('reminders:get'),
  remindersSet: (prefs: unknown) => ipcRenderer.invoke('reminders:set', prefs),

  // Export
  exportData: (payload: { format: 'json' | 'csv' }) =>
    ipcRenderer.invoke('export:data', payload),

  // Event listeners (return cleanup function)
  onAiChunk: (cb: (data: { messageId: string; chunk: string }) => void) => {
    const handler = (_: unknown, data: { messageId: string; chunk: string }) => cb(data)
    ipcRenderer.on('ai:chunk', handler)
    return () => ipcRenderer.removeListener('ai:chunk', handler)
  },
  onAiDone: (cb: (data: { messageId: string }) => void) => {
    const handler = (_: unknown, data: { messageId: string }) => cb(data)
    ipcRenderer.on('ai:done', handler)
    return () => ipcRenderer.removeListener('ai:done', handler)
  },
  onAiError: (cb: (data: { messageId: string; code: string; message: string }) => void) => {
    const handler = (_: unknown, data: { messageId: string; code: string; message: string }) => cb(data)
    ipcRenderer.on('ai:error', handler)
    return () => ipcRenderer.removeListener('ai:error', handler)
  },

  // Sign-in completes out of band — the OAuth callback returns through the OS,
  // not through the invoke that opened the browser.
  onAuthChanged: (cb: (data: { signedIn: boolean; email?: string | null; error?: string }) => void) => {
    const handler = (_: unknown, data: { signedIn: boolean; email?: string | null; error?: string }) => cb(data)
    ipcRenderer.on('auth:changed', handler)
    return () => ipcRenderer.removeListener('auth:changed', handler)
  }
})
