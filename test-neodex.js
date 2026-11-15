// lancé par le test « local » de NeoDex : les jeux gratuits (Epic et ailleurs), les promos Steam, GOG et Humble, un jeu GOG ajouté à la liste
// depuis les promos puis retiré, et la taille des textes (avec NEO_SHOTS : l'image de chaque onglet est prise par le test)
module.exports = async ({ pj, sleep }) => {
  const q = code => pj(`(() => { const v = document.getElementById('pjMain'); ${code} })()`);
  const wait = async (code, what) => { for (let i = 0; i < 60; i++) { const r = await q(code); if (r) return r; await sleep(500); } throw new Error(what + ' : rien après 30 s · ' + await q(`return v.textContent.slice(0, 200);`)); };
  const tab = v => pj(`document.querySelector('#pjTabs [data-v="${v}"]').click(), 0`);
  await pj(`window.__e = []; addEventListener('error', e => __e.push(e.message)); addEventListener('unhandledrejection', e => __e.push(String(e.reason))); 0`);
  const out = [];
  await tab('free');
  out.push(await wait(`const s = v.querySelector('.pjSub'); return s && v.querySelectorAll('.pjCard').length + ' gratuits (dont ' + s.nextElementSibling.children.length + ' ailleurs)';`, 'gratuits'));
  const size = await q(`return parseFloat(getComputedStyle(v.querySelector('.pjCard .n')).fontSize);`);
  if (size < 17) throw new Error('textes encore petits : ' + size + ' px');
  await tab('deals');
  out.push(await wait(`return v.querySelectorAll('.pjCard').length && 'Steam ' + v.querySelectorAll('.pjCard').length;`, 'promos Steam'));
  for (const s of ['gog', 'humble']) {
    await pj(`document.querySelector('.pjShops [data-shop="${s}"]').click(), 0`); await sleep(300);
    out.push(await wait(`return v.querySelector('.pjShops .on')?.dataset.shop === '${s}' && v.querySelectorAll('.pjCard').length && '${s} ' + v.querySelectorAll('.pjCard').length;`, 'promos ' + s));
  }
  // un jeu GOG ajouté depuis les promos, qui arrive dans « Ma liste » avec son prix GOG
  await pj(`document.querySelector('.pjShops [data-shop="gog"]').click(), 0`);
  const name = await wait(`const c = v.querySelector('.pjCard'); if (!c || v.querySelector('.pjShops .on')?.dataset.shop !== 'gog') return ''; const b = [...c.querySelectorAll('button')].find(b => /MA LISTE/.test(b.textContent)); b.click(); return c.querySelector('.n').textContent;`, 'bouton + Ma liste');
  await tab('watch');
  const row = await wait(`const r = [...v.querySelectorAll('.pjW')].find(r => r.textContent.includes(${JSON.stringify(name)})); return r && r.textContent;`, 'jeu GOG dans la liste');
  const price = /[\d,]+\s€/.exec(row)?.[0]; if (!price) throw new Error('pas de prix GOG dans la liste : ' + row);
  out.push('« ' + name + ' » suivi à ' + price);
  await q(`[...v.querySelectorAll('.pjW')].find(r => r.textContent.includes(${JSON.stringify(name)})).querySelector('button').click(); return 0;`); await sleep(500);
  await tab('deals'); await wait(`return !!v.querySelector('.pjShops');`, 'barre des boutiques'); await pj(`document.querySelector('.pjShops [data-shop="steam"]').click(), 0`); await wait(`return v.querySelector('.pjShops .on')?.dataset.shop === 'steam' && v.querySelectorAll('.pjCard').length;`, 'retour Steam');
  const errs = await pj(`__e.join(' | ')`); if (errs) throw new Error('erreur : ' + errs);
  const L = await pj(`(() => ({ sw: document.documentElement.scrollWidth, ww: innerWidth }))()`);
  if (L.sw > L.ww + 1) throw new Error('la page déborde sur le côté : ' + JSON.stringify(L));
  return out.join(' · ');
};
