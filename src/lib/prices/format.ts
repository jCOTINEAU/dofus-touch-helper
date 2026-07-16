/** Formatage des montants en kamas (fr-FR, arrondi entier). */

const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

export function formatKamas(v: number): string {
  return `${fmt.format(Math.round(v))} k`
}

/** Durée lisible : "45 min", "2 h 05", "1 h". */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}
