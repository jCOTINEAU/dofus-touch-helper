<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import { LOT_SIZES, divergence } from '../lib/prices/stats'
  import { formatKamas } from '../lib/prices/format'
  import ItemAvatar from '../components/ItemAvatar.svelte'
  import EmptyState from '../components/EmptyState.svelte'

  const allItems = useLiveQuery(() => db.items.toArray(), [])
  const allEntries = useLiveQuery(() => db.priceEntries.toArray(), [])
  const items = $derived(new Map(allItems.value.map((i) => [i.id, i])))

  const rows = $derived.by(() => {
    const byItem = new Map<number, typeof allEntries.value>()
    for (const e of allEntries.value) {
      const list = byItem.get(e.itemId) ?? []
      list.push(e)
      byItem.set(e.itemId, list)
    }
    return [...byItem.entries()]
      .map(([itemId, entries]) => ({ itemId, item: items.get(itemId), div: divergence(entries) }))
      .filter((r) => r.div.spreadPct !== null)
      .sort((a, b) => (b.div.spreadPct ?? 0) - (a.div.spreadPct ?? 0))
  })

  const fmt = (v: number | null) => (v === null ? '—' : formatKamas(v))
</script>

<div class="flex items-center gap-2 mb-2">
  <a href="#/prix" class="btn btn-ghost btn-square text-xl" aria-label="Retour">←</a>
  <h1 class="text-2xl font-bold flex-1">Opportunités HDV</h1>
</div>
<p class="text-sm text-base-content/60 mb-4">
  Écart de prix unitaire entre tailles de lot. Un gros écart = opportunité : acheter dans la
  catégorie la moins chère au kama/unité, revendre dans la plus chère.
</p>

{#if rows.length === 0}
  <EmptyState
    message="Pas encore d'écart mesurable."
    hint="Relève le prix d'une ressource pour au moins deux tailles de lot (×1, ×10, ×100)."
  />
{:else}
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body overflow-x-auto p-2 sm:p-4">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Ressource</th>
            {#each LOT_SIZES as s (s)}<th class="text-right">×{s} (k/u)</th>{/each}
            <th class="text-right">Écart</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as r (r.itemId)}
            {@const spread = Math.round(r.div.spreadPct ?? 0)}
            <tr>
              <td>
                <a href={`#/prix/${r.itemId}`} class="flex items-center gap-2">
                  <ItemAvatar imageUrl={r.item?.imageUrl} name={r.item?.name ?? '?'} size={28} />
                  <span>{r.item?.name ?? `item ${r.itemId}`}</span>
                </a>
              </td>
              {#each LOT_SIZES as s (s)}
                <td class="text-right font-mono text-xs">{fmt(r.div.byLot[s])}</td>
              {/each}
              <td class="text-right">
                <span class="badge {spread >= 20 ? 'badge-success' : 'badge-ghost'} font-mono">
                  {spread} %
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}
