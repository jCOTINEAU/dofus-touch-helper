import { describe, expect, it } from 'vitest'
import { computeNeeds } from './needs'
import { computeGlobalShopping } from './shopping'
import { RING_CATALOG, makeStates } from './__fixtures__/catalogs'

describe('computeGlobalShopping', () => {
  it('cumule restant/possédé/requis, item partagé entre projets', () => {
    const p1 = computeNeeds(RING_CATALOG, [{ itemId: 2, qty: 2 }], makeStates({}))
    // p1 : or requis 4, possédé 0, reste 4 ; bocal requis 2, reste 2
    const p2 = computeNeeds(RING_CATALOG, [{ itemId: 2, qty: 1 }], makeStates({ 3: { owned: 1 } }))
    // p2 : or requis 2, possédé 1, reste 1 ; bocal requis 1, reste 1
    const total = computeGlobalShopping([p1, p2])
    expect(total.get(3)).toEqual({ remaining: 5, owned: 1, required: 6 })
    expect(total.get(4)).toEqual({ remaining: 3, owned: 0, required: 3 })
  })

  it("un item complet dans un projet n'apparaît que pour les projets où il manque", () => {
    const done = computeNeeds(RING_CATALOG, [{ itemId: 5, qty: 3 }], makeStates({ 5: { owned: 3 } }))
    const missing = computeNeeds(RING_CATALOG, [{ itemId: 5, qty: 2 }], makeStates({}))
    const total = computeGlobalShopping([done, missing])
    // le projet « done » ne contribue pas (remaining 0 → hors shopping)
    expect(total.get(5)).toEqual({ remaining: 2, owned: 0, required: 2 })
  })

  it('aucun projet : liste vide', () => {
    expect(computeGlobalShopping([]).size).toBe(0)
  })
})
