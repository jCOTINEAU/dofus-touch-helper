/** Générateurs de pages markdown synthétiques au format jina, pour les tests. */

export interface TestComponent {
  qty: number
  name: string
  url: string
}

export function itemPage(
  name: string,
  url: string,
  recipe?: { job: string; jobLevel: number; components: TestComponent[] },
): string {
  let md = `Title: ${name} - Catégorie - Type - Encyclopédie DOFUS -  DOFUS Touch, le MMORPG ultime sur mobile

URL Source: ${url}

Markdown Content:

# ${name}

Niveau : 10
`
  if (recipe) {
    md += `\nRecette\n\n${recipe.job} Niveau ${recipe.jobLevel}\n`
    for (const c of recipe.components) {
      md += `\n${c.qty} x\n\n[![Image 1](https://static.ankama.com/x.png)](${c.url})\n\n[${c.name}](${c.url})\n\nCat\n\nNiv. 1\n`
    }
  }
  return md
}

export function deadPage(url: string): string {
  return `Title: DOFUS Touch, le MMORPG ultime sur mobile

URL Source: ${url}

Warning: Target URL returned error 404: Not Found

Markdown Content:

Page introuvable
`
}
