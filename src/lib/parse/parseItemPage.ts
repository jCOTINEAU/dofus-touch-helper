/**
 * Parse le markdown renvoyé par r.jina.ai pour une page objet de
 * l'encyclopédie Dofus Touch.
 *
 * Structure observée (fixtures dans __fixtures__/) :
 *
 *   Title: Anneau du Cycloïde - Anneau - Anneau - Encyclopédie DOFUS - …
 *   URL Source: https://www.dofus-touch.com/fr/mmorpg/encyclopedie/equipements/14092-anneau-cycloide
 *   [Warning: Target URL returned error 404: Not Found]   ← page morte
 *   Markdown Content:
 *   …
 *   Niveau : 200                     ← niveau de l'objet
 *   …
 *   Recette                          ← absent = ressource de base
 *   Bijoutier Niveau 100
 *   38 x
 *   [![Image 42](img)](url-composant)
 *   [Cuir de Glouragan](url-composant)
 *   Cuir
 *   Niv. 190
 *   … (composant suivant ouvert par la prochaine ligne « N x »)
 *
 * La section « Panoplie » qui suit la recette contient des liens au même
 * format mais sans ligne « N x » : la collecte est donc strictement
 * conditionnée par l'ouverture « N x ».
 */

import type { Recipe, RecipeComponent } from '../types'
import { extractItemId } from '../fetch/url'

/** Page 404 côté encyclopédie (objet retiré du jeu). */
export class DeadPageError extends Error {
  constructor(url: string) {
    super(`Page encyclopédie morte (404) : ${url}`)
    this.name = 'DeadPageError'
  }
}

/** Réponse vide de jina (transitoire — à réessayer). */
export class EmptyPageError extends Error {
  constructor(url: string) {
    super(`Réponse jina vide pour : ${url}`)
    this.name = 'EmptyPageError'
  }
}

/** Contenu inattendu (recette sans composant, etc.). */
export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

export interface ParsedItem {
  id: number
  name: string
  category: string | null
  level: number | null
  imageUrl: string | null
  recipe: Recipe | null
}

const QTY_RE = /^(\d+)\s*x$/
const IMAGE_LINK_RE = /^\[!\[[^\]]*\]\(([^)]+)\)\]\(([^)]+)\)$/
const NAME_LINK_RE = /^\[([^\]]+)\]\((https?:[^)]+)\)$/
const COMPONENT_LEVEL_RE = /^Niv\.\s*(\d+)$/
const JOB_RE = /^(.+?)\s+Niveau\s+(\d+)$/
const ITEM_LEVEL_RE = /^Niveau\s*:\s*(\d+)$/
const ITEM_IMAGE_RE = /^!\[[^\]]*\]\((https:\/\/static\.ankama\.com\/dofus-touch\/[^)]+)\)$/

export function parseItemPage(markdown: string, sourceUrl: string): ParsedItem {
  const id = extractItemId(sourceUrl)
  if (id === null) throw new ParseError(`URL sans id d'objet : ${sourceUrl}`)

  const lines = markdown.split('\n').map((l) => l.trim())

  // --- En-tête jina ---
  const titleLine = lines.find((l) => l.startsWith('Title:'))
  const contentStart = lines.findIndex((l) => l.startsWith('Markdown Content:'))
  const header = lines.slice(0, contentStart === -1 ? 10 : contentStart)
  if (header.some((l) => l.startsWith('Warning:') && l.includes('404'))) {
    throw new DeadPageError(sourceUrl)
  }
  const title = titleLine ? titleLine.slice('Title:'.length).trim() : ''
  const body = contentStart === -1 ? [] : lines.slice(contentStart + 1)
  if (title === '' || body.every((l) => l === '')) {
    throw new EmptyPageError(sourceUrl)
  }

  const titleParts = title.split(' - ')
  const name = titleParts[0].trim()
  const category = titleParts.length > 1 ? titleParts[1].trim() : null

  // --- Corps : niveau et image de l'objet (avant la section Recette) ---
  const recipeStart = body.findIndex((l) => l === 'Recette')
  const beforeRecipe = recipeStart === -1 ? body : body.slice(0, recipeStart)

  let level: number | null = null
  let imageUrl: string | null = null
  for (const line of beforeRecipe) {
    if (level === null) {
      const m = ITEM_LEVEL_RE.exec(line)
      if (m) level = Number(m[1])
    }
    if (imageUrl === null) {
      const m = ITEM_IMAGE_RE.exec(line)
      if (m) imageUrl = m[1]
    }
  }

  // --- Recette ---
  let recipe: Recipe | null = null
  if (recipeStart !== -1) {
    recipe = parseRecipe(body.slice(recipeStart + 1), sourceUrl)
  }

  return { id, name, category, level, imageUrl, recipe }
}

function parseRecipe(lines: string[], sourceUrl: string): Recipe {
  let job = ''
  let jobLevel = 0
  const components: RecipeComponent[] = []

  let current: Partial<RecipeComponent> & { qty: number } & {
    name?: string
  } = null as never
  let open = false

  const close = () => {
    if (open && current.name !== undefined) {
      components.push({
        itemId: current.itemId!,
        name: current.name,
        url: current.url!,
        qty: current.qty,
        category: current.category ?? null,
        level: current.level ?? null,
        imageUrl: current.imageUrl ?? null,
      })
    }
    open = false
  }

  for (const line of lines) {
    if (line === '') continue

    if (job === '') {
      const m = JOB_RE.exec(line)
      if (m) {
        job = m[1].trim()
        jobLevel = Number(m[2])
      }
      continue
    }

    const qtyMatch = QTY_RE.exec(line)
    if (qtyMatch) {
      close()
      current = { qty: Number(qtyMatch[1]) }
      open = true
      continue
    }
    if (!open) continue

    const imgMatch = IMAGE_LINK_RE.exec(line)
    if (imgMatch) {
      current.imageUrl = imgMatch[1]
      continue
    }
    const nameMatch = NAME_LINK_RE.exec(line)
    if (nameMatch && current.name === undefined) {
      const itemId = extractItemId(nameMatch[2])
      if (itemId !== null) {
        current.name = nameMatch[1].trim()
        current.url = nameMatch[2]
        current.itemId = itemId
      }
      continue
    }
    const levelMatch = COMPONENT_LEVEL_RE.exec(line)
    if (levelMatch) {
      current.level = Number(levelMatch[1])
      close()
      continue
    }
    // Ligne de texte nue après le nom = catégorie du composant.
    if (current.name !== undefined && current.category === undefined && !line.startsWith('[')) {
      current.category = line
    }
  }
  close()

  if (job === '' || components.length === 0) {
    throw new ParseError(`Section Recette illisible (métier: "${job}", ${components.length} composants) : ${sourceUrl}`)
  }
  return { job, jobLevel, components }
}
