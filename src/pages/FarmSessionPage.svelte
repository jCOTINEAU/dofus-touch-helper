<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import { farmSession } from '../lib/stores/farmSession.svelte'
  import { globalMods } from '../lib/stores/globalMods.svelte'
  import { combatEffectiveLoots } from '../lib/combats/effectiveLoots'
  import { sessionMetrics } from '../lib/combats/sessionMetrics'
  import { recentMedianUnit } from '../lib/prices/stats'
  import { formatKamas, formatDuration } from '../lib/prices/format'
  import type { CreatureCount } from '../lib/types'
  import GlobalModsBar from '../components/GlobalModsBar.svelte'
  import MonsterPicker from '../components/MonsterPicker.svelte'

  const allMonsters = useLiveQuery(() => db.monsters.toArray(), [])
  const allEntries = useLiveQuery(() => db.priceEntries.toArray(), [])
  const monstersById = $derived(new Map(allMonsters.value.map((m) => [m.id, m])))

  const live = $derived(farmSession.state)
  // On lit toute la table (dépendance Dexie toujours suivie) puis on filtre
  // par session en dérivé — robuste aux changements de session.
  const allSessionCombats = useLiveQuery(() => db.sessionCombats.toArray(), [])
  const combats = $derived(
    live ? allSessionCombats.value.filter((c) => c.sessionId === live.sessionId) : [],
  )

  // Horloge vivante (1 s) pour l'affichage du chrono.
  let now = $state(Date.now())
  $effect(() => {
    const t = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(t)
  })

  const priceOf = $derived.by(() => {
    const byItem = new Map<number, typeof allEntries.value>()
    for (const e of allEntries.value) {
      const list = byItem.get(e.itemId) ?? []
      list.push(e)
      byItem.set(e.itemId, list)
    }
    return (itemId: number) => {
      const entries = byItem.get(itemId)
      return entries ? recentMedianUnit(entries, now) : null
    }
  })

  function expectedKamasOf(creatures: CreatureCount[]): number {
    const eff = combatEffectiveLoots(creatures, monstersById, [], globalMods.value)
    let total = 0
    for (const e of eff) {
      const p = priceOf(e.itemId)
      if (p !== null) total += e.expectedUnits * p
    }
    return total
  }

  const metrics = $derived(sessionMetrics(combats, expectedKamasOf))

  const prepCounts = $derived(
    new Map((live?.prep ?? []).map((c) => [c.monsterId, c.count])),
  )
  const prepKamas = $derived(live ? expectedKamasOf(live.prep) : 0)

  const clock = $derived(farmSession.elapsed(now))
  const fmtClock = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const fmtAvg = (s: number | null) => (s === null ? '—' : formatDuration(Math.round(s)))

  async function terminate() {
    if (!confirm('Terminer la session de farm ?')) return
    await farmSession.end()
  }
</script>

<div class="flex items-center gap-2 mb-3">
  <a href="#/combats" class="btn btn-ghost btn-square text-xl" aria-label="Retour">←</a>
  <h1 class="text-2xl font-bold flex-1">Session de farm</h1>
  {#if farmSession.active && live?.phase !== 'preparing'}
    <button class="btn btn-sm" onclick={() => farmSession.togglePause()}>
      {farmSession.paused ? '▶ Reprendre' : '⏸ Pause'}
    </button>
  {/if}
</div>

{#if !farmSession.active}
  <!-- Écran de démarrage -->
  <div class="card bg-base-100 shadow-sm mb-4">
    <div class="card-body items-center gap-4 py-8 text-center">
      <p class="text-base-content/60">
        Lance une session : le chrono mesure le temps d'exploration et de chaque combat pour
        estimer ta rentabilité réelle.
      </p>
      <button class="btn btn-primary btn-lg" onclick={() => farmSession.start()}>
        ▶ Démarrer une session
      </button>
      <a href="#/combats/masques" class="link link-hover text-sm">Gérer les monstres masqués</a>
    </div>
  </div>
  <GlobalModsBar />
{:else}
  {@const s = live!}
  <!-- Bandeau chrono + métriques -->
  <div class="stats stats-horizontal shadow-sm bg-base-100 w-full mb-3 text-center">
    <div class="stat px-3 py-2">
      <div class="stat-title text-xs">
        {s.phase === 'fighting' ? 'Combat' : s.phase === 'preparing' ? 'Préparation' : 'Exploration'}
        {farmSession.paused ? '(pause)' : ''}
      </div>
      <div class="stat-value font-mono text-2xl">
        {s.phase === 'preparing' ? '—' : fmtClock(clock)}
      </div>
    </div>
    <div class="stat px-3 py-2">
      <div class="stat-title text-xs">{metrics.combatCount} combats</div>
      <div class="stat-value font-mono text-lg">{formatKamas(metrics.totalExpectedKamas)}</div>
      <div class="stat-desc">
        moy {fmtAvg(metrics.avgCombatSec)}/combat · {fmtAvg(metrics.avgIdleSec)} entre
      </div>
    </div>
  </div>

  {#if s.phase === 'idle'}
    <button
      class="btn btn-primary btn-block h-24 text-2xl"
      onclick={() => farmSession.prepare()}
      disabled={farmSession.paused}
    >
      ⚔ Préparer combat
    </button>
    <div class="mt-3 flex justify-between">
      <a href="#/combats/masques" class="btn btn-ghost btn-sm">Masquer des monstres</a>
      <button class="btn btn-ghost btn-sm text-error" onclick={terminate}>Terminer la session</button>
    </div>
  {:else if s.phase === 'preparing'}
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body gap-3 py-4">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">Préparer le combat</h2>
          <button class="btn btn-ghost btn-sm" onclick={() => farmSession.cancelPrepare()}>
            ✕ Annuler
          </button>
        </div>
        <MonsterPicker
          monsters={allMonsters.value}
          counts={prepCounts}
          onAdd={(mid, d) => farmSession.addMonster(mid, d)}
        />
        <div class="text-sm">
          Sélection :
          {#if s.prep.length === 0}
            <span class="text-base-content/50">aucune</span>
          {:else}
            {s.prep.map((c) => `${c.count}× ${monstersById.get(c.monsterId)?.name ?? c.monsterId}`).join(', ')}
            · ~{formatKamas(prepKamas)}
          {/if}
        </div>
        <button
          class="btn btn-primary btn-block h-16 text-xl"
          onclick={() => farmSession.startFight()}
          disabled={s.prep.length === 0}
        >
          ⚔ Combattre
        </button>
      </div>
    </div>
  {:else if s.phase === 'fighting'}
    <div class="mb-3 text-center text-sm text-base-content/60">
      {s.prep.map((c) => `${c.count}× ${monstersById.get(c.monsterId)?.name ?? c.monsterId}`).join(', ')}
      · ~{formatKamas(prepKamas)} espérés
    </div>
    <button
      class="btn btn-success btn-block h-24 text-2xl"
      onclick={() => farmSession.endFight()}
      disabled={farmSession.paused}
    >
      ✅ Fin de combat
    </button>
  {/if}
{/if}
