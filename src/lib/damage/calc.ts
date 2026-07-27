/**
 * Moteur de calcul de dégâts (feature Dégâts, étape 3). Fonctions pures, sans
 * Dexie ni DOM — testées à part.
 *
 * Formule d'un coup :
 *   dégât = base × (1 + (force + puissance) / 100) + dommages
 * où `base` = valeur de la ligne de dégâts du sort (roll min/max/moyen),
 * `force` = stat élémentaire (Terre / meilleur élément → Force pour un Iop
 * orienté force), `puissance` et `dommages` = profil + buffs actifs.
 *
 * Buffs modélisés (self-cast, cf. mémoire « iop-spell-semantics ») :
 *   - Puissance (8137) : +Puissance, ligne « sur soi » (1ʳᵉ ligne)
 *   - Épée Divine (8131) : +Dommages
 *   - Brokle (410) sur la cible : roll max forcé + Putsch (+20 % des dégâts)
 * Les autres sorts ne comptent que leurs lignes de dégâts ; le vol de vie est
 * ignoré (on ne s'intéresse qu'aux dégâts infligés).
 */

import { parseEffect, type Spell, type SpellLevel } from './spells'
import { normalizeStats, type Stats } from './stats'

const SPELL_PUISSANCE = 8137
const SPELL_EPEE_DIVINE = 8131
const SPELL_BROKLE = 410
const SPELL_CONCENTRATION = 8121
const PUTSCH_BONUS = 0.2 // +20 % des dégâts subis par la cible sous Putsch

/** Un tour du scénario : budget de PA (variable, ex. buffs alliés) + sorts lancés. */
export interface ScenarioTurn {
  pa: number
  /** Ids des sorts lancés ce tour, dans l'ordre. */
  casts: number[]
}

export interface Scenario {
  id?: number
  name: string
  class: string
  /** Profil de stats utilisé (null = tout à zéro). */
  profileId?: number
  turns: ScenarioTurn[]
  /** Niveau choisi par sort (global au scénario). */
  levels: Record<number, number>
}

/** Résultat d'un roll : dégâts au roll min / max / moyen. */
export interface RollResult {
  min: number
  max: number
  avg: number
}

export interface TurnResult {
  damage: RollResult
  paUsed: number
}

export interface SimResult {
  /** Dégâts de chaque tour du scénario (départ à froid, sans buff préexistant). */
  perTurn: TurnResult[]
  /** Cumul des 3 premiers tours de jeu. */
  sum3: RollResult
  /** Moyenne par tour à l'infini (scénario bouclé, buffs stabilisés). */
  infinite: RollResult
  warnings: string[]
}

interface StatBuff {
  key: string // spellId+stat : un même sort rafraîchit son buff au lieu de l'empiler
  stat: 'puissance' | 'dommages'
  value: number
  turnsLeft: number
}

const zero = (): RollResult => ({ min: 0, max: 0, avg: 0 })
const addInto = (acc: RollResult, r: RollResult) => {
  acc.min += r.min
  acc.max += r.max
  acc.avg += r.avg
}

function levelData(spell: Spell, level: number): SpellLevel {
  return spell.levels.find((l) => l.level === level) ?? spell.levels[spell.levels.length - 1]
}

/** Buffs auto-appliqués (sur soi) par un sort donné. */
function selfBuffs(spellId: number, ld: SpellLevel): StatBuff[] {
  const out: StatBuff[] = []
  if (spellId === SPELL_PUISSANCE) {
    // Ligne « sur soi » = la 1ʳᵉ ligne d'effet.
    const e = parseEffect(ld.normal[0] ?? '')
    if (e.kind === 'buff') {
      out.push({ key: `${spellId}:puissance`, stat: 'puissance', value: e.value, turnsLeft: e.turns ?? 1 })
    }
  } else if (spellId === SPELL_EPEE_DIVINE) {
    for (const raw of ld.normal) {
      const e = parseEffect(raw)
      if (e.kind === 'buff' && /dommages/i.test(e.stat)) {
        out.push({ key: `${spellId}:dommages`, stat: 'dommages', value: e.value, turnsLeft: e.turns ?? 1 })
      }
    }
  }
  return out
}

/**
 * Lignes de dégâts d'un sort réellement infligées à la cible unique.
 * Concentration a une 2ᵉ ligne de dégâts qui ne concerne que les invocations
 * (cf. Jérémy) : on ne garde que la 1ʳᵉ.
 */
function damageEffects(spellId: number, ld: SpellLevel) {
  const dmg = ld.normal.map(parseEffect).filter((e) => e.kind === 'damage')
  if (spellId === SPELL_CONCENTRATION) return dmg.slice(0, 1)
  return dmg
}

/** Durée (en tours) de l'effet Brokle, lue sur sa ligne « Maximise… ». */
function brokleTurns(ld: SpellLevel): number {
  for (const raw of ld.normal) {
    const e = parseEffect(raw)
    if (/maximise/i.test(e.text)) return e.turns ?? 2
  }
  return 2
}

/**
 * Simule un scénario. `spellsById` fournit les données de sort ; `profile`
 * les stats de base (force / dommages / puissance).
 */
export function simulate(
  scenario: Scenario,
  profile: Partial<Stats> | undefined,
  spellsById: Map<number, Spell>,
): SimResult {
  const base = normalizeStats(profile)
  const T = scenario.turns.length
  const warnings: string[] = []
  if (T === 0) return { perTurn: [], sum3: zero(), infinite: zero(), warnings }

  // On simule le scénario en boucle sur plusieurs cycles : le 1ᵉ cycle donne
  // les dégâts « à froid », le dernier la moyenne stabilisée (à l'infini).
  const CYCLES = 12
  const allTurns: TurnResult[] = []

  const statBuffs: StatBuff[] = []
  let brokleLeft = 0

  const bonus = (stat: 'puissance' | 'dommages') =>
    statBuffs.filter((b) => b.stat === stat).reduce((s, b) => s + b.value, 0)

  const levelFor = (spellId: number) =>
    scenario.levels[spellId] ?? spellsById.get(spellId)?.maxLevel ?? 1

  for (let cycle = 0; cycle < CYCLES; cycle++) {
    for (let t = 0; t < T; t++) {
      const turn = scenario.turns[t]
      const damage = zero()
      let paUsed = 0
      const castCount = new Map<number, number>()

      for (const spellId of turn.casts) {
        const spell = spellsById.get(spellId)
        if (!spell) continue
        const ld = levelData(spell, levelFor(spellId))
        paUsed += ld.pa ?? 0
        castCount.set(spellId, (castCount.get(spellId) ?? 0) + 1)

        // Dégâts du lancer, avec les buffs ACTUELS (avant d'appliquer les siens).
        const force = base.force
        const puissance = base.puissance + bonus('puissance')
        const dommages = base.dommages + bonus('dommages')
        const factor = 1 + (force + puissance) / 100
        const brokle = brokleLeft > 0

        for (const e of damageEffects(spellId, ld)) {
          if (e.kind !== 'damage') continue
          const lo = brokle ? e.max : e.min
          const hi = e.max
          const mid = brokle ? e.max : (e.min + e.max) / 2
          const mult = brokle ? 1 + PUTSCH_BONUS : 1
          damage.min += (lo * factor + dommages) * mult
          damage.max += (hi * factor + dommages) * mult
          damage.avg += (mid * factor + dommages) * mult
        }

        // Puis on applique les effets du lancer (bénéficient aux suivants).
        for (const b of selfBuffs(spellId, ld)) {
          const existing = statBuffs.find((x) => x.key === b.key)
          if (existing) {
            existing.value = b.value
            existing.turnsLeft = b.turnsLeft
          } else {
            statBuffs.push({ ...b })
          }
        }
        if (spellId === SPELL_BROKLE) brokleLeft = brokleTurns(ld)
      }

      // Avertissements (1ᵉ cycle seulement).
      if (cycle === 0) {
        if (paUsed > turn.pa) {
          warnings.push(`Tour ${t + 1} : ${paUsed} PA utilisés pour ${turn.pa} disponibles`)
        }
        for (const [spellId, n] of castCount) {
          const spell = spellsById.get(spellId)
          if (!spell) continue
          const ld = levelData(spell, levelFor(spellId))
          // Limite effective mono-cible = min(utilisations/tour, lancers/joueur).
          const limit = Math.min(ld.usesPerTurn ?? Infinity, ld.castsPerTurn ?? Infinity)
          if (Number.isFinite(limit) && n > limit) {
            warnings.push(`Tour ${t + 1} : ${spell.name} lancé ${n}× (max ${limit}/tour)`)
          }
        }
      }

      allTurns.push({ damage, paUsed })

      // Fin de tour : les buffs perdent un tour.
      for (const b of statBuffs) b.turnsLeft--
      let i = statBuffs.length
      while (i--) if (statBuffs[i].turnsLeft <= 0) statBuffs.splice(i, 1)
      if (brokleLeft > 0) brokleLeft--
    }
  }

  const perTurn = allTurns.slice(0, T)

  const sum3 = zero()
  for (let i = 0; i < Math.min(3, allTurns.length); i++) addInto(sum3, allTurns[i].damage)

  // Moyenne par tour sur le dernier cycle (buffs stabilisés).
  const lastCycle = allTurns.slice((CYCLES - 1) * T, CYCLES * T)
  const infSum = zero()
  for (const tr of lastCycle) addInto(infSum, tr.damage)
  const infinite: RollResult = {
    min: infSum.min / T,
    max: infSum.max / T,
    avg: infSum.avg / T,
  }

  return { perTurn, sum3, infinite, warnings }
}
