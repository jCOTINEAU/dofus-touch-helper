/** Formatage des montants en kamas (fr-FR, arrondi entier). */

const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

export function formatKamas(v: number): string {
  return `${fmt.format(Math.round(v))} k`
}
