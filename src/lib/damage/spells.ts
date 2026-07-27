/**
 * Sorts (feature Dégâts). Le jeu de données est généré hors ligne par
 * scripts/build-iop-spells.mjs → public/spells-iop.json (un sort = ses
 * niveaux, chaque niveau = ses effets bruts normaux/critiques). Le parsing
 * des lignes d'effet en structuré (dommages / vol / buff / durée) est fait
 * ici, côté app, pour pouvoir l'affiner sans re-scraper.
 */

export interface SpellLevel {
  level: number
  pa: number | null
  poMin: number | null
  poMax: number | null
  levelRequired: number | null
  critPct: number | null
  usesPerTurn: number | null
  cooldown: number | null
  /** Textes bruts des effets, ex. « 30 Dommages (2 tours) ». */
  normal: string[]
  critical: string[]
}

export interface Spell {
  id: number
  name: string
  description: string
  maxLevel: number
  levels: SpellLevel[]
}

export interface SpellData {
  version: number
  class: string
  spells: Spell[]
}

/** Un sort retenu dans le kit du joueur (Dexie). */
export interface SpellChoice {
  id?: number
  class: string
  spellId: number
  level: number
}

let cache: Spell[] | null = null
let loading: Promise<Spell[]> | null = null

/** Charge les sorts d'une classe (Iop pour l'instant), une fois, à la demande. */
export function loadSpells(cls = 'iop'): Promise<Spell[]> {
  if (cache) return Promise.resolve(cache)
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}spells-${cls}.json`)
      .then((r) => (r.ok ? r.json() : { spells: [] }))
      .then((d: SpellData) => {
        cache = d.spells ?? []
        return cache
      })
      .catch(() => {
        cache = []
        return cache
      })
  }
  return loading
}

export type ParsedEffect =
  | { kind: 'damage'; text: string; min: number; max: number; element: string; turns: number | null }
  | { kind: 'steal'; text: string; min: number; max: number; element: string; turns: number | null }
  | { kind: 'buff'; text: string; stat: string; value: number; percent: boolean; turns: number | null }
  | { kind: 'other'; text: string; turns: number | null }

const turnsOf = (text: string): number | null => {
  const m = text.match(/\((\d+)\s*tours?\)/)
  return m ? Number(m[1]) : null
}

/**
 * Découpe une ligne d'effet en effet structuré. Exemples couverts :
 *  - « 23 à 26 (dommages Terre) »      → damage
 *  - « 23 à 26 (vol Terre) »           → steal (vol de vie)
 *  - « 22 à 24 (meilleur élément) »    → damage (élément « meilleur élément »)
 *  - « 30 Dommages (2 tours) »         → buff (stat Dommages, +30, 2 tours)
 *  - « 350 Puissance (3 tours) »       → buff
 *  - « 15% Érosion (2 tours) »         → buff en pourcentage
 *  - « Maximise les effets… (2 tours) »→ other
 */
export function parseEffect(text: string): ParsedEffect {
  const turns = turnsOf(text)

  // Dommages / vol : « N [à M] (dommages|vol Élément) » ou « N [à M] (meilleur élément) ».
  const dmg = text.match(/^(\d+)(?:\s*à\s*(\d+))?\s*\(([^)]+)\)\s*$/)
  if (dmg && /tours?/.test(dmg[3]) === false) {
    const min = Number(dmg[1])
    const max = dmg[2] ? Number(dmg[2]) : min
    const paren = dmg[3].trim()
    if (/^vol\s+/i.test(paren)) {
      return { kind: 'steal', text, min, max, element: paren.replace(/^vol\s+/i, ''), turns }
    }
    const element = paren.replace(/^dommages\s+/i, '')
    return { kind: 'damage', text, min, max, element, turns }
  }

  // Buff de caractéristique : « [±]N[%] Stat (T tours) ».
  const buff = text.match(/^([+-]?\d+)(%?)\s+(.+?)\s*\(\d+\s*tours?\)\s*$/)
  if (buff) {
    return {
      kind: 'buff',
      text,
      value: Number(buff[1]),
      percent: buff[2] === '%',
      stat: buff[3].trim(),
      turns,
    }
  }

  return { kind: 'other', text, turns }
}

/** Ids des sorts Iop qui portent une sémantique métier particulière. */
const SPELL_PRESSION = 8139
const SPELL_PUISSANCE = 8137
const SPELL_BROKLE = 410

/**
 * Note métier pour une ligne d'effet donnée (nuances non lisibles dans le
 * texte brut). Voir la mémoire projet « iop-spell-semantics ». `index` est la
 * position de la ligne dans la liste d'effets du sort.
 */
export function effectNote(spellId: number, effect: ParsedEffect, index: number): string | null {
  // Pression : le vol de vie n'est effectif que sous l'état Vitalité.
  if (spellId === SPELL_PRESSION && effect.kind === 'steal') {
    return "seulement sous l'état Vitalité"
  }
  // Puissance : 3 lignes = soi (self-cast) / cible / miettes récupérées par soi.
  if (spellId === SPELL_PUISSANCE && effect.kind === 'buff') {
    return (
      ['si lancé sur soi', 'donné à la cible', 'récupéré par soi si cible alliée'][index] ?? null
    )
  }
  // Brokle : effets appliqués à la cible pendant 2 tours.
  if (spellId === SPELL_BROKLE) {
    if (/putsch/i.test(effect.text)) return 'la cible subit +20 % des dégâts de sort reçus'
    if (/maximise/i.test(effect.text)) return 'tes sorts font le roll max sur la cible'
  }
  return null
}
