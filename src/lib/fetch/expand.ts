/**
 * Expansion récursive de l'arbre de craft d'un objet : BFS sur les
 * composants, chaque page n'est fetchée qu'une fois (cache Dexie). La
 * reprise après échec/annulation est triviale : relancer, les pages déjà
 * en cache sont sautées.
 */

import { getOrFetchItem, type LoadOptions } from './itemLoader'
import { extractItemId, normalizeItemUrl } from './url'

export interface ExpandProgress {
  /** Pages découvertes (croît en cours d'expansion). */
  discovered: number
  /** Pages traitées (cache ou réseau). */
  done: number
  fromCache: number
  currentName: string | null
  warnings: string[]
}

export interface ExpandOptions {
  refresh?: boolean
  signal?: AbortSignal
  onProgress?: (p: ExpandProgress) => void
  /** Injectable pour les tests. */
  loader?: typeof getOrFetchItem
}

export interface ExpandResult {
  rootId: number
  /** Nombre total de pages du sous-arbre. */
  itemCount: number
  warnings: string[]
}

export async function expandCraftTree(
  rootUrl: string,
  opts: ExpandOptions = {},
): Promise<ExpandResult> {
  const load = opts.loader ?? getOrFetchItem
  const warnings: string[] = []
  // Déduplication à l'enfilage : l'id d'un composant est connu via son URL,
  // un sous-arbre partagé n'est donc traité qu'une seule fois.
  const seen = new Set<number>()
  const rootIdFromUrl = extractItemId(normalizeItemUrl(rootUrl))
  if (rootIdFromUrl === null) throw new Error(`URL encyclopédie invalide : ${rootUrl}`)
  seen.add(rootIdFromUrl)
  const queue: { url: string; parentName?: string }[] = [{ url: rootUrl }]
  let discovered = 1
  let done = 0
  let fromCache = 0
  let rootId: number | null = null

  const report = (currentName: string | null) =>
    opts.onProgress?.({ discovered, done, fromCache, currentName, warnings })

  while (queue.length > 0) {
    if (opts.signal?.aborted) throw new DOMException('Annulé', 'AbortError')
    const { url, parentName } = queue.shift()!
    report(parentName ?? null)

    const loadOpts: LoadOptions = {
      refresh: opts.refresh,
      parentName,
      signal: opts.signal,
    }
    let item
    try {
      const result = await load(url, loadOpts)
      item = result.item
      if (result.fromCache) fromCache++
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      if (e instanceof Error && e.name === 'ParseError') {
        // Page illisible : on la compte comme feuille et on continue.
        warnings.push(`Page illisible, composant traité comme ressource de base : ${url} (${e.message})`)
        done++
        continue
      }
      throw e
    }
    done++
    rootId ??= item.id
    // L'id parsé peut différer de celui de l'URL (redirection/slug obsolète) :
    // on le marque vu pour éviter un cycle auto-référent.
    seen.add(item.id)

    if (item.fetchStatus === 'dead') {
      warnings.push(`« ${item.name} » n'existe plus dans l'encyclopédie (compté tel quel)`)
    }
    for (const comp of item.recipe?.components ?? []) {
      if (seen.has(comp.itemId)) continue
      seen.add(comp.itemId)
      discovered++
      queue.push({ url: comp.url, parentName: comp.name })
    }
  }

  report(null)
  if (rootId === null) throw new Error(`Expansion vide pour ${rootUrl}`)
  return { rootId, itemCount: seen.size, warnings }
}
