/**
 * Coûts en kamas des besoins de craft, en croisant l'arbre (needs) et les
 * prix relevés (médiane unitaire récente injectée via `priceOf`).
 *
 * `effectiveCost` calcule récursivement le meilleur coût d'obtention d'un
 * objet : l'acheter tel quel, ou crafter ses composants (chacun étant
 * lui-même évalué au meilleur coût). Conçu pour être étendu plus tard avec
 * une option « farmer » (rendement des combats) comme source supplémentaire.
 */

import type { Catalog } from '../needs/needs'

export type PriceOf = (itemId: number) => number | null

export interface EffectiveCost {
  /** Prix d'achat unitaire (médiane récente), null si jamais relevé. */
  buy: number | null
  /** Coût de craft = Σ composants au meilleur coût ; null si incalculable. */
  craft: number | null
  /** Meilleur coût connu (min des deux), null si aucun. */
  best: number | null
  /** Source du meilleur coût. */
  bestSource: 'buy' | 'craft' | null
  /** Ressources sans prix qui empêchent un calcul complet. */
  missingPrices: number[]
}

/**
 * Coût effectif unitaire d'un objet. Cycle-guardé et mémoïsé via `cache`
 * (passer une même Map pour amortir sur tout un arbre).
 */
export function effectiveCost(
  catalog: Catalog,
  priceOf: PriceOf,
  itemId: number,
  cache: Map<number, EffectiveCost> = new Map(),
  path: ReadonlySet<number> = new Set(),
): EffectiveCost {
  const cached = cache.get(itemId)
  if (cached) return cached

  const buy = priceOf(itemId)
  const entry = catalog.get(itemId)
  let craft: number | null = null
  const missingPrices: number[] = []

  if (entry?.recipe && !path.has(itemId)) {
    const nextPath = new Set(path).add(itemId)
    let total = 0
    let complete = true
    for (const comp of entry.recipe.components) {
      const sub = effectiveCost(catalog, priceOf, comp.itemId, cache, nextPath)
      missingPrices.push(...sub.missingPrices)
      if (sub.best === null) {
        complete = false
        if (sub.missingPrices.length === 0) missingPrices.push(comp.itemId)
      } else {
        total += comp.qty * sub.best
      }
    }
    craft = complete ? total : null
  }

  if (buy === null && craft === null && !entry?.recipe) {
    missingPrices.push(itemId)
  }

  const best =
    buy !== null && craft !== null ? Math.min(buy, craft) : (buy ?? craft)
  const bestSource =
    best === null ? null : craft !== null && (buy === null || craft <= buy) ? 'craft' : 'buy'

  const result: EffectiveCost = {
    buy,
    craft,
    best,
    bestSource,
    missingPrices: [...new Set(missingPrices)],
  }
  // Mémoïsé seulement hors chemin de cycle (le résultat y est partiel).
  if (path.size === 0 || !path.has(itemId)) cache.set(itemId, result)
  return result
}

export interface CostedLine {
  itemId: number
  qty: number
  /** Prix unitaire retenu (achat direct), null si inconnu. */
  unitPrice: number | null
  /** qty × unitPrice, null si inconnu. */
  lineCost: number | null
}

export interface ShoppingCost {
  lines: CostedLine[]
  /** Somme des lignes chiffrables. */
  total: number
  /** Ids des ressources sans prix (total partiel si non vide). */
  missingPrices: number[]
}

/** Coût d'une liste de courses : chaque ligne au prix d'achat unitaire. */
export function costShopping(
  shopping: readonly { itemId: number; qty: number }[],
  priceOf: PriceOf,
): ShoppingCost {
  const lines: CostedLine[] = []
  let total = 0
  const missingPrices: number[] = []
  for (const { itemId, qty } of shopping) {
    const unitPrice = priceOf(itemId)
    if (unitPrice === null) {
      missingPrices.push(itemId)
      lines.push({ itemId, qty, unitPrice: null, lineCost: null })
    } else {
      const lineCost = qty * unitPrice
      total += lineCost
      lines.push({ itemId, qty, unitPrice, lineCost })
    }
  }
  return { lines, total, missingPrices }
}
