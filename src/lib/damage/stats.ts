/**
 * Caractéristiques d'un profil de stats (feature « Dégâts »).
 * Liste volontairement extensible : ajouter une clé ici + son libellé
 * suffit à la propager aux formulaires et (plus tard) au calcul.
 */

export const STAT_KEYS = ['force', 'dommages', 'puissance'] as const
export type StatKey = (typeof STAT_KEYS)[number]

export const STAT_LABELS: Record<StatKey, string> = {
  force: 'Force',
  dommages: 'Dommages',
  puissance: 'Puissance',
}

export type Stats = Record<StatKey, number>

/** Profil de stats : un nom + une valeur par caractéristique. */
export interface StatProfile {
  id?: number
  name: string
  stats: Stats
}

/** Stats à zéro (pour un nouveau profil ou compléter un profil partiel). */
export function emptyStats(): Stats {
  return Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Stats
}

/** Complète un profil chargé avec d'éventuelles nouvelles caractéristiques. */
export function normalizeStats(stats: Partial<Stats> | undefined): Stats {
  const base = emptyStats()
  if (stats) for (const k of STAT_KEYS) if (typeof stats[k] === 'number') base[k] = stats[k]!
  return base
}
