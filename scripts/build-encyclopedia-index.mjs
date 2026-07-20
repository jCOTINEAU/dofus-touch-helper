#!/usr/bin/env node
/**
 * Construit l'index de recherche de l'encyclopédie Dofus Touch (nom → id/url/type)
 * en scrapant les pages de listing DIRECTEMENT (côté machine, pas de CORS ni
 * de proxy jina). Le résultat est écrit dans public/encyclopedia-index.json
 * et committé — l'app le charge pour permettre l'ajout/recherche par nom.
 *
 * Usage : node scripts/build-encyclopedia-index.mjs [--cat=ressources] [--maxpages=N]
 * (sans argument : toutes les catégories)
 *
 * Nécessite `curl` (gère la redirection à cookie « authlogin » du site).
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://www.dofus-touch.com/fr/mmorpg/encyclopedie'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const CATEGORIES = ['ressources', 'equipements', 'armes', 'consommables', 'panoplies', 'monstres']

const jar = join(mkdtempSync(join(tmpdir(), 'dofus-idx-')), 'cookies.txt')
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')),
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function fetchPage(url) {
  return execFileSync(
    'curl',
    ['-sL', '-c', jar, '-b', jar, '-A', UA, '--max-time', '40', url],
    { encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 },
  )
}

const decode = (s) =>
  s
    .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&ecirc;/g, 'ê')
    .replace(/&agrave;/g, 'à').replace(/&acirc;/g, 'â').replace(/&ccedil;/g, 'ç')
    .replace(/&ocirc;/g, 'ô').replace(/&ucirc;/g, 'û').replace(/&ugrave;/g, 'ù')
    .replace(/&icirc;/g, 'î').replace(/&iuml;/g, 'ï').replace(/&euml;/g, 'ë')
    .replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;|&#8203;|​/g, ' ')
    .replace(/&[a-z]+;/gi, '').trim()

function extract(html, cat) {
  const re = new RegExp(
    `<a href="(/fr/mmorpg/encyclopedie/${cat}/(\\d+)-[^"]+)">([^<]+)</a>`,
    'g',
  )
  const out = []
  for (const m of html.matchAll(re)) {
    const name = decode(m[3])
    if (name) out.push({ id: Number(m[2]), name, url: 'https://www.dofus-touch.com' + m[1], type: cat })
  }
  return out
}

function maxPage(html) {
  let max = 1
  for (const m of html.matchAll(/[?&]page=(\d+)/g)) max = Math.max(max, Number(m[1]))
  return max
}

async function scrapeCategory(cat, capPages) {
  const first = fetchPage(`${BASE}/${cat}`)
  const last = Math.min(maxPage(first), capPages ?? Infinity)
  const byId = new Map()
  for (const e of extract(first, cat)) byId.set(e.id, e)
  process.stderr.write(`${cat}: ${last} pages\n`)
  for (let p = 2; p <= last; p++) {
    await sleep(300)
    let html = ''
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        html = fetchPage(`${BASE}/${cat}?page=${p}`)
        if (html.length > 2000) break
      } catch {
        /* retry */
      }
      await sleep(1500)
    }
    for (const e of extract(html, cat)) byId.set(e.id, e)
    if (p % 10 === 0) process.stderr.write(`  ${cat} ${p}/${last} (${byId.size})\n`)
  }
  return [...byId.values()]
}

const cats = args.cat ? [args.cat] : CATEGORIES
const capPages = args.maxpages ? Number(args.maxpages) : undefined
const entries = []
for (const cat of cats) {
  entries.push(...(await scrapeCategory(cat, capPages)))
}
entries.sort((a, b) => a.name.localeCompare(b.name, 'fr'))

const outDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public')
const out = join(outDir, 'encyclopedia-index.json')
writeFileSync(out, JSON.stringify({ version: 1, entries }))
process.stderr.write(`\nOK: ${entries.length} entrées → ${out}\n`)
