export const meta = {
  name: 'brain-system-networks',
  description: 'Build the five Brain System network plugins and interventions, then verify and fix them',
  phases: [
    { title: 'Build', detail: 'somatic, autonomic, enteric, endocrine, immune in parallel' },
    { title: 'Assemble', detail: 'interventions, switches, latency tests, kernel needs' },
    { title: 'Verify', detail: 'two skeptics check code against the spec' },
    { title: 'Fix', detail: 'apply confirmed findings, rerun tests and typecheck' },
  ],
}

const ROOT = '/Users/ismoil/projects1/nervous-system'
const SPEC = 'brain-system/research/ANALYSIS.md'

const COMMON = `You work on the Brain System app in ${ROOT} (macOS, Node v26, plain ES modules, no build step). Tests: \`npm test\` (= node --test) from brain-system/; type check: \`npm run typecheck\` (tsc -p ., checks files that start with // @ts-check). Follow CLAUDE.md's graph rules (ask graphify by name before a camelCase search; let a graph answer name a source file before you read it; read only the lines it points to; never run graphify update/extract/watch). Scope brain-system/ only. Project files English, British spelling. Do not commit. Constants in PARAMS objects with § citations, model choices marked [model]. Content: clinical, neutral, non-explicit; no genital structures (A.1).

Binding contracts (read first):
- brain-system/src/sim/contracts.d.ts: Plugin, NodeSpec, EdgeSpec, KernelApi, StimulusRecord, Scenario, Checkpoint, InterventionPreset. Note: declareArray returns nothing; fetch views in init() with k.array(name). graph.paths is a Map. k.events() returns the newest seq.
- The prose plugin contract at the top of brain-system/src/sim/graph.js (lines 14-139): fragment/create/init/settle, k.declare, k.ref(name, fallback) with the A.5 basal value as fallback, k.onLayer, gains g(net) and the §11.13 forms, k.command(t) for the orgasm adapter records, k.input(t) for scenario inputs.
- Existing plugins to imitate: brain-system/src/sim/brainnet.js (id brainnet, order 0, owns the brain fragment and the 21 ports body fragments attach to) and brain-system/src/sim/sensory.js (order 10, receptors). Kernel: brain-system/src/sim/kernel.js. Scenarios and their checkpoints: brain-system/src/sim/scenarios.js (SCENARIOS, evaluate, availability) and brain-system/test/scenarios.test.mjs (how plugins are passed, which checkpoints are todo and which plugin they need).
Spec (Markdown, not gated; grep headings, read ranges): ${SPEC} A.3 naming incl. A.3.4 state variable names (line ~6401), A.4 clocks (6479), A.5 switch semantics (6503), A.6 stimuli (6528), §11 integration (4683-5178: §11.3 masks, §11.10-§11.13 switch execution and gating forms, §11.14 adapter commands), §12 scenarios (5179-5652, §12.20 table), B.11 (6955), B.14 tests (7000), B.15 phases (7018).
Cross-module values are read ONLY through k.ref('<A.3.4 name>', <A.5 basal fallback>) and written only by the module that declares them, so every module works alone and with the others. Use exactly the A.3.4 names.`

const MODULES = [
  { id: 'somatic', order: 20, sec: '§6 Somatic nervous system (lines 2370-3123)', phase: 'B.15 phase 4',
    scope: 'cord, roots and nerves in the graph; dorsal horn, reflex circuits (stretch, withdrawal, crossed extension, Golgi), motor pools, EMG, force, joints, CPGs, limb motion state; the neural part of hotObject and kneeJerk; the §6 interventions as data the interventions module can apply (export a list of cut targets)' },
  { id: 'autonomic', order: 30, sec: '§7 Autonomic nervous system (lines 3124-3568)', phase: 'B.15 phase 5',
    scope: 'heart, vessels, baroreflex loop (carotid sinus and aortic arch afferents in IX and X -> NTS -> CVLM -| RVLM -> IML; NTS -> nucleus ambiguus and DMV), respiration, pupil with the light reflex (retina -> pretectal -> Edinger-Westphal -> ciliary ganglion -> sphincter), SCR, thermoregulation core, bladder; standUp and the autonomic parts of hotObject, loudSound, brightLight; orgasm vitals from the CV layer in switched modes only, read from k.command(t) records { cmdSym, cmdVag, cmdSacral, apnoea, omega } (§11.14; with all networks on the adapter passes legacy vitals through, so your CV layer must not alter that path); the §7 interventions as data' },
  { id: 'enteric', order: 40, sec: '§8 Enteric nervous system and gut-brain axis (lines 3569-4063)', phase: 'B.15 phase 7',
    scope: 'GutModel: ENS segments, motility (MMC, peristalsis), secretion, vagal and spinal afferents, gut hormones on the gut-brain axis; uGut state for rendering; meal; the enteric switch; §8 interventions as data' },
  { id: 'endocrine', order: 50, sec: '§9 Neuroendocrine network (lines 4064-4384)', phase: 'B.15 phase 6',
    scope: 'HPA (CRH, ACTH, cortisol with feedback), SAM (adrenaline, with the adrenal AND edge autonomic+neuroendocrine), posterior pituitary (vasopressin, oxytocin), RAAS, HPT/HPG scalars; full stressor and the RAAS part of standUp; the stress input of the stressor scenario arrives through k.input(t) (see scenarios.js); §9 interventions as data' },
  { id: 'immune', order: 60, sec: '§10 Neuroimmune network (lines 4385-4682)', phase: 'B.15 phase 8',
    scope: 'LPS, cytokines (IL-6 etc.), PGE2, the hypothalamic set point and fever (with autonomic thermoregulation through k.ref), sickness behaviour; infection (its lps control event arrives through Kernel.schedule, see scenarios.js); the inflammatory reflex (efferent route contested per A.8 #16; acetylcholine on alpha7 nicotinic receptors in the spleen); §10 interventions as data' },
]

const BUILD_SCHEMA = { type: 'object', properties: {
  module: { type: 'string' },
  files: { type: 'array', items: { type: 'string' } },
  exports: { type: 'array', items: { type: 'string' } },
  stateNames: { type: 'array', items: { type: 'string' }, description: 'A.3.4 names declared' },
  refs: { type: 'array', items: { type: 'string' }, description: 'A.3.4 names read via k.ref, with fallback' },
  implemented: { type: 'string' },
  deferred: { type: 'string' },
  checkpoints: { type: 'string', description: 'scenario checkpoints now passing, with measured values, and those still todo' },
  kernelNeeds: { type: 'string', description: 'exact changes needed in kernel.js/graph.js/scenarios.js/contracts.d.ts, or none' },
  interventionTargets: { type: 'string', description: 'exported intervention data (name and shape)' },
  tests: { type: 'string', description: 'own test counts and full-suite result' },
}, required: ['module', 'files', 'implemented', 'deferred', 'checkpoints', 'kernelNeeds', 'tests'] }

const FINDINGS_SCHEMA = { type: 'object', properties: {
  findings: { type: 'array', items: { type: 'object', properties: {
    module: { type: 'string' }, file: { type: 'string' }, line: { type: 'number' },
    severity: { type: 'string', enum: ['major', 'minor'] },
    claim: { type: 'string' }, specRef: { type: 'string' }, evidence: { type: 'string', description: 'code lines, spec quote, or a command and its output' },
    fix: { type: 'string' },
  }, required: ['module', 'file', 'severity', 'claim', 'specRef', 'evidence', 'fix'] } },
  checked: { type: 'string', description: 'what was checked and found correct' },
}, required: ['findings', 'checked'] }

phase('Build')
const built = await parallel(MODULES.map((m) => () => agent(`${COMMON}

## Your task: the ${m.id} network plugin (${m.phase})
Write brain-system/src/sim/${m.id}.js starting with // @ts-check, exporting \`plugin\` typed /** @type {import('./contracts').Plugin} */ with id '${m.id}', scope 'body', order ${m.order}, and its fragment attaching to brainnet's ports and nodes. Spec: ${SPEC} ${m.sec}. Scope: ${m.scope}.
Write brain-system/test/${m.id}.test.mjs: the graph builds with [brainnet, sensory, ${m.id}] and alone-with-brain; rest is the steady state after settle; the §12 checkpoints of your scenarios pass within §12 tolerances (use scenarios.js evaluate; if scenarios.test.mjs keeps them todo because it does not pass your plugin, say so in kernelNeeds rather than editing it); switch-off behaviour of your network per A.5 (basal replacement for hormones, denervation for nerves); brain-only mode freezes your body state; determinism (same seed, two frame-rate schedules, max |Δ| = 0).
Files you own: src/sim/${m.id}.js and test/${m.id}.test.mjs ONLY. Four other builders are writing the other network modules in parallel, so the full suite may fail in their files while you work: run your own test file, then the full suite at the end, and report failures outside your files without fixing them. Do not edit kernel.js, graph.js, scenarios.js, contracts.d.ts or any other file; put needed changes in kernelNeeds, exactly. npm run typecheck must report no error in your file.`, { label: `build:${m.id}`, phase: 'Build', schema: BUILD_SCHEMA })))

const ok = built.filter(Boolean)
log(`built ${ok.length}/${MODULES.length}: ${ok.map((b) => b.module).join(', ')}`)
const buildSummary = JSON.stringify(ok, null, 1)

phase('Assemble')
const assembleP = agent(`${COMMON}

## Your task: assemble the network stage
The five network plugins were just written by parallel builders. Their reports (JSON):
${buildSummary}

1. Apply the kernelNeeds the builders listed, minimally and without changing existing behaviour (kernel.js, graph.js, scenarios.js, contracts.d.ts, test/scenarios.test.mjs wiring so that it passes all available plugins). After any kernel change, test/orgasm-regression.test.mjs (goldens), test/determinism.test.mjs and test/dopamine.test.mjs must still pass unchanged; never re-record a golden.
2. Write brain-system/src/sim/interventions.js (// @ts-check): INTERVENTIONS (the §6, §7, §9, §10 intervention presets, using the data each module exports) and apply(kernel, preset), per B.4, B.11 and contracts.d.ts InterventionPreset; it must match the intervention ids the HUD offers in brain-system/src/ui-body.js (INTERVENTIONS there; read it via the graph, do not edit it, report mismatches).
3. Write brain-system/test/switches.test.mjs (every A.5 row on a probe stimulus with all five plugins; every cross-network AND edge, e.g. the adrenal edge; the §12 switch-off matrix), brain-system/test/latency.test.mjs (§4.11 rows on the §2.14 lengths: N20, fingertip -> S1, tibial N22, P30 and P37, patellar, Achilles; analytic overlay vs simulated arrivals; §12.20 rows 1-4 and 47-49), brain-system/test/interventions.test.mjs, and brain-system/test/orgasm-switched.test.mjs (§12.14 switched-mode vitals of the orgasm scenario: with all networks on the vitals equal the legacy vitals() exactly; with a network off the adapter command records drive the autonomic CV layer).
4. Run the full suite and the type check; fix failures in the files you own or the wiring you changed; report anything else precisely.
Return a text report under 450 words: kernel changes made (exact), interventions and their mapping to the HUD ids, test counts per new file, full-suite and typecheck results, open problems with the file and line.`, { label: 'assemble', phase: 'Assemble' })

phase('Verify')
const GROUPS = [
  { id: 'motor-autonomic', mods: ['somatic', 'autonomic'], secs: '§6 (2370-3123) and §7 (3124-3568)' },
  { id: 'gut-endocrine-immune', mods: ['enteric', 'endocrine', 'immune'], secs: '§8 (3569-4063), §9 (4064-4384) and §10 (4385-4682)' },
]
const reviews = await parallel(GROUPS.map((g) => () => agent(`${COMMON}

## Your task: skeptical review of ${g.mods.join(', ')}
Read brain-system/src/sim/${g.mods.join('.js, brain-system/src/sim/')}.js and their tests against ${SPEC} ${g.secs}, A.3.4, A.5 and §11.10-§11.13. Hunt for real defects only: wrong equations or constants against the cited section, wrong signs or units, switch semantics that differ from A.5 (denervation vs basal replacement, AND edges, brain-only freezing), state written by the wrong module or read without the A.5 fallback, non-determinism (Math.random, wall clock, frame-rate dependence), checkpoints that pass for the wrong reason (tolerance widened, value hard-coded), and tests that cannot fail. Before reporting a finding, try to refute it yourself: re-read the spec passage and the code, and where possible run a command that shows it (node -e or a focused test). Report only findings that survive, each with evidence. Do not edit any file. Another agent is concurrently editing kernel.js, interventions.js and new test files; ignore churn there.`, { label: `verify:${g.id}`, phase: 'Verify', schema: FINDINGS_SCHEMA })))
const findings = reviews.filter(Boolean).flatMap((r) => r.findings)
log(`skeptics: ${findings.length} findings (${findings.filter((f) => f.severity === 'major').length} major)`)
const assembled = await assembleP

phase('Fix')
const fixed = await agent(`${COMMON}

## Your task: apply confirmed review findings
Assembler report:
${assembled}

Review findings (JSON; each already survived its finder's own refutation attempt):
${JSON.stringify(findings, null, 1)}

Re-check each finding against the spec and the code before changing anything; skip one you can refute and say why. Fix the rest in the network modules, interventions.js and their tests (not kernel.js unless a finding is about it; never re-record goldens). Then run npm test and npm run typecheck from brain-system/ and fix regressions you caused. Return a text report under 400 words: per finding fixed/skipped with the reason, final test counts (tests/pass/fail/todo) and typecheck result, and anything still open.`, { label: 'fix', phase: 'Fix' })

return { built: ok, assembled, reviews: reviews.filter(Boolean), fixed }
