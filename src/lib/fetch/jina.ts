/**
 * Accès bas niveau au proxy r.jina.ai — seul proxy CORS validé contre
 * l'anti-bot de dofus-touch.com (corsproxy.io, allorigins et codetabs sont
 * bloqués). Renvoie la page cible convertie en markdown.
 */

export const JINA_PREFIX = 'https://r.jina.ai/'

/** Erreur transitoire (429, 5xx, réseau) : la file de fetch réessaiera. */
export class RetryableFetchError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message)
    this.name = 'RetryableFetchError'
  }
}

export type FetchFn = typeof fetch

export async function fetchViaJina(
  targetUrl: string,
  fetchFn: FetchFn = fetch,
  signal?: AbortSignal,
): Promise<string> {
  let res: Response
  try {
    res = await fetchFn(JINA_PREFIX + targetUrl, { signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    // Erreur réseau (offline, DNS…) : transitoire.
    throw new RetryableFetchError(`Réseau indisponible : ${String(e)}`)
  }
  if (res.status === 429 || res.status >= 500) {
    throw new RetryableFetchError(`jina HTTP ${res.status}`, res.status)
  }
  if (!res.ok) {
    throw new Error(`jina HTTP ${res.status} pour ${targetUrl}`)
  }
  return res.text()
}
