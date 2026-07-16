/**
 * Dernier projet consulté : l'onglet « Projets » du dock y ramène
 * directement au lieu de repasser par la liste. Persisté en localStorage
 * pour survivre aux rechargements.
 */

const KEY = 'dofus-craft:last-project'

function readInitial(): number | null {
  const raw = localStorage.getItem(KEY)
  const n = Number(raw)
  return raw !== null && Number.isFinite(n) ? n : null
}

let value = $state<number | null>(readInitial())

export const lastProject = {
  get value() {
    return value
  },
  set(id: number) {
    value = id
    localStorage.setItem(KEY, String(id))
  },
  /** Oublie le projet (si `id` est fourni, seulement s'il correspond). */
  clear(id?: number) {
    if (id === undefined || value === id) {
      value = null
      localStorage.removeItem(KEY)
    }
  },
}
