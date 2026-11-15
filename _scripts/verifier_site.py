#!/usr/bin/env python3
"""Contrôles automatiques du site mogadarr.fr, lancés avant chaque publication.

BLOQUE la publication (code de sortie 1) si :
  - une image déclarée dans l'en-tête d'une page (image:, image: sous open-graph /
    twitter-card, title-block-banner:) n'existe pas ;
  - une image, une vidéo, une feuille de style… utilisée dans une page
    (src=, poster=, url(...), ![](...)) n'existe pas ;
  - un lien interne vers une page du site (….html ou ….qmd) ne mène nulle part ;
  - une source d'image est vide (src="", srcset="", poster="", ou ![…]() en Markdown) :
    c'est presque toujours un chemin oublié, et c'est du HTML non conforme ;
  - une référence de _quarto.yml (menu, image par défaut, favicon, fichiers inclus,
    ressources) n'existe pas.

SIGNALE (sans bloquer) les images utilisées de plus de 1 Mo, lentes à charger sur téléphone.

Image remplie plus tard par JavaScript (photo prise avec un filtre, visionneuse…) : mettre
dans src cette image transparente de 1 pixel, plutôt qu'une source vide :
  data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7

Usage, depuis la racine du dépôt :  python3 _scripts/verifier_site.py
Aucune dépendance : uniquement la bibliothèque standard de Python.
"""
import glob
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Dossiers qui ne sont pas des sources du site (rendus, anciens essais, outils).
DOSSIERS_IGNORES = {".git", ".github", ".quarto", "_preview", "_site", "docs", "node_modules",
                    "templates", "static", "_scripts"}
EXT_IMAGES = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif", ".ico"}
EXT_FICHIERS = EXT_IMAGES | {".mp4", ".webm", ".mov", ".pdf", ".css", ".js", ".woff", ".woff2", ".ttf"}
EXT_PAGES = {".html", ".qmd"}
SEUIL_LOURD = 1_000_000  # octets
SUR_GITHUB = os.environ.get("GITHUB_ACTIONS") == "true"

erreurs, avertissements = [], []
references_verifiees = 0
images_lourdes = {}


def relatif(p):
    try:
        return Path(p).resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(p)


def erreur(fichier, ligne, message):
    erreurs.append((relatif(fichier), ligne, message))


def est_externe(cible):
    c = cible.strip().lower()
    return (not c or c.startswith(("http:", "https:", "//", "mailto:", "tel:", "data:", "javascript:", "#", "about:"))
            or any(m in cible for m in ("<%", "${", "{{", "' +", "\" +")))


def nettoyer(cible):
    return re.split(r"[?#]", cible.strip(), maxsplit=1)[0]


def resoudre(depuis, cible):
    """Chemin sur disque d'une référence écrite dans le fichier `depuis`."""
    if cible.startswith("/"):
        return ROOT / cible.lstrip("/")
    return (Path(depuis).parent / cible).resolve()


def page_existe(chemin):
    """Une page publiée existe si sa source (.qmd, .md, .ipynb) ou le fichier .html existe."""
    if chemin.is_dir() or str(chemin).endswith(os.sep):
        chemin = chemin / "index.html"
    base = chemin.with_suffix("")
    return chemin.exists() or any(base.with_suffix(ext).exists() for ext in (".qmd", ".md", ".ipynb", ".html"))


def verifier_reference(depuis, ligne, cible, nature):
    """Vérifie une référence locale ; `nature` décrit d'où elle vient (pour le message)."""
    global references_verifiees
    if est_externe(cible):
        return
    propre = nettoyer(cible)
    if not propre:
        return
    ext = Path(propre).suffix.lower()
    chemin = resoudre(depuis, propre)
    if ext in EXT_FICHIERS:
        references_verifiees += 1
        if not chemin.is_file():
            erreur(depuis, ligne, f"{nature} introuvable : {cible}")
        elif ext in EXT_IMAGES and chemin.stat().st_size > SEUIL_LOURD:
            images_lourdes.setdefault(relatif(chemin), (chemin.stat().st_size, relatif(depuis), ligne))
    elif ext in EXT_PAGES:
        references_verifiees += 1
        if not page_existe(chemin):
            erreur(depuis, ligne, f"lien vers une page inexistante : {cible}")


def valeur_yaml(brut):
    v = brut.strip()
    if v[:1] in ("'", '"'):
        fin = v.find(v[0], 1)
        return v[1:fin] if fin > 0 else v[1:]
    return re.split(r"\s+#", v, maxsplit=1)[0].strip()


def bornes_entete(lignes):
    i = 0
    while i < len(lignes) and not lignes[i].strip():
        i += 1
    if i >= len(lignes) or lignes[i].strip() != "---":
        return None
    for j in range(i + 1, len(lignes)):
        if lignes[j].strip() in ("---", "..."):
            return i, j
    return None


RE_CLE = re.compile(r"^(\s*)([A-Za-z0-9_-]+)\s*:\s*(.*)$")
RE_ATTR = re.compile(r"""\b(src|poster|href|data-src)\s*=\s*(["'])([^"'<>]*)\2""", re.I)
RE_URL_CSS = re.compile(r"""url\(\s*(["']?)([^"')]+)\1\s*\)""", re.I)
RE_IMG_MD = re.compile(r"!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")
RE_LIEN_MD = re.compile(r"(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")
# Sources vides : on ne regarde que l'intérieur des balises HTML, et pas le contenu des blocs
# <script> / <style> (img.src = "" y est du JavaScript, pas du HTML).
# (?<![\w.:-]) écarte data-src="", img.src="" (dans un onclick)…
RE_SCRIPT_STYLE = re.compile(r"(<(script|style)\b[^>]*>)(.*?)(</\2\s*>)", re.I | re.S)
RE_BALISE = re.compile(r"<[A-Za-z][\w:-]*(?:\s[^<>]*)?>")
RE_ATTR_VIDE = re.compile(r"""(?<![\w.:-])(src|srcset|poster)\s*=\s*(["'])\s*\2""", re.I)
RE_IMG_MD_VIDE = re.compile(r"!\[[^\]]*\]\(\s*\)")


def sources_vides(texte):
    """[(numéro de ligne, message)] des sources d'image vides du texte."""
    # Contenu des blocs <script>/<style> remplacé par des espaces ; les retours à la ligne
    # sont gardés pour que les numéros de ligne restent justes.
    masque = RE_SCRIPT_STYLE.sub(
        lambda m: m.group(1) + re.sub(r"[^\n]", " ", m.group(3)) + m.group(4), texte)
    trouvees = []
    for balise in RE_BALISE.finditer(masque):
        for attr in RE_ATTR_VIDE.finditer(balise.group(0)):
            ligne = masque.count("\n", 0, balise.start() + attr.start()) + 1
            trouvees.append((ligne, f'{attr.group(1).lower()}="" vide : chemin d\'image oublié ? '
                                    "(image remplie par JavaScript : utiliser l'image transparente "
                                    "indiquée en tête de _scripts/verifier_site.py)"))
    for m in RE_IMG_MD_VIDE.finditer(masque):
        trouvees.append((masque.count("\n", 0, m.start()) + 1, "image Markdown sans fichier : ![…]()"))
    return sorted(trouvees)


def verifier_page(fichier):
    texte = fichier.read_text(encoding="utf-8")
    lignes = texte.splitlines()
    bornes = bornes_entete(lignes)
    corps_debut = 0
    if bornes:
        debut, fin = bornes
        corps_debut = fin + 1
        parent = None
        for n in range(debut + 1, fin):
            m = RE_CLE.match(lignes[n])
            if not m:
                continue
            indent, cle, brut = len(m.group(1)), m.group(2), m.group(3)
            if indent == 0:
                parent = cle
            valeur = valeur_yaml(brut)
            if not valeur:
                continue
            if (indent == 0 and cle == "image") or (indent > 0 and cle == "image" and parent in ("open-graph", "twitter-card")):
                verifier_reference(fichier, n + 1, valeur, "image d'en-tête")
            elif indent == 0 and cle == "title-block-banner" and valeur.lower() not in ("true", "false", "yes", "no"):
                verifier_reference(fichier, n + 1, valeur, "image de bandeau")
    for n in range(corps_debut, len(lignes)):
        ligne = lignes[n]
        for m in RE_ATTR.finditer(ligne):
            verifier_reference(fichier, n + 1, m.group(3), "fichier")
        for m in RE_URL_CSS.finditer(ligne):
            verifier_reference(fichier, n + 1, m.group(2), "image de fond")
        for m in RE_IMG_MD.finditer(ligne):
            verifier_reference(fichier, n + 1, m.group(1), "image")
        for m in RE_LIEN_MD.finditer(ligne):
            verifier_reference(fichier, n + 1, m.group(1), "lien")
    for ligne, message in sources_vides(texte):
        if ligne > corps_debut:  # hors de l'en-tête YAML
            erreur(fichier, ligne, message)


def verifier_config():
    config = ROOT / "_quarto.yml"
    lignes = config.read_text(encoding="utf-8").splitlines()
    dans_ressources, indent_ressources = False, 0
    for n, ligne in enumerate(lignes, start=1):
        if dans_ressources:
            m = re.match(r"^(\s*)-\s*(.+)$", ligne)
            if m and len(m.group(1)) >= indent_ressources:
                motif = valeur_yaml(m.group(2))
                if not glob.glob(str(ROOT / motif)):
                    erreur(config, n, f"ressource introuvable : {motif}")
                continue
            if ligne.strip() and not ligne.strip().startswith("#"):
                dans_ressources = False
        m = RE_CLE.match(ligne)
        if not m:
            continue
        cle, valeur = m.group(2), valeur_yaml(m.group(3))
        if cle == "resources" and not valeur:
            dans_ressources, indent_ressources = True, len(m.group(1))
        elif cle in ("href", "favicon", "image", "file") and valeur:
            verifier_reference(config, n, valeur, "fichier de la configuration")


def main():
    pages = sorted(p for p in ROOT.rglob("*.qmd")
                   if not (set(p.relative_to(ROOT).parts[:-1]) & DOSSIERS_IGNORES))
    for page in pages:
        verifier_page(page)
    verifier_config()

    for chemin, (taille, depuis, ligne) in sorted(images_lourdes.items()):
        avertissements.append((chemin, None, f"image lourde ({taille / 1e6:.1f} Mo), à compresser pour les téléphones "
                                               f"(utilisée par {depuis}:{ligne})"))

    print("Contrôle du site mogadarr.fr")
    for f, l, msg in erreurs:
        print(f"  ✗ {f}:{l} — {msg}")
        if SUR_GITHUB:
            print(f"::error file={f},line={l}::{msg}")
    for f, l, msg in avertissements:
        print(f"  ⚠ {f} — {msg}")
        if SUR_GITHUB:
            print(f"::warning file={f}::{msg}")
    print(f"Résultat : {len(pages)} pages et {references_verifiees} références vérifiées — "
          f"{len(erreurs)} erreur(s), {len(avertissements)} avertissement(s).")
    if erreurs:
        print("Publication bloquée : corrigez les erreurs ci-dessus (nom ou chemin de fichier).")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
