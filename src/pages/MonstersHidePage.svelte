<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import ItemAvatar from '../components/ItemAvatar.svelte'
  import EmptyState from '../components/EmptyState.svelte'

  const allMonsters = useLiveQuery(() => db.monsters.toArray(), [])

  let familyFilter = $state<string | null>(null)
  let minLevel = $state('')
  let maxLevel = $state('')

  const families = $derived(
    [...new Set(allMonsters.value.map((m) => m.family ?? 'Autres'))].sort((a, b) =>
      a.localeCompare(b, 'fr'),
    ),
  )

  const filtered = $derived.by(() => {
    const lo = minLevel === '' ? null : Number(minLevel)
    const hi = maxLevel === '' ? null : Number(maxLevel)
    return allMonsters.value
      .filter((m) => {
        if (familyFilter && (m.family ?? 'Autres') !== familyFilter) return false
        // Filtre niveau : garde si la tranche du monstre chevauche [lo, hi].
        if (lo !== null && m.levelMax !== null && m.levelMax < lo) return false
        if (hi !== null && m.levelMin !== null && m.levelMin > hi) return false
        return true
      })
      .sort((a, b) => (a.levelMin ?? 0) - (b.levelMin ?? 0) || a.name.localeCompare(b.name, 'fr'))
  })

  const shownCount = $derived(filtered.filter((m) => !m.hidden).length)

  function setHidden(id: number, hidden: boolean) {
    db.monsters.update(id, { hidden })
  }
  function setAllHidden(hidden: boolean) {
    db.monsters.bulkUpdate(filtered.map((m) => ({ key: m.id, changes: { hidden } })))
  }

  const levelLabel = (m: (typeof allMonsters.value)[number]) =>
    m.levelMin === null ? '—' : m.levelMin === m.levelMax ? `niv ${m.levelMin}` : `niv ${m.levelMin}-${m.levelMax}`
</script>

<div class="flex items-center gap-2 mb-4">
  <a href="#/combats/session" class="btn btn-ghost btn-square text-xl" aria-label="Retour">←</a>
  <h1 class="text-2xl font-bold flex-1">Monstres de la sélection</h1>
</div>

{#if allMonsters.value.length === 0}
  <EmptyState
    message="Aucun monstre importé."
    hint="Importe un monstre depuis un combat ou une session pour le voir ici."
  />
{:else}
  <div class="card bg-base-100 shadow-sm mb-4">
    <div class="card-body gap-3 py-4">
      <p class="text-sm text-base-content/60">
        Décoche un monstre pour l'exclure de la sélection en session. {shownCount}/{filtered.length}
        affiché(s).
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <select class="select select-bordered select-sm" bind:value={familyFilter}>
          <option value={null}>Toutes familles</option>
          {#each families as f (f)}<option value={f}>{f}</option>{/each}
        </select>
        <input
          type="number"
          class="input input-bordered input-sm w-20"
          placeholder="niv min"
          inputmode="numeric"
          bind:value={minLevel}
        />
        <input
          type="number"
          class="input input-bordered input-sm w-20"
          placeholder="niv max"
          inputmode="numeric"
          bind:value={maxLevel}
        />
        <div class="join">
          <button class="btn btn-sm join-item" onclick={() => setAllHidden(false)}>Tout cocher</button>
          <button class="btn btn-sm join-item" onclick={() => setAllHidden(true)}>Tout décocher</button>
        </div>
      </div>

      <div class="flex flex-col divide-y divide-base-200">
        {#each filtered as m (m.id)}
          <label class="flex min-h-11 cursor-pointer items-center gap-3 py-1.5">
            <input
              type="checkbox"
              class="checkbox checkbox-primary"
              checked={!m.hidden}
              onchange={(e) => setHidden(m.id, !e.currentTarget.checked)}
            />
            <ItemAvatar imageUrl={m.imageUrl} name={m.name} size={28} />
            <span class="flex-1">
              {m.name}
              {#if !m.imported}<span class="badge badge-ghost badge-sm">non importé</span>{/if}
            </span>
            <span class="text-xs text-base-content/40">{levelLabel(m)}</span>
          </label>
        {/each}
      </div>
    </div>
  </div>
{/if}
