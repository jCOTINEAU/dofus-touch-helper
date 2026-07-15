/** Liste de courses globale : somme des besoins restants de chaque projet. */

import type { NeedsResult } from './needs'

export function computeGlobalShopping(results: readonly NeedsResult[]): Map<number, number> {
  const total = new Map<number, number>()
  for (const result of results) {
    for (const { itemId, qty } of result.shopping) {
      total.set(itemId, (total.get(itemId) ?? 0) + qty)
    }
  }
  return total
}
