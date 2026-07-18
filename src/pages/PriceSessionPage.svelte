<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import {
    LOT_SIZES,
    recentMedianUnit,
    seriesByLot,
    type LotSize,
  } from '../lib/prices/stats'
  import {
    advanceLot,
    currentItem,
    progress,
    selectLot,
    skipToNextItem,
    startSession,
    type SessionState,
  } from '../lib/prices/session'
  import { formatKamas, formatRelativeTime } from '../lib/prices/format'
  import { toCatalogEntry } from '../lib/db/repo'
  import { computeNeeds } from '../lib/needs/needs'
  import ItemAvatar from '../components/ItemAvatar.svelte'
  import NumPad from '../components/NumPad.svelte'
  import type { CachedItem } from '../lib/types'

  const allItems = useLiveQuery(() => db.items.toArray(), [])
  const allEntries = useLiveQuery(() => db.priceEntries.toArray(), [])
  const allProjects = useLiveQuery(() => db.projects.toArray(), [])
  const allTargets = useLiveQuery(() => db.projectTargets.toArray(), [])
  const allStates = useLiveQuery(() => db.nodeStates.toArray(), [])

  const items = $derived(new Map(allItems.value.map((i) => [i.id, i])))

  const entriesByItem = $derived.by(() => {
    const map = new Map<number, typeof allEntries.value>()
    for (const e of allEntries.value) {
      const list = map.get(e.itemId) ?? []
      list.push(e)
      map.set(e.itemId, list)
    }
    return map
  })

  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, 'fr')

  // --- Phase 1 : sélection des ressources de la tournée ---
  let phase = $state<'select' | 'entry' | 'done'>('select')
  let selected = $state<Set<number>>(new Set())
  let initialized = $state(false)

  // Filtre par projet(s). Vide = toutes les ressources suivies.
  let projectFilter = $state<Set<number>>(new Set())
  // En mode projet, ignorer les ressources déjà au complet (reste 0).
  let skipComplete = $state(true)

  interface Candidate {
    item: CachedItem
    lastAt: number
    /** Reste à obtenir cumulé sur les projets filtrés (mode projet). */
    remaining: number | null
  }

  /** Ressources suivies (≥ 1 relevé), triées comme l'HDV. */
  const trackedCandidates = $derived<Candidate[]>(
    allItems.value
      .filter((i) => entriesByItem.has(i.id))
      .map((item) => ({
        item,
        lastAt: (entriesByItem.get(item.id) ?? []).reduce((m, e) => Math.max(m, e.recordedAt), 0),
        remaining: null,
      }))
      .sort((a, b) => byName(a.item, b.item)),
  )

  /** Ressources (feuilles du plan) des projets filtrés, avec reste cumulé. */
  const projectCandidates = $derived.by<Candidate[]>(() => {
    if (projectFilter.size === 0) return []
    const catalog = new Map(allItems.value.map((i) => [i.id, toCatalogEntry(i)]))
    const remainingById = new Map<number, number>()
    for (const p of allProjects.value) {
      if (!projectFilter.has(p.id!)) continue
      const targets = allTargets.value
        .filter((t) => t.projectId === p.id)
        .map((t) => ({ itemId: t.itemId, qty: t.qty }))
      const states = new Map(
        allStates.value
          .filter((s) => s.projectId === p.id)
          .map((s) => [s.itemId, { mode: s.mode, owned: s.owned }]),
      )
      const needs = computeNeeds(catalog, targets, states)
      for (const n of needs.byItem.values()) {
        if (!n.isLeafInPlan) continue // on ne price que ce qu'on achète
        remainingById.set(n.itemId, (remainingById.get(n.itemId) ?? 0) + n.remaining)
      }
    }
    const out: Candidate[] = []
    for (const [itemId, remaining] of remainingById) {
      if (skipComplete && remaining === 0) continue
      const item = items.get(itemId)
      if (!item) continue // ressource non encore en cache (expansion incomplète)
      out.push({
        item,
        lastAt: (entriesByItem.get(itemId) ?? []).reduce((m, e) => Math.max(m, e.recordedAt), 0),
        remaining,
      })
    }
    return out.sort((a, b) => byName(a.item, b.item))
  })

  const candidates = $derived(
    projectFilter.size === 0 ? trackedCandidates : projectCandidates,
  )

  $effect(() => {
    // Pré-coche tout à l'arrivée (une fois les données chargées).
    if (!initialized && candidates.length > 0) {
      selected = new Set(candidates.map((c) => c.item.id))
      initialized = true
    }
  })

  function selectAllCandidates() {
    selected = new Set(candidates.map((c) => c.item.id))
  }

  function toggleProject(id: number) {
    const next = new Set(projectFilter)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    projectFilter = next
    selectAllCandidates()
  }

  function useAllTracked() {
    projectFilter = new Set()
    selectAllCandidates()
  }

  function setSkipComplete(v: boolean) {
    skipComplete = v
    selectAllCandidates()
  }

  function toggle(id: number) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selected = next
  }

  // Reprise d'une tournée : ne garder que cet objet et tous ceux d'après
  // (dans l'ordre alphabétique = l'ordre de la session).
  function resumeFrom(index: number) {
    selected = new Set(candidates.slice(index).map((c) => c.item.id))
  }

  // --- Phase 2 : saisie ---
  let session = $state<SessionState | null>(null)
  let typed = $state('')
  let recordedCount = $state(0)
  /** Relevés de la session : "itemId:lot" → { lotPrice, variationPct|null } */
  let recorded = $state<Map<string, { lotPrice: number; variationPct: number | null }>>(new Map())

  function start() {
    const sessionItems = candidates
      .filter((c) => selected.has(c.item.id))
      .map((c) => {
        const series = seriesByLot(entriesByItem.get(c.item.id) ?? [])
        const lots = LOT_SIZES.filter((s) => series[s].length > 0)
        return { itemId: c.item.id, lots: lots.length > 0 ? lots : [...LOT_SIZES] }
      })
    session = startSession(sessionItems)
    typed = ''
    recordedCount = 0
    recorded = new Map()
    phase = session.finished ? 'done' : 'entry'
  }

  const current = $derived(session ? currentItem(session) : null)
  const currentCached = $derived(current ? items.get(current.itemId) : undefined)
  const currentEntries = $derived(current ? (entriesByItem.get(current.itemId) ?? []) : [])
  const currentMedian = $derived(
    current ? recentMedianUnit(currentEntries, Date.now()) : null,
  )

  /** Dernier prix connu du lot (prix du lot entier). */
  const lastLotPrice = $derived((lot: LotSize) => {
    const series = seriesByLot(currentEntries)[lot]
    return series.length > 0 ? series[series.length - 1].lot : null
  })

  function afterStep(next: SessionState) {
    session = next
    typed = ''
    if (next.finished) phase = 'done'
  }

  function ok() {
    if (!session || !current || typed === '') return
    const lotPrice = Number(typed)
    if (!Number.isFinite(lotPrice) || lotPrice <= 0) return
    const lot = session.currentLot
    const unit = lotPrice / lot
    const variationPct =
      currentMedian !== null && currentMedian > 0
        ? Math.round(((unit - currentMedian) / currentMedian) * 100)
        : null
    void db.priceEntries.add({
      itemId: current.itemId,
      lotSize: lot,
      lotPrice,
      recordedAt: Date.now(),
    })
    const key = `${current.itemId}:${lot}`
    const nextRecorded = new Map(recorded)
    nextRecorded.set(key, { lotPrice, variationPct })
    recorded = nextRecorded
    recordedCount++
    afterStep(advanceLot(session))
  }

  const prog = $derived(session ? progress(session) : { done: 0, total: 0 })
  const upcoming = $derived.by(() => {
    if (!session || session.finished) return []
    return session.items
      .slice(session.itemIndex + 1, session.itemIndex + 5)
      .map((i) => items.get(i.itemId)?.name ?? `item ${i.itemId}`)
  })

  const sessionMark = $derived((itemId: number, lot: LotSize) =>
    recorded.get(`${itemId}:${lot}`),
  )
</script>

{#if phase === 'select'}
  <div class="flex items-center gap-2 mb-4">
    <a href="#/prix" class="btn btn-ghost btn-square text-xl" aria-label="Retour aux prix">←</a>
    <h1 class="text-2xl font-bold flex-1">Session HDV</h1>
  </div>

  {#if trackedCandidates.length === 0 && allProjects.value.length === 0}
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <p class="text-base-content/60">
          Aucune ressource suivie : relève au moins un prix depuis une fiche ressource pour
          pouvoir lancer une session.
        </p>
      </div>
    </div>
  {:else}
    <!-- Source : toutes les suivies, ou les ressources d'un/plusieurs projets -->
    <div class="card bg-base-100 shadow-sm mb-4">
      <div class="card-body py-3 gap-2">
        <span class="text-xs font-semibold text-base-content/60 uppercase">Source</span>
        <div class="flex flex-wrap gap-2">
          <button
            class="btn btn-sm {projectFilter.size === 0 ? 'btn-primary' : 'btn-outline'}"
            onclick={useAllTracked}
          >
            Toutes les suivies
          </button>
          {#each allProjects.value as p (p.id)}
            <button
              class="btn btn-sm {projectFilter.has(p.id!) ? 'btn-primary' : 'btn-outline'}"
              onclick={() => toggleProject(p.id!)}
            >
              {p.name}
            </button>
          {/each}
        </div>
        {#if projectFilter.size > 0}
          <label class="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              class="toggle toggle-sm toggle-primary"
              checked={skipComplete}
              onchange={(e) => setSkipComplete(e.currentTarget.checked)}
            />
            Ignorer les ressources déjà complètes (reste 0)
          </label>
        {/if}
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm mb-4">
      <div class="card-body py-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-semibold">Ressources de la tournée ({selected.size}/{candidates.length})</h2>
          <div class="join">
            <button class="btn btn-sm join-item" onclick={selectAllCandidates}>Tout</button>
            <button class="btn btn-sm join-item" onclick={() => (selected = new Set())}>
              Rien
            </button>
          </div>
        </div>
        <p class="text-xs text-base-content/50">
          Astuce : <strong>double-tape</strong> un objet pour ne garder que lui et les suivants
          (reprendre une tournée interrompue).
        </p>
        {#if candidates.length === 0}
          <p class="py-4 text-center text-sm text-base-content/50">
            Aucune ressource à relever pour cette source.
          </p>
        {:else}
          <div class="flex flex-col divide-y divide-base-200">
            {#each candidates as c, i (c.item.id)}
              {@const stale = Date.now() - c.lastAt > 3 * 24 * 3600 * 1000}
              <label
                class="flex min-h-12 cursor-pointer touch-manipulation items-center gap-3 py-2 select-none"
                ondblclick={() => resumeFrom(i)}
                title="Double-tape pour reprendre à partir d'ici"
              >
                <input
                  type="checkbox"
                  class="checkbox checkbox-primary"
                  checked={selected.has(c.item.id)}
                  onchange={() => toggle(c.item.id)}
                />
                <ItemAvatar imageUrl={c.item.imageUrl} name={c.item.name} size={32} />
                <span class="flex-1">{c.item.name}</span>
                {#if c.remaining !== null}
                  <span class="badge badge-ghost badge-sm">reste {c.remaining}</span>
                {/if}
                <span class="text-xs {stale ? 'text-warning' : 'text-base-content/40'}">
                  {c.lastAt === 0 ? 'jamais' : formatRelativeTime(c.lastAt, Date.now())}
                </span>
              </label>
            {/each}
          </div>
        {/if}
      </div>
    </div>
    <button class="btn btn-primary btn-lg w-full" disabled={selected.size === 0} onclick={start}>
      ▶ Démarrer la session ({selected.size})
    </button>
  {/if}
{:else if phase === 'entry' && session && current}
  <!-- Barre de progression -->
  <div class="flex items-center gap-3 mb-3">
    <a href="#/prix" class="btn btn-ghost btn-sm" aria-label="Quitter la session">✕</a>
    <progress class="progress progress-primary flex-1" value={prog.done} max={prog.total}
    ></progress>
    <span class="font-mono text-sm">{prog.done + 1}/{prog.total}</span>
  </div>

  <!-- Ressource courante -->
  <div class="card bg-base-100 shadow-sm mb-3">
    <div class="card-body gap-3 py-4">
      <div class="flex items-center gap-3">
        <ItemAvatar imageUrl={currentCached?.imageUrl} name={currentCached?.name ?? '…'} size={44} />
        <div class="flex-1">
          <div class="text-lg font-bold">{currentCached?.name ?? `item ${current.itemId}`}</div>
          {#if currentMedian !== null}
            <div class="text-xs text-base-content/50">
              médiane récente : {formatKamas(currentMedian)}/u
            </div>
          {/if}
        </div>
      </div>

      <!-- Puces de lots -->
      <div class="grid grid-cols-3 gap-2">
        {#each LOT_SIZES as lot (lot)}
          {@const mark = sessionMark(current.itemId, lot)}
          {@const active = session.currentLot === lot}
          {@const proposed = current.lots.includes(lot)}
          <button
            class="rounded-box border p-2 text-left {active
              ? 'border-primary bg-primary/10'
              : mark
                ? 'border-success/50 bg-success/5'
                : proposed
                  ? 'border-base-300'
                  : 'border-base-200 opacity-50'}"
            onclick={() => (session = selectLot(session!, lot))}
          >
            <div class="text-sm font-bold">
              ×{lot}
              {#if mark}
                ✓
                {#if mark.variationPct !== null && Math.abs(mark.variationPct) >= 15}
                  <span class="badge badge-warning badge-sm">
                    {mark.variationPct > 0 ? '+' : ''}{mark.variationPct} %
                  </span>
                {/if}
              {:else if active}
                ▶
              {/if}
            </div>
            <div class="text-xs text-base-content/50">
              {#if mark}
                {formatKamas(mark.lotPrice)}
              {:else if lastLotPrice(lot) !== null}
                dern. {formatKamas(lastLotPrice(lot)!)}
              {:else}
                jamais suivi
              {/if}
            </div>
          </button>
        {/each}
      </div>

      <!-- Zone de saisie (affichage seul, pas d'input natif) -->
      <div class="flex items-center justify-between rounded-box bg-base-200 px-4 py-3">
        <span class="text-sm text-base-content/60">Prix du lot ×{session.currentLot} :</span>
        <span class="font-mono text-2xl font-bold">
          {typed === '' ? '—' : formatKamas(Number(typed)).slice(0, -2)}
          <span class="text-base text-base-content/50">k</span>
        </span>
      </div>
    </div>
  </div>

  <NumPad
    onDigit={(d) => (typed = (typed + d).slice(0, 9))}
    onErase={() => (typed = typed.slice(0, -1))}
    onOk={ok}
    okDisabled={typed === '' || Number(typed) <= 0}
    onSkipLot={() => afterStep(advanceLot(session!))}
    onSkipItem={() => afterStep(skipToNextItem(session!))}
  />

  {#if upcoming.length > 0}
    <p class="mt-3 text-xs text-base-content/40">à venir : {upcoming.join(' · ')}…</p>
  {/if}
{:else if phase === 'done'}
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body items-center gap-4 py-10 text-center">
      <div class="text-4xl">🎉</div>
      <h1 class="text-2xl font-bold">Session terminée</h1>
      <p class="text-base-content/60">{recordedCount} relevé(s) enregistré(s).</p>
      <div class="flex gap-2">
        <a href="#/prix" class="btn btn-primary">Retour aux prix</a>
        <button class="btn btn-ghost" onclick={() => (phase = 'select')}>Nouvelle session</button>
      </div>
    </div>
  </div>
{/if}
