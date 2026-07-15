import { describe, expect, it } from 'vitest'
import { applyCraft } from './craft'
import { RING_CATALOG, makeStates } from './__fixtures__/catalogs'

// Rappel : potion(2) = 2 × or(3) + 1 × bocal(4)

const ownedAfter = (r: ReturnType<typeof applyCraft>, id: number) =>
  r.updates.find((u) => u.itemId === id)?.owned

describe('applyCraft', () => {
  it('stock suffisant : consomme les composants et incrémente le craft', () => {
    const r = applyCraft(RING_CATALOG, makeStates({ 3: { owned: 5 }, 4: { owned: 2 } }), 2)
    expect(r.ok).toBe(true)
    expect(r.missing).toEqual([])
    expect(ownedAfter(r, 3)).toBe(3)
    expect(ownedAfter(r, 4)).toBe(1)
    expect(ownedAfter(r, 2)).toBe(1)
  })

  it('stock insuffisant strict : rien appliqué, manque exact listé', () => {
    const r = applyCraft(RING_CATALOG, makeStates({ 3: { owned: 1 } }), 2)
    expect(r.ok).toBe(false)
    expect(r.updates).toEqual([])
    expect(r.missing).toEqual([
      { itemId: 3, missing: 1 },
      { itemId: 4, missing: 1 },
    ])
  })

  it('force : applique en clampant les stocks à 0', () => {
    const r = applyCraft(RING_CATALOG, makeStates({ 3: { owned: 1 } }), 2, 1, true)
    expect(r.ok).toBe(true)
    expect(r.missing).toHaveLength(2)
    expect(ownedAfter(r, 3)).toBe(0)
    expect(ownedAfter(r, 4)).toBe(0)
    expect(ownedAfter(r, 2)).toBe(1)
  })

  it('count > 1 : quantités multipliées', () => {
    const r = applyCraft(
      RING_CATALOG,
      makeStates({ 3: { owned: 10 }, 4: { owned: 5 }, 2: { owned: 1 } }),
      2,
      3,
    )
    expect(r.ok).toBe(true)
    expect(ownedAfter(r, 3)).toBe(4) // 10 − 3×2
    expect(ownedAfter(r, 4)).toBe(2) // 5 − 3×1
    expect(ownedAfter(r, 2)).toBe(4) // 1 + 3
  })

  it('item sans recette : no-op', () => {
    const r = applyCraft(RING_CATALOG, makeStates({}), 3)
    expect(r).toEqual({ ok: false, missing: [], updates: [] })
  })

  it("craft d'un item en mode buy : autorisé (le mode ne concerne que le plan)", () => {
    const r = applyCraft(
      RING_CATALOG,
      makeStates({ 2: { mode: 'buy' }, 3: { owned: 2 }, 4: { owned: 1 } }),
      2,
    )
    expect(r.ok).toBe(true)
    expect(ownedAfter(r, 2)).toBe(1)
  })
})
