/** Helpers d'URL encyclopédie Dofus Touch. */

const ENCYCLOPEDIA_RE =
  /^https:\/\/www\.dofus-touch\.com\/[a-z]{2}\/mmorpg\/encyclopedie\/[a-z-]+\/(\d+)-[^/?#]*\/?$/

/** Extrait l'id numérique d'une URL encyclopédie ("…/14092-anneau-cycloide" → 14092). */
export function extractItemId(url: string): number | null {
  const m = /\/(\d+)-[^/?#]*\/?(?:[?#].*)?$/.exec(url)
  return m ? Number(m[1]) : null
}

/** Nettoie une URL collée par l'utilisateur (espaces, query, fragment, slash final). */
export function normalizeItemUrl(raw: string): string {
  return raw.trim().replace(/[?#].*$/, '').replace(/\/+$/, '')
}

export function isEncyclopediaItemUrl(url: string): boolean {
  return ENCYCLOPEDIA_RE.test(normalizeItemUrl(url))
}
