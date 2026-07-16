import { describe, expect, it } from 'vitest'
import type { Combat, CombatLoot } from '../types'
import {
  bestKamasPerHour,
  farmAdvice,
  farmSourcesFor,
  makeFarmAdvisor,
  sideKamasPerHour,
} from './farming'

const combats: Combat[] = [
  { id: 1, name: 'Cycloïde donjon', avgDurationSec: 300 }, // 5 min
  { id: 2, name: 'Plaine rapide', avgDurationSec: 60 },
  { id: 3, name: 'Sans durée', avgDurationSec: 0 },
]

const loots: CombatLoot[] = [
  { id: 1, combatId: 1, itemId: 100, dropRatePct: 50, qtyPerDrop: 2 }, // 1/combat → 12/h
  { id: 2, combatId: 1, itemId: 200, dropRatePct: 100, qtyPerDrop: 1 }, // annexe
  { id: 3, combatId: 2, itemId: 100, dropRatePct: 10, qtyPerDrop: 1 }, // 0.1/combat → 6/h
  { id: 4, combatId: 3, itemId: 100, dropRatePct: 100, qtyPerDrop: 5 }, // durée inconnue
  { id: 5, combatId: 2, itemId: 300, dropRatePct: 100, qtyPerDrop: 2 },
]

const prices = (map: Record<number, number>) => (id: number) => map[id] ?? null

describe('farmSourcesFor', () => {
  it('trouve les combats qui lootent la ressource, triés par unités/h', () => {
    const sources = farmSourcesFor(100, combats, loots)
    expect(sources.map((s) => s.combatName)).toEqual([
      'Cycloïde donjon',
      'Plaine rapide',
      'Sans durée',
    ])
    expect(sources[0].unitsPerCombat).toBe(1) // 50% × 2
    expect(sources[0].unitsPerHour).toBe(12) // 1 × 3600/300
    expect(sources[2].unitsPerHour).toBeNull() // durée 0
  })

  it('ressource jamais lootée : aucune source', () => {
    expect(farmSourcesFor(999, combats, loots)).toEqual([])
  })

  it('drop à 0 % : source ignorée', () => {
    const zeroLoots: CombatLoot[] = [
      { id: 9, combatId: 1, itemId: 400, dropRatePct: 0, qtyPerDrop: 3 },
    ]
    expect(farmSourcesFor(400, combats, zeroLoots)).toEqual([])
  })
})

describe('sideKamasPerHour', () => {
  it('exclut la ressource visée du rendement annexe', () => {
    // Combat 1 : loots 100 (visé, exclu) + 200 (prix 25) → 1×25 par combat de 5 min = 300 k/h
    const rate = sideKamasPerHour(combats[0], loots, 100, prices({ 100: 999, 200: 25 }))
    expect(rate).toBe(300)
  })

  it('aucun loot annexe : 0 k/h', () => {
    const rate = sideKamasPerHour(combats[1], loots, 100, prices({ 300: 0 }))
    expect(rate).toBe(0)
  })
})

describe('bestKamasPerHour', () => {
  it('retourne le meilleur rendement parmi les combats', () => {
    // Combat 1 : (0.5×2×10 + 1×25) = 35 k / 5 min = 420 k/h
    // Combat 2 : (0.1×1×10 + 1×2×30) = 61 k / 1 min = 3660 k/h
    const best = bestKamasPerHour(combats, loots, prices({ 100: 10, 200: 25, 300: 30 }))
    expect(best).toBe(3660)
  })

  it('aucun combat avec durée : null', () => {
    expect(bestKamasPerHour([combats[2]], loots, prices({ 100: 10 }))).toBeNull()
  })
})

describe('farmAdvice', () => {
  const source = farmSourcesFor(100, combats, loots)[0] // 12/h, combat 1

  it('temps de farm et coût d’achat', () => {
    const advice = farmAdvice(24, source, {
      unitPrice: 50,
      sideKamasPerHour: 0,
      referenceKamasPerHour: null,
    })
    expect(advice.farmSeconds).toBe(7200) // 24 unités à 12/h = 2 h
    expect(advice.buyCost).toBe(1200)
    expect(advice.equivalentKamasPerHour).toBe(600) // 1200 k / 2 h
    expect(advice.verdict).toBeNull() // pas de référence
  })

  it('les loots annexes s’ajoutent au taux équivalent', () => {
    const advice = farmAdvice(24, source, {
      unitPrice: 50,
      sideKamasPerHour: 300,
      referenceKamasPerHour: null,
    })
    expect(advice.equivalentKamasPerHour).toBe(900) // 600 + 300
  })

  it('verdict farm : le taux équivalent bat la référence', () => {
    const advice = farmAdvice(24, source, {
      unitPrice: 50,
      sideKamasPerHour: 300,
      referenceKamasPerHour: 800,
    })
    expect(advice.verdict).toBe('farm')
  })

  it('verdict buy : mieux vaut farmer des kamas ailleurs et acheter', () => {
    const advice = farmAdvice(24, source, {
      unitPrice: 50,
      sideKamasPerHour: 0,
      referenceKamasPerHour: 1500,
    })
    expect(advice.verdict).toBe('buy')
  })

  it('égalité : farm (à rendement égal, autant looter directement)', () => {
    const advice = farmAdvice(24, source, {
      unitPrice: 50,
      sideKamasPerHour: 0,
      referenceKamasPerHour: 600,
    })
    expect(advice.verdict).toBe('farm')
  })

  it('durée de combat inconnue : temps null, pas de verdict', () => {
    const noDuration = farmSourcesFor(100, combats, loots)[2]
    const advice = farmAdvice(24, noDuration, {
      unitPrice: 50,
      sideKamasPerHour: 0,
      referenceKamasPerHour: 1000,
    })
    expect(advice.farmSeconds).toBeNull()
    expect(advice.equivalentKamasPerHour).toBeNull()
    expect(advice.verdict).toBeNull()
  })

  it('prix inconnu : temps de farm quand même, pas de verdict', () => {
    const advice = farmAdvice(24, source, {
      unitPrice: null,
      sideKamasPerHour: 0,
      referenceKamasPerHour: 1000,
    })
    expect(advice.farmSeconds).toBe(7200)
    expect(advice.buyCost).toBeNull()
    expect(advice.verdict).toBeNull()
  })
})

describe('makeFarmAdvisor', () => {
  it('assemble source + annexes + référence, null si aucun combat ne loote', () => {
    const priceOf = prices({ 100: 50, 200: 25, 300: 30 })
    const advisor = makeFarmAdvisor(combats, loots, priceOf)

    expect(advisor(999, 10, 50)).toBeNull()

    const advice = advisor(100, 24, 50)!
    expect(advice.source.combatName).toBe('Cycloïde donjon')
    expect(advice.farmSeconds).toBe(7200)
    // annexes du combat 1 = loot 200 : 25 k/combat de 5 min = 300 k/h
    expect(advice.equivalentKamasPerHour).toBe(900) // 600 + 300
    // référence = combat 2 : (0.1×50 + 2×30) = 65 k/min = 3900 k/h
    expect(advice.referenceKamasPerHour).toBe(3900)
    expect(advice.verdict).toBe('buy')
  })
})
