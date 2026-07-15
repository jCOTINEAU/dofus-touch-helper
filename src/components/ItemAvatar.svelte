<script lang="ts">
  let {
    imageUrl,
    name,
    size = 40,
  }: { imageUrl: string | null | undefined; name: string; size?: number } = $props()
</script>

{#if imageUrl}
  <img
    src={imageUrl}
    alt={name}
    width={size}
    height={size}
    loading="lazy"
    class="rounded-box bg-base-200 shrink-0"
  />
{:else}
  <div
    class="rounded-box bg-base-200 shrink-0 flex items-center justify-center font-bold text-base-content/40"
    style="width: {size}px; height: {size}px"
  >
    {name.charAt(0).toUpperCase()}
  </div>
{/if}
