import { describe, expect, it } from 'vitest'
import type { SessionCombat } from '../types'
import { sessionMetrics } from './sessionMetrics'

const combat = (
  durationSec: number,
  idleBeforeSec: number,
  creatures: [number, number][],
): SessionCombat => ({
  sessionId: 1,
  durationSec,
  idleBeforeSec,
  creatures: creatures.map(([monsterId, count]) => ({ monsterId, count })),
  recordedAt: 0,
})

// Espérance = 100 k par monstre (peu importe lequel).
const kamasOf = (creatures: SessionCombat['creatures']) =>
  creatures.reduce((n, c) => n + c.count, 0) * 100

describe('sessionMetrics', () => {
  it('agrège durées, monstres, espérance et moyennes', () => {
    const m = sessionMetrics(
      [
        combat(60, 30, [[1, 2]]), // 2 monstres, 200 k
        combat(120, 90, [[1, 1], [2, 1]]), // 2 monstres, 200 k
      ],
      kamasOf,
    )
    expect(m.combatCount).toBe(2)
    expect(m.totalMonsters).toBe(4)
    expect(m.totalExpectedKamas).toBe(400)
    expect(m.totalCombatSec).toBe(180)
    expect(m.totalIdleSec).toBe(120)
    expect(m.avgCombatSec).toBe(90) // 180/2
    expect(m.avgSecPerMonster).toBe(45) // 180/4
    expect(m.avgIdleSec).toBe(60) // 120/2
    // 400 k sur 300 s → 4800 k/h
    expect(m.kamasPerHour).toBeCloseTo(4800)
  })

  it('session vide : moyennes nulles', () => {
    const m = sessionMetrics([], kamasOf)
    expect(m).toMatchObject({
      combatCount: 0,
      totalMonsters: 0,
      totalExpectedKamas: 0,
      avgCombatSec: null,
      avgSecPerMonster: null,
      avgIdleSec: null,
      kamasPerHour: null,
    })
  })

  it('temps total nul (durées 0) : kamas/h null', () => {
    const m = sessionMetrics([combat(0, 0, [[1, 1]])], kamasOf)
    expect(m.avgSecPerMonster).toBe(0)
    expect(m.kamasPerHour).toBeNull()
  })
})
