import { describe, expect, it } from 'vitest'
import { FetchQueue } from './queue'
import { RetryableFetchError } from './jina'

/** Horloge simulée : sleep avance le temps, now le lit. */
function makeClock() {
  let t = 0
  return {
    nowFn: () => t,
    sleepFn: async (ms: number) => {
      t += ms
    },
    randomFn: () => 0,
    now: () => t,
  }
}

describe('FetchQueue', () => {
  it('espace les départs de 1100 ms minimum', async () => {
    const clock = makeClock()
    const q = new FetchQueue(clock)
    const starts: number[] = []
    await Promise.all([
      q.enqueue(async () => starts.push(clock.now())),
      q.enqueue(async () => starts.push(clock.now())),
      q.enqueue(async () => starts.push(clock.now())),
    ])
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1100)
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(1100)
  })

  it('réessaie les erreurs transitoires avec backoff 5/15/45 s', async () => {
    const clock = makeClock()
    const q = new FetchQueue(clock)
    let calls = 0
    const result = await q.enqueue(async () => {
      calls++
      if (calls <= 2) throw new RetryableFetchError('429', 429)
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(calls).toBe(3)
    // 2 backoffs consommés : 5000 + 15000 inclus dans le temps écoulé.
    expect(clock.now()).toBeGreaterThanOrEqual(20_000)
  })

  it('abandonne après épuisement des retries', async () => {
    const clock = makeClock()
    const q = new FetchQueue({ ...clock, backoffsMs: [10, 10] })
    let calls = 0
    await expect(
      q.enqueue(async () => {
        calls++
        throw new RetryableFetchError('500', 500)
      }),
    ).rejects.toThrow(RetryableFetchError)
    expect(calls).toBe(3) // 1 essai + 2 retries
  })

  it('ne réessaie pas les erreurs non transitoires', async () => {
    const clock = makeClock()
    const q = new FetchQueue(clock)
    let calls = 0
    await expect(
      q.enqueue(async () => {
        calls++
        throw new Error('fatale')
      }),
    ).rejects.toThrow('fatale')
    expect(calls).toBe(1)
  })

  it('réessaie les réponses jina vides (EmptyPageError)', async () => {
    const clock = makeClock()
    const q = new FetchQueue(clock)
    let calls = 0
    const err = new Error('vide')
    err.name = 'EmptyPageError'
    const result = await q.enqueue(async () => {
      calls++
      if (calls === 1) throw err
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(calls).toBe(2)
  })

  it('signal déjà annulé : rejette sans appeler fn', async () => {
    const clock = makeClock()
    const q = new FetchQueue(clock)
    const controller = new AbortController()
    controller.abort()
    let calls = 0
    await expect(
      q.enqueue(async () => {
        calls++
      }, controller.signal),
    ).rejects.toHaveProperty('name', 'AbortError')
    expect(calls).toBe(0)
  })

  it("un échec ne bloque pas la suite de la file", async () => {
    const clock = makeClock()
    const q = new FetchQueue(clock)
    const failed = q.enqueue(async () => {
      throw new Error('boom')
    })
    const next = q.enqueue(async () => 42)
    await expect(failed).rejects.toThrow('boom')
    await expect(next).resolves.toBe(42)
  })
})
