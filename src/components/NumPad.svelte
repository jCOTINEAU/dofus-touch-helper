<script lang="ts">
  /**
   * Pavé numérique intégré : remplace le clavier iOS pour la saisie des prix
   * (aucun input natif → aucun problème de focus/viewport, grosses touches
   * fixes). Les boutons « passer » sont optionnels (utilisés en session HDV,
   * masqués sur la fiche d'une ressource).
   */
  interface Props {
    onDigit: (d: string) => void
    onErase: () => void
    onOk: () => void
    okLabel?: string
    okDisabled?: boolean
    onSkipLot?: () => void
    onSkipItem?: () => void
  }
  let {
    onDigit,
    onErase,
    onOk,
    okLabel = 'OK ▸',
    okDisabled = false,
    onSkipLot,
    onSkipItem,
  }: Props = $props()

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
      aria-label="Valider ce prix"
    >
      {okLabel}
    </button>
  </div>
  <div class="flex w-28 flex-col gap-2">
    <button
      class="btn text-xl {onSkipLot || onSkipItem ? 'h-14' : 'flex-1'}"
      onclick={onErase}
      aria-label="Effacer"
    >
      ⌫
    </button>
    {#if onSkipLot}
      <button class="btn h-14 text-sm" onclick={onSkipLot}>Passer<br />lot ▸</button>
    {/if}
    {#if onSkipItem}
      <button class="btn h-14 text-sm btn-outline" onclick={onSkipItem}>
        Ressource<br />suiv. ▸
      </button>
    {/if}
  </div>
</div>
