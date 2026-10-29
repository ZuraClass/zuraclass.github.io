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

  function normalize(d) {
    const ps = (d && Array.isArray(d.products) ? d.products : []).map(p => ({
      id: String(p.id), slug: String(p.slug || p.id), title: String(p.title || ''), category: String(p.category || ''),
      tags: Array.isArray(p.tags) ? p.tags.map(String) : [], description: String(p.description || ''),
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

  /* Kartu produk. o: {href, coverUrl, imageCount, showStatus, footer, delay} */
  function card(p, o) {
    o = o || {};
    const cover = o.coverUrl !== undefined ? o.coverUrl : src(p.cover);
    const n = o.imageCount !== undefined ? o.imageCount : (p.images || []).length + (p.cover ? 1 : 0);
    const open = o.href ? `<a href="${esc(o.href)}" data-open="${esc(p.id)}"` : `<button type="button" data-open="${esc(p.id)}"`;
    const close = o.href ? '</a>' : '</button>';
    const tags = (p.tags || []).slice(0, 3).map(x => `<span class="text-[11px] font-bold text-blue-700 bg-blue-50 rounded-md px-2 py-0.5">${esc(x)}</span>`).join('');
    const more = (p.tags || []).length > 3 ? `<span class="text-[11px] font-bold text-slate-400">+${p.tags.length - 3}</span>` : '';
    return `
    <article class="spot lift glass rounded-2xl overflow-hidden group flex flex-col fade-up" style="--d:${o.delay || 0}ms">
      ${open} class="block text-left w-full flex-1 flex flex-col" aria-label="${esc(p.title)}">
        <div class="relative aspect-[16/10] bg-gradient-to-br from-blue-100 to-sky-50 overflow-hidden">
          ${cover ? `<img src="${esc(cover)}" loading="lazy" alt="" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" />`
            : `<span class="absolute inset-0 grid place-items-center text-blue-300"><i data-lucide="image" class="w-10 h-10"></i></span>`}
          <span class="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-zura-navy/85 text-white text-[11px] font-semibold backdrop-blur">${esc(catLabel(p.category))}</span>
          ${n ? `<span class="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/45 text-white text-[11px] font-bold backdrop-blur flex items-center gap-1"><i data-lucide="images" class="w-3 h-3"></i>${n}</span>` : ''}
          ${o.showStatus && p.published === false ? `<span class="absolute top-3 right-3 px-2 py-1 rounded-md bg-amber-400 text-amber-950 text-[11px] font-extrabold">DRAFT</span>` : ''}
        </div>
        <div class="p-4 flex-1">
          <h3 class="font-display font-extrabold text-zura-navy leading-snug line-clamp-2">${esc(p.title)}</h3>
          <div class="mt-2.5 flex flex-wrap items-center gap-1.5">${tags}${more}</div>
        </div>
      ${close}
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
      el.innerHTML = `<div class="aspect-[16/10] rounded-2xl bg-gradient-to-br from-blue-100 to-sky-50 grid place-items-center text-blue-300"><i data-lucide="image" class="w-12 h-12"></i></div>`;
      return;
    }
    el.innerHTML = `
      <div data-main class="relative aspect-[16/10] rounded-2xl overflow-hidden bg-white/80 border border-white shadow-lg select-none touch-pan-y">
        <img data-img alt="" draggable="false" class="w-full h-full object-contain cursor-zoom-in" />
        ${n > 1 ? `<button type="button" data-prev aria-label="Prev" class="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow grid place-items-center hover:bg-white"><i data-lucide="chevron-left" class="w-5 h-5"></i></button>
        <button type="button" data-next aria-label="Next" class="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow grid place-items-center hover:bg-white"><i data-lucide="chevron-right" class="w-5 h-5"></i></button>
        <span data-count class="absolute bottom-2 right-2 text-[11px] font-bold bg-zura-navy/80 text-white rounded-md px-2 py-0.5"></span>` : ''}
        <span class="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/85 grid place-items-center text-slate-600 pointer-events-none"><i data-lucide="maximize-2" class="w-4 h-4"></i></span>
      </div>
      ${n > 1 ? `<div data-thumbs class="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">${urls.map((u, k) =>
        `<button type="button" data-k="${k}" class="shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 border-transparent transition"><img src="${esc(u)}" loading="lazy" alt="" class="w-full h-full object-cover" /></button>`).join('')}</div>` : ''}`;
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

  window.ZLP = { LANG, t, esc, src, slugify, fmtDate, catLabel, waLink, normalize, loadProducts, groupByCategory, card, lightbox, mountGallery, toast };
})();
