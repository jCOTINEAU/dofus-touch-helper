/**
 * Moteur de calcul des besoins d'un projet de craft.
 *
 * Fonctions pures : aucune dépendance à Dexie ou au DOM. L'entrée est un
 * catalogue plat (id → recette), les cibles du projet et l'état par item
 * (mode craft/achat, quantité possédée) ; la sortie donne, pour chaque item
 * du plan, le besoin brut, le restant après déduction du stock, et la liste
 * de courses (feuilles du plan).
 *
 * Règle centrale : la déduction du stock s'applique AVANT l'expansion d'une
 * recette. Posséder 3 potions sur 10 requises ne propage que 7 crafts vers
 * les composants de la potion.
 */

export interface CatalogEntry {
  itemId: number
  name: string
  dead: boolean
  recipe: { components: { itemId: number; qty: number }[] } | null
}

export type Catalog = ReadonlyMap<number, CatalogEntry>

export interface Target {
  itemId: number
  qty: number
}

export interface ItemState {
  mode: 'craft' | 'buy'
  owned: number
}

export type StateMap = ReadonlyMap<number, ItemState>

export interface NodeNeed {
  itemId: number
  /** Besoin brut, après propagation des déductions des parents. */
  required: number
  owned: number
  /** max(0, required − owned) */
  remaining: number
  /** Nombre de crafts à faire (= remaining si craftable en mode craft, sinon 0). */
  craftsToDo: number
  /** Feuille du plan : sans recette, ou mode achat, ou mort, ou absent du catalogue. */
  isLeafInPlan: boolean
  /** Part de `required` venant directement des cibles du projet. */
  fromTargets: number
}

export interface NeedsResult {
  byItem: Map<number, NodeNeed>
  /** Feuilles du plan avec remaining > 0 : la liste de courses. */
  shopping: { itemId: number; qty: number }[]
  warnings: string[]
}

const DEFAULT_STATE: ItemState = { mode: 'craft', owned: 0 }

/** Un item est développé (ses composants comptent) ssi recette + mode craft. */
function isExpanded(entry: CatalogEntry | undefined, state: ItemState): boolean {
  return entry !== undefined && entry.recipe !== null && state.mode === 'craft'
}

export function computeNeeds(
  catalog: Catalog,
  targets: readonly Target[],
  states: StateMap,
): NeedsResult {
  const warnings: string[] = []
  const stateOf = (id: number) => states.get(id) ?? DEFAULT_STATE

  // --- 1. Sous-graphe induit + détection de cycles (DFS itératif). ---
  // Les arêtes qui fermeraient un cycle sont coupées (l'item est alors
  // traité comme feuille pour cette branche), avec un warning.
  const edges = new Map<number, { itemId: number; qty: number }[]>()
  const discovered: number[] = []
  const seen = new Set<number>()
  const cycleEdges = new Set<string>()

  const dfs = (rootId: number) => {
    const stack: { id: number; onPath: Set<number> }[] = [
      { id: rootId, onPath: new Set() },
    ]
    while (stack.length > 0) {
      const { id, onPath } = stack.pop()!
      if (!seen.has(id)) {
        seen.add(id)
        discovered.push(id)
      }
      if (edges.has(id)) continue // déjà développé (sous-arbre partagé)
      const entry = catalog.get(id)
      if (!isExpanded(entry, stateOf(id))) continue
      const children: { itemId: number; qty: number }[] = []
      const nextPath = new Set(onPath).add(id)
      for (const comp of entry!.recipe!.components) {
        if (nextPath.has(comp.itemId)) {
          cycleEdges.add(`${id}->${comp.itemId}`)
          warnings.push(
            `Cycle de recette coupé : ${entry!.name} → ${catalog.get(comp.itemId)?.name ?? comp.itemId}`,
          )
          continue
        }
        children.push({ itemId: comp.itemId, qty: comp.qty })
        stack.push({ id: comp.itemId, onPath: nextPath })
      }
      edges.set(id, children)
    }
  }
  for (const t of targets) dfs(t.itemId)

  // --- 2. Tri topologique (Kahn) sur le sous-graphe sans cycles. ---
  const inDegree = new Map<number, number>()
  for (const id of discovered) inDegree.set(id, 0)
  for (const children of edges.values()) {
    for (const c of children) inDegree.set(c.itemId, (inDegree.get(c.itemId) ?? 0) + 1)
  }
  const queue = discovered.filter((id) => inDegree.get(id) === 0)
  const topo: number[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    topo.push(id)
    for (const c of edges.get(id) ?? []) {
      const d = inDegree.get(c.itemId)! - 1
      inDegree.set(c.itemId, d)
      if (d === 0) queue.push(c.itemId)
    }
  }

  // Filet de sécurité : un cycle peut échapper à la DFS quand ses nœuds ont
  // été développés via des chemins disjoints. Les nœuds restants sont alors
  // traités comme des feuilles (sans propagation), avec un warning.
  const forcedLeaves = new Set<number>()
  if (topo.length < discovered.length) {
    const processed = new Set(topo)
    for (const id of discovered) {
      if (!processed.has(id)) {
        forcedLeaves.add(id)
        topo.push(id)
        warnings.push(
          `Cycle de recette non résolu autour de ${catalog.get(id)?.name ?? id} : traité comme ressource de base`,
        )
      }
    }
  }

  // --- 3. Besoin initial : les cibles. ---
  const required = new Map<number, number>()
  const fromTargets = new Map<number, number>()
  for (const t of targets) {
    required.set(t.itemId, (required.get(t.itemId) ?? 0) + t.qty)
    fromTargets.set(t.itemId, (fromTargets.get(t.itemId) ?? 0) + t.qty)
  }

  // --- 4. Propagation top-down en ordre topologique. ---
  const byItem = new Map<number, NodeNeed>()
  for (const id of topo) {
    const entry = catalog.get(id)
    const state = stateOf(id)
    const req = required.get(id) ?? 0
    const remaining = Math.max(0, req - state.owned)
    const expanded = isExpanded(entry, state) && !forcedLeaves.has(id)
    const craftsToDo = expanded ? remaining : 0

    if (entry === undefined) {
      warnings.push(`Données manquantes pour l'item ${id} (fetch incomplet ?)`)
    }

    if (expanded && craftsToDo > 0) {
      for (const c of edges.get(id) ?? []) {
        required.set(c.itemId, (required.get(c.itemId) ?? 0) + craftsToDo * c.qty)
      }
    }

    byItem.set(id, {
      itemId: id,
      required: req,
      owned: state.owned,
      remaining,
      craftsToDo,
      isLeafInPlan: !expanded,
      fromTargets: fromTargets.get(id) ?? 0,
    })
  }

  const shopping = [...byItem.values()]
    .filter((n) => n.isLeafInPlan && n.remaining > 0)
    .map((n) => ({ itemId: n.itemId, qty: n.remaining }))

  return { byItem, shopping, warnings }
}
