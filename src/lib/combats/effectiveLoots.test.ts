import { describe, expect, it } from 'vitest'
import type { CachedMonster } from '../types'
import {
  DEFAULT_MODS,
  asLootInputs,
  combatEffectiveLoots,
  type GlobalMods,
} from './effectiveLoots'
import { combatProfit } from './profit'

const monster = (id: number, drops: [number, number, boolean?][]): CachedMonster => ({
  id,
  url: `u${id}`,
  name: `m${id}`,
  imageUrl: null,
  family: null,
  familyId: null,
  levelMin: null,
  levelMax: null,
  imported: true,
  drops: drops.map(([itemId, dropRatePct, conditional]) => ({
    itemId,
    name: `item${itemId}`,
    url: `u${itemId}`,
    dropRatePct,
    conditional: conditional ?? false,
  })),
  fetchedAt: 0,
})

// Bouftou-like : Citron 20 %, Corne 50 %, Cuisse 40 % (conditionnelle)
const monsters = new Map<number, CachedMonster>([
  [1, monster(1, [[100, 20], [200, 50], [300, 40, true]])],
])
const mods = (o: Partial<GlobalMods> = {}): GlobalMods => ({ ...DEFAULT_MODS, ...o })

describe('combatEffectiveLoots', () => {
  it('espérance de base = taux × nombre de créatures (sans conditionnels)', () => {
    const eff = combatEffectiveLoots([{ monsterId: 1, count: 3 }], monsters, [], mods())
    // Citron : 3 × 0.20 = 0.6 ; Corne : 3 × 0.50 = 1.5 ; Cuisse exclue
    const byId = new Map(eff.map((e) => [e.itemId, e.expectedUnits]))
    expect(byId.size).toBe(2)
    expect(byId.get(100)).toBeCloseTo(0.6)
    expect(byId.get(200)).toBeCloseTo(1.5)
  })

  it('includeConditional ajoute les butins conditionnels', () => {
    const eff = combatEffectiveLoots(
      [{ monsterId: 1, count: 1 }],
      monsters,
      [],
      mods({ includeConditional: true }),
    )
    expect(eff.find((e) => e.itemId === 300)!.expectedUnits).toBeCloseTo(0.4)
  })

  it('boosterPack × 2,5 avec plafond à 100 %', () => {
    const eff = combatEffectiveLoots([{ monsterId: 1, count: 1 }], monsters, [], mods({ boosterPack: true }))
    const byId = new Map(eff.map((e) => [e.itemId, e.expectedUnits]))
    expect(byId.get(100)).toBeCloseTo(0.5) // 20 % × 2,5 = 50 %
    expect(byId.get(200)).toBeCloseTo(1) // 50 % × 2,5 = 125 % → plafonné à 100 %
  })

  it('playerDouble double l’espérance', () => {
    const eff = combatEffectiveLoots([{ monsterId: 1, count: 1 }], monsters, [], mods({ playerDouble: true }))
    expect(eff.find((e) => e.itemId === 100)!.expectedUnits).toBeCloseTo(0.4) // 0.2 × 2
  })

  it('agrège plusieurs créatures et les loots manuels sur la même ressource', () => {
    const eff = combatEffectiveLoots(
      [
        { monsterId: 1, count: 2 },
        { monsterId: 1, count: 1 },
      ],
      monsters,
      [{ itemId: 100, dropRatePct: 100, qtyPerDrop: 5 }],
      mods(),
    )
    // Citron : 3 × 0.20 (créatures) + 5 (manuel 100%) = 0.6 + 5 = 5.6
    expect(eff.find((e) => e.itemId === 100)!.expectedUnits).toBeCloseTo(5.6)
  })

  it('monstre inconnu du cache : ignoré', () => {
    expect(combatEffectiveLoots([{ monsterId: 999, count: 1 }], monsters, [], mods())).toEqual([])
  })

  it('asLootInputs alimente combatProfit avec l’espérance exacte', () => {
    const eff = combatEffectiveLoots([{ monsterId: 1, count: 1 }], monsters, [], mods())
    // prix : Citron 100 k/u, Corne 10 k/u → 0.2×100 + 0.5×10 = 25 k/combat
    const priceOf = (id: number) => ({ 100: 100, 200: 10 })[id] ?? null
    const profit = combatProfit(60, asLootInputs(eff), priceOf)
    expect(profit.expectedKamas).toBeCloseTo(25)
    expect(profit.kamasPerHour).toBeCloseTo(1500)
  })
})
