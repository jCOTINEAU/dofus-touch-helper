#!/usr/bin/env python3
"""Calcule le total cumulé de ressources de base pour crafter une liste d'objets Dofus Touch.

Usage:
    python3 dofus_craft.py URL [URL ...] [-o ressources.csv]

Chaque URL est une page de l'encyclopédie Dofus Touch (équipement, ressource,
consommable...). Le script descend récursivement dans les recettes : tout
composant lui-même craftable est remplacé par ses propres composants
(quantités multipliées), jusqu'aux ressources de base. Le résultat mergé est
écrit en CSV.
"""

import argparse
import csv
import http.cookiejar
import re
import sys
import time
import urllib.request
from collections import Counter

BASE = "https://www.dofus-touch.com"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# Le site redirige avec un paramètre authlogin qui pose un cookie : sans
# cookie jar on boucle indéfiniment sur cette redirection.
_opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
_opener.addheaders = [("User-Agent", UA)]

_page_cache = {}


def fetch(url, retries=3):
    if url.startswith("/"):
        url = BASE + url
    if url in _page_cache:
        return _page_cache[url]
    for attempt in range(retries):
        try:
            html = _opener.open(url, timeout=30).read().decode("utf-8", "replace")
            break
        except OSError as e:
            if isinstance(e, urllib.error.HTTPError) and e.code < 500:
                raise  # 404 etc. : inutile de réessayer
            if attempt == retries - 1:
                raise
            print(f"  ! {e} sur {url}, nouvel essai...", file=sys.stderr)
            time.sleep(2 * (attempt + 1))
    _page_cache[url] = html
    time.sleep(0.3)  # politesse
    return html


def page_title(html):
    m = re.search(r"<title>([^<]+)", html)
    return m.group(1).split(" - ")[0].strip() if m else "?"


def parse_recipe(html):
    """Retourne (métier, niveau, [(qté, nom, url)]) ou None si pas de recette."""
    i = html.find("ak-crafts")
    if i == -1:
        return None
    section = html[i:]
    m = re.search(r'ak-panel-intro">\s*(.*?)\s*<span>Niveau (\d+)</span>', section)
    job, level = (m.group(1).strip(), int(m.group(2))) if m else ("?", 0)
    pat = re.compile(
        r'(\d+)\s*x\s*</div>.*?'
        r'<a href="(/fr/mmorpg/encyclopedie/[^"]+)"[^>]*>\s*'
        r'<span class="ak-linker">([^<]+)</span>',
        re.S)
    components = [(int(q), name, url) for q, url, name in pat.findall(section)]
    return job, level, components


def expand(url, qty, totals, urls, crafted, stack, depth=0, name=None):
    """Descend récursivement la recette de `url` et cumule `qty` fois ses
    ressources de base dans `totals`."""
    indent = "  " * depth
    try:
        html = fetch(url)
    except urllib.error.HTTPError as e:
        # Page morte (objet retiré de l'encyclopédie) : on garde le nom vu
        # dans la recette parente et on le compte comme ressource de base.
        name = name or url.rstrip("/").rsplit("/", 1)[-1]
        print(f"{indent}{qty} x {name}  (page {e.code}, compté tel quel)",
              file=sys.stderr)
        totals[name] += qty
        urls[name] = url
        return
    name = page_title(html)
    recipe = parse_recipe(html)

    if recipe is None or url in stack:  # ressource de base (ou cycle)
        print(f"{indent}{qty} x {name}", file=sys.stderr)
        totals[name] += qty
        urls[name] = url
        return

    job, level, components = recipe
    crafted[name] = f"{job} niv. {level}"
    print(f"{indent}{qty} x {name}  [{job} niv. {level}]", file=sys.stderr)
    for comp_qty, comp_name, comp_url in components:
        expand(comp_url, qty * comp_qty, totals, urls, crafted,
               stack | {url}, depth + 1, name=comp_name)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("urls", nargs="+", metavar="URL",
                        help="pages encyclopédie des objets à crafter")
    parser.add_argument("-o", "--output", default="ressources.csv",
                        help="fichier CSV de sortie (défaut: ressources.csv)")
    args = parser.parse_args()

    totals = Counter()
    urls = {}
    crafted = {}
    for url in args.urls:
        expand(url, 1, totals, urls, crafted, frozenset())

    with open(args.output, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["quantite", "ressource", "url"])
        for name, qty in totals.most_common():
            writer.writerow([qty, name, BASE + urls[name]
                             if urls[name].startswith("/") else urls[name]])

    print(f"\n{len(totals)} ressources de base distinctes, "
          f"{sum(totals.values())} au total -> {args.output}", file=sys.stderr)
    if crafted:
        print("Crafts intermédiaires : "
              + ", ".join(f"{n} ({j})" for n, j in crafted.items()),
              file=sys.stderr)


if __name__ == "__main__":
    main()
