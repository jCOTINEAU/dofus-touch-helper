/**
 * Application d'un craft sur les stocks : consomme les composants DIRECTS
 * (comme le ferait le jeu) et incrémente l'item crafté.
 */

import type { Catalog, StateMap, ItemState } from './needs'

export interface CraftResult {
  ok: boolean
  /** Composants directs manquants (vide si le stock suffit). */
  missing: { itemId: number; missing: number }[]
  /** Nouveaux stocks à appliquer (vide si !ok). */
  updates: { itemId: number; owned: number }[]
}

const DEFAULT_STATE: ItemState = { mode: 'craft', owned: 0 }

/**
 * Par défaut strict : si un composant manque, rien n'est appliqué et
 * `missing` liste le manque exact. Avec `force`, les stocks des composants
 * sont clampés à 0 (l'utilisateur a pu crafter avec des ressources jamais
 * enregistrées) et le craft est appliqué quand même.
 */
export function applyCraft(
  catalog: Catalog,
  states: StateMap,
  itemId: number,
  count = 1,
  force = false,
): CraftResult {
  const entry = catalog.get(itemId)
  if (!entry || entry.recipe === null || count <= 0) {
    return { ok: false, missing: [], updates: [] }
  }
  const ownedOf = (id: number) => (states.get(id) ?? DEFAULT_STATE).owned

  const missing: { itemId: number; missing: number }[] = []
  for (const comp of entry.recipe.components) {
    const lack = comp.qty * count - ownedOf(comp.itemId)
    if (lack > 0) missing.push({ itemId: comp.itemId, missing: lack })
  }
  if (missing.length > 0 && !force) {
    return { ok: false, missing, updates: [] }
  }

  // Consommation (clampée à 0), puis incrément de l'item crafté. On passe
  // par une map pour gérer proprement un item présent deux fois (recette
  // exotique) ou l'item crafté lui-même en composant.
  const newOwned = new Map<number, number>()
  for (const comp of entry.recipe.components) {
    const current = newOwned.get(comp.itemId) ?? ownedOf(comp.itemId)
    newOwned.set(comp.itemId, Math.max(0, current - comp.qty * count))
  }
  newOwned.set(itemId, (newOwned.get(itemId) ?? ownedOf(itemId)) + count)

  return {
    ok: true,
    missing,
    updates: [...newOwned.entries()].map(([id, owned]) => ({ itemId: id, owned })),
  }
}
