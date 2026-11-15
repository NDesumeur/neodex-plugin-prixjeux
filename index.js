// Prix des jeux : les jeux gratuits de la semaine sur Epic, les promos Steam du moment, et ta liste de jeux à surveiller avec une alerte quand le prix descend sous ton seuil.
// Il tourne dans le bac à sable de NeoDex, avec ses outils d'interface (ctx.host) et seulement les autorisations de son plugin.json.
const HTML = `<div class="appWrap">
  <div class="agHead"><span class="label">Prix des jeux</span>
    <div class="agNav" id="pjTabs"><button class="btn px" data-v="free">GRATUITS</button><button class="btn px" data-v="deals">PROMOS</button><button class="btn px" data-v="watch">MA LISTE</button></div></div>
  <div id="pjMain"></div>
  <div class="hint">Prix Steam et GOG en euros (boutiques françaises), promos Humble en dollars, jeux offerts par l'Epic Games Store et ailleurs (GamerPower). Ta liste est vérifiée toutes les 3 heures, même quand cet onglet est fermé : une notification arrive quand un jeu passe sous ton prix ou qu'un nouveau jeu gratuit sort.</div>
</div>`;
const CSS = `#pjTabs{margin-left:auto}#pjTabs .btn.on{--c:var(--magenta);color:#fff}
.pjGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.pjCard{gap:8px;padding-top:0!important;overflow:hidden}.pjCard img{width:calc(100% + 32px);margin:0 -16px;aspect-ratio:460/215;object-fit:cover;background:rgba(0,0,0,.25);image-rendering:auto}
.pjCard .n{color:#fff;font-size:18px}.pjCard .d{font-size:15px;color:var(--lilac)}
.pjPrice{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.pjPrice s{color:var(--muted);font-size:15px}.pjPrice b{font:19px var(--title);color:#fff}
.pjCut{font:13px var(--title);background:#5ad05a;color:#05010b;padding:3px 6px}.pjFree{font:13px var(--title);background:var(--magenta);color:#fff;padding:3px 6px}.pjSoon{font:13px var(--title);background:var(--line2);color:#fff;padding:3px 6px}
.pjRow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.pjRow .btn{margin-left:auto}
.pjSearch{display:flex;gap:8px;margin-bottom:14px}.pjSearch input{flex:1;background:var(--bg2,#14102a);color:#fff;border:2px solid var(--line2,#3a2f6a);font:16px var(--body,inherit);padding:8px 10px}
.pjHits{display:flex;flex-direction:column;gap:6px;margin-bottom:18px}.pjHit{display:grid;grid-template-columns:120px 1fr auto auto;gap:12px;align-items:center;font-size:16px;color:var(--lilac)}.pjHit img{width:120px;height:45px;object-fit:cover}
.pjHit b{color:#fff;font-weight:500}.pjW{display:grid;grid-template-columns:120px 1fr 120px 150px auto;gap:12px;align-items:center;padding:8px 0;border-top:1px solid rgba(255,255,255,.06);font-size:16px;color:var(--lilac)}
.pjW img{width:120px;height:45px;object-fit:cover}.pjW b{color:#fff;font-weight:500}.pjW input{width:80px;font-size:16px;background:var(--bg2,#14102a);color:#fff;border:2px solid var(--line2,#3a2f6a);padding:4px}
.pjW.hit{background:rgba(90,208,90,.1)}.pjW .ok{color:#5ad05a}
.pjShops{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.pjShops .btn.on{--c:var(--magenta);color:#fff}
.pjShop{font:13px var(--title);color:#05010b;background:#c8c0e8;padding:3px 6px}.pjShop.gog{background:#b07ae0}.pjShop.humble{background:#ff8a5a}.pjShop.prime{background:#3ab0ff}.pjShop.steam{background:#7ab8e8}
.pjSub{font:18px var(--title);color:#fff;margin:26px 0 12px}
.pjMain .hint,#pjMain .hint{font-size:15px}
@media (max-width:760px){.pjW{grid-template-columns:90px 1fr auto;}.pjW img{width:90px;height:34px}.pjW>span:nth-of-type(2){grid-column:2/4}.pjHit{grid-template-columns:90px 1fr auto}.pjHit img{width:90px;height:34px}.pjHit>span{display:none}}`;
const STEAM = 'https://store.steampowered.com/', GOG = 'https://catalog.gog.com/v1/catalog?countryCode=FR&locale=fr-FR&currencyCode=EUR&productType=in:game,pack&', CHEAP = 'https://www.cheapshark.com/api/1.0/', GIVE = 'https://www.gamerpower.com/api/giveaways?type=game', EPIC = 'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=fr&country=FR&allowCountries=FR';
const eur = c => (c / 100).toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'}), usd = v => (+v).toLocaleString('fr-FR', {style: 'currency', currency: 'USD'});
// les jeux offerts ailleurs (GamerPower) : sur PC, hors Epic (déjà montré au-dessus), avec leur boutique
function giveaways(list) {
  return (Array.isArray(list) ? list : []).filter(g => g.status === 'Active' && /PC|DRM-Free|Steam|GOG/.test(g.platforms) && !/Epic Games/.test(g.platforms + g.title)).map(g => {
    const shop = /Prime Gaming|Amazon/i.test(g.title + g.platforms) ? 'Prime Gaming' : /GOG/.test(g.title + g.platforms) ? 'GOG' : /Steam/.test(g.platforms) ? 'Steam' : /Itch/i.test(g.platforms) ? 'itch.io' : /Ubisoft/i.test(g.platforms + g.title) ? 'Ubisoft' : 'PC';
    return {id: g.id, title: g.title.replace(/\s*Giveaway$/i, '').replace(/\s*\((Steam|GOG|Prime Gaming|Itch\.io|IndieGala|Ubisoft)[^)]*\)\s*$/i, ''), shop, img: g.thumbnail, to: g.end_date && g.end_date !== 'N/A' ? g.end_date : '', worth: g.worth !== 'N/A' ? g.worth : '', url: g.open_giveaway_url};
  });
}
console.assert(giveaways([{id: 1, status: 'Active', platforms: 'PC, GOG', title: 'Sable (GOG) Giveaway', worth: '$9.99', end_date: 'N/A'}, {id: 2, status: 'Active', platforms: 'PC, Epic Games Store', title: 'X Giveaway'}, {id: 3, status: 'Active', platforms: 'PC', title: 'Y (Prime Gaming) Giveaway'}]).map(g => g.title + '/' + g.shop).join() === 'Sable/GOG,Y/Prime Gaming', 'giveaways');
// un prix GOG (« 799 EUR » = 7,99 €) au format des prix Steam : centimes, réduction en %
const gogPrice = pr => { const f = parseInt(pr?.finalPrice), i = parseInt(pr?.basePrice); return isNaN(f) ? null : {final: f, initial: i, discount_percent: i > f ? Math.round((1 - f / i) * 100) : 0}; };
console.assert(gogPrice({finalPrice: '49 EUR', basePrice: '999 EUR'}).discount_percent === 95, 'gogPrice');
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
  let tab = 'free', gen = 0;
  async function render() {
    if (!view.classList.contains('on')) return;
    view.querySelectorAll('#pjTabs .btn').forEach(b => b.classList.toggle('on', b.dataset.v === tab));
    // chaque affichage se prépare à part : seul le dernier demandé s'affiche (deux clics rapides ne se marchent pas dessus)
    const main = $('pjMain'), box = el('div'), me = ++gen; main.replaceChildren(el('div', 'hint', 'Chargement…'));
    try { await ({free, deals, watch})[tab](box); } catch (e) { box.replaceChildren(el('div', 'hint', 'Prix indisponibles : ' + e.message + '. Vérifie ta connexion.')); }
    if (me === gen) main.replaceChildren(...box.childNodes);
  }
  async function free(main) {
    const list = epicFree(await json(EPIC)), grid = el('div', 'pjGrid');
    for (const g of list) {
      const c = el('div', 'sysCard px pjCard'), p = el('div', 'pjPrice'), d = new Date(g.now ? g.to : g.from);
      p.append(el('span', g.now ? 'pjFree' : 'pjSoon', g.now ? 'GRATUIT' : 'BIENTÔT'), g.price ? el('s', '', eur(g.price)) : '', el('span', 'd', (g.now ? "jusqu'au " : 'à partir du ') + d.toLocaleString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'})));
      c.append(img(g.img), el('div', 'n', g.title), p, el('div', 'd', 'Epic Games Store')); open(c, g.url); grid.append(c);
    }
    main.replaceChildren(list.length ? grid : el('div', 'hint', "Pas de jeu offert annoncé pour l'instant."));
    const more = el('div', 'pjGrid'), other = await json(GIVE).then(giveaways, () => []);
    for (const g of other) {
      const c = el('div', 'sysCard px pjCard'), p = el('div', 'pjPrice');
      p.append(el('span', 'pjFree', 'GRATUIT'), g.worth ? el('s', '', g.worth) : '', g.to ? el('span', 'd', "jusqu'au " + new Date(g.to.replace(' ', 'T')).toLocaleDateString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long'})) : '');
      c.append(img(g.img), el('div', 'n', g.title), p, el('span', 'pjShop ' + (g.shop === 'Prime Gaming' ? 'prime' : g.shop.toLowerCase()), g.shop.toUpperCase())); open(c, g.url); more.append(c);
    }
    const prime = el('div', 'sysCard px pjCard'); prime.style.paddingTop = '14px';
    prime.append(el('span', 'pjShop prime', 'PRIME GAMING'), el('div', 'n', 'Les jeux offerts aux abonnés Amazon Prime'), el('div', 'd', "Amazon ne publie pas sa liste : la page s'ouvre dans un onglet, il faut ton compte Prime pour les récupérer."));
    open(prime, 'https://gaming.amazon.com/home'); more.append(prime);
    main.append(el('div', 'pjSub', 'Offerts ailleurs : GOG, Steam, Prime Gaming…'), more);
  }
  let shop = 'steam';
  async function deals(main) {
    const bar = el('div', 'pjShops');
    for (const [k, t] of [['steam', 'STEAM'], ['gog', 'GOG'], ['humble', 'HUMBLE']]) { const s = el('button', 'btn px' + (shop === k ? ' on' : ''), t); s.dataset.shop = k; s.onclick = () => { shop = k; render(); }; bar.append(s); }
    const grid = el('div', 'pjGrid'), done = items => main.replaceChildren(bar, items ? grid : el('div', 'hint', 'Pas de promo en ce moment dans cette boutique.'));
    const addBtn = (g, label = '+ MA LISTE') => { const a = el('button', 'btn px', watching(g.id) ? '✓ DANS MA LISTE' : label); a.title = 'Surveiller son prix : une notification arrive quand il descend sous ton prix'; a.onclick = () => { follow(g); a.textContent = '✓ DANS MA LISTE'; }; return a; };
    if (shop === 'gog') {
      const j = await json(GOG + 'limit=48&order=desc:trending&discounted=eq:true');
      for (const i of j.products || []) {
        const c = el('div', 'sysCard px pjCard'), p = el('div', 'pjPrice'), f = Math.round(+i.price.finalMoney.amount * 100), o = Math.round(+i.price.baseMoney.amount * 100);
        p.append(el('span', 'pjCut', i.price.discount || ''), el('s', '', eur(o)), el('b', '', eur(f)));
        const r = el('div', 'pjRow'); r.append(el('span', 'pjShop gog', 'GOG'), addBtn({id: 'gog:' + i.id, shop: 'gog', name: i.title, img: i.coverHorizontal, price: f, url: i.storeLink}));
        c.append(img(i.coverHorizontal), el('div', 'n', i.title), p, r); open(c, i.storeLink); grid.append(c);
      }
      return done(j.products?.length);
    }
    if (shop === 'humble') {  // Humble ne publie pas ses prix : ils viennent de CheapShark, en dollars
      const list = await json(CHEAP + 'deals?storeID=11&onSale=1&sortBy=Deal%20Rating&pageSize=40');
      for (const i of Array.isArray(list) ? list : []) {
        const c = el('div', 'sysCard px pjCard'), p = el('div', 'pjPrice'), r = el('div', 'pjRow'), pic = i.steamAppID ? 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/' + i.steamAppID + '/header.jpg' : /^https:\/\/cdn\.humblebundle\.com\//.test(i.thumb) ? i.thumb : '';
        p.append(el('span', 'pjCut', '-' + Math.round(+i.savings) + ' %'), el('s', '', usd(i.normalPrice)), el('b', '', usd(i.salePrice)));
        r.append(el('span', 'pjShop humble', 'HUMBLE'), i.steamAppID ? addBtn({id: +i.steamAppID, name: i.title, img: pic, price: Math.round(+i.salePrice * 100)}, '+ MA LISTE (STEAM)') : '');
        c.append(img(pic), el('div', 'n', i.title), p, r); open(c, 'https://www.cheapshark.com/redirect?dealID=' + i.dealID); grid.append(c);
      }
      main.replaceChildren(bar, el('div', 'hint', 'Prix Humble Store en dollars (CheapShark). « + Ma liste » suit le prix du même jeu sur Steam, en euros.'), list.length ? grid : el('div', 'hint', 'Pas de promo en ce moment.'));
      return;
    }
    const j = await json(STEAM + 'api/featuredcategories?cc=fr&l=french'), seen = new Set(), items = [...(j.specials?.items || []), ...(j.top_sellers?.items || []).filter(i => i.discounted)].filter(i => !seen.has(i.id) && seen.add(i.id));
    for (const i of items.sort((a, b) => b.discount_percent - a.discount_percent)) {
      const c = el('div', 'sysCard px pjCard'), p = el('div', 'pjPrice'), add = addBtn({id: i.id, name: i.name, img: i.header_image || i.large_capsule_image, price: i.final_price});
      p.append(el('span', 'pjCut', '-' + i.discount_percent + ' %'), el('s', '', eur(i.original_price)), el('b', '', eur(i.final_price)));
      const r = el('div', 'pjRow'); r.append(el('span', 'd', i.discount_expiration ? "jusqu'au " + new Date(i.discount_expiration * 1000).toLocaleDateString('fr-FR', {day: 'numeric', month: 'long'}) : 'Steam'), add);
      c.append(img(i.header_image || i.large_capsule_image), el('div', 'n', i.name), p, r); open(c, STEAM + 'app/' + i.id); grid.append(c);
    }
    done(items.length);
  }
  const watching = id => data.watch.some(w => w.id === id);
  function follow(g) { if (watching(g.id)) return; data.watch.push({id: g.id, shop: g.shop || 'steam', url: g.url || STEAM + 'app/' + g.id, name: g.name, img: g.img, target: Math.max(0, Math.floor((g.price || 0) * .8 / 100)), last: g.price ?? null, alerted: false}); save(); toast(g.name + ' est dans ta liste : prix cible ' + eur(data.watch.at(-1).target * 100)); }
  async function prices(all) {  // les prix de plusieurs jeux en une demande par boutique : Steam, et GOG pour les « gog:… »
    const ids = all.filter(id => !String(id).startsWith('gog:')), gog = all.filter(id => String(id).startsWith('gog:')).map(id => id.slice(4)), out = {};
    if (ids.length) { const j = await json(STEAM + 'api/appdetails?appids=' + ids.join(',') + '&cc=fr&filters=price_overview');
      for (const id of ids) { const d = j[id]; out[id] = d?.success ? (d.data?.price_overview || {final: 0, initial: 0, discount_percent: 0, free: true}) : null; } }
    if (gog.length) { const j = await json('https://api.gog.com/products/prices?ids=' + gog.join(',') + '&countryCode=FR&currency=EUR');
      for (const it of j?._embedded?.items || []) out['gog:' + it._embedded?.product?.id] = gogPrice(it._embedded?.prices?.[0]); }
    return out;
  }
  async function watch(main) {
    const box = el('div', 'pjSearch'), q = el('input'), go = el('button', 'btn px', 'CHERCHER'), hits = el('div', 'pjHits');
    q.placeholder = 'Ajouter un jeu Steam ou GOG à surveiller (nom du jeu)…';
    const search = async () => {
      const t = q.value.trim(); if (!t) return; hits.replaceChildren(el('div', 'hint', 'Recherche…'));
      try {
        const [j, k] = await Promise.all([json(STEAM + 'api/storesearch/?term=' + encodeURIComponent(t) + '&l=french&cc=FR'), json(GOG + 'limit=5&query=like:' + encodeURIComponent(t)).catch(() => ({}))]);
        const found = [...(j.items || []).slice(0, 8).map(i => ({id: i.id, name: i.name, img: i.tiny_image, price: i.price?.final ?? 0, s: 'STEAM'})),
          ...(k.products || []).map(i => ({id: 'gog:' + i.id, shop: 'gog', url: i.storeLink, name: i.title, img: i.coverHorizontal, price: Math.round(+i.price.finalMoney.amount * 100), s: 'GOG'}))];
        hits.replaceChildren(...found.map(g => { const r = el('div', 'pjHit'), b = el('button', 'btn px', watching(g.id) ? '✓' : '+ MA LISTE'), n = el('b', '', g.name + ' ');
          b.onclick = () => { follow(g); render(); }; n.append(el('span', 'pjShop ' + g.s.toLowerCase(), g.s));
          r.append(img(g.img), n, el('span', '', g.price ? eur(g.price) : 'gratuit'), b); return r; }));
        if (!found.length) hits.replaceChildren(el('div', 'hint', 'Aucun jeu trouvé.'));
      } catch (e) { hits.replaceChildren(el('div', 'hint', 'Recherche impossible : ' + e.message)); }
    };
    go.onclick = search; q.onkeydown = e => { if (e.key === 'Enter') search(); };
    box.append(q, go);
    const list = el('div', 'sysCard px'); list.append(el('span', 'label', 'Ma liste · ' + data.watch.length + ' jeu' + (data.watch.length > 1 ? 'x' : '')));
    if (!data.watch.length) list.append(el('div', 'hint', 'Ajoute un jeu avec la recherche ou le bouton « + MA LISTE » d\'une promo. Tu choisis ton prix : une notification arrive quand il est atteint.'));
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
      r.append(img(w.img), el('b', '', w.name), now, tg, del); open(r, w.url || STEAM + 'app/' + w.id); list.append(r);
    }
    save(); main.replaceChildren(box, hits, list);
  }
  // ---- la vérification en arrière-plan : prix de la liste et nouveaux jeux gratuits ----
  async function check() {
    try {
      const p = await prices(data.watch.map(w => w.id));
      for (const w of data.watch) {
        const cur = p[w.id]; if (!cur) continue; w.last = cur.final;
        if (cur.final <= w.target * 100 && !w.alerted) { w.alerted = true; ctx.notifications?.send({title: w.name + ' : ' + eur(cur.final), body: (cur.discount_percent ? '-' + cur.discount_percent + ' % · ' : '') + 'sous ton prix de ' + eur(w.target * 100), open: w.url || STEAM + 'app/' + w.id}).catch(() => {}); }
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
