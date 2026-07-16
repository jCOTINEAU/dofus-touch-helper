import { describe, expect, it } from 'vitest'
import { formatDuration, formatKamas, formatRelativeTime } from './format'

describe('formatKamas', () => {
  it('arrondit et sépare les milliers (fr, espace fine insécable)', () => {
    expect(formatKamas(1234567.4)).toBe('1\u202f234\u202f567 k')
    expect(formatKamas(0)).toBe('0 k')
  })
})

describe('formatDuration', () => {
  it('minutes, heures, heures+minutes', () => {
    expect(formatDuration(30)).toBe('< 1 min')
    expect(formatDuration(45 * 60)).toBe('45 min')
    expect(formatDuration(3600)).toBe('1 h')
    expect(formatDuration(2 * 3600 + 5 * 60)).toBe('2 h 05')
  })
})

describe('formatRelativeTime', () => {
  const NOW = 1_800_000_000_000
  const MIN = 60_000
  it("instant, minutes, heures, jours", () => {
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe("à l'instant")
    expect(formatRelativeTime(NOW - 5 * MIN, NOW)).toBe('il y a 5 min')
    expect(formatRelativeTime(NOW - 3 * 60 * MIN, NOW)).toBe('il y a 3 h')
    expect(formatRelativeTime(NOW - 6 * 24 * 60 * MIN, NOW)).toBe('il y a 6 j')
  })
})
