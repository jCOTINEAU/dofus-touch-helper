/**
 * Métriques d'une session de farm, calculées à partir des combats mesurés.
 * L'espérance de kamas par combat est injectée (fonction pure) pour rester
 * indépendant des prix / monstres / modificateurs.
 */

import type { SessionCombat } from '../types'

export interface SessionMetrics {
  combatCount: number
  totalMonsters: number
  /** Kamas espérés cumulés sur la session. */
  totalExpectedKamas: number
  /** Durée moyenne d'un combat (s), null si aucun combat. */
  avgCombatSec: number | null
  /** Temps de combat moyen par monstre (s), null si aucun monstre. */
  avgSecPerMonster: number | null
  /** Temps d'exploration moyen entre combats (s), null si aucun combat. */
  avgIdleSec: number | null
  /** Temps total de combat (s). */
  totalCombatSec: number
  /** Temps total d'exploration (s). */
  totalIdleSec: number
  /** Kamas espérés par heure (combat + exploration), null si durée nulle. */
  kamasPerHour: number | null
}

export function sessionMetrics(
  combats: readonly SessionCombat[],
  expectedKamasOf: (creatures: SessionCombat['creatures']) => number,
): SessionMetrics {
  const combatCount = combats.length
  let totalMonsters = 0
  let totalExpectedKamas = 0
  let totalCombatSec = 0
  let totalIdleSec = 0
  for (const c of combats) {
    totalMonsters += c.creatures.reduce((n, cr) => n + cr.count, 0)
    totalExpectedKamas += expectedKamasOf(c.creatures)
    totalCombatSec += c.durationSec
    totalIdleSec += c.idleBeforeSec
  }
  const totalSec = totalCombatSec + totalIdleSec
  return {
    combatCount,
    totalMonsters,
    totalExpectedKamas,
    totalCombatSec,
    totalIdleSec,
    avgCombatSec: combatCount > 0 ? totalCombatSec / combatCount : null,
    avgSecPerMonster: totalMonsters > 0 ? totalCombatSec / totalMonsters : null,
    avgIdleSec: combatCount > 0 ? totalIdleSec / combatCount : null,
    kamasPerHour: totalSec > 0 ? (totalExpectedKamas * 3600) / totalSec : null,
  }
}
