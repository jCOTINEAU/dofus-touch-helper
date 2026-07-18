<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import { combatProfit, rankCombats } from '../lib/combats/profit'
  import { asLootInputs, combatEffectiveLoots } from '../lib/combats/effectiveLoots'
  import { recentMedianUnit } from '../lib/prices/stats'
  import { globalMods } from '../lib/stores/globalMods.svelte'
  import { router } from '../lib/router.svelte'
  import EmptyState from '../components/EmptyState.svelte'
  import GlobalModsBar from '../components/GlobalModsBar.svelte'

  const combats = useLiveQuery(() => db.combats.toArray(), [])
  const allLoots = useLiveQuery(() => db.combatLoots.toArray(), [])
  const allCreatures = useLiveQuery(() => db.combatCreatures.toArray(), [])
  const allMonsters = useLiveQuery(() => db.monsters.toArray(), [])
  const allEntries = useLiveQuery(() => db.priceEntries.toArray(), [])

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

  const ranked = $derived(
    rankCombats(
      combats.value.map((combat) => {
        const creatures = allCreatures.value
          .filter((c) => c.combatId === combat.id)
          .map((c) => ({ monsterId: c.monsterId, count: c.count }))
        const manual = allLoots.value.filter((l) => l.combatId === combat.id)
        const effective = combatEffectiveLoots(creatures, monstersById, manual, globalMods.value)
        return {
          combat,
          creatureCount: creatures.reduce((n, c) => n + c.count, 0),
          profit: combatProfit(combat.avgDurationSec, asLootInputs(effective), priceOf),
        }
      }),
    ),
  )

  let newName = $state('')

  async function create(e: SubmitEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (name === '') return
    const id = await db.combats.add({ name, avgDurationSec: 0 })
    newName = ''
    router.go(`combats/${id}`)
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Supprimer le combat « ${name} » ?`)) return
    await db.transaction('rw', [db.combats, db.combatLoots, db.combatCreatures], async () => {
      await db.combats.delete(id)
      await db.combatLoots.where({ combatId: id }).delete()
      await db.combatCreatures.where({ combatId: id }).delete()
    })
  }

  const fmtK = (v: number) => (v >= 10000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)))
</script>

<h1 class="text-2xl font-bold mb-4">Combats</h1>

<div class="mb-4 flex flex-wrap gap-2">
  <a href="#/combats/session" class="btn btn-primary flex-1">
    ▶ Session de farm (rentabilité chronométrée)
  </a>
  <a href="#/combats/historique" class="btn btn-outline">Historique</a>
</div>

<div class="mb-4">
  <GlobalModsBar />
</div>

<form class="flex gap-2 mb-6" onsubmit={create}>
  <input
    class="input input-bordered flex-1"
    placeholder="Nom du combat (ex: Cycloïde donjon)"
    bind:value={newName}
  />
  <button class="btn btn-primary" type="submit" disabled={newName.trim() === ''}>Créer</button>
</form>

{#if ranked.length === 0}
  <EmptyState
    message="Aucun combat enregistré."
    hint="Crée un combat, attache-lui les ressources lootées avec leur % de drop, et compare les rendements."
  />
{:else}
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body py-4">
      <table class="table">
        <thead>
          <tr>
            <th>Combat</th>
            <th class="text-right">kamas/combat</th>
            <th class="text-right">kamas/heure</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each ranked as row, i (row.combat.id)}
            <tr>
              <td>
                <a href={`#/combats/${row.combat.id}`} class="font-medium">
                  {#if i === 0 && row.profit.kamasPerHour !== null}🏆{/if}
                  {row.combat.name}
                </a>
                <div class="text-xs text-base-content/50">
                  {row.creatureCount} créature(s) ·
                  {row.combat.avgDurationSec > 0
                    ? `${Math.round(row.combat.avgDurationSec / 60)} min`
                    : 'durée ?'}
                </div>
                {#if row.profit.missingPrices.length > 0}
                  <span class="badge badge-warning badge-sm">
                    {row.profit.missingPrices.length} prix manquant(s)
                  </span>
                {/if}
              </td>
              <td class="text-right font-mono">{fmtK(row.profit.expectedKamas)}</td>
              <td class="text-right font-mono font-bold">
                {row.profit.kamasPerHour === null ? '—' : fmtK(row.profit.kamasPerHour)}
              </td>
              <td class="text-right">
                <button
                  class="btn btn-ghost btn-xs text-error"
                  onclick={() => remove(row.combat.id!, row.combat.name)}
                  aria-label="Supprimer"
                >
                  ✕
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}
