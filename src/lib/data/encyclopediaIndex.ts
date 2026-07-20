/**
 * Index de recherche de l'encyclopédie (nom → id/url/type), généré hors
 * ligne par scripts/build-encyclopedia-index.mjs et livré dans
 * public/encyclopedia-index.json. Chargé une fois, à la demande.
 */

export interface IndexEntry {
  id: number
  name: string
  url: string
  /** Section : ressources | equipements | armes | consommables | panoplies | monstres */
  type: string
}

let cache: IndexEntry[] | null = null
let loading: Promise<IndexEntry[]> | null = null

export function loadIndex(): Promise<IndexEntry[]> {
  if (cache) return Promise.resolve(cache)
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}encyclopedia-index.json`)
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d: { entries?: IndexEntry[] }) => {
        cache = d.entries ?? []
        return cache
      })
      .catch(() => {
        cache = []
        return cache
      })
  }
  return loading
}

/** Normalisation pour recherche insensible à la casse et aux accents. */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

/**
 * Recherche par nom dans l'index. `types` filtre les sections (undefined =
 * toutes). Priorise les préfixes, puis limite à `limit` résultats.
 */
export function searchIndex(
  entries: readonly IndexEntry[],
  query: string,
  types?: readonly string[],
  limit = 30,
): IndexEntry[] {
  const q = norm(query.trim())
  if (q.length < 2) return []
  const scored: { e: IndexEntry; score: number }[] = []
  for (const e of entries) {
    if (types && !types.includes(e.type)) continue
    const n = norm(e.name)
    const i = n.indexOf(q)
    if (i === -1) continue
    scored.push({ e, score: i === 0 ? 0 : 1 })
  }
  scored.sort((a, b) => a.score - b.score || a.e.name.localeCompare(b.e.name, 'fr'))
  return scored.slice(0, limit).map((s) => s.e)
}
