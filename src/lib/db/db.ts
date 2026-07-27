import Dexie, { type EntityTable, type Table } from 'dexie'
import type {
  CachedItem,
  CachedMonster,
  Combat,
  CombatCreature,
  CombatLoot,
  FarmSession,
  NodeState,
  PriceEntry,
  Project,
  ProjectTarget,
  SessionCombat,
} from '../types'
import type { StatProfile } from '../damage/stats'
import type { SpellChoice } from '../damage/spells'
import type { Scenario } from '../damage/calc'

export type AppDatabase = Dexie & {
  items: EntityTable<CachedItem, 'id'>
  projects: EntityTable<Project, 'id'>
  projectTargets: EntityTable<ProjectTarget, 'id'>
  nodeStates: Table<NodeState, [number, number]>
  priceEntries: EntityTable<PriceEntry, 'id'>
  combats: EntityTable<Combat, 'id'>
  combatLoots: EntityTable<CombatLoot, 'id'>
  monsters: EntityTable<CachedMonster, 'id'>
  combatCreatures: EntityTable<CombatCreature, 'id'>
  farmSessions: EntityTable<FarmSession, 'id'>
  sessionCombats: EntityTable<SessionCombat, 'id'>
  statProfiles: EntityTable<StatProfile, 'id'>
  spellChoices: EntityTable<SpellChoice, 'id'>
  scenarios: EntityTable<Scenario, 'id'>
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

// v2 : import de monstres (drops) et créatures par combat.
db.version(2).stores({
  monsters: 'id, name',
  combatCreatures: '++id, combatId, monsterId',
})

// v3 : sessions de farm chronométrées.
db.version(3).stores({
  farmSessions: '++id, startedAt',
  sessionCombats: '++id, sessionId',
})

// v4 : profils de stats (feature Dégâts).
db.version(4).stores({
  statProfiles: '++id, name',
})

// v5 : kit de sorts retenus (feature Dégâts).
db.version(5).stores({
  spellChoices: '++id, spellId, [class+spellId]',
})

// v6 : scénarios d'enchaînement (calculateur de dégâts).
db.version(6).stores({
  scenarios: '++id, name',
})
