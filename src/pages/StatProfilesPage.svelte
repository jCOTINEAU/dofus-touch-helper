<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import {
    STAT_KEYS,
    STAT_LABELS,
    emptyStats,
    normalizeStats,
    type StatKey,
    type StatProfile,
  } from '../lib/damage/stats'
  import EmptyState from '../components/EmptyState.svelte'

  const rawProfiles = useLiveQuery<StatProfile[]>(() => db.statProfiles.toArray(), [])
  // Complète les stats (nouvelles caractéristiques éventuelles) à l'affichage.
  const profiles = $derived(
    rawProfiles.value.map((p) => ({ ...p, stats: normalizeStats(p.stats) })),
  )

  let newName = $state('')

  async function create(e: SubmitEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (name === '') return
    await db.statProfiles.add({ name, stats: emptyStats() })
    newName = ''
  }

  async function rename(id: number, name: string) {
    await db.statProfiles.update(id, { name: name.trim() || 'Sans nom' })
  }

  async function setStat(profile: StatProfile, key: StatKey, value: number) {
    const stats = { ...normalizeStats(profile.stats), [key]: Math.max(0, Math.floor(value) || 0) }
    await db.statProfiles.update(profile.id!, { stats })
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Supprimer le profil « ${name} » ?`)) return
    await db.statProfiles.delete(id)
  }
</script>

<h1 class="text-2xl font-bold mb-1">Profils de stats</h1>
<p class="text-sm text-base-content/60 mb-4">
  Un profil = un jeu de caractéristiques (utilisé plus tard pour le calcul de dégâts).
</p>

<form class="flex gap-2 mb-6" onsubmit={create}>
  <input
    class="input input-bordered flex-1"
    placeholder="Nom du profil (ex: Iop full force)"
    bind:value={newName}
  />
  <button class="btn btn-primary" type="submit" disabled={newName.trim() === ''}>Créer</button>
</form>

{#if profiles.length === 0}
  <EmptyState
    message="Aucun profil de stats."
    hint="Crée un profil puis renseigne ses caractéristiques."
  />
{:else}
  <div class="flex flex-col gap-3">
    {#each profiles as profile (profile.id)}
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body gap-3 py-4">
          <div class="flex items-center gap-2">
            <input
              class="input input-bordered input-sm flex-1 font-semibold"
              value={profile.name}
              onchange={(e) => rename(profile.id!, e.currentTarget.value)}
              aria-label="Nom du profil"
            />
            <button
              class="btn btn-ghost btn-sm text-error"
              onclick={() => remove(profile.id!, profile.name)}
              aria-label="Supprimer"
            >
              ✕
            </button>
          </div>
          <div class="flex flex-wrap gap-3">
            {#each STAT_KEYS as key (key)}
              <label class="flex flex-col gap-0.5">
                <span class="text-[11px] font-medium uppercase tracking-wide text-base-content/50">
                  {STAT_LABELS[key]}
                </span>
                <input
                  type="number"
                  class="input input-bordered h-11 w-24 text-center font-mono"
                  inputmode="numeric"
                  min="0"
                  value={profile.stats[key]}
                  onchange={(e) => setStat(profile, key, Number(e.currentTarget.value))}
                  aria-label={STAT_LABELS[key]}
                />
              </label>
            {/each}
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}
