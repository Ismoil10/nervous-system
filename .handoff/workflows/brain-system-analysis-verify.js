export const meta = {
  name: 'brain-system-analysis-verify',
  description: 'Adversarially fact-check the assembled Brain System ANALYSIS.md (body networks, senses, simulation model), verify each major issue, revise, repeat',
  phases: [
    { title: 'Check', detail: 'six lenses over the assembled document' },
    { title: 'Verify', detail: 'a skeptic tries to refute each major issue' },
    { title: 'Revise', detail: 'one editor applies confirmed issues in place' },
  ],
}

const ROOT = 'C:\\Users\\User\\projects\\galaxy'
const APP = ROOT + '\\brain-system'
const DOC = APP + '\\research\\ANALYSIS.md'
const DOPA = APP + '\\research\\DOPAMINE.md'
const SCRATCH = 'C:\\Users\\User\\AppData\\Local\\Temp\\claude\\C--Users-User-projects-galaxy\\641a402d-336b-4b93-bc5d-2e26265edfd2\\scratchpad'

const CONTEXT = `Project: Brain System (${APP}), a scientific WebGL2 visualization of a procedural human brain in MNI-152 mm made of tiny cool-white neuron "stars" (src/anatomy.js, brain.js, shaders.js, renderer.js, performance.js, camera.js, ui.js, main.js), now being extended to the brain's networks throughout a star-built human body. The dopamine-during-orgasm simulation (src/dopamine.js + src/response.js, spec ${DOPA}) stays as one scenario.
The specification you check is ${DOC}: sections §1–§13, §14 sources and Appendix A (the framework contract the sections were written against). It was drafted by twelve writers in parallel from nine research lenses and has NEVER been fact-checked. It is long: page through it with Read offset/limit (or Grep for headings) until you have read every part your lens covers.
User decisions the document must honour: networks = somatic (spinal cord, 31 spinal and 12 cranial nerve pairs, sensory and motor pathways, reflexes), autonomic (sympathetic chain, parasympathetic incl. vagus; heart, lungs, pupil, viscera), enteric + gut–brain axis, neuroendocrine + neuroimmune (HPA axis, blood-borne hormones, inflammatory reflex); one master switch (brain only ↔ whole body) plus one switch per network, a disabled network drops out of the simulation and the rest respond accordingly; stimuli both from a manual panel (pick a sense, click a body site) and scripted scenarios; the orgasm/dopamine model stays as a scenario; a neutral, non-explicit anatomical star body; modulator tints on source nuclei allowed (restrained, labelled, never on dopamine lanterns); HUD of collapsible dropdowns without secondary subtitles; English only; photosensitivity (≤ 3 flashes/s, large-area changes low-passed, lantern colour ≥ 2,200 K); adaptive performance tiers; it must be built inside the existing single project.
Tools: knowledge graph at ${ROOT}\\graphify-out (CLAUDE.md rule: run \`graphify query "<question>" --budget 2500\` from ${ROOT} before reading code or sources; \`graphify explain\`/\`graphify path\`); the 137 raw Wikipedia captures in ${APP}\\raw are in the graph (semantic nodes included); ANALYSIS.md itself is not, read it directly. Node 24 is available; scratch scripts only under ${SCRATCH}\\verify-<lens>. Web search is available for literature checks.`

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
          severity: { type: 'string', enum: ['major', 'minor'] },
          claim: { type: 'string' },
          problem: { type: 'string' },
          evidence: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['section', 'severity', 'claim', 'problem', 'fix'],
      },
    },
  },
  required: ['clean', 'issues'],
}
const VERDICT = { type: 'object', properties: { real: { type: 'boolean' }, reason: { type: 'string' } }, required: ['real', 'reason'] }

const LENSES = [
  { key: 'anatomy-geometry', brief: 'Every coordinate, extent, route and count: MNI coordinates of brain structures (§2, §4–§8; compare with what src/anatomy.js already has, via graphify), the body frame and its placement of the MNI head (Appendix A, §10), vertebral levels and nerve exits, plexus and nerve routes, organ positions and sizes, cranial nerve nuclei and exits, spinal cord length and segment levels, dermatomes, fibre counts. Compute what you can (e.g. distances along routes vs conduction latencies, organ positions vs body proportions) in Node. Flag wrong sides, structures outside the body/brain, impossible routes, and inconsistent numbers between sections.' },
  { key: 'physiology-numbers', brief: 'The physiology in §3–§8: conduction velocities by fibre class, synaptic and neuromuscular delays, receptor adaptation, sensory latencies at each relay, Stevens exponents, reflex latencies, autonomic response time constants, baroreflex gain, slow-wave frequencies, transit times, HPA latencies and half-lives, adrenaline kinetics, cytokine and fever time courses. Check each against the literature it cites (web search) and against the raw captures; flag misattributed or non-existent citations, wrong species, wrong units, overstated certainty.' },
  { key: 'math-simulation', brief: 'The mathematics (§3) and the simulation model (§9): are the equations dimensionally correct, complete and unambiguous for an implementer; are parameters in §9 the ones defined in §3–§8 (each number owned by one section); is the numerical scheme stable at the stated steps and clocks; does the cost fit a real-time JavaScript frame budget. Independently implement the core of §9 from the TEXT in a Node script — the network graph with event propagation and delays, at least the withdrawal reflex, the pupillary light reflex, the baroreflex on standing, the HPA response to a stressor and the fever course — and reproduce the §9 validation table; report every row you cannot reproduce within ±20 % and every equation you had to guess.' },
  { key: 'switch-semantics', brief: 'The master switch and the per-network switches (Appendix A, §9, §12): is "brain only" defined precisely and sensibly, and is each network switch grounded in real lesion physiology (spinal cord injury and spinal shock, peripheral denervation, sympathectomy, vagotomy, heart-transplant denervation, pure autonomic failure, Hirschsprung disease vs extrinsic denervation of the gut, adrenalectomy, hypophysectomy, splenic denervation)? Does what keeps working autonomously (enteric reflexes, intrinsic heart rate ~100 bpm, local reflexes below a lesion, humoral pathways) match the evidence? Are the scenario outcomes with each switch off stated and consistent across §5–§9 and §11–§12? Do the switches compose (two networks off) without contradictions?' },
  { key: 'design-integration', brief: 'Design, implementability and consistency: does §12 fit the actual current code (read src/main.js, renderer.js, shaders.js, brain.js, anatomy.js, performance.js, camera.js, ui.js, index.html, dopamine.js, response.js — via graphify first) and keep the orgasm/dopamine scenario working; are module boundaries, interfaces, point budgets per tier (on top of the existing 60k–400k brain budget), uniform/attribute budgets (WebGL2: 256 vertex uniform vectors is the assumed floor), camera framings and timings achievable; does the HUD design (§11) follow the dropdown rule; are all user decisions honoured; do numbers agree between sections and with Appendix A; is anything an implementer could not build unambiguously.' },
  { key: 'safety-wording', brief: 'Safety, realism and wording (§1, §11, §13 and every user-facing text): photosensitivity (WCAG 2.1 SC 2.3.1 general and red flash thresholds; travelling pulses and whole-body flashes; the 3 Hz rule; large-area slew limits), colour rules (dopamine amber reserved, low-chroma network colours, colour-vision accessibility), prefers-reduced-motion, non-explicit body and pelvic region, species and uncertainty labelling, disputed findings presented as disputed, no medical advice tone; and whether claims of realism are honest about simplifications (slowed conduction, oversampled structures, schematic routes).' },
]

const checkPrompt = (l, round, prior) => `${CONTEXT}

Fact-check lens: ${l.key} (round ${round}).
${l.brief}
${prior ? `\nThis is a re-check after a revision. The editor's report of what changed in round ${round - 1} is below. Focus on (a) whether those changes are correct and complete, (b) problems the changes introduced, (c) anything major still wrong in your lens. Do not re-report issues that were fixed.\n\nEditor report:\n${prior}\n` : ''}
Report each problem with its section, severity (major = wrong or misleading, or would make the implementation wrong; minor = imprecise wording, missing nuance or a small numeric slip), the exact claim, the problem, the evidence (source, computation or simulation output) and a concrete fix (replacement text or numbers). Set clean=true only if you found nothing major.`

const verifyPrompt = (f, lens) => `${CONTEXT}

A fact-checker (lens ${lens}) reported the issue below in ${DOC}. Try hard to REFUTE it: read the cited section, check the source, recompute or simulate. Answer real=false if the claim in the document is actually correct, if the issue misreads the document, if the proposed fix would be wrong, or if it is only a style preference. Answer real=true only if the document is wrong or misleading as stated AND the fix (or an obvious variant) is right; say which in your reason.

Issue:
${JSON.stringify(f, null, 1)}`

const revisePrompt = (round, confirmed, minor, rejected) => `${CONTEXT}

You are the editor. Revise ${DOC} IN PLACE with the Edit tool (the file exists; do not create other project files; scratch scripts go under ${SCRATCH}\\verify-editor). Apply every confirmed major issue below, and each minor issue you agree with (skip a minor one only with a reason). Rejected issues are listed so you do not apply them. Keep the structure and section numbers §1–§14 and Appendix A; keep each number defined in exactly one section and referenced elsewhere; when a fix changes a number, update every place that uses it (search the whole document). If you change any equation or parameter of §9, re-run your own Node prototype and update the validation table. Return a concise report: per issue what you changed (section and the new text or numbers) or why you skipped it, plus the list of sections you edited.

Round ${round}.
Confirmed major issues:
${JSON.stringify(confirmed, null, 1)}

Minor issues:
${JSON.stringify(minor, null, 1)}

Rejected issues (do not apply):
${JSON.stringify(rejected.map((r) => ({ section: r.section, claim: r.claim, reason: r.reasons })), null, 1)}`

const rounds = []
let prior = null
for (let round = 1; round <= 2; round++) {
  phase('Check')
  const perLens = await pipeline(
    LENSES,
    (l) => agent(checkPrompt(l, round, prior), { label: `check:${l.key}:r${round}`, phase: 'Check', schema: ISSUES }),
    async (res, l) => {
      const issues = ((res && res.issues) || []).map((f) => ({ ...f, lens: l.key }))
      const majors = issues.filter((f) => f.severity === 'major')
      const verdicts = await parallel(majors.map((f) => () => agent(verifyPrompt(f, l.key), { label: `verify:${l.key}:${f.section}`.slice(0, 60), phase: 'Verify', schema: VERDICT })))
      const judged = majors.map((f, i) => ({ ...f, real: verdicts[i] ? verdicts[i].real : true, reasons: verdicts[i] ? verdicts[i].reason : 'verifier failed; kept' }))
      return { lens: l.key, judged, minor: issues.filter((f) => f.severity === 'minor') }
    },
  )
  const ok = perLens.filter(Boolean)
  const judged = ok.flatMap((r) => r.judged)
  const confirmed = judged.filter((f) => f.real)
  const rejected = judged.filter((f) => !f.real)
  const minor = ok.flatMap((r) => r.minor)
  log(`round ${round}: ${judged.length} major reported, ${confirmed.length} confirmed, ${rejected.length} refuted; ${minor.length} minor; lenses missing: ${LENSES.filter((l) => !ok.find((r) => r.lens === l.key)).map((l) => l.key).join(', ') || 'none'}`)
  const entry = { round, confirmed, rejected: rejected.map((r) => ({ lens: r.lens, section: r.section, claim: r.claim, reason: r.reasons })), minorCount: minor.length, report: null }
  rounds.push(entry)
  if (!confirmed.length && !minor.length) break
  phase('Revise')
  entry.report = await agent(revisePrompt(round, confirmed, minor, rejected), { label: `revise:r${round}`, phase: 'Revise', agentType: 'general-purpose' })
  prior = entry.report
  if (!confirmed.length) break
}
return { rounds }
