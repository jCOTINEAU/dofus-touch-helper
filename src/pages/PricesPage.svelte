<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import { recentMedianUnit } from '../lib/prices/stats'
  import { formatRelativeTime } from '../lib/prices/format'
  import ItemAvatar from '../components/ItemAvatar.svelte'
  import EmptyState from '../components/EmptyState.svelte'

  const STALE_MS = 3 * 24 * 3600 * 1000

  const allItems = useLiveQuery(() => db.items.toArray(), [])
  const allEntries = useLiveQuery(() => db.priceEntries.toArray(), [])

  import { pricesView } from '../lib/stores/pricesView.svelte'

  let search = $state('')

  // Section « Suivies » repliable, choix mémorisé (liste potentiellement longue).
  const TRACKED_OPEN_KEY = 'dofus-craft:prices-tracked-open'
  let trackedOpen = $state(localStorage.getItem(TRACKED_OPEN_KEY) !== 'false')
  function toggleTracked() {
    trackedOpen = !trackedOpen
    localStorage.setItem(TRACKED_OPEN_KEY, String(trackedOpen))
  }

  const entriesByItem = $derived.by(() => {
    const map = new Map<number, typeof allEntries.value>()
    for (const e of allEntries.value) {
      const list = map.get(e.itemId) ?? []
      list.push(e)
      map.set(e.itemId, list)
    }
    return map
  })

  const medianOf = $derived((itemId: number) => {
    const entries = entriesByItem.get(itemId)
    return entries ? recentMedianUnit(entries, Date.now()) : null
  })

  const tracked = $derived(
    allItems.value
      .filter((i) => entriesByItem.has(i.id))
      .map((i) => ({
        item: i,
        count: entriesByItem.get(i.id)!.length,
        median: medianOf(i.id),
        lastAt: entriesByItem.get(i.id)!.reduce((m, e) => Math.max(m, e.recordedAt), 0),
      }))
      .sort((a, b) => a.item.name.localeCompare(b.item.name, 'fr')),
  )

  /** Première lettre sans accent, ou # pour le reste. */
  function letterOf(name: string): string {
    const c = name
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toUpperCase()
      .charAt(0)
    return c >= 'A' && c <= 'Z' ? c : '#'
  }

  const byLetter = $derived.by(() => {
    const map = new Map<string, typeof allItems.value>()
    for (const item of [...allItems.value].sort((a, b) => a.name.localeCompare(b.name, 'fr'))) {
      const letter = letterOf(item.name)
      const list = map.get(letter) ?? []
      list.push(item)
      map.set(letter, list)
    }
    return [...map.entries()].sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a < b ? -1 : 1))
  })

  const searchResults = $derived.by(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return []
    return allItems.value
      .filter((i) => i.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .slice(0, 20)
  })

  const fmtMedian = (m: number | null) =>
    m === null ? null : `${Math.round(m * 100) / 100} k/u`
</script>

{#snippet itemRow(item: (typeof allItems.value)[number])}
  {@const median = fmtMedian(medianOf(item.id))}
  <a href={`#/prix/${item.id}`} class="flex items-center gap-3 py-2 min-h-11">
    <ItemAvatar imageUrl={item.imageUrl} name={item.name} size={32} />
    <span class="flex-1">{item.name}</span>
    {#if median}
      <span class="font-mono text-sm">{median}</span>
    {:else}
      <span class="text-xs text-base-content/40">suivre →</span>
    {/if}
  </a>
{/snippet}

<h1 class="text-2xl font-bold mb-4">Prix HDV</h1>

<div class="sticky top-0 z-10 -mx-4 bg-base-200 px-4 pb-3 pt-1">
  <label class="input input-bordered flex items-center gap-2 w-full">
    <input type="search" class="grow" placeholder="Chercher une ressource…" bind:value={search} />
  </label>
</div>

{#if tracked.length > 0 && search.trim().length < 2}
  <a href="#/prix/session" class="btn btn-primary btn-lg mb-4 w-full">
    ▶ Démarrer une session HDV ({tracked.length} suivies)
  </a>
{/if}

{#if search.trim().length >= 2}
  <div class="card bg-base-100 shadow-sm mb-4">
    <div class="card-body py-3">
      {#if searchResults.length === 0}
        <p class="text-sm text-base-content/50">Aucune ressource connue ne correspond.</p>
      {:else}
        {#each searchResults as item (item.id)}
          {@render itemRow(item)}
        {/each}
      {/if}
    </div>
  </div>
{:else}
  {#if allItems.value.length === 0}
    <EmptyState
      message="Aucune ressource connue."
      hint="Les ressources apparaissent ici dès qu'un projet a chargé leurs recettes."
    />
  {:else}
    {#if tracked.length > 0}
      {@const staleCount = tracked.filter((r) => Date.now() - r.lastAt > STALE_MS).length}
      <div class="collapse collapse-arrow bg-base-100 shadow-sm mb-4">
        <input type="checkbox" checked={trackedOpen} onchange={toggleTracked} />
        <div class="collapse-title font-semibold">
          Suivies
          <span class="badge badge-ghost badge-sm ml-2">{tracked.length}</span>
          {#if staleCount > 0}
            <span class="badge badge-warning badge-sm ml-1">⚠ {staleCount} à rafraîchir</span>
          {/if}
        </div>
        <div class="collapse-content">
          {#each tracked as row (row.item.id)}
            {@const stale = Date.now() - row.lastAt > STALE_MS}
            <a href={`#/prix/${row.item.id}`} class="flex items-center gap-3 py-2 min-h-11">
              <ItemAvatar imageUrl={row.item.imageUrl} name={row.item.name} size={32} />
              <div class="flex-1">
                <div>{row.item.name}</div>
                <div class="text-xs {stale ? 'text-warning' : 'text-base-content/40'}">
                  {stale ? '⚠ ' : '✓ '}{formatRelativeTime(row.lastAt, Date.now())}
                </div>
              </div>
              {#if row.median !== null}
                <span class="font-mono text-sm">{fmtMedian(row.median)}</span>
              {/if}
            </a>
          {/each}
        </div>
      </div>
    {/if}

    <h2 class="font-semibold text-sm text-base-content/60 uppercase mb-2 px-1">
      Toutes les ressources connues
    </h2>
    <div class="flex flex-col gap-2">
      {#each byLetter as [letter, items] (letter)}
        <div class="collapse collapse-arrow bg-base-100 shadow-sm">
          <input
            type="checkbox"
            checked={pricesView.openLetter === letter}
            onchange={() =>
              (pricesView.openLetter = pricesView.openLetter === letter ? null : letter)}
          />
          <div class="collapse-title font-bold">
            {letter}
            <span class="badge badge-ghost badge-sm ml-2">{items.length}</span>
          </div>
          <div class="collapse-content">
            {#each items as item (item.id)}
              {@render itemRow(item)}
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
{/if}
