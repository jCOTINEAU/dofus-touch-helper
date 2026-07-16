import { describe, expect, it } from 'vitest'
import { costShopping, effectiveCost } from './costs'
import { DIAMOND_CATALOG, RING_CATALOG, makeCatalog } from '../needs/__fixtures__/catalogs'

// Rappel RING_CATALOG : anneau(1) = 10 × potion(2) + 5 × cuir(5) ;
// potion(2) = 2 × or(3) + 1 × bocal(4, mort) ; or/bocal/cuir = feuilles.

const prices = (map: Record<number, number>) => (id: number) => map[id] ?? null

describe('effectiveCost', () => {
  it('feuille : coût = prix d’achat', () => {
    const c = effectiveCost(RING_CATALOG, prices({ 3: 50 }), 3)
    expect(c).toMatchObject({ buy: 50, craft: null, best: 50, bestSource: 'buy' })
  })

  it('feuille sans prix : incalculable et signalée', () => {
    const c = effectiveCost(RING_CATALOG, prices({}), 3)
    expect(c.best).toBeNull()
    expect(c.missingPrices).toEqual([3])
  })

  it('craftable : coût de craft = somme des composants', () => {
    // potion = 2 × or(50) + 1 × bocal(10) = 110
    const c = effectiveCost(RING_CATALOG, prices({ 3: 50, 4: 10 }), 2)
    expect(c.craft).toBe(110)
    expect(c.buy).toBeNull()
    expect(c).toMatchObject({ best: 110, bestSource: 'craft' })
  })

  it('crafter vs acheter : le moins cher gagne', () => {
    const cheapBuy = effectiveCost(RING_CATALOG, prices({ 2: 80, 3: 50, 4: 10 }), 2)
    expect(cheapBuy).toMatchObject({ buy: 80, craft: 110, best: 80, bestSource: 'buy' })

    const cheapCraft = effectiveCost(RING_CATALOG, prices({ 2: 200, 3: 50, 4: 10 }), 2)
    expect(cheapCraft).toMatchObject({ best: 110, bestSource: 'craft' })
  })

  it('égalité : craft privilégié (économie du joueur artisan)', () => {
    const c = effectiveCost(RING_CATALOG, prices({ 2: 110, 3: 50, 4: 10 }), 2)
    expect(c.bestSource).toBe('craft')
  })

  it('récursif : le composant intermédiaire est évalué au meilleur coût', () => {
    // anneau = 10 × potion + 5 × cuir(20).
    // potion : achat 80 < craft 110 → 80. anneau craft = 10×80 + 5×20 = 900.
    const c = effectiveCost(RING_CATALOG, prices({ 2: 80, 3: 50, 4: 10, 5: 20 }), 1)
    expect(c.craft).toBe(900)
    expect(c.bestSource).toBe('craft')
  })

  it('composant sans prix ni recette : craft incalculable mais achat utilisable', () => {
    // potion : bocal sans prix → craft null ; achat 80 → best 80.
    const c = effectiveCost(RING_CATALOG, prices({ 2: 80, 3: 50 }), 2)
    expect(c.craft).toBeNull()
    expect(c).toMatchObject({ best: 80, bestSource: 'buy' })
    expect(c.missingPrices).toContain(4)
  })

  it('diamant : le cache mémoïse le composant partagé', () => {
    let calls = 0
    const priceOf = (id: number) => {
      if (id === 4) calls++
      return id === 4 ? 5 : null
    }
    const cache = new Map()
    const c = effectiveCost(DIAMOND_CATALOG, priceOf, 1, cache)
    // A = B(2×D) + C(3×D) = 2×5 + 3×5 = 25
    expect(c.craft).toBe(25)
    expect(calls).toBe(1) // D évalué une seule fois
  })

  it('cycle : pas de boucle infinie, coût calculable via l’achat', () => {
    const catalog = makeCatalog([
      { id: 1, name: 'A', recipe: [[2, 1]] },
      { id: 2, name: 'B', recipe: [[1, 1]] },
    ])
    const c = effectiveCost(catalog, prices({ 2: 30 }), 1)
    // A craft = 1 × B ; B: achat 30, son craft référence A (cycle) → ignoré.
    expect(c.craft).toBe(30)
  })

  it('cycle sans aucun prix : incalculable proprement', () => {
    const catalog = makeCatalog([
      { id: 1, name: 'A', recipe: [[2, 1]] },
      { id: 2, name: 'B', recipe: [[1, 1]] },
    ])
    const c = effectiveCost(catalog, prices({}), 1)
    expect(c.best).toBeNull()
  })
})

describe('costShopping', () => {
  it('chiffre chaque ligne et le total', () => {
    const cost = costShopping(
      [
        { itemId: 3, qty: 14 },
        { itemId: 5, qty: 10 },
      ],
      prices({ 3: 50, 5: 20 }),
    )
    expect(cost.lines[0]).toMatchObject({ lineCost: 700 })
    expect(cost.lines[1]).toMatchObject({ lineCost: 200 })
    expect(cost.total).toBe(900)
    expect(cost.missingPrices).toEqual([])
  })

  it('prix manquant : ligne à null, total partiel, id signalé', () => {
    const cost = costShopping(
      [
        { itemId: 3, qty: 14 },
        { itemId: 4, qty: 7 },
      ],
      prices({ 3: 50 }),
    )
    expect(cost.lines[1]).toMatchObject({ unitPrice: null, lineCost: null })
    expect(cost.total).toBe(700)
    expect(cost.missingPrices).toEqual([4])
  })

  it('liste vide : total zéro', () => {
    expect(costShopping([], prices({}))).toMatchObject({ total: 0, missingPrices: [] })
  })
})
