<script lang="ts">
  import { db } from '../lib/db/db'
  import { useLiveQuery } from '../lib/stores/liveQuery.svelte'
  import { loadSpells, type Spell, type SpellChoice } from '../lib/damage/spells'
  import { simulate, type Scenario } from '../lib/damage/calc'
  import { normalizeStats, type StatProfile } from '../lib/damage/stats'
  import EmptyState from '../components/EmptyState.svelte'

  const CLASS = 'iop'

  let spells = $state<Spell[]>([])
  loadSpells(CLASS).then((s) => (spells = s))
  const spellsById = $derived(new Map(spells.map((s) => [s.id, s])))

  const profiles = useLiveQuery<StatProfile[]>(() => db.statProfiles.toArray(), [])
  const choices = useLiveQuery<SpellChoice[]>(
    () => db.spellChoices.where('class').equals(CLASS).toArray(),
    [],
  )
  const scenarios = useLiveQuery<Scenario[]>(() => db.scenarios.toArray(), [])

  // Niveau par défaut d'un sort : celui du kit, sinon le niveau max.
  const kitLevel = $derived(new Map(choices.value.map((c) => [c.spellId, c.level])))
  const defaultLevel = (spellId: number) =>
    kitLevel.get(spellId) ?? spellsById.get(spellId)?.maxLevel ?? 1

  // Sorts ajoutables : le kit s'il existe, sinon tous les sorts de la classe.
  const addable = $derived(
    choices.value.length > 0
      ? choices.value.map((c) => spellsById.get(c.spellId)).filter((s): s is Spell => !!s)
      : spells,
  )

  const paOf = (sc: Scenario, spellId: number) => {
    const lvl = sc.levels[spellId] ?? defaultLevel(spellId)
    return spellsById.get(spellId)?.levels.find((l) => l.level === lvl)?.pa ?? 0
  }
  // Sorts distincts utilisés dans un scénario (pour régler leurs niveaux).
  const usedSpells = (sc: Scenario) => [...new Set(sc.turns.flatMap((t) => t.casts))]

  async function addScenario() {
    await db.scenarios.add({
      name: `Scénario ${scenarios.value.length + 1}`,
      class: CLASS,
      profileId: profiles.value[0]?.id,
      turns: [{ pa: 6, casts: [] }],
      levels: {},
    })
  }
  const removeScenario = (sc: Scenario) => db.scenarios.delete(sc.id!)
  // `sc` vient de useLiveQuery → c'est un proxy Svelte $state. Écrire ses
  // tableaux/objets imbriqués directement dans Dexie lève DataCloneError
  // (IndexedDB ne clone pas un Proxy) : on snapshot en objets simples d'abord.
  const patch = (sc: Scenario, changes: Partial<Scenario>) =>
    db.scenarios.update(sc.id!, $state.snapshot(changes) as Partial<Scenario>)

  const addTurn = (sc: Scenario) =>
    patch(sc, { turns: [...sc.turns, { pa: sc.turns.at(-1)?.pa ?? 6, casts: [] }] })
  const removeTurn = (sc: Scenario, ti: number) =>
    patch(sc, { turns: sc.turns.filter((_, i) => i !== ti) })
  const setPa = (sc: Scenario, ti: number, pa: number) =>
    patch(sc, { turns: sc.turns.map((t, i) => (i === ti ? { ...t, pa: Math.max(1, pa) } : t)) })

  function addCast(sc: Scenario, ti: number, spellId: number) {
    const levels = { ...sc.levels }
    if (levels[spellId] == null) levels[spellId] = defaultLevel(spellId)
    const turns = sc.turns.map((t, i) =>
      i === ti ? { ...t, casts: [...t.casts, spellId] } : t,
    )
    return patch(sc, { turns, levels })
  }
  const removeCast = (sc: Scenario, ti: number, ci: number) =>
    patch(sc, {
      turns: sc.turns.map((t, i) =>
        i === ti ? { ...t, casts: t.casts.filter((_, j) => j !== ci) } : t,
      ),
    })
  const setLevel = (sc: Scenario, spellId: number, level: number) =>
    patch(sc, { levels: { ...sc.levels, [spellId]: level } })

  const statsFor = (sc: Scenario) =>
    normalizeStats(profiles.value.find((p) => p.id === sc.profileId)?.stats)

  const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR')
</script>

<h1 class="text-2xl font-bold mb-1">Calcul de dégâts</h1>
<p class="text-sm text-base-content/60 mb-4">
  Construis des scénarios (tours × sorts) et compare dégâts par tour, sur 3 tours et à l'infini.
</p>

{#if profiles.value.length === 0}
  <EmptyState
    message="Crée d'abord un profil de stats."
    hint="Onglet Profils : renseigne force / dommages / puissance."
  />
{:else}
  <button class="btn btn-primary btn-sm mb-4" onclick={addScenario}>+ Nouveau scénario</button>

  {#if scenarios.value.length === 0}
    <EmptyState message="Aucun scénario." hint="Crée-en un pour commencer." />
  {/if}

  <div class="flex flex-col gap-4">
    {#each scenarios.value as sc (sc.id)}
      {@const res = spellsById.size ? simulate(sc, statsFor(sc), spellsById) : null}
      {@const used = usedSpells(sc)}
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body gap-3 py-4">
          <div class="flex items-center gap-2">
            <input
              class="input input-bordered input-sm flex-1 font-semibold"
              value={sc.name}
              onchange={(e) => patch(sc, { name: e.currentTarget.value.trim() || 'Sans nom' })}
              aria-label="Nom du scénario"
            />
            <button
              class="btn btn-ghost btn-sm text-error"
              onclick={() => removeScenario(sc)}
              aria-label="Supprimer">✕</button
            >
          </div>

          <label class="flex flex-col gap-0.5">
            <span class="text-[11px] uppercase tracking-wide text-base-content/50">Profil</span>
            <select
              class="select select-bordered select-sm w-fit"
              value={sc.profileId ?? ''}
              onchange={(e) => patch(sc, { profileId: Number(e.currentTarget.value) || undefined })}
            >
              {#each profiles.value as p (p.id)}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          </label>

          <!-- Niveaux des sorts (global au scénario) -->
          {#if used.length > 0}
            <div class="flex flex-col gap-1">
              <span class="text-[11px] uppercase tracking-wide text-base-content/50">Niveaux</span>
              <div class="flex flex-wrap gap-2">
                {#each used as spellId (spellId)}
                  {@const sp = spellsById.get(spellId)}
                  <label class="flex items-center gap-1 text-sm">
                    <span>{sp?.name}</span>
                    <select
                      class="select select-bordered select-xs"
                      value={sc.levels[spellId] ?? defaultLevel(spellId)}
                      onchange={(e) => setLevel(sc, spellId, Number(e.currentTarget.value))}
                    >
                      {#each Array.from({ length: sp?.maxLevel ?? 1 }, (_, i) => i + 1) as lvl (lvl)}
                        <option value={lvl}>niv {lvl}</option>
                      {/each}
                    </select>
                  </label>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Tours -->
          <div class="flex flex-col gap-2">
            {#each sc.turns as turn, ti (ti)}
              {@const paUsed = turn.casts.reduce((s, id) => s + paOf(sc, id), 0)}
              <div class="rounded-box bg-base-200 p-2">
                <div class="mb-1 flex items-center justify-between gap-2">
                  <span class="text-xs font-semibold text-base-content/70">Tour {ti + 1}</span>
                  <div class="flex items-center gap-2">
                    <label class="flex items-center gap-1 text-xs">
                      <span class:text-error={paUsed > turn.pa} class="font-mono">{paUsed}</span>
                      /
                      <input
                        type="number"
                        class="input input-bordered input-xs w-14 text-center font-mono"
                        inputmode="numeric"
                        min="1"
                        value={turn.pa}
                        onchange={(e) => setPa(sc, ti, Number(e.currentTarget.value) || 1)}
                        aria-label="PA du tour"
                      />
                      <span class="text-base-content/50">PA</span>
                    </label>
                    <button
                      class="btn btn-ghost btn-xs text-error"
                      onclick={() => removeTurn(sc, ti)}
                      aria-label="Supprimer le tour">✕</button
                    >
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                  {#each turn.casts as spellId, ci (ci)}
                    <span class="badge badge-neutral gap-1">
                      {spellsById.get(spellId)?.name ?? '?'}
                      <button class="text-error" onclick={() => removeCast(sc, ti, ci)} aria-label="Retirer"
                        >✕</button
                      >
                    </span>
                  {/each}
                  <select
                    class="select select-bordered select-xs"
                    onchange={(e) => {
                      const id = Number(e.currentTarget.value)
                      e.currentTarget.selectedIndex = 0
                      if (id) addCast(sc, ti, id)
                    }}
                  >
                    <option value="">+ sort</option>
                    {#each addable as sp (sp.id)}
                      <option value={sp.id}>{sp.name}</option>
                    {/each}
                  </select>
                </div>
              </div>
            {/each}
            <button class="btn btn-ghost btn-xs self-start" onclick={() => addTurn(sc)}>+ tour</button>
          </div>

          <!-- Résultats -->
          {#if res}
            <div class="overflow-x-auto">
              <table class="table table-xs">
                <thead>
                  <tr>
                    <th></th>
                    <th class="text-right">min</th>
                    <th class="text-right">moyen</th>
                    <th class="text-right">max</th>
                  </tr>
                </thead>
                <tbody>
                  {#each res.perTurn as tr, i (i)}
                    <tr>
                      <td>Tour {i + 1}</td>
                      <td class="text-right font-mono">{fmt(tr.damage.min)}</td>
                      <td class="text-right font-mono font-semibold">{fmt(tr.damage.avg)}</td>
                      <td class="text-right font-mono">{fmt(tr.damage.max)}</td>
                    </tr>
                  {/each}
                  <tr class="border-t-2">
                    <td class="font-semibold">Sur 3 tours</td>
                    <td class="text-right font-mono">{fmt(res.sum3.min)}</td>
                    <td class="text-right font-mono font-semibold">{fmt(res.sum3.avg)}</td>
                    <td class="text-right font-mono">{fmt(res.sum3.max)}</td>
                  </tr>
                  <tr>
                    <td class="font-semibold">Moyenne / tour (∞)</td>
                    <td class="text-right font-mono">{fmt(res.infinite.min)}</td>
                    <td class="text-right font-mono font-semibold">{fmt(res.infinite.avg)}</td>
                    <td class="text-right font-mono">{fmt(res.infinite.max)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {#if res.warnings.length > 0}
              <div class="text-xs text-warning">
                {#each res.warnings as w (w)}<div>⚠ {w}</div>{/each}
              </div>
            {/if}
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/if}
