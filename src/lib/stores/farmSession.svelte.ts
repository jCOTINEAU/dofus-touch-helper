/**
 * Machine à états de la session de farm chronométrée. Les timers sont basés
 * sur des timestamps absolus (résistent au passage en arrière-plan). L'état
 * vivant est persisté en localStorage pour survivre à un rechargement ; les
 * combats terminés sont commités dans Dexie.
 *
 * Phases : idle (exploration, chrono « entre combats ») → preparing
 * (sélection, non chronométrée) → fighting (chrono combat) → idle …
 */

import { db } from '../db/db'
import type { CreatureCount } from '../types'
import { capSec, elapsedSec as pureElapsed } from '../combats/sessionTiming'

export type Phase = 'idle' | 'preparing' | 'fighting'

interface LiveState {
  sessionId: number
  phase: Phase
  /** Début de la phase chronométrée en cours (idle ou fighting). */
  phaseStartedAt: number
  /** Timestamp de mise en pause, ou null. */
  pausedAt: number | null
  /** Temps de pause accumulé sur la phase en cours (ms). */
  pausedAccumMs: number
  /** Durée d'exploration mesurée avant le combat en préparation (s). */
  pendingIdleSec: number
  /** Sélection de monstres en cours de préparation. */
  prep: CreatureCount[]
}

const KEY = 'dofus-craft:farm-session'

function persist(s: LiveState | null) {
  if (s) localStorage.setItem(KEY, JSON.stringify(s))
  else localStorage.removeItem(KEY)
}

function load(): LiveState | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as LiveState) : null
  } catch {
    return null
  }
}

let state = $state<LiveState | null>(load())

/** Secondes écoulées sur la phase chronométrée en cours (idle/fighting). */
function elapsedSec(s: LiveState, now: number): number {
  return pureElapsed(s.phaseStartedAt, s.pausedAt, s.pausedAccumMs, now)
}

export const farmSession = {
  get state() {
    return state
  },
  get active() {
    return state !== null
  },
  get paused() {
    return state?.pausedAt != null
  },

  elapsed(now: number): number {
    return state && state.phase !== 'preparing' ? elapsedSec(state, now) : 0
  },

  async start() {
    const sessionId = (await db.farmSessions.add({ startedAt: Date.now() })) as number
    state = {
      sessionId,
      phase: 'idle',
      phaseStartedAt: Date.now(),
      pausedAt: null,
      pausedAccumMs: 0,
      pendingIdleSec: 0,
      prep: [],
    }
    persist(state)
  },

  /** idle → preparing : fige le temps d'exploration, ouvre la sélection. */
  prepare() {
    if (!state || state.phase !== 'idle') return
    state.pendingIdleSec = capSec(elapsedSec(state, Date.now()))
    state.phase = 'preparing'
    state.prep = []
    state.pausedAt = null
    state.pausedAccumMs = 0
    persist(state)
  },

  addMonster(monsterId: number, delta = 1) {
    if (!state || state.phase !== 'preparing') return
    const found = state.prep.find((c) => c.monsterId === monsterId)
    if (found) found.count = Math.max(0, found.count + delta)
    else if (delta > 0) state.prep.push({ monsterId, count: delta })
    state.prep = state.prep.filter((c) => c.count > 0)
    persist(state)
  },

  cancelPrepare() {
    if (!state || state.phase !== 'preparing') return
    // Retour en exploration ; le temps d'exploration continue de courir.
    state.phase = 'idle'
    state.prep = []
    state.pausedAt = null
    state.pausedAccumMs = 0
    persist(state)
  },

  /** preparing → fighting : démarre le chrono du combat. */
  startFight() {
    if (!state || state.phase !== 'preparing' || state.prep.length === 0) return
    state.phase = 'fighting'
    state.phaseStartedAt = Date.now()
    state.pausedAt = null
    state.pausedAccumMs = 0
    persist(state)
  },

  /** fighting → idle : enregistre le combat mesuré, relance l'exploration. */
  async endFight() {
    if (!state || state.phase !== 'fighting') return
    const durationSec = capSec(elapsedSec(state, Date.now()))
    await db.sessionCombats.add({
      sessionId: state.sessionId,
      durationSec,
      idleBeforeSec: state.pendingIdleSec,
      creatures: state.prep.map((c) => ({ ...c })),
      recordedAt: Date.now(),
    })
    state.phase = 'idle'
    state.phaseStartedAt = Date.now()
    state.pausedAt = null
    state.pausedAccumMs = 0
    state.pendingIdleSec = 0
    state.prep = []
    persist(state)
  },

  togglePause() {
    // Pas de chrono en préparation : la pause n'y a pas de sens.
    if (!state || state.phase === 'preparing') return
    if (state.pausedAt == null) {
      state.pausedAt = Date.now()
    } else {
      state.pausedAccumMs += Date.now() - state.pausedAt
      state.pausedAt = null
    }
    persist(state)
  },

  async end() {
    if (!state) return
    await db.farmSessions.update(state.sessionId, { endedAt: Date.now() })
    const ended = state.sessionId
    state = null
    persist(null)
    return ended
  },
}
