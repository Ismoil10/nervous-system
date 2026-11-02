// Hardware capability detection and adaptive quality control.
//
// Strategy: estimate the initial tier from the GPU name and device characteristics,
// then measure real frame times and adjust the render scale first, then the tier.

// Per tier: neuron stars, dopamine axon and release-site points drawn (cell bodies and lanterns
// are always drawn in full), bloom levels, device-pixel-ratio cap and initial render scale.
export const TIERS = [
  { name: 'low',    label: 'Low',    neurons: 60000,  axon: 6000,  vari: 4000,  bloomLevels: 4, maxDpr: 1.0,  scale: 0.85 },
  { name: 'medium', label: 'Medium', neurons: 130000, axon: 10000, vari: 7000,  bloomLevels: 5, maxDpr: 1.25, scale: 1.0 },
  { name: 'high',   label: 'High',   neurons: 240000, axon: 16000, vari: 11000, bloomLevels: 6, maxDpr: 1.5,  scale: 1.0 },
  { name: 'ultra',  label: 'Ultra',  neurons: 400000, axon: 24000, vari: 16000, bloomLevels: 6, maxDpr: 2.0,  scale: 1.0 },
];

export function readGpuName(gl) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const raw = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  // "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0, D3D11)" -> short name
  const m = /ANGLE \([^,]*,\s*([^,(]+?)(?:\s+Direct3D|\s+\(|,|$)/.exec(raw || '');
  return { raw: raw || 'unknown', short: (m ? m[1] : raw || 'unknown').trim() };
}

// Estimated tier (0..3) from the GPU name.
function tierFromGpu(name) {
  const n = name.toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|microsoft basic|software/.test(n)) return 0;
  if (/rtx\s*[2-9]\d|rx\s*[67]\d{3}|radeon pro w|apple m\d (pro|max|ultra)|arc a7/.test(n)) return 3;
  if (/gtx\s*(9[6-9]\d|10[5-8]\d|16\d\d)|rx\s*(4[7-9]\d|5[5-9]\d|5[5-7]00)|vega|quadro|apple m\d|arc/.test(n)) return 2;
  if (/geforce|radeon|nvidia|amd/.test(n)) return 2;
  if (/intel|iris|uhd|hd graphics|mali|adreno|powervr|apple gpu/.test(n)) return 1;
  return 1;
}

export function detectTier(gl) {
  const gpu = readGpuName(gl);
  let tier = tierFromGpu(gpu.raw);
  const reasons = [`GPU: ${gpu.short}`];
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 8;   // capped at 8 in Chrome
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 820);
  if (cores <= 4) { tier = Math.min(tier, 1); reasons.push(`${cores} CPU threads`); }
  if (mem <= 4) { tier = Math.min(tier, 1); reasons.push(`${mem} GB memory`); }
  if (mobile) { tier = Math.min(tier, 1); reasons.push('mobile device'); }
  const pixels = screen.width * screen.height * Math.min(devicePixelRatio || 1, 2) ** 2;
  if (pixels > 3840 * 2160 && tier > 1) { tier -= 1; reasons.push('very high-resolution screen'); }
  return { tier, gpu, cores, mem, mobile, reasons };
}

// Controls the render scale and tier based on frame time.
export class AdaptiveQuality {
  constructor({ tier, maxTier, onChange, hasGpuTimer = false }) {
    this.hasGpuTimer = hasGpuTimer;
    this.tier = tier;
    this.maxTier = maxTier;
    this.scale = TIERS[tier].scale;
    this.onChange = onChange;
    this.samples = [];
    this.windowStart = performance.now();
    this.cooldownUntil = performance.now() + 2500;   // ignore spikes during loading
    this.upgradeBlockedUntil = 0;
    this.goodWindows = 0;
    this.refreshHz = 60;
    this.fps = 0;
    this.locked = false;   // set when the user picks a tier manually
  }

  // dt — time between frames (s), gpuMs — GPU time (if available).
  sample(dt, gpuMs) {
    // In a hidden tab/panel the browser throttles frames — that is not our load.
    if (document.hidden) {
      this.samples.length = 0;
      this.windowStart = performance.now();
      return;
    }
    this.samples.push(dt);
    if (gpuMs != null) this.lastGpuMs = gpuMs;
    const now = performance.now();
    if (now - this.windowStart < 1500) return;
    const sorted = this.samples.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const best = sorted[Math.floor(sorted.length * 0.1)];
    this.samples.length = 0;
    this.windowStart = now;
    this.fps = 1 / median;
    // Estimate the display refresh rate from the fastest frames (60/120/144 Hz).
    this.refreshHz = Math.max(this.refreshHz * 0.8, Math.min(240, 1 / best));
    if (this.locked || now < this.cooldownUntil) return;
    // A GPU timer exists but has not produced a result yet — too early to decide.
    if (this.hasGpuTimer && this.lastGpuMs == null) return;

    // When GPU time is known, attribute low FPS to our load only if the GPU is actually busy (≥ 12 ms):
    // otherwise the cause is a browser limit or background mode.
    const budget = 1000 / Math.min(this.refreshHz, 120);
    const gpu = this.lastGpuMs;
    const slow = this.fps < 50 && (gpu == null || gpu > 12);
    const fast = this.fps > this.refreshHz * 0.92 && (gpu == null || gpu < budget * 0.45);

    if (slow) {
      this.goodWindows = 0;
      this.upgradeBlockedUntil = now + 12000;   // hysteresis: prevents oscillation
      if (this.scale > 0.7) {
        this.scale = Math.max(0.6, this.scale - 0.15);
        this._emit('scale');
      } else if (this.tier > 0) {
        this.tier -= 1;
        this.scale = TIERS[this.tier].scale;
        this._emit('tier');
      }
      this.cooldownUntil = now + 2000;
    } else if (fast && now > this.upgradeBlockedUntil) {
      this.goodWindows += 1;
      if (this.goodWindows >= 3) {
        this.goodWindows = 0;
        if (this.scale < TIERS[this.tier].scale) {
          this.scale = Math.min(TIERS[this.tier].scale, this.scale + 0.1);
          this._emit('scale');
        } else if (this.tier < this.maxTier) {
          this.tier += 1;
          this.scale = Math.min(this.scale, TIERS[this.tier].scale);
          this._emit('tier');
        }
        this.cooldownUntil = now + 2000;
      }
    } else {
      this.goodWindows = 0;
    }
  }

  force(tier) {
    this.tier = tier;
    this.scale = TIERS[tier].scale;
    this.locked = true;
    this._emit('tier');
  }

  unlock() {
    this.locked = false;
    this.cooldownUntil = performance.now() + 2000;
  }

  _emit(kind) {
    this.onChange?.({ kind, tier: this.tier, scale: this.scale });
  }
}
