import Dexie, { type EntityTable, type Table } from 'dexie'
import type {
  CachedItem,
  Combat,
  CombatLoot,
  NodeState,
  PriceEntry,
  Project,
  ProjectTarget,
} from '../types'

export type AppDatabase = Dexie & {
  items: EntityTable<CachedItem, 'id'>
  projects: EntityTable<Project, 'id'>
  projectTargets: EntityTable<ProjectTarget, 'id'>
  nodeStates: Table<NodeState, [number, number]>
  priceEntries: EntityTable<PriceEntry, 'id'>
  combats: EntityTable<Combat, 'id'>
  combatLoots: EntityTable<CombatLoot, 'id'>
  meta: Table<{ key: string; value: unknown }, string>
}

export const db = new Dexie('dofus-touch-helper') as AppDatabase

db.version(1).stores({
  items: 'id, name, fetchStatus',
  projects: '++id, name',
  projectTargets: '++id, projectId, [projectId+itemId]',
  nodeStates: '[projectId+itemId], projectId, itemId',
  priceEntries: '++id, itemId, [itemId+recordedAt], [itemId+lotSize]',
  combats: '++id, name',
  combatLoots: '++id, combatId, itemId',
  meta: 'key',
})
