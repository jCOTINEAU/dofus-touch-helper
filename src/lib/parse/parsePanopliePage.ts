/**
 * Parse le markdown r.jina.ai d'une page panoplie : nom de la panoplie et
 * liste de ses équipements (id, nom, url) — chacun sera ensuite ajouté au
 * projet comme cible et développé récursivement.
 */

import { extractItemId } from '../fetch/url'
import { EmptyPageError } from './parseItemPage'

export interface PanoplieItem {
  itemId: number
  name: string
  url: string
}

export interface ParsedPanoplie {
  id: number
  name: string
  items: PanoplieItem[]
}

// Lien nom (non-image) vers un équipement/arme de la panoplie.
const ITEM_LINK_RE =
  /(?<!\])\[([^\]!][^\]]*)\]\((https:\/\/www\.dofus-touch\.com\/fr\/mmorpg\/encyclopedie\/(?:equipements|armes)\/(\d+)-[^)]+)\)/g

export function parsePanopliePage(markdown: string, sourceUrl: string): ParsedPanoplie {
  const id = extractItemId(sourceUrl)
  if (id === null) throw new Error(`URL panoplie invalide : ${sourceUrl}`)

  const titleLine = markdown.split('\n').find((l) => l.startsWith('Title:')) ?? ''
  const name = titleLine.slice('Title:'.length).split(' - ')[0].trim()
  if (name === '') throw new EmptyPageError(sourceUrl)

  const items: PanoplieItem[] = []
  const seen = new Set<number>()
  for (const m of markdown.matchAll(ITEM_LINK_RE)) {
    const label = m[1].trim()
    if (label === 'Voir la recette') continue // lien secondaire de chaque item
    const itemId = Number(m[3])
    if (seen.has(itemId)) continue
    seen.add(itemId)
    items.push({ itemId, name: label, url: m[2] })
  }
  return { id, name, items }
}
