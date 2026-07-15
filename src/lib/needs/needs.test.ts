import { describe, expect, it } from 'vitest'
import { computeNeeds } from './needs'
import { DIAMOND_CATALOG, RING_CATALOG, makeCatalog, makeStates } from './__fixtures__/catalogs'

const NO_STATE = makeStates({})

const need = (r: ReturnType<typeof computeNeeds>, id: number) => {
  const n = r.byItem.get(id)
  if (!n) throw new Error(`byItem sans entrée pour ${id}`)
  return n
}
const shoppingMap = (r: ReturnType<typeof computeNeeds>) =>
  new Map(r.shopping.map((s) => [s.itemId, s.qty]))

describe('computeNeeds', () => {
  it('1. cible feuille simple → shopping = qty', () => {
    const catalog = makeCatalog([{ id: 3, name: 'or' }])
    const r = computeNeeds(catalog, [{ itemId: 3, qty: 7 }], NO_STATE)
    expect(need(r, 3)).toMatchObject({ required: 7, remaining: 7, isLeafInPlan: true })
    expect(shoppingMap(r).get(3)).toBe(7)
  })

  it('2. recette à 1 niveau : multiplication des quantités', () => {
    const r = computeNeeds(RING_CATALOG, [{ itemId: 2, qty: 4 }], NO_STATE)
    expect(need(r, 2)).toMatchObject({ required: 4, craftsToDo: 4, isLeafInPlan: false })
    expect(need(r, 3).required).toBe(8) // 4 potions × 2 or
    expect(need(r, 4).required).toBe(4)
  })

  it('3. chaîne à 3 niveaux : multiplication en cascade', () => {
    const r = computeNeeds(RING_CATALOG, [{ itemId: 1, qty: 2 }], NO_STATE)
    expect(need(r, 2).required).toBe(20) // 2 anneaux × 10 potions
    expect(need(r, 3).required).toBe(40) // 20 potions × 2 or
    expect(need(r, 5).required).toBe(10) // 2 anneaux × 5 cuir
  })

  it('4. diamant : les besoins du composant partagé fusionnent', () => {
    const r = computeNeeds(DIAMOND_CATALOG, [{ itemId: 1, qty: 1 }], NO_STATE)
    expect(need(r, 4).required).toBe(5) // 1×B→2×D + 1×C→3×D
  })

  it('5. item à la fois cible et composant : addition', () => {
    const r = computeNeeds(
      RING_CATALOG,
      [
        { itemId: 1, qty: 1 },
        { itemId: 2, qty: 3 },
      ],
      NO_STATE,
    )
    expect(need(r, 2)).toMatchObject({ required: 13, fromTargets: 3 }) // 10 (anneau) + 3 (cible)
    expect(need(r, 3).required).toBe(26)
  })

  it('6. owned sur feuille : déduction et clamp à 0', () => {
    const r = computeNeeds(
      RING_CATALOG,
      [{ itemId: 2, qty: 4 }],
      makeStates({ 3: { owned: 3 }, 4: { owned: 99 } }),
    )
    expect(need(r, 3)).toMatchObject({ required: 8, owned: 3, remaining: 5 })
    expect(need(r, 4)).toMatchObject({ required: 4, owned: 99, remaining: 0 })
    expect(shoppingMap(r).has(4)).toBe(false)
  })

  it('7. owned sur intermédiaire : 10 potions requises, 3 possédées → or = 14', () => {
    const r = computeNeeds(
      RING_CATALOG,
      [{ itemId: 1, qty: 1 }],
      makeStates({ 2: { owned: 3 } }),
    )
    expect(need(r, 2)).toMatchObject({ required: 10, owned: 3, remaining: 7, craftsToDo: 7 })
    expect(need(r, 3).required).toBe(14) // 7 crafts × 2 or, pas 20
    expect(need(r, 4).required).toBe(7)
  })

  it('8. owned intermédiaire > requis : composants à 0, jamais de négatif', () => {
    const r = computeNeeds(
      RING_CATALOG,
      [{ itemId: 1, qty: 1 }],
      makeStates({ 2: { owned: 25 } }),
    )
    expect(need(r, 2)).toMatchObject({ remaining: 0, craftsToDo: 0 })
    expect(need(r, 3).required).toBe(0)
    expect(shoppingMap(r).has(3)).toBe(false)
  })

  it('9. toggle buy : sous-arbre exclu, item dans la liste de courses', () => {
    const r = computeNeeds(
      RING_CATALOG,
      [{ itemId: 1, qty: 1 }],
      makeStates({ 2: { mode: 'buy' } }),
    )
    expect(need(r, 2)).toMatchObject({ required: 10, isLeafInPlan: true, craftsToDo: 0 })
    expect(shoppingMap(r).get(2)).toBe(10)
    expect(r.byItem.has(3)).toBe(false) // l'or n'apparaît pas dans le plan
  })

  it("10. buy + diamant : l'état s'applique à toutes les occurrences", () => {
    const r = computeNeeds(
      DIAMOND_CATALOG,
      [{ itemId: 1, qty: 1 }],
      makeStates({ 3: { mode: 'buy' } }),
    )
    expect(need(r, 4).required).toBe(2) // seul B propage (C est acheté)
    expect(shoppingMap(r).get(3)).toBe(1)
  })

  it('11. composant mort : compté comme feuille normale', () => {
    const r = computeNeeds(RING_CATALOG, [{ itemId: 2, qty: 2 }], NO_STATE)
    expect(need(r, 4)).toMatchObject({ required: 2, isLeafInPlan: true })
    expect(shoppingMap(r).get(4)).toBe(2)
  })

  it('12. cycle : coupé avec warning, pas de boucle infinie', () => {
    const catalog = makeCatalog([
      { id: 1, name: 'A', recipe: [[2, 2]] },
      { id: 2, name: 'B', recipe: [[1, 1], [3, 3]] },
      { id: 3, name: 'C' },
    ])
    const r = computeNeeds(catalog, [{ itemId: 1, qty: 1 }], NO_STATE)
    expect(r.warnings.some((w) => w.includes('Cycle'))).toBe(true)
    expect(need(r, 2).required).toBe(2)
    expect(need(r, 3).required).toBe(6)
  })

  it('13. multi-cibles avec quantités : agrégation', () => {
    const r = computeNeeds(
      RING_CATALOG,
      [
        { itemId: 2, qty: 2 },
        { itemId: 5, qty: 4 },
        { itemId: 2, qty: 1 },
      ],
      NO_STATE,
    )
    expect(need(r, 2)).toMatchObject({ required: 3, fromTargets: 3 })
    expect(need(r, 5)).toMatchObject({ required: 4 })
  })

  it('14. item absent du catalogue : feuille + warning', () => {
    const catalog = makeCatalog([{ id: 1, name: 'A', recipe: [[999, 5]] }])
    const r = computeNeeds(catalog, [{ itemId: 1, qty: 1 }], NO_STATE)
    expect(need(r, 999)).toMatchObject({ required: 5, isLeafInPlan: true })
    expect(r.warnings.some((w) => w.includes('999'))).toBe(true)
  })

  it('15. buy sur parent + owned sur enfant orphelin : enfant hors plan', () => {
    const r = computeNeeds(
      RING_CATALOG,
      [{ itemId: 1, qty: 1 }],
      makeStates({ 2: { mode: 'buy' }, 3: { owned: 50 } }),
    )
    expect(r.byItem.has(3)).toBe(false) // l'or n'est plus requis par personne
  })

  it("16. déterminisme : l'ordre du catalogue et des états ne change rien", () => {
    const specs: Parameters<typeof makeCatalog>[0] = [
      { id: 1, name: 'anneau', recipe: [[2, 10], [5, 5]] },
      { id: 2, name: 'potion', recipe: [[3, 2], [4, 1]] },
      { id: 3, name: 'or' },
      { id: 4, name: 'bocal', dead: true },
      { id: 5, name: 'cuir' },
    ]
    const r1 = computeNeeds(makeCatalog(specs), [{ itemId: 1, qty: 1 }], NO_STATE)
    const r2 = computeNeeds(makeCatalog([...specs].reverse()), [{ itemId: 1, qty: 1 }], NO_STATE)
    expect([...r1.byItem.entries()].sort()).toEqual([...r2.byItem.entries()].sort())
    expect(shoppingMap(r1)).toEqual(shoppingMap(r2))
  })

  it('17. cycle atteint par des chemins disjoints : filet de sécurité, pas de nœud perdu', () => {
    // B(2) et C(3) forment un cycle, atteints par deux cibles distinctes.
    const catalog = makeCatalog([
      { id: 2, name: 'B', recipe: [[3, 1]] },
      { id: 3, name: 'C', recipe: [[2, 1]] },
    ])
    const r = computeNeeds(
      catalog,
      [
        { itemId: 2, qty: 1 },
        { itemId: 3, qty: 1 },
      ],
      NO_STATE,
    )
    // Tous les nœuds découverts doivent exister dans byItem, sans boucle infinie.
    expect(r.byItem.has(2)).toBe(true)
    expect(r.byItem.has(3)).toBe(true)
  })
})
