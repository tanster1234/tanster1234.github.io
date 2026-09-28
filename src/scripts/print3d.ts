// Live 3D print viewer (three.js). Loaded on demand when the Lab nears the viewport.
// Hover lights the print from inside and steers its spin; the switch button toggles the light.
// Prints are registered by name; STL/GLB models of real prints can be added to PRINTS later.
import * as THREE from 'three';

type Built = { object: THREE.Object3D; glowMaterials: THREE.MeshPhysicalMaterial[]; lightY: number; height: number };

const PLA = () => new THREE.MeshPhysicalMaterial({
  // translucent PLA without a refraction pass: light transparency + sheen reads as printed plastic
  color: 0xf4ead8, roughness: 0.46, metalness: 0,
  sheen: 0.6, sheenColor: new THREE.Color(0xffe6c4), sheenRoughness: 0.5, clearcoat: 0.12,
  transparent: true, opacity: 0.93,
  emissive: new THREE.Color(0xff7a14), emissiveIntensity: 0,
  side: THREE.DoubleSide,
});

// The film's lamp: a shade whose profile is a smoothed demand curve, printed in 0.2 mm-looking layers.
function forecastLamp(): Built {
  const H = 1.3, layers = 120;
  const r = (u: number) =>
    0.9 + 0.24 * Math.sin(Math.PI * 0.92 * u) + 0.035 * Math.sin(u * Math.PI * 2 * 2.6 + 0.4)
    - 0.36 * Math.pow(Math.max(0, (u - 0.72) / 0.28), 1.6);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= layers; i++) {
    const u = i / layers, y = 0.05 + u * H, base = r(u);
    pts.push(new THREE.Vector2(base + 0.005, y));
    if (i < layers) pts.push(new THREE.Vector2(base - 0.002, y + (H / layers) * 0.5));
  }
  const mat = PLA();
  const shade = new THREE.Mesh(new THREE.LatheGeometry(pts, 180), mat);
  // printed base ring
  const ring = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(0.86, 0), new THREE.Vector2(1.32, 0), new THREE.Vector2(1.32, 0.05), new THREE.Vector2(0.86, 0.05)], 180),
    mat,
  );
  const g = new THREE.Group();
  g.add(shade, ring);
  return { object: g, glowMaterials: [mat], lightY: 0.55, height: H };
}

const PRINTS: Record<string, () => Built> = { 'forecast-lamp': forecastLamp };

function plateTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d')!;
  x.fillStyle = '#16181b'; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = 'rgba(233,231,225,0.07)'; x.lineWidth = 1;
  for (let i = 0; i <= 512; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(233,231,225,${Math.random() * 0.06})`; x.fillRect(Math.random() * 512, Math.random() * 512, 1, 1); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  return t;
}

// Each heavy step runs in its own idle slot so setting up WebGL never lands on a scroll frame.
const idle = () => new Promise<void>((resolve) => {
  const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: { timeout: number }) => number);
  if (ric) ric(() => resolve(), { timeout: 1500 }); else setTimeout(resolve, 60);
});

export async function mountPrint(host: HTMLElement) {
  const make = PRINTS[host.dataset.print ?? ''];
  if (!make) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  await idle();
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch { return; } // no WebGL: the still image stays
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.className = 'print-canvas';
  host.prepend(canvas);

  const scene = new THREE.Scene();
  // plain lights instead of a generated environment map: near-zero setup cost
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x1b1d20, 1.1));
  await idle();

  const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 60);
  const built = make();
  const pivot = new THREE.Group();
  pivot.add(built.object);
  scene.add(pivot);
  camera.position.set(0, 1.7, 6.2);
  camera.lookAt(0, built.height * 0.46, 0);

  const plate = new THREE.Mesh(new THREE.CircleGeometry(3.2, 96), new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: 0.85, metalness: 0.05 }));
  plate.rotation.x = -Math.PI / 2;
  scene.add(plate);

  const key = new THREE.DirectionalLight(0xfff1e0, 1.6); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9aabff, 0.8); rim.position.set(-4, 3, -3); scene.add(rim);
  const bulb = new THREE.PointLight(0xffa640, 0, 7, 1.4); bulb.position.set(0, built.lightY, 0); scene.add(bulb);
  // compile every shader up front, in parallel where the driver allows, before the first frame
  try { await renderer.compileAsync(scene, camera); } catch { /* falls back to compiling on first render */ }
  await idle();

  let lit = 0, litTarget = 0, hx = 0, hy = 0, visible = false, raf = 0, last = performance.now(), hovering = false;
  const button = host.querySelector<HTMLButtonElement>('.lamp-switch');
  const setLit = (on: boolean) => {
    litTarget = on ? 1 : 0;
    button?.setAttribute('aria-pressed', String(on));
    if (button) button.textContent = on ? 'Switch off' : 'Switch on';
    host.classList.toggle('is-lit', on);
    host.dataset.cursor = on ? 'Switch it off' : 'Switch it on';
    document.querySelector('.cursor-label')?.replaceChildren(host.dataset.cursor);
    kick();
  };

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    kick();
  };
  new ResizeObserver(resize).observe(host);

  const frame = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    lit += (litTarget - lit) * Math.min(1, dt * 5);
    const spin = (reduce ? 0 : 0.22) + (hovering ? hx * 1.8 : 0);
    pivot.rotation.y += spin * dt;
    pivot.rotation.x += ((hovering ? -hy * 0.12 : 0) - pivot.rotation.x) * Math.min(1, dt * 4);
    bulb.intensity = 5.5 * lit;
    for (const m of built.glowMaterials) m.emissiveIntensity = 0.62 * lit;
    renderer.toneMappingExposure = 1.05 + 0.12 * lit;
    renderer.render(scene, camera);
    const settling = Math.abs(litTarget - lit) > 0.002;
    if (visible && (!reduce || hovering || settling)) kick();
  };
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }, { rootMargin: '100px' }).observe(host);
  host.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'mouse') return; hovering = true; setLit(true); });
  host.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'mouse') return; hovering = false; hx = hy = 0; setLit(false); });
  host.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = host.getBoundingClientRect();
    hx = ((e.clientX - r.left) / r.width) * 2 - 1;
    hy = ((e.clientY - r.top) / r.height) * 2 - 1;
    kick();
  });
  button?.addEventListener('click', (e) => { e.stopPropagation(); setLit(litTarget < 0.5); });

  resize();
  host.classList.add('is-3d');
}
