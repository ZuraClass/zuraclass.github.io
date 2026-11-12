/* Pustaka bersama untuk /products (publik) dan /catalog (admin). Diekspos sebagai window.ZLP */
(function () {
  let LANG = 'id';
  try { LANG = localStorage.getItem('zl_lang') || ((navigator.language || 'id').toLowerCase().startsWith('id') ? 'id' : 'en'); } catch (e) {}
  const t = (id, en) => (LANG === 'id' ? id : en);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // path relatif repo ("assets/products/..") -> URL root situs; blob:/data:/http dibiarkan
  const src = p => (!p ? '' : /^(https?:|blob:|data:)/.test(p) ? p : '/' + String(p).replace(/^\/+/, ''));
  const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'produk';
  const fmtDate = iso => (iso ? new Date(iso).toLocaleDateString(LANG === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const catLabel = c => c || t('Lainnya', 'Other');
  const waLink = (base, text) => (base ? base + (base.includes('?') ? '&' : '?') + 'text=' + encodeURIComponent(text) : '');

  /* Harga Rupiah bulat. null = harga belum diisi (bukan Rp0). */
  function parsePrice(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : null;
    const cleaned = String(value).trim().replace(/^Rp\s*/i, '').replace(/[.\s]/g, '');
    if (!/^\d+$/.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  }
  const fmtPrice = price => 'Rp' + Number(price).toLocaleString('id-ID', { maximumFractionDigits: 0 });
  const fmtUSD = price => 'US$' + Number(price).toLocaleString('en-US', { maximumFractionDigits: 0 });

  /* Harga USD ditetapkan manual di Catalog, bukan hasil konversi otomatis. */
  function parseUSDPrice(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : null;
    const cleaned = String(value).trim().replace(/^(?:US\$|USD|\$)\s*/i, '').replace(/,/g, '');
    if (!/^\d+$/.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  }

  /* Rekomendasi = CEILING((harga IDR x 130%) / 18000), dalam USD bulat. */
  function recommendUSD(idrPrice) {
    const price = parsePrice(idrPrice);
    return price === null ? null : Math.ceil(price * 13 / 180000);
  }

  /*
   * PRICE DESIGN v3 — tepat tiga baris per region:
   * 1) region & mata uang; 2) harga normal dicoret + SALE/PROMO;
   * 3) harga final/promo yang menjadi fokus.
   *
   * Responsive berdasarkan LEBAR KOMPONEN, bukan lebar layar. Kartu sempit
   * menjadi susunan vertikal; panel detail yang lebar tetap dua kolom.
   * Tidak memodifikasi nilai harga/checkout yang berasal dari Catalog.
   */
  function mountPriceStyles() {
    if (typeof document === 'undefined' || document.getElementById('zl-price-styles-v3')) return;
    const css = `
      .zl-price-shell {container-type:inline-size; container-name:zlprice; width:100%;}
      .zl-price-grid {display:grid;grid-template-columns:minmax(0,1fr);gap:0;}
      .zl-price-col {display:grid;grid-template-rows:minmax(1.1rem,auto) minmax(1.45rem,auto) minmax(2.15rem,auto);
        align-content:start;row-gap:.32rem;min-width:0;padding:0;}
      .zl-price-col+.zl-price-col {border-top:1px solid #e2e8f0;margin-top:.85rem;padding-top:.8rem;}
      .zl-price-region {min-width:0;font-size:clamp(.625rem,2.3cqw,.7rem);line-height:1.4;
        font-weight:850;letter-spacing:.09em;text-transform:uppercase;color:#94a3b8;white-space:normal;}
      .zl-price-col--usd .zl-price-region {color:#3b82f6;}
      .zl-price-previous {display:flex;flex-wrap:nowrap;align-items:center;gap:.5rem;min-height:1.45rem;min-width:0;}
      .zl-price-old {font-size:clamp(.75rem,2.8cqw,.9rem);font-weight:650;color:#94a3b8;
        white-space:nowrap;line-height:1.3;}
      .zl-price-badge {font-size:.6rem;font-weight:850;white-space:nowrap;line-height:1.3;
        border-radius:.4rem;padding:.18rem .42rem;background:#fff1f2;color:#e11d48;letter-spacing:.025em;}
      .zl-price-value {display:block;min-width:0;color:#0A1931;font-family:Sora,Inter,sans-serif;font-weight:850;
        font-size:clamp(1.35rem,5.2cqw,2.1rem);line-height:1.2;letter-spacing:-.055em;
        font-variant-numeric:tabular-nums;white-space:nowrap;}
      .zl-price-shell[data-size="card"] .zl-price-value {font-size:clamp(1.25rem,5.1cqw,1.78rem);}
      .zl-price-unavailable {display:block;font-size:.8rem;line-height:1.3;color:#94a3b8;font-weight:650;}
      @container zlprice (min-width:400px) {
        .zl-price-grid {grid-template-columns:repeat(2,minmax(0,1fr));}
        .zl-price-col+.zl-price-col {border-top:0;border-left:1px solid #e2e8f0;margin-top:0;
          padding-top:0;padding-left:clamp(.7rem,2.3cqw,1.15rem);margin-left:clamp(.4rem,1.2cqw,.65rem);}
      }
    `;
    const el = document.createElement('style');
    el.id = 'zl-price-styles-v3'; el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  function priceMarkup(p, opts = {}) {
    mountPriceStyles();
    const large = !!opts.large;
    const region = (label, normal, promo, formatter, empty, regionClass) => {
      const sale = normal !== null && promo !== null && promo < normal;
      const finalValue = sale ? promo : normal;
      const previous = sale
        ? `<del class="zl-price-old">${esc(formatter(normal))}</del><span class="zl-price-badge">${t('PROMO','SALE')}</span>`
        : '<span aria-hidden="true">&nbsp;</span>';
      return `<div class="zl-price-col ${regionClass}">
        <div class="zl-price-region">${esc(label)}</div>
        <div class="zl-price-previous">${previous}</div>
        ${finalValue === null
          ? `<span class="zl-price-unavailable">${esc(empty)}</span>`
          : `<strong class="zl-price-value">${esc(formatter(finalValue))}</strong>`}
      </div>`;
    };
    const idrNormal = parsePrice(p.normalPrice), idrPromo = parsePrice(p.promoPrice);
    const usdNormal = parseUSDPrice(p.usdNormalPrice), usdPromo = parseUSDPrice(p.usdPromoPrice);
    return `<div class="zl-price-shell" data-size="${large ? 'large' : 'card'}" data-dual-prices>
      <div class="zl-price-grid">
        ${region('INDONESIA · IDR', idrNormal, idrPromo, fmtPrice,
          t('Harga belum tersedia','Price unavailable'), 'zl-price-col--idr')}
        ${region('INTERNATIONAL · USD', usdNormal, usdPromo, fmtUSD,
          t('Harga belum tersedia','Price unavailable'), 'zl-price-col--usd')}
      </div>
    </div>`;
  }

  /* Tautan checkout hanya HTTPS, tidak pernah fallback diam-diam ke WA. */
  function validHTTPS(value) {
    try {
      const url = new URL(String(value || '').trim());
      return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url.href : '';
    } catch (e) { return ''; }
  }
  const checkoutHref = p => validHTTPS(p.checkoutUrl);
  const lemonCheckoutHref = p => validHTTPS(p.lemonCheckoutUrl);
  const shareHref = p => '/products/share/' + encodeURIComponent(String(p.slug || p.id)) + '/';

  /* Teks beberapa baris -> daftar poin (satu baris = satu poin).
     Format "Judul | keterangan": judul ditebalkan. inline=true -> "Judul: keterangan" dalam satu baris. */
  function listMarkup(text, inline) {
    const rows = String(text || '').split(/\r?\n/).map(s => s.trim().replace(/^[-*•]\s+/, '')).filter(Boolean).slice(0, 40);
    return rows.map(row => {
      const i = row.indexOf('|');
      const head = i > 0 ? row.slice(0, i).trim() : '', body = (i >= 0 ? row.slice(i + 1) : row).trim();
      if (inline) return `<li class="block text-[13px] leading-relaxed text-slate-700 break-words">${head ? `<b class="font-bold text-zura-navy">${esc(head)}:</b> ` : ''}${esc(body)}</li>`;
      return `<li class="block"><div class="min-w-0"><div class="text-sm break-words ${head ? 'font-bold text-zura-navy' : 'text-slate-700'}">${esc(head || body)}</div>${head && body ? `<div class="text-[13px] leading-relaxed text-slate-600 break-words mt-0.5">${esc(body)}</div>` : ''}</div></li>`;
    }).join('');
  }

  function normalize(d) {
    const ps = (d && Array.isArray(d.products) ? d.products : []).map(p => ({
      id: String(p.id), slug: String(p.slug || p.id), title: String(p.title || ''), category: String(p.category || ''),
      tags: Array.isArray(p.tags) ? p.tags.map(String) : [], description: String(p.description || ''), checkoutUrl: String(p.checkoutUrl || ''),
      lemonCheckoutUrl: String(p.lemonCheckoutUrl || ''), shareImage: p.shareImage || null,
      features: String(p.features || ''), includes: String(p.includes || ''), terms: String(p.terms || ''),
       normalPrice: parsePrice(p.normalPrice), promoPrice: parsePrice(p.promoPrice),
      usdNormalPrice: parseUSDPrice(p.usdNormalPrice), usdPromoPrice: parseUSDPrice(p.usdPromoPrice),
      cover: p.cover || null, images: Array.isArray(p.images) ? p.images.slice(0, 15) : [],
      published: p.published !== false, createdAt: p.createdAt || null, updatedAt: p.updatedAt || p.createdAt || null
    }));
    return { products: ps, updatedAt: (d && d.updatedAt) || null };
  }
  async function loadProducts(url) {
    try {
      const r = await fetch((url || '/data/products.json') + '?t=' + Math.floor(Date.now() / 600000), { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      return normalize(await r.json());
    } catch (e) { return { products: [], updatedAt: null, error: e.message }; }
  }
  function groupByCategory(list) {
    const m = new Map();
    list.forEach(p => { const k = (p.category || '').trim(); if (!m.has(k)) m.set(k, []); m.get(k).push(p); });
    return [...m.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])));
  }

  /* Kartu produk. Kartu admin memakai footer; kartu publik memiliki dua CTA. */
  function card(p, o = {}) {
    const cover = o.coverUrl !== undefined ? o.coverUrl : src(p.cover);
    const n = o.imageCount !== undefined ? o.imageCount : (p.images || []).length + (p.cover ? 1 : 0);
    const open = o.href ? `<a href="${esc(o.href)}" data-open="${esc(p.id)}"` : `<button type="button" data-open="${esc(p.id)}"`;
    const close = o.href ? '</a>' : '</button>';
    const tags = (p.tags || []).slice(0, 3).map(x => `<span class="text-[11px] font-bold text-blue-700 bg-blue-50 rounded-md px-2 py-0.5">${esc(x)}</span>`).join('');
    const more = (p.tags || []).length > 3 ? `<span class="text-[11px] font-bold text-slate-400">+${p.tags.length - 3}</span>` : '';
    const canBuy = !!(checkoutHref(p) || lemonCheckoutHref(p));
    const buttons = o.href ? `<div class="px-4 pb-4 grid grid-cols-2 gap-2.5">
      ${canBuy ? `<button type="button" data-checkout-product="${esc(p.id)}" class="min-w-0 px-2.5 py-3 text-center rounded-xl bg-zura-navy hover:bg-blue-700 text-white text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-1.5"><i data-lucide="shopping-cart" class="w-4 h-4 shrink-0"></i>${t('Beli Sekarang', 'Buy Now')}</button>` : `<span aria-disabled="true" title="${t('Link checkout belum diisi', 'Checkout link is missing')}" class="min-w-0 px-2 py-3 text-center rounded-xl bg-slate-100 text-slate-400 text-xs sm:text-sm font-bold flex items-center justify-center">${t('Belum Tersedia', 'Unavailable')}</span>`}
      <a href="${esc(o.href)}" data-open="${esc(p.id)}" class="min-w-0 px-2.5 py-3 rounded-xl border border-blue-200 hover:border-blue-600 hover:bg-blue-50 text-blue-700 text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-1.5"><i data-lucide="eye" class="w-4 h-4 shrink-0"></i>${t('Lihat Detail', 'View Details')}</a>
    </div>` : '';
    return `
    <article class="spot lift glass rounded-2xl overflow-hidden group flex flex-col fade-up" style="--d:${o.delay || 0}ms">
      ${open} class="block text-left w-full flex-1 flex flex-col" aria-label="${esc(p.title)}">
        <div class="relative aspect-square bg-white overflow-hidden">
          ${cover ? `<img src="${esc(cover)}" loading="lazy" alt="${esc(p.title)}" class="w-full h-full object-contain group-hover:scale-105 transition duration-500" />`
            : `<span class="absolute inset-0 grid place-items-center text-blue-300"><i data-lucide="image" class="w-10 h-10"></i></span>`}
          <span class="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-zura-navy/85 text-white text-[11px] font-semibold backdrop-blur">${esc(catLabel(p.category))}</span>
          ${n ? `<span class="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/45 text-white text-[11px] font-bold backdrop-blur flex items-center gap-1"><i data-lucide="images" class="w-3 h-3"></i>${n}</span>` : ''}
          ${o.showStatus && p.published === false ? `<span class="absolute top-3 right-3 px-2 py-1 rounded-md bg-amber-400 text-amber-950 text-[11px] font-extrabold">DRAFT</span>` : ''}
        </div>
        <div class="p-4 flex-1">
          <h3 class="font-display font-extrabold text-zura-navy leading-snug line-clamp-2">${esc(p.title)}</h3>
          ${tags || more ? `<div class="mt-2.5 flex flex-wrap items-center gap-1.5">${tags}${more}</div>` : ''}
          <div class="mt-4">${priceMarkup(p)}</div>
        </div>
      ${close}
      ${buttons}
      ${o.footer || ''}
    </article>`;
  }

  /* Lightbox layar penuh */
  function lightbox(urls, start, onChange) {
    let i = start || 0; const n = urls.length;
    const o = document.createElement('div');
    o.className = 'fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur flex items-center justify-center p-3 select-none';
    o.innerHTML = `<img class="max-h-[88vh] max-w-[94vw] object-contain rounded-lg shadow-2xl" alt="" draggable="false" />
      <button data-x aria-label="Close" class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white text-xl">✕</button>
      ${n > 1 ? `<button data-p aria-label="Prev" class="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white text-2xl">‹</button>
      <button data-n aria-label="Next" class="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white text-2xl">›</button>
      <div data-c class="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs font-bold"></div>` : ''}`;
    document.body.appendChild(o);
    const img = o.querySelector('img'), c = o.querySelector('[data-c]');
    function go(k) { i = (k + n) % n; img.src = urls[i]; if (c) c.textContent = (i + 1) + ' / ' + n; if (onChange) onChange(i); }
    function close() { window.removeEventListener('keydown', key, true); o.remove(); }
    function key(e) {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); }
      else if (e.key === 'ArrowLeft') go(i - 1); else if (e.key === 'ArrowRight') go(i + 1);
    }
    window.addEventListener('keydown', key, true);
    o.addEventListener('click', e => {
      if (e.target.closest('[data-x]') || e.target === o) close();
      else if (e.target.closest('[data-p]')) go(i - 1); else if (e.target.closest('[data-n]')) go(i + 1);
    });
    let x0 = null;
    o.addEventListener('pointerdown', e => { x0 = e.clientX; });
    o.addEventListener('pointerup', e => { if (x0 != null && Math.abs(e.clientX - x0) > 50 && n > 1) go(i + (e.clientX < x0 ? 1 : -1)); x0 = null; });
    go(i);
  }

  /* Galeri: gambar utama + thumbnail. urls = array URL */
  function mountGallery(el, urls) {
    urls = (urls || []).filter(Boolean); const n = urls.length;
    if (!n) {
      el.innerHTML = `<div class="aspect-square rounded-2xl bg-gradient-to-br from-blue-100 to-sky-50 grid place-items-center text-blue-300"><i data-lucide="image" class="w-12 h-12"></i></div>`;
      return;
    }
    el.innerHTML = `
      <div data-main class="relative aspect-square rounded-2xl overflow-hidden bg-white/80 border border-white shadow-lg select-none touch-pan-y">
        <img data-img alt="" draggable="false" class="w-full h-full object-contain cursor-zoom-in" />
        ${n > 1 ? `<button type="button" data-prev aria-label="Prev" class="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow grid place-items-center hover:bg-white"><i data-lucide="chevron-left" class="w-5 h-5"></i></button>
        <button type="button" data-next aria-label="Next" class="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow grid place-items-center hover:bg-white"><i data-lucide="chevron-right" class="w-5 h-5"></i></button>
        <span data-count class="absolute bottom-2 right-2 text-[11px] font-bold bg-zura-navy/80 text-white rounded-md px-2 py-0.5"></span>` : ''}
        <span class="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/85 grid place-items-center text-slate-600 pointer-events-none"><i data-lucide="maximize-2" class="w-4 h-4"></i></span>
      </div>
      ${n > 1 ? `<div data-thumbs class="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">${urls.map((u, k) =>
        `<button type="button" data-k="${k}" class="shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-transparent transition"><img src="${esc(u)}" loading="lazy" alt="" class="w-full h-full object-contain bg-white" /></button>`).join('')}</div>` : ''}`;
    const img = el.querySelector('[data-img]'), count = el.querySelector('[data-count]'), box = el.querySelector('[data-thumbs]'), main = el.querySelector('[data-main]');
    const thumbs = [...el.querySelectorAll('[data-k]')];
    let i = 0;
    function go(k) {
      i = (k + n) % n; img.src = urls[i]; if (count) count.textContent = (i + 1) + ' / ' + n;
      thumbs.forEach((b, j) => { const on = j === i; b.classList.toggle('border-blue-600', on); b.classList.toggle('border-transparent', !on); b.classList.toggle('opacity-60', !on);
        if (on && box) box.scrollTo({ left: b.offsetLeft - box.clientWidth / 2 + b.clientWidth / 2, behavior: 'smooth' }); });
    }
    el.addEventListener('click', e => {
      if (e.target.closest('[data-prev]')) go(i - 1);
      else if (e.target.closest('[data-next]')) go(i + 1);
      else if (e.target.closest('[data-k]')) go(+e.target.closest('[data-k]').dataset.k);
      else if (e.target === img) lightbox(urls, i, go);
    });
    let x0 = null;
    main.addEventListener('pointerdown', e => { x0 = e.clientX; });
    main.addEventListener('pointerup', e => { if (x0 != null && Math.abs(e.clientX - x0) > 45 && n > 1) go(i + (e.clientX < x0 ? 1 : -1)); x0 = null; });
    go(0);
  }

  function toast(msg) {
    let b = document.getElementById('zlToast');
    if (!b) { b = document.createElement('div'); b.id = 'zlToast'; b.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-[300] max-w-[92vw] bg-zura-navy text-white px-4 py-3 rounded-2xl shadow-xl text-sm font-medium'; document.body.appendChild(b); }
    b.textContent = msg; b.style.display = 'block'; clearTimeout(b._t); b._t = setTimeout(() => { b.style.display = 'none'; }, 4200);
  }

  window.ZLP = { LANG, t, esc, src, slugify, fmtDate, catLabel, waLink, parsePrice, fmtPrice, fmtUSD, parseUSDPrice, recommendUSD, priceMarkup, checkoutHref, lemonCheckoutHref, shareHref, validHTTPS, listMarkup, normalize, loadProducts, groupByCategory, card, lightbox, mountGallery, toast };
})();
