import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { FetchQueue } from './queue'
import { JINA_PREFIX } from './jina'
import { getOrFetchItem, type LoadOptions } from './itemLoader'
import { expandCraftTree, type ExpandProgress } from './expand'
import { deadPage, itemPage } from './testPages'

const BASE = 'https://www.dofus-touch.com/fr/mmorpg/encyclopedie'
const URL_RING = `${BASE}/equipements/1-anneau`
const URL_POTION = `${BASE}/ressources/2-potion`
const URL_OR = `${BASE}/ressources/3-or`
const URL_DEAD = `${BASE}/ressources/4-bocal`
const URL_CUIR = `${BASE}/ressources/5-cuir`

// anneau = 10 × potion + 5 × cuir ; potion = 2 × or + 1 × bocal(mort) ;
// cuir et or = feuilles. Le sous-arbre potion/cuir est partagé nulle part,
// mais "or" sert aussi de composant direct de l'anneau (partagé).
const PAGES: Record<string, string> = {
  [URL_RING]: itemPage('Anneau', URL_RING, {
    job: 'Bijoutier',
    jobLevel: 100,
    components: [
      { qty: 10, name: 'Potion', url: URL_POTION },
      { qty: 5, name: 'Cuir', url: URL_CUIR },
      { qty: 2, name: 'Or', url: URL_OR },
    ],
  }),
  [URL_POTION]: itemPage('Potion', URL_POTION, {
    job: 'Mineur',
    jobLevel: 40,
    components: [
      { qty: 2, name: 'Or', url: URL_OR },
      { qty: 1, name: 'Bocal', url: URL_DEAD },
    ],
  }),
  [URL_OR]: itemPage('Or', URL_OR),
  [URL_CUIR]: itemPage('Cuir', URL_CUIR),
  [URL_DEAD]: deadPage(URL_DEAD),
}

function makeLoader(pages: Record<string, string>) {
  const queue = new FetchQueue({ sleepFn: async () => {}, nowFn: () => 0, randomFn: () => 0 })
  const calls: string[] = []
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input).replace(JINA_PREFIX, '')
    calls.push(url)
    const body = pages[url]
    return new Response(body ?? 'Not Found', { status: body ? 200 : 404 })
  }) as typeof fetch
  const loader = (url: string, opts: LoadOptions = {}) =>
    getOrFetchItem(url, { ...opts, queue, fetchFn })
  return { loader, calls }
}

beforeEach(async () => {
  await db.items.clear()
})

describe('expandCraftTree', () => {
  it("expanse tout l'arbre, une seule requête par page", async () => {
    const { loader, calls } = makeLoader(PAGES)
    const result = await expandCraftTree(URL_RING, { loader })
    expect(result.rootId).toBe(1)
    expect(result.itemCount).toBe(5)
    // « Or » est partagé (anneau + potion) mais fetché une seule fois.
    expect(calls.filter((u) => u === URL_OR)).toHaveLength(1)
    expect(await db.items.count()).toBe(5)
  })

  it('signale les pages mortes en warning', async () => {
    const { loader } = makeLoader(PAGES)
    const result = await expandCraftTree(URL_RING, { loader })
    expect(result.warnings.some((w) => w.includes('Bocal'))).toBe(true)
    expect((await db.items.get(4))!).toMatchObject({ name: 'Bocal', fetchStatus: 'dead' })
  })

  it('reprise après première passe : tout vient du cache', async () => {
    const { loader, calls } = makeLoader(PAGES)
    await expandCraftTree(URL_RING, { loader })
    const before = calls.length
    const progress: ExpandProgress[] = []
    await expandCraftTree(URL_RING, { loader, onProgress: (p) => progress.push({ ...p }) })
    expect(calls.length).toBe(before) // aucune nouvelle requête
    expect(progress.at(-1)!.fromCache).toBe(5)
  })

  it('la progression croît de façon monotone', async () => {
    const { loader } = makeLoader(PAGES)
    const progress: ExpandProgress[] = []
    await expandCraftTree(URL_RING, { loader, onProgress: (p) => progress.push({ ...p }) })
    const dones = progress.map((p) => p.done)
    expect([...dones].sort((a, b) => a - b)).toEqual(dones)
    expect(progress.at(-1)!.done).toBe(5)
    expect(progress.at(-1)!.discovered).toBe(5)
  })

  it('abort en cours d’expansion', async () => {
    const { loader } = makeLoader(PAGES)
    const controller = new AbortController()
    let count = 0
    const countingLoader: typeof loader = async (url, opts) => {
      count++
      if (count === 2) controller.abort()
      return loader(url, opts)
    }
    await expect(
      expandCraftTree(URL_RING, { loader: countingLoader, signal: controller.signal }),
    ).rejects.toHaveProperty('name', 'AbortError')
  })
})
