<script lang="ts">
  /**
   * Sélecteur de monstres pour « Préparer combat » : recherche par nom,
   * rangée « récents » quand la recherche est vide, puis sections par
   * famille. Tap sur une icône = +1 (les frères non importés sont fetchés
   * à la volée). Les monstres masqués sont exclus.
   */
  import { getOrFetchMonster } from '../lib/fetch/monsterLoader'
  import { isEncyclopediaItemUrl } from '../lib/fetch/url'
  import { recentMonsters } from '../lib/stores/recentMonsters.svelte'
  import type { CachedMonster } from '../lib/types'
  import ItemAvatar from './ItemAvatar.svelte'

  interface Props {
    monsters: CachedMonster[]
    counts: Map<number, number>
    onAdd: (monsterId: number, delta: number) => void
  }
  let { monsters, counts, onAdd }: Props = $props()

  let search = $state('')
  let importingId = $state<number | null>(null)
  let importUrl = $state('')
  let importError = $state('')

  const visible = $derived(monsters.filter((m) => !m.hidden))
  const byId = $derived(new Map(visible.map((m) => [m.id, m])))

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase()
    return q ? visible.filter((m) => m.name.toLowerCase().includes(q)) : visible
  })

  const families = $derived.by(() => {
    const map = new Map<string, CachedMonster[]>()
    for (const m of filtered) {
      const key = m.family ?? 'Autres'
      const list = map.get(key) ?? []
      list.push(m)
      map.set(key, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'))
  })

  const recent = $derived(
    recentMonsters.ids.map((id) => byId.get(id)).filter((m): m is CachedMonster => !!m),
  )

  async function tap(m: CachedMonster) {
    if (!m.imported) {
      // Frère : import à la volée avant de l'ajouter.
      importingId = m.id
      try {
        await getOrFetchMonster(m.url)
      } catch (e) {
        importError = `Import impossible (${String(e)})`
        importingId = null
        return
      }
      importingId = null
    }
    recentMonsters.push(m.id)
    onAdd(m.id, 1)
  }

  async function importByUrl(e: SubmitEvent) {
    e.preventDefault()
    if (!isEncyclopediaItemUrl(importUrl)) return
    importError = ''
    try {
      const { monster } = await getOrFetchMonster(importUrl.trim())
      importUrl = ''
      recentMonsters.push(monster.id)
      onAdd(monster.id, 1)
    } catch (err) {
      importError = `Import impossible (${String(err)})`
    }
  }
</script>

{#snippet chip(m: CachedMonster)}
  {@const count = counts.get(m.id) ?? 0}
  <div class="relative">
    <button
      class="flex w-20 flex-col items-center gap-1 rounded-box border p-1 text-center touch-manipulation
        {count > 0 ? 'border-primary bg-primary/10' : 'border-base-300'}
        {m.imported ? '' : 'opacity-70'}"
      onclick={() => tap(m)}
      disabled={importingId === m.id}
    >
      {#if importingId === m.id}
        <span class="loading loading-spinner loading-sm my-2"></span>
      {:else}
        <ItemAvatar imageUrl={m.imageUrl} name={m.name} size={36} />
      {/if}
      <span class="line-clamp-2 text-[11px] leading-tight">
        {m.name}{m.imported ? '' : ' ↓'}
      </span>
    </button>
    {#if count > 0}
      <span class="badge badge-primary badge-sm absolute -right-1 -top-1">{count}</span>
      <button
        class="btn btn-circle btn-xs absolute -left-1 -top-1"
        onclick={() => onAdd(m.id, -1)}
        aria-label="Retirer un {m.name}">−</button
      >
    {/if}
  </div>
{/snippet}

<div class="flex flex-col gap-2">
  <input
    type="search"
    class="input input-bordered input-sm w-full"
    placeholder="Filtrer par nom…"
    bind:value={search}
  />

  {#if importError}<p class="text-xs text-error">{importError}</p>{/if}

  {#if search.trim() === '' && recent.length > 0}
    <div>
      <div class="text-xs font-semibold uppercase text-base-content/50">Récents</div>
      <div class="flex flex-wrap gap-2 pt-1">
        {#each recent as m (m.id)}{@render chip(m)}{/each}
      </div>
    </div>
  {/if}

  {#if visible.length === 0}
    <p class="text-sm text-base-content/50">
      Aucun monstre. Colle l'URL d'un monstre ci-dessous pour l'importer.
    </p>
  {/if}

  {#each families as [family, list] (family)}
    <div>
      <div class="text-xs font-semibold uppercase text-base-content/50">{family}</div>
      <div class="flex flex-wrap gap-2 pt-1">
        {#each list as m (m.id)}{@render chip(m)}{/each}
      </div>
    </div>
  {/each}

  <form class="flex gap-2 pt-1" onsubmit={importByUrl}>
    <input
      type="url"
      class="input input-bordered input-sm flex-1"
      placeholder="+ importer un monstre par URL…"
      bind:value={importUrl}
    />
    <button class="btn btn-sm" type="submit" disabled={!isEncyclopediaItemUrl(importUrl)}>+</button>
  </form>
</div>
