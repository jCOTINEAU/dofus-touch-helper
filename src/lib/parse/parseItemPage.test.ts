import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
import { DeadPageError, EmptyPageError, ParseError, parseItemPage } from './parseItemPage'
import { extractItemId, isEncyclopediaItemUrl, normalizeItemUrl } from '../fetch/url'

const BASE = 'https://www.dofus-touch.com/fr/mmorpg/encyclopedie'
const fixture = (name: string) =>
  readFileSync(join(__dirname, '__fixtures__', name), 'utf-8')

describe('parseItemPage', () => {
  it('équipement avec recette multi-composants (Anneau du Cycloïde)', () => {
    const item = parseItemPage(
      fixture('equipement-anneau-cycloide.md'),
      `${BASE}/equipements/14092-anneau-cycloide`,
    )
    expect(item.id).toBe(14092)
    expect(item.name).toBe('Anneau du Cycloïde')
    expect(item.category).toBe('Anneau')
    expect(item.level).toBe(200)
    expect(item.imageUrl).toMatch(/static\.ankama\.com.*items/)
    expect(item.recipe).not.toBeNull()
    expect(item.recipe!.job).toBe('Bijoutier')
    expect(item.recipe!.jobLevel).toBe(100)
    expect(item.recipe!.components).toHaveLength(8)

    const first = item.recipe!.components[0]
    expect(first).toMatchObject({
      itemId: 11938,
      name: 'Cuir de Glouragan',
      qty: 38,
      category: 'Cuir',
      level: 190,
    })
    expect(first.url).toBe(`${BASE}/ressources/11938-cuir-glouragan`)

    const last = item.recipe!.components[7]
    expect(last).toMatchObject({ itemId: 16852, qty: 1, name: 'Essence de Comte Harebourg' })

    // La section Panoplie qui suit la recette ne doit PAS contaminer les composants.
    const names = item.recipe!.components.map((c) => c.name)
    expect(names).not.toContain('Amulette du Cycloïde')
  })

  it('ressource de base sans recette (Cuir de Glouragan)', () => {
    const item = parseItemPage(
      fixture('ressource-cuir-glouragan.md'),
      `${BASE}/ressources/11938-cuir-glouragan`,
    )
    expect(item.id).toBe(11938)
    expect(item.name).toBe('Cuir de Glouragan')
    expect(item.category).toBe('Cuir')
    expect(item.recipe).toBeNull()
  })

  it('recette avec composant sous /consommables/ (Essence de Comte Harebourg)', () => {
    const item = parseItemPage(
      fixture('ressource-essence-comte-harebourg.md'),
      `${BASE}/ressources/16852-essence-comte-harebourg`,
    )
    expect(item.recipe!.job).toBe('Alchimiste')
    expect(item.recipe!.jobLevel).toBe(100)
    expect(item.recipe!.components).toHaveLength(8)
    const entrecote = item.recipe!.components.find((c) => c.itemId === 8506)
    expect(entrecote).toBeDefined()
    expect(entrecote!.url).toContain('/consommables/')
    expect(entrecote!.qty).toBe(2)
  })

  it('recette référençant un composant mort (Bocal dans la Potion)', () => {
    const item = parseItemPage(
      fixture('ressource-potion-metal-precieux.md'),
      `${BASE}/ressources/2541-potion-metal-precieux-liquide`,
    )
    expect(item.recipe!.job).toBe('Mineur')
    expect(item.recipe!.components).toHaveLength(5)
    const bocal = item.recipe!.components.find((c) => c.itemId === 1468)
    expect(bocal).toMatchObject({ name: 'Bocal', qty: 1 })
  })

  it('consommable craftable (Entrecôte de Crocodaille)', () => {
    const item = parseItemPage(
      fixture('consommable-entrecote-crocodaille.md'),
      `${BASE}/consommables/8506-entrecote-crocodaille`,
    )
    expect(item.name).toBe('Entrecôte de Crocodaille')
    expect(item.category).toBe('Viande comestible')
    expect(item.recipe!.job).toBe('Boucher')
    expect(item.recipe!.jobLevel).toBe(80)
    expect(item.recipe!.components).toHaveLength(7)
  })

  it('recette sans métier (Farine de Houblon, fabriquée au Moulin)', () => {
    const item = parseItemPage(
      fixture('ressource-farine-houblon-sans-metier.md'),
      `${BASE}/ressources/535-farine-houblon`,
    )
    expect(item.name).toBe('Farine de Houblon')
    expect(item.recipe).not.toBeNull()
    // Pas de ligne « Métier Niveau X » sur la page → job vide, mais recette valide.
    expect(item.recipe!.job).toBe('')
    expect(item.recipe!.jobLevel).toBe(0)
    expect(item.recipe!.components).toHaveLength(1)
    expect(item.recipe!.components[0]).toMatchObject({ itemId: 401, name: 'Houblon', qty: 2 })
    // La section « Est utilisé pour les recettes » ne doit pas polluer les composants.
    const names = item.recipe!.components.map((c) => c.name)
    expect(names).not.toContain('Baguette Deuh-Pain')
  })

  it('page morte → DeadPageError', () => {
    expect(() =>
      parseItemPage(fixture('page-morte-bocal.md'), `${BASE}/ressources/1468-bocal`),
    ).toThrow(DeadPageError)
  })

  it('réponse jina vide → EmptyPageError', () => {
    const empty = `Title: \n\nURL Source: ${BASE}/ressources/11938-cuir-glouragan\n\nMarkdown Content:\n\n`
    expect(() =>
      parseItemPage(empty, `${BASE}/ressources/11938-cuir-glouragan`),
    ).toThrow(EmptyPageError)
  })

  it('URL sans id → ParseError', () => {
    expect(() => parseItemPage('Title: x\n\nMarkdown Content:\nx', 'https://exemple.com/nope')).toThrow(
      ParseError,
    )
  })
})

describe('url helpers', () => {
  it('extractItemId', () => {
    expect(extractItemId(`${BASE}/equipements/14092-anneau-cycloide`)).toBe(14092)
    expect(extractItemId(`${BASE}/ressources/1468-bocal/`)).toBe(1468)
    expect(extractItemId(`${BASE}/ressources/1468-bocal?x=1`)).toBe(1468)
    expect(extractItemId('https://exemple.com/pas-un-objet')).toBeNull()
  })

  it('normalizeItemUrl + isEncyclopediaItemUrl', () => {
    expect(normalizeItemUrl(`  ${BASE}/ressources/1468-bocal/?a=b#c  `)).toBe(
      `${BASE}/ressources/1468-bocal`,
    )
    expect(isEncyclopediaItemUrl(`${BASE}/equipements/14092-anneau-cycloide`)).toBe(true)
    expect(isEncyclopediaItemUrl('https://www.dofus.com/fr/mmorpg/encyclopedie/equipements/1-x')).toBe(
      false,
    )
  })
})
