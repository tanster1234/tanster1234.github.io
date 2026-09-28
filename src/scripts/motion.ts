// Page motion. Lenis drives the scroll, GSAP ScrollTrigger + SplitText drive reveals and
// scrubbed effects, anime.js handles the small signature moments (label scramble, title wave).
// Nothing is hidden by CSS: every "from" state is set here, only for elements below the fold,
// so a script failure can never leave content invisible. Reduced motion skips all of it.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { animate, stagger, scrambleText } from 'animejs';

gsap.registerPlugin(ScrollTrigger, SplitText);

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => window.matchMedia('(pointer: fine)').matches;
let lenis: Lenis | null = null;

export function startMotion() {
  navTone();
  if (reduce()) { counters(true); return; }

  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  (window as any).__lenis = lenis;
  anchors();
  cursor();
  magnetic();

  const go = () => {
    reveals();
    labels();
    counters(false);
    marquee();
    timeline();
    labLayers();
    tilt();
    titleWave();
    arcs();
    ScrollTrigger.refresh();
  };
  // split only after the real fonts are in, so line breaks are final
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(go); else go();
}

const below = (el: Element) => el.getBoundingClientRect().top > window.innerHeight * 0.92;

function anchors() {
  document.querySelectorAll<HTMLAnchorElement>('a[href*="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = a.hash ? document.querySelector<HTMLElement>(a.hash) : null;
      if (target && a.pathname === location.pathname) { e.preventDefault(); lenis?.scrollTo(target, { offset: -8, duration: 1.4 }); }
    });
  });
}

function navTone() {
  const nav = document.querySelector<HTMLElement>('.nav');
  const sections = [...document.querySelectorAll<HTMLElement>('[data-theme]')];
  if (!nav || !sections.length) return;
  const update = () => {
    const hit = sections.find((s) => { const r = s.getBoundingClientRect(); return r.top <= 36 && r.bottom > 36; });
    nav.dataset.tone = hit?.dataset.theme === 'light' ? 'light' : 'dark';
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  setInterval(update, 400); // the film flips its own theme at the lights-on moment
}

// ---- text reveals ------------------------------------------------------------------------
function reveals() {
  // multi-line headlines rise line by line inside masks (no width change, so nothing re-wraps)
  document.querySelectorAll<HTMLElement>('[data-rise="lines"]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, {
          yPercent: 112, duration: 1.15, ease: 'expo.out', stagger: 0.085,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        });
      },
    });
  });
  // section titles: characters rise inside their words
  document.querySelectorAll<HTMLElement>('[data-rise="chars"]').forEach((el) => {
    SplitText.create(el, {
      type: 'words,chars', mask: 'words', autoSplit: true,
      onSplit(self) {
        return gsap.from(self.chars, {
          yPercent: 115, rotate: 4, duration: 0.95, ease: 'expo.out', stagger: 0.022,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      },
    });
  });
  // everything else: short rise + fade in batches, only for what starts below the fold
  const items = [...document.querySelectorAll<HTMLElement>(
    '[data-rise="fade"], .lede, .stats .stat, .roles .role, .lead, .cards .card, .cols .col, .queue li, .steps li, .spec, .links, .ctas, .edu',
  )].filter((el) => below(el) && !el.closest('[data-rise="lines"], [data-rise="chars"]'));
  gsap.set(items, { autoAlpha: 0, y: 28 });
  ScrollTrigger.batch(items, {
    start: 'top 90%', once: true,
    onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07, overwrite: true }),
  });
}

// mono labels decode into place like data coming in (anime.js scrambleText)
function labels() {
  document.querySelectorAll<HTMLElement>('.eyebrow').forEach((eb) => {
    if (eb.closest('.film')) return;
    const node = [...eb.childNodes].reverse().find((n) => n.nodeType === 3 && n.textContent!.trim());
    if (!node) return;
    const span = document.createElement('span');
    span.textContent = node.textContent;
    eb.replaceChild(span, node);
    ScrollTrigger.create({
      trigger: eb, start: 'top 92%', once: true,
      onEnter: () => {
        try { animate(span, { innerHTML: scrambleText({ chars: 'a-z0-9;·_' }), duration: 900, ease: 'linear' }); } catch { /* purely decorative */ }
      },
    });
  });
}

function counters(immediate: boolean) {
  document.querySelectorAll<HTMLElement>('.num[data-count]').forEach((el) => {
    const sup = el.querySelector('sup')?.outerHTML ?? '';
    const parts = (el.dataset.count ?? '').split('–').map(Number);
    if (immediate || parts.some(Number.isNaN)) return;
    const run = () => {
      const o = { k: 0 };
      gsap.to(o, { k: 1, duration: 1.3, ease: 'power3.out', onUpdate: () => { el.innerHTML = parts.map((v) => Math.round(v * o.k)).join('–') + sup; } });
    };
    if (below(el)) ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: run }); else run();
  });
}

// the shot arc in Off-court draws itself once it is on screen
function arcs() {
  document.querySelectorAll<SVGElement>('.arc').forEach((a) => {
    if (!below(a)) { a.classList.add('go'); return; }
    ScrollTrigger.create({ trigger: a, start: 'top 80%', once: true, onEnter: () => a.classList.add('go') });
  });
}

// ---- scroll-driven effects ---------------------------------------------------------------
// Marquee band that drifts on its own and reacts to scroll speed and direction.
function marquee() {
  document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((m) => {
    const track = m.querySelector<HTMLElement>('.marquee-track');
    if (!track) return;
    let x = 0, dir = -1, skew = 0, live = false;
    const setX = gsap.quickSetter(track, 'x', 'px');
    const setSkew = gsap.quickSetter(track, 'skewX', 'deg');
    ScrollTrigger.create({ trigger: m, start: 'top bottom', end: 'bottom top', onToggle: (s) => { live = s.isActive; } });
    gsap.ticker.add((_t, dt) => {
      if (!live) return;
      const v = lenis ? lenis.velocity : 0;
      if (Math.abs(v) > 0.2) dir = v > 0 ? -1 : 1;
      const half = track.scrollWidth / 2;
      x += (dir * 0.9 - v * 0.55) * (dt / 16.7);
      if (x <= -half) x += half;
      if (x > 0) x -= half;
      skew += (gsap.utils.clamp(-10, 10, -v * 0.45) - skew) * 0.12;
      setX(x); setSkew(skew);
    });
  });
}

// The work timeline is drawn like a toolpath as you read down it; nodes light as it passes.
function timeline() {
  const wrap = document.querySelector<HTMLElement>('.roles-wrap');
  const fill = wrap?.querySelector<HTMLElement>('.rail-fill');
  if (!wrap || !fill) return;
  gsap.fromTo(fill, { scaleY: 0 }, {
    scaleY: 1, ease: 'none',
    scrollTrigger: { trigger: wrap, start: 'top 70%', end: 'bottom 65%', scrub: 0.5 },
  });
  wrap.querySelectorAll<HTMLElement>('.role').forEach((role) => {
    ScrollTrigger.create({
      trigger: role, start: 'top 68%',
      onEnter: () => role.classList.add('lit'), onLeaveBack: () => role.classList.remove('lit'),
    });
  });
}

// The dark Lab is laid down layer by layer: a bone cover retracts upward in hard steps.
// It animates a transform (composited), so the Lab itself never has to repaint.
function labLayers() {
  const lab = document.querySelector<HTMLElement>('#lab');
  if (!lab) return;
  const cover = document.createElement('div');
  cover.className = 'lab-cover';
  cover.setAttribute('aria-hidden', 'true');
  lab.appendChild(cover);
  gsap.fromTo(cover, { scaleY: 1 }, {
    scaleY: 0, ease: 'steps(16)',
    scrollTrigger: { trigger: lab, start: 'top bottom', end: 'top 25%', scrub: true },
  });
}

function tilt() {
  if (!finePointer()) return;
  document.querySelectorAll<HTMLElement>('[data-sway]').forEach((el) => {
    gsap.set(el, { transformPerspective: 1400, transformStyle: 'preserve-3d' });
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.7, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.7, ease: 'power3' });
    const k = Number(el.dataset.sway) || 4;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * k);
      rx(-((e.clientY - r.top) / r.height - 0.5) * k * 0.8);
    });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });
}

// Big titles marked data-wave ripple through the font's width axis around the pointer (anime.js).
function titleWave() {
  if (!finePointer()) return;
  document.querySelectorAll<HTMLElement>('[data-wave]').forEach((el) => {
    const chars = [...el.querySelectorAll<HTMLElement>('.wc')];
    if (!chars.length) return;
    let last = -1;
    el.addEventListener('pointermove', (e) => {
      const i = chars.findIndex((c) => { const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right; });
      if (i < 0 || i === last) return;
      last = i;
      animate(chars, {
        '--w': [{ to: 72, duration: 220 }, { to: 125, duration: 520 }],
        '--g': [{ to: 520, duration: 220 }, { to: 820, duration: 520 }],
        delay: stagger(45, { from: i }), ease: 'outQuad',
      });
    });
    el.addEventListener('pointerleave', () => { last = -1; });
  });
}

// ---- cursor & buttons ----------------------------------------------------------------------
// Nozzle tip + a short cooling trail, built from tiny DOM dots (no full-screen canvas).
function cursor() {
  if (!finePointer()) return;
  const root = document.createElement('div');
  root.className = 'cursor is-hidden';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `<div class="cursor-trail">${'<span></span>'.repeat(9)}</div><div class="cursor-dot"></div><div class="cursor-label"></div>`;
  document.body.appendChild(root);
  const dot = root.querySelector<HTMLElement>('.cursor-dot')!;
  const label = root.querySelector<HTMLElement>('.cursor-label')!;
  const trail = [...root.querySelectorAll<HTMLElement>('.cursor-trail span')];
  const pts = trail.map(() => ({ x: -200, y: -200 }));
  let mx = -200, my = -200, x = -200, y = -200, running = false;

  const loop = () => {
    x += (mx - x) * 0.55; y += (my - y) * 0.55;
    const t = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    dot.style.transform = t; label.style.transform = t;
    let px = x, py = y, spread = 0;
    pts.forEach((p, i) => {
      p.x += (px - p.x) * 0.42; p.y += (py - p.y) * 0.42;
      const s = 1 - i / pts.length;
      trail[i].style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) scale(${(0.35 + 0.65 * s).toFixed(2)})`;
      trail[i].style.opacity = (0.5 * s).toFixed(2);
      trail[i].style.background = i < 3 ? '#FFB23F' : '#F26A1B';
      spread += Math.abs(px - p.x) + Math.abs(py - p.y);
      px = p.x; py = p.y;
    });
    running = spread + Math.abs(mx - x) + Math.abs(my - y) > 0.6;
    if (running) requestAnimationFrame(loop);
  };
  window.addEventListener('pointermove', (e) => {
    mx = e.clientX; my = e.clientY;
    if (root.classList.contains('is-hidden')) {
      root.classList.remove('is-hidden'); x = mx; y = my;
      pts.forEach((p) => { p.x = mx; p.y = my; });
    }
    if (!running) { running = true; requestAnimationFrame(loop); }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => root.classList.add('is-hidden'));
  window.addEventListener('blur', () => root.classList.add('is-hidden'));

  document.addEventListener('pointerover', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-cursor], a, button, summary');
    root.classList.toggle('is-hot', !!el);
    const text = el?.dataset.cursor ?? (el?.matches('a[target="_blank"]') ? 'Open ↗' : '');
    label.textContent = text;
    root.classList.toggle('has-label', !!text);
  });
}

function magnetic() {
  if (!finePointer()) return;
  document.querySelectorAll<HTMLElement>('.btn.primary, .nav-cta').forEach((b) => {
    const tx = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'power3' });
    const ty = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'power3' });
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      tx((e.clientX - (r.left + r.width / 2)) * 0.2);
      ty((e.clientY - (r.top + r.height / 2)) * 0.3);
    });
    b.addEventListener('pointerleave', () => { tx(0); ty(0); });
  });
}
