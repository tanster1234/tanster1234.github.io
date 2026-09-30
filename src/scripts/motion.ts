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
  // hold the page still while the preloader curtain is down
  if ((window as any).__preloading) { lenis.stop(); window.addEventListener('tb:revealed', () => lenis?.start(), { once: true }); }
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
      type: 'words,chars', mask: 'words', wordsClass: 'split-word', autoSplit: true,
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
// Hot nozzle: a glowing tip that tracks the pointer exactly, with a tapered filament trail that
// cools from amber to ember. Built from a few small transformed elements (no full-screen layer),
// and the native cursor is hidden while it is active.
function cursor() {
  if (!finePointer()) return;
  const SEG = 18;
  const root = document.createElement('div');
  root.className = 'nozzle is-hidden';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `<div class="nozzle-trail">${'<i></i>'.repeat(SEG)}</div>`
    + '<div class="nozzle-tip"><span class="nozzle-heat"></span><span class="nozzle-core"></span></div><div class="nozzle-label"></div>';
  document.body.appendChild(root);
  document.documentElement.classList.add('has-nozzle');
  const tip = root.querySelector<HTMLElement>('.nozzle-tip')!;
  const label = root.querySelector<HTMLElement>('.nozzle-label')!;
  const segs = [...root.querySelectorAll<HTMLElement>('.nozzle-trail i')];
  segs.forEach((el, i) => {
    const k = i / (SEG - 1);
    el.style.setProperty('--t', `${(4.2 - 3.2 * k).toFixed(2)}px`);
    el.style.setProperty('--o', (0.95 - 0.85 * k).toFixed(2));
    el.style.setProperty('--c', k < 0.25 ? '#FFC05A' : k < 0.6 ? '#F26A1B' : '#B8420C');
  });
  const pts = Array.from({ length: SEG + 1 }, () => ({ x: -200, y: -200 }));
  let mx = -200, my = -200, running = false;

  const place = () => {
    const t = `translate3d(${mx}px, ${my}px, 0)`;
    tip.style.transform = t; label.style.transform = t;
  };
  const loop = () => {
    pts[0].x = mx; pts[0].y = my;
    let total = 0;
    for (let i = 1; i <= SEG; i++) {
      const p = pts[i], q = pts[i - 1];
      p.x += (q.x - p.x) * 0.42; p.y += (q.y - p.y) * 0.42;
      const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy);
      total += len;
      segs[i - 1].style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) rotate(${Math.atan2(dy, dx).toFixed(3)}rad) scaleX(${((len + 0.6) / 10).toFixed(3)})`;
    }
    running = total > 0.8;
    if (running) requestAnimationFrame(loop);
  };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    if (root.classList.contains('is-hidden')) {
      root.classList.remove('is-hidden');
      pts.forEach((p) => { p.x = mx; p.y = my; });
    }
    place();
    if (!running) { running = true; requestAnimationFrame(loop); }
  }, { passive: true });
  window.addEventListener('pointerdown', () => root.classList.add('is-down'));
  window.addEventListener('pointerup', () => root.classList.remove('is-down'));
  document.documentElement.addEventListener('pointerleave', () => root.classList.add('is-hidden'));
  window.addEventListener('blur', () => root.classList.add('is-hidden'));

  document.addEventListener('pointerover', (e) => {
    const target = e.target as HTMLElement;
    const typing = !!target.closest('input, textarea, select, [contenteditable]');
    root.classList.toggle('is-typing', typing);
    const el = target.closest<HTMLElement>('[data-cursor], a, button, summary, [role="tab"]');
    root.classList.toggle('is-hot', !!el && !typing);
    const text = el?.dataset.cursor ?? (el?.matches('a[target="_blank"]') ? 'Open ↗' : '');
    label.textContent = text;
    root.classList.toggle('has-label', !!text && !typing);
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
