<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import {
    effectNote,
    loadSpells,
    parseEffect,
    type Spell,
    type SpellChoice,
  } from '../lib/damage/spells'
  import EmptyState from '../components/EmptyState.svelte'

  const CLASS = 'iop'

  let spells = $state<Spell[]>([])
  loadSpells(CLASS).then((s) => (spells = s))

  const choices = useLiveQuery<SpellChoice[]>(
    () => db.spellChoices.where('class').equals(CLASS).toArray(),
    [],
  )
  const choiceOf = $derived(new Map(choices.value.map((c) => [c.spellId, c])))

  // Niveau affiché pour un sort hors kit (aperçu) — par défaut le niveau max.
  let previews = $state<Record<number, number>>({})
  function shownLevel(spell: Spell): number {
    const c = choiceOf.get(spell.id)
    if (c) return c.level
    return previews[spell.id] ?? spell.maxLevel
  }

  async function setLevel(spell: Spell, level: number) {
    const c = choiceOf.get(spell.id)
    if (c) await db.spellChoices.update(c.id!, { level })
    else previews = { ...previews, [spell.id]: level }
  }

  async function toggleKit(spell: Spell) {
    const c = choiceOf.get(spell.id)
    if (c) await db.spellChoices.delete(c.id!)
    else
      await db.spellChoices.add({ class: CLASS, spellId: spell.id, level: shownLevel(spell) })
  }

  function levelData(spell: Spell) {
    const lvl = shownLevel(spell)
    return spell.levels.find((l) => l.level === lvl) ?? spell.levels[spell.levels.length - 1]
  }
</script>

<h1 class="text-2xl font-bold mb-1">Sorts (Iop)</h1>
<p class="text-sm text-base-content/60 mb-4">
  Choisis le niveau de chaque sort et ajoute-le à ton kit (utilisé plus tard pour le calcul).
</p>

{#if spells.length === 0}
  <EmptyState message="Chargement des sorts…" hint="" />
{:else}
  <div class="flex flex-col gap-3">
    {#each spells as spell (spell.id)}
      {@const inKit = choiceOf.has(spell.id)}
      {@const ld = levelData(spell)}
      <div class="card bg-base-100 shadow-sm" class:ring-2={inKit} class:ring-primary={inKit}>
        <div class="card-body gap-2 py-4">
          <div class="flex items-start gap-2">
            <div class="flex-1">
              <h2 class="font-semibold">{spell.name}</h2>
              <p class="text-xs text-base-content/60">{spell.description}</p>
            </div>
            <button
              class="btn btn-sm {inKit ? 'btn-primary' : 'btn-outline'}"
              onclick={() => toggleKit(spell)}
            >
              {inKit ? '✓ Kit' : '+ Kit'}
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[11px] uppercase tracking-wide text-base-content/50">Niveau</span>
            <div class="join">
              {#each Array.from({ length: spell.maxLevel }, (_, i) => i + 1) as lvl (lvl)}
                <button
                  class="join-item btn btn-xs {shownLevel(spell) === lvl ? 'btn-active btn-primary' : 'btn-ghost'}"
                  onclick={() => setLevel(spell, lvl)}
                >
                  {lvl}
                </button>
              {/each}
            </div>
          </div>

          <div class="flex flex-wrap gap-1.5 text-xs">
            {#if ld.pa != null}<span class="badge badge-sm badge-ghost">{ld.pa} PA</span>{/if}
            {#if ld.poMin != null}
              <span class="badge badge-sm badge-ghost"
                >{ld.poMin === ld.poMax ? ld.poMin : `${ld.poMin}-${ld.poMax}`} PO</span
              >
            {/if}
            {#if ld.usesPerTurn != null}
              <span class="badge badge-sm badge-ghost">{ld.usesPerTurn}×/tour</span>
            {/if}
            {#if ld.cooldown != null}
              <span class="badge badge-sm badge-ghost">relance {ld.cooldown}</span>
            {/if}
            {#if ld.critPct != null}
              <span class="badge badge-sm badge-ghost">crit {ld.critPct}%</span>
            {/if}
          </div>

          <div class="flex flex-col gap-1">
            {#each ld.normal as raw, i (i)}
              {@const e = parseEffect(raw)}
              {@const note = effectNote(spell.id, e, i)}
              <div class="flex flex-col">
                <div class="flex items-center gap-2 text-sm">
                  {#if e.kind === 'damage'}
                    <span class="badge badge-sm badge-error badge-soft">dégâts</span>
                    <span>{e.min === e.max ? e.min : `${e.min}–${e.max}`} {e.element}</span>
                  {:else if e.kind === 'steal'}
                    <span class="badge badge-sm badge-warning badge-soft">vol</span>
                    <span>{e.min === e.max ? e.min : `${e.min}–${e.max}`} {e.element}</span>
                  {:else if e.kind === 'buff'}
                    <span class="badge badge-sm badge-success badge-soft">buff</span>
                    <span>
                      {e.value > 0 ? '+' : ''}{e.value}{e.percent ? '%' : ''} {e.stat}
                      {#if e.turns}<span class="text-base-content/50">({e.turns} tours)</span>{/if}
                    </span>
                  {:else}
                    <span class="badge badge-sm badge-ghost">effet</span>
                    <span class="text-base-content/80">{e.text}</span>
                  {/if}
                </div>
                {#if note}
                  <span class="pl-1 text-xs italic text-base-content/50">↳ {note}</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}
