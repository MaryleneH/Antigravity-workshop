// Fabrique les planches de présentation des maquettes (les images à montrer à l'auteure).
//
// Usage : node _maquettes/outils/planches.js <dossier_de_travail> [numéros…]
//   <dossier_de_travail> : dossier temporaire pour les captures intermédiaires
//   [numéros]            : pistes à (re)faire, toutes par défaut. La vue d'ensemble est toujours refaite.
//
// Résultat dans _maquettes/planches/ :
//   0-vue-d-ensemble.jpg          les 5 pistes côte à côte (et le site d'aujourd'hui, pour mémoire)
//   N-nom.jpg                     une planche par piste : ordinateur, téléphone, palette, polices, extraits
//   detail/N-nom-page-entiere.jpg la page d'accueil entière sur ordinateur
//   detail/N-nom-telephone.jpg    la page d'accueil entière sur téléphone
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const RACINE = process.env.MG_RACINE ? path.resolve(process.env.MG_RACINE) : path.resolve(__dirname, '..'); // MG_RACINE : pour les essais
const SORTIE = path.join(RACINE, 'planches');
const TRAVAIL = path.resolve(process.argv[2] || '');
if (!process.argv[2]) { console.error('Usage : node planches.js <dossier_de_travail> [numéros…]'); process.exit(2); }
const SEULEMENT = process.argv.slice(3).map(Number);
const SITE_ACTUEL = 'https://mogadarr.fr/';

// La facette de Mo derrière chaque piste, et les deux extraits de page montrés sur sa planche
// (y = position dans la page ordinateur de 1440 px de large ; hauteur montrée : 840 px).
const PISTES = {
  1: { facette: 'la prof de lettres', extraits: [] },
  2: { facette: 'la femme de théâtre', extraits: [] },
  3: { facette: 'la romancière engagée', extraits: [] },
  4: { facette: 'l’univers en séries', extraits: [] },
  5: { facette: 'la romance qui fait du bien', extraits: [] },
};
try { Object.assign(PISTES, require('./planches-reglages.json')); } catch (e) { /* réglages facultatifs */ }

const FIGER = `*,*::before,*::after{animation-duration:.001s !important;animation-delay:0s !important;
  animation-iteration-count:1 !important;transition:none !important;scroll-behavior:auto !important}`;
const UA_TEL = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const fichierURL = (p) => pathToFileURL(path.resolve(p)).href;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function lireMetas(html) {
  const m = {};
  for (const x of html.matchAll(/<meta\s+name="mg:([a-z]+)"\s+content="([^"]*)"/g)) m[x[1]] = x[2].replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, '’');
  const liens = [...html.matchAll(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"[^>]*>/g)].map((x) => x[1]);
  return {
    numero: Number(m.numero), nom: m.nom || '?', idee: m.idee || '', mots: (m.mots || '').split(/\s*[,;]\s*/).filter(Boolean),
    palette: (m.palette || '').split(/\s*;\s*/).filter(Boolean).map((c) => { const [hex, ...n] = c.trim().split(/\s+/); return { hex, nom: n.join(' ') }; }),
    polices: (m.polices || '').split(/\s*;\s*/).filter(Boolean).map((p) => { const [police, role] = p.split(/\s+[—–-]\s+/); return { police: police.trim(), role: (role || '').trim() }; }),
    liensPolices: liens,
  };
}

async function preparer(page) {
  await page.addStyleTag({ content: FIGER }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(600);
}

// Captures d'une page : haut de page ordinateur (net), page entière ordinateur, téléphone (haut + entière).
async function capturer(browser, url, dossier, { planDePage = true } = {}) {
  fs.mkdirSync(dossier, { recursive: true });
  const infos = {};
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 90000 }); await preparer(page);
    await page.screenshot({ path: path.join(dossier, 'ordi-haut.png') });
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 90000 }); await preparer(page);
    infos.hauteurOrdi = await page.evaluate(() => document.documentElement.scrollHeight);
    if (planDePage) {
      // Plan de la page : grandes sections avec leur position, pour choisir les extraits.
      infos.plan = await page.evaluate(() => {
        const blocs = [...document.querySelectorAll('body > *, body > main > *, body > div > section')].filter((e) => !['SCRIPT', 'STYLE', 'LINK'].includes(e.tagName));
        return blocs.map((e) => { const r = e.getBoundingClientRect(); const t = e.querySelector('h1,h2,h3');
          return { y: Math.round(r.top + scrollY), h: Math.round(r.height), balise: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''), titre: t ? t.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) : '' }; })
          .filter((b) => b.h > 80);
      });
    }
    await page.screenshot({ path: path.join(dossier, 'ordi-pleine.png'), fullPage: true });
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA_TEL });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 90000 }); await preparer(page);
    await page.screenshot({ path: path.join(dossier, 'tel-haut.png') });
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA_TEL });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 90000 }); await preparer(page);
    infos.hauteurTel = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: path.join(dossier, 'tel-pleine.png'), fullPage: true });
    await ctx.close();
  }
  return infos;
}

// ---------- Gabarits des planches (1600 × 2000 px, exportées en ×1,25) ----------
const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1600px;background:#EFEDE8;color:#1A1A1A;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .pl{width:1600px;padding:54px 56px 40px;display:flex;flex-direction:column;gap:30px}
  .tete{display:grid;grid-template-columns:auto 1fr;gap:34px;align-items:center}
  .num{width:150px;height:150px;border-radius:50%;display:grid;place-items:center;font-size:92px;font-weight:800;line-height:1}
  .sur{font-size:24px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#6B6B6B}
  .nom{font-size:104px;line-height:1;margin:6px 0 10px;letter-spacing:-.01em}
  .facette{font-size:34px;font-weight:600;color:#3A3A3A}
  .idee{font-size:33px;line-height:1.38;color:#2A2A2A;max-width:1380px}
  .mots{display:flex;gap:14px;flex-wrap:wrap}
  .mot{font-size:25px;font-weight:600;padding:9px 22px;border-radius:999px;background:#fff;border:2px solid #1A1A1A}
  .legende{font-size:22px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6B6B6B;margin-bottom:12px}
  .cadre{background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 2px 0 rgba(0,0,0,.05),0 24px 60px -24px rgba(0,0,0,.35);border:1px solid rgba(0,0,0,.12)}
  .barre{height:40px;background:#F4F3F1;border-bottom:1px solid rgba(0,0,0,.1);display:flex;align-items:center;gap:8px;padding:0 16px}
  .barre i{width:12px;height:12px;border-radius:50%;background:#D5D2CC;display:block}
  .barre span{margin-left:18px;font-size:16px;color:#77736C;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:999px;padding:3px 22px}
  .cadre img{display:block;width:100%}
  .tel{width:330px;border-radius:46px;background:#141414;padding:11px;box-shadow:0 30px 60px -22px rgba(0,0,0,.5)}
  .tel .ecran{border-radius:36px;overflow:hidden;background:#fff;height:666px}
  .tel img{display:block;width:100%}
  .pied{display:flex;justify-content:space-between;font-size:20px;color:#77736C;border-top:2px solid rgba(0,0,0,.12);padding-top:16px}
  .extrait{height:436px;overflow:hidden;position:relative}
  .extrait img{position:absolute;left:0;width:100%}
`;
const clair = (hex) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) > 150; };

function gabaritPiste(m, cap, infos) {
  const p = PISTES[m.numero] || { facette: '', extraits: [] };
  const titrePolice = m.polices[0] ? `'${m.polices[0].police}'` : 'Inter';
  const c1 = (m.palette[0] || { hex: '#1A1A1A' }).hex, cAccent = (m.palette[2] || m.palette[1] || { hex: '#C0392B' }).hex;
  const extraits = (p.extraits && p.extraits.length ? p.extraits : [{ titre: 'Dans la page', y: Math.round(infos.hauteurOrdi * 0.3) }, { titre: 'Plus bas', y: Math.round(infos.hauteurOrdi * 0.58) }]).slice(0, 2);
  const echelle = 728 / 1440;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  ${m.liensPolices.map((l) => `<link rel="stylesheet" href="${l}">`).join('')}
  <style>${BASE_CSS}
    .num{background:${cAccent};color:${clair(cAccent) ? '#1A1A1A' : '#fff'}}
    .nom{font-family:${titrePolice},Inter,sans-serif}
    .vues{display:grid;grid-template-columns:1128px 330px;gap:30px;align-items:end}
    .extraits{display:grid;grid-template-columns:1fr 1fr;gap:32px}
    .bas{display:grid;grid-template-columns:1fr 1fr;gap:40px}
    .palette{display:flex;gap:0;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,.14);height:150px}
    .palette div{flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:12px 12px 10px;font-size:17px;line-height:1.25;font-weight:600}
    .palette small{font-weight:500;font-size:15px;opacity:.85;letter-spacing:.03em}
    .polices{display:grid;grid-template-columns:repeat(${Math.min(m.polices.length, 4) || 1},1fr);gap:14px;height:150px}
    .police{background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,.14);padding:12px 16px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}
    .police b{font-size:50px;line-height:1.1;font-weight:400;white-space:nowrap}
    .police span{font-size:17px;font-weight:700;white-space:nowrap}.police small{font-size:15px;color:#6B6B6B;white-space:nowrap}
  </style></head><body><div class="pl">
    <div class="tete">
      <div class="num">${m.numero}</div>
      <div><div class="sur">Piste ${m.numero} sur 5 · ${esc(p.facette)}</div><div class="nom">« ${esc(m.nom)} »</div>
        <div class="mots">${m.mots.map((x) => `<span class="mot">${esc(x)}</span>`).join('')}</div></div>
    </div>
    <p class="idee">${esc(m.idee)}</p>
    <div class="vues">
      <div><div class="legende">Sur ordinateur</div>
        <div class="cadre"><div class="barre"><i></i><i></i><i></i><span>mogadarr.fr</span></div><img src="${fichierURL(path.join(cap, 'ordi-haut.png'))}"></div></div>
      <div><div class="legende">Sur téléphone</div>
        <div class="tel"><div class="ecran"><img src="${fichierURL(path.join(cap, 'tel-haut.png'))}"></div></div></div>
    </div>
    <div class="extraits">${extraits.map((e) => `<div><div class="legende">${esc(e.titre)}</div>
        <div class="cadre extrait"><img src="${fichierURL(path.join(cap, 'ordi-pleine.png'))}" style="top:-${Math.round(e.y * echelle)}px"></div></div>`).join('')}</div>
    <div class="bas">
      <div><div class="legende">Les couleurs</div><div class="palette">${m.palette.map((c) => `<div style="background:${c.hex};color:${clair(c.hex) ? '#1A1A1A' : '#fff'}">${esc(c.nom)}<small>${c.hex.toUpperCase()}</small></div>`).join('')}</div></div>
      <div><div class="legende">Les polices</div><div class="polices">${m.polices.slice(0, 4).map((f) => `<div class="police"><b style="font-family:'${f.police}'">Aa Éé</b><div><span>${esc(f.police)}</span><br><small>${esc(f.role)}</small></div></div>`).join('')}</div></div>
    </div>
    <div class="pied"><span>mogadarr.fr — pistes de refonte, novembre 2026</span><span>Maquette de travail : textes et images pourront changer</span></div>
  </div></body></html>`;
}

// Page entière découpée en colonnes (ordinateur : 2 colonnes ; téléphone : 5 colonnes)
function gabaritPageEntiere(m, image, hauteurPage, largeurPage, colonnes, titre) {
  const dispo = 1488, ecart = 26;
  const largeurCol = Math.floor((dispo - ecart * (colonnes - 1)) / colonnes);
  const echelle = largeurCol / largeurPage;
  const hauteurCol = Math.ceil((hauteurPage * echelle) / colonnes);
  const titrePolice = m.polices[0] ? `'${m.polices[0].police}'` : 'Inter';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">${m.liensPolices.map((l) => `<link rel="stylesheet" href="${l}">`).join('')}
  <style>${BASE_CSS}.nom{font-family:${titrePolice},Inter,sans-serif;font-size:64px;margin:0}
    .cols{display:flex;gap:${ecart}px;align-items:flex-start}
    .col{width:${largeurCol}px;height:${hauteurCol}px;overflow:hidden;position:relative;background:#fff;border-radius:12px;border:1px solid rgba(0,0,0,.14);box-shadow:0 18px 40px -22px rgba(0,0,0,.35)}
    .col img{position:absolute;left:0;width:${largeurCol}px}
  </style></head><body><div class="pl">
    <div style="display:flex;align-items:baseline;gap:24px;flex-wrap:wrap"><div class="nom">« ${esc(m.nom)} »</div><div class="sur">Piste ${m.numero} · ${esc(titre)}</div></div>
    <div class="cols">${Array.from({ length: colonnes }, (_, i) => `<div class="col"><img src="${fichierURL(image)}" style="top:-${i * hauteurCol}px"></div>`).join('')}</div>
    <div class="pied"><span>mogadarr.fr — pistes de refonte, novembre 2026</span><span>Se lit colonne par colonne, de gauche à droite</span></div>
  </div></body></html>`;
}

function gabaritEnsemble(liste, capActuel) {
  const tuile = (num, nom, facette, idee, img, tel, couleur, police, palette) => `<div class="tuile">
      <div class="vig"><div class="cadre"><img src="${img}"></div>${tel ? `<div class="mini"><img src="${tel}"></div>` : ''}</div>
      <div class="lib"><div class="n" style="background:${couleur};color:${clair(couleur) ? '#1A1A1A' : '#fff'}">${num}</div>
        <div><div class="t" style="font-family:${police}">${nom}</div><div class="f">${facette}</div></div></div>
      <p>${idee}</p><div class="pastilles">${palette.map((c) => `<i style="background:${c.hex}"></i>`).join('')}</div></div>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  ${[...new Set(liste.flatMap((x) => x.m.liensPolices))].map((l) => `<link rel="stylesheet" href="${l}">`).join('')}
  <style>${BASE_CSS}
    h1{font-size:76px;line-height:1.04;letter-spacing:-.02em;font-weight:800}
    .chapo{font-size:32px;line-height:1.4;color:#3A3A3A;max-width:1300px;margin-top:14px}
    .grille{display:grid;grid-template-columns:1fr 1fr;gap:44px 40px}
    .vig{position:relative;padding-right:0}
    .mini{position:absolute;right:18px;bottom:-22px;width:150px;border-radius:22px;border:6px solid #141414;background:#141414;overflow:hidden;box-shadow:0 18px 34px -12px rgba(0,0,0,.55);height:310px}
    .mini img{display:block;width:100%}
    .lib{display:flex;gap:18px;align-items:center;margin-top:22px}
    .n{width:74px;height:74px;border-radius:50%;display:grid;place-items:center;font-size:42px;font-weight:800;flex:none}
    .t{font-size:50px;line-height:1.05}
    .f{font-size:23px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6B6B6B;margin-top:4px}
    .tuile p{font-size:26px;line-height:1.38;color:#2A2A2A;margin-top:12px}
    .pastilles{display:flex;gap:7px;margin-top:14px}.pastilles i{width:30px;height:30px;border-radius:50%;border:1px solid rgba(0,0,0,.22);display:block}
    .tuile.actuel .cadre{filter:saturate(.75)} .tuile.actuel .t{font-family:Inter;font-weight:700;font-size:40px;color:#55524C}
  </style></head><body><div class="pl" style="gap:40px">
    <div><div class="sur">mogadarr.fr · pistes de refonte</div>
      <h1>5 pistes pour le nouveau site de Mo&nbsp;Gadarr</h1>
      <p class="chapo">Cinq facettes de Mo, cinq ambiances. Chaque piste montre la même page d’accueil, avec les mêmes romans et les mêmes textes : seul le style change. Laquelle lui ressemble le plus ?</p></div>
    <div class="grille">
      ${capActuel ? `<div class="tuile actuel"><div class="vig"><div class="cadre"><img src="${fichierURL(path.join(capActuel, 'ordi-haut.png'))}"></div></div>
        <div class="lib"><div class="n" style="background:#D5D2CC;color:#1A1A1A">·</div><div><div class="t">Le site d’aujourd’hui</div><div class="f">pour mémoire</div></div></div>
        <p>Bleu nuit, or et effets de verre : le point de départ.</p></div>` : ''}
      ${liste.map(({ m, cap }) => tuile(m.numero, `« ${esc(m.nom)} »`, esc((PISTES[m.numero] || {}).facette || ''), esc(m.idee),
        fichierURL(path.join(cap, 'ordi-haut.png')), fichierURL(path.join(cap, 'tel-haut.png')), (m.palette[2] || m.palette[1] || { hex: '#C0392B' }).hex,
        m.polices[0] ? `'${m.polices[0].police}',Inter` : 'Inter', m.palette)).join('')}
    </div>
    <div class="pied"><span>Novembre 2026</span><span>Maquettes de travail : textes et images pourront changer</span></div>
  </div></body></html>`;
}

async function rendre(browser, html, fichierSortie, dossierTmp) {
  const tmp = path.join(dossierTmp, '_planche.html');
  fs.writeFileSync(tmp, html);
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.25 });
  const page = await ctx.newPage();
  await page.goto(fichierURL(tmp), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
  fs.mkdirSync(path.dirname(fichierSortie), { recursive: true });
  await page.screenshot({ path: fichierSortie, fullPage: true, type: 'jpeg', quality: 86 });
  const taille = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
  await ctx.close();
  console.log(`  → ${path.relative(RACINE, fichierSortie)} (${Math.round(taille[0] * 1.25)} × ${Math.round(taille[1] * 1.25)} px, ${Math.round(fs.statSync(fichierSortie).size / 1024)} Ko)`);
}

(async () => {
  const fichiers = fs.readdirSync(RACINE).filter((f) => /^[1-9]-.+\.html$/.test(f)).sort();
  const browser = await chromium.launch();
  const liste = [];
  for (const f of fichiers) {
    const m = lireMetas(fs.readFileSync(path.join(RACINE, f), 'utf8'));
    const base = f.replace(/\.html$/, '');
    const cap = path.join(TRAVAIL, base);
    const aFaire = !SEULEMENT.length || SEULEMENT.includes(m.numero);
    if (aFaire || !fs.existsSync(path.join(cap, 'infos.json'))) {
      console.log(`Piste ${m.numero} « ${m.nom} » : captures…`);
      const infos = await capturer(browser, fichierURL(path.join(RACINE, f)), cap);
      fs.writeFileSync(path.join(cap, 'infos.json'), JSON.stringify(infos, null, 1));
      console.log(`  page ordinateur : ${infos.hauteurOrdi} px ; téléphone : ${infos.hauteurTel} px`);
      (infos.plan || []).forEach((b) => console.log(`    y=${String(b.y).padStart(5)}  h=${String(b.h).padStart(5)}  ${b.balise}  ${b.titre}`));
    }
    const infos = JSON.parse(fs.readFileSync(path.join(cap, 'infos.json'), 'utf8'));
    liste.push({ m, cap, base, infos });
    if (aFaire) {
      await rendre(browser, gabaritPiste(m, cap, infos), path.join(SORTIE, `${base}.jpg`), TRAVAIL);
      await rendre(browser, gabaritPageEntiere(m, path.join(cap, 'ordi-pleine.png'), infos.hauteurOrdi, 1440, 2, 'la page d’accueil entière, sur ordinateur'), path.join(SORTIE, 'detail', `${base}-page-entiere.jpg`), TRAVAIL);
      await rendre(browser, gabaritPageEntiere(m, path.join(cap, 'tel-pleine.png'), infos.hauteurTel, 390, 5, 'la page d’accueil entière, sur téléphone'), path.join(SORTIE, 'detail', `${base}-telephone.jpg`), TRAVAIL);
    }
  }
  // Le site d'aujourd'hui, pour mémoire (une seule fois)
  const capActuel = path.join(TRAVAIL, '0-actuel');
  if (!fs.existsSync(path.join(capActuel, 'ordi-haut.png'))) {
    console.log('Site actuel : capture…');
    try { await capturer(browser, SITE_ACTUEL, capActuel, { planDePage: false }); } catch (e) { console.log('  (site actuel non capturé : ' + e.message.split('\n')[0] + ')'); }
  }
  console.log('Vue d’ensemble…');
  await rendre(browser, gabaritEnsemble(liste, fs.existsSync(path.join(capActuel, 'ordi-haut.png')) ? capActuel : null), path.join(SORTIE, '0-vue-d-ensemble.jpg'), TRAVAIL);
  await browser.close();
})();
