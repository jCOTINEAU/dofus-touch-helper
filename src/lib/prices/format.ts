/** Formatage des montants en kamas (fr-FR, arrondi entier). */

const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

export function formatKamas(v: number): string {
  return `${fmt.format(Math.round(v))} k`
}

/** Ancienneté lisible : "à l'instant", "il y a 5 min / 3 h / 6 j". */
export function formatRelativeTime(thenMs: number, nowMs: number): string {
  const minutes = Math.floor((nowMs - thenMs) / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  return `il y a ${Math.floor(hours / 24)} j`
}

/** Durée lisible : "45 min", "2 h 05", "1 h". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return '< 1 min'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}
