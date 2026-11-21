# Contrôles du site

Trois contrôles complémentaires. Le premier est automatique ; les deux autres se lancent à la main :
l'un après une retouche de mise en page, l'autre de temps en temps, pour les liens d'achat.

## 1. `verifier_site.py` — avant chaque publication (automatique)

Lit les fichiers du dépôt, sans navigateur : images déclarées mais absentes, liens internes cassés,
sources d'image vides, références de `_quarto.yml`. Il tourne tout seul sur GitHub à chaque demande
de fusion et **bloque la publication** en cas d'erreur.

```bash
python3 _scripts/verifier_site.py
```

## 2. `verifier_affichage.js` — après une retouche de mise en page (à la main)

Ouvre le site construit dans un vrai navigateur (sans fenêtre), à 26 largeurs d'écran de 320 à
1600 px, et signale ce que la lecture des fichiers ne peut pas voir :

- un texte, une image ou une pastille **rognés** par le bord de l'écran ou par leur cadre ;
- un bouton ou un titre **recouvert** par un autre élément ;
- un texte **trop pâle** pour être lu (contraste mesuré sur l'image affichée) ;
- une erreur JavaScript, un fichier introuvable, une image cassée.

```bash
quarto render
```

```bash
node _scripts/verifier_affichage.js _site
```

Il faut Node.js et Playwright (`npm install playwright`, puis `npx playwright install chromium`).
Les options (quelques pages seulement, autres largeurs, site en ligne, seuil de contraste) sont
décrites en tête du fichier.

### Pourquoi tant de largeurs ?

La page ne défile jamais de côté : un élément trop large n'ajoute pas de barre de défilement, il
est simplement rogné. Vérifier « sur téléphone et sur ordinateur » (390 et 1440 px) laisse passer
les défauts qui n'apparaissent qu'entre les deux : tablettes (641 à 1280 px) et petits téléphones
(320 à 375 px). C'est exactement ce qui s'est produit à la mise en ligne du thème « Cocon ».

## 3. `verifier_liens_achat.js` — de temps en temps (à la main)

Essaie tous les boutons « Acheter » qui mènent à Amazon. Les fiches Amazon disparaissent sans prévenir
(nouvelle édition, fin d'un contrat d'édition, lien court périmé) : le bouton mène alors à une page
« introuvable », alors que rien n'a changé dans le dépôt. Seul un essai du lien le révèle.

```bash
quarto render
```

```bash
node _scripts/verifier_liens_achat.js _site
```

Le script ouvre chaque lien dans un vrai navigateur (Amazon refuse les requêtes automatiques simples) et
avance doucement : comptez 3 à 4 minutes. Il classe chaque lien : valide, cassé, ou « non vérifié » quand
Amazon a refusé la requête — dans ce cas, relancer plus tard.

Quand un roman n'est plus en vente : remplacer son bouton « Acheter sur Amazon » par le bloc utilisé dans
`romans/be-sweeter.qmd` (une note `book-note` et un bouton « Écrire à Mo Gadarr »), plutôt que de laisser
un lien mort.
