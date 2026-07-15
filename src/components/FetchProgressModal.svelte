<script lang="ts">
  import type { ExpandProgress } from '../lib/fetch/expand'

  let {
    open,
    progress,
    onCancel,
  }: { open: boolean; progress: ExpandProgress | null; onCancel: () => void } = $props()
</script>

<dialog class="modal" {open}>
  <div class="modal-box">
    <h3 class="font-bold text-lg">Récupération des recettes…</h3>
    {#if progress}
      <progress
        class="progress progress-primary w-full my-3"
        value={progress.done}
        max={progress.discovered}
      ></progress>
      <p class="text-sm text-base-content/60">
        {progress.done}/{progress.discovered} pages
        {#if progress.fromCache > 0}(dont {progress.fromCache} en cache){/if}
        {#if progress.currentName}— {progress.currentName}{/if}
      </p>
      {#if progress.warnings.length > 0}
        <ul class="text-xs text-warning mt-2 list-disc list-inside">
          {#each progress.warnings as w (w)}
            <li>{w}</li>
          {/each}
        </ul>
      {/if}
    {:else}
      <progress class="progress progress-primary w-full my-3"></progress>
    {/if}
    <div class="modal-action">
      <button class="btn btn-ghost" onclick={onCancel}>Annuler</button>
    </div>
  </div>
</dialog>
