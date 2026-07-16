<script lang="ts">
  import CraftTreeNode from './CraftTreeNode.svelte'
  import ItemAvatar from './ItemAvatar.svelte'
  import ModeToggle from './ModeToggle.svelte'
  import QtyStepper from './QtyStepper.svelte'
  import type { DisplayNode } from '../lib/needs/tree'
  import type { NodeNeed } from '../lib/needs/needs'
  import type { CachedItem } from '../lib/types'
  import type { EffectiveCost } from '../lib/prices/costs'
  import { formatKamas } from '../lib/prices/format'

  interface Props {
    node: DisplayNode
    depth?: number
    items: Map<number, CachedItem>
    needs: Map<number, NodeNeed>
    /** Coût effectif crafter/acheter (optionnel — masqué si absent). */
    costOf?: (itemId: number) => EffectiveCost
    onModeChange: (itemId: number, mode: 'craft' | 'buy') => void
    onOwnedChange: (itemId: number, owned: number) => void
    onCraft: (itemId: number) => void
  }
  let {
    node,
    depth = 0,
    items,
    needs,
    costOf,
    onModeChange,
    onOwnedChange,
    onCraft,
  }: Props = $props()

  const item = $derived(items.get(node.itemId))
  const need = $derived(needs.get(node.itemId))
  const name = $derived(item?.name ?? `item ${node.itemId}`)
  const dead = $derived(item?.fetchStatus === 'dead')
  const craftable = $derived(item?.recipe != null)
  const inPlan = $derived(need !== undefined)
  // Mode craft actif : le sous-arbre fait partie du plan.
  const expanded = $derived(inPlan && !need!.isLeafInPlan)
  // Craftable mais basculé « à acheter » : recette ignorée.
  const buyMode = $derived(inPlan && craftable && need!.isLeafInPlan)
  const done = $derived(inPlan && need!.remaining === 0)
  const canToggle = $derived(expanded && node.children.length > 0)

  // Racine + premier niveau dépliés par défaut ; depth est stable sur la durée de vie du nœud.
  // svelte-ignore state_referenced_locally
  let open = $state(depth <= 1)

  const cardClass = $derived.by(() => {
    if (!inPlan) return 'border-base-200 bg-base-100 opacity-55'
    if (dead) return 'border-error/50 bg-error/5'
    if (done) return 'border-success/45 bg-success/5'
    if (buyMode) return 'border-dashed border-secondary/50 bg-secondary/5'
    if (expanded) return 'border-primary/30 bg-base-100'
    return 'border-base-300 bg-base-100'
  })

  const remainingLabel = $derived.by(() => {
    if (!inPlan || done) return ''
    return expanded ? `reste ${need!.remaining} à crafter` : `reste ${need!.remaining} à obtenir`
  })

  // Aide à la décision : coût unitaire crafter vs acheter (si prix connus).
  const cost = $derived(craftable && inPlan && !dead && costOf ? costOf(node.itemId) : null)
  const costHint = $derived.by(() => {
    if (!cost || (cost.craft === null && cost.buy === null)) return null
    const parts: { label: string; value: string; best: boolean }[] = []
    if (cost.craft !== null)
      parts.push({
        label: 'crafter',
        value: formatKamas(cost.craft),
        best: cost.bestSource === 'craft',
      })
    if (cost.buy !== null)
      parts.push({ label: 'acheter', value: formatKamas(cost.buy), best: cost.bestSource === 'buy' })
    return parts
  })
</script>

<div class={depth === 0 ? 'mb-3' : 'mt-2'}>
  <div class="overflow-hidden rounded-box border {cardClass}">
    <!-- Ligne principale : toute la zone gauche (chevron + image + nom) déplie/replie -->
    <div class="flex items-center gap-1 p-1.5 sm:gap-2">
      {#if canToggle}
        <button
          type="button"
          class="flex min-h-12 min-w-0 flex-1 cursor-pointer touch-manipulation items-center gap-2 rounded-lg px-1 text-left transition-colors hover:bg-base-200/60 active:bg-base-200 sm:gap-3"
          onclick={() => (open = !open)}
          aria-expanded={open}
          aria-label={open ? `Replier ${name}` : `Déplier ${name}`}
        >
          {@render rowHeader()}
        </button>
      {:else}
        <div class="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left sm:gap-3">
          {@render rowHeader()}
        </div>
      {/if}

      {#snippet rowHeader()}
        <span class="flex h-8 w-6 shrink-0 items-center justify-center sm:w-8">
          {#if canToggle}
            <svg
              class="h-5 w-5 text-primary transition-transform duration-200 {open
                ? 'rotate-90'
                : ''}"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                clip-rule="evenodd"
              />
            </svg>
          {:else}
            <span class="text-base-content/25" aria-hidden="true">•</span>
          {/if}
        </span>

        <ItemAvatar imageUrl={item?.imageUrl} {name} size={40} />

        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-1.5 font-medium leading-tight">
            {#if depth > 0}
              <span class="text-base-content/60">{node.qtyPerCraft} ×</span>
            {/if}
            <span>{name}</span>
            {#if dead}
              <span class="badge badge-error badge-sm">introuvable</span>
            {/if}
            {#if node.cycleCut}
              <span
                class="badge badge-warning badge-sm"
                title="Recette coupée : dépendance circulaire"
              >
                cycle
              </span>
            {/if}
          </div>
          <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {#if item?.recipe}
              <span class="badge badge-soft badge-primary badge-sm whitespace-nowrap">
                🔨 {item.recipe.job
                  ? `${item.recipe.job} niv. ${item.recipe.jobLevel}`
                  : 'Fabrication'}
              </span>
              {#if buyMode}
                <span class="text-xs text-secondary">acheté tel quel — recette ignorée</span>
              {/if}
            {:else if inPlan}
              <span class="text-xs text-base-content/45">matière première</span>
            {/if}
            {#if costHint}
              <span class="text-xs whitespace-nowrap text-base-content/60">
                {#each costHint as part, i (part.label)}
                  {#if i > 0}<span class="text-base-content/30"> · </span>{/if}
                  <span class={part.best ? 'font-semibold text-accent' : ''}>
                    {part.label} ≈ {part.value}{part.best && costHint.length > 1 ? ' ✓' : ''}
                  </span>
                {/each}
                {#if cost && cost.missingPrices.length > 0}
                  <span class="text-base-content/35">(partiel)</span>
                {/if}
              </span>
            {/if}
          </div>
        </div>
      {/snippet}

      <!-- Compteur : possédé / requis, jamais ambigu -->
      {#if inPlan}
        <div
          class="flex shrink-0 flex-col items-end gap-1 pr-1 sm:pr-2"
          title="possédé / requis"
        >
          <div class="font-mono text-base leading-none whitespace-nowrap">
            <span class="font-bold {done ? 'text-success' : ''}">{need!.owned}</span>
            <span class="text-base-content/45">/ {need!.required}</span>
          </div>
          <progress
            class="progress h-1.5 w-16 {done ? 'progress-success' : 'progress-warning'}"
            value={Math.min(need!.owned, need!.required)}
            max={Math.max(need!.required, 1)}
          ></progress>
          <div
            class="text-[11px] leading-none whitespace-nowrap {done
              ? 'font-medium text-success'
              : 'text-base-content/60'}"
          >
            {done ? '✓ complet' : remainingLabel}
          </div>
        </div>
      {:else}
        <span class="pr-2 text-xs italic text-base-content/40">hors plan (parent acheté)</span>
      {/if}
    </div>

    <!-- Ligne actions : stock possédé + mode + craft -->
    {#if inPlan}
      <div
        class="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-t border-base-content/8 px-2 py-2 sm:px-3"
      >
        <QtyStepper
          value={need!.owned}
          showLabel
          onchange={(v) => onOwnedChange(node.itemId, v)}
        />
        {#if craftable && !dead}
          <div class="flex flex-wrap items-center justify-end gap-2">
            <ModeToggle
              mode={need!.isLeafInPlan ? 'buy' : 'craft'}
              onchange={(m) => onModeChange(node.itemId, m)}
            />
            {#if expanded}
              <button
                class="btn h-11 btn-outline btn-primary whitespace-nowrap"
                onclick={() => onCraft(node.itemId)}
              >
                +1 crafté
              </button>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if canToggle && open}
    <div class="ml-3 border-l-2 border-base-300 pl-2 pt-0.5 sm:ml-5 sm:pl-3">
      {#each node.children as child (child.itemId)}
        <CraftTreeNode
          node={child}
          depth={depth + 1}
          {items}
          {needs}
          {costOf}
          {onModeChange}
          {onOwnedChange}
          {onCraft}
        />
      {/each}
    </div>
  {/if}
</div>
