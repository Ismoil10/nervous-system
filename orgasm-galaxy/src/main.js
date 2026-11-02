// Entry point: hardware detection, galaxy creation and the animation loop.

import { createContext, GpuTimer } from './gl-utils.js';
import { TIERS, detectTier, AdaptiveQuality } from './performance.js';
import { generateGalaxy, generateBackground, starColor, synchrotronRGB } from './astro.js';
import { GalaxyRenderer } from './renderer.js';
import { OrbitCamera } from './camera.js';
import { ResponseModel, PHASES } from './response.js';
import { JetKnots } from './knots.js';
import { MODEL, jetAxis } from './galaxy-model.js';
import { RING_HIST_N, RING_HIST_DT, AGN_HIST_N, AGN_HIST_YR } from './shaders.js';
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

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function fmtHuman(sec) {
  if (sec < 60) return `${sec < 10 ? sec.toFixed(1).replace(/\.0$/, '') : Math.round(sec)} s`;
  if (sec < 3600) return `${(sec / 60).toFixed(sec < 600 ? 1 : 0).replace(/\.0$/, '')} min`;
  return `${(sec / 3600).toFixed(1).replace(/\.0$/, '')} h`;
}
function fmtAstro(years) {
  if (years >= 1e6) return `${(years / 1e6).toFixed(1).replace(/\.0$/, '')} Myr`;
  if (years >= 1e3) return `${(years / 1e3).toFixed(years < 1e4 ? 1 : 0).replace(/\.0$/, '')} kyr`;
  return `${Math.round(years)} yr`;
}
function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

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
  const baseSpin = reducedMotion ? 0 : camera.autoSpin;
  const model = new ResponseModel();
  const knots = new JetKnots();
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

  // Star-formation history of the nuclear ring (model time) and AGN light history (astro time),
  // newest first: the shaders read them to age clusters and to delay the light echoes.
  const ringHist = new Float32Array(RING_HIST_N);
  const agnHist = new Float32Array(AGN_HIST_N);
  let ringAcc = 0, agnAcc = 0;
  const pushHist = (hist, value, steps) => {
    const n = Math.min(hist.length, steps);
    if (n > 0) { hist.copyWithin(n, 0, hist.length - n); hist.fill(value, 0, n); }
    hist[0] = value;
  };

  let paused = false;
  let simT = 0, animT = 0, flowT = 0;
  const resetAll = () => {
    model.reset();
    knots.clear();
    ringHist.fill(0); agnHist.fill(0);
  };
  const hud = new Hud({
    onMode: (m) => model.setMode(m),
    onLevel: (v) => model.setLevel(v),
    onStimulate: (held) => model.setHeld(held),
    onDistract: () => model.distract(),
    onPause: () => { paused = !paused; hud.setPaused(paused); },
    onProfile: (id) => model.setProfile(id),
    onTref: (sec) => model.setTref(sec),
    onEnvelope: (env) => { model.envelope = env; },
    onReset: () => resetAll(),
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
  hud.syncSettings({ mode: model.mode, level: model.level, profile: model.profileId, tref: model.p.tref, envelope: model.envelope });
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

  // Brightness calibration (linear HDR units before ACES). The AGN is in units of L_gal.
  const tune = {
    oldStars: 0.022, youngStars: 0.1, glow: 0.012, hii: 1.6, dust: 1.6, jet: 0.3, cone: 0.3,
    background: 0.55, core: 0.03, agn: 120, lane: 0.2, flush: 0.02, exposure: 1.2, bloom: 1.0,
  };
  window.__galaxy = { tune, model, camera, quality, renderer, knots, tick: (now) => tick(now) };   // console inspection and testing

  const coreColor = starColor(4600), agnColor = synchrotronRGB(0.44);
  const axis = jetAxis();
  const clip = new Float32Array(4);
  const diskAxis = new Float32Array([1, 0, 1]);
  const arousalHist = new Float32Array(600);
  let histHead = 0, histAcc = 0;
  let hudTimer = 0, last = performance.now(), dimmed = false;

  // One step of simulation and rendering; the rAF loop calls it, and it can be driven directly for testing.
  function tick(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    resize();

    const gpuMs = gpuTimer.poll();
    quality.sample(dt, gpuMs);

    const sdt = paused ? 0 : dt;
    const clk = model.update(sdt);
    const g = model.galaxy();
    for (const ev of model.events.splice(0)) {
      if (ev.type === 'pulse') knots.eject(ev.amp * (reducedMotion ? 0.5 : 1));
    }
    const dUnits = clk.years / (MODEL.MYR_PER_UNIT * 1e6);
    simT += dUnits;
    animT += sdt;
    flowT += dUnits * 0.6 * g.flowSpeed;

    ringAcc += dUnits;
    const ringSteps = Math.floor(ringAcc / RING_HIST_DT);
    ringAcc -= ringSteps * RING_HIST_DT;
    pushHist(ringHist, g.ringSF, ringSteps);
    agnAcc += clk.years;
    const agnSteps = Math.floor(agnAcc / AGN_HIST_YR);
    agnAcc -= agnSteps * AGN_HIST_YR;
    pushHist(agnHist, Math.min(1.5, g.agn / 0.3), agnSteps);

    // Cortical "letting go" is shown at the interface: the HUD dims and the camera stops drifting.
    const climax = model.phase === 'orgasm' || model.phase === 'inevitability';
    if (climax !== dimmed) { dimmed = climax; hud.setDimmed(climax); }
    camera.autoSpin = climax ? 0 : baseSpin;
    camera.shake = 0;
    camera.update(dt, canvas.width / canvas.height, animT);
    knots.update(sdt, clk.years, axis, camera.eye, g.relicTau, g.trainOver);

    // Projection of the galaxy centre (bulge light and AGN).
    const m = camera.view, pr = camera.proj;
    const vx = m[12], vy = m[13], vz = m[14];
    clip[0] = pr[0] * vx + pr[4] * vy + pr[8] * vz + pr[12];
    clip[1] = pr[1] * vx + pr[5] * vy + pr[9] * vz + pr[13];
    clip[3] = -vz;
    const zoom = Math.pow(2.55 / camera.distance, 0.8);
    const nx = m[8], ny = m[9], nl = Math.hypot(nx, ny);
    if (nl > 1e-4) { diskAxis[0] = nx / nl; diskAxis[1] = -ny / nl; } else { diskAxis[0] = 1; diskAxis[1] = 0; }
    diskAxis[2] = Math.max(0.1, Math.abs(m[10]));

    const q = gpuTimer.begin();
    renderer.render({
      view: camera.view, proj: camera.proj, viewRot: camera.viewRot, fov: camera.fov, eye: camera.eye,
      t: simT, at: animT, ringHist, armFrac: 0.5, agnHist, jetAxis: axis,
      jet: g.jet, coneO: g.coneO, coneMax: Math.max(...agnHist) * (0.4 + 0.6 * g.coneO),
      lane: g.laneOpacity * tune.lane, laneWidth: g.laneWidth, inflow: g.inflow * tune.lane * 2, flowT, nucFeed: g.nucFeed,
      flush: [g.flush[0], g.flush[1], g.flush[2] * tune.flush], zoom, diskAxis,
      core: {
        visible: clip[3] > 0.05,
        x: (clip[0] / clip[3]) * 0.5 + 0.5,
        y: (clip[1] / clip[3]) * 0.5 + 0.5,
        rePx: 0.5 * 0.03 / (Math.tan(camera.fov / 2) * clip[3]),
        power: tune.core,
        color: coreColor,
        agn: g.agn * tune.agn,
        agnColor,
        spikeLen: 70 * smoothstep(0.03, 0.3, g.agn),
      },
      fxData: knots.data, fxCount: knots.count,
      glowScale: Math.min(1, Math.pow(camera.distance / 2.2, 1.5)),
      exposure: tune.exposure, bloomStrength: tune.bloom, tune,
    });
    gpuTimer.end(q);

    histAcc += sdt;
    while (histAcc >= 0.1) {
      histAcc -= 0.1;
      arousalHist[histHead] = model.Aeff;
      histHead = (histHead + 1) % arousalHist.length;
    }
    if (model.mode === 'demo') hud.setLevel(model.level);

    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = 0.12;
      const phase = PHASES[model.phase];
      const v = model.vitals();
      const refractory = model.I >= 0.08;
      let remaining = 0;
      if (refractory) for (remaining = 0; remaining < 30 * 3600 && model._Iat(model.tHuman + remaining) >= 0.08; remaining += 10);
      hud.update({
        phaseName: phase.name,
        phaseDesc: phase.desc,
        arousal: model.Aeff,
        clock: `1 s = ${fmtHuman(clk.kh)} human · ${fmtAstro(clk.ka)}`,
        refractory: { active: refractory, pct: model.I, remaining: fmtClock(remaining) },
        vitals: v,
        pulses: model.pulses,
        neuro: model.neuro(),
        history: arousalHist, historyHead: histHead,
        fps: quality.fps, gpuMs,
        tierLabel: `${TIERS[quality.tier].label}${quality.locked ? '' : ' (auto)'} · ${Math.round(quality.scale * 100)}%`,
        stars: renderer.starCount,
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
