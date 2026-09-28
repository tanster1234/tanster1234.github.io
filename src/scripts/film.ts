// Scroll-film engine: canvas + pre-extracted JPEG frames.
// - Frames stream in with a concurrency-capped pump, nearest-to-playhead first.
// - An ImageBitmap sliding window decodes off the main thread so every draw is a blit.
// - The playhead is lerped toward the scroll target for smoothness.
// - The last 10% of the section is the lights-on: the lit still blooms in over the final frame.
// Dev contract: ?jump=<scrollY> lands pre-scrolled and settled; window.__ready flips when drawable.

const FILM_END = 0.86; // share of the section used by footage; the rest is lights-on → daylight
const MAX_CROP = 0.3; // how much of the frame may be cropped before we letterbox instead
const AHEAD = 48; // decoded frames kept ahead of the playhead (~2 s at 24 fps)
const KEEP = 64; // frames beyond this distance are evicted
const MAX_INFLIGHT = 10;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

declare global {
  interface Window { __ready?: boolean; __film?: { progress: () => number; frame: () => number } }
}

export function startFilm(section: HTMLElement | null) {
  if (!section) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { window.__ready = true; return; }

  const COUNT = Number(section.dataset.frames);
  const DIR = section.dataset.dir!;
  const remap: [number, number][] = JSON.parse(section.dataset.remap || '[]');
  const canvas = section.querySelector<HTMLCanvasElement>('.film-canvas')!;
  const ctx = canvas.getContext('2d')!;
  const lit = new Image();
  lit.decoding = 'async';
  lit.src = section.dataset.lit!;
  let litAlpha = 0;
  lit.onload = () => { dirty = true; kick(); };
  const bloom = section.querySelector<HTMLElement>('.film-bloom')!;
  const day = section.querySelector<HTMLElement>('.film-day')!;
  const grain = section.querySelector<HTMLElement>('.film-grain');
  const hud = section.querySelector<HTMLElement>('.film-hud');
  const beats = [...section.querySelectorAll<HTMLElement>('.beat')];
  const hudN = section.querySelector<HTMLElement>('.hud-n');
  const load = section.querySelector<HTMLElement>('.film-load');
  const bar = section.querySelector<HTMLElement>('.film-load .bar');
  const cue = section.querySelector<HTMLElement>('.scroll-cue');

  const src = (i: number) => `${DIR}f_${String(i + 1).padStart(4, '0')}.jpg`;
  const images: (HTMLImageElement | undefined)[] = new Array(COUNT);
  const state = new Uint8Array(COUNT); // 0 idle, 1 loading, 2 ready, 3 failed
  const bitmaps = new Map<number, ImageBitmap>();
  const decoding = new Set<number>();
  let inflight = 0, ready = 0, want = 0, displayed = -1, bmpCenter = -999;
  let current = 0, target = 0, running = false, dirty = true;

  // ---- loading -------------------------------------------------------------
  function nextToLoad(): number {
    for (let d = 0; d < AHEAD * 3; d++) {
      const a = want + d; if (a < COUNT && !state[a]) return a;
      const b = want - (d >> 1); if (b >= 0 && !state[b]) return b;
    }
    for (let i = 0; i < COUNT; i++) if (!state[i]) return i;
    return -1;
  }
  function pump() {
    while (inflight < MAX_INFLIGHT) {
      const i = nextToLoad();
      if (i < 0) return;
      state[i] = 1; inflight++;
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => {
        inflight--; state[i] = 2; ready++;
        (window as any).__filmLoaded = ready / COUNT;
        if (bar) bar.style.width = `${(ready / COUNT) * 100}%`;
        if (ready === COUNT) load?.classList.add('done');
        if (Math.abs(i - Math.round(current)) <= AHEAD) { bmpCenter = -999; dirty = true; kick(); }
        pump();
      };
      im.onerror = () => { inflight--; state[i] = 3; pump(); };
      im.src = src(i);
      images[i] = im;
    }
  }

  function ensureBitmaps(center: number) {
    if (Math.abs(center - bmpCenter) < 3) return;
    bmpCenter = center;
    const lo = Math.max(0, center - 16), hi = Math.min(COUNT - 1, center + AHEAD);
    for (let i = lo; i <= hi; i++) {
      if (bitmaps.has(i) || decoding.has(i) || state[i] !== 2) continue;
      decoding.add(i);
      createImageBitmap(images[i]!).then((b) => {
        decoding.delete(i);
        if (Math.abs(i - bmpCenter) > KEEP) { b.close(); return; }
        bitmaps.set(i, b);
        if (i === Math.round(current)) { dirty = true; kick(); }
      }).catch(() => decoding.delete(i));
    }
    for (const k of Array.from(bitmaps.keys())) {
      if (k < center - KEEP || k > center + KEEP) { bitmaps.get(k)!.close(); bitmaps.delete(k); }
    }
  }

  function nearestDrawable(i: number): CanvasImageSource | null {
    for (let d = 0; d < COUNT; d++) {
      for (const j of [i - d, i + d]) {
        if (j < 0 || j >= COUNT) continue;
        const b = bitmaps.get(j); if (b) return b;
        if (state[j] === 2) return images[j]!;
      }
    }
    return null;
  }

  // ---- drawing ---------------------------------------------------------------
  function resize() {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; dirty = true; }
  }
  function draw(i: number) {
    const img = bitmaps.get(i) ?? nearestDrawable(i);
    if (!img) return false;
    const iw = (img as ImageBitmap).width, ih = (img as ImageBitmap).height;
    const cw = canvas.width, ch = canvas.height;
    const sCover = Math.max(cw / iw, ch / ih), sFit = Math.min(cw / iw, ch / ih);
    const s = Math.min(sCover, sFit / (1 - MAX_CROP));
    const w = iw * s, h = ih * s;
    ctx.fillStyle = '#0e0f11';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    if (litAlpha > 0.001 && lit.complete && lit.naturalWidth) {
      ctx.globalAlpha = litAlpha;
      ctx.drawImage(lit, (cw - w) / 2, (ch - h) / 2, w, h);
      ctx.globalAlpha = 1;
    }
    displayed = i;
    return true;
  }

  // ---- scroll mapping ----------------------------------------------------------
  function sectionProgress() {
    const r = section!.getBoundingClientRect();
    const total = section!.offsetHeight - window.innerHeight;
    return total > 0 ? clamp(-r.top / total, 0, 1) : 0;
  }
  function remapFilm(pf: number) {
    if (remap.length < 2) return pf;
    for (let k = 1; k < remap.length; k++) {
      const [p0, f0] = remap[k - 1], [p1, f1] = remap[k];
      if (pf <= p1) return f0 + ((pf - p0) / (p1 - p0)) * (f1 - f0);
    }
    return 1;
  }

  function updateOverlays(p: number) {
    const pf = clamp(p / FILM_END, 0, 1);
    for (const el of beats) {
      const from = Number(el.dataset.from), to = Number(el.dataset.to);
      const fin = from <= 0 ? 1 : smooth(from, from + 0.03, pf);
      el.style.opacity = String(fin * (1 - smooth(to - 0.03, to, pf)));
    }
    const q = clamp((p - FILM_END) / (1 - FILM_END), 0, 1);
    const la = smooth(0.04, 0.45, q);
    if (Math.abs(la - litAlpha) > 0.002) { litAlpha = la; dirty = true; }
    bloom.style.opacity = String(smooth(0.2, 0.55, q) * 0.95);
    const d = smooth(0.5, 0.97, q);
    day.style.opacity = String(d);
    if (grain) grain.style.opacity = String(0.07 * (1 - d));
    if (hud) hud.style.opacity = String(1 - smooth(0.3, 0.6, q));
    section!.dataset.theme = d > 0.55 ? 'light' : 'dark';
    if (cue) cue.style.opacity = String(1 - smooth(0, 0.02, p));
  }

  function tick() {
    running = false;
    const p = sectionProgress();
    target = remapFilm(clamp(p / FILM_END, 0, 1)) * (COUNT - 1);
    const delta = target - current;
    current = Math.abs(delta) < 0.02 ? target : current + delta * 0.14;
    const idx = Math.round(current);
    want = idx;
    ensureBitmaps(idx);
    updateOverlays(p);
    if (idx !== displayed || dirty) { if (draw(idx)) dirty = false; }
    if (hudN) hudN.textContent = String(idx + 1).padStart(3, '0');
    pump();
    if (Math.abs(target - current) > 0.02 || decoding.size) kick();
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(tick); } }

  // ---- boot ------------------------------------------------------------------
  resize();
  window.addEventListener('resize', () => { resize(); kick(); });
  window.addEventListener('scroll', kick, { passive: true });

  const jump = new URLSearchParams(location.search).get('jump');
  if (jump !== null) {
    window.scrollTo(0, Number(jump) || 0);
    target = remapFilm(clamp(sectionProgress() / FILM_END, 0, 1)) * (COUNT - 1);
    current = target;
  }
  want = Math.round(current);
  pump();
  kick();

  window.__film = { progress: sectionProgress, frame: () => displayed };
  const settle = () => {
    const idx = Math.round(current);
    if (bitmaps.has(idx) && displayed === idx) { window.__ready = true; return; }
    kick(); setTimeout(settle, 60);
  };
  settle();
}
