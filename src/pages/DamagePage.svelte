<script lang="ts">
  import StatProfilesPage from './StatProfilesPage.svelte'
  import SpellsPage from './SpellsPage.svelte'
  import CalcPage from './CalcPage.svelte'

  // Section « Dégâts » : onglets Profils | Sorts | Calcul.
  let tab = $state<'profils' | 'sorts' | 'calcul'>('profils')
</script>

<div role="tablist" class="tabs tabs-box mb-4">
  <button
    role="tab"
    class="tab {tab === 'profils' ? 'tab-active' : ''}"
    onclick={() => (tab = 'profils')}
  >
    Profils
  </button>
  <button
    role="tab"
    class="tab {tab === 'sorts' ? 'tab-active' : ''}"
    onclick={() => (tab = 'sorts')}
  >
    Sorts
  </button>
  <button
    role="tab"
    class="tab {tab === 'calcul' ? 'tab-active' : ''}"
    onclick={() => (tab = 'calcul')}
  >
    Calcul
  </button>
</div>

{#if tab === 'profils'}
  <StatProfilesPage />
{:else if tab === 'sorts'}
  <SpellsPage />
{:else}
  <CalcPage />
{/if}
