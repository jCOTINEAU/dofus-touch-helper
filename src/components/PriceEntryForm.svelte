<script lang="ts">
  import { LOT_SIZES, type LotSize } from '../lib/prices/stats'
  import { formatKamas } from '../lib/prices/format'
  import NumPad from './NumPad.svelte'

  let {
    onAdd,
    lastLotPrice,
  }: {
    onAdd: (lotSize: LotSize, lotPrice: number) => void
    /** Dernier prix connu d'un lot (pour l'indice sous la saisie). */
    lastLotPrice?: (lot: LotSize) => number | null
  } = $props()

  let lotSize = $state<LotSize>(1)
  let typed = $state('')

  const valid = $derived(Number(typed) > 0)
  const lastKnown = $derived(lastLotPrice ? lastLotPrice(lotSize) : null)

  function commit() {
    if (!valid) return
    onAdd(lotSize, Number(typed))
    typed = ''
  }
</script>

<div class="flex flex-col gap-3">
  <div class="join self-start">
    {#each LOT_SIZES as size (size)}
      <button
        type="button"
        class="btn join-item h-11 {lotSize === size ? 'btn-primary' : ''}"
        onclick={() => (lotSize = size)}
      >
        ×{size}
      </button>
    {/each}
  </div>

  <div class="flex items-center justify-between rounded-box bg-base-200 px-4 py-3">
    <div class="text-sm text-base-content/60">
      Prix du lot ×{lotSize}
      {#if lastKnown !== null}
        <span class="block text-xs text-base-content/40">dernier : {formatKamas(lastKnown)}</span>
      {/if}
    </div>
    <span class="font-mono text-2xl font-bold">
      {typed === '' ? '—' : Number(typed).toLocaleString('fr-FR')}
      <span class="text-base text-base-content/50">k</span>
    </span>
  </div>

  <NumPad
    onDigit={(d) => (typed = (typed + d).slice(0, 9))}
    onErase={() => (typed = typed.slice(0, -1))}
    onOk={commit}
    okLabel="Relever"
    okDisabled={!valid}
  />
</div>
