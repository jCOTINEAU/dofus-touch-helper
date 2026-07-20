<script lang="ts">
  import { isEncyclopediaItemUrl } from '../lib/fetch/url'
  import NameSearch from './NameSearch.svelte'
  import type { IndexEntry } from '../lib/data/encyclopediaIndex'

  let { onAdd, disabled = false }: { onAdd: (url: string, qty: number) => void; disabled?: boolean } =
    $props()

  let url = $state('')
  let qty = $state(1)
  let picked = $state<IndexEntry | null>(null)
  let byUrl = $state(false) // repli : saisie manuelle par URL

  const valid = $derived(isEncyclopediaItemUrl(url))

  function selectName(entry: IndexEntry) {
    picked = entry
    url = entry.url
  }

  function submit(e: SubmitEvent) {
    e.preventDefault()
    if (!valid) return
    onAdd(url.trim(), Math.max(1, qty))
    url = ''
    qty = 1
    picked = null
  }
</script>

<form class="flex flex-col gap-2" onsubmit={submit}>
  {#if !byUrl}
    <NameSearch
      types={['equipements', 'armes', 'ressources', 'consommables', 'panoplies']}
      placeholder="Chercher un objet ou une panoplie par nom…"
      onSelect={selectName}
      {disabled}
    />
  {:else}
    <input
      type="url"
      class="input input-bordered w-full"
      placeholder="Coller l'URL d'un objet ou d'une panoplie…"
      bind:value={url}
      {disabled}
    />
    {#if url !== '' && !valid}
      <p class="text-xs text-error">URL invalide (dofus-touch.com/…/encyclopedie/…)</p>
    {/if}
  {/if}

  <div class="flex flex-wrap items-center gap-2">
    {#if picked}
      <span class="badge badge-primary badge-lg gap-1">
        {picked.name}
        <button type="button" onclick={() => { picked = null; url = '' }} aria-label="Effacer">✕</button>
      </span>
    {/if}
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
    <button
      type="button"
      class="btn btn-ghost btn-sm ml-auto"
      onclick={() => { byUrl = !byUrl; picked = null; url = '' }}
    >
      {byUrl ? 'par nom' : 'par URL'}
    </button>
  </div>
</form>
