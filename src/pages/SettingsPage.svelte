<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import { exportBackup, importBackup } from '../lib/db/backup'

  const itemCount = useLiveQuery(() => db.items.count(), 0)

  let persisted = $state<boolean | null>(null)
  let storageText = $state('')
  let message = $state('')
  let fileInput: HTMLInputElement

  $effect(() => {
    navigator.storage?.persisted?.().then((p) => (persisted = p))
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage != null && e.quota != null) {
        storageText = `${Math.round(e.usage / 1024)} Ko utilisés sur ~${Math.round(e.quota / 1024 / 1024)} Mo`
      }
    })
  })

  async function requestPersist() {
    persisted = (await navigator.storage?.persist?.()) ?? false
  }

  async function doExport() {
    const backup = await exportBackup()
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dofus-craft-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    message = 'Export téléchargé — range-le dans Fichiers/iCloud Drive.'
  }

  async function doImport(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    if (!confirm('Importer va REMPLACER toutes les données locales. Continuer ?')) {
      fileInput.value = ''
      return
    }
    try {
      const { counts } = await importBackup(JSON.parse(await file.text()))
      message = `Import réussi : ${Object.entries(counts)
        .filter(([, n]) => n > 0)
        .map(([t, n]) => `${n} ${t}`)
        .join(', ')}`
    } catch (err) {
      message = `Échec de l'import : ${String(err)}`
    }
    fileInput.value = ''
  }

  async function clearItemCache() {
    if (!confirm('Vider le cache encyclopédie ? (les recettes seront re-téléchargées au besoin)'))
      return
    await db.items.clear()
    message = 'Cache encyclopédie vidé.'
  }
</script>

<h1 class="text-2xl font-bold mb-4">Réglages</h1>

{#if message}
  <div class="alert alert-info mb-4 text-sm">{message}</div>
{/if}

<div class="card bg-base-100 shadow-sm mb-4">
  <div class="card-body py-4">
    <h2 class="font-semibold">Stockage</h2>
    <p class="text-sm text-base-content/60">
      Toutes tes données restent dans ce navigateur (IndexedDB). {storageText}
    </p>
    <div class="flex items-center gap-3">
      {#if persisted === true}
        <span class="badge badge-success">Stockage persistant accordé</span>
      {:else if persisted === false}
        <span class="badge badge-warning">Stockage non persistant</span>
        <button class="btn btn-sm" onclick={requestPersist}>Demander la persistance</button>
      {/if}
    </div>
    <p class="text-xs text-base-content/50">
      Sur iPad, installe l'app sur l'écran d'accueil (Partager → « Sur l'écran d'accueil ») :
      le stockage y est dédié et à l'abri du nettoyage automatique de Safari.
    </p>
  </div>
</div>

<div class="card bg-base-100 shadow-sm mb-4">
  <div class="card-body py-4">
    <h2 class="font-semibold">Sauvegarde</h2>
    <p class="text-sm text-base-content/60">
      Exporte un fichier JSON (à ranger dans Fichiers / iCloud Drive, partageable entre
      appareils), ou importe une sauvegarde — l'import <strong>remplace</strong> tout.
    </p>
    <div class="flex gap-2 flex-wrap">
      <button class="btn btn-primary btn-sm" onclick={doExport}>Exporter</button>
      <button class="btn btn-sm" onclick={() => fileInput.click()}>Importer…</button>
      <input
        type="file"
        accept="application/json"
        class="hidden"
        bind:this={fileInput}
        onchange={doImport}
      />
    </div>
  </div>
</div>

<div class="card bg-base-100 shadow-sm mb-4">
  <div class="card-body py-4">
    <h2 class="font-semibold">Cache encyclopédie</h2>
    <p class="text-sm text-base-content/60">
      {itemCount.value} objet(s) en cache. Chaque objet n'est téléchargé qu'une fois depuis
      l'encyclopédie officielle Dofus Touch (via le proxy r.jina.ai).
    </p>
    <div class="flex gap-2">
      <button class="btn btn-sm btn-outline btn-error" onclick={clearItemCache}>
        Vider le cache
      </button>
      <a class="btn btn-sm btn-ghost" href="#/debug">Outil debug</a>
    </div>
  </div>
</div>
