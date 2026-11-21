// Capture une maquette sur ordinateur (1440 px) et sur téléphone (390 px), et signale les défauts.
//
// Usage : node _maquettes/outils/capture.js <maquette.html> <dossier_de_sortie>
//
// Fichiers produits :
//   ordi-pleine.png     page entière, 1440 px de large
//   ordi-1.png, -2…     la même, découpée en tranches de 1440 × 1400 (pour relire de près)
//   tel-pleine.png      page entière sur téléphone (390 px, netteté ×2)
//   tel-planche.png     la page téléphone découpée en écrans, posés côte à côte
// Défauts signalés : erreurs JavaScript, fichiers introuvables, images cassées, débordement horizontal.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const [fichier, sortie] = process.argv.slice(2);
if (!fichier || !sortie) { console.error('Usage : node capture.js <maquette.html> <dossier_de_sortie>'); process.exit(2); }
const url = pathToFileURL(path.resolve(fichier)).href;
fs.mkdirSync(sortie, { recursive: true });

// Animations figées dans leur état final : des captures stables et comparables.
const FIGER = `*,*::before,*::after{animation-duration:.001s !important;animation-delay:0s !important;
  animation-iteration-count:1 !important;transition:none !important;scroll-behavior:auto !important}`;

async function ouvrir(browser, options) {
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage();
  const defauts = [];
  page.on('pageerror', (e) => defauts.push('Erreur JavaScript : ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') defauts.push('Console : ' + m.text()); });
  page.on('requestfailed', (r) => defauts.push('Fichier introuvable : ' + decodeURI(r.url()).replace(/^file:\/\/.*\/Antigravity-workshop\//, '')));
  page.on('response', (r) => { if (r.status() >= 400) defauts.push(`HTTP ${r.status()} : ${r.url()}`); });
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.addStyleTag({ content: FIGER });
  await page.evaluate(() => document.fonts.ready);
  // Faire défiler toute la page (images différées, apparitions au défilement), puis revenir en haut.
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
  const etat = await page.evaluate(() => {
    const largeur = window.innerWidth;
    const cassees = [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src'));
    // Éléments qui dépassent à droite de l'écran (cause habituelle d'un défilement horizontal)
    const debordants = [];
    if (document.documentElement.scrollWidth > largeur + 1) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > largeur + 1 && getComputedStyle(el).position !== 'fixed') {
          let cache = false;
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX; if (o === 'hidden' || o === 'auto' || o === 'scroll' || o === 'clip') { cache = true; break; }
          }
          if (!cache) debordants.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} (droite : ${Math.round(r.right)} px)`);
        }
      }
    }
    const polices = [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')))];
    return { hauteur: document.documentElement.scrollHeight, largeurPage: document.documentElement.scrollWidth, largeur, cassees, debordants: debordants.slice(0, 8), polices };
  });
  return { ctx, page, defauts, etat };
}

(async () => {
  const browser = await chromium.launch();
  let problemes = 0;
  const bilan = (nom, defauts, etat) => {
    const liste = [...new Set(defauts)];
    etat.cassees.forEach((s) => liste.push('Image cassée : ' + s));
    if (etat.largeurPage > etat.largeur + 1) liste.push(`Débordement horizontal : la page fait ${etat.largeurPage} px pour un écran de ${etat.largeur} px → ${etat.debordants.join(' ; ') || 'élément non identifié'}`);
    console.log(`\n${nom} — hauteur ${etat.hauteur} px — polices chargées : ${etat.polices.join(', ') || 'aucune'}`);
    console.log(liste.length ? liste.map((l) => '  ✗ ' + l).join('\n') : '  ✓ aucun défaut détecté');
    problemes += liste.length;
  };

  // ----- Ordinateur -----
  {
    const { ctx, page, defauts, etat } = await ouvrir(browser, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await page.screenshot({ path: path.join(sortie, 'ordi-pleine.png'), fullPage: true });
    const H = 1400; const n = Math.ceil(etat.hauteur / H);
    for (let i = 0; i < n; i++) {
      await page.screenshot({ path: path.join(sortie, `ordi-${i + 1}.png`), fullPage: true,
        clip: { x: 0, y: i * H, width: 1440, height: Math.min(H, etat.hauteur - i * H) } });
    }
    bilan('ORDINATEUR (1440 px)', defauts, etat);
    console.log(`  ${n} tranche(s) : ordi-1.png … ordi-${n}.png`);
    await ctx.close();
  }

  // ----- Téléphone -----
  {
    const { ctx, page, defauts, etat } = await ouvrir(browser, {
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    await page.screenshot({ path: path.join(sortie, 'tel-pleine.png'), fullPage: true });
    bilan('TÉLÉPHONE (390 px)', defauts, etat);
    // Planche : la page découpée en écrans de 390 × 1688 (deux hauteurs d'écran), côte à côte.
    const H = 1688; const n = Math.ceil(etat.hauteur / H);
    const planche = await ctx.newPage();
    const cols = Array.from({ length: n }, (_, i) =>
      `<div style="width:390px;height:${H}px;overflow:hidden;background:#fff;outline:1px solid #999;flex:none">
         <img src="tel-pleine.png" style="width:390px;display:block;margin-top:-${i * H}px"></div>`).join('');
    // Page temporaire écrite à côté de l'image (une page « vide » n'a pas le droit de lire un fichier local).
    const tmp = path.resolve(sortie, '_planche.html');
    fs.writeFileSync(tmp, `<body style="margin:0;background:#444"><div style="display:flex;gap:14px;padding:14px">${cols}</div></body>`);
    await planche.setViewportSize({ width: n * 390 + (n + 1) * 14, height: H + 28 });
    await planche.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
    await planche.screenshot({ path: path.join(sortie, 'tel-planche.png'), scale: 'css' });
    fs.unlinkSync(tmp);
    console.log(`  planche de ${n} écran(s) : tel-planche.png`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\nBilan : ${problemes ? problemes + ' défaut(s) à corriger' : 'aucun défaut'} — captures dans ${sortie}`);
  process.exit(problemes ? 1 : 0);
})();
