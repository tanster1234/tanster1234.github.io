// Off-court mini game: drag back and release to shoot. 10 shots a game, 2 or 3 points a make.
// World is 800×500 units, drawn scaled into the canvas. Fixed-step physics keeps collisions stable.

const WW = 800, WH = 500;
const FLOOR = 462, G = 1500, BALL_R = 15, RIM_R = 4, K = 6.6, MAX_PULL = 205;
const RIM_Y = 228, RIM_F = 612, RIM_B = 690, BOARD_X = 702, BOARD_TOP = 142, BOARD_BOT = 262;
const THREE_X = 262, SHOTS = 10;

type V = { x: number; y: number };
type Seg = [V, V];

export function mountCourt(host: HTMLElement) {
  const canvas = host.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const scoreEl = host.querySelector<HTMLElement>('[data-score]')!;
  const shotEl = host.querySelector<HTMLElement>('[data-shot]')!;
  const bestEl = host.querySelector<HTMLElement>('[data-best]')!;
  const callEl = host.querySelector<HTMLElement>('[data-call]')!;
  const overEl = host.querySelector<HTMLElement>('[data-over]')!;
  const finalEl = host.querySelector<HTMLElement>('[data-final]')!;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let best = 0;
  try { best = Number(localStorage.getItem('tb-court-best')) || 0; } catch { /* storage blocked */ }

  const state = {
    score: 0, shot: 0, spot: { x: 160, y: 386 } as V, three: true,
    ball: { x: 160, y: 386 } as V, vel: { x: 0, y: 0 } as V, spin: 0,
    flying: false, aiming: false, pull: { x: 0, y: 0 } as V, start: { x: 0, y: 0 } as V,
    touchedRim: false, touchedBoard: false, scored: false, flightT: 0, restT: 0, madeT: 0, floorT: 0,
    net: 0, over: false, keyAim: { angle: 52, power: 0.72 }, keyMode: false,
  };
  (window as any).__court = state;

  const segs: Seg[] = [
    [{ x: BOARD_X, y: BOARD_TOP }, { x: BOARD_X, y: BOARD_BOT }],          // backboard
    [{ x: RIM_B + RIM_R, y: RIM_Y }, { x: BOARD_X, y: RIM_Y }],             // bracket
  ];
  const rims: V[] = [{ x: RIM_F, y: RIM_Y }, { x: RIM_B, y: RIM_Y }];

  // ---- sizing -------------------------------------------------------------------------------
  let scale = 1, dpr = 1;
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    scale = Math.min(w / WW, h / WH);
    draw();
  };
  const toWorld = (e: PointerEvent): V => {
    const r = canvas.getBoundingClientRect();
    const ox = (r.width - WW * scale) / 2, oy = (r.height - WH * scale) / 2;
    return { x: (e.clientX - r.left - ox) / scale, y: (e.clientY - r.top - oy) / scale };
  };

  // ---- game flow ---------------------------------------------------------------------------
  const newSpot = () => {
    const x = 70 + Math.random() * 270;
    state.spot = { x, y: 386 };
    state.three = x < THREE_X;
    state.ball = { ...state.spot }; state.vel = { x: 0, y: 0 };
    state.flying = false; state.touchedRim = state.touchedBoard = state.scored = false;
    state.flightT = state.restT = state.madeT = state.floorT = 0;
  };
  const hud = () => {
    scoreEl.textContent = String(state.score);
    shotEl.textContent = `${Math.min(state.shot + (state.over ? 0 : 1), SHOTS)} / ${SHOTS}`;
    bestEl.textContent = String(best);
  };
  let callTimer = 0;
  const call = (text: string) => {
    callEl.textContent = text; callEl.classList.add('on');
    clearTimeout(callTimer); callTimer = window.setTimeout(() => callEl.classList.remove('on'), 1300);
  };
  const newGame = () => {
    state.score = 0; state.shot = 0; state.over = false; overEl.hidden = true;
    newSpot(); hud(); kick();
  };
  const endShot = () => {
    if (!state.scored) call(state.touchedRim ? 'Rim out.' : state.touchedBoard ? 'Off the glass.' : 'Airball.');
    state.shot += 1;
    if (state.shot >= SHOTS) {
      state.over = true;
      if (state.score > best) { best = state.score; try { localStorage.setItem('tb-court-best', String(best)); } catch { /* ignore */ } }
      finalEl.textContent = String(state.score);
      overEl.hidden = false;
    } else newSpot();
    hud();
  };
  const launch = (v: V) => {
    state.vel = v; state.flying = true; state.aiming = false; state.keyMode = false;
    state.touchedRim = state.touchedBoard = state.scored = false; state.flightT = state.madeT = state.floorT = 0;
    kick();
  };
  const velFromPull = (p: V): V => {
    const len = Math.hypot(p.x, p.y), k = len > MAX_PULL ? MAX_PULL / len : 1;
    return { x: p.x * k * K, y: p.y * k * K };
  };
  const keyVel = (): V => {
    const a = (state.keyAim.angle * Math.PI) / 180, s = state.keyAim.power * MAX_PULL * K;
    return { x: Math.cos(a) * s, y: -Math.sin(a) * s };
  };

  // ---- physics -----------------------------------------------------------------------------
  const collideCircle = (c: V, r: number) => {
    const b = state.ball, dx = b.x - c.x, dy = b.y - c.y, d = Math.hypot(dx, dy), min = BALL_R + r;
    if (d >= min || d === 0) return false;
    const nx = dx / d, ny = dy / d;
    b.x = c.x + nx * min; b.y = c.y + ny * min;
    const vn = state.vel.x * nx + state.vel.y * ny;
    if (vn < 0) { state.vel.x -= 1.62 * vn * nx; state.vel.y -= 1.62 * vn * ny; state.vel.x *= 0.96; }
    return true;
  };
  const collideSeg = ([a, c]: Seg) => {
    const b = state.ball, ex = c.x - a.x, ey = c.y - a.y;
    const t = Math.max(0, Math.min(1, ((b.x - a.x) * ex + (b.y - a.y) * ey) / (ex * ex + ey * ey)));
    return collideCircle({ x: a.x + ex * t, y: a.y + ey * t }, 2);
  };
  const step = (dt: number) => {
    const b = state.ball, v = state.vel, prevY = b.y;
    v.y += G * dt; b.x += v.x * dt; b.y += v.y * dt;
    state.spin += (v.x / BALL_R) * dt;
    for (const r of rims) if (collideCircle(r, RIM_R)) { state.touchedRim = true; }
    if (collideSeg(segs[0])) state.touchedBoard = true;
    collideSeg(segs[1]);
    // a make: centre drops through the rim plane between the rim points
    if (!state.scored && prevY < RIM_Y && b.y >= RIM_Y && v.y > 0 && b.x > RIM_F + RIM_R && b.x < RIM_B - RIM_R) {
      state.scored = true; state.net = 1; state.madeT = state.flightT;
      const pts = state.three ? 3 : 2;
      state.score += pts;
      call(!state.touchedRim && !state.touchedBoard ? `Swish. +${pts}` : state.touchedBoard ? `Bank. +${pts}` : `Good. +${pts}`);
      hud();
    }
    if (b.y + BALL_R > FLOOR) {
      if (!state.floorT) state.floorT = state.flightT;
      b.y = FLOOR - BALL_R;
      if (v.y > 0) v.y = -v.y * 0.55;
      v.x *= 0.82;
      if (Math.abs(v.y) < 70) v.y = 0;
    }
    state.flightT += dt;
    const resting = b.y >= FLOOR - BALL_R - 0.5 && Math.abs(v.y) < 1 && Math.abs(v.x) < 25;
    state.restT = resting ? state.restT + dt : 0;
    const done = (state.scored && state.flightT - state.madeT > 1.0) || (!state.scored && state.floorT && state.flightT - state.floorT > 0.7);
    if (done || b.x < -60 || b.x > WW + 60 || state.restT > 0.35 || state.flightT > 3.5) { state.flying = false; endShot(); }
  };

  // ---- drawing -----------------------------------------------------------------------------
  function drawCourt() {
    const g = ctx.createLinearGradient(0, 0, 0, WH);
    g.addColorStop(0, '#15171a'); g.addColorStop(1, '#0e0f11');
    ctx.fillStyle = g; ctx.fillRect(-400, -400, WW + 800, WH + 800);
    // floor as a build plate
    ctx.strokeStyle = 'rgba(233,231,225,0.06)'; ctx.lineWidth = 1;
    for (let x = -400; x <= WW + 400; x += 24) { ctx.beginPath(); ctx.moveTo(x, FLOOR); ctx.lineTo(x + (x - WW / 2) * 0.35, WH + 60); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(233,231,225,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-400, FLOOR); ctx.lineTo(WW + 400, FLOOR); ctx.stroke();
    // three-point line
    ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(233,231,225,0.28)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(THREE_X, FLOOR); ctx.lineTo(THREE_X, FLOOR - 60); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(157,161,168,0.8)'; ctx.font = '600 11px "Martian Mono", monospace';
    ctx.fillText('3PT', THREE_X + 6, FLOOR - 48);
    // backboard + target square
    ctx.fillStyle = 'rgba(233,231,225,0.05)'; ctx.fillRect(BOARD_X - 4, BOARD_TOP, 8, BOARD_BOT - BOARD_TOP);
    ctx.strokeStyle = '#e9e7e1'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(BOARD_X, BOARD_TOP); ctx.lineTo(BOARD_X, BOARD_BOT); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(233,231,225,0.5)';
    ctx.strokeRect(BOARD_X - 30, RIM_Y - 34, 28, 30);
    // pole
    ctx.strokeStyle = 'rgba(233,231,225,0.25)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(BOARD_X + 22, BOARD_TOP + 40); ctx.lineTo(BOARD_X + 22, FLOOR); ctx.moveTo(BOARD_X + 22, BOARD_TOP + 40); ctx.lineTo(BOARD_X + 4, BOARD_TOP + 40); ctx.stroke();
  }
  function drawNet() {
    const sway = Math.sin(performance.now() / 70) * 6 * state.net;
    ctx.strokeStyle = 'rgba(233,231,225,0.7)'; ctx.lineWidth = 1.2;
    const topL = RIM_F, topR = RIM_B, botL = RIM_F + 14 + sway, botR = RIM_B - 14 + sway, bot = RIM_Y + 52 + state.net * 10;
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      ctx.beginPath(); ctx.moveTo(topL + (topR - topL) * t, RIM_Y); ctx.lineTo(botL + (botR - botL) * (1 - t), bot); ctx.stroke();
    }
    for (let j = 1; j <= 3; j++) {
      const t = j / 4, y = RIM_Y + (bot - RIM_Y) * t;
      const l = topL + (botL - topL) * t, r = topR + (botR - topR) * t;
      ctx.beginPath(); ctx.moveTo(l, y); ctx.lineTo(r, y); ctx.stroke();
    }
  }
  function drawRim(front: boolean) {
    ctx.strokeStyle = '#F26A1B'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    if (front) { ctx.moveTo(RIM_F, RIM_Y); ctx.lineTo((RIM_F + RIM_B) / 2, RIM_Y + 3); }
    else { ctx.moveTo((RIM_F + RIM_B) / 2, RIM_Y + 3); ctx.lineTo(RIM_B, RIM_Y); ctx.lineTo(BOARD_X, RIM_Y); }
    ctx.stroke();
  }
  function drawBall() {
    const { x, y } = state.ball;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, FLOOR - y + 2, BALL_R * (1 - (FLOOR - y) / 900), 3, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, BALL_R);
    g.addColorStop(0, '#ff9a4d'); g.addColorStop(0.6, '#F26A1B'); g.addColorStop(1, '#b8480f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(state.spin);
    ctx.strokeStyle = 'rgba(23,25,28,0.75)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-BALL_R, 0); ctx.lineTo(BALL_R, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -BALL_R); ctx.lineTo(0, BALL_R); ctx.stroke();
    ctx.beginPath(); ctx.arc(-BALL_R * 1.25, 0, BALL_R * 0.95, -0.9, 0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(BALL_R * 1.25, 0, BALL_R * 0.95, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
    ctx.restore();
  }
  function drawAim() {
    const v = state.keyMode ? keyVel() : velFromPull(state.pull);
    if (Math.hypot(v.x, v.y) < 60) return;
    const p = { ...state.ball }, q = { ...v };
    for (let i = 0; i < 44; i++) {
      for (let s = 0; s < 3; s++) { q.y += G / 180; p.x += q.x / 180; p.y += q.y / 180; }
      if (p.y > FLOOR) break;
      ctx.fillStyle = `rgba(255,178,63,${0.9 - i * 0.018})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.4 - i * 0.03, 0, Math.PI * 2); ctx.fill();
    }
    // the fit, as a data scientist would label it (x right, y up, from the ball)
    const a = -G / (2 * v.x * v.x), bq = -v.y / v.x;
    ctx.fillStyle = 'rgba(233,231,225,0.75)'; ctx.font = '11px "Martian Mono", monospace';
    ctx.fillText(`fit: y = ${a.toFixed(4)}x² + ${bq.toFixed(2)}x`, 24, WH - 14);
  }
  function drawSpot() {
    ctx.strokeStyle = 'rgba(233,231,225,0.3)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(state.spot.x, FLOOR, 22, 5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const ox = (canvas.width / dpr - WW * scale) / 2, oy = (canvas.height / dpr - WH * scale) / 2;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr);
    drawCourt(); drawSpot(); drawRim(false); drawNet();
    if ((state.aiming || state.keyMode) && !state.flying) drawAim();
    drawBall(); drawRim(true);
  }

  // ---- loop --------------------------------------------------------------------------------
  let raf = 0, last = 0, acc = 0, visible = true;
  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (state.flying) { acc += dt; while (acc >= 1 / 240) { step(1 / 240); acc -= 1 / 240; if (!state.flying) break; } }
    state.net = Math.max(0, state.net - dt * 1.6);
    draw();
    if (visible && (state.flying || state.aiming || state.net > 0 || state.keyMode)) kick(); else last = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  // ---- input -------------------------------------------------------------------------------
  canvas.addEventListener('pointerdown', (e) => {
    if (state.flying || state.over) return;
    canvas.setPointerCapture(e.pointerId);
    state.aiming = true; state.start = toWorld(e); state.pull = { x: 0, y: 0 };
    host.classList.add('is-aiming'); kick();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!state.aiming) return;
    const p = toWorld(e);
    state.pull = { x: state.start.x - p.x, y: state.start.y - p.y };
    kick();
  });
  const release = () => {
    if (!state.aiming) return;
    host.classList.remove('is-aiming');
    const v = velFromPull(state.pull);
    state.aiming = false;
    if (Math.hypot(v.x, v.y) > 120) launch(v); else kick();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', () => { state.aiming = false; host.classList.remove('is-aiming'); kick(); });

  // keyboard: arrows aim, space shoots
  canvas.addEventListener('keydown', (e) => {
    if (state.flying || state.over) return;
    const a = state.keyAim;
    if (e.key === 'ArrowLeft') a.angle = Math.min(80, a.angle + 2);
    else if (e.key === 'ArrowRight') a.angle = Math.max(20, a.angle - 2);
    else if (e.key === 'ArrowUp') a.power = Math.min(1, a.power + 0.02);
    else if (e.key === 'ArrowDown') a.power = Math.max(0.3, a.power - 0.02);
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); launch(keyVel()); return; }
    else return;
    e.preventDefault(); state.keyMode = true; kick();
  });
  canvas.addEventListener('blur', () => { state.keyMode = false; kick(); });

  host.querySelectorAll<HTMLButtonElement>('[data-new]').forEach((b) => b.addEventListener('click', newGame));
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(canvas);
  if (document.fonts) document.fonts.ready.then(() => draw());
  if (reduce) state.net = 0;
  newGame();
}
