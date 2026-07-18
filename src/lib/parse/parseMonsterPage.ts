/**
 * Parse le markdown r.jina.ai d'une page monstre du bestiaire Dofus Touch.
 *
 * La section « Butins » liste les drops : image, lien nom, taux « X % »,
 * niveau. Une sous-section « Butins conditionnés » suit avec les drops
 * conditionnels (rares, objets de quête/équipement…). Un monstre sans
 * drop est valide (drops vide) — contrairement à une recette, on ne lève
 * pas d'erreur.
 */

import type { MonsterDrop } from '../types'
import { extractItemId } from '../fetch/url'
import { DeadPageError, EmptyPageError } from './parseItemPage'

export interface ParsedMonster {
  id: number
  name: string
  imageUrl: string | null
  drops: MonsterDrop[]
}

const DROP_RE = new RegExp(
  '\\[([^\\]]+)\\]\\(' + // [Nom]
    '(https://www\\.dofus-touch\\.com/fr/mmorpg/encyclopedie/[a-z-]+/(\\d+)-[^)]+)\\)' + // (url)
    '\\s*([\\d.,]+)\\s*%', // taux X %
  'g',
)
const MONSTER_IMG_RE =
  /!\[[^\]]*\]\((https:\/\/static\.ankama\.com\/dofus-touch\/[^)]*\/monsters\/[^)]+)\)/

/** Fin de la zone de butins (au-delà = animations, caractéristiques…). */
const SECTION_END = ['Animations des sorts', 'Caractéristiques', 'Résistances', 'Partager']

export function parseMonsterPage(markdown: string, sourceUrl: string): ParsedMonster {
  const id = extractItemId(sourceUrl)
  if (id === null) throw new Error(`URL monstre invalide : ${sourceUrl}`)

  const titleLine = markdown.split('\n').find((l) => l.startsWith('Title:')) ?? ''
  if (/Warning:.*404/.test(markdown)) throw new DeadPageError(sourceUrl)
  const name = titleLine.slice('Title:'.length).split(' - ')[0].trim()
  if (name === '') throw new EmptyPageError(sourceUrl)

  const imgMatch = MONSTER_IMG_RE.exec(markdown)
  const imageUrl = imgMatch ? imgMatch[1] : null

  const drops: MonsterDrop[] = []
  const butinStart = markdown.indexOf('Butins')
  if (butinStart !== -1) {
    // Borne la zone de butins pour ne pas capturer d'autres liens.
    let end = markdown.length
    for (const marker of SECTION_END) {
      const j = markdown.indexOf(marker, butinStart)
      if (j !== -1) end = Math.min(end, j)
    }
    const region = markdown.slice(butinStart, end)
    // Position (relative) de la sous-section conditionnelle.
    const condIdx = region.indexOf('conditionn')

    DROP_RE.lastIndex = 0
    for (const m of region.matchAll(DROP_RE)) {
      const itemId = extractItemId(m[2])
      if (itemId === null) continue
      drops.push({
        itemId,
        name: m[1].replace(/\s*\*+\s*$/, '').trim(), // enlève un éventuel « ** »
        url: m[2],
        dropRatePct: Number(m[4].replace(',', '.')),
        conditional: condIdx !== -1 && (m.index ?? 0) >= condIdx,
      })
    }
  }

  return { id, name, imageUrl, drops }
}
