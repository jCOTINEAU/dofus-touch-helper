<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import { combatProfit } from '../lib/combats/profit'
  import { recentMedianUnit } from '../lib/prices/stats'
  import ItemAvatar from '../components/ItemAvatar.svelte'

  let { combatId }: { combatId: string } = $props()
  const id = $derived(Number(combatId))

  const combat = useLiveQuery(() => db.combats.get(Number(combatId)), undefined)
  const loots = useLiveQuery(
    () => db.combatLoots.where({ combatId: Number(combatId) }).toArray(),
    [],
  )
  const allItems = useLiveQuery(() => db.items.toArray(), [])
  const allEntries = useLiveQuery(() => db.priceEntries.toArray(), [])

  const items = $derived(new Map(allItems.value.map((i) => [i.id, i])))

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

  const profit = $derived(combatProfit(combat.value?.avgDurationSec ?? 0, loots.value, priceOf))

  // --- édition durée (en minutes pour l'utilisateur) ---
  async function setDurationMin(minutes: number) {
    await db.combats.update(id, { avgDurationSec: Math.max(0, Math.round(minutes * 60)) })
  }

  // --- ajout de loot ---
  let search = $state('')
  const searchResults = $derived.by(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return []
    const already = new Set(loots.value.map((l) => l.itemId))
    return allItems.value
      .filter((i) => i.name.toLowerCase().includes(q) && !already.has(i.id))
      .slice(0, 8)
  })

  async function addLoot(itemId: number) {
    await db.combatLoots.add({ combatId: id, itemId, dropRatePct: 100, qtyPerDrop: 1 })
    search = ''
  }

  const fmtK = (v: number) => (v >= 10000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v * 10) / 10))
</script>

<div class="flex items-center gap-2 mb-4">
  <a href="#/combats" class="btn btn-ghost btn-sm">←</a>
  <h1 class="text-2xl font-bold flex-1">{combat.value?.name ?? '…'}</h1>
</div>

<div class="stats stats-vertical sm:stats-horizontal shadow-sm bg-base-100 w-full mb-4">
  <div class="stat">
    <div class="stat-title">Durée moyenne</div>
    <div class="stat-value text-lg">
      <label class="input input-bordered flex items-center gap-2 w-36">
        <input
          type="number"
          class="grow"
          min="0"
          step="0.5"
          inputmode="decimal"
          value={combat.value ? Math.round((combat.value.avgDurationSec / 60) * 10) / 10 : 0}
          onchange={(e) => setDurationMin(Number(e.currentTarget.value))}
          aria-label="Durée moyenne en minutes"
        />
        <span class="text-sm text-base-content/50">min</span>
      </label>
    </div>
  </div>
  <div class="stat">
    <div class="stat-title">Espérance / combat</div>
    <div class="stat-value text-lg font-mono">{fmtK(profit.expectedKamas)} k</div>
    {#if profit.missingPrices.length > 0}
      <div class="stat-desc text-warning">{profit.missingPrices.length} loot(s) sans prix</div>
    {/if}
  </div>
  <div class="stat">
    <div class="stat-title">Rendement</div>
    <div class="stat-value text-lg font-mono">
      {profit.kamasPerHour === null ? '—' : `${fmtK(profit.kamasPerHour)} k/h`}
    </div>
    {#if profit.kamasPerHour === null}
      <div class="stat-desc">renseigne la durée</div>
    {/if}
  </div>
</div>

<div class="card bg-base-100 shadow-sm mb-4">
  <div class="card-body py-4">
    <h2 class="font-semibold">Ajouter un loot</h2>
    <input
      type="search"
      class="input input-bordered w-full"
      placeholder="Chercher une ressource connue…"
      bind:value={search}
    />
    {#if searchResults.length > 0}
      <div class="flex flex-col">
        {#each searchResults as item (item.id)}
          <button class="flex items-center gap-3 py-1 text-left" onclick={() => addLoot(item.id)}>
            <ItemAvatar imageUrl={item.imageUrl} name={item.name} size={28} />
            <span>{item.name}</span>
            <span class="text-xs text-base-content/40 ml-auto">ajouter +</span>
          </button>
        {/each}
      </div>
    {:else if search.trim().length >= 2}
      <p class="text-xs text-base-content/50">
        Aucune ressource connue ne correspond (les ressources apparaissent ici après avoir été
        rencontrées dans un craft ou une recherche de prix).
      </p>
    {/if}
  </div>
</div>

<div class="card bg-base-100 shadow-sm">
  <div class="card-body py-4">
    <h2 class="font-semibold">Loots</h2>
    {#if loots.value.length === 0}
      <p class="text-sm text-base-content/50">Aucun loot attaché.</p>
    {:else}
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Ressource</th>
            <th>% drop</th>
            <th>Qté</th>
            <th class="text-right">Prix (k/u)</th>
            <th class="text-right">Espérance</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each loots.value as loot (loot.id)}
            {@const item = items.get(loot.itemId)}
            {@const price = priceOf(loot.itemId)}
            <tr>
              <td>
                <div class="flex items-center gap-2">
                  <ItemAvatar imageUrl={item?.imageUrl} name={item?.name ?? '?'} size={28} />
                  <span>{item?.name ?? `item ${loot.itemId}`}</span>
                </div>
              </td>
              <td>
                <input
                  type="number"
                  class="input input-bordered input-sm w-20"
                  min="0"
                  max="100"
                  step="0.1"
                  inputmode="decimal"
                  value={loot.dropRatePct}
                  onchange={(e) =>
                    db.combatLoots.update(loot.id!, {
                      dropRatePct: Math.min(100, Math.max(0, Number(e.currentTarget.value))),
                    })}
                  aria-label="Pourcentage de drop"
                />
              </td>
              <td>
                <input
                  type="number"
                  class="input input-bordered input-sm w-16"
                  min="1"
                  inputmode="numeric"
                  value={loot.qtyPerDrop}
                  onchange={(e) =>
                    db.combatLoots.update(loot.id!, {
                      qtyPerDrop: Math.max(1, Math.floor(Number(e.currentTarget.value))),
                    })}
                  aria-label="Quantité par drop"
                />
              </td>
              <td class="text-right font-mono">
                {#if price === null}
                  <a href={`#/prix/${loot.itemId}`} class="badge badge-warning badge-sm">
                    relever
                  </a>
                {:else}
                  {fmtK(price)}
                {/if}
              </td>
              <td class="text-right font-mono">
                {price === null ? '—' : fmtK((loot.dropRatePct / 100) * loot.qtyPerDrop * price)}
              </td>
              <td class="text-right">
                <button
                  class="btn btn-ghost btn-xs text-error"
                  onclick={() => db.combatLoots.delete(loot.id!)}
                  aria-label="Retirer le loot"
                >
                  ✕
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>
