// Capture une maquette sur ordinateur (1440 px) et sur téléphone (390 px), et signale les défauts.
//
// Usage : node _maquettes/outils/capture.js <maquette.html> <dossier_de_sortie>
//
// Fichiers produits :
//   ordi-pleine.png     page entière, 1440 px de large
//   ordi-1.png, -2…     la même, découpée en tranches de 1440 × 1400 (pour relire de près)
//   tel-1.png, -2…      la page sur téléphone (390 px, netteté ×2), écran par écran
//   tel-planche.png     ces écrans posés côte à côte (tel-planche-1.png, -2… si la page est longue)
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
  // Largeur de référence : celle de l'écran demandé. (Sur téléphone, window.innerWidth ne convient pas :
  // quand un élément dépasse, le navigateur « dézoome » et innerWidth grandit avec la page.)
  const etat = await page.evaluate((largeur) => {
    const cassees = [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src'));
    // Éléments visibles qui dépassent de l'écran sans être rognés par un parent.
    const debordants = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0) || (r.right <= largeur + 1 && r.left >= -1)) continue;
      let ignore = getComputedStyle(el).visibility === 'hidden';
      for (let p = el; p && p !== document.documentElement && !ignore; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.position === 'fixed' || (p !== el && s.overflowX !== 'visible')) ignore = true;
      }
      if (!ignore) debordants.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} (de ${Math.round(r.left)} à ${Math.round(r.right)} px)`);
    }
    const polices = [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')))];
    return { hauteur: document.documentElement.scrollHeight, largeurPage: Math.max(document.documentElement.scrollWidth, window.innerWidth), largeur, cassees, debordants: [...new Set(debordants)].slice(0, 8), polices };
  }, options.viewport.width);
  return { ctx, page, defauts, etat };
}

(async () => {
  const browser = await chromium.launch();
  let problemes = 0;
  const bilan = (nom, defauts, etat) => {
    const liste = [...new Set(defauts)];
    etat.cassees.forEach((s) => liste.push('Image cassée : ' + s));
    if (etat.largeurPage > etat.largeur + 1 || etat.debordants.length) liste.push(`Débordement horizontal : la page fait ${etat.largeurPage} px pour un écran de ${etat.largeur} px → ${etat.debordants.join(' ; ') || 'élément non identifié'}`);
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
    bilan('TÉLÉPHONE (390 px)', defauts, etat);
    // La page est capturée écran par écran (390 × 1688, soit deux hauteurs de téléphone) : une capture
    // unique d'une page très haute dépasserait la taille maximale d'image du navigateur (16 384 px).
    const H = 1688; const n = Math.ceil(etat.hauteur / H);
    for (let i = 0; i < n; i++) {
      await page.screenshot({ path: path.join(sortie, `tel-${i + 1}.png`), fullPage: true,
        clip: { x: 0, y: i * H, width: 390, height: Math.min(H, etat.hauteur - i * H) } });
    }
    // Planches : les écrans posés côte à côte, 5 par image pour rester lisibles.
    const PAR_PLANCHE = 5; const nbPlanches = Math.ceil(n / PAR_PLANCHE);
    const planche = await ctx.newPage();
    for (let k = 0; k < nbPlanches; k++) {
      const ecrans = Array.from({ length: Math.min(PAR_PLANCHE, n - k * PAR_PLANCHE) }, (_, j) => k * PAR_PLANCHE + j + 1);
      const cols = ecrans.map((i) => `<div style="width:390px;height:${H}px;overflow:hidden;background:#fff;outline:1px solid #999;flex:none">
         <img src="tel-${i}.png" style="width:390px;display:block"></div>`).join('');
      // Page temporaire écrite à côté des images (une page « vide » n'a pas le droit de lire un fichier local).
      const tmp = path.resolve(sortie, '_planche.html');
      fs.writeFileSync(tmp, `<body style="margin:0;background:#444"><div style="display:flex;gap:14px;padding:14px">${cols}</div></body>`);
      await planche.setViewportSize({ width: ecrans.length * 390 + (ecrans.length + 1) * 14, height: H + 28 });
      await planche.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
      await planche.screenshot({ path: path.join(sortie, nbPlanches === 1 ? 'tel-planche.png' : `tel-planche-${k + 1}.png`), scale: 'css' });
      fs.unlinkSync(tmp);
    }
    console.log(nbPlanches === 1 ? `  planche de ${n} écran(s) : tel-planche.png`
      : `  ${n} écrans sur ${nbPlanches} planches : ${Array.from({ length: nbPlanches }, (_, k) => `tel-planche-${k + 1}.png`).join(', ')}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\nBilan : ${problemes ? problemes + ' défaut(s) à corriger' : 'aucun défaut'} — captures dans ${sortie}`);
  process.exit(problemes ? 1 : 0);
})();
