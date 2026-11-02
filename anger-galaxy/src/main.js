// Entry point: hardware detection, galaxy creation and the animation loop.

import { createContext, GpuTimer } from './gl-utils.js';
import { TIERS, detectTier, AdaptiveQuality } from './performance.js';
import { generateGalaxy, generateBackground, starColor } from './astro.js';
import { GalaxyRenderer } from './renderer.js';
import { OrbitCamera } from './camera.js';
import { AngerModel } from './anger.js';
import { GalacticEvents } from './events.js';
import { MODEL, spiralShape } from './galaxy-model.js';
import { Hud } from './ui.js';

const canvas = document.getElementById('scene');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');

function fatal(message) {
  loading.hidden = true;
  const box = document.getElementById('fatal');
  box.hidden = false;
  box.textContent = message;
}

// Short pause so the loading text gets painted. rAF is not used: it stalls in a background tab.
const nextFrame = () => new Promise((r) => setTimeout(r, 40));

async function start() {
  const ctx = createContext(canvas);
  if (!ctx) {
    fatal('Your browser does not support WebGL2. Open the page in a recent version of Chrome, Edge or Firefox.');
    return;
  }
  const { gl, hdr } = ctx;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Hardware capabilities -> initial quality tier.
  const hw = detectTier(gl);
  const forcedName = new URLSearchParams(location.search).get('quality');
  const forced = TIERS.findIndex((t) => t.name === forcedName);
  const startTier = forced >= 0 ? forced : hw.tier;
  let genTier = forced >= 0 ? forced : Math.min(TIERS.length - 1, hw.tier + 1);   // headroom for adaptive upgrades
  console.info('[galaxy] hardware:', hw.reasons.join(', '), '| tier:', TIERS[startTier].label, '| HDR:', hdr);

  loadingText.textContent = `Generating ${TIERS[genTier].stars.toLocaleString('en-US')} stars…`;
  await nextFrame();

  // 2. Stellar populations (CPU, once).
  let galaxy = generateGalaxy(TIERS[genTier]);
  const background = generateBackground();
  console.info(`[galaxy] populations generated in ${galaxy.ms.toFixed(0)} ms`);

  let renderer;
  try {
    renderer = new GalaxyRenderer(gl, hdr, galaxy, background, genTier);
  } catch (err) {
    fatal('Failed to load the graphics shaders: ' + err.message);
    throw err;
  }

  const camera = new OrbitCamera(canvas, { reducedMotion });
  const anger = new AngerModel();
  const events = new GalacticEvents();
  const gpuTimer = new GpuTimer(gl);

  const applyQuality = () => {
    renderer.setTier(TIERS[quality.tier], TIERS[genTier]);
    resize(true);
  };
  const quality = new AdaptiveQuality({
    tier: startTier,
    maxTier: genTier,
    onChange: () => applyQuality(),
    hasGpuTimer: !!gpuTimer.ext,
  });
  if (forced >= 0) quality.locked = true;

  let paused = false;
  let shakeOn = !reducedMotion;   // the Hud replaces this with the stored choice on construction
  let simT = 0, animT = 0;
  const hud = new Hud({
    onShake: (on) => { shakeOn = on; },
    onMode: (m) => anger.setMode(m),
    onSlider: (v) => anger.setManual(v),
    onProvoke: () => anger.provoke(),
    onPause: () => { paused = !paused; hud.setPaused(paused); },
    onQuality: async (value) => {
      if (value === 'auto') { quality.unlock(); return; }
      const idx = Number(value);
      if (idx > genTier) {
        loading.hidden = false;
        loadingText.textContent = `Generating ${TIERS[idx].stars.toLocaleString('en-US')} stars…`;
        await nextFrame();
        genTier = idx;
        galaxy = generateGalaxy(TIERS[genTier]);
        renderer.replaceGalaxy(galaxy);
        quality.maxTier = genTier;
        loading.hidden = true;
      }
      quality.force(idx);
    },
  });
  if (forced >= 0) document.getElementById('quality').value = String(forced);

  // 3. Size: CSS size × DPR (capped per tier) × adaptive render scale.
  let cssW = 0, cssH = 0, dprUsed = 0;
  function resize(force = false) {
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[quality.tier].maxDpr);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!force && w === cssW && h === cssH && dpr === dprUsed) return;
    cssW = w; cssH = h; dprUsed = dpr;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    renderer.resize(canvas.width, canvas.height, quality.scale);
  }
  renderer.setTier(TIERS[quality.tier], TIERS[genTier]);
  resize(true);

  // Brightness calibration (in linear HDR units, before ACES).
  const tune = {
    oldStars: 0.022, youngStars: 0.1, glow: 0.012, hii: 1.6, dust: 1.6, outflow: 0.022,
    background: 0.55, core: 0.03, exposure: 1.2, bloom: 1.0,
  };
  window.__galaxy = { tune, anger, camera, quality, renderer, events };   // for inspection from the console

  const coreColor = starColor(4300), agnColor = starColor(22000);
  const clip = new Float32Array(4);
  const diskAxis = new Float32Array([1, 0, 1]);
  let hudTimer = 0, last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    resize();

    const gpuMs = gpuTimer.poll();
    quality.sample(dt, gpuMs);

    const sdt = paused ? 0 : dt;
    anger.update(sdt);
    const p = anger.params();
    const shape = spiralShape(p.pitchDeg, p.contrast);
    simT += sdt * MODEL.BASE_SPEED * p.speed;
    animT += sdt;
    for (const ev of anger.events.splice(0)) if (ev === 'crisis') events.triggerRing();
    events.update(sdt, p, shape, simT);

    camera.shake = shakeOn ? p.shake : 0;
    camera.update(dt, canvas.width / canvas.height, animT);

    // Screen-space projection of the galactic center (for the bulge glow and the AGN).
    const m = camera.view, pr = camera.proj;
    const vx = m[12], vy = m[13], vz = m[14];
    clip[0] = pr[0] * vx + pr[4] * vy + pr[8] * vz + pr[12];
    clip[1] = pr[1] * vx + pr[5] * vy + pr[9] * vz + pr[13];
    clip[3] = -vz;
    const zoom = Math.pow(2.55 / camera.distance, 0.8);
    // Screen-space direction of the disk normal and the inclination (cos i) — used to flatten the diffuse glow and the dust.
    const nx = m[8], ny = m[9], nl = Math.hypot(nx, ny);
    if (nl > 1e-4) { diskAxis[0] = nx / nl; diskAxis[1] = -ny / nl; } else { diskAxis[0] = 1; diskAxis[1] = 0; }
    diskAxis[2] = Math.max(0.1, Math.abs(m[10]));
    const flare = p.coreFlare * (1 + (0.12 + 0.45 * p.anger) * anger.pulse);

    const q = gpuTimer.begin();
    renderer.render({
      view: camera.view, proj: camera.proj, viewRot: camera.viewRot, fov: camera.fov,
      t: simT, at: animT, k: shape.k, ecc: shape.ecc, heat: p.heat,
      sf: p.sf, sfFrac: p.sfFrac, outflow: p.outflow, ring: events.uniform, zoom, diskAxis,
      core: {
        visible: clip[3] > 0.05,
        x: (clip[0] / clip[3]) * 0.5 + 0.5,
        y: (clip[1] / clip[3]) * 0.5 + 0.5,
        rePx: 0.5 * 0.045 / (Math.tan(camera.fov / 2) * clip[3]),
        power: tune.core * flare,
        color: coreColor,
        agn: 0.6 * (flare - 1) + 0.04,
        agnColor,
      },
      fxData: events.data, fxCount: events.count,
      exposure: tune.exposure * p.exposure, bloomStrength: tune.bloom, tune,
    });
    gpuTimer.end(q);

    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = 0.12;
      if (anger.mode === 'auto') hud.setSlider(anger.value);
      hud.update({
        params: p,
        phaseName: anger.phaseInfo.name,
        phaseDesc: anger.phaseInfo.desc,
        history: anger.history, historyHead: anger.histHead,
        fps: quality.fps, gpuMs,
        tierLabel: `${TIERS[quality.tier].label}${quality.locked ? '' : ' (auto)'} · ${Math.round(quality.scale * 100)}%`,
        stars: renderer.starCount,
        width: renderer.width, height: renderer.height,
        gpu: hw.gpu.short, gpuRaw: hw.gpu.raw,
      });
    }
  }

  loading.hidden = true;
  requestAnimationFrame(frame);
}

start();
