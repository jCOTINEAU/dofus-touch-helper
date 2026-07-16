/** Types partagés de l'application. */

export interface RecipeComponent {
  itemId: number
  name: string
  url: string
  qty: number
  category: string | null
  level: number | null
  imageUrl: string | null
}

export interface Recipe {
  job: string
  jobLevel: number
  components: RecipeComponent[]
}

/** Objet de l'encyclopédie mis en cache (table `items`). */
export interface CachedItem {
  id: number
  url: string
  name: string
  category: string | null
  level: number | null
  imageUrl: string | null
  /** null = ressource de base (pas de recette). */
  recipe: Recipe | null
  /** 'dead' = page 404 sur l'encyclopédie (objet retiré du jeu). */
  fetchStatus: 'ok' | 'dead'
  fetchedAt: number
}

export interface Project {
  id?: number
  name: string
  createdAt: number
  /**
   * Compter ce projet dans la liste de courses globale (défaut true —
   * absent sur les projets créés avant l'ajout du champ). false pour les
   * projets « parking » servant juste à référencer des ressources.
   */
  includeInShopping?: boolean
}

/** Objet cible d'un projet (ce qu'on veut crafter). */
export interface ProjectTarget {
  id?: number
  projectId: number
  itemId: number
  qty: number
}

/** État par (projet, item) : mode de plan et quantité possédée. */
export interface NodeState {
  projectId: number
  itemId: number
  mode: 'craft' | 'buy'
  owned: number
}

/** Relevé de prix HDV : prix du LOT entier (pas unitaire). */
export interface PriceEntry {
  id?: number
  itemId: number
  lotSize: 1 | 10 | 100
  lotPrice: number
  recordedAt: number
}

export interface Combat {
  id?: number
  name: string
  avgDurationSec: number
}

export interface CombatLoot {
  id?: number
  combatId: number
  itemId: number
  dropRatePct: number
  qtyPerDrop: number
}
