<script lang="ts">
  let {
    value,
    onchange,
    label = 'Possédé',
  }: { value: number; onchange: (v: number) => void; label?: string } = $props()

  let text = $derived(String(value))

  function commit(raw: string) {
    const n = Math.max(0, Math.floor(Number(raw)))
    onchange(Number.isFinite(n) ? n : 0)
  }
</script>

<div class="join" aria-label={label}>
  <button
    class="btn btn-square join-item"
    onclick={() => onchange(Math.max(0, value - 1))}
    disabled={value <= 0}
    aria-label="Moins"
  >
    −
  </button>
  <input
    class="input input-bordered join-item w-16 text-center"
    inputmode="numeric"
    pattern="[0-9]*"
    value={text}
    onchange={(e) => commit(e.currentTarget.value)}
    aria-label={label}
  />
  <button class="btn btn-square join-item" onclick={() => onchange(value + 1)} aria-label="Plus">
    +
  </button>
</div>
