/**
 * Mini routeur hash : `#/projets/3` → { name: 'projet', params: { id: '3' } }.
 * Les patterns utilisent `:param` pour les segments dynamiques.
 */

export interface Route {
  name: string
  params: Record<string, string>
}

const patterns: { pattern: string; name: string }[] = [
  { pattern: '', name: 'projets' },
  { pattern: 'projets/:id', name: 'projet' },
  { pattern: 'courses', name: 'courses' },
  { pattern: 'prix', name: 'prix' },
  // Avant prix/:itemId (premier motif gagnant).
  { pattern: 'prix/session', name: 'prixSession' },
  { pattern: 'prix/:itemId', name: 'prixDetail' },
  { pattern: 'combats', name: 'combats' },
  { pattern: 'combats/:id', name: 'combatDetail' },
  { pattern: 'reglages', name: 'reglages' },
  { pattern: 'debug', name: 'debug' },
]

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').replace(/\/$/, '')
  const segments = path === '' ? [] : path.split('/')
  for (const { pattern, name } of patterns) {
    const parts = pattern === '' ? [] : pattern.split('/')
    if (parts.length !== segments.length) continue
    const params: Record<string, string> = {}
    let ok = true
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(':')) {
        params[parts[i].slice(1)] = decodeURIComponent(segments[i])
      } else if (parts[i] !== segments[i]) {
        ok = false
        break
      }
    }
    if (ok) return { name, params }
  }
  return { name: 'projets', params: {} }
}

function createRouter() {
  let current = $state<Route>(parseHash(location.hash))

  window.addEventListener('hashchange', () => {
    current = parseHash(location.hash)
  })

  return {
    get route() {
      return current
    },
    go(path: string) {
      location.hash = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`
    },
  }
}

export const router = createRouter()
