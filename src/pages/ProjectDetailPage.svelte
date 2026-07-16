<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import { setNodeMode, setNodeOwned, toCatalogEntry } from '../lib/db/repo'
  import { computeNeeds, type Catalog } from '../lib/needs/needs'
  import { applyCraft } from '../lib/needs/craft'
  import { buildDisplayTree } from '../lib/needs/tree'
  import { expandCraftTree, type ExpandProgress } from '../lib/fetch/expand'
  import AddTargetForm from '../components/AddTargetForm.svelte'
  import CraftTreeNode from '../components/CraftTreeNode.svelte'
  import FetchProgressModal from '../components/FetchProgressModal.svelte'
  import EmptyState from '../components/EmptyState.svelte'

  let { projectId }: { projectId: string } = $props()
  const pid = $derived(Number(projectId))

  const project = useLiveQuery(() => db.projects.get(Number(projectId)), undefined)
  const targets = useLiveQuery(
    () => db.projectTargets.where({ projectId: Number(projectId) }).toArray(),
    [],
  )
  const nodeStates = useLiveQuery(
    () => db.nodeStates.where({ projectId: Number(projectId) }).toArray(),
    [],
  )
  const allItems = useLiveQuery(() => db.items.toArray(), [])

  const items = $derived(new Map(allItems.value.map((i) => [i.id, i])))
  const catalog: Catalog = $derived(
    new Map(allItems.value.map((i) => [i.id, toCatalogEntry(i)])),
  )
  const stateMap = $derived(
    new Map(nodeStates.value.map((s) => [s.itemId, { mode: s.mode, owned: s.owned }])),
  )
  const targetList = $derived(targets.value.map((t) => ({ itemId: t.itemId, qty: t.qty })))
  const needs = $derived(computeNeeds(catalog, targetList, stateMap))
  const tree = $derived(buildDisplayTree(catalog, targetList))
  const shopping = $derived(
    needs.shopping
      .map((s) => ({ ...s, item: items.get(s.itemId) }))
      .sort((a, b) => b.qty - a.qty),
  )

  let tab = $state<'arbre' | 'courses'>('arbre')

  // --- Ajout de cible (expansion avec modal de progression) ---
  let expanding = $state(false)
  let progress = $state<ExpandProgress | null>(null)
  let expandError = $state('')
  let expandWarnings = $state<string[]>([])
  let abort: AbortController | null = null

  async function addTarget(url: string, qty: number) {
    expanding = true
    expandError = ''
    progress = null
    abort = new AbortController()
    try {
      const result = await expandCraftTree(url, {
        signal: abort.signal,
        onProgress: (p) => (progress = { ...p }),
      })
      expandWarnings = result.warnings
      const existing = await db.projectTargets
        .where({ projectId: pid, itemId: result.rootId })
        .first()
      if (existing) {
        await db.projectTargets.update(existing.id!, { qty: existing.qty + qty })
      } else {
        await db.projectTargets.add({ projectId: pid, itemId: result.rootId, qty })
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        expandError = `Récupération incomplète (${String(e)}). Les pages déjà chargées sont en cache : réessaie pour reprendre.`
      }
    } finally {
      expanding = false
      abort = null
    }
  }

  async function setTargetQty(targetId: number, qty: number) {
    if (qty <= 0) {
      await db.projectTargets.delete(targetId)
    } else {
      await db.projectTargets.update(targetId, { qty })
    }
  }

  // --- Craft (+1) avec dialog de stock insuffisant ---
  let craftDialog = $state<{
    itemId: number
    missing: { itemId: number; missing: number }[]
  } | null>(null)

  async function applyUpdates(updates: { itemId: number; owned: number }[]) {
    await db.nodeStates.bulkPut(
      updates.map((u) => ({
        projectId: pid,
        itemId: u.itemId,
        mode: stateMap.get(u.itemId)?.mode ?? 'craft',
        owned: u.owned,
      })),
    )
  }

  async function craft(itemId: number, force = false) {
    const result = applyCraft(catalog, stateMap, itemId, 1, force)
    if (!result.ok) {
      if (result.missing.length > 0) craftDialog = { itemId, missing: result.missing }
      return
    }
    craftDialog = null
    await applyUpdates(result.updates)
  }
</script>

<div class="flex items-center gap-2 mb-4">
  <a href="#/" class="btn btn-ghost btn-square text-xl" aria-label="Retour aux projets">←</a>
  <h1 class="text-2xl font-bold flex-1">{project.value?.name ?? '…'}</h1>
</div>

<div class="card bg-base-100 shadow-sm mb-4">
  <div class="card-body py-4">
    <AddTargetForm onAdd={addTarget} disabled={expanding} />
    {#if expandError}
      <div class="alert alert-warning text-sm">{expandError}</div>
    {/if}
    {#if expandWarnings.length > 0}
      <ul class="text-xs text-warning list-disc list-inside">
        {#each expandWarnings as w (w)}
          <li>{w}</li>
        {/each}
      </ul>
    {/if}

    {#if targets.value.length > 0}
      <div class="flex flex-col gap-1 mt-2">
        {#each targets.value as t (t.id)}
          <div class="flex items-center gap-2 text-sm">
            <span class="flex-1">{items.get(t.itemId)?.name ?? `item ${t.itemId}`}</span>
            <input
              type="number"
              class="input input-bordered h-11 w-24 text-center"
              min="0"
              inputmode="numeric"
              value={t.qty}
              onchange={(e) => setTargetQty(t.id!, Math.floor(Number(e.currentTarget.value)))}
              aria-label="Quantité cible"
            />
            <button
              class="btn btn-ghost btn-square h-11 w-11 text-error"
              onclick={() => setTargetQty(t.id!, 0)}
              aria-label="Retirer"
            >
              ✕
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if needs.warnings.length > 0}
  <div class="alert alert-warning text-sm mb-4">
    <ul class="list-disc list-inside">
      {#each needs.warnings as w (w)}
        <li>{w}</li>
      {/each}
    </ul>
  </div>
{/if}

{#if targets.value.length === 0}
  <EmptyState
    message="Aucun objet cible."
    hint="Colle l'URL encyclopédie d'un objet (dofus-touch.com) pour construire l'arbre de craft."
  />
{:else}
  <div role="tablist" class="tabs tabs-box tabs-lg mb-4">
    <button
      role="tab"
      class="tab {tab === 'arbre' ? 'tab-active' : ''}"
      onclick={() => (tab = 'arbre')}
    >
      Arbre de craft
    </button>
    <button
      role="tab"
      class="tab {tab === 'courses' ? 'tab-active' : ''}"
      onclick={() => (tab = 'courses')}
    >
      Liste de courses ({shopping.length})
    </button>
  </div>

  {#if tab === 'arbre'}
    <div>
      {#each tree as node (node.itemId)}
        <CraftTreeNode
          {node}
          {items}
          needs={needs.byItem}
          onModeChange={(id, mode) => setNodeMode(pid, id, mode)}
          onOwnedChange={(id, owned) => setNodeOwned(pid, id, owned)}
          onCraft={(id) => craft(id)}
        />
      {/each}
    </div>
  {:else}
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body py-4">
        {#if shopping.length === 0}
          <p class="text-base-content/60 text-center py-8">
            Tout est couvert par ton stock — rien à acheter !
          </p>
        {:else}
          <table class="table">
            <thead>
              <tr><th>Ressource</th><th class="text-right">Manquant</th><th></th></tr>
            </thead>
            <tbody>
              {#each shopping as s (s.itemId)}
                <tr>
                  <td>
                    {s.item?.name ?? `item ${s.itemId}`}
                    {#if s.item?.fetchStatus === 'dead'}
                      <span class="badge badge-error badge-sm ml-1">introuvable</span>
                    {/if}
                  </td>
                  <td class="text-right font-mono font-bold">{s.qty}</td>
                  <td class="text-right">
                    <a href={`#/prix/${s.itemId}`} class="btn btn-ghost btn-xs">prix</a>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
  {/if}
{/if}

<FetchProgressModal open={expanding} {progress} onCancel={() => abort?.abort()} />

{#if craftDialog}
  {@const dialogItem = items.get(craftDialog.itemId)}
  <dialog class="modal modal-bottom sm:modal-middle" open>
    <div class="modal-box">
      <h3 class="font-bold text-lg">⚠️ Stock insuffisant</h3>
      <p class="py-2 text-sm">
        Pour crafter 1 × <span class="font-semibold">{dialogItem?.name ?? craftDialog.itemId}</span>,
        il manque :
      </p>
      <ul class="rounded-box bg-base-200 px-4 py-3 text-sm flex flex-col gap-1">
        {#each craftDialog.missing as m (m.itemId)}
          <li class="flex items-center gap-2">
            <span class="badge badge-warning badge-sm font-mono">{m.missing}</span>
            <span>{items.get(m.itemId)?.name ?? m.itemId}</span>
          </li>
        {/each}
      </ul>
      <p class="py-2 text-xs text-base-content/60">
        « Forcer » applique le craft en mettant à zéro les stocks manquants (utile si tu as
        crafté avec des ressources jamais enregistrées ici).
      </p>
      <div class="modal-action">
        <button class="btn h-11 btn-ghost" onclick={() => (craftDialog = null)}>Annuler</button>
        <button class="btn h-11 btn-warning" onclick={() => craft(craftDialog!.itemId, true)}>
          Forcer quand même
        </button>
      </div>
    </div>
    <button
      class="modal-backdrop"
      onclick={() => (craftDialog = null)}
      aria-label="Fermer"
    ></button>
  </dialog>
{/if}
