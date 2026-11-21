#!/usr/bin/env python3
"""Assemble les planches en un seul PDF à feuilleter (une planche par page).

Usage, depuis la racine du dépôt :
    python3 _maquettes/outils/livret.py <fichier.pdf>

Ordre des pages : la vue d'ensemble, puis pour chaque piste sa planche,
la page entière sur ordinateur et la page entière sur téléphone.
Dépendance : Pillow.
"""
import sys
from pathlib import Path

from PIL import Image

PLANCHES = Path(__file__).resolve().parent.parent / "planches"


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sortie = Path(sys.argv[1])
    pages = [PLANCHES / "0-vue-d-ensemble.jpg"]
    for planche in sorted(p for p in PLANCHES.glob("[1-9]-*.jpg")):
        pages.append(planche)
        for suffixe in ("-page-entiere", "-telephone"):
            detail = PLANCHES / "detail" / f"{planche.stem}{suffixe}.jpg"
            if detail.exists():
                pages.append(detail)
    pages = [p for p in pages if p.exists()]
    if not pages:
        sys.exit("Aucune planche trouvée : lancer d'abord planches.js")
    images = [Image.open(p).convert("RGB") for p in pages]
    sortie.parent.mkdir(parents=True, exist_ok=True)
    # 150 points par pouce : une planche de 2000 px de large fait environ 34 cm à l'écran.
    images[0].save(sortie, "PDF", resolution=150, save_all=True, append_images=images[1:], quality=85)
    print(f"{sortie} : {len(images)} pages, {sortie.stat().st_size / 1e6:.1f} Mo")


if __name__ == "__main__":
    main()
