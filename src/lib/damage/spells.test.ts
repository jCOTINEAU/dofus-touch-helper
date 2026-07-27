import { describe, expect, it } from 'vitest'
import { parseEffect } from './spells'

describe('parseEffect', () => {
  it('parse des dommages avec fourchette et élément', () => {
    expect(parseEffect('23 à 26 (dommages Terre)')).toMatchObject({
      kind: 'damage',
      min: 23,
      max: 26,
      element: 'Terre',
    })
  })

  it('parse un dommage à valeur unique (coup critique)', () => {
    expect(parseEffect('27 (meilleur élément)')).toMatchObject({
      kind: 'damage',
      min: 27,
      max: 27,
      element: 'meilleur élément',
    })
  })

  it('parse un vol de vie', () => {
    expect(parseEffect('23 à 26 (vol Terre)')).toMatchObject({
      kind: 'steal',
      min: 23,
      max: 26,
      element: 'Terre',
    })
  })

  it('parse un buff de dommages (Épée Divine)', () => {
    expect(parseEffect('30 Dommages (2 tours)')).toMatchObject({
      kind: 'buff',
      stat: 'Dommages',
      value: 30,
      percent: false,
      turns: 2,
    })
  })

  it('parse un buff de puissance (Puissance)', () => {
    expect(parseEffect('350 Puissance (3 tours)')).toMatchObject({
      kind: 'buff',
      stat: 'Puissance',
      value: 350,
      turns: 3,
    })
  })

  it('parse un buff en pourcentage', () => {
    expect(parseEffect('15% Érosion (2 tours)')).toMatchObject({
      kind: 'buff',
      stat: 'Érosion',
      value: 15,
      percent: true,
      turns: 2,
    })
  })

  it('parse un malus (valeur négative)', () => {
    expect(parseEffect('-30 Résistance Poussée (2 tours)')).toMatchObject({
      kind: 'buff',
      stat: 'Résistance Poussée',
      value: -30,
    })
  })

  it("classe le reste en 'other' avec sa durée", () => {
    expect(parseEffect('Maximise les effets aléatoires (2 tours)')).toMatchObject({
      kind: 'other',
      turns: 2,
    })
    expect(parseEffect('Putsch')).toMatchObject({ kind: 'other', turns: null })
  })
})
