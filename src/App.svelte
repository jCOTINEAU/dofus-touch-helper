<script lang="ts">
  import { router } from './lib/router.svelte'
  import ProjectsPage from './pages/ProjectsPage.svelte'
  import ProjectDetailPage from './pages/ProjectDetailPage.svelte'
  import ShoppingListPage from './pages/ShoppingListPage.svelte'
  import PricesPage from './pages/PricesPage.svelte'
  import PriceDetailPage from './pages/PriceDetailPage.svelte'
  import CombatsPage from './pages/CombatsPage.svelte'
  import CombatDetailPage from './pages/CombatDetailPage.svelte'
  import SettingsPage from './pages/SettingsPage.svelte'

  const route = $derived(router.route)

  const navItems = [
    { hash: '#/', name: 'projets', label: 'Projets', match: ['projets', 'projet'] },
    { hash: '#/courses', name: 'courses', label: 'Courses', match: ['courses'] },
    { hash: '#/prix', name: 'prix', label: 'Prix', match: ['prix', 'prixDetail'] },
    { hash: '#/combats', name: 'combats', label: 'Combats', match: ['combats', 'combatDetail'] },
    { hash: '#/reglages', name: 'reglages', label: 'Réglages', match: ['reglages'] },
  ]
</script>

<div class="min-h-screen bg-base-200 pb-24">
  <header class="navbar bg-base-100 pt-safe shadow-sm">
    <span class="text-lg font-bold px-2">Dofus Touch Craft</span>
  </header>

  <main class="p-4 max-w-3xl mx-auto">
    {#if route.name === 'projets'}
      <ProjectsPage />
    {:else if route.name === 'projet'}
      <ProjectDetailPage projectId={route.params.id} />
    {:else if route.name === 'courses'}
      <ShoppingListPage />
    {:else if route.name === 'prix'}
      <PricesPage />
    {:else if route.name === 'prixDetail'}
      <PriceDetailPage itemId={route.params.itemId} />
    {:else if route.name === 'combats'}
      <CombatsPage />
    {:else if route.name === 'combatDetail'}
      <CombatDetailPage combatId={route.params.id} />
    {:else if route.name === 'reglages'}
      <SettingsPage />
    {/if}
  </main>

  <nav class="dock dock-lg bg-base-100 pb-safe">
    {#each navItems as item (item.name)}
      <a href={item.hash} class:dock-active={item.match.includes(route.name)}>
        <span class="dock-label">{item.label}</span>
      </a>
    {/each}
  </nav>
</div>
