import { create } from 'zustand'
import type { UserProfile, MacroTargets } from '../lib/types'
import { calcMacroTargets as calcMacros } from '../../../shared/macros'

interface ProfileState {
  profile: UserProfile | null
  macroTargets: MacroTargets | null
  loaded: boolean
  load: () => Promise<void>
  save: (p: UserProfile) => Promise<void>
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  macroTargets: null,
  loaded: false,

  load: async () => {
    const profile = await window.api.profileGet()
    set({
      profile,
      macroTargets: profile ? calcMacros(profile) : null,
      loaded: true
    })
  },

  save: async (profile) => {
    await window.api.profileSave(profile)
    set({ profile, macroTargets: calcMacros(profile) })
  }
}))
