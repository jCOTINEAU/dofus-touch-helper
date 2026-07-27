import { describe, expect, it } from 'vitest'
import { simulate, type Scenario } from './calc'
import type { Spell } from './spells'

function mkSpell(id: number, normal: string[], pa = 3, usesPerTurn: number | null = null): Spell {
  return {
    id,
    name: `spell-${id}`,
    description: '',
    maxLevel: 1,
    levels: [
      {
        level: 1,
        pa,
        poMin: 1,
        poMax: 1,
        levelRequired: 1,
        critPct: null,
        usesPerTurn,
        castsPerTurn: null,
        cooldown: null,
        normal,
        critical: [],
      },
    ],
  }
}

const scenario = (turns: number[][], pa = 6): Scenario => ({
  name: 's',
  class: 'iop',
  turns: turns.map((casts) => ({ pa, casts })),
  levels: {},
})

// Sorts de dégâts « nus ».
const ATK = mkSpell(1, ['100 (dommages Terre)'])
const ATK_RANGE = mkSpell(2, ['10 à 20 (dommages Terre)'])
// Sorts de buff (ids réels reconnus par le moteur).
const PUISSANCE = (turns: number) =>
  mkSpell(8137, [`100 Puissance (${turns} tours)`, `100 Puissance (${turns} tours)`, `50 Puissance (${turns} tours)`])
const BROKLE = mkSpell(410, ['Maximise les effets aléatoires (2 tours)', 'Putsch'])

const map = (...spells: Spell[]) => new Map(spells.map((s) => [s.id, s]))

describe('simulate — formule', () => {
  it('chaque 100 de Force ajoute les dégâts de base', () => {
    const r = simulate(scenario([[1]]), { force: 100 }, map(ATK))
    // 100 × (1 + 100/100) = 200
    expect(r.perTurn[0].damage.avg).toBe(200)
    expect(r.perTurn[0].damage.min).toBe(200)
    expect(r.perTurn[0].damage.max).toBe(200)
  })

  it('les Dommages sont ajoutés à plat', () => {
    const r = simulate(scenario([[1]]), { dommages: 50 }, map(ATK))
    // 100 × 1 + 50 = 150
    expect(r.perTurn[0].damage.avg).toBe(150)
  })

  it('la Puissance équivaut à de la Force', () => {
    const r = simulate(scenario([[1]]), { puissance: 100 }, map(ATK))
    expect(r.perTurn[0].damage.avg).toBe(200)
  })

  it('roll min / max / moyen sur une fourchette', () => {
    const r = simulate(scenario([[2]]), { force: 0 }, map(ATK_RANGE))
    expect(r.perTurn[0].damage.min).toBe(10)
    expect(r.perTurn[0].damage.max).toBe(20)
    expect(r.perTurn[0].damage.avg).toBe(15)
  })
})

describe('simulate — buffs', () => {
  it('Puissance lancée avant profite au sort suivant (même tour)', () => {
    const r = simulate(scenario([[8137, 1]]), { force: 0 }, map(PUISSANCE(3), ATK))
    // +100 puissance → 100 × (1 + 100/100) = 200
    expect(r.perTurn[0].damage.avg).toBe(200)
  })

  it('le buff expire après sa durée', () => {
    // Puissance (2 tours) au tour 1, puis attaques seules.
    const r = simulate(scenario([[8137, 1], [1], [1]]), { force: 0 }, map(PUISSANCE(2), ATK))
    expect(r.perTurn[0].damage.avg).toBe(200) // buff actif
    expect(r.perTurn[1].damage.avg).toBe(200) // encore actif (2 tours)
    expect(r.perTurn[2].damage.avg).toBe(100) // expiré
  })

  it('cumul sur 3 tours = 3 tours de jeu (boucle si scénario plus court)', () => {
    const r = simulate(scenario([[1]]), { force: 100 }, map(ATK))
    // 200 par tour × 3 tours
    expect(r.sum3.avg).toBe(600)
  })
})

describe('simulate — cas particuliers de sorts', () => {
  it('Concentration ne compte que sa 1ʳᵉ ligne de dégâts (2ᵉ = invocations)', () => {
    const conc = mkSpell(8121, [
      '15 à 19 (dommages Terre)',
      '23 à 27 (dommages Terre)',
      'Avance de 1 case(s)',
    ])
    const r = simulate(scenario([[8121]]), { force: 0 }, map(conc))
    // Seule la 1ʳᵉ ligne : moyen = (15 + 19) / 2 = 17.
    expect(r.perTurn[0].damage.avg).toBe(17)
  })
})

describe('simulate — Brokle', () => {
  it('force le roll max et ajoute Putsch (+20 %)', () => {
    const r = simulate(scenario([[410, 2]]), { force: 0 }, map(BROKLE, ATK_RANGE))
    // roll max = 20, × 1 (factor) × 1.2 (Putsch) = 24, sur min/max/moyen
    expect(r.perTurn[0].damage.min).toBe(24)
    expect(r.perTurn[0].damage.max).toBe(24)
    expect(r.perTurn[0].damage.avg).toBe(24)
  })

  it('sans Brokle le moyen reste au milieu de la fourchette', () => {
    const r = simulate(scenario([[2]]), { force: 0 }, map(ATK_RANGE))
    expect(r.perTurn[0].damage.avg).toBe(15)
  })
})

describe('simulate — avertissements', () => {
  it('signale un dépassement de PA', () => {
    const r = simulate(scenario([[1, 1, 1]], 6), { force: 0 }, map(ATK)) // 3×3 PA = 9 > 6
    expect(r.warnings.some((w) => w.includes('PA'))).toBe(true)
  })

  it("signale un dépassement d'utilisations par tour", () => {
    const atk = mkSpell(3, ['100 (dommages Terre)'], 1, 1) // 1 usage/tour
    const r = simulate(scenario([[3, 3]], 6), { force: 0 }, map(atk))
    expect(r.warnings.some((w) => w.includes('max'))).toBe(true)
  })
})

describe('simulate — moyenne à l\'infini', () => {
  it('converge vers la moyenne du régime stabilisé', () => {
    // Puissance (2t) tour 1 puis 2 attaques : 200,200,100 par cycle.
    const r = simulate(scenario([[8137, 1], [1], [1]]), { force: 0 }, map(PUISSANCE(2), ATK))
    expect(r.infinite.avg).toBeCloseTo(500 / 3, 5)
  })
})
