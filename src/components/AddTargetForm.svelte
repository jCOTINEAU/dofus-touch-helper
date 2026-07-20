<script lang="ts">
  import { isEncyclopediaItemUrl } from '../lib/fetch/url'

  let { onAdd, disabled = false }: { onAdd: (url: string, qty: number) => void; disabled?: boolean } =
    $props()

  let url = $state('')
  let qty = $state(1)

  const valid = $derived(isEncyclopediaItemUrl(url))

  function submit(e: SubmitEvent) {
    e.preventDefault()
    if (!valid) return
    onAdd(url.trim(), Math.max(1, qty))
    url = ''
    qty = 1
  }
</script>

<form class="flex gap-2 flex-wrap" onsubmit={submit}>
  <input
    type="url"
    class="input input-bordered flex-1 min-w-60"
    placeholder="Coller l'URL d'un objet ou d'une panoplie…"
    bind:value={url}
    {disabled}
  />
  <input
    type="number"
    class="input input-bordered w-20"
    min="1"
    inputmode="numeric"
    bind:value={qty}
    {disabled}
    aria-label="Quantité"
  />
  <button class="btn btn-primary" type="submit" disabled={disabled || !valid}>Ajouter</button>
</form>
{#if url !== '' && !valid}
  <p class="text-xs text-error mt-1">
    URL invalide — attendu : https://www.dofus-touch.com/fr/mmorpg/encyclopedie/…
  </p>
{/if}
