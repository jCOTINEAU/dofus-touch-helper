<script lang="ts">
  let { message, hint = '' }: { message: string; hint?: string } = $props()
</script>

<div class="card bg-base-100 shadow-sm">
  <div class="card-body items-center text-center py-12">
    <p class="text-base-content/60">{message}</p>
    {#if hint}
      <p class="text-sm text-base-content/40">{hint}</p>
    {/if}
  </div>
</div>
