/**
 * Statistiques de prix HDV. Le prix saisi est toujours le prix du LOT
 * entier (1, 10 ou 100 unités) ; les stats sont calculées en prix
 * unitaire (lotPrice / lotSize) mais SÉPARÉMENT par taille de lot : une
 * divergence forte entre lots est un signal d'achat/revente.
 */

import type { PriceEntry } from '../types'

export const LOT_SIZES = [1, 10, 100] as const
export type LotSize = (typeof LOT_SIZES)[number]

export interface PricePoint {
  t: number
  /** Prix du lot entier. */
  lot: number
  /** Prix unitaire (lot / taille). */
  unit: number
}

export function unitPrice(e: PriceEntry): number {
  return e.lotPrice / e.lotSize
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Points triés par date croissante, par taille de lot. */
export function seriesByLot(entries: readonly PriceEntry[]): Record<LotSize, PricePoint[]> {
  const result: Record<LotSize, PricePoint[]> = { 1: [], 10: [], 100: [] }
  for (const e of [...entries].sort((a, b) => a.recordedAt - b.recordedAt)) {
    result[e.lotSize].push({ t: e.recordedAt, lot: e.lotPrice, unit: unitPrice(e) })
  }
  return result
}

/**
 * Fenêtre de « session de relevés » : des prix saisis à quelques secondes
 * ou minutes d'intervalle (typiquement les lots 1/10/100 relevés d'un coup
 * à l'HDV) sont regroupés sur un même point de l'axe du temps.
 */
export const SESSION_WINDOW_MS = 10 * 60 * 1000

/**
 * Regroupe des points (triés chronologiquement) par fenêtre : le dernier
 * relevé de la fenêtre gagne, et le point est recalé au centre de la
 * fenêtre. Les fenêtres étant absolues, toutes les séries d'un même item
 * partagent les mêmes positions x.
 */
export function bucketPoints(
  points: readonly PricePoint[],
  windowMs = SESSION_WINDOW_MS,
): PricePoint[] {
  const byBucket = new Map<number, PricePoint>()
  for (const p of points) {
    byBucket.set(Math.floor(p.t / windowMs), p)
  }
  return [...byBucket.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucket, p]) => ({ ...p, t: bucket * windowMs + windowMs / 2 }))
}

export interface LotStats {
  /** Moyenne du prix unitaire. */
  mean: number | null
  /** Médiane du prix unitaire. */
  median: number | null
  /** Dernier prix unitaire relevé. */
  last: number | null
  count: number
}

export function lotStats(points: readonly PricePoint[]): LotStats {
  if (points.length === 0) return { mean: null, median: null, last: null, count: 0 }
  const units = points.map((p) => p.unit)
  return {
    mean: units.reduce((a, b) => a + b, 0) / units.length,
    median: median(units),
    last: points[points.length - 1].unit,
    count: points.length,
  }
}

export interface RecentMedianOptions {
  windowDays?: number
  maxEntries?: number
}

/**
 * Prix unitaire de référence d'une ressource : médiane des relevés
 * récents (< 30 j, 10 max, toutes tailles de lot confondues). S'il n'y a
 * aucun relevé récent, repli sur le relevé le plus récent ; null si aucun
 * relevé du tout.
 */
export function recentMedianUnit(
  entries: readonly PriceEntry[],
  now: number,
  opts: RecentMedianOptions = {},
): number | null {
  if (entries.length === 0) return null
  const windowMs = (opts.windowDays ?? 30) * 24 * 3600 * 1000
  const maxEntries = opts.maxEntries ?? 10
  const sorted = [...entries].sort((a, b) => b.recordedAt - a.recordedAt)
  const recent = sorted.filter((e) => now - e.recordedAt <= windowMs).slice(0, maxEntries)
  if (recent.length === 0) return unitPrice(sorted[0])
  return median(recent.map(unitPrice))
}

export interface Divergence {
  /** Dernier prix unitaire par taille de lot (null si jamais relevé). */
  byLot: Record<LotSize, number | null>
  /** Écart (max−min)/min en %, sur les lots relevés ; null si < 2 lots. */
  spreadPct: number | null
}

export function divergence(entries: readonly PriceEntry[]): Divergence {
  const series = seriesByLot(entries)
  const byLot: Record<LotSize, number | null> = { 1: null, 10: null, 100: null }
  for (const size of LOT_SIZES) {
    const points = series[size]
    byLot[size] = points.length > 0 ? points[points.length - 1].unit : null
  }
  const units = LOT_SIZES.map((s) => byLot[s]).filter((u): u is number => u !== null)
  const spreadPct =
    units.length >= 2 ? ((Math.max(...units) - Math.min(...units)) / Math.min(...units)) * 100 : null
  return { byLot, spreadPct }
}
