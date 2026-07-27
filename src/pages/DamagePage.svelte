<script lang="ts">
  import StatProfilesPage from './StatProfilesPage.svelte'
  import SpellsPage from './SpellsPage.svelte'

  // Section « Dégâts » : onglets Profils | Sorts (le calcul viendra ensuite).
  let tab = $state<'profils' | 'sorts'>('profils')
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
</div>

{#if tab === 'profils'}
  <StatProfilesPage />
{:else}
  <SpellsPage />
{/if}
