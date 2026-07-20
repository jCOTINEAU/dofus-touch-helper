<script lang="ts">
  /**
   * Recherche par nom dans l'index encyclopédie. Affiche une liste de
   * résultats filtrés ; au clic, appelle onSelect avec l'entrée choisie.
   * Repli : si l'index n'est pas chargé (JSON absent), le champ reste
   * utilisable via l'URL (le parent garde son champ URL).
   */
  import { loadIndex, searchIndex, type IndexEntry } from '../lib/data/encyclopediaIndex'

  interface Props {
    types?: string[]
    placeholder?: string
    onSelect: (entry: IndexEntry) => void
    disabled?: boolean
  }
  let { types, placeholder = 'Chercher par nom…', onSelect, disabled = false }: Props = $props()

  let query = $state('')
  let entries = $state<IndexEntry[]>([])
  let loaded = $state(false)

  $effect(() => {
    loadIndex().then((e) => {
      entries = e
      loaded = true
    })
  })

  const results = $derived(loaded ? searchIndex(entries, query, types, 20) : [])

  function pick(entry: IndexEntry) {
    onSelect(entry)
    query = ''
  }
</script>

<div class="relative">
  <input
    type="search"
    class="input input-bordered w-full"
    {placeholder}
    bind:value={query}
    {disabled}
  />
  {#if query.trim().length >= 2}
    <div class="mt-1 max-h-64 overflow-y-auto rounded-box border border-base-300 bg-base-100">
      {#if results.length === 0}
        <p class="p-3 text-sm text-base-content/50">
          {loaded ? 'Aucun résultat.' : 'Index en cours de chargement…'}
        </p>
      {:else}
        {#each results as e (e.type + e.id)}
          <button
            class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-base-200"
            onclick={() => pick(e)}
          >
            <span class="flex-1">{e.name}</span>
            <span class="badge badge-ghost badge-sm">{e.type.replace(/s$/, '')}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>
