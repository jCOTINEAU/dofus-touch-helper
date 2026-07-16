<script lang="ts">
  let {
    imageUrl,
    name,
    size = 40,
  }: { imageUrl: string | null | undefined; name: string; size?: number } = $props()

  let failed = $state(false)
</script>

{#if imageUrl && !failed}
  <!-- static.ankama.com renvoie 403 si le Referer n'est pas dofus-touch.com :
       no-referrer est indispensable pour que les images chargent. -->
  <img
    src={imageUrl}
    alt={name}
    width={size}
    height={size}
    loading="lazy"
    referrerpolicy="no-referrer"
    class="rounded-box bg-base-200 shrink-0"
    onerror={() => (failed = true)}
  />
{:else}
  <div
    class="rounded-box bg-base-200 shrink-0 flex items-center justify-center font-bold text-base-content/40"
    style="width: {size}px; height: {size}px"
  >
    {name.charAt(0).toUpperCase()}
  </div>
{/if}
