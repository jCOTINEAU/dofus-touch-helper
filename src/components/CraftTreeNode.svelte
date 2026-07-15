<script lang="ts">
  import CraftTreeNode from './CraftTreeNode.svelte'
  import ItemAvatar from './ItemAvatar.svelte'
  import ModeToggle from './ModeToggle.svelte'
  import QtyStepper from './QtyStepper.svelte'
  import type { DisplayNode } from '../lib/needs/tree'
  import type { NodeNeed } from '../lib/needs/needs'
  import type { CachedItem } from '../lib/types'

  interface Props {
    node: DisplayNode
    depth?: number
    items: Map<number, CachedItem>
    needs: Map<number, NodeNeed>
    onModeChange: (itemId: number, mode: 'craft' | 'buy') => void
    onOwnedChange: (itemId: number, owned: number) => void
    onCraft: (itemId: number) => void
  }
  let { node, depth = 0, items, needs, onModeChange, onOwnedChange, onCraft }: Props = $props()

  const item = $derived(items.get(node.itemId))
  const need = $derived(needs.get(node.itemId))
  const name = $derived(item?.name ?? `item ${node.itemId}`)
  const craftable = $derived(item?.recipe != null)
  const inPlan = $derived(need !== undefined)
  const expanded = $derived(inPlan && !need!.isLeafInPlan)
  const done = $derived(inPlan && need!.remaining === 0)
  // Racines dépliées par défaut ; depth est stable sur la durée de vie du nœud.
  // svelte-ignore state_referenced_locally
  let open = $state(depth === 0)
</script>

<div class="border-l-2 {depth > 0 ? 'border-base-300 pl-3' : 'border-transparent'} py-1">
  <div class="flex items-center gap-3 flex-wrap">
    {#if node.children.length > 0 && expanded}
      <button
        class="btn btn-ghost btn-sm btn-square"
        onclick={() => (open = !open)}
        aria-label={open ? 'Replier' : 'Déplier'}
      >
        {open ? '▾' : '▸'}
      </button>
    {:else}
      <span class="w-8"></span>
    {/if}

    <ItemAvatar imageUrl={item?.imageUrl} {name} size={36} />

    <div class="flex-1 min-w-40">
      <div class="font-medium">
        {#if depth > 0}<span class="text-base-content/60">{node.qtyPerCraft} ×</span>{/if}
        {name}
        {#if item?.fetchStatus === 'dead'}
          <span class="badge badge-error badge-sm ml-1">introuvable</span>
        {/if}
        {#if node.cycleCut}
          <span class="badge badge-warning badge-sm ml-1">cycle</span>
        {/if}
      </div>
      {#if item?.recipe}
        <div class="text-xs text-base-content/50">
          {item.recipe.job} niv. {item.recipe.jobLevel}
        </div>
      {/if}
    </div>

    {#if inPlan}
      <div class="flex items-center gap-2 flex-wrap">
        <span class="badge {done ? 'badge-success' : 'badge-warning'} badge-lg whitespace-nowrap">
          {need!.remaining} / {need!.required}
        </span>
        <QtyStepper value={need!.owned} onchange={(v) => onOwnedChange(node.itemId, v)} />
        {#if craftable && item?.fetchStatus !== 'dead'}
          <ModeToggle
            mode={need!.isLeafInPlan ? 'buy' : 'craft'}
            onchange={(m) => onModeChange(node.itemId, m)}
          />
          {#if expanded}
            <button class="btn btn-sm btn-outline" onclick={() => onCraft(node.itemId)}>
              +1 crafté
            </button>
          {/if}
        {/if}
      </div>
    {:else}
      <span class="text-xs text-base-content/40 italic">hors plan (parent acheté)</span>
    {/if}
  </div>

  {#if open && expanded}
    {#each node.children as child (child.itemId)}
      <CraftTreeNode
        node={child}
        depth={depth + 1}
        {items}
        {needs}
        {onModeChange}
        {onOwnedChange}
        {onCraft}
      />
    {/each}
  {/if}
</div>
