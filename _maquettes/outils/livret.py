#!/usr/bin/env python3
"""Assemble les planches détaillées en un seul PDF à feuilleter (une planche par page).

Usage, depuis la racine du dépôt :
    python3 _maquettes/outils/livret.py <dossier_des_planches> <fichier.pdf>

Ordre des pages : la vue d'ensemble, puis pour chaque piste sa planche,
la page entière sur ordinateur et la page entière sur téléphone
(les fichiers du sous-dossier detail/ produits par planches.js).
Dépendance : Pillow.
"""
import sys
from pathlib import Path

from PIL import Image


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    detail = Path(sys.argv[1]) / "detail"
    sortie = Path(sys.argv[2])
    pages = [detail / "0-vue-d-ensemble.jpg"]
    for planche in sorted(detail.glob("[1-9]-*-planche.jpg")):
        base = planche.name[: -len("-planche.jpg")]
        pages += [planche, detail / f"{base}-page-entiere.jpg", detail / f"{base}-telephone.jpg"]
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
