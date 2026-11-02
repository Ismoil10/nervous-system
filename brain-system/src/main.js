// Entry point: hardware detection, brain generation and the animation loop.

import { createContext, GpuTimer } from './gl-utils.js';
import { TIERS, detectTier, AdaptiveQuality } from './performance.js';
import { generateBrain } from './brain.js';
import { BrainRenderer } from './renderer.js';
import { OrbitCamera } from './camera.js';
import { ResponseModel, PHASES } from './response.js';
import { DopamineModel } from './dopamine.js';
import { CENTER, MM } from './anatomy.js';
import { NEURON_COOL, NEURON_WARM, DOPAMINE_RGB, blackbodyRGB } from './color.js';
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

function fmtHuman(sec) {
  if (sec < 60) return `${sec < 10 ? sec.toFixed(1).replace(/\.0$/, '') : Math.round(sec)} s`;
  if (sec < 3600) return `${(sec / 60).toFixed(sec < 600 ? 1 : 0).replace(/\.0$/, '')} min`;
  return `${(sec / 3600).toFixed(1).replace(/\.0$/, '')} h`;
}
function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

// Dopamine-system budget per tier (cell bodies are always drawn in full).
const daBudget = (tier) => ({ soma: 3500, axon: tier.axon, vari: tier.vari, total: 3500 + tier.axon + tier.vari });

// Views: whole brain, cutaway (left hemisphere removed at the midline) and the dopamine system
// with the cortex faded right down.
const TARGET = CENTER.map((v) => v * MM);
const VIEWS = {
  whole: { cut: -10, shell: 0.55, deep: 0.8, back: 0.3, camera: { yaw: -0.87, pitch: 0.3, distance: 3.6, target: TARGET } },
  cutaway: { cut: -0.006, shell: 0.8, deep: 0.8, back: 0.35, camera: { yaw: -1.45, pitch: 0.12, distance: 3.2, target: [0, -0.12, 0] } },
  dopamine: { cut: -10, shell: 0.1, deep: 0.3, back: 0.5, camera: { yaw: -0.95, pitch: 0.28, distance: 3.0, target: [0, -0.06, -0.04] } },
};
const VIEW_ORDER = ['whole', 'cutaway', 'dopamine'];

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
  const params = new URLSearchParams(location.search);
  const forced = TIERS.findIndex((t) => t.name === params.get('quality'));
  const startTier = forced >= 0 ? forced : hw.tier;
  let genTier = forced >= 0 ? forced : Math.min(TIERS.length - 1, hw.tier + 1);   // headroom for adaptive upgrades
  console.info('[brain] hardware:', hw.reasons.join(', '), '| tier:', TIERS[startTier].label, '| HDR:', hdr);

  loadingText.textContent = `Placing ${TIERS[genTier].neurons.toLocaleString('en-US')} neurons…`;
  await nextFrame();

  // 2. Point populations (CPU, once).
  const t0 = performance.now();
  let brain = generateBrain({ neurons: TIERS[genTier].neurons, da: daBudget(TIERS[genTier]) });
  console.info(`[brain] populations generated in ${(performance.now() - t0).toFixed(0)} ms`);

  let renderer;
  try {
    renderer = new BrainRenderer(gl, hdr, brain);
  } catch (err) {
    fatal('Failed to load the graphics shaders: ' + err.message);
    throw err;
  }

  let view = VIEWS[params.get('view')] ? params.get('view') : 'whole';
  const camera = new OrbitCamera(canvas, { reducedMotion, ...VIEWS[view].camera, fov: 0.55, minDistance: 0.9, maxDistance: 7, spin: 0.03 });
  const baseSpin = reducedMotion ? 0 : camera.autoSpin;
  const model = new ResponseModel();
  const dopamine = new DopamineModel();
  model.onStep = (h) => dopamine.step(h, model);   // the dopamine layer follows every human-time substep
  const gpuTimer = new GpuTimer(gl);

  const applyQuality = () => {
    renderer.setTier(TIERS[quality.tier]);
    resize(true);
  };
  const quality = new AdaptiveQuality({ tier: startTier, maxTier: genTier, onChange: () => applyQuality(), hasGpuTimer: !!gpuTimer.ext });
  if (forced >= 0) quality.locked = true;

  const naccHist = new Float32Array(600);   // NAcc core dopamine (nM), one sample per 0.1 screen s
  let histHead = 0, histAcc = 0;
  let paused = false;
  const resetAll = () => {
    model.reset();
    dopamine.reset();
    naccHist.fill(0);
  };
  const setView = (v) => {
    if (!VIEWS[v]) return;
    view = v;
    camera.flyTo(VIEWS[v].camera);
    hud.setView(v);
  };
  const hud = new Hud({
    onMode: (m) => model.setMode(m),
    onLevel: (v) => model.setLevel(v),
    onStimulate: (held) => model.setHeld(held),
    onDistract: () => model.distract(),
    onPause: () => { paused = !paused; hud.setPaused(paused); },
    onProfile: (id) => model.setProfile(id),
    onTref: (sec) => model.setTref(sec),
    onView: (v) => setView(v === 'next' ? VIEW_ORDER[(VIEW_ORDER.indexOf(view) + 1) % VIEW_ORDER.length] : v),
    onHypothesis: (id) => dopamine.setHypothesis(id),
    onReset: () => resetAll(),
    onQuality: async (value) => {
      if (value === 'auto') { quality.unlock(); return; }
      const idx = Number(value);
      if (idx > genTier) {
        loading.hidden = false;
        loadingText.textContent = `Placing ${TIERS[idx].neurons.toLocaleString('en-US')} neurons…`;
        await nextFrame();
        genTier = idx;
        brain = generateBrain({ neurons: TIERS[genTier].neurons, da: daBudget(TIERS[genTier]) });
        renderer.replaceBrain(brain);
        quality.maxTier = genTier;
        loading.hidden = true;
      }
      quality.force(idx);
    },
  });
  hud.syncSettings({ mode: model.mode, level: model.level, profile: model.profileId, tref: model.p.tref, view, hypothesis: dopamine.hypothesis });
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
  renderer.setTier(TIERS[quality.tier]);
  resize(true);

  // Brightness calibration (linear HDR units before ACES).
  const tune = { neurons: 0.05, bathing: 0.3, somata: 0.7, axons: 0.22, release: 0.35, lanterns: 0.03, exposure: 1.1, bloom: 0.8, lambda: 0.6 };
  window.__brain = { tune, model, dopamine, camera, quality, renderer, tick: (now) => tick(now), setView };   // console inspection and testing

  const fibre = blackbodyRGB(4200);
  let animT = 0, hudTimer = 0, last = performance.now(), dimmed = false;

  // One step of simulation and rendering; the rAF loop calls it, and it can be driven directly for testing.
  function tick(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    resize();
    const gpuMs = gpuTimer.poll();
    quality.sample(dt, gpuMs);

    const sdt = paused ? 0 : dt;
    const clk = model.update(sdt);
    model.events.length = 0;
    dopamine.updateVisuals(sdt, model, clk.kh);
    animT += sdt;

    // "Letting go" at the climax is shown at the interface: the HUD dims and the camera stops drifting.
    const climax = model.phase === 'orgasm' || model.phase === 'inevitability';
    if (climax !== dimmed) { dimmed = climax; hud.setDimmed(climax); }
    camera.autoSpin = climax ? 0 : baseSpin;
    camera.update(dt, canvas.width / canvas.height, animT);
    const V = VIEWS[view];

    const q = gpuTimer.begin();
    renderer.render({
      view: camera.view, proj: camera.proj, eye: camera.eye, fov: camera.fovEff, t: animT,
      cut: V.cut, shell: V.shell, deep: V.deep, back: V.back, lambda: tune.lambda,
      // Flux per point follows the inverse-square law and the field of view, so surface brightness
      // stays constant when zooming or on a portrait screen.
      zoom: Math.pow((3.6 / camera.distance) * (Math.tan(camera.fov / 2) / Math.tan(camera.fovEff / 2)), 2),
      region: dopamine.region, tint: dopamine.tint, da: dopamine.da, pathHist: dopamine.pathHist,
      amber: DOPAMINE_RGB, cool: NEURON_COOL, warm: NEURON_WARM, fibre,
      exposure: tune.exposure, bloomStrength: tune.bloom, tune,
    });
    gpuTimer.end(q);

    const da = dopamine.readouts();
    histAcc += sdt;
    while (histAcc >= 0.1) {
      histAcc -= 0.1;
      naccHist[histHead] = da.naccCore;
      histHead = (histHead + 1) % naccHist.length;
    }
    if (model.mode === 'demo') hud.setLevel(model.level);

    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = 0.12;
      const refractory = model.I >= 0.08;
      let remaining = 0;
      if (refractory) for (remaining = 0; remaining < 30 * 3600 && model._Iat(model.tHuman + remaining) >= 0.08; remaining += 10);
      hud.update({
        phaseName: PHASES[model.phase].name,
        phaseDesc: PHASES[model.phase].desc,
        arousal: model.Aeff,
        clock: `1 s = ${fmtHuman(clk.kh)}`,
        refractory: { active: refractory, pct: model.I, remaining: fmtClock(remaining) },
        vitals: model.vitals(),
        pulses: model.pulses,
        dopamine: da,
        modulators: dopamine.modulators(model),
        history: naccHist, historyHead: histHead,
        fps: quality.fps, gpuMs,
        tierLabel: `${TIERS[quality.tier].label}${quality.locked ? '' : ' (auto)'} · ${Math.round(quality.scale * 100)}%`,
        points: renderer.pointCount,
        width: renderer.width, height: renderer.height,
        gpu: hw.gpu.short, gpuRaw: hw.gpu.raw,
      });
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    tick(now);
  }

  loading.hidden = true;
  requestAnimationFrame(frame);
}

start();
