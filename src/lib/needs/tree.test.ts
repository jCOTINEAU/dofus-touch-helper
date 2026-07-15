import { describe, expect, it } from 'vitest'
import { buildDisplayTree } from './tree'
import { RING_CATALOG, makeCatalog } from './__fixtures__/catalogs'

describe('buildDisplayTree', () => {
  it('arbre structurel avec quantités par craft', () => {
    const [root] = buildDisplayTree(RING_CATALOG, [{ itemId: 1, qty: 2 }])
    expect(root).toMatchObject({ itemId: 1, qtyPerCraft: 2, cycleCut: false })
    expect(root.children.map((c) => [c.itemId, c.qtyPerCraft])).toEqual([
      [2, 10],
      [5, 5],
    ])
    const potion = root.children[0]
    expect(potion.children.map((c) => [c.itemId, c.qtyPerCraft])).toEqual([
      [3, 2],
      [4, 1],
    ])
    expect(potion.children[0].children).toEqual([])
  })

  it('cycle marqué cycleCut sans récursion infinie', () => {
    const catalog = makeCatalog([
      { id: 1, name: 'A', recipe: [[2, 1]] },
      { id: 2, name: 'B', recipe: [[1, 1]] },
    ])
    const [root] = buildDisplayTree(catalog, [{ itemId: 1, qty: 1 }])
    const b = root.children[0]
    expect(b.itemId).toBe(2)
    expect(b.children[0]).toMatchObject({ itemId: 1, cycleCut: true, children: [] })
  })

  it('item inconnu du catalogue : nœud feuille', () => {
    const [root] = buildDisplayTree(makeCatalog([]), [{ itemId: 42, qty: 1 }])
    expect(root).toMatchObject({ itemId: 42, children: [], cycleCut: false })
  })
})
