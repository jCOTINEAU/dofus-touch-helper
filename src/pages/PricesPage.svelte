<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import { recentMedianUnit } from '../lib/prices/stats'
  import ItemAvatar from '../components/ItemAvatar.svelte'
  import EmptyState from '../components/EmptyState.svelte'

  const allItems = useLiveQuery(() => db.items.toArray(), [])
  const allEntries = useLiveQuery(() => db.priceEntries.toArray(), [])

  let search = $state('')

  const entriesByItem = $derived.by(() => {
    const map = new Map<number, typeof allEntries.value>()
    for (const e of allEntries.value) {
      const list = map.get(e.itemId) ?? []
      list.push(e)
      map.set(e.itemId, list)
    }
    return map
  })

  const tracked = $derived(
    allItems.value
      .filter((i) => entriesByItem.has(i.id))
      .map((i) => ({
        item: i,
        count: entriesByItem.get(i.id)!.length,
        median: recentMedianUnit(entriesByItem.get(i.id)!, Date.now()),
      }))
      .sort((a, b) => a.item.name.localeCompare(b.item.name)),
  )

  const searchResults = $derived.by(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return []
    return allItems.value
      .filter((i) => i.name.toLowerCase().includes(q) && !entriesByItem.has(i.id))
      .slice(0, 20)
  })
</script>

<h1 class="text-2xl font-bold mb-4">Prix HDV</h1>

<label class="input input-bordered flex items-center gap-2 mb-4 w-full">
  <input
    type="search"
    class="grow"
    placeholder="Chercher une ressource connue (déjà rencontrée dans un craft)…"
    bind:value={search}
  />
</label>

{#if searchResults.length > 0}
  <div class="card bg-base-100 shadow-sm mb-4">
    <div class="card-body py-3">
      {#each searchResults as item (item.id)}
        <a href={`#/prix/${item.id}`} class="flex items-center gap-3 py-1">
          <ItemAvatar imageUrl={item.imageUrl} name={item.name} size={32} />
          <span>{item.name}</span>
          <span class="text-xs text-base-content/40 ml-auto">suivre →</span>
        </a>
      {/each}
    </div>
  </div>
{/if}

{#if tracked.length === 0 && searchResults.length === 0}
  <EmptyState
    message="Aucune ressource suivie."
    hint="Cherche une ressource ci-dessus, ou passe par la liste de courses d'un projet (bouton « prix »)."
  />
{:else if tracked.length > 0}
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body py-4">
      <h2 class="font-semibold text-sm text-base-content/60 uppercase">Suivies</h2>
      {#each tracked as row (row.item.id)}
        <a href={`#/prix/${row.item.id}`} class="flex items-center gap-3 py-1">
          <ItemAvatar imageUrl={row.item.imageUrl} name={row.item.name} size={36} />
          <div class="flex-1">
            <div class="font-medium">{row.item.name}</div>
            <div class="text-xs text-base-content/50">{row.count} relevé(s)</div>
          </div>
          {#if row.median !== null}
            <span class="font-mono">{Math.round(row.median * 100) / 100} k/u</span>
          {/if}
        </a>
      {/each}
    </div>
  </div>
{/if}
