<script lang="ts">
  /**
   * Chart de lignes SVG minimaliste (zéro dépendance) : plusieurs séries
   * temporelles, points cliquables (tap iPad) affichant la valeur.
   */
  export interface ChartSeries {
    label: string
    color: string
    points: { t: number; v: number }[]
  }

  let { series, height = 220 }: { series: ChartSeries[]; height?: number } = $props()

  const PAD = { top: 12, right: 12, bottom: 24, left: 46 }
  const W = 640

  const all = $derived(series.flatMap((s) => s.points))
  const tMin = $derived(Math.min(...all.map((p) => p.t)))
  const tMax = $derived(Math.max(...all.map((p) => p.t)))
  const vMax = $derived(Math.max(...all.map((p) => p.v)))
  const vMin = $derived(Math.min(0, ...all.map((p) => p.v)))

  const x = $derived((t: number) =>
    tMax === tMin
      ? (W + PAD.left - PAD.right) / 2
      : PAD.left + ((t - tMin) / (tMax - tMin)) * (W - PAD.left - PAD.right),
  )
  const y = $derived((v: number) =>
    vMax === vMin
      ? height / 2
      : height - PAD.bottom - ((v - vMin) / (vMax - vMin)) * (height - PAD.top - PAD.bottom),
  )

  const yTicks = $derived.by(() => {
    if (all.length === 0) return []
    const step = (vMax - vMin) / 4 || 1
    return [0, 1, 2, 3, 4].map((i) => vMin + i * step)
  })

  const fmtDate = (t: number) =>
    new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  const fmtVal = (v: number) =>
    v >= 10000 ? `${Math.round(v / 1000)}k` : String(Math.round(v * 100) / 100)

  let selected = $state<{ label: string; t: number; v: number } | null>(null)
</script>

{#if all.length === 0}
  <p class="text-sm text-base-content/50 text-center py-6">Pas encore de relevé.</p>
{:else}
  <div class="overflow-x-auto">
    <svg viewBox="0 0 {W} {height}" class="w-full min-w-100" role="img" aria-label="Courbe des prix">
      {#each yTicks as tick (tick)}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(tick)}
          y2={y(tick)}
          class="stroke-base-300"
          stroke-dasharray="3 3"
        />
        <text x={PAD.left - 6} y={y(tick) + 4} text-anchor="end" class="fill-base-content/50 text-[11px]">
          {fmtVal(tick)}
        </text>
      {/each}
      <text x={PAD.left} y={height - 6} class="fill-base-content/50 text-[11px]">{fmtDate(tMin)}</text>
      <text x={W - PAD.right} y={height - 6} text-anchor="end" class="fill-base-content/50 text-[11px]">
        {fmtDate(tMax)}
      </text>

      {#each series as s (s.label)}
        {#if s.points.length > 1}
          <polyline
            fill="none"
            stroke={s.color}
            stroke-width="2"
            points={s.points.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')}
          />
        {/if}
        {#each s.points as p (p.t)}
          <circle
            cx={x(p.t)}
            cy={y(p.v)}
            r="5"
            fill={s.color}
            role="button"
            tabindex="0"
            onclick={() => (selected = { label: s.label, t: p.t, v: p.v })}
            onkeydown={(e) => e.key === 'Enter' && (selected = { label: s.label, t: p.t, v: p.v })}
          />
        {/each}
      {/each}
    </svg>
  </div>
  <div class="flex items-center gap-4 flex-wrap mt-1">
    {#each series as s (s.label)}
      {#if s.points.length > 0}
        <span class="flex items-center gap-1 text-xs">
          <span class="w-3 h-3 rounded-full inline-block" style="background: {s.color}"></span>
          {s.label}
        </span>
      {/if}
    {/each}
    {#if selected}
      <span class="text-xs font-mono ml-auto">
        {selected.label} · {fmtDate(selected.t)} · {fmtVal(selected.v)} k
      </span>
    {/if}
  </div>
{/if}
