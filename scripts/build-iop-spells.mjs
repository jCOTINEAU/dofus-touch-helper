#!/usr/bin/env node
/**
 * Construit le jeu de données des sorts Iop (Dofus Touch) en scrapant les pages
 * de détail DIRECTEMENT (côté machine, pas de CORS ni de proxy jina). Résultat
 * écrit dans public/spells-iop.json et committé — l'app le charge pour l'ajout
 * de sorts (feature Dégâts).
 *
 * Chaque sort est scrapé à TOUS ses niveaux (les effets changent par niveau).
 * On conserve le texte brut des effets (normaux + critiques) ; le parsing en
 * effets structurés (dommages / buff de carac / durée) se fait côté app pour
 * pouvoir l'affiner sans re-scraper.
 *
 * Usage : node scripts/build-iop-spells.mjs
 * Nécessite `curl` (gère la redirection à cookie « authlogin » du site).
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DETAILS = 'https://www.dofus-touch.com/fr/mmorpg/encyclopedie/sorts/details'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

// Sorts Iop ciblés (ids relevés sur la page classe /classes/8-iop).
const IOP_SPELLS = [
  { id: 8139, name: 'Pression' },
  { id: 8131, name: 'Epée Divine' },
  { id: 8137, name: 'Puissance' },
  { id: 8121, name: 'Concentration' },
  { id: 8127, name: 'Vitalité' },
  { id: 8133, name: 'Intimidation' },
  { id: 8295, name: 'Epée de Iop' },
  { id: 410, name: 'Brokle' },
]

const jar = join(mkdtempSync(join(tmpdir(), 'dofus-spells-')), 'cookies.txt')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function fetchLevel(id, level) {
  const url = `${DETAILS}?id=${id}&level=${level}&selector=1`
  return execFileSync(
    'curl',
    ['-sL', '-c', jar, '-b', jar, '-A', UA, '--max-time', '40', url],
    { encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 },
  )
}

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&ecirc;/g, 'ê')
    .replace(/&agrave;/g, 'à').replace(/&acirc;/g, 'â').replace(/&ccedil;/g, 'ç')
    .replace(/&ocirc;/g, 'ô').replace(/&ucirc;/g, 'û').replace(/&ugrave;/g, 'ù')
    .replace(/&icirc;/g, 'î').replace(/&iuml;/g, 'ï').replace(/&euml;/g, 'ë')
    .replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;|&#8203;|​/g, ' ')
    .replace(/&[a-z]+;/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

const grab = (html, re) => {
  const m = html.match(re)
  return m ? decode(m[1]) : null
}

/** Extrait les textes d'effet (`.ak-title`) d'une région HTML. */
function effectsIn(region) {
  const out = []
  for (const m of region.matchAll(/class="ak-title">([\s\S]*?)<\/div>/g)) {
    const t = decode(m[1])
    if (t) out.push(t)
  }
  return out
}

/** Découpe la page de détail d'un niveau en attributs structurés. */
function parseLevel(html, level) {
  const poPa = grab(html, /ak-spell-po-pa">([^<]+)</) ?? ''
  const poRange = poPa.match(/(\d+)(?:\s*-\s*(\d+))?\s*PO/)
  const paMatch = poPa.match(/(\d+)\s*PA/)

  const iNorm = html.indexOf('Effets normaux')
  const iCrit = html.indexOf('Effets critiques')
  let iAutres = html.indexOf('Autres caractéristiques')
  if (iAutres < 0) iAutres = html.indexOf('Autres caract')
  if (iAutres < 0) iAutres = iCrit + 6000

  const normal = iNorm >= 0 ? effectsIn(html.slice(iNorm, iCrit >= 0 ? iCrit : iAutres)) : []
  const critical = iCrit >= 0 ? effectsIn(html.slice(iCrit, iAutres)) : []

  const autres = html.slice(iAutres, iAutres + 3000)
  const num = (re) => {
    const m = autres.match(re)
    return m ? Number(m[1]) : null
  }

  return {
    level,
    poMin: poRange ? Number(poRange[1]) : null,
    poMax: poRange ? Number(poRange[2] ?? poRange[1]) : null,
    pa: paMatch ? Number(paMatch[1]) : null,
    levelRequired: Number(grab(html, /ak-spell-required-lvl">Niveau requis\s*(\d+)/) ?? '0') || null,
    critPct: num(/Probabilité de coup critique[^0-9]*(\d+)\s*%/),
    usesPerTurn: num(/Utilisations par tour[^0-9]*(\d+)/),
    cooldown: num(/Intervalle de relance[^0-9]*(\d+)/),
    normal,
    critical,
  }
}

function maxRank(html) {
  let max = 1
  for (const m of html.matchAll(/[?&]level=(\d+)&selector=1/g)) max = Math.max(max, Number(m[1]))
  return max
}

async function scrapeSpell({ id, name }) {
  const firstHtml = fetchLevel(id, 1)
  const ranks = maxRank(firstHtml)
  const realName =
    grab(firstHtml, /ak-spell-name">([\s\S]*?)<span/) || name
  const description = grab(firstHtml, /ak-spell-description">([\s\S]*?)<\/span>/) || ''
  const levels = [parseLevel(firstHtml, 1)]
  for (let lvl = 2; lvl <= ranks; lvl++) {
    await sleep(400)
    let html = ''
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        html = fetchLevel(id, lvl)
        if (html.length > 5000) break
      } catch {
        /* retry */
      }
      await sleep(1500)
    }
    levels.push(parseLevel(html, lvl))
  }
  process.stderr.write(`  ${realName} (id ${id}) : ${ranks} niveaux\n`)
  return { id, name: realName, description, maxLevel: ranks, levels }
}

const spells = []
for (const s of IOP_SPELLS) {
  spells.push(await scrapeSpell(s))
  await sleep(500)
}

const outDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public')
const out = join(outDir, 'spells-iop.json')
writeFileSync(out, JSON.stringify({ version: 1, class: 'iop', spells }, null, 2))
process.stderr.write(`\nOK: ${spells.length} sorts → ${out}\n`)
