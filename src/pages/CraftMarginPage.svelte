<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import { toCatalogEntry } from '../lib/db/repo'
  import { effectiveCost, type EffectiveCost } from '../lib/prices/costs'
  import { recentMedianUnit } from '../lib/prices/stats'
  import { formatKamas } from '../lib/prices/format'
  import ItemAvatar from '../components/ItemAvatar.svelte'
  import EmptyState from '../components/EmptyState.svelte'

  const allItems = useLiveQuery(() => db.items.toArray(), [])
  const allEntries = useLiveQuery(() => db.priceEntries.toArray(), [])

  const priceOf = $derived.by(() => {
    const byItem = new Map<number, typeof allEntries.value>()
    for (const e of allEntries.value) {
      const list = byItem.get(e.itemId) ?? []
      list.push(e)
      byItem.set(e.itemId, list)
    }
    const now = Date.now()
    return (itemId: number) => {
      const entries = byItem.get(itemId)
      return entries ? recentMedianUnit(entries, now) : null
    }
  })

  const rows = $derived.by(() => {
    const catalog = new Map(allItems.value.map((i) => [i.id, toCatalogEntry(i)]))
    const cache = new Map<number, EffectiveCost>()
    return allItems.value
      .filter((i) => i.recipe != null && i.fetchStatus !== 'dead')
      .map((item) => {
        const craftCost = effectiveCost(catalog, priceOf, item.id, cache).craft
        const sellPrice = priceOf(item.id)
        const margin = craftCost !== null && sellPrice !== null ? sellPrice - craftCost : null
        const marginPct = margin !== null && craftCost ? (margin / craftCost) * 100 : null
        return { item, craftCost, sellPrice, margin, marginPct }
      })
      .sort((a, b) => {
        // Marges connues d'abord (desc), puis le reste.
        if (a.margin === null && b.margin === null) return a.item.name.localeCompare(b.item.name, 'fr')
        if (a.margin === null) return 1
        if (b.margin === null) return -1
        return b.margin - a.margin
      })
  })

  const hasData = $derived(rows.some((r) => r.margin !== null))
</script>

<div class="flex items-center gap-2 mb-2">
  <a href="#/prix" class="btn btn-ghost btn-square text-xl" aria-label="Retour">←</a>
  <h1 class="text-2xl font-bold flex-1">Rentabilité de craft</h1>
</div>
<p class="text-sm text-base-content/60 mb-4">
  Marge = prix de vente HDV de l'objet − coût de craft (composants au meilleur coût, prix
  médians récents). Relève le prix de vente d'un objet pour voir sa marge.
</p>

{#if rows.length === 0}
  <EmptyState
    message="Aucun objet craftable en cache."
    hint="Ajoute des objets à un projet pour charger leurs recettes."
  />
{:else}
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body overflow-x-auto p-2 sm:p-4">
      {#if !hasData}
        <p class="text-sm text-warning">
          Relève le <strong>prix de vente</strong> d'objets craftables (et le prix de leurs
          composants) pour calculer les marges.
        </p>
      {/if}
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Objet</th>
            <th class="text-right">Coût craft</th>
            <th class="text-right">Vente</th>
            <th class="text-right">Marge</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as r (r.item.id)}
            <tr>
              <td>
                <a href={`#/prix/${r.item.id}`} class="flex items-center gap-2">
                  <ItemAvatar imageUrl={r.item.imageUrl} name={r.item.name} size={28} />
                  <span>{r.item.name}</span>
                </a>
              </td>
              <td class="text-right font-mono">
                {r.craftCost === null ? '—' : formatKamas(r.craftCost)}
              </td>
              <td class="text-right font-mono">
                {#if r.sellPrice === null}
                  <a href={`#/prix/${r.item.id}`} class="badge badge-warning badge-sm">relever</a>
                {:else}
                  {formatKamas(r.sellPrice)}
                {/if}
              </td>
              <td class="text-right font-mono font-bold">
                {#if r.margin === null}
                  —
                {:else}
                  <span class={r.margin >= 0 ? 'text-success' : 'text-error'}>
                    {r.margin >= 0 ? '+' : ''}{formatKamas(r.margin)}
                    {#if r.marginPct !== null}
                      <span class="text-xs font-normal opacity-70">
                        ({r.marginPct >= 0 ? '+' : ''}{Math.round(r.marginPct)} %)
                      </span>
                    {/if}
                  </span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}
