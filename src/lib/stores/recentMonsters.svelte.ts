/** Monstres sélectionnés récemment (accès rapide dans le picker de session). */

const KEY = 'dofus-craft:recent-monsters'
const MAX = 12

let ids = $state<number[]>(read())

function read(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'number') : []
  } catch {
    return []
  }
}

export const recentMonsters = {
  get ids() {
    return ids
  },
  push(id: number) {
    ids = [id, ...ids.filter((x) => x !== id)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(ids))
  },
}
