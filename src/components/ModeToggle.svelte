<script lang="ts">
  let {
    mode,
    onchange,
  }: { mode: 'craft' | 'buy'; onchange: (m: 'craft' | 'buy') => void } = $props()
</script>

<div class="join" role="group" aria-label="Mode d'obtention">
  <button
    class="btn join-item h-11 px-3 {mode === 'craft' ? 'btn-primary' : 'btn-ghost'}"
    onclick={() => onchange('craft')}
    aria-pressed={mode === 'craft'}
  >
    🔨 À crafter
  </button>
  <button
    class="btn join-item h-11 px-3 {mode === 'buy' ? 'btn-secondary' : 'btn-ghost'}"
    onclick={() => onchange('buy')}
    aria-pressed={mode === 'buy'}
  >
    🛒 À acheter
  </button>
</div>
