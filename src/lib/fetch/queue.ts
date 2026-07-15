/**
 * File FIFO globale de fetch : espace les départs de requêtes (le quota
 * gratuit de r.jina.ai est ~20 req/min) et réessaie les erreurs
 * transitoires avec backoff. La file est volontairement séquentielle : un
 * backoff sur 429 met en pause tout le trafic, ce qui est le comportement
 * voulu face à un rate-limit global.
 */

import { RetryableFetchError } from './jina'

export interface FetchQueueOptions {
  minIntervalMs?: number
  jitterMs?: number
  /** Délais de backoff ; la longueur du tableau fixe le nombre de retries. */
  backoffsMs?: number[]
  /** Injectables pour les tests. */
  sleepFn?: (ms: number) => Promise<void>
  nowFn?: () => number
  randomFn?: () => number
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function isRetryable(e: unknown): boolean {
  return (
    e instanceof RetryableFetchError ||
    (e instanceof Error && e.name === 'EmptyPageError')
  )
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Annulé', 'AbortError')
}

export class FetchQueue {
  private chain: Promise<unknown> = Promise.resolve()
  private lastStart = 0

  private readonly minIntervalMs: number
  private readonly jitterMs: number
  private readonly backoffsMs: number[]
  private readonly sleep: (ms: number) => Promise<void>
  private readonly now: () => number
  private readonly random: () => number

  constructor(opts: FetchQueueOptions = {}) {
    this.minIntervalMs = opts.minIntervalMs ?? 1100
    this.jitterMs = opts.jitterMs ?? 300
    this.backoffsMs = opts.backoffsMs ?? [5_000, 15_000, 45_000]
    this.sleep = opts.sleepFn ?? defaultSleep
    this.now = opts.nowFn ?? Date.now
    this.random = opts.randomFn ?? Math.random
  }

  enqueue<T>(fn: (signal?: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    const task = this.chain.then(async (): Promise<T> => {
      throwIfAborted(signal)
      let attempt = 0
      for (;;) {
        await this.throttle()
        throwIfAborted(signal)
        try {
          return await fn(signal)
        } catch (e) {
          if (!isRetryable(e) || attempt >= this.backoffsMs.length) throw e
          await this.sleep(this.backoffsMs[attempt])
          throwIfAborted(signal)
          attempt++
        }
      }
    })
    // La chaîne ne doit jamais rester bloquée sur un échec.
    this.chain = task.catch(() => {})
    return task
  }

  private async throttle(): Promise<void> {
    const wait = this.lastStart + this.minIntervalMs + this.random() * this.jitterMs - this.now()
    if (wait > 0) await this.sleep(wait)
    this.lastStart = this.now()
  }
}

/** File partagée par toute l'app. */
export const globalQueue = new FetchQueue()
