<script lang="ts">
  import type { FarmAdvice } from '../lib/combats/farming'
  import { formatDuration, formatKamas } from '../lib/prices/format'

  let { advice }: { advice: FarmAdvice } = $props()

  const rate = $derived(
    advice.source.unitsPerHour === null
      ? null
      : Math.round(advice.source.unitsPerHour * 10) / 10,
  )
</script>

<div class="text-xs text-base-content/60">
  🗡 <a href={`#/combats/${advice.source.combatId}`} class="link-hover font-medium">
    {advice.source.combatName}
  </a>
  {#if rate !== null}
    (~{rate}/h)
    {#if advice.farmSeconds !== null}
      → ≈ <span class="font-mono">{formatDuration(advice.farmSeconds)}</span> de farm
    {/if}
  {:else}
    <span class="text-warning">(durée du combat à renseigner)</span>
  {/if}
  {#if advice.verdict !== null}
    ·
    {#if advice.verdict === 'farm'}
      <span class="font-semibold text-accent">plutôt farmer ✓</span>
    {:else}
      <span class="font-semibold text-accent">plutôt acheter 💰</span>
    {/if}
    <span class="text-base-content/40">
      (éq. {formatKamas(advice.equivalentKamasPerHour!)}/h vs meilleur farm
      {formatKamas(advice.referenceKamasPerHour!)}/h)
    </span>
  {/if}
</div>
