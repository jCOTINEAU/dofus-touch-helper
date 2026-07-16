/**
 * État d'affichage de la page Prix conservé entre les remontages (la page
 * est démontée à chaque navigation vers une fiche). Garde la lettre A–Z
 * dépliée pour que la position de scroll reste cohérente au retour.
 */

let openLetter = $state<string | null>(null)

export const pricesView = {
  get openLetter() {
    return openLetter
  },
  set openLetter(value: string | null) {
    openLetter = value
  },
}
