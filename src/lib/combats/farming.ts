/**
 * Croisement farm / achat pour une ressource : où la farmer, en combien de
 * temps, et est-ce plus rentable que de farmer des kamas ailleurs pour
 * l'acheter.
 *
 * Modèle : farmer le combat C pendant le temps T nécessaire à obtenir
 * `qty` unités rapporte (en équivalent kamas/h) :
 *   coût d'achat évité / T  +  loots annexes de C (hors la ressource visée)
 * On compare ce taux au meilleur kamas/h connu parmi tes combats (le coût
 * d'opportunité : ce que tu gagnerais en farmant autre chose pour acheter).
 */

import type { Combat, CombatLoot } from '../types'
import { combatProfit } from './profit'
import type { PriceOf } from '../prices/costs'

export interface FarmSource {
  combatId: number
  combatName: string
  avgDurationSec: number
  /** Espérance d'unités par combat (drop% × qté). */
  unitsPerCombat: number
  /** null si la durée du combat est inconnue (0). */
  unitsPerHour: number | null
}

/** Combats qui lootent `itemId`, du plus efficace au moins efficace. */
export function farmSourcesFor(
  itemId: number,
  combats: readonly Combat[],
  loots: readonly CombatLoot[],
): FarmSource[] {
  const byId = new Map(combats.map((c) => [c.id!, c]))
  const sources: FarmSource[] = []
  for (const loot of loots) {
    if (loot.itemId !== itemId) continue
    const combat = byId.get(loot.combatId)
    if (!combat) continue
    const unitsPerCombat = (loot.dropRatePct / 100) * loot.qtyPerDrop
    if (unitsPerCombat <= 0) continue
    sources.push({
      combatId: combat.id!,
      combatName: combat.name,
      avgDurationSec: combat.avgDurationSec,
      unitsPerCombat,
      unitsPerHour:
        combat.avgDurationSec > 0 ? (unitsPerCombat * 3600) / combat.avgDurationSec : null,
    })
  }
  return sources.sort((a, b) => {
    if (a.unitsPerHour === null && b.unitsPerHour === null) return 0
    if (a.unitsPerHour === null) return 1
    if (b.unitsPerHour === null) return -1
    return b.unitsPerHour - a.unitsPerHour
  })
}

/** kamas/h des loots annexes d'un combat (en excluant la ressource visée). */
export function sideKamasPerHour(
  combat: Combat,
  loots: readonly CombatLoot[],
  excludedItemId: number,
  priceOf: PriceOf,
): number | null {
  const side = loots.filter((l) => l.combatId === combat.id && l.itemId !== excludedItemId)
  return combatProfit(combat.avgDurationSec, side, priceOf).kamasPerHour
}

/** Meilleur kamas/h parmi tous les combats (coût d'opportunité du farm). */
export function bestKamasPerHour(
  combats: readonly Combat[],
  loots: readonly CombatLoot[],
  priceOf: PriceOf,
): number | null {
  let best: number | null = null
  for (const combat of combats) {
    const rate = combatProfit(
      combat.avgDurationSec,
      loots.filter((l) => l.combatId === combat.id),
      priceOf,
    ).kamasPerHour
    if (rate !== null && (best === null || rate > best)) best = rate
  }
  return best
}

/**
 * Fabrique un conseiller prêt à l'emploi pour une liste de courses :
 * meilleur combat qui loote la ressource + verdict farm/achat.
 * Retourne null pour une ressource qu'aucun combat ne loote.
 */
export function makeFarmAdvisor(
  combats: readonly Combat[],
  loots: readonly CombatLoot[],
  priceOf: PriceOf,
): (itemId: number, qty: number, unitPrice: number | null) => FarmAdvice | null {
  const reference = bestKamasPerHour(combats, loots, priceOf)
  const byId = new Map(combats.map((c) => [c.id!, c]))
  return (itemId, qty, unitPrice) => {
    const sources = farmSourcesFor(itemId, combats, loots)
    if (sources.length === 0) return null
    const source = sources[0]
    return farmAdvice(qty, source, {
      unitPrice,
      sideKamasPerHour: sideKamasPerHour(byId.get(source.combatId)!, loots, itemId, priceOf),
      referenceKamasPerHour: reference,
    })
  }
}

export interface FarmAdvice {
  source: FarmSource
  /** Temps estimé pour farmer `qty` unités (s) ; null si durée inconnue. */
  farmSeconds: number | null
  /** Coût d'achat des `qty` unités ; null si prix inconnu. */
  buyCost: number | null
  /** Taux équivalent du farm : achat évité/temps + loots annexes (k/h). */
  equivalentKamasPerHour: number | null
  /** Meilleur kamas/h connu (référence de comparaison). */
  referenceKamasPerHour: number | null
  /** 'farm' si le farm bat la référence, 'buy' sinon ; null si incomparable. */
  verdict: 'farm' | 'buy' | null
}

export function farmAdvice(
  qty: number,
  source: FarmSource,
  opts: {
    unitPrice: number | null
    sideKamasPerHour: number | null
    referenceKamasPerHour: number | null
  },
): FarmAdvice {
  const farmSeconds =
    source.unitsPerHour !== null && qty > 0 ? (qty / source.unitsPerHour) * 3600 : null
  const buyCost = opts.unitPrice !== null ? qty * opts.unitPrice : null

  let equivalentKamasPerHour: number | null = null
  if (farmSeconds !== null && farmSeconds > 0 && buyCost !== null) {
    equivalentKamasPerHour = (buyCost * 3600) / farmSeconds + (opts.sideKamasPerHour ?? 0)
  }

  let verdict: 'farm' | 'buy' | null = null
  if (equivalentKamasPerHour !== null && opts.referenceKamasPerHour !== null) {
    verdict = equivalentKamasPerHour >= opts.referenceKamasPerHour ? 'farm' : 'buy'
  }

  return {
    source,
    farmSeconds,
    buyCost,
    equivalentKamasPerHour,
    referenceKamasPerHour: opts.referenceKamasPerHour,
    verdict,
  }
}
