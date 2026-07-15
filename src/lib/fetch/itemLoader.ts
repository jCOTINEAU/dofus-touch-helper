/**
 * Chargement d'un objet : cache Dexie d'abord (jamais de re-fetch sans
 * `refresh`), sinon fetch via la file + parse + mise en cache. Une page
 * morte (404 encyclopédie) est cachée comme stub `fetchStatus: 'dead'`
 * avec le nom fourni par la recette parente.
 */

import { db } from '../db/db'
import { DeadPageError, parseItemPage } from '../parse/parseItemPage'
import type { CachedItem } from '../types'
import { fetchViaJina, type FetchFn } from './jina'
import { FetchQueue, globalQueue } from './queue'
import { extractItemId, normalizeItemUrl } from './url'

export interface LoadOptions {
  refresh?: boolean
  /** Nom vu dans la recette parente (utilisé pour les pages mortes). */
  parentName?: string
  signal?: AbortSignal
  queue?: FetchQueue
  fetchFn?: FetchFn
}

export interface LoadResult {
  item: CachedItem
  fromCache: boolean
}

export async function getOrFetchItem(rawUrl: string, opts: LoadOptions = {}): Promise<LoadResult> {
  const url = normalizeItemUrl(rawUrl)
  const id = extractItemId(url)
  if (id === null) throw new Error(`URL encyclopédie invalide : ${rawUrl}`)

  if (!opts.refresh) {
    const cached = await db.items.get(id)
    if (cached) return { item: cached, fromCache: true }
  }

  const queue = opts.queue ?? globalQueue
  let item: CachedItem
  try {
    const markdown = await queue.enqueue(
      (signal) => fetchViaJina(url, opts.fetchFn, signal),
      opts.signal,
    )
    const parsed = parseItemPage(markdown, url)
    item = {
      id: parsed.id,
      url,
      name: parsed.name,
      category: parsed.category,
      level: parsed.level,
      imageUrl: parsed.imageUrl,
      recipe: parsed.recipe
        ? {
            job: parsed.recipe.job,
            jobLevel: parsed.recipe.jobLevel,
            components: parsed.recipe.components.map((c) => ({
              itemId: c.itemId,
              name: c.name,
              url: c.url,
              qty: c.qty,
              category: c.category,
              level: c.level,
              imageUrl: c.imageUrl,
            })),
          }
        : null,
      fetchStatus: 'ok',
      fetchedAt: Date.now(),
    }
  } catch (e) {
    if (!(e instanceof DeadPageError)) throw e
    item = {
      id,
      url,
      name: opts.parentName ?? url.split('/').pop() ?? String(id),
      category: null,
      level: null,
      imageUrl: null,
      recipe: null,
      fetchStatus: 'dead',
      fetchedAt: Date.now(),
    }
  }
  await db.items.put(item)
  return { item, fromCache: false }
}
