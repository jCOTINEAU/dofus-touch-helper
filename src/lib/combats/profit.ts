/**
 * Rentabilité d'un combat de farm : espérance de kamas par combat
 * (somme des loots pondérés par leur % de drop) et kamas par heure via la
 * durée moyenne estimée. Le prix unitaire est injecté (médiane récente,
 * cf. prices/stats.ts) pour rester pur.
 */

export interface LootInput {
  itemId: number
  dropRatePct: number
  qtyPerDrop: number
}

export interface CombatProfit {
  /** Espérance de kamas par combat (loots sans prix exclus). */
  expectedKamas: number
  /** null si la durée du combat est inconnue/nulle. */
  kamasPerHour: number | null
  /** Loots ignorés faute de prix relevé. */
  missingPrices: number[]
}

export function combatProfit(
  avgDurationSec: number,
  loots: readonly LootInput[],
  priceOf: (itemId: number) => number | null,
): CombatProfit {
  let expectedKamas = 0
  const missingPrices: number[] = []
  for (const loot of loots) {
    const price = priceOf(loot.itemId)
    if (price === null) {
      missingPrices.push(loot.itemId)
      continue
    }
    expectedKamas += (loot.dropRatePct / 100) * loot.qtyPerDrop * price
  }
  const kamasPerHour = avgDurationSec > 0 ? (expectedKamas * 3600) / avgDurationSec : null
  return { expectedKamas, kamasPerHour, missingPrices }
}

/** Tri par kamas/heure décroissant, les combats sans durée en dernier. */
export function rankCombats<T extends { profit: CombatProfit }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const ka = a.profit.kamasPerHour
    const kb = b.profit.kamasPerHour
    if (ka === null && kb === null) return b.profit.expectedKamas - a.profit.expectedKamas
    if (ka === null) return 1
    if (kb === null) return -1
    return kb - ka
  })
}
