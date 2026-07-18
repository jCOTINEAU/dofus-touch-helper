/**
 * Chargement d'un monstre : cache Dexie d'abord, sinon fetch via la file +
 * parse + mise en cache. Crée aussi des stubs d'items pour les ressources
 * dropées (afin d'avoir leur nom partout, sans fetch supplémentaire).
 */

import { db } from '../db/db'
import { parseMonsterPage } from '../parse/parseMonsterPage'
import type { CachedItem, CachedMonster } from '../types'
import { fetchViaJina, type FetchFn } from './jina'
import { FetchQueue, globalQueue } from './queue'
import { extractItemId, normalizeItemUrl } from './url'

export interface MonsterLoadOptions {
  refresh?: boolean
  signal?: AbortSignal
  queue?: FetchQueue
  fetchFn?: FetchFn
}

export async function getOrFetchMonster(
  rawUrl: string,
  opts: MonsterLoadOptions = {},
): Promise<{ monster: CachedMonster; fromCache: boolean }> {
  const url = normalizeItemUrl(rawUrl)
  const id = extractItemId(url)
  if (id === null) throw new Error(`URL monstre invalide : ${rawUrl}`)

  if (!opts.refresh) {
    const cached = await db.monsters.get(id)
    if (cached) return { monster: cached, fromCache: true }
  }

  const queue = opts.queue ?? globalQueue
  const markdown = await queue.enqueue(
    (signal) => fetchViaJina(url, opts.fetchFn, signal),
    opts.signal,
  )
  const parsed = parseMonsterPage(markdown, url)
  const monster: CachedMonster = {
    id: parsed.id,
    url,
    name: parsed.name,
    imageUrl: parsed.imageUrl,
    drops: parsed.drops,
    fetchedAt: Date.now(),
  }
  await db.monsters.put(monster)

  // Étiquettes pour les ressources dropées non encore connues.
  const stubs: CachedItem[] = []
  for (const d of parsed.drops) {
    if (await db.items.get(d.itemId)) continue
    if (stubs.some((s) => s.id === d.itemId)) continue
    stubs.push({
      id: d.itemId,
      url: d.url,
      name: d.name,
      category: null,
      level: null,
      imageUrl: null,
      recipe: null,
      fetchStatus: 'ok',
      fetchedAt: Date.now(),
      stub: true,
    })
  }
  if (stubs.length > 0) await db.items.bulkPut(stubs)

  return { monster, fromCache: false }
}
