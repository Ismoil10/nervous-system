export const meta = {
  name: 'brain-system-analysis-factcheck-r2',
  description: 'Stage 6: fact-check ANALYSIS.md round 2 (four lenses), skeptics refute each lens\'s major issues, one editor revises the document in place',
  phases: [
    { title: 'Check', detail: 'four lenses over ANALYSIS.md (sonnet, high)' },
    { title: 'Verify', detail: 'one skeptic per lens tries to refute its major issues' },
    { title: 'Revise', detail: 'one editor applies confirmed issues to ANALYSIS.md' },
  ],
}

const ROOT = 'C:\\Users\\User\\projects\\nervous-system'
const APP = ROOT + '\\brain-system'
const DOC = APP + '\\research\\ANALYSIS.md'
const DOPA = APP + '\\research\\DOPAMINE.md'
const SCRATCH = 'C:\\Users\\User\\AppData\\Local\\Temp\\claude\\C--Users-User--claude-spares-spare-7RIe5m\\bbf7f24a-a450-4563-b7aa-b8bcef60bc6e\\scratchpad\\stage6'

const CONTEXT = `Project: Brain System (${APP}), a scientific WebGL2 visualisation of a procedural human brain (MNI-152 mm) and a star-built neutral human body, with a whole-body nervous-system simulation. The code is built: src/sim/*.js (kernel, graph, brainnet, sensory, stimuli, somatic, autonomic, enteric, endocrine, immune, scenarios, interventions, orgasm-adapter, runtime), src/body/*.js, src/*.js. Module PARAMS objects cite their owner section (e.g. "§7.8"). The dopamine-during-orgasm model (src/dopamine.js, src/response.js; spec ${DOPA}) is one scenario.
The specification you check is ${DOC} (about 7,060 lines): §1–§13, §14 sources, Appendix A (binding framework contract) and Appendix B (implementation plan). Section starts: §1 L12, §2 L194, §3 L628, §4 L1168, §5 L1725, §6 L2370, §7 L3124, §8 L3569, §9 L4064, §10 L4385, §11 L4683, §12 L5179, §13 L5653, §14 L6260, App. A L6361, App. B L6624. Page through your sections with Read offset/limit; read every part your lens covers. This is fact-check ROUND 2: an earlier round was applied to the document, so concentrate on what is still wrong.
User decisions the document must honour (do not report these as issues): networks = somatic, autonomic, enteric + gut–brain axis, neuroendocrine, neuroimmune; one master switch (brain only ↔ whole body) plus one switch per network, a disabled network drops out and the rest respond; stimuli from a manual panel and scripted scenarios; the orgasm/dopamine model stays as a scenario; brain-only mode runs the §11.14 central form of the orgasm scenario (κ coupling removed, vitals "—"), which overrides older B.5 wording (user decision, 4 Nov 2026); a neutral, non-explicit anatomical body with no genital structures (pelvic anatomy only as schematic nerves/plexuses, bladder and rectum); restrained modulator tints; HUD of collapsible dropdowns without subtitles, working at 375 px; English with British spelling; photosensitivity (≤ 3 flashes/s, large-area changes low-passed, lantern colour ≥ 2,200 K); reduced motion respected; adaptive performance tiers; one project, no build step, no framework, types through JSDoc only.
Rules for you: never read, cite or change anger-galaxy/. Do NOT edit any project file (you are a checker); scratch scripts only under ${SCRATCH}\\<your label>. The project graph gate is active for you: before grepping a camelCase/PascalCase code name run \`graphify explain "<Name>"\` from ${ROOT} (one name per call), and before reading a src/test .js file run \`graphify explain "brain-system/src/<file>.js" | head -5\` so the path is printed; then read only the lines you need. Markdown files (ANALYSIS.md, DOPAMINE.md) and brain-system/raw/ captures are never gated. Never run graphify update/extract/watch. Run Python with PYTHONUTF8=1. Web search is available for literature checks (use mode "standard").`

const ISSUES = {
  type: 'object',
  properties: {
    clean: { type: 'boolean' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          section: { type: 'string' },
          line: { type: 'integer' },
          severity: { type: 'string', enum: ['major', 'minor'] },
          claim: { type: 'string' },
          problem: { type: 'string' },
          evidence: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['section', 'severity', 'claim', 'problem', 'evidence', 'fix'],
      },
    },
    calibrations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          module: { type: 'string' },
          param: { type: 'string' },
          verdict: { type: 'string', enum: ['keep', 'change', 'document'] },
          rationale: { type: 'string' },
          suggested: { type: 'string' },
        },
        required: ['module', 'param', 'verdict', 'rationale'],
      },
    },
  },
  required: ['clean', 'issues'],
}

const VERDICTS = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { index: { type: 'integer' }, real: { type: 'boolean' }, reason: { type: 'string' } },
        required: ['index', 'real', 'reason'],
      },
    },
  },
  required: ['verdicts'],
}

const EDIT_REPORT = {
  type: 'object',
  properties: {
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          section: { type: 'string' },
          what: { type: 'string' },
          before: { type: 'string' },
          after: { type: 'string' },
          numeric: { type: 'boolean' },
        },
        required: ['section', 'what', 'numeric'],
      },
    },
    skipped: {
      type: 'array',
      items: { type: 'object', properties: { section: { type: 'string' }, claim: { type: 'string' }, reason: { type: 'string' } }, required: ['section', 'reason'] },
    },
    sectionsEdited: { type: 'array', items: { type: 'string' } },
  },
  required: ['changes', 'skipped', 'sectionsEdited'],
}

const CALIBRATIONS = `Stage-4 calibrations made in the code, each marked [model], that this round must judge (report them in "calibrations", verdict keep / change / document, with the doc section that should own the value):
- autonomic defence.vag 0.08 → 0.12 (so the hotObject row-12 HR rise = 6.9 bpm);
- autonomic stress.symAdr 0.30 → 0.185 (adrenaline ≈ ×4.0 with autonomic loaded);
- autonomic bulbospinal η 0.20; autonomic spinalRest ρ by SCI phase;
- enteric brakeGain 4 → 16 (≈ 1.77 kcal/min against the §8.13 1.8; the §8.8 B formula gives about 2.9);
- endocrine clock vote uses the relative distance to target (en.gap, threshold 0.08);
- stimuli contact-heat thresholds: cold and warm receptors use 45 °C and 33.5 °C;
- somatic startle recruitment delays: neck 68, shoulder 85, arm 115, leg 150 ms.
Known open model gaps (do not report them as new): RSA 10.5 vs the §7.8 9.4 bpm; §8 conflict between the B formula and the §8.13 1.8 kcal/min (DO judge which is right); SCI autonomic dysreflexia not implemented.`

const LENSES = [
  { key: 'anatomy-render-safety', calib: false, brief: 'Sections §1, §2, §3 and §13 (plus the geometry rows of Appendix A). Every coordinate, extent, route and count: MNI coordinates of brain structures and the §3 additions, the body frame and placement of the MNI head, vertebral levels and nerve exits, plexus and nerve routes, organ positions and sizes, cord length and segment levels, dermatomes, the §2.14 path lengths. Compute what you can in Node (distances along routes, consistency between sections). Then rendering and safety: point budgets, LOD, colours (dopamine amber reserved; CCT/Duv palette), camera values (§13.11), picking and site exclusion rules (no perineal/pelvic-floor sites), photosensitivity (WCAG 2.1 SC 2.3.1 general and red flash thresholds, the 341 × 256 CSS px area at the stated viewing distance, the 3 Hz rule, large-area slew limits), reduced motion, the non-explicit body, species and uncertainty labelling, honest wording about simplifications. Flag wrong sides, impossible routes, numbers that disagree between sections, and threshold misstatements.' },
  { key: 'physiology-neural', calib: true, brief: 'Sections §4, §5 and §6 (signal processing, sensory systems, somatic nervous system). Conduction velocities by fibre class, synaptic and neuromuscular delays, receptor transduction and adaptation, Stevens exponents and psi, sensory latencies at each relay (N20, P30/P37, tibial N22), reflex latencies (patellar, Achilles, withdrawal, blink R1/R2, startle), motor pools, CPGs, the §6.15 lesion presets (SCI levels and phases after Ditunno et al. 2004, nerve section, rhizotomy). Check each value against the literature it cites (web search) and the raw captures in brain-system/raw/; flag misattributed or non-existent citations, wrong species, wrong units and overstated certainty. Judge the stimuli and somatic calibrations listed below.' },
  { key: 'physiology-visceral', calib: true, brief: 'Sections §7, §8, §9 and §10 (autonomic, enteric and gut–brain axis, neuroendocrine, neuroimmune). Heart rate and its intrinsic rate (IHR by age), baroreflex gain and loop, RSA, respiration and chemoreflex, pupil, skin conductance, thermoregulation, bladder; gastric emptying and the §8.8/§8.13 energy-delivery conflict, slow waves, MMC, transit; HPA latencies, cortisol and ACTH kinetics, adrenaline kinetics, RAAS, posterior pituitary; LPS, cytokine and fever time courses, the inflammatory reflex (efferent and contested status). Check each value against the literature it cites (web search) and against brain-system/raw/; flag misattributions, wrong species, wrong units, overstated certainty. Judge the autonomic, enteric and endocrine calibrations listed below, and say which side of the §8 conflict is right.' },
  { key: 'integration-switches', calib: false, brief: 'Section §11 (switches and simulation architecture), §12 (scenarios and validation) and Appendices A and B. Is "brain only" defined precisely, and is each network switch grounded in real lesion physiology (spinal shock, denervation, sympathectomy, vagotomy, heart-transplant denervation, pure autonomic failure, Hirschsprung vs extrinsic denervation, adrenalectomy, hypophysectomy, splenic denervation)? Does what keeps working autonomously match the evidence? Are switch-off outcomes stated consistently across §5–§12 and do two switches compose without contradiction? Are the §11 equations dimensionally correct and unambiguous, the step sizes and clock rules (A.4, §11.7) stable and consistent, the §12 checkpoints and tolerances consistent with the owning sections, and do the numbers in A and B agree with §2–§13? Where the code already implements a rule (via the graph: Kernel, ScenarioPlayer, SimClock, OrgasmAdapter, Runtime), note spec statements the code shows to be impossible or ambiguous.' },
]

const checkPrompt = (l) => `${CONTEXT}

Fact-check lens: ${l.key}.
${l.brief}
${l.calib ? '\n' + CALIBRATIONS + '\n' : ''}
Report each problem with its section, line, severity (major = wrong or misleading, or would make the implementation wrong; minor = imprecise wording, missing nuance or a small numeric slip), the exact claim, the problem, the evidence (source with its URL or raw capture, computation or simulation output) and a concrete fix (replacement text or numbers). Report at most 25 issues, most important first; if you found more, say so in the last one. Set clean=true only if you found nothing major.`

const verifyPrompt = (lens, majors) => `${CONTEXT}

A fact-checker (lens ${lens}) reported the major issues below in ${DOC}. For EACH one, try hard to REFUTE it: read the cited section, check the source, recompute or simulate. real=false if the document is actually correct, if the issue misreads the document, if the proposed fix would be wrong, or if it is only a style preference. real=true only if the document is wrong or misleading as stated AND the fix (or an obvious variant, which you then state) is right. Return one verdict per issue, using its index.

Issues:
${JSON.stringify(majors.map((f, i) => ({ index: i, section: f.section, line: f.line, claim: f.claim, problem: f.problem, evidence: f.evidence, fix: f.fix })), null, 1)}`

const revisePrompt = (confirmed, minor, rejected) => `${CONTEXT}

You are the editor (the only agent allowed to edit, and only ${DOC}). Revise it IN PLACE with the Edit tool. Apply every confirmed major issue below and each minor issue you agree with (skip a minor one only with a reason). Rejected issues are listed so you do not apply them. Keep the structure and section numbers (§1–§14, Appendices A and B), keep each number defined in exactly one owning section and referenced elsewhere, and when a fix changes a number update every place in the document that uses it (search the whole file). Keep the house style: British spelling, value tables with Quantity | Value | Unit | Species | Conf. | Source, [model] tags for model choices. Do not touch the B.5 main.js row's brain-only orgasm wording (user decision). Scratch work only under ${SCRATCH}\\editor.
Return the structured report: every change (section, what, before, after, numeric = true when a numeric value that code might use changed), every skipped issue with its reason, and the list of sections edited.

Confirmed major issues:
${JSON.stringify(confirmed, null, 1)}

Minor issues:
${JSON.stringify(minor, null, 1)}

Rejected issues (do not apply):
${JSON.stringify(rejected.map((r) => ({ section: r.section, claim: r.claim, reason: r.reason })), null, 1)}`

phase('Check')
const perLens = await pipeline(
  LENSES,
  (l) => agent(checkPrompt(l), { label: `check:${l.key}`, phase: 'Check', schema: ISSUES, model: 'sonnet', effort: 'high' }),
  async (res, l) => {
    const issues = ((res && res.issues) || []).map((f) => ({ ...f, lens: l.key }))
    const majors = issues.filter((f) => f.severity === 'major')
    let judged = []
    if (majors.length) {
      const v = await agent(verifyPrompt(l.key, majors), { label: `verify:${l.key}`, phase: 'Verify', schema: VERDICTS })
      const byIdx = new Map(((v && v.verdicts) || []).map((x) => [x.index, x]))
      judged = majors.map((f, i) => { const x = byIdx.get(i); return { ...f, real: x ? x.real : true, reason: x ? x.reason : 'skeptic gave no verdict; kept' } })
    }
    return { lens: l.key, ok: !!res, judged, minor: issues.filter((f) => f.severity === 'minor'), calibrations: (res && res.calibrations) || [] }
  },
)

const ok = perLens.filter(Boolean)
const missing = LENSES.filter((l) => !ok.find((r) => r.lens === l.key && r.ok)).map((l) => l.key)
const judged = ok.flatMap((r) => r.judged)
const confirmed = judged.filter((f) => f.real)
const rejected = judged.filter((f) => !f.real)
const minor = ok.flatMap((r) => r.minor)
const calibrations = ok.flatMap((r) => r.calibrations.map((c) => ({ ...c, lens: r.lens })))
log(`${judged.length} major reported, ${confirmed.length} confirmed, ${rejected.length} refuted; ${minor.length} minor; ${calibrations.length} calibration verdicts; lenses missing: ${missing.join(', ') || 'none'}`)

let edit = null
if (confirmed.length || minor.length) {
  phase('Revise')
  edit = await agent(revisePrompt(confirmed, minor, rejected), { label: 'revise:analysis', phase: 'Revise', agentType: 'general-purpose', schema: EDIT_REPORT })
}

return {
  missing,
  confirmed: confirmed.map((f) => ({ lens: f.lens, section: f.section, line: f.line, claim: f.claim, fix: f.fix, reason: f.reason })),
  rejected: rejected.map((f) => ({ lens: f.lens, section: f.section, claim: f.claim, reason: f.reason })),
  minorCount: minor.length,
  calibrations,
  edit,
}