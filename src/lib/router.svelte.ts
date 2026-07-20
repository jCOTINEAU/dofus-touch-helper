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
  { pattern: 'prix/rentabilite', name: 'craftMargin' },
  { pattern: 'prix/opportunites', name: 'hdvOpportunities' },
  { pattern: 'prix/:itemId', name: 'prixDetail' },
  { pattern: 'combats', name: 'combats' },
  // Avant combats/:id (premier motif gagnant).
  { pattern: 'combats/session', name: 'farmSession' },
  { pattern: 'combats/historique', name: 'farmHistory' },
  { pattern: 'combats/masques', name: 'monstersHide' },
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

const scrollKey = (hash: string) => hash.replace(/^#\/?/, '').replace(/\/$/, '') || '/'
const SCROLL_STORE = 'dofus-craft:scroll'

function loadScroll(): Map<string, number> {
  try {
    return new Map(Object.entries(JSON.parse(sessionStorage.getItem(SCROLL_STORE) ?? '{}')))
  } catch {
    return new Map()
  }
}

function createRouter() {
  let current = $state<Route>(parseHash(location.hash))
  // Position de scroll retenue par route (persistée le temps de la session
  // de navigation), pour la restaurer au retour.
  const scrollPositions = loadScroll()
  const saveScroll = () =>
    sessionStorage.setItem(SCROLL_STORE, JSON.stringify(Object.fromEntries(scrollPositions)))

  window.addEventListener('hashchange', (e) => {
    // Au moment du hashchange, la page sortante est encore rendue : on
    // enregistre sa position sous son ancien hash.
    const oldHash = e.oldURL.includes('#') ? '#' + e.oldURL.split('#')[1] : '#/'
    scrollPositions.set(scrollKey(oldHash), window.scrollY)
    saveScroll()
    current = parseHash(location.hash)
  })

  return {
    get route() {
      return current
    },
    go(path: string) {
      location.hash = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`
    },
    /** Position de scroll mémorisée pour un hash (0 si aucune). */
    savedScroll(hash: string = location.hash): number {
      return scrollPositions.get(scrollKey(hash)) ?? 0
    },
  }
}

export const router = createRouter()
