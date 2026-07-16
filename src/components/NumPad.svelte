<script lang="ts">
  /**
   * Pavé numérique intégré : remplace le clavier iOS pendant la session
   * HDV (aucun input natif → aucun problème de focus/viewport, grosses
   * touches fixes en bas d'écran).
   */
  interface Props {
    onDigit: (d: string) => void
    onErase: () => void
    onOk: () => void
    onSkipLot: () => void
    onSkipItem: () => void
    okDisabled?: boolean
  }
  let { onDigit, onErase, onOk, onSkipLot, onSkipItem, okDisabled = false }: Props = $props()

  const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0']
</script>

<div class="flex gap-2">
  <div class="grid flex-1 grid-cols-3 gap-2">
    {#each DIGITS as d (d)}
      <button class="btn h-14 text-xl font-bold" onclick={() => onDigit(d)}>{d}</button>
    {/each}
    <button
      class="btn btn-primary h-14 text-lg"
      onclick={onOk}
      disabled={okDisabled}
      aria-label="Relever ce prix"
    >
      OK ▸
    </button>
  </div>
  <div class="flex w-28 flex-col gap-2">
    <button class="btn h-14 text-xl" onclick={onErase} aria-label="Effacer">⌫</button>
    <button class="btn h-14 text-sm" onclick={onSkipLot}>Passer<br />lot ▸</button>
    <button class="btn h-14 text-sm btn-outline" onclick={onSkipItem}>Ressource<br />suiv. ▸</button>
  </div>
</div>
