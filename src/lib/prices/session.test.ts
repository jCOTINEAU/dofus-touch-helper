import { describe, expect, it } from 'vitest'
import {
  advanceLot,
  currentItem,
  progress,
  selectLot,
  skipToNextItem,
  startSession,
  type SessionItem,
} from './session'

const ITEMS: SessionItem[] = [
  { itemId: 1, lots: [1, 10, 100] },
  { itemId: 2, lots: [10] },
  { itemId: 3, lots: [100, 1] }, // désordonné volontairement
]

describe('session HDV', () => {
  it('démarre sur le premier lot de la première ressource', () => {
    const s = startSession(ITEMS)
    expect(s.finished).toBe(false)
    expect(currentItem(s)!.itemId).toBe(1)
    expect(s.currentLot).toBe(1)
  })

  it('sélection vide : session immédiatement terminée', () => {
    expect(startSession([]).finished).toBe(true)
    expect(startSession([{ itemId: 1, lots: [] }]).finished).toBe(true)
  })

  it('les lots sont remis dans l’ordre canonique ×1, ×10, ×100', () => {
    const s = startSession([ITEMS[2]])
    expect(s.items[0].lots).toEqual([1, 100])
    expect(s.currentLot).toBe(1)
  })

  it('advanceLot : enchaîne les lots puis passe à la ressource suivante', () => {
    let s = startSession(ITEMS)
    s = advanceLot(s) // 1 → 10
    expect(s.currentLot).toBe(10)
    s = advanceLot(s) // 10 → 100
    expect(s.currentLot).toBe(100)
    s = advanceLot(s) // fin des lots → ressource 2, lot 10
    expect(currentItem(s)!.itemId).toBe(2)
    expect(s.currentLot).toBe(10)
  })

  it('advanceLot sur la dernière ressource/lot : session terminée', () => {
    let s = startSession([{ itemId: 1, lots: [10] }])
    s = advanceLot(s)
    expect(s.finished).toBe(true)
    expect(currentItem(s)).toBeNull()
  })

  it('skipToNextItem saute tous les lots restants de la ressource', () => {
    let s = startSession(ITEMS)
    s = skipToNextItem(s)
    expect(currentItem(s)!.itemId).toBe(2)
    expect(s.currentLot).toBe(10)
    s = skipToNextItem(s)
    expect(currentItem(s)!.itemId).toBe(3)
    s = skipToNextItem(s)
    expect(s.finished).toBe(true)
  })

  it('selectLot : saut manuel vers un lot proposé', () => {
    let s = startSession(ITEMS)
    s = selectLot(s, 100)
    expect(s.currentLot).toBe(100)
    // l'avancement reprend depuis ce lot : plus rien après → ressource 2
    s = advanceLot(s)
    expect(currentItem(s)!.itemId).toBe(2)
  })

  it('selectLot sur un lot jamais suivi : l’ajoute à la ressource', () => {
    let s = startSession([{ itemId: 2, lots: [10] }, { itemId: 3, lots: [1] }])
    s = selectLot(s, 100) // ressource 2 n'a jamais suivi ×100
    expect(s.currentLot).toBe(100)
    expect(s.items[0].lots).toEqual([10, 100])
    s = selectLot(s, 1)
    expect(s.items[0].lots).toEqual([1, 10, 100])
    // avancement : 1 → 10 → 100 → ressource suivante
    s = advanceLot(s)
    expect(s.currentLot).toBe(10)
  })

  it('progress reflète la position 1-based et la fin', () => {
    let s = startSession(ITEMS)
    expect(progress(s)).toEqual({ done: 0, total: 3 })
    s = skipToNextItem(s)
    expect(progress(s)).toEqual({ done: 1, total: 3 })
    s = skipToNextItem(s)
    s = skipToNextItem(s)
    expect(progress(s)).toEqual({ done: 3, total: 3 })
  })

  it('transitions sur une session finie : no-op', () => {
    let s = startSession([{ itemId: 1, lots: [1] }])
    s = advanceLot(s)
    expect(s.finished).toBe(true)
    expect(advanceLot(s)).toEqual(s)
    expect(skipToNextItem(s).finished).toBe(true)
    expect(selectLot(s, 10)).toEqual(s)
  })
})
