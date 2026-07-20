/**
 * Mémorise, par projet, quels nœuds de l'arbre de craft sont dépliés.
 * Tout est replié par défaut (aucun id mémorisé) ; l'état est persisté en
 * localStorage. Les nœuds complétés sont forcés repliés côté affichage.
 */

const KEY = 'dofus-craft:tree-expand'

function read(): Record<number, number[]> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

let data = $state<Record<number, number[]>>(read())

function save() {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export const treeExpand = {
  isOpen(projectId: number, itemId: number): boolean {
    return (data[projectId] ?? []).includes(itemId)
  },
  toggle(projectId: number, itemId: number) {
    const set = new Set(data[projectId] ?? [])
    if (set.has(itemId)) set.delete(itemId)
    else set.add(itemId)
    data = { ...data, [projectId]: [...set] }
    save()
  },
  collapse(projectId: number, itemId: number) {
    const list = data[projectId] ?? []
    if (!list.includes(itemId)) return
    data = { ...data, [projectId]: list.filter((x) => x !== itemId) }
    save()
  },
}
