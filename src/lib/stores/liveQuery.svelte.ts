/**
 * Pont Dexie → Svelte 5 : expose une liveQuery Dexie comme valeur réactive.
 * À appeler pendant l'init d'un composant. La requête se réabonne si les
 * tables Dexie qu'elle lit changent (mécanisme natif de liveQuery).
 */

import { liveQuery } from 'dexie'

export function useLiveQuery<T>(querier: () => Promise<T> | T, initial: T): { value: T } {
  let value = $state(initial) as T

  $effect(() => {
    const subscription = liveQuery(querier).subscribe({
      next: (v) => {
        value = v
      },
    })
    return () => subscription.unsubscribe()
  })

  return {
    get value() {
      return value
    },
  }
}
