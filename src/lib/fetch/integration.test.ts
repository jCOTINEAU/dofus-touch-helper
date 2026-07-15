/**
 * Test d'intégration RÉSEAU RÉEL (encyclopédie via r.jina.ai).
 * Lancement manuel : INTEGRATION=1 npm test -- --run integration
 * Résultats attendus validés par dofus_craft.py (référence à la racine).
 */

import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { expandCraftTree } from './expand'
import { loadCatalog } from '../db/repo'
import { computeNeeds } from '../needs/needs'

const RING_URL =
  'https://www.dofus-touch.com/fr/mmorpg/encyclopedie/equipements/14092-anneau-cycloide'

describe.runIf(process.env.INTEGRATION === '1')('expansion réelle Anneau du Cycloïde', () => {
  it(
    'expanse tout l’arbre et retrouve les totaux du script Python',
    { timeout: 300_000 },
    async () => {
      const result = await expandCraftTree(RING_URL, {
        onProgress: (p) =>
          process.stdout.write(`\r${p.done}/${p.discovered} pages (cache: ${p.fromCache})   `),
      })
      process.stdout.write('\n')

      expect(result.rootId).toBe(14092)
      // Le Bocal (1468) est mort dans l'encyclopédie.
      expect(result.warnings.some((w) => w.includes('Bocal'))).toBe(true)

      const ring = (await db.items.get(14092))!
      expect(ring.recipe!.job).toBe('Bijoutier')
      expect(ring.recipe!.jobLevel).toBe(100)
      expect(ring.recipe!.components).toHaveLength(8)

      // Totaux de ressources de base pour 1 anneau, validés via dofus_craft.py :
      // 38 Cuir de Glouragan, 20 Or, 10 Bocal (mort), 12-2=… — on vérifie
      // un sous-ensemble stable.
      const catalog = await loadCatalog()
      const needs = computeNeeds(catalog, [{ itemId: 14092, qty: 1 }], new Map())
      const req = (id: number) => needs.byItem.get(id)?.required ?? 0
      expect(req(11938)).toBe(38) // Cuir de Glouragan
      expect(req(313)).toBe(20) // Or (10 potions × 2)
      expect(req(1468)).toBe(10) // Bocal (mort, compté tel quel)
      expect(req(1730)).toBe(6) // Mesure de sel (3 recettes × 2)
      expect(req(16852)).toBe(1) // Essence de Comte Harebourg
    },
  )
})
