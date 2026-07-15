/**
 * Arbre structurel du craft pour l'affichage : indépendant des états
 * (mode/possédé), qui viennent de `computeNeeds().byItem`. Les sous-arbres
 * partagés sont dupliqués (chaque occurrence est affichée sous son parent).
 */

import type { Catalog, Target } from './needs'

export interface DisplayNode {
  itemId: number
  /** Quantité par craft du parent (ou quantité cible pour une racine). */
  qtyPerCraft: number
  children: DisplayNode[]
  /** true si ce nœud ferme un cycle (non développé). */
  cycleCut: boolean
}

export function buildDisplayTree(catalog: Catalog, targets: readonly Target[]): DisplayNode[] {
  const build = (itemId: number, qty: number, path: ReadonlySet<number>): DisplayNode => {
    const entry = catalog.get(itemId)
    if (path.has(itemId)) {
      return { itemId, qtyPerCraft: qty, children: [], cycleCut: true }
    }
    const nextPath = new Set(path).add(itemId)
    const children =
      entry?.recipe?.components.map((c) => build(c.itemId, c.qty, nextPath)) ?? []
    return { itemId, qtyPerCraft: qty, children, cycleCut: false }
  }
  return targets.map((t) => build(t.itemId, t.qty, new Set()))
}
