/**
 * Récupère une panoplie (fetch + parse, sans cache — usage ponctuel à
 * l'import dans un projet).
 */

import { parsePanopliePage, type ParsedPanoplie } from '../parse/parsePanopliePage'
import { fetchViaJina, type FetchFn } from './jina'
import { FetchQueue, globalQueue } from './queue'
import { normalizeItemUrl } from './url'

export async function fetchPanoplie(
  rawUrl: string,
  opts: { signal?: AbortSignal; queue?: FetchQueue; fetchFn?: FetchFn } = {},
): Promise<ParsedPanoplie> {
  const url = normalizeItemUrl(rawUrl)
  const queue = opts.queue ?? globalQueue
  // Parse dans la file (réponse vide réessayée).
  return queue.enqueue(async (signal) => {
    const markdown = await fetchViaJina(url, opts.fetchFn, signal)
    return parsePanopliePage(markdown, url)
  }, opts.signal)
}
