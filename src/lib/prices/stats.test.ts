import { describe, expect, it } from 'vitest'
import type { PriceEntry } from '../types'
import {
  SESSION_WINDOW_MS,
  bucketPoints,
  divergence,
  lotStats,
  median,
  recentMedianUnit,
  seriesByLot,
  unitPrice,
} from './stats'

const DAY = 24 * 3600 * 1000
const NOW = 1_800_000_000_000

const entry = (
  lotSize: 1 | 10 | 100,
  lotPrice: number,
  daysAgo: number,
  itemId = 313,
): PriceEntry => ({ itemId, lotSize, lotPrice, recordedAt: NOW - daysAgo * DAY })

describe('stats de prix', () => {
  it('unitPrice normalise par la taille du lot', () => {
    expect(unitPrice(entry(100, 5000, 0))).toBe(50)
    expect(unitPrice(entry(1, 60, 0))).toBe(60)
  })

  it('median : impair, pair, vide', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBeNull()
  })

  it('seriesByLot sépare et trie par date', () => {
    const s = seriesByLot([entry(1, 60, 1), entry(10, 500, 3), entry(1, 55, 2)])
    expect(s[1].map((p) => p.unit)).toEqual([55, 60]) // trié chronologiquement
    expect(s[10]).toHaveLength(1)
    expect(s[100]).toHaveLength(0)
  })

  it('lotStats : moyenne, médiane, dernier', () => {
    const s = seriesByLot([entry(10, 400, 3), entry(10, 500, 2), entry(10, 900, 1)])
    const stats = lotStats(s[10])
    expect(stats.mean).toBeCloseTo(60)
    expect(stats.median).toBe(50)
    expect(stats.last).toBe(90)
    expect(stats.count).toBe(3)
  })

  it('recentMedianUnit : médiane des relevés < 30 j toutes tailles confondues', () => {
    const entries = [
      entry(1, 60, 1), // 60/u
      entry(10, 400, 5), // 40/u
      entry(100, 5000, 10), // 50/u
      entry(1, 999, 60), // hors fenêtre
    ]
    expect(recentMedianUnit(entries, NOW)).toBe(50)
  })

  it('recentMedianUnit : limite maxEntries aux plus récents', () => {
    const entries = [entry(1, 10, 1), entry(1, 20, 2), entry(1, 30, 3)]
    expect(recentMedianUnit(entries, NOW, { maxEntries: 2 })).toBe(15)
  })

  it('recentMedianUnit : repli sur le dernier relevé si tout est vieux', () => {
    const entries = [entry(10, 800, 90), entry(10, 400, 45)]
    expect(recentMedianUnit(entries, NOW)).toBe(40) // le plus récent des vieux
  })

  it('recentMedianUnit : null sans aucun relevé', () => {
    expect(recentMedianUnit([], NOW)).toBeNull()
  })

  it('divergence : dernier prix unitaire par lot + spread %', () => {
    const d = divergence([
      entry(1, 100, 2), // 100/u
      entry(1, 80, 1), // 80/u (dernier)
      entry(100, 4000, 1), // 40/u
    ])
    expect(d.byLot[1]).toBe(80)
    expect(d.byLot[100]).toBe(40)
    expect(d.byLot[10]).toBeNull()
    expect(d.spreadPct).toBeCloseTo(100) // (80−40)/40
  })

  it('divergence : null avec moins de 2 tailles relevées', () => {
    expect(divergence([entry(1, 100, 1)]).spreadPct).toBeNull()
  })

  it('bucketPoints : des relevés à quelques secondes d’écart fusionnent (dernier gagne)', () => {
    const base = Math.floor(NOW / SESSION_WINDOW_MS) * SESSION_WINDOW_MS
    const points = [
      { t: base + 1000, lot: 100, unit: 100 },
      { t: base + 30_000, lot: 110, unit: 110 }, // même fenêtre → remplace
      { t: base + SESSION_WINDOW_MS + 5000, lot: 120, unit: 120 }, // fenêtre suivante
    ]
    const bucketed = bucketPoints(points)
    expect(bucketed).toHaveLength(2)
    expect(bucketed[0].unit).toBe(110)
    expect(bucketed[0].t).toBe(base + SESSION_WINDOW_MS / 2) // recalé au centre
    expect(bucketed[1].unit).toBe(120)
  })

  it('bucketPoints : les fenêtres absolues alignent les séries entre elles', () => {
    const base = Math.floor(NOW / SESSION_WINDOW_MS) * SESSION_WINDOW_MS
    const a = bucketPoints([{ t: base + 1000, lot: 60, unit: 60 }])
    const b = bucketPoints([{ t: base + 45_000, lot: 4000, unit: 40 }])
    expect(a[0].t).toBe(b[0].t) // même session → même x
  })
})
