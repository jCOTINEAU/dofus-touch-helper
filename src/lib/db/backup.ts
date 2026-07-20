/**
 * Export/import JSON de toute la base : sauvegarde manuelle et transfert
 * entre appareils via l'app Fichiers (iCloud Drive).
 */

import { db } from './db'

const TABLES = [
  'items',
  'projects',
  'projectTargets',
  'nodeStates',
  'priceEntries',
  'combats',
  'combatLoots',
  'monsters',
  'combatCreatures',
  'farmSessions',
  'sessionCombats',
  'meta',
] as const

export interface BackupFile {
  app: 'dofus-touch-helper'
  version: 1
  exportedAt: number
  tables: Record<string, unknown[]>
}

export async function exportBackup(): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {}
  for (const name of TABLES) {
    tables[name] = await db.table(name).toArray()
  }
  return { app: 'dofus-touch-helper', version: 1, exportedAt: Date.now(), tables }
}

/** Remplace TOUT le contenu local par la sauvegarde (pas de fusion). */
export async function importBackup(data: unknown): Promise<{ counts: Record<string, number> }> {
  const backup = data as BackupFile
  if (backup?.app !== 'dofus-touch-helper' || backup.version !== 1 || !backup.tables) {
    throw new Error('Fichier de sauvegarde invalide (app/version)')
  }
  // Chaque table présente doit être un tableau (sinon fichier corrompu).
  for (const name of TABLES) {
    const rows = backup.tables[name]
    if (rows !== undefined && !Array.isArray(rows)) {
      throw new Error(`Sauvegarde invalide : la table « ${name} » n'est pas une liste`)
    }
  }
  const counts: Record<string, number> = {}
  await db.transaction(
    'rw',
    TABLES.map((n) => db.table(n)),
    async () => {
      for (const name of TABLES) {
        const rows = backup.tables[name] ?? []
        await db.table(name).clear()
        // bulkPut : tolère d'éventuels doublons de clé (dernier gagne)
        // plutôt que de faire échouer tout l'import.
        await db.table(name).bulkPut(rows)
        counts[name] = rows.length
      }
    },
  )
  return { counts }
}
