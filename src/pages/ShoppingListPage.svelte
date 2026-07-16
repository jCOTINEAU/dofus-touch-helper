<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import { toCatalogEntry } from '../lib/db/repo'
  import { computeNeeds } from '../lib/needs/needs'
  import { computeGlobalShopping } from '../lib/needs/shopping'
  import EmptyState from '../components/EmptyState.svelte'

  const projects = useLiveQuery(() => db.projects.toArray(), [])
  const allTargets = useLiveQuery(() => db.projectTargets.toArray(), [])
  const allStates = useLiveQuery(() => db.nodeStates.toArray(), [])
  const allItems = useLiveQuery(() => db.items.toArray(), [])

  const items = $derived(new Map(allItems.value.map((i) => [i.id, i])))
  const rows = $derived.by(() => {
    const catalog = new Map(allItems.value.map((i) => [i.id, toCatalogEntry(i)]))
    const results = projects.value.map((p) => {
      const targets = allTargets.value
        .filter((t) => t.projectId === p.id)
        .map((t) => ({ itemId: t.itemId, qty: t.qty }))
      const states = new Map(
        allStates.value
          .filter((s) => s.projectId === p.id)
          .map((s) => [s.itemId, { mode: s.mode, owned: s.owned }]),
      )
      return computeNeeds(catalog, targets, states)
    })
    return [...computeGlobalShopping(results).entries()]
      .map(([itemId, line]) => ({ itemId, ...line, item: items.get(itemId) }))
      .sort((a, b) => b.remaining - a.remaining)
  })
</script>

<h1 class="text-2xl font-bold mb-4">Liste de courses globale</h1>
<p class="text-sm text-base-content/60 mb-4">
  Tout ce qu'il manque, cumulé sur l'ensemble des projets.
</p>

{#if rows.length === 0}
  <EmptyState
    message="Rien à acheter."
    hint="Les besoins restants de tes projets apparaîtront ici."
  />
{:else}
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body py-4">
      <table class="table">
        <thead>
          <tr>
            <th>Ressource</th>
            <th class="text-right">Possédé</th>
            <th class="text-right">Reste à obtenir</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.itemId)}
            <tr>
              <td>
                {row.item?.name ?? `item ${row.itemId}`}
                {#if row.item?.fetchStatus === 'dead'}
                  <span class="badge badge-error badge-sm ml-1">introuvable</span>
                {/if}
              </td>
              <td class="text-right">
                <div class="font-mono whitespace-nowrap">
                  <span class="font-bold">{row.owned}</span>
                  <span class="text-base-content/45">/ {row.required}</span>
                </div>
                <progress
                  class="progress progress-warning h-1 w-14"
                  value={Math.min(row.owned, row.required)}
                  max={Math.max(row.required, 1)}
                ></progress>
              </td>
              <td class="text-right font-mono font-bold whitespace-nowrap">{row.remaining}</td>
              <td class="text-right">
                <a href={`#/prix/${row.itemId}`} class="btn btn-ghost btn-xs">prix</a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}
