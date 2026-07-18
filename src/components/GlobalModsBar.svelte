<script lang="ts">
  import { globalMods } from '../lib/stores/globalMods.svelte'

  const m = $derived(globalMods.value)
</script>

<div class="card bg-base-100 shadow-sm">
  <div class="card-body gap-2 py-3">
    <span class="text-xs font-semibold uppercase text-base-content/60">
      Modificateurs (globaux, appliqués à tous les combats)
    </span>
    <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
      <label class="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          class="toggle toggle-sm toggle-primary"
          checked={m.boosterPack}
          onchange={(e) => globalMods.set({ boosterPack: e.currentTarget.checked })}
        />
        BoosterPack (+150 % de drop)
      </label>
      <label class="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          class="toggle toggle-sm toggle-primary"
          checked={m.playerDouble}
          onchange={(e) => globalMods.set({ playerDouble: e.currentTarget.checked })}
        />
        Double joueur (× 2)
      </label>
      <label class="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          class="toggle toggle-sm toggle-primary"
          checked={m.includeConditional}
          onchange={(e) => globalMods.set({ includeConditional: e.currentTarget.checked })}
        />
        Inclure les butins conditionnels
      </label>
    </div>
  </div>
</div>
