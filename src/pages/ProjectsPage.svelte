<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import { router } from '../lib/router.svelte'
  import { lastProject } from '../lib/stores/lastProject.svelte'
  import EmptyState from '../components/EmptyState.svelte'

  const projects = useLiveQuery(() => db.projects.toArray(), [])
  const targetCounts = useLiveQuery(async () => {
    const targets = await db.projectTargets.toArray()
    const counts = new Map<number, number>()
    for (const t of targets) counts.set(t.projectId, (counts.get(t.projectId) ?? 0) + 1)
    return counts
  }, new Map<number, number>())

  let newName = $state('')

  async function create(e: SubmitEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (name === '') return
    const id = await db.projects.add({ name, createdAt: Date.now() })
    newName = ''
    router.go(`projets/${id}`)
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Supprimer le projet « ${name} » ?`)) return
    await db.transaction('rw', [db.projects, db.projectTargets, db.nodeStates], async () => {
      await db.projects.delete(id)
      await db.projectTargets.where({ projectId: id }).delete()
      await db.nodeStates.where({ projectId: id }).delete()
    })
    lastProject.clear(id)
  }
</script>

<h1 class="text-2xl font-bold mb-4">Projets</h1>

<form class="flex gap-2 mb-6" onsubmit={create}>
  <input
    class="input input-bordered flex-1"
    placeholder="Nom du projet (ex: stuff level 50 pour jean-michel)"
    bind:value={newName}
  />
  <button class="btn btn-primary" type="submit" disabled={newName.trim() === ''}>
    Nouveau projet
  </button>
</form>

{#if projects.value.length === 0}
  <EmptyState
    message="Aucun projet pour l'instant."
    hint="Crée un projet puis colle les URL encyclopédie des objets à crafter."
  />
{:else}
  <div class="flex flex-col gap-3">
    {#each projects.value as project (project.id)}
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body flex-row items-center justify-between py-4">
          <a href={`#/projets/${project.id}`} class="flex-1">
            <h2 class="card-title text-base">
              {project.name}
              {#if project.includeInShopping === false}
                <span class="badge badge-ghost badge-sm">hors courses</span>
              {/if}
            </h2>
            <p class="text-sm text-base-content/50">
              {targetCounts.value.get(project.id!) ?? 0} objet(s) cible(s)
            </p>
          </a>
          <button
            class="btn btn-ghost btn-sm text-error"
            onclick={() => remove(project.id!, project.name)}
            aria-label="Supprimer"
          >
            Supprimer
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}
