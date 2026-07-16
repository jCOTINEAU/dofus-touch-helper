<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import { setNodeOwned, toCatalogEntry } from '../lib/db/repo'
  import { computeNeeds } from '../lib/needs/needs'
  import { computeGlobalShopping, projectCountsInShopping } from '../lib/needs/shopping'
  import { recentMedianUnit } from '../lib/prices/stats'
  import { formatKamas } from '../lib/prices/format'
  import { makeFarmAdvisor } from '../lib/combats/farming'
  import QtyStepper from '../components/QtyStepper.svelte'
  import EmptyState from '../components/EmptyState.svelte'
  import FarmHint from '../components/FarmHint.svelte'

  const projects = useLiveQuery(() => db.projects.toArray(), [])
  const allTargets = useLiveQuery(() => db.projectTargets.toArray(), [])
  const allStates = useLiveQuery(() => db.nodeStates.toArray(), [])
  const allItems = useLiveQuery(() => db.items.toArray(), [])
  const allEntries = useLiveQuery(() => db.priceEntries.toArray(), [])
  const allCombats = useLiveQuery(() => db.combats.toArray(), [])
  const allLoots = useLiveQuery(() => db.combatLoots.toArray(), [])

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

  interface ProjectShare {
    projectId: number
    projectName: string
    remaining: number
    owned: number
    required: number
  }

  const rows = $derived.by(() => {
    const catalog = new Map(allItems.value.map((i) => [i.id, toCatalogEntry(i)]))
    const perProject = projects.value.filter(projectCountsInShopping).map((p) => {
      const targets = allTargets.value
        .filter((t) => t.projectId === p.id)
        .map((t) => ({ itemId: t.itemId, qty: t.qty }))
      const states = new Map(
        allStates.value
          .filter((s) => s.projectId === p.id)
          .map((s) => [s.itemId, { mode: s.mode, owned: s.owned }]),
      )
      return { project: p, needs: computeNeeds(catalog, targets, states) }
    })

    const global = computeGlobalShopping(perProject.map((r) => r.needs))
    return [...global.entries()]
      .map(([itemId, line]) => {
        // Répartition par projet : le stock étant par (projet, ressource),
        // la saisie se fait dans la sous-ligne du projet concerné.
        const shares: ProjectShare[] = []
        for (const { project, needs } of perProject) {
          const inShopping = needs.shopping.find((s) => s.itemId === itemId)
          if (!inShopping) continue
          const need = needs.byItem.get(itemId)!
          shares.push({
            projectId: project.id!,
            projectName: project.name,
            remaining: inShopping.qty,
            owned: need.owned,
            required: need.required,
          })
        }
        const unitPrice = priceOf(itemId)
        return {
          itemId,
          ...line,
          item: items.get(itemId),
          shares,
          unitPrice,
          lineCost: unitPrice === null ? null : unitPrice * line.remaining,
        }
      })
      .sort((a, b) => b.remaining - a.remaining)
  })

  const total = $derived(rows.reduce((sum, r) => sum + (r.lineCost ?? 0), 0))
  const missingPriceCount = $derived(rows.filter((r) => r.lineCost === null).length)

  const farmAdviceFor = $derived(makeFarmAdvisor(allCombats.value, allLoots.value, priceOf))

  const excludedCount = $derived(
    projects.value.filter((p) => !projectCountsInShopping(p)).length,
  )

  let openItem = $state<number | null>(null)
</script>

<h1 class="text-2xl font-bold mb-4">Liste de courses globale</h1>
<p class="text-sm text-base-content/60 mb-4">
  Tout ce qu'il manque, cumulé sur l'ensemble des projets. Touche une ligne pour saisir le stock
  projet par projet.
  {#if excludedCount > 0}
    <span class="text-base-content/40">
      ({excludedCount} projet(s) exclu(s) des courses globales)
    </span>
  {/if}
</p>

{#if rows.length === 0}
  <EmptyState
    message="Rien à acheter."
    hint="Les besoins restants de tes projets apparaîtront ici."
  />
{:else}
  <div class="card bg-base-100 shadow-sm mb-4">
    <div class="card-body flex-row flex-wrap items-baseline justify-between py-4">
      <span class="text-sm text-base-content/60">Coût estimé total :</span>
      <span class="font-mono text-xl font-bold">
        {formatKamas(total)}{missingPriceCount > 0 ? ' +?' : ''}
      </span>
      {#if missingPriceCount > 0}
        <span class="w-full text-xs text-warning">
          Total partiel : {missingPriceCount} ressource(s) sans prix relevé.
        </span>
      {/if}
    </div>
  </div>

  <div class="flex flex-col gap-2">
    {#each rows as row (row.itemId)}
      <div class="card bg-base-100 shadow-sm">
        <button
          class="card-body flex-row flex-wrap items-center gap-x-3 gap-y-1 py-3 text-left"
          onclick={() => (openItem = openItem === row.itemId ? null : row.itemId)}
          aria-expanded={openItem === row.itemId}
        >
          <div class="min-w-40 flex-1">
            <div class="font-medium">
              {row.item?.name ?? `item ${row.itemId}`}
              {#if row.item?.fetchStatus === 'dead'}
                <span class="badge badge-error badge-sm ml-1">introuvable</span>
              {/if}
              {#if row.shares.length > 1}
                <span class="badge badge-ghost badge-sm ml-1">{row.shares.length} projets</span>
              {/if}
            </div>
            <div class="text-xs text-base-content/50">
              reste <span class="font-mono font-bold text-base-content">{row.remaining}</span>
              sur {row.required} —
              {#if row.lineCost !== null}
                ≈ <span class="font-mono">{formatKamas(row.lineCost)}</span>
                <span class="text-base-content/35">({formatKamas(row.unitPrice!)}/u)</span>
              {:else}
                <a
                  href={`#/prix/${row.itemId}`}
                  class="link link-warning"
                  onclick={(e) => e.stopPropagation()}
                >
                  prix à relever
                </a>
              {/if}
            </div>
            {#if farmAdviceFor(row.itemId, row.remaining, row.unitPrice)}
              <FarmHint advice={farmAdviceFor(row.itemId, row.remaining, row.unitPrice)!} />
            {/if}
          </div>
          <a
            href={`#/prix/${row.itemId}`}
            class="btn btn-ghost btn-xs"
            onclick={(e) => e.stopPropagation()}
          >
            prix
          </a>
        </button>

        {#if openItem === row.itemId}
          <div class="border-t border-base-200 px-4 py-2">
            {#each row.shares as share (share.projectId)}
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <a href={`#/projets/${share.projectId}`} class="min-w-32 flex-1 text-sm link-hover">
                  {share.projectName}
                  <span class="block text-xs text-base-content/50">
                    reste {share.remaining} sur {share.required}
                  </span>
                </a>
                <QtyStepper
                  value={share.owned}
                  onchange={(v) => setNodeOwned(share.projectId, row.itemId, v)}
                />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
