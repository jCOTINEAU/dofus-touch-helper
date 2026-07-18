import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMonsterPage } from './parseMonsterPage'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = 'https://www.dofus-touch.com/fr/mmorpg/encyclopedie/monstres'
const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf-8')

describe('parseMonsterPage', () => {
  it('Bouftou : drops réguliers + conditionnels distingués', () => {
    const m = parseMonsterPage(fixture('monstre-bouftou.md'), `${BASE}/101-bouftou`)
    expect(m.id).toBe(101)
    expect(m.name).toBe('Bouftou')

    const regular = m.drops.filter((d) => !d.conditional)
    expect(regular.map((d) => [d.itemId, d.name, d.dropRatePct])).toEqual([
      [1736, 'Citron', 16],
      [385, 'Bave de Bouftou', 9],
      [383, 'Corne de Bouftou', 18],
    ])

    const conditional = m.drops.filter((d) => d.conditional)
    // Cuisse de Bouftou ** → le « ** » est nettoyé.
    const cuisse = conditional.find((d) => d.itemId === 1912)
    expect(cuisse).toMatchObject({ name: 'Cuisse de Bouftou', dropRatePct: 55, conditional: true })
    expect(conditional.find((d) => d.itemId === 2422)).toMatchObject({ dropRatePct: 0.08 })
  })

  it('Aboub : un drop régulier, le reste conditionnel', () => {
    const m = parseMonsterPage(fixture('monstre-aboub.md'), `${BASE}/384-aboub`)
    expect(m.name).toBe('Aboub')
    const regular = m.drops.filter((d) => !d.conditional)
    expect(regular).toHaveLength(1)
    expect(regular[0]).toMatchObject({ itemId: 13729, name: 'Papier Charbon', dropRatePct: 19 })
  })

  it('monstre sans butins : drops vide, pas d’erreur', () => {
    const md = `Title: Vide - Bestiaire - Encyclopédie DOFUS\n\nMarkdown Content:\n\nCaractéristiques\n`
    const m = parseMonsterPage(md, `${BASE}/36-bouftou`)
    expect(m.drops).toEqual([])
  })
})
