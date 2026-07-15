/** Mini-catalogues et helpers pour les tests du moteur de besoins. */

import type { Catalog, CatalogEntry, ItemState, StateMap } from '../needs'

interface EntrySpec {
  id: number
  name?: string
  dead?: boolean
  /** [itemId, qty] par composant ; absent = ressource de base. */
  recipe?: [number, number][]
}

export function makeCatalog(specs: EntrySpec[]): Catalog {
  const map = new Map<number, CatalogEntry>()
  for (const s of specs) {
    map.set(s.id, {
      itemId: s.id,
      name: s.name ?? `item-${s.id}`,
      dead: s.dead ?? false,
      recipe: s.recipe
        ? { components: s.recipe.map(([itemId, qty]) => ({ itemId, qty })) }
        : null,
    })
  }
  return map
}

export function makeStates(spec: Record<number, Partial<ItemState>>): StateMap {
  const map = new Map<number, ItemState>()
  for (const [id, s] of Object.entries(spec)) {
    map.set(Number(id), { mode: s.mode ?? 'craft', owned: s.owned ?? 0 })
  }
  return map
}

/**
 * Scénario de référence, calqué sur le cas réel Anneau/Essence/Potion :
 *   anneau(1) = 10 × potion(2) + 5 × cuir(5)
 *   potion(2) = 2 × or(3) + 1 × bocal(4, mort)
 */
export const RING_CATALOG = makeCatalog([
  { id: 1, name: 'anneau', recipe: [[2, 10], [5, 5]] },
  { id: 2, name: 'potion', recipe: [[3, 2], [4, 1]] },
  { id: 3, name: 'or' },
  { id: 4, name: 'bocal', dead: true },
  { id: 5, name: 'cuir' },
])

/**
 * Diamant : A(1) = 1 × B(2) + 1 × C(3) ; B = 2 × D(4) ; C = 3 × D(4).
 */
export const DIAMOND_CATALOG = makeCatalog([
  { id: 1, name: 'A', recipe: [[2, 1], [3, 1]] },
  { id: 2, name: 'B', recipe: [[4, 2]] },
  { id: 3, name: 'C', recipe: [[4, 3]] },
  { id: 4, name: 'D' },
])
