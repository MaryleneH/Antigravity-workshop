// Fabrique tout ce qu'on montre à l'auteure à partir des maquettes N-nom.html.
//
// Usage : node _maquettes/outils/planches.js <dossier_de_travail> [numéros…] [--sans-video]
//   <dossier_de_travail> : dossier temporaire (captures intermédiaires)
//   [numéros]            : pistes à (re)faire ; toutes par défaut. Les vues d'ensemble sont toujours refaites.
//   MG_SORTIE=<dossier>  : où écrire le résultat (par défaut : _maquettes/planches)
//
// Résultat :
//   0-les-5-pistes.jpg            )  images au FORMAT TÉLÉPHONE (1080 × 1920) :
//   N-nom.jpg                     )  lisibles en plein écran, faciles à envoyer par messagerie
//   video/N-nom.mp4               la page d'accueil qui défile sur téléphone (1080 × 1920)
//   detail/0-vue-d-ensemble.jpg   )
//   detail/N-nom-planche.jpg      )  planches détaillées, pour un grand écran (2000 px de large)
//   detail/N-nom-page-entiere.jpg )
//   detail/N-nom-telephone.jpg    )
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const args = process.argv.slice(2);
if (!args[0]) { console.error('Usage : node planches.js <dossier_de_travail> [numéros…] [--sans-video]'); process.exit(2); }
const RACINE = process.env.MG_RACINE ? path.resolve(process.env.MG_RACINE) : path.resolve(__dirname, '..'); // MG_RACINE : pour les essais
const SORTIE = process.env.MG_SORTIE ? path.resolve(process.env.MG_SORTIE) : path.join(RACINE, 'planches');
const TRAVAIL = path.resolve(args[0]);
const SANS_VIDEO = args.includes('--sans-video');
const SEULEMENT = args.slice(1).filter((a) => /^\d+$/.test(a)).map(Number);
const SITE_ACTUEL = 'https://mogadarr.fr/';

// Réglages par piste : la facette de Mo, la phrase courte des cartes, les deux extraits de la planche détaillée
// (y = position dans la page ordinateur de 1440 px de large). Complétés par planches-reglages.json.
const PISTES = {
  1: { facette: 'la prof de lettres' },
  2: { facette: 'la femme de théâtre' },
  3: { facette: 'la romancière engagée' },
  4: { facette: 'l’univers en séries' },
  5: { facette: 'la romance qui fait du bien' },
};
try { const r = require('./planches-reglages.json'); for (const k of Object.keys(r)) PISTES[k] = Object.assign({}, PISTES[k], r[k]); } catch (e) { /* réglages facultatifs */ }

const FIGER = `*,*::before,*::after{animation-duration:.001s !important;animation-delay:0s !important;
  animation-iteration-count:1 !important;transition:none !important;scroll-behavior:auto !important}`;
const UA_TEL = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const TEL = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: UA_TEL };
const fichierURL = (p) => pathToFileURL(path.resolve(p)).href;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const clair = (hex) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) > 150; };
const surFond = (hex) => (clair(hex) ? '#1A1A1A' : '#FFFFFF');
const maj = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const AJUSTER = `<script>document.fonts.ready.then(function(){document.querySelectorAll('[data-max]').forEach(function(e){var max=+e.dataset.max,s=parseFloat(getComputedStyle(e).fontSize);e.style.display='inline-block';e.style.whiteSpace='nowrap';while(e.getBoundingClientRect().width>max&&s>28){s-=2;e.style.fontSize=s+'px';}});});</script>`;

function lireMetas(html) {
  const m = {};
  for (const x of html.matchAll(/<meta\s+name="mg:([a-z]+)"\s+content="([^"]*)"/g)) m[x[1]] = x[2].replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, '’').replace(/&nbsp;/g, ' ');
  const liens = [...html.matchAll(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"[^>]*>/g)].map((x) => x[1].replace(/&amp;/g, '&'));
  const numero = Number(m.numero); const p = PISTES[numero] || {};
  const palette = (m.palette || '').split(/\s*;\s*/).filter(Boolean).map((c) => { const [hex, ...n] = c.trim().split(/\s+/); return { hex, nom: n.join(' ') }; });
  const polices = (m.polices || '').split(/\s*;\s*/).filter(Boolean).map((f) => { const [police, role] = f.split(/\s+[—–-]\s+/); return { police: police.trim(), role: (role || '').trim() }; });
  const accent = p.accent || (palette[2] || palette[1] || { hex: '#C0392B' }).hex;
  return { numero, nom: m.nom || '?', idee: p.idee || m.idee || '', ideeLongue: m.idee || '', mots: (m.mots || '').split(/\s*[,;]\s*/).filter(Boolean),
    palette, polices, liensPolices: liens, accent, facette: p.facette || '', titrePolice: polices[0] ? `'${polices[0].police}'` : 'Inter' };
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

// Une page entière, capturée en tranches (une image unique très haute dépasserait la limite du navigateur).
async function tranches(page, largeur, dossier, prefixe, hauteurTranche) {
  const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);
  const liste = [];
  for (let y = 0, i = 1; y < hauteur; y += hauteurTranche, i++) {
    const h = Math.min(hauteurTranche, hauteur - y);
    const f = `${prefixe}-${i}.png`;
    await page.screenshot({ path: path.join(dossier, f), fullPage: true, clip: { x: 0, y, width: largeur, height: h } });
    liste.push({ fichier: f, h });
  }
  return { hauteur, tranches: liste };
}

async function capturer(browser, url, dossier, { plan = true } = {}) {
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
    if (plan) {
      infos.plan = await page.evaluate(() => {
        const blocs = [...document.querySelectorAll('body > *, body > main > *, body > div > section, body > div > main > *')].filter((e) => !['SCRIPT', 'STYLE', 'LINK'].includes(e.tagName));
        return blocs.map((e) => { const r = e.getBoundingClientRect(); const t = e.querySelector('h1,h2,h3');
          return { y: Math.round(r.top + scrollY), h: Math.round(r.height), balise: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''), titre: t ? t.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) : '' }; })
          .filter((b) => b.h > 80);
      });
    }
    infos.ordi = await tranches(page, 1440, dossier, 'ordi-tranche', 6000);
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ ...TEL, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 90000 }); await preparer(page);
    await page.screenshot({ path: path.join(dossier, 'tel-haut.png') });
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ ...TEL, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 90000 }); await preparer(page);
    infos.tel = await tranches(page, 390, dossier, 'tel-tranche', 3000);
    await ctx.close();
  }
  return infos;
}

// Bande verticale reconstituée à partir des tranches, affichée à la largeur voulue, décalée de `haut` px (à l'échelle).
const bande = (cap, t, largeur, haut) => `<div style="position:absolute;left:0;top:-${Math.round(haut)}px;width:${largeur}px">${
  t.tranches.map((x) => `<img src="${fichierURL(path.join(cap, x.fichier))}" style="display:block;width:${largeur}px">`).join('')}</div>`;

// ====================== FORMAT TÉLÉPHONE : cartes 1080 × 1920 ======================
const CARTE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1080px;height:1920px;overflow:hidden}
  body{background:#F1EEE8;color:#1A1A1A;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .c{position:relative;width:1080px;height:1920px;padding:64px 56px 0}
  .sur{font-size:31px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#6A665F}
  .cadre{background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 30px 60px -28px rgba(0,0,0,.45);border:1px solid rgba(0,0,0,.14)}
  .barre{height:38px;background:#F4F3F1;border-bottom:1px solid rgba(0,0,0,.1);display:flex;align-items:center;gap:8px;padding:0 16px}
  .barre i{width:12px;height:12px;border-radius:50%;background:#D2CEC7;display:block}
  .cadre img{display:block;width:100%}
  .tel{border-radius:54px;background:#151515;padding:13px;box-shadow:0 34px 60px -24px rgba(0,0,0,.55);flex:none}
  .tel .ecran{border-radius:42px;overflow:hidden;background:#fff}
  .tel img{display:block;width:100%}
  .pied{position:absolute;left:56px;right:56px;bottom:34px;display:flex;justify-content:space-between;font-size:26px;color:#77736C}
`;

function gabaritCarte(m, cap) {
  // Écran de téléphone : 304 px de large, aux proportions d'un écran de 390 × 844.
  const ecranL = 304, ecranH = Math.round(ecranL * 844 / 390);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">${m.liensPolices.map((l) => `<link rel="stylesheet" href="${l}">`).join('')}
  <style>${CARTE_CSS}
    .tete{display:flex;gap:30px;align-items:center;height:158px}
    .num{width:158px;height:158px;border-radius:50%;display:grid;place-items:center;font-size:100px;font-weight:800;line-height:1;flex:none;background:${m.accent};color:${surFond(m.accent)}}
    .nom{font-family:${m.titrePolice},Inter,sans-serif;font-size:${m.nom.length > 11 ? 94 : 110}px;line-height:1;margin-top:10px;white-space:nowrap}
    .facette{position:absolute;left:56px;top:246px;font-size:46px;font-weight:700;color:#26231F}
    .idee{position:absolute;left:56px;right:56px;top:314px;font-size:40px;line-height:56px;color:#26231F;height:168px;overflow:hidden}
    .mots{position:absolute;left:56px;top:504px;display:flex;gap:12px}
    .mot{font-size:29px;font-weight:600;padding:7px 22px;border-radius:999px;background:#fff;border:2.5px solid #1A1A1A;white-space:nowrap}
    .ordi{position:absolute;left:56px;top:594px;width:968px}
    .tel{position:absolute;right:56px;top:1094px;width:${ecranL + 26}px}
    .infos{position:absolute;left:56px;top:1272px;width:596px}
    .lab{font-size:27px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6A665F;margin:0 0 14px}
    .couleurs{display:grid;grid-template-columns:repeat(3,1fr);gap:14px 14px;margin-bottom:30px}
    .couleur{font-size:24px;font-weight:600;line-height:30px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .couleur i{display:block;height:70px;border-radius:14px;border:1px solid rgba(0,0,0,.2);margin-bottom:6px}
    .polices{display:flex;flex-direction:column;gap:10px}
    .police{display:flex;align-items:center;gap:16px;height:62px;background:#fff;border:1px solid rgba(0,0,0,.14);border-radius:14px;padding:0 18px;white-space:nowrap;overflow:hidden}
    .police b{font-size:44px;line-height:1;font-weight:400;flex:none;width:76px}
    .police span{font-size:27px;font-weight:700}.police small{font-size:24px;color:#6A665F}
  </style></head><body><div class="c">
    <div class="tete"><div class="num">${m.numero}</div>
      <div><div class="sur">Piste ${m.numero} sur 5</div><div class="nom" data-max="780">« ${esc(m.nom)} »</div></div></div>
    <div class="facette">${esc(maj(m.facette))}</div>
    <p class="idee">${esc(m.idee)}</p>
    <div class="mots">${m.mots.slice(0, 3).map((x) => `<span class="mot">${esc(x)}</span>`).join('')}</div>
    <div class="cadre ordi"><div class="barre"><i></i><i></i><i></i></div><img src="${fichierURL(path.join(cap, 'ordi-haut.png'))}"></div>
    <div class="tel"><div class="ecran" style="height:${ecranH}px"><img src="${fichierURL(path.join(cap, 'tel-haut.png'))}"></div></div>
    <div class="infos">
      <div class="lab">Les couleurs</div>
      <div class="couleurs">${m.palette.slice(0, 6).map((c) => `<div class="couleur"><i style="background:${c.hex}"></i>${esc(c.nom)}</div>`).join('')}</div>
      <div class="lab">Les polices</div>
      <div class="polices">${m.polices.slice(0, 3).map((f) => `<div class="police"><b style="font-family:'${f.police}'">Aa</b><span>${esc(f.police)}</span><small>${esc(f.role)}</small></div>`).join('')}</div>
    </div>
    <div class="pied"><span>mogadarr.fr · maquette de travail</span><span>${m.numero} / 5</span></div>
  </div>${AJUSTER}</body></html>`;
}

function gabaritCarteEnsemble(liste) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">${[...new Set(liste.flatMap((x) => x.m.liensPolices))].map((l) => `<link rel="stylesheet" href="${l}">`).join('')}
  <style>${CARTE_CSS}
    h1{font-size:78px;line-height:1.03;letter-spacing:-.025em;font-weight:800;margin-top:14px}
    .chapo{font-size:37px;line-height:1.34;color:#33302B;margin-top:16px}
    .liste{margin-top:26px;display:flex;flex-direction:column}
    .ligne{display:grid;grid-template-columns:392px 1fr;gap:34px;align-items:center;padding:16px 0;border-top:2px solid rgba(0,0,0,.13)}
    .ligne .cadre{border-radius:16px}
    .n{display:inline-grid;place-items:center;width:64px;height:64px;border-radius:50%;font-size:38px;font-weight:800;vertical-align:middle;margin-right:14px}
    .t{font-size:60px;line-height:1.02;white-space:nowrap}
    .f{font-size:34px;font-weight:600;color:#3D3A34;margin-top:10px;line-height:1.2}
    .pastilles{display:flex;gap:9px;margin-top:16px}.pastilles i{width:38px;height:38px;border-radius:50%;border:1px solid rgba(0,0,0,.22);display:block}
  </style></head><body><div class="c">
    <div class="sur">mogadarr.fr · nouveau design</div>
    <h1>5 pistes pour le site de Mo&nbsp;Gadarr</h1>
    <p class="chapo">La même page d’accueil, cinq ambiances. Laquelle vous ressemble le&nbsp;plus&nbsp;?</p>
    <div class="liste">${liste.map(({ m, cap }) => `<div class="ligne">
      <div class="cadre"><img src="${fichierURL(path.join(cap, 'ordi-haut.png'))}"></div>
      <div><div><span class="n" style="background:${m.accent};color:${surFond(m.accent)}">${m.numero}</span></div>
        <div class="t" data-max="596" style="font-family:${m.titrePolice},Inter;margin-top:10px">« ${esc(m.nom)} »</div>
        <div class="f">${esc(maj(m.facette))}</div>
        <div class="pastilles">${m.palette.slice(0, 6).map((c) => `<i style="background:${c.hex}"></i>`).join('')}</div></div></div>`).join('')}</div>
    <div class="pied"><span>Maquettes de travail · novembre 2026</span><span>Le détail de chaque piste suit</span></div>
  </div>${AJUSTER}</body></html>`;
}

// Carton-titre de la vidéo (dessiné en 1080 × 1922 puis réduit pour tenir dans l'écran de 390 × 694 filmé en ×2,77)
function gabaritCarton(m) {
  const fond = m.accent, texte = surFond(fond);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${m.liensPolices.map((l) => `<link rel="stylesheet" href="${l}">`).join('')}
  <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap');
    *{box-sizing:border-box;margin:0;padding:0} html,body{width:390px;height:694px;overflow:hidden;background:${fond}}
    .k{position:relative;width:1080px;height:1922px;transform:scale(${390 / 1080});transform-origin:0 0;color:${texte};font-family:Inter,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 84px}
    .s{font-size:44px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;opacity:.82}
    .n{font-family:${m.titrePolice},Inter,sans-serif;font-size:${m.nom.length > 11 ? 142 : 168}px;line-height:1;margin:34px 0 40px}
    .f{font-size:60px;font-weight:600;line-height:1.2}
    .i{font-size:46px;line-height:1.38;margin-top:44px;opacity:.94}
    .b{position:absolute;left:84px;bottom:150px;font-size:42px;font-weight:600;opacity:.85}
  </style></head><body><div class="k">
    <div class="s">Piste ${m.numero} sur 5</div><div><div class="n" data-max="912">« ${esc(m.nom)} »</div></div>
    <div class="f">${esc(maj(m.facette))}</div><p class="i">${esc(m.idee)}</p>
    <div class="b">La page d’accueil, sur téléphone ↓</div></div>${AJUSTER}</body></html>`;
}

// ====================== GRAND ÉCRAN : planches détaillées (2000 px de large) ======================
const PLANCHE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1600px;background:#EFEDE8;color:#1A1A1A;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .pl{width:1600px;padding:54px 56px 40px;display:flex;flex-direction:column;gap:30px}
  .tete{display:grid;grid-template-columns:auto 1fr;gap:34px;align-items:center}
  .num{width:150px;height:150px;border-radius:50%;display:grid;place-items:center;font-size:92px;font-weight:800;line-height:1}
  .sur{font-size:24px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#6B6B6B}
  .nom{font-size:104px;line-height:1;margin:6px 0 10px;letter-spacing:-.01em}
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
`;

function gabaritPlanche(m, cap, infos) {
  const p = PISTES[m.numero] || {};
  const H = infos.ordi.hauteur;
  const extraits = (p.extraits && p.extraits.length ? p.extraits : [{ titre: 'Dans la page', y: Math.round(H * 0.3) }, { titre: 'Plus bas', y: Math.round(H * 0.58) }]).slice(0, 2);
  const L = 728, echelle = L / 1440;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">${m.liensPolices.map((l) => `<link rel="stylesheet" href="${l}">`).join('')}
  <style>${PLANCHE_CSS}
    .num{background:${m.accent};color:${surFond(m.accent)}} .nom{font-family:${m.titrePolice},Inter,sans-serif}
    .vues{display:grid;grid-template-columns:1128px 330px;gap:30px;align-items:end}
    .extraits{display:grid;grid-template-columns:1fr 1fr;gap:32px}
    .bas{display:grid;grid-template-columns:1fr 1fr;gap:40px}
    .palette{display:flex;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,.14);height:150px}
    .palette div{flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:12px 12px 10px;font-size:17px;line-height:1.25;font-weight:600}
    .palette small{font-weight:500;font-size:15px;opacity:.85;letter-spacing:.03em}
    .polices{display:grid;grid-template-columns:repeat(${Math.min(m.polices.length, 4) || 1},1fr);gap:14px;height:150px}
    .police{background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,.14);padding:12px 16px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}
    .police b{font-size:50px;line-height:1.1;font-weight:400;white-space:nowrap}
    .police span{font-size:17px;font-weight:700;white-space:nowrap}.police small{font-size:15px;color:#6B6B6B;white-space:nowrap}
  </style></head><body><div class="pl">
    <div class="tete"><div class="num">${m.numero}</div>
      <div><div class="sur">Piste ${m.numero} sur 5 · ${esc(m.facette)}</div><div class="nom">« ${esc(m.nom)} »</div>
        <div class="mots">${m.mots.map((x) => `<span class="mot">${esc(x)}</span>`).join('')}</div></div></div>
    <p class="idee">${esc(m.ideeLongue || m.idee)}</p>
    <div class="vues">
      <div><div class="legende">Sur ordinateur</div>
        <div class="cadre"><div class="barre"><i></i><i></i><i></i><span>mogadarr.fr</span></div><img src="${fichierURL(path.join(cap, 'ordi-haut.png'))}"></div></div>
      <div><div class="legende">Sur téléphone</div>
        <div class="tel"><div class="ecran"><img src="${fichierURL(path.join(cap, 'tel-haut.png'))}"></div></div></div>
    </div>
    <div class="extraits">${extraits.map((e) => `<div><div class="legende">${esc(e.titre)}</div>
        <div class="cadre extrait">${bande(cap, infos.ordi, L, e.y * echelle)}</div></div>`).join('')}</div>
    <div class="bas">
      <div><div class="legende">Les couleurs</div><div class="palette">${m.palette.map((c) => `<div style="background:${c.hex};color:${surFond(c.hex)}">${esc(c.nom)}<small>${c.hex.toUpperCase()}</small></div>`).join('')}</div></div>
      <div><div class="legende">Les polices</div><div class="polices">${m.polices.slice(0, 4).map((f) => `<div class="police"><b style="font-family:'${f.police}'">Aa Éé</b><div><span>${esc(f.police)}</span><br><small>${esc(f.role)}</small></div></div>`).join('')}</div></div>
    </div>
    <div class="pied"><span>mogadarr.fr — pistes de refonte, novembre 2026</span><span>Maquette de travail : textes et images pourront changer</span></div>
  </div></body></html>`;
}

// Page entière en colonnes (ordinateur : 2 colonnes ; téléphone : 6 colonnes)
function gabaritPageEntiere(m, cap, t, largeurPage, colonnes, titre) {
  const dispo = 1488, ecart = 24;
  const largeurCol = Math.floor((dispo - ecart * (colonnes - 1)) / colonnes);
  const echelle = largeurCol / largeurPage;
  const hauteurCol = Math.ceil((t.hauteur * echelle) / colonnes);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">${m.liensPolices.map((l) => `<link rel="stylesheet" href="${l}">`).join('')}
  <style>${PLANCHE_CSS}.nom{font-family:${m.titrePolice},Inter,sans-serif;font-size:64px;margin:0}
    .cols{display:flex;gap:${ecart}px;align-items:flex-start}
    .col{width:${largeurCol}px;height:${hauteurCol}px;overflow:hidden;position:relative;background:#fff;border-radius:12px;border:1px solid rgba(0,0,0,.14);box-shadow:0 18px 40px -22px rgba(0,0,0,.35)}
  </style></head><body><div class="pl">
    <div style="display:flex;align-items:baseline;gap:24px;flex-wrap:wrap"><div class="nom">« ${esc(m.nom)} »</div><div class="sur">Piste ${m.numero} · ${esc(titre)}</div></div>
    <div class="cols">${Array.from({ length: colonnes }, (_, i) => `<div class="col">${bande(cap, t, largeurCol, i * hauteurCol)}</div>`).join('')}</div>
    <div class="pied"><span>mogadarr.fr — pistes de refonte, novembre 2026</span><span>Se lit colonne par colonne, de gauche à droite</span></div>
  </div></body></html>`;
}

function gabaritEnsemble(liste, capActuel) {
  const tuile = ({ m, cap }) => `<div class="tuile">
      <div class="vig"><div class="cadre"><img src="${fichierURL(path.join(cap, 'ordi-haut.png'))}"></div><div class="mini"><img src="${fichierURL(path.join(cap, 'tel-haut.png'))}"></div></div>
      <div class="lib"><div class="n" style="background:${m.accent};color:${surFond(m.accent)}">${m.numero}</div>
        <div><div class="t" style="font-family:${m.titrePolice},Inter">« ${esc(m.nom)} »</div><div class="f">${esc(m.facette)}</div></div></div>
      <p>${esc(m.idee)}</p><div class="pastilles">${m.palette.map((c) => `<i style="background:${c.hex}"></i>`).join('')}</div></div>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">${[...new Set(liste.flatMap((x) => x.m.liensPolices))].map((l) => `<link rel="stylesheet" href="${l}">`).join('')}
  <style>${PLANCHE_CSS}
    h1{font-size:76px;line-height:1.04;letter-spacing:-.02em;font-weight:800}
    .chapo{font-size:32px;line-height:1.4;color:#3A3A3A;max-width:1300px;margin-top:14px}
    .grille{display:grid;grid-template-columns:1fr 1fr;gap:44px 40px}
    .vig{position:relative}
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
      ${liste.map(tuile).join('')}
    </div>
    <div class="pied"><span>Novembre 2026</span><span>Maquettes de travail : textes et images pourront changer</span></div>
  </div></body></html>`;
}

// ====================== Rendu ======================
async function rendre(browser, html, fichierSortie, { largeur = 1600, hauteur = null, echelle = 1.25 } = {}) {
  const tmp = path.join(TRAVAIL, '_planche.html');
  fs.writeFileSync(tmp, html);
  const ctx = await browser.newContext({ viewport: { width: largeur, height: hauteur || 1000 }, deviceScaleFactor: echelle });
  const page = await ctx.newPage();
  await page.goto(fichierURL(tmp), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
  fs.mkdirSync(path.dirname(fichierSortie), { recursive: true });
  await page.screenshot({ path: fichierSortie, fullPage: !hauteur, type: 'jpeg', quality: 88 });
  const taille = hauteur ? [largeur, hauteur] : await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
  await ctx.close();
  console.log(`  → ${path.relative(SORTIE, fichierSortie)} (${Math.round(taille[0] * echelle)} × ${Math.round(taille[1] * echelle)} px, ${Math.round(fs.statSync(fichierSortie).size / 1024)} Ko)`);
}

// Vidéo : carton-titre, puis la page qui défile comme sur un téléphone (1080 × 1920, 30 images/s).
async function filmer(browser, url, m, fichierSortie) {
  fs.mkdirSync(path.dirname(fichierSortie), { recursive: true });
  const IPS = 30, VUE = { width: 390, height: 694 };
  const ctx = await browser.newContext({ ...TEL, viewport: VUE, deviceScaleFactor: 1080 / 390 });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(IPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'crop=1080:1920:0:0,format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '25', '-movflags', '+faststart', fichierSortie],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const fini = new Promise((ok, ko) => { ff.on('close', (c) => (c === 0 ? ok() : ko(new Error('ffmpeg a échoué, code ' + c)))); ff.on('error', ko); });
  const ecrire = async (image, fois = 1) => { for (let i = 0; i < fois; i++) if (!ff.stdin.write(image)) await new Promise((r) => ff.stdin.once('drain', r)); };
  const photo = (page) => page.screenshot({ type: 'jpeg', quality: 92 });

  // 1. Carton-titre (2,4 s)
  const carton = await ctx.newPage();
  const tmp = path.join(TRAVAIL, '_carton.html'); fs.writeFileSync(tmp, gabaritCarton(m));
  await carton.goto(fichierURL(tmp), { waitUntil: 'networkidle' }); await carton.evaluate(() => document.fonts.ready); await carton.waitForTimeout(300);
  await ecrire(await photo(carton), Math.round(2.4 * IPS)); await carton.close();

  // 2. La page : une seconde à l'arrêt, le défilement, puis une seconde et demie à l'arrêt en bas
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 90000 }); await preparer(page);
  const course = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const duree = Math.max(11, Math.min(26, course / 640));
  const n = Math.round(duree * IPS), a = 0.1;   // a : part du temps passée à accélérer, puis à freiner
  const position = (t) => (t < a ? (t * t) / (2 * a * (1 - a)) : t > 1 - a ? 1 - ((1 - t) * (1 - t)) / (2 * a * (1 - a)) : (t - a / 2) / (1 - a));
  await ecrire(await photo(page), IPS);
  let derniere;
  for (let i = 1; i <= n; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(course * position(i / n)));
    derniere = await photo(page); await ecrire(derniere);
  }
  await ecrire(derniere, Math.round(1.5 * IPS));
  ff.stdin.end(); await fini; await ctx.close();
  console.log(`  → ${path.relative(SORTIE, fichierSortie)} (${(2.4 + 1 + duree + 1.5).toFixed(1)} s, ${(fs.statSync(fichierSortie).size / 1e6).toFixed(1)} Mo)`);
}

(async () => {
  fs.mkdirSync(TRAVAIL, { recursive: true });
  const fichiers = fs.readdirSync(RACINE).filter((f) => /^[1-9]-.+\.html$/.test(f)).sort();
  const browser = await chromium.launch();
  const liste = [];
  for (const f of fichiers) {
    const m = lireMetas(fs.readFileSync(path.join(RACINE, f), 'utf8'));
    const base = f.replace(/\.html$/, ''), cap = path.join(TRAVAIL, base), url = fichierURL(path.join(RACINE, f));
    const aFaire = !SEULEMENT.length || SEULEMENT.includes(m.numero);
    if (aFaire || !fs.existsSync(path.join(cap, 'infos.json'))) {
      console.log(`Piste ${m.numero} « ${m.nom} » : captures…`);
      const infos = await capturer(browser, url, cap);
      fs.writeFileSync(path.join(cap, 'infos.json'), JSON.stringify(infos, null, 1));
      console.log(`  page ordinateur : ${infos.ordi.hauteur} px ; téléphone : ${infos.tel.hauteur} px`);
      (infos.plan || []).forEach((b) => console.log(`    y=${String(b.y).padStart(5)}  h=${String(b.h).padStart(5)}  ${b.balise}  ${b.titre}`));
    }
    const infos = JSON.parse(fs.readFileSync(path.join(cap, 'infos.json'), 'utf8'));
    liste.push({ m, cap, base, infos });
    if (aFaire) {
      await rendre(browser, gabaritCarte(m, cap), path.join(SORTIE, `${base}.jpg`), { largeur: 1080, hauteur: 1920, echelle: 1 });
      await rendre(browser, gabaritPlanche(m, cap, infos), path.join(SORTIE, 'detail', `${base}-planche.jpg`));
      await rendre(browser, gabaritPageEntiere(m, cap, infos.ordi, 1440, 2, 'la page d’accueil entière, sur ordinateur'), path.join(SORTIE, 'detail', `${base}-page-entiere.jpg`));
      await rendre(browser, gabaritPageEntiere(m, cap, infos.tel, 390, 6, 'la page d’accueil entière, sur téléphone'), path.join(SORTIE, 'detail', `${base}-telephone.jpg`));
      if (!SANS_VIDEO) await filmer(browser, url, m, path.join(SORTIE, 'video', `${base}.mp4`));
    }
  }
  const capActuel = path.join(TRAVAIL, '0-actuel');
  if (!fs.existsSync(path.join(capActuel, 'ordi-haut.png'))) {
    console.log('Site actuel : capture…');
    try { await capturer(browser, SITE_ACTUEL, capActuel, { plan: false }); } catch (e) { console.log('  (site actuel non capturé : ' + e.message.split('\n')[0] + ')'); }
  }
  console.log('Vues d’ensemble…');
  await rendre(browser, gabaritCarteEnsemble(liste), path.join(SORTIE, '0-les-5-pistes.jpg'), { largeur: 1080, hauteur: 1920, echelle: 1 });
  await rendre(browser, gabaritEnsemble(liste, fs.existsSync(path.join(capActuel, 'ordi-haut.png')) ? capActuel : null), path.join(SORTIE, 'detail', '0-vue-d-ensemble.jpg'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
