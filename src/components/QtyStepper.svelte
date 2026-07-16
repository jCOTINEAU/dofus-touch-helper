<script lang="ts">
  let {
    value,
    onchange,
    label = 'Possédé',
    showLabel = false,
  }: {
    value: number
    onchange: (v: number) => void
    label?: string
    showLabel?: boolean
  } = $props()

  let text = $derived(String(value))

  function commit(raw: string) {
    const n = Math.max(0, Math.floor(Number(raw)))
    onchange(Number.isFinite(n) ? n : 0)
  }
</script>

<div class="flex flex-col items-start gap-0.5">
  {#if showLabel}
    <span class="text-[11px] font-medium tracking-wide text-base-content/50 uppercase">
      {label}
    </span>
  {/if}
  <div class="join" aria-label={label}>
    <button
      class="btn btn-square join-item h-11 w-11 text-lg"
      onclick={() => onchange(Math.max(0, value - 1))}
      disabled={value <= 0}
      aria-label="Moins"
    >
      −
    </button>
    <input
      class="input input-bordered join-item h-11 w-14 text-center text-base font-semibold"
      inputmode="numeric"
      pattern="[0-9]*"
      value={text}
      onchange={(e) => commit(e.currentTarget.value)}
      aria-label={label}
    />
    <button
      class="btn btn-square join-item h-11 w-11 text-lg"
      onclick={() => onchange(value + 1)}
      aria-label="Plus"
    >
      +
    </button>
  </div>
</div>
