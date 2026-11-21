#!/usr/bin/env node
/* Contrôle d'affichage du site mogadarr.fr : ce que seul un vrai navigateur peut voir.

   À lancer après toute retouche de mise en page (feuilles de styles/, gabarits de _includes/, pages
   « univers » qui ont leur propre style). Le site construit est ouvert dans un navigateur sans fenêtre,
   à de nombreuses largeurs d'écran, et chaque page est mesurée.

   POURQUOI. Sur ce site, la page ne défile jamais de côté (overflow-x:clip sur body). Un élément trop large
   ne crée donc pas de barre de défilement : il est rogné en silence. Regarder la page à deux largeurs
   (390 et 1440 px) ne suffit pas : les défauts se cachent entre les deux (tablettes, petits téléphones).

   CE QUI EST SIGNALÉ
     1. erreurs de la page : erreur JavaScript, fichier introuvable, image cassée ;
     2. contenu rogné : texte, image ou pastille coupés par le bord de l'écran ou par leur cadre ;
     3. texte tronqué par des points de suspension (parfois voulu : voir TRONCATURES_ADMISES) ;
     4. lien, bouton ou titre recouvert par un autre élément (illisible ou incliquable) ;
     5. texte trop pâle : contraste mesuré sur l'image réellement affichée (repères d'accessibilité
        WCAG : 4,5:1 pour le texte courant, 3:1 pour le gros texte ; ici on signale ce qui est sous 3:1,
        ou sous le seuil donné par --contraste).

   USAGE (depuis la racine du dépôt, après `quarto render`)
     node _scripts/verifier_affichage.js _site
     node _scripts/verifier_affichage.js _site --pages=index.html,about.html
     node _scripts/verifier_affichage.js _site --largeurs=320-1600:20      de 320 à 1600 px, tous les 20 px
     node _scripts/verifier_affichage.js _site --base=https://mogadarr.fr/  mesurer le site en ligne
     node _scripts/verifier_affichage.js _site --contraste=4.5              plus exigeant sur le texte courant
     node _scripts/verifier_affichage.js _site --sans-contraste

   Il faut Node.js et Playwright (npm install playwright ; npx playwright install chromium).
   Code de sortie : 0 si tout va bien, 1 s'il y a des défauts. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ---------- Réglages ----------
const LARGEURS_PAR_DEFAUT = [320, 340, 360, 375, 390, 414, 430, 480, 540, 600, 640, 680, 720, 768, 820, 900, 960,
  1000, 1024, 1060, 1100, 1180, 1280, 1366, 1440, 1600];
const LARGEURS_CONTRASTE = [1280];   // les couleurs ne dépendent presque pas de la largeur
const EN_PARALLELE = 3;              // pages mesurées en même temps
// Troncatures « … » voulues : sélecteur de l'élément tronqué, et pourquoi c'est admis.
const TRONCATURES_ADMISES = [
  ['.annonce-texte', 'annonce de l’accueil : le titre du roman est abrégé sous 360 px, c’est prévu'],
];

// ---------- Ligne de commande ----------
const args = process.argv.slice(2);
const option = (nom) => { const a = args.find((x) => x === '--' + nom || x.startsWith('--' + nom + '=')); return a ? (a.includes('=') ? a.split('=').slice(1).join('=') : true) : null; };
const dossier = args.find((a) => !a.startsWith('--'));
if (!dossier || !fs.existsSync(dossier)) { console.error('Usage : node _scripts/verifier_affichage.js <dossier du site construit> [options]  (voir l’en-tête du fichier)'); process.exit(2); }
const racine = path.resolve(dossier);
function lireLargeurs(v) {
  const m = String(v).match(/^(\d+)-(\d+):(\d+)$/);
  if (m) { const out = []; for (let w = +m[1]; w <= +m[2]; w += +m[3]) out.push(w); return out; }
  return String(v).split(',').map(Number).filter(Boolean);
}
const largeurs = option('largeurs') ? lireLargeurs(option('largeurs')) : LARGEURS_PAR_DEFAUT;
const seuilContraste = option('sans-contraste') ? null : (option('contraste') && option('contraste') !== true ? parseFloat(option('contraste')) : 3);

function pagesDuSite(d, rel = '') {
  let out = [];
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f), r = rel ? rel + '/' + f : f;
    if (fs.statSync(p).isDirectory()) { if (f !== 'site_libs') out = out.concat(pagesDuSite(p, r)); } else if (f.endsWith('.html')) out.push(r);
  }
  return out;
}
let pages = option('pages') ? String(option('pages')).split(',') : pagesDuSite(racine).sort();
if (option('lot')) { const [i, n] = String(option('lot')).split('/').map(Number); pages = pages.filter((_, k) => k % n === i); }

// ---------- Petit serveur local (inutile avec --base) ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.xml': 'application/xml', '.txt': 'text/plain' };
function servir() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0].split('#')[0]); if (rel.endsWith('/')) rel += 'index.html';
      const f = path.join(racine, rel);
      if (!f.startsWith(racine) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('introuvable'); return; }
      const taille = fs.statSync(f).size; const type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
      const plage = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');   // les vidéos se lisent par morceaux
      if (plage) { const debut = plage[1] ? +plage[1] : 0, fin = plage[2] ? Math.min(+plage[2], taille - 1) : taille - 1;
        res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${debut}-${fin}/${taille}`, 'Accept-Ranges': 'bytes', 'Content-Length': fin - debut + 1 });
        fs.createReadStream(f, { start: debut, end: fin }).pipe(res);
      } else { res.writeHead(200, { 'Content-Type': type, 'Content-Length': taille, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(res); }
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// Animations figées dans leur état final : sinon on mesure des éléments en plein mouvement (fausses alertes).
const FIGER = `*,*::before,*::after{animation-duration:.001s !important;animation-delay:0s !important;animation-iteration-count:1 !important;transition:none !important;scroll-behavior:auto !important}`;

// =====================================================================================
// Mesures faites DANS la page (rognages, troncatures, recouvrements).
// W = largeur d'écran demandée ; admises = sélecteurs des troncatures voulues.
// =====================================================================================
function mesurer({ W, admises }) {
  const nom = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const chemin = (el) => { const parts = []; for (let q = el; q && q !== document.body && parts.length < 3; q = q.parentElement) parts.unshift(nom(q)); return parts.join(' > '); };
  const apercuDe = (el) => (el.textContent || el.getAttribute('alt') || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50);
  const OBJETS = new Set(['IMG', 'VIDEO', 'IFRAME', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'TABLE', 'PRE']);
  const out = [];

  // ----- Contenu rogné -----
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('script,style,noscript,template') || (el.closest('svg') && el.tagName.toLowerCase() !== 'svg')) continue;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0.5 && r.height > 0.5)) continue;
    const textes = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    const objet = OBJETS.has(el.tagName);
    if (!textes.length && !objet) continue;
    const sEl = getComputedStyle(el);
    const boite = textes.length > 0 && (sEl.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(sEl.borderTopWidth) > 0);   // pastille, bouton…
    if (sEl.position === 'absolute' && (r.width <= 2 || r.height <= 2)) continue;                                           // texte réservé aux lecteurs d'écran
    // On remonte les ancêtres : caché ? décoratif ? dans une bande à faire glisser ? Et on calcule la partie
    // réellement visible de l'élément : son rectangle, rogné par CHAQUE ancêtre qui coupe ce qui dépasse.
    let cache = false, decor = false, defile = false, points = false;
    let cadre = null, cadreTexte = null;
    const vis = { g: r.left, d: r.right, h: r.top, b: r.bottom };
    for (let q = el; q && q !== document.documentElement; q = q.parentElement) {
      const s = getComputedStyle(q);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) { cache = true; break; }
      if (q.getAttribute('aria-hidden') === 'true') decor = true;
      if (s.textOverflow === 'ellipsis') points = true;                                             // troncature « … » : traitée plus bas
      if (q === document.body) continue;
      const rogneX = /hidden|clip|auto|scroll/.test(s.overflowX), rogneY = /hidden|clip|auto|scroll/.test(s.overflowY);
      if (/auto|scroll/.test(s.overflowX) && q.scrollWidth > q.clientWidth + 1) defile = true;      // bande à faire glisser : voulu
      if (rogneX && !cadreTexte) cadreTexte = q;
      if (q !== el) {
        const c = q.getBoundingClientRect();
        if (rogneX) { if (!cadre) cadre = q; vis.g = Math.max(vis.g, c.left); vis.d = Math.min(vis.d, c.right); }
        if (rogneY) { vis.h = Math.max(vis.h, c.top); vis.b = Math.min(vis.b, c.bottom); }
      }
    }
    if (cache || decor || defile) continue;
    if (!(vis.d - vis.g > 0.5 && vis.b - vis.h > 0.5)) continue;                                    // rien n'en est visible (diapositive suivante d'un carrousel…)
    // Étendue réelle du texte, ligne par ligne : plus fiable que la boîte du bloc.
    let tg = Infinity, td = -Infinity;
    for (const n of textes) { const rg = document.createRange(); rg.selectNodeContents(n);
      for (const t of rg.getClientRects()) { if (t.width > 0.5) { tg = Math.min(tg, t.left); td = Math.max(td, t.right); } } }
    const aTexte = td > -Infinity;
    // a) par le bord de l'écran : l'élément dépasse de l'écran et sa partie visible touche le bord
    //    (que ce soit l'écran qui rogne, ou une section pleine largeur).
    if (vis.d > 1 && vis.g < W - 1) {
      const coupeD = r.right > W + 1 && vis.d >= W - 1, coupeG = r.left < -1 && vis.g <= 1;
      if (coupeD || coupeG) {
        const texteCoupe = aTexte && ((coupeD && td > W + 1) || (coupeG && tg < -1));
        if (texteCoupe || objet || boite) out.push({ type: texteCoupe ? 'TEXTE coupé par le bord de l’écran' : (objet ? 'image ou objet coupé par le bord de l’écran' : 'pastille coupée par le bord de l’écran'),
          qui: chemin(el), texte: apercuDe(el), detail: `occupe ${Math.round(r.left)}→${Math.round(r.right)} px sur un écran de ${W} px`, mesure: Math.round(Math.max(r.right - W, -r.left)) });
      }
    }
    // b) texte rogné par son cadre (carte, pastille…), sans points de suspension
    if (cadreTexte && aTexte && !points) {
      const c = cadreTexte.getBoundingClientRect(); const depasse = Math.max(td - c.right, c.left - tg);
      if (depasse > 1.5 && !(td <= c.left || tg >= c.right)) out.push({ type: 'texte rogné par son cadre', qui: chemin(el), texte: apercuDe(el), detail: `dépasse de ${Math.round(depasse)} px de ${nom(cadreTexte)}`, mesure: Math.round(depasse) });
    }
    // c) pastille ou bouton dont la boîte est rognée par son cadre (le texte peut rester entier)
    if (cadre && boite) {
      const c = cadre.getBoundingClientRect(); const depasse = Math.max(r.right - c.right, c.left - r.left);
      if (depasse > 1.5 && !(r.right <= c.left || r.left >= c.right)) out.push({ type: 'pastille rognée par son cadre', qui: chemin(el), texte: apercuDe(el), detail: `dépasse de ${Math.round(depasse)} px de ${nom(cadre)}`, mesure: Math.round(depasse) });
    }
  }

  // ----- Texte tronqué par des points de suspension -----
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    if (s.textOverflow !== 'ellipsis' || !/hidden|clip/.test(s.overflowX)) continue;
    const r = el.getBoundingClientRect(); if (!(r.width > 0.5 && r.height > 0.5)) continue;
    let cache = false; for (let q = el; q && q !== document.documentElement; q = q.parentElement) { const t = getComputedStyle(q); if (t.display === 'none' || t.visibility === 'hidden' || parseFloat(t.opacity) < 0.05) { cache = true; break; } }
    if (cache || el.scrollWidth <= el.clientWidth + 1) continue;
    if (admises.some((sel) => el.matches(sel))) continue;
    out.push({ type: 'texte tronqué par « … »', qui: chemin(el), texte: apercuDe(el), detail: `il manque ${el.scrollWidth - el.clientWidth} px`, mesure: el.scrollWidth - el.clientWidth });
  }

  // ----- Lien, bouton ou titre recouvert par un autre élément -----
  const partieVisible = (el) => {   // rectangle de l'élément, rogné par ses ancêtres ; null si rien n'est visible
    const r = el.getBoundingClientRect(); const v = { g: r.left, d: r.right, h: r.top, b: r.bottom };
    for (let q = el; q && q !== document.documentElement; q = q.parentElement) {
      const t = getComputedStyle(q);
      if (t.display === 'none' || t.visibility === 'hidden' || parseFloat(t.opacity) < 0.05 || t.pointerEvents === 'none') return null;
      if (q !== el && q !== document.body) { const c = q.getBoundingClientRect();
        if (/hidden|clip|auto|scroll/.test(t.overflowX)) { v.g = Math.max(v.g, c.left); v.d = Math.min(v.d, c.right); }
        if (/hidden|clip|auto|scroll/.test(t.overflowY)) { v.h = Math.max(v.h, c.top); v.b = Math.min(v.b, c.bottom); } }
    }
    v.g = Math.max(v.g, 0); v.d = Math.min(v.d, W);
    return (v.d - v.g > 8 && v.b - v.h > 8) ? v : null;
  };
  const yDepart = window.scrollY;
  for (const el of document.querySelectorAll('main a[href], main button, .co a[href], .co button, #quarto-header a[href], #quarto-header button, h1, h2, h3')) {
    if (el.closest('[aria-hidden="true"]')) continue;
    const r0 = el.getBoundingClientRect(); if (!(r0.width > 8 && r0.height > 8)) continue;
    // Amener l'élément au milieu de l'écran en ne faisant défiler QUE la fenêtre (scrollIntoView ferait aussi
    // défiler l'intérieur des blocs qui rognent, ce qui fausserait les mesures suivantes).
    if (getComputedStyle(el).position !== 'fixed' && !el.closest('#quarto-header')) window.scrollTo({ top: window.scrollY + r0.top + r0.height / 2 - window.innerHeight / 2, behavior: 'instant' });
    const v = partieVisible(el); if (!v) continue;
    const mx = (v.d - v.g) * 0.2, my = (v.b - v.h) * 0.2;   // points pris à 20 % du bord : un rond ou une carte penchée n'occupent pas leurs coins
    const par = new Set(); let pris = 0, total = 0;
    for (const x of [v.g + mx, (v.g + v.d) / 2, v.d - mx]) for (const y of [v.h + my, (v.h + v.b) / 2, v.b - my]) {
      if (y < 0 || y >= window.innerHeight) continue; total++;
      const dessus = document.elementFromPoint(x, y); if (!dessus) continue;
      if (dessus === el || el.contains(dessus) || dessus.contains(el)) continue;
      let fixe = false; for (let q = dessus; q && q !== document.documentElement; q = q.parentElement) if (getComputedStyle(q).position === 'fixed') { fixe = true; break; }
      if (fixe) continue;                                   // menu flottant, bouton « haut de page »… : passager
      pris++; par.add(chemin(dessus));
    }
    if (pris >= 2) out.push({ type: (/^H\d$/.test(el.tagName) ? 'titre' : 'lien ou bouton') + ' recouvert par un autre élément', qui: chemin(el), texte: apercuDe(el),
      detail: `${pris} points sur ${total} recouverts par ${[...par].slice(0, 2).join(' et ')}`, mesure: pris });
  }
  window.scrollTo({ top: yDepart, behavior: 'instant' });
  return out;
}

// =====================================================================================
// Contraste : relevé des textes DANS la page, puis mesure sur la capture d'écran.
// =====================================================================================
function releverTextes() {
  const nom = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('script,style,noscript,template,svg,[aria-hidden="true"]')) continue;
    const noeuds = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim().length > 1); if (!noeuds.length) continue;
    let opacite = 1, cache = false;
    for (let q = el; q && q !== document.documentElement; q = q.parentElement) { const s = getComputedStyle(q); if (s.display === 'none' || s.visibility === 'hidden') { cache = true; break; } opacite *= parseFloat(s.opacity); }
    if (cache || opacite < 0.05) continue;
    const s = getComputedStyle(el);
    if (s.position === 'absolute' && (el.offsetWidth <= 2 || el.offsetHeight <= 2)) continue;
    const clip = { g: -Infinity, d: Infinity, h: -Infinity, b: Infinity };   // zone visible : chaque ancêtre qui rogne
    for (let q = el.parentElement; q && q !== document.body && q !== document.documentElement; q = q.parentElement) { const t = getComputedStyle(q); const c = q.getBoundingClientRect();
      if (/hidden|clip|auto|scroll/.test(t.overflowX)) { clip.g = Math.max(clip.g, c.left); clip.d = Math.min(clip.d, c.right); }
      if (/hidden|clip|auto|scroll/.test(t.overflowY)) { clip.h = Math.max(clip.h, c.top); clip.b = Math.min(clip.b, c.bottom); } }
    for (const n of noeuds) { const rg = document.createRange(); rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) {   // première ligne de chaque texte
        if (r.width < 8 || r.height < 6) continue;
        if (r.left < clip.g - 1 || r.right > clip.d + 1 || r.top < clip.h - 1 || r.bottom > clip.b + 1) continue;
        out.push({ qui: nom(el.parentElement || el) + ' > ' + nom(el), texte: n.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height,
          couleur: s.color, remplissage: s.webkitTextFillColor, opacite, taille: parseFloat(s.fontSize), poids: +s.fontWeight || 400 });
        break;
      } }
  }
  return { textes: out, hauteur: document.documentElement.scrollHeight };
}

// Exécuté dans une page vide : lit la capture (image) et mesure, pour chaque texte, la couleur de fond
// réellement affichée derrière lui. Rapport de contraste WCAG entre la couleur du texte et ce fond.
async function mesurerContraste({ image, y0, textes }) {
  const img = new Image(); img.src = image; await img.decode();
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const rapport = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const lire = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
  const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const out = [];
  for (const t of textes) {
    const x1 = Math.max(0, Math.floor(t.x)), y1 = Math.max(0, Math.floor(t.y - y0)), x2 = Math.min(cv.width, Math.ceil(t.x + t.w)), y2 = Math.min(cv.height, Math.ceil(t.y + t.h - y0));
    if (x2 - x1 < 4 || y2 - y1 < 4) continue;
    const d = ctx.getImageData(x1, y1, x2 - x1, y2 - y1).data; const px = []; for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
    // Couleur dominante d'un lot de pixels (couleurs regroupées par paquets de 8 niveaux).
    const dominante = (lot) => { const n = new Map(); for (const p of lot) { const k = (p[0] >> 3) << 10 | (p[1] >> 3) << 5 | (p[2] >> 3); n.set(k, (n.get(k) || 0) + 1); }
      let best = null, max = -1; for (const [k, v] of n) if (v > max) { max = v; best = k; }
      const proches = lot.filter((p) => ((p[0] >> 3) << 10 | (p[1] >> 3) << 5 | (p[2] >> 3)) === best); return [0, 1, 2].map((i) => proches.reduce((s, p) => s + p[i], 0) / proches.length); };
    let c = lire(t.couleur); const fill = lire(t.remplissage); if (fill && fill[3] === 0) c = null;
    let fond, texte, note = '';
    if (!c || c[3] === 0) {   // texte en dégradé : on prend la teinte la plus éloignée du fond
      fond = dominante(px); texte = px.reduce((m, p) => (Math.abs(lum(p) - lum(fond)) > Math.abs(lum(m) - lum(fond)) ? p : m), px[0]); note = ' (texte en dégradé)';
    } else {
      // Fond = couleur dominante parmi les pixels qui n'ont PAS la couleur du texte (sur un fond en dégradé,
      // ce seraient sinon les lettres, d'une seule couleur, qui l'emporteraient).
      const a = c[3] * t.opacite;
      const loin = a > 0.85 ? px.filter((p) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2 > 48 * 48) : px;
      fond = dominante(loin.length >= 0.12 * px.length ? loin : px);
      texte = [0, 1, 2].map((i) => c[i] * a + fond[i] * (1 - a));
    }
    out.push({ qui: t.qui, texte: t.texte, taille: t.taille, gros: t.taille >= 24 || (t.taille >= 18.66 && t.poids >= 700), rapport: rapport(texte, fond), couleurs: `${hex(texte)} sur ${hex(fond)}`, note });
  }
  return out;
}

// =====================================================================================
(async () => {
  const srv = option('base') ? null : await servir();
  const BASE = option('base') ? String(option('base')).replace(/\/?$/, '/') : `http://127.0.0.1:${srv.address().port}/`;
  const navigateur = await chromium.launch();
  const defauts = new Map();     // clé → { type, qui, texte, pire, ou: Map(page → Set(largeurs)) }
  const erreurs = new Map();     // page → Set(messages)
  const pales = new Map();       // clé → { rapport, … , pages: Set }
  let mesures = 0;
  const noter = (page, W, t) => { const cle = t.type + ' | ' + t.qui; if (!defauts.has(cle)) defauts.set(cle, { ...t, pire: -1, ou: new Map() });
    const v = defauts.get(cle); if (!v.ou.has(page)) v.ou.set(page, new Set()); v.ou.get(page).add(W); if (t.mesure > v.pire) { v.pire = t.mesure; v.pireTxt = `${t.detail} (à ${W} px)`; } };

  async function controler(p) {
    const groupes = [
      { opts: { isMobile: true, hasTouch: true }, largeurs: largeurs.filter((w) => w < 600), hauteur: 800 },   // téléphone
      { opts: {}, largeurs: largeurs.filter((w) => w >= 600), hauteur: 900 },                                    // tablette, ordinateur
    ].filter((g) => g.largeurs.length);
    for (const g of groupes) {
      const ctx = await navigateur.newContext({ ...g.opts, viewport: { width: g.largeurs[0], height: g.hauteur } });
      const page = await ctx.newPage(); const err = new Set();
      page.on('pageerror', (e) => err.add('erreur JavaScript : ' + e.message.split('\n')[0]));
      page.on('response', (r) => { if (r.status() >= 400) err.add(`fichier en erreur ${r.status()} : ${r.url().replace(BASE, '/')}`); });
      try {
        await page.goto(BASE + p, { waitUntil: 'load', timeout: 60000 });
        await page.addStyleTag({ content: FIGER });
        await page.evaluate(() => document.fonts.ready);
        let premier = true;
        for (const W of g.largeurs) {
          await page.setViewportSize({ width: W, height: g.hauteur });
          if (premier) {   // faire défiler une fois toute la page : apparitions au défilement, images différées
            await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}); premier = false;
            for (const src of await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && (i.currentSrc || i.getAttribute('src'))).map((i) => i.getAttribute('src')))) err.add('image cassée : ' + src);
          }
          await page.waitForTimeout(140);
          for (const t of await page.evaluate(mesurer, { W, admises: TRONCATURES_ADMISES.map((x) => x[0]) })) noter(p, W, t);
          mesures++;
        }
      } catch (e) { err.add('page non mesurée : ' + e.message.split('\n')[0]); }
      if (err.size) { if (!erreurs.has(p)) erreurs.set(p, new Set()); err.forEach((m) => erreurs.get(p).add(m)); }
      await ctx.close();
    }
    // Contraste : une capture de la page entière (par tranches), mesurée dans une page vide.
    if (seuilContraste) for (const W of LARGEURS_CONTRASTE) {
      const ctx = await navigateur.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + p, { waitUntil: 'load', timeout: 60000 });
        await page.addStyleTag({ content: FIGER + '#quarto-header{position:absolute !important}' });   // le menu fixe ne doit pas recouvrir la capture
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(300);
        const { textes, hauteur } = await page.evaluate(releverTextes);
        const outil = await ctx.newPage(); const H = 6000;   // tranches : une image trop haute est refusée par le navigateur
        for (let y0 = 0; y0 < hauteur; y0 += H) {
          const lot = textes.filter((t) => t.y >= y0 && t.y + t.h <= Math.min(y0 + H, hauteur)); if (!lot.length) continue;
          const png = await page.screenshot({ fullPage: true, clip: { x: 0, y: y0, width: W, height: Math.min(H, hauteur - y0) } });
          for (const m of await outil.evaluate(mesurerContraste, { image: 'data:image/png;base64,' + png.toString('base64'), y0, textes: lot })) {
            if (m.rapport >= (m.gros ? Math.min(3, seuilContraste) : seuilContraste)) continue;
            const cle = m.qui + ' | ' + m.rapport.toFixed(1); if (!pales.has(cle)) pales.set(cle, { ...m, pages: new Set() }); pales.get(cle).pages.add(p);
          }
        }
      } catch (e) { if (!erreurs.has(p)) erreurs.set(p, new Set()); erreurs.get(p).add('contraste non mesuré : ' + e.message.split('\n')[0]); }
      await ctx.close();
    }
  }
  // Plusieurs pages à la fois.
  const file = [...pages];
  await Promise.all(Array.from({ length: Math.min(EN_PARALLELE, file.length) }, async () => { while (file.length) await controler(file.shift()); }));
  await navigateur.close(); if (srv) srv.close();

  // ---------- Rapport ----------
  const toutes = [...largeurs].sort((a, b) => a - b);
  const plages = (set) => { const l = [...set].sort((a, b) => a - b); const out = []; let d = l[0], f = l[0];
    for (let i = 1; i <= l.length; i++) { if (i < l.length && l[i] === toutes[toutes.indexOf(f) + 1]) f = l[i]; else { out.push(d === f ? `${d}` : `${d}–${f}`); d = f = l[i]; } }
    return out.join(', ') + ' px'; };
  console.log(`Contrôle d'affichage — ${pages.length} page(s) × ${largeurs.length} largeur(s) d'écran = ${mesures} mesures${seuilContraste ? ` ; contraste mesuré à ${LARGEURS_CONTRASTE.join(', ')} px` : ''}`);
  let total = 0;
  if (erreurs.size) { console.log('\nERREURS DE PAGE'); for (const [p, ms] of erreurs) { total += ms.size; console.log(`  ✗ ${p}\n      ` + [...ms].slice(0, 6).join('\n      ')); } }
  if (defauts.size) {
    console.log('\nAFFICHAGE');
    for (const t of [...defauts.values()].sort((a, b) => a.type.localeCompare(b.type) || b.ou.size - a.ou.size)) {
      total++; const ou = [...t.ou.entries()].slice(0, 4).map(([p, ws]) => `${p} à ${plages(ws)}`).join(' ; ');
      console.log(`  ✗ ${t.type}\n      ${t.qui}   « ${t.texte} »\n      au pire : ${t.pireTxt}\n      ${t.ou.size} page(s) : ${ou}${t.ou.size > 4 ? ' ; …' : ''}`);
    }
  }
  if (pales.size) {
    console.log(`\nTEXTES TROP PÂLES (contraste sous ${seuilContraste}:1${seuilContraste > 3 ? ' ; 3:1 pour le gros texte' : ''})`);
    for (const m of [...pales.values()].sort((a, b) => a.rapport - b.rapport)) { total++; const ps = [...m.pages];
      console.log(`  ✗ ${m.rapport.toFixed(2)}:1  ${m.couleurs}  ${Math.round(m.taille)} px${m.gros ? ' (gros)' : ''}  ${m.qui}  « ${m.texte} »${m.note}  — ${ps.slice(0, 2).join(', ')}${ps.length > 2 ? ' …' : ''}`); }
  }
  console.log(total ? `\n${total} défaut(s) à regarder.` : '\nAucun défaut : rien de rogné, de recouvert ni de trop pâle.');
  process.exit(total ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
