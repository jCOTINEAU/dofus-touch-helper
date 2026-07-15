import { describe, expect, it } from 'vitest'
import { combatProfit, rankCombats } from './profit'

const prices = new Map<number, number>([
  [1, 50], // 50 k/u
  [2, 200],
])
const priceOf = (id: number) => prices.get(id) ?? null

describe('combatProfit', () => {
  it('espérance = Σ drop% × qté × prix', () => {
    const p = combatProfit(
      120,
      [
        { itemId: 1, dropRatePct: 50, qtyPerDrop: 2 }, // 0.5×2×50 = 50
        { itemId: 2, dropRatePct: 10, qtyPerDrop: 1 }, // 0.1×1×200 = 20
      ],
      priceOf,
    )
    expect(p.expectedKamas).toBeCloseTo(70)
    expect(p.kamasPerHour).toBeCloseTo((70 * 3600) / 120) // 2100
    expect(p.missingPrices).toEqual([])
  })

  it('loot sans prix : exclu et signalé', () => {
    const p = combatProfit(
      60,
      [
        { itemId: 1, dropRatePct: 100, qtyPerDrop: 1 },
        { itemId: 999, dropRatePct: 100, qtyPerDrop: 5 },
      ],
      priceOf,
    )
    expect(p.expectedKamas).toBe(50)
    expect(p.missingPrices).toEqual([999])
  })

  it('durée nulle : kamas/h null', () => {
    const p = combatProfit(0, [{ itemId: 1, dropRatePct: 100, qtyPerDrop: 1 }], priceOf)
    expect(p.expectedKamas).toBe(50)
    expect(p.kamasPerHour).toBeNull()
  })

  it('aucun loot : zéro', () => {
    const p = combatProfit(60, [], priceOf)
    expect(p.expectedKamas).toBe(0)
    expect(p.kamasPerHour).toBe(0)
  })
})

describe('rankCombats', () => {
  it('trie par kamas/h décroissant, sans-durée en dernier', () => {
    const rows = [
      { name: 'lent', profit: { expectedKamas: 100, kamasPerHour: 500, missingPrices: [] } },
      { name: 'rapide', profit: { expectedKamas: 10, kamasPerHour: 2000, missingPrices: [] } },
      { name: 'sans durée', profit: { expectedKamas: 999, kamasPerHour: null, missingPrices: [] } },
    ]
    expect(rankCombats(rows).map((r) => r.name)).toEqual(['rapide', 'lent', 'sans durée'])
  })
})
