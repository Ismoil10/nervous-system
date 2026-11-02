export const meta = {
  name: 'brain-system-dopamine-verify',
  description: 'Adversarially fact-check Brain System research/DOPAMINE.md, the orgasm-scenario spec (never checked as a file), verify each major issue, revise, repeat',
  phases: [
    { title: 'Check', detail: 'four lenses over the saved file' },
    { title: 'Verify', detail: 'a skeptic tries to refute each major issue' },
    { title: 'Revise', detail: 'one editor applies confirmed issues in place' },
  ],
}

const ROOT = 'C:\\Users\\User\\projects\\galaxy'
const APP = ROOT + '\\brain-system'
const DOC = APP + '\\research\\DOPAMINE.md'
const GAL = ROOT + '\\brain-system\\research\\RESPONSE.md'
const SCRATCH = 'C:\\Users\\User\\AppData\\Local\\Temp\\claude\\C--Users-User-projects-galaxy\\641a402d-336b-4b93-bc5d-2e26265edfd2\\scratchpad'

const CONTEXT = `Project: Brain System (${APP}; renamed today from "Orgasm Brain", folder renamed from orgasm-brain/, so older text may still say orgasm-brain — that is expected), a WebGL2 visualization of a procedural human brain (MNI-152 mm) made of cool-white neuron "stars". It is being extended to the brain's networks throughout a star-built human body (separate spec research/ANALYSIS.md, being written now — not your concern). The dopamine-during-orgasm simulation, with dopamine release drawn as warm amber lantern glow, is now ONE SCENARIO of Brain System. Clinical, non-explicit tone.
The specification of that scenario is ${DOC} (sections 1–11, ~1,700 lines; its section numbers are cited by the code as "research/DOPAMINE.md §n"). History: a synthesis agent drafted it but could not save it; a reviser restored the draft from a transcript and applied one round of fact-check fixes. The file as saved has NEVER been fact-checked; that is your job. Its §6.7 declares the corrected equations of ${GAL} §7.2–§7.9 to be the one canonical whole-body response model that brain-system/src/response.js must be ported to; those galaxy sections were themselves revised and their last revision was not re-verified, so check them too where the brain document depends on them. §9.8 lists how the current code (${APP}\\src\\*.js, index.html, README.md) diverges from the text.
User decisions that override the document: (1) the user explicitly chose "dopamine plus modulators (prolactin, GABA, opioids, serotonin acting on dopamine), shown in the model and in the HUD", so the existing low-chroma modulator tints on the modulators' source nuclei (pituitary rose, raphe violet, RMTg/VTA teal, PAG/arcuate sage; never on dopamine lantern glows) are kept; any text saying modulators have no colour ("uTint is set to zero", "Avoid … colours for modulators") conflicts with the user and must be rewritten to describe restrained, labelled tints on source nuclei (still never on lanterns, never saturated, legend says they mark modulator activity, not dopamine). (2) HUD: collapsible dropdowns, no secondary subtitles. (3) English only in project files. (4) Photosensitivity safety and lantern colour ≥ 2,200 K.
Tools: the brain CODE is in the knowledge graph (CLAUDE.md rule: run \`graphify query "<question>"\` from ${ROOT} before searching code); DOPAMINE.md has only heading nodes in the graph, read it directly (use Grep/Read with offsets, it is long). Raw Wikipedia captures are in ${APP}\\raw and ${ROOT}\\orgasm-galaxy\\raw (in the graph). Node 24 is available; write scratch scripts only under ${SCRATCH} (e.g. a subfolder named after your lens). The previous reviser's scripts are there (rm74.mjs, da_v2.mjs, v2run.mjs, e1–e10.mjs) — you may read them, but numbers you report must come from your own independent check. Web search is available for checking literature claims.`

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
  { key: 'neuroanatomy-geometry', brief: 'Sections §2 and §7 (and the anatomy rows of §9.2, §9.8): every MNI coordinate, extent, volume, cell count and proportion, pathway route and control point (§7.6), the point budget (§7.4–§7.5) and the recommended geometry changes (§7.3). Check against the raw captures (graphify), atlas knowledge (MNI/Harvard-Oxford/Keuken et al. 2014 SN/STN atlas, Pauli et al. 2018 subcortical atlas), and by computing volumes and positions from anatomy.js/brain.js in Node. Flag sides, structures outside the brain hull, overlapping structures, wrong volumes, and recommendations that would make the geometry worse.' },
  { key: 'kinetics-math', brief: 'Sections §3 and §6 (and §9.3, §9.6): the physiology numbers (firing, release, Michaelis–Menten uptake, diffusion, receptor kinetics, concentrations) against the literature they cite; the equations of §6.4 for internal consistency, units and dimensional correctness, parameter table §6.5 matching the equations, the integration scheme §6.8, and the closed loop §6.7 (D = clamp(0.2 + 1.6·(C̄_shell/C0 − 1))). Independently implement the §6.4 dopamine model plus the corrected galaxy response model (§6.7 table, galaxy §7.2–§7.9) in a Node script from the TEXT and reproduce the §6.9 validation table and §9.6 timeline; report every row your simulation does not reproduce within ±20 % (rows 3, 19, 21 exact), every equation that is ambiguous or underspecified for an implementer, and any instability.' },
  { key: 'evidence-wording', brief: 'Sections §1, §4, §5, §9.5, §9.9, §10, §11: does every cited study exist and say what is claimed (author, year, species, sex, method, magnitude, time course)? Use web search. Are disputed findings presented as disputed (prolactin and refractoriness, TIDA withdrawal, Fiorino vs Lorrain, pre-climax ramp, pulse-locked dopamine, MPOA in humans, PET VTA resolution)? Are user-facing phase texts (§9.9) accurate, species-tagged, neutral and non-explicit? Are the photosensitivity rules (§10) a correct reading of WCAG 2.1 SC 2.3.1 and the cited epilepsy literature, and is the colour claim (R/(R+G+B) at 1,900/2,200/2,300 K, linear sRGB from a Planck locus) numerically right (compute it)?' },
  { key: 'design-consistency', brief: 'Whole-document consistency and implementability: the §6.7 port table against the actual corrected equations in the galaxy document §7.2–§7.9 (every constant and rule); §9.8 against the actual current code (read the files: is each "current code" cell true, is any divergence missing?); §9.1 interfaces against how main.js/response.js/dopamine.js are actually wired (onStep hook, update loop, updateVisuals) — prefer keeping existing method names and fixing the text when only names differ; cross-references between sections (numbers that disagree between §4.8, §6.9, §9.6, §9.9); conflicts with the user decisions listed in the context (modulator tints especially); anything an implementer could not build unambiguously.' },
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

You are the editor. Revise ${DOC} IN PLACE with the Edit tool (the file exists; do not create other project files; scratch scripts go under ${SCRATCH}). Apply every confirmed major issue below, and each minor issue you agree with (skip a minor one only with a reason). Rejected issues are listed so you do not apply them. Keep the structure and section numbers §1–§11 (the code cites them), keep the conventions (evidence tags, species, confidence), keep §9.8 (reconciliation table) and §9.9 (phase texts) in step with every change, and make the user decisions in the context hold everywhere in the text (rewrite the modulator-colour statements accordingly in §1, §5, §8, §9.1, §10 and anywhere else). If you change any equation or parameter, re-run your own Node simulation of the §6.4 model coupled to the corrected response model and update every affected number in §6.9, §9.6, §4.8 and §9.9. Return a concise report: per issue what you changed (section and the new text or numbers) or why you skipped it, plus the list of sections you edited.

Round ${round}.
Confirmed major issues:
${JSON.stringify(confirmed, null, 1)}

Minor issues:
${JSON.stringify(minor, null, 1)}

Rejected issues (do not apply):
${JSON.stringify(rejected.map((r) => ({ section: r.section, claim: r.claim, reason: r.reasons })), null, 1)}`

const rounds = []
let prior = null
for (let round = 1; round <= 3; round++) {
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
  log(`round ${round}: ${judged.length} major reported, ${confirmed.length} confirmed, ${rejected.length} refuted; ${minor.length} minor`)
  const entry = { round, confirmed, rejected: rejected.map((r) => ({ lens: r.lens, section: r.section, claim: r.claim, reason: r.reasons })), minorCount: minor.length, report: null }
  rounds.push(entry)
  if (!confirmed.length && !minor.length) break
  phase('Revise')
  entry.report = await agent(revisePrompt(round, confirmed, minor, rejected), { label: `revise:r${round}`, phase: 'Revise', agentType: 'general-purpose' })
  prior = entry.report
  if (!confirmed.length) break
}
return { rounds }