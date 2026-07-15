/** Helpers d'accès typés au-dessus de Dexie. */

import { db } from './db'
import type { CachedItem, NodeState } from '../types'
import type { Catalog, CatalogEntry, StateMap } from '../needs/needs'

export function toCatalogEntry(item: CachedItem): CatalogEntry {
  return {
    itemId: item.id,
    name: item.name,
    dead: item.fetchStatus === 'dead',
    recipe: item.recipe
      ? {
          components: item.recipe.components.map((c) => ({
            itemId: c.itemId,
            qty: c.qty,
          })),
        }
      : null,
  }
}

/** Catalogue complet depuis le cache (la table items reste petite). */
export async function loadCatalog(): Promise<Catalog> {
  const items = await db.items.toArray()
  return new Map(items.map((i) => [i.id, toCatalogEntry(i)]))
}

/** États (mode/possédé) d'un projet sous forme de StateMap pour computeNeeds. */
export async function loadStateMap(projectId: number): Promise<StateMap> {
  const states = await db.nodeStates.where({ projectId }).toArray()
  return new Map(states.map((s) => [s.itemId, { mode: s.mode, owned: s.owned }]))
}

export async function setNodeMode(
  projectId: number,
  itemId: number,
  mode: NodeState['mode'],
): Promise<void> {
  const existing = await db.nodeStates.get([projectId, itemId])
  await db.nodeStates.put({ projectId, itemId, mode, owned: existing?.owned ?? 0 })
}

export async function setNodeOwned(
  projectId: number,
  itemId: number,
  owned: number,
): Promise<void> {
  const existing = await db.nodeStates.get([projectId, itemId])
  await db.nodeStates.put({
    projectId,
    itemId,
    mode: existing?.mode ?? 'craft',
    owned: Math.max(0, owned),
  })
}
