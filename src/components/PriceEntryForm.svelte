<script lang="ts">
  import { LOT_SIZES, type LotSize } from '../lib/prices/stats'

  let { onAdd }: { onAdd: (lotSize: LotSize, lotPrice: number) => void } = $props()

  let lotSize = $state<LotSize>(1)
  let price = $state('')

  const valid = $derived(Number(price) > 0)

  function submit(e: SubmitEvent) {
    e.preventDefault()
    if (!valid) return
    onAdd(lotSize, Number(price))
    price = ''
  }
</script>

<form class="flex gap-2 items-center flex-wrap" onsubmit={submit}>
  <div class="join">
    {#each LOT_SIZES as size (size)}
      <button
        type="button"
        class="btn join-item {lotSize === size ? 'btn-primary' : ''}"
        onclick={() => (lotSize = size)}
      >
        ×{size}
      </button>
    {/each}
  </div>
  <label class="input input-bordered flex items-center gap-2 flex-1 min-w-40">
    <input
      type="number"
      class="grow"
      min="1"
      inputmode="numeric"
      placeholder="Prix du lot de {lotSize}"
      bind:value={price}
    />
    <span class="text-base-content/50">k</span>
  </label>
  <button class="btn btn-primary" type="submit" disabled={!valid}>Relever</button>
</form>
