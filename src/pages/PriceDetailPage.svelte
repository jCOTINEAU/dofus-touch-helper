<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import {
    LOT_SIZES,
    divergence,
    lotStats,
    recentMedianUnit,
    seriesByLot,
    type LotSize,
  } from '../lib/prices/stats'
  import ItemAvatar from '../components/ItemAvatar.svelte'
  import LineChart from '../components/LineChart.svelte'
  import PriceEntryForm from '../components/PriceEntryForm.svelte'

  let { itemId }: { itemId: string } = $props()
  const id = $derived(Number(itemId))

  const item = useLiveQuery(() => db.items.get(Number(itemId)), undefined)
  const entries = useLiveQuery(
    () => db.priceEntries.where({ itemId: Number(itemId) }).toArray(),
    [],
  )

  const series = $derived(seriesByLot(entries.value))
  const stats = $derived(
    LOT_SIZES.map((size) => ({ size, ...lotStats(series[size]) })).filter((s) => s.count > 0),
  )
  const div = $derived(divergence(entries.value))
  const reference = $derived(recentMedianUnit(entries.value, Date.now()))

  const COLORS: Record<LotSize, string> = { 1: '#6366f1', 10: '#f59e0b', 100: '#10b981' }
  let view = $state<'unit' | 'lot'>('unit')

  const chartSeries = $derived(
    LOT_SIZES.map((size) => ({
      label: view === 'unit' ? `lot ×${size} (k/unité)` : `lot ×${size} (k/lot)`,
      color: COLORS[size],
      points: series[size].map((p) => ({ t: p.t, v: view === 'unit' ? p.unit : p.lot })),
    })).filter((s) => s.points.length > 0),
  )

  const history = $derived([...entries.value].sort((a, b) => b.recordedAt - a.recordedAt))

  async function addEntry(lotSize: LotSize, lotPrice: number) {
    await db.priceEntries.add({ itemId: id, lotSize, lotPrice, recordedAt: Date.now() })
  }

  const fmt = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100) / 100}`)
  const fmtDate = (t: number) =>
    new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' +
    new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
</script>

<div class="flex items-center gap-3 mb-4">
  <a href="#/prix" class="btn btn-ghost btn-sm">←</a>
  <ItemAvatar imageUrl={item.value?.imageUrl} name={item.value?.name ?? '…'} size={44} />
  <div>
    <h1 class="text-2xl font-bold">{item.value?.name ?? `item ${itemId}`}</h1>
    {#if reference !== null}
      <p class="text-sm text-base-content/60">
        Référence (médiane récente) : <span class="font-mono">{fmt(reference)} k/u</span>
      </p>
    {/if}
  </div>
</div>

<div class="card bg-base-100 shadow-sm mb-4">
  <div class="card-body py-4">
    <PriceEntryForm onAdd={addEntry} />
  </div>
</div>

{#if div.spreadPct !== null}
  <div
    class="alert {div.spreadPct >= 20 ? 'alert-success' : 'alert-info'} mb-4 text-sm"
    role="status"
  >
    Écart entre tailles de lot : <strong>{Math.round(div.spreadPct)} %</strong>
    {#if div.spreadPct >= 20}
      — opportunité d'achat/revente entre catégories !
    {/if}
    <span class="font-mono text-xs">
      {LOT_SIZES.filter((s) => div.byLot[s] !== null)
        .map((s) => `×${s}: ${fmt(div.byLot[s])} k/u`)
        .join(' · ')}
    </span>
  </div>
{/if}

{#if stats.length > 0}
  <div class="stats stats-vertical sm:stats-horizontal shadow-sm bg-base-100 w-full mb-4">
    {#each stats as s (s.size)}
      <div class="stat">
        <div class="stat-title">Lot ×{s.size} — unitaire</div>
        <div class="stat-value text-lg font-mono">{fmt(s.median)} k</div>
        <div class="stat-desc">
          méd. · moy. {fmt(s.mean)} · dernier {fmt(s.last)} · {s.count} relevé(s)
        </div>
      </div>
    {/each}
  </div>
{/if}

<div class="card bg-base-100 shadow-sm mb-4">
  <div class="card-body py-4">
    <div class="flex items-center justify-between">
      <h2 class="font-semibold">Évolution</h2>
      <div class="join">
        <button
          class="btn btn-xs join-item {view === 'unit' ? 'btn-primary' : ''}"
          onclick={() => (view = 'unit')}
        >
          k/unité
        </button>
        <button
          class="btn btn-xs join-item {view === 'lot' ? 'btn-primary' : ''}"
          onclick={() => (view = 'lot')}
        >
          k/lot
        </button>
      </div>
    </div>
    <LineChart series={chartSeries} />
  </div>
</div>

{#if history.length > 0}
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body py-4">
      <h2 class="font-semibold">Historique</h2>
      <table class="table table-sm">
        <thead>
          <tr><th>Date</th><th>Lot</th><th class="text-right">Prix lot</th><th class="text-right">k/u</th><th></th></tr>
        </thead>
        <tbody>
          {#each history as e (e.id)}
            <tr>
              <td class="text-xs">{fmtDate(e.recordedAt)}</td>
              <td>×{e.lotSize}</td>
              <td class="text-right font-mono">{e.lotPrice}</td>
              <td class="text-right font-mono">{fmt(e.lotPrice / e.lotSize)}</td>
              <td class="text-right">
                <button
                  class="btn btn-ghost btn-xs text-error"
                  onclick={() => db.priceEntries.delete(e.id!)}
                  aria-label="Supprimer le relevé"
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
