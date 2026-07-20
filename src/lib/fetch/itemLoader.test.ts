import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { FetchQueue } from './queue'
import { JINA_PREFIX } from './jina'
import { getOrFetchItem } from './itemLoader'
import { deadPage, itemPage } from './testPages'

const BASE = 'https://www.dofus-touch.com/fr/mmorpg/encyclopedie'
const URL_A = `${BASE}/equipements/1-objet-a`
const URL_B = `${BASE}/ressources/2-ressource-b`
const URL_DEAD = `${BASE}/ressources/3-mort`

/** Queue instantanée pour les tests. */
const instantQueue = () =>
  new FetchQueue({ sleepFn: async () => {}, nowFn: () => 0, randomFn: () => 0 })

function makeFetch(pages: Record<string, string>) {
  const calls: string[] = []
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    const target = url.replace(JINA_PREFIX, '')
    const body = pages[target]
    return new Response(body ?? 'Not Found', { status: body ? 200 : 404 })
  }) as typeof fetch
  return { fetchFn, calls }
}

beforeEach(async () => {
  await db.items.clear()
})

describe('getOrFetchItem', () => {
  it('fetch, parse et met en cache', async () => {
    const { fetchFn, calls } = makeFetch({
      [URL_A]: itemPage('Objet A', URL_A, {
        job: 'Bijoutier',
        jobLevel: 50,
        components: [{ qty: 3, name: 'Ressource B', url: URL_B }],
      }),
    })
    const { item, fromCache } = await getOrFetchItem(URL_A, {
      queue: instantQueue(),
      fetchFn,
    })
    expect(fromCache).toBe(false)
    expect(calls).toHaveLength(1)
    expect(item).toMatchObject({ id: 1, name: 'Objet A', fetchStatus: 'ok' })
    expect(item.recipe!.components[0]).toMatchObject({ itemId: 2, qty: 3 })
    expect(await db.items.get(1)).toBeDefined()
  })

  it('cache hit : aucun fetch au second appel', async () => {
    const { fetchFn, calls } = makeFetch({ [URL_B]: itemPage('Ressource B', URL_B) })
    const q = instantQueue()
    await getOrFetchItem(URL_B, { queue: q, fetchFn })
    const second = await getOrFetchItem(URL_B, { queue: q, fetchFn })
    expect(second.fromCache).toBe(true)
    expect(calls).toHaveLength(1)
  })

  it('refresh force le re-fetch', async () => {
    const { fetchFn, calls } = makeFetch({ [URL_B]: itemPage('Ressource B', URL_B) })
    const q = instantQueue()
    await getOrFetchItem(URL_B, { queue: q, fetchFn })
    const second = await getOrFetchItem(URL_B, { queue: q, fetchFn, refresh: true })
    expect(second.fromCache).toBe(false)
    expect(calls).toHaveLength(2)
  })

  it('page morte : stub dead avec le nom de la recette parente', async () => {
    const { fetchFn } = makeFetch({ [URL_DEAD]: deadPage(URL_DEAD) })
    const { item } = await getOrFetchItem(URL_DEAD, {
      queue: instantQueue(),
      fetchFn,
      parentName: 'Bocal',
    })
    expect(item).toMatchObject({ id: 3, name: 'Bocal', fetchStatus: 'dead', recipe: null })
    expect((await db.items.get(3))!.fetchStatus).toBe('dead')
  })

  it('URL invalide : rejet immédiat', async () => {
    await expect(getOrFetchItem('https://exemple.com/nope')).rejects.toThrow(
      /URL encyclopédie invalide/,
    )
  })

  it('réponse jina vide : réessayée puis succès (pas d’échec d’expansion)', async () => {
    let n = 0
    const fetchFn = (async (input: RequestInfo | URL) => {
      n++
      // 1re réponse vide (jina transitoire) → EmptyPageError → retry ;
      // 2e réponse valide.
      const body = n === 1 ? '' : itemPage('Ressource B', URL_B)
      return new Response(body, { status: 200 })
    }) as typeof fetch
    const { item } = await getOrFetchItem(URL_B, { queue: instantQueue(), fetchFn })
    expect(n).toBe(2)
    expect(item).toMatchObject({ id: 2, name: 'Ressource B', fetchStatus: 'ok' })
  })
})
