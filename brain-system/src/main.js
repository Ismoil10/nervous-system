// Entry point (research/ANALYSIS.md B.5 main.js row, B.6, B.9–B.13): hardware detection, brain and
// body generation, the frame loop, picking, views and the HUD wiring. The DOM-free part of the loop
// lives in src/sim/runtime.js: SimClock owns kh and hands it to the orgasm scenario's own clock
// through the delegate; OrgasmAdapter advances the response and dopamine models over the clock's
// human interval; the Kernel (all seven network plugins, the adapter's command ring as its orgasm
// command source) follows on the same tH axis through the ScenarioPlayer, within the tier's CPU
// budget, and the clock commits the tH it reached (time slicing, §11.7).
//
// Frame (B.6): timing → runtime.frame (clock, adapter, dopamine filter, kernel, commit, BrainNet
// filter) → body generation slice → network ghosts, limb pose, packets on body paths → photosensitivity
// limiter → camera → render (the renderer composes and uploads the state textures) → HUD every 0.12 s.
//
// URL parameters (B.5): body=0|1, nets=<comma list of networks on>|all|none, scenario=<id>, seed=<n>,
// time=<preset name>|<locked kh>, view=<view key>, quality=low|medium|high|ultra; safetyMonitor=1
// (renderer.js); advanced=1 opens the full HUD instead of the simple one (ui-simple.js; user decision,
// 5 November 2026). Decisions where the spec is silent are marked [model].

import { createContext, GpuTimer } from './gl-utils.js';
import { TIERS, detectTier, AdaptiveQuality } from './performance.js';
import { generateBrain, generateBrainExtra, applyRelabel, areaIds, FLOATS as BRAIN_FLOATS } from './brain.js';
import { BrainRenderer, PARAMS as RENDER } from './renderer.js';
import { WAVE_SLOTS } from './shaders.js';
import { HeartBeat, HEART } from './heart.js';
import { PulseWave } from './pulse.js';
import { RespTrace, monitorValues } from './monitor.js';
import { OrbitCamera } from './camera.js';
import { CameraControls } from './camera-controls.js';
import { pickStars, VIEW_PICK } from './view-pick.js';
import { PRESETS } from './clock.js';
import { CENTER, MM, AREAS, R as ANATOMY_R } from './anatomy.js';
import { NEURON_COOL, NEURON_WARM, DOPAMINE_RGB, blackbodyRGB } from './color.js';
import { Hud } from './ui.js';
import { SCENARIOS as HUD_SCENARIOS, isBodyView, modeOf, senseById, siteById as hudSite } from './ui-body.js';
import { SimpleHud, stateOf, stateForScenario, STRESS_CIRCUIT, STRESS_MEMBER, STRESS_OTHER, STRESS_RGB, stressOverlay,
  dopamineLevel, stressLevel, plainStage, CALM_STORY } from './ui-simple.js';
import { Runtime } from './sim/runtime.js';
import { NET_IDS } from './sim/graph.js';
import { SCENARIOS } from './sim/scenarios.js';
import * as stimuli from './sim/stimuli.js';
import { generateBodyChunks } from './body/generate.js';
import { pick } from './body/picking.js';
import { SITES, BODY_BOUNDS } from './body/geometry.js';
import { PhotoLimiter } from './safety.js';
import { PacketMap, NetGhost, jointPose, overlayMembers, projectCss, mmToUnits } from './wiring.js';

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

function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

// Dopamine-system budget per tier (cell bodies are always drawn in full).
const daBudget = (tier) => ({ soma: 3500, axon: tier.axon, vari: tier.vari, total: 3500 + tier.axon + tier.vari });

// Views (§13.11). The three brain views are unchanged: whole brain, cutaway (left hemisphere removed
// at the midline) and the dopamine system with the cortex faded right down. Body views keep the brain
// shading of the whole-brain view; their keys are those of ui-body.js.
const TARGET = CENTER.map((v) => v * MM);
const BRAIN_SHADE = { cut: -10, shell: 0.55, deep: 0.8, back: 0.3 };
const bodyView = (target, distance, yaw, pitch) => ({ ...BRAIN_SHADE, camera: { yaw, pitch, distance, target } });
const VIEWS = {
  whole: { cut: -10, shell: 0.55, deep: 0.8, back: 0.3, camera: { yaw: -0.87, pitch: 0.3, distance: 3.6, target: TARGET } },
  cutaway: { cut: -0.006, shell: 0.8, deep: 0.8, back: 0.35, camera: { yaw: -1.45, pitch: 0.12, distance: 3.2, target: [0, -0.12, 0] } },
  dopamine: { cut: -10, shell: 0.1, deep: 0.3, back: 0.5, camera: { yaw: -0.95, pitch: 0.28, distance: 3.0, target: [0, -0.06, -0.04] } },
  wholeBody: bodyView([0, -0.2, -7.9], 35, -0.35, 0.10),
  upperBody: bodyView([0, 0, -2.46], 13.6, -0.35, 0.10),
  headNeck: bodyView([0, 0.1, -0.4], 6.7, -0.5, 0.15),
  thorax: bodyView([-0.1, 0, -3.3], 6.7, -0.25, 0.10),
  heart: bodyView([-0.25, 0.15, -3.45], 3.0, -0.45, 0.12),   // HEART.md §5: close on the heart; the rest dims
  abdomen: bodyView([0, 0.1, -5.9], 8.6, -0.25, 0.10),
  torso: bodyView([0, 0, -4.6], 14.3, -0.35, 0.10),
  spine: bodyView([0, -0.6, -4.3], 15.9, Math.PI, 0.10),
  rightArm: bodyView([2.2, -0.2, -5.5], 17.5, 0.6, 0.10),
  rightLeg: bodyView([0.9, 0, -12.0], 20.4, 0.45, 0.10),
};
const CAMERA = {
  fov: 0.55, minDistance: 0.9, spin: 0.03,   // §13.11 (unchanged)
  maxBody: 45, maxBrain: 7,                  // §13.11 maxDistance 45; brain-only mode keeps the brain-view limit 7 [model]
  near: 0.01, nearRef: 4, far: 150,          // §13.11 near 0.01·max(1, d/4), far 150
  viewGapS: 0.8,                             // §13.11 one view change per t_fade; later requests queue (the last one wins)
};
const BODY = { seed: 1848, sliceMs: 8 };     // B.9: ≤ 8-ms generation slices after the first brain frame
const PICK = { movePx: 6, holdMs: 600 };     // [model] a press that moves less than this is a click, not an orbit drag
// PhotoLimiter sources (§13.15, B.6 step 8): requested amplitudes as fractions of maximum relative
// luminance [model]. Its factors scale the packets; the body fade, the network ghosts and the lanterns
// are already slew-limited where they are made (t_fade, NetGhost, DOPAMINE.md §10) and enter as
// context only, so the brain-only image stays the post-port one [model].
const LIMIT = { packetLum: 0.25, packetPx: 5, bodyLum: 0.12, lanternLum: 0.3, brainRadiusMm: 75 };
const HUD_SCENARIO_IDS = HUD_SCENARIOS.map((s) => s.id);
const DEFAULT_SCENARIO = 'orgasm';   // opened when the URL names no scenario (readParams)
// Dopamine wave (display only) [model], like an expanding shock-wave ring. Each shell's radius
// grows at speedMm per screen second; its width grows with the radius; its strength rises over
// `rise` s and fades out between fadeFromMm and fadeToMm; it pushes the points it crosses outward by
// up to pushMm. At most WAVE_SLOTS shells at once.
const WAVE = {
  climax: { speedMm: 55, amp: 1 }, pulse: { speedMm: 80, amp: 0.5 },
  width0Mm: 5, widthPerMm: 0.12, pushMm: 1.6, rise: 0.35, fadeFromMm: 70, fadeToMm: 115, slots: WAVE_SLOTS,
};
// Pre-build dopamine display restored in the simple HUD: fibre-flow cadence (0.5/16 s per sample,
// 0.5-s travel) and the climax glow filter without the 2-s pulse-locked floor.
const CLASSIC_DA = { histStep: 0.5 / 16, tauVisLocked: 0.3 };
// Visual style of the simple HUD (user decisions, 5–6 November 2026): "detailed" draws every body
// star, smaller and sharper, in anatomical colours, with the nervous system brighter (renderer
// PARAMS.style); "stars" is the earlier look, kept as a preset. The glass shells of 5 November were
// replaced by the detailed stars. The choice is remembered in this browser.
const STYLE = { key: 'brain-system.style' };
// Detailed style colours [model]: brain stars pink-lavender (the brain's colour in anatomy atlases);
// the dopamine amber stays reserved for dopamine. The body stars take the anatomical tissue colours
// of BODY_VS (uStyle.x).
const DETAILED_NEURON = { cool: [0.9, 0.82, 1.0], warm: [1.0, 0.84, 0.94] };
const UNDRAWN_TOGGLES = { receptors: 'Touch receptors are not drawn in this build', labels: 'Labels are not drawn in this build' };

// URL parameters (B.5 item 8).
function readParams(search) {
  const p = new URLSearchParams(search);
  const num = (key) => { const v = p.get(key); return v !== null && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null; };
  const body = p.get('body');
  let nets = {};
  const list = p.get('nets');
  if (list !== null) {
    const on = new Set(list.split(',').map((x) => x.trim()).filter(Boolean));
    nets = Object.fromEntries(NET_IDS.map((n) => [n, on.has('all') || on.has(n)]));
  }
  const time = p.get('time');
  const kh = time !== null && Number.isFinite(Number(time)) && Number(time) > 0 ? Number(time) : null;
  // Without a `scenario` parameter the app opens playing the orgasm scenario in demo mode, as it did
  // before the whole-body build, so the dopamine system is active from the first frame (user decision,
  // 5 November 2026; A.7 opens with none). `?scenario=none` opens at rest.
  const sc = p.get('scenario');
  return {
    bodyMode: body === '0' || body === 'false' || body === 'brain' ? 'brain' : 'body',
    nets, scenario: sc === null ? DEFAULT_SCENARIO : SCENARIOS[sc] ? sc : null, seed: num('seed'),
    time: time !== null && PRESETS[time] ? time : kh,
    view: p.get('view'), quality: p.get('quality'),
    advanced: p.get('advanced') === '1' || p.get('advanced') === 'true',
  };
}

// Brain populations at a tier: the post-port neuron buffer with the A.3.3 relabels and the area
// attribute, plus the separate buffer of new nuclei (B.5 brain.js row, B.8).
function makeBrain(tier) {
  const brain = generateBrain({ neurons: tier.neurons, da: daBudget(tier) });
  applyRelabel(brain);
  brain.areas = areaIds(brain);
  const extra = generateBrainExtra({ neurons: tier.extra });
  extra.areas = areaIds(extra);
  brain.extra = extra;
  return brain;
}

const humanise = (id) => (id ? String(id).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\./g, ' ').toLowerCase() : null);
const sideName = (s) => (s > 0 ? 'R' : s < 0 ? 'L' : null);

async function start() {
  const ctx = createContext(canvas);
  if (!ctx) {
    fatal('Your browser does not support WebGL2. Open the page in a recent version of Chrome, Edge or Firefox.');
    return;
  }
  const { gl, hdr } = ctx;
  const rmQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let rmSetting = 'system';
  let reducedMotion = rmQuery.matches;

  // 1. Hardware capabilities -> initial quality tier.
  const hw = detectTier(gl);
  const url = readParams(location.search);
  document.body.classList.toggle('hud-simple', !url.advanced);
  document.body.classList.toggle('hud-advanced', url.advanced);
  const forced = TIERS.findIndex((t) => t.name === url.quality);
  const startTier = forced >= 0 ? forced : hw.tier;
  let genTier = forced >= 0 ? forced : Math.min(TIERS.length - 1, hw.tier + 1);   // headroom for adaptive upgrades
  console.info('[brain] hardware:', hw.reasons.join(', '), '| tier:', TIERS[startTier].label, '| HDR:', hdr);

  loadingText.textContent = `Placing ${TIERS[genTier].neurons.toLocaleString('en-US')} neurons…`;
  await nextFrame();

  // 2. Point populations (CPU, once).
  const t0 = performance.now();
  let brain = makeBrain(TIERS[genTier]);
  console.info(`[brain] populations generated in ${(performance.now() - t0).toFixed(0)} ms`);

  let renderer;
  try {
    renderer = new BrainRenderer(gl, hdr, brain);
  } catch (err) {
    fatal('Failed to load the graphics shaders: ' + err.message);
    throw err;
  }
  renderer.setSkeleton(false);   // §13.13 Views: Skeleton off by default

  // 3. Simulation: clock, orgasm adapter, kernel with every network, scenario player (runtime.js).
  loadingText.textContent = 'Settling the body model…';
  await nextFrame();
  const t1 = performance.now();
  const rt = new Runtime({ seed: url.seed, bodyMode: url.bodyMode, nets: url.nets });
  console.info(`[brain] kernel settled in ${(performance.now() - t1).toFixed(0)} ms (${rt.graph.nodes.length} nodes, ${rt.graph.edges.length} edges)`);
  const { model, dopamine, adapter, clock, kernel, player } = rt;
  if (url.time != null) { if (typeof url.time === 'string') rt.lockPreset(url.time); else rt.lock(url.time); }

  // Views and camera (§13.11). A `view` URL parameter wins over every scenario fly-to (B.5, B.13).
  let bodyMode = rt.bodyMode;
  const viewParam = VIEWS[url.view] && !(isBodyView(url.view) && bodyMode !== 'body') ? url.view : null;
  let view = viewParam ?? (url.scenario === 'orgasm' ? 'dopamine' : bodyMode === 'body' ? 'upperBody' : 'whole');
  let lastBrainView = isBodyView(view) ? 'whole' : view;
  const camera = new OrbitCamera(canvas, {
    reducedMotion, ...VIEWS[view].camera, fov: CAMERA.fov, minDistance: CAMERA.minDistance,
    maxDistance: bodyMode === 'body' ? CAMERA.maxBody : CAMERA.maxBrain, spin: CAMERA.spin,
    near: CAMERA.near, nearRef: CAMERA.nearRef, far: CAMERA.far, onCut: () => renderer.crossFade(),
  });
  const gpuTimer = new GpuTimer(gl);

  const applyQuality = () => {
    renderer.setTier(TIERS[quality.tier]);
    resize(true);
  };
  const quality = new AdaptiveQuality({ tier: startTier, maxTier: genTier, onChange: () => applyQuality(), hasGpuTimer: !!gpuTimer.ext });
  if (forced >= 0) quality.locked = true;

  // Display state of the whole-body build.
  const limiter = new PhotoLimiter({ width: canvas.clientWidth || 1280, height: canvas.clientHeight || 720, dpr: window.devicePixelRatio || 1 });
  const packetMap = new PacketMap(rt.graph);
  const netGhost = new NetGhost(RENDER.netSwitch);
  const rawPackets = [], bodyPackets = [], sources = [];
  let bodyGen = null, bodyData = null, bodyTier = -1;
  const heart = new HeartBeat();   // the beat drawn on the heart stars and the HUD trace (HEART.md)
  const pulse = new PulseWave();   // the arterial pulse on the vessel stars and the PLETH trace (PULSE.md)
  const resp = new RespTrace();     // the patient monitor's respiration trace (monitor.js)
  let picking = false, limbMotion = true, lastPath = null;
  const overlayOn = {};
  // Simple HUD state: the chosen state (Calm, Stress, Dopamine), what the camera looks at, the
  // resting adrenaline when Stress started, and the stress overlay strength last sent (−1: off).
  let simple = null, mode = 'calm', stressBase = null, stressShown = -1;
  let style = (() => { try { return localStorage.getItem(STYLE.key) === 'stars' ? 'stars' : 'detailed'; } catch { return 'detailed'; } })();

  const naccHist = new Float32Array(600);   // NAcc core dopamine (nM), one sample per 0.1 screen s
  let histHead = 0, histAcc = 0;
  let paused = false;

  // --- Views: one change per t_fade, the latest request queued (§13.11) ---
  let viewQueued = null, lastViewAt = -Infinity, screenT = 0;
  const requestView = (v) => {
    if (!VIEWS[v] || (isBodyView(v) && bodyMode !== 'body')) return;
    viewQueued = v;
  };
  const applyView = (v) => {
    view = v;
    if (!isBodyView(v)) lastBrainView = v;
    camera.flyTo(VIEWS[v].camera);
    hud.setView(v);
    lastViewAt = screenT;
  };

  // --- Body generation: after the first brain frame, in ≤ 8-ms slices (B.9) ---
  const ensureBody = () => {
    if (bodyGen || (bodyData && bodyTier === genTier)) return;
    const T = TIERS[genTier];
    bodyGen = { it: generateBodyChunks({ budget: T, lod: T.bodyLod }, BODY.seed, BODY.sliceMs), tier: genTier };
  };
  const stepBody = () => {
    const r = bodyGen.it.next();
    const v = r.value;
    if (!r.done && !(v && v.done)) return;
    const body = v && v.body ? v.body : v;
    bodyTier = bodyGen.tier;
    bodyGen = null;
    if (!body) return;
    bodyData = body;
    renderer.replaceBody(body);
    heart.setStars(body.points, body.floats, body.count);
    pulse.setStars(body.points, body.floats, body.count);
    if (bodyMode === 'body') renderer.setBodyFade(1);   // fade in over t_fade (B.9, §13.15)
    console.info(`[brain] body generated: ${body.count.toLocaleString('en-US')} points`);
  };

  // --- Scenarios (B.12, B.13) ---
  const syncAvailability = () => hud.syncSettings({ scenarioUnavailable: rt.unavailable(HUD_SCENARIO_IDS) });
  const afterOrgasmStart = (fly) => {
    naccHist.fill(0);
    hud.syncSettings({ mode: model.mode, level: model.level });
    if (fly && !viewParam) requestView('dopamine');   // B.13: unless a view URL parameter is set
  };
  const selectScenario = (id) => {
    rt.select(id);
    if (rt.scenarioId === 'orgasm') afterOrgasmStart(true);
  };
  const playScenario = (id) => {
    if (!rt.play(id)) return;
    if (rt.scenarioId === 'orgasm') afterOrgasmStart(false);
  };
  const resetAll = () => {
    rt.reset();
    if (rt.scenarioId === 'orgasm') afterOrgasmStart(false);
    naccHist.fill(0);
  };

  // --- Master switch (A.5, B.11, §13.10) ---
  const setBodyMode = (m) => {
    rt.setBodyMode(m);
    bodyMode = rt.bodyMode;
    camera.maxDistance = bodyMode === 'body' ? CAMERA.maxBody : CAMERA.maxBrain;
    if (bodyMode === 'body') {
      ensureBody();                              // ?body=0 defers generation until the first switch-on (B.9)
      if (bodyData) renderer.setBodyFade(1);
      requestView('upperBody');
    } else {
      renderer.setBodyFade(0);
      picking = false;
      if (isBodyView(view) || isBodyView(viewQueued)) requestView(lastBrainView || 'whole');
    }
    syncAvailability();
  };

  // --- Picking (B.11 steps 2–3, §13.12) ---
  const siteInfo = (s, side = sideName(s.side)) => ({
    id: s.base, side, label: hudSite(s.base)?.label, dermatome: s.kind === 'skin' ? s.segment ?? null : null,
    nerve: humanise(s.nerve), segment: s.segment ?? null, pathMm: Number.isFinite(s.pathLen) ? s.pathLen : null,
  });
  const geometrySite = (id, side) => {
    const want = side === 'R' ? 1 : side === 'L' ? -1 : null;
    const list = SITES.filter((s) => s.base === id);
    return list.find((s) => want === null || s.side === want || s.side === 0) ?? list[0] ?? null;
  };
  const pickAt = (x, y) => {
    const { sense, mode } = hud.body.stim;
    const m = modeOf(sense, mode), s = senseById(sense);
    const sites = m && !m.siteFree ? m.sites ?? s?.sites ?? null : null;
    const hit = pick(camera.unproject(x, y), { sense, bodyMode, yaw: camera.yaw, sites });
    if (!hit) { hud.setSite({ valid: false }); hud.setPicking(true); return; }
    hud.setSite(siteInfo(hit.site));
    picking = false;
  };
  let pressAt = null;
  canvas.addEventListener('pointerdown', (e) => { pressAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    const d = pressAt;
    pressAt = null;
    if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.altKey) return;   // modified clicks and drags navigate (camera-controls.js)
    if (!picking || !d || bodyMode !== 'body' || !bodyData) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > PICK.movePx || performance.now() - d.t > PICK.holdMs) return;
    pickAt(e.clientX, e.clientY);
  });

  // --- Camera navigation (camera-controls.js): the depth under a pixel is read from the stars drawn
  // there (view-pick.js): the brain populations (minus the cutaway half) and, in body mode, the body.
  const navSets = () => {
    const cut = VIEWS[view].cut > -1 ? VIEWS[view].cut : -Infinity;
    const sets = [{ data: brain.neurons, stride: BRAIN_FLOATS, count: brain.neuronCount, cutX: cut },
      { data: brain.da, stride: BRAIN_FLOATS, count: brain.daCount, cutX: cut }];
    if (brain.extra) sets.push({ data: brain.extra.neurons, stride: BRAIN_FLOATS, count: brain.extra.neuronCount, cutX: cut });
    if (bodyMode === 'body' && bodyData) sets.push({ data: bodyData.points, stride: bodyData.floats, count: bodyData.count });
    return sets;
  };
  const navPick = (x, y) => {
    const pxAngle = (2 * Math.tan(camera.fovEff / 2)) / (canvas.clientHeight || 1);
    const ray = camera._rayDir(x, y), opts = { near: camera.nearPlane, bin: camera.distance * VIEW_PICK.binFrac };
    const sets = navSets();
    const hit = pickStars(camera.eye, ray, sets, { ...opts, cone: VIEW_PICK.conePx * pxAngle })
      ?? pickStars(camera.eye, ray, sets, { ...opts, cone: VIEW_PICK.conePx * VIEW_PICK.widen * pxAngle });
    return hit ? hit.point : null;
  };
  const navBounds = () => {
    if (bodyMode !== 'body' || !bodyData) return { center: TARGET, radius: LIMIT.brainRadiusMm * MM };
    const { min, max } = BODY_BOUNDS;
    return { center: min.map((v, i) => ((v + max[i]) / 2) * MM), radius: 0.5 * Math.max(...min.map((v, i) => max[i] - v)) * MM };
  };
  let storage = null;
  try { storage = window.localStorage; } catch { storage = null; }
  new CameraControls(canvas, camera, {
    pickAt: navPick, frameAll: navBounds, framePreset: () => requestView(view), storage,
    blocked: () => { const d = document.getElementById('info'); return !!d && !d.hidden; },   // the About dialog
    simpleHud: () => document.body.classList.contains('hud-simple'),
  });

  // --- Overlays and Views toggles (display only, A.5, §13.10, §13.13) ---
  const setOverlay = (id, on) => {
    if (id === 'skeleton') { renderer.setSkeleton(on); return; }
    if (id in UNDRAWN_TOGGLES) return;
    overlayOn[id] = !!on;
    const members = overlayMembers(overlayOn, AREAS.map((a) => a.id));
    renderer.state.setOverlay(members ? renderer.state.overlayTargets(members) : {});
  };

  // --- Reduced motion (§13.15; Settings: System / On) ---
  const applyReducedMotion = () => {
    reducedMotion = rmSetting === 'on' || rmQuery.matches;
    camera.reducedMotion = reducedMotion;
    dopamine.setReducedMotion(reducedMotion);
    renderer.setReducedMotion(reducedMotion);
    renderer.setLimbMotion(limbMotion);
  };
  rmQuery.addEventListener?.('change', () => { if (rmSetting === 'system') applyReducedMotion(); });

  // Quality (both HUDs): 'auto' returns to the adaptive tier of performance.js; a tier index fixes it,
  // generating the larger point populations first when that tier was not built yet.
  async function setQuality(value) {
    if (value === 'auto') { quality.unlock(); return; }
    const idx = Number(value);
    if (idx > genTier) {
      loading.hidden = false;
      loadingText.textContent = `Placing ${TIERS[idx].neurons.toLocaleString('en-US')} neurons…`;
      await nextFrame();
      genTier = idx;
      brain = makeBrain(TIERS[genTier]);
      renderer.replaceBrain(brain);
      quality.maxTier = genTier;
      if (bodyData || bodyGen) { bodyGen = null; ensureBody(); }   // the body follows in slices (§13.4)
      loading.hidden = true;
    }
    quality.force(idx);
  }

  const hud = new Hud({
    // Orgasm scenario (Scenarios › scn-orgasm; Space and D act only while it runs).
    onMode: (m) => { rt.orgasmMode = m; model.setMode(m); },
    onLevel: (v) => model.setLevel(v),
    onStimulate: (held) => model.setHeld(held),
    onDistract: () => model.distract(),
    onProfile: (id) => model.setProfile(id),
    onTref: (sec) => model.setTref(sec),
    onHypothesis: (id) => dopamine.setHypothesis(id),
    onOnset: (o) => model.setOnset(o),                              // DOPAMINE.md §6.10 onset window
    onSwitch: (name, value) => dopamine.setSwitch(name, value),     // the other §6.10 rows
    onNovelStimulus: () => dopamine.novelStimulus(),
    // Controls bar, Settings, Views, Performance.
    onPause: () => togglePause(),
    onView: (v) => requestView(v),
    onReset: () => resetAll(),
    onQuality: (value) => setQuality(value),
    // Body, Interventions (A.5, B.11).
    onBodyMode: (m) => setBodyMode(m),
    onNet: (id, on) => { rt.setNet(id, on); syncAvailability(); },
    onIntervention: (preset) => {
      try { rt.setIntervention(preset); } catch (err) { console.warn('[brain] intervention:', err.message); }
    },
    // Stimulus (B.11, §13.12).
    onSense: () => {},   // the draft is read from the HUD at pick and delivery time
    onPick: (armed, siteId, side) => {
      if (siteId === undefined) { picking = !!armed && bodyMode === 'body'; return; }
      picking = false;
      if (!siteId) return;
      const s = geometrySite(siteId, side);
      if (s) hud.setSite(siteInfo(s, side ?? sideName(s.side)));
    },
    onDeliver: (record) => {
      const r = rt.deliver(record);
      if (!r) { console.warn('[brain] stimulus not valid here:', record.sense, record.mode, record.site); return; }
      const s = record.site ? geometrySite(record.site, record.side) : null;
      const label = record.site ? hudSite(record.site)?.label ?? record.site : senseById(record.sense)?.label;
      lastPath = [label, s && humanise(s.nerve), s && s.segment].filter(Boolean).join(' · ');
    },
    // Scenarios (B.12).
    onScenario: (id) => selectScenario(id),
    onPlay: (id) => playScenario(id),
    onStop: () => rt.stop(),
    onRestart: () => playScenario(rt.scenarioId),
    onRepeat: () => rt.repeat(),
    onSeek: (tH) => rt.seek(tH),
    // Time (A.4).
    onTimePreset: (name) => rt.lockPreset(name),
    onTimeLock: (kh) => rt.lock(kh),
    onTimeRate: (kh) => rt.lock(kh),
    // Brain systems, Views toggles, Settings.
    onOverlay: (id, on) => setOverlay(id, on),
    onArousalState: (id) => rt.setArousalState(id),
    onAge: (y) => rt.setAge(y),
    onLimbMotion: (on) => { limbMotion = !!on; renderer.setLimbMotion(limbMotion); },
    onReducedMotion: (v) => { rmSetting = v === 'on' ? 'on' : 'system'; applyReducedMotion(); },
  });
  for (const [id, why] of Object.entries(UNDRAWN_TOGGLES)) hud.body.setToggleAvailable(id, false, why);
  applyReducedMotion();

  // --- Dopamine wave (display only; user decision, 5 November 2026) ---
  // At the climax a bright shell leaves the core dopamine system (VTA) and runs out along its fibres
  // and through the whole brain; a weaker, faster one follows each contraction, scaled by its
  // amplitude. A new shell starts at most every ≈ 0.6 s (under 3 a second); reduced motion halves
  // the climax wave and its push and drops the per-contraction ones [model].
  const vtaMm = (() => {
    const N = brain.neurons, ids = new Set([ANATOMY_R.vta, ANATOMY_R.vtaMedial]), c = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < brain.neuronCount; i++) {
      if (!ids.has(Math.round(N[i * 12 + 8]))) continue;
      c[0] += N[i * 12]; c[1] += N[i * 12 + 1]; c[2] += N[i * 12 + 2]; n++;
    }
    return n ? c.map((v) => v / n / MM) : [0, -17, -14];   // fallback: VTA near MNI (0, −17, −14)
  })();
  const waves = [];
  let wavePhase = null, wavePulses = 0;
  function updateWaves(dt) {
    if (!simple) return;   // the full HUD keeps the DOPAMINE.md display
    if (adapter.active) {
      const ph = model.phase, done = model.pulses?.done ?? 0;
      if (ph === 'orgasm' && wavePhase !== 'orgasm') { waves.push({ age: 0, ...WAVE.climax }); wavePulses = done; }
      else if (ph === 'orgasm' && done > wavePulses) {
        const amps = model.train?.amps ?? [];
        const rel = amps.length ? (amps[done - 1] ?? amps[amps.length - 1]) / Math.max(1e-6, amps[0]) : 1;
        if (!reducedMotion) waves.push({ age: 0, speedMm: WAVE.pulse.speedMm, amp: WAVE.pulse.amp * Math.min(1, rel) });
        wavePulses = done;
      }
      wavePhase = ph;
    } else wavePhase = null;
    for (const w of waves) w.age += dt;
    while (waves.length && (waves[0].speedMm * waves[0].age > WAVE.fadeToMm || waves.length > WAVE.slots)) waves.shift();
    const k = reducedMotion ? 0.5 : 1;
    const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    renderer.setWaves(vtaMm, waves.map((w) => {
      const r = w.speedMm * w.age;
      return {
        radiusMm: r, widthMm: WAVE.width0Mm + WAVE.widthPerMm * r, pushMm: WAVE.pushMm * k,
        amp: k * w.amp * smooth(0, WAVE.rise, w.age) * (1 - smooth(WAVE.fadeFromMm, WAVE.fadeToMm, r)),
      };
    }));
  }

  // Simple HUD (the default; the full HUD above opens with ?advanced=1): Calm, Stress or Dopamine;
  // Look at Brain or Body (the camera only); Pause.
  function togglePause() { paused = !paused; hud.setPaused(paused); simple?.setPaused(paused); }
  // Stress is drawn on the brain (display only): the stress circuit brightens and the rest of the
  // brain dims through the brain-systems overlay, scaled by k (0–1); the locus coeruleus takes its
  // noradrenaline tint. null clears both.
  const AREA_IDS = AREAS.map((a) => a.id);
  const stressMembers = { regions: STRESS_CIRCUIT.regions, areas: STRESS_CIRCUIT.areas.map((a) => AREA_IDS.indexOf(a)).filter((i) => i >= 0) };
  // The circuit's stars also take the noradrenaline colour (BrainNet tint channel, §13.6), written
  // after BrainNet refills its tints each frame; alpha ≤ the BrainNet tint mix of 0.8 [model].
  const stressRegionIdx = STRESS_CIRCUIT.regions.map((id) => ANATOMY_R[id]).filter((r) => r !== undefined);
  const paintStressTint = (k) => {
    const t = rt.brainnet?.tint;
    if (!t) return;
    const m = 0.8 * k;
    for (const r of stressRegionIdx) {
      for (let s = 0; s < 2; s++) {
        const o = (2 * r + s) * 4;
        if (t[o + 3] >= m) continue;
        t[o] = STRESS_RGB[0]; t[o + 1] = STRESS_RGB[1]; t[o + 2] = STRESS_RGB[2]; t[o + 3] = m;
      }
    }
  };
  const showStress = (k) => {
    if (k == null) {
      if (stressShown < 0) return;
      stressShown = -1;
      renderer.state.setOverlay({});
      rt.brainnet?.setTints(null);
      return;
    }
    if (Math.abs(k - stressShown) < 0.02) return;
    if (stressShown < 0) rt.brainnet?.setTints(['NE']);
    stressShown = k;
    const t = renderer.state.overlayTargets(stressMembers);   // members > 1, the rest < 1
    const mix = (a) => a.map((v) => (v > 1 ? 1 + (STRESS_MEMBER - 1) * k : 1 - (1 - STRESS_OTHER) * k));
    renderer.state.setOverlay({ region: mix(t.region), area: mix(t.area) });
  };
  // Emotion and view are separate states (user decision, 5 November 2026): an emotion runs its model
  // and never moves the camera; a view moves the camera and never changes the emotion.
  const setMode = (m) => {
    const st = stateOf(m);
    if (!st) return;
    mode = m;
    if (paused) togglePause();
    showStress(null);
    if (!st.scenario) { rt.stop(); return; }
    if (st.scenario === 'stressor' && rt.bodyMode !== 'body') {
      const keep = viewQueued ?? view;
      setBodyMode('body');   // adrenaline and cortisol need the body; the view stays as it was
      requestView(keep);
    }
    playScenario(st.scenario);   // the orgasm scenario starts here without its fly-to (B.13 applies to the full HUD)
    if (st.scenario === 'stressor') stressBase = rt.vitals().adrenaline;
  };
  const setSimpleView = (v) => {
    if (isBodyView(v) && rt.bodyMode !== 'body') setBodyMode('body');
    requestView(v);
  };
  const simpleState = () => {
    if (mode === 'stress' && !player.active) { mode = 'calm'; showStress(null); }   // the stressor ran to its end
    const st = adapter.active || player.active ? rt.stage() : null;
    const story = st ? { scenario: rt.scenarioId === 'orgasm' ? 'Orgasm' : rt.scenarioId === 'stressor' ? 'Stress' : rt.scenarioLabel(),
      ...plainStage(rt.scenarioId, st.name, st.text) } : CALM_STORY;
    let meter = null;
    if (mode === 'dopamine' && adapter.active) meter = { kind: 'dopamine', level: dopamineLevel(dopamine.readouts().ratioNacc) };
    if (mode === 'stress') {
      const v = rt.vitals();
      const level = stressLevel(v.adrenaline / (stressBase || v.adrenaline));
      meter = { kind: 'stress', level };
      showStress(stressOverlay(level));
    }
    const q = { value: quality.locked ? String(quality.tier) : 'auto', autoLabel: quality.locked ? null : TIERS[quality.tier].label };
    const monitor = renderer.bodyVisible && bodyData ? monitorValues(rt.vitals(), heart.bpm, pulse.ptt) : null;
    return { state: mode, view: viewQueued ?? view, quality: q, style, paused, story, meter, monitor };
  };
  if (!url.advanced) {
    const refresh = () => simple.update(simpleState());
    simple = new SimpleHud(document, {
      onState: (m) => { setMode(m); refresh(); },
      onView: (v) => { setSimpleView(v); refresh(); },
      onQuality: (value) => { setQuality(value).then(refresh); },
      onPause: () => { togglePause(); refresh(); },
      onStyle: (s) => { setStyle(s); refresh(); },
    });
    // The dopamine display of the app before the whole-body build (user decision, 5 November 2026;
    // DOPAMINE.md §9.8 "current code" column): the climax reward locked to each contraction, so every
    // contraction sends a burst from the midbrain along the fibres; the fibre flow at its old 0.5-s
    // travel; no extra 2-s smoothing of the glows during the climax (the 0.3-s floor stays).
    dopamine.setSwitch('pulseLocked', true);
    Object.assign(dopamine.p, CLASSIC_DA);
  }

  // A scenario chosen by URL: the orgasm scenario starts on selection (B.13); the others play [model].
  if (url.scenario) {
    rt.select(url.scenario);
    if (url.scenario !== 'orgasm' && !rt.unavailable()[url.scenario]) rt.play();
  }
  // The simple HUD opens on the state of the scenario that plays: Dopamine for the default orgasm
  // scenario, Stress for ?scenario=stressor, otherwise Calm.
  mode = adapter.active || player.active ? stateForScenario(rt.scenarioId) : 'calm';
  if (mode === 'stress') stressBase = rt.vitals().adrenaline;

  const p = dopamine.p;
  hud.syncSettings({
    mode: model.mode, level: model.level, profile: model.profileId, tref: model.p.tref, view, hypothesis: dopamine.hypothesis,
    onset: { uPre: model.p.uPre }, switches: { pulseLocked: p.pulseLocked, zR: p.zR > 0, kappa: p.gK > 0, sT: p.sT > 0, satiety: p.satiety, imaging: p.imaging },
    bodyMode, nets: rt.nets, scenarioUnavailable: rt.unavailable(HUD_SCENARIO_IDS), scenario: rt.scenarioId,
    kh: clock.kh, timeLock: clock.locked ?? null, age: kernel.get('age'), arousalState: rt.arousalState(),
    reducedMotion: rmSetting, limbMotion,
  });
  if (forced >= 0) document.getElementById('quality').value = String(forced);

  // 4. Size: CSS size × DPR (capped per tier) × adaptive render scale.
  let cssW = 0, cssH = 0, dprUsed = 0;
  function resize(force = false) {
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[quality.tier].maxDpr);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!force && w === cssW && h === cssH && dpr === dprUsed) return;
    cssW = w; cssH = h; dprUsed = dpr;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    renderer.resize(canvas.width, canvas.height, quality.scale);
    limiter.resize(Math.max(1, w), Math.max(1, h), window.devicePixelRatio || 1);
  }
  renderer.setTier(TIERS[quality.tier]);
  resize(true);

  // Brightness calibration (linear HDR units before ACES); `body` scales the body pass (§13.3). At 1
  // the sparse body points stayed below visibility at body-view distances; 6 shows the figure, nerves
  // and cord clearly from Whole body to Thorax without saturating close-ups [model, browser check].
  const tune = { neurons: 0.05, bathing: 0.3, somata: 0.7, axons: 0.22, release: 0.35, lanterns: 0.03, exposure: 1.1, bloom: 0.8, lambda: 0.6, body: 6 };

  // --- Visual style (simple HUD): Detailed or Stars. ---
  function setStyle(s) {
    style = s === 'stars' ? 'stars' : 'detailed';
    renderer.detailed = !!simple && style === 'detailed';
    try { localStorage.setItem(STYLE.key, style); } catch { /* storage may be blocked */ }
  }
  setStyle(style);
  window.__brain = {   // console inspection and testing
    tune, runtime: rt, model, dopamine, adapter, clock, kernel, player, scenarios: player, stimuli, safety: limiter,
    camera, quality, renderer, packetMap, get body() { return bodyData; }, tick: (now) => tick(now), setView: requestView,
  };

  const fibre = blackbodyRGB(4200);
  let animT = 0, hudTimer = 0, last = performance.now(), dimmed = false, frames = 0;

  // Photosensitivity sources of this frame (§13.15): packets, the body pass, the lanterns.
  function limit(dt) {
    sources.length = 0;
    const w = cssW || 1, h = cssH || 1;
    for (const q of bodyPackets) {
      const xy = projectCss(camera.view, camera.proj, mmToUnits(packetMap.positionMm(q)), w, h);
      if (xy) sources.push({ id: `p${q.seq}`, x: xy[0], y: xy[1], r: LIMIT.packetPx, amp: LIMIT.packetLum * Math.min(1, Math.max(0, q.gain)), ref: q });
    }
    if (renderer.body && renderer.bodyFade > 0) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let c = 0; c < 8; c++) {
        const pt = [0, 1, 2].map((a) => ((c >> a) & 1 ? BODY_BOUNDS.max[a] : BODY_BOUNDS.min[a]));
        const xy = projectCss(camera.view, camera.proj, mmToUnits(pt), w, h);
        if (!xy) continue;
        x0 = Math.min(x0, xy[0]); y0 = Math.min(y0, xy[1]); x1 = Math.max(x1, xy[0]); y1 = Math.max(y1, xy[1]);
      }
      x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(w, x1); y1 = Math.min(h, y1);
      if (x1 > x0 && y1 > y0) {
        const g = netGhost.gains.reduce((s, v) => s + v, 0) / netGhost.gains.length;
        sources.push({ id: 'body', x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, amp: LIMIT.bodyLum * renderer.bodyFade * g });
      }
    }
    const c = projectCss(camera.view, camera.proj, TARGET, w, h);
    if (c) {
      const eye = camera.eye, d = Math.hypot(eye[0] - TARGET[0], eye[1] - TARGET[1], eye[2] - TARGET[2]);
      const r = (LIMIT.brainRadiusMm * MM) * (h / 2) / Math.tan(camera.fovEff / 2) / Math.max(1e-3, d);
      let E = 0;
      for (let i = 1; i < dopamine.region.length; i += 4) E = Math.max(E, dopamine.region[i]);
      sources.push({ id: 'lanterns', x: c[0], y: c[1], r, amp: LIMIT.lanternLum * Math.min(1, Math.max(0, E)) });
    }
    const f = limiter.scale(sources, dt);
    for (let i = 0; i < sources.length; i++) if (sources[i].ref) sources[i].ref.scale = Math.min(1, f[i]);
  }

  // One step of simulation and rendering; the rAF loop calls it, and it can be driven directly for testing.
  function tick(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    resize();
    const gpuMs = gpuTimer.poll();
    quality.sample(dt, gpuMs);
    screenT += dt;

    // B.6 steps 2–6: clock proposal, orgasm adapter, dopamine filter (the per-tick contract), kernel
    // within the tier's budget (B.9), clock commit, BrainNet filter.
    const sdt = paused ? 0 : dt;
    rt.frame(sdt, { budgetMs: TIERS[quality.tier].kernelMs });
    if (stressShown >= 0) paintStressTint(stressShown);   // simple HUD, Stress
    updateWaves(sdt);
    // Heart (HEART.md §4–§5): beats in screen time at the simulated rate, with its respiratory
    // variation (hrInst / hr) and contractility; with the legacy envelope (Pleasure) the systolic
    // pressure stands in for contractility.
    if (renderer.bodyVisible) {
      const vit = rt.vitals(), hrK = kernel.get('hr'), hrI = kernel.get('aut.hrInst');
      const contr = Math.max(kernel.get('contractility') || 1, 1 + ((vit.sbp ?? 115) - 115) / HEART.contrFromSbp);
      heart.step(dt, { hr: vit.hr, rsa: hrK > 0 && hrI > 0 ? hrI / hrK : 1, contractility: contr, kh: clock.kh,
        paused, reducedMotion, focus: view === 'heart', sbp: vit.sbp, dbp: vit.dbp });
      resp.step(dt, { rr: vit.rr, vt: kernel.get('vt'), kh: clock.kh, paused });
      renderer.setHeart(...heart.uniforms());
      // Arterial pulse (PULSE.md §7–§8): the beat's wave through the tree; the skin blood flow sets the
      // fingertip pulse amplitude.
      pulse.step(heart, { sbf: kernel.get('sbf') });
      renderer.setPulse(pulse.uniforms());
    }
    animT += sdt;

    // The body follows the first brain frame in slices (B.9).
    if (frames > 0 && !bodyGen && !bodyData && bodyMode === 'body') ensureBody();
    if (bodyGen) stepBody();
    frames++;

    // Display state of the body: network ghosts follow g.<net> (A.5), the limb pose (§13.9; off in
    // the orgasm scenario, B.13), and the kernel's packets on the body paths (§11.8, §13.8).
    renderer.setNetworkGains(netGhost.update(kernel, dt));
    renderer.setLimbMotion(limbMotion && !adapter.active);
    if (renderer.bodyVisible) {
      if (limbMotion && !adapter.active && !reducedMotion) for (const j of jointPose(kernel)) renderer.setJoint(j.seg, j.q, j.pivot, j.offset);
      packetMap.map(kernel.packets(rawPackets), bodyPackets);
    } else bodyPackets.length = 0;

    // "Letting go" at the climax is shown at the interface: the HUD dims and the camera stops
    // drifting, only inside the orgasm scenario (B.13; ONSET and ORGASM).
    const climax = adapter.climax;
    if (climax !== dimmed) { dimmed = climax; hud.setDimmed(climax); simple?.setDimmed(climax); }
    if (viewQueued && screenT - lastViewAt >= CAMERA.viewGapS) { const v = viewQueued; viewQueued = null; applyView(v); }
    camera.autoSpin = climax || reducedMotion || isBodyView(view) ? 0 : CAMERA.spin;   // §13.11 auto-orbit in brain views only
    camera.update(dt, canvas.width / canvas.height, animT);
    const V = VIEWS[view];

    limit(dt);   // B.6 step 8
    const q = gpuTimer.begin();
    renderer.render({
      view: camera.view, proj: camera.proj, eye: camera.eye, fov: camera.fovEff, t: animT, dt,
      cut: V.cut, shell: V.shell, deep: V.deep, back: V.back, lambda: tune.lambda,
      // Flux per point follows the inverse-square law and the field of view, so surface brightness
      // stays constant when zooming or on a portrait screen.
      zoom: Math.pow((3.6 / camera.distance) * (Math.tan(camera.fov / 2) / Math.tan(camera.fovEff / 2)), 2),
      distance: camera.distance,
      dopamine, brainnet: rt.brainnet, kernel, packets: bodyPackets,
      amber: DOPAMINE_RGB, cool: renderer.detailed ? DETAILED_NEURON.cool : NEURON_COOL, warm: renderer.detailed ? DETAILED_NEURON.warm : NEURON_WARM, fibre,
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
    if (adapter.active && model.mode === 'demo') hud.setLevel(model.level);

    if (simple && renderer.bodyVisible && bodyData) simple.drawMonitor(heart, resp, pulse);
    hudTimer -= dt;
    if (hudTimer <= 0 && simple) {
      hudTimer = 0.12;
      simple.update(simpleState());
    } else if (hudTimer <= 0) {
      hudTimer = 0.12;
      const refractory = adapter.active && model.I >= 0.08;
      let remaining = 0;
      if (refractory) for (remaining = 0; remaining < 30 * 3600 && model._Iat(model.tHuman + remaining) >= 0.08; remaining += 10);
      const stage = rt.stage();
      hud.update({
        phaseName: stage.name,
        phaseDesc: stage.text,
        arousal: model.Aeff,
        clock: clock.label(),
        kh: clock.kh, clockSource: clock.source, timeHuman: clock.tH - clock.epochH,
        scenario: rt.scenarioHud(), orgasm: adapter.active,
        refractory: { active: refractory, pct: model.I, remaining: fmtClock(remaining) },
        vitals: rt.vitals(), vitalTags: rt.vitalTags(),
        vitalsHistory: rt.trace, vitalsHistoryHead: rt.traceHead, vitalsSpanH: rt.traceSpanH(),
        pulses: model.pulses,
        dopamine: da,
        modulators: { ...dopamine.modulators(model), noradrenaline: kernel.get('modNE'), acetylcholine: kernel.get('modACh'),
          histamine: kernel.get('modHA'), orexin: kernel.get('modOX') },
        history: naccHist, historyHead: histHead,
        bodyMode: rt.bodyMode, nets: rt.nets, intervention: rt.interventionId(), arousalState: rt.arousalState(),
        events: rt.events(), lastPath, psi: rt.lastStimulus ? kernel.get('psi') : undefined,
        fps: quality.fps, gpuMs,
        tierLabel: `${TIERS[quality.tier].label}${quality.locked ? '' : ' (auto)'} · ${Math.round(quality.scale * 100)}%`,
        points: renderer.pointCount, bodyPoints: renderer.bodyPoints, extraPoints: renderer.extraPoints,
        packets: renderer.state.packetCount, kernelMs: rt.kernelMs, clockLimited: clock.limited,
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
