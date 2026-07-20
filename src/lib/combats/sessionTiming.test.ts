import { describe, expect, it } from 'vitest'
import { MAX_PHASE_SEC, capSec, elapsedSec } from './sessionTiming'

describe('elapsedSec', () => {
  it('temps écoulé simple', () => {
    expect(elapsedSec(1000, null, 0, 61_000)).toBe(60)
  })
  it('gèle au moment de la pause', () => {
    // pausé à 31 s, now bien plus tard → figé à 30 s
    expect(elapsedSec(1000, 31_000, 0, 999_000)).toBe(30)
  })
  it('déduit le temps de pause accumulé', () => {
    // 60 s écoulées mais 20 s de pause → 40 s
    expect(elapsedSec(1000, null, 20_000, 61_000)).toBe(40)
  })
  it('jamais négatif', () => {
    expect(elapsedSec(1000, null, 999_000, 2_000)).toBe(0)
  })
})

describe('capSec', () => {
  it('laisse passer une durée normale', () => {
    expect(capSec(120)).toBe(120)
  })
  it('plafonne une durée aberrante (app laissée ouverte)', () => {
    expect(capSec(50_000)).toBe(MAX_PHASE_SEC)
  })
  it('clamp les négatifs à 0', () => {
    expect(capSec(-5)).toBe(0)
  })
})
