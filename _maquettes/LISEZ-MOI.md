# Maquettes — pistes de refonte de mogadarr.fr (novembre 2026)

Cinq pistes de design pour la page d'accueil, à montrer à Mo Gadarr pour qu'elle choisisse.
Chaque piste part d'une facette de l'auteure et montre **la même page, avec les mêmes contenus** :
seul le style change.

| N° | Nom | Facette de Mo | Fichier |
|----|-----|---------------|---------|
| 1 | Stylo rouge | la prof de lettres | `1-stylo-rouge.html` |
| 2 | En scène | la femme de théâtre | `2-en-scene.html` |
| 3 | Manifeste | la romancière engagée | `3-manifeste.html` |
| 4 | Grand écran | l'univers en séries | `4-grand-ecran.html` |
| 5 | Cocon | la romance qui fait du bien | `5-cocon.html` |

## Piste retenue

L'auteure a choisi la piste **5 « Cocon »** (novembre 2026). Elle est désormais le thème du site :
`styles/cocon.scss`, `styles/cocon-pages.scss`, `index.qmd` et les gabarits `_includes/cocon-*.ejs`.
Les quatre autres maquettes restent ici pour mémoire.

Après la mise en ligne, la palette du site a été **ravivée** (mêmes teintes, couleurs plus intenses) : la maquette
`5-cocon.html` garde les valeurs d'origine, le site utilise celles de `styles/cocon.scss`.

## Ce dossier n'est pas publié

Quarto ignore les dossiers dont le nom commence par `_` : rien de ce dossier ne part sur mogadarr.fr.
Ce sont des maquettes de travail, pas des pages du site.

## Contenu

- `N-nom.html` — une maquette par piste (une seule page, autonome). S'ouvre directement dans un navigateur.
- `commun/contenu.js` — les contenus partagés par les cinq maquettes (24 romans, séries, sujets de société,
  actualités, textes), tirés du site actuel.
- `commun/img/` — quelques images préparées pour les maquettes (logo, illustration de Mo, photos).
- `planches/` — **les images à montrer**, au format téléphone (1080 × 1920, lisibles en plein écran) :
  `0-les-5-pistes.jpg` puis une image par piste.
- `outils/` — les scripts qui fabriquent les captures et les planches.

## Refaire les images après une retouche

Depuis la racine du dépôt (il faut Node.js, Playwright et ffmpeg). Le premier dossier sert aux captures
intermédiaires ; `MG_SORTIE` indique où écrire le résultat (par défaut : `_maquettes/planches`).

```bash
MG_SORTIE=/tmp/maquettes-sortie node _maquettes/outils/planches.js /tmp/maquettes-travail
```

Le résultat contient :

- les images au format téléphone (`0-les-5-pistes.jpg`, `1-stylo-rouge.jpg`…) ;
- `video/` : une courte vidéo par piste, la page d'accueil qui défile sur téléphone ;
- `detail/` : les planches détaillées pour grand écran (vue d'ensemble, planche, page entière sur ordinateur
  et sur téléphone).

Pour ne refaire qu'une piste (ici la 3), ou sans les vidéos :

```bash
MG_SORTIE=/tmp/maquettes-sortie node _maquettes/outils/planches.js /tmp/maquettes-travail 3 --sans-video
```

Pour assembler les planches détaillées en un PDF à feuilleter :

```bash
python3 _maquettes/outils/livret.py /tmp/maquettes-sortie /tmp/mogadarr-5-pistes.pdf
```

Pour vérifier une maquette (captures ordinateur et téléphone, défauts signalés) :

```bash
node _maquettes/outils/capture.js _maquettes/3-manifeste.html /tmp/captures-3
```

## Et ensuite

Une fois la piste choisie, elle sera déclinée sur tout le site (accueil, romans, pages de livres,
l'auteure, blog, contact), puis mise en ligne par la procédure habituelle : branche, aperçu, validation.
