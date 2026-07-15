<script lang="ts">
  let {
    mode,
    onchange,
  }: { mode: 'craft' | 'buy'; onchange: (m: 'craft' | 'buy') => void } = $props()
</script>

<div class="join">
  <button
    class="btn btn-sm join-item {mode === 'craft' ? 'btn-primary' : 'btn-ghost'}"
    onclick={() => onchange('craft')}
  >
    À crafter
  </button>
  <button
    class="btn btn-sm join-item {mode === 'buy' ? 'btn-secondary' : 'btn-ghost'}"
    onclick={() => onchange('buy')}
  >
    À acheter
  </button>
</div>
