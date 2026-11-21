#!/usr/bin/env node
/* Contrôle des liens d'achat (Amazon) du site mogadarr.fr.

   POURQUOI. Les fiches Amazon disparaissent sans prévenir : nouvelle édition, fin d'un contrat d'édition,
   lien court périmé… Le bouton « Acheter » mène alors à une page « introuvable ». Rien dans le dépôt ne
   change : seul un essai du lien le révèle. Et Amazon refuse les requêtes automatiques simples (curl) :
   il faut un vrai navigateur.

   CE QUE FAIT LE SCRIPT. Il relève tous les liens vers Amazon dans le site construit, ouvre chaque lien
   distinct dans un navigateur sans fenêtre, et classe le résultat :
     ✓ fiche du livre (titre lu sur la page)          ✓ recherche qui trouve le livre
     ✗ page introuvable                               ✗ recherche sans résultat
     ? non vérifié : Amazon a refusé la requête (trop de demandes) — relancer plus tard

   USAGE (depuis la racine du dépôt, après `quarto render`)
     node _scripts/verifier_liens_achat.js _site
     node _scripts/verifier_liens_achat.js _site --pause=6        secondes entre deux liens (défaut : 4)

   Il faut Node.js et Playwright (npm install playwright ; npx playwright install chromium).
   Le script va doucement exprès : une trentaine de liens prennent 3 à 4 minutes.
   Code de sortie : 0 si aucun lien n'est cassé, 1 sinon. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dossier = args.find((a) => !a.startsWith('--'));
if (!dossier || !fs.existsSync(dossier)) { console.error('Usage : node _scripts/verifier_liens_achat.js <dossier du site construit> [--pause=4]'); process.exit(2); }
const pause = 1000 * parseFloat((args.find((a) => a.startsWith('--pause=')) || '--pause=4').split('=')[1]);
const racine = path.resolve(dossier);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 1. Relever les liens d'achat dans les pages construites ----------
function pagesDuSite(d, rel = '') {
  let out = [];
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f), r = rel ? rel + '/' + f : f;
    if (fs.statSync(p).isDirectory()) { if (f !== 'site_libs') out = out.concat(pagesDuSite(p, r)); } else if (f.endsWith('.html')) out.push(r);
  }
  return out;
}
const liens = new Map();   // adresse → Set(pages où elle figure)
for (const p of pagesDuSite(racine).sort()) {
  const html = fs.readFileSync(path.join(racine, p), 'utf8');
  for (const m of html.matchAll(/href\s*=\s*"(https?:\/\/(?:www\.)?(?:amazon\.[a-z.]+|amzn\.eu|amzn\.to|a\.co)\/[^"]*)"/gi)) {
    const u = m[1].replace(/&amp;/g, '&'); if (!liens.has(u)) liens.set(u, new Set()); liens.get(u).add(p);
  }
}
if (!liens.size) { console.log('Aucun lien vers Amazon dans ' + dossier); process.exit(0); }

// ---------- 2. Ouvrir chaque lien dans un vrai navigateur ----------
// Page intermédiaire d'Amazon (« Continuer les achats ») : on clique, puis on redemande la page voulue.
async function franchir(page) {
  let clique = false;
  for (let k = 0; k < 3; k++) {
    const b = page.locator('button:has-text("Continuer les achats"), input[type=submit][value*="Continuer"], button:has-text("Continue shopping")').first();
    if (await b.count() === 0) break;
    await b.click({ timeout: 8000 }).catch(() => {}); await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(1800); clique = true;
  }
  return clique;
}
async function essayer(ctx, u) {
  const page = await ctx.newPage();
  try {
    let rep = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 }); await page.waitForTimeout(2000);
    if (await franchir(page)) { rep = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 }); await page.waitForTimeout(2000); }
    const code = rep ? rep.status() : 0;
    const vu = await page.evaluate(() => {
      const t = (s) => (document.querySelector(s)?.textContent || '').replace(/\s+/g, ' ').trim(); const corps = document.body ? document.body.innerText : '';
      return { titre: document.title, produit: t('#productTitle'), auteur: t('#bylineInfo'),
        introuvable: /Page introuvable|Vous recherchez quelque chose|n.avons pas pu trouver cette page/i.test(corps) || /Page introuvable|Page Not Found/i.test(document.title),
        robot: /Saisissez les caractères|Enter the characters|Toutes nos excuses/i.test(corps) && corps.length < 4000,
        aucun: /Aucun résultat pour/i.test(corps), resultats: [...document.querySelectorAll('[data-component-type="s-search-result"] h2')].slice(0, 3).map((h) => h.textContent.replace(/\s+/g, ' ').trim()) };
    });
    const recherche = /\/s\?/.test(page.url());
    if (code === 404 || vu.introuvable) return { etat: 'casse', detail: 'page introuvable sur Amazon' };
    if (code === 503 || code === 429 || vu.robot) return { etat: 'inconnu', detail: `Amazon a refusé la requête (code ${code})` };
    if (recherche) return vu.resultats.length ? { etat: 'ok', detail: 'recherche → ' + vu.resultats[0].slice(0, 70) } : { etat: vu.aucun ? 'casse' : 'inconnu', detail: vu.aucun ? 'recherche sans résultat' : 'résultats non lus' };
    if (vu.produit) return { etat: 'ok', detail: vu.produit.slice(0, 70) + (vu.auteur ? ' — ' + vu.auteur.replace(/\s*Format.*$/, '').slice(0, 30) : '') };
    return { etat: 'inconnu', detail: `page non reconnue (code ${code}, titre « ${vu.titre.slice(0, 40)} »)` };
  } catch (e) { return { etat: 'inconnu', detail: e.message.split('\n')[0].slice(0, 100) }; } finally { await page.close(); }
}

(async () => {
  const navigateur = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await navigateur.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' } });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  { const p = await ctx.newPage(); await p.goto('https://www.amazon.fr/', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {}); await p.waitForTimeout(1500); await franchir(p); await p.close(); }   // règle une fois la page intermédiaire

  console.log(`Liens d'achat : ${liens.size} adresse(s) distincte(s) à essayer (pause de ${pause / 1000} s entre deux)…\n`);
  const bilan = { ok: [], casse: [], inconnu: [] };
  for (const [u, pages] of liens) {
    let r = await essayer(ctx, u);
    if (r.etat === 'inconnu') { await attendre(Math.max(20000, pause * 4)); r = await essayer(ctx, u); }   // un second essai, après une vraie pause
    bilan[r.etat].push({ u, pages: [...pages], detail: r.detail });
    console.log(`${r.etat === 'ok' ? '✓' : r.etat === 'casse' ? '✗' : '?'} ${u.replace(/^https?:\/\//, '').slice(0, 58).padEnd(58)} ${r.detail}`);
    await attendre(pause);
  }
  await navigateur.close();

  const ou = (pages) => pages.slice(0, 4).join(', ') + (pages.length > 4 ? ` … (${pages.length} pages)` : '');
  if (bilan.casse.length) { console.log('\nLIENS CASSÉS — à corriger'); for (const x of bilan.casse) console.log(`  ✗ ${x.u}\n      ${x.detail}\n      utilisé dans : ${ou(x.pages)}`); }
  if (bilan.inconnu.length) { console.log('\nNON VÉRIFIÉS — relancer plus tard (Amazon limite les requêtes automatiques)'); for (const x of bilan.inconnu) console.log(`  ? ${x.u}\n      ${x.detail}\n      utilisé dans : ${ou(x.pages)}`); }
  console.log(`\nBilan : ${bilan.ok.length} lien(s) valide(s), ${bilan.casse.length} cassé(s), ${bilan.inconnu.length} non vérifié(s).`);
  process.exit(bilan.casse.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
