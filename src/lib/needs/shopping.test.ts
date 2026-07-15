import { describe, expect, it } from 'vitest'
import { computeNeeds } from './needs'
import { computeGlobalShopping } from './shopping'
import { RING_CATALOG, makeStates } from './__fixtures__/catalogs'

describe('computeGlobalShopping', () => {
  it('somme les besoins de plusieurs projets, item partagé cumulé', () => {
    const p1 = computeNeeds(RING_CATALOG, [{ itemId: 2, qty: 2 }], makeStates({}))
    // p1 : 4 or, 2 bocal
    const p2 = computeNeeds(RING_CATALOG, [{ itemId: 2, qty: 1 }], makeStates({ 3: { owned: 1 } }))
    // p2 : 1 or (2−1), 1 bocal
    const total = computeGlobalShopping([p1, p2])
    expect(total.get(3)).toBe(5)
    expect(total.get(4)).toBe(3)
  })

  it('aucun projet : liste vide', () => {
    expect(computeGlobalShopping([]).size).toBe(0)
  })
})
