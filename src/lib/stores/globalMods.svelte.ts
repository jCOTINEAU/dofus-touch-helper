/**
 * Modificateurs globaux appliqués à tous les combats (BoosterPack, double
 * joueur, butins conditionnels). Persistés en localStorage.
 */

import { DEFAULT_MODS, type GlobalMods } from '../combats/effectiveLoots'

const KEY = 'dofus-craft:global-mods'

function read(): GlobalMods {
  try {
    return { ...DEFAULT_MODS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...DEFAULT_MODS }
  }
}

let mods = $state<GlobalMods>(read())

export const globalMods = {
  get value(): GlobalMods {
    return mods
  },
  set(patch: Partial<GlobalMods>) {
    mods = { ...mods, ...patch }
    localStorage.setItem(KEY, JSON.stringify(mods))
  },
}
