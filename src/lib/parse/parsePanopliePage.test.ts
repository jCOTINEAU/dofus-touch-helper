import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePanopliePage } from './parsePanopliePage'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = 'https://www.dofus-touch.com/fr/mmorpg/encyclopedie/panoplies'
const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf-8')

describe('parsePanopliePage', () => {
  it('Panoplie du Cycloïde : nom + équipements dédupliqués', () => {
    const p = parsePanopliePage(fixture('panoplie-cycloide.md'), `${BASE}/273-panoplie-cycloide`)
    expect(p.id).toBe(273)
    expect(p.name).toBe('Panoplie du Cycloïde')
    expect(p.items.map((i) => [i.itemId, i.name])).toEqual([
      [14091, 'Amulette du Cycloïde'],
      [14092, 'Anneau du Cycloïde'],
      [14093, 'Bottes du Cycloïde'],
    ])
    // « Voir la recette » ne pollue pas, pas de doublon.
    expect(p.items.every((i) => i.name !== 'Voir la recette')).toBe(true)
  })
})
