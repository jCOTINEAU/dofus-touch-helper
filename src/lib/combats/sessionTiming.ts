/**
 * Helpers purs de chronométrage de session de farm (testables).
 */

/** Durée maximale plausible d'une phase (3 h) — au-delà, l'app a été laissée
 * ouverte : on plafonne pour ne pas fausser les moyennes. */
export const MAX_PHASE_SEC = 3 * 3600

/** Secondes écoulées depuis `phaseStartedAt`, pause déduite, jamais négatif. */
export function elapsedSec(
  phaseStartedAt: number,
  pausedAt: number | null,
  pausedAccumMs: number,
  now: number,
): number {
  const ref = pausedAt ?? now
  return Math.max(0, Math.round((ref - phaseStartedAt - pausedAccumMs) / 1000))
}

/** Plafonne une durée enregistrée (exploration/combat) à MAX_PHASE_SEC. */
export function capSec(seconds: number): number {
  return Math.min(Math.max(0, seconds), MAX_PHASE_SEC)
}
