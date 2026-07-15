<script lang="ts">
  import { expandCraftTree, type ExpandProgress } from '../lib/fetch/expand'
  import { loadCatalog } from '../lib/db/repo'
  import { computeNeeds } from '../lib/needs/needs'
  import { buildDisplayTree } from '../lib/needs/tree'
  import { isEncyclopediaItemUrl } from '../lib/fetch/url'

  let url = $state('')
  let running = $state(false)
  let progress = $state<ExpandProgress | null>(null)
  let output = $state('')
  let error = $state('')
  let abort: AbortController | null = null

  async function run() {
    if (!isEncyclopediaItemUrl(url)) {
      error = 'URL encyclopédie Dofus Touch invalide'
      return
    }
    error = ''
    output = ''
    running = true
    abort = new AbortController()
    try {
      const result = await expandCraftTree(url.trim(), {
        signal: abort.signal,
        onProgress: (p) => (progress = { ...p }),
      })
      const catalog = await loadCatalog()
      const needs = computeNeeds(catalog, [{ itemId: result.rootId, qty: 1 }], new Map())
      const tree = buildDisplayTree(catalog, [{ itemId: result.rootId, qty: 1 }])
      output = JSON.stringify(
        {
          result,
          shopping: needs.shopping.map((s) => ({
            ...s,
            name: catalog.get(s.itemId)?.name,
          })),
          warnings: needs.warnings,
          tree,
        },
        null,
        2,
      )
    } catch (e) {
      error = String(e)
    } finally {
      running = false
      abort = null
    }
  }
</script>

<h1 class="text-2xl font-bold mb-4">Debug — expansion d'arbre</h1>

<div class="card bg-base-100 shadow-sm">
  <div class="card-body gap-4">
    <input
      type="url"
      class="input input-bordered w-full"
      placeholder="https://www.dofus-touch.com/fr/mmorpg/encyclopedie/…"
      bind:value={url}
      disabled={running}
    />
    <div class="flex gap-2">
      <button class="btn btn-primary" onclick={run} disabled={running || url === ''}>
        {running ? 'Expansion…' : 'Expanser'}
      </button>
      {#if running}
        <button class="btn btn-ghost" onclick={() => abort?.abort()}>Annuler</button>
      {/if}
    </div>
    {#if progress && running}
      <div>
        <progress class="progress progress-primary w-full" value={progress.done} max={progress.discovered}
        ></progress>
        <p class="text-sm text-base-content/60">
          {progress.done}/{progress.discovered} pages (cache : {progress.fromCache})
          {progress.currentName ? `— ${progress.currentName}` : ''}
        </p>
      </div>
    {/if}
    {#if error}
      <div class="alert alert-error">{error}</div>
    {/if}
    {#if output}
      <pre class="bg-base-200 p-3 rounded-box text-xs overflow-x-auto max-h-160">{output}</pre>
    {/if}
  </div>
</div>
