/**
 * Loots effectifs d'un combat : agrège les drops des créatures et les loots
 * manuels, en appliquant les modificateurs globaux (BoosterPack, double
 * joueur, butins conditionnels). Fonction pure — le résultat est une
 * espérance d'unités par ressource et par combat, convertible en
 * `LootInput[]` pour réutiliser tels quels le calcul de rentabilité
 * (`combatProfit`) et le conseil farm (`farming`).
 */

import type { CachedMonster, CombatCreature, CombatLoot } from '../types'
import type { LootInput } from './profit'

export interface GlobalMods {
  /** +150 % sur le taux de drop (× 2,5), plafonné à 100 %. */
  boosterPack: boolean
  /** Double l'espérance de chaque ressource (× 2). */
  playerDouble: boolean
  /** Inclure les butins conditionnels des monstres. */
  includeConditional: boolean
}

export const DEFAULT_MODS: GlobalMods = {
  boosterPack: false,
  playerDouble: false,
  includeConditional: false,
}

export interface CreatureRef {
  monsterId: number
  count: number
}

export interface ManualLoot {
  itemId: number
  dropRatePct: number
  qtyPerDrop: number
}

export interface EffectiveLoot {
  itemId: number
  /** Espérance d'unités obtenues par combat. */
  expectedUnits: number
}

/** Taux effectif après booster, plafonné à 100 %. */
function effRate(base: number, mods: GlobalMods): number {
  return Math.min(base * (mods.boosterPack ? 2.5 : 1), 100)
}

export function combatEffectiveLoots(
  creatures: readonly CreatureRef[],
  monstersById: ReadonlyMap<number, CachedMonster>,
  manualLoots: readonly ManualLoot[],
  mods: GlobalMods,
): EffectiveLoot[] {
  const playerMult = mods.playerDouble ? 2 : 1
  const byItem = new Map<number, number>()
  const add = (itemId: number, units: number) =>
    byItem.set(itemId, (byItem.get(itemId) ?? 0) + units)

  for (const creature of creatures) {
    const monster = monstersById.get(creature.monsterId)
    if (!monster) continue
    for (const drop of monster.drops) {
      if (drop.conditional && !mods.includeConditional) continue
      const units = creature.count * (effRate(drop.dropRatePct, mods) / 100) * playerMult
      add(drop.itemId, units)
    }
  }
  for (const loot of manualLoots) {
    add(loot.itemId, (effRate(loot.dropRatePct, mods) / 100) * loot.qtyPerDrop * playerMult)
  }

  return [...byItem.entries()]
    .filter(([, units]) => units > 0)
    .map(([itemId, expectedUnits]) => ({ itemId, expectedUnits }))
}

/** Convertit l'espérance en LootInput pour combatProfit / farming. */
export function asLootInputs(effective: readonly EffectiveLoot[]): LootInput[] {
  return effective.map((e) => ({
    itemId: e.itemId,
    dropRatePct: 100,
    qtyPerDrop: e.expectedUnits,
  }))
}

/**
 * Loots effectifs de tous les combats sous forme de `CombatLoot[]`
 * (espérance encodée en qtyPerDrop, taux 100 %), pour alimenter le conseil
 * farm qui raisonne par combat.
 */
export function effectiveLootsPerCombat(
  combats: readonly { id?: number }[],
  creatures: readonly CombatCreature[],
  manualLoots: readonly CombatLoot[],
  monstersById: ReadonlyMap<number, CachedMonster>,
  mods: GlobalMods,
): CombatLoot[] {
  const out: CombatLoot[] = []
  for (const combat of combats) {
    const cid = combat.id
    if (cid === undefined) continue
    const refs = creatures
      .filter((c) => c.combatId === cid)
      .map((c) => ({ monsterId: c.monsterId, count: c.count }))
    const manual = manualLoots.filter((l) => l.combatId === cid)
    for (const e of combatEffectiveLoots(refs, monstersById, manual, mods)) {
      out.push({ combatId: cid, itemId: e.itemId, dropRatePct: 100, qtyPerDrop: e.expectedUnits })
    }
  }
  return out
}
