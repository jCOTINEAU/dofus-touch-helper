/**
 * Machine à états d'une « session HDV » : saisie en série des prix d'une
 * sélection de ressources, lot par lot (×1 → ×10 → ×100), avec passage
 * automatique à la ressource suivante. Pur : l'UI applique les transitions
 * et persiste les relevés elle-même.
 */

import { LOT_SIZES, type LotSize } from './stats'

export interface SessionItem {
  itemId: number
  /** Lots à proposer dans le flux (ceux déjà suivis au moins une fois). */
  lots: LotSize[]
}

export interface SessionState {
  items: SessionItem[]
  itemIndex: number
  currentLot: LotSize
  finished: boolean
}

/** Lots triés dans l'ordre canonique ×1, ×10, ×100. */
function sortLots(lots: readonly LotSize[]): LotSize[] {
  return LOT_SIZES.filter((s) => lots.includes(s))
}

export function startSession(items: readonly SessionItem[]): SessionState {
  const cleaned = items
    .map((i) => ({ itemId: i.itemId, lots: sortLots(i.lots) }))
    .filter((i) => i.lots.length > 0)
  if (cleaned.length === 0) {
    return { items: [], itemIndex: 0, currentLot: 1, finished: true }
  }
  return { items: cleaned, itemIndex: 0, currentLot: cleaned[0].lots[0], finished: false }
}

export function currentItem(state: SessionState): SessionItem | null {
  return state.finished ? null : state.items[state.itemIndex]
}

/** Passe à la ressource suivante (ou termine la session). */
export function skipToNextItem(state: SessionState): SessionState {
  if (state.finished) return state
  const nextIndex = state.itemIndex + 1
  if (nextIndex >= state.items.length) {
    return { ...state, finished: true }
  }
  return {
    ...state,
    itemIndex: nextIndex,
    currentLot: state.items[nextIndex].lots[0],
  }
}

/**
 * Avance au lot suivant de la ressource courante (dans l'ordre canonique,
 * parmi les lots proposés), ou à la ressource suivante s'il n'y en a plus.
 */
export function advanceLot(state: SessionState): SessionState {
  const item = currentItem(state)
  if (!item) return state
  const next = item.lots.find(
    (lot) => LOT_SIZES.indexOf(lot) > LOT_SIZES.indexOf(state.currentLot),
  )
  if (next !== undefined) {
    return { ...state, currentLot: next }
  }
  return skipToNextItem(state)
}

/**
 * Sélection manuelle d'un lot de la ressource courante (y compris un lot
 * jamais suivi : il est alors ajouté aux lots proposés de la ressource,
 * pour que l'avancement automatique reste cohérent).
 */
export function selectLot(state: SessionState, lot: LotSize): SessionState {
  const item = currentItem(state)
  if (!item) return state
  if (item.lots.includes(lot)) {
    return { ...state, currentLot: lot }
  }
  const items = state.items.map((i, idx) =>
    idx === state.itemIndex ? { ...i, lots: sortLots([...i.lots, lot]) } : i,
  )
  return { ...state, items, currentLot: lot }
}

/** Position pour l'affichage de progression (1-based). */
export function progress(state: SessionState): { done: number; total: number } {
  return {
    done: state.finished ? state.items.length : state.itemIndex,
    total: state.items.length,
  }
}
