<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import { combatProfit } from '../lib/combats/profit'
  import {
    asLootInputs,
    combatEffectiveLoots,
    type CreatureRef,
  } from '../lib/combats/effectiveLoots'
  import { recentMedianUnit } from '../lib/prices/stats'
  import { formatKamas } from '../lib/prices/format'
  import { getOrFetchMonster } from '../lib/fetch/monsterLoader'
  import { isEncyclopediaItemUrl } from '../lib/fetch/url'
  import { globalMods } from '../lib/stores/globalMods.svelte'
  import ItemAvatar from '../components/ItemAvatar.svelte'
  import NameSearch from '../components/NameSearch.svelte'
  import GlobalModsBar from '../components/GlobalModsBar.svelte'
  import QtyStepper from '../components/QtyStepper.svelte'

  let { combatId }: { combatId: string } = $props()
  const id = $derived(Number(combatId))

  const combat = useLiveQuery(() => db.combats.get(Number(combatId)), undefined)
  const loots = useLiveQuery(() => db.combatLoots.where({ combatId: Number(combatId) }).toArray(), [])
  const creatures = useLiveQuery(
    () => db.combatCreatures.where({ combatId: Number(combatId) }).toArray(),
    [],
  )
  const allItems = useLiveQuery(() => db.items.toArray(), [])
  const allEntries = useLiveQuery(() => db.priceEntries.toArray(), [])
  const allMonsters = useLiveQuery(() => db.monsters.toArray(), [])

  const items = $derived(new Map(allItems.value.map((i) => [i.id, i])))
  const monstersById = $derived(new Map(allMonsters.value.map((m) => [m.id, m])))

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

  // Nom d'une ressource : cache items, ou à défaut un drop de monstre.
  const nameOf = $derived((itemId: number) => {
    const it = items.get(itemId)
    if (it) return it.name
    for (const m of allMonsters.value) {
      const d = m.drops.find((x) => x.itemId === itemId)
      if (d) return d.name
    }
    return `item ${itemId}`
  })

  const creatureRefs = $derived<CreatureRef[]>(
    creatures.value.map((c) => ({ monsterId: c.monsterId, count: c.count })),
  )
  const effective = $derived(
    combatEffectiveLoots(creatureRefs, monstersById, loots.value, globalMods.value)
      .map((e) => ({ ...e, unitPrice: priceOf(e.itemId) }))
      .sort((a, b) => nameOf(a.itemId).localeCompare(nameOf(b.itemId), 'fr')),
  )
  const profit = $derived(
    combatProfit(combat.value?.avgDurationSec ?? 0, asLootInputs(effective), priceOf),
  )

  async function setDurationMin(minutes: number) {
    await db.combats.update(id, { avgDurationSec: Math.max(0, Math.round(minutes * 60)) })
  }

  // --- import d'une créature par URL ---
  let creatureUrl = $state('')
  let creatureUrlMode = $state(false)
  let importing = $state(false)
  let importError = $state('')
  const creatureUrlValid = $derived(isEncyclopediaItemUrl(creatureUrl))

  async function addCreatureByUrl(url: string) {
    if (importing) return
    importing = true
    importError = ''
    try {
      const { monster } = await getOrFetchMonster(url.trim())
      const existing = await db.combatCreatures.where({ combatId: id, monsterId: monster.id }).first()
      if (existing) await db.combatCreatures.update(existing.id!, { count: existing.count + 1 })
      else await db.combatCreatures.add({ combatId: id, monsterId: monster.id, count: 1 })
      creatureUrl = ''
    } catch (err) {
      importError = `Import impossible (${String(err)}).`
    } finally {
      importing = false
    }
  }

  function addCreature(e: SubmitEvent) {
    e.preventDefault()
    if (creatureUrlValid) addCreatureByUrl(creatureUrl)
  }

  async function setCreatureCount(cid: number, count: number) {
    if (count <= 0) await db.combatCreatures.delete(cid)
    else await db.combatCreatures.update(cid, { count })
  }

  // --- loot manuel ---
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
</script>

<div class="flex items-center gap-2 mb-4">
  <a href="#/combats" class="btn btn-ghost btn-square text-xl" aria-label="Retour aux combats">←</a>
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
    <div class="stat-value text-lg font-mono">{formatKamas(profit.expectedKamas)}</div>
    {#if profit.missingPrices.length > 0}
      <div class="stat-desc text-warning">{profit.missingPrices.length} sans prix</div>
    {/if}
  </div>
  <div class="stat">
    <div class="stat-title">Rendement</div>
    <div class="stat-value text-lg font-mono">
      {profit.kamasPerHour === null ? '—' : `${formatKamas(profit.kamasPerHour)}/h`}
    </div>
    {#if profit.kamasPerHour === null}
      <div class="stat-desc">renseigne la durée</div>
    {/if}
  </div>
</div>

<div class="mb-4">
  <GlobalModsBar />
</div>

<!-- Créatures -->
<div class="card bg-base-100 shadow-sm mb-4">
  <div class="card-body py-4">
    <h2 class="font-semibold">Créatures</h2>
    {#if importing}
      <div class="flex items-center gap-2 text-sm text-base-content/60">
        <span class="loading loading-spinner loading-sm"></span> Import du monstre…
      </div>
    {:else if creatureUrlMode}
      <form class="flex flex-wrap gap-2" onsubmit={addCreature}>
        <input
          type="url"
          class="input input-bordered flex-1 min-w-60"
          placeholder="Coller l'URL encyclopédie d'un monstre…"
          bind:value={creatureUrl}
        />
        <button class="btn btn-primary" type="submit" disabled={!creatureUrlValid}>Importer</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick={() => (creatureUrlMode = false)}>
          par nom
        </button>
      </form>
    {:else}
      <NameSearch
        types={['monstres']}
        placeholder="Chercher un monstre par nom…"
        onSelect={(e) => addCreatureByUrl(e.url)}
      />
      <button type="button" class="btn btn-ghost btn-xs" onclick={() => (creatureUrlMode = true)}>
        ou par URL
      </button>
    {/if}
    {#if importError}<div class="alert alert-warning text-sm">{importError}</div>{/if}

    {#if creatures.value.length === 0}
      <p class="text-sm text-base-content/50">
        Aucune créature. Colle l'URL d'un monstre du bestiaire pour importer ses drops.
      </p>
    {:else}
      <div class="flex flex-col divide-y divide-base-200">
        {#each creatures.value as c (c.id)}
          {@const monster = monstersById.get(c.monsterId)}
          <div class="flex flex-wrap items-center gap-3 py-2">
            <ItemAvatar imageUrl={monster?.imageUrl} name={monster?.name ?? '?'} size={36} />
            <div class="flex-1 min-w-32">
              <div class="font-medium">{monster?.name ?? `monstre ${c.monsterId}`}</div>
              <div class="text-xs text-base-content/50">
                {monster?.drops.filter((d) => !d.conditional).length ?? 0} drop(s)
                {#if monster?.drops.some((d) => d.conditional)}
                  · {monster.drops.filter((d) => d.conditional).length} conditionnel(s)
                {/if}
              </div>
            </div>
            <QtyStepper value={c.count} onchange={(v) => setCreatureCount(c.id!, v)} label="Nombre" />
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Butin effectif -->
<div class="card bg-base-100 shadow-sm mb-4">
  <div class="card-body py-4">
    <h2 class="font-semibold">Butin effectif (par combat)</h2>
    {#if effective.length === 0}
      <p class="text-sm text-base-content/50">Ajoute des créatures ou des loots manuels.</p>
    {:else}
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Ressource</th>
            <th class="text-right">Espérance</th>
            <th class="text-right">Prix (k/u)</th>
            <th class="text-right">Kamas</th>
          </tr>
        </thead>
        <tbody>
          {#each effective as e (e.itemId)}
            <tr>
              <td>{nameOf(e.itemId)}</td>
              <td class="text-right font-mono">{Math.round(e.expectedUnits * 100) / 100}</td>
              <td class="text-right font-mono">
                {#if e.unitPrice === null}
                  <a href={`#/prix/${e.itemId}`} class="badge badge-warning badge-sm">relever</a>
                {:else}
                  {formatKamas(e.unitPrice)}
                {/if}
              </td>
              <td class="text-right font-mono">
                {e.unitPrice === null ? '—' : formatKamas(e.expectedUnits * e.unitPrice)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

<!-- Loots manuels (optionnel) -->
<div class="card bg-base-100 shadow-sm">
  <div class="card-body py-4">
    <h2 class="font-semibold">Loots manuels (optionnel)</h2>
    <input
      type="search"
      class="input input-bordered w-full"
      placeholder="Ajouter une ressource connue à la main…"
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
    {/if}
    {#if loots.value.length > 0}
      <table class="table table-sm mt-2">
        <thead>
          <tr><th>Ressource</th><th>% drop</th><th>Qté</th><th></th></tr>
        </thead>
        <tbody>
          {#each loots.value as loot (loot.id)}
            <tr>
              <td>{nameOf(loot.itemId)}</td>
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
