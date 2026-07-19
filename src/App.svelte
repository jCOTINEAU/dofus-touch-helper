<script lang="ts">
  import { router } from './lib/router.svelte'
  import ProjectsPage from './pages/ProjectsPage.svelte'
  import ProjectDetailPage from './pages/ProjectDetailPage.svelte'
  import ShoppingListPage from './pages/ShoppingListPage.svelte'
  import PricesPage from './pages/PricesPage.svelte'
  import PriceDetailPage from './pages/PriceDetailPage.svelte'
  import CombatsPage from './pages/CombatsPage.svelte'
  import CombatDetailPage from './pages/CombatDetailPage.svelte'
  import FarmSessionPage from './pages/FarmSessionPage.svelte'
  import FarmHistoryPage from './pages/FarmHistoryPage.svelte'
  import MonstersHidePage from './pages/MonstersHidePage.svelte'
  import SettingsPage from './pages/SettingsPage.svelte'
  import PriceSessionPage from './pages/PriceSessionPage.svelte'
  import DebugPage from './pages/DebugPage.svelte'
  import { swUpdate } from './lib/stores/swUpdate.svelte'
  import { lastProject } from './lib/stores/lastProject.svelte'
  import { farmSession } from './lib/stores/farmSession.svelte'

  const route = $derived(router.route)

  // Restaure la position de scroll au changement de route (retour arrière) ou
  // remonte en haut sur une nouvelle page. La liste étant remplie de façon
  // asynchrone (Dexie), on réessaie sur quelques frames jusqu'à atteindre la
  // cible ou expiration.
  let restoreToken = 0
  $effect(() => {
    void route.name // dépendance : ré-exécute à chaque navigation
    void route.params.id
    void route.params.itemId
    const target = router.savedScroll()
    const myToken = ++restoreToken
    if (target <= 0) {
      window.scrollTo(0, 0)
      return
    }
    // La page se remplit de façon asynchrone (Dexie) et sa hauteur grandit :
    // on ré-applique la cible à chaque frame pendant ~2,5 s, en s'arrêtant dès
    // qu'elle est atteinte (ou si l'utilisateur scrolle lui-même).
    let startTs = 0
    let lastY = -1
    const step = (ts: number) => {
      if (myToken !== restoreToken) return
      if (startTs === 0) startTs = ts
      // L'utilisateur a pris la main : on arrête pour ne pas le contrarier.
      if (lastY >= 0 && Math.abs(window.scrollY - lastY) > 4 && Math.abs(window.scrollY - target) > 4) {
        return
      }
      window.scrollTo(0, target)
      lastY = window.scrollY
      if (Math.abs(window.scrollY - target) > 2 && ts - startTs < 2500) {
        requestAnimationFrame(step)
      }
    }
    requestAnimationFrame(step)
  })

  // « Projets » ramène au dernier projet consulté ; la flèche ← du projet
  // ramène à la liste pour en changer.
  const projetsHash = $derived(
    lastProject.value !== null ? `#/projets/${lastProject.value}` : '#/',
  )
  const navItems = $derived([
    { hash: projetsHash, name: 'projets', label: 'Projets', match: ['projets', 'projet'] },
    { hash: '#/courses', name: 'courses', label: 'Courses', match: ['courses'] },
    { hash: '#/prix', name: 'prix', label: 'Prix', match: ['prix', 'prixDetail', 'prixSession'] },
    {
      hash: '#/combats',
      name: 'combats',
      label: 'Combats',
      match: ['combats', 'combatDetail', 'farmSession', 'farmHistory', 'monstersHide'],
    },
    { hash: '#/reglages', name: 'reglages', label: 'Réglages', match: ['reglages'] },
  ])
</script>

<div class="min-h-screen bg-base-200 pb-24">
  <header class="navbar bg-base-100 pt-safe shadow-sm">
    <span class="text-lg font-bold px-2">Dofus Touch Craft</span>
  </header>

  {#if farmSession.active && route.name !== 'farmSession'}
    <a
      href="#/combats/session"
      class="flex items-center justify-center gap-2 bg-primary py-2 text-sm font-semibold text-primary-content"
    >
      ⏱ Session de farm en cours{farmSession.paused ? ' (en pause)' : ''} — Reprendre →
    </a>
  {/if}

  <main class="p-4 max-w-3xl mx-auto">
    {#if route.name === 'projets'}
      <ProjectsPage />
    {:else if route.name === 'projet'}
      {#key route.params.id}
        <ProjectDetailPage projectId={route.params.id} />
      {/key}
    {:else if route.name === 'courses'}
      <ShoppingListPage />
    {:else if route.name === 'prix'}
      <PricesPage />
    {:else if route.name === 'prixSession'}
      <PriceSessionPage />
    {:else if route.name === 'prixDetail'}
      {#key route.params.itemId}
        <PriceDetailPage itemId={route.params.itemId} />
      {/key}
    {:else if route.name === 'combats'}
      <CombatsPage />
    {:else if route.name === 'farmSession'}
      <FarmSessionPage />
    {:else if route.name === 'farmHistory'}
      <FarmHistoryPage />
    {:else if route.name === 'monstersHide'}
      <MonstersHidePage />
    {:else if route.name === 'combatDetail'}
      {#key route.params.id}
        <CombatDetailPage combatId={route.params.id} />
      {/key}
    {:else if route.name === 'reglages'}
      <SettingsPage />
    {:else if route.name === 'debug'}
      <DebugPage />
    {/if}
  </main>

  {#if swUpdate.needRefresh}
    <div class="toast toast-center z-50" style="bottom: 6rem">
      <div class="alert alert-info">
        <span>Nouvelle version disponible.</span>
        <button class="btn btn-sm btn-primary" onclick={() => swUpdate.reload()}>Recharger</button>
        <button class="btn btn-sm btn-ghost" onclick={() => swUpdate.dismiss()}>Plus tard</button>
      </div>
    </div>
  {/if}

  <nav class="dock dock-lg bg-base-100 pb-safe">
    {#each navItems as item (item.name)}
      <a href={item.hash} class:dock-active={item.match.includes(route.name)}>
        <span class="dock-label">{item.label}</span>
      </a>
    {/each}
  </nav>
</div>
