// Prix des jeux : les jeux gratuits de la semaine sur Epic, les promos Steam du moment, et ta liste de jeux à surveiller avec une alerte quand le prix descend sous ton seuil.
// Il tourne dans le bac à sable de NeoDex, avec ses outils d'interface (ctx.host) et seulement les autorisations de son plugin.json.
const HTML = `<div class="appWrap">
  <div class="agHead"><span class="label">Prix des jeux</span>
    <div class="agNav" id="pjTabs"><button class="btn px" data-v="free">GRATUITS</button><button class="btn px" data-v="deals">PROMOS STEAM</button><button class="btn px" data-v="watch">MA LISTE</button></div></div>
  <div id="pjMain"></div>
  <div class="hint">Prix Steam en euros (boutique française) et jeux offerts par l'Epic Games Store. Ta liste est vérifiée toutes les 3 heures, même quand cet onglet est fermé : une notification arrive quand un jeu passe sous ton prix ou qu'un nouveau jeu gratuit sort.</div>
</div>`;
const CSS = `#pjTabs{margin-left:auto}#pjTabs .btn.on{--c:var(--magenta);color:#fff}
.pjGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.pjCard{gap:8px;padding-top:0!important;overflow:hidden}.pjCard img{width:calc(100% + 32px);margin:0 -16px;aspect-ratio:460/215;object-fit:cover;background:rgba(0,0,0,.25);image-rendering:auto}
.pjCard .n{color:#fff;font-size:15px}.pjCard .d{font-size:13px;color:var(--lilac)}
.pjPrice{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.pjPrice s{color:var(--muted);font-size:13px}.pjPrice b{font:16px var(--title);color:#fff}
.pjCut{font:11px var(--title);background:#5ad05a;color:#05010b;padding:3px 6px}.pjFree{font:11px var(--title);background:var(--magenta);color:#fff;padding:3px 6px}.pjSoon{font:11px var(--title);background:var(--line2);color:#fff;padding:3px 6px}
.pjRow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.pjRow .btn{margin-left:auto}
.pjSearch{display:flex;gap:8px;margin-bottom:14px}.pjSearch input{flex:1;background:var(--bg2,#14102a);color:#fff;border:2px solid var(--line2,#3a2f6a);font:14px var(--body,inherit);padding:6px 8px}
.pjHits{display:flex;flex-direction:column;gap:6px;margin-bottom:18px}.pjHit{display:grid;grid-template-columns:120px 1fr auto auto;gap:12px;align-items:center;font-size:14px;color:var(--lilac)}.pjHit img{width:120px;height:45px;object-fit:cover}
.pjHit b{color:#fff;font-weight:500}.pjW{display:grid;grid-template-columns:120px 1fr 120px 150px auto;gap:12px;align-items:center;padding:8px 0;border-top:1px solid rgba(255,255,255,.06);font-size:14px;color:var(--lilac)}
.pjW img{width:120px;height:45px;object-fit:cover}.pjW b{color:#fff;font-weight:500}.pjW input{width:70px;background:var(--bg2,#14102a);color:#fff;border:2px solid var(--line2,#3a2f6a);padding:4px}
.pjW.hit{background:rgba(90,208,90,.1)}.pjW .ok{color:#5ad05a}`;
const STEAM = 'https://store.steampowered.com/', EPIC = 'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=fr&country=FR&allowCountries=FR';
const eur = c => (c / 100).toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'});
// les jeux offerts par Epic : en ce moment (réduction de 100 %) et la semaine prochaine
function epicFree(j, now = Date.now()) {
  const out = [];
  for (const e of j?.data?.Catalog?.searchStore?.elements || []) {
    const cur = e.promotions?.promotionalOffers?.[0]?.promotionalOffers || [], up = e.promotions?.upcomingPromotionalOffers?.[0]?.promotionalOffers || [];
    const pick = (list, soon) => list.find(o => o.discountSetting?.discountPercentage === 0 && (soon || (new Date(o.startDate) <= now && new Date(o.endDate) > now)));
    const o = pick(cur, false) || pick(up, true); if (!o) continue;
    const slug = e.offerMappings?.[0]?.pageSlug || e.catalogNs?.mappings?.[0]?.pageSlug || e.productSlug;
    const img = (e.keyImages || []).find(k => k.type === 'OfferImageWide') || (e.keyImages || []).find(k => k.type === 'DieselStoreFrontWide') || e.keyImages?.[0];
    out.push({id: e.id, title: e.title, img: img?.url || '', from: o.startDate, to: o.endDate, now: !!pick(cur, false), price: e.price?.totalPrice?.originalPrice || 0, url: slug ? 'https://store.epicgames.com/fr/p/' + slug : 'https://store.epicgames.com/fr/free-games'});
  }
  return out.sort((a, b) => b.now - a.now || a.from.localeCompare(b.from));
}
console.assert(epicFree({data: {Catalog: {searchStore: {elements: [{id: 'a', title: 'A', productSlug: 'a', promotions: {promotionalOffers: [{promotionalOffers: [{startDate: '2020-01-01', endDate: '2999-01-01', discountSetting: {discountPercentage: 0}}]}]}}, {id: 'b', title: 'B', promotions: {promotionalOffers: [{promotionalOffers: [{startDate: '2020-01-01', endDate: '2999-01-01', discountSetting: {discountPercentage: 50}}]}]}}]}}}}).map(g => g.id).join() === 'a', 'epicFree');
export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoDex pour s'ouvrir."; return; }
  const { el, toast, newTab } = ctx.host, folder = ctx.folder;
  ctx.host.addStyle(CSS);
  view.innerHTML = HTML;
  const $ = id => view.querySelector('#' + id);
  const doc = async n => { try { return await folder.read(n); } catch { return null; } };
  let data = (await doc('data')) || {watch: [], seenFree: []};  // watch : [{id, name, img, target, last, alerted}]
  const save = () => folder.write('data', data).catch(() => {});
  const json = async url => { const r = await ctx.net(url); if (!r.ok) throw new Error('le serveur répond ' + r.status); return JSON.parse(r.body); };  // par NeoDex : Steam et Epic n'acceptent pas les demandes venues d'une page
  const img = src => { const i = el('img'); i.src = src || ''; i.loading = 'lazy'; i.onerror = () => i.style.visibility = 'hidden'; return i; };
  const open = (node, url) => { node.style.cursor = 'var(--cp,pointer)'; node.title = 'Ouvrir la page du jeu'; node.onclick = e => { if (e.target.closest('button,input')) return; newTab(url); }; };
  let tab = 'free';
  async function render() {
    if (!view.classList.contains('on')) return;
    view.querySelectorAll('#pjTabs .btn').forEach(b => b.classList.toggle('on', b.dataset.v === tab));
    const main = $('pjMain'); main.replaceChildren(el('div', 'hint', 'Chargement…'));
    try { await ({free, deals, watch})[tab](main); } catch (e) { main.replaceChildren(el('div', 'hint', 'Prix indisponibles : ' + e.message + '. Vérifie ta connexion.')); }
  }
  async function free(main) {
    const list = epicFree(await json(EPIC)), grid = el('div', 'pjGrid');
    for (const g of list) {
      const c = el('div', 'sysCard px pjCard'), p = el('div', 'pjPrice'), d = new Date(g.now ? g.to : g.from);
      p.append(el('span', g.now ? 'pjFree' : 'pjSoon', g.now ? 'GRATUIT' : 'BIENTÔT'), g.price ? el('s', '', eur(g.price)) : '', el('span', 'd', (g.now ? "jusqu'au " : 'à partir du ') + d.toLocaleString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'})));
      c.append(img(g.img), el('div', 'n', g.title), p, el('div', 'd', 'Epic Games Store')); open(c, g.url); grid.append(c);
    }
    main.replaceChildren(list.length ? grid : el('div', 'hint', "Pas de jeu offert annoncé pour l'instant."));
  }
  async function deals(main) {
    const j = await json(STEAM + 'api/featuredcategories?cc=fr&l=french'), seen = new Set(), items = [...(j.specials?.items || []), ...(j.top_sellers?.items || []).filter(i => i.discounted)].filter(i => !seen.has(i.id) && seen.add(i.id));
    const grid = el('div', 'pjGrid');
    for (const i of items.sort((a, b) => b.discount_percent - a.discount_percent)) {
      const c = el('div', 'sysCard px pjCard'), p = el('div', 'pjPrice'), add = el('button', 'btn px', watching(i.id) ? '✓ SUIVI' : '+ SUIVRE');
      p.append(el('span', 'pjCut', '-' + i.discount_percent + ' %'), el('s', '', eur(i.original_price)), el('b', '', eur(i.final_price)));
      add.onclick = () => { follow({id: i.id, name: i.name, img: i.header_image || i.large_capsule_image, price: i.final_price}); add.textContent = '✓ SUIVI'; };
      const r = el('div', 'pjRow'); r.append(el('span', 'd', i.discount_expiration ? "jusqu'au " + new Date(i.discount_expiration * 1000).toLocaleDateString('fr-FR', {day: 'numeric', month: 'long'}) : 'Steam'), add);
      c.append(img(i.header_image || i.large_capsule_image), el('div', 'n', i.name), p, r); open(c, STEAM + 'app/' + i.id); grid.append(c);
    }
    main.replaceChildren(items.length ? grid : el('div', 'hint', 'Pas de promo mise en avant sur Steam en ce moment.'));
  }
  const watching = id => data.watch.some(w => w.id === id);
  function follow(g) { if (watching(g.id)) return; data.watch.push({id: g.id, name: g.name, img: g.img, target: Math.max(0, Math.floor((g.price || 0) * .8 / 100)), last: g.price ?? null, alerted: false}); save(); toast(g.name + ' est dans ta liste : prix cible ' + eur(data.watch.at(-1).target * 100)); }
  async function prices(ids) {  // les prix Steam de plusieurs jeux en une demande
    if (!ids.length) return {};
    const j = await json(STEAM + 'api/appdetails?appids=' + ids.join(',') + '&cc=fr&filters=price_overview'), out = {};
    for (const id of ids) { const d = j[id]; out[id] = d?.success ? (d.data?.price_overview || {final: 0, initial: 0, discount_percent: 0, free: true}) : null; }
    return out;
  }
  async function watch(main) {
    const box = el('div', 'pjSearch'), q = el('input'), go = el('button', 'btn px', 'CHERCHER'), hits = el('div', 'pjHits');
    q.placeholder = 'Ajouter un jeu Steam à surveiller (nom du jeu)…';
    const search = async () => {
      const t = q.value.trim(); if (!t) return; hits.replaceChildren(el('div', 'hint', 'Recherche…'));
      try {
        const j = await json(STEAM + 'api/storesearch/?term=' + encodeURIComponent(t) + '&l=french&cc=FR');
        hits.replaceChildren(...(j.items || []).slice(0, 8).map(i => { const r = el('div', 'pjHit'), b = el('button', 'btn px', watching(i.id) ? '✓' : '+ SUIVRE');
          b.onclick = () => { follow({id: i.id, name: i.name, img: i.tiny_image, price: i.price?.final ?? 0}); render(); };
          r.append(img(i.tiny_image), el('b', '', i.name), el('span', '', i.price ? eur(i.price.final) : 'gratuit'), b); return r; }));
        if (!j.items?.length) hits.replaceChildren(el('div', 'hint', 'Aucun jeu trouvé.'));
      } catch (e) { hits.replaceChildren(el('div', 'hint', 'Recherche impossible : ' + e.message)); }
    };
    go.onclick = search; q.onkeydown = e => { if (e.key === 'Enter') search(); };
    box.append(q, go);
    const list = el('div', 'sysCard px'); list.append(el('span', 'label', 'Ma liste · ' + data.watch.length + ' jeu' + (data.watch.length > 1 ? 'x' : '')));
    if (!data.watch.length) list.append(el('div', 'hint', 'Ajoute un jeu avec la recherche ou le bouton « + SUIVRE » d\'une promo. Tu choisis ton prix : une notification arrive quand il est atteint.'));
    const p = await prices(data.watch.map(w => w.id)).catch(() => ({}));
    for (const w of data.watch) {
      const cur = p[w.id], r = el('div', 'pjW'), t = el('input'), del = el('button', 'btn px', '✕');
      if (cur) w.last = cur.final;
      const hit = w.last != null && w.last <= w.target * 100; if (hit) r.classList.add('hit');
      t.type = 'number'; t.min = 0; t.value = w.target; t.title = 'Prévenir quand le prix descend à ce montant (en euros) ou moins';
      t.onchange = () => { w.target = Math.max(0, +t.value || 0); w.alerted = false; save(); render(); };
      del.title = 'Retirer de la liste'; del.onclick = () => { data.watch = data.watch.filter(x => x !== w); save(); render(); };
      const now = el('span'); now.append(w.last == null ? '—' : el('b', hit ? 'ok' : '', eur(w.last)), cur?.discount_percent ? ' (-' + cur.discount_percent + ' %)' : '');
      const tg = el('span'); tg.append('alerte à ', t, ' €');
      r.append(img(w.img), el('b', '', w.name), now, tg, del); open(r, STEAM + 'app/' + w.id); list.append(r);
    }
    save(); main.replaceChildren(box, hits, list);
  }
  // ---- la vérification en arrière-plan : prix de la liste et nouveaux jeux gratuits ----
  async function check() {
    try {
      const p = await prices(data.watch.map(w => w.id));
      for (const w of data.watch) {
        const cur = p[w.id]; if (!cur) continue; w.last = cur.final;
        if (cur.final <= w.target * 100 && !w.alerted) { w.alerted = true; ctx.notifications?.send({title: w.name + ' : ' + eur(cur.final), body: (cur.discount_percent ? '-' + cur.discount_percent + ' % · ' : '') + 'sous ton prix de ' + eur(w.target * 100), open: STEAM + 'app/' + w.id}).catch(() => {}); }
        if (cur.final > w.target * 100) w.alerted = false;  // il remonte : on pourra prévenir à la prochaine baisse
      }
    } catch {}
    try {
      const now = epicFree(await json(EPIC)).filter(g => g.now), fresh = now.filter(g => !data.seenFree.includes(g.id));
      if (fresh.length && data.seenFree.length) ctx.notifications?.send({title: 'Gratuit sur Epic : ' + fresh.map(g => g.title).join(', '), body: "Offert jusqu'au " + new Date(fresh[0].to).toLocaleDateString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long'}), open: fresh[0].url}).catch(() => {});
      data.seenFree = [...new Set([...data.seenFree, ...now.map(g => g.id)])].slice(-60);
    } catch {}
    save();
  }
  $('pjTabs').onclick = e => { const v = e.target.dataset.v; if (v) { tab = v; render(); } };
  ctx.background?.every(180, check).catch(() => {}); setTimeout(check, 20000);
  ctx.onOpen(() => render());
}
