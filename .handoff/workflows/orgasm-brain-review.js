export const meta = {
  name: 'orgasm-brain-review',
  description: 'Multi-lens review of the Orgasm Brain code against its analysis, adversarial verification of each finding, then fixes',
  phases: [
    { title: 'Review', detail: 'four independent lenses over the code' },
    { title: 'Verify', detail: 'two skeptics try to refute each finding' },
    { title: 'Fix', detail: 'one agent applies the confirmed fixes and re-checks' },
  ],
}

const ROOT = 'C:\\Users\\User\\projects\\galaxy'
const APP = ROOT + '\\orgasm-brain'
const CONTEXT = `Project: Orgasm Brain (${APP}), a plain-ES-module WebGL2 visualization (no build step): a procedural human brain in MNI space made of cool-white neuron "stars", with released dopamine drawn as warm amber lantern glow, simulating dopamine activity across the sexual response cycle and orgasm. Code: ${APP}\\src\\{main,dopamine,response,anatomy,brain,shaders,renderer,color,performance,camera,gl-utils,ui}.js, ${APP}\\index.html, ${APP}\\style.css. The specification is ${APP}\\research\\ANALYSIS.md (the dopamine system, the mathematical model, brain geometry, visual mapping, implementation targets, safety rules). response.js is the physiological driver copied from the sibling ${ROOT}\\orgasm-galaxy (its constants follow the implemented code, which differs from the later-revised orgasm-galaxy/research/ANALYSIS.md §7 — that divergence is known and out of scope here). dopamine.js follows the model prototype in the analysis (seven cell groups VTA-lateral, VTA-medial, SNc, A11–A14; nine terminal fields; Michaelis–Menten uptake; Montague release plasticity; D1/D2/autoreceptor binding; TD prediction error; modulators prolactin, GABA, μ-opioid, lateral-hypothalamic serotonin, oxytocin; two post-orgasm hypotheses).
Known, intentional design choices (do not report as bugs unless undocumented or inconsistent): impulse travel along the fibres is slowed to 0.5 s for visibility; firing is shown as a rate-coded twinkle capped at 3 Hz, never as real spikes; cortical dopamine glow is boosted relative to its true terminal density for legibility; MNI-space brain volume (~1.4 L) is larger than an average brain because the MNI template is; _dev.html is a temporary test page and will be deleted.
Workspace rule (CLAUDE.md): before searching the code, run \`graphify query "<question>"\` from ${ROOT} (the brain code is in the graph), then read the files it points to. Node 24 is available: \`node --check <file>\` and \`node --input-type=module -e "await import('file:///…')"\` work for every module except main.js and ui.js (DOM). response.js + dopamine.js run headless: new ResponseModel(), m.onStep = (h) => d.step(h, m), then m.update(1/30) repeatedly and d.updateVisuals(1/30, m, kh), d.readouts(), d.modulators(m). anatomy.js and brain.js also run headless (generateBrain({neurons, da:{soma, axon, vari, total}})).
Report only real problems with a concrete failure scenario; no style nits.`

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          title: { type: 'string' },
          scenario: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['file', 'severity', 'title', 'scenario', 'fix'],
      },
    },
  },
  required: ['findings'],
}
const VERDICT = {
  type: 'object',
  properties: { real: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['real', 'reason'],
}

const LENSES = [
  { key: 'model-fidelity', brief: 'Does dopamine.js implement the mathematical model of ANALYSIS.md faithfully: every equation, parameter value and unit, the calibration of q_j to C0, the exact-exponential substepping, receptor kinetics, autoreceptor and KOR terms, the TD prediction error (value feature, train kernel, learning, reset), modulator gains, TIDA, the two post-orgasm hypotheses, and the coupling to response.js (which state it reads, when; the onStep hook in response.js update())? Simulate in Node over full demo cycles and several profiles and compare with every validation target the analysis states (tonic and phasic concentrations, ratios, peak timings, clearance half-times, D1/D2 occupancy, post-orgasm behaviour). Also check the visual mapping in dopamine.updateVisuals and the imaging-based activity map against the analysis.' },
  { key: 'render-correctness', brief: 'Rendering correctness: point record layouts written by brain.js vs attribute use in shaders.js (12 floats: a0, a1, a2 per kind — neurons, dopamine somata/axons/varicosities, lanterns), region indices vs uniform arrays (REGION_COUNT, uRegion/uTint/uDA vec4 packing, uPathHist indexing with PATH_HIST and PATH_COUNT), uniform names set in renderer.js vs declared/used (and the vertex-uniform-vector budget of 256), GLSL ES 3.00 validity and NaN sources (division by zero, log2 of 0, normalize of zero vectors), tissuePath maths and the cutaway plane, the medial-wall grazing fade, draw ranges vs tier counts after shuffling (prefix subsampling must stay uniform per population), gains per tier, bloom chain and composite, camera fovEff and zoom compensation.' },
  { key: 'anatomy-realism-safety', brief: 'Anatomy, realism and safety: every MNI coordinate, extent and pathway control point in anatomy.js against the tables in ANALYSIS.md (and plausibility: correct side, inside the brain, structures not overlapping wrongly); region assignment (corticalRegion, NAcc core/shell split); point budgets vs the analysis; colours (neurons 7,000–9,500 K, dopamine 2,300 K, never below 2,200 K; modulator tints low-chroma); photosensitivity rules (no more than 3 flashes/s, large-area changes low-passed with τ ≥ 0.3 s, cerebellar folia contrast ≤ 30 %, no regular high-contrast gratings), prefers-reduced-motion handling; clinical non-explicit wording in index.html, ui.js, response.js PHASES and README; the HUD contract between main.js and ui.js (every payload field rendered, handlers wired, keyboard, focus and inert handling, 375 px layout).' },
  { key: 'perf-robustness', brief: 'Performance and robustness: per-frame allocations or O(n) work in main.js, dopamine.js (updateVisuals, readouts, modulators, forEach closures), ui.js; the cost of dopamine.step at large human clock factors (recovery phase kh can be hundreds — count substeps per frame); guards against dt = 0 or huge dt, NaN propagation, time going backwards; pause/resume, Reset mid-phase, profile/hypothesis/view/quality changes mid-cycle, quality regeneration (replaceBrain) and the da budget per tier, window resize, hidden tab, WebGL limits (point size, uniform vectors), generation time of generateBrain at the ultra tier and the cached surface grids.' },
]

phase('Review')
const confirmed = await pipeline(
  LENSES,
  (l) => agent(`${CONTEXT}\n\nReview lens: ${l.key}.\n${l.brief}\n\nReturn every real problem you can demonstrate.`, { label: `review:${l.key}`, phase: 'Review', schema: FINDINGS }),
  async (res, l) => {
    const findings = (res && res.findings) || []
    const judged = await parallel(findings.map((f) => () => parallel([0, 1].map((i) => () => agent(`${CONTEXT}\n\nA reviewer (lens ${l.key}) reported the finding below. Try hard to REFUTE it: read the code, run Node checks or simulations where possible. Default to real=false if the scenario cannot actually happen, is an intentional documented choice, or is only a style preference. ${i === 1 ? 'Focus on whether the proposed fix would itself break something.' : ''}\n\nFinding:\n${JSON.stringify(f, null, 1)}`, { label: `verify:${l.key}:${f.title.slice(0, 30)}:${i}`, phase: 'Verify', schema: VERDICT })))
      .then((vs) => ({ ...f, lens: l.key, votes: vs.filter(Boolean).map((v) => v.real), reasons: vs.filter(Boolean).map((v) => v.reason) }))))
    return judged.filter(Boolean)
  },
)
const all = confirmed.filter(Boolean).flat()
const real = all.filter((f) => f.votes.filter(Boolean).length >= 2 || (f.severity === 'high' && f.votes.some(Boolean)))
log(`findings: ${all.length}, confirmed: ${real.length}`)

phase('Fix')
let fixReport = null
if (real.length) {
  fixReport = await agent(`${CONTEXT}\n\nApply fixes for the confirmed findings below, in place, keeping the existing code style and comment density (English). Do not change the intentional design choices listed above. After editing, run \`node --check\` on every changed .js file, re-import each headless module in Node, and re-run a Node simulation of response.js + dopamine.js over a full demo cycle (tonic NAcc ≈ 15 nM at rest, orgasm reached at ≈ 45–55 s of screen time, back to baseline at ≈ 120–130 s) and a generateBrain call at the high tier. If you change ANALYSIS.md-backed numbers, keep the analysis and the code consistent. Return a short list of what you changed per finding (or why you skipped one).\n\nConfirmed findings:\n${JSON.stringify(real.map(({ votes, ...f }) => f), null, 1)}`, { label: 'fix', phase: 'Fix', agentType: 'general-purpose' })
}

return { total: all.length, confirmed: real.map(({ reasons, ...f }) => f), rejected: all.filter((f) => !real.includes(f)).map((f) => ({ title: f.title, lens: f.lens, reasons: f.reasons })), fixReport }
