import { create } from 'zustand'

export interface FavoriteToggleItem {
  fdcId: number
  foodDescription: string
  servingUnit: string
  servingAmount: number
  grams: number
}

interface FavoritesState {
  ids: Set<number>
  loaded: boolean

  /** Idempotent — fetches favorite ids once; later calls are no-ops. */
  load: () => Promise<void>
  /** Toggles a favorite and returns the new state. */
  toggle: (item: FavoriteToggleItem) => Promise<boolean>
}

/**
 * Single source of truth for which foods are starred. Search results, the
 * History tab, and the Faves tab all read from here, so toggling in one
 * place is reflected everywhere immediately (previously each component
 * fetched its own copy and went stale).
 */
export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: new Set(),
  loaded: false,

  load: async () => {
    if (get().loaded) return
    const ids = await window.api.favoritesGetIds()
    set({ ids: new Set(ids), loaded: true })
  },

  toggle: async (item) => {
    const { isFavorite } = await window.api.favoritesToggle(item)
    set(state => {
      const ids = new Set(state.ids)
      if (isFavorite) ids.add(item.fdcId)
      else ids.delete(item.fdcId)
      return { ids }
    })
    return isFavorite
  }
}))
