<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import { globalMods } from '../lib/stores/globalMods.svelte'
  import { combatEffectiveLoots } from '../lib/combats/effectiveLoots'
  import { sessionMetrics } from '../lib/combats/sessionMetrics'
  import { recentMedianUnit } from '../lib/prices/stats'
  import { formatKamas, formatDuration } from '../lib/prices/format'
  import type { CreatureCount } from '../lib/types'
  import EmptyState from '../components/EmptyState.svelte'

  const sessions = useLiveQuery(() => db.farmSessions.toArray(), [])
  const allCombats = useLiveQuery(() => db.sessionCombats.toArray(), [])
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

  function expectedKamasOf(creatures: CreatureCount[]): number {
    let total = 0
    for (const e of combatEffectiveLoots(creatures, monstersById, [], globalMods.value)) {
      const p = priceOf(e.itemId)
      if (p !== null) total += e.expectedUnits * p
    }
    return total
  }

  type SortKey = 'date' | 'kamasPerHour' | 'totalExpectedKamas' | 'combatCount'
  let sortKey = $state<SortKey>('date')

  const rows = $derived.by(() => {
    const combatsBySession = new Map<number, typeof allCombats.value>()
    for (const c of allCombats.value) {
      const list = combatsBySession.get(c.sessionId) ?? []
      list.push(c)
      combatsBySession.set(c.sessionId, list)
    }
    const out = sessions.value
      .map((s) => {
        const combats = combatsBySession.get(s.id!) ?? []
        return {
          session: s,
          combats: combats.sort((a, b) => a.recordedAt - b.recordedAt),
          metrics: sessionMetrics(combats, expectedKamasOf),
        }
      })
      .filter((r) => r.combats.length > 0)
    out.sort((a, b) => {
      if (sortKey === 'date') return b.session.startedAt - a.session.startedAt
      return (b.metrics[sortKey] ?? 0) - (a.metrics[sortKey] ?? 0)
    })
    return out
  })

  let openId = $state<number | null>(null)

  const fmtSec = (s: number | null) => (s === null ? '—' : formatDuration(Math.round(s)))
  const fmtDate = (t: number) =>
    new Date(t).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  const compo = (creatures: CreatureCount[]) =>
    creatures.map((c) => `${c.count}× ${monstersById.get(c.monsterId)?.name ?? c.monsterId}`).join(', ')

  async function remove(id: number) {
    if (!confirm('Supprimer cette session de l’historique ?')) return
    await db.transaction('rw', [db.farmSessions, db.sessionCombats], async () => {
      await db.farmSessions.delete(id)
      await db.sessionCombats.where({ sessionId: id }).delete()
    })
  }
</script>

<div class="flex items-center gap-2 mb-4">
  <a href="#/combats" class="btn btn-ghost btn-square text-xl" aria-label="Retour">←</a>
  <h1 class="text-2xl font-bold flex-1">Historique des sessions</h1>
</div>

{#if rows.length === 0}
  <EmptyState
    message="Aucune session enregistrée."
    hint="Lance une session de farm et enchaîne quelques combats pour la retrouver ici."
  />
{:else}
  <div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
    <span class="text-base-content/60">Trier par :</span>
    <div class="join">
      <button
        class="btn btn-xs join-item {sortKey === 'date' ? 'btn-primary' : ''}"
        onclick={() => (sortKey = 'date')}>Date</button
      >
      <button
        class="btn btn-xs join-item {sortKey === 'kamasPerHour' ? 'btn-primary' : ''}"
        onclick={() => (sortKey = 'kamasPerHour')}>k/h</button
      >
      <button
        class="btn btn-xs join-item {sortKey === 'totalExpectedKamas' ? 'btn-primary' : ''}"
        onclick={() => (sortKey = 'totalExpectedKamas')}>Kamas</button
      >
      <button
        class="btn btn-xs join-item {sortKey === 'combatCount' ? 'btn-primary' : ''}"
        onclick={() => (sortKey = 'combatCount')}>Combats</button
      >
    </div>
  </div>

  <div class="card bg-base-100 shadow-sm">
    <div class="card-body overflow-x-auto p-2 sm:p-4">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Session</th>
            <th class="text-right">Combats</th>
            <th class="text-right">Kamas</th>
            <th class="text-right">k/h</th>
            <th class="text-right">moy/combat</th>
            <th class="text-right">entre</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.session.id)}
            {@const m = row.metrics}
            <tr class="cursor-pointer hover:bg-base-200/50">
              <td
                onclick={() => (openId = openId === row.session.id ? null : row.session.id!)}
              >
                <div class="font-medium whitespace-nowrap">
                  {openId === row.session.id ? '▾' : '▸'}
                  {fmtDate(row.session.startedAt)}
                </div>
                <div class="text-xs text-base-content/50">
                  {m.totalMonsters} monstres
                  {#if !row.session.endedAt}<span class="badge badge-warning badge-xs ml-1">en cours</span>{/if}
                </div>
              </td>
              <td class="text-right font-mono">{m.combatCount}</td>
              <td class="text-right font-mono">{formatKamas(m.totalExpectedKamas)}</td>
              <td class="text-right font-mono font-bold">
                {m.kamasPerHour === null ? '—' : formatKamas(m.kamasPerHour)}
              </td>
              <td class="text-right font-mono">{fmtSec(m.avgCombatSec)}</td>
              <td class="text-right font-mono">{fmtSec(m.avgIdleSec)}</td>
              <td class="text-right">
                <button
                  class="btn btn-ghost btn-xs text-error"
                  onclick={() => remove(row.session.id!)}
                  aria-label="Supprimer">✕</button
                >
              </td>
            </tr>
            {#if openId === row.session.id}
              <tr>
                <td colspan="7" class="bg-base-200/40">
                  <div class="text-xs text-base-content/60 mb-1">
                    temps/monstre moy {fmtSec(m.avgSecPerMonster)} · combat total
                    {formatDuration(m.totalCombatSec)} · exploration {formatDuration(m.totalIdleSec)}
                  </div>
                  <table class="table table-xs">
                    <thead>
                      <tr><th>#</th><th>Composition</th><th class="text-right">Durée</th><th class="text-right">Avant</th><th class="text-right">~Kamas</th></tr>
                    </thead>
                    <tbody>
                      {#each row.combats as c, i (c.id)}
                        <tr>
                          <td>{i + 1}</td>
                          <td>{compo(c.creatures)}</td>
                          <td class="text-right font-mono">{formatDuration(c.durationSec)}</td>
                          <td class="text-right font-mono">{formatDuration(c.idleBeforeSec)}</td>
                          <td class="text-right font-mono">{formatKamas(expectedKamasOf(c.creatures))}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}
