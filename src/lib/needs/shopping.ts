/** Liste de courses globale : cumul des besoins de chaque projet. */

import type { NeedsResult } from './needs'

/** Un projet compte dans les courses globales sauf refus explicite. */
export function projectCountsInShopping(project: { includeInShopping?: boolean }): boolean {
  return project.includeInShopping !== false
}

export interface ShoppingLine {
  /** Reste à obtenir (cumulé). */
  remaining: number
  /** Déjà possédé (cumulé sur les projets où l'item est en course). */
  owned: number
  /** Besoin total (cumulé). */
  required: number
}

export function computeGlobalShopping(
  results: readonly NeedsResult[],
): Map<number, ShoppingLine> {
  const total = new Map<number, ShoppingLine>()
  for (const result of results) {
    for (const { itemId, qty } of result.shopping) {
      const need = result.byItem.get(itemId)
      const line = total.get(itemId) ?? { remaining: 0, owned: 0, required: 0 }
      line.remaining += qty
      line.owned += need?.owned ?? 0
      line.required += need?.required ?? qty
      total.set(itemId, line)
    }
  }
  return total
}
