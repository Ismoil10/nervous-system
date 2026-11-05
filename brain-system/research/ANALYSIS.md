# Brain System — the brain, its internal systems and its networks throughout the body: analysis and design rationale

Status: specification for extending Brain System from a brain-only dopamine visualization to the brain's
networks throughout a star-built human body (somatic, autonomic, enteric, neuroendocrine and neuroimmune),
with every sensory input, a master switch (brain only ↔ whole body) and one switch per network. Written
before that code. The dopamine-during-orgasm model is one scenario; its specification is
[DOPAMINE.md](DOPAMINE.md). Assembled from section drafts written in parallel against one framework
contract (Appendix A); assembled, fact-check in progress (round 1 applied). Date: 2026-10-31.

---

## 1. Purpose, scope and conventions

### 1.1. Status

This is the specification of the whole-body extension of Brain System, written before the extension's code. The project was renamed from "Orgasm Brain" on the document date (`brain-system/index.html` L7, L20). Nine analysis lenses supplied the material. Appendix A is the binding writer contract and wins over any section that disagrees with it until the contract is revised; Appendix B is the implementation plan. This document is canonical for every quantity that is not a dopamine quantity; `research/DOPAMINE.md` stays canonical for every dopamine quantity and for the internals of the orgasm scenario (§1.8). Where `src/` differs from this text, the text is canonical and §11 lists the reconciliation. Every number carries a source, a species tag and a confidence, or the tag [model]. Date: 2026-10-31.

### 1.2. The request, restated

The user asked for a model of the nervous system's biological networks as they are distributed through the human body, preceded by an analysis of the brain's internal systems, its signal processing and its responses to input from every sense. The model lives inside the existing single project. Its body networks are layers that are switched on and off and modified at run time, so that the same human model can be simulated with and without its biological systems. The existing simulation, in which dopamine release during the sexual response cycle is driven by a whole-body response model and drawn as warm amber lantern glow among cool-white neuron stars, remains as one scenario among several.

The document follows that order. Analysis: reference geometry (§2), brain systems (§3), signal processing (§4), the ten senses (§5). Networks: somatic (§6), autonomic (§7), enteric and gut–brain axis (§8), neuroendocrine (§9), neuroimmune (§10). Model: integration and switches (§11), scenarios and validation (§12), rendering, HUD, performance and safety (§13). Sources: §14.

| # | User decision | Realised as | Where |
|---|---|---|---|
| 1 | Somatic, autonomic, enteric (gut–brain axis), neuroendocrine and neuroimmune networks | Five switchable networks; three layers never switched (`cns`, `special`, `tissue`) | A.3.1; §6–§10 |
| 2 | One master switch plus one switch per network; the remaining systems respond | `bodyMode`, `net.<id>`, ramped gain `g.<id>`; AND edges; lesions as interventions | A.5; A.8 #3, #4, #9; §11 |
| 3 | Manual stimulus panel and scripted scenarios | One stimulus record and receptor model; nine core scenarios | A.6; A.3.5; §5; §12 |
| 4 | Orgasm–dopamine model kept as a scenario | Scenario `orgasm` behind the §11 adapter | §1.8; §11 |
| 5 | Neutral, clinical, non-explicit star figure | Content rules; a mannequin without sex characteristics, on male reference proportions | §1.10; §2; §13 |
| 6 | Modulators as restrained low-chroma tints on source nuclei | Tint palette and legend | §13; DOPAMINE.md §1 |
| 7 | HUD of collapsible dropdowns, no secondary subtitles | Dropdown set of A.7 | §13 |
| 8 | English only in project files | British English, as in DOPAMINE.md | §1.9 |
| 9 | Photosensitivity safety; lantern colour ≥ 2,200 K | Photosensitivity limiter | A.9; §13; DOPAMINE.md §10 |
| 10 | Hardware-aware performance | Adaptive tiers; a budget overrun slows the clock (the kernel stops at a step boundary and the clock commits the time reached), never the step size | A.4; §11; §13 |

### 1.3. Modelling stance

- **One causal graph, read out visually.** A star brightens only when the rate of its node rises; an organ changes only when its effector state changes (§13).
- **Signals travel.** A stimulus reaches the brain only along modelled afferent pathways, delayed by path length over conduction velocity plus synaptic delays (§2, §4); responses return along efferent pathways. Brain and body share one frame (A.2), so no transform can hide a delay.
- **Rate units with event packets**, not spiking neurons (§4; sizes §11). Stars sample populations, and the HUD says how many neurons one star stands for (§13).
- **A switch lesions a whole system.** Off removes drive; neural targets relax to denervated behaviour and blood hormones to basal replacement, never zero (A.5; A.8 #9). The response of the remaining systems emerges from the model and is not scripted per switch.
- **A reference subject, not a person.** Healthy-adult means (§2, §7); variation only through declared parameters (`age`, `posture`, scenario inputs).
- **Two clocks.** Physiology in human time tH; display and safety limits in screen time tS; slow motion and fast-forward always labelled (A.4).
- **Human data first** [model]. Precedence when sources disagree: human, non-human primate, cat or dog, rodent; squid only for the Hodgkin–Huxley inspector (§4). Animal latencies are recomputed from human path lengths and velocities, never copied.
- **Stimuli are represented, not reproduced.** No audio; no screen brightening beyond §13 limits; pain shown as signal flow (A.6; A.8 #23).

### 1.4. Scope

| Layer (id) | What is modelled | Switching | Owner |
|---|---|---|---|
| Brain (`cns`) | Everything above the cervicomedullary junction (A.2): thalamocortical system, cortical areas, basal ganglia and cerebellar loops, limbic system, hypothalamus and circumventricular organs, brainstem centres, ascending modulators, arousal and sleep, salience, the dopamine model | Never | §3; DOPAMINE.md |
| Special senses (`special`) | Retina and optic nerve, cochlea, vestibular labyrinth, olfactory epithelium, gustatory fibres of VII, IX, X to their first central station | Never; kept in brain only | §5 |
| Five networks (`somatic`, `autonomic`, `enteric`, `neuroendocrine`, `neuroimmune`) | As in §1.7 and A.3.1 | One switch each | §6–§10 |
| Body tissue (`tissue`) | SA node, interstitial cells of Cajal, muscle, organs, blood, kidney, peripheral immune cells | Whenever `bodyMode = 'body'` | §7, §8, §10 |

### 1.5. Exclusions

| Not modelled | Reason | Nearest proxy |
|---|---|---|
| Genital structures, explicit depiction | User decision 5 | Schematic pelvic nerves, bladder, rectum, unlabelled pelvic-floor field (§2, §13) |
| Spiking neurons at true counts | Not computable at frame rate | Rate units; Hodgkin–Huxley and LIF inspectors (§4) |
| Molecular signalling, plasticity, learning | Outside the request | Habituation, predictive coding (§4, §5); dopamine prediction error (DOPAMINE.md §6) |
| Adaptive immunity, chronic inflammation, pathogens | Not a neural network | Acute innate response to endotoxin (§10) |
| Full metabolism, fluid balance, gas exchange | Outside the request; hypoxia would spread everywhere (A.8 #8) | Relative scalars (§8, §9); gases clamped (§6, §7) |
| Gait, balance control, trunk or pelvic motion | Legibility, reduced motion, non-explicit rule | Minimal rigid limb motion (A.8 #22) |
| Disease, drugs, injury beyond presets | Outside the request | Interventions (A.5; §11) |
| Development, sex differences, subjective experience | One reference subject; not measurable | `age`; perceived magnitude `psi` (§5) |
| Sound output, real flashes | Safety (A.8 #23) | Symbolic display (§13) |

### 1.6. The two modes

**Brain only (`bodyMode = 'brain'`).** The brain renders exactly as the post-port build (the DOPAMINE.md §9.8 port, including its §7.3 geometry, applied in Phase 0a, B.15) apart from the new nuclei, cortical areas and geometry splits of §3 and §13, and the body is frozen and hidden. All CNS dynamics keep running: the rate graph, the arousal and sleep state machine, the SCN, the fictive respiratory rhythm, tonic sympathetic premotor drive, hypothalamic and pituitary commands and the dopamine model. Commands addressed to the body leave the brain ports (§3) as "efference only" packets that fade at the port. The special senses stay, injected at their first central station: the retina, optic nerve and olfactory bulb are CNS, and hearing, balance and taste, whose receptors and ganglia are peripheral, are kept by design (A.8 #5). The manual panel therefore offers only vision, hearing, smell, taste and balance (A.6). Blood-borne inputs to the brain are clamped at basal on a life-support assumption, and the body vitals show "—" (A.5; A.8 #10). Scenarios run in a central form or are greyed (A.3.5). The mode is only a partial analogue of the encéphale isolé (Bremer 1935, C [unverified]): the cut is at the same level, but that preparation keeps all cranial-nerve input, whereas this mode silences every afferent channel except the special senses.

**Whole body (`bodyMode = 'body'`).** This is the default at first load: all five networks on, with the orgasm scenario playing in demo mode on the Dopamine system view (A.7; user decision, 5 November 2026); `?scenario=none` opens at rest on the "Upper body" view. The star figure (§2, §13) appears around the unchanged brain in the same frame (A.2); cord, nerves, ganglia, organs, gut and vessels are simulated, the `tissue` layer runs, stimuli can be applied at body sites and the vitals are live. Switching to brain only freezes and hides the body, and switching back resets body states to the resting steady state (A.5).

### 1.7. The five networks

**Somatic (§6).** Spinal and trigeminal afferents for touch, pain, temperature and proprioception; α and γ motor neurons; the somatic and branchiomotor components of the cranial nerves; phrenic and intercostal output; somatic cord tracts and spinal motor circuits including pattern generators. §6 describes all 31 spinal and 12 cranial nerve pairs, and each cranial nerve is switched by functional component, so its autonomic and special components follow their own layers (A.8 #6). With the network off, body-surface touch, pain, temperature and proprioception produce no central or autonomic response, somatic reflexes vanish, motor commands become efference only, and ventilation is maintained at the central rhythm by model assumption (A.8 #8).

**Autonomic (§7).** Extrinsic sympathetic and parasympathetic outflow from bulbospinal premotor axons through preganglionic neurons and ganglia to postganglionic fibres, plus every visceral afferent, including the baroreceptor fibres that reach the NTS in IX and X ([G Baroreflex L35]); interoception therefore depends on this network (A.8 #7). Effectors are the heart, vessels, airways, pupils, glands, viscera, bladder and brown fat. With the network off, the heart runs at its intrinsic rate (§7; A.8 #11), the pupils are fixed at the denervated diameter (§7), baroreflex and chemoreflex loops open, interoceptive stimuli produce nothing central, and RAAS restores part of the blood pressure over minutes if the neuroendocrine network is on.

**Enteric (§8).** The myenteric and submucosal plexuses. ICC slow waves and enteroendocrine release belong to `tissue` and continue when the network is off. With it off, the peristaltic reflex, MMC and secretomotor reflexes stop, sphincters close and transit stalls, as in achalasia and Hirschsprung disease; these states are shown quietly.

**Neuroendocrine (§9).** Hypophyseal portal transport, anterior and posterior pituitary release, adrenal cortical and medullary hormone action, RAAS, the distant actions of gut hormones, HPT and HPG as scalars, prolactin and TIDA through DOPAMINE.md, and hormone entry to the brain. With the network off, hypothalamic neurosecretory neurons still compute their commands (shown as tints), but blood hormones relax to basal and are clamped there: no cortisol or adrenaline surge, no RAAS rescue and no cortisol brake on cytokines.

**Neuroimmune (§10).** Immune–nervous coupling in both directions: vagal and humoral immune-to-brain routes, cytokine action on the PVN, the inflammatory reflex (efferent route contested; A.8 #16), splenic sympathetic action, glucocorticoid action on immune cells, the fever set-point shift and sickness behaviour. With the network off, the peripheral innate response continues as tissue, cytokines run higher and longer because both brakes are lost, and there is no fever and no sickness behaviour.

Some couplings need several networks on at once (AND edges, A.5): adrenal adrenaline needs autonomic and neuroendocrine, the inflammatory-reflex efferent autonomic and neuroimmune, vagal control of gut muscle autonomic and enteric. Named lesions are interventions, not sub-switches (A.8 #4; §11).

### 1.8. Relation to DOPAMINE.md and the galaxy response model

- **Canonical sources.** DOPAMINE.md is canonical for every dopamine quantity (its §2–§9), the orgasm scenario's internals and their sources (its §11). `RESPONSE.md` §7.4–§7.9 is the project's one canonical response model; DOPAMINE.md reads it and writes back only the dopaminergic drive (DOPAMINE.md conventions; §6.7). `src/response.js` still carries pre-correction constants and must be ported (DOPAMINE.md §6.7, §9.8). This document cites both files by section and never restates or changes their values.
- **Place and regression.** The simulation becomes scenario `orgasm`, HUD label "Orgasm – dopamine" (A.3.5), run through the §11 adapter, which maps the internal names of `response.js` (A.3.4). With all networks on it reproduces exactly the traces of the legacy path of the same commit (A.8 #21; B.13): before the DOPAMINE.md §9.8 port that is the frame-driven `update(dt)` loop, and from the port onward (Phase 0a, B.15) the ported model on the DOPAMINE.md §9.3 human-time grid (§11.14). The DOPAMINE.md §6.9 and §9.6 targets apply after the port, when the references are recorded again (§12.13). Brain only runs the central form of §11. With the neuroendocrine network off, prolactin and oxytocin are clamped at basal and the TIDA loop is frozen (A.5); the §12 matrix gives every other switch outcome.
- **Display.** DOPAMINE.md §1 (tone) and §10 rule 7 admit the neutral star-built body network of this document, but rule 7 also states that the dopamine scenario adds nothing below the brainstem except the labelled A11 beam. The schematic pelvic activity markers of A.8 #21 (non-rhythmic, rate and speed not to scale, §13.9) therefore need the rule-7 amendment proposed in §11.18 and the user's confirmation (§13.18). Until both exist, the pelvic streams keep their resting display during `orgasm`, and a visible body stays static and neutral. DOPAMINE.md §1 tints prolactin, serotonin, GABA and opioid source nuclei; §13 adds noradrenaline, acetylcholine, histamine and orexin under the same restrictions (DOPAMINE.md §10, "Avoid"). The 2,300 K amber stays reserved for dopamine (DOPAMINE.md §8.2), and all body colours are ≥ 5,500 K (A.8 #19; §13).
- **Framing carried over.** Mesolimbic dopamine is drawn as motivation and prediction error, not pleasure (DOPAMINE.md §1); human dopamine has never been measured during sexual activity (DOPAMINE.md §4.1); DOPAMINE.md §10 rules 8–12 (species labels, hypothesis channels, disputed findings, wording, neurons per star) apply unchanged and extend to every network.

### 1.9. Conventions

Appendix A binds every convention; this summary names the binding text.

| Topic | Convention | Binding |
|---|---|---|
| Language | English only; British spelling as in DOPAMINE.md (colour, centre, oesophagus, haemodynamic); clinical, non-explicit tone | A.1 |
| Headings | `## N. Title`, `### N.M. Title`, numbered, sentence case; content directly under each heading, no subtitle or tagline | A.1 |
| Numbers | In tables, defined in exactly one section (A.7); elsewhere referenced, an inline restatement followed by its owner, e.g. "IHR ≈ 101 bpm (§7.5)" | A.1, A.7 |
| Table columns | `Quantity · Value · Unit · Species · Conf. · Source`; coordinates `Structure · id · Position (x, y, z) mm · Extent mm · Frame · Conf. · Source` | A.1 |
| Notation | En-dash ranges (18–23), "≈", Unicode minus "−", "× 10ⁿ", comma thousands (86,000); identifiers and paths in backticks | A.1 |
| Units | SI with mm, ms, s, min, h, mmHg, bpm, °C, dB SPL, cd/m², µS, pg/mL, µg/dL, pM; delay in ms = L_mm / v_mps | A.1 |
| Cross-references | "§7.4"; "DOPAMINE.md §6.4"; "`src/anatomy.js` L321" | A.1 |
| Frames | One MNI-152 mm frame for brain and body (x right, y anterior, z superior); right side listed; left-sided organs at negative x | A.2 |
| Names, clocks | Ids in camelCase ASCII, sided `id.R` / `id.L`; tH for physiology, tS for display and safety, kh in human s per screen s | A.3, A.4 |
| Endings | Each section ends with Open questions | A.1 |

| Evidence tag | Meaning | Effect on confidence |
|---|---|---|
| **Author Year** | Peer-reviewed ("A & B Year"; three or more authors "A et al. Year") | As rated |
| **[T]** | Textbook knowledge, no primary source checked | One step lower |
| **[G file Lx]** | Raw capture and line; stem without `en_wikipedia_org_api_rest_v1_page_html_`; folder `brain-system/raw/` unless prefixed, e.g. [G Oxytocin L73] | Never the sole basis of high; errors in §1.11 |
| **[model]** | Design or calibration choice of this project | Low |
| **[recalled]**, **[secondary]** | From memory; from a secondary tabulation (e.g. "Andersen et al. 2013 via arXiv:2311.04570") | At most low unless independently confirmed |
| **[unverified]** | Full text not read | Stated per row |

Species tags: **H** human, **Mk** macaque, **SM** squirrel monkey, **R** rat, **Ms** mouse, **C** cat, **D** dog, **GP** guinea pig, **Gb** gerbil, **Sq** squid, **—** model choice. Confidence as in DOPAMINE.md: **high**, replicated direct measurement; **medium**, one line of evidence or indirect; **low**, estimate, extrapolation, design choice or contested.

### 1.10. Content rules

- **Non-explicit (A.1).** No genital structures. Pelvic anatomy is limited to schematic nerves and plexuses, the bladder, the rectum and an unlabelled pelvic-floor field. The pudendal nerve ends at the perineal midline. The S4–S5 perianal band, perineal sites and the pelvic-floor field are never pickable from any view; `dermatome.S3` is pickable only from posterior views (§13.12). The figure has no sex characteristics and is built on male reference proportions (A.9; §2). The orgasm scenario is described only clinically and by reference to DOPAMINE.md.
- **Photosensitivity.** Limits in A.9, owned by §13; they extend DOPAMINE.md §10 rules 1–6 and WCAG 2.2 Success Criterion 2.3.1 (unchanged from 2.1) to packets, heartbeats, organ responses and toggle fades.
- **No audio, symbolic stimuli, reduced motion** (A.6; A.8 #22, #23; §13). The camera never moves for a balance stimulus.
- **Disclosures.** One star stands for many neurons, small structures are enlarged for legibility, values are species-tagged estimates, and travel is slowed when kh < 1 (§13; DOPAMINE.md §10 rules 11–12). Contested findings are shown as contested (e.g. A.8 #16).

### 1.11. Corrections to the raw captures

Corrected values are restated only with their owner section, which defines and sources them. DOPAMINE.md §2.5 holds the corrections to dopamine-related captures; they stand.

| # | Capture | What it states | Correction used | Owner | Species | Conf. | Source |
|---|---|---|---|---|---|---|---|
| 1 | [G Respiratory_center L40] (also L34, L50) | The dorsal respiratory group "initiates inspiration" and sets the rate; the ventral group is inactive in quiet breathing | The rhythm of every breath, quiet breathing included, is generated in the preBötzinger complex (`preBotC`), which the capture itself places in the VRG (L48). The DRG, inside the NTS, relays vagal and glossopharyngeal afferents (L42) to it (`ntsVisc`) [T]. Rhythm is CNS (A.8 #8) | §3, §7 | R (rhythm); H (homologue) | high (R); medium (H) | Smith et al. 1991; Schwarzacher, Rüb & Deller 2011 |
| 2 | [G Neuromodulation L54] (= [G Volume_transmission L54]) | Noradrenaline system of "around 15,000 neurons" | 22,000–51,000 pigmented neurons per LC in adult men, no side-to-side difference (§3; [G Locus_coeruleus L48]) | §3 | H | medium | Mouton et al. 1994 [unverified] |
| 3 | [G Neuromodulation L54] | "More than 100 billion neurons in the brain" | ≈ 86 × 10⁹ (§3) | §3 | H | high | Azevedo et al. 2009 |
| 4 | [G Neuromodulation L77] (= [G Volume_transmission L77]); [G Myenteric_plexus L67] | Brain ≈ 10 % of body serotonin, gut 80–90 % (L77); gut > 90 % (L67) | ≈ 90–95 % of body 5-HT in the gut, mostly in enterochromaffin cells; ≈ 1–2 % in the brain (§8) | §8 | H | medium (gut); low (brain) | Gershon & Tack 2007 [unverified]; brain [T] |
| 5 | [G Vestibular_system L137] | Cupula relaxation T2 ≈ 20 s in humans | Canal afferent τ ≈ 5 s plus central velocity storage ≈ 15 s (§5; A.8 #15); the capture assigns the combined decay to the cupula | §5 | SM (afferent); Mk (storage) | medium | Fernández & Goldberg 1971 [unverified]; Raphan, Matsuo & Cohen 1979 |
| 6 | [G Group_A_nerve_fiber L46–L47]; [G Nerve_conduction_velocity L44–L45] | Ia and Ib conduct at 80–120 m/s | Cat values; human default 65 m/s (§4; A.8 #13) | §4 | C; H (model) | medium | Hursh 1939 |
| 7 | [G Group_A_nerve_fiber L37] | α-motor axons at 80–120 m/s | Cat values; [G Nerve_conduction_velocity L35] gives 50–60 m/s and its L62 a clinical median motor 49–64 m/s; human defaults per §4 (A.9) | §4 | C; H (model) | medium | Hursh 1939 |
| 8 | [G Startle_response L47] | Startle pathway latency "less than 10 ms" | Rat value; the pathway (cochlear root neurons and lateral lemniscus nucleus → PnC → facial and spinal motor neurons; L33, L47) was worked out in rats (L45). Longer human latencies are owned by §6 | §6 | R | high | Davis et al. 1982 |
| 9 | [G Suprachiasmatic_nucleus L41] | "Two nuclei composed of approximately 10,000 neurons", species and side unstated | Rodent order of magnitude, not a human value; §3 sets the human count or marks it low | §3 | R, Ms | low | [T] |
| 10 | [G Paraventricular_nucleus_of_hypothalamus L42] | ≈ 100,000 neurons in ≈ 0.5 mm³ "in the rat"; ≈ 1 % of brain volume | Rat count, unverified; volume share corrected in DOPAMINE.md §2.5; §3 sets the human count | §3 | R | low | DOPAMINE.md §2.5 |
| 11 | [G Thalamus L52, L62] | Whole-thalamus 13.68 cm³ (post mortem, mean age 71) and 8.68 cm³ (MRI, mean age 17) | No side basis stated; methods and ages differ. Not used: geometry follows `src/anatomy.js` after the DOPAMINE.md §7.3 port (A.2) | §3 | H | n/a | — |
| 12 | [G Nerve_conduction_velocity L36] | Aγ (5–8 µm) conducts at 4–24 m/s | Inconsistent with the γ diameter factor (4.6 (m/s)/µm × 5–8 µm = 23–37 m/s) and with the textbook Aγ range ≈ 15–30 m/s; model default 25 (15–35) m/s (§4) | §4 | C | low | [T]; Table 4.4c |

### 1.12. Reading guide

| § | Answers | Main consumers |
|---|---|---|
| 1 | Scope, conventions, content rules, capture corrections | Every reader |
| 2 | Body coordinates and path lengths | Body geometry, picking, delays |
| 3 | Brain systems, new structures, firing rates, arousal, ports | `src/anatomy.js`, `src/brain.js` |
| 4 | Conduction, synapses, coding, adaptation, gain, latency method | Kernel, packet timing |
| 5 | Ten senses: transduction, thresholds, latencies, stimulus ranges | Stimulus dropdown |
| 6 | Cord, spinal and cranial nerves, reflexes, cord injury | Somatic network, limb motion |
| 7 | Autonomic outflow, reflexes, respiration, thermoregulation, vitals | Autonomic network, Vitals |
| 8 | ENS, motility, gut hormones, gut–brain routes | Enteric network, `meal` |
| 9, 10 | Hormones and their brain actions; cytokines, inflammatory reflex, fever | Neuroendocrine, neuroimmune networks |
| 11 | Graph, switches, kernel, clock, stimulus pipeline, orgasm adapter | `src/clock.js`, simulation files |
| 12 | Scenarios, switch-off outcomes, checkpoints | Scenarios dropdown, headless tests |
| 13 | Stars, palette, packets, camera, HUD, tiers, photosensitivity | `src/shaders.js`, `src/renderer.js`, `src/ui.js`, `src/performance.js`, `index.html` |
| 14; A; B | Sources; writer contract; implementation plan | Writers, reviewers, implementers |

Reading paths: one stimulus, A.6 → §5 → §4 → §2 → §3 → §6 or §7 → §11 → §13 (worked case `hotObject`, §12); one switch, A.5 → the network's off-behaviour subsection → §11 → §12 matrix; implementing, Appendix A → Appendix B → §11 → §2, §3 → §13 → §12; checking a number, its owner in A.7.

Section numbers citable from `src/`, `README.md` and `index.html`: §1 scope and conventions, §2 body geometry, §3 brain systems, §4 signal processing, §5 senses, §6 somatic, §7 autonomic, §8 enteric and gut–brain, §9 neuroendocrine, §10 neuroimmune, §11 architecture and switches, §12 scenarios and validation, §13 rendering, HUD, performance and safety, §14 sources, Appendix A contract, Appendix B implementation plan. Code comments cite "ANALYSIS.md §7.5" or "DOPAMINE.md §6.4".

### 1.13. Open questions

- Mouton et al. 1994: full text not read; a web check of the abstract confirms a stereological count with no side-to-side difference, but not the per-side basis of correction 2.
- Gershon & Tack 2007 and Fernández & Goldberg 1971: full texts not read. The brain share of body 5-HT is [T] and needs a primary human source.
- Bremer 1935: a secondary account (web check) dates both the cerveau isolé and the encéphale isolé to 1935; the original was not read.
- Should brain only keep trigeminal and vagal afferents, as the encéphale isolé does? The current decision silences them, so brain only equals "no body networks".
- Human SCN and PVN neuron counts are not established; §3 must source them or mark them low.
- The figure has no sex characteristics but is built on male reference proportions (A.9; disclosed in About, §13.14); female reference values are not parameterised.
- Whether the DOPAMINE.md §1 tint list should mention the four tints that §13 adds outside the orgasm scenario is undecided.

### 1.14. Sources

- **Literature:** Azevedo et al. 2009 (H); Bremer 1935 (C) [unverified]; Davis et al. 1982 (R); Fernández & Goldberg 1971 (SM) [unverified]; Gershon & Tack 2007 (H) [unverified]; Hursh 1939 (C); Mouton et al. 1994 (H) [unverified]; Raphan, Matsuo & Cohen 1979 (Mk); Schwarzacher, Rüb & Deller 2011 (H); Smith et al. 1991 (R, in vitro).
- **Standards:** W3C WCAG 2.2 — SC 2.3.1, whose text is unchanged from 2.1 (as DOPAMINE.md §11.4), and SC 2.5.8, which exists only in 2.2 (§13.12 touch targets). **[T]:** the DRG as afferent relay; the brain share of body 5-HT; the rodent SCN count.
- **Captures (`brain-system/raw/`):** Baroreflex L35; Group_A_nerve_fiber L37, L46–L47; Locus_coeruleus L48; Myenteric_plexus L67; Nerve_conduction_velocity L35, L44–L45, L62; Neuromodulation L54, L77; Paraventricular_nucleus_of_hypothalamus L42; Respiratory_center L34, L40, L42, L48, L50; Startle_response L33, L45, L47; Suprachiasmatic_nucleus L41; Thalamus L52, L62; Vestibular_system L137; Volume_transmission L54, L77.
- **Project files:** `brain-system/research/DOPAMINE.md` conventions, §1, §2.5, §4.1, §6.7, §6.9, §8.2, §9.6, §9.8, §10, §11; `RESPONSE.md` §7.4–§7.9; `brain-system/index.html` L7, L20.
- **Graph checks:** `graphify query` (respiratory rhythm generator; serotonin distribution; DOPAMINE.md sections); `explain` (Dorsal and Ventral respiratory group; Baroreflex Solitary nucleus; PnC; Inflammatory reflex; Ampullary Cupula); `path` Dorsal respiratory group → Ventral respiratory group → Pre-Botzinger complex, Vagus nerve → Solitary nucleus, Cochlear Root Neurons → PnC, LLN → PnC. Graph-wide paths from Cochlear nucleus and Baroreceptors were noisy, so the captures were read at the cited lines. **Web checks:** Bremer 1935; Mouton et al. 1994 (abstract).

---

## 2. Frames and the reference body

### 2.1. Frame, ownership and inputs

The body frame is the brain's MNI-152 frame (A.2). The two share origin, axes and millimetres, so no transform exists between them. `src/anatomy.js` coordinates, as revised by the DOPAMINE.md §7.3 port (Phase 0a, B.15), hold unchanged and brain-only mode renders as that post-port build (head-skin fading, §13).

This section owns every body-frame coordinate and extent, the reference subject, the cord length, diameters and levels, and the standard path lengths. Other sections own the following:
- §3: brain coordinates above the junction, including the cranial-nerve attachments.
- §4: turns the §2.14 lengths into delays.
- §6: assigns dermatomes and the root composition of each nerve.
- §7 and §8: organ roles.
- §13: rendering, skin sampling, camera and picking.

Inputs follow the A.2 precedence:
1. `anatomy.js`.
2. The body-geometry lens (lens-BG).
3. The enteric lens (lens-EN), for gut centrelines and radii.
4. The somatic lens (lens-SM), for nerves lens-BG lacks: axillary, musculocutaneous, obturator, cervical plexus, VII, XI, XII.
5. The autonomic lens (lens-AU), for the cranial parasympathetic ganglia, the nodose ganglion and the glands.

Scratch scripts tested skin depth, clearance and path lengths; they are model checks, not sources. Source cells note moves of more than 3 mm from the lens value, and ‡ marks a move beyond the ±20 mm allowance. Coordinate tables describe the human (H) reference body, so they omit the species column. Tuples omit the thousands comma, as in A.2. The drawn gut arc `sDraw` and the in-vivo gut coordinate s (§8.2) both start at the upper oesophageal sphincter (UES); §2.9 maps one onto the other.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Origin and axes | MNI-152 origin (≈ anterior commissure); x right, y anterior, z superior | — | H | high | A.2; `src/anatomy.js` L1 |
| Render scale `MM` | 0.01 (1 unit = 100 mm); figure spans z +0.88 to −16.72 units | units/mm | — | high | `src/anatomy.js` L7 |
| Scalp vertex | (0, −20, 88) | mm | H | medium | A.2; cerebrum top z 76 (`HULL.cerebrum`, `src/anatomy.js` L126 post-port) + ≈ 12 mm of tissue [T] |
| Floor plane | z = −1,672; h = z + 1,672 | mm | — | low | [model]; A.8 #1 |
| Cervicomedullary junction | (0, −45, −72) | mm | H | low | DOPAMINE.md §2.4 (L278) |
| `BRAINSTEM` tube end | (0, −46, −88), half-axes (6, 5). Drawn as today but functionally upper cord: segments C1–C2 lie inside it | mm | — | low | `BRAINSTEM`, `src/anatomy.js` L321–L324 post-port |
| Posture and sides | Standing anatomical position, with organs in standing positions. The right side is listed and the left mirrors x; the vagus, phrenic, visceral routes and unpaired organs are listed per side. Left organs have x < 0 | — | — | — | A.2 |

### 2.2. Reference subject and landmark heights

The reference figure has no sex characteristics and is built on male reference proportions (Drillis & Contini 1966); female proportions are not modelled. It has an unscaled MNI head above a body of native proportions. Below the chin, landmark heights follow z = f · 1,760 − 1,672 (A.2).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Model stature (vertex to sole) | 1,760 | mm | — | low | [model]; A.8 #1 |
| Native-equivalent stature | 1,745 (vertex to menton is 246 here against ≈ 232 in native men) | mm | H | low | craniofacial norms [T] via lens-BG |
| Mean stature of adult men, 2012 US Army survey | ≈ 1,755 | mm | H | low | Gordon et al. 2014 [recalled] |
| Head scale; figure height | 1.00 (≈ 5–10 % above native per axis); 7.15 head heights | — | H | medium | A.2; DOPAMINE.md §2.4; computed |
| Mass | 75 | kg | — | low | [model] |
| Body surface area | 1.91 (0.007184 · W^0.425 · H^0.725; 75 kg, 176 cm) | m² | H | medium | DuBois & DuBois 1916; computed |
| Age; core temperature | `age` 30 y (§11); tCore 37.0 °C (§7) | — | — | — | A.9 |
| Figure extent | x ±282; y −145 to +173; z +88 to −1,672 | mm | — | low | computed; camera framing in §13 |
| Landmark heights (f → z) | shoulder (acromion) 0.818 → −232; chest 0.720 → −405 (not used: the rib cage fixes the nipple level, §2.7); elbow 0.630 → −563; trochanter 0.530 → −739; wrist 0.485 → −818; middle fingertip 0.377 → −1,008; knee 0.285 → −1,170; ankle 0.039 → −1,603 | mm | H | low | Drillis & Contini 1966 via Winter [secondary] |
| Segment lengths (f · H) | upper arm 327, forearm 257, hand 190, thigh 431, leg 433, foot 268, foot breadth 97, shoulder width 456, hip width 336 | mm | H | low | same |
| Drawn segment lengths (§2.6 joints) | upper arm 295 (glenohumeral centre → elbow; the Drillis 0.186 H is acromion → elbow), forearm 258, hand 190, thigh 439 (+2 %), leg 433, foot 268; acromial breadth 400, bitrochanteric 340 | mm | — | low | computed |

The eye and chin fractions (0.936, 0.870) are not used, because the MNI head already fixes the eye at z −38 and menton at z −158. The acromion sits at 0.818 H, level with the suprasternal notch (−229), as acromial height does in men, and the glenohumeral centre lies 36 mm below it (§2.6). The Drillis upper-arm fraction measures acromion to elbow (0.818 − 0.630 = 0.188 H ≈ 0.186 H), so the 295 mm glenohumeral-centre-to-elbow length is the expected value, not a shortfall.

### 2.3. Head soft tissue and sense organs

> **Head form (5 November 2026).** The skin of the head and neck no longer uses the envelope
> primitives below. It follows `research/BODY-FORM.md` §8: a cranium, a face skeleton and soft
> tissue, the nose, lips, eyelids with an almond fissure, and auricles, sized to craniofacial norms,
> with the neck as part of the torso sections. The §2.3 points (nasion, pronasale, subnasale, corneal
> apex, eye, meatus, the mandibular plane) and every sense organ below are unchanged. `headEnv.scalp`
> and `pinna.R` remain as picking volumes.

The head envelope is the smooth union (k = 10 mm) of the primitives below. The two lens-BG ellipsoids left the brow, cheekbones, tragus and occiput 7–16 mm uncovered, so three primitives were added. The skin passes within ±6 mm of every skin landmark.

| Structure | id | Position (x, y, z) mm | Extent mm | Frame | Conf. | Source |
|---|---|---|---|---|---|---|
| Scalp vault | `headEnv.scalp` | (0, −17, 12) | radii (80, 99, 77) | body | low | lens-BG |
| Brow; midface; skull base and occiput | `headEnv.brow`, `.midface`, `.occiput` | (0, 40, −20); (0, 30, −52); (0, −28, −55) | (66, 46, 34); (72, 60, 40); (80, 80, 42) | body | low | [model] |
| Face and jaw | `headEnv.face` | (0, 50, −100); clipped below the mandibular plane through both gonia (±50, −5, −125) and menton (0, 78, −158), z = −125 − 0.398·(y + 5) | (62, 50, 70) | body | low | lens-BG (0, 50, −95), z-radius 65; lowered to reach menton; clip [model] gives the chin–neck angle |
| Neck | `headEnv.neck` | elliptic cylinder, axis (x 0, y −15), z −95 to −200 | (60, 58) | body | low | lens-BG |
| Nose | `headEnv.nose` | nasion (0, 87, −40) → pronasale (0, 108, −82) → subnasale (0, 96, −94) | wedge half-width 16 | body | low | Farkas-type proportions [T] |
| Pinna; eye opening | `pinna.R` | (80, −24, −45); no skin within 14 mm of the corneal apex | (8, 15, 30) | body | low | lens-BG; [model] |
| Skin landmarks (SDF residual) | `lm.*` | vertex (0, −20, 88) −1.0; opisthocranion (0, −116, 12) 0; euryon (80, −17, 12) 0; glabella (0, 84, −22) −1.9; nasion (0, 87, −40) −0.4; subnasale −3.8; stomion (0, 98, −115) −0.8; menton (0, 78, −158) 0; tragion (78, −20, −46) +0.2 | ±6 | body | low | A.2; nasion and tragion from a FieldTrip template via lens-BG [secondary]; [T] |
| Bony landmarks | `lm.mastoid.R`, `lm.gonion.R` | mastoid tip (55, −40, −70); gonion (50, −5, −125) | 14 and 9 inside the skin | body | low | [T] |
| Eye globe | `eye.R` | (33, 60, −38) | radius 12 | body | medium | A.2; Brodoehl, Witte & Klingner 2016 (right-eye MNI box x 21–51, y 47–74, z −50 to −26) |
| Corneal apex, pupil; retina | `pupilSphincter.R`, `pupilDilator.R`, `retina.R` | (33, 72, −38); posterior pole (33, 48, −38) | pupil diameter §7; shell radius 11 | body | medium; low | A.2; [model] |
| Optic nerve; extraocular cone | `cn2.R`, `extraocular.R` | disc = `cn2` optic nerve head (§3.16) → optic canal (12, 22, −26) → chiasm (§3.16); the same route as `tractOptic`; cone (30, 42, −38) | r 2; (10, 14, 10) | body | low | lens-BG [T] |
| Cochlea; vestibular labyrinth | `cochlea.R`, `vestLabyrinth.R` | (39, −22, −45); (42, −28, −43) | radius 5; ≈ 20 across | body | low | A.2 (craniometric; no published MNI value); lens-BG [T] |
| Middle ear, stapedius; meatus; porus | `stapedius.R` | (47, −27, −45); external meatus (74, −24, −46); internal porus (22, −32, −42) → §3 | (3, 3, 3) | body | low | [model]; lens-BG [T] |
| Olfactory epithelium | `olfEpith.R`, `cn1.R` | (5, 45, −40); fila cross the cribriform plate at (6, 40, −33) → bulb (§3) | (3, 10, 4) | body | low | lens-BG [T] |
| Tongue; taste fields | `tongue`, `tongueAnt.R`, `tonguePost.R` | (0, 55, −110); anterior (VII) (12, 75, −97); vallate row (IX) (12, 30, −100) | (25, 35, 16); patches r 10 | body | low | lens-BG [T]; [model] |
| Hyoid; larynx; V1–V3 skin sites | `larynx`, `foreheadV1.R`, `cheekV2.R`, `chinV3.R` | hyoid (0, 25, −145), 8 below the mandibular plane; larynx (0, 30, −158.5), z −145 to −172; (20, 77, 25); (45, 76, −75); (15, 84, −145) | larynx (15, 12, 13.5) | body | low | lens-BG hyoid −125, larynx −135, lowered below the drawn mandible [T]; [model] |

### 2.4. Vertebral column

The lens-BG built the column from Gray's lengths [T] and a plumb-line posture (Kendall et al. [T]). Five surface landmarks fall where they should:
- suprasternal notch (z −229) at T2/T3 (−232);
- sternal angle (−280) at T4/T5 (−279);
- xiphisternal joint (−388) at T9 (−386);
- iliac crest (−587) at L4;
- umbilicus (−580) at L3/L4 (−570).

The lens left only ≈ 90 mm between the symphysis and S3, which is too little room for the rectum. The sacrum and coccyx were moved back 4–21 mm and the symphysis forward 5 mm, which gives ≈ 105 mm.

| Structure | id | Position (x, y, z) mm | Extent mm | Frame | Conf. | Source |
|---|---|---|---|---|---|---|
| C1–C7 | `vert.C1` … `vert.C7` | x 0; z −83, −98, −114, −129, −144, −158, −172; y −27, −28, −29, −30, −32, −35, −38 | half (9, 8, 6) | body | low | lens-BG; y interpolated |
| T1–T12 | `vert.T1` … `vert.T12` | z −196, −220, −244, −267, −291, −315, −339, −363, −386, −410, −434, −458; y −42, −46, −50, −54, −58, −62, −62, −62, −62, −58, −53, −47 | (14, 12, 10) | body | low | same |
| L1–L5 | `vert.L1` … `vert.L5` | z −482, −517, −552, −587, −622; y −37, −31, −25, −22, −28 | (22, 16, 13) | body | low | lens-BG |
| S1–S5; coccyx tip | `vert.S1` … `vert.S5`, `vert.Co` | z −655, −676, −697, −718, −739, −765; y −42, −56, −68, −72, −70, −62 | S1 (24, 10, 9) → S5 (12, 10, 9); Co (8, 6, 6) | body | low | lens-BG y −52, −61, −58, −50, −41 for S2–Co, moved back (pelvic depth) |
| Canal centreline (x 0), control points (y, z) | `canal` | (−45, −72) (−47, −100) (−44, −130) (−55, −172) (−66, −200) (−86, −300) (−88, −380) (−72, −460) (−58, −520) (−52, −585) (−56, −640) (−84, −700) (−84, −740) (−74, −765) | radius 7–9 | body | low | lens-BG; last three (lens (−82, −700), (−75, −740), (−58, −765)) kept ≥ 10 mm from the revised sacrum |

### 2.5. Spinal cord, roots and dorsal root ganglia

The cord continues the `BRAINSTEM` tube along the canal centreline. Segment centres sit on the centreline at the level given by the segment–vertebra rule below. §6 places the horns and the IML, SPN, Clarke and CPG parts in (ξ, η).

A dorsal root runs from its DRG to the foramen. From there it takes a straight chord through the dural sac to an entry zone 3.5 mm lateral and 3 mm dorsal to the segment centre. Below the conus the roots form the cauda equina.

Cord sections are ellipses whose axes are the Frostell et al. 2016 diameters, tapering to 0.5 mm at the conus tip. The capture gives 13 mm for both enlargements and 6.4 mm for the thoracic cord [G Spinal_cord L45]. That overstates the lumbar maximum, which the review puts at 9.4 mm (L3 transverse).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Cord length, adult | ≈ 450 men; ≈ 430 women | mm | H | medium | [G Spinal_cord L45, L72] |
| Drawn cord, junction → conus (0, −63, −499) | 435 along the curve; vertical span 427 | mm | — | medium | computed; A.8 #2 |
| Segments | 31 (C1–C8, T1–T12, L1–L5, S1–S5, Co1) | — | H | high | [G Spinal_nerve L33] |
| Conus tip | L1–L2 vertebrae | — | H | medium | [G Spinal_cord L45, L70]; A.2 |
| Dural sac end; filum terminale | sac ends at the S2 vertebra (0, −73, −676); filum runs conus → sac end → coccyx dorsum (0, −70, −760) | mm | H | medium; low | [G Spinal_cord L78, L70]; course [T] |
| Enlargements | cervical: segments C5–T1, z −129 to −172 (the capture gives the vertebral levels C4–T1, which these segments lie opposite within ±1 level); lumbosacral: segments L2–S3, z −416 to −484 (the capture gives vertebrae T10–L1) | mm | H | medium | [G Spinal_cord L72]; segmental ranges [T] |
| Transverse diameter by segment | C1–C8 11.3, 11.5, 12.0, 12.8, 13.3, 13.1, 12.5, 11.3; T1–T12 10.7, 10.0, 9.6, 9.5, 9.2, 8.7, 8.4, 8.3, 8.6, 8.6, 8.3, 8.2; L1–L5 8.6, 9.1, 9.4, 9.3, 8.8; S1–S5 8.4, 7.1, 6.3, 5.5, 4.7 (± 1.5–3.5, 2 SD) | mm | H | medium | Frostell et al. 2016, Table 5 (pooled post-mortem, myelographic and MRI) |
| AP diameter by segment | C1–C8 8.3, 8.2, 8.0, 7.7, 7.4, 7.0, 6.9, 6.8; T1–T12 6.9, 6.9, 6.8, 6.6, 6.4, 6.4, 6.3, 6.3, 6.5, 6.5, 6.4, 6.4; L1–L5 6.7, 7.2, 7.5, 7.5, 7.1; S1–S5 6.8, 5.8, 5.2, 4.6, 3.9 (± 1.6–3.2, 2 SD) | mm | H | medium | same |
| Segment–vertebra rule | C1 at the foramen magnum; C2–C7 one vertebra higher; C8 between C6 and C7; T1 at C7; T2 at C7/T1; T3–T8 two higher; T9 at T6/T7; T10–T12 three higher; L1–L2 at T10; L3–L4 at T11; L5 at T12; S1–S5 at L1; Co1 at L1–L2 | — | H | low | [T] (±1 level); lens-BG |
| Exit rule | C1 between occiput and atlas; C2–C7 above their vertebra; C8 below C7; T1 and below exit below their vertebra; S1–S4 via the sacral foramina (vertebra z − 4); S5 and Co1 via the hiatus | — | H | high | [G Spinal_nerve L43, L63, L73] |
| Dorsal-root length (chord route) | C1–C8 21, 24, 25, 24, 24, 24, 24, 34; T1–T12 54, 65, 76, 76, 76, 77, 76, 75, 87, 100, 101, 103; L1–L5 120, 143, 166, 188, 203; S1–Co1 201, 217, 233, 249, 270, 274 | mm | — | low | computed |
| Arc position of segments from the junction | C1–C8 4, 11, 26, 42, 57, 73, 87, 94; T1–T12 102, 114, 127, 152, 177, 200, 224, 249, 261, 273, 297, 320; L1–L5 338, 350, 363, 375, 393; S1–Co1 410, 415, 420, 425, 429, 435 | mm | — | low | computed |

| Structure | id | Position (x, y, z) mm | Extent mm | Frame | Conf. | Source |
|---|---|---|---|---|---|---|
| Segments C1–C8 | `cord.C1` … `cord.C8` | x 0; z −76, −83, −98, −114, −129, −144, −158, −165; y −45, −46, −47, −46, −44, −48, −51, −53 | half-diameters, e.g. C5 (6.7, 3.7) | body | low | [model], rule above |
| Segments T1–T12 | `cord.T1` … `cord.T12` | z −172, −184, −196, −220, −244, −267, −291, −315, −327, −339, −363, −386; y −55, −60, −64, −70, −75, −79, −84, −86, −87, −87, −88, −87 | e.g. T8 (4.2, 3.2) | body | low | same |
| Segments L1–L5 | `cord.L1` … `cord.L5` | z −404, −416, −428, −440, −458; y −83, −81, −78, −76, −72 | e.g. L3 (4.7, 3.8) | body | low | same |
| Segments S1–Co1 | `cord.S1` … `cord.Co1` | z −474, −479, −484, −489, −493, −499; y −69, −68, −66, −65, −64, −63 | S1 (4.2, 3.4) → 0.5 | body | low | same; Co1 = conus anchor |
| DRG C1–C8 | `drg.C1` … `drg.C8` | x 24; z −77, −90, −106, −121, −136, −151, −165, −184; y −45, −46, −46, −45, −46, −49, −53, −60 | (4, 4, 6) | body | low | lens-BG exit z; y = canal y |
| DRG T1–T12 | `drg.T1` … `drg.T12` | x 26; z −208, −232, −255, −279, −303, −327, −351, −374, −398, −422, −446, −470; y −68, −72, −77, −82, −86, −87, −87, −88, −84, −80, −75, −70 | same | body | low | same |
| DRG L1–L5 | `drg.L1` … `drg.L5` | x 32; z −499, −534, −569, −604, −638; y −63, −57, −53, −53, −56 | same | body | low | same |
| DRG S1–Co1 | `drg.S1` … `drg.Co1` | x 26 (Co1 24); z −659, −680, −701, −722, −747, −759; y −65, −75, −84, −84, −81, −76 | same | body | low | revised canal (lens-BG y −73, −82, −78, −70, −62 for S2–Co1) |

Each spinal nerve `sn.*` starts at its DRG.

### 2.6. Trunk, limbs and joints

> **Skin form (5 November 2026).** The joints, landmarks, limb axes and internal trunk sections below
> are unchanged, and they still place the gut, the regions and the rigid segments. The outer skin now
> follows `research/BODY-FORM.md`, an anthropometric analysis of the human form (ANSUR II, neutral
> at 1,760 mm):
> - front/back superelliptic torso sections with the chest, abdomen, lumbar curve and buttocks;
> - deltoid, trapezius, pectoral, scapular and gluteal masses;
> - profiled limbs with the biceps, quadriceps, knee, calf and malleoli;
> - arms joined with a crease;
> - guards that cannot cut a term near the surface.
>
> A second pass (`BODY-FORM.md` §9) adds the clavicles and axillary folds, joins the deltoid to the
> arm, flattens the chest front, removes the band at the knee and the elbow, and replaces the box
> hand and the slab foot with a palm, jointed digits, a heel, an arch and toes.

The torso is lofted through elliptical sections, the limbs are tapered capsules, and the hands and feet are boxes. The ellipse puts the chest wall ≈ 15 mm too far back at the midclavicular line. Skin points are therefore snapped to the drawn skin (§2.7), and deep structures follow the depth rules of §2.15.

| Structure | id | Position (x, y, z) mm | Extent mm | Frame | Conf. | Source |
|---|---|---|---|---|---|---|
| Torso sections, centre (0, y, z) | `torso.z185` … `torso.z835` | z −185, −260, −370, −420, −560, −600, −740, −835; y −20, −20, −15, −15, −10, −12, −20, −20 | half-breadth × half-depth 65 × 60, 170 × 120, 165 × 125, 155 × 120, 145 × 110 (waist), 160 × 115, 175 × 125, 175 × 125 (crotch fillet into the thighs; no genital geometry, A.1) | body | low | lens-BG (girths [T]) |
| Acromion; shoulder skin | `lm.acromion.R`, `lm.shoulderTop.R` | (200, −20, −232); skin (200, −20, −220), over the AC joint (175, −15, −222) | — | body | low | 0.818 H [secondary]; [model] |
| Trunk landmarks | `lm.cervicale`, `.jugularNotch`, `.sternalAngle`, `.xiphoid`, `.xiphoidTip` | (0, −110, −185); (0, 60, −229), 13 below the loft; (0, 80, −280); (0, 92, −388) = the xiphisternal joint (§2.4); (0, 92, −410) = the xiphoid tip, ≈ 22 below the joint, the single "xiphoid level" used by the §2.7 and §2.12 trunk levels | — | body | low | lens-BG [T]; tip offset [T] |
| Pelvic landmarks | `lm.iliacCrest.R`, `.asis.R`, `.pubicTubercle.R`, `.trochanter.R` | (150, −30, −587); (118, 50, −700); (25, 60, −745); (170, −20, −739) | — | body | low | lens-BG; 0.530 H [secondary] |
| Pubic symphysis | `lm.symphysis` | (0, 55, −757) | z −737 to −777; inner surface y ≈ 45 | body | low | lens-BG y 50 (bladder clearance) |
| Upper-limb joints | `shoulder.R`, `elbow.R`, `wrist.R`, `palmC.R`, `finger.R` | glenohumeral (185, −25, −268); elbow (195, −30, −563), carrying angle ≈ 8–10°; wrist (232, −22, −818); palm (238, −15, −870); index MCP (248, −15, −918) | hand box half (43, 15); finger r 9; thumb r 11 | body | low | lens-BG; MCP [model] |
| Fingertips | `indexTip.R` | index (258, −15, −1000); middle (240, −15, −1008); little (205, −15, −985); thumb (282, 0, −930) | — | body | medium (index); low | A.2; 0.377 H [secondary] |
| Lower-limb joints | `hip.R`, `knee.R`, `ankle.R` | (88, −10, −732); (80, −32, −1170); (78, −45, −1603) | — | body | medium; low (ankle) | A.2 anchors; 0.039 H [secondary] |
| Foot | — | heel contact (78, −95, −1672); toe tip (95, 173, −1672); hallux tip (78, 170, −1660) | half-breadth 48; dorsum 35 (MTP) to 69 (ankle) | body | low | lens-BG; hallux [model] |

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Limb radii | upper arm 50 → 40; forearm (mediolateral × AP) 42 × 42 → 45 × 40 (25 %) → 30 × 20; thigh 95 → 60; leg 60 → 62 (calf, z −1,290) → 37 | mm | H | low | lens-BG [T] |

### 2.7. Skin sites and dermatome key points

The definitions come from the capture; the coordinates are placements on the drawn skin. Trunk points are snapped along ±y, limb points radially, and head points to the envelope. Snapping moved chest and abdominal points by up to 16 mm. The lens-BG points that lay off the skin (L2, L3) were re-placed. §6 maps each site to its segment and nerve. The S4–S5 band is posterior and schematic; it is never pickable from any view (A.1; §13.12).

| Structure | id | Position (x, y, z) mm | Extent mm | Frame | Conf. | Source |
|---|---|---|---|---|---|---|
| C2 (lateral to the occipital protuberance); C3 (supraclavicular fossa at the midclavicular line); C4 (AC joint) | `dermatome.C2.R` … `.C4.R` | (15, −105, −50); (95, 20, −222), on the skin over the clavicle midpoint (97.5, 20, −223.5), site radius 10; (175, −15, −222) | skin | body | low | [G Dermatome_anatomy L61–L63]; C3 moved 35 lateral from the lens value (60, 50, −215), which lay at the medial fossa, off the midclavicular line |
| C5 (lateral antecubital fossa); C6, C7, C8 (dorsal proximal phalanx of thumb, middle, little finger) | `.C5.R` … `.C8.R` | (215, 5, −545); (280, −30, −910); (240, −35, −930); (205, −35, −915) | skin | body | low | [G Dermatome_anatomy L64–L67] |
| T1 (medial antecubital fossa); T2 (axillary apex, hidden with the arms down) | `.T1.R`, `.T2.R` | (161, −6, −570); (150, −25, −265) | skin | body | low | [G Dermatome_anatomy L68, L69] |
| T3–T6 (midclavicular line: 3rd, 4th (nipple level), 5th space; xiphoid level) | `.T3.R` … `.T6.R` | (95, 85, −340); (95, 87, −370); (95, 86, −390), the midpoint of T4 and T6; (95, 84, −410), level with the §2.6 `lm.xiphoidTip` | skin | body | low | [G Dermatome_anatomy L70–L73]; the capture's T6 is the level of the xiphoid process, not of the xiphisternal joint |
| T7–T9 (¼, ½, ¾ xiphoid tip → umbilicus); T10 (umbilical level); T11 (midway to the inguinal ligament) | `.T7.R` … `.T11.R` | (95, 78, −453); (95, 76, −495); (95, 74, −538); (95, 78, −580); (95, 82, −651) | skin | body | low | [G Dermatome_anatomy L74–L78]; fractions of −410 → −580, T11 the midpoint of −580 and the T12 ligament level −722 |
| T12 (inguinal-ligament midpoint); L1 (midway T12–L2); L2 (anteromedial thigh) | `.T12.R`, `.L1.R`, `.L2.R` | (72, 94, −722); (55, 67, −829); (37, 43, −936) | skin; the ligament midpoint (≈ (71.5, 55, −722)) lies ≈ 40 deeper (no groin crease) | body | low | [G Dermatome_anatomy L79–L81] |
| L3 (medial femoral condyle, above the knee); L4 (medial malleolus); L5 (3rd MTP joint, dorsum) | `.L3.R` … `.L5.R` | (19, −31, −1150); (41, −45, −1605); (85, 120, −1640) | skin | body | low | [G Dermatome_anatomy L82–L84] |
| S1 (lateral calcaneus); S2 (popliteal fossa); S3 (ischial tuberosity) | `.S1.R` … `.S3.R` | (105, −85, −1640); (80, −92, −1165); (55, −139, −815) | skin | body | low | [G Dermatome_anatomy L85–L87] |
| S4–S5 perianal band | `dermatome.S4`, `.S5` | posterior, \|x\| ≤ 15, z −825 to −840 | not pickable | body | low | [G Dermatome_anatomy L88]; A.1 |
| Hand, forearm and foot sites | `indexTip.R`, `palm.R`, `forearmDorsal.R`, `footSole.R`, `heel.R`, `bigToe.R` | (258, −15, −1000); (238, 0, −870); (214, −60, −690); (85, 30, −1672); (78, −75, −1672); (78, 170, −1660) | skin | body | medium (index); low | A.2; [model] |
| Umbilicus | `umbilicus` | (0, 92, −580) | unlit landmark, no navel geometry | body | low | lens-BG |
| Tendon tap sites | `bicepsTendon.R`, `tricepsTendon.R`, `patellarTendon.R`, `achillesTendon.R` | (200, 0, −548), skin tap (202, 10, −548); (195, −64, −535); (82, 25, −1200); (78, −80, −1590) | 6, 3, 3 deep | body | low | patellar lens-BG; others [model] |

### 2.8. Organs, glands and receptor sites

Solid organs are ellipsoids. Where neighbours press, they are carved with a 3 mm gap, which reproduces the real impressions on the liver and spleen. The heart is clipped at the central-tendon plane (z −392), and the lungs are carved by the heart and by both domes. Two organs are unions of more than one ellipsoid: the heart (main solid, apex lobe and ventricles) and the liver (main right-lobe solid, left lobe and the gallbladder fundus). A stated apex or tip point is the extreme point of the **union**, so it must be tested against every primitive of that organ and not against the main ellipsoid alone; the volumes below likewise distinguish the main solid from the union. Organ roles belong to other sections:
- §7: heart, airways, vessels, bladder, glands, brown fat.
- §8: gut, pancreas, liver.
- §9: adrenal, thyroid.
- §10: spleen.

| Structure | id | Position (x, y, z) mm | Extent mm | Frame | Conf. | Source |
|---|---|---|---|---|---|---|
| Heart (main solid; apex lobe); apex point; ventricles | `heart`, `ventricles` | main (−22, 15, −352); apex lobe (−62, 40, −377); apex point (−80, 50, −384) (left 5th space, above the z −392 clipping plane, on the apex-lobe surface at normalised radius 0.99); ventricles (−35, 25, −372) | half (52, 45, 55); apex lobe (26, 20, 14), 31 % of it inside the main solid and the ventricles so the union stays joined; (40, 35, 40). All three clipped below z −392 | body | low | A.2; [T]; apex lobe [model] (`src/body/geometry.js` L453). The lens apex (−85, 55, −390) lay at radius 1.65 in the main solid and outside the union; moved 9 mm onto the drawn surface |
| SA node; AV node | `saNode`, `avNode` | (30, 0, −312), at the SVC–atrial junction; (5, −2, −350) | r 4; r 3 | body | low | A.2; lens-BG [T] |
| Lungs; hila | `lungs.R`, `lungs.L`, `lungStretch.R` | (78, −18, −318); (−82, −22, −328); hila (±45, −20, −300) | (62, 80, 118); (56, 78, 112), carved | body | low | lens-BG [T] |
| Trachea → carina | `airways` | cricoid (0, 20, −172) → (0, −10, −290); bronchi to the hila | r 9 | body | low | lens-BG (C6 → T4/T5), start lowered to the larynx base |
| Diaphragm | `diaphragm` | right dome (55, −5, −382); left dome (−55, −5, −395); central tendon (0, 15, −392); costal attachments z −440 to −470; crura to L1–L3 | sheet, end-expiration | body | low | lens-BG [T] |
| Diaphragmatic openings | — | caval (T8) (30, 5, −380), on the §2.10 IVC at the height of the sheet, in the central tendon; oesophageal (T10) (−22, −22, −415); aortic (T12) (−8, −20, −460) | — | body | low | [G Phrenic_nerve L46]; §2.9, §2.10 |
| Liver (main right-lobe solid; left lobe); gallbladder fundus | `liver` | main (44, 8, −440); left lobe (−45, 26, −432); left-lobe tip (−90, 30, −430), at radius 0.95 in the left lobe; fundus (70, 60, −495) | main (90, 68, 55), carved, ≈ 1.41 L on its own (0.3 % of that volume within 15 mm of the skin); left lobe (48, 32, 20), uncarved; union ≈ 1.5 L before carving; fundus r 15 | body | low | lens-BG (52, 8, −445), (100, 68, 55): raised 5 (hepatic flexure), moved 8 medial and narrowed so the right flank keeps a body wall. Left lobe [model] (`src/body/geometry.js` L460): the main solid reaches only x −46, so the tip lies outside it |
| Spleen; hilum | `spleen` | (−108, −55, −458); hilum (−86, −40, −460) | (22, 42, 58) along rib 10 | body | low | A.2; [model] |
| Pancreas | `pancreas` | head (26, 28, −542) r 13 → neck (2, 18, −515) → body (−12, 18, −505) → (−45, −8, −488) r 10 → tail (−80, −28, −465) r 8 | tube ≈ 145 long | body | low | lens-BG, re-routed into the duodenal C |
| Kidneys | `kidney.R`, `kidney.L` | (62, −50, −512); (−60, −50, −497) | (30, 22, 55) | body | low | lens-BG [T] |
| Adrenals | `adrenalCortex.*`, `adrenalMedulla.*` | R (42, −42, −447); L (−38, −36, −448), anteromedial to the upper pole of the left kidney | (12, 8, 22), enlarged for legibility; medulla core (5, 3, 9) | body | low | A.2; [model]. L moved from (−46, −42, −456), whose centre lay inside the left kidney (52 % of the gland inside); now 1.8 % inside, medulla core clear |
| Bladder at volume V | `bladder` | neck fixed (0, 5, −782), behind the lower part of the symphysis; centre (0, 5, −782 + 1.55a) (≈ 1 mm clear of the symphysis at 600 mL) | half (1.4a, a, 1.55a), a = (3V / (4π · 2.17))^⅓ = 14.9 / 32.1 / 40.4 at 30 / 300 / 600 mL | body | low | [model]; V = `bladderVol` (§7) |
| Pelvic-floor field (unlabelled) | `pelvicFloor` | (0, −20, −810) | (45, 50, 8) | body | low | lens-BG; A.1 |
| Thyroid | `thyroid` | lobes (±18, 22, −175); isthmus (0, 32, −180), over the upper tracheal rings | lobe (9, 9, 22) | body | low | lens-BG (−165) [T], lowered with the larynx |
| Carotid sinus; carotid body | `carotidSinus.R`, `carotidBody.R` | (25, 5, −120); (25, 2, −120) | r 5; r 2.5 | body | low | A.2; [model] |
| Aortic arch baroreceptor field | `aorticArch` | (−20, −8, −252) | r 14 | body | low | §2.10 |
| Visceral stimulus sites | `stomachWall`, `duodenum`, `colonRectum` | anterior gastric wall at rest (−58, 44, −468); (50, −8, −548); rectal ampulla (0, −38, −740) | follow §2.9 radii | body | low | [model] |
| Lacrimal gland | `lacrimal.R` | (44, 60, −27) | (8, 5, 4) | body | low | lens-AU, moved off the globe |
| Parotid; submandibular; sublingual | `parotid.R`, `submandibularGland.R`, `sublingual.R` | (50, −8, −80); (35, 12, −142), below the mandibular border; (18, 55, −128) | (15, 20, 25); (12, 15, 8); (6, 15, 5) | body | low | lens-AU, re-placed [T] |
| Sweat sites | `sweatPalm.R`, `sweatSole.R`, `sweatForehead`, `sweatAxilla.R` | = `palm.R`; = `footSole.R`; (0, 78, 35); (152, −22, −285) | skin | body | low | lens-AU, snapped to skin |
| Brown adipose tissue | `bat` | supraclavicular (±65, 5, −200); paravertebral (±32, −80, −320) | (25, 15, 10); (8, 10, 40) | body | low | [T]; neuroendocrine-immune lens rejected (A.2) |

### 2.9. Gut tube

Lens-EN centrelines were re-snapped to clear bone, vessels and solid organs (A.2). Two coordinates exist (A.2). `sDraw` (cm) is arc length along the drawn polyline centreline and is owned here. `s` (cm) is in-vivo length, owned by §8.2, and is the only coordinate the gut model uses. The breakpoint table below, owned by this section, maps s onto `sDraw` piecewise linearly between the §8.2 region boundaries, so drawn lengths never change timing. The centreline rows quote `sDraw`.

The stomach has two radius sets: resting radii (≈ 0.50 L drawn, including the fundal air cap) and fed radii (the lens-EN values, ≈ 0.85 L). Its drawn radius is r = r_rest + (r_fed − r_rest) · f, with the filling fraction f set by §8. The rectal ampulla grows from r 20 to 25 by the same rule.

The jejunoileum and sigmoid are non-periodic random-walk tubes of fixed length inside their envelopes, never regular loops (photosensitivity, §13). Each keeps 3 mm from the colon, stomach, duodenum, pancreas and the bladder at its current volume.

| Structure | id | Position (x, y, z) mm | Extent mm | Frame | Conf. | Source |
|---|---|---|---|---|---|---|
| Oesophagus, UES (C6) sDraw 0 → | `gut.oes` | (0, −8, −165) → (−4, −20, −210) → (−1, −31, −270) → (0, −34, −292) → behind the left atrium (−4, −38, −340) → (−12, −30, −392) | r 10 | body | low | lens-EN, +8 to +11 y (vertebrae) |
| Hiatus (T10), LES at sDraw 24–28.3; cardia sDraw 28.3 | `gut.les` | (−22, −22, −415); cardia (−30, −10, −435) | r 10 | body | low | lens-EN |
| Fundus | `gut.fundus` | (−58, −4, −432), top z −398 | r 30 rest, 34 fed | body | low | lens-EN, lowered out of the thorax ‡ |
| Upper body, sDraw 33.3; gastric pacemaker | `gut.corpus`, `iccPacemaker` | (−58, 16, −468); pacemaker at sDraw 35.8 (s 36, §8.2), on the greater-curvature wall of the centreline point (−52.5, 24.1, −491.0): (−81, 24, −491) rest, (−94, 24, −491) fed | r 28 rest, 42 fed; patch 30 × 30 | body | low | lens-EN, lowered 18; pacemaker after O'Grady et al. 2010 [secondary], placed by the breakpoint map |
| Lower body (sDraw 39.2) → antrum | `gut.corpus`, `gut.antrum` | (−45, 35, −522) → incisure (−25, 48, −556), sDraw 43.3 → (0, 52, −550) | r 30 → 25 → 22 rest; 40 → 32 → 25 fed | body | low | lens-EN, shifted ≤ 10 (left colon, abdominal wall) |
| Pyloric canal sDraw 48.1; pylorus sDraw 50.2 | `gut.pylorus` | (12, 42, −535); (20, 30, −520) | r 14–15; r 8 | body | low | lens-EN |
| Duodenum | `gut.duod` | cap (40, 30, −512) → (52, −4, −518) → (50, −8, −548) → (50, −5, −580) → (28, 26, −590) → (0, 38, −594) → (−20, 30, −585) → (−30, 14, −560) → DJ flexure sDraw 76.9 (−32, 5, −540) | r 18 → 15 | body | low | lens-EN; cap ‡ and horizontal part moved in front of the IVC and aorta |
| Mesenteric root | — | (−30, 0, −540) → (55, 20, −690) | line | body | low | lens-EN |
| Jejunum; ileum envelopes | `gut.jej`, `gut.ileum` | (−35, 45, −590); (20, 35, −680); jejunum/ileum junction at sDraw 181.9 | half (60, 45, 60), ≈ 105 cm, r 15; half (65, 45, 70), ≈ 160 cm, r 12 | body | low | lens-EN |
| Ileocaecal valve (sDraw 341.9); caecal pole sDraw 342.0; caecum → ascending colon at (80, 15, −680), sDraw 347.2 | `gut.icv`, `gut.caecum` | (55, 25, −690); (62, 35, −725) | ring r 12; r 35 | body | low | lens-EN |
| Ascending colon; hepatic flexure sDraw 363.6 | `gut.colAsc` | (80, 15, −680) → (92, 0, −600) → (90, 4, −545) → (80, 18, −525) | r 32 → 28 | body | low | lens-EN, moved lateral and down |
| Transverse colon | `gut.colTrans` | (55, 52, −620) → (0, 60, −636) → (−45, 44, −605) → (−80, 24, −570) → (−96, 24, −525) | r 27 → 24 | body | low | lens-EN, re-routed ‡ |
| Cannon–Böhm point sDraw 388.4 (s ≈ 399, §8.2) | — | (−64, 33, −586), ⅔ along the transverse arc, 12 cm before the splenic flexure; follows from the breakpoint map | — | body | low | [G Pelvic_splanchnic_nerves L41]; [G Parasympathetic_nervous_system L52] |
| Splenic flexure sDraw 400.8; descending colon | `gut.colDesc` | (−104, −8, −485) → (−106, −20, −545) → (−90, −12, −600) → (−82, −8, −660) | r 24 → 22 | body | low | lens-EN; flexure ‡ |
| Sigmoid envelope sDraw 418.8–458.8 | `gut.sigmoid` | (−35, 10, −680); guides (−65, 10, −680), (−35, 16, −676), (−10, −6, −684) | half (45, 30, 25); 40 cm, r 20 | body | low | lens-EN raised 15–25 (bladder dome) |
| Rectum | `gut.rectum` | rectosigmoid (S3) (0, −32, −705) → ampulla (0, −38, −740) → (0, −26, −775) → anorectal junction sDraw 468.2 (0, −18, −795) | r 20; ampulla 20–25; → 12 | body | low | lens-EN; ampulla out of the sacrum ‡ |
| Anal canal; verge sDraw 472.6 | `gut.ias`, `gut.eas` | (0, −25, −810) → (0, −35, −835) | r 10 → 8, schematic | body | low | lens-EN; A.1 |

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Drawn lengths | oesophagus 28.3; stomach axis 21.9; duodenum 26.7; small intestine 292 (jejunoileum 265); colon to the rectosigmoid 117 (sigmoid 40); rectum and anal canal 13.8 | cm | — | low | computed; textbook ≈ 25, —, ≈ 25, ≈ 300, ≈ 150 [T] |
| Breakpoints s (§8.2) → `sDraw`; linear between rows | 0 → 0 (UES); 21 → 24.0 (LES start); 25 → 28.3 (cardia); 33 → 33.3 (corpus); 45 → 43.3 (incisure, antrum); 53 → 48.1 (pyloric canal); 55 → 50.2 (pylorus); 80 → 76.9 (DJ flexure); 185 → 181.9 (jejunum/ileum); 345 → 342.0 (ileocaecal valve, caecal pole); 351 → 347.2 (ascending colon); 369 → 363.6 (hepatic flexure); 414 → 400.8 (splenic flexure); 439 → 418.8 (sigmoid); 482 → 458.8 (rectosigmoid); 496 → 468.2 (anorectal junction); 500 → 472.6 (verge) | cm | — | low | computed on the drawn polylines; [model] (linear map) |
| Derived points (s → `sDraw`) | pacemaker 36 → 35.8; Cannon–Böhm point 399 → 388.4 | cm | — | low | breakpoint map |

### 2.10. Great vessels

The vessels carry the blood-borne signals (§13) and the inflammatory-reflex route. The lens-BG aorta and IVC overlapped the lordotic L1–L4 bodies by 12 mm; they now follow the front of the spine. Transport times belong to §9.

| Structure | id | Position (x, y, z) mm | Extent mm | Frame | Conf. | Source |
|---|---|---|---|---|---|---|
| Ascending aorta; arch apex | `aorta` | (−5, 5, −330) → (2, 8, −275); apex (−20, −8, −252) | r 14 | body | low | lens-BG; apex moved 12 left of the trachea |
| Descending aorta | `aorta` | (−26, −40, −295) → (−24, −52, −380) → hiatus (T12) (−8, −20, −460) | r 12 → 11 | body | low | lens-BG, re-snapped |
| Abdominal aorta | `aorta` | coeliac trunk (−6, −5, −468) → (−5, 5, −470); SMA origin (−7, 7, −500); IMA origin (−6, 13, −552); bifurcation (L4) (−5, 7, −590) | r 11 → 9 | body | low | [model] on the L1–L3 bodies |
| Inferior vena cava | `ivc` | (21, −1, −590) → (24, 2, −520) → (30, 6, −470) → (32, 6, −420) → caval opening (30, 5, −380) → right atrium (30, 5, −360) | r 11–12 | body | low | lens-BG, moved off the spine |
| Superior vena cava | `svc` | (30, 0, −250) → (30, 5, −320) | r 10 | body | low | lens-BG |
| Carotid | `carotid.R` | common (25, 5, −230) → bifurcation (25, 5, −120) → ICA (27, −5, −90) → carotid canal (25, −15, −60) | r 4–6 | body | low | A.2; lens-BG |
| Splenic artery and nerve | `splenicNerve` | left coeliac ganglion (−18, −10, −470) → (−45, −12, −472) → splenic hilum (−86, −40, −460) | ≈ 80 long | body | low | [model]; contested (A.8 #16) |

### 2.11. Autonomic ganglia and plexuses

Placement rules:
- Thoracic chain ganglia sit over the rib heads at x ±30, y = vertebral-body y − 5.
- Lumbar ganglia sit at x ±25, y = body y + 5. The lens-BG offset of +12 put the right chain inside the IVC.
- Sacral ganglia lie on the revised sacral front.
- Prevertebral ganglia lie on the front of the aorta at their arterial origins.

| Structure | id | Position (x, y, z) mm | Extent mm | Frame | Conf. | Source |
|---|---|---|---|---|---|---|
| Superior and middle cervical ganglia | `scg.R`, `mcg.R` | (32, −20, −105); (30, −20, −158) | 25–30 long; 5–8 | body | low | lens-BG [T] |
| Stellate ganglion (incl. `chain.T1`) | `stellate.R` | (32, −40, −186) → (32, −45, −196) | (12, 5, 25) | body | low | lens-BG [T] |
| Thoracic chain T2–T12 | `chain.T2.R` … `.T12.R` | x 30; z = vertebral z; y −51, −55, −59, −63, −67, −67, −67, −67, −63, −58, −52 | 3–6 | body | low | lens-BG rule |
| Lumbar chain L1–L4 | `chain.L1.R` … `.L4.R` | x 25; z −482, −517, −552, −587; y −32, −26, −20, −17 | 3–5 | body | low | lens-BG, offset changed |
| Sacral chain S1–S4; ganglion impar | `chain.S1.R` … `.S4.R`, `impar` | (18, −32, −655), (16, −46, −676), (14, −58, −697), (12, −62, −718); impar (0, −53, −752) | 3 | body | low | [model]; [G Sympathetic_trunk L39] |
| Cardiac plexus | `cardiacPlexus` | (−12, −4, −284) | ≈ 30 | body | low | lens-BG, moved off the carina |
| Coeliac; superior mesenteric; inferior mesenteric ganglia | `coeliac.R/L`, `smg`, `img` | (±18, −10, −470); (−4, 10, −495); (−6, 18, −560) | r 10; 6; 5 | body | low | A.2; lens-BG SMG and IMG lay inside the aorta |
| Aorticorenal ganglia; renal plexus | `aorticorenal.R/L` | (±20, −20, −495); (±35, −35, −500) | r 5; ≈ 15 | body | low | lens-BG |
| Superior; inferior hypogastric plexus | `supHypogastric`, `infHypogastric.R` | (0, −12, −635); (35, −20, −760) | (15, 5, 20); (15, 20, 20), schematic | body | low | lens-BG; A.1 |
| Cranial parasympathetic ganglia | `ciliaryGang.R`, `pterygopalatineGang.R`, `oticGang.R`, `submandibularGang.R` | (27, 40, −35); (25, 22, −55); (25, 0, −55); (28, 30, −125), above the submandibular gland in the floor of the mouth | r 2–2.5 | body | low | lens-AU [T]; [G Pupillary_light_reflex L40] |
| Nodose; inferior glossopharyngeal; trigeminal ganglia | `nodoseGang.R` | (30, −24, −80); (30, −30, −68); (24, −12, −36) | (3, 3, 8); r 2; (5, 8, 4) | body | low | lens-AU, [G Vagus_nerve L50]; [model]; lens-SM [T] |

### 2.12. Nerve routes

Each nerve is a Catmull–Rom spline through its waypoints, with u = 0 at the CNS end (A.2). Routes start at a DRG (§2.5) or a brain attachment (§3), and §6 defines their root composition. Lens-SM points were mapped segment by segment from that lens's own skeleton onto the §2.6 joints, then held to the depth rules of §2.15. That skeleton includes the elbow (205, −30, −555) and knee (95, −25, −1161).

`graphify path` confirms these branchings:
- brachial plexus → its five branches;
- lumbar plexus → femoral and obturator; femoral → saphenous;
- sciatic → tibial and common fibular;
- pelvic splanchnics → inferior hypogastric plexus;
- carotid sinus → IX;
- vagus → recurrent laryngeal and the thoracic plexuses.

The graph has no nodes for the chorda tympani, the trigeminal branches or the targets of XI and XII. All waypoints are [T] or [model].

| Structure | id | Position (x, y, z) mm | Extent mm | Frame | Conf. | Source |
|---|---|---|---|---|---|---|
| Brachial plexus | `plexusBrachial` | C5–T1 DRG → trunks: upper (66, −26, −178), middle (70, −29, −198), lower (70, −33, −218) → divisions (110, −28, −240) → cords: lateral (160, −18, −268), posterior (158, −32, −272), medial (156, −24, −276) | band 15–25 | body | low | lens-BG, split; [G Brachial_plexus L42–L65] |
| Axillary | `axillary` | posterior cord → (153, −30, −302) → quadrangular space (170, −40, −312) → (187, −41, −321) → deltoid (207, −16, −326) | ≈ 3 | body | low | lens-SM |
| Musculocutaneous | `musculocutaneous` | lateral cord → (152, 8, −305) → (180, 6, −394) → (189, 3, −481) → (210, −5, −553) → lateral cutaneous nerve of forearm (234, −11, −688) → (245, −17, −797) | ≈ 3 | body | low | lens-SM |
| Median | `median` | cords → (165, −20, −280) → (178, −5, −420) → cubital fossa (188, −1, −560) → (208, −2, −700) → carpal tunnel (230, −10, −820) → palm (240, −12, −880) → thumb, index and middle tips (§2.6) | ≈ 5 | body | low | lens-BG, pulled inside the skin |
| Ulnar | `ulnar` | medial cord → (160, −30, −280) → (163, −35, −420) → cubital tunnel (166, −42, −560) → (190, −15, −700) → Guyon's canal (212, −15, −822) → little tip | ≈ 4 | body | low | lens-BG, pulled inside |
| Radial | `radial` | posterior cord → (150, −35, −275) → spiral groove (200, −50, −420) → (225, −25, −560) → superficial branch (245, −25, −780) → dorsal thumb web (262, −35, −880) | ≈ 5 | body | low | lens-BG |
| Cervical plexus | `plexusCervical` | C1–C4 DRG → nerve point (52, −8, −140) → lesser occipital (48, −60, −40), great auricular (76, −22, −72), transverse cervical (25, 36, −135), supraclavicular → C3, C4 sites | fine | body | low | lens-SM, re-snapped |
| Phrenic, right; left | `phrenic.R`, `phrenic.L` | C3–C5 DRG → anterior scalene (±40, −10, −170) → inlet (±35, 0, −215); R → beside the SVC and right atrium (42, 10, −320) → beside the caval opening (40, 5, −380) → over the right dome (55, −5, −382); L → over the left ventricle (−75, 26, −339) → left dome (−60, 10, −398) | 2–3 | body | low | lens-BG, L moved out of the heart; [G Phrenic_nerve L36, L46] |
| Intercostal T1–T11 (rule) | `intercostal.T1` … `.T11` | DRG → costal angle (80, y_ca, z_DRG − 15) → midaxillary (x_ma, −20, z_DRG − 50) → anterior end (35, y_ae, z_ant), 5 below the skin | ≈ 2 | body | low | lens-BG z_ant; [model]; [G Spinal_nerve L73] |
| Intercostal parameters, T1 → T11 | — | y_ca −72, −98, −111, −110, −110, −110, −109, −107, −104, −101, −98; x_ma 152, 154, 153, 152, 151, 148, 144, 140, 138, 136, 134; y_ae 84, 96, 100, 102, 100, 98, 96, 94, 92, 94, 96; z_ant −250, −300, −340, −370, −390, −410, −453, −495, −538, −580, −651 (the §2.7 dermatome levels) | — | body | low | lens-BG points lay at the skin; z_ant follows §2.7 |
| Subcostal T12 | `subcostal` | (26, −70, −470) → (80, −95, −485) → (131, −10, −540) → (75, 70, −715) | ≈ 2 | body | low | same; end lens-SM |
| Femoral; saphenous | `femoral`, `saphenous` | L2–L4 DRG → psoas (42, −30, −600) → psoas–iliacus groove (62, −10, −650) → inguinal ligament (80, 55, −730) → femoral triangle (85, 52, −765) → quadriceps (94, 42, −900); saphenous (85, 52, −790) → adductor canal (70, 25, −950) → medial knee (55, −15, −1170) → (60, −45, −1450) → medial foot (80, 10, −1640) | 6–8; ≈ 3 | body | low | lens-BG, start lowered; [G Lumbar_plexus L50] |
| Obturator | `obturator` | (35, −18, −620) → pelvic wall (55, 8, −690) → obturator canal (48, 38, −755) → (41, 26, −843) → (39, 7, −1000) → (38, 0, −1064) | ≈ 4 | body | low | lens-SM; [G Lumbar_plexus L48] |
| Sacral plexus; sciatic | `plexusSacral`, `sciatic` | lumbosacral trunk (L4–L5 DRG) → ala (40, −45, −660); S1–S3 from the anterior foramina (28, −36, −660), (25, −48, −680), (23, −58, −701) → piriformis (45, −50, −690) → sciatic notch (70, −65, −720) → (80, −80, −790) → (85, −60, −950) → popliteal apex (82, −55, −1090) | ≈ 20; 15–20 | body | low | lens-BG; [G Sacral_plexus L26, L49]; [G Sciatic_nerve L41] |
| Tibial | `tibial` | (82, −55, −1090) → (80, −60, −1170) → (80, −55, −1350) → tarsal tunnel (60, −55, −1600) → medial plantar (80, 20, −1662) | ≈ 8 | body | low | lens-BG |
| Common fibular | `commonFibular` | (82, −55, −1090) → (110, −50, −1150) → fibular neck (133, −28, −1210) → deep branch (93, −1, −1400) → ankle (82, −18, −1585) → dorsum (88, 60, −1645) → first web (85, 125, −1650) | ≈ 5 | body | low | lens-BG; neck point brought to the skin [T] |
| Pudendal (schematic) | `pudendal` | S2–S4 → (35, −60, −720) → ischial spine (50, −60, −765) → pudendal canal (45, −30, −800) → ends at the perineal midline in the pelvic-floor field (0, −20, −815) | ≈ 3; no genital structures | body | low | lens-BG; [G Pudendal_nerve L50, L52, L56]; A.1 |
| Pelvic splanchnic; hypogastric nerves | `splanchnicPelvic` | S2–S4 anterior foramina (25, −48, −680), (23, −58, −701), (20, −62, −722) → inferior hypogastric plexus; superior hypogastric plexus → (±35, −20, −760) | schematic | body | low | lens-BG, re-snapped to the sacral front |
| Greater splanchnic | `splanchnicGreater.R` | chain T5–T9 → (28, −60, −340) → (20, −45, −430) → coeliac ganglion; adrenal preganglionics (segments per §7.2) pass through the coeliac ganglion to the medulla | 2–3 | body | low | lens-BG [T] |
| Lesser, least, lumbar splanchnics | `splanchnicLesser`, `splanchnicLeast`, `splanchnicLumbar` | T10–T11 → (22, −45, −460) → aorticorenal; T12 → renal plexus; L1–L2 → IMG and superior hypogastric plexus | 2 | body | low | lens-BG [T] |
| Vagus, right | `cn10.R` | rootlets = `cn10` attachment (§3.16) → jugular foramen (30, −32, −62) → nodose → carotid sheath (30, −8, −120) → (31, −6, −150) → (31, −6, −215), posterolateral to the carotid, between it and the internal jugular vein → behind the right bronchus (20, −30, −300) → posterior oesophageal plexus (oesophagus + (0, −12, 0), z −320 to −405) → posterior trunk (−22, −34, −415) → coeliac ganglia → along the SMA → Cannon–Böhm point | 3–4 | body | low | lens-BG; [G Vagus_nerve L48, L50, L58]; [G Parasympathetic_nervous_system L52] |
| Vagus, left | `cn10.L` | mirrored `cn10` attachment (§3.16) → (−30, −32, −62) → (−30, −24, −80) → (−30, −8, −120) → (−31, −6, −150) → (−31, −6, −215) → lateral to the arch (−35, −6, −258) → behind the lung root (−36, −24, −300) → anterior oesophageal plexus (+ (0, 12, 0)) → anterior trunk (−22, −10, −415) → lesser curvature (−35, 20, −460); hepatic branch → (40, 10, −440) | 3–4 | body | low | lens-BG; [G Vagus_nerve L60] |
| Vagal branches | `cn10.para`, `cn10.aff` | cardiac → cardiac plexus → SA, AV nodes; pulmonary → hila; recurrent laryngeal R around the subclavian (35, −5, −225) → (8, −2, −180), L under the arch (−12, −16, −280) → (−8, −2, −200); aortic-arch afferents | — | body | low | [G Vagus_nerve L58, L60]; [G Baroreflex L35] |
| IX: carotid sinus nerve; posterior tongue | `carotidSinusNerve`, `cn9.aff`, `cn9.special` | carotid sinus → (28, −8, −95) → inferior ganglion → jugular foramen → §3; `tonguePost` → (25, 10, −90) → inferior ganglion | fine | body | low | [G Baroreflex L35]; [model] |
| Chorda tympani | `cn7.special` | `tongueAnt` → lingual nerve (28, 40, −105) → (35, 0, −70) → middle ear (47, −27, −45) → internal porus | fine | body | low | [T] |
| Facial, extracranial | `cn7.motor` | stylomastoid foramen (45, −22, −70) → parotid (52, −5, −80) → temporal (62, 22, −20), zygomatic (60, 50, −50), buccal (50, 65, −80), mandibular (45, 55, −120), cervical (40, 20, −140); stapedius branch (47, −27, −45) | fine | body | low | lens-SM, two ends moved inside |
| Trigeminal branches | `cn5.som` | ganglion → V1 superior orbital fissure (18, 30, −30) → supraorbital (25, 72, −18); V2 rotundum (20, 15, −45) → infraorbital (28, 72, −60); V3 ovale (24, −5, −50) → mental (25, 78, −135); each to its skin site | 1–3 | body | low | [T] |
| Accessory; hypoglossal | `cn11`, `cn12` | jugular foramen → (45, −15, −95) → posterior triangle (52, −30, −150) → trapezius (75, −70, −215); canal (18, −33, −63) → (30, −10, −90) → hyoid loop (35, 20, −138), above the lowered hyoid → tongue (15, 45, −100) | 2–3 | body | low | lens-SM; triangle point x 65 → 52 |
| III, IV, VI; ocular autonomic | `cn3`, `cn4`, `cn6`, `cn3.para` | attachments (§3) → superior orbital fissure → extraocular cone; III → ciliary ganglion → short ciliary nerves → `pupilSphincter`; SCG → internal carotid plexus → carotid canal → long ciliary nerves → `pupilDilator` | fine | body | low | [G Pupillary_light_reflex L40, L59]; [G Sympathetic_trunk L39] |

### 2.13. Muscle centres and effector targets

At their lens positions, five muscle centres lay at or above the skin. Limb muscle centres are therefore placed at 55 % of the local radius, and trunk muscle centres 18–30 mm below the skin. Activation belongs to §6.

| Structure | id | Position (x, y, z) mm | Extent mm | Frame | Conf. | Source |
|---|---|---|---|---|---|---|
| Deltoid; biceps; triceps | `deltoid.R`, `biceps.R`, `triceps.R` | (213, −23, −300); (190, −3, −420); (197, −51, −420) | (25, 25, 50); (25, 22, 90); (25, 22, 100) | body | low | lens-BG, moved to 55 % radius |
| Forearm flexors; extensors | `forearmFlexors.R`, `forearmExtensors.R` | (207, −7, −660); (218, −46, −660) | (25, 20, 90) | body | low | same |
| Rectus abdominis; erector spinae | `rectusAbdominis.R`, `erectorSpinae.R` | (34, 82, −600); (33, −103, −460) | (30, 6, 150); (20, 20, 200) | body | low | lens-BG, moved below the skin |
| Gluteus maximus | `glutealMax.R` | (84, −99, −770) | (60, 25, 80) | body | low | same |
| Quadriceps; hamstrings; adductors | `quadriceps.R`, `hamstrings.R`, `adductors.R` | (88, 22, −950); (85, −64, −950); (44, 3, −870) | (55, 45, 170); (45, 35, 170); (30, 35, 120) | body | low | lens-BG, moved to 55 % radius |
| Gastrocnemius–soleus; tibialis anterior | `gastrocSoleus.R`, `tibialisAnt.R` | (80, −70, −1300); (92, −8, −1340) | (45, 40, 140); (15, 15, 120) | body | low | same |
| Sternocleidomastoid; trapezius | `sternocleidomastoid.R`, `trapezius.R` | mastoid → sternoclavicular joint (20, 55, −225), centre (37, 8, −148); (75, −70, −215) | width 25; (60, 8, 40) | body | low | lens-BG; lens-SM, moved inside |
| Masseter; orbicularis oculi | `masseter.R`, `orbicularisOculi.R` | (48, 28, −118); ring around (33, 70, −38) | (12, 20, 25); ring r 18 | body | low | lens-BG, moved inside; [model] |
| Intercostal muscles; others | `intercostalMuscles`; `stapedius.R`, `extraocular.R`, `pelvicFloor`, `diaphragm` | bands along §2.12 routes, representative (150, −20, −340); others §2.3, §2.8 | — | body | low | [model] |

### 2.14. Standard path lengths

Path lengths are polyline sums over the §2.5–§2.12 waypoints and the §3 brain nodes (`cuneate`, `gracile`, `thalVPL`, `s1.hand`, `s1.foot`, `m1.hand`, `m1.leg`, `ntsVisc`, `nAmbVagal`, `rvlm`, `opn`, `ew`). Where a pathway crosses, the relay on the opposite side is used; roots use the §2.5 chord route. Every revision of an A.9 value stays inside its 10 % allowance. The stimulus-side sums keep their A.9 totals: wrist → C7 segment 761 (760) and fingertip → C7 segment 943 (943). These are the only path lengths: §4.11, §6, §7, §8, §11 and §12 cite them, and §4 recomputes the latency checks from them.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Index fingertip → C7 DRG (median, middle trunk) | 919 (A.9 921) | mm | — | low | computed |
| Wrist → C7 DRG | 737 (738) | mm | — | low | computed |
| C7 DRG → C7 segment | 24 (22; +9 %) | mm | — | low | computed |
| C7 segment → cuneate | 100 (100): cord arc 87 + junction → `cuneate` 13 | mm | — | low | computed |
| Cuneate → contralateral VPL | 73 (71) | mm | — | low | computed; equals the crossed §3.16 `tractML` polyline (73.0) |
| VPL → S1 hand | 60 (60) | mm | — | low | computed |
| Quadriceps → L4 DRG (femoral, via psoas) | 413 (413) | mm | — | low | computed |
| L4 DRG → L4 segment (cauda equina) | 188 (173; +8.7 %) | mm | — | low | computed |
| Calf → S1 DRG (tibial, sciatic) | 676 (663; +2.0 %) | mm | — | low | computed |
| S1 DRG → S1 segment | 201 (194; +3.6 %) | mm | — | low | computed |
| Hallux tip → L5 DRG (deep fibular, sciatic, lumbosacral trunk) | 1,196 (1,156; +3.5 %) | mm | — | low | computed |
| Cord junction → conus | 435 (435) | mm | — | medium | §2.5 |
| Carotid sinus → `ntsVisc` (IX) | 104 (100; +4 %) | mm | — | low | computed |
| SA node → `nAmbVagal` (right cardiac vagal) | 289 (312; −7.4 %) | mm | — | low | computed |
| Stomach wall → `ntsVisc` (left vagus) | 521 (502; +3.8 %) | mm | — | low | computed |
| L3 DRG → L3 segment; ankle (tibial) → S1 DRG | 166; 977 | mm | — | low | computed |
| Ankle (tibial, tarsal tunnel) → popliteal apex; popliteal apex → S1 DRG | 511; 466 (sum 977) | mm | — | low | computed; the below-knee segment carries the distal Aβ velocity (§4.4) |
| S1 segment → gracile; gracile → contralateral VPL; VPL → S1 foot | 420; 74; 65 | mm | — | low | computed |
| C6 segment → biceps (C6 root, upper trunk, lateral cord, musculocutaneous) | 392 | mm | — | low | computed; the withdrawal efferent (§4.11) |
| C4 segment → right dome; → left dome (phrenic) | 317; 331 | mm | — | low | computed (polyline); the right route now passes the caval opening (§2.12; 308 before) |
| IML T1 → stellate → SA node | 246: preganglionic IML → T1 root → white ramus → stellate 71; postganglionic stellate → cardiac plexus → SA node 175 | mm | — | low | computed |
| `rvlm` → IML T1 (bulbospinal) | 131: `tractBulbospinal` 29 (§3.16) + cord arc to T1 102 | mm | — | low | computed |
| Pupillary light reflex: retina → `opn`; `opn` → `ew`; `ew` → `ciliaryGang` (III); `ciliaryGang` → `pupilSphincter` | 105 (optic nerve head → optic canal → chiasm → optic tract → pretectum); 8 (1.2 × centre distance, §3.15); 78; 35 (short ciliary nerves around the globe) | mm | — | low | computed |
| M1 hand → contralateral C7; M1 leg → contralateral L4 (corticospinal) | 232; 532 | mm | — | low | computed; brain part along §3's `tractCST` |

### 2.15. Tolerances and consistency rules

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Precision; positional uncertainty | 1 (brainstem nuclei per §3); ±20–40, head landmarks ±6 against the envelope | mm | — | — | A.2 |
| Skin sites | on the drawn skin ±3 (bony landmarks excepted) | mm | — | — | [model] |
| Deep nerve waypoints | ≥ 12 below the torso skin; limb radial fraction ≤ 0.80 (≥ 8 deep); cutaneous ends may reach the skin | mm | — | — | [model] |
| Muscle centres | limb radial fraction 0.55; trunk 18–30 deep | mm | — | — | [model] |
| Gut tube vs bone; vs kidney, adrenal, heart | ≥ 0 clearance; contact ≤ 5 (fed stomach vs the moved left adrenal 3.8) | mm | — | — | [model]; checked |
| Solid organ vs skin | liver ≥ 15 (0.3 % of its volume closer); the spleen keeps its A.2 anchor along rib 10, with 20 % of its volume within 15 of the skin (accepted, §2.16) | mm | — | — | [model]; checked |
| Bladder vs bone (symphysis, sacrum) | ≥ 0 at every volume up to 600 mL | mm | — | — | [model]; checked at the §2.8 neck |
| Adrenal vs kidney | ≤ 3 interpenetration; medulla core clear | mm | — | — | [model]; checked (left 2.8, right 0) |
| Hollow organ vs hollow organ or vessel | interpenetration ≤ 11 at moderate filling; ≤ 23 with a 600 mL bladder or a fed stomach | mm | — | — | [model]; checked |
| Carve depth; abdominal wall over gut | liver ≤ 27, spleen ≤ 14, gap 3; wall ≥ 15 | mm | — | — | [model]; checked |
| Vessels vs vertebral bodies | ≥ −1.5 (contact) | mm | — | — | [model]; checked |
| Path-length revisions vs A.9 | ≤ 10 % | — | — | — | A.9 |

### 2.16. Open questions

- **Upper arm (closed).** A.2's "shoulder" is the acromion at 0.818 H, level with the suprasternal notch as in men; the glenohumeral centre stays 36 mm lower, and the 295 mm glenohumeral-to-elbow length is expected (§2.2). ANSUR II acromial height is [recalled].
- **Cervical column.** The §2.4 spacing is 14.8 mm per cervical level against ≈ 18–20 mm real [T]. The hyoid, larynx and submandibular gland were lowered below the drawn mandible (§2.3, §2.8), which puts the larynx base at the C7 vertebra and leaves the carotid bifurcation anchor (A.2, z −120) ≈ 16 mm above the upper thyroid border instead of level with it. Lengthening the cervical column would fix both but moves the A.2 junction-to-T1 geometry.
- **Spleen depth.** 20 % of the spleen lies within 15 mm of the skin (§2.15); a 5–8 mm medial move of the A.2 anchor would bring it under the wall rule.
- **Moves beyond ±20 mm (‡).** The fundus, duodenal cap, transverse colon, splenic flexure and rectal ampulla moved beyond the allowance. §8 should confirm them.
- **Pelvic depth.** Even at ≈ 105 mm, the pelvis crowds the bladder, rectum and sigmoid above 300 mL. A measured male mid-pelvic AP diameter is needed.
- **Torso sections.** Superellipse sections (exponent ≈ 2.5–3) would correct the chest wall, which sits ≈ 15 mm too far back. Adopting them is a §13 decision and would re-snap the §2.7 sites.
- **Head.** The nasion and tragion come from a template fiducial in a mailing-list post, and the cochlea from craniometry. Both should be measured on the MNI152 T1 head.
- **Cord length.** The drawn cord is 435 mm against ≈ 450 (A.8 #2). Lengthening it would lower the conus or bow the canal.
- **Root lengths.** Roots that follow the canal run 5–10 mm longer than the chords. L4 becomes 195, more than 10 % above A.9. Measured human intradural lengths are needed.
- **Anthropometry.** The ANSUR II stature is [recalled]; the Drillis–Contini fractions are [secondary].
- **Drawn gut lengths.** The colon is drawn at 117 cm against ≈ 150, and the oesophagus at 28 against ≈ 25. The §2.9 breakpoint map keeps timing on the in-vivo s of §8.2; lengthening the loops would only change `sDraw`.
- **Stomach and bladder laws; hand.** Both laws are design choices that §8 and §7 should check against imaging. Picking individual digits needs a finer hand (§13).
- **Splenic nerve.** The 80 mm route is contested (A.8 #16) and stays under `autonomic ∧ neuroimmune`.

### 2.17. Sources

Peer-reviewed:
- Brodoehl, Witte & Klingner 2016, BMC Neuroscience 17:48 (MNI eye regions).
- Drillis & Contini 1966, via Winter, *Biomechanics and Motor Control of Human Movement* [secondary].
- DuBois & DuBois 1916, Archives of Internal Medicine 17:863 (BSA formula; agreeing secondary tabulations).
- Frostell et al. 2016, Frontiers in Neurology 7:238 (segmental cord diameters, Table 5).
- Gordon et al. 2014, NATICK/TR-15/007 [recalled].
- O'Grady et al. 2010, via lens-EN [secondary].

Textbooks [T]:
- Gray's Anatomy.
- Moore, *Clinically Oriented Anatomy*.
- Kendall, McCreary & Provance, *Muscles: Testing and Function*.
- Farkas-type craniofacial norms.

Captures (`brain-system/raw/`):
- [G Spinal_cord L45, L70, L72, L78]
- [G Spinal_nerve L33, L43, L63, L73]
- [G Dermatome_anatomy L61–L88]
- [G Phrenic_nerve L36, L46]
- [G Brachial_plexus L42–L65]
- [G Lumbar_plexus L48, L50]
- [G Sacral_plexus L26, L49]
- [G Sciatic_nerve L41]
- [G Pudendal_nerve L50, L52, L56]
- [G Vagus_nerve L48, L50, L58, L60]
- [G Baroreflex L35]
- [G Pupillary_light_reflex L40, L59]
- [G Sympathetic_trunk L39]
- [G Parasympathetic_nervous_system L52]
- [G Pelvic_splanchnic_nerves L41]

Project files: `src/anatomy.js` L1, L7, `HULL.cerebrum` L126, `BRAINSTEM` L321–L324 (post-port lines); `src/body/geometry.js` `ORGANS` L451–L470; DOPAMINE.md §2.4 (L278).

---

## 3. Brain systems

### 3.1. Scope, ownership and model form

The brain (`cns`, A.3.1) is simulated in both modes and is never switched. Body networks reach it only through the ports in §3.14. A network switch therefore silences or cuts ports but never removes a brain node (A.5). The "Brain systems" overlays change only what is drawn.

The brain is a directed rate graph on the `NF` layer (A.4). Each node carries `r.<node>` (Hz) and `a.<node>` = r/rmax. §4 defines the node-class τ, the sigmoid (θ, κ), rmax, the noradrenergic gain law, `predErr`, the conduction velocities and t_syn. Modulator pools run on `CV`, and `procS`, `procC` and `arousalState` run on `CR` (§11). The dopamine model (DOPAMINE.md §6) runs unchanged as a subsystem.

Positions are right-side MNI-152 mm (mirror x for the left; x = 0 marks a midline structure). The brain frame is identical to the body frame (A.2). Under the A.2 precedence, §3.16 is the first source for brain coordinates.

This section defines the numbers listed in A.7 row 3. It only references the following: sensory latencies (§5), reflex latencies and CMCT (§6), cardiorespiratory, pupil and thermal values (§7), gut values (§8), hormones (§9) and visual values (§13).

Every chain stated in this section was checked with `graphify path`. Chains that have a direct extracted edge in the graph cite their capture line: baroreflex, raphe pallidus → brown fat, startle, mammillothalamic, climbing fibre, dorsal column–lemniscal, SCN → DMH, orexin → LC, habenula → RMTg, and PAG → raphe magnus. The basal ganglia, cerebellar-loop, CeA, HPA-feedback and sleep-switch chains connect only indirectly in the graph and rest on the cited literature.

### 3.2. Neuron counts and volumes

Everything outside the cortex and cerebellum holds ≈ 0.69 × 10⁹ neurons (DOPAMINE.md §2.2), so each added nucleus is oversampled for display. §13 converts these counts into "1 star ≈ N neurons".

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Whole brain, cortex, cerebellum; amygdala and hippocampus (per side); MSN share | DOPAMINE.md §2.2 | neurons | H | high–medium | Azevedo et al. 2009; [G Human_brain L46]; [G Cerebral_cortex L45] |
| Thalamic nuclei | ≥ 30 per side | nuclei | H | high | [G Thalamus L50] |
| LGN volume; neurons | 90–160; ≈ 1–2 × 10⁶ per side | mm³; neurons | H | medium; low | Andrews, Halpern & Purves 1997 [unverified]; [T] |
| Amygdaloid nuclei | 13 | nuclei | H | medium | [G Amygdala L56] |
| Basal ganglia relative counts | GPe > GPi ≈ STN ≈ SNr (the non-dopaminergic SN); GPi, STN and SNr of order 10⁵ per side, GPe several-fold higher; SNc ≈ 4 × 10⁵ pigmented neurons per side | neurons | H | low | Hardman et al. 2002 (abstract, PMID 11920704: GPe holds more neurons than GPi, STN and the non-dopaminergic SN, which are similar to one another) [unverified]; GPe and SNc values [recalled] (Pakkenberg et al. 1991), low until the tables are read; the HUD keeps the §3.19 order-of-magnitude note |
| Nucleus basalis cholinergic neurons, ChAT⁺; VAChT⁺ | ≈ 210,000; ≈ 174,000 per hemisphere | neurons | H | medium | Gilmor et al. 1999 [unverified] |
| LC pigmented neurons (adult men); soma volume | 22,000–51,000 per LC; 31,000–60,000 | neurons; µm³ | H | medium | [G Locus_coeruleus L48]; German et al. 1988 [unverified] |
| Dorsal raphe, all neurons (Nissl); serotonergic (PH8⁺) | 235,000 ± 15,000; 165,000 ± 34,000 | neurons | H | medium | Baker et al. 1990 [unverified]; Baker et al. 1991a [unverified] |
| Median raphe, serotonergic (pontine tegmentum ≈ 125,000, incl. PnO 30,700 and B9 29,000) | ≈ 64,400 | neurons | H | medium | Baker et al. 1991b [unverified] |
| PPN cholinergic (Ch5) | ≈ 36,000–70,000 per side, depending on outline; older estimates 20,000–26,000 | neurons | H | low | Brain Pathol. 2025, doi:10.1111/bpa.70011 (n = 4) [unverified]; older values [T] |
| Orexin neurons, both sides; loss in narcolepsy | ≈ 66,000–69,000; 85–95 % | neurons; % | H | medium; high | Thannickal, Lai & Siegel 2007 [unverified]; Thannickal et al. 2000 |
| TMN histaminergic neurons, both sides | ≈ 64,000 | neurons | H | low | Airaksinen et al. 1991 [unverified] |
| SCN (species and side not stated) | ≈ 10,000 | neurons | R | low | [G Suprachiasmatic_nucleus L41] |
| Basilar pontine nuclei | ≈ 2 × 10⁷ per side | neurons | H | low | Tomasch 1969 [unverified] |
| Cerebellar cortex area; reticular nuclei | 730; ≈ 100 | cm²; nuclei | H | medium | [G Cerebellum L60]; [G Reticular_formation L52] |
| Volumes per side (7 T): PBN lateral, medial; vestibular complex; dorsal vagal complex | ≈ 54, ≈ 47; ≈ 130–136; ≈ 85–88 | mm³ | H | medium | Singh et al. 2020 [unverified] |

The capture's figure of "around 15,000" noradrenergic neurons ([G Neuromodulation L54]) is not used (§1 corrections).

### 3.3. Thalamocortical system

The thalamus relays every sense except smell. Nearly all thalamic neurons except those of the reticular nucleus project to cortex, and cortex projects back ([G Thalamus L48]). First-order nuclei carry driver input from the periphery or the cerebellum. Higher-order nuclei (pulvinar, MD) carry layer-5 driver input from one cortical area to another (Sherman & Guillery 2002, C, Mk). Most synapses on a relay cell are modulatory (table below), so cortex and arousal state gate the transfer. In NREM sleep, hyperpolarised relay cells fire T-type rebound bursts and `thalRet` paces spindles. Sensory transfer falls, while brainstem and spinal reflexes persist (Steriade, McCormick & Sejnowski 1993; McCormick & Bal 1997; C).

Model: relay output = driver input × the state's relay gain (§3.11) × a modulation factor from `thalRet`, layer-6 feedback, `modACh` and `modNE` [model]. Bursts are never rendered spike by spike (§13). `thalVPL` stands in for the vestibular relay, because A.3.3 has no VPI id.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Retinal share of synapses on LGN relay cells | 5–10 | % | C | medium | Van Horn, Erişir & Sherman 2000 |

| id | Class | Driver input | Cortical target |
|---|---|---|---|
| `thalAnt` | higher-order, limbic | `mammillary` ([G Limbic_system L64]) | `pcc`, `rsc` |
| `thalMD` | higher-order | prefrontal L5, `amygdala`, `vp`, `snr`, `piriform` | `dlpfc`, `ofc`, `acc`, `ofcOlf` |
| `thalVA`, `thalVL` | basal ganglia recipient; VL also first-order from the cerebellum | `gpi`, `snr`; `dentate`, `interposed` | `preSma`, `pmd`, `sma`, `m1` |
| `thalVPL`, `thalVPM` | first-order | medial lemniscus, spinothalamic; trigeminal lemniscus | `s1`, `ba3a`, `ba2`, `s2`, `insPost`, `pivc`; `s1.face` |
| `thalVPMpc` | first-order | `ntsGust` (direct in primates) | `gust`, `areaG` |
| `thalVMpo` | first-order (VMpo, VMb) | lamina I; `ntsVisc`, `pbn` | `insPost`, `insAnt`, `dacc` ([G Insular_cortex L52, L58]) |
| `thalCM` | intralaminar | medial spinothalamic, `ppn`, `gpi` | striatum, diffuse cortex |
| `thalPulv` | higher-order | cortical L5, `sc` | `ppc`, `ips`, ventral visual cortex, `amygdala` |
| `thalRet` | GABAergic shell | collaterals of relay and corticothalamic axons | none (inhibits the relay nuclei) |
| `lgn`, `mgn` | first-order | optic tract; `ic` | `v1`; `a1`, `pt`, `amygdala` |

### 3.4. Cortical hierarchy and areas

Feedforward projections leave the supragranular layers and end in layer 4. Feedback projections leave the infragranular layers and avoid layer 4 (Felleman & Van Essen 1991, Mk). Feedforward signalling is carried mainly in the gamma band and feedback in the alpha/beta band (van Kerkoerle et al. 2014; Bastos et al. 2015; Mk). Under predictive coding, predictions travel down the hierarchy and prediction errors travel up ([G Predictive_coding L29, L37]; Rao & Ballard 1999; Friston 2005). Expected, repeated or self-generated input therefore evokes less activity than novel input. `predErr` (§4) supplies novelty (§3.12) and cerebellar attenuation (§3.6).

Cortical areas are an `area` attribute on existing cortical stars, not new regions. Each star takes the area of the nearest §3.16 centroid, with soft Gaussian membership. Deep areas (`a1`, `pt`, `pivc`, `s2`, the insular sub-areas, `gust`, `areaG`) take their stars from the Sylvian sheet. The `corticalRegion` assignment, and with it the dopamine regions of DOPAMINE.md §6.3, is unchanged.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Visual areas; hierarchical levels | ≈ 32; ≈ 10 | — | Mk | high | Felleman & Van Essen 1991 |
| Feedforward band; feedback band | > 40; 8–30 | Hz | Mk | medium | van Kerkoerle et al. 2014; Bastos et al. 2015 |

Cortico-cortical flows, in addition to the thalamic targets in §3.3:

- Vision: `v1` → `v4` → `ffa` → `amygdala`, `ofc`; `v1`, `thalPulv` → `mt` → `ppc`, `fef`.
- Hearing: `a1` → `pt` → `tpj`.
- Touch and proprioception: `s1` → `ba2`, `s2` → `insPost`; `ba3a` → `m1`.
- Interoception: `insPost` → `insMid` → `insAnt` ↔ `dacc`.
- Taste and smell: `gust` → `ofc`; `piriform` → `ofcOlf`, `entorhinal`.
- Executive and visceromotor: `dlpfc` → `caudate`, `preSma`; `dacc`, `sgacc`, `pgacc` → `pag`, `lh`, `pvn`, `lc`.
- Memory: `entorhinal`, `parahipp` → `hippocampus`.
- Motor: motor areas → `portCST`, striatum, `stn`, `pontineNuc`, `redNucleus`.

### 3.5. Basal ganglia loops

Cortex, basal ganglia and thalamus form parallel, largely segregated loops, and each loop returns to its frontal origin (Alexander, DeLong & Strick 1986, Mk). The basal ganglia hold motor systems under inhibition, and releasing that inhibition lets an action run ([G Basal_ganglia L48]). Three pathways set the output (Albin, Young & Penney 1989; Nambu, Tokuno & Takada 2002):

- The direct pathway (D1 MSNs → GPi/SNr) releases an action by disinhibition.
- The indirect pathway (D2 MSNs → GPe → STN → GPi/SNr) suppresses competing actions.
- The hyperdirect pathway (cortex → STN → GPi) is a fast, global stop.

Cortical stimulation evokes a three-phase GPi response, carried in turn by the hyperdirect, direct and indirect pathways (Nambu et al. 2000). Removing the cortico-subthalamic projection abolishes only the early excitation (Inoue et al. 2012 [unverified], Mk).

A channel is released when its GPi/SNr output stays below 50 % of its tonic rate for ≥ 20 ms [model]. The loop reads the striatal receptor occupancies θ1 and θ2 of DOPAMINE.md §6.3 and never writes them. In the hot-object scenario the withdrawal reflex is spinal (§6), and the later voluntary withdrawal runs through the motor channel (§3.13).

| Channel | Cortex | Striatum | Output | Thalamus → cortex |
|---|---|---|---|---|
| Motor | `sma`, `m1`, `pmd`, `s1` | `putamen` | `gpi` (ventrolateral), `snr` | `thalVL`, `thalVA` → `sma`, `m1`, `pmd` |
| Oculomotor | `fef`, `dlpfc`, `ppc` | `caudate` body | `gpi` (dorsomedial), `snr` → `sc` | `thalVA`, `thalMD` → `fef` |
| Dorsolateral prefrontal | `dlpfc`, `ppc`, `pmd` | dorsolateral caudate head | `gpi`, `snr` | `thalVA`, `thalMD` → `dlpfc` |
| Lateral orbitofrontal | `ofc`, temporal cortex, `acc` | ventromedial caudate | `gpi`, `snr` | `thalVA`, `thalMD` → `ofc` |
| Anterior cingulate (limbic) | `hippocampus`, `entorhinal`, `amygdala` | `nacc`, `olfTubercle` | `vp`, `gpi`, `snr` | `thalMD` → `acc`, medial `ofc` |

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| GPi tonic rate; GPe tonic rate (with pauses) | 60–80 (model 70); 50–70 (model 60) | Hz | Mk | medium | DeLong 1971 |
| SNr tonic rate | ≈ 60 | Hz | Mk | low | [T] |
| STN resting rate | 15–25 (model 20) | Hz | Mk | medium | [T] |
| MSN rate | < 1–2 (model 1) | Hz | R, Mk | medium | [T] |
| STN excitation after a cortical pulse | 5–6 | ms | Mk | medium | Nambu et al. 2000 [unverified] |
| GPi early excitation / inhibition / late excitation | +8–11 / −15–30 / +30–45 | ms | Mk | medium | Nambu et al. 2000 [unverified] |

The three-phase sequence is a validation target. The cortex → STN route is 69.5 mm (§3.16), which gives ≈ 3.5 ms at the §4 default CNS velocity.

### 3.6. Cerebellar loops

The cortico-cerebellar loop is closed. It runs from cortex to the pontine nuclei, crosses in the middle peduncle (mossy fibres), reaches the Purkinje cells and then the deep nuclei, crosses again in the superior peduncle, ends in `thalVL` and `redNucleus`, and returns to `m1` and `pmd`. Prefrontal areas form such loops too ([G Cerebellum L58, L62]; Kelly & Strick 2003, Mk). Climbing fibres from the contralateral olive carry error signals ([G Cerebellum L62]; Marr 1969; Albus 1971).

The model gives the cerebellum four roles:

1. **Forward model.** `pontineNuc` carries a copy of each motor command. The cerebellum predicts the sensory consequence and subtracts it from the reafference at `s1`, `ba3a` and `ba2`. Touch produced by the subject's own movement therefore evokes less cortical activity than the same touch applied externally (Blakemore, Wolpert & Frith 1998, H). `io` signals the mismatch, which also feeds `predErr` (§4).
2. **Vestibulocerebellum.** `flocculus` adapts VOR gain, and `nodulus` supports velocity storage (vestibular τ §5, VOR latency §6).
3. **Fastigial nucleus.** `fastigial` acts on posture and saccades through `vestNuc` and `gi`. Its projection to brainstem autonomic centres (the fastigial pressor response, [T]) is drawn with weight 0 by default [model].
4. **Interposed and dentate.** `interposed` → `redNucleus` (limb control); `dentate` → `thalVL` (planning).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Purkinje simple-spike rate; complex-spike rate | 40–100 (model 60); ≈ 1 | Hz | Mk | high | Thach 1968 |
| Cortical response to self-produced touch when the prediction matches | × 0.5 | — | H | low | [model]; direction from Blakemore, Wolpert & Frith 1998 |
| Lag between command and touch at which attenuation is lost | ≥ 0.2 | s | H | low | Blakemore, Frith & Wolpert 1999 [recalled] |

### 3.7. Limbic system

The basolateral amygdala links sensory value to prefrontal, temporal, insular and hippocampal context. The central nucleus is the main output ([G Amygdala L56, L58]; LeDoux 2000; Davis & Whalen 2001). `cea` projects to:

- `lh` (sympathetic arousal);
- `pag` (freezing, analgesia);
- `pvn` by way of `bnst` (HPA axis);
- `dmv` and `nAmbVagal` (bradycardia);
- `pbn` and `lc` ([G Locus_coeruleus L54]).

CeA output neurons are GABAergic and act largely by disinhibition, so each CeA edge carries the sign of its net effect on the target [model]. The BNST carries sustained, anxiety-like responses.

Hippocampal input regulates PVN CRH neurons ([G Paraventricular_nucleus_of_hypothalamus L80]). The feedback is relayed through `bnst` (Jacobson & Sapolsky 1991, R), and its gains are in §9.

The insula is graded from posterior to anterior. The posterior insula is primary interoceptive cortex ([G Insular_cortex L58]; Craig 2002). The anterior insula, together with `dacc`, is a hub for awareness and salience (Craig 2009). It is also part of the primary gustatory cortex and is reciprocally connected with the CeA ([G Insular_cortex L52, L81]).

Threat reaches the amygdala first by fast subcortical routes (`mgn` → amygdala; `sc` → `thalPulv` → amygdala), which set the onset. A slower cortical route then adds stimulus detail.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Amygdala response onset to fearful faces (fear latency target) | ≈ 74 | ms | H | medium | Méndez-Bértolo et al. 2016 [unverified] |
| Lateral amygdala auditory response onset | 12–20 | ms | R | medium | Quirk, Repa & LeDoux 1995 |

### 3.8. Hypothalamus as integrator

The hypothalamus receives six kinds of input (Swanson & Sawchenko 1983, R; Saper & Lowell 2014, R, Ms):

- **Visceral:** `ntsVisc`, the ventrolateral medulla and `pbn` → `pvn`, `dmh`, `lh` ([G Paraventricular_nucleus_of_hypothalamus L80]).
- **Humoral:** `portCVO` → `ovlt`, `sfo`, `areaPostrema`, `arcuate`, `mnpo`.
- **Circadian:** retinohypothalamic tract → `scn` → subparaventricular zone, `dmh`, `pvn` ([G Suprachiasmatic_nucleus L47, L59]).
- **Limbic:** `amygdala`, `cea`, `bnst`, `hippocampus` and prefrontal cortex → `pvn`, `lh`, `vmh`.
- **Thermal:** `pbn` relay → warm-sensitive preoptic neurons (Morrison & Nakamura 2011, R).
- **Metabolic:** leptin, insulin and ghrelin → `arcuate`, `lh` (§8, §9).

Thermoregulatory output is a chain: warm-sensitive preoptic neurons inhibit `dmh`, `dmh` drives `rpa`, and `rpa` drives sympathetic outflow to brown fat, skin vessels and the heart ([G Raphe_nuclei L83, L85]; Morrison & Nakamura 2011). Thresholds are in §7 and the fever shift of the set point in §10.

| id | Output | Role | Parameters |
|---|---|---|---|
| `pvn` | CRH, TRH → `portPortal`; AVP, oxytocin → `portNeurohyp`; → `rvlm`, `ntsVisc`, `dmv`, `portSymp` | stress integrator | §7, §9 |
| `son` | AVP, oxytocin → `portNeurohyp` | osmotic and volume control | §9 |
| `arcuate`; `mpoa` | GHRH, TIDA dopamine; GnRH (scalar only) | metabolic sensing; existing structure | DOPAMINE.md §5; §8, §9 |
| `mnpo` | thermoregulatory, sleep-promoting, osmotic | EP3 site of the fever shift | §7, §10 |
| `vlpo`; `scn` | GABA–galanin; circadian (VIP core, AVP shell, [G Suprachiasmatic_nucleus L49]) | sleep switch; process C | §3.11 |
| `dmh` | → `rpa`, `pvn` | thermogenesis, stress tachycardia | §7 |
| `lh`; `tmn` | orexin; histamine | arousal, feeding | §3.10, §8 |
| `vmh`; `mammillary` | defence → `pag`; → `thalAnt` | — | — |

### 3.9. Brainstem centres

| Centre | Nodes | Parameters |
|---|---|---|
| Baroreflex | `ntsVisc` → `cvlm` ⊣ `rvlm`; `ntsVisc` → `nAmbVagal`, `dmv` | §7 |
| Sympathetic premotor | `rvlm`, `pvn`, `rpa` (with `dmh`) → IML | §7 |
| Cardiac vagal | `nAmbVagal` (primary), `dmv` (minor) | §7; A.8 #17 |
| Respiration | `preBotC` (rhythm), `rtn` (CO₂), `ntsVisc` (dorsal group), `pbn` (Kölliker–Fuse) | §7 |
| Gut vagal; humoral and emetic | `ntsVisc`, `dmv`; `areaPostrema` | §8, §10 |
| PAG; descending pain control | `pag`; `pag` → `rmg` → dorsal horn; `lc` → dorsal horn | §5, §7 |
| Parabrachial relay | `pbn` | §5, §7 |
| Reticular formation | `mrf`, `pno`, `pnc`, `gi` | §3.11, §6 |
| Startle; vestibular | `cochNuc` → `pnc` → `portRS`; `vestNuc`, `flocculus`, `nodulus` | §6; §5, §6, §7 |
| Micturition | `barrington` | §7 |
| Cranial nerve nuclei | `n3 n4 n6 motV mesV prV spV n7m nAmbMotor n12 ew ssn isn dmv nAmbVagal ntsGust ntsVisc cochNuc vestNuc` | §6, §7 |

Baroreflex. Carotid sinus afferents (IX) and aortic arch afferents (X) excite glutamatergic NTS neurons. These excite the CVLM, which inhibits the RVLM with GABA, and they also excite the vagal nuclei. A rise in pressure therefore withdraws sympathetic tone and adds vagal tone ([G Baroreflex L35–L39, L47]; Guyenet 2006, R). Cardiac vagal motoneurons lie mainly in the nucleus ambiguus and are gated by respiration; the DMV mainly supplies the gut (Gilbey et al. 1984, C).

Respiration. The inspiratory rhythm arises in the preBötzinger complex (Smith et al. 1991, R), which has a human homologue (Schwarzacher, Rüb & Deller 2011). The retrotrapezoid/parafacial region adds active expiration and central CO₂ sensing (Guyenet & Bayliss 2015, R). The dorsal respiratory group integrates afferent input. The pontine group (Kölliker–Fuse and medial parabrachial nuclei, [G Respiratory_center L58]) shapes the inspiratory off-switch (Del Negro, Funk & Feldman 2018). This corrects [G Respiratory_center L40], which names the dorsal group as the rhythm generator; [G Respiratory_center L54] ("both form the solitary nucleus") is garbled (§1). `preBotC` is an `oscillator` node. It inhibits `nAmbVagal` during inspiration, which is the central source of RSA, and RSA therefore persists with the somatic network off (A.5). It also drives the bulbospinal respiratory output through `portRS` (§6).

PAG and PBN. The dorsolateral and lateral PAG columns produce active coping, with tachycardia and non-opioid analgesia. The ventrolateral column produces passive coping, with bradycardia and opioid analgesia (Bandler & Shipley 1994; Keay & Bandler 2001; C, R). The PAG projects to raphe magnus, which projects to the dorsal horn ([G Brainstem L69]; [G Raphe_nuclei L66]). The PBN relays visceral, thermal, nociceptive and gustatory signals to the hypothalamus, amygdala and insula, and it is needed for arousal (Fuller et al. 2011, R; Palmiter 2018, Ms). In primates, taste largely bypasses the PBN and runs from the NTS directly to `thalVPMpc` (Beckstead, Morse & Norgren 1980, Mk).

Reticular formation and startle. The reticular formation has three columns: median (raphe), medial (gigantocellular) and lateral (parvocellular) ([G Reticular_formation L44]). Its rostral part is modulatory and its caudal part premotor ([G Reticular_formation L39, L41]). The acoustic startle pathway runs auditory nerve → cochlear root neurons (represented by `cochNuc`) → PnC → reticulospinal output, without the colliculi ([G Startle_response L33, L47]; Davis et al. 1982, R). The capture's latency of < 10 ms is a rat value; human values are in §6. The statement in [G Brainstem L63] that the VTA is "composed of paired cerebral peduncles" is wrong and is not used.

### 3.10. Ascending modulatory systems

The ascending arousal system has two branches (Saper, Scammell & Lu 2005, R; [G Reticular_formation L80]). The dorsal branch reaches the thalamus: acetylcholine from PPN/LDT and glutamate from the parabrachial–precoeruleus complex. The ventral branch reaches the cortex through the hypothalamus and basal forebrain, carrying LC, raphe, TMN, VTA, orexin and basal forebrain output. Lesions of the parabrachial–precoeruleus complex cause a coma-like state in rats (Fuller et al. 2011).

Each system drives one pool through `volume` edges. Pools act as gains on their targets (§4) and appear as low-chroma tints on their source nuclei (§13). Each pool is its low-passed source rate divided by the `wakeRelaxed` rate (LC 2 Hz), so every pool equals 1 in `wakeRelaxed` [model]. The pool τ values lie within the capture's range of hundreds of ms to minutes ([G Volume_transmission L21]). Dopamine pools follow DOPAMINE.md §6.5.

| System | Sources | Pool | Targets; inputs | State profile |
|---|---|---|---|---|
| Noradrenergic | `lc` | `modNE` | whole neuraxis; inputs from mPFC, orexin, amygdala, cingulate, raphe ([G Locus_coeruleus L54–L63]) | tonic and phasic; ≈ 0 in REM ([G Locus_coeruleus L91]) |
| Serotonergic, rostral; caudal | `dr`, `mnr`; `rmg`, `rpa`, `rob` | `mod5HT`; none | forebrain, and `scn` through `dmh` ([G Raphe_nuclei L66, L79]); cord and brainstem | waking > NREM > REM ≈ 0 |
| Histaminergic | `tmn` | `modHA` | cortex, thalamus, basal forebrain | waking only |
| Orexinergic | `lh` | `modOX` | `lc`, `tmn`, `dr`, `vta`, `nbm` | active waking |
| Cholinergic | `nbm`, `msdb`, `hdb`; `ppn`, `ldt` | `modACh` | cortex, `hippocampus`, `amygdala`, `olfBulb` ([G Basal_forebrain L35, L41]); thalamus, basal ganglia | high in waking and REM, low in NREM; adenosine suppresses it ([G Basal_forebrain L39]) |

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| LC tonic rate: waking / NREM / REM | 1–3 / ≈ 1 / ≈ 0 | Hz | R, Mk | medium | Aston-Jones & Bloom 1981; [G Locus_coeruleus L91] |
| LC phasic burst | 2–3 spikes at 10–20 Hz (model 3 spikes at 15 Hz) | Hz | Mk | medium | Aston-Jones et al. 1994; Aston-Jones & Cohen 2005 |
| LC phasic latency; post-burst suppression | 80–150 (model 100); 300–700 (model 500) | ms | Mk | medium | Aston-Jones & Cohen 2005 |
| Dorsal raphe serotonergic rate: waking / NREM / REM | 1–5, regular / lower / ≈ 0 | Hz | C | medium | Jacobs & Fornal 1999 |
| Orexin neuron rate: active waking / sleep | a few / ≈ 0 | Hz | R | medium | Lee, Hassani & Jones 2005; Mileykovskiy, Kiyashchenko & Siegel 2005 |
| TMN rate: waking / sleep | 1–4 / ≈ 0 | Hz | Ms, C | medium | Takahashi, Lin & Sakai 2006 |
| PPN/LDT rate: waking / NREM / REM | 8 / 2 / 10 | Hz | — | low | [model]; state profile from Boucetta et al. 2014 [recalled] (R) |
| τ of `modNE`; `modACh`; `mod5HT`; `modHA`; `modOX` | 2 (1–3); 1 (0.5–2); 7 (5–10); 10; 30 (10–60) | s | — | low | [model] |

The `lc` → frontal route is 96.5 mm (§3.16). At the §4 LC axon velocity, noradrenaline therefore reaches prefrontal cortex ≈ 0.2 s after the burst leaves the nucleus, and the phasic gain boost begins ≈ 0.3 s after a salient stimulus.

### 3.11. Arousal and sleep–wake state machine

`arousalState` ∈ {`wakeAlert`, `wakeRelaxed`, `n1`, `n2`, `n3`, `rem`}.

Sleep and waking are switched by a flip-flop. VLPO/MnPO GABA–galanin neurons inhibit the arousal groups, the arousal groups inhibit them back, and orexin stabilises the waking side (Saper, Chou & Scammell 2001, R). REM is switched by a second flip-flop: REM-on sublaterodorsal neurons (here `pno`) against REM-off ventrolateral PAG neurons (Lu et al. 2006, R). The REM-on side drives atonia through `gi` and `portRS`. Process S and process C set when the switches flip (Borbély 1982; Daan, Beersma & Borbély 1984).

By default the HUD selector forces a state (A.8 #23). With the selector on "auto", the following rules apply [model]:

- The state is `n3` while procS > 0.35, and `n2` otherwise.
- The state is `n1` for the first 5 min after sleep onset and after each REM episode.
- REM closes each ultradian cycle. It lasts 10 min in the first cycle and 5 min longer in each later cycle.

Spinal and brainstem reflexes stay intact in every state; in REM, atonia lowers `reflexGain` (§6). A stimulus during sleep is compared with θ_s (§3.12) multiplied by the state's arousal factor. Above that threshold the model wakes to `wakeAlert`; a transition triggered by salience ≥ θ_s is applied as an event at the NF step of the crossing, and the 60-s CR layer updates only `procS`, `procC` and the scheduled state transitions (§11.6). Below it, the stimulus gives only a transient cortical event drawn like a K-complex [model]. The optional `sleepSound` scenario exercises this rule (§12).

| State | modNE | mod5HT | modHA | modACh | modOX | LC (Hz) | Relay gain | Mode | Motor | Arousal factor | Species | Conf. | Source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `wakeAlert` | 1.5 | 1.2 | 1.2 | 1.2 | 1.5 | 3 | 1.0 | tonic | normal | — | — | low | [model] |
| `wakeRelaxed` | 1 | 1 | 1 | 1 | 1 | 2 | 1.0 | tonic | normal | — | — | low | reference state [model] |
| `n1` | 0.75 | 0.7 | 0.5 | 0.5 | 0.3 | 1.5 | 0.6 | mixed | slightly reduced | 1.5 | — | low | [model] |
| `n2` | 0.5 | 0.5 | 0.1 | 0.25 | 0.1 | 1 | 0.35 | burst | reduced | 2.5 | R, C | medium (pattern), low (values) | see note |
| `n3` | 0.4 | 0.4 | 0.05 | 0.15 | 0.05 | 0.8 | 0.2 | burst | reduced | 3.5 | R, C | medium (pattern), low (values) | see note |
| `rem` | 0 | 0 | 0 | 1.0 | 0.1 | ≈ 0 | 0.5 | tonic | atonia except eye and respiratory muscles | 3.0 | R, C | medium (pattern), low (values) | see note |

Note: the state patterns come from Saper, Scammell & Lu 2005; Aston-Jones & Bloom 1981; Jacobs & Fornal 1999; Lee, Hassani & Jones 2005; [G Locus_coeruleus L91]; and [G Basal_forebrain L39]. The grading, relay gains and arousal factors are [model].

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Free-running circadian period `T_circ` | 24.2 (24 h 11 min) | h | H | high | Czeisler et al. 1999; [G Suprachiasmatic_nucleus L61] |
| Entrained period | 24.0 | h | — | low | [model] |
| Process C | procC = cos(2π (t_clock − 17 h)/24 h) | — | — | low | [model] |
| Process S rise τ in waking, dS/dt = (1 − S)/τ_r; decay τ in sleep, dS/dt = −S/τ_d | 18.2; 4.2 | h | H | medium | Daan, Beersma & Borbély 1984 [unverified]; same values in secondary implementations |
| Sleep-onset threshold H⁺; waking threshold H⁻ | 0.63 + 0.12·procC; 0.20 + 0.12·procC | — | — | low | [model] |
| NREM–REM cycle; first REM episode after sleep onset | ≈ 90 (70–120); ≈ 70–90 | min | H | medium | [T] |
| REM share of sleep | ≈ 20–25 | % | H | medium | [T] |
| Spindles, human scoring band (`thalRet`) | 11–16 | Hz | H | medium | [T] (AASM scoring manual) |
| Spindle and slow-oscillation mechanism (`thalRet`, thalamocortical) | 7–14; < 1 | Hz | C | high | Steriade, McCormick & Sejnowski 1993 |
| Delta; theta; alpha; beta | 0.5–4; 4–8; 8–12; 13–30 | Hz | H | medium | [T] |
| Gamma (paced by basal forebrain parvalbumin neurons) | 30–80 | Hz | R, Ms | medium | [G Basal_forebrain L41] |

Model check (scratch script, not a source): in the steady state the model sleeps from 23:06 to 06:59 (7.9 h). procS is ≈ 0.63 at sleep onset and falls below 0.35 after ≈ 2.5 h. REM episodes of 10–30 min over five cycles give ≈ 21 % REM. EEG bands appear only as a schematic trace in the readout and are never rendered as luminance oscillations (§13).

### 3.12. Salience and large-scale networks

Every stimulus receives a salience score:

salience = min(1, I_n · N · (b + c))

- I_n is the perceived magnitude `psi`, normalised to the range of its modality (§5).
- N is novelty: 1 − habituation, computed from `predErr` (§4) and the habituation rules of §5.
- b is a baseline weight and c a class weight (table below).

When salience ≥ θ_s (multiplied by the arousal factor during sleep), the following happen:

- `lcPhasic` is set to the salience value, and an LC burst follows after the §3.10 latency. No second burst can occur during the post-burst suppression.
- `insAnt` and `dacc` are activated.
- `dlpfc` and `ppc` gain activity, while `pcc`, `precuneus`, `mpfc` and `angular` are suppressed (Sridharan, Levitin & Menon 2008, H; Menon & Uddin 2010).
- Sensory and executive nodes receive the noradrenergic gain boost of §4.
- With the body on, `cea` drives `lh`, `pag`, `pvn` and `nAmbVagal`.

The pupil readout uses the kernel of §7. Repeating a stimulus lowers N (§12).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| θ_s; b | 0.25; 0.3 | — | — | low | [model] |
| c: noxious above pain threshold; sound ≥ 90 dB SPL or aversive odour; flash ≥ 1,000 cd/m² or food odour/taste (× hunger, §8); interoceptive above its sensation threshold (§5); innocuous touch, tone, vestibular or proprioceptive stimulus | 0.9; 0.6; 0.4; 0.3; 0 | — | — | low | [model] |
| Executive / default-mode activity change per unit salience | +0.3 / −0.3 | relative | — | low | [model]; direction from Sridharan, Levitin & Menon 2008 |
| Haemodynamic response peak; undershoot minimum | 5 (4–6); 12–16 (model 15) | s | H | high | Boynton et al. 1996; Glover 1999 |
| Model HRF (t in s) | h(t) = t⁵e^(−t)/Γ(6) − t¹⁵e^(−t)/(6·Γ(16)) | — | H | medium | [T] |
| Resting-state band; networks by parcellation | 0.01–0.1 Hz; 7–17 | — | H | medium; high | [T]; Yeo et al. 2011 |

Large-scale networks are correlation patterns in fMRI, not anatomical tracts, and no universal atlas of them exists ([G Large-scale_brain_network L27, L35]; Raichle et al. 2001; Seeley et al. 2007; Uddin, Yeo & Spreng 2019). They appear only as an optional overlay labelled "functional connectivity (fMRI correlation)", off by default (A.8 #23), with activity passed through the HRF (§13). Members ([G Large-scale_brain_network L41, L47, L54, L60]):

- Default mode: `pcc precuneus mpfc angular hippocampus entorhinal parahipp`.
- Salience: `insAnt dacc nacc vta snc amygdala hypothalamus pag`.
- Executive: `dlpfc ppc`.
- Dorsal attention: `fef ips`.
- Ventral attention: `tpj insAnt`.
- Sensorimotor: `m1 s1 sma`.
- Visual: `v1 v4 mt`.

### 3.13. Voluntary action and response timing

A voluntary response follows one route in the model:

1. The stimulus is represented in sensory cortex (latencies §5).
2. It is evaluated in `dlpfc`, `insAnt`/`dacc` and `ppc`.
3. The motor channel of the basal ganglia releases the action (§3.5).
4. `thalVL`/`thalVA` drive `sma` and `pmd`.
5. `m1` sends the command through `portCST` (CMCT §6), with an efference copy to `pontineNuc` (§3.6).
6. The muscle responds after the electromechanical delay of §4.

The part of a reaction time that remains after sensory latency, CMCT and electromechanical delay is set by node τ and the §3.5 release criterion. §12 checks the totals.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Simple reaction time: visual; auditory | 200–250 (model 220); 150–180 (model 160) | ms | H | medium | [T] |
| Simple reaction time: touch | 150–200 (model 170) | ms | H | low | [T] |

### 3.14. Brain ports

Ports are the only points where signals cross between the brain graph and the body networks. Junction ports sit at z = −72, at the (ξ, η) of their tract in the §6 tract map. Supraspinal ports sit at the §3.16 nerve attachments. A port edge runs only if `bodyMode = 'body'` and all of its `nets` are on (A.5). In brain-only mode, the special-sense ports are fed at the first central station (A.8 #5), and efferent ports end in "efference only" packets that fade out.

| id | Brain-side nodes | Signals | `nets` | Brain only |
|---|---|---|---|---|
| `portDC` | `gracile`, `cuneate` → contralateral `thalVPL` (crossed medial lemniscus, §3.16; [G Dorsal_column_E2_80_93medial_lemniscus_pa L44, L48]); spinocerebellar input → cerebellar cortex | touch, vibration, proprioception | `somatic` | silent |
| `portSTT` | `thalVPL`, `thalVMpo`, `thalCM`, `thalMD`; collaterals → `pbn`, `pag`, `mrf`, `gi`, `lc` | pain, temperature, itch, crude and affective touch | `somatic` | silent |
| `portTrig` | `prV`, `spV` → contralateral `thalVPM` (crossed trigeminal lemniscus and spinal trigeminothalamic route; minor uncrossed dorsal tract from `prV` for the oral cavity, §3.16); `spV` → contralateral `thalVMpo`; `mesV` (jaw proprioception) | facial touch, pain, temperature; jaw proprioception | `somatic` | silent |
| `portVisc` | `ntsVisc` → `cvlm`, `nAmbVagal`, `dmv`, `pbn`, `pvn`, `son` | baroreceptor, chemoreceptor, lung, gut and immune afferents | `autonomic` (immune afferents `autonomic ∧ neuroimmune`) | silent; NTS baseline falls |
| `portGust` | `ntsGust` → `thalVPMpc` | taste (VII, IX, X) | [] | fed at `ntsGust` |
| `portSpinoVisc` | `ntsVisc`, `pbn`, `thalVMpo`, `thalVPL` | bladder, colorectal and cardiac spinal afferents | `autonomic` | silent |
| `portCVO` | `areaPostrema`, `ovlt`, `sfo`, `medianEminence`; PGE2 → `mnpo` | hormones; cytokines and PGE2; osmolality and glucose | `neuroendocrine`; `neuroimmune`; `tissue` | clamped at basal |
| `portVest` | `vestNuc` → `n3`, `n4`, `n6`, `portRS`, `thalVPL`, `flocculus`, `nodulus`, `rvlm` | rotation, linear acceleration, tilt | [] | fed at `vestNuc` |
| `portCoch` | `cochNuc` → trapezoid body → contralateral `soc` → `ic` → `mgn` → `a1` (main crossed route; uncrossed branch at lower weight, §3.16); `cochNuc` → `pnc` | sound | [] | fed at `cochNuc` |
| `portRetina` | optic nerve → `lgn`, `sc`, `opn`, `scn` | light | [] | fed at the optic nerve head |
| `portOlf` | `olfBulb` → `piriform`, `olfTubercle`, `amygdala`, `entorhinal` | odour | [] | fed at `olfBulb` |
| `portCST` | `m1`, `pmd`, `sma`, `s1` | voluntary commands | `somatic` | efference only |
| `portRS` | `gi`, `pnc`, `pno`, `vestNuc`, `redNucleus`, `rmg`, `lc`; bulbospinal output of `preBotC` | posture, startle, REM atonia, breathing drive, descending pain control | `somatic` (startle `special ∧ somatic`) | efference only |
| `portCranMotor` | `n3`, `n4`, `n6`, `motV`, `n7m`, `nAmbMotor`, `n12` (XI through `n11`, §6) | eye, jaw, face, pharynx, larynx, tongue | `somatic` | efference only |
| `portSymp` | `rvlm`, `pvn`, `rpa`, `lh` | heart, vessels, sweat glands, adrenal medulla, brown fat, pupil dilator | `autonomic` | efference only |
| `portVag` | `nAmbVagal`, `dmv` | heart; gut; cephalic phase; inflammatory reflex | `autonomic` (gut `autonomic ∧ enteric`; immune `autonomic ∧ neuroimmune`) | efference only |
| `portPara` | `ew`, `ssn`, `isn` | pupil constriction, accommodation, tears, saliva | `autonomic` (light reflex `special ∧ autonomic`) | efference only |
| `portSacral` | `barrington`, `pag` | drive to the sacral parasympathetic nucleus | `autonomic` | efference only |
| `portPortal` | `pvn`, `arcuate`, `mpoa` → `medianEminence` | releasing hormones; TIDA dopamine (DOPAMINE.md) | `neuroendocrine` | commands shown as tints |
| `portNeurohyp` | `pvn`, `son` → `pituitaryPost` | AVP, oxytocin | `neuroendocrine` (baroreceptor-driven AVP `autonomic ∧ neuroendocrine`) | commands shown as tints |
| `portImmune` | logical port: `dmv` through `portVag`; `rvlm`, `pvn` through `portSymp`; `pvn` through `portPortal` | inflammatory reflex, splenic sympathetic drive, glucocorticoid brake | `autonomic ∧ neuroimmune`; glucocorticoid branch `neuroendocrine ∧ neuroimmune` | efference only |

Spinocerebellar input enters through `portDC`; no separate port is added. The inflammatory-reflex route follows A.8 #16 and §10.

### 3.15. Brain-graph nodes and principal edges

This section adds 89 new region ids:

| Group | New region ids |
|---|---|
| Thalamus | 13 |
| Basal ganglia, basal forebrain, limbic | 9 |
| Hypothalamus and circumventricular organs (`scn` is an `oscillator`, `pineal` a `gland`) | 14 |
| Brainstem, cerebellar and olfactory nuclei (`preBotC` is an `oscillator`) | 47 |
| Splits (`gpe`, `dr` and `pituitaryAnt` reuse the old ids) | 6 |

`REGION_COUNT` therefore rises from 33 to ≈ 122. Cortical areas (38 ids, with five sub-sites each for `s1` and `m1`), the 21 ports and the 5 pools are not regions. The brain contributes ≈ 200 node ids and, by the lens estimate, ≈ 350–400 edges; §11 owns the graph totals.

Each edge has the delay d = L/v + n_syn·t_syn [model]:

- L is the §3.16 route length where one is listed, and otherwise 1.2 × the distance between node centres.
- v is the §4 velocity of the tract class (default: "other CNS").

CNS edges have `nets = []`.

| From → to | Sign / transmitter |
|---|---|
| relay nuclei → areas; L6 → relay nuclei; `thalRet` → relay nuclei; `ppn`, `ldt` → thalamus | +; + (modulatory); −; + / Glu, GABA, ACh |
| `gracile`, `cuneate` → contralateral `thalVPL`; `prV`, `spV` → contralateral `thalVPM` (`spV` also → contralateral `thalVMpo`), with `prV` → ipsilateral `thalVPM` at weight 0.2; `cochNuc` → contralateral `soc`, `ic`, with the ipsilateral branch at weight 0.4 (crossed; routes §3.16) | + / Glu |
| frontal cortex → striatum; D1 → `gpi`, `snr`; D2 → `gpe`; `gpe` → `stn`, `gpi`; `stn` → `gpi`, `snr`, `gpe`; `m1`, `sma`, `preSma` → `stn` | +; −; −; −; +; + / Glu, GABA with SP (D1) or Enk (D2) |
| `gpi`, `snr` → `thalVA`, `thalVL`, `thalMD`, `sc`, `ppn`; `snc` → striatum | − / GABA; D1 +, D2 − / DA (`volume`, DOPAMINE.md) |
| cortex → `pontineNuc` → crossed cerebellum; Purkinje cells → deep nuclei; `flocculus` → `vestNuc`; `dentate` → `thalVL`, `interposed` → `redNucleus` (crossed); `io` → Purkinje cells | +; −; −; +; + / Glu, GABA |
| BLA → `cea`, `bnst`; `cea` → `lh`, `pag`, `pbn`, `lc`, `bnst`, `dmv`, `nAmbVagal`, ↔ `insAnt` | +; net + / Glu; GABA, peptides |
| `hippocampus` → `bnst` → `pvn` CRH neurons; `mammillary` → `thalAnt`; `insPost` → `insMid` → `insAnt` ↔ `dacc` | −; +; + / Glu, GABA |
| `scn` → `dmh`, `pvn`; `vlpo`, `mnpo` ⊣ `lc`, `dr`, `mnr`, `tmn`, `lh`, `ppn`, `ldt`; `lc`, `dr` ⊣ `vlpo`; `lh` → `lc`, `tmn`, `dr`, `nbm`, `vta` | ±; −; −; + / GABA, AVP, galanin, NA, 5-HT, orexin |
| `habenula` → `rmtg` ([G Ventral_tegmental_area L57]; DOPAMINE.md §5 GABA term) | + / Glu |
| `mnpo` ⊣ `dmh` → `rpa` → `portSymp`; `pvn` → `rvlm`, `ntsVisc`, `dmv`, `portSymp` | −, +, +; + / GABA, Glu, AVP, OT |
| `portVisc` → `ntsVisc` → `cvlm` ⊣ `rvlm` → `portSymp`; `ntsVisc` → `nAmbVagal`, `dmv` → `portVag` | +, +, −, +; + / Glu, GABA, ACh |
| `preBotC` ⊣ `nAmbVagal` (during inspiration); `rtn` → `preBotC` | −; + / GABA, Gly; Glu |
| `pag` dl/l → `rvlm`; `pag` vl → `rmg` → `portRS`; `lc` → `portRS` | +; + then ON cells + / OFF cells −; − / Glu, 5-HT, Enk, NA (α2) |
| `cochNuc` → `pnc` → `portRS`; `vestNuc` → `n3`, `n4`, `n6`, `portRS`, `rvlm`; `ntsGust` → `thalVPMpc`; `areaPostrema` → `ntsVisc`; `barrington` → `portSacral` | + (VOR push–pull ±) / Glu, Gly, GABA |
| `lc`, `dr`/`mnr`, `tmn`, `nbm`/`msdb`/`hdb`/`ppn`/`ldt`, `lh` → `modNE`, `mod5HT`, `modHA`, `modACh`, `modOX` | + (`volume`) |

### 3.16. MNI coordinates of new brain structures

Extents are ellipsoid half-axes (x, y, z) or tube points [x, y, z, r]. The structures were checked against the post-port geometry (DOPAMINE.md §7.3 applied in Phase 0a, B.15; perpendicular-section tube test and Monte Carlo volume overlaps, `verify-editor/bs.mjs`):

- Brainstem centres lie inside the `BRAINSTEM` spline tube with its post-port first point (0, −24, −4, 12, 8) at normalised r² 0.00–0.93. Exceptions: `cochNuc` (1.22) protrudes laterally as the real nuclei do; `sc` (1.17) and `ic` (1.04) sit on the dorsal tube boundary and get tectal bumps (§3.17); `io` (centre 0.65) bulges as the olive, with 20 % of its volume outside the tube. The `spV` tube ends inside the tube (r² 0.91). The first-point change moves only midbrain values (`sc` 0.82 → 1.17, `opn` 0.71 → 0.50, `redNucleus` 0.17 → 0.26); medullary and pontine values are unchanged.
- Nuclei were also checked pairwise. No centre lies inside another new nucleus. `preBotC` shares 0 % of its volume with `io`, and the XII attachment lies medial to the olive (r² 2.61 against `io`). Remaining overlaps ≥ 10 % are adjacent cell groups whose real borders interdigitate: `cochNuc`–`vestNuc` 27 %, `dmv`–`ntsVisc` 16 %, `prV`–`pbn` 13 %, `cvlm`–`io` 13 %, `nAmbVagal`–`nAmbMotor` 12 %, `motV`–`pbn` 10 %, `mrf`–`ic` 10 %. Against the generous existing `pag` ellipsoid: `sc` 43 % (centre r² 0.98), `dr` 42 %, `ew` 29 %. Any later coordinate must pass both tests.
- Cortical patch centres lie 0.4–27.7 mm inside `sdCerebrum`.
- The new cerebellar nuclei lie 2.1–7.9 mm inside `sdCerebellum`.
- `olfBulb` sits 2 mm below the frontal hull.

Structures under ≈ 50 mm³ are drawn enlarged (§13). The source is [T] and the confidence low unless stated otherwise.

| Structure | id | Position (x, y, z) mm | Extent mm | Frame | Conf. | Source |
|---|---|---|---|---|---|---|
| Thalamus: anterior; MD; VA; VL | `thalAnt`; `thalMD`; `thalVA`; `thalVL` | (7, −7, 13); (6, −17, 8); (12, −8, 7); (14, −15, 5) | (2.5, 3, 2.5); (3.5, 6, 4); (3, 3, 3); (3.5, 4, 4) | MNI | low | [T] |
| VPL; VPM; VPMpc; VMpo | `thalVPL`; `thalVPM`; `thalVPMpc`; `thalVMpo` | (18, −21, 3); (14, −21, 1); (12, −19, −1); (11, −23, −1) | (3, 3.5, 3); (2.5, 3, 2.5); (1.5, 2, 1.5); (1.5, 2, 1.5) | MNI | low | [T]; Craig 2002 (VMpo) |
| CM–Pf; pulvinar; reticular nucleus | `thalCM`; `thalPulv`; `thalRet` | (9, −20, 2); (16, −29, 6); (19, −16, 6) | (2.5, 3, 2.5); (5, 6, 5); 1-mm shell | MNI | low | [T]; [G Thalamus L106] |
| LGN; MGN; habenula | `lgn`; `mgn`; `habenula` | (22, −25, −5); (15, −26, −6); (3.5, −25, 2) | (3, 4, 2.5) ≈ 126 mm³; (2.5, 3, 2.5); (1.5, 2, 1.5) | MNI | low | Andrews, Halpern & Purves 1997 (LGN volume) |
| GPe; GPi | `gpe`; `gpi` | (22, −2, 1); (17, −6, −3) | (3, 9, 6); (2.5, 6, 4) | MNI | low | [T] |
| STN | `stn` | (12, −13, −5) | (2.5, 5, 2.5); long axis anterolateral-superior → posteromedial-inferior | MNI | medium | DOPAMINE.md §2.4 |
| SNr; ventral pallidum | `snr`; `vp` | (13, −14, −11); (13, 4, −6) | (3, 6, 2.5); (3, 4, 2.5) | MNI | low | Keuken et al. 2014 (orientation) |
| Nucleus basalis (Ch4) | `nbm` | [13, 4, −10, 2], [19, −2, −9, 2.5], [24, −9, −8, 2], [28, −16, −9, 1.5] | tube | MNI | low | Zaborszky et al. 2008 (centroid estimated) |
| Ch1–2; Ch3; BNST | `msdb`; `hdb`; `bnst` | (2, 6, −3); (10, 4, −13); (7, 2, 0) | (1.5, 3, 3); (3, 2, 1.5); (2, 3, 3) | MNI | low | [T] |
| Central amygdala | `cea` | (22, −6, −14) | (2.5, 3, 2.5) | MNI | low | DOPAMINE.md §2.4 |
| Olfactory tubercle; olfactory bulb | `olfTubercle`; `olfBulb` | (13, 8, −14); (8, 36, −25) | (3, 3, 1.5); (2, 5, 1.5) | MNI | low | [T] |
| SCN; SON; VLPO | `scn`; `son`; `vlpo` | (2, 2, −13); (10, 0, −14); (6, 3, −12) | drawn (1.5, 2, 1.5), real ≈ (1, 1.2, 1); (1.5, 3, 1.2); (1.5, 2, 1.5) | MNI | low | [G Suprachiasmatic_nucleus L41]; Saper, Scammell & Lu 2005 |
| MnPO; OVLT; SFO | `mnpo`; `ovlt`; `sfo` | (0, 4, −8); (0, 6, −11); (0, −2, 10) | (1, 2, 3); (1, 1, 1.5); (1, 1.5, 1) | MNI, mid | low | [T] |
| LH orexin field; TMN; DMH | `lh`; `tmn`; `dmh` | (6, −10, −9); (6, −12, −14); (4, −8, −6) | (3, 4, 3); (2, 2.5, 1.5); (1.5, 2, 2) | MNI | low | Thannickal et al. 2000 (distribution) |
| VMH; mammillary bodies | `vmh`; `mammillary` | (4.5, −6, −11); (3, −11, −14) | (2, 2.5, 2) each | MNI | low | [model] (VMH moved clear of `arcuate`); DOPAMINE.md §2.4 |
| Area postrema; median eminence; pineal gland | `areaPostrema`; `medianEminence`; `pineal` | (0, −44, −56); (0, −6, −15); (0, −32, 1) | (2, 1, 2); (2.5, 2.5, 1.5); (3, 4, 3) | MNI, mid | low | [T]; DOPAMINE.md §2.4 |
| Pituitary lobes | `pituitaryAnt`; `pituitaryPost` | part of the `pituitary` ellipsoid with y > −2; y ≤ −2 | — | MNI, mid | low | A.3.3 |
| Locus coeruleus | `lc` | [4.1, −36.2, −18, 0.9], [5.2, −36.9, −24, 1.4], [5.8, −37.2, −27, 1.4], [6.4, −37.7, −30, 1.2], [7.6, −38.5, −33, 0.8] | tube, drawn enlarged | MNI | medium | Keren et al. 2009; mean right LC (5.4, −37.9, −24.7) via Astafiev et al. 2010 [secondary] |
| Raphe: dorsal; median; magnus; pallidus; obscurus | `dr`; `mnr`; `rmg`; `rpa`; `rob` | (0, −30, −13); (0, −29, −22); (0, −31, −40); (0, −29, −50); (0, −35, −52) | (2.5, 3, 5); (2, 3, 4); (2, 3, 5); (1.5, 2, 5); (1.5, 2, 6) | MNI, mid | low | [T] |
| PPN; LDT; PBN | `ppn`; `ldt`; `pbn` | (7, −31, −19); (3, −36, −19); (9, −35, −26) | (2, 3, 4); (1.5, 2, 3); (2, 2.5, 4) | MNI | low | [T]; Singh et al. 2020 (PBN volume) |
| PnO; PnC; Gi; MRF | `pno`; `pnc`; `gi`; `mrf` | (4, −31, −24); (4, −32, −34); (3, −35, −45); (6, −32, −12) | (3, 3, 4); (3, 3, 4); (2.5, 3, 6); (2.5, 2.5, 3) | MNI | low | [G Startle_response L33] (PnC) |
| Vestibular nuclei | `vestNuc` | (9, −37, −40) | (3, 2.2, 5) | MNI | low | Singh et al. 2020 (volume); 1 mm anterior of the lens value [model] |
| NTS rostral; NTS caudal; DMV | `ntsGust`; `ntsVisc`; `dmv` | (5, −39, −44); (3.5, −42, −53); (3, −40, −51) | (1.5, 1.5, 3); (1.8, 1.8, 5); (1, 1.2, 6) | MNI | low | [T]; NTS split [model] |
| Nucleus ambiguus: branchiomotor; cardiac vagal (external formation, ventrolateral) | `nAmbMotor`; `nAmbVagal` | (7.5, −38, −50); (7.5, −36.5, −52.5) | (1, 1.2, 5); (1, 1, 4) | MNI | low | [G Respiratory_center L48]; split [model]; moved 2.5–3 mm dorsal with `preBotC` |
| RVLM; CVLM | `rvlm`; `cvlm` | (6.5, −33, −45), at the rostral pole of the olive; (6, −34, −56) | (2, 2, 3); (1.8, 1.8, 3) | MNI | low | [G Baroreflex L37] |
| preBötC; RTN/pFRG; inferior olive | `preBotC`; `rtn`; `io` | (6.5, −35, −51), dorsal to the olive and ventral to `nAmbVagal`; (9, −26, −43); (5, −31.5, −53), mostly intramedullary with a ventrolateral bulge | (1.5, 1.2, 2); (2, 1.5, 3); (2.5, 2, 6.5) | MNI | low | Schwarzacher, Rüb & Deller 2011; Guyenet & Bayliss 2015; preBötC dorsal to the olive [T]. The draft centres (7, −32, −51) and (5.5, −31, −52) put 88 % of `preBotC` inside `io` |
| Gracile; cuneate | `gracile`; `cuneate` | (2.5, −44, −62); (5.5, −43, −60) | (1.5, 1.5, 4) each | MNI | low | [T] |
| Trigeminal: spinal; principal; mesencephalic; motor | `spV`; `prV`; `mesV`; `motV` | [8, −38, −42, 1.5] → [6.5, −42.5, −70, 1.5] (the draft end [8, −42, −72] lay outside the tube, r² 1.50); (11, −33, −28); [7, −36.5, −26, 0.8] → [6, −33, −10, 0.8]; (8, −32, −28) | tube; (2, 2, 3); tube; (1.5, 2, 2.5) | MNI | low | [T] |
| Cochlear nuclei; SOC | `cochNuc`; `soc` | (12, −36, −40); (8, −30, −34) | (2, 2, 3) each | MNI | low | Sitek et al. 2019 (centroids not retrieved) |
| IC; SC; olivary pretectal nucleus | `ic`; `sc`; `opn` | (6, −36, −11); (5, −32, −4); (6, −28, −1) | (3, 3, 3); (3, 2.5, 2.5); (1.5, 1.5, 1.5) | MNI | low | [T] |
| EW; III; IV; VI | `ew`; `n3`; `n4`; `n6` | (2, −26, −6); (3, −25, −9); (3, −30, −15); (4, −37, −34) | (1, 1.5, 2); (1.5, 2, 2.5); (1, 1, 1.2); (1.2, 1.2, 1.5) | MNI | low | [T] |
| VII motor; XII; SSN; ISN; Barrington's nucleus | `n7m`; `n12`; `ssn`; `isn`; `barrington` | (10, −31, −38); (1.5, −40, −54); (6, −33, −39); (6, −36, −46), clear of `gi` and `ntsGust`; (4, −35, −27) | (1.5, 1.5, 2.5); (1, 1, 5); (1, 1, 1.5); (1, 1, 1.5); (1, 1.5, 1.5) | MNI | low | [T] |
| Red nucleus; basilar pontine nuclei | `redNucleus`; `pontineNuc` | (5, −20, −8); (7, −20, −32) | (2.5, 3, 3); (6, 5, 8) | MNI | medium; low | DOPAMINE.md §2.4; [T] |
| Fastigial; interposed; flocculus; nodulus (mid) | `fastigial`; `interposed`; `flocculus`; `nodulus` | (5, −53, −27); (10, −55, −31); (25, −44, −36); (0, −50, −33) | (1.5, 2.5, 1.5); (1.5, 3, 2); (4, 4, 3); (4, 3, 3) | MNI | low | [T] |
| V1; hV4; hMT+; FFA | `v1`; `v4`; `mt`; `ffa` | (10, −86, 4); (30, −78, −14); (46, −72, 4); (40, −52, −18) | radius 15; 8; 8; 6 | MNI | medium (hV4 low) | Dumoulin et al. 2000 (MT, approx.) |
| A1 (TE1.0); planum temporale | `a1`; `pt` | (48, −18, 6); (54, −28, 12) | radius 7; 8 | MNI | medium; low | Morosan et al. 2001 (approx.) |
| S1 hand, face, trunk, leg, foot | `s1.hand` … `.foot` | (40, −30, 58); (56, −14, 34); (20, −42, 70); (8, −42, 72); (4, −40, 64) | radius 6–8 | MNI | medium (hand, face) | [T] |
| Area 3a; area 2 | `ba3a`; `ba2` | (36, −26, 50); (42, −36, 56) | radius 5; 6 | MNI | low | [T] |
| M1 hand, face, trunk, leg, foot | `m1.hand` … `.foot` | (38, −22, 58); (54, −6, 34); (22, −18, 68); (12, −22, 72); (6, −26, 72) | radius 6–8 | MNI | medium (hand, face, foot) | Yousry et al. 1997 (approx.) |
| SMA; pre-SMA; PMd; PMv; FEF | `sma`; `preSma`; `pmd`; `pmv`; `fef` | (4, −6, 62); (6, 14, 56); (26, −10, 62); (52, 8, 24); (30, −4, 54) | radius 8; 8; 8; 8; 6 | MNI | medium (PMd, PMv low) | Paus 1996 (FEF, approx.) |
| S2 (OP1); PIVC (OP2) | `s2`; `pivc` | (52, −24, 20); (40, −20, 18) | radius 7; 5 | MNI | medium; low | Eickhoff et al. 2006; zu Eulenburg et al. 2012 (approx.) |
| Insula: dorsal posterior; mid; anterior | `insPost`; `insMid`; `insAnt` | (38, −16, 6); (38, −2, 6); (36, 18, 0) | sub-patches of the insular sheet; `insAnt` lies in the DOPAMINE.md §7.3 ribbon (§3.17) | MNI | medium | Craig 2002; Seeley et al. 2007; DOPAMINE.md §2.4 |
| Gustatory insula; frontal-opercular field; piriform; olfactory OFC | `gust`; `areaG`; `piriform`; `ofcOlf` | (38, 2, 10); (44, 10, 8); (22, 2, −18); (24, 34, −14) | radius 6; 5; 6; 6 | MNI | low | [G Insular_cortex L81] |
| DLPFC; PPC; IPS; angular gyrus; TPJ | `dlpfc`; `ppc`; `ips`; `angular`; `tpj` | (42, 32, 28); (46, −52, 48); (30, −56, 50); (46, −70, 34); (54, −50, 22) | radius 10; 10; 10; 10; 8 | MNI | medium | Seeley et al. 2007; Yeo et al. 2011; Andrews-Hanna et al. 2010 (approx.) |
| PCC; precuneus; mPFC; RSC | `pcc`; `precuneus`; `mpfc`; `rsc` | (4, −54, 28); (4, −62, 46); (4, 52, 2); (6, −50, 12) | radius 10; 10; 10; 5 | MNI | medium (RSC low) | Raichle et al. 2001; Fox et al. 2005 (approx.) |
| dACC; sgACC; pgACC | `dacc`; `sgacc`; `pgacc` | (4, 24, 34); (4, 18, −10); (4, 38, 10) | radius 8; 5; 6 | MNI | medium (sgACC low) | Seeley et al. 2007; Öngür & Price 2000; DOPAMINE.md §2.4 |
| Entorhinal; parahippocampal cortex | `entorhinal`; `parahipp` | (24, −10, −32); (26, −32, −16) | radius 6 each | MNI | low | [T] |
| Nerve attachments: I (`portOlf`); optic nerve head (`portRetina`); chiasm | `cn1`; `cn2`; `cn2.chiasm` | (8, 36, −27); (30, 48, −39); (0, 3, −18) | —; —; (7, 4, 2) | MNI | low | optic nerve head 12 mm behind the A.2 globe centre, 3 mm nasal [T]; this row owns the optic nerve head, which §2.3 references |
| III; IV; V (`portTrig`); VI | `cn3`; `cn4`; `cn5`; `cn6` | (5, −14, −14); (4, −38.5, −16); (17, −27, −30); (4, −21, −42) | — | MNI | low | [T] |
| VII; VIII (`portVest`, `portCoch`); IX; X (`portVisc`, `portVag`); XI cranial rootlets; XII | `cn7`; `cn8`; `cn9`; `cn10`; `cn11`; `cn12` | (13, −29, −41); (14.5, −32, −41); (9.5, −33, −47); (9.5, −35, −51); (8.5, −37, −56); (3.5, −28.5, −53), preolivary sulcus medial to the olive | — | MNI | low | [T]; these attachments are the CNS ends of the §2.12 routes |

Principal CNS routes are given as polyline waypoints, which packets and edge lengths use. The lengths are model checks; standard path lengths remain owned by §2. Routes start at the right-side nucleus; a route that crosses passes through its midline decussation point and ends at the left-side (x < 0) target, and the mirrored route serves the left nucleus.

| Structure | id | Position (x, y, z) mm | Extent mm | Frame | Conf. | Source |
|---|---|---|---|---|---|---|
| Medial lemniscus (crossed) | `tractML` | `cuneate` or `gracile` → internal arcuate decussation (0, −38, −52) → (−4, −36, −48) → (−5, −30, −32) → (−8, −25, −15) → (−14, −22, −3) → contralateral `thalVPL` (−18, −21, 3) | r 1.5 | MNI | low | [G Dorsal_column_E2_80_93medial_lemniscus_pa L44, L48]; [T]; 73.0 mm from `cuneate`, 74.0 from `gracile` (= §2.14) |
| Spinothalamic tract, brain part | `tractSTT` | (5, −42, −72) → (8, −36, −50) → (10, −30, −30) → (10, −26, −12) → `thalVPL`; branches to `thalVMpo`, `pbn`, `pag` | r 1.5 | MNI | low | [T]; 80.1 mm |
| Trigeminal lemniscus (ventral trigeminothalamic tract, crossed); somatosensory radiation | `tractTrigLem`; `tractThalS1` | `prV` → decussation (0, −30, −24) → (−8, −28, −15) → contralateral `thalVPM` (−14, −21, 1); `thalVPL` → (26, −24, 20) → `s1.hand` | r 1; 2 | MNI | low | [T]; 42.8; 60.0 mm |
| Spinal trigeminothalamic route (crossed) | `tractTrigSp` | `spV` caudalis (7, −41, −60) → (0, −38, −52) → (−8, −36, −45) → (−10, −30, −30) → (−10, −26, −12) → contralateral `thalVPM` (−14, −21, 1); branch → contralateral `thalVMpo` (−11, −23, −1) | r 1 | MNI | low | [T]; 71.1 mm (VMpo branch 68.0) |
| Dorsal trigeminothalamic tract (uncrossed, oral cavity; weight 0.2 [model]) | `tractTrigDors` | `prV` → (8, −28, −15) → ipsilateral `thalVPM` | r 0.7 | MNI | low | [T]; 32.7 mm |
| Auditory brainstem path, main crossed branch; uncrossed branch (weight 0.4 [model]); acoustic radiation | `tractLatLem`; `tractLatLemU`; `tractAcRad` | `cochNuc` → trapezoid body (0, −30, −36) → contralateral `soc` (−8, −30, −34) → (−10, −33, −22) → contralateral `ic` (−6, −36, −11) → (−11, −31, −7) → `mgn` (−15, −26, −6); `cochNuc` → `soc` → (10, −33, −22) → `ic` → (11, −31, −7) → `mgn`; `mgn` → (30, −22, 2) → `a1` (same side as its `mgn`) | r 1; 0.7; 2 | MNI | low | [T]; 61.5; 48.6; 36.3 mm |
| Optic nerve and tract; optic radiation | `tractOptic`; `tractOptRad` | `cn2` → optic canal (12, 22, −26) (the §2.3 route) → chiasm → (12, −6, −14) → (18, −16, −10) → `lgn`; `lgn` → (32, −45, 0) → (25, −75, 4) → `v1` | r 2; 3 | MNI | low | [T]; 96.9; 72.6 mm |
| Corticospinal tract, brain part | `tractCST` | `m1.hand` → (28, −18, 30) → (22, −14, 8) → (14, −16, −12) → (8, −20, −30) → (3, −31, −55) → (0, −40, −72) | r 3 | MNI | low | [T]; 141.4 mm |
| SCP; MCP | `tractSCP`; `tractMCP` | `dentate` (15, −57, −35) → (10, −45, −28) → (0, −27, −14) → left `redNucleus` → left `thalVL`; `pontineNuc` → (0, −18, −34) → (−18, −38, −32) → (−25, −60, −40) | r 2; 4 | MNI | low | [T]; 66.7; 59.0 mm |
| Dorsal noradrenergic bundle | `tractDNB` | `lc` → (5, −28, −10) → (6, −12, −6) → (8, 6, −4) → (8, 30, 6) → (8, 45, 18) | r 1.5 | MNI | low | [T]; 96.5 mm |
| PAG–RVM–dorsal horn; bulbospinal sympathetic | `tractPagRvm`; `tractBulbospinal` | `pag` (0, −31, −7) → `rmg` → (3, −38, −56) → (4, −45, −72); `rvlm` → (6, −38, −60) → (5, −44, −72) | r 1 | MNI | low | [T]; 68.2; 29.3 mm |
| Hyperdirect pathway | `tractHyperdirect` | `m1.hand` → (22, −14, 8) → `stn` | r 1 | MNI | low | [T]; 69.5 mm |

All other edges run straight between node centres, including the retinohypothalamic tract (chiasm → `scn`, [G Suprachiasmatic_nucleus L59]). Junction end points are drawing targets only; the ports themselves take their (ξ, η) from §6.

### 3.17. Changes to `anatomy.js` and `brain.js` geometry

| Change | Reason or check |
|---|---|
| Split the post-port `pallidum` ((±18.5, −4, −1) r (3.5, 9, 6), DOPAMINE.md §7.3) into `gpe` and `gpi`: draw both as their §3.16 ellipsoids in the extra buffer (B.8) and relabel each existing pallidum star to the nearer of the two centres. Split the `raphe` tube into `dr` and `mnr`, and add `rmg`, `rpa`, `rob` with new stars (they lie at z −40 to −52, outside the tube's z −9…−26). Split `pituitary` into `pituitaryAnt` (y > −2) and `pituitaryPost` (y ≤ −2) | the pathways need separate nodes (A.3.3) |
| Insula: adopt the DOPAMINE.md §7.3 ribbon, centre (±37, −3, 4), half-extents (4, 26, 11) (y −29…+23), in place of the coded shell (`brain.js` L184–L193; centre (±36, −9, 2), radii (4, 17, 10), y −26…+8) | the anterior insula (y +16…+24) currently has no stars; in the new ribbon `insAnt` sits at r² 0.85 |
| Add dorsal tectal bumps for `sc`, `ic` and `opn` | against the post-port tube their centres lie at or past the dorsal boundary (1.17, 1.04, 0.50) |
| Place `cvlm` at (6, −34, −56) and `vestNuc` at (9, −37, −40) | both lie inside the tube (0.75, 0.93) |
| Draw `lgn`, `mgn` and `habenula` as separate ellipsoids outside the thalamus | r² 3.31, 2.52 and 1.62 against the post-port thalamus (3.89, 2.62, 1.41 against the coded one) |
| Fit the thalamic subnuclei to the post-port thalamus: DOPAMINE.md §7.3 (±11, −18, 8) r (8.5, 16, 9.5), rotated 15° about z with the anterior pole medial (the preferred variant there) | `thalAnt` lies inside (r² 0.82; 0.97 unrotated; 1.23 against the coded thalamus). `thalVMpo` (1.01) and `thalRet` (0.99) sit on the ventral and lateral edge, where they lie anatomically, and protrude by ≤ 1 mm; `thalVPL` 0.86 |
| Draw the hypothalamic nuclei as their own ellipsoids | `son`, `tmn`, `mammillary`, `scn`, `mnpo` and `ovlt` lie outside the post-port hypothalamus ellipsoid (r² 1.66–3.51). No centre lies inside `arcuate`, `pvn` or `mpoa`; volume overlaps `vlpo`–`mpoa` 18 %, `vmh`–`arcuate` 8 %, `dmh`–`pvn` 6 %, `mammillary`–`arcuate` 5 % |
| Add the new nuclei as NUCLEI entries (`'e'` or `'t'`), mirrored unless midline; add cortical areas only as an `area` attribute | keeps cortical sub-areas out of `REGION_COUNT` |
| Move per-region state to a data texture (§11) | `uRegion` and `uTint` (`shaders.js` L30, L63) and `uDA` (L122) each hold `REGION_COUNT` vec4; ≈ 122 regions would exceed the 256 vertex uniform vectors that WebGL2 guarantees |

This document moves no `anatomy.js` entry beyond the DOPAMINE.md §7.3 port, which Phase 0a applies first (A.2 precedence 1; B.15). In brain-only mode the brain renders as the post-port build, plus these additions. Model checks (scratch scripts, not sources): `research-brain-systems/sec2_check.mjs`, `sec3_thal.mjs`, `sec2_vn.mjs`, `sec2_routes.mjs`, `sec2_twoproc.mjs`; post-port and pairwise rechecks `verify-editor/bs.mjs`, `geo2.mjs`, `hyp.mjs`.

### 3.18. Behaviour under the switches and in brain-only mode

| Condition | Ports | Central consequences |
|---|---|---|
| Brain only | non-special afferent ports silent; special senses fed at the first central station; `portCVO` clamped at basal; efferent ports efference only | The `ntsVisc` baseline falls. The somatic and visceral relays and `insPost` sit at their spontaneous floor. `preBotC` runs a fictive rhythm, `rvlm` keeps its tonic drive, and `pvn`/`son` commands appear as tints. The arousal machine, the SCN (still entrained through `portRetina`), the modulator pools and the dopamine model keep running. Salience comes from the special senses only |
| Somatic off | `portDC`, `portSTT`, `portTrig` silent; motor ports efference only | Body-surface stimuli produce no central response. Cerebellar comparators treat missing reafference as absent data (comparison gain 0), not as error [model]. Central RSA persists. A loud sound still reaches `pnc`, `lc` and `amygdala`, but shows only autonomic signs |
| Autonomic off | `portVisc`, `portSpinoVisc` silent; autonomic efferent ports efference only | The baroreflex loop is open. `rvlm` runs at its central drive, and vagal commands have no effect (the heart runs at its intrinsic rate, §7). `insPost` receives no visceral input, and there is no heartbeat-evoked response (§5). Taste still arrives |
| Enteric off | vagal gut mechanosensitivity halved | NTS gastric drive is weaker; satiety reaches the brain through hormones only (§8) |
| Neuroendocrine off | `portCVO` hormone channels clamped at basal; portal and neurohypophysial commands shown as tints | Commands are still computed. Basal cortisol fixes the feedback level, and gut hormones do not reach `areaPostrema` or `arcuate` |
| Neuroimmune off | cytokine channel and vagal immune afferents silent; `portImmune` efference only | No PGE2 reaches `mnpo`, so there is no set-point shift (§10). No sickness modifiers apply, and infection does not drive `pvn` |

Orgasm scenario: with all networks on, `response.js` drives the dopamine model exactly as now. In brain-only mode the scenario runs in its central form (A.3.5; adapter in §11). The brain graph does not change the scenario's inputs. Outside this scenario, salience could feed the existing salience input N of DOPAMINE.md §5 without changing any DOPAMINE.md value; §11 decides.

### 3.19. Open questions

- The brainstem centres are estimates fitted inside the tube. Should measured centroids be computed from the Brainstem Navigator labels (Singh et al. 2020) and the Sitek et al. 2019 NIfTI labels, licence permitting, before the coordinates are frozen?
- No domain-lens coordinates for the cranial motor nuclei, sensory relays, `barrington`, `ssn`, `isn`, `mnpo` or `cea` reached this section, and the somatic and sensory sections defer to §3.16. Any later values must pass the same tube and pairwise tests.
- The ventral-medullary column (`io`, `preBotC`, `nAmbVagal`, `nAmbMotor`, `rvlm`, `cvlm`) was re-placed by the pairwise test with [T] ordering only (olive ventral, preBötC dorsal to it, nucleus ambiguus dorsal again); its dorsoventral spacing should be checked against Brainstem Navigator labels.
- Several values are unverified: the TMN count (Airaksinen et al. 1991, not located in this pass), the PPN count (n = 4), Hardman et al. 2002, Tomasch 1969, German et al. 1988, the Singh et al. 2020 volumes, the orexin control count and the Nambu latencies. Should the HUD show these counts as "order of magnitude"?
- No verified human counts exist for the SCN or the PVN; the capture values are rodent (§1).
- What share of human cardiac vagal motoneurons lies in the nucleus ambiguus rather than the DMV (A.8 #17)?
- The salience weights, N1–N3 grading, relay gains, arousal factors, REM episode lengths and two-process thresholds are design values. They should be tested against arousal data with `sleepSound`.
- Should salience drive the DOPAMINE.md §5 input N, and should `habenula` couple to dopamine only through the existing §5 GABA term? This is a §11 decision and leaves DOPAMINE.md unchanged.
- The A.6 stimulus record has no flag for self-produced touch, so the §3.6 attenuation covers only the model's own movements.
- [G Brainstem L63] and [G Respiratory_center L54] should be added to the §1 corrections table.
- Spherical patches overlap at the central sulcus; a parcellation of the cortical folding field may be needed.
- Should A.3.3 gain a `thalVPI` id, or should the `thalVPL` proxy stay?
- The rule that missing reafference counts as absent data (§3.18) needs agreement with §4 and §6.
- The optic nerve head position depends on the §2 head geometry.
- The PPN/LDT rates are model values; only their state profile has a literature basis.

### 3.20. Sources

**Literature:** Airaksinen et al. 1991; Albin, Young & Penney 1989; Albus 1971; Alexander, DeLong & Strick 1986; Andrews, Halpern & Purves 1997; Andrews-Hanna et al. 2010; Astafiev et al. 2010; Aston-Jones & Bloom 1981; Aston-Jones et al. 1994; Aston-Jones & Cohen 2005; Azevedo et al. 2009; Baker et al. 1990; Baker et al. 1991a (Neuroscience); Baker et al. 1991b (Synapse); Bandler & Shipley 1994; Bastos et al. 2015; Beckstead, Morse & Norgren 1980; Blakemore, Wolpert & Frith 1998; Blakemore, Frith & Wolpert 1999; Borbély 1982; Boucetta et al. 2014; Boynton et al. 1996; Brain Pathol. 2025, doi:10.1111/bpa.70011; Craig 2002; Craig 2009; Czeisler et al. 1999; Daan, Beersma & Borbély 1984; Davis et al. 1982; Davis & Whalen 2001; Del Negro, Funk & Feldman 2018; DeLong 1971; Dumoulin et al. 2000; Eickhoff et al. 2006; Felleman & Van Essen 1991; Fox et al. 2005; Friston 2005; Fuller et al. 2011; German et al. 1988; Gilbey et al. 1984; Gilmor et al. 1999; Glover 1999; Guyenet 2006; Guyenet & Bayliss 2015; Hardman et al. 2002; Inoue et al. 2012; Jacobs & Fornal 1999; Jacobson & Sapolsky 1991; Keay & Bandler 2001; Kelly & Strick 2003; Keren et al. 2009; Keuken et al. 2014; LeDoux 2000; Lee, Hassani & Jones 2005; Lu et al. 2006; Marr 1969; McCormick & Bal 1997; Méndez-Bértolo et al. 2016; Menon & Uddin 2010; Mileykovskiy, Kiyashchenko & Siegel 2005; Morosan et al. 2001; Morrison & Nakamura 2011; Nambu et al. 2000; Nambu, Tokuno & Takada 2002; Öngür & Price 2000; Palmiter 2018; Paus 1996; Quirk, Repa & LeDoux 1995; Raichle et al. 2001; Rao & Ballard 1999; Saper, Chou & Scammell 2001; Saper, Scammell & Lu 2005; Saper & Lowell 2014; Schwarzacher, Rüb & Deller 2011; Seeley et al. 2007; Sherman & Guillery 2002; Singh et al. 2020; Sitek et al. 2019; Smith et al. 1991; Sridharan, Levitin & Menon 2008; Steriade, McCormick & Sejnowski 1993; Swanson & Sawchenko 1983; Takahashi, Lin & Sakai 2006; Thach 1968; Thannickal et al. 2000; Thannickal, Lai & Siegel 2007; Tomasch 1969; Uddin, Yeo & Spreng 2019; Van Horn, Erişir & Sherman 2000; van Kerkoerle et al. 2014; Yeo et al. 2011; Yousry et al. 1997; Zaborszky et al. 2008; zu Eulenburg et al. 2012. Modifiers are tagged inline. Abstracts checked by web search in this pass, with values that agree: Baker et al. 1990, 1991a, 1991b; Gilmor et al. 1999; Inoue et al. 2012; Méndez-Bértolo et al. 2016; Thannickal et al. 2000.

**Textbook knowledge [T]:** coordinates marked [T]; SNr, STN and MSN rates; EEG bands other than spindles and the slow oscillation; sleep architecture; reaction times; HRF form; resting-state band; fastigial pressor response.

**Raw captures:** `brain-system/raw/` stems and lines as cited inline, located with `graphify query`, `path` and `explain`.

**Project files:** `research/DOPAMINE.md` §2.2–§2.4, §5, §6.3, §6.5, §7.3, §7.4; `src/anatomy.js` `REGION_IDS` L17–L41, `BRAINSTEM` L321–L324; `src/brain.js` L184–L193; `src/shaders.js` L30, L63, L122.

---

## 4. Signal processing

### 4.1. Scope and conventions

This section turns neuron, synapse and axon biophysics into the equations the kernel integrates (§11). It owns the numbers A.7 assigns to it, including the A.9 "resulting checks". It uses without restating path lengths (§2); τA, t_rec, Stevens exponents, Weber fractions and sensory latency targets (§5); reflex targets, NMJ quantal data, motor-unit rates and CMCT (§6); autonomic loop parameters, BRS and effector kinetics (§7); steps, history, packet cadence and CPU budget (§11); tolerances (§12); rendering numbers (§13); central firing rates, modulator pools, salience and LC phasic timing (§3); and all dopamine quantities (DOPAMINE.md).

The formalism is the same in both modes; in brain-only mode only `cns` and `special` edges run (A.5). Generic mammalian neuron values are tagged R because most measurements come from rodent tissue. "[model] check" rows are deterministic outputs of the stated equations from the prototypes in §4.16; their confidence describes reproducibility, not physiology.

### 4.2. Membrane potential, spike and single-cell models

The population graph never integrates spikes. Spikes appear only in the single-cell inspector (§4.13, level C), which explains the action potential and runs the size-principle motoneuron-pool demonstration (§6).

**Table 4.2a. Generic membrane and spike values.**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Resting potential (axon hillock) / threshold / spike peak | −70 / −55 / +40 | mV | R | medium | [G Action_potential L45] |
| After-hyperpolarisation trough (schematic plot) | −90 | mV | R | low | [G Action_potential L45] |
| Na⁺ / Ca²⁺ spike duration | < 1 / ≥ 100 | ms | R | high / medium | [G Action_potential L33] |
| Specific membrane capacitance | 1.0 | µF/cm² | Sq | high | Hodgkin & Huxley 1952 |
| Specific membrane capacitance, cortical neurons | ≈ 0.9 | µF/cm² | R | low | Gentet, Stuart & Clements 2000 [recalled] |
| Membrane time constant in vitro | 10–30 | ms | R | medium | [T] |

In vivo, cortical neurons sit in a high-conductance state with shorter τm (Destexhe, Rudolph & Paré 2003, C [recalled]; size of the reduction unverified). Passive spread decays as V(x) = V₀·e^(−x/λ), λ = √(r_m/r_l) [G Cable_theory L284, L312], so subthreshold signals are lost within a few λ. Axons therefore regenerate spikes, and the model treats every axon as a pure delay line (§4.4).

**Hodgkin–Huxley inspector** (V in mV, rates in ms⁻¹, rest −65 mV):

```
C_m dV/dt = −ḡ_Na m³h (V − E_Na) − ḡ_K n⁴ (V − E_K) − ḡ_L (V − E_L) + I(t)
dx/dt = φ·[α_x(V)(1 − x) − β_x(V) x],  x ∈ {m, h, n},  φ = Q10^((T − 6.3)/10)
α_m = 0.1(V+40)/(1 − e^(−(V+40)/10))   β_m = 4 e^(−(V+65)/18)
α_h = 0.07 e^(−(V+65)/20)              β_h = 1/(1 + e^(−(V+35)/10))
α_n = 0.01(V+55)/(1 − e^(−(V+55)/10))  β_n = 0.125 e^(−(V+65)/80)
Gate step (Rush–Larsen):  x ← x∞ + (x − x∞)·e^(−h/τx),  x∞ = α/(α+β),  τx = 1/(φ(α+β))
Voltage step (exponential Euler, conductances frozen):  V ← V∞ + (V − V∞)·e^(−h·g_T/C_m)
```

**Table 4.2b. HH parameters and checks (squid, 6.3 °C).**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| C_m | 1 | µF/cm² | Sq | high | Hodgkin & Huxley 1952 |
| ḡ_Na, ḡ_K, ḡ_L | 120, 36, 0.3 | mS/cm² | Sq | high | Hodgkin & Huxley 1952 |
| E_Na, E_K, E_L | +50, −77, −54.387 | mV | Sq | high | Hodgkin & Huxley 1952 (shifted to rest −65 mV) |
| Reference temperature; gating Q10 | 6.3; 3 | °C; — | Sq | high; medium | Hodgkin & Huxley 1952; Q10 [T] |
| Gate integration | Rush–Larsen | — | — | medium | Rush & Larsen 1978 [recalled] |
| Inspector step h | 0.01–0.05 (stable to 0.1) | ms | — | high | [model] check, `cell.mjs` |
| Threshold, 1 ms pulse | 6.91 | µA/cm² | Sq | high | [model] check |
| Peak / AHP trough; half-width / time to peak | +39.9 / −76.2; 1.45 / 1.67 | mV; ms | Sq | high | [model] check |
| Earliest second spike (2× threshold pulses) | 12.5 | ms | Sq | high | [model] check |
| f–I at 5 / 6.5 / 10 / 20 / 50 µA/cm² | 0 / 55.1 / 68.3 / 86.5 / 117.0 | Hz | Sq | high | [model] check; < 0.5 % change for h 0.005–0.1 ms |
| Half-width with Q10 = 3 at 6.3 / 18.5 / 25 / 30 °C | 1.56 / 0.40 / 0.23 / 0.14 | ms | Sq | high | [model] check |
| Spike at 37 °C with Q10 = 3 | none (peak −0.5 mV; heat block) | — | Sq | high | [model] check |

The squid model is never scaled to body temperature, because it fails to fire there. The inspector labels its trace "squid giant axon, 6.3 °C" and states that mammalian Na⁺ spikes last under 1 ms. A mammalian channel set is an open question (§4.15).

**LIF inspector and motoneuron pool:**

```
C dV/dt = −g_L (V − E_L) − g_E(t)(V − E_E) − g_I(t)(V − E_I) + I(t)
if V ≥ V_th:  spike, V ← V_reset, clamp for t_ref
step: V ← V∞ + (V − V∞)·e^(−h·g_T/C), V∞ = conductance-weighted mean of the reversal potentials
```

**Table 4.2c. LIF parameters and checks.**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| C; g_L; τm = C/g_L | 200; 10; 20 | pF; nS; ms | R | medium | [T] |
| E_L / V_th / V_reset | −70 / −50 / −60 | mV | R | medium | [T]; V_th is an effective point-neuron threshold [model] |
| Absolute refractory period t_ref | 2 | ms | R | medium | [T] |
| Inspector step h | 0.1 | ms | — | high | [model] check |
| f–I vs analytic at 250 / 600 pA | 41.7 vs 41.7 / 153.8 vs 154.7 | Hz | — | high | [model] check, `cell.mjs` |
| AMPA peak conductance for a 0.5 mV EPSP; release to EPSP peak | 0.68; 6.6 | nS; ms | — | high | [model] check |
| Sum of two 0.5 mV EPSPs at Δt 1 / 5 / 10 / 20 / 50 ms | 0.99 / 0.95 / 0.86 / 0.72 / 0.55 | mV | — | high | [model] check |
| Synchronous inputs to fire from rest (linear estimate 40) | 49 | — | — | high | [model] check |

Temporal summation works over a window of about τm, and the falling driving force makes convergent excitation sublinear. Both properties justify a rate unit with a node τ and a saturating F (§4.8).

### 4.3. Synaptic transmission

Each chemical synapse on an edge adds t_syn to its delay (§4.4). This one figure lumps together terminal conduction, Ca²⁺ entry, vesicle fusion and the rise of the postsynaptic response to threshold.

**Table 4.3a. Transmission delays.**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| **t_syn**, per fast chemical synapse | 0.6 (0.15–1.0) | ms | — | medium | [model], from the rows below |
| Presynaptic spike onset to postsynaptic current, physiological temperature | ≈ 0.15 | ms | R | medium | Sabatini & Regehr 1996 (cerebellum) |
| Ca²⁺ influx to vesicle fusion | ≈ 0.06 | ms | R | medium | Sabatini & Regehr 1996 |
| Classic synaptic delay, room temperature | 0.5–1 | ms | frog | low | Katz & Miledi 1965 [recalled] |
| **NMJ delay**, terminal arrival to endplate response | 0.7 (0.5–0.8) | ms | — | medium | [G Neuromuscular_junction L50] (species not stated) |
| Muscle fibre CV | ≈ 4 (3–5) | m/s | H | medium | [T] |
| **EMG spread**, endplate to recording territory (≈ 2 mm) | 0.5 | ms | — | low | [model], from muscle fibre CV |
| **Electromechanical delay**, EMG onset to force | 30 (10–50 by method) | ms | H | low | [T], [model] |

NMJ quantal data belong to §6.

**Table 4.3b. Synaptic kinetics and reversal potentials.**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| AMPA rise / decay τ | 0.3 (0.2–0.5) / 3 (1–5) | ms | R | medium | [T] |
| NMDA rise / decay τ | 5–10 / 100 (50–150) | ms | R | low | [T] |
| GABA-A rise / decay τ | 0.5 / 8 (5–20) | ms | R | medium | [T] |
| GABA-B rise / decay τ | ≈ 50 / 150 (100–300) | ms | R | low | [T] |
| Glycine decay τ; ganglionic nicotinic EPSC decay τ | 5 (3–10); ≈ 5 | ms | R | low | [T] |
| Metabotropic (muscarinic, monoamine); peptide and volume transmission | 0.1–10 s; seconds–minutes | — | R | low | [T] |
| E_AMPA = E_NMDA; E_GABA-A (Cl⁻) | 0; −80 (−65 to −80) | mV | R | medium | [T] |
| E_glycine; E_GABA-B (K⁺) | −80; −95 | mV | R | low; medium | [T] |
| NMDA Mg²⁺ block constants | 3.57 mM; 0.062 mV⁻¹ | — | R | low | Jahr & Stevens 1990 [recalled] |

```
g(t) = ḡ·N·(e^(−t/τd) − e^(−t/τr)), t ≥ 0 (N normalises the peak to 1);  I = g(t)·B(V)·(V − E_rev)
B(V) = 1 / (1 + ([Mg²⁺]/3.57 mM)·e^(−0.062·V)) for NMDA;  B = 1 otherwise
```

In the rate graph (§4.13), fast ionotropic kinetics are absorbed into the receiving node's τ. Slow receptors (NMDA, GABA-B, metabotropic) keep a second input filter on each edge of that class, τ_s·ds/dt = −s + w_s·a_j(t − d). The main example is dorsal-horn NMDA wind-up under repeated C input. Modulator pools belong to §3 and dopamine kinetics to DOPAMINE.md §3. More than 100 transmitters are known [G Neurotransmitter L52], and the model names only the classes it uses.

### 4.4. Conduction

Every axon or tract is a delay line. With L in mm and v in m/s (= mm/ms):

```
d_e = Σ_k L_k / v_k + n_syn · t_syn        (ms)
```

L_k comes from the §2 polylines, v_k from the fibre class of each segment and t_syn from Table 4.3a. Velocities are never rescaled for display (A.4).

**Table 4.4a. Peripheral fibre classes (A.9 defaults).**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| `Ia`, `Ib`, textbook class value (Aα, 13–20 µm) | 80–120 | m/s | C | high | [G Nerve_conduction_velocity L44–L45]; [G Group_A_nerve_fiber L46] (70–120) |
| `Ia`, `Ib`, **model** | 65 (human 55–70 by reflex timing) | m/s | H | low | [model], calibrated to §6 reflex timing (A.8 #13) |
| `II`, spindle secondary (6–12 µm) | 45 (class 33–75) | m/s | C | low | [G Nerve_conduction_velocity L46]; point value [model] |
| `Abeta`, arm: proximal / distal of the wrist; leg: above / below the knee | 65 / 50; 65 / 50 (class 33–75) | m/s | H | medium (arm); low (leg) | [G Nerve_conduction_velocity L46, L61, L63, L67, L133]; leg nerves 40–45 against 50–65 m/s in the arm [G Nerve_conduction_velocity L66, L69]; below-knee point value [model], calibrated to the tibial SEP (§4.11) |
| `Adelta` (1–5 µm, thinly myelinated) | 15 (3–30) | m/s | C | medium | [G Nerve_conduction_velocity L47] |
| `C` (0.2–1.5 µm, unmyelinated) | 1.0 (0.5–2.0) | m/s | H | high | [G Nerve_conduction_velocity L48]; [G Group_C_nerve_fiber L39] |
| `CT` (C-tactile) | 0.9 (0.6–1.3) | m/s | H | low | Vallbo et al. 1999 via Liljencrantz & Olausson 2014 [secondary] |
| `Cmi` (mechano-insensitive, itch) | 0.5 | m/s | H | low | Schmelz et al. 1997 ("exceptionally low"; value [recalled]) |
| `Agamma` (5–8 µm) | 25 (15–35) | m/s | C | low | [T]; consistent with Table 4.4c (4.6 × 5–8 µm = 23–37); capture 4–24 m/s not used ([G Nerve_conduction_velocity L36]; §1.11 #12) |
| `Aalpha`, α-motor, arm / leg | 55 / 50 | m/s | H | high | [G Nerve_conduction_velocity L35, L62, L65, L66, L69] |
| `B`, preganglionic (1–5 µm) | 8 (3–15) | m/s | C | medium | [G Nerve_conduction_velocity L54]; point value [model] |
| `Cpost`, postganglionic | 1.0 (0.5–2.0) | m/s | C | medium | [G Nerve_conduction_velocity L55] |
| Visceral afferent C (vagal, glossopharyngeal, spinal) | 1.0 | m/s | C | low | [T] |
| A-fibre baroreceptor afferent | 15 | m/s | R | low | [T] |

The Group A capture lists α-motor fibres at 80–120 m/s [G Group_A_nerve_fiber L37]. That is a cat class value. Human clinical values are 50–60 m/s [G Nerve_conduction_velocity L35], and the model uses those.

**Table 4.4b. CNS tracts (`cns` class).**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Dorsal column / medial lemniscus / lemniscal thalamocortical (`thalVPL`, `thalVPM` → `s1`) | 55 / 45 / 35 | m/s | H | low | [model], calibrated to the median-nerve SEP (§4.11) |
| Spinothalamic tract, Aδ-related | 10 | m/s | H | medium | Rossi et al. 2000 (9.87 ± 1.24, 8.3–11.0, n = 8, indirect) (abstract); 10.0 ± 4.5 quoted as a comparison value in Qiu et al. 2001 (abstract) |
| Spinothalamic tract, C-related | 2.2 | m/s | H | low | Qiu et al. 2001 (2.2 ± 0.6, 11 healthy men) (abstract) |
| Spinothalamic tract, other laser estimate (not used) | ≈ 21 | m/s | H | low | Cruccu et al. 2000 (mean 21, n = 15) (abstract) |
| Corticospinal, model (bulk of fast fibres) | 60 | m/s | H | low | [model] |
| Corticospinal, Betz-cell axons (≈ 3 % of CST axons, §6.8) | > 70 | m/s | H | medium | [G Corticospinal_tract L38] |
| Optic nerve and tract | 8 | m/s | — | low | [model] |
| LC axons; bulbospinal autonomic premotor axons | 0.5; 3 | m/s | R; C | low | [T] |
| Other CNS default | 20 | m/s | — | low | [model] |

Cruccu et al. 2000 report ≈ 21 m/s using a different laser method. The 10 m/s default rests on two concordant abstracts. The route is afferent → dorsal horn → anterior white commissure → thalamus (VPL, VPM, MD) → S1 and insula [G Spinothalamic_tract L54, L69, L71].

**Table 4.4c. Diameter, myelin and the myelin diameter factor.**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| **Myelin diameter factor** (v = k·D, total diameter), group I and α / groups II, III and γ | 5.7 / 4.6 | (m/s)/µm | C | medium | Boyd & Kalu 1979 (muscle afferents) [unverified]; α, γ by analogy [model] |
| Diameter factor, cutaneous large / small myelinated fibres | 5.6 / 4.6 | (m/s)/µm | C | medium | Boyd & Kalu 1979 [unverified] |
| Rounded linear rule | ≈ 6 | (m/s)/µm | C | low | Hursh 1939 [recalled] |
| Unmyelinated scaling | v ∝ √d | — | — | medium | [T]; cable theory [G Cable_theory L284] |
| Node of Ranvier length; internode length | ≈ 1; ≈ 100·D | µm | — | medium; low | [G Myelin L33]; [T] |
| Optimal g-ratio | ≈ 0.6 | — | — | low | Rushton 1951 [recalled] |

The factor converts fibre diameter into velocity when a nerve has no clinical CV. Whether cat factors apply to human skin nerves is an open question (§4.15).

**Table 4.4d. Correction factors.**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| CV vs nerve temperature | positive, linear | — | H | high | [G Nerve_conduction_velocity L127] |
| Temperature coefficient k_T (relative) | 0.03 (0.02–0.05) | °C⁻¹ | H | low | [T] [recalled]; [model] |
| Age slope, upper-limb nerves; sural | −0.1 (−1 per decade); none | m/s per year | H | medium | [G Nerve_conduction_velocity L117] |
| Age at adult CV / newborn fraction of adult CV | 4 / ≈ 0.5 | y / — | H | medium | [G Nerve_conduction_velocity L115] |
| Wrist-to-digit sensory CV vs height | −0.5 m/s per inch | — | H | medium | [G Nerve_conduction_velocity L133] |

```
v(T_n, age) = v_ref · [1 + k_T (T_n − T_n,base)] · f_dev(age) + s_age · (max(age, 20) − 30)    myelinated peripheral classes
f_dev(age)  = 0.5 + 0.125·age for age < 4;  1 otherwise
```

The factor is 1 at baseline nerve temperature. Cold limbs or fever enter through T_n, taken from `tSkin` and `tCore` (§7). The age slope is measured only for upper-limb nerves, so applying it to other myelinated classes is a [model] extrapolation, with sural fibres exempt. Height is not a factor, because stature is fixed at 1,760 mm (§2).

**Volley dispersion.** A compound volley spreads as σ_t = c_disp · Σ L/v, where c_disp is the coefficient of variation of v within a class: 0.1 for `Ia Ib Abeta Aalpha` and 0.3 for `Adelta` and the C classes [model]. An Aδ volley from the index fingertip to the C7 segment (943 mm, 62.9 ms) therefore has σ_t ≈ 19 ms. Fast volleys arrive sharp and slow ones smeared; §13 owns how this is drawn. Over 1 m of nerve, the Table 4.4a ranges give arrival windows of Aβ 13.3–30.3 ms, Aδ 33–333 ms and C 0.5–2.0 s.

**History-depth check.** The NF history ring holds up to 8,192 samples per source, 4.096 s (§11.6). The longest need is `Cmi` from the great toe: 1,196 mm to the L5 DRG plus the 203-mm L5 root (§2.14, §2.5), 2.80 s at 0.5 m/s, which fits. `C` on the same route takes 1.40 s. Only edges with d_e > 4.096 s must use EV packets (§4.13); none exists on the §2 geometry.

### 4.5. Neural coding and the limits of rate units

A node's state is r_i, the population-average rate (Hz), with a_i = r_i/rmax_i (A.3.4). A rate is a spike count over a window, typically T = 100 or 500 ms [G Neural_coding L58], and the kernel uses its large-population, short-window limit. This is accurate for intensity, slow modulation and population vectors, but loses codes that depend on the timing of single spikes.

**Table 4.5. Codes and their treatment.**

| Code | Evidence | In the rate graph | Treatment |
|---|---|---|---|
| Rate (spike count) | [G Neural_coding L58] | Native | r_i |
| Population vector | Georgopoulos et al. 1986 (Mk, M1) | Representable | Somatotopic and direction sub-sites as separate units (A.3.3 `.hand` etc.) |
| Tonic vs phasic | SA vs RA afferents (§5) | Native | Adaptation filters (§4.7) |
| First-spike latency | Johansson & Birznieks 2004 (H, fingertip) | Timing kept, information not modelled | EV onset packets carry exact onsets (§4.13) |
| Phase locking, interaural time differences | [T] | Not representable below the 0.5 ms NF step | Labelled simplification; LIF demonstration optional (§4.15) |
| Synchrony and oscillations | [T] | Not emergent at kernel steps (Table 4.13b) | Explicit oscillators or states (§3), steady halo (§13) |
| Sparse codes | Olshausen & Field 1996 (model) | Not represented | Mean-field populations |
| Thalamic burst vs tonic mode | [T] | State-dependent gain | `arousalState` (§3) switches thalamic θ, κ (§4.8) [model] |

Single spikes are never drawn in the main view. Firing appears as a rate-coded twinkle, within the §13 photosensitivity limits.

### 4.6. Receptive fields and lateral inhibition

Lateral inhibition sharpens edges. It was inferred from Mach bands and measured in single cells by Hartline in *Limulus* [G Lateral_inhibition L21, L31, L33, L45]. Retinal ganglion and V1 receptive fields have an antagonistic centre and surround [G Receptive_field L59, L63] (Kuffler 1953, C). The model uses difference-of-Gaussians (DoG) weights within each topographic map (Rodieck 1965 form):

```
w_ij = w_c·exp(−d_ij² / 2σ_c²) − w_s·exp(−d_ij² / 2σ_s²)
σ_s = 3·σ_c;   w_s = 0.85·w_c·(σ_c/σ_s)^k,   k = map dimension (1 strip, 2 sheet)
σ_c = TPT / 2.355   (centre FWHM = §5 two-point threshold TPT of that skin region)
```

**Table 4.6. DoG parameters.**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Surround to centre width σ_s/σ_c | 3 | — | — | medium | [model]; Rodieck 1965 (form) |
| Surround to centre integral | 0.85 | — | — | medium | [model] |
| Centre width rule | FWHM = §5 two-point threshold | — | — | low | [model] |
| Mach overshoot at a step edge, 1-D strip | 1.94× bright plateau, undershoot below dark plateau | — | — | high | [model] check, `net.mjs` |

DoG weights apply in dorsal horn laminae III–V, `gracile`/`cuneate`, `thalVPL`/`thalVPM`, the `s1` sub-sites, `spV`/`prV` and the tonotopic `cochNuc`/`mgn`/`a1` strips. Retinal and LGN surrounds belong to the always-on special senses (A.5). Because the surround integral is below 1, uniform input is attenuated, not cancelled.

### 4.7. Adaptation filters

Adaptation is fast (hundreds of ms) and slow (minutes to days), and is often stronger at cortical than at subcortical stages [G Neural_adaptation L25, L29]. Each receptor class has a first-order adaptation state driven by the Stevens-shaped drive x (§4.10):

```
τA · dA/dt = x − A
SA:  u = max(0, x − kA·A)      RA:  u = |x − A|  (on and off responses)
Two time scales:  A = A_f + A_s with separate τA,f, τA,s
Output:  r = rmax · u^n / (u^n + u50^n)      (§4.8)
```

The filter form is fixed here, and τA, kA and u50 for each receptor are fixed in §5. With provisional τA values the filters reproduce the textbook response shapes ([model] checks, `net.mjs`):
- SA1 (τA 1.5 s, kA 0.6): 133 → 106 Hz over a 2 s indentation, with no off response.
- RA1 (τA 30 ms): 124 Hz bursts at onset and offset that fall to 13 Hz within 100 ms.
- RA2 (τA 5 ms): onset and offset transients only.

The semicircular canals use H(s) = T₁T₂·s / ((1 + T₁s)(1 + T₂s)) on head angular velocity. With T₂ ≈ 5 s and T₁ ≈ 5 ms the corners are ≈ 0.03 Hz and ≈ 32 Hz, so between 0.1 and 10 Hz the gain is flat (|H| 0.95 at 0.1 Hz, ≈ 1.0 at 1 Hz, 0.99 at 10 Hz) and the output tracks head velocity, as §5.9 states. The high-pass behaviour appears below ≈ 0.05 Hz and in step responses, and central velocity storage extends the perceived and VOR time constant to ≈ 15 s. The capture's T₂ ≈ 20 s [G Vestibular_system L137] mixes the two stages. A.8 #15 sets the split (afferent ≈ 5 s, storage ≈ 15 s), and §5 owns the values.

### 4.8. Gain control and neuromodulatory gain

Every rate unit uses a logistic transfer function on a dimensionless drive x, where 1 means saturating input:

```
F(x) = rmax / (1 + exp(−g_NE·(x − θ)/κ))
```

**Table 4.8a. Transfer-function parameters.**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| θ (default; class range) | 0.5 (0.5–1.0) | drive | — | medium | [model]; Wilson & Cowan 1972 (form) |
| κ (default; class range) | 0.12 (0.08–0.25) | drive | — | medium | [model] |
| F(0) with the defaults | ≈ 1.5 % of rmax | — | — | high | [model]; spontaneous rates come from tonic I_ext |
| θ, `pnc` (startle threshold behaviour) | 0.7 | drive | — | low | [model] (§4.11) |

**Table 4.8b. rmax by node class (normalisation and display ceilings).**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Ia and Aβ afferent populations | 300 | Hz | H | low | [T] |
| Aδ / C and CT afferent populations | 100 / 30 | Hz | — / H | low | [model] / [T] |
| Fast relays (`gracile cuneate spV prV cochNuc thalVPL thalVPM thalVMpo mgn lgn`) | 300 | Hz | R | low | [T] |
| Spinal and brainstem interneurons; reticular premotor (`pnc pno gi mrf`) | 200 | Hz | — | low | [model] |
| α-MN pools (display ceiling; physiological rates §6) | 50 | Hz | — | low | [model] |
| Autonomic premotor (`ntsVisc rvlm cvlm nAmbVagal dmv`); limbic and hypothalamic nuclei | 50 | Hz | — | low | [model] |
| Cortical areas | 100 | Hz | R | low | [T] |

Autonomic channels use f_max per channel (§7). Modulator and dopamine nuclei use §3 and DOPAMINE.md §3.1.

**Saturation and normalisation.** Receptor outputs use the Naka–Rushton form, R = rmax·c^n/(c^n + c50^n). Thalamic relays and primary sensory areas add divisive normalisation over a pool P (Heeger 1992; Carandini & Heeger 2012), applied as a divisive gain on the logistic drive. Normalisation gives contrast gain control and keeps response ratios unchanged under a 10× change in input gain ([model] check, `net.mjs`). Table 4.8d fixes which form each class uses.

**Table 4.8d. Transfer function by node class** ([model]).

| Node class | Transfer function |
|---|---|
| Receptors (`rec.<site>`) | Naka–Rushton on the §4.10 receptor drive |
| Fast relays, spinal and brainstem interneurons, reticular premotor, autonomic premotor, limbic, hypothalamic and modulator-source nuclei | logistic F(x) with the Table 4.8a θ and κ |
| Thalamic relays (`thalVPL thalVPM thalVMpo thalVPMpc lgn mgn`) and primary sensory areas (`s1 v1 a1 gust piriform`) | logistic F(x / (1 + Σ_{j∈P} w_ij·a_j / σ)), σ per modality (§5) |
| Other cortical areas | logistic F(x) |

**Table 4.8e. Default rate-graph coupling (NF edges).**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Excitatory relay weight w | +1.0 | drive per unit a | — | low | [model]; reproduces the Table 4.11 NF column |
| Inhibitory weight | −1.0 | drive per unit a | — | low | [model] |
| Convergent inputs | scaled so that Σ\|w\| over a node's inputs ≤ 1.2 | — | — | low | [model] |
| Tonic drive I_ext | θ + κ·ln(r_spont / (rmax − r_spont)), so that F gives each node its §3 spontaneous rate at rest | drive | — | low | [model] |
| Sign and transmitter | from the §3.15 edge table | — | — | — | §3.15 |

Named exceptions (DoG weights §4.6, dermatome overlap and root weights §6, fastigial weight 0, the crossed-route branch weights of §3.16) override these defaults. Drive x is dimensionless throughout: every input term carries a_j = r_j/rmax_j, never a rate in Hz (§4.13, §11.13).

**Table 4.8c. Gain-control parameters.**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Naka–Rushton / normalisation exponent n, V1 | 2 | — | Mk, C | medium | Heeger 1992; Carandini & Heeger 2012; Albrecht & Hamilton 1982 [recalled] |
| n, receptors and other stations | 1–3 | — | — | low | [model] |
| Semi-saturation c50 or σ per modality | §5 | — | — | — | §5 |
| NE gain g_NE = 1 + γ_t·(`modNE` − 1) + γ_p·`lcPhasic` | γ_t 0.5, γ_p 1.0; clamp 0.7–2.0 | — | — | low | [model]; Servan-Schreiber, Printz & Cohen 1990 (slope gain); Aston-Jones & Cohen 2005 (Mk) |
| ACh afferent:recurrent scaling 1 + γ_ACh·(`modACh` − 1) | γ_ACh 0.5 | — | — | low | [model] |

g_NE multiplies the slope 1/κ of every sensory relay and primary sensory area, so arousal sharpens sensory responses without moving their thresholds. The noradrenaline source is `lc` (graph: Locus coeruleus → Norepinephrine). 5-HT, histamine and orexin act through `arousalState` and the §3 thresholds, not through a gain term [model]. `modNE`, `modACh` and `lcPhasic` belong to §3.

### 4.9. Prediction, efference copy and habituation

In predictive coding, predictions travel down the hierarchy and prediction errors travel up [G Predictive_coding L29, L39]. Retinal lateral inhibition can be read as prediction (Srinivasan, Laughlin & Dubs 1982, fly), and the scheme has a hierarchical model form (Rao & Ballard 1999). Motor commands can be read as proprioceptive predictions [G Predictive_coding L51]. Self-touch is attenuated by an efference-copy prediction (Blakemore, Wolpert & Frith 1998, H). The model keeps one prediction per modality channel:

```
τ_pred · dr̂/dt = r − r̂
ε = r − r̂ − w_ec · ê(t)       ê = forward-model prediction of self-generated input (cerebellar loop, §3)
ε⁺ = max(0, ε)  →  salience, lcPhasic, PnC gain (§3; §6)
Habituation:  g_hab = 1 / (1 + k_hab·H),   dH/dt = −H/τ_rec + ρ·Σ events
```

**Table 4.9. Prediction parameters.**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| τ_pred (default; range) | 0.5 (0.3–1) | s | — | low | [model] |
| Efference-copy weight w_ec | 0.7 | — | — | low | [model]; attenuation, not abolition (Blakemore, Wolpert & Frith 1998, H) |
| k_hab, τ_rec, ρ per modality; prepulse inhibition | §5 | — | — | — | §5 |

ε⁺ plays the same structural role as the dopamine TD error (DOPAMINE.md §6.4, §6.6) but is a separate signal. A repeated identical stimulus becomes predicted after a few presentations, so ε⁺ shrinks, and startle and orienting habituate without extra machinery.

### 4.10. Psychophysical laws

```
Stevens:              psi = k · (I − I₀)^a,   I > I₀
Weber (generalised):  ΔI = k_W · (I + I_n)        (I_n: failure near threshold)
Fechner:              psi = (1/k_W) · ln((I + I_n)/(I₀ + I_n))
Range rule:           a ≈ 1.53 / log₁₀(I_max/I_min)
```

The forms are from [G Stevens_27s_power_law L44] and [G Weber_E2_80_93Fechner_law L27]. Weber's law fails at low intensities and often at high ones [G Weber_E2_80_93Fechner_law L137], and the power law largely replaced Fechner's logarithm [G Weber_E2_80_93Fechner_law L343]. The range rule is Teghtsoonian 1971 (H, medium; the per-modality table was not retrieved).

The `psi` readout (§5) is computed analytically from the Stevens law with §5's exponents. It is not decoded from receptor rates, which would compound the exponents. The receptor drive is x = ((I − I₀)/I_ref)^(a/n), so the Naka–Rushton stage gives r ∝ (I − I₀)^a for x ≪ x₅₀ and saturates above that [model]. One physical stimulus drives every receptor class whose threshold it exceeds (A.6), each with its own I₀ and a.

### 4.11. Latency method and model-vs-target table

```
t_k = t_rec (§5) + Σ_edges d_e (§4.4) + Σ_relays τ_i·ln(a_i,fin / (a_i,fin − θ_next / w)) + D_eff (§6, §7)
```

- **t_rec**: receptor transduction (spindle mechanics, cochlear and retinal transduction, heat penetration).
- **Σ d_e**: the exact EV arrival time, used as the canonical latency in Table 4.11.
- **Relay term**: the time an intermediate rate unit i (not the target) needs before its output, weighted by w (Table 4.8e), brings the next node's drive to that node's θ. a_i,fin = F_i of i's settled drive. A fast relay driven to saturation (a_fin 0.98, w 1, θ_next 0.5) adds 0.71·τ: 0.43 ms per fast relay, 1.07 ms per interneuron and 2.13 ms per autonomic node (Table 4.13a). `pnc` has θ 0.7 on its own drive, so with w = 1 it settles at a_fin 0.915; with τ_pnc 20 ms (Table 4.13a) it adds 20·ln(0.915/0.415) = 15.8 ms. NF crossings are resolved only to the NF step (A.4); onset packets carry exact times (§4.13).
- **D_eff**: the effector dead time. When §6 or §7 states a dead time measured from the stimulus, D_eff = max(0, D_owner − Σ d_e), so the total equals D_owner. §6 and §7 must state which reference they use (§4.15).

**Table 4.11. Model vs target.** Paths are the §2.14 lengths unless marked [model]; CVs from Tables 4.4a–b; t_syn, NMJ delay and EMG spread from Table 4.3a; t_rec excluded; Δ compares EV with the target. NF is the Level A rate graph (§4.13) with the Table 4.8e weights at h 0.25 ms (`verify-editor/lat3.mjs`; the h 0.5 ms values differ by ≤ 0.5 ms). Tolerances belong to §12 (provisional ±10 %).

| Pathway (node chain) | Path (mm) and classes | n_syn | EV (ms) | NF (ms) | Target (owner) | Δ | Verdict |
|---|---|---|---|---|---|---|---|
| Median nerve at wrist → `cuneate` → contralateral `thalVPL` → `s1.hand` (N20) | 737 + 24 Aβ65; 100 DC55; 73 ML45; 60 TC35 | 3 | 18.7 | 19.4 | ≈ 18–20 (§5) | within | pass |
| `indexTip` → `s1.hand` | as above + 182 Aβ50 | 3 | 22.3 | 23.1 | 21–24 (§5) | within | pass |
| Tibial at ankle → `cord.S1.dh` (N22) | 511 Aβ50; 466 + 201 Aβ65 | 1 | 21.1 | 21.1 | 21–23 (§5) | within | pass |
| Tibial at ankle → `gracile` (P30) | as N22 + 420 DC55 | 1 | 28.7 | 28.6 | ≈ 30 (§5) | −4 % | pass |
| Tibial at ankle → `gracile` → contralateral `thalVPL` → `s1.foot` (P37) | as P30; 74 ML45; 65 TC35 | 3 | 33.4 | 34.0 | 37–40 (§5; a peak) | −3.6 to −6.6 ms | pass as upper bound (§5.1); onset pending §5 |
| `patellarTendon` → `cord.L4.vh` → `quadriceps` | 413 + 188 Ia65; 188 + 413 α50 | 1 | 23.1 | 23.4 | 18–23 (§6) | +0.1 (upper edge) | pass |
| `achillesTendon` → `cord.S1.vh` → `gastrocSoleus` | 676 + 201 Ia65; 201 + 676 α50 | 1 | 32.8 | 33.2 | 30–36 (§6) | within | pass |
| `cochlea` → `cochNuc` → `pnc` → `n7m` → `orbicularisOculi` (startle blink) | 25 VIII-afferent 20; 20 + 15 cns20; 120 facial-motor 50 (all [model]) | 3 | 8.4 | 25.2 (26.2 with t_rec 1 ms, §5) | 20–40 (§6) | within | pass |
| `indexTip` Aδ → `cord.C7.dh` → `thalVMpo` → `insPost`/`s2` | 919 + 24 Aδ15; 171 STT10; 50 cns20 | 3 | 84.3 | 85.5 | laser-evoked onset (§5) | — | pending §5 t_rec |
| `indexTip` C → same chain (second pain) | 919 + 24 C1.0; 171 STT2.2; 50 cns20 | 3 | 1,025 | 1,026 | C-LEP N2 704 ± 179 ms (a peak, hand dorsum, §5.5), compared at the dispersed leading edge (mean − 1σ_t, §4.4) | leading edge ≈ 0.74 s (σ_t 0.28 s); the chain starts ≈ 110 mm distal of the target's hand-dorsum site (≈ 830 mm of peripheral path there), and the N2 mean implies C CV ≈ 1.3–1.6 m/s, the upper part of the 0.5–2.0 class range, against the 1.0 m/s default | marginal: the EV arrival exceeds the N2 mean by ≈ 1.8 SD and the pass leans on a −1σ_t shift that no other row uses. Optionally raise `C` to 1.2 m/s (class range unchanged) and re-run this chain |
| Sural at ankle Aδ → `cord.S1.dh` → 2 interneurons → `hamstrings` (biceps femoris; RIII) | 860 + 201 Aδ15 (860 [model]); 201 + 350 α50 (350 [model]) | 3 | 84.8 | 87.3 | RIII onset 90–130 (§6) | −6 % | marginal |
| `indexTip` Aδ → `cord.C7.dh` → 2 interneurons → `biceps` (withdrawal) | 919 + 24 Aδ15; 392 α55 | 3 | 73.0 | 75.4 | EMG onset 250–350 from contact, which includes t_rec 224 ms at 55 °C (§6.11, §11.9) | EV + t_rec = 297 ms | pass |
| `carotidSinus` (A) → `ntsVisc` → `nAmbVagal` → `cardiacPlexus` ganglion → `saNode` | 104 baroA15; 10 cns20; 279 B8; 10 Cpost1.0 (SA node → `nAmbVagal` 289) | 3 | 54.1 | 60.9 | vagal dead time (§7) | effector ≈ 0.25 of 0.3 s | consistent |
| `carotidSinus` (C) → same chain | 104 C1.0; then as above | 3 | 151.2 | 157.9 | as above | — | consistent |
| `carotidSinus` → `ntsVisc` → `cvlm` → `rvlm` → `cord.T1.iml` → `stellate` → `saNode` | 104 baroA15; 15 cns20; 131 bulbospinal3; 71 B8; 175 Cpost1.0 | 5 | 238.2 | 249.8 | sympathetic dead time (§7) | effector ≈ 1.76 of 2.0 s | consistent |
| `retina` → `opn` → `ew` → `ciliaryGang` → `pupilSphincter` (PLR, neural) | 105 optic8; 8 cns20; 78 B8; 35 Cpost1.0 | 3 | 60.1 (36.8 at 3 m/s postganglionic) | 65.4 | PLR onset (§7) | effector-dominated | consistent |

The chains follow the graph and the captures:
- Lemniscal: the graph path dorsal column → medial lemniscus → VPL → S1.
- Spinothalamic: [G Spinothalamic_tract L69, L71].
- Acoustic startle: three central synapses, auditory nerve → cochlear root neurons → PnC → facial motor nucleus [G Startle_response L33]. `cochNuc` stands for the root neurons; a sub-id `cochNuc.crn` is optional.
- Baroreflex: NTS → nucleus ambiguus, and NTS → CVLM → RVLM → IML [G Baroreflex L35, L37, L39].
- PLR: [G Pupillary_light_reflex L40, L56–L59].
- Withdrawal: [G Withdrawal_reflex L31].

These values replace the A.9 "resulting checks", with the §2.14 lengths:
- N20 (wrist): EV 18.7 ms, NF 19.4 ms (A.9 had ≈ 19.9).
- Fingertip → S1: EV 22.3 ms, NF 23.1 ms (A.9 had ≈ 23.4).
- Patellar EV 23.1 ms and Achilles EV 32.8 ms (22.5 and 32.1 on the A.9 lengths).

The differences from A.9 come from stating explicitly whether relay lags are counted and from the §2.14 path revisions.

Both stretch reflexes pass against the §6.11 ranges. Compared from tap onset (add t_rec ≈ 1 ms, §5.1), patellar composes to ≈ 24.1 ms, ≈ 1 ms above 23 ms and inside the ±10 % tolerance (§12.20), and Achilles to ≈ 33.8 ms. No proximal onset site is needed. If §2 adds one later, it applies to the quadriceps only: a proximal soleus site would put Achilles at ≈ 30 ms, at the floor of 30–36 ms. Stature-matched norms (latency rises with height, r ≈ 0.70; §6.11) are the reference, not short-stature cohorts.

The tibial chain needs the below-knee Aβ velocity of Table 4.4a. With 65 m/s along the whole leg it gives N22 18.7 ms, P30 26.4 ms and P37 31.1 ms, all more than 10 % short. With 50 m/s over the 511-mm ankle → popliteal segment, N22 and P30 pass. P37 (37–40 ms) is a cortical peak, which §5.1 treats as an upper bound; the model arrival precedes it by 3.6–6.6 ms, more than the relay terms explain, so §5 must source a P37 onset (§4.15). The H-reflex and Achilles rows are unchanged, because Ia keeps its calibrated 65 m/s (A.8 #13).

The startle blink shows a different gap. Pure conduction reaches `orbicularisOculi` at ≈ 8.4 ms (≈ 9.4 ms with t_rec), while the observed blink comes at 20–40 ms [G Startle_response L39]. The gap is assigned to temporal summation in `pnc`: its θ 0.7 (Table 4.8a) and τ 20 ms (Table 4.13a) give a relay term of 15.8 ms, and the simulated NF arrival is 25.2 ms. With τ_pnc 14 ms the blink would arrive at 20.5 ms, at the floor of the target; 20 ms keeps it inside 20–40 ms and is the single value used everywhere (§12.6).

Neural transport is a small part of cardiac reflex latency: ≈ 54–61 ms for the vagal limb and ≈ 0.24–0.25 s for the sympathetic limb. The rest of the §7 dead times is receptor biochemistry: ACh opening K⁺ channels on the SA node [G Heart_rate L55, L76] and β1–cAMP signalling for noradrenaline [T]. PLR latency is likewise dominated by phototransduction and sphincter kinetics (§5, §7).

### 4.12. Delayed-loop stability

A negative-feedback loop with dead time D and first-order lags τ_i has a critical gain K_c at its resonance frequency f_c:

```
G(s) = K · e^(−sD) / Π_i (1 + sτ_i)
D·ω_c + Σ_i atan(ω_c τ_i) = π;   f_c = ω_c / 2π;   K_c = Π_i √(1 + (ω_c τ_i)²)
```

Asymmetric kinetics, such as sympathetic τ_on ≠ τ_off, are bracketed by evaluating both values.

**Table 4.12a. Loop stability margins.**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Baseline gain margin K_c/K, every physiological loop | ≥ 2 (≥ 6 dB) | — | — | low | [model] |
| Baseline phase margin | ≥ 45 | deg | — | low | [model] |
| Spasticity demonstration (sustained clonus at f_c, amplitude limited by F) | K/K_c 1.05–1.2 | — | — | low | [model] |
| Damped Mayer-wave resonance on the sympathetic vascular loop | K/K_c 0.5–0.7 | — | — | low | [model]; de Boer, Karemaker & Strackee 1987 (qualitative) |
| Clinical ankle clonus frequency (validation target) | 5–7 (§6.11) | Hz | H | medium | §6.11 |
| Mayer-wave period (validation target) | ≈ 10 (≈ 0.1 Hz) | s | H | medium | de Boer, Karemaker & Strackee 1987 |

**Table 4.12b. Critical frequencies and gains** ([model] checks, `sec3checks.mjs`). D and τ come from §7 (A.8 #14) unless marked [model].

| Loop | D | Lags τ_i | f_c | K_c | Note |
|---|---|---|---|---|---|
| Stretch reflex, canonical | 62.8 ms (Achilles EV 32.8 + EMD 30) | force 40 ms [model] | 5.6 Hz | 1.72 | In the clonus band; spindle phase lead ignored |
| Stretch reflex, alternative | 35 ms | 40 + 40 ms | 5.6 Hz | 2.99 | Lens variant, EMD folded into the lags |
| Stretch reflex, short EMD | 47 ms | 40 + 40 ms | 4.7 Hz | 2.42 | Below the clonus band |
| Vagal heart-period limb + Windkessel | 0.3 s | 0.5 s; τ_WK 1.5 s [model] | 0.45 Hz | 7.5 | Hypothetical: §7.5 has no Windkessel |
| Vagal limb, §7.5 as written | 0.3 s | 0.5 s | 1.0 Hz | 3.3 | K ≈ 0.4, gain margin ≈ 8 |
| Sympathetic heart-rate limb + Windkessel, τ_on / τ_off | 2.0 s | 4 / 10 s; τ_WK 1.5 s [model] | 0.097 / 0.086 Hz | 3.6 / 7.0 | Hypothetical: §7.5 has no Windkessel |
| Sympathetic heart-rate limb, §7.5 as written, τ_on / τ_off | 2.0 s | 4 / 10 s | 0.146 / 0.134 Hz | 3.8 / 8.5 | Loop gain ≈ 0.22 |
| Sympathetic vascular (resistance) limb, §7.5 as written | 2.0 s | 6 s | 0.140 Hz | 5.4 | Loop gain ≈ 1.52, K/K_c ≈ 0.28 |
| Sympathetic vascular limb (illustrative) | 2.0 s | 4 s; vascular 1.5 s; τ_WK 1.5 s [model] | 0.071 Hz | 3.0 | Hypothetical; below 0.1 Hz |
| Sympathetic vascular limb (lens) | 2.5 s | 1.5 + 1.5 s | 0.102 Hz | 1.93 | Lens variant; matches Mayer waves |

The static loop gain of the vagal limb is ≈ BRS × |dMAP/dHP|. In §7.5, cardiac output scales as hr^0.25, so |dMAP/dHP| = 0.25·MAP/HP ≈ 0.025 mmHg/ms (MAP and HR from §7). With the §7.8 model BRS of 15.8 ms/mmHg, K ≈ 0.4 and the gain margin is ≈ 8 without a Windkessel.

The 0.086–0.097 Hz values assume a Windkessel lag (τ_WK 1.5 s) that §7.5 does not contain: there MAP = co/G is algebraic. With §7.5 as written, the vascular limb has f_c ≈ 0.14 Hz and K/K_c ≈ 0.3, the chronotropic limb a loop gain of ≈ 0.2, and the vagal limb damps the summed sympathetic limbs, so no Mayer resonance appears (§7.15; the closed-loop MAP spectrum is monotone). The sympathetic limbs alone, without the vagal limb, would peak at ≈ 0.11 Hz. The account in which the delay of the sympathetic limb produces the 10 s rhythm (de Boer, Karemaker & Strackee 1987, H) is contested by central-oscillator views (§4.15). If Mayer waves are wanted, §7 must add a second-order vascular stage (a Windkessel, τ ≈ 1.5 s) tuned to K/K_c 0.5–0.7 at 0.08–0.12 Hz (§7.15).

All loop rhythms pass through the §13 visual low-pass and pulse caps. A first-order envelope with τ = 0.3 s (§13) passes 17.4 % of a 3 Hz modulation and 8.8 % of a 6 Hz one ([model] check), so a 5.6 Hz clonus appears as a steady halo with a numeric readout.

### 4.13. Three-fidelity formalism and node-class time constants

One graph is integrated at three fidelities.

**Level A: rate graph (NF layer, step from §11).**

```
τ_i · dr_i/dt = −r_i + F_i(x_i)
x_i(t) = Σ_j w_ij · a_j(t − d_ij) + Σ_k w_ik^slow · s_ik(t) + I_i^ext(t)     (§4.3 slow filters; §4.6 DoG)
exact step, F frozen over h:   r_i ← F_i + (r_i − F_i) · e^(−h/τ_i)
input change at t + αh:        step over αh, then over (1 − α)h
```

This is the `relax` update in `src/dopamine.js` L19 (DOPAMINE.md §6.8). It is unconditionally stable, so a τ shorter than the NF step is allowed. F uses a lookup table, and delayed reads interpolate the §11 history ring.

**Level B: event packets (EV layer).** A packet carries the mean activation a of its source (dimensionless, A.3.4) for one fibre class over its emission interval. It arrives at t_emit + d_e and enters x_i as an area-preserving pulse whose width follows σ_t (§4.4), with ties ordered as in A.4. §11's periodic cadence is too coarse for reflex timing, so each source also emits an **onset packet** when |Δa| since its last packet exceeds δ_onset = 0.05 [model]. The onset packet is timestamped at the interpolated crossing, and arrivals use the split step, so arrival times carry no quantisation error. The delivery kernel is the same here and in §11.8: an area-preserving Gaussian of σ = max(1 ms, σ_t), truncated at ±3σ. For d_e ≤ 4.096 s (the §11.6 ring), a packet and a history read carry the same signal and §11 chooses per edge. Longer edges (§4.4) must use packets.

**Level C: single-cell inspector.** HH (Table 4.2b) or LIF (Table 4.2c) units are driven by Poisson trains at the rate of their host node [model]. They run only while visible and on tiers allowed by §11 and §13. The motoneuron pool uses ≤ 200 LIF units with log-spaced recruitment thresholds (size principle, Henneman 1957, C); motor-unit numbers belong to §6.

Rhythms are generated explicitly rather than left to emerge from E–I loops: `preBotC` (§3), the SA node (§7) and the gut slow waves (§8). Table 4.13b shows why.

**Table 4.13a. Node-class time constants.**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Receptor output stage, after the §5 adaptation filter | 0.5 | ms | — | low | [model] |
| Fast sensory and motor relays (`gracile cuneate spV prV cochNuc thalVPL thalVPM thalVMpo mgn lgn`; α and γ MN pools) | 0.6 (0.5–0.7) | ms | — | medium | [model] |
| Spinal and brainstem interneurons (dorsal horn incl. lamina I projection cells, Ia-inhibitory, Ib, flexion-reflex, `cpgL`, `opn`) | 1.5 | ms | — | low | [model] |
| Reticular premotor (`pno gi mrf`) | 10 | ms | — | low | [model] |
| `pnc` | 20 | ms | — | low | [model]; closes the startle gap (§4.11; blink NF 25.2 ms) |
| Autonomic premotor, preganglionic and ganglion nodes (`ntsVisc ntsGust dmv nAmbVagal rvlm cvlm ew`, `cord.*.iml`, `cord.*.spn`, ganglia) | 3 (2–5) | ms | — | low | [model] |
| Cortical areas (all `area` sub-sites) | 10 (5–20) | ms | — | medium | Wilson & Cowan 1972 [T] |
| Thalamic association, intralaminar, reticular (`thalMD thalPulv thalCM thalAnt thalVA thalVL thalRet`); BG and cerebellar nuclei (`stn gpe gpi snr fastigial interposed dentate`) | 5 | ms | — | low | [model]; §3 timing overrides |
| Limbic, hypothalamic, forebrain (`amygdala cea bnst hypothalamus pvn son scn` …); modulator sources (`lc dr mnr rmg tmn nbm lh`) | 20 | ms | — | low | [model]; pool τ §3 |

Dopamine cell groups use DOPAMINE.md §6.5. Nodes of kind `effector`, `organ`, `gland`, `pool` and `oscillator` follow their own kinetics (§6–§10).

**Table 4.13b. Integration checks.**

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Rate-unit error, τ 10 ms, inputs on step boundaries, h 0.1–10 ms | 0.000 | Hz (of 100) | — | high | [model] check, `rate.mjs` |
| Rate-unit error, input off the step grid (h 3 / 10 ms) | 0.83 / up to 38 | Hz (of 100) | — | high | [model] check, `rate.mjs`, `cell.mjs`; removed by split step |
| Wilson–Cowan E–I, stable regime, fixed point at h 0.25–40 ms | E* 0.8820 at every h | — | — | high | [model] check, `rate.mjs` |
| Wilson–Cowan, oscillatory regime, cycle frequency at h 0.25 / 1 / 5 / 20 / 40 ms | 18 / 14 / 10 / 6 / 4 | Hz | — | high | [model] check |

### 4.14. Analytic arrival-time overlay

For each stimulus or scenario event, the kernel predicts arrival times before the simulation shows them:
1. Take the active subgraph: edges whose `nets` are all on (A.5), minus the edges the current intervention removes (§11).
2. Expand each node into (node, afferent class) states, so that parallel Aβ, Aδ and C routes give separate first and second arrivals.
3. Run Dijkstra from the stimulated receptors with edge weights d_e. Add t_rec (§5) at the source, and add the relay term (§4.11) only when comparing with the NF layer.
4. Label the destinations named by the stimulus panel or scenario, for example "S1 22.3 ms" or "second pain 1.03 s". Keep each label until the simulation crosses q at that node. A mismatch beyond 1 ms per relay is logged as a kernel test failure (§11).
5. Recompute whenever a switch, intervention, temperature or age changes a delay.

At ≈ 740 nodes and ≈ 2,200 edges (§11.4), with ≤ 13 fibre classes, the search costs well under 1 ms. The overlay is the headless regression target for Table 4.11.

### 4.15. Open questions

- **Tibial P37.** The model reaches `s1.foot` 3.6–6.6 ms before the P37 peak. §5 should source a tibial P37 onset, or §4 should assign the gap (a leg thalamocortical delay or an extra relay).
- **Below-knee Aβ velocity** (50 m/s) is a calibration to the tibial SEP, consistent with slower leg nerves [G Nerve_conduction_velocity L66, L69] but not a measured tibial sensory CV.
- **Ia/Ib at 65 m/s** is a calibration, not a measurement. The HUD should show "human ≈ 55–70 (model 65); textbook 80–120 (cat)".
- **Spinothalamic velocities** rest on abstracts (Rossi et al. 2000; Qiu et al. 2001), against ≈ 21 m/s from Cruccu et al. 2000. Lemniscal and thalamocortical values are calibrations.
- **NF weights.** The Table 4.8e defaults reproduce the Table 4.11 NF column with w = 1; the blink latency depends steeply on w (it fails to fire below w ≈ 0.82), so `pnc` inputs must keep w = 1 when the I_ext baselines are set.
- **CT, Cmi and cutaneous diameter factors** rest on a review, on memory and on cat data, respectively.
- **k_T** is [recalled]. Should the default adult apply it to fever and cold limbs?
- **RIII, withdrawal and blink R1** need primary targets from §6 and paths from §2. R1 should undershoot as startle does, with the gap closed by the `prV`/`spV` τ.
- **Startle.** The `pnc` τ and θ and the brainstem path lengths are calibrations pending §2 and §3. Leg latencies up to ≈ 400 ms [G Startle_response L39] are unexplained.
- **PLR neural share** depends on the class of the short ciliary postganglionic fibres (60.1 vs 36.8 ms) and on the [model] optic velocity.
- **Dead-time reference.** §6 and §7 must state whether each dead time runs from the stimulus or from neural arrival (§4.11).
- **Mayer waves.** Should the model show the delay resonance, or keep the loop well damped (§7)?
- **Inspector.** Should it add a mammalian channel set at 37 °C, and demonstrate timing codes with LIF?
- **Electromechanical delay** depends on method. A shorter EMD under load would shift the clonus f_c.

### 4.16. Sources

Peer-reviewed (species; tags): Albrecht & Hamilton 1982 (Mk, C) [recalled]; Aston-Jones & Cohen 2005 (Mk); Blakemore, Wolpert & Frith 1998 (H); Boyd & Kalu 1979, *J Physiol* 289:277–297 (C) [unverified]; Carandini & Heeger 2012; Cruccu et al. 2000, *NeuroReport* 11:3029–3032, STT CV ≈ 21 m/s (H) (abstract); de Boer, Karemaker & Strackee 1987, *Am J Physiol* 253:H680–H689 (H); Destexhe, Rudolph & Paré 2003 (C) [recalled]; Gentet, Stuart & Clements 2000 (R) [recalled]; Georgopoulos et al. 1986 (Mk); Heeger 1992 (C); Henneman 1957 (C); Hodgkin & Huxley 1952, *J Physiol* 117:500–544 (Sq); Hursh 1939 (C) [recalled]; Jahr & Stevens 1990 (R) [recalled]; Johansson & Birznieks 2004 (H); Katz & Miledi 1965 (frog) [recalled]; Kuffler 1953 (C); Liljencrantz & Olausson 2014, *Front Behav Neurosci*, C-tactile review (H); Olshausen & Field 1996 (model); Qiu et al. 2001, *Neurosci Lett* 311:181–184 (H) (abstract); Rao & Ballard 1999 (model); Rodieck 1965 (C); Rossi et al. 2000, *Clin Neurophysiol*, indirect STT CV (H) (abstract); Rush & Larsen 1978 [recalled]; Rushton 1951 [recalled]; Sabatini & Regehr 1996, *Nature* 384:170–172 (R); Schmelz et al. 1997, *J Neurosci* 17:8003–8008 (H); Servan-Schreiber, Printz & Cohen 1990 (model); Srinivasan, Laughlin & Dubs 1982 (fly); Teghtsoonian 1971 (H); Vallbo et al. 1999, *J Neurophysiol* 81:2753–2763 (H) [secondary for CV]; Wilson & Cowan 1972 (model).

Textbook [T]: membrane τ; synaptic kinetics and reversal potentials; muscle fibre CV; electromechanical delay; k_T; internode length; √d scaling; visceral, baroreceptor, LC and bulbospinal velocities; clonus frequency; β1–cAMP latency; rmax ceilings; phase locking; burst mode.

Raw captures (`brain-system/raw/`): Action_potential L33, L45; Baroreflex L35, L37, L39; Cable_theory L284, L312; Corticospinal_tract L38; Group_A_nerve_fiber L37, L46; Group_C_nerve_fiber L39; Heart_rate L55, L76; Lateral_inhibition L21, L31, L33, L45; Myelin L33; Nerve_conduction_velocity L35–L36, L44–L48, L54–L55, L61–L69, L115, L117, L127, L133; Neural_adaptation L25, L29; Neural_coding L58; Neuromuscular_junction L50; Neurotransmitter L52; Predictive_coding L29, L39, L51; Pupillary_light_reflex L40, L56–L59; Receptive_field L59, L63; Spinothalamic_tract L54, L69, L71; Startle_response L33, L39; Stevens_27s_power_law L44; Vestibular_system L137; Weber_E2_80_93Fechner_law L27, L137, L343; Withdrawal_reflex L31.

Graph paths (`graphify path`, 2026-10-31):
- dorsal column–medial lemniscus → medial lemniscus → VPL → S1 (postcentral gyrus)
- muscle spindle → stretch reflex → α motor neuron
- cochlear hair cells → auditory nerve → cochlear root neurons → PnC → facial motor nucleus
- baroreceptor → solitary nucleus → nucleus ambiguus
- solitary nucleus → CVLM → RVLM → intermediolateral nucleus
- accelerans nerve → SA node
- Edinger–Westphal → ciliary ganglion → iris sphincter
- withdrawal reflex → reflex arc → interneuron
- locus coeruleus → noradrenaline

Links missing from the graph (retina → pretectum → EW, nucleus ambiguus → SA node, IML → stellate, STT → thalamus) were taken from the captures listed above.

Project documents: Appendix A (A.4, A.5, A.8 #13–#15, A.9); DOPAMINE.md §3, §3.1, §6.4–§6.6, §6.8; `src/dopamine.js` L19.

Scratch prototypes (model checks, not sources), in `C:\Users\User\AppData\Local\Temp\claude\C--Users-User-projects-galaxy\641a402d-336b-4b93-bc5d-2e26265edfd2\scratchpad\research-signal-processing\`: `cell.mjs`, `rate.mjs`, `net.mjs`, `perf2.mjs`, `sec3checks.mjs` (Table 4.12b) and `sec4table.mjs` (Table 4.11); all re-run 2026-10-31.

---

## 5. Sensory systems

### 5.1. Pipeline, ownership and intensity coding

For each modality, in A.6 order, this section gives the receptors, transduction, fibre class, adaptation, thresholds and intensity coding. It then gives the relay chain by node id (A.3.3) with measured arrival times per station, the cortical map and the outputs. §5.12–§5.16 cover descending control, multisensory integration, habituation, psychophysical scaling, stimulus parameters, switch dependence and dopamine coupling.

No coordinates are defined here: brain structures and ports are in §3, and sites, routes and path lengths in §2. Other sections own these quantities:
- **§4:** conduction velocities (A.9), synaptic and NMJ delays, filter forms, rmax, the Naka–Rushton exponent, DoG weights, NE gain, τ_pred, and the model-vs-target latency table. This section supplies that table's sensory targets.
- **§6:** reflex latencies and thresholds, and the `cn2`/`cn8` axon counts.
- **§7:** autonomic effector values.
- **§8:** gut numbers.
- **§3:** non-dopamine neuron counts, central firing rates, reaction times and LC timing.
- **§11:** implementation of the stimulus pipeline.
- **§13:** picking and display.

What happens to one stimulus:
1. The A.6 record resolves to a site (picking §13, coordinates §2).
2. Every receptor class at the site is driven if the stimulus exceeds its threshold `I0`, whatever sense was picked (A.6). For example, 55 °C drives warm fibres, cold fibres (paradoxical discharge, §5.6), Aδ mechano-heat nociceptors and C polymodal nociceptors. Drive u = I / I0. Half-saturation sits at the geometric centre of the class's dynamic range [model].
3. Adaptation uses the tabulated τA and kA. It is subtractive for SA classes and rectified on/off for RA classes (forms §4).
4. The class rate `rec.<site>` (Hz) leaves as packets on the listed fibre class. The delay comes from the §4 velocities and the §2 path lengths.
5. Arrival targets are measured from stimulus onset and feed the §4 model-vs-target table. Onset rows are binding; evoked-potential peaks are only upper bounds.
6. Cortical arrival activates the mapped `area` patch. `psi` = k·(I − I0)^a (a from §5.13) is a readout only.
7. Outputs leave through the efferent ports to §3, §6, §7 and §9.

Intensity is coded in three ways:
- by firing rate, up to rmax (§4);
- by recruitment of higher-threshold units and classes (step 2);
- by range fractionation within a class: auditory-nerve spontaneous-rate classes (§5.3), and regular versus irregular vestibular afferents (§5.9).

Place codes carry quality and location, not intensity. The olfactory bulb's timing code [G Olfactory_system L60] survives only as onset order (§4).

Natural stimuli add transduction delays that electrical stimuli and clicks lack. Photoreceptor and ORN onsets are in §5.2 and §5.7.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Extra delay at scotopic levels | +50–100 | ms | H | low | [T] |
| Cochlear transduction incl. travelling wave, click | ≈ 1 | ms | H | medium | [T] (fits ABR I, §5.3) |
| Vestibular hair-cell transduction | < 1 | ms | — | low | [T] |
| Mechanoreceptor step or tap; spindle Ia tendon tap | ≈ 1 | ms | — | low | [model] |
| Contact heat to nociceptor threshold | ramp stimuli: (θ_c − T_skin) / ramp + d²/(2α) ≈ 110 diffusion lag at the default terminal depth d 150 µm (α 1 × 10⁻⁷ m²/s, §6.10); contact steps use the §11.9 erfc model instead (224 at 55 °C) | ms | — | low | [model]; §6.10 depth, §11.9 |
| Tastant: diffusion and transduction | 50–200 | ms | — | low | [model] |
| Visceral mechanoreceptors | < 10 | ms | — | low | [model] |

### 5.2. Vision

Photoreceptors hyperpolarise through the cascade opsin → transducin → PDE → closure of cGMP-gated channels [T]. Bipolar and ganglion cells build centre–surround receptive fields by lateral inhibition [G Receptive_field L59–L63; G Lateral_inhibition L45] (DoG form §4). They form parallel magno, parvo and konio streams.

The relay is `retina` → optic nerve → chiasm → `lgn` [G Visual_system L49–L53] → layer 4 of `v1` [G Visual_cortex L39, L89]. In the LGN, magnocellular input enters layers 1–2 and parvocellular input layers 3–6 [T]. Nasal fibres cross at the chiasm, so each LGN and V1 carries the contralateral hemifield, and one eye reaches both hemispheres. Beyond V1 two streams diverge [G Visual_cortex L57–L58] (Ungerleider & Mishkin 1982, Mk; Goodale & Milner 1992, H):
- **Dorsal stream** (`v1` → `mt` → `ips`/`ppc`): motion, location and action.
- **Ventral stream** (`v1` → `v4` → `ffa`): form, objects and faces.

Smaller retinal targets:
- **Pupillary light reflex.** ipRGCs → `opn` → `ew` → `ciliaryGang` (§7) [G Pupillary_light_reflex L56–L58].
- **Circadian.** ipRGCs → retinohypothalamic tract → `scn` [G Suprachiasmatic_nucleus L59].
- **Collicular route.** `retina` → `sc` → `thalPulv` → `mt`. Its first step rests on Perry, Oehler & Cowey 1984 [recalled] (§5.17).

The accessory optic system is not modelled. The pupil (`pupilD.L/R`, §7) closes a feedback loop on retinal illuminance (luminance × pupil area). The loop is open when the autonomic network is off.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Rods per retina | ≈ 92 × 10⁶ (77–107 × 10⁶) | cells | H | medium | Curcio et al. 1990 [recalled]; [T] |
| Cones per retina | ≈ 4.6 × 10⁶ (4.1–5.3 × 10⁶) | cells | H | medium | Curcio et al. 1990 [recalled]; [T] |
| ipRGC share of RGCs (RGC and optic-axon totals → §6) | 1–2 | % | H | medium | [G Sensory_nervous_system L57] |
| RGC axons ending in LGN / SC | ≈ 90 / ≈ 10 | % | Mk | low | Perry, Oehler & Cowey 1984 [recalled] |
| Absolute threshold, dark-adapted brief flash | 5–14 | absorbed quanta | H | medium | Hecht, Shlaer & Pirenne 1942 [recalled]; [T] |
| `I0` rods / cones | ≈ 10⁻⁶ / ≈ 10⁻³–10⁻² | cd/m² | H | medium / low | [T] |
| Rod saturation | ≈ 10² | cd/m² | H | low | [T] |
| Cone dark-adaptation plateau; complete rod adaptation | 7–10; 30–40 | min | H | medium | Hecht, Haig & Chase 1937 [recalled]; [T] |
| Light-adaptation τA, cones / rods | 0.1 / 1 | s | — | low | [model] |
| ipRGC adaptation kA (sustained melanopsin drive) | ≈ 0.1 | — | Mk, H | low | [model]; Gamlin et al. 2007 [recalled] |
| V1 magnification M(E) = 17.3 / (E + 0.75), E in deg | — | mm/deg | H | low | Horton & Hoyt 1991 [recalled] |

Arrival targets from flash onset:

| Quantity (station, node) | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| First RGC spike, photopic (`retina` → `portRetina`) | 20–40 | ms | Mk | low | [T] |
| LGN magnocellular (`lgn`) | ≈ 33 | ms | Mk (anaesth.) | medium | Schmolesky et al. 1998 [unverified] |
| LGN parvocellular (`lgn`; ≈ 17 ms after magno) | ≈ 50 | ms | Mk (anaesth.) | medium | Schmolesky et al. 1998 [unverified] |
| SC superficial layers (`sc`) | 40–60 | ms | Mk | low | [T] |
| V1 onset (`v1`) | 40–60 | ms | H, Mk | medium | [G Visual_system L57] (species not stated); Di Russo et al. 2002 [recalled] |
| MT/V5 onset (`mt`) | ≈ 72 | ms | Mk (anaesth.) | low | Schmolesky et al. 1998 [recalled] |
| V4 onset range (`v4`) | 72–159 | ms | Mk (anaesth.) | medium | Schmolesky et al. 1998 [unverified] |
| Pattern-reversal VEP P100 | ≈ 100 | ms | H | medium | [T] |
| Face-selective N170 (`ffa`) | ≈ 170 (150–190) | ms | H | medium | Bentin et al. 1996 [recalled]; [T] |

Map: the contralateral hemifield lies on V1, with the fovea at the occipital pole and the upper field on the lower calcarine bank [T]. Area extents are in §3.

Outputs:
- Pupillary light reflex (§7).
- Orienting and saccades via `sc` (§3, §6).
- LC phasic arousal and salience (§3).
- Circadian phase via `scn` (§3).
- Melatonin suppression via `scn` → `pvn` → IML → `scg` → `pineal` (§7, §9) [G Visual_system L69].

A vision stimulus is never drawn as a screen flash (§13; A.9).

### 5.3. Hearing

The ear canal resonates at about 2.5–3.5 kHz, giving ≈ +10–15 dB over ≈ 2–5 kHz (quarter-wave resonance of a ≈ 25 mm canal ≈ 3.4 kHz); the pinna and concha add direction-dependent gain up to ≈ 12 kHz [T]. The capture's "3–12 kHz" amplification [G Auditory_system L80] is not adopted (§5.17). The ossicles raise sound pressure (gain in the table below) [G Auditory_system L35]. The basilar membrane separates frequencies by place: the stiff base is tuned high and the apex low [G Auditory_system L39]. Inner hair cells provide almost all afferent output. Outer hair cells are the electromotile amplifier, and the medial olivocochlear bundle sets their gain [G Cochlea L83] (§5.12). Auditory-nerve spontaneous-rate classes have staggered thresholds (range fractionation, §5.1). Phase locking carries timing up to a few kHz.

The relay is `cochNuc` → `soc` → lateral lemniscus → `ic` → `mgn` → `a1`:
- **Cochlear nuclei.** Bushy cells feed the olivary nuclei, stellate cells code spectral peaks and octopus cells code timing [G Auditory_system L45]. Most fibres cross in the trapezoid body [G Auditory_system L43].
- **SOC.** The first binaural convergence: MSO codes time differences and LSO level differences [G Auditory_system L41].
- **IC.** It receives the lateral lemniscus and projects to the thalamus and the SC [G Auditory_system L45–L50; G Nociception L72].
- **MGN to A1.** The ventral MGN relays topographically [G Auditory_system L54–L58] to tonotopic A1 [G Auditory_cortex L42, L54, L62].
- **Beyond A1.** Belt and parabelt areas split into a "what" and a "where" stream through `pt` (Rauschecker & Tian 2000, Mk).

Two reflex routes branch off. Cochlear root neurons and the nucleus of the lateral lemniscus drive `pnc` → `n7m` for startle [G Startle_response L33, L47]. The SOC drives the stapedius reflex via `n7m`. Both reflexes are §6's. Rate units do not represent ITD or phase-locking codes (§4). Audio is never played (A.6).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Cochlear turns | 2.75 | turns | H | high | [G Cochlea L51] |
| Basilar-membrane length | ≈ 32 (30–35) | mm | H | medium | [T] |
| Inner / outer hair cells | ≈ 3,500 / ≈ 12,000 | cells per cochlea | H | medium | [T] |
| Type I share of afferents (totals → §6) | ≈ 90–95 | % | H, C | medium | [T] |
| Middle-ear pressure gain | ≈ 20 | × | H | medium | [G Auditory_system L35] |
| Best threshold (2–5 kHz) | −5 to 0 | dB SPL | H | medium | [T] (ISO 226) |
| Discomfort; pain | 110–120; 130–140 | dB SPL | H | medium | [T] |
| Dynamic range of one AN fibre | 20–40 | dB | C | medium | [T]; Liberman 1978 [recalled] |
| Phase-locking upper limit | 4–5 | kHz | C | medium | Johnson 1980 [recalled]; [T] |
| AN adaptation τA, rapid / short-term | 1–5 / 30–70 | ms | Gb | low | Westerman & Smith 1984 [recalled] |
| Greenwood map f = A·(10^(a·x) − k), x from apex | A 165.4 Hz; a 2.1; k 0.88 | — | H | medium | Greenwood 1990 [recalled]; [T] |

Arrival targets for a 70–80 dB nHL click, measured from the eardrum:

| Quantity (station, node) | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| ABR I, distal `cn8` | 1.5–1.7 | ms | H | medium | [T] |
| ABR II, proximal `cn8` / `cochNuc` | 2.5–2.8 | ms | H | medium | [T] |
| ABR III, `cochNuc` / `soc` | 3.7–3.9 | ms | H | medium | [T] |
| ABR IV, `soc` / lateral lemniscus | 4.8–5.1 | ms | H | medium | [T] |
| ABR V, lateral lemniscus / `ic` | 5.5–5.8 | ms | H | medium | [T] |
| `mgn` arrival | ≈ 8–10 | ms | — | low | [model] (between ABR V and A1) |
| `a1` onset, Heschl's gyrus | 12–15 | ms | H | low | Liégeois-Chauvel et al. 1994 [recalled] |
| Middle-latency Na / Pa | ≈ 18 / 25–30 | ms | H | medium | [T] |
| N1 / P2 (`a1`, `pt`) | ≈ 100 / ≈ 180 | ms | H | medium | [T] |
| Mismatch negativity | 100–250 | ms | H | low | Näätänen et al. 2007 [recalled] |

Map: a tone's cochlear place comes from the Greenwood function. A1 tonotopy is simplified to one gradient along Heschl's gyrus, high frequencies posteromedial and low frequencies anterolateral [T, low]. Each A1 receives both ears, with contralateral dominance [T].

Outputs:
- Stapedius reflex and startle (§6).
- Orienting via `ic` → `sc` (§3).
- HR, SCR and pupil responses (§7).
- LC phasic response (§3).
- Arousal from sleep, gated by `arousalState` (§3; `sleepSound`, §12).

### 5.4. Touch

Glabrous skin has four low-threshold mechanoreceptor (LTMR) classes [G Mechanoreceptor L37–L40]:
- **SA1 (Merkel):** pressure, form and roughness.
- **SA2 (Ruffini):** skin stretch.
- **RA1 (Meissner):** flutter and slip.
- **PC (Pacinian):** high-frequency vibration.

SA1 and RA1 fields are small and dense in the fingertips and lips; PC and SA2 fields are large [G Mechanoreceptor L59]. Hairy skin adds hair-follicle and C-tactile (CT) afferents [G Group_C_nerve_fiber L65]. CT afferents respond best to slow, gentle stroking and code its pleasantness (Löken et al. 2009, H).

Discriminative touch ascends in the dorsal columns: gracile for input entering below T6, cuneate above. It relays in `gracile`/`cuneate`, crosses as internal arcuate fibres and runs in the medial lemniscus to `thalVPL` [G Dorsal_column_E2_80_93medial_lemniscus_pa L44, L48, L56]. From there it reaches `s1` (areas 3b and 1), `ba2`, `s2` and `ppc` [G Postcentral_gyrus L52; G Somatosensory_system L89, L97].

Other routes:
- **Face.** Trigeminal ganglion → `prV` → crossed ventral trigeminothalamic tract (trigeminal lemniscus) → contralateral `thalVPM` → `s1.face` [T]. A small uncrossed dorsal tract from `prV` carries oral-cavity input to the ipsilateral `thalVPM` at low weight (§3.16).
- **Crude touch.** Also ascends in the anterior spinothalamic tract [G Spinothalamic_tract L75–L77].
- **CT input.** Reaches `insPost` via lamina I (Olausson et al. 2002, H [unverified]), drawn through `thalVMpo` [model].

The cerebellar forward model attenuates self-produced touch (§3).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| LTMR units, glabrous skin of one hand | ≈ 17,000 | units | H | medium | Johansson & Vallbo 1979 [unverified]; Vallbo & Johansson 1984 [recalled] |
| Class shares RA1 / SA1 / PC / SA2 | 43 / 25 / 13 / 19 | % | H | low | Vallbo & Johansson 1984 [recalled] |
| Unit density, index fingertip / palm | 241 / 58 | units/cm² | H | medium | Johansson & Vallbo 1979 [unverified] |
| `I0` (`Abeta`) RA1 / SA1 / PC / SA2, median unit | ≈ 0.6 / 1.3 / 0.5 / 7.5 | mN | H | low | Johansson & Vallbo 1979 [recalled] |
| `I0` CT (`CT`) | < 5 | mN | H | medium | [G Group_C_nerve_fiber L65] |
| Perceptual threshold, fingertip (Semmes–Weinstein 2.83) | ≈ 0.7 | mN | H | medium | [T] |
| Vibration band SA1 / RA1 / PC | 5–15 / 10–50 / 200–300 (best 250) | Hz | H | medium | [G Somatosensory_system L69–L73; G Mechanoreceptor L40] |
| PC vibration threshold at 250 Hz | 0.1–0.5 | µm | H | medium | Verrillo 1963 [recalled]; [T] |
| CT optimal stroke velocity | 1–10 (peak ≈ 3) | cm/s | H | medium | Löken et al. 2009 [unverified] |
| LTMR dynamic range above `I0` | ≈ 2 | decades of force | — | low | [model] |
| τA; kA: SA1 / SA2 | 1.5; 0.6 / 10; 0.2 | s; — | — | low | [model] |
| τA (rectified on/off): RA1 / PC / hair follicle | 30 / 5 / 20 | ms | C (PC) | low | [model]; Loewenstein & Mendelson 1965 [recalled] (PC capsule high-pass) |
| CT τA; kA (fatigues on repeated stroking) | 1; 0.5 | s; — | H | low | [model]; Vallbo, Olausson & Wessberg 1999 [recalled] |

Arrival targets: the median nerve is stimulated electrically at the wrist and the tibial nerve at the ankle, in adults 170–180 cm tall. Latency grows with height; the reference body is in §2.

| Quantity (station, node) | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| N9, Erb's point (`plexusBrachial`) | 9–10 | ms | H | medium | [T] |
| N13, cervical dorsal horn (`cord.C6.dh`–`cord.C7.dh`) | ≈ 13 | ms | H | medium | [T] |
| P14, caudal medial lemniscus (above `cuneate`) | ≈ 14 | ms | H | medium | [T] |
| N20, area 3b (`s1.hand`) | 18–20 | ms | H | medium | [T] |
| Index fingertip → `s1.hand` | 21–24 | ms | H | low | [model] (wrist N20 plus distal Aβ conduction); [T] (digital N20 2–4 ms later) |
| Tibial N22, lumbar dorsal horn (`cord.S1.dh`) | 21–23 | ms | H | medium | [T] |
| Tibial P30, cervicomedullary (`gracile`) | ≈ 30 | ms | H | low | [T] |
| Tibial P37, foot area (`s1.foot`) | 37–40 | ms | H | medium | [T] |
| `s2` response peak | 90–125 | ms | H | medium | Hari et al. 1984, *Electroencephalogr Clin Neurophysiol* 57:254–263 (abstract: SI deflections at 30–80 and 150–180 ms, SII at 90–125 ms) |

With the §2.14 geometry, wrist N20 is 18.7 ms (EV; 19.4 ms NF) and fingertip → S1 22.3 ms (EV; 23.1 ms NF) (§4.11), both mid-range. The tibial N22 and P30 pass with the below-knee Aβ velocity, and the P37 peak is an upper bound that the model arrival precedes (§4.11). CT timing follows the C fibre class (§4).

Map: the homunculus runs medial to lateral as foot, leg, trunk, hand and face, with hand and face enlarged (Penfield & Boldrey 1937, H). The sub-sites are `s1.foot .leg .trunk .hand .face` (§3). Two-point thresholds are in §5.14.

Outputs:
- Cutaneous reflexes (§6).
- Gating of pain transmission (§5.12).
- Affective touch via `insPost` → `insAnt`.
- Orienting (§3).

### 5.5. Pain and itch

Nociceptors are free endings [G Mechanoreceptor L41] on Aδ and C fibres:
- **Aδ high-threshold mechanoreceptors:** pinprick.
- **Aδ mechano-heat nociceptors (AMH).** Type I has a high heat threshold and sensitises after injury. Type II has a low heat threshold and carries first pain to heat (Treede et al. 1995, Mk).
- **C polymodal nociceptors:** second, burning pain.
- **Mechano-insensitive C units.** Inflammation recruits them, and some carry histamine itch (Schmelz et al. 1997, H).

Cowhage itch uses polymodal C fibres (Namer et al. 2008, H). TRPV1 transduces heat, and TRPA1 transduces irritants and possibly noxious cold [G Nociception L56].

Afferents end in lamina I, lamina II (substantia gelatinosa [G Nociception L61]) and lamina V (wide-dynamic-range cells). Projection axons cross in the anterior white commissure within one or two segments [G Spinothalamic_tract L69]. Three ascending routes leave the dorsal horn:
- **Spinothalamic.** To `thalMD`, `thalVPL`, `thalVPM` [G Spinothalamic_tract L71] and `thalVMpo` [model; §5.18]. From there to `s1`/`s2` for location and intensity [G Spinothalamic_tract L87], `insPost` [G Insular_cortex L58], and `dacc` and `insAnt` for affect [G Nociception L76–L77].
- **Spinoparabrachial.** Lamina I → `pbn` and `pag` [G Nociception L62]; `pbn` → `cea` and `hypothalamus` for autonomic and affective drive (Todd 2010, R).
- **Spinoreticular.** To `gi`/`mrf`, for arousal [T].

Facial pain uses `spV` (caudalis), whose projection crosses at medullary levels to the contralateral `thalVPM` and `thalVMpo` (route `tractTrigSp`, §3.16). Aδ and C volleys from the hand arrive ≈ 1 s apart and are drawn as two packets (first and second pain).

Further mechanisms:
- **Sensitisation** includes wind-up (Mendell 1966, C; Price et al. 1977, H).
- **Spinal itch** is relayed by GRP–GRPR neurons (Sun & Chen 2007, Ms). Pain and scratching inhibit itch through Bhlhb5 interneurons (Ross et al. 2010, Ms).
- **Immune hyperalgesia** enters as `sickness.hyperalgesia` (§10).

Descending control is in §5.12.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Heat pain threshold (QST, from 32 °C at 1 °C/s) | 43–47 | °C | H | medium | Rolke et al. 2006 [recalled]; [T] |
| Cold pain (variable) / pressure pain (thenar) / pinprick pain threshold | 5–15 °C / 300–500 kPa / ≈ 30–130 mN | — | H | low | Rolke et al. 2006 [recalled] |
| `I0` heat, AMH type II / type I (`Adelta`) | ≈ 46 / > 53 | °C | Mk | low | Treede et al. 1995 [recalled] |
| `I0` heat, C polymodal (`C`) | 41–49 (mean 43–45) | °C | H | low | [T] |
| Mechano-insensitive share of C nociceptors (`Cmi`) | ≈ 15–25 | % | H | low | Schmidt et al. 1995 [recalled] |
| TRPV1 / TRPV2 activation | ≈ 43 / ≈ 52 | °C | R (cloned) | medium | Caterina et al. 1997, 1999 [recalled]; [T] |
| TRPA1 activation (contested) | < 17 | °C | Ms (channel) | low | Story et al. 2003 [recalled] |
| Minimum C-input rate for wind-up | ≈ 0.3 | Hz | C, H | low | Mendell 1966 [recalled]; Price et al. 1977 [recalled] |
| Nociceptor τA; kA (sensitisation separate) | 10; 0.3 | s; — | — | low | [model] |
| Nociceptor dynamic range above `I0` (heat) | ≈ 8 | °C | — | low | [model] |
| Histamine itch onset; duration | ≈ 10–30 s; ≈ 5–10 min | — | H | low | [T] |

Arrival targets for brief laser heat on the back of the hand or foot. These sites have shorter paths than the fingertip or toe.

| Quantity (station, node) | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Aδ LEP N1, operculo-insular (`s2`, `insPost`) | ≈ 150–170 | ms | H | low | [T] |
| Aδ LEP N2 / P2 (`dacc`) | 200–240 / 300–390 | ms | H | medium | [T] |
| C LEP N2 / P2, hand dorsum | 704 ± 179 / 984 ± 149 | ms | H | medium | Jankovski, Plaghki & Mouraux 2013 (abstract) |
| C LEP N2 / P2, foot | 1,314 ± 171 / 1,716 ± 171 | ms | H | medium | Jankovski, Plaghki & Mouraux 2013 (abstract) |

Map: `s1` is somatotopic. A posterior-insula somatotopy is reported but not drawn [recalled, low]. `dacc` and `insAnt` have no somatotopy.

Outputs:
- Withdrawal and crossed extension (§6); the raw capture describes withdrawal within 0.5 s [G Withdrawal_reflex L31].
- Defence-type HR, BP, SCR and pupil response (§7).
- HPA activation for intense or sustained pain (§9).
- Salience (§5.16).

### 5.6. Temperature

Warm fibres are C fibres; cold fibres are thinly myelinated Aδ, with some C [G Thermoreceptor L23]. Cold is transduced by TRPM8 [G Thermoreceptor L42, L50] and by two-pore-domain K⁺ leak channels that close on cooling [G Thermoreceptor L52]. TRPV3 and TRPV4 cover warm ranges [T].

Cold fibres overshoot on cooling and then settle to a static discharge. They also fire paradoxically above ≈ 45 °C [G Thermoreceptor L23] (Dodt & Zotterman 1952, C), so 55 °C drives them too. Within a neutral zone, sensation adapts away completely. Warmth summates over area (§5.13).

Afferents enter through Lissauer's tract, synapse one or two levels up, cross, and ascend in the spinothalamic tract to `thalVPL` [G Thermoreceptor L27]. Lamina I also receives them [G Nociception L62]. Two central routes follow:
- **Perception:** lamina I → `thalVMpo` → `insPost` (Craig et al. 2000, H).
- **Thermoregulatory feed-forward:** lamina I → lateral `pbn` → `mnpo` → `dmh` → `rpa`, to the §7 effectors and to shivering (§6) (Nakamura & Morrison 2008, R [recalled]; §5.17).

Perceived temperature is signed relative to the adapted skin temperature.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Warm / cool detection threshold (from 32 °C at 1 °C/s) | +1–2 / −0.5 to −1 | °C | H | medium | Rolke et al. 2006 [recalled]; [T] |
| Static-discharge maximum, cold (`Adelta`) / warm (`C`) fibres | 25–30 / 40–45 | °C | C, Mk | low | Hensel 1973 [recalled]; Darian-Smith et al. 1979 [recalled] |
| Paradoxical cold-fibre discharge | > 45 | °C | C | low | [G Thermoreceptor L23]; Dodt & Zotterman 1952 [recalled] |
| TRPM8 activation | < 25–28 | °C | R, Ms (channel) | medium | McKemy, Neuhausser & Julius 2002 [recalled]; Peier et al. 2002 [recalled] |
| TRPV3 / TRPV4 range | 33–39 / 27–34 | °C | Ms (channel) | low | [T] |
| 2P-domain K⁺ channel closure | < ≈ 28 | °C | — | low | [G Thermoreceptor L52] |
| Neutral zone (complete adaptation) | ≈ 30–36 | °C skin | H | low | [T] |
| Thermoreceptor τA; kA | 30; 0.7 | s; — | — | low | [model] |

No evoked-potential target is adopted (§5.18). Cold arrives with Aδ timing and warmth with C timing (§4).

Outputs:
- Vasomotor, sweat and BAT responses (§7).
- Shivering (§6).
- The diving response to a cold face (`coldFace`, §7, §12).

### 5.7. Smell

Each olfactory receptor neuron (ORN) expresses one receptor gene. It transduces through Golf → adenylyl cyclase III → cAMP → CNG channels, amplified by a Ca²⁺-activated Cl⁻ current [T]. Unmyelinated ORN axons cross the cribriform plate to the bulb [G Olfactory_system L48–L50]. ORNs with the same receptor converge on a few glomeruli, and mitral and tufted cells code concentration by timing [G Olfactory_system L60].

The lateral olfactory tract reaches:
- the AON, which is reciprocally linked to the bulb and the piriform cortex [G Olfactory_system L83];
- `piriform`, `olfTubercle` and the cortical `amygdala` [G Olfactory_system L62];
- `entorhinal` [T].

There is no thalamic relay before primary cortex.

Secondary routes:
- `piriform` → `ofcOlf` [G Olfactory_system L62].
- Olfactory cortex → `thalMD` → `ofcOlf` [T].
- `olfTubercle` → thalamus and `hypothalamus` [G Olfactory_system L64].
- Mitral cells → `hypothalamus`, for feeding [G Olfactory_system L75].

High concentrations co-activate trigeminal chemonociceptors (`cn5.som`), which belong to the somatic network and produce sneeze, breath-holding and irritation.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| ORNs, both sides | 6–10 × 10⁶ | cells | H | low | [T] |
| Intact olfactory receptor genes | ≈ 350 | genes | H | low | Malnic, Godfrey & Buck 2004 [recalled] |
| Glomeruli per bulb | ≈ 5,500 (2,975–9,325) | glomeruli | H | medium | Maresh et al. 2008 [unverified] |
| `I0` | 1 by definition | × threshold | — | — | [model] |
| ORN dynamic range | 1–2 | decades | — | low | [T] |
| Receptor τA; kA | 5; 0.7 | s; — | — | low | [model] |
| Perceptual adaptation half-time; recovery | 1–3; minutes | min | H | low | Dalton 2000 [recalled] |
| Trigeminal co-activation | > ≈ 10⁴ | × threshold | — | low | [model] |
| ORN response onset (`olfEpith` → `portOlf`) | 100–400 | ms | H, R | low | [T] |
| Olfactory ERP N1 / P2 | 300–450 / 500–800 | ms | H | low | Kobal & Hummel 1988 [recalled] |

`piriform` codes odours as distributed ensembles without spatial chemotopy [T, low], so it is drawn as a uniform patch.

Outputs:
- Cephalic-phase salivation, insulin and acid with food odours (§8).
- Nausea and sympathetic activation with aversive odours (§7).
- Sneeze (§6).
- Salience and reward (§5.16).

### 5.8. Taste

Taste buds sit in the fungiform, foliate and circumvallate papillae and on the palate and throat [G Taste L27]. Transduction (mouse data):
- **Type II cells** (sweet, umami, bitter) release ATP through CALHM1 (Taruno et al. 2013, Ms).
- **Type III cells** transduce sour through OTOP1 and release 5-HT (Tu et al. 2018, Ms).
- **Low salt** acts through ENaC (Chandrashekar et al. 2010, *Nature* 464:297–301, taste-cell-specific ENaC-α knockout, Ms).

Innervation [T]:
- Anterior two-thirds of the tongue (fungiform): `cn7.special` (chorda tympani, geniculate ganglion).
- Foliate papillae: VII and IX.
- Posterior third (circumvallate): `cn9.special` (petrosal ganglion).
- Palate: VII (greater petrosal).
- Epiglottis and larynx: `cn10.special` (nodose ganglion).

Every quality is detected at every lingual locus (Collings 1974, H). Choosing `tongueAnt` or `tonguePost` therefore selects the nerve, not the quality.

The afferents converge on rostral NTS (`ntsGust`) [G Vagus_nerve L82; §5.17]. In primates the NTS projects directly to `thalVPMpc` (Beckstead, Morse & Norgren 1980, Mk [recalled]); rodents relay through the PBN. The thalamus projects to the primary gustatory cortex `gust` (dorsal mid-insula and frontal operculum; Veldhuizen et al. 2011, H [recalled]) and `areaG`. From there the signal reaches `ofcOlf` (value), `amygdala` and `lh`.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Taste buds; receptor cells per bud | 2,000–5,000; 50–100 | buds; cells | H | medium | [G Taste L27] |
| Detection threshold NaCl / sucrose / citric acid / MSG | 2–10 / 5–20 / 1–3 / 1–3 | mM | H | low | [T] |
| Detection threshold quinine | 5–30 | µM | H | low | [T] |
| Dynamic range | ≈ 2 | decades above threshold | — | low | [model] |
| Perceptual adaptation (constant stimulus) | 0.5–2 | min | H | low | [T] |
| Primary gustatory area onset, 1 M NaCl / 3 mM saccharin (`gust`) | ≈ 93 / ≈ 172 | ms | H | medium | Kobayakawa et al. 1996 (abstract) |
| `areaG` latency relative to `gust`, NaCl | ≈ equal | — | H | low | Kobayakawa et al. 1999 [unverified] |

Outputs:
- Gustatory–salivary reflex: `ntsGust` → `ssn`/`isn` → `cn7.para`/`cn9.para` (§7).
- Cephalic-phase insulin and acid (§8).
- Gag and swallow (§6).
- Gustofacial expressions, present in neonates (Steiner 1973, H; not drawn).
- Reward and aversion (§5.16).

### 5.9. Balance

Each labyrinth has three roughly orthogonal semicircular canals [G Vestibular_system L39] and two otolith organs. The utricle senses horizontal and the saccule vertical linear acceleration and tilt [G Vestibular_system L157]. Rotation deflects the cupula and its hair cells [G Vestibular_system L44, L68]. The cupula behaves as an over-damped pendulum, so for head movements at 0.1–10 Hz its deflection tracks head velocity [G Vestibular_system L137].

The capture's 20 s time constant combines two processes (A.8 #15):
- **Afferent high-pass:** the canal afferent itself high-passes with τ ≈ 5 s.
- **Velocity storage:** the vestibular nuclei and nodulus extend the perceived and VOR time constant to ≈ 15 s.

A sustained rotation is therefore felt to fade over tens of seconds, and stopping gives an opposite after-sensation. Regular afferents carry tonic signals and irregular afferents phasic ones (§5.1).

The route `vestLabyrinth` → `cn8` (Scarpa's ganglion) → `vestNuc` is [T] (§5.17), with direct primary input to `flocculus` and `nodulus`. The vestibular nuclei project to:
- `n3`, `n4` and `n6` via the MLF (VOR, §6) [G Vestibular_system L150];
- the cerebellum [G Vestibular_system L149] and the vestibulospinal tracts (§6);
- the reticular formation [G Vestibular_system L151]; together with `ntsVisc` and `pbn` this gives vestibulosympathetic BP support and motion-sickness signs (§7);
- the thalamus [G Vestibular_system L153], drawn as `thalVPL` (VPI) → `pivc` (OP2) and `insPost` (zu Eulenburg et al. 2012, H; Eickhoff et al. 2006, H).

The camera never moves for balance stimuli (A.6).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Cupula fast time constant T1 | ≈ 5 | ms | H | medium | [G Vestibular_system L137] |
| Canal afferent high-pass τ | 5 | s | SM | medium | Fernández & Goldberg 1971 [recalled]; A.8 #15 |
| Velocity-storage τ (perception, VOR) | 15 | s | Mk | medium | Raphan, Matsuo & Cohen 1979 [recalled]; A.8 #15 |
| Velocity-transduction band | 0.1–10 | Hz | H | medium | [G Vestibular_system L137] |
| Canal afferent resting rate | ≈ 90 | spikes/s | SM | low | Goldberg & Fernández 1971 [recalled] |
| Yaw threshold at 1 Hz (higher at lower frequencies) | 0.5–1.5 | deg/s | H | low | Grabherr et al. 2008 [recalled] |
| Linear acceleration threshold | 0.05–0.1 | m/s² | H | low | Benson, Spencer & Stott 1986 [recalled] |
| Tilt threshold | 0.5–1.5 | deg | H | low | [T] |
| Otolith kA, regular / irregular; τA | 0.1 / 0.6; 1 s | — | SM | low | [model] |

No cortical arrival target is adopted. VOR and cVEMP latencies and the Scarpa's ganglion totals are §6's.

Outputs:
- VOR and vestibulospinal posture (§6).
- Vestibulosympathetic BP support on posture change (§7, `standUp`).
- Nausea, pallor and sweating with conflicting rotation (§7).
- Self-motion perception in `pivc`.

### 5.10. Proprioception

Muscle spindles are 1–3 mm long [G Proprioception L63] and hold 5–14 intrafusal fibres [G Muscle_spindle L55]. Ia endings signal length and velocity, II endings length; static and dynamic γ drive sets their sensitivity [G Muscle_spindle L67]. Golgi tendon organs (Ib) lie in series with muscle fibres and signal active force. Joint receptors fire mainly near end range, and SA2 skin stretch contributes to finger position [G Somatosensory_system L75].

Conscious proprioception ascends in the dorsal columns (`cuneate`/`gracile` → `thalVPL` → `ba3a`, `ba2`) [G Proprioception L43]. Unconscious proprioception ascends in the spinocerebellar tracts [G Proprioception L44; G Golgi_tendon_organ L58]:
- **Dorsal tract (leg):** Clarke's column `cord.T1…L2.clarke` → inferior peduncle → `cerebellum`.
- **Cuneocerebellar route:** the arm.
- **Ventral tract:** the state of the limb CPG.

Segmental reflex arcs are §6's.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Intrafusal fibres per spindle; spindle length | 5–14; 1–3 | fibres; mm | H | medium | [G Muscle_spindle L55; G Proprioception L63] |
| Movement-detection threshold, proximal / finger joints (rises at slow velocities) | 0.2–1 / 1–6 | deg | H | low | Hall & McCloskey 1983 [recalled] |
| τA; kA: Ia (plus velocity term) / II / Ib | 0.2; 0.5 / 2; 0.2 / 1; 0.3 | s; — | — | low | [model] |

Validation uses the mixed-nerve SEP rows of §5.4, which include muscle afferents.

Outputs:
- Stretch, H- and long-latency reflexes (§6).
- Posture and the cerebellar forward model (§3).
- Perceived heaviness and force (§5.13).

### 5.11. Interoception

Interoceptive signals reach the brain by three routes [G Interoception L29]:
- vagal and glossopharyngeal afferents to the NTS;
- lamina I spinal visceral afferents on the spinothalamic route;
- blood-borne signals at the CVOs.

Receptor parameters that set reflexes belong to §7 (cardiorespiratory, bladder) and §8 (gut). This section owns only the sensation thresholds and the central routing.

| Receptor (site id) | Nerve, ganglion | Fibre class | First relay → ascending route |
|---|---|---|---|
| Arterial baroreceptors, PIEZO1/2 (`carotidSinus`, `aorticArch`) [G Baroreflex L35, L45] | `carotidSinusNerve`/`cn9.aff`; `cn10.aff`, `nodoseGang` | A-fibre baroreceptor, `C` | `ntsVisc` [G Baroreflex L47] → `pbn` → `thalVPMpc` → `insPost` |
| Carotid body (`carotidBody`) | `cn9.aff` | `C` | `ntsVisc` |
| Pulmonary SAR, RAR, J (`lungStretch`) | `cn10.aff` | A (SAR, RAR), `C` (J) | `ntsVisc` |
| Gastric and oesophageal IGLE, IMA, mucosal chemoreceptors (`stomachWall`, `duodenum`) | `cn10.aff`, `nodoseGang` [G Vagus_nerve L50] | `C` | `ntsVisc` [G Vagus_nerve L82] → `pbn`, `pvn`, `cea` |
| Spinal visceral high-threshold afferents | `splanchnicGreater` etc., `drg.T5…L2` | `Adelta`, `C` | lamina I → `thalVMpo` → `insPost` |
| Rectal mechanoreceptors (`colonRectum`) | `splanchnicPelvic`, `drg.S2…S4` | `Adelta`, `C` | `cord.S3.dh` → `thalVMpo`; `pag` |
| Bladder tension receptors, silent C (`bladder`) | `splanchnicPelvic`, `drg.S2…S4` | `Adelta`, `C` | `cord.S3.dh` → `pag` → `barrington`; → `insPost`, `dacc` |
| Central CO₂, osmoreceptors, warm-sensitive neurons | CNS (`rtn`, `ovlt`, `sfo`) | `cns` | intrinsic; `portCVO` |

The NTS is viscerotopic. It projects to `pbn` → `thalVPMpc` (the basal ventromedial nucleus) → `insPost` → `insMid` → `insAnt`. Along this posterior-to-anterior gradient the body state is re-represented and integrated with affect (Craig 2002, 2009 [recalled]; the NTS → PBN step per §5.17).

Further projections:
- The anterior insula also receives `thalVPMpc` and `cea` input [G Insular_cortex L52].
- The posterior insula receives the spinothalamic route [G Insular_cortex L58].
- The NTS also feeds `pvn` [G Paraventricular_nucleus_of_hypothalamus L80], `cea`, `dmv`, `nAmbVagal` and `cvlm` (§7, §9).

Arterial baroreceptor activity is not consciously perceived in the model. A `baroStep` produces reflexes and insula activity, with `psi` = 0 [model].

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Bladder: first sensation / normal desire / strong desire | 150–250 / 250–400 / 400–550 | mL | H | low | [T] |
| Rectal balloon: first sensation / desire / maximum tolerated | 10–40 / 60–150 / 150–300 | mL | H | low | [T] |
| Gastric distension: first sensation / discomfort | ≈ 200–400 / ≈ 600–800 | mL intragastric | H | low | [T] |
| Heartbeat-evoked potential window after the R wave | 200–600 | ms | H | low | Park & Blanke 2019 [recalled] |
| Visceral mechanoreceptor τA; kA (slowly adapting) | 30; 0.3 | s; — | — | low | [model] |

Outputs:
- Baroreflex, chemoreflex and micturition (§7).
- Satiety and gut reflexes (§8).
- HPA activation via NTS → PVN (§9).

### 5.12. Cross-modal processing and descending control

`thalRet` gates the thalamic relays, and arousal state scales them. Attenuation in N2 and N3 sleep (§3) sets the arousal threshold for `sleepSound` (§12). NE gain and basal-forebrain ACh act on sensory thalamus and cortex (gain form §4; modulator states §3). Corticofugal and olivocochlear efferents let cortex control its own input. Medial olivocochlear efferents lower outer-hair-cell gain in noise [G Cochlea L83; T].

Nociceptive transmission is controlled at three levels, which the model combines into one dorsal-horn gain (form §4):
- **Segmental gate.** Aβ input drives dorsal-horn inhibitory interneurons (Melzack & Wall 1965).
- **PAG–RVM.** `pag` drives the RVM (`rmg`), whose serotonergic and enkephalinergic output inhibits dorsal-horn transmission [G Periaqueductal_gray L36, L42–L44; G Nociception L67]. RVM ON and OFF cells facilitate or inhibit the dorsal horn (Fields et al. 1983, R; Basbaum & Fields 1984).
- **Noradrenergic α2 inhibition** from `lc` and the A5/A7 groups [T]. The graph links `lc` to the dorsal horn only through the raphe.

The deep `sc` integrates vision, hearing (IC input [G Nociception L72]) and touch in spatial register for orienting. Cues that coincide in space and time give super-additive responses, and the gain is largest for weak cues (inverse effectiveness; Meredith & Stein 1983, C; Stein & Meredith 1993, C).

Repeated identical stimuli habituate orienting and startle, and a novel stimulus dishabituates them. The prediction mechanism and τ_pred are §4's; the empirical markers are PPI (below) and the MMN (§5.3). The PPI circuit runs from `ic`, `sc` and `ppn` to `pnc` (§6) and is modulated by limbic–striatal–pallidal input (Swerdlow, Geyer & Braff 2001, R).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| PPI effective / maximal lead interval | 30–500 / 60–120 | ms | H | low | Graham 1975 [recalled]; Blumenthal et al. 2005 [recalled] |
| Typical PPI, healthy adults | 40–70 | % startle reduction | H | low | [T] |
| Startle habituation, first trials | ≈ 50 % decline within 5–10 trials | — | H | low | [T] |
| Habituation constants of the §4.9 trace (startle, orienting): k_hab; τ_rec; ρ | 0.25; 300 s; 1 per suprathreshold event | —; s; — | — | low | [model]; repeats at a 20-s interval give g_hab 0.54 at trial 5 and 0.38 at trial 10, matching the row above |
| SC multisensory temporal window | ≈ 100–500 | ms | C | low | Meredith, Nemitz & Stein 1987 [recalled] |

### 5.13. Psychophysical scaling: Stevens exponents and Weber fractions

The `psi` readout uses the exponent of the stimulus mode, and the HUD shows the Weber fraction as the just-noticeable step. I in `psi` = k·(I − I₀)^a is the physical continuum of each row: luminance (cd/m²) for vision, sound pressure for hearing, vibration amplitude (µm) and force (mN) for touch, temperature difference (°C) for pain and temperature, concentration for smell and taste. Weber's law fails near threshold [G Weber_E2_80_93Fechner_law L137] and only approximately holds for loudness [G Weber_E2_80_93Fechner_law L347], so the display uses the power law. Stevens's stimulus conditions are given in brackets.

| Sense, mode | Continuum | Exponent a | Species | Conf. | Source |
|---|---|---|---|---|---|
| vision, step / flash | Brightness (5° dark target / point source, brief flash) | 0.33 / 0.5 | H | medium | [G Stevens_27s_power_law L71–L73] |
| hearing | Loudness (3 kHz); I is sound pressure, p = 20 µPa · 10^(L/20) (equivalently a = 0.33 on intensity), so loudness doubles every ≈ 9 dB | 0.67 | H | medium | [G Stevens_27s_power_law L68] ("Sound pressure of 3000 Hz tone") |
| touch, vibration ≤ 100 / > 100 Hz | Vibration (60 / 250 Hz) | 0.95 / 0.6 | H | medium | [G Stevens_27s_power_law L69–L70] |
| touch, press | Pressure on palm | 1.1 | H | medium | [G Stevens_27s_power_law L93] |
| touch, stroke | Roughness (CT pleasantness is an inverted U over velocity, Löken et al. 2009) | 1.5 | H | low | [G Stevens_27s_power_law L90] |
| pain, heat | Thermal pain (radiant) | 1.0 | H | medium | [G Stevens_27s_power_law L89] |
| temperature, cool / warm | Cold contact / warmth: contact, small, large irradiation | 1.0 / 1.6, 1.3, 0.7 | H | medium | [G Stevens_27s_power_law L83–L86] |
| smell | Heptane | 0.6 | H | medium | [G Stevens_27s_power_law L82] |
| taste, sweet / salty | Sucrose (saccharin 0.8) / salt | 1.3 / 1.4 | H | medium | [G Stevens_27s_power_law L79–L81] |
| balance, rotation | Angular acceleration (5 s; onset acceleration) | 1.4 | H | medium | [G Stevens_27s_power_law L99] |
| proprioception, force | Heaviness / muscle force | 1.45 / 1.7 | H | medium | [G Stevens_27s_power_law L94–L95] |
| other pain modes, sour, bitter, umami, joint angle, distensions | none | 1.0 | — | low | [model] |

| Continuum | Weber fraction ΔI/I | Species | Conf. | Source |
|---|---|---|---|---|
| Lifted weight | 0.02–0.05 | H | low | [G Weber_E2_80_93Fechner_law L340] (5 % illustrative); [T] |
| Sound intensity (ΔL 0.5–1 dB) | 0.12–0.26 | H | medium | Jesteadt, Wier & Green 1977 [recalled]; [T] |
| Luminance (photopic, large field) | 0.01–0.02 | H | low | [T] |
| Vibration amplitude; static pressure | 0.1–0.3; 0.1–0.15 | H | low | [T] |
| Odour; taste concentration | 0.25–0.3; 0.15–0.25 | H | low | Cain 1977 [recalled]; [T] |

### 5.14. Stimulus parameters and valid sites

This table fixes the final A.6 values. Markers that restate another section's numbers carry that section's reference, and durations are [model] defaults. Two ranges differ from A.6:
- **Pain heat starts at 42 °C** instead of 45 °C, so the slider spans the whole heat-pain threshold distribution and the C polymodal thresholds (§5.5).
- **Gastric distension reaches 800 mL** instead of 400 mL, so the discomfort band (§5.11) is reachable (§5.18).

Scenario inputs and the default manual behaviour per sense are §12's.

| Sense | Modes | Parameter (unit): range, default | Duration (ms): range, default | Markers | Valid sites |
|---|---|---|---|---|---|
| vision | flash, step | luminance (log₁₀ cd/m²): −6…+5, +3 | flash 10–100, 10; step 100–2,000, 1,000 | rod `I0` −6, cone `I0` −3…−2, rod saturation +2 (§5.2); PLR (§7) | `retina` L/R/both |
| hearing | click, tone, noise | level (dB SPL): 0–130, 70; tone (Hz): 125–8,000, 1,000; rise (ms): 0.5–20, 5 | click 0.1; tone, noise 10–2,000, 200 | threshold ≈ 0 (§5.3); stapedius ≈ 85 (§6); startle ≈ 90 (§6); discomfort 110–120, pain 130 (§5.3) | `cochlea` L/R/both |
| touch | press, vibration, stroke | force (mN, log): 0.1–10,000, 50; vibration (Hz): 5–400, 250, amplitude (µm, log) 0.1–1,000, 10; stroke (cm/s): 0.3–30, 3 | press 50–5,000, 1,000; vibration 100–5,000, 1,000; stroke 500–5,000, 2,000 | fingertip ≈ 0.7 mN; bands 5–15 / 10–50 / 250 Hz; CT optimum 1–10 cm/s (§5.4) | skin sites (below) |
| pain | heat, cold, pinprick, pressure, itch | heat (°C): 42–60, 50; cold (°C): 0–15, 5; pinprick (mN): 8–512, 256; pressure (kPa): 100–800, 500; itch (relative): 0–1, 0.5 | heat 100–5,000, 1,000; cold 1,000–30,000, 5,000; pinprick 10–100, 20; pressure 1,000–10,000, 3,000; itch single event | heat pain 43–47, AMH II ≈ 46, AMH I > 53; cold pain 5–15; pinprick ≈ 30–130 mN; pressure 300–500 kPa (§5.5) | skin sites; itch gain × 0.5 on glabrous sites [model] |
| temperature | warm, cool | contact (°C): 15–45, 40 (warm) / 25 (cool); ramp (°C/s): 0.5–5, 1; baseline 32 °C | 1,000–60,000, 10,000 | detection +1–2 / −0.5 to −1; TRPM8 < 25–28; neutral zone 30–36 (§5.6) | skin sites |
| smell | odour | concentration (log₁₀ × threshold): 0–8, 2; class food / neutral / aversive | 200–10,000, 2,000 | trigeminal > 4 (§5.7) | `olfEpith` L/R/both |
| taste | sweet, salty, sour, bitter, umami | concentration (× threshold): 0–100, 10 | 500–10,000, 2,000 | 1 = threshold (§5.8) | `tongueAnt`, `tonguePost`, L/R (nerve, not quality) |
| balance | rotation, linear, tilt | peak angular velocity (deg/s): 0–300, 60, yaw/pitch/roll, 1 s ramp, hold, stop; linear (m/s²): 0–10, 1; tilt (deg): 0–30, 10 | rotation 1,000–60,000, 10,000; linear 200–5,000, 1,000; tilt 1,000–60,000, 10,000 | yaw 0.5–1.5 deg/s; linear 0.05–0.1 m/s²; tilt 0.5–1.5 deg (§5.9) | head (both labyrinths); camera never moves |
| proprioception | imposedMovement, tendonTap | movement (deg): 0–30, 5 at (deg/s) 1–100, 10; tap stretch (mm): 0.5–5, 2 | set by angle and velocity; tap 10 | joint 0.2–1 deg proximal, 1–6 deg finger (§5.10); tap reflex threshold (§6) | `shoulder elbow wrist finger hip knee ankle`; `bicepsTendon tricepsTendon patellarTendon achillesTendon` |
| interoception | baroStep, lungInflation, gastricDistension, duodenalLipid, colorectalDistension, bladderFill, co2 | baroStep (mmHg): −40…+40, +20; lungs (L): 0–3, 1; gastric (mL): 0–800, 200; duodenal lipid (kcal): 0–100, 30; colorectal (mL): 0–300, 100; bladder (mL): 0–600, 300; ΔPaCO₂ (mmHg): 0–20, 5 | baroStep 1,000–60,000, 10,000; distensions and fills 10,000–300,000, 60,000; co2 30,000–600,000, 120,000 | baroStep not perceived; gastric, rectal, bladder sensation (§5.11); Hering–Breuer (§7) | `carotidSinus`/`aorticArch`, `lungStretch`, `stomachWall`, `duodenum`, `colonRectum`, `bladder`, `carotidBody` (plus `rtn`); rays hit organ volumes, not skin |

Skin sites. Spinal segments are assigned in §6 and coordinates in §2; density is relative to the fingertip.

| Site id | Skin; CT | Afferent route | Two-point threshold (mm) | Relative LTMR density | Conf. | Source |
|---|---|---|---|---|---|---|
| `indexTip` | glabrous; no | spinal, median | 2–4 | 1.0 | medium | Weinstein 1968 [recalled]; Johansson & Vallbo 1979 [unverified] |
| `palm` | glabrous; no | spinal, median and ulnar | ≈ 10 | 0.24 | medium | as above |
| `forearmDorsal` | hairy; yes | spinal | ≈ 35–40 | ≈ 0.05 | low | Weinstein 1968 [recalled]; [model] |
| `umbilicus` | hairy; yes | spinal (T10 key point) | ≈ 30–35 | ≈ 0.05 | low | [T]; [model] |
| `footSole` / `heel` | glabrous; no | spinal, tibial | ≈ 20 / ≈ 20–25 | ≈ 0.1 | low | Weinstein 1968 [recalled]; [model] |
| `bigToe` | glabrous pad; no | spinal | ≈ 10 | ≈ 0.15 | low | Weinstein 1968 [recalled]; [model] |
| `foreheadV1` / `cheekV2` / `chinV3` | hairy; yes | trigeminal V1 / V2 / V3 → `prV`/`spV` | ≈ 15 / ≈ 10 / ≈ 8 | ≈ 0.1–0.15 | low | Weinstein 1968 [recalled]; [model] |
| `dermatome.C2 … dermatome.S3` | hairy (glabrous key points excepted); yes | spinal, segment per §6 | 30–50 | ≈ 0.03–0.05 | low | [T]; [model] |

Perineal and S4–S5 sites are not pickable (A.1). Every interoceptive site lies inside the trunk.

### 5.15. Switch dependence and brain-only behaviour

The rules are those of A.5: a disabled network removes its edges, and the brain receives only what the remaining edges deliver. Port ids are §3's.

| Sense | Central arrival needs (port) | Outputs: networks needed | Brain-only form |
|---|---|---|---|
| vision | `special` (`portRetina`) | PLR `special ∧ autonomic`; SC orienting `somatic`; circadian CNS; melatonin `autonomic` | injected at optic-nerve start; no pupil |
| hearing | `special` (`portCoch`) | stapedius, startle motor `special ∧ somatic`; startle autonomic signs `special ∧ autonomic` | injected at `cochNuc`; motor efference only |
| touch | `somatic` (`portDC`; face `portTrig`; CT `portSTT`) | cutaneous reflexes `somatic`; autonomic signs also `autonomic` | unavailable (greyed) |
| pain | `somatic` (`portSTT`; face `portTrig`) | withdrawal `somatic`; HR, BP, SCR, pupil also `autonomic`; cortisol also `neuroendocrine`; hyperalgesia `neuroimmune` | unavailable |
| temperature | `somatic` (`portSTT`; face `portTrig`) | vasomotor, sweat, BAT also `autonomic`; shivering `somatic` | unavailable |
| smell | `special` (`portOlf`) | salivation, cephalic phase `special ∧ autonomic` (insulin action also `neuroendocrine`); sneeze `somatic` | injected at `olfBulb` |
| taste | `special` (`portGust`) | salivation `special ∧ autonomic`; cephalic phase (§8); gag, swallow `somatic` | injected at `ntsGust`; no salivation |
| balance | `special` (`portVest`) | VOR, vestibulospinal `special ∧ somatic`; vestibulosympathetic, motion-sickness signs `special ∧ autonomic` | injected at `vestNuc`; VOR efference only |
| proprioception | `somatic` (`portDC`) | stretch reflexes `somatic` | unavailable |
| interoception | `autonomic` (`portVisc`, `portSpinoVisc`; A.8 #7); `co2` also reaches `rtn` (CNS) | baroreflex, chemoreflex, micturition (§7); satiety (§8); NTS → PVN also `neuroendocrine`; `enteric` off halves vagal gut mechanosensitivity (A.5) | unavailable (gases clamped) |

With `autonomic` off, interoceptive stimuli produce nothing central except the RTN response to CO₂. With `somatic` off, body-surface and joint stimuli produce no central or autonomic response (A.5).

### 5.16. Coupling to arousal, salience and dopamine

Each sensory event updates `salience`, `predErr` and `lcPhasic` (§3). The inputs are:
- `psi`;
- novelty, as the prediction error against the modality's running prediction (§4);
- valence class:
  - **Appetitive:** sweet and umami taste, food odour, CT stroking.
  - **Aversive:** pain, bitter taste, aversive odour, noise above the startle marker of §6.
  - **Neutral:** all others.

Unexpected salient or rewarding stimuli evoke phasic midbrain dopamine bursts. Their latency and duration are DOPAMINE.md's (DOPAMINE.md §3.1; Schultz 1998, Mk). Salient and aversive events engage a separate medial VTA population (DOPAMINE.md §3.1; Lammel et al. 2011, Ms).

The dopamine model has no cue input; its onset transient stands in for one (DOPAMINE.md §4.2, §6.6, §6.7). For scenarios other than orgasm, this pipeline can supply a cue input or feed the catecholamine salience term `N` (DOPAMINE.md §5, §6.2) through the §11 adapter. Inside the orgasm scenario the coupling is disabled, so the traces stay identical (A.8 #21).

No dopamine quantity is defined or changed here. NE and ACh responses are drawn as modulator tints per §13.

### 5.17. Route evidence and capture readings

Every route stated in this section was checked with `graphify path --undirected` on 2026-10-31. Routes with a direct graph path (one to three hops through the named structures) carry their [G] lines in place. The graph does not support the following steps, so the listed evidence carries them:

| Route | Graph result | Evidence adopted |
|---|---|---|
| `retina` → `sc` | 9-hop detour | Perry, Oehler & Cowey 1984 [recalled] |
| `ic` → `mgn` → `a1` | 3 hops; MGN → A1 inferred | [G Auditory_system L50, L54–L58]; [T] |
| LTMR → DRG; trigeminal lemniscus → `thalVPM` | 4-hop, 9-hop detours | [T] |
| spinothalamic tract → `insPost` | 5 hops | [G Insular_cortex L58] |
| RVM → dorsal horn; `lc` → dorsal horn | via enkephalin; via raphe | [G Periaqueductal_gray L42–L44]; [T] |
| thermoreceptor → preoptic area | 12-hop detour | Nakamura & Morrison 2008 [recalled] |
| olfactory cortex → `thalMD` | 5-hop detour | [T] |
| taste cell → `ntsGust` → `thalVPMpc` → `gust` | detour; no gustatory relay | [G Vagus_nerve L82]; Beckstead, Morse & Norgren 1980 [recalled] |
| hair cell → `vestNuc` | 5-hop detour | [T] |
| Ia/Ib → spinocerebellar tracts | 2–3 inferred hops | [G Proprioception L44; G Golgi_tendon_organ L58] |
| NTS → `pbn`; NTS → `pvn` | 6-hop detour; 3 hops | Craig 2002 [recalled]; [G Paraventricular_nucleus_of_hypothalamus L80] |

Capture statements not adopted, for the §1 corrections table:
- [G Receptive_field L43]: "up to 500 per cubic cm" fingertip mechanoreceptors. Adopted instead: 241 units/cm² (§5.4).
- [G Nociception L54]: thermoception covers 24–28 °C, with pain beyond. Adopted instead: an innocuous range of ≈ 15–45 °C (§5.5, §5.6).
- [G Sensory_nervous_system L77]: Ruffini endings sense cold. They are SA2 stretch receptors [G Mechanoreceptor L38].
- [G Sensory_nervous_system L57]: retinal ganglion cells in the adrenal medulla. Disregarded; the ipRGC share is kept.
- [G Taste L27]: hundreds of taste buds per papilla. This holds for circumvallate papillae only [T].
- [G Insular_cortex L81]: the anterior insula is primary gustatory cortex. Adopted instead: dorsal mid-insula and frontal operculum (§5.8).
- [G Auditory_system L80]: the ear canal amplifies 3–12 kHz. Adopted instead: canal resonance ≈ 2.5–3.5 kHz (+10–15 dB over ≈ 2–5 kHz), with pinna and concha gain to ≈ 12 kHz (§5.3).
- [G Dermatome_anatomy L68]: the T1 key point is "just distal to the medial epicondyle". Adopted instead: the ISNCSCI wording, just **proximal** to the medial epicondyle of the humerus (§6.6).
- [G Corticospinal_tract L38]: Betz cells are ≈ 5 % of the cells projecting to the cord. Adopted instead: ≈ 3 % of CST axons, from the document's own counts (§6.8).
- [G Central_pattern_generator L53]: the swallowing generator is the hypoglossal nucleus. Adopted instead: a medullary reticular network, dorsal (NTS) and ventral (nucleus ambiguus) groups, with the hypoglossal nucleus as an output nucleus (§6.13).

### 5.18. Open questions

- **Checks in this pass.** These were checked against abstracts or secondary summaries only:
  - Kobayakawa et al. 1996: the gustatory onsets.
  - Schmolesky et al. 1998: the M–P difference and the LGN magnocellular onset. A secondary summary gives a V4 mean of ≈ 104 ms; the V1 and MT means need the full text.
  - Grabherr et al. 2008 and Rolke et al. 2006: the studies were identified, but their values were not retrieved.
  - All other [recalled] values still need checking against the originals.
- **Macaque latencies.** These come from anaesthetised animals. Human intracranial or MEG targets should replace them where they exist.
- **Thermal targets.** None is adopted. Warmth- and cold-evoked potential norms, or Yarnitsky & Ochoa 1991 [recalled], are needed.
- **Gustatory cortex.** The `areaG` timing rests on one MEG study, and the `gust` location carries ±10 mm uncertainty (→ §3).
- **Visceral thresholds.** These rest on [T] only. Whether the gastric values refer to volume or barostat pressure is uncertain, and §8 must confirm the 800 mL slider top.
- **VMpo.** VMpo as a distinct lamina I relay is contested; routing via VPI and `thalVPMpc` needs evaluation with §3. The CT thalamic relay is a model choice.
- **Ports and velocities.** Whether the spinocerebellar edges share `portDC` is for §3 to decide. Olfactory-nerve and gustatory-afferent velocities are missing from A.9 (→ §4).
- **Tibial P37 onset.** Only the P37 peak (37–40 ms) is sourced; the model arrives at 33.4 ms (§4.11). A measured onset is needed.
- **Fitted constants.** All τA, kA, dynamic ranges, transduction delays and relative densities are model choices, as are the MGN arrival, the trigeminal smell marker and the glabrous itch gain.
- **PPI and habituation.** The magnitudes are [T], and the §5.12 habituation constants are [model] fitted to the [T] decline; a measured habituation rate per inter-trial interval should replace them.
- **Perception readouts.** Whether the HUD shows "not perceived" for `baroStep`, and whether it shows individual variation in heartbeat perception, are decisions for §13.
- **Sub-millisecond codes.** Phase locking, ITD and first-spike tactile codes are not represented. A labelled LIF demonstration is a §4 option.

### 5.19. Sources

Peer-reviewed literature, all [recalled] unless tagged otherwise; species are given in the text: Basbaum & Fields 1984; Beckstead, Morse & Norgren 1980; Benson, Spencer & Stott 1986; Bentin et al. 1996; Blumenthal et al. 2005; Cain 1977; Caterina et al. 1997, 1999; Chandrashekar et al. 2010; Collings 1974; Craig 2002, 2009; Craig et al. 2000; Curcio et al. 1990; Dalton 2000; Darian-Smith et al. 1979 (cited in G Thermoreceptor L58); Di Russo et al. 2002; Dodt & Zotterman 1952; Eickhoff et al. 2006; Fernández & Goldberg 1971; Fields et al. 1983; Gamlin et al. 2007; Goldberg & Fernández 1971; Goodale & Milner 1992; Grabherr et al. 2008 (scope checked); Graham 1975; Greenwood 1990; Hall & McCloskey 1983; Hari et al. 1984 (abstract); Hecht, Haig & Chase 1937; Hecht, Shlaer & Pirenne 1942; Hensel 1973; Horton & Hoyt 1991; Jankovski, Plaghki & Mouraux 2013, *Pain* 154:1578–1587 (abstract); Jesteadt, Wier & Green 1977; Johansson & Vallbo 1979 [unverified]; Johnson 1980; Kobal & Hummel 1988; Kobayakawa et al. 1996, *Neurosci Lett* 212:155–158 (abstract); Kobayakawa et al. 1999 [unverified]; Lammel et al. 2011 (via DOPAMINE.md); Liberman 1978; Liégeois-Chauvel et al. 1994; Loewenstein & Mendelson 1965; Löken et al. 2009 [unverified]; Malnic, Godfrey & Buck 2004; Maresh et al. 2008 [unverified]; McKemy, Neuhausser & Julius 2002; Melzack & Wall 1965; Mendell 1966; Meredith & Stein 1983; Meredith, Nemitz & Stein 1987; Nakamura & Morrison 2008; Namer et al. 2008; Näätänen et al. 2007; Olausson et al. 2002 [unverified]; Park & Blanke 2019; Peier et al. 2002; Penfield & Boldrey 1937; Perry, Oehler & Cowey 1984; Price et al. 1977; Raphan, Matsuo & Cohen 1979; Rauschecker & Tian 2000; Rolke et al. 2006 (identity checked); Ross et al. 2010; Schmelz et al. 1997; Schmidt et al. 1995; Schmolesky et al. 1998 ([unverified] for LGN and V4); Schultz 1998 (via DOPAMINE.md); Stein & Meredith 1993; Steiner 1973; Story et al. 2003; Sun & Chen 2007; Swerdlow, Geyer & Braff 2001; Taruno et al. 2013; Todd 2010; Treede et al. 1995; Tu et al. 2018; Ungerleider & Mishkin 1982; Vallbo & Johansson 1984; Vallbo, Olausson & Wessberg 1999; Veldhuizen et al. 2011; Verrillo 1963; Weinstein 1968; Westerman & Smith 1984; Yarnitsky & Ochoa 1991; zu Eulenburg et al. 2012.

Textbook knowledge [T]: clinical SEP, ABR, MLR, N1/P2, VEP and LEP norms; sensory thresholds; hair-cell counts; Weber fractions; transduction mechanisms.

Raw captures are cited in place as [G stem Lx]: 33 stems in `brain-system/raw/`, plus Periaqueductal_gray in `brain-system/raw/`. Project documents: DOPAMINE.md §3.1, §4.2, §5, §6.2, §6.6, §6.7; Appendix A.

---

## 6. Somatic nervous system

### 6.1. Components and ownership

The somatic network (`somatic`, A.3.1) links the CNS with skin, muscle, tendon and joint, and it drives striated muscle. It has six parts:

- general somatic afferents (GSA) for touch, pain, temperature and proprioception;
- α and γ motor neurons;
- cranial GSE and SVE motor output;
- the respiratory pump output (phrenic and intercostal nerves);
- the somatic tracts of the cord;
- the spinal motor circuits, including the central pattern generator (CPG) interneurons.

This section owns the circuit rules of that network and the quantities that A.7 assigns to it. It defines no coordinates. Other quantities belong to other sections:

- §2: body-frame positions, cord geometry, the segment–vertebra rule and all path lengths.
- §3: brainstem nuclei, cranial-nerve attachments, cortical areas, ports and reaction times.
- §4: conduction velocities and the synaptic, NMJ, EMG-spread and electromechanical delays.
- §5: receptor properties, perceptual thresholds and perceptual latencies.
- §7: cardiovascular, respiratory-rate and other autonomic quantities.

| Component | Content | Sub-network | Node kinds | Edge kinds and fibre classes |
|---|---|---|---|---|
| Spinal GSA afferents | DRG neurons from skin, muscle, tendon and joint; dorsal-root entry; segmental collaterals; dorsal-horn processing | `som.aff` | `receptor`, `ganglion` (`drg.*`), `segment` (`cord.*.dh`) | `axon`: `Ia`, `Ib`, `II`, `Abeta`, `Adelta`, `C`, `CT`, `Cmi` |
| Trigeminal GSA afferents | Trigeminal ganglion; face, cornea, oral cavity; jaw-muscle spindles | `som.aff` | `receptor`, `ganglion`; `prV spV mesV` are CNS nuclei (`cns`) | `axon`: `Abeta`, `Adelta`, `C`, `Ia` |
| Spinal motor output | α and γ motor neurons in `cord.*.vh`, `phrenicNuc`, `n11`, `onuf`; Ia, Ib, Renshaw, flexor-reflex and commissural interneurons; `cpgL` | `som.motor` | `segment`, `effector` | `axon`: `Aalpha`, `Agamma`; intrasegmental `tract` (`cns`) |
| Cranial motor output | Peripheral axons of `n3 n4 n6 motV n7m nAmbMotor n11 n12` | `som.motor` | `nucleus` (CNS, always computed), `effector` | `axon`: `Aalpha` |
| Somatic cord tracts | Dorsal columns, anterolateral system, spinocerebellar, corticospinal, reticulospinal, vestibulospinal, tectospinal, rubrospinal and bulbospinal respiratory tracts; descending raphe and coeruleus modulation | `som.tract` | `segment`, `port` | `tract`: `cns` |

Some structures sit in somatic territory but belong to `autonomic` (§7; A.8 #7):

- the intermediolateral column (`cord.*.iml`, T1–L2) and the sacral parasympathetic nucleus (`cord.*.spn`, S2–S4);
- preganglionic `B` fibres in the ventral roots, and the white and grey rami;
- `Cpost` fibres that run inside somatic nerves;
- spinal visceral afferents in the dorsal roots and their ascending relays;
- bulbospinal sympathetic premotor axons.

Two other groups are also outside the somatic switch:

- The special senses (I, II, VIII and the gustatory parts of VII, IX and X) belong to `special` (A.8 #5).
- Brainstem and cortical nodes are `cns` and are never switched. The cranial motor nuclei therefore keep computing when the somatic network is off (§6.14).

Shared nerves follow one rule. A cord segment or a named nerve is drawn whenever `bodyMode = 'body'`, and each edge it carries has its own `nets` set (A.5). For example, the median nerve holds somatic afferent and motor edges plus autonomic `Cpost` edges to sweat glands and vessels, all on one §2 spline. A nerve-section intervention (§6.15) cuts every edge in the nerve. §7 reads the autonomic consequences, such as loss of palmar sweating.

### 6.2. Spinal cord: segments, laminae and neurons

The cord runs from the cervicomedullary junction (A.2) to the conus. §2 owns its length, diameters, segment positions, enlargements and the cauda equina. The cord has 31 segments, and each gives off one pair of dorsal (afferent) roots and one pair of ventral (efferent) roots [G Spinal_cord L74, L76].

The cord is shorter than the vertebral column, so each segment lies above the vertebra of the same number:

- about one level higher in the neck;
- two to three levels higher in the thorax;
- the lumbar segments lie behind T10–T12, and the sacral and coccygeal segments behind T12–L1 (§2 owns the rule and its table).

A T11 vertebral lesion therefore reaches the L3–L4 segments (§6.15).

The cord holds less than 0.3 % of CNS neurons (the count below against the whole-brain count of §3), so §13 must oversample it deliberately. Two existing definitions stay unchanged, and the somatic cord adds nodes without redefining either:

- the existing `spinal` region, which is the A11 diencephalospinal dopamine target (DOPAMINE.md §2.1, §2.3);
- the `src/brain.js` L240 rule that labels brainstem-tube stars below z −64 as `spinal`.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Cord segments | 31 (8 C, 12 T, 5 L, 5 S, 1 Co) | segments | H | high | [G Spinal_cord L74]; [G Spinal_nerve L33] |
| Neurons in the cord | 1.97–2.22 × 10⁸ | neurons | H | medium | Bahney & von Bartheld 2018 |
| All cells in the cord | 1.5–1.7 × 10⁹ | cells | H | medium | Bahney & von Bartheld 2018 |
| Neuron share of cord cells | ≈ 13.4 | % | H | medium | Bahney & von Bartheld 2018 |
| Glia : neuron ratio | 5.6–7.1 | ratio | H | medium | Bahney & von Bartheld 2018 |
| Composition difference between cervical, thoracic and lumbar levels | not significant | — | H, Mk | medium | Bahney & von Bartheld 2018 |

| Lamina | Content | Main input → output | Node |
|---|---|---|---|
| I (marginal zone) | Nociceptive-specific and thermoreceptive projection neurons | `Adelta`, `C` → anterolateral system | `cord.*.dh` |
| II (substantia gelatinosa) | Excitatory and inhibitory interneurons; gate circuitry | `C`, `CT`, `Cmi` | `cord.*.dh` |
| III–IV (nucleus proprius) | Low-threshold mechanoreceptive interneurons | `Abeta` | `cord.*.dh` |
| V | Wide-dynamic-range neurons; viscerosomatic convergence | `Abeta`, `Adelta`, `C`, visceral → anterolateral system | `cord.*.dh` |
| VI | Proprioceptive interneurons, largest in the enlargements | `Ia`, `Ib`, `II` | `cord.*.dh` |
| VII (intermediate zone) | Ia and Ib inhibitory interneurons, Renshaw cells; Clarke's column; IML and SPN (autonomic) | segmental and descending → motor pools, spinocerebellar tracts | `cord.*.vh`, `.clarke`, `.iml`, `.spn` |
| VIII | Commissural and propriospinal interneurons (crossed extension); reticulo- and vestibulospinal targets | → contralateral pools | `cord.*.vh` |
| IX | α and γ pools: axial medial, limb lateral, flexor dorsal to extensor; `phrenicNuc`, `n11`, `onuf` | → `Aalpha`, `Agamma` | `cord.*.vh` |
| X | Grey matter around the central canal; visceral convergence | visceral, nociceptive | `cord.*.dh` |

The laminar scheme follows Rexed 1952 (C) [recalled], with human homology from [T] (Kandel et al.). Confidence is medium.

### 6.3. Cord cross-section map (ξ, η)

Coordinates are normalised as in A.2: ξ = x / transverse radius, and η = AP offset / AP radius, with + anterior. Values are for the right half; mirror ξ for the left. §2 gives the radii per segment.

Grey matter is largest in the enlargements. White matter shrinks caudally, because descending fibres have ended and ascending fibres have not yet joined [T]. Each tract's stars fill its box (§13), and the same boxes define lesion geometry (§6.15). The placements are textbook (Kandel et al.; Gray's Anatomy). The exact box limits are [model].

| Structure | id | \|ξ\| | η | Levels | Network | Conf. | Source |
|---|---|---|---|---|---|---|---|
| Central canal, lamina X | `cord.<seg>` core | 0–0.08 | −0.08…+0.05 | all | shared | medium | [T] |
| Dorsal horn apex, laminae I–II | `cord.<seg>.dh` | 0.22–0.42 | −0.62…−0.88 | all | `som.aff` (lamina I visceral relay `ans.vaff`) | medium | [T] |
| Dorsal horn body, laminae III–VI | `cord.<seg>.dh` | 0.08–0.42 | −0.15…−0.62 | all | `som.aff` | medium | [T] |
| Intermediate zone, lamina VII | `cord.<seg>.vh` | 0.05–0.45 | −0.15…+0.12 | all | `som.motor` | medium | [T] |
| Clarke's column | `cord.<seg>.clarke` | 0.08–0.18 | −0.28…−0.12 | T1–L2 | `som.aff` | medium | [T] |
| Intermediolateral column | `cord.<seg>.iml` | 0.45–0.56 | −0.10…+0.05 | T1–L2 | `autonomic` (§7) | medium | [T] |
| Sacral parasympathetic nucleus | `cord.<seg>.spn` | 0.35–0.50 | −0.05…+0.10 | S2–S4 | `autonomic` (§7) | low | [T] |
| Ventral horn, axial pools | `cord.<seg>.vh` | 0.12–0.30 | +0.15…+0.60 | all | `som.motor` | medium | [T] |
| Ventral horn, limb pools | `cord.<seg>.vh` | 0.30–0.70 | +0.05…+0.60 | C5–T1, L2–S2 | `som.motor` | medium | [T] |
| Phrenic motor nucleus | `phrenicNuc` | 0.20–0.35 | +0.30…+0.50 | C3–C5 | `som.motor` | low | [T]; [G Phrenic_nerve L36] |
| Spinal accessory nucleus | `n11` | 0.45–0.60 | +0.05…+0.25 | C1–C5 | `som.motor` | low | [T] |
| Onuf's nucleus | `onuf` | 0.50–0.62 | +0.35…+0.50 | S2 (S1–S3) | `som.motor` | low | [T]; [G Pudendal_nerve L64] |
| Lumbar locomotor CPG core | `cpgL` | 0.05–0.35 | 0…+0.35 | L1–L2 | `som.motor` | low | [model]; [G Central_pattern_generator L53] |
| Fasciculus gracilis | `dcGracile` | 0.02–0.20 | −0.45…−0.98 | all (fibres from below T6) | `som.tract` | medium | [T] |
| Fasciculus cuneatus | `dcCuneate` | 0.20–0.42 | −0.40…−0.95 | T6 and above | `som.tract` | medium | [T] |
| Dorsolateral fasciculus (Lissauer) | `lissauer` | 0.30–0.45 | −0.88…−1.00 | all | `som.aff` | low | [T] |
| Lateral corticospinal tract | `cstLat` | 0.50–0.85 | −0.50…−0.02 | all, thinning caudally | `som.tract` | medium | [T] |
| Dorsal spinocerebellar tract | `dsct` | 0.85–0.98 | −0.45…−0.05 | arises T1–L2 | `som.tract` | low | [T] |
| Rubrospinal tract | `rubrospinal` | 0.55–0.80 | −0.02…+0.15 | mainly cervical (H) | `som.tract` | low | [T] |
| Lateral (medullary) reticulospinal | `rsMed` | 0.45–0.60 | +0.05…+0.35 | all | `som.tract` | low | [T] |
| Ventral spinocerebellar tract | `vsct` | 0.82–0.96 | +0.05…+0.45 | arises lumbar | `som.tract` | low | [T] |
| Anterolateral system (spinothalamic, spinoreticular, spinoparabrachial) | `stt` | 0.55–0.82 | +0.15…+0.60 | all | `som.tract` (visceral relays `ans.vaff`) | medium | [T]; [G Spinothalamic_tract L69] |
| Bulbospinal respiratory axons | `bsResp` | 0.50–0.70 | +0.20…+0.50 | C3–T11 | `som.tract` | low | [T] |
| Lateral vestibulospinal | `lvst` | 0.35–0.60 | +0.65…+0.92 | all | `som.tract` | low | [T] |
| Medial (pontine) reticulospinal | `rsPont` | 0.15–0.35 | +0.45…+0.75 | all | `som.tract` | low | [T] |
| Medial vestibulospinal, MLF | `mvst` | 0.08–0.18 | +0.55…+0.80 | cervical | `som.tract` | low | [T] |
| Tectospinal | `tectospinal` | 0.15–0.30 | +0.78…+0.96 | cervical | `som.tract` | low | [T] |
| Anterior corticospinal | `cstAnt` | 0.02–0.12 | +0.50…+0.97 | cervical to upper thoracic | `som.tract` | low | [T] |
| Raphespinal and coerulospinal fibres | `descMod` | 0.35–0.50 | −0.50…−0.30 | all | `som.tract` | low | [T] |
| Bulbospinal sympathetic premotor axons | (§7) | 0.40–0.55 | −0.30…−0.05 | C1–L2 | `autonomic` | low | [T] |
| Fasciculus proprius | `proprius` | rim 0.05 around the grey matter | — | all | `som.tract` | low | [T] |

| Pathway | Somatotopy (medial → lateral) | Crossing | Deficit after a right hemisection | Conf. | Source |
|---|---|---|---|---|---|
| Dorsal column–medial lemniscus | sacral → cervical | medulla, as internal arcuate fibres after `gracile`/`cuneate` | ipsilateral, below | high | [G Dorsal_column_E2_80_93medial_lemniscus_pa L48]; [T] |
| Anterolateral system | cervical ventromedial → sacral dorsolateral | anterior white commissure, 1–2 segments above entry | contralateral, from 1–2 segments below | high | [G Spinothalamic_tract L69]; [T] |
| Lateral CST | arm medial → leg lateral (classical; contested in humans) | pyramidal decussation | ipsilateral, below | low | [T]; Nathan, Smith & Deacon 1990 [recalled] |
| Anterior CST | — | segmental, near the target | minor, bilateral | medium | [G Corticospinal_tract L40] |
| Dorsal / ventral spinocerebellar | — | uncrossed / crosses twice | ipsilateral ataxia, not perceived | low | [T] |
| Rubrospinal; tectospinal | — | ventral / dorsal tegmental decussation | ipsilateral | low | [T] |
| Lateral vestibulospinal; reticulospinal | — | uncrossed; mainly uncrossed or bilateral | ipsilateral | low | [T] |

Model rule: within a tract box, a fibre's position is interpolated linearly by its segment of origin or termination. A lesion that removes part of a box therefore removes a predictable range of body segments (§6.15).

### 6.4. The 31 spinal nerve pairs

Each spinal nerve is a mixed nerve formed from the dorsal and ventral roots of one segment [G Spinal_nerve L43]. Exit levels follow one rule [G Spinal_nerve L63, L73]:

- C1–C7 leave above the vertebra of the same number;
- C8 leaves below C7;
- every nerve further down leaves below its vertebra.

Node ids are `sn.<seg>` and `drg.<seg>`. Exits and DRG positions are in §2.

| Group | Pairs | Ventral rami form | Main somatic targets | Conf. | Source |
|---|---|---|---|---|---|
| Cervical C1–C8 | 8 | `plexusCervical` (C1–C4), `phrenic` (C3–C5), `plexusBrachial` (C5–T1) | neck, diaphragm, upper limb; occipital skin via the C2 dorsal ramus | high | [G Spinal_nerve L63]; [G Phrenic_nerve L26] |
| Thoracic T1–T12 | 12 | `intercostal.T1…T11`, `subcostal` (T12); T1 also joins `plexusBrachial` | intercostal muscles, abdominal wall (T7–T12), trunk skin | high | [G Spinal_nerve L73, L77] |
| Lumbar L1–L5 | 5 | `plexusLumbar` (T12–L4); lumbosacral trunk (L4–L5) | hip flexors, knee extensors, adductors, anterior thigh skin | high | [G Lumbar_plexus L26] |
| Sacral S1–S5 | 5 | `plexusSacral` (L4–S4), `pudendal` (S2–S4) | posterior thigh, leg, foot, pelvic floor | high | [G Sacral_plexus L26] |
| Coccygeal Co1 | 1 | coccygeal plexus | perianal skin (not pickable, A.1) | medium | [T] |

| Element | Somatic content | Autonomic content (owner §7) | Source |
|---|---|---|---|
| Dorsal root and DRG | `Ia`, `Ib`, `II`, `Abeta`, `Adelta`, `C`, `CT`, `Cmi` | spinal visceral afferents, concentrated at T1–L2 and S2–S4 | [G Spinal_cord L76]; [T] |
| Ventral root | `Aalpha`, `Agamma` | `B` preganglionic fibres at T1–L2 and S2–S4 | [G Spinal_cord L76]; [T] |
| White / grey ramus communicans | — | white rami T1–L2 only; grey rami bring `Cpost` into every spinal nerve | [T] |
| Dorsal ramus | `erectorSpinae`, back skin | `Cpost` | [G Spinal_nerve L51] |
| Ventral ramus | limbs, anterior trunk, plexuses | `Cpost` | [G Spinal_nerve L51] |

C1 often lacks a dorsal root and has no dermatome, so skin sites start at C2 [T] (low).

### 6.5. Plexuses and named nerves

§2 owns all waypoints. Root composition sets each nerve's edge membership, which segment-level lesions use (§6.15). Ids in italics extend A.3.3 following its patterns. The graph confirms each plexus-to-nerve and nerve-to-target link listed: brachial plexus → branches → median, radial, ulnar, musculocutaneous and axillary nerves; posterior cord → radial; lateral cord → musculocutaneous; lumbar plexus → femoral and obturator; femoral → quadriceps; sacral plexus → sciatic → tibial and common fibular; pudendal → Onuf's nucleus and the external anal sphincter.

| id | Roots | Course | Motor targets | Cutaneous sites | Model role | Conf. | Source |
|---|---|---|---|---|---|---|---|
| `plexusCervical` | C1–C4 | deep to the sternocleidomastoid | infrahyoid muscles (not modelled); joins `phrenic` | `dermatome.C3`, `dermatome.C4` | — | medium | [T] |
| `phrenic` | C3–C5 (mainly C4) | anterior scalene; anterior to the lung root; right nerve through the caval opening at T8 | `diaphragm` (its only motor supply) | central diaphragm, pericardium, pleura; pain referred to C3–C5 skin | inspiratory output (§6.13) | high | [G Phrenic_nerve L26, L36, L46, L75] |
| accessory phrenic (not drawn) | C5 | joins the phrenic nerve in the thorax | `diaphragm` | — | present in up to 75 % of cadavers | medium | [G Phrenic_nerve L60] |
| `plexusBrachial` | C5–T1 | 5 roots; 3 trunks (upper C5–C6, middle C7, lower C8–T1); 6 divisions; 3 cords (lateral, posterior, medial); 5 terminal branches | — | — | — | high | [G Brachial_plexus L39, L51–L55, L69–L71] |
| `axillary` | C5–C6 | posterior cord; quadrangular space | `deltoid`, teres minor | lateral shoulder | shoulder abduction | high | [G Brachial_plexus L101] |
| `musculocutaneous` | C5–C7 | lateral cord; pierces coracobrachialis | `biceps`, brachialis, coracobrachialis | anterolateral forearm | biceps reflex; elbow flexion in withdrawal | high | [G Brachial_plexus L96] |
| `radial` | C5–T1 | posterior cord; spiral groove | `triceps`, brachioradialis, `forearmExtensors` | `forearmDorsal`, radial dorsum of the hand | triceps reflex | high | [G Brachial_plexus L102] |
| `median` | C5 (C6)–T1 | lateral and medial roots; carpal tunnel | most `forearmFlexors`, thenar muscles | palmar radial 3½ digits incl. `indexTip`; radial `palm` | hot-object afferents | medium | [G Brachial_plexus L97]; [T] |
| `ulnar` | C8–T1 (± C7) | medial cord; behind the medial epicondyle; Guyon's canal | flexor carpi ulnaris, medial deep finger flexor, *`handIntrinsics`* | ulnar palm, `dermatome.C8` | T1 myotome | medium | [T] |
| `intercostal.T1…T11` | T1–T11 | costal grooves; T7–T11 continue into the abdominal wall | `intercostalMuscles`; `rectusAbdominis` (T7–T11) | `dermatome.T2`–`T11`; `umbilicus` = T10 | inspiratory and expiratory output | high | [G Spinal_nerve L77] |
| `subcostal` | T12 | below rib 12 | abdominal wall | `dermatome.T12` | — | high | [G Spinal_nerve L77] |
| `plexusLumbar` | T12–L4 | within psoas major; small branches: iliohypogastric T12–L1, lateral femoral cutaneous L2–L3 | — | anterolateral thigh | — | high | [G Lumbar_plexus L26, L56, L59] |
| `femoral` | L2–L4 | between psoas and iliacus; under the inguinal ligament | `quadriceps`, iliacus (*`iliopsoas`*), sartorius, pectineus | `dermatome.L2`, `dermatome.L3` | patellar reflex | high | [G Lumbar_plexus L61] |
| `saphenous` | L3–L4 | femoral continuation; adductor canal | — | medial leg and foot (`dermatome.L4`) | — | medium | [G Lumbar_plexus L61]; [T] |
| `obturator` | L2–L4 | obturator canal | `adductors` (incl. gracilis) | medial thigh | — | high | [G Lumbar_plexus L60] |
| `plexusSacral` | L4–S4 | on piriformis | — | — | — | high | [G Sacral_plexus L26] |
| *`inferiorGluteal`* | L5–S2 | below piriformis | `glutealMax` | — | antigravity extension | high | [G Sacral_plexus L62] |
| `sciatic` | L4–S3 | greater sciatic foramen; posterior thigh; largest nerve in the body | `hamstrings`, part of adductor magnus | no thigh skin | leg withdrawal (biceps femoris carries RIII) | high | [G Sciatic_nerve L41, L46]; [G Sacral_plexus L70] |
| `tibial` | L4–S3 | popliteal fossa; tarsal tunnel; plantar nerves | `gastrocSoleus`, *`toeFlexors`*, intrinsic foot muscles | `footSole`, medial heel | Achilles reflex; H-reflex; plantar response | high | [G Sacral_plexus L74] |
| `commonFibular` | L4–S2 | around the fibular neck; deep and superficial branches | `tibialisAnt`, *`toeExtensors`*, peroneal muscles | lateral leg, `dermatome.L5` | ankle dorsiflexion; Babinski response | high | [G Sacral_plexus L71] |
| *`sural`* | S1–S2 | sural cutaneous branches | — | `heel`, `dermatome.S1` | RIII stimulation site | medium | [T] |
| `pudendal` | S2–S4 | greater then lesser sciatic foramen; pudendal canal; schematic, ending at the perineal midline (A.1) | `pelvicFloor` (motor neurons in `onuf`) | perineal skin (not pickable) | pelvic-floor tone; orgasm-scenario stream (A.8 #21) | high | [G Sacral_plexus L78]; [G Pudendal_nerve L64, L80, L82] |

Three targets or edge sets have no plexus row:

- Dorsal rami supply `erectorSpinae`.
- `cn11` supplies `sternocleidomastoid` and `trapezius`, with proprioceptive fibres from C2–C4 [T].
- The pudendal nerve carries sympathetic but not parasympathetic fibres [G Pudendal_nerve L72]. These are `autonomic` edges on the same schematic spline.

### 6.6. Dermatomes, myotomes and stimulus-site assignment

A skin click snaps to a site (§13). The site resolves to a segment and DRG, a peripheral nerve, and the afferent classes the stimulus drives under the single receptor model of A.6. Key points follow ISNCSCI as captured in [G Dermatome_anatomy L61–L87], and §2 places them. S4–S5 is not offered (A.1).

| Site | ISNCSCI key point | Peripheral nerve | Conf. (nerve) |
|---|---|---|---|
| `dermatome.C2` | ≥ 1 cm lateral to the occipital protuberance | greater occipital (C2 dorsal ramus) | medium |
| `dermatome.C3` / `C4` | supraclavicular fossa / acromioclavicular joint | supraclavicular (cervical plexus) | medium |
| `dermatome.C5` | radial side of the antecubital fossa | upper-arm lateral cutaneous branches (radial) or musculocutaneous; variable | low |
| `dermatome.C6` / `C7` / `C8` | dorsal proximal phalanx of thumb / middle finger / little finger | superficial radial / superficial radial / dorsal branch of the ulnar | medium / low / medium |
| `dermatome.T1` | medial (ulnar) side of the antecubital fossa, just **proximal** to the medial epicondyle of the humerus (ISNCSCI; the capture's "distal" is not adopted, §5.17) | medial cutaneous nerve of the forearm | medium |
| `dermatome.T2` | apex of the axilla | intercostobrachial | medium |
| `dermatome.T3`–`T11` | midclavicular line at defined levels (T4 nipples, T6 xiphoid, T10 umbilicus) | `intercostal.Tn` anterior cutaneous branches | medium |
| `dermatome.T12` | midclavicular line at the midpoint of the inguinal ligament | `subcostal` / iliohypogastric | medium |
| `dermatome.L1` | midway between the T12 and L2 points | ilioinguinal / femoral branch of the genitofemoral | low |
| `dermatome.L2` / `L3` | mid-anterior thigh / medial femoral condyle above the knee (ISNCSCI) | `femoral` anterior cutaneous | medium |
| `dermatome.L4` / `L5` | medial malleolus / dorsum of foot at the third MTP joint | `saphenous` / superficial `commonFibular` | medium |
| `dermatome.S1` / `S2` / `S3` | lateral calcaneus / popliteal fossa / ischial tuberosity (posterior view) | `sural` / posterior femoral cutaneous / inferior cluneal | medium |

Segment assignments are H, high [G Dermatome_anatomy L61–L87]. Nerve assignments are [T] at the stated confidence. The graph confirms dermatome → spinal nerve.

| Site | Segment (primary; overlap) | Peripheral nerve | Note | Conf. |
|---|---|---|---|---|
| `indexTip` | C7; C6 | `median` (palmar digital) | glabrous; densest Aβ innervation (§5) | medium |
| `palm` | C7; C6, C8 | `median`, `ulnar` | hot-object site (§12) | low |
| `forearmDorsal` | C7; C6, C8 | posterior cutaneous of forearm (`radial`) | hairy skin, so `CT` present | low |
| `footSole` | S1; L5 | `tibial` (plantar nerves) | plantar-response site | low |
| `heel` | S1 | `sural`, `tibial` (medial calcaneal) | — | medium |
| `bigToe` | L5; L4 | `tibial`, `commonFibular` | — | low |
| `umbilicus` | T10 | `intercostal.T10` | — | high |
| `foreheadV1` / `cheekV2` / `chinV3` | trigeminal V1 / V2 / V3 | supraorbital / infraorbital / mental (`cn5.som`) | blink site: `foreheadV1` | medium |
| `bicepsTendon` / `tricepsTendon` | C5–C6 / C7–C8 | `musculocutaneous` / `radial` | tendon reflexes | high |
| `patellarTendon` / `achillesTendon` | L2–L4 (mainly L3–L4) / S1–S2 | `femoral` / `tibial` | tendon reflexes | high |
| `shoulder` `elbow` `wrist` `finger` | C5–C6 / C5–C8 / C6–C8 / C6–T1 | axillary; musculocutaneous, radial, median, ulnar | joint proprioception: spindle `Ia`, `II`; joint `II`, `Adelta` | low |
| `hip` `knee` `ankle` | L2–S1 / L3–S1 / L4–S2 | femoral, obturator, sciatic; femoral, tibial; tibial, commonFibular | joint proprioception | low |

Sources for this table: tendon segments [G Stretch_reflex L44, L47–L49] and [G Reflex_arc L51]; all other rows [T].

Overlap rule ([model], low): a skin stimulus drives its primary segment at weight 1.0 and each overlap segment at 0.4. Dermatomes overlap strongly, so cutting one root leaves at most hypoaesthesia. Nerve territories are sharper [T], so a nerve section produces territory anaesthesia. Rhizotomy needs about 3 adjacent roots to produce anaesthesia (§6.15).

| Segment | Key movement (ISNCSCI) | Muscle id | Nerve |
|---|---|---|---|
| C3–C5 | diaphragm | `diaphragm` | `phrenic` |
| C5 / C6 / C7 | elbow flexion / wrist extension / elbow extension | `biceps` / `forearmExtensors` / `triceps` | `musculocutaneous` / `radial` / `radial` |
| C8 / T1 | finger flexion / little-finger abduction | `forearmFlexors` / *`handIntrinsics`* | `median`, `ulnar` / `ulnar` |
| L2 / L3 | hip flexion / knee extension | *`iliopsoas`* / `quadriceps` | `femoral` |
| L4 / L5 | ankle dorsiflexion / long toe extension | `tibialisAnt` / *`toeExtensors`* | deep `commonFibular` |
| S1 | ankle plantar flexion | `gastrocSoleus` | `tibial` |

Myotomes follow [T] (ISNCSCI), H, medium; diaphragm roots [G Phrenic_nerve L36]. A motor pool spans 2–4 segments [T]. Root weights are 0.5 for the key segment and 0.25 for each neighbour ([model], low). These weights set how far a segment-level lesion weakens a muscle.

### 6.7. Cranial nerves

All twelve pairs are described here. Each component is switched with the network that owns its functional class (A.8 #6):

- GSE, SVE and GSA → `somatic`;
- GVE and GVA → `autonomic`;
- SSA and SVA → `special`.

§3 owns nucleus coordinates and attachments, and §2 owns extracranial waypoints. Star density on a nerve filament is proportional to log₁₀ of its axon count (§13), so small nerves stay visible. Cranial nerves emerge above the atlas [G Cranial_nerves L40], and twelve pairs are conventional, with the terminal nerve (CN 0) sometimes added [G Cranial_nerves L42, L52].

| Nerve | Component → network | Nuclei and ganglia (→ §3) | Targets or sites | Axons per nerve | Conf. | Source |
|---|---|---|---|---|---|---|
| `cn1` Olfactory | SVA → `special` | `olfBulb` | `olfEpith` | equals the receptor-neuron count (§5) | — | [T] |
| `cn2` Optic (CNS tract) | SSA → `special` | `lgn`, `sc`, `opn`, `scn` | `retina` | 1.0–1.2 × 10⁶ | medium | Jonas et al. 1992 [recalled]; agrees in order with ≈ 1.3 × 10⁶ ganglion cells [G Sensory_neuron L61] |
| `cn3` Oculomotor | GSE `cn3.motor` → `somatic`; GVE `cn3.para` → `autonomic` | `n3`; `ew` → `ciliaryGang` | `extraocular` (SR, IR, MR, IO), levator; `pupilSphincter` | 1.5–2.5 × 10⁴ | low | [T] |
| `cn4` Trochlear | GSE → `somatic` | `n4`; crosses and exits dorsally | superior oblique | 1–3 × 10³ (fewest) | low | [T] |
| `cn5` Trigeminal | GSA `cn5.som`; SVE `cn5.motor` → `somatic` | ganglion → `prV` (touch), `spV` (pain, temperature; to C2–C3), `mesV` (jaw spindles, cell bodies in the CNS); `motV` | `foreheadV1`, `cheekV2`, `chinV3`, cornea, oral mucosa; `masseter` and other jaw muscles, tensor tympani | ≈ 10⁵ (order of magnitude) | low | [T] |
| `cn6` Abducens | GSE → `somatic` | `n6` (plus internuclear neurons to the contralateral `n3` via the MLF) | lateral rectus | 2–7 × 10³ | low | [T] |
| `cn7` Facial | SVE `cn7.motor`, GSA `cn7.som` → `somatic`; GVE `cn7.para` → `autonomic`; SVA `cn7.special` → `special` | `n7m`; → `spV`; `ssn` → `pterygopalatineGang`, `submandibularGang`; geniculate ganglion → `ntsGust` | facial muscles incl. `orbicularisOculi`, `stapedius`; external-ear skin; `lacrimal`, `submandibularGland`, `sublingual`; `tongueAnt` | 7–10 × 10³ (motor) | low | [T] |
| `cn8` Vestibulocochlear | SSA → `special` | spiral ganglion → `cochNuc`; Scarpa's ganglion → `vestNuc`, `flocculus`, `nodulus` | `cochlea`; `vestLabyrinth` | ≈ 3.0 × 10⁴ (cochlear); 1.8–2.0 × 10⁴ (vestibular) | medium; low | Spoendlin & Schrott 1989 [recalled]; [T] |
| `cn9` Glossopharyngeal | SVE `cn9.motor` → `somatic`; GVE `cn9.para`, GVA `cn9.aff` → `autonomic`; SVA → `special` | `nAmbMotor`; `isn` → `oticGang`; petrosal ganglion → `ntsVisc`, `ntsGust` | stylopharyngeus (*`pharynxLarynx`*); `parotid`; `carotidSinus`, `carotidBody`, pharynx; `tonguePost` | no reliable count; placeholder 10⁴ | low | [model] |
| `cn10` Vagus (`vagus`) | SVE `cn10.motor`, GSA `cn10.som` → `somatic`; GVE `cn10.para`, GVA `cn10.aff` → `autonomic`; SVA → `special` | `nAmbMotor`; jugular ganglion → `spV`; `nAmbVagal`, `dmv`; `nodoseGang` → `ntsVisc`; → `ntsGust` | pharynx, palate, larynx, striated upper oesophagus; ear canal; heart, airways, gut (§7, §8); `aorticArch`, `lungStretch`; epiglottis | cervical: right ≈ 105,000, left ≈ 87,000 (one source) or ≈ 25,000 / 23,000 (others) | low | [G Vagus_nerve L42] |
| `cn11` Accessory | SVE/GSE → `somatic` | `n11` (C1–C5 ventral horn; root rises through the foramen magnum, leaves through the jugular foramen) | `sternocleidomastoid`, `trapezius` | no count found; placeholder 2 × 10³ | low | [model] |
| `cn12` Hypoglossal | GSE → `somatic` | `n12` | tongue (*`tongue`*) | no reliable count; placeholder 10⁴ | low | [model] |

All counts are H. The two vagal figures differ about fourfold; the lower ones probably count myelinated fibres only [T]. The vagal afferent fraction belongs to §8. The graph confirms vagus nerve → nucleus ambiguus and oculomotor nerve (CN III) → Edinger–Westphal nucleus.

Corticobulbar input to the cranial motor nuclei is bilateral except to the lower facial nucleus, which is mainly contralateral [T]. A cortical lesion therefore spares the forehead and the blink.

Pharyngeal general sensation is classed as GVA here, so the gag reflex needs `autonomic ∧ somatic` (§6.17). With `somatic` off, every `.som` and `.motor` edge is cut. The nuclei keep computing, and their output appears as efference-only packets at `portCranMotor` (A.5).

### 6.8. Descending motor pathways

The corticospinal tract (CST) arises from layer V of M1, premotor cortex, the SMA and parietal areas. It runs through the posterior limb of the internal capsule, the cerebral crus, the basilar pons and the medullary pyramid [G Corticospinal_tract L36]. The graph confirms primary motor cortex → Betz cells → CST → medullary pyramids → lateral CST → α motor neuron.

Ports (§3 owns the port list):

- The CST enters the body at `portCST`.
- Every other brainstem–spinal motor and modulatory tract uses `portRS`.
- Bulbospinal autonomic axons use `portSymp` and `portSacral` (§7).

In primates some CST neurons contact hand motor neurons directly (Lemon 2008 [recalled], Mk, H; [T]).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| CST axons per side | ≈ 1.0–1.1 × 10⁶ | axons | H | high | [G Corticospinal_tract L30]; Lassek & Rasmussen 1939 [recalled] |
| Origin: M1 / premotor and SMA / S1, parietal and cingulate | ≈ 30 / 30 / 40 | % | H | medium | [G Corticospinal_tract L36] |
| Lateral CST share | ≈ 90 | % | H | medium | [G Corticospinal_tract L40] |
| Lateral-tract fibres staying ipsilateral | 2–3 | % of lateral tract | H | medium | [G Corticospinal_tract L40] |
| Anterior CST share (crosses segmentally) | ≈ 10 | % | H | medium | [G Corticospinal_tract L40] |
| Connections crossing in the medulla (alternative estimate) | 75–80 | % | H | low | [G Corticospinal_tract L48] |
| Model split: crossed lateral / uncrossed lateral / anterior | 87 / 3 / 10 | % | — | low | [model] from [G Corticospinal_tract L40] |
| Betz-cell share of CST axons | ≈ 3 (34,000 of ≈ 1.05 × 10⁶; the two adjacent rows) | % | H | low | computed from Lassek 1940 [unverified]; the capture's ≈ 5 % of cells projecting to the cord [G Corticospinal_tract L38] is not adopted (§5.17) |
| Betz cells per hemisphere | ≈ 3.4 × 10⁴ | cells | H | low | Lassek 1940 [unverified] |
| Fastest CST conduction (Betz axons) | > 70 | m/s | H | medium | [G Corticospinal_tract L38] (model CV → §4) |
| CST myelination mostly complete | ≈ 2 | y | H | medium | [G Corticospinal_tract L30] |

Pyramidal decussation varies between individuals (Nathan, Smith & Deacon 1990 [recalled], H). The model split is a default.

| Tract | Edge id | Origin node | Cord position (§6.3) | Terminations | Model function | Conf. | Source |
|---|---|---|---|---|---|---|---|
| Lateral CST | `cstLat` | `m1`, `pmd`, `pmv`, `sma`, `s1` | contralateral | laminae IV–IX; direct onto hand motor neurons | distal voluntary movement; gate on the plantar response | high | [G Corticospinal_tract L36, L40] |
| Anterior CST | `cstAnt` | as above | ipsilateral | medial ventral horn, bilateral | axial and proximal muscles | medium | [G Corticospinal_tract L40] |
| Corticobulbar | `corticobulbar` | `m1.face`, `pmv` | brainstem only (`cns`) | `n7m`, `motV`, `n12`, `nAmbMotor`, `n11` | voluntary face, jaw, tongue, larynx | medium | [T] |
| Rubrospinal | `rubrospinal` | `redNucleus` | contralateral | cervical intermediate zone | distal flexors; small in humans | medium | [T]; Lemon 2008 [recalled] |
| Pontine reticulospinal | `rsPont` | `pno`, `pnc` | ipsilateral anterior funiculus | medial ventral horn, lamina VIII | axial and extensor tone; limb part of startle | medium | [T]; Davis et al. 1982 (R) |
| Medullary reticulospinal | `rsMed` | `gi` | bilateral, lateral funiculus | laminae VII–IX | mainly inhibitory; REM atonia | low | [T] |
| Lateral vestibulospinal | `lvst` | `vestNuc` (Deiters) | ipsilateral, all levels | extensor pools | antigravity tone (`standUp`) | medium | [T] |
| Medial vestibulospinal | `mvst` | `vestNuc` (medial) | bilateral, cervical | neck pools | vestibulocollic reflex | low | [T] |
| Tectospinal | `tectospinal` | `sc` | contralateral, cervical | neck pools | orienting head turn (`loudSound`, `brightLight`) | low | [T] |
| Bulbospinal respiratory | `bsResp` | ventral respiratory group, driven by `preBotC` (§3) | ventrolateral funiculus | `phrenicNuc`, intercostal and abdominal pools | breathing output (§6.13) | medium | [T] |
| Descending modulation | `descMod` | `rmg` (RVM), `lc`, `dr` | dorsolateral funiculus | dorsal horn (pain control, §5); ventral horn (motor gain) | nociceptive and motor gain | low | [T] |

The A11 diencephalospinal pathway is not a somatic tract. Its values stay in DOPAMINE.md, and its `nets` below the junction is open (§6.17).

### 6.9. Motor units, neuromuscular junction and muscle output

Motor units are recruited by size: slow (S), then fast fatigue-resistant (FR), then fast fatigable (FF) ([T]; Henneman 1957 [recalled], C). Force is encoded by recruitment plus rate coding. The NMJ has a high safety factor, so every motor-axon impulse yields a muscle action potential; no neuromuscular-blocking intervention is planned. §4 owns the NMJ delay, EMG spread and electromechanical delay (A.9).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Discharge rate at recruitment | 5–8 | Hz | H | medium | [T] |
| Discharge rate at maximal sustained effort | 20–50 | Hz | H | medium | [T] |
| Brief discharge at ballistic onset | up to ≈ 100 | Hz | H | low | [T] |
| Motor units / innervation ratio, first dorsal interosseous | ≈ 120 / ≈ 340 | units / fibres per unit | H | low | Feinstein et al. 1955 [recalled] |
| Motor units / innervation ratio, tibialis anterior | ≈ 450 / ≈ 660 | units / fibres per unit | H | low | Feinstein et al. 1955 [recalled] |
| Motor units / innervation ratio, medial gastrocnemius | ≈ 580 / ≈ 1,900 | units / fibres per unit | H | low | Feinstein et al. 1955 [recalled] |
| Innervation ratio, extraocular muscles | ≈ 10 | fibres per unit | H | low | [T] |
| NMJ cleft width | 30 | nm | mixed (see note) | high | [G Neuromuscular_junction L45] |
| nAChR density at the endplate | 10,000 | receptors/µm² | mixed | medium | [G Neuromuscular_junction L45] |
| AChE density in the cleft | 2,600 | molecules/µm² | mixed | medium | [G Neuromuscular_junction L46] |
| ACh per quantum | 7,000–10,000 | molecules | mixed | medium | [G Neuromuscular_junction L48] |
| Receptors opened per quantum | ≈ 2,000 | receptors | mixed | medium | [G Neuromuscular_junction L48] |
| MEPP amplitude | ≈ 0.5 | mV | mixed | medium | [G Neuromuscular_junction L48] |
| Spontaneous quantal rate at rest | ≈ 1 | /s per junction | mixed | medium | [G Neuromuscular_junction L48] |
| ACh hydrolysis time | ≈ 0.16 | ms | mixed | low | [G Neuromuscular_junction L48] ("citation needed" in the capture) |
| Vesicles per motor terminal | ≈ 500,000 | vesicles | frog | medium | [G Neuromuscular_junction L45] |
| Safety factor (EPP ÷ threshold) | ≈ 3–5 | ratio | mixed mammal | low | [T] |
| Activation τ (rise of `force` after delayed `emg`) | 15 | ms | — | low | [model], guided by Zajac 1989 [recalled] |
| Deactivation τ | 50 | ms | — | low | [model], guided by Zajac 1989 [recalled] |
| EMG burst width of one tendon-jerk volley | 10–20 | ms | H | low | [T] |

Note: "mixed" means the capture pools frog and mammalian values. A.1 has no frog tag (§6.17). The graph confirms motor neuron → NMJ → chemical synapse → ACh → nicotinic receptor.

State variables owned here (A.3.4):

- `emg.<muscle>` (0–1) is rectified, smoothed EMG normalised to a maximal voluntary contraction. It is computed on the `NF` grid (A.4) as recruitment-weighted pool drive: reflex volleys plus descending command plus `shiver`.
- `force.<muscle>` (0–1) is `emg` delayed by the electromechanical delay (§4) and then passed through first-order activation and deactivation.
- `joint.<joint>` is defined in §6.16 and `reflexGain` in §6.11.

Tonic discharge at 5–50 Hz is shown as steady glow, never as one flash per spike (§13).

### 6.10. Reflex circuits

Each reflex is a parameterised circuit over the node graph. Its latency is computed, not set: path lengths (§2) over velocities (§4), plus n_syn · t_syn, plus the NMJ delay and EMG spread. The targets in §6.11 are the acceptance tests in §4's model-vs-target table. §5 owns receptor transduction (spindle, tendon organ, nociceptor).

Every stretch circuit includes two inhibitory elements:

- reciprocal Ia inhibition: one glycinergic interneuron onto the antagonist pool [G Reflex_arc L54];
- recurrent Renshaw inhibition [T].

Ib autogenic inhibition runs continuously in the force loop. At high gain it gives the clasp-knife response, an upper-motor-neuron sign [G Stretch_reflex L77].

The graph confirms these chains:

- muscle spindle → stretch reflex → α motor neuron, plus the Ia inhibitory interneuron;
- Golgi tendon organ → clasp-knife reflex;
- nociceptor → withdrawal reflex → crossed extensor reflex;
- auditory nerve → cochlear root neurons → PnC → facial motor nucleus, and cochlear nucleus → LLN → PnC [G Startle_response L33, L47];
- vestibular nuclei → nuclei III, IV and VI → VOR.

Blink, corneal, jaw, stapedius and plantar arcs are [T] only; the graph has no edges for them.

| Reflex id | Trigger (A.6 sense / mode; site) | Afferent | Centre (n_syn) | Efferent → muscle | `nets` |
|---|---|---|---|---|---|
| `reflex.biceps` | proprioception / tendonTap; `bicepsTendon` | `Ia`, `musculocutaneous` → `drg.C5`–`C6` | `cord.C5`–`C6.vh` (1; antagonist 2) | → `biceps`; inhibits `triceps` | `somatic` |
| `reflex.triceps` | tendonTap; `tricepsTendon` | `Ia`, `radial` → C7–C8 | `cord.C7`–`C8.vh` (1) | → `triceps` | `somatic` |
| `reflex.patellar` | tendonTap; `patellarTendon` | `Ia`, `femoral` → L2–L4 | `cord.L3`–`L4.vh` (1; inhibits `hamstrings`, 2) | `femoral` → `quadriceps` | `somatic` |
| `reflex.achilles` | tendonTap; `achillesTendon` | `Ia`, `tibial` → S1–S2 | `cord.S1`–`S2.vh` (1) | → `gastrocSoleus`; inhibits `tibialisAnt` | `somatic` |
| `reflex.hSoleus` | validation only (electrical tibial stimulus, popliteal fossa) | `Ia` | 1 | → `gastrocSoleus` | `somatic` |
| `reflex.jaw` | validation and reflex test (chin tap) | `Ia` via V3 to `mesV` | `mesV` → `motV` (1) | `cn5.motor` → `masseter` | `somatic` |
| `reflex.withdrawalArm` | pain (heat, pinprick, pressure) on hand or forearm sites | `Adelta` (first), `C` (second) → C6–T1 | multisegmental flexor-reflex interneurons, laminae IV–VII (≥ 3) | → `biceps`, `deltoid`; `triceps` inhibited | `somatic` |
| `reflex.withdrawalLeg` | pain on `footSole`, `heel`, `bigToe` | `Adelta`, `C` (`tibial`, `sural`) → L4–S2 | flexor-reflex interneurons (≥ 3) | → `hamstrings`, `tibialisAnt`, *`iliopsoas`*; `quadriceps`, `gastrocSoleus` inhibited | `somatic` |
| `reflex.crossedExt` | coupled to `reflex.withdrawalLeg` when `posture` = upright | — | commissural interneurons, lamina VIII (≥ 4) | contralateral `quadriceps`, `gastrocSoleus`, `glutealMax` | `somatic` |
| `reflex.riii` | validation only (electrical `sural`) | `Adelta` | flexor-reflex interneurons | → biceps femoris (`hamstrings`) | `somatic` |
| `reflex.plantar` | touch / stroke or pain / pinprick, lateral `footSole` | `Abeta`, `Adelta` → S1–S2 | polysynaptic | normal: *`toeFlexors*`; Babinski: *`toeExtensors`* (L5) when the CST is cut at or above L5 | `somatic` |
| `reflex.blinkR1` | touch / press; `foreheadV1` | `Abeta`, V1 | `prV` → ipsilateral `n7m` (2–3) | `cn7.motor` → `orbicularisOculi` | `somatic` |
| `reflex.blinkR2` | same stimulus | `Abeta`/`Adelta`, V1 | `spV` → lateral medullary `mrf` → both `n7m` | both `orbicularisOculi` | `somatic` |
| `reflex.corneal` | touch on the cornea (proposed *`cornea.R/L`*) | V1 nasociliary | `spV` → `mrf` → both `n7m` | both `orbicularisOculi` | `somatic` |
| `reflex.vor` | balance / rotation; head | vestibular afferent | `vestNuc` → `n6`, and via the MLF to `n3` (2 central synapses) | `cn3`/`cn4`/`cn6.motor` → `extraocular` | `special ∧ somatic` |
| `reflex.stapedius` | hearing above θ_stap, either ear | cochlear afferent | `cochNuc` (VCN) → `soc` → both `n7m` (3–4) | `cn7.motor` → both `stapedius` | `special ∧ somatic` |
| `reflex.startle` | hearing above threshold with a fast rise; also sudden vestibular or touch input [T] | cochlear afferent | cochlear root neurons (in `cochNuc`) → `pnc` → `n7m`, `motV`, `n11`, and via `rsPont`/`portRS` to cord pools | cascade (§6.11) | motor `special ∧ somatic`; autonomic signs `special ∧ autonomic` (§7) |
| `reflex.m2` | proprioception / imposedMovement at `wrist` or `finger` | `Ia` → `dcCuneate` → `cuneate` → `thalVPL` | `ba3a`, `m1.hand` (transcortical) | `portCST` → `cord.C6`–`T1.vh` → `forearmFlexors` | `somatic` (brain part `cns`) |
| `reflex.dazzle` | vision / flash at high luminance | retina | `sc`, pretectum → `n7m` | both `orbicularisOculi` | `special ∧ somatic` |
| `reflex.gag` (optional) | scenario use only | `cn9.aff` | `ntsVisc`, `spV` → `nAmbMotor` | → *`pharynxLarynx`* | `autonomic ∧ somatic` |

The hot-object withdrawal is composed in five steps; §12 sets the input:

1. Heat reaches the nociceptor terminals. §5 owns this transduction delay.
2. The `Adelta` volley runs from the palm to the C7 DRG (the §2 wrist → C7 DRG path plus the palm segment), then from the DRG to the segment.
3. A chain of 3–4 interneurons adds n_syn · t_syn.
4. The motor volley runs from the C5–C6 segments to `biceps` and `deltoid`, then crosses the NMJ and spreads (§4).
5. The electromechanical delay (§4) gives movement onset.

With the §2.14 lengths (palm → C7 segment ≈ 813 mm, C6 segment → biceps 392 mm), steps 2–4 put EMG onset 64 ms after nociceptor activation (EV; ≈ 67 ms NF; §4.11). Step 1 dominates: at the default terminal depth of 150 µm, heat from a 55 °C contact on 32 °C skin reaches the nociceptor threshold after 224 ms (§11.9). EMG onset therefore falls ≈ 290 ms after contact and movement onset ≈ 320 ms after it (EMD 30 ms, §4). The §6.11 targets are this composition, labelled [model]; no human contact-heat EMG latency is sourced. Palmar glabrous skin is thick, so a shallower default depth would not be justified. The `C` volley carries second pain (§5) and does not set the reflex latency. The same scratch geometry gives a biceps jerk of about 14 ms.

### 6.11. Reflex latencies, thresholds and gain

Latencies run from stimulus or tap to EMG onset unless stated otherwise. With the §2.14 lengths, the composed arcs give patellar ≈ 23.1 ms and Achilles ≈ 32.8 ms (§4.11). Neither includes a receptor term. These rows are the acceptance targets of Table 4.11. Peripheral latencies scale with stature, and §2 gives the reference stature.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Biceps tendon reflex | 11–15 | ms | H | medium | [T] |
| Triceps tendon reflex | 12–17 | ms | H | low | [T] |
| Patellar reflex (quadriceps) | 18–23 | ms | H | medium | [T] |
| Achilles reflex (soleus) | 30–36 | ms | H | medium | [T] |
| Correlation of latency with height, patellar / Achilles | r ≈ 0.70 / 0.72 | — | H | medium | Frijns et al. 1997 (abstract; n = 102) |
| Correlation of latency with age, patellar / Achilles | r ≈ 0.16 / 0.30 | — | H | medium | Frijns et al. 1997 (abstract) |
| Correlation of Achilles latency with soleus H-reflex latency | r ≈ 0.97 | — | H | medium | Frijns et al. 1997 (abstract) |
| Soleus H-reflex | 28–32 | ms | H | medium | [T] |
| Soleus H-reflex nomogram (L = popliteal stimulation point to medial malleolus) | 9.14 + 0.46 · L (cm) + 0.1 · age (y) | ms | H | low | Braddom & Johnson 1974 [recalled] |
| FCR H-reflex | 15–18 | ms | H | low | [T] |
| Jaw jerk (masseter) | 6–10 | ms | H | low | [T] |
| Extra central delay, reciprocal Ia inhibition | ≈ 1 | ms | C, H | medium | [T] |
| Extra central delay, Ib autogenic inhibition | 1–2 | ms | C | low | [T] |
| RII (non-nociceptive, sural → biceps femoris) | 40–60 | ms | H | low | Sandrini et al. 2005 [recalled] |
| RIII onset | 90–130 | ms | H | low | Willer 1977 [recalled]; Sandrini et al. 2005 [recalled] |
| RIII analysis window | 90–180 | ms | H | low | Sandrini et al. 2005 [recalled] |
| RIII (withdrawal) threshold | equals the pain threshold (value in §5) | — | H | medium | Willer 1977 (abstract) |
| Hand withdrawal, 55 °C contact, EMG onset from contact | 250–350 | ms | — | low | [model] (§6.10: transduction 224 ms + neural 64–67 ms); no human contact-heat source |
| Hand withdrawal, movement onset from contact | 280–380 | ms | — | low | [model] (EMG onset + 30 ms EMD); completion < 500 ms [G Withdrawal_reflex L31] |
| Crossed extension, delay after ipsilateral flexor onset | 10–30 | ms | — | low | [model]; contralateral activation [G Withdrawal_reflex L31] |
| Crossed-extension threshold | ≈ 1.5 × withdrawal threshold | relative | — | low | [model] |
| Blink R1, ipsilateral (supraorbital) | 10–13 (mean ≈ 10.5) | ms | H | medium | Kimura 1973 [recalled]; [T] |
| Blink R2, ipsilateral / contralateral | 30–41 / 30–44 | ms | H | medium | Kimura 1973 [recalled]; [T] |
| Facial direct response (stylomastoid → orbicularis oculi) | 3–4 | ms | H | low | [T] |
| Corneal reflex (bilateral) | 35–50 | ms | H | low | [T] |
| VOR latency, yaw / pitch / roll | 7.5 ± 2.9 / 7.6 ± 2.8 / 10.3 ± 1.9 | ms | H | high | Aw et al. 1996 |
| VOR gain (high-acceleration yaw) | 0.9–1.0 | ratio | H | medium | Aw et al. 1996; [T] |
| Stapedius threshold, ipsilateral tone 0.5–2 kHz | 70–90 | dB HL | H | medium | [T] |
| Contralateral stapedius threshold offset | +5–10 | dB | H | low | [T] |
| Broadband-noise threshold relative to tones | −15 to −20 | dB | H | low | [T] |
| Model θ_stap, ipsilateral (tone / broadband) | 85 / 70 | dB SPL | — | low | [model] (A.6 marker ≈ 85) |
| Stapedius latency, near threshold → high level | 100 → 25 | ms | H | medium | [T] |
| Model stapedius latency rule | 100 at θ_stap, linear to 25 at θ_stap + 30 dB | ms | — | low | [model] |
| Acoustic startle threshold | > 80 | dB SPL | H | medium | [G Startle_response L43] |
| Model startle probability | logistic, midpoint 90, scale 4.55 (10 % at 80, 90 % at 100) | dB SPL | — | low | [model] (A.6 marker ≈ 90) |
| Startle EMG: masseter / orbicularis oculi | ≈ 14 / 20–40 | ms | H | medium | [G Startle_response L39] |
| Startle latency, head / neck / shoulder (measure not stated in the capture, probably movement onset from high-speed film) | 60–120 / 75–121 / 100–121 | ms | H | low | [G Startle_response L39], which cites no primary source |
| Startle latency, arms / legs (same measure) | 125–195 / 145–395 | ms | H | low | same |
| Startle recruitment order (EMG) | orbicularis oculi at blink-reflex latency; sternocleidomastoid first of the generalised response; more caudal muscles progressively later; intrinsic hand muscles very long | — | H | medium | Brown et al. 1991, *Brain* 114:1891–1902 (abstract) |
| Model recruitment delays (EMG onset), neck / shoulder / arm / leg | 68 / 85 / 115 / 150, plus reticulospinal conduction (§4) | ms | — | low | [model]; these sit in the lower half of each band above, and the simulated joint-angle onsets (elbow ≈ 199, knee ≈ 252 ms) lie above the arm and leg bands, which is expected if the bands are movement latencies |
| Primary startle circuit, tone → hindleg EMG | 8 (< 10) | ms | R | medium | Davis et al. 1982; [G Startle_response L47] |
| Long-latency stretch reflex, wrist/hand: M1 / M2 / M3 | 25–30 / 50–60 / 70–100 | ms | H | medium | [T]; Lee & Tatton 1975 [recalled]; Matthews 1991 [recalled] |
| Plantar response (flexor normal; Babinski extensor) | sign only, no latency target | — | H | medium | [T] |
| Tendon-tap threshold for reflex EMG (tendon displacement) | 0.5 | mm | — | low | [model] |
| Tendon-tap response law (s > 0.5 mm) | a = 1 − exp(−(s − 0.5 mm) / 1.2 mm) | 0–1 | — | low | [model] |
| Clonus frequency (ankle) | 5–7 | Hz | H | low | [T] |

The startle rows apply to the reference broadband probe (fast rise, 50 ms). §5 owns habituation and prepulse inhibition, which multiply startle magnitude. The amygdala and BNST modulate startle [G Startle_response L43, L45].

`reflexGain` is the product of the factors below, evaluated per spinal segment so that SCI acts only below the lesion. Startle has its own product: the state factor × the fear factor × habituation and PPI from §5.

| Factor | Value | Applies to | Species | Conf. | Source |
|---|---|---|---|---|---|
| `arousalState` wakeAlert / wakeRelaxed / n1 / n2 / n3 / rem | 1.1 / 1.0 / 0.9 / 0.7 / 0.6 / 0.1 | monosynaptic and H reflexes | — | low | [model]; REM suppression of the H-reflex from Hodes & Dement 1964 [recalled] |
| Jendrassik manoeuvre (optional flag) | × 1.5 | tendon reflexes | — | low | [model]; direction [T] |
| Fear or threat (`salience` with amygdala/BNST activity, §3) | × 1.3 | startle | — | low | [model]; direction from Lang, Bradley & Cuthbert 1990 [recalled] |
| SCI phase below the lesion | per §6.15 | segmental reflexes below the lesion | — | low | [model] |

HUD clinical grade ([model], low; scale from [G Stretch_reflex L69–L75]):

| `reflexGain` | < 0.15 | 0.15–0.6 | 0.6–1.6 | 1.6–2.4 | > 2.4 |
|---|---|---|---|---|---|
| Grade | 0 | 1+ | 2+ | 3+ | 4+ with clonus |

Clonus is shown as rate-coded glow (§13).

### 6.12. Voluntary command and central motor conduction

§3 owns the decision and the simple reaction times. The command runs:

1. from `pmd`, `sma` and `m1.<site>` through `portCST`;
2. along `cstLat`, or `cstAnt` for axial muscles;
3. to the segmental pools, directly and through interneurons, with α–γ co-activation that keeps spindle sensitivity during shortening [T].

An efference copy goes to the cerebellar forward model (§3), which attenuates self-produced touch. The core scenarios need no voluntary movement beyond optional scripted follow-ups (§12), and voluntary EMG is shown as glow only (§6.16). With `somatic` off or in brain-only mode, the command is computed and fades at `portCST` as efference only (A.5).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| CMCT, cortex → cervical motor neurons (hand) | 5–8 | ms | H | medium | [T]; Rossini et al. 2015 [unverified] |
| CMCT, cortex → lumbar motor neurons (leg) | 12–16 | ms | H | medium | [T]; Rossini et al. 2015 [unverified] |
| MEP latency, hand muscle (APB or FDI) | 20–23 | ms | H | medium | [T] |
| MEP latency, tibialis anterior | 28–32 | ms | H | medium | [T] |

Model check (scratch, not a source). The corticospinal routes are M1 hand → contralateral C7 232 mm and M1 leg → contralateral L4 532 mm (§2.14). At the A.9 corticospinal CV plus one synapse this gives:

- Hand: CMCT ≈ 4.5 ms (≈ 4.9 ms with the 24-mm root to the foramen at 55 m/s), 0.1–0.5 ms below the 5–8 ms target. §4 should review the corticospinal velocity (a bulk CV of ≈ 50 m/s would give ≈ 5.3 ms) or the synapse count (§6.17).
- Leg: CMCT ≈ 9.5 ms to the L4 segment. Including the 188 mm cauda-equina root (§2.14) at α-motor CV gives ≈ 13.2 ms, inside 12–16 ms.

Root-stimulation CMCT includes this proximal root segment, and the F-wave method does not [T]. The model therefore compares against the root-stimulation convention (§6.17).

### 6.13. Pattern generators and the respiration rule

`preBotC` (§3) generates the respiratory rhythm in the CNS, and §7 owns `rr` and `vt`. The somatic part is the output stage:

- `bsResp` drives `phrenicNuc` (C3–C5) → `phrenic` → `diaphragm`.
- `bsResp` also drives the external and parasternal intercostals via `intercostal.T1…T11`, and the scalenes.
- At high ventilation (§7), expiration becomes active and recruits the internal intercostals and `rectusAbdominis` [T].

`diaphragmExc` moves the diaphragm star sheet (§13). The graph links the respiratory centre and pneumotaxic centre to the phrenic nerve.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Diaphragm motor supply | `phrenic`, C3–C5 (mainly C4) | — | H | high | [G Phrenic_nerve L26, L36] |
| Diaphragm excursion, quiet breathing, mean (men / women) | 18 ± 3 / 16 ± 3 | mm | H | low | Boussuges et al. 2009 [recalled] |
| Lower limit of normal, quiet breathing (men / women) | 10 / 9 | mm | H | medium | Boussuges et al. 2009 (abstract; n = 210) |
| Diaphragm excursion, deep breathing, mean (men / women) | 70 ± 11 / 57 ± 10 | mm | H | low | Boussuges et al. 2009 [recalled] |
| Lower limit of normal, deep breathing (men / women) | 47 / 37 | mm | H | medium | Boussuges et al. 2009 (abstract) |
| Model mapping | `diaphragmExc` = 17 mm · (`vt` / vt_rest)^0.75, with vt_rest from §7 (≈ 65 mm at 6 × vt_rest) | mm | — | low | [model] |
| Locomotor CPG location | lower thoracic and lumbar cord | — | Ms, C (vertebrate) | high | [G Central_pattern_generator L53] |
| Human rhythmogenic core | upper lumbar, around L2 (`cpgL`) | — | H | low | Dimitrijevic, Gerasimenko & Pinter 1998 [recalled] |
| Epidural stimulation evoking rhythmic, stepping-like EMG after motor-complete SCI | 25–50 | Hz | H | medium | Minassian et al. 2004 (abstract; n = 10) |
| Epidural stimulation evoking sustained tonic extension | 5–15 | Hz | H | medium | Minassian et al. 2004 (abstract) |
| Stride frequency in walking (cadence 100–120 steps/min) | 0.8–1.0 | Hz | H | medium | [T] |

When the somatic network is off, or in brain-only mode (A.5; A.8 #8), respiration follows this rule:

- `preBotC` keeps its rhythm. In brain-only mode the rhythm is fictive.
- Phrenic and intercostal edges are cut, `diaphragmExc` = 0, and the sheet is static.
- The HUD states "ventilation maintained (model assumption)".
- Blood gases are clamped at PaCO₂ 40 and PaO₂ 95 mmHg (A.9; §7).
- `rr` and `vt` keep their central values for cross-network readers (§7), and central RSA persists [model].

The same rule covers the C2 and C4 SCI presets (§6.15), where the assumption stands for mechanical ventilation. Simulated hypoxia never spreads into other networks.

The locomotor CPG is a labelled region, "locomotor CPG (inferred in humans)": a half-centre pair of flexor and extensor pools [G Central_pattern_generator L39]. The V0–V3 interneuron classes come from mouse and zebrafish genetics [G Central_pattern_generator L55]. No core scenario drives the locomotor CPG.

The swallowing pattern generator is a medullary reticular network: a dorsal group in and around the NTS (`ntsGust`, `ntsVisc`) and a ventral group near the nucleus ambiguus (Jean 2001, *Physiol Rev* 81:929–969 [recalled]; textbook anatomy [T]). The capture's placement of the generator at the hypoglossal nucleus [G Central_pattern_generator L53] is not adopted (§5.17): that nucleus is a motor nucleus and receives the output. Its oropharyngeal output (`nAmbMotor`, `n12`, `motV`, `n7m`) is somatic. §8 owns the oesophageal phase.

Shivering is driven centrally from the preoptic area via the dorsomedial hypothalamus and `rpa` to α motor neurons through bulbospinal paths. `shiver` (0–1) adds tonic drive to `emg` of `trapezius`, `erectorSpinae`, `deltoid`, `rectusAbdominis` and `quadriceps` [model]. §7 owns thresholds and heat-production gain, and §10 owns the fever set point. Shivering is shown as muscle glow without limb motion (A.8 #22). With `somatic` off there is no shivering, and fever relies on vasoconstriction and BAT (A.5).

### 6.14. Somatic switch, brain-only mode and cross-network gates

The switch ramps `g.somatic` over 1.0 s of tH (A.5). Every edge whose `nets` holds a somatic sub-network stops. Spinal grey matter relaxes to its intrinsic (denervated) state, and brain nodes keep computing.

- `portDC`, `portSTT` and `portTrig` go silent. Spinocerebellar input also enters at `portDC` unless §3 adds a port (§6.17).
- Efference at `portCST`, `portRS` and `portCranMotor` is drawn as efference-only packets.
- In brain-only mode the cord below the junction, including `n11` and `phrenicNuc`, is not simulated, so XI has no brain-only form and its commands end at `portCranMotor` (A.2 boundary rule). `spV`, drawn to z −70, lies wholly above the junction and is computed. The upper-cord part of the `BRAINSTEM` tube is drawn as today (A.2; `BRAINSTEM`, `src/anatomy.js` L321–L324). The cranial motor nuclei, `pnc` and the motor cortex compute central forms only.

| Function | All networks on | Somatic off | Autonomic off | Brain only |
|---|---|---|---|---|
| Tendon and H reflexes | present (§6.11) | absent | unchanged | unavailable |
| Withdrawal, crossed extension | present, with autonomic signs (§7) | absent; no percept, no autonomic response | motor unchanged; no autonomic signs | unavailable (`hotObject` greyed) |
| Blink R1/R2, corneal, jaw jerk | present | absent | unchanged | unavailable |
| VOR | eyes counter-rotate | nuclei compute; efference only | unchanged | central form |
| Stapedius, dazzle blink | present | absent | unchanged | central form |
| Startle | motor cascade and autonomic signs | autonomic signs only (A.5) | motor cascade only | `pnc` activity; efference only |
| Voluntary command | EMG | efference only | unchanged | efference only |
| Breathing output | phrenic and intercostal bursts | cut; ventilation maintained | rhythm and output intact; peripheral chemoreflex afferents absent, so only central CO₂ chemoreception regulates ventilation; resting PaCO₂ settles within ±2 mmHg of 40 [model] (residual drive §7.9); HUD tag "central chemoreflex only" | ventilation maintained; fictive rhythm |
| Shivering | as §7 requires | absent | present | — |
| Touch, pain, temperature, proprioception percepts | present | none | present; no autonomic signs | unavailable |
| Antigravity tone (`standUp`) | present; muscle pump active | passive tilt (A.5) | present | unavailable |
| Pelvic-floor tone (`onuf`) | tonic | absent | unchanged | — |
| Vitals | EMG and force shown | 0; "ventilation maintained" | — | "—" |

| Loop or edge set | `nets` | Note |
|---|---|---|
| Startle motor / startle autonomic signs | `special ∧ somatic` / `special ∧ autonomic` | A.5; autonomic owner §7 |
| VOR, stapedius, dazzle blink | `special ∧ somatic` | proposed here |
| Gag reflex; cough; peripheral-chemoreflex ventilatory response | `autonomic ∧ somatic` | visceral afferent, somatic output |
| Autonomic responses to skin stimuli (pain-evoked HR, SCR, pupil; cold-evoked vasoconstriction; cold-face bradycardia) | `somatic ∧ autonomic` | §7 values |
| Shivering in fever | `somatic` (set point needs `neuroimmune`) | A.5 |
| `Cpost` and visceral afferent edges inside somatic nerves | `autonomic` | §6.1 |

### 6.15. Interventions: spinal cord injury, nerve section and dorsal rhizotomy

§11 owns intervention semantics: one preset at a time, separate from the switches. This section defines the content. An SCI preset does two things:

- it cuts the §6.3 (ξ, η) regions at the lesion segment for every tract edge crossing it;
- it removes grey-matter nodes at the level.

The result is lower-motor-neuron signs at the level and upper-motor-neuron signs below it.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Cervical share of SCI | just over 50 | % | H | medium | [G Spinal_cord_injury L35] |
| Thoracic, thoracolumbar and lumbar shares | ≈ 15 each | % | H | medium | [G Spinal_cord_injury L35] |
| SCI survivors per year, USA | ≈ 12,000 | people/y | H | medium | [G Spinal_cord_injury L39] |
| Complete / incomplete tetraplegia | 18.3 / 34.1 | % | H | medium | [G Spinal_cord_injury L73] |
| Complete / incomplete paraplegia | 23.0 / 18.5 | % | H | medium | [G Spinal_cord_injury L74] |
| Incomplete-injury criterion | sensory or motor sparing at S4–S5 | — | H | high | [G Spinal_cord_injury L57, L76] |

The default level is C6, because cervical injuries predominate [model]. Sacral sparing is a readout only; S4–S5 is never pickable (A.1).

| Level | Vertebral level (§2 rule) | Lost (complete lesion) | Preserved | Respiration | Autonomic hand-off |
|---|---|---|---|---|---|
| C2 | C1–C2 | all limbs, trunk, `diaphragm`, most `n11` output | face, cranial nerves | phrenic output lost; ventilation maintained | at or above T6 (§7) |
| C4 | C3 | arms, trunk, legs; diaphragm partial | C3 phrenic share; shrug (`cn11`) | reduced; ventilation maintained | §7 |
| C6 | C5 | `triceps`, finger flexors, `handIntrinsics`, trunk, legs; wrist extension weak | `diaphragm`, `deltoid`, `biceps` | intercostals and abdominals lost (weak cough) | §7 |
| T1 | C7 | trunk below T1, legs; hand intrinsics partial | arms | intercostals T2–T11 lost | §7 |
| T6 | T4 | lower intercostals, abdominal wall, legs | arms, upper intercostals | largely preserved | threshold level (§7) |
| T10 | T7 | lower abdominal wall (Beevor's sign), legs | upper abdominal wall | preserved | below T6 |
| L2 | T10 | knee extension, ankle and toe movement; hip flexion weak | trunk | preserved | below T6 |
| S2 | L1 (conus) | `pelvicFloor` (`onuf`, `pudendal`); *`toeFlexors`* partial; sacral parasympathetic outflow (bladder, rectum → §7, §8) | hips, knees, dorsiflexion; Achilles mostly (S1) | preserved | below T6 |

Level consequences follow [T] (ISNCSCI), H, medium; phrenic levels follow [G Phrenic_nerve L36]. §7 applies the T6 rule (neurogenic shock acutely, autonomic dysreflexia later) using the lesion flag this preset sets.

| Type | Cut set at the lesion | Resulting pattern | Conf. | Source |
|---|---|---|---|---|
| Complete | whole cross-section at 1 segment; zone of partial preservation 1–2 segments below at gain 0.5 [model] | no function below incl. S4–S5; UMN signs after spinal shock; LMN signs at the level | high | [G Spinal_cord_injury L57, L76]; [T] |
| Brown-Séquard (side selectable) | ξ > 0 half (right preset) at 1 segment | ipsilateral motor and dorsal-column loss; contralateral pain and temperature loss from 1–2 segments below; all modalities lost at the level | high | [G Spinothalamic_tract L69]; [T] |
| Central cord (cervical presets) | grey matter with \|ξ\| < 0.5 plus the anterior white commissure over lesion ± 1 segment; inner `cstLat` (\|ξ\| 0.50–0.68) at gain 0.3 [model] | arms weaker than legs; cape-like pain and temperature loss; sacral sparing | low (relies on contested lamination) | [T] |
| Anterior cord | all η > −0.4 over 2 segments | motor, pain and temperature loss below; dorsal-column modalities spared | medium | [T] |

| Phase | Time after injury | Picture | Tendon gain | Cutaneous / flexor gain | Babinski | §6.11 HUD grade (gain × the 1.1 wake-alert factor) |
|---|---|---|---|---|---|---|
| 1 | 0–1 d | areflexia or hyporeflexia; flaccid | 0 | 0–0.1 | absent (delayed plantar response possible) | 0 |
| 2 | 1–3 d | initial reflex return, cutaneous first | 0–0.2 | 0.3 | may appear | 0–1+ |
| 3 | 1–4 wk | initial hyperreflexia | 1.8 | 1.2 | present | 3+ (1.98) |
| 4 | 1–12 mo | hyperreflexia, spasticity, clonus, clasp-knife | 2.5 | 1.5 | present | 4+ with clonus (2.75) |

Phase windows and descriptions follow Ditunno et al. 2004 (H, medium). Gains are [model] (—, low). The phase-3 tendon gain is set so that the displayed grade is the hyperreflexia the phase describes: the earlier 1.2 gave 1.32 after the state factor, which the §6.11 table grades 2+ (normal brisk).

Named-nerve section is offered for:

- upper limb: `radial`, `median`, `ulnar`, `axillary`, `musculocutaneous`;
- lower limb: `femoral`, `obturator`, `sciatic`, `tibial`, `commonFibular`;
- `phrenic`, with `cn7.motor` as an option.

The cut removes every edge in the nerve distal to the section, including its `Cpost` and visceral afferent edges (§6.1). The consequences:

- Its muscles go flaccid, reflexes through the nerve vanish, and its territory becomes anaesthetic at once.
- A unilateral phrenic section stops that hemidiaphragm, with ventilation maintained.
- A `cn7.motor` section abolishes the ipsilateral blink motor response and the stapedius on that side.

The day slider (0–365 d) changes only the excitability and appearance of the distal stump.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Conduction and reflexes through the section | lost at once | — | H | medium | [T] |
| Distal motor response (CMAP) | ≈ 50 % by day 3–5; absent by day 9 | d | H | medium | Chaudhry & Cornblath 1992 (abstract; n = 5) |
| Distal sensory response (SNAP) | absent by ≈ day 11 | d | H | low | Chaudhry & Cornblath 1992 [recalled] |
| Fibrillation potentials appear | 10–21 (later with a long stump) | d | H | low | [T] |
| Axon regeneration rate | 1–3 | mm/day | H | medium | [T] |
| Muscle fibrosis without reinnervation | 12–24 | months | H | low | [T] |
| Model distal excitability | 1 until day 3, then linear to 0 at day 9 (motor) and day 11 (sensory) | 0–1 | — | low | [model] |

Dorsal rhizotomy removes every dorsal-root edge, somatic and visceral, at the selected segments. Stretch reflexes through those segments vanish, and voluntary movement stays. Anaesthesia needs about 3 adjacent roots [T].

A "large fibre only" variant removes `Ia`, `Ib`, `II` and `Abeta` and keeps `Adelta` and `C`. This is the human sensory-neuronopathy case: no stretch reflexes or position sense, intact pain and temperature, and movement that depends on vision (Cole & Sedgwick 1992 [recalled], H).

### 6.16. Motion of the figure

Only the reflexes in A.8 #22 move the figure, as rigid rotations at the §2 joints rendered by §13. Other somatic outputs glow on muscles and nerves. All motion is disabled under reduced motion.

| Reflex or scenario | Joint | Agonist − antagonist | Cap (A.8 #22) |
|---|---|---|---|
| Arm withdrawal (`hotObject`) | `elbow.R` flexion; `wrist.R` | `biceps` − `triceps`; `forearmExtensors` − `forearmFlexors` | elbow ≤ 30°, wrist ≤ 20° |
| Knee jerk (`kneeJerk`) | `knee.R` extension | `quadriceps` − `hamstrings` | ≤ 15° |
| Startle (`loudSound`) | neck, `shoulder`, `elbow`, both sides | `sternocleidomastoid`, `trapezius`, `deltoid`, `biceps` | ≤ 5° |
| All other reflexes, shivering, voluntary EMG | none | — | glow only |

Joint law ([model], low): `joint.<j>` = θ_rest + k_j · (`force` agonist − `force` antagonist). This passes through a second-order low-pass filter (3 Hz natural frequency, damping 0.8) and is clamped at the cap, with k_j set so that a maximal reflex reaches the cap. Reflex force follows each EMG burst as an α-function, `force` = a·(s/τ_tw)·e^(1 − s/τ_tw), with s = t − t_EMG − EMD (30 ms, §4) and τ_tw = 20 ms [model], so it peaks 50 ms after EMG onset. The filter cannot follow so brief a twitch: a default 2 mm patellar tap at `reflexGain` = 1 (a = 0.71, static equivalent 10.7°) gives a peak knee extension of ≈ 4.0° at ≈ 155 ms after the tap (§12.8). Motion starts after EMG onset (§6.11) plus the electromechanical delay. The diaphragm sheet moves by `diaphragmExc` as an organ display (§13).

### 6.17. Open questions

- **Values not checked against full texts.**
  - [recalled]: Feinstein et al. 1955 (motor units); Boussuges et al. 2009 (means); Kimura 1973; Braddom & Johnson 1974 (a secondary source gives the constant as −9.14, but only +9.14 yields 28–32 ms); Chaudhry & Cornblath 1992 (SNAP timing); Sandrini et al. 2005 and Willer 1977 (RIII latencies); Dimitrijevic et al. 1998; Lassek & Rasmussen 1939; Hodes & Dement 1964; Zajac 1989.
  - [unverified]: Lassek 1940; Rossini et al. 2015.
  - Verified from abstracts only: Bahney & von Bartheld 2018, Ditunno et al. 2004, Minassian et al. 2004, Frijns et al. 1997 (correlations), Davis et al. 1982, Willer 1977 (threshold).
- **Cranial axon counts.** III, IV, V, VI and VII are textbook values, and IX, XI and XII are placeholders. The two vagal counts differ about fourfold.
- **Cranial arcs compose short.** On provisional geometry with A.9 CVs, blink R1 composes to ≈ 8.5 ms against 10–13 ms, and the jaw jerk to ≈ 5 ms against 6–10 ms. §4 should add a receptor or brainstem-integration term, without rescaling CVs per fibre class. §2 must supply the trigeminal and intratemporal facial paths.
- **CMCT convention.** Leg CMCT meets 12–16 ms only if the cauda-equina root is included (§6.12). §4 should adopt the root-stimulation convention, or slower lumbar-projecting fibres. Hand CMCT composes 0.1–0.5 ms below 5–8 ms; an extra synapse or relay τ, or a bulk corticospinal CV of ≈ 50 m/s, would close it.
- **Withdrawal targets.** The §6.11 EMG and movement-onset targets are a [model] composition of the §11.9 transduction model and the §2.14 paths; a measured contact-heat withdrawal latency is needed.
- **Pyramidal crossing.** The capture gives ≈ 87 % (L40) and 75–80 % (L48). The 87 / 3 / 10 default needs a primary source.
- **Species tag.** NMJ capture values mix frog and mammal. A.1 has no frog tag ("Fr" proposed).
- **Gag-reflex afferent.** If pharyngeal sensation is classed GSA, the gag reflex becomes `somatic` only.
- **Striated upper oesophagus.** It receives SVE from `nAmbMotor` (somatic, A.8 #6). §8 must tag that edge accordingly.
- **`nets` for descending CNS axons below the junction.** This covers A11 (DOPAMINE.md §2.3), raphespinal, coerulospinal and RVM edges. `som.tract` is proposed here; §11 should confirm.
- **Spinocerebellar port.** Use `portDC`, or §3 adds `portSCT`.
- **Viscerosomatic convergence** (laminae I, V, X; referred pain). Should referred pain survive when only one of `somatic` and `autonomic` is on? §11 needs a rule.
- **CST lamination.** Somatotopic lamination of the human lateral CST is contested, and the central-cord preset relies on it. A lamination-free preset may be more defensible.
- **Cornea site.** Add `cornea.R/L` to A.3.3, or keep the corneal reflex for validation only.
- **Startle rise-time dependence.** It is unquantified. The `loudSound` probe (rise < 1 ms, §12) avoids it.
- **Stature.** A height slider would rescale peripheral paths; latency correlates with height at r ≈ 0.70.
- **Brainstem nucleus positions.** The somatic nuclei (`n3 n4 n6 motV n7m nAmbMotor n12 pnc gi`) should be checked against a registered MNI brainstem atlas (§3).
- **Olivocochlear efferents.** They have no network assigned; `special` seems natural.
- **Spinal circuit detail.** Human interneuron and CPG organisation is inferred from mouse, cat and stimulation studies. Named V0–V3 classes versus one labelled region is a §13 decision.

### 6.18. Sources

Peer-reviewed:

- Aw ST et al. 1996, J Neurophysiol 76:4009–4020 (Part I, normal subjects). VOR latency and gain (H).
- Bahney J, von Bartheld CS 2018, Anat Rec 301:697–710. Cord cell and neuron numbers (H, Mk).
- Boussuges A, Gole Y, Blanc P 2009, Chest 135:391–400. Diaphragm excursion (H).
- Braddom RL, Johnson EW 1974, Arch Phys Med Rehabil 55:161–166 [recalled]. H-reflex nomogram (H).
- Chaudhry V, Cornblath DR 1992, Muscle Nerve 15:687–693. Wallerian degeneration (H).
- Cole JD, Sedgwick EM 1992, J Physiol 449:503–515 [recalled]. Large-fibre deafferentation (H).
- Davis M et al. 1982, J Neurosci 2:791–805. Primary acoustic startle circuit (R).
- Dimitrijevic MR, Gerasimenko Y, Pinter MM 1998, Ann N Y Acad Sci 860:360–376 [recalled]. Human locomotor CPG.
- Ditunno JF et al. 2004, Spinal Cord 42:383–395. Four-phase spinal shock (H).
- Feinstein B et al. 1955, Acta Anat 23:127–142 [recalled]. Motor units (H).
- Frijns CJM et al. 1997, Clin Neurol Neurosurg 99:31–36. Tendon-reflex latency correlates (H).
- Henneman E 1957, Science 126:1345–1347 [recalled]. Size principle (C).
- Hodes R, Dement WC 1964, Electroencephalogr Clin Neurophysiol 17:617–629 [recalled]. H-reflex in REM sleep (H).
- Jonas JB et al. 1992, Invest Ophthalmol Vis Sci 33:2012–2018 [recalled]. Optic nerve fibres (H).
- Kimura J 1973 [recalled]. Blink-reflex norms (H).
- Lang PJ, Bradley MM, Cuthbert BN 1990, Psychol Rev 97:377–395 [recalled]. Affective startle modulation (H).
- Lassek AM, Rasmussen GL 1939, Arch Neurol Psychiatry 42:872–876 [recalled]. Pyramidal fibre count (H).
- Lassek AM 1940, Arch Neurol Psychiatry 44:718–724 [unverified]. Betz cells (H).
- Lee RG, Tatton WG 1975, Can J Neurol Sci 2:285–293 [recalled]. Long-latency stretch reflexes (H).
- Lemon RN 2008, Annu Rev Neurosci 31:195–218 [recalled]. Descending pathways across species.
- Matthews PBC 1991, Trends Neurosci 14:87–91 [recalled]. Transcortical stretch reflex (H).
- Minassian K et al. 2004, Spinal Cord 42:401–416. Epidural-stimulation stepping (H).
- Nathan PW, Smith MC, Deacon P 1990, Brain 113:303–324 [recalled]. Human corticospinal tracts (H).
- Rexed B 1952, J Comp Neurol 96:415–495 [recalled]. Cord laminae (C).
- Rossini PM et al. 2015, Clin Neurophysiol 126:1071–1107 [unverified]. TMS and CMCT (H).
- Sandrini G et al. 2005, Prog Neurobiol 77:353–395 [recalled]. Lower-limb flexion reflex (H).
- Spoendlin H, Schrott A 1989, Hear Res 43:25–38 [recalled]. Auditory nerve fibres (H).
- Willer JC 1977, Pain 3:69–80. RIII and the pain threshold (H).
- Zajac FE 1989, Crit Rev Biomed Eng 17:359–411 [recalled]. Muscle activation dynamics.

Textbooks and standards [T]:

- Kandel et al., Principles of Neural Science.
- Gray's Anatomy.
- ISNCSCI (ASIA/ISCoS).
- Clinical neurophysiology and audiology texts: tendon, H, blink and acoustic-reflex norms; denervation; CMCT.

Raw captures [G], folder `brain-system/raw/`:

- Spinal_cord (L74, L76); Spinal_nerve (L33, L43, L51, L63, L73, L77); Dermatome_anatomy (L61–L87).
- Corticospinal_tract (L30, L36, L38, L40, L48).
- Startle_response (L33, L39, L43, L45, L47).
- Neuromuscular_junction (L45, L46, L48).
- Stretch_reflex (L44, L47–L49, L69–L75, L77); Reflex_arc (L51, L54); Withdrawal_reflex (L31).
- Phrenic_nerve (L26, L36, L46, L60, L75); Brachial_plexus (L39, L51–L55, L69–L71, L96, L97, L101, L102); Lumbar_plexus (L26, L56, L59–L61); Sacral_plexus (L26, L62, L70, L71, L74, L78); Sciatic_nerve (L41, L46); Pudendal_nerve (L64, L72, L80, L82).
- Spinal_cord_injury (L35, L39, L57, L73, L74, L76); Spinothalamic_tract (L69); Dorsal_column_E2_80_93medial_lemniscus_pa (L48).
- Central_pattern_generator (L39, L53, L55); Cranial_nerves (L40, L42, L52); Vagus_nerve (L42); Sensory_neuron (L61).

Model checks, not sources: `C:\Users\User\AppData\Local\Temp\claude\C--Users-User-projects-galaxy\641a402d-336b-4b93-bc5d-2e26265edfd2\scratchpad\research-somatic-motor\checks-s6.mjs`. Graph path and explain outputs are in the same folder (`paths1.out`, `paths2.out`). Code references: `src/anatomy.js` L321–L324 (`BRAINSTEM`) and `src/brain.js` L240 (`spinal` region).

---

## 7. Autonomic nervous system

### 7.1. Definition, scope and ownership

The autonomic nervous system (ANS) here is the extrinsic visceral motor outflow (sympathetic thoracolumbar, parasympathetic craniosacral), its ganglia and postganglionic fibres, the bulbospinal premotor axons, and all general visceral afferents, including the arterial baro- and chemoreceptor afferents of cranial nerves IX and X (A.3.1; A.8 decisions 6, 7) [G Autonomic_nervous_system L33, L51]. The enteric nervous system is a separate network (§8), although classical texts count it as a third division [G Sympathetic_nervous_system L34]. Central autonomic nuclei are `cns`: always simulated, described here only as drivers of the outflow (§7.4); their coordinates, neuron counts and firing rates are §3's.

This section owns the cardiovascular, respiratory-control, pupillary, sudomotor, thermoregulatory and other visceral effector models, the autonomic reflexes, the five autonomic interventions of A.5, the autonomic rule for spinal cord injury (the preset is §6) and the autonomic validation targets. Owned elsewhere: body coordinates (§2), conduction velocities (§4), sensation thresholds (§5), shivering and phrenic output (§6), gut (§8), catecholamines, AVP, RAAS (§9), fever and inflammatory reflex (§10), switches (§11), scenario inputs (§12), display (§13).

### 7.2. Anatomy of the outflow and the visceral afferents

Every efferent pathway except the adrenal medulla has two neurons: a preganglionic neuron in the CNS (thinly myelinated B fibre) and a postganglionic neuron in a ganglion (unmyelinated `Cpost`) [G Autonomic_nervous_system L51; G Group_C_nerve_fiber L27]. Sympathetic preganglionic neurons lie in the intermediolateral column, `cord.T1.iml`–`cord.L2.iml` (some sources to L3) [G Sympathetic_nervous_system L42, L54]; their axons synapse in the paravertebral chain at, above or below their level, or pass through it to a prevertebral ganglion [G Sympathetic_nervous_system L60]. Chromaffin cells of the adrenal medulla act as the postganglionic element and secrete mainly adrenaline into the blood [G Sympathetic_nervous_system L47, L64]. Columns are placed by segment, not vertebra (§2).

| Division | CNS origin | Ganglion route (node ids) | Main targets | Source |
|---|---|---|---|---|
| Sympathetic, head | `cord.T1–T2.iml` (ciliospinal centre, classically C8–T2) | chain → `scg` → carotid plexus | `pupilDilator`, eyelid smooth muscle, facial `skinVessels`, `sweatForehead` | [G Sympathetic_nervous_system L68]; [T] |
| Sympathetic, heart | `cord.T1–T4.iml` | `scg`, `mcg`, `stellate`, `chain.T1–T4` → `cardiacPlexus` | `saNode`, `avNode`, `ventricles` | [G Heart_rate L70] |
| Sympathetic, limbs and body wall | `cord.T1–L2.iml` | chain at all levels to `chain.S4` and `impar`; grey rami to every spinal nerve | `muscleVessels`, `skinVessels`, sweat glands, arrector pili, `bat` | [G Sympathetic_trunk L33–L39]; [G Autonomic_nervous_system L59–L63] |
| Sympathetic, abdomen | T5–T9 `splanchnicGreater`, T10–T11 `splanchnicLesser`, T12 `splanchnicLeast`, L1–L2 `splanchnicLumbar` | through the chain → `coeliac`, `aorticorenal`, `smg`, `img` | `splanchnicVessels`, gut wall (§8), `kidney`, `spleen` | [G Sympathetic_trunk L57–L60]; [G Autonomic_nervous_system L65, L71–L72] |
| Sympathoadrenal | `cord.T5–T11.iml` (model segments; textbook range T5–L1, with a minor T12–L1 tail not modelled) | `splanchnicGreater` through `coeliac`, no synapse | `adrenalMedulla` | [G Autonomic_nervous_system L66]; segments [T]; this row owns the adrenal preganglionic segments (§2.12 references it) |
| Sympathetic, pelvis (schematic) | `cord.T10–L2.iml` | `splanchnicLumbar` → `img` → `supHypogastric` → `infHypogastric` | `bladder` (storage), `rectum` | [G Autonomic_nervous_system L72–L73]; [T] |
| Parasympathetic III | `ew` | `cn3.para` → `ciliaryGang` → short ciliary nerves | `pupilSphincter`, ciliary muscle | [G Parasympathetic_nervous_system L59] |
| Parasympathetic VII | `ssn` | `cn7.para` → `pterygopalatineGang`; `submandibularGang` | `lacrimal`, nasal glands; `submandibularGland`, `sublingual` | [G Parasympathetic_nervous_system L61]; ganglia [T] |
| Parasympathetic IX | `isn` | `cn9.para` → `oticGang` | `parotid` | [G Parasympathetic_nervous_system L51]; [T] |
| Parasympathetic X | `nAmbVagal` (cardiac, primary), `dmv` (viscera; minor cardiac share, A.8 #17) | `cn10.para` → ganglia on or in the organs | `saNode`, `avNode`, `airways`, gut to the Cannon–Böhm point (§2) | [G Vagus_nerve L44, L80–L81]; [G Parasympathetic_nervous_system L52] |
| Parasympathetic, sacral (schematic) | `cord.S2–S4.spn` | `splanchnicPelvic` → `infHypogastric`, intramural ganglia | `bladder` (voiding), `rectum`, colon distal to the Cannon–Böhm point | [G Pelvic_splanchnic_nerves L33, L41]; [G Parasympathetic_nervous_system L53] |

Visceral afferents (`ans.vaff`) run with both divisions. The vagus is 80–90 % afferent (nodose and jugular ganglia) [G Vagus_nerve L44, L48]; human fibre counts are disputed [G Vagus_nerve L42]. Carotid sinus baroreceptor axons run in IX (`carotidSinusNerve`) and aortic arch axons in X (`nodoseGang`), both ending on glutamatergic NTS neurons (`ntsVisc`) [G Baroreflex L35]; carotid-body chemoreceptors share the IX route; lung stretch and upper-gut afferents use X (§8). Spinal visceral afferents follow the splanchnic and pelvic splanchnic nerves to the dorsal horn and ascend via `portSpinoVisc` (§5) [G Autonomic_nervous_system L75; G Pelvic_splanchnic_nerves L33]. Velocities are §4's (A.9: visceral afferent C 1.0 m/s, A-fibre baroreceptor 15 m/s).

### 7.3. Transmitters and receptors

| Synapse | Transmitter → receptor | Effect used | Source |
|---|---|---|---|
| All ganglia; chromaffin cells | ACh → nicotinic (α3β4) | fast relay | [G Sympathetic_nervous_system L44]; subtype [T] |
| Vagal → SA, AV nodes | ACh → M2 (GIRK, ↓ cAMP) | heart period ↑ within a beat | [G Heart_rate L76]; [T] |
| Parasympathetic → smooth muscle, glands | ACh (+ VIP, NO) → M3 | sphincter pupillae, saliva, tears, bronchoconstriction, detrusor; gut via ENS (§8) | [G Autonomic_nervous_system L41]; [T] |
| Sympathetic → heart | NE → β1 (cAMP) | rate, conduction, contractility | [G Heart_rate L55, L70] |
| Sympathetic → arterioles, veins, dilator, arrector pili, bladder neck, sphincters | NE (+ NPY, ATP) → α1 | constriction | [T] |
| Sympathetic presynaptic, gut | NE → α2 | inhibits enteric cholinergic transmission | [T] |
| Sympathetic → kidney | NE → β1 | renin (§9) | [T] |
| Plasma adrenaline (§9) | → β2, β1 | bronchodilation, muscle vasodilation, chronotropy | Barnes 1986; [T] |
| Sympathetic → BAT; detrusor | NE → β (human BAT subtype debated); β3 | thermogenesis; storage | [T] |
| Sudomotor, all sites incl. palms and soles | ACh → M3 | sweating, skin conductance | [T]; corrects [G Sympathetic_nervous_system L46] (§1) |
| Renal postganglionic | DA → D1 | not modelled | [G Sympathetic_nervous_system L48] |

M2 signalling is membrane-delimited and ACh is hydrolysed quickly. β1 acts through cAMP, and NE is cleared slowly by reuptake. This gives the tenfold speed difference between vagal and sympathetic heart-rate control (§7.5).

### 7.4. Central autonomic network

The ANS is driven by integrated brainstem reflexes under hypothalamic and limbic control, the hypothalamus acting as integrator [G Autonomic_nervous_system L36] (Benarroch 1993; Dampney 1994; Guyenet 2006). All nodes are §3's; this table gives only their autonomic role and their outputs to the §7.6 channels.

| Node id | Role | Outputs | Source |
|---|---|---|---|
| `ntsVisc` | first relay of baro-, chemo-, lung and gut afferents | `cvlm` (+), `nAmbVagal` (+), `dmv` (+), `pbn`, `pvn`, respiratory groups | [G Baroreflex L35–L39]; [G Respiratory_center L42] |
| `cvlm` | baroreflex GABAergic interneurons | `rvlm` (−) | [G Baroreflex L37] |
| `rvlm` | tonic sympathetic vasomotor and cardiac premotor drive | `fSymCard`, `fSymMus`, `fSymSpl`, `fSymAdr`, `fSymGut` via bulbospinal axons | [G Baroreflex L37]; Guyenet 2006 |
| `nAmbVagal`, `dmv` | cardiac and visceral vagal preganglionic neurons | `fVagCard` (mainly `nAmbVagal`), `fVagGut` (`dmv`) | [G Vagus_nerve L80–L81]; [G Baroreflex L39] |
| `mpoa`, `mnpo` | warm-sensitive set-point integration (shifted by §10) | tonic inhibition of `dmh`, `rpa`; sudomotor drive | Morrison & Nakamura 2019 (R); [G Medial_preoptic_nucleus L41] |
| `dmh` → `rpa` (+ `rob`) | stress tachycardia; cold defence premotor | `fSymSkin`, `fSymBat`, cardiac sympathetic co-activation | Morrison & Nakamura 2019 (R); [G Raphe_nuclei L83] |
| `pvn` (preautonomic) | output to IML, `rvlm`, `dmv`, `ntsVisc`; neuroendocrine part §9 | `fSymAdr`, `rvlm` offset | [G Paraventricular_nucleus_of_hypothalamus L46, L71, L80] |
| `cea`, `bnst` | threat responses | `pag`, `rvlm`, `lc`, `nAmbVagal` (−) | [G Fight-or-flight_response L57]; [T] |
| `pag` | active and passive defence columns; micturition gating | `rvlm`, `barrington` | Benarroch 1993 |
| `pbn` | visceral and thermal relay; inspiratory off-switch | `cea`, `dmh`, `mnpo`, `thalVMpo` | [G Respiratory_center L58]; [T] |
| `lc` | arousal | `fEw` (−), `fSymPup`, arousal offsets on sympathetic channels | [G Locus_coeruleus L54]; Joshi et al. 2016 (Mk) |
| `opn` | light-reflex relay | both `ew` | [G Pupillary_light_reflex L40, L57] |
| `ssn`, `isn` | salivatory and lacrimal preganglionic neurons | `fSal` | [G Parasympathetic_nervous_system L61] |
| `barrington` | pontine micturition switch | `fSacral`; inhibits `onuf` (§6) | Fowler et al. 2008 |
| `insPost` → `insAnt`; `sgacc`, `pgacc`, `dacc`, `mpfc` | interoceptive cortex; cortical autonomic control | `cea`, `lh`, `dmh`, `pag`, `nAmbVagal` | Craig 2002; [G Insular_cortex L40] |
| `preBotC`, `rtn` | respiratory rhythm; central CO₂ sensing (§7.9) | `respPhase`, RSA gating, phrenic output (§6) | Smith et al. 1991 (R); Schwarzacher et al. 2011 |

The graph confirms three chains: the baroreflex (Baroreceptor → Solitary nucleus → CVLM → RVLM → Intermediolateral nucleus), the light reflex (Pretectal Nucleus → Edinger-Westphal Nucleus → Ciliary Ganglion), and the pelvic splanchnic → inferior hypogastric edge. The salivatory, micturition and thermoregulatory routes rest on the cited literature.

### 7.5. Resting state, heart rate and haemodynamics

Without nervous input the SA node fires near 100 bpm (IHR, 101 at 30 y in the table below). Resting HR is lower because vagal tone predominates. Vagal withdrawal alone (atropine) gives ≈ 110 bpm, above the intrinsic rate, because resting sympathetic tone is still present (101 × (1 + 0.851 × 0.105) = 110, the §7.11 atropine row); higher rates need added sympathetic or circulating catecholamine drive [G Heart_rate L68, L76]. The model uses a multiplicative law (Rosenblueth & Simeone 1934, D), which reproduces accentuated antagonism (Levy 1971, D):

`hr = IHR(age) · f_T(tCore) · (1 + k_s · s̃) / (1 + k_v · ṽ)`, `hp = 60 / hr`.

- ṽ is `tone.vagCard` after its dead time and first-order lag.
- s̃ is `tone.symCard` after its dead time and an asymmetric lag (τ_on rising, τ_off falling), plus the β1 action of plasma adrenaline: s̃_eff = s̃ + k_adr · (adrenaline/adrenaline_basal − 1) · g.neuroendocrine (§9 basal; §11.13). The receptor effect of a blood-borne hormone carries only its own network (§11.3 rule 3): a denervated target still responds to circulating adrenaline, and is in fact hypersensitive to it. `g.autonomic` gates the **release** edge instead (§9.6, §11.11), so switching the autonomic network off still removes the adrenaline response, but over the pool's own decay (t½ ≈ 2.5 min) rather than within the 1 s gain ramp.
- f_T = 1 + k_T · (tCore − 37) is the SA-node temperature factor. §10.6 owns k_T; the whole-body fever-tachycardia slope is a §10.9 check, not a driver. With autonomic off f_T acts on IHR alone (A.5), so HR still rises with core temperature.
- The haemodynamic channels map to tones as s̃_R = mean(`tone.symMus`, `tone.symSpl`), s̃_ven = `tone.symSpl` and s̃_c = `tone.symCard`, each after its own dead time and lag (table below).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Resting `hr`, supine | 68 | bpm | H | high | `response.js` L360; A.8 #12; normal 60–100 [G Heart_rate L23] |
| Resting `sbp`/`dbp`; `map`; `pp` | 115/75; 88; 40 | mmHg | H | high | `response.js` L362–L363; A.8 #12 |
| `co`; `sv`; `tpr` | 5.0; 73.5; 17.6 (≈ 1,408 dyn·s·cm⁻⁵) | L/min; mL; mmHg·min/L | H | medium | [T]; derived |
| IHR(age) | 118.1 − 0.57 · age (101.0 at 30 y; 83.9 at 60 y) | bpm | H | medium | Jose & Collison 1970 [secondary]; ≈ 100 [G Heart_rate L76]; A.8 #11 |
| IHR, sex-specific | M 118 − 0.55 · age; F 119 − 0.61 · age | bpm | H | low | Jose & Collison 1970 [secondary][unverified] |
| HRmax(age) | 208 − 0.7 · age (187 at 30 y) | bpm | H | high | Tanaka et al. 2001 |
| HR after atropine | ≈ 110 (model 108) | bpm | H | medium | [T]; model check |
| Vagal dead time / τ | 0.3 / 0.5 | s | D, H | medium | A.8 #14; Warner & Cox 1962 (D); Levy 1971 (D) |
| Sympathetic dead time / τ_on / τ_off | 2.0 / 4 / 10 | s | D | medium | A.8 #14 [model]; Warner & Cox 1962 (D) |
| k_v / k_s | 2.0 / 0.851 | — | — | low | [model]: atropine 110; HRmax at full sympathetic tone |
| k_adr (β1 action of plasma adrenaline on s̃) | 0.05 per unit of the adrenaline ratio to basal | — | — | low | [model] |
| Resting `tone.vagCard` / `tone.symCard` | 0.309 / 0.105 | — | — | low | [model] |
| Contractility, resistance, venous unstressed volume: dead time / τ | 2 / 8; 2 / 6; 5 / 20 | s | D | low | Ursino 1998 [recalled] |
| Splanchnic share of blood volume | ≈ 20–25 | % | H | medium | [T] |

Haemodynamics are a steady-state one-compartment model on `CV` [model]:
- `co = 5.0 · (hr/68)^0.25 · P_post · (1 + 0.5 · (s̃_ven − 0.10)) · contractility^0.5`, with `contractility = 1 + (s̃_c − 0.105)`. `P_post` is the posture preload factor (§7.8). The HR exponent is small because venous return, not pacing, sets output [T].
- Conductance `G = 0.40 · G0 + 0.60 · G0 · 1.3 / (1 + 3 · s̃_R)`, G0 = 1/17.6. The 40 % share (brain, coronary, part of kidney) is treated as non-neural. `map = co / G`; `pp = 40 · sv / 73.5`; `sbp = map + 2pp/3`; `dbp = map − pp/3`.

Model check (scratch, not a source):
- Rest is a fixed point at 68 bpm and 115/75.
- Atropine gives 108 bpm.
- Removing all autonomic tone gives HR 101 and ≈ 92/65 (MAP 74, −14 mmHg), before RAAS (§9) partly restores BP over minutes.

### 7.6. Efferent channels

Each channel is a rate with `tone = f / f_max` (A.3.4). Tone is computed on `CV` as a clamped sum of three terms: resting tone, the baroreflex term (§7.8), and offsets from the §7.4 nodes (chemoreflex, thermal, arousal, stress). The offsets are weighted to meet §7.13.

| Channel | Route (node ids) | Baro gain G | Rest tone | Other drives |
|---|---|---|---|---|
| `fSymCard` | `rvlm` → `cord.T1–T4.iml` → `stellate`/`mcg`/chain → `saNode`, `avNode`, `ventricles` | 0.50 | 0.105 | `dmh`, `lc`, `pag`, central command (§6) |
| `fVagCard` | `nAmbVagal` (+ `dmv`) → `cn10.para` → `cardiacPlexus` → `saNode`, `avNode` | 0.58 (+) | 0.309 | RSA gating; `cea` (−); diving (+); central command (−) |
| `fSymMus` | `rvlm` → `cord.T1–L2.iml` → chain → `muscleVessels` | 0.50 | 0.10 | chemoreflex (+); low-pressure unloading (+) |
| `fSymSpl` | `rvlm` → `cord.T5–L2.iml` → splanchnics → prevertebral ganglia → `splanchnicVessels`, veins, `kidney` | 0.50 | 0.10 | postprandial (§8), stress |
| `fSymSkin` | `rpa` (+ `rvlm`) → IML → chain → `skinVessels` | 0.10 | 0.15 | thermal (dominant), fear, startle |
| `fSudo.<site>` (`palm`, `sole`, `forehead`, `axilla`) | thermal (`mpoa`) or emotional (`cea`, `dacc`, `insAnt`) → IML → chain → sweat glands | 0 | 0.05 | palms, soles arousal-dominated; forehead, axilla thermal and arousal |
| `fSymAdr` | `pvn`, `rvlm` → `cord.T5–T11.iml` → `splanchnicGreater` → `adrenalMedulla` | 0.20 | 0.05 | stress, exercise; output to §9 (`autonomic ∧ neuroendocrine`) |
| `fSymBat` | `dmh` → `rpa` → `cord.T1–T6.iml` → chain → `bat` | 0 | 0.02 | cold, fever chill (§10) |
| `fSymPup` | `lh`, `pvn` → `cord.T1–T2.iml` → `scg` → `pupilDilator` | 0 | 0.10 | darkness, `lc`, pain |
| `fSymGut` | `rvlm`, `pvn` → `cord.T5–L2.iml` → splanchnic, hypogastric → gut wall, sphincters, bladder neck | 0.20 | 0.10 | stress, pain; enteric targets also need `enteric` |
| `fVagGut` | `dmv` → `cn10.para` → gut-wall ganglia | 0 | 0.20 | cephalic phase, accommodation (§8); `autonomic ∧ enteric` |
| `fEw` | `opn` → `ew` → `cn3.para` → `ciliaryGang` → `pupilSphincter` | 0 | 0.371 | light (bilateral), near response, `lc` (−), sleep (+) |
| `fSal` | `ssn`, `isn` → `cn7.para`, `cn9.para` → salivary ganglia → glands; pterygopalatine stream → `lacrimal` | 0 | 0.10 | taste, smell, sight of food, chewing |
| `fSacral` | `barrington` → `cord.S2–S4.spn` → `splanchnicPelvic` → `infHypogastric` → `bladder`, `rectum` | 0 | 0.02 | micturition switch; orgasm adapter (§11) |

MSNA is emitted as bursts gated by the cardiac cycle. A burst follows a diastolic pressure fall with a probability that rises with `tone.symMus` and falls with baroreceptor drive [T]. Bursts are timed by the seeded `CV` generator (§7.14).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| `f_max`, all channels | 10 | spikes/s | — | low | [model] display scale |
| Single vasoconstrictor unit at rest | ≈ 0.5 | spikes/s | H | low | Macefield et al. 1994 [recalled] |
| MSNA burst incidence, young adult | ≈ 20–40 per 100 heartbeats (rises with age) | bursts | H | low | [T] |
| Stress offset onto `fSymAdr` (§7.4 offsets) | 0.185 | tone per unit `u_stress` | — | low | [model] stage-4 calibration, src/sim/autonomic.js (`stress.symAdr`). With the endocrine module `tone.symAdr`/rest then peaks near ×4.1 (§9.4 drive), so the adrenaline pool reproduces the §9.10 and §12.11 input profile (×4.12 at 14 min, ≈ 181 pg/mL from 44): a model target and a high-end stressor excursion. The SAM channel is gated by `autonomic ∧ neuroendocrine` |

Latency budget. Each dead time is split into two parts: conduction (packets on `EV` at §4 velocities over §2 lengths) and a local residue. A packet therefore arrives when its effect starts [model split]:

| Pathway | Conduction | Residue | Total |
|---|---|---|---|
| Vagal → SA node | `nAmbVagal` → SA node 289 mm (§2.14): 279 mm B 8 m/s + 10 mm `Cpost` 1.0 m/s plus the ganglion synapse ≈ 45 ms (§4.11) | ≈ 0.255 s (relay, M2–GIRK) | 0.3 s (§7.5) |
| Sympathetic → SA node | bulbospinal 131 mm at 3 m/s ≈ 44 ms; preganglionic 71 mm at 8 m/s ≈ 9 ms; stellate → SA node 175 mm at 1.0 m/s ≈ 0.175 s (§2.14; §4.11) | ≈ 1.77 s (β1–cAMP) | 2.0 s (§7.5) |
| Light reflex | retina → `opn` → `ew` → `ciliaryGang` → `pupilSphincter`, 105 + 8 + 78 + 35 mm (§2.14), ≈ 60 ms with synapses (§4.11) | ≈ 0.16 s: retinal transduction 25 ms + sphincter dead time 135 ms [model] | 0.22 s (§7.7) |
| Skin response, palm / sole | central ≈ 0.25 s; bulbospinal ≈ 0.07 / 0.14 s; postganglionic ≈ 0.9 / 1.2 m at 1.0 m/s | gland ≈ 0.2 s | ≈ 1.4 / 1.8 s (targets §7.7) |

### 7.7. Other autonomic effectors

Pupil. Diameter varies between 1.5 and 8 mm. The parasympathetic sphincter constricts and the sympathetic dilator dilates [G Pupillary_response L23–L27]. Each eye is computed separately:

`pupilD = clamp(5.0 + 3.0 · tone.symPup − 3.5 · tone.ew_eff + ΔD_ar, 1.5, 8)` mm [model]

- 5.0 mm is the denervated diameter (A.9).
- `tone.ew_eff` is `tone.ew` after the light-reflex dead time and the sphincter lag.
- Light drive is equal for both eyes (direct = consensual) [G Pupillary_light_reflex L40]: `e_L = 1/(1 + exp(−(log₁₀ L − 2.63)/1.2))` for retinal luminance L in cd/m² [model], minus `lc` inhibition.
- ΔD_ar convolves `lcPhasic` and `salience` (§3) with the unit-peak kernel h(t) = tⁿ · e^(−n·t/t_max). Pupil size tracks LC activity [G Pupillary_response L31] (Joshi et al. 2016, Mk).
- Latency rises with age [G Pupillary_response L35].

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Pupil range | 1.5–8 | mm | H | high | [G Pupillary_response L23] |
| Baseline `pupilD`, room light (≈ 100 cd/m²) | 4.0 | mm | H | medium | A.9; [T] |
| Denervated pupil (autonomic off), fixed | 5.0 | mm | — | low | A.9; [T] |
| Model steady pupil at 1,000 cd/m² | ≈ 3.3 | mm | — | low | [model] |
| Light-reflex latency at ≈ 1,000 cd/m² (shorter when brighter) | 0.22 (0.18–0.30) | s | H | medium | Ellis 1981; absolute value [T] |
| Inter-eye latency difference | 8–35 | ms | H | medium | Bergamin & Kardon 2003 |
| Constriction τ; redilation τ parasympathetic / sympathetic | ≈ 0.25; ≈ 1.5 / ≈ 5–15 | s | H | low | [T]; slow part gives the Horner dilation lag |
| Arousal kernel n / t_max | 10.1 / 0.93 | — / s | H | high | Hoeks & Levelt 1993 |

Skin conductance and sweat. Sudomotor fibres are cholinergic (§7.3). `scl` is a slow integral of sudomotor drive. Each burst adds a phasic `scr` of Bateman shape A·(e^(−t/3.0) − e^(−t/0.75)) [model], peaking ≈ 1.4 s after gland activation. Non-specific SCRs are seeded Poisson events scaled by `tone.fSudo.palm`.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| SCR latency / rise / half-recovery | 1–3 / 1–3 / 2–10 | s | H | medium | Dawson et al. 2007 |
| `scl` range; model baseline | 2–20; 5 | µS | H | medium; low | Dawson et al. 2007; [model] |
| SCR amplitude; non-specific SCR rate | 0.1–1.0 µS; 1–3 per min | — | H | low | Dawson et al. 2007 [recalled] |
| Skin response latency palm / sole | 1.3–1.5 / 1.8–2.1 | s | H | low | Shahani et al. 1984 [recalled]; 1.33 / 1.85 in one cohort [secondary] |
| Maximal whole-body `sweat` (acclimatised ≈ 3) | 1–2 | L/h | H | medium | [T] |
| `sbf`, thermoneutral → severe heat | ≈ 0.25 → 6–8 | L/min | H | medium | Rowell 1974 |

Skin blood flow is set by noradrenergic vasoconstriction and by active vasodilation through cholinergic co-transmission in sudomotor nerves [T]. Thermal control is in §7.10; dimming limits are in §13.

Salivary and lacrimal glands. Watery saliva is parasympathetic (M3). Sympathetic input adds protein and does not reduce flow in the model [T]. Tears follow the pterygopalatine stream of `fSal`.

Bladder. Storage is sympathetic (β3 detrusor, α1 bladder neck) plus somatic (`onuf`, §6). Voiding is sacral parasympathetic (M3), switched by `barrington` under `pag` and prefrontal gating (Fowler et al. 2008). `bladderVol` fills at the urine rate; sensation thresholds are §5's. Voiding is an `fSacral` pulse train with a volume reset on the schematic bladder (A.1).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Saliva, unstimulated / stimulated (max) | 0.3–0.4 / 1.5–2 (≈ 7) | mL/min | H | medium | Humphrey & Williamson 2001 |
| Basal tear secretion | ≈ 1–2 | µL/min | H | low | [T] |
| Bladder capacity | 400–600 | mL | H | medium | Fowler et al. 2008 |
| Urine production at rest | ≈ 1 | mL/min | H | low | [T] |

Airways. Tonic vagal M3 bronchoconstriction dominates. Direct sympathetic innervation of human airway smooth muscle is sparse, so bronchodilation under stress comes from adrenaline on β2 receptors (§9) (Barnes 1986). A display-only airway-resistance index is `1 + 0.3 · (tone.vagCard − 0.309) − 0.2 · adrenaline effect` [model].

BAT and piloerection. Adults have cold-activatable BAT in supraclavicular and paravertebral depots (Cypess et al. 2009; van Marken Lichtenbelt et al. 2009; Virtanen et al. 2009). `bat` follows `fSymBat` with τ ≈ 5 min [model]. Piloerection (α1) accompanies cold and strong emotion over seconds (Benedek & Kaernbach 2011); it is a display flag only.

### 7.8. Reflexes

Arterial baroreflex. Carotid sinus (IX) and aortic arch (X) baroreceptors excite the NTS. The NTS excites the CVLM, which inhibits the RVLM; in parallel the NTS excites `nAmbVagal` and `dmv`. A pressure rise therefore withdraws sympathetic and raises vagal outflow. The reflex is tonic at rest and acts within a cardiac cycle [G Baroreflex L27–L43] (Guyenet 2006). Routes:
- `carotidSinus` → `carotidSinusNerve` → `ntsVisc` → `cvlm` → `rvlm` → IML → `stellate`/chain → `saNode`, vessels.
- `ntsVisc` → `nAmbVagal` → `cn10.para` → `saNode`.

Model:
- `b = w_cs · σ((P_cs − P50)/k_b) + (1 − w_cs) · σ((P_ao − P50)/k_b)`, where σ is the logistic function.
- `P_cs` = MAP − upright hydrostatic offset + carotid `baroStep`; `P_ao` = MAP + aortic `baroStep`.
- `tone.vagCard = 0.309 + 0.58 · (b − 0.5)`; `tone.sym<X> = s0 − G · (b − 0.5)` (G in §7.6).
- Ursino's (1998) lead–lag rate filter is optional and off, because the targets were met without it.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| P50 (= resting MAP); k_b (10–90 % span ≈ 44 mmHg) | 88; 10 | mmHg | — | low | [model]; single-receptor threshold ≈ 50–60, saturation ≈ 160–180 [T] |
| Carotid weight w_cs | 0.30 | — | — | low | [model] |
| Heart–carotid hydrostatic offset upright | ≈ 17.9 (232 mm × 0.0772 mmHg/mm) | mmHg | — | medium | §2 anchors; ρg of blood [T] |
| Whole-body cardiac BRS, supine / standing (range 0–40) | 15.7 / ≈ 7 | ms/mmHg | H | low | Laude et al. 2004 via Heusser et al. 2021 [secondary] |
| Carotid-only maximal gain, HR / MAP | ≈ −0.3 / ≈ −0.2 to −0.3 | bpm/mmHg; mmHg/mmHg | H | low | Potts et al. 1993 [unverified] |
| Model: vagal BRS; carotid ±5 mmHg peak ΔHR / ΔMAP | 15.8 ms/mmHg; −0.27 / −0.22 | — | — | low | model check |
| Baroreceptor afferent display scale | 2.5–48 | spikes/s | D | low | Ursino 1998 [recalled] |
| SCI spinal tone ρ below a complete lesion (fraction of rest tone) by §6.15 phase 1 / 2 / 3 / 4: cardiac, muscle, splanchnic and the other channels; skin channels (vasoconstrictor, sudomotor) | 0.02 / 0.05 / 0.10 / 0.15; 0.04 / 0.10 / 0.20 / 0.30 | — | — | low | [model] stage-4 calibration, src/sim/autonomic.js (`spinalRest`), revised at stage 6 from 0.1 / 0.2 / 0.4 / 0.5 for every channel. ρ is the spinal and intrinsic vascular-tone fraction, not resting sympathetic firing (low or absent below a complete lesion on microneurography); the phase windows are borrowed from Ditunno et al. 2004 for timing only (SCI rule below) |

Cardiopulmonary reflexes. Atrial stretch raises HR (Bainbridge) [G Heart_rate L86]. Unloading of low-pressure receptors constricts forearm vessels without HR change (Zoller et al. 1972 [recalled]). This is modelled as an `fSymMus` term proportional to the fall of `P_post` (not in the model check). Bezold–Jarisch is not modelled.

Orthostatic response. Standing displaces 500–1,000 mL of blood below the heart (Smit et al. 1999). BP reaches its nadir at 7–10 s and recovers within 20–30 s. HR peaks early (≈ 3 s) and again at ≈ 12 s, then settles above the supine value (Borst et al. 1982; Wieling et al. 2007). Model [model]:
- `P_post` falls 23 % (τ 7 s).
- The carotid hydrostatic offset ramps in over 3 s.
- Leg-muscle contraction adds two transients: a central-command vagal withdrawal (alpha function, peak 1.5 s, 0.06 tone) and a muscle vasodilation that multiplies the total conductance G by (1 + 0.40·α(t)), α a unit-peak alpha function peaking at 10 s. Applying the 40 % to the neural share only would give a smaller, earlier HR peak (+28 at 6.4 s); the model check uses total G.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| HR peaks after active standing, early / main | ≈ 3 / ≈ 12 | s | H | medium | Borst et al. 1982 (12 s); early peak [recalled] |
| BP nadir | ≈ 7–10 | s | H | medium | Wieling et al. 2007 |
| Steady standing ΔHR / ΔDBP / ΔSBP | +10–15 / +5–10 / 0 to −10 | bpm; mmHg | H | medium | [T] |
| Initial orthostatic hypotension | fall > 40 SBP or > 20 DBP within 15 s | mmHg | H | high | Wieling et al. 2007 |
| OH criterion | sustained fall ≥ 20 SBP or ≥ 10 DBP within 3 min | mmHg | H | high | Freeman et al. 2011 |
| Neurogenic OH signature | ΔHR/ΔSBP < 0.5 | bpm/mmHg | H | high | Norcliffe-Kaufmann et al. 2018 |
| POTS | ΔHR ≥ 30 within 10 min, no OH | bpm | H | high | Freeman et al. 2011 |
| Model, intact | 99 bpm at 4 s; peak 104 at 10 s; SBP nadir 89 at 7.5 s; 3 min: 82 bpm, 104/76 | — | — | low | model check |
| Model, autonomic off | HR 101 fixed; SBP 92 → 58 at ≈ 14 s → 71 at 3 min | — | — | low | model check |

Valsalva (optional, §12). The four phases:
- Phase I: mechanical BP rise.
- Phase II: BP fall, then late recovery by vasoconstriction, with tachycardia.
- Phase III: brief fall on release.
- Phase IV: overshoot with baroreflex bradycardia.

With autonomic off there is no late phase II recovery and no overshoot. The Valsalva ratio (max phase II HR / min phase IV HR) is ≥ 1.21 under 40 y (V16).

Pupillary light reflex. Route: ipRGCs and other ganglion cells → optic nerve → `opn` → both `ew` → `cn3.para` → `ciliaryGang` → short ciliary nerves → `pupilSphincter` [G Pupillary_light_reflex L40, L56–L59]. Values are in §7.7. The edge is `special ∧ autonomic` (A.5).

Diving response (`coldFace`). Cold water on the face (trigeminal `spV`) plus apnoea gives vagal bradycardia and peripheral vasoconstriction. Apnoea from immersion is needed, and lung inflation suppresses the bradycardia. HR falls by 15–40 % (V15; Gooden 1994). Model: exponential approach to −32 %, τ 13 s [model], giving ≈ −20 % at 15 s and ≈ −30 % at 30 s.

Respiratory sinus arrhythmia. Inspiration gates cardiac vagal output. RSA is 5–15 bpm peak-to-trough in young adults (V13), largest near 6 breaths/min and absent without the vagus (Eckberg 1983). Model: `tone.vagCard · (1 − 0.25 · (vt/0.5) · sin 2π·respPhase)` [model]. The model check gives 9.4 bpm at 14 breaths/min (VT 0.5 L) and 17.4 bpm at 6 breaths/min (VT 1.0 L).

Defence and orienting responses. A sudden intense noise produces:
- an HR acceleration peaking at ≈ 3–5 s, a deceleration, and a second acceleration at ≈ 30–40 s (+5–15 bpm, V14; Vila et al. 2007);
- an SCR, pupil dilation and finger vasoconstriction.

A mild novel stimulus gives an orienting deceleration of a few bpm (Graham & Clifton 1966). Drive: `cea`, `pag` and `lc` offsets on `fSymCard`, `fSymSkin`, `fSudo` and `fSymPup`, with a transient `fVagCard` withdrawal.

Spinal cord injury rule (preset §6):
- Bulbospinal drive to IML segments below the lesion is zero.
- Resting sympathetic tone below a complete cervical or high thoracic lesion is small: direct microneurography finds essentially no spontaneous muscle sympathetic activity below the lesion, and what remains is reflexly evoked and sparse. The model therefore keeps ≤ 0.15 of normal resting tone for the muscle and splanchnic channels and up to ≈ 0.3 for the skin channel, which laser-Doppler work suggests is less depressed (Stjernberg, Blumberg & Wallin 1986, *Brain* 109:695; Wallin et al. 2014; Bernjak et al. 2011; review *Front Physiol* 2012;3:215 — all [secondary, unverified], H).
- Segmental sympathetic **reflexes** below the lesion remain and carry the whole late-phase change: the §6 spinal-shock phase scales reflex gain (depressed early, exaggerated late; Ditunno et al. 2004), not resting tone. The dysreflexia rule below and the not-yet-built SCI dysreflexia module read that gain. The recalled "roughly a third to a half of resting activity" (Mathias & Frankel) is a **plasma noradrenaline** figure, which has non-neural sources, and is not a nerve-activity target [recalled].
- Cervical lesions lose all supraspinal cardiac sympathetic drive, which leaves vagal tone unopposed.
- At or above T6, a stimulus below the lesion (`bladderFill`, `colorectalDistension`, noxious input) triggers a splanchnic surge. SBP rises ≥ +20 mmHg above baseline, with baroreflex bradycardia through the intact vagus (autonomic dysreflexia, V19; Krassioukov et al. 2009).

### 7.9. Respiratory control

The rhythm arises in the pre-Bötzinger complex (Smith et al. 1991, R; human homologue Schwarzacher et al. 2011). The capture attributes it to the dorsal group [G Respiratory_center L40]; §1 corrects this. The other groups:
- The NTS integrates IX and X afferents from chemoreceptors, baroreceptors and lung stretch receptors [G Respiratory_center L42].
- The ventral group works in forced breathing [G Respiratory_center L48–L50].
- The pontine group gives the inspiratory off-switch [G Respiratory_center L58].

Ownership follows A.8 decision 8. `preBotC` sets `respPhase`. Ventilation follows chemoreflex and arousal drives, with VT rising before rate: `vt = 0.5 · (ve/7)^0.6`, `rr = ve/vt` [model]. The orgasm breath-hold in `vitals()` (L361) becomes a central apnoea command (§11).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Resting `rr` | 14 (12–16) | breaths/min | H | high | `response.js` L361; [T] |
| Resting `vt` / `ve` | 0.5 / 7 | L; L/min | H | medium | [T] |
| `paco2` / `pao2`, ventilation maintained | 40 / 95 | mmHg | H | medium | A.9; [T] |
| HCVR | 1.5–3 | L/min per mmHg | H | medium | [T] |
| CO₂ response share central / peripheral | ≈ 2/3 / ≈ 1/3 | — | H | low | [T] |
| Peripheral chemoreflex delay / τ | lung → carotid body transit (§9.8) + ≈ 1 / 10–20 | s | H | low | Bellville et al. 1979 [recalled] |
| Central chemoreflex delay / τ | 10–20 / 60–150 | s | H | low | Bellville et al. 1979 [recalled] |
| Hypoxic ventilatory response onset | PaO₂ < ≈ 60 | mmHg | H | medium | [T] |

Hypoxia and hypercapnia raise `fSymMus`. Hypoxia during apnoea raises `fVagCard` unless the lungs inflate. The `co2` stimulus (A.6) acts via `rtn` (CNS, survives autonomic off) and `carotidBody` (autonomic). With autonomic off and somatic on, ventilation is real and PaCO₂ is a live variable regulated by the central share of the CO₂ response alone (row above); the model holds resting PaCO₂ within ±2 mmHg of 40 [model] and the HUD tags ventilation "central chemoreflex only" (§6.14).

### 7.10. Thermoregulation

Preoptic warm-sensitive neurons tonically inhibit `dmh` and `rpa`. Cooling disinhibits them, which drives cutaneous vasoconstriction, BAT and (via §6) shivering. Heat loss uses active vasodilation and sweating (Morrison & Nakamura 2019, R) [G Raphe_nuclei L83].

The model integrates `tCore` on `EN` and carries mean `tSkin` as a second state that sets the skin term. Effector thresholds are offsets from `tSet`, so the §10 fever shift moves them all together. A skin term lowers the cold thresholds when `tSkin` < 33 °C [model]. Mean `tSkin` is not the same quantity as the 32 °C local contact baseline of §5.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| `tSet` = resting `tCore` | 37.0 | °C | H | high | A.9; [T] |
| Interthreshold range, sweating to vasoconstriction | ≈ 0.2 | °C | H | high | Lopez et al. 1994 |
| Thresholds higher in women (not exposed) | ≈ 0.3 | °C | H | high | Lopez et al. 1994 |
| One study: sweating / vasoconstriction / shivering | 37.5 ± 0.4 / 36.8 ± 0.7 / 36.2 ± 0.5 | °C | H | medium | Komatsu et al. 2005 |
| Model onsets: sweating / vasoconstriction and BAT / shivering | 37.1 / 36.9 / 36.3 (tSet + 0.1 / − 0.1 / − 0.7) | °C | — | low | [model] from the rows above |
| Mean `tSkin`, thermoneutral; resting heat production; heat capacity | 33.0 °C; ≈ 80 W; ≈ 3.5 kJ/(kg·°C) | — | H | medium | [T] |
| Core relaxation time τ_T | 2,700 | s | — | low | [model] |
| Warming availability: passive / vasoconstriction and BAT / shivering | 0.08 / 0.42 / 0.50 | — | — | low | [model] |
| Cooling availability: passive / vasodilation and sweating | 0.25 / 0.75 | — | — | low | [model] |

Heat balance on `EN` [model], the form behind the §12.12 and §12.14 fever values:

```
dtCore/dt = A · (tSet − tCore) / τ_T
A = 0.08 + 0.42 · g.autonomic + 0.50 · g.somatic     when tSet > tCore (warming: vasoconstriction, BAT, shivering)
A = 0.25 + 0.75 · g.autonomic                        when tSet ≤ tCore (cooling: vasodilation, sweating)
tSkin = 33.0 °C at thermoneutrality; it follows contact and ambient stimuli only (§12 inputs)
```

Effector drives follow the threshold offsets above: vasoconstriction and BAT (`fSymSkin`, `fSymBat`) and shivering (`shiver`, §6) rise as tCore falls below their onsets, sweating as it rises above. Feasibility: a +1.35 °C rise in a 75-kg body stores ≈ 354 kJ, ≈ 39 W above resting production over 2.5 h, well inside shivering and BAT capacity. The two-compartment core–skin form with explicit heat flows is an open question (§7.15).

### 7.11. Interventions

One preset at a time (A.5; semantics §11).

| Preset | Edges removed | Expected result | Source |
|---|---|---|---|
| Heart transplant | cardiac efferents and afferents | HR = IHR(donor age) · f_T plus plasma catecholamines with β1 supersensitivity (adrenaline effect × 2 [model]); RSA and baroreflex HR ≈ 0; exercise chronotropy delayed by minutes; late reinnervation not modelled | Bengel et al. 2001; [T] |
| Atropine (systemic, vagal-blockade dose ≈ 0.02–0.04 mg/kg) | all muscarinic effects | HR ≈ 110 (§7.5); pupil +1–2 mm with a sluggish but present light reflex; dry mouth; anhidrosis; no RSA. Topical (eye-drop) atropine, which gives a 7–8 mm fixed pupil, is a different exposure and is not offered | [T] |
| Truncal vagotomy | subdiaphragmatic `cn10`: `fVagGut`, abdominal afferents, vagal limb of the inflammatory reflex (§10) | heart unaffected; less acid, impaired emptying, no vagal satiety (§8); option: highly selective (fundus and body) | [G Vagotomy L39, L40] |
| T2–T3 sympathectomy | chain at T2–T3, chosen side | no palmar sweating or hand vasoconstriction; compensatory trunk sweating; stellate option adds Horner signs (miosis with dilation lag, mild ptosis, facial anhidrosis) | [G Sympathectomy L32]; signs [T] |
| Pure autonomic failure | sympathetic gains × 0.1; `fVagCard` × 0.3; sudomotor × 0.1 | OH with near-fixed HR (ΔHR/ΔSBP < 0.5), postprandial hypotension, anhidrosis; supine-hypertension option; low supine noradrenaline (§9) | Freeman 2008; Norcliffe-Kaufmann et al. 2018; [G Dysautonomia L33] |

### 7.12. Switch-off behaviour

Autonomic off (A.5). `g.autonomic` ramps to 0 over 1 s tH. Efferent channels and visceral afferent edges stop, and each state relaxes by its own kinetics:
- HR approaches IHR(age) · f_T with τ_off and is tagged "intrinsic" (A.8 #11).
- Conductance, venous tone and contractility fall to basal.
- Pupils approach 5.0 mm with the redilation τ and stay fixed, with no light reflex.
- SCR, sweating, salivation, lacrimation, RSA, BAT, the cephalic phase and vagal satiety (§8) and the inflammatory reflex (§10) stop.
- The adrenal medulla loses its preganglionic drive, so adrenaline stays basal (§9).
- RAAS partly restores BP over minutes (§9).
- Central CO₂ chemoreception and the rhythm continue, without peripheral chemoreflex tuning.
- Thermoregulation keeps only shivering (§6), so `tCore` drifts with ambient load.
- During fever HR still rises, through f_T alone: IHR · k_T per °C (≈ 7.6 bpm/°C at IHR 101; k_T §10.6). The neural part of the fever tachycardia disappears.
- Standing produces a severe orthostatic fall (§7.8) whose upright values lie in the syncopal range; the model does not simulate loss of consciousness or cerebral perfusion (§12.9).

§13 low-passes visible transitions (τ ≥ 2 s).

Central commands are still computed. They are shown as tints and as efference-only packets that fade at `portSymp`, `portVag`, `portPara` and `portSacral`. With visceral afferents cut, NTS baroreceptor drive falls to zero as in brain-only mode. The `rvlm` command therefore rises and the vagal command falls (baroreflex-failure pattern, Ketch et al. 2002 [recalled]); see §7.15.

| Other switch off | Autonomic consequence |
|---|---|
| Master → brain only | channels end at the ports; vitals "—"; blood values clamped basal (A.5) |
| Somatic | ventilation maintained, clamped gases; central RSA persists [model]; no shivering; standing becomes a passive tilt (no central-command, muscle-vasodilation or muscle-pump effects); no trigeminal diving input |
| Enteric | vagal and sympathetic actions on motility and secretion stop; vascular and sphincter actions continue |
| Neuroendocrine | adrenaline, AVP and RAAS actions basal; transplant HR flat; no RAAS rescue |
| Neuroimmune | `tSet` stays 37.0; the inflammatory-reflex efferent has no target |

### 7.13. Scenario contributions and validation targets

Inputs and tolerances are §12's.

| Scenario | Autonomic path | Expected readouts | Networks |
|---|---|---|---|
| `hotObject` | nociceptors (§5) → `pbn`, `cea`, `lc` → `rvlm`, `fSudo.palm`, `fSymPup`; `fVagCard` (−) | pupil dilation from ≈ 0.4 s; palm SCR ≈ 1.4 s; HR +5–15 peaking 3–5 s and SBP +10–20 [T, low]; withdrawal §6 | somatic ∧ autonomic |
| `loudSound` | `cochNuc` → `pnc`, `lc`, `cea` → `fSymCard`, `fSymSkin`, `fSudo`, `fSymPup` | defence response (§7.8); SCR ≈ 1.5–3 s; finger vasoconstriction; pupil dilation. Brain-only: commands only | special ∧ autonomic |
| `brightLight` | `retina` → `opn` → both `ew` → `fEw` | direct and consensual constriction after 0.22 s; redilation after offset. Brain-only: command only | special ∧ autonomic |
| `kneeJerk` | none [T] | — | — |
| `standUp` | posture → baroreflex | V7; autonomic off: V8 | autonomic (somatic for active transients) |
| `meal` | sight, smell → `ssn`/`isn`, `dmv` (§8); distension → `cn10.aff` → `ntsVisc`; baroreflex buffers splanchnic hyperaemia (§8) | saliva toward the stimulated range within seconds (timing §8); HR +3–8 [T, low]; SBP change < 10; autonomic off or PAF: V18 | special ∧ autonomic; autonomic ∧ enteric |
| `stressor` | `pvn`, `dmh`, `cea` → `rvlm`, `fSymAdr`; `nAmbVagal` (−) | HR +15–25; SBP +15–30; DBP +10–15 [T, low]; more NS-SCRs; sustained pupil dilation; adrenaline §9 | autonomic (+ neuroendocrine) |
| `infection` | §10 set-point shift → `mnpo`/`mpoa` → `dmh`, `rpa` → `skinVessels`, `bat` | chill: `sbf` ↓, `bat` ↑, shivering (§6); fever tachycardia (§10); defervescence: sweating, vasodilation | neuroimmune ∧ autonomic (∧ somatic) |
| `orgasm` | §11 adapter: with all networks on, `vitals()` is passed through; with a network off, the §11.14 command record drives channel offsets and `fSacral`; pelvic streams per A.8 #21 (schematic markers, pending §13.18) | all networks on: identical to `vitals()` (L354–L364); autonomic off: HR at IHR, BP at the outflow-removed baseline, no pelvic traffic; DOPAMINE.md unchanged | as §11 |
| `valsalva` | baroreflex with strain | V16; phase IV overshoot with bradycardia | autonomic (+ somatic) |
| `coldFace` | `spV` → `nAmbVagal`, `rvlm` | HR ≈ −20 % at 15 s, ≈ −30 % at 30 s | somatic ∧ autonomic |
| `sleepSound` | arousal from n2 → `lc`, `rvlm` | transient HR +5–10 and finger vasoconstriction [T, low] | special ∧ autonomic |

| # | Checkpoint | Target | Species | Conf. | Source |
|---|---|---|---|---|---|
| V1 | Resting supine | `hr` 68, 115/75, `map` 88, `rr` 14, pupil 4.0 mm, `tCore` 37.0 | H | high | §7.5, §7.7, §7.9, §7.10 |
| V2 | Autonomic off, supine | `hr` = IHR (101 at 30 y); RSA 0; pupils 5.0 mm fixed; no SCR | H | medium | §7.5, §7.12 |
| V3 | Atropine | `hr` ≈ 110 | H | medium | [T] |
| V4 | Heart transplant | `hr` 90–110; RSA ≈ 0 | H | medium | Bengel et al. 2001; [T] |
| V5 | Whole-body BRS, supine | 15.7 ms/mmHg | H | low | Laude et al. 2004 [secondary] |
| V6 | Carotid `baroStep` ±5 mmHg | ≈ −0.3 bpm/mmHg; ≈ −0.2 to −0.3 mmHg/mmHg | H | low | Potts et al. 1993 [unverified] |
| V7 | Active stand | peaks ≈ 3 s and ≈ 12 s; nadir 7–10 s; steady +10–15 bpm | H | medium | Borst et al. 1982; Wieling et al. 2007 |
| V8 | Stand, autonomic off | SBP fall ≥ 20 within 3 min; ΔHR/ΔSBP < 0.5 | H | high | Freeman et al. 2011; Norcliffe-Kaufmann et al. 2018 |
| V9 | Light reflex | latency 0.22 s; direct = consensual | H | medium | Ellis 1981; Bergamin & Kardon 2003 |
| V10 | Skin response latency | palm 1.3–1.5 s; sole 1.8–2.1 s | H | low | Shahani et al. 1984 [recalled] |
| V11 | SCR shape | latency 1–3 s; rise 1–3 s; half-recovery 2–10 s | H | medium | Dawson et al. 2007 |
| V12 | Arousal pupil response | peak ≈ 0.93 s after a brief event | H | high | Hoeks & Levelt 1993 |
| V13 | RSA at rest | 5–15 bpm; largest near 6 breaths/min | H | medium | Eckberg 1983 |
| V14 | Defence response | +5–15 bpm, first peak 3–5 s | H | low | Vila et al. 2007 |
| V15 | Diving | −15 to −40 % | H | medium | Gooden 1994 |
| V16 | Valsalva ratio | ≥ 1.21; ≈ 1.0 with autonomic off | H | medium | [T] |
| V17 | HCVR (`co2`) | 1.5–3 L/min per mmHg | H | medium | [T] |
| V18 | Postprandial hypotension, autonomic off | SBP fall ≥ 20 within 120 min | H | medium | Jansen & Lipsitz 1995 |
| V19 | Dysreflexia (SCI ≥ T6 + `bladderFill`) | SBP ≥ +20 with bradycardia | H | high | Krassioukov et al. 2009 |
| V20 | Thermoeffector order | sweating; vasoconstriction ≈ 0.2 °C lower; shivering ≈ 0.6 °C below vasoconstriction | H | medium | Lopez et al. 1994; Komatsu et al. 2005 |
| V21 | Orgasm regression, all networks on | identical to `vitals()` | — | high | §11; DOPAMINE.md §9.6 |

### 7.14. Implementation notes

- Layers (A.4): channels, effectors, baroreflex, haemodynamics, respiration, pupil and skin conductance run on `CV` (10 ms). Thermoregulation and `bladderVol` run on `EN` (1 s). Packets run on `EV` with the conduction part of each dead time (§7.6).
- Dead times are ring buffers of D / 10 ms entries (longest 500, venous 5 s). Updates use the exact exponential form, and step sizes never depend on `kh`. At these gains the model check holds rest within 0.1 bpm with no sustained oscillation.
- Variability is seeded (`mulberry32`, `CV`): MSNA burst gating (§7.6), non-specific SCRs (§7.7) and an Ornstein–Uhlenbeck term on each drive (σ 0.01, τ 5 s [model]). Together with RSA these give heart-rate variability.
- Interfaces (file list §11):
  - Reads `r.<node>`, `salience`, `lcPhasic`, `arousalState` (§3), `posture` and motor commands (§6), and plasma hormones (§9).
  - Writes `hr hp sbp dbp map pp co sv tpr contractility rr vt ve respPhase paco2 pao2 pupilD.L pupilD.R scl scr tCore tSkin sweat sbf bat bladderVol`, every `f*` channel and `tone.<channel>`.
  - `response.js` keeps its names (§11 maps `sys`/`dia`).
- Orgasm adapter (§11): with all networks on, displayed cardiorespiratory readouts equal `vitals()`; they are taken from `response.js` and the channel tones are inverted for display. With any relevant network off, this model's outputs apply.
- Display (§13): MSNA and sudomotor packets ≤ 3 per s per region; pupil as a small disc; colours per A.8 decision 19.
- After code changes run `graphify update .`.

### 7.15. Open questions

- Jose & Collison (1970) coefficients come from secondary sources, and the sex-specific forms disagree with the pooled form.
- Ursino (1998) constants are recalled. Tlalka et al. (2024) confirm the model structure and a no-input heart period of 0.580 s but defer the regulation constants to Ursino's table. As commonly re-implemented, Ursino's heart-period effectors use a vagal delay 0.2 s with τ 1.5 s and a sympathetic delay 2 s with τ 2 s, not the model's 0.3/0.5 s and 2/4/10 s (A.8 #14). Justify these from transfer-function data (Berger, Saul & Cohen 1989), or adopt Ursino's; Ursino is cited here only for the contractility, resistance and venous rows.
- The offset gains (nociceptive, startle, stress and PGE2 drives → each channel), the gain of the psychosensory pupil kernel (mm per unit `lcPhasic`) and a RAAS → conductance term are not tabulated. Until §7 gives them, §12.20 rows 12–14, the §12.11 HR and adrenaline values and the §12.9 RAAS share cannot be reproduced from this section.
- Mayer waves need a second-order vascular stage (a Windkessel, τ ≈ 1.5 s) tuned to K/K_c 0.5–0.7 at 0.08–0.12 Hz; §7.5 as written has none (§4.12).
- Heat balance: the §7.10 effector-limited relaxation should become a two-compartment core–skin model with explicit heat flows (core–skin conductance times the vasomotor factor, BAT and shivering gains, sweating) before thermal stimuli other than fever are scripted.
- Potts et al. (1993): an abstract fragment shows MAP gains of −0.23 ± 0.04 and −0.60 ± 0.38 mmHg/mmHg without naming the condition, and the HR gain is unconfirmed. The EuroBaVar medians need checking against Laude et al. (2004).
- Still recalled: Macefield et al. 1994, Bellville et al. 1979, Shahani et al. 1984, Zoller et al. 1972, Ketch et al. 2002, the Dawson et al. 2007 amplitude and NS-SCR rows, and the early 3 s HR peak.
- The acute supine MAP fall under complete autonomic blockade in healthy humans is unverified. The model's −14 mmHg is set by k_R and the 40 % non-neural share. The same two uncalibrated values set the depth of the autonomic-off upright fall (SBP 58 at ≈ 14 s, 71/50 at 3 min, MAP ≈ 57 at heart level and ≈ 39 at the carotid), which lies in the syncopal range (§12.9).
- Model deviations from the targets:
  - The orthostatic HR peak is +36 bpm at 10 s (typical +20–30 [T]).
  - The steady standing DBP rise is +1 mmHg instead of +5–10.
  - There is no post-peak relative bradycardia.
  - There is no 0.1 Hz baroreflex resonance, so RSA is largest at 6 breaths/min only because the breaths are deeper.
  - A stronger vasomotor gain or a second-order sympathetic stage may fix these.
- w_cs, channel gains, resting tones and `f_max` are calibrated, not measured. Human cardiac sympathetic and vagal firing rates are unknown.
- The pupil law (2.63, 1.2), the denervated 5.0 mm and age effects need fitting to pupillometry data. The model's atropine mydriasis (≈ 5.3 mm) is now compared with the systemic vagal-blockade dose (+1–2 mm over the resting diameter, §7.11), not with the 7–8 mm fixed pupil of topical atropine; a source for the systemic figure is still wanted.
- Thermal thresholds differ between studies (interthreshold 0.2 °C in Lopez et al. 1994, 0.7 °C in Komatsu et al. 2005). BAT heat output, shivering gain and ambient defaults are model choices.
- Deafferented commands with autonomic off: either show the rising `rvlm` command or hold NTS input at rest to avoid a stress-like tint. Decision needed with §11 and §13.
- The 50 ms `loudSound` may evoke a weaker defence response than longer stimuli. The size of postprandial hyperaemia (§8) decides whether V18 emerges.
- Sex differences are not exposed; only `age` changes defaults. Voiding as a pulse plus volume reset needs §13 confirmation.
- Graph gaps: there are no edges for salivatory nuclei → ganglia, Barrington → sacral outflow, or preoptic → `dmh` → `rpa`. The graph's ACTH → adrenal medulla edge is wrong (ACTH acts on the cortex, §9).

### 7.16. Sources

Peer-reviewed: Barnes 1986; Bellville et al. 1979 [recalled]; Benarroch 1993; Benedek & Kaernbach 2011; Bengel et al. 2001; Bergamin & Kardon 2003; Borst et al. 1982; Craig 2002; Cypess et al. 2009; Dampney 1994; Dawson et al. 2007; Ditunno et al. 2004; Eckberg 1983; Ellis 1981; Fowler et al. 2008; Freeman 2008; Freeman et al. 2011; Gooden 1994; Graham & Clifton 1966; Guyenet 2006; Heusser et al. 2021; Hoeks & Levelt 1993; Humphrey & Williamson 2001; Jansen & Lipsitz 1995; Jose & Collison 1970 [secondary]; Joshi et al. 2016; Ketch et al. 2002 [recalled]; Komatsu et al. 2005; Krassioukov et al. 2009; Laude et al. 2004 [secondary]; Levy 1971; Lopez et al. 1994; Macefield et al. 1994 [recalled]; Morrison & Nakamura 2019; Norcliffe-Kaufmann et al. 2018; Potts et al. 1993 [unverified]; Rosenblueth & Simeone 1934; Rowell 1974; Schwarzacher et al. 2011; Shahani et al. 1984 [recalled]; Smit et al. 1999; Smith et al. 1991; Tanaka et al. 2001; Tlalka et al. 2024; Ursino 1998 [recalled]; van Marken Lichtenbelt et al. 2009; Vila et al. 2007; Virtanen et al. 2009; Warner & Cox 1962; Wieling et al. 2007; Zoller et al. 1972 [recalled].

Textbook [T]: anatomy, receptor subtypes, reference values, HCVR, Valsalva ratio, thermal constants, clinical signs.

Project files: `brain-system/src/response.js` L354–L365 (`vitals()`); `brain-system/research/DOPAMINE.md` §9.6.

Raw captures (`brain-system/raw/`): Autonomic_nervous_system L33–L75; Baroreflex L27–L43; Dysautonomia L33; Fight-or-flight_response L57; Group_C_nerve_fiber L27; Heart_rate L23–L86; Insular_cortex L40; Locus_coeruleus L54; Medial_preoptic_nucleus L41; Paraventricular_nucleus_of_hypothalamus L46, L71, L80; Parasympathetic_nervous_system L51–L61; Pelvic_splanchnic_nerves L33, L41; Pupillary_light_reflex L40–L59; Pupillary_response L23–L35; Raphe_nuclei L83; Respiratory_center L40–L58; Sympathectomy L32; Sympathetic_nervous_system L34–L68; Sympathetic_trunk L33–L60; Vagotomy L39–L40; Vagus_nerve L42–L81.

---

## 8. Enteric nervous system and gut–brain axis

### 8.1. Scope and ownership

The enteric nervous system (ENS) runs from the oesophagus to the anus. It senses mechanical and luminal conditions and drives motility, secretion and local blood flow without the brain or spinal cord. It keeps working after vagotomy, in isolated segments and in transplanted bowel ([G Enteric_nervous_system L33, L61, L63]; Trendelenburg 1917). Classical texts call it the third autonomic division ([G Sympathetic_nervous_system L34]). Here it is its own network, and its switch covers only the myenteric and submucosal plexuses (A.3.1). ICC, smooth muscle, epithelium, enteroendocrine cells, lumen and microbiota are `tissue`. `dmv`, sacral and sympathetic outflow and all gut visceral afferents are `autonomic` (A.8 #7). The striated oesophagus and the external anal sphincter are `somatic` (§6). Distant hormone actions are `neuroendocrine` (`ne.gut`), and immune coupling is `neuroimmune` (§10). §11 owns the full ownership model.

This section owns every ENS and gut number (A.7). Values owned elsewhere are cited, not restated: geometry (§2), fibre velocities and r_max (§4), sensation thresholds (§5), autonomic channels (§7), meal inputs (§12) and visual numbers (§13).

### 8.2. Gut regions and the arc-length coordinate

The gut model is one-dimensional. Position is arc length s in cm from the upper oesophageal sphincter (A.2), measured as in-vivo length; this section owns s. The drawn arc length is a different coordinate, `sDraw`, and §2.9 owns the piecewise-linear breakpoint table that maps the region boundaries below onto it, so drawn lengths never change timing. Cells `gut[i]` have width Δs, with i = ⌊s / Δs⌋ increasing aborally. Sphincters are single cells with their own tone (§8.7). Region boundaries are [T] or [model], low confidence, unless stated otherwise.

| Region | id | s (cm) | Extrinsic parasympathetic (§8.9) |
|---|---|---|---|
| Oesophageal body; LES | `gut.oes`; `gut.les` | 0–21; 21–25 | `nAmbMotor` (striated, s 0–7); `dmv` |
| Fundus; corpus (pacemaker s 36, §8.4); antrum; pylorus | `gut.fundus`; `gut.corpus`; `gut.antrum`; `gut.pylorus` | 25–33; 33–45; 45–53; 53–55 | `dmv` |
| Duodenum; jejunum; ileum | `gut.duod`; `gut.jej`; `gut.ileum` | 55–80; 80–185; 185–345 | `dmv`, weakening aborally |
| Ileocaecal valve; caecum; ascending colon | `gut.icv`; `gut.caecum`; `gut.colAsc` | 345; 345–351; 351–369 | `dmv` |
| Transverse colon | `gut.colTrans` | 369–414 | `dmv` to s ≈ 399 (Cannon–Böhm point), sacral beyond |
| Descending; sigmoid; rectum | `gut.colDesc`; `gut.sigmoid`; `gut.rectum` | 414–439; 439–482; 482–496 | sacral S2–S4 ([G Pelvic_splanchnic_nerves L33, L41]) |
| Anal canal | `gut.ias`, `gut.eas` | 496–500 | sacral (IAS); `pudendal`, somatic (EAS; [G Pudendal_nerve L40]) |

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Oroanal length in vivo; small intestine; small-intestinal inner diameter | ≈ 5 m; ≈ 3 m (291 cm in their calculation); 2.5 cm | — | H | medium | Helander & Fändriks 2014 [unverified] |
| Autopsy or surgical length relative to in vivo | ≈ 2× | — | H | medium | Helander & Fändriks 2014 [unverified] |
| Oesophagus; colon plus rectum | ≈ 25; ≈ 150 | cm | H | medium | [T] |
| Model gut length (s at the anal verge) | 500 | cm | — | low | [model] |
| Cell width Δs: two highest tiers; two lowest | 2 (N = 250); 4 (N = 125) | cm | — | high | [model]; `gut_proto.mjs` |
| Cannon–Böhm point | s ≈ 399 (two-thirds of the transverse colon) | cm | H | medium | [G Pelvic_splanchnic_nerves L41]; [model] (s) |

### 8.3. ENS anatomy and neuron classes

ENS neurons lie in two plexuses ([G Enteric_nervous_system L41]):
- The myenteric (Auerbach) plexus lies between the muscle layers and controls motility ([G Myenteric_plexus L45]).
- The submucosal (Meissner) plexus innervates the epithelium and the muscularis mucosae ([G Submucosal_plexus L44–L46]). It is sparse above the pylorus (Furness 2006 [T]).

Glia and a diffusion barrier make the ganglia CNS-like ([G Enteric_nervous_system L65]). Intrinsic primary afferent neurons (IPANs, Dogiel type II) sense stretch, tension and luminal chemistry. They drive interneurons and excitatory and inhibitory motor neurons ([G Enteric_nervous_system L63]). Excitatory motor neurons and IPANs use acetylcholine with tachykinins. Inhibitory motor neurons use nitric oxide, VIP and a purine (NANC) (Furness 2006 [T]). Intestinofugal neurons project to the prevertebral ganglia and close intestino-intestinal reflexes outside the CNS (Szurszewski 1981).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| ENS neurons | ≈ 5 × 10⁸ (review range 2–6 × 10⁸) | neurons | H | medium | [G Enteric_nervous_system L39]; Furness et al. 2014 |
| IPAN share: myenteric; submucosal | ≈ 30; 14 | % | GP ("preclinical") | medium | [G Myenteric_plexus L47]; [G Submucosal_plexus L48] |
| Transmitters; nicotinic receptors | > 30; on essentially all myenteric neurons | — | GP, H | high; medium | [G Enteric_nervous_system L63]; [G Myenteric_plexus L72] |
| Myenteric classes, ileum | IPAN 0.26; longitudinal excitatory motor 0.25; circular inhibitory motor 0.16 (anal); circular excitatory motor 0.12 (oral); ascending interneurons 0.05; descending interneurons 0.10; other incl. intestinofugal (< 1 %) 0.06 | fraction | GP | low | Brookes 2001 [recalled] |
| Enteroendocrine cells | ≈ 1 | % of epithelium | H | medium | Gribble & Reimann 2016 |
| ENS share by region (input to §13) | oesophagus 0.03; stomach 0.10; small intestine 0.55; colon and rectum 0.32 | fraction | — | low | [model]: tube area × ganglion density |
| Myenteric : submucosal: oesophagus and stomach; intestine | 0.9 : 0.1; 0.65 : 0.35 | fraction | — | low | [model] after Furness 2006 |

The class shares are used only to tag stars and to choose which stars light up during a reflex. The simulation runs on per-cell kernels (§8.5).

### 8.4. ICC pacemakers and slow waves

Interstitial cells of Cajal (ICC) are mesodermal ([G Interstitial_cell_of_Cajal L42]). They generate slow waves through ANO1 Ca²⁺-activated Cl⁻ channels; ANO1-knockout mice have no slow waves ([G Interstitial_cell_of_Cajal L46, L54]). ICC also relay enteric motor transmission and sense stretch. They form the network along which slow waves propagate, and a break in it decouples the two sides ([G Interstitial_cell_of_Cajal L65–L69]; Sanders, Koh & Ward 2006; Sanders, Ward & Koh 2014). ICC are `tissue`, so slow waves survive every switch.

One corpus pacemaker on the greater curvature entrains the corpus and antrum, while the fundus is silent (O'Grady et al. 2010). Small-intestinal frequency falls in steps ("plateaus") (Diamant & Bortoff 1969, D). The colon has two weakly coherent rhythms. Phase is analytic in tH (A.4), so clock jumps are seamless and the GPU can evaluate it from textures of f and λ.

```
swPhase[i] = 2π · f(s_i) · (tH − λ(s_i))  (mod 2π);   λ(s) = | ∫ s0→s ds′ / c(s′) |
s0 = 36 cm in the stomach (both directions; fundus s < 33 has no phase); oral edge of each plateau; colon: seeded per-patch random walk (§11)
```

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Gastric frequency | 2.83 ± 0.35 (pacemaker 2.85, corpus 2.80, antrum 2.86; P = 0.3) | cycles/min | H | high | O'Grady et al. 2010 (n = 12) |
| Velocity: pacemaker / corpus / antrum; amplitude | 8.0 (6.5–9.9) / 3.0 (2.6–3.5) / 5.7 (4.7–6.9; 5.9 in the abstract) mm/s; 0.57 / 0.25 / 0.52 mV | — | H | high | O'Grady et al. 2010 |
| Corpus wavefront spacing; simultaneous wavefronts | 55–60 mm; > 2 (up to 3–4) | — | H | high | O'Grady et al. 2010 |
| Electrogastrographic rhythm | 0.047 ± 0.003 (0.041–0.053) | Hz | H | high | Rebollo et al. 2018 (n = 30) |
| Duodenal slow waves; phase III frequency, duodenum–jejunum | 11–12; 10.92 (10.68–11.16) | cycles/min | H | high | [G Interstitial_cell_of_Cajal L61]; Baker et al. 2019 (n = 8) |
| Terminal-ileal slow waves | 8–9 | cycles/min | H | medium | [G Interstitial_cell_of_Cajal L62]; [T] |
| Model plateaus 1–6 (s 55–100, –150, –200, –260, –310, –345) | 11.7, 11.0, 10.3, 9.5, 8.8, 8.2 | cycles/min | H (ends), D (form) | low | [model] fitted to the rows above |
| Small-intestinal slow-wave phase velocity | 0.9 (longitudinal 9.0 ± 0.7, circumferential 10.1 ± 0.8 mm/s; jejunal frequency 9.8 ± 0.4 cpm) | cm/s | H | medium | Angeli et al. 2018 (human jejunum, intra-operative high-resolution mapping, n = 9; abstract). The 2.4 cm/s phase III contraction velocity (§8.6) is a different quantity |
| Colonic slow waves; myenteric potential oscillations (MPOs) | 2–4 (model 3.0); ≈ 17.8 | cycles/min | H (MPOs in vitro) | medium; low | [G Interstitial_cell_of_Cajal L63]; Rae et al. 1998 [secondary] |
| Colonic coherence patch | 8 cm; random walk σ 0.5 rad, τ 5 min | — | — | low | [model] |

Model checks (arithmetic, not data):
- On the 30 cm model stomach, a wave runs from the pacemaker to the pylorus in ≈ 44 s. That gives ≈ 2.1 wavefronts at once and a corpus wavelength of ≈ 64 mm.
- Neighbouring plateau frequencies beat at the boundaries, so contraction strength waxes and wanes there.
- In the small intestine, 0.9 cm/s at 8.2–11.7 cpm gives a wavelength of ≈ 4.6–6.6 cm (≈ 13 cm with the earlier 2.4 cm/s). The 2-cm cells of the two highest tiers sample ≈ 2.3–3.3 cells per wavelength; the 4-cm cells of the two lowest tiers sample fewer than two, so there contraction gating uses the cycle mean (envelope mode, §13) [model]. The 100-ms `GI` step advances the phase by ≤ 0.02 cycles.

### 8.5. Electromechanical gate, peristaltic reflex and tonic inhibition

Slow waves set the timing of phasic contractions but cannot trigger them alone. A contraction needs added excitatory drive: cholinergic and tachykinergic neurons, vagal and sacral input, motilin, 5-HT. NO/VIP and sympathetic α2 inhibition raise the threshold (Sanders, Koh & Ward 2006; Szurszewski 1981).

The peristaltic reflex is intrinsic. Distension contracts the wall oral to the stimulus and relaxes it anal to the stimulus (Bayliss & Starling 1899, D; [G Enteric_nervous_system L75]). It persists in denervated segments (Trendelenburg 1917). Inhibitory motor neurons are tonically active. Without enteric neurons, circular muscle is disinhibited but uncoordinated and the sphincters cannot relax, so aganglionic bowel obstructs instead of going flaccid (Furness 2006 [T]).

```
gutX[i] = b(s_i, mode) + g_e·[E_asc(i) + V(s_i) + Mo(s_i) + H5(i)] − g_in·[I_desc(i) + I0(s_i)] − k_S·S + P_mmc(i)
E_asc(i) = g.enteric·k_a·Σ_{j=i+1…i+n_a} ipan[j];  I_desc(i) = g.enteric·k_d·Σ_{j=i−n_d…i−1} ipan[j];  I0 = g.enteric·I0_base
V(s) = g.autonomic·g.enteric·[w_vag(s)·v_n + w_sac(s)·q_n]  (v_n, q_n = tone.fVagGut, tone.fSacral ÷ fasting rest, §7);  S = g.autonomic·tone.fSymGut
C*[i] = clamp01(gutX[i]) · max(0, (cos swPhase[i] − 0.3)/0.7)²;   gutC[i] = first-order filter of C*[i]
```

`ipan[i]` is the §4 node sigmoid of local stretch (cell content) plus mucosal 5-HT (§8.11). The reflex is a kernel on the cell grid, not a set of graph edges. Its display belongs to §13.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Gate threshold on cos φ; exponent | 0.3 (window ≈ 40 % of the cycle); 2 | — | — | low | [model] after Sanders, Koh & Ward 2006 |
| Contraction filter τ_rise; τ_fall | 1; 3 | s | — | low | [model] |
| Ascending excitation; descending inhibition | 1–2 (n_a = 1 cell); 2–5 (n_d = 2 cells) | cm | GP, D | low | Furness 2006 [T] |
| I0_base, intestine; sphincter relaxation command | 0.3; 0.6 | normalised | — | low | [model] |
| Base b: enteric off; fasting phase I; fed segmenting | 0.15; 0.05; 0.35 (random pattern, 8 cm correlation) | normalised | — | low | [model] |
| w_vag; w_sac | stomach 1.0, duodenum 0.6, jejunum 0.3, ileum and colon to s 399 0.15, then 0; 0 before s 399, ramp to 1.0 at s 414 | — | — | low | [model] |
| Sympathetic gains (S 0–1) | excitability × (1 − 0.6·S); sphincter tone + 0.3·S; mucosal flow − 0.5·S; secretion × (1 − 0.5·S) | — | — | low | [model] after Szurszewski 1981 |
| Atropine-resistant (tachykinergic) share of excitation | 0.4 | fraction | — | low | [model]; [T] |

### 8.6. Migrating motor complex and fed pattern

The ENS generates the fasting migrating motor complex (MMC). It cycles through three phases:
- phase I: quiescence;
- phase II: irregular contractions;
- phase III: a burst at the local slow-wave frequency that migrates aborally.

Gastric phase III coincides with motilin peaks (Vantrappen et al. 1979 [recalled]), and ghrelin can induce it (Tack et al. 2006). Loss of phase III goes with bacterial overgrowth (Vantrappen et al. 1977). A denervated canine jejunoileum keeps its MMC but loses coordination with the host gut (dog autotransplant series [secondary]). With autonomic off, the small-bowel MMC therefore continues but is uncoupled from the stomach. Eating starts the segmenting fed pattern, which lasts longer as meal energy rises (Ouyang, Sunshine & Reynolds 1989 [unverified]).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| MMC period: cohort; textbook; model | 157 (104–211); 90–120; median 110, lognormal σ 0.3, clip 80–230 | min | H; H; — | medium; low; low | Baker et al. 2019 (n = 8); [T]; [model] |
| Phase III duration; phase I : II share of the remaining time | 6.99 (6.25–7.74) min; 0.55 : 0.45 | — | H; — | medium; low | Baker et al. 2019; [model] after [T] |
| Front velocity, duodenum–proximal jejunum | 4.20 (within clusters); 3.72 (between); falls aborally | cm/min | H | medium | Baker et al. 2019; Kellow et al. 1986 [unverified] |
| Model front velocity (s_SI = s − 55) | 4.5·e^(−s_SI/200 cm) + 0.8 (5.3 at the pylorus, 1.9 at the ileocaecal valve, ≈ 100 min transit); window × (1 + s_SI/290 cm) | cm/min | — | low | [model] |
| Contractions within phase III | 2.35 cm/s antegrade (63.0 %), 2.63 cm/s retrograde (32.8 %), 4.2 % stationary; peak 73.6 (67.7–79.5) mmHg | — | H | medium | Baker et al. 2019 |
| Phase III origin; model antral probability | antrum 47.8 % (11/23); 0.48·g.neuroendocrine·(0.3 + 0.7·g.autonomic) | — | H; — | medium; low | Baker et al. 2019; [model] |
| Motilin pulse lead before antral phase III | ≈ 10 | min | — | low | [model] |
| Fed pattern; model rule | 2.5–8 h; ≥ min(120 + 0.25·E₀, 480) min, held while gastric nutrient > 15 kcal or small-intestinal nutrient > 40 kcal | — | H; — | low | [T]; [model] |

The gastric and small-intestinal schedules share one clock while `g.autonomic` ≥ 0.5; below that each runs on its own seeded clock (§11). With enteric off there is no MMC (A.5).

### 8.7. Oesophagus, swallowing and sphincters

The striated upper third of the oesophagus is driven by the medullary swallowing generator through `nAmbMotor` (§6). The smooth-muscle remainder is under `dmv` and the myenteric plexus [T]. A swallow sends a peristaltic wave, relaxes the LES and starts vagovagal relaxation of the fundus. Repeated swallows inhibit the oesophageal body until the last one [T]. Gastric distension triggers transient LES relaxations (TLESRs) through the vagovagal arc (Mittal et al. 1995 [recalled]).

The pylorus and ileocaecal valve relax through enteric inhibitory neurons. The internal anal sphincter (IAS) relaxes in the rectoanal inhibitory reflex (RAIR). The RAIR is intrinsic: it survives spinal transection and is absent in Hirschsprung disease (Rao et al. 2002; [T]). With enteric off, all four smooth-muscle sphincters stay closed (A.5).

```
tone_sph = clamp01(T0_sph + 0.3·S − relax·g.enteric);  relax = 0.6 during swallow or TLESR (LES), antral wave (pylorus),
ileal content (ileocaecal valve), rectal distension (IAS)
```

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Peristaltic velocity; transit of 21 cm | 3–4 cm/s; ≈ 5–7 s | — | H | medium | [T]; computed |
| Distal latency; upper normal integrated relaxation pressure | ≥ 4.5 s; 15 mmHg | — | H | medium | Kahrilas et al. 2015 |
| LES resting pressure | 10–35 | mmHg | H | medium | [T] |
| Deglutitive LES relaxation: onset; duration | ≈ 2; 6–10 | s | H | low | [T] |
| TLESR duration; postprandial rate | > 10 (10–60) s; 2–6 per h | — | H | low | Mittal et al. 1995 [recalled] |
| Model TLESR trigger; resting tone T0_sph | gastric volume > 300 mL; 0.7 | — | — | low | [model] |
| Swallow interval while eating; RAIR threshold | 15–40 s; ≈ 10–30 mL | — | H | low | [T] |

### 8.8. Gastric emptying, transit and colonic motor patterns

Solids empty after a lag while the antrum grinds them into particles of ≈ 1–2 mm, then near-linearly. Liquids empty roughly exponentially (Elashoff, Reedy & Meyer 1982; [T]). Duodenal feedback limits delivery through CCK, enterogastric reflexes and the pylorus (Hunt & Stubbs 1975; Brener, Hendrix & McHugh 1983). Truncal vagotomy removes accommodation and halves antral drive, so liquids empty faster and solids slower (Minami & McCallum 1984; [G Vagotomy L39]). High-amplitude propagating contractions (HAPCs) cause mass movements after waking and after meals [T]. The gastrocolonic response is blunted after complete thoracic spinal cord injury, so it depends largely on extrinsic nerves (Rao et al. 2000 [unverified]; [T]).

| Quantity (validation) | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Solid retention, 255 kcal egg-white meal, 1 / 2 / 4 h | 37–90 / 30–60 / 0–10 | % | H | high | Tougas et al. 2000 [unverified]; Abell et al. 2008 [unverified] |
| Solid lag; water emptying t½ | 20–40; ≈ 15 | min | H | low | [T] |
| Duodenal energy delivery | ≈ 2 (1–4) | kcal/min | H | medium | Hunt & Stubbs 1975; Brener, Hendrix & McHugh 1983 [unverified] |
| Capsule, median (IQR): gastric (leaves with phase III, not with the meal); small bowel; colon; whole gut | 3.6 (3.0–4.2); 4.6 (4.0–5.9); 18.1 (12.8–26.8); 27.7 (22.9–34.3) | h | H | high | Sarosiek et al. 2010 (n = 66) |
| Marker colonic transit: total; right / left / rectosigmoid | 35.0 ± 2.1; 11.3 / 11.4 / 12.4 | h | H | medium | Metcalf et al. 1987 [unverified] |
| HAPC rate; amplitude; velocity | ≈ 6 (2–10) per day; ≥ 100 mmHg; ≈ 1 cm/s | — | H | low | [T] |
| Gastrocolonic response: onset; duration | ≤ 60 min; fat > 3 h, carbohydrate falling after 2.5 h | — | H | low | Rao et al. 2000 [unverified] |

| Quantity (model; A antral strength, G pyloric conductance; §8.15) | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Trituration k₁; emptying k₂ | A/40; A·G/12 | min⁻¹ | — | low | [model] tuned to Tougas et al. 2000 |
| A | g.enteric·(0.5 + 0.5·g.autonomic·min(v_n, 1.5))·(1 − 0.4·S)·m_sick (§10) | — | — | low | [model]; Minami & McCallum 1984 |
| r_set: mixed meal; nutrient liquid | min(2.0, 1.2·(E₀/255 kcal)^0.5); 2.0 | kcal/min | —; H | low; medium | [model]; Brener, Hendrix & McHugh 1983 [unverified] |
| Pyloric brake | G = G_pyl/(1 + `brakeGain`·B·(r̃/r_set)⁴), `brakeGain` 8, B = 0.5·g.neuroendocrine + 0.3·g.autonomic + 0.2·g.enteric (= 1 with all networks on), r̃ low-passed with τ 3 min; G_pyl 1 (enteric on), 0.05 (off). Steady delivery is then ≈ 1.0 × r_set | — | — | low | [model] re-tuned to Tougas et al. 2000 and the §8.13 rows |
| Why `brakeGain` > 1 | The bare (r̃/r_set)⁴ form halves G at 0.5·r_set, which is too soft against an unbraked load of ≈ 10–18 kcal/min at peak: with `brakeGain` 1 steady delivery overshoots r_set by 7–36 % (2.50 kcal/min on the 600 kcal mixed meal), the stomach clears in 3.3 h instead of 4–6 h, and 2 h retention on the 255 kcal solid meal is 25 %, outside the 30–60 % §8.18 window. `brakeGain` 8 moves the half-conductance point to ≈ r_set: 1.90 kcal/min, 4.6 h, retention 74 / 46 / 3 %, and it stays inside all three windows for A 0.9–1.25. Gains of 4–8 all pass; 16 reaches the §8.13 rate but puts 4 h retention at the 10–15 % edge | — | — | low | editor re-run of the §8.15 equations (model check, not a source) |
| Water t½ without accommodation; meal volume | ≈ 8 min; 1.2 mL/kcal | — | — | low | [model] |
| Small intestine: fed and fasting velocity; dispersion; τ_abs | 1.25, 0.25 cm/min; 1.0 cm²/min; 45 min | — | — | low | [model] tuned to Sarosiek et al. 2010 |
| Ileal brake | velocity − 35 % × g.neuroendocrine while distal nutrient is present | — | — | low | [model] |
| Colonic tanks | τ_c 11 h each; κ right 0.6 + 0.4·g.autonomic·v_n, others 0.6 + 0.4·g.autonomic·q_n, all × max(g.enteric, 0.05) | h | H (τ_c); — | medium; low | Metcalf et al. 1987 [unverified]; [model] |
| HAPC hazard | 6 per day × (1 + 2·waking + 2·gastrocolonic) × g.enteric × (0.5 + 0.5·g.autonomic); each moves 50 % of right and left content distally | per day | — | low | [model] |
| Gastrocolonic gain; waking pulse | excitability + 0.5 for 2.5 h (carbohydrate) to 3.5 h (fat) × (0.3 + 0.7·g.autonomic); 1 for 60 min after `wakeAlert` (§3) | — | — | low | [model] after Rao et al. 2000 |

Evacuation is not simulated. In long runs, `rectalVol` and the rectosigmoid tank are reset by a neutral scheduled event.

### 8.9. Extrinsic innervation and afferent levels

The dorsal motor nucleus of the vagus sends parasympathetic output "especially [to] the intestines" ([G Vagus_nerve L80]). It does so by synapsing on enteric neurons, which drive cholinergic excitation and NANC inhibition [T]. Vagal and sacral motor effects on the gut therefore need `autonomic` ∧ `enteric` (A.5).

Sympathetic splanchnic axons synapse in the prevertebral ganglia ([G Autonomic_nervous_system L71]). The postganglionic neurons act in three ways (Szurszewski 1981):
- they inhibit motility by presynaptic α2 inhibition of enteric ACh release;
- they contract sphincters (α1);
- they constrict submucosal arterioles.

Vagal visceral afferents have their cell bodies in the nodose ganglion and end in the solitary nucleus ([G Vagus_nerve L44, L48, L50, L82]). The pelvic splanchnic nerves carry sacral preganglionic fibres to the inferior hypogastric plexus, together with visceral afferents to the cord ([G Parasympathetic_nervous_system L53]; [G Pelvic_splanchnic_nerves L33]).

Every route below was traced with `graphify path`. The graph's edges are textual co-references, not connectivity (e.g. Solitary nucleus → Dorsal nucleus of vagus, [G Baroreflex L39]), so each hop is sourced on its own. The striated oesophagus and the external anal sphincter belong to §6.

| Pathway | Nodes (A.3.3) | Fibre | nets | Territory |
|---|---|---|---|---|
| Vagal afferent, mechanical and chemical | IGLE, IMA, mucosal ending → `nodoseGang` → `ntsVisc` (`portVisc`) | `C` | `autonomic` | s 0–399 (chemical: stomach, small intestine) |
| Spinal visceral, splanchnic | gut → `splanchnicGreater`/`Lesser`/`Lumbar` → `drg.T5`…`drg.L2` → `cord.*.dh` (`portSpinoVisc`) | `C`, `Adelta` | `autonomic` | stomach to sigmoid |
| Spinal visceral, pelvic | sigmoid, rectum → `splanchnicPelvic` → `drg.S2`…`drg.S4` | `C` | `autonomic` | sigmoid to anal canal |
| Vagal motor | `dmv` (`portVag`) → `vagus` → myenteric neurons | `B` (§8.20) | `autonomic`, `enteric` | s 21–399 |
| Sacral motor | `cord.S2`…`S4.spn` (`portSacral`) → `splanchnicPelvic` → `infHypogastric` → myenteric neurons | `B`, `Cpost` | `autonomic`, `enteric` | s 399–500 |
| Sympathetic | `cord.T5`…`L2.iml` → splanchnics → `coeliac`, `smg`, `img` → enteric neurons (with `enteric`); sphincters, arterioles (`autonomic` alone) | `B`, `Cpost` | `autonomic` (± `enteric`) | below the LES |
| Intestino-intestinal | intestinofugal → `coeliac`, `smg`, `img` → enteric ganglia | `C`, `Cpost` | `enteric`, `autonomic` | intestine |

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Vagal afferent share: all fibres; at the diaphragm; model | 80–90 %; ≈ 90 % (≈ 9 : 1); 0.8 (0.75–0.9) | — | H; C; — | medium; low; medium | [G Vagus_nerve L48]; Agostoni et al. 1957 [recalled]; [model] |
| Abdominal vagal axons | predominantly unmyelinated | — | R | medium | Prechtl & Powley 1990 [recalled] |
| Spinal entry: oesophagus; stomach; small intestine; proximal colon; distal colon; rectum | T1–T6; T6–T9; T9–T11; T10–T12; L1–L2 (plus S2–S4); S2–S4 | segment | H | low | [T]; referral → §6 |
| Visceral share of DRG neurons: in the segments of entry (T9–L2, S2–S4); averaged over all segments | ≤ 10; ≈ 2–3 | % | C | low | Cervero et al. 1984 and Jänig & Morrison 1986 as summarised in reviews [secondary, unverified] |

Vagal endings come in three types:
- intraganglionic laminar endings (IGLEs) in the myenteric ganglia sense tension (Zagorodnyuk & Brookes 2000, GP; Berthoud & Powley 1992, R);
- intramuscular arrays sense stretch ([T]);
- mucosal endings sense CCK (CCK1), 5-HT (5-HT3), nutrients and neuropod glutamate (Kaelberer et al. 2018, Ms; Smith et al. 1981, R).

A signal takes ≈ 0.5 s from the stomach to `ntsVisc` (521 mm, §2.14; C fibres, §4). The display traffic on the vagus follows the afferent fraction (§13).

### 8.10. Enteroendocrine cells and gut hormones

Enteroendocrine cells (EEC) sense nutrients, stretch and microbial products (Gribble & Reimann 2016). Each hormone has a local term ℓ_X acting on vagal endings and IPANs, and a plasma pool X acting at a distance (`ne.gut`). With neuroendocrine off, X relaxes to basal (A.5) while ℓ_X continues. Central actions of the hormones belong to §9.

| Cell (id) | Site s (cm) | Stimulus | Distant action | Variable |
|---|---|---|---|---|
| I (`iCells`) | 55–185 | fat, protein | pyloric brake, gallbladder, `areaPostrema` | `cck` |
| L (`lCells`) | 260–482 | distal nutrient (early peak via a proximal signal) | ileal brake, incretin, `areaPostrema`, `arcuate` | `glp1`, `pyy` |
| X/A (`xaCells`) | 25–45 | fasting, anticipation; nutrient suppresses | `arcuate` (hunger), gastric phase III | `ghrelin` |
| M (`mCells`); G (`gCells`) | 55–80; 45–53 | MMC cycle; protein, distension, vagal drive | antral phase III onset; acid (not modelled) | `motilin`; `gastrin` |
| EC (`ecCells`) | whole mucosa | stretch, luminal chemistry | platelet uptake; no BBB passage (§8.11) | `ec5ht` |
| Pancreatic β (outside the gut) | — | cephalic drive, absorption, GLP-1 | `arcuate` | `insulin` |

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| CCK: fasting; peak after mixed liquid meal | 1.0 ± 0.2 (n = 22); ≈ 6.0 ± 1.6 within 15 min | pM | H | medium | Liddle et al. 1985 [unverified] |
| CCK half-life | 2–5 | min | H | low | [T] |
| GLP-1 (total): fasting; early and late peaks | 5–10; 15–50 at 15–30 and 60–120 min | pM | H | low | [T] |
| Intact GLP-1 half-life (DPP-4) | 1–2 | min | H | low | Deacon et al. 1995 [recalled] |
| PYY: onset; plateau | ≤ 15 min; 1–2 h, ∝ energy | — | H | medium | Adrian et al. 1985 [unverified] |
| PYY: fasting; rise | 15–25 pM; 2–3× | — | H | low | [T] |
| Ghrelin: pre-meal rise; trough; depth | ≈ 2× over 1–2 h; ≈ 1 h after eating; −40 to −60 % | — | H | medium; low (depth) | Cummings et al. 2001 [unverified]; [T] |
| Acyl-ghrelin half-life | ≈ 10 | min | H | low | [T] |
| Motilin; gastrin | peaks with gastric phase III; 2–3× after meals | — | H | medium; low | Vantrappen et al. 1979 [recalled]; [T] |
| CCK satiation after abdominal vagotomy | abolished | — | R | high | Smith et al. 1981 |

```
dX/dtH = R_X − (X − X_b)/τ_X, τ_X = t½/ln 2 (EN);  ℓ_X = R_X low-passed, τ 1 min (GI)
R_ghrelin follows habitual meal times (procC, §3) minus absorption;  R_insulin = cephalic (§8.13) + absorption + g.neuroendocrine·glp1
```

The other release rates R_X follow the stimuli in the cell table. All gains are calibrated to the §12 meal (§8.13). `ghrelin`, `motilin`, `gastrin`, `insulin` and `ec5ht` are relative (fasting = 1); `cck`, `glp1` and `pyy` are in pM (A.3.4).

### 8.11. Serotonin and dopamine in the gut

EC-cell 5-HT has three routes:
- it activates IPAN mucosal terminals (`enteric`);
- it activates vagal 5-HT3 afferents that carry nausea-related input to the NTS (`autonomic`);
- platelets take it up through SERT.

Gut 5-HT does not cross the blood–brain barrier (Gershon & Tack 2007 [recalled]; [T]), so `ec5ht` never feeds `mod5HT` (§3). Gut dopamine is likewise peripheral and is not coupled to DOPAMINE.md, which stays canonical for central dopamine.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Gut share of body 5-HT | ≈ 90–95 | % | H | medium | [G Enteric_nervous_system L63] (> 90 %); Gershon & Tack 2007 [recalled] |
| Brain share of body 5-HT | ≈ 1–2 (estimates up to ≈ 5) | % | H | low | [T] |
| EC-cell share of gut 5-HT (rest in enteric neurons) | ≈ 90 | % | H, rodent | low | [T] |
| Gut share of body dopamine | ≈ 50 | % | H | medium | [G Myenteric_plexus L67]; Eisenhofer et al. 1997 [recalled] |
| Microbial control of EC 5-HT synthesis | spore-forming bacteria promote it | — | Ms | medium | Yano et al. 2015 |

### 8.12. Microbiota

Colonic bacteria and their short-chain fatty acids act on EEC, immune cells and vagal endings. Enteric neurons, glia, EEC and macrophages relay these signals by humoral and neural routes ([G Neuroimmune_system L49]). The causal evidence is from rodents and plays out over days:
- germ-free mice have an exaggerated HPA response to restraint (Sudo et al. 2004);
- the behavioural effects of a *Lactobacillus* strain disappear after vagotomy (Bravo et al. 2011).

On scenario time scales the model therefore treats the microbiota as a fixed setting.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Bacteria, 70 kg man; per human cell | 3.8 × 10¹³; ≈ 1.3 | — | H | medium | Sender, Fuchs & Milo 2016 |
| Density in colonic content | ≈ 10¹¹ | per g | H | low | Sender, Fuchs & Milo 2016 [recalled] |
| SCFA, proximal colon; acetate : propionate : butyrate | 70–140 mM; ≈ 60 : 20 : 20 | — | H | low | Cummings et al. 1987 [recalled] |
| Setting `microbiota` | `eubiotic` (default); `germFreeLike`: EC 5-HT synthesis × 0.5, HPA reactivity gain for §9; `dysbiotic`: inflammatory-tone gain for §10 | — | Ms (directions) | low | [model]; Yano et al. 2015; Sudo et al. 2004 |

### 8.13. Cephalic phase and meal readouts

Food cues drive vagal efferents before eating. The effects are acid and pancreatic secretion (first shown by Pavlov, [G Gut_E2_80_93brain_axis L52]), insulin, gastrin and gastric relaxation. Vagotomy abolishes the cephalic acid response (Richardson et al. 1977 [recalled]). In the model, the special-sense route reaches `lh`, `arcuate` and `pvn` (§3, §5). These drive `dmv` and raise `tone.fVagGut` (§7). The cephalic phase therefore needs `special` ∧ `autonomic`, and insulin action also needs `neuroendocrine` (A.5). Salivation belongs to §7.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Food cue to rise in `dmv` command | ≤ 1 | s | — | low | [model] |
| Cephalic insulin: onset; duration | ≈ 2; ≈ 10 | min | H | low | [T] |
| Cephalic share of meal-stimulated acid | ≈ one-third | — | H | low | Richardson et al. 1977 [recalled] |
| Model `tone.fVagGut` request; insulin; gastrin | + 0.3 for the cue plus 5 min; + 0.3 (rise 2 min, τ 5 min); + 0.3 | relative | — | low | [model] |

For the `meal` scenario (inputs §12, all networks on), the expected gut readouts are:
- `fed` becomes true at the first swallow and aborts any phase III (§8.6);
- swallowing, emptying and hormone responses follow the §8.7, §8.8 and §8.10 rows;
- the model outputs in the table below.

§7 owns the haemodynamics.

| Quantity (`meal` model output) | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Mean `emptyRate` over 60–180 min (r_set 1.84 at 600 kcal, §8.8) | ≈ 1.9 (≈ 1.0 × r_set) | kcal/min | — | low | [model] (§8.8, `brakeGain` 8) |
| Chyme head at the caecum | ≈ 4.4 from meal start, pre-retune; to be re-run with `brakeGain` 8, which delays gastric exit | h | — | low | [model]. Target: the §8.8 capsule figure 4.0–5.9 h is small-bowel transit measured **from gastric exit**, so from meal start the head is expected at the gastric lag (≈ 0.5 h) plus that transit, ≈ 4.5–6.5 h. Capsule transit also includes waiting for phase III, so it is an indirect target for a nutrient front; a breath-test nutrient-front target would be better |
| Stomach below 15 kcal; MMC return | ≈ 4.6 (expected 4–6 [T]); ≈ 5–6 | h | — | low | [model] (`brakeGain` 8) |
| `satiety`; `hunger` by meal end | > 0.7; < 0.2 | 0–1 | — | low | [model] (§8.14) |

### 8.14. Gut–brain routes and central integration

Gut signals reach the brain by four channels:
- fast neural (vagal and spinal afferents);
- paracrine-to-neural (EEC to vagal endings);
- humoral (EEC → blood → `areaPostrema`, `arcuate` at `portCVO`; §8.10 kinetics plus §9 circulation);
- immune or microbial (§10, §8.12).

The vagal and humoral satiation routes overlap, so either still acts alone; the humoral route is slower (Smith et al. 1981; [T]). Interoceptive signals ascend by two routes ([G Interoception L27, L29]):
- lamina I spinothalamic projections (`portSpinoVisc` → `thalVPL`, `thalVMpo` → `insPost`, `dacc`);
- solitary-nucleus projections to the thalamus, insula, somatosensory and anterior cingulate cortex.

The solitary nucleus also carries information from the stomach to PVN CRH neurons ([G Paraventricular_nucleus_of_hypothalamus L80]). The graph has no parabrachial or area postrema node, so those relays rest on Craig 2002 and [T].

| Route | Path | nets | Latency | Species | Conf. | Source |
|---|---|---|---|---|---|---|
| Vagal mechanical | IGLE/IMA → `nodoseGang` → `ntsVisc` | `autonomic` | ≈ 0.5 s (stomach) | — | medium | §2, §4 |
| Neuropod synapse | EEC → glutamate → nodose neuron | `autonomic` | EPSC 60–800 ms after photostimulation (in vitro, n = 9 pairs) | Ms | medium | Kaelberer et al. 2018 |
| Vagal firing in vivo, time to peak | intraluminal stimulus → vagus | `autonomic` | 72.7 ± 20.9 s (EEC photostimulation); 92.8 s (300 mM sucrose) | Ms | medium | Kaelberer et al. 2018 |
| Vagovagal loop incl. muscle | `ntsVisc` → `dmv` → `vagus` → myenteric → muscle | `autonomic`, `enteric` | ≈ 1–2 s | — | low | [model] (§2, §4, §8.5) |

Central roles of the §3 nodes:
- `ntsVisc` drives `dmv`, `pbn`, `pvn` and `arcuate`.
- `pbn` → `thalVMpo`, `thalVPMpc` → `insPost` → `insMid` → `insAnt`, `pgacc`, `sgacc`, `dacc` carries interoception and visceral affect (Craig 2002). Gastric distension activates the insula, cingulate, thalamus and somatosensory cortex (Ladabaum et al. 2001 [unverified]).
- `arcuate`, `lh` and `pvn` integrate hunger: ghrelin excites; PYY, GLP-1 and insulin inhibit.
- `barrington` sets the sacral tone request.

```
satiety* = 1 − exp(−[0.6·m + 0.5·c + 0.8·h]), τ 2 min;  m, c = g.autonomic·(vagMech, vagChem)/r_max (§4);  h = g.neuroendocrine·mean(cck/6 pM, glp1/30 pM, pyy/pyy_peak)
hunger* = clamp01(0.3 + 0.4·g.neuroendocrine·(ghrelin − 1) − 0.8·satiety − sickness.anorexia (§10)), τ 5 min;  brain only: satiety 0, hunger 0.3
[weights and τ: model, low]
```

At rest, a cortical "gastric network" is phase-synchronised with the gastric rhythm (Rebollo et al. 2018, H). It spans somatosensory, medial motor, posterior cingulate, precuneus, occipital, extrastriate body and retrosplenial regions, but not the insula. An optional overlay, off by default and labelled as functional connectivity (A.8 #23), locks `s1`, `s2`, `sma`, `pcc`, `precuneus`, `v1` and `rsc` to the gastric `swPhase`. Its amplitude belongs to §13.

Stress reaches the gut only through §7 channels and §9 hormones. Acute stress suppresses antral motility and the MMC (Stanghellini et al. 1983, H). Central CRF slows gastric emptying and speeds colonic transit (Taché et al. 2001, R). The model reproduces this with the sympathetic antral term and a `pvn`-driven `tone.fSacral` term (§7).

The gut branch of the inflammatory reflex runs `dmv` → `vagus` → enteric cholinergic neurons → α7nAChR on muscularis macrophages. It is independent of the spleen (Matteoli et al. 2014, Ms). BMP2/CSF1 crosstalk between macrophages and enteric neurons tunes motility (Muller et al. 2014, Ms). The branch needs `autonomic` ∧ `enteric` ∧ `neuroimmune` (A.5); its values belong to §10.

### 8.15. Hybrid motility model and interface

The model combines three parts:
- the analytic slow-wave field (§8.4);
- gated contractions with reflex kernels (§8.5, §8.7);
- lumped transit (§8.8).

Layers follow A.4:
- `swPhase` is analytic;
- `gutX`, `gutC`, sphincter tone, the MMC scheduler and afferent rates run in `GI`;
- transit (internal *gastricFine*, *siNutrient[i]*) runs on the 1 s sub-step;
- hormones, `satiety` and `hunger` run in `EN`.

The scratch prototype `gut_proto.mjs` reproduced normal retention and transit, and the qualitative effects of vagotomy, sympathectomy and sacral lesions.

```
gastric: dF_solid/dt = −k1·F_solid; dF_fine/dt = k1·F_solid − k2·F_fine; dV_liq/dt = −(ln 2/t½_liq)·V_liq·G_pyl; emptyRate = k2·F_fine + liquid term
small:   ∂n/∂t = −v ∂n/∂s + D ∂²n/∂s² − n/τ_abs (s 55–345);  v = g.enteric·(fed ? v_fed·(1 − 0.35·g.neuroendocrine·ileal) : v_fast) + phase III sweep
colon:   d colon[k]/dt = in_k − κ_k·colon[k]/τ_c;  HAPC as seeded Poisson events
```

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Motility index | net aboral small-intestinal transit velocity, % of intact fed value | % | — | low | [model] |
| GI striding | 1 s strides when every `ipan[i]` < 0.05 and no sphincter command or MMC window is active | — | — | low | [model]; §11 decides |
| Field cost, 250 cells; at kh 900 with striding | ≈ 11 µs per evaluation (Node); ≈ 0.17 ms/frame at 60 fps | — | — | high; medium | prototype; computed |
| Prototype intact: solids 1 / 2 / 4 h; marker 5 % in colon, 50 % in colon, 50 % expelled | 74 / 46 / 3 %; 4.5, 6.8, 36.5 h (marker rows pre-retune, to be re-run) | — | — | low | `gut_proto.mjs`, solids recomputed at `brakeGain` 8 (§8.8); the earlier 67 / 32 / 0 % came from a softer brake than the one written in §8.8 |
| Prototype vagus off: water at 30 min (intact 25 %), solids; enteric off; neuroendocrine off (solids, earlier set point) | 8 %, 76 / 47 / 8 %; no emptying or transit; 59 / 19 / 0 % | — | — | low | `gut_proto.mjs` |

The module reads the §7 channels, plasma adrenaline (small β2 inhibition, [model], low), `sickness.*` (§10), food cues, `arousalState` and swallow commands. Its outputs go to the ports and readers listed in the §11 coupling table. The display uploads float textures of f(s), λ(s), `gutX` and `gutC`.

On screen, f_screen = f × kh. §13 owns the photosensitivity limit (A.9) and the switch to envelope mode. The table gives the clock rate at which each rhythm reaches 1 Hz and 3 Hz on screen:

| Rhythm (§8.4) | f (Hz) | kh at 1 Hz on screen | kh at 3 Hz |
|---|---|---|---|
| Stomach (2.83 cpm); colonic slow wave (3.0) | 0.047; 0.050 | 21; 20 | 64; 60 |
| Duodenum (11.7); terminal ileum (8.2) | 0.195; 0.137 | 5.1; 7.3 | 15; 22 |
| Colonic MPO (17.8) | 0.297 | 3.4 | 10 |

At the `gut` preset (×10), the small intestine exceeds 1 Hz on screen and MPOs approach 3 Hz. MPOs are subthreshold, so they should never be drawn cycle by cycle.

### 8.16. Switch-off and intervention behaviour

This expands A.5 for the gut. §11 owns the general semantics and §12 the outcome matrix.

| Condition | Gut behaviour | Tag |
|---|---|---|
| Brain only | Gut hidden and frozen; reset to fasting rest on return. Food-cue commands end at `portVag` as efference only. `meal` unavailable. | "—"; `satiety` 0, `hunger` 0.3 |
| Somatic off | No swallow and no striated peristalsis; EAS tone 0. In `meal`, boluses enter at s 7 cm on schedule. | "ingestion maintained (model assumption)" |
| Autonomic off | The ENS keeps peristalsis, local reflexes, secretion, the RAIR and a small-bowel MMC uncoupled from the stomach (antral-origin probability × 0.3). Lost: cephalic phase, accommodation, half the antral pump, TLESRs, vagal satiety, gut sensation, sympathetic brake, sacral drive. Gastrocolonic gain 0.3. | "extrinsically denervated" |
| Enteric off | Slow waves persist with weak contractions that do not propagate. No reflex kernels, MMC, secretomotor reflexes or RAIR. All four sphincters closed; emptying and transit stall (§8.5, §8.8 rows). Vagal motor acts only on the striated oesophagus; `vagMech` × 0.5 (IGLEs sit in the ganglia). EEC release continues. The gut branch of the inflammatory reflex fails. Shown quietly. | "Motility index ≈ 0" |
| Neuroendocrine off | Plasma gut hormones at basal; ℓ_X continues. Emptying slightly faster; no motilin-triggered gastric phase III; no ileal brake; satiety from vagal signals only; cephalic insulin has no action. | "basal" |
| Neuroimmune off | Macrophage brake and microbiota–immune coupling removed; no sickness-related gut slowing or anorexia. | — |

| Intervention (owner) | Gut effect | Source |
|---|---|---|
| Truncal vagotomy (§7) | Gut `dmv` efferents and vagal afferents removed: A halved, faster water emptying, no TLESRs, no cephalic phase or CCK satiety, MMC uncoupled. A highly selective option spares the antrum and pylorus. | [G Vagotomy L33, L39–L40]; Minami & McCallum 1984 |
| Atropine (§7) | Excitation × 0.4 (tachykinergic share), less secretion, slower emptying; ganglionic nicotinic transmission intact | [model]; [T] |
| T2–T3 sympathectomy; pure autonomic failure (§7) | Sympathectomy: no gut effect (gut outflow is T5–L2). Pure autonomic failure: sympathetic gut drive per the §7 preset, colonic κ × 0.7. | [T]; [model] |
| Spinal cord injury (§6) | C2–T6: no spinal visceral input from below, vagus intact, gastrocolonic gain 0.3, slower colon, RAIR back after spinal shock. T10, L2: partial splanchnic loss. S2: sacral and EAS loss, RAIR kept. | Krogh, Mosdal & Laurberg 2000 [unverified]; [T] |
| Dorsal rhizotomy (§6); splenic denervation, VNS (§10) | Rhizotomy: spinal visceral afferents lost at the cut roots. Splenic denervation spares the gut macrophage branch; VNS strengthens it. | [T]; Matteoli et al. 2014; [model] |

| Quantity (clinical anchor) | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Hirschsprung disease: incidence; male : female | ≈ 1 in 5,000; ≈ 4 : 1 | births; ratio | H | high | [G Hirschsprung_27s_disease L44]; [G Myenteric_plexus L79] |

Clinical analogues of enteric off:
- Hirschsprung disease: both plexuses absent from the arrest point to the anus, no RAIR ([G Myenteric_plexus L78]; Rao et al. 2002);
- achalasia: fewer myenteric ganglion cells and an LES that does not relax ([G Myenteric_plexus L81]; [T]);
- chronic intestinal pseudo-obstruction from ICC loss ([G Interstitial_cell_of_Cajal L73]).

Orgasm scenario: the gut only follows the §7 channels and writes nothing to `response.js` or DOPAMINE.md variables, so the traces stay identical (§11; A.8 #21).

### 8.17. Interoceptive gut stimuli

The manual panel offers three gut modes (A.6); §5 owns their ranges and thresholds. Each stimulus is a physical input to the gut state:

| Mode (site) | Input | Transducers → afferents | Outputs | Requires |
|---|---|---|---|---|
| `gastricDistension` (`stomachWall`) | balloon volume added to the stomach | IGLE, IMA, IPANs → `vagMech`; `spinNoci` (T6–T9) above the §5 discomfort threshold | accommodation; TLESR above the trigger volume; local peristalsis; satiety | `autonomic` (afferents, accommodation); `enteric` (local reflexes, NANC) |
| `duodenalLipid` (`duodenum`) | lipid kcal at s 55–80 | I cells, neuropod EEC, mucosal endings → `vagChem` | antral suppression, pyloric closure, `cck` rise, satiety | `autonomic`; `enteric` (intestinofugal arm); `neuroendocrine` (blood CCK) |
| `colorectalDistension` (`colonRectum`) | volume added to `rectalVol` | rectal IPANs; pelvic and lumbar afferents → `spinNoci` (S2–S4, L1–L2) | RAIR; sensation, urge, pain (§5); sympathetic response if noxious | `enteric` (RAIR); `autonomic` (sensation) |

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| `vagMech` | §4 sigmoid of gastric volume (half-activation 300 mL) + 0.3 × antral `gutC`; 2 Hz at fasting rest; × 0.5 with enteric off | Hz | — | low | [model]; IGLE site (Zagorodnyuk & Brookes 2000) |
| `vagChem` | §4 sigmoid of (ℓ_cck/3 pM + emptyRate/1 kcal/min + local `ec5ht` − 1) | Hz | — | low | [model] |
| `spinNoci` | 0 below the §5 discomfort threshold, §4 sigmoid above it | Hz | — | low | [model] |

### 8.18. Tests and validation targets

| # | Headless test (§11 harness) | Target | Owner |
|---|---|---|---|
| 1 | Intact 255 kcal solid meal | retention inside 37–90 / 30–60 / 0–10 % at 1 / 2 / 4 h | §8.8 |
| 2 | Marker transit | small-bowel head 3–6 h; colon 18–40 h | §8.8 |
| 3 | Slow waves | f within ± 2 %; pacemaker to pylorus 40–60 s; no fundic phase | §8.4 |
| 4 | Fasting, 50 cycles | median period 110 ± 15 min; phase III 5–10 min; duodenal front 3.5–5.5 cm/min | §8.6 |
| 5 | Enteric off; autonomic off; neuroendocrine off | Enteric off: emptying < 5 % of intact at 4 h, sphincters closed, slow waves present. Autonomic off: small-bowel MMC present, antral-origin fraction < 0.2, no cephalic phase, water t½ shorter, 4 h solid retention higher. Neuroendocrine off: hormones basal, 1 h solid retention lower. | §8.16 |
| 6 | `tone.fSymGut` step, 30 s | antral `gutC` amplitude falls by 40 % or more within 10 s | §8.5 |
| 7 | Duodenal lipid 30 kcal | first sustained rise of `vagChem` above its resting rate ≥ 20 s after the lipid reaches s 55–80, time to peak 60–120 s (§8.14: 72.7 ± 20.9 s for EEC stimulation, 92.8 s for 300 mM sucrose); `cck` peak at 10–30 min. The ≤ 1.5 s packet latency is kept only as the §8.9 conduction check for a packet already in flight: `vagChem` fires at 2 Hz at fasting rest, so a "first packet" inside 1.5 s is true whatever the stimulus and would invite the sub-second whole-animal reading §8.20 warns against | §8.14; §8.10 |
| 8 | `meal` | §8.13 readouts inside their windows | §8.13 |
| 9 | Colorectal distension 50 mL | IAS relaxes with enteric on, whatever the autonomic state; not with enteric off | §8.7 |
| 10 | Display | no per-cycle rendering above the §13 limit for kh 0.005–3,600 | §13 |
| 11 | Determinism; orgasm regression | bit-identical traces per seed at any fps and headless; no writes to `response.js` or DA variables | §11 |

### 8.19. Capture corrections for §1

| Capture | Problem | Correction |
|---|---|---|
| [G Neuromodulation L77]; [G Volume_transmission L77] | brain 10 %, gut 80–90 % of body 5-HT | gut ≈ 90–95 %, brain ≈ 1–2 % (§8.11) |
| [G Vagotomy L31] | vagotomy said to denervate "the left side of the transverse colon" | vagal territory is the proximal two-thirds (§8.2) |
| [G Myenteric_plexus L43, L78] | enteric neurons called parasympathetic | the ENS is a separate network (§8.1) |
| [G Myenteric_plexus L47] | "30 %" sensory, no species given | guinea-pig value; human share unknown (§8.3) |
| [G Interstitial_cell_of_Cajal L60–L63] | single rounded frequencies | stomach 2.83 cpm, uniform over corpus and antrum; small intestine in plateaus (§8.4) |

### 8.20. Open questions

- Human data gaps (all low): regional ENS counts and class shares; ileal slow-wave velocity (the jejunal value of Angeli et al. 2018 is applied along the whole small intestine); reflex extents; hormone half-lives; PYY and GLP-1 basal values. Energy-delivery data for 600 kcal mixed meals are also missing; the rule r_set ∝ √E₀ is a model choice.
- Fibre class of `dmv` → gut: abdominal vagal axons in the rat are mostly unmyelinated. §4 must choose `B` (efferent leg ≈ 65 ms over 521 mm, §2.14) or `C` (≈ 0.5 s).
- Placeholder values:
  - IGLE survival without the ENS (× 0.5);
  - gastrocolonic gain without extrinsic nerves (0.3);
  - atropine tachykinergic share (0.4);
  - colonic κ in pure autonomic failure (× 0.7); the disease also involves enteric neurons;
  - TLESR trigger volume and `vagMech` half-activation.
- MMC after extrinsic denervation: no human data were found. The dog figure (88 % normal sequence at 12–20 months) is [secondary].
- `meal` with somatic off uses "ingestion maintained"; §12 must confirm this or grey the scenario.
- `microbiota` is a new setting; §9, §10 and §11 must agree to it, or it is dropped.
- The extrastriate body area in the Rebollo et al. 2018 network has no `area` id; §3 may add `eba`.
- §11 must accept or replace GI striding.
- Neuropod signalling is fast only at the synapse (§8.14). Displays must not imply a sub-second whole-animal response.
- A `rectalVol` reset policy for long runs is needed, since evacuation is not simulated.
- §13 picks the EC-cell 5-HT tint, shared with the raphe and distinct from the dopamine amber.
- `insulin` is a relative scalar without a glucose model; glycaemia is out of scope.
- An optional mucosal-stroke stimulus (EC 5-HT → IPAN → local reflex) is outside A.6; §5 and §11 decide whether to add it.
- The graph lacks parabrachial and area postrema nodes. New captures plus `graphify update .` would let those relays be traced.

### 8.21. Sources

Peer-reviewed: Abell et al. 2008; Adrian et al. 1985; Agostoni et al. 1957; Angeli et al. 2018, *Neurogastroenterol Motil* (human jejunal slow waves; abstract); Baker et al. 2019 (J Neurogastroenterol Motil, PMC6326202; full text read); Bayliss & Starling 1899; Berthoud & Powley 1992; Bravo et al. 2011; Brener, Hendrix & McHugh 1983; Brookes 2001; Craig 2002; Cummings et al. 1987; Cummings et al. 2001; Deacon et al. 1995; Diamant & Bortoff 1969; Eisenhofer et al. 1997; Elashoff, Reedy & Meyer 1982; Furness et al. 2014; Gershon & Tack 2007; Gribble & Reimann 2016; Helander & Fändriks 2014; Hunt & Stubbs 1975; Jänig & Morrison 1986; Kaelberer et al. 2018 (Science 361:eaat5236, PMC6417812; latencies checked); Kahrilas et al. 2015; Kellow et al. 1986; Krogh, Mosdal & Laurberg 2000; Ladabaum et al. 2001; Liddle et al. 1985 (abstract only); Matteoli et al. 2014; Metcalf et al. 1987; Minami & McCallum 1984; Mittal et al. 1995; Muller et al. 2014; O'Grady et al. 2010 (full text read); Ouyang, Sunshine & Reynolds 1989; Prechtl & Powley 1990; Rao et al. 2000; Rao et al. 2002; Rebollo et al. 2018 (full text read); Richardson et al. 1977; Sanders, Koh & Ward 2006; Sanders, Ward & Koh 2014; Sarosiek et al. 2010 (full text read); Sender, Fuchs & Milo 2016; Smith et al. 1981; Stanghellini et al. 1983; Sudo et al. 2004; Szurszewski 1981; Taché et al. 2001; Tack et al. 2006; Tougas et al. 2000; Trendelenburg 1917; Vantrappen et al. 1977; Vantrappen et al. 1979; Yano et al. 2015; Zagorodnyuk & Brookes 2000.

Secondary: Rae et al. 1998, human colonic rhythms (via reviews); dog jejunoileal autotransplant series (via the enteric lens).

Textbooks: Furness 2006, *The Enteric Nervous System*; standard gastrointestinal physiology and anatomy texts for every [T] entry.

Raw captures (`brain-system/raw/`, lines as tagged in the text): Autonomic_nervous_system; Baroreflex; Enteric_nervous_system; Gut_E2_80_93brain_axis; Hirschsprung_27s_disease; Interoception; Interstitial_cell_of_Cajal; Myenteric_plexus; Neuroimmune_system; Neuromodulation; Paraventricular_nucleus_of_hypothalamus; Parasympathetic_nervous_system; Pelvic_splanchnic_nerves; Pudendal_nerve; Submucosal_plexus; Sympathetic_nervous_system; Vagotomy; Vagus_nerve; Volume_transmission.

Model checks, not sources: `gut_proto.mjs`, `lengths.mjs` (scratch, research-enteric).

---

## 9. Neuroendocrine network

### 9.1. Architecture of the network

The neuroendocrine network (`neuroendocrine`; sub-networks `ne.hpa`, `ne.sam`, `ne.post`, `ne.raas`, `ne.gut`, `ne.scalar`) is one HUD switch, separate from `neuroimmune` (A.8 decision 3). The two must stay apart because their lesions differ and because the model's AND gates need them separable: adrenal adrenaline is `autonomic ∧ neuroendocrine`, baroreceptor-driven vasopressin is `autonomic ∧ neuroendocrine`, and cortisol acting on immune cells is `neuroendocrine ∧ neuroimmune` (A.5; §10 owns the immune side of that gate).

Four coupled blocks sit behind the switch, each a chain of `nucleus` → `gland` → `pool` nodes with explicit transport edges rather than one lumped "endocrine" node:

| Block | Chain | Edge kinds | Sub-network |
|---|---|---|---|
| HPA | `pvn` (parvocellular) → `medianEminence` → `pituitaryAnt` → blood → `adrenalCortex` → `cortisol` | `portal`, `blood` | `ne.hpa` |
| SAM | `cord.T5…T11.iml` → `splanchnicGreater` → `adrenalMedulla` → `adrenaline` | `axon` (B), `blood` | `ne.sam` |
| Posterior pituitary | `pvn`/`son` (magnocellular) → `stalk` → `pituitaryPost` → `avp`, `oxytocin` | `axon` (`cns`), `blood` | `ne.post` |
| Renal and scalar | `raas`; `hpt`, `hpg`, `prolactin`; distant actions of gut hormones | `blood` | `ne.raas`, `ne.scalar`, `ne.gut` |

The anatomical point this layout teaches for free is that the hypothalamus reaches the two pituitary lobes by two different routes. CRH and the co-secretagogue vasopressin are released from neurosecretory nerve terminals at the median eminence, CRH travelling to the anterior lobe through the portal blood vessel system of the hypophyseal stalk, while magnocellular vasopressin and oxytocin reach the posterior lobe by axonal transport and are secreted from the nerve endings directly into the systemic circulation [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L43; G Neuroendocrinology L31, L45, L49, L69]. Anterior-lobe endocrine cells are, in mammals, not directly innervated at all [G Neuroendocrinology L51] — which is why the portal edge, not an axon, is the only brain → adenohypophysis link in the graph.

`pvn` is the single hub, and no new hub is invented. The capture gives it magnocellular neurosecretory cells projecting to the posterior pituitary, parvocellular neurosecretory cells projecting to the median eminence and thence to the anterior pituitary, parvocellular CRH, vasopressin and oxytocin populations projecting centrally, MC4R-expressing oxytocinergic cells, and afferents from the nucleus of the solitary tract and the ventrolateral medulla (heart and stomach), from the hippocampus (stress regulation), from the arcuate nucleus (metabolic), from the AV3V region (osmolality, angiotensin) and from the suprachiasmatic nucleus (lighting, circadian) [G Paraventricular_nucleus_of_hypothalamus L38, L46, L48, L60, L70–L72, L78, L80, L82, L84]. Graph paths confirm the two routes the model draws: `pvn` → parvocellular neurosecretory cells → `medianEminence`, arcuate → hypothalamus → tuberoinfundibular path → median eminence → hypophyseal portal system, magnocellular cells → vasopressin, `ntsVisc` → `pvn`, and `scn` → `pvn` (`graphify path`, all one to four hops).

Four axes exist and only the first is modelled in full: the HPA, HPG and HPT axes and the hypothalamic–neurohypophyseal system are the four major neuroendocrine systems through which the hypothalamus and pituitary direct neuroendocrine function [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L33; G Hypothalamic_E2_80_93pituitary_E2_80_93th L29]. That grouping is the shape of the HUD sub-list: HPA in full, neurohypophyseal as release, HPT and HPG as scalars (§9.7).

### 9.2. Nodes, coordinates and geometry changes

Brain coordinates follow A.2 precedence: existing `anatomy.js` entries, as revised by the DOPAMINE.md §7.3 port (Phase 0a, B.15), are never moved, and the neuroendocrine lens's own body coordinates are rejected (A.8 decision 18) — its adrenals at z −1,030 belong to an inconsistent scale. Every body coordinate below is a reference to §2, which owns them, including the A.2 anchors adrenals R (42, −42, −447), L (−38, −36, −448), spleen (−108, −55, −458) and coeliac ganglia (±18, −10, −470).

| Structure | id | Position (x, y, z) mm | Extent mm | Frame | Conf. | Source |
|---|---|---|---|---|---|---|
| PVN (post-port) | `pvn` | (3.5, −4, −6) | r 1.5 × 3.0 × 2.4 | MNI | high | DOPAMINE.md §7.3 (coded (3, −4, −6) r 1.8 × 3 × 2.4, `src/anatomy.js` L170) |
| Median eminence (existing lantern field; its own region after the port) | `medianEminence` | (0, −6, −15) | r 2.5 × 2.5 × 1.5, mid | MNI | medium | `src/anatomy.js` L242; DOPAMINE.md §7.3 region split |
| Pituitary gland, whole (region `pituitaryGland` after the port) | `pituitary` | (0, 0, −32) | r 6.0 × 4.5 × 3.0, mid | MNI | high | `src/anatomy.js` L172; DOPAMINE.md §7.3 |
| Stalk (existing tube) | `stalk` | (0, −6, −15) → (0, −1, −28) | r 1.1–1.3, mid | MNI | high | `src/anatomy.js` L173 |
| Anterior lobe: gland stars with y > −2 | `pituitaryAnt` | centroid (0, 0.7, −32) | the label rule defines the lobe, not a separate ellipsoid; 81.3 % of the gland volume | MNI | medium | A.3.3 split [model]; Monte Carlo centroid |
| Posterior lobe: gland stars with y ≤ −2 | `pituitaryPost` | centroid (0, −2.9, −32) | label rule; 18.7 % of the gland volume | MNI | medium | A.3.3 split [model]; Monte Carlo centroid |
| Arcuate / A12, TIDA (post-port) | `arcuate`, `a12` | (3, −7, −13) | arcuate r 1.0 × 3.0 × 2.0; A12 r 1.0 × 2.6 × 1.8 | MNI | high | DOPAMINE.md §7.3 (coded (2, −7, −13), `src/anatomy.js` L171, L190) |
| Medial preoptic area (post-port) | `mpoa` | (4, 4, −10) | r 2.0 × 3.2 × 3.0 | MNI | high | DOPAMINE.md §7.3 (coded (3.5, 4, −10) r 2.6 × 3.2 × 3, `src/anatomy.js` L169) |
| `son scn ovlt sfo areaPostrema ntsVisc dmv cea hippocampus insPost` | as named | → §3 | → §3 | MNI | — | owner §3 (A.2 precedence) |
| Adrenal cortex and medulla (concentric) | `adrenalCortex`, `adrenalMedulla` | → §2 | cortex outer shell, medulla inner core | body | — | owner §2 |
| Thyroid, kidney, liver, pancreas | `thyroid kidney liver pancreas` | → §2 | → §2 | body | — | owner §2 |

Two geometry consequences. First, the `pituitary` ellipsoid is split into `pituitaryAnt` and `pituitaryPost` by the A.3.3 rule rather than re-placed, so brain-only rendering is unchanged from the post-port build except for the new label boundary (§13). Second, modelling the adrenal as two concentric shells on one §2 anchor, rather than as two separate points, is what lets the HPA and SAM blocks be lesioned independently at the same place (§9.9). The PVN's own neuron count and its share of brain volume are §3's (and the capture's rat figure of ≈ 100,000 neurons in ≈ 0.5 mm³ is corrected as rodent in §1).

### 9.3. HPA axis: stages, transport routes and feedback

Three signalling stages, two transport routes. PVN parvocellular neurons synthesise and secrete vasopressin and CRH; CRH and vasopressin act synergistically on anterior-lobe corticotropes to release stored ACTH, cleaved from proopiomelanocortin; ACTH is transported by the blood to the adrenal cortex, where it rapidly stimulates biosynthesis of corticosteroids such as cortisol from cholesterol, mainly in the zona fasciculata [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L27, L39–L41, L43; G Cortisol L57]. The model therefore carries a short portal delay, a long systemic delay (§9.8) and — dominating both — an adrenal biosynthesis delay (§9.4).

Four feedback terms, each a separate gain so that one lesion can remove one limb:

| Limb | Site | Sign | Mechanism | Species | Conf. | Source |
|---|---|---|---|---|---|---|
| Cortisol → hypothalamus | `pvn` | − | reduces CRH and vasopressin secretion | H | high | [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L49] |
| Cortisol → pituitary | `pituitaryAnt` | − | directly reduces cleavage of POMC into ACTH and β-endorphins | H | high | [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L41, L49] |
| Cortisol → hippocampus → PVN | `hippocampus` | − (slow) | partial MR + GR control of CRH release; hippocampal inputs to CRH neurons are "important regulators of stress responses" | H, R | medium | [G Paraventricular_nucleus_of_hypothalamus L80]; Andersen, Vinther & Ottesen 2013 [secondary] |
| Adrenaline and noradrenaline → pituitary | `pituitaryAnt` | **+** | adrenal-medullary E/NE increase the breakdown of POMC into ACTH and β-endorphins | H | high | [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L50] |

The positive limb is easy to omit and should not be: it is what makes the fast SAM channel partly responsible for the slow one. Its permissive counterpart runs the other way — E/NE are produced by the adrenal medulla through sympathetic stimulation **and the local effects of cortisol**, which upregulates the synthesising enzymes [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L50] (the enzyme evidence is largely rodent adrenal). The two axes are therefore mutually amplifying on the minutes-to-hours scale, not merely parallel.

Brain-tissue feedback uses two receptor classes, not one gain. In the brain cortisol acts on mineralocorticoid and glucocorticoid receptors, expressed by many types of neuron, and the hypothalamus is one important glucocorticoid target [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L43; G Cortisol L61]. The model splits them: a high-affinity MR term carries the tonic, circadian-baseline occupancy and a low-affinity GR term is recruited only during stress. This reproduces why the axis is tightly regulated at rest yet still responsive, and it gives the HUD a "feedback occupancy" readout instead of a bare cortisol number.

The entry point from a stimulus is the amygdala, in parallel with the sympathetic outflow: sensory information arriving at the lateral aspect of the amygdala is conveyed to its central nucleus, and at the hypothalamus those impulses activate both the sympathetic nervous system and the modulating systems of the HPA axis; connections between amygdala, hippocampus, prefrontal cortex and hypothalamus facilitate HPA activation [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L58]. So one `cea` activation fans out to both channels of §9.6, and the manual stimulus panel (§5, §12) needs no separate endocrine trigger. CRH itself fans out twice: CRH receptors within sympathetic ganglia raise adrenal nerve activity directly, and interrupting CRH weakens the ACTH response [G Sympathoadrenal_system L43] (rodent ganglionic CRF-receptor work).

### 9.4. HPA kinetics, parameters and the delay loop

The axis is a delay ODE, not a cascade of instantaneous gains: the delay is what produces the pulsatility, and without it the system does not oscillate (Walker, Terry & Lightman 2010, R). The model carries **two** glucocorticoid variables, for a reason established by the stability check below: a fast feedback-carrying signal `S` (adrenal output and free glucocorticoid at the corticotrope) and the slow plasma total pool `cortisol`, which is what the HUD displays.

Every pool is a ratio to its basal value (`crhRel`, `acthRel`, `S`, `cortisolRel`, `adrenalineRel`; basal 1), and §9.9 converts to display units. Time is in minutes. Each production term carries its removal rate, so basal = 1 at basal drive.

```
dCRH/dt      = k_CRH  · (C(tH) · drive(tH) · F(S) − CRH)
dACTH/dt     = k_ACTH · (CRH · F(S) · (1 + e_E · (adrenalineRel − 1)) − ACTH)
dS/dt        = k_S    · (ACTH(tH − τ_adrenal) − S)
dcortisol/dt = k_C    · (S − cortisol)
F(S)         = 2 / (1 + (S/K)^n),  K = 1 (basal S), so F(1) = 1; the same F acts at `pvn` and `pituitaryAnt`
drive(tH)    = 1 + G_s · u_stress(tH) + k_cyto · pge2 · g.neuroimmune      (u_stress: §12.3 profile; k_cyto §10.5)
C(tH)        = (1 + a_C · procC(tH)) · (1 + a_CAR · α(tH − t_wake; 15 min))  (procC and the wake transition from §3; α unit-peak)
```

The MR term is near saturation at basal and is absorbed into the normalisation; F is the GR-recruited feedback, and the MR/GR occupancy readout of §9.3 is computed from S for display only.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Hill exponent n (default; non-pulsatile option) | 6; 4 | — | — | low | [model]: with feedback at both sites and K = basal S the Hopf threshold is n ≈ 4.8 (row below), so n = 6 pulses and n = 4 is stable. The secondary tabulation gives 4 |
| Stress gain G_s | 6 | — | — | low | [model] (A.8 #24 defaults) |
| Adrenaline → ACTH gain e_E (§9.3 positive limb) | 0.2 | per unit of the adrenaline ratio | — | low | [model] |
| Circadian gain a_C; awakening gain a_CAR | 0.6; 1.0 | — | — | low | [model] |
| `k_CRH` removal | 0.1732 | 1/min (t½ ≈ 4.0 min, arithmetic) | H | low | Andersen, Vinther & Ottesen 2013 via arXiv:2311.04570 Table 2 [secondary, unverified] |
| `k_ACTH` removal | 0.0315 (calibration target 0.046–0.069) | 1/min (t½ ≈ 22 min, arithmetic; target t½ 10–15 min) | H | low | as above [secondary, unverified]. The 22 min is probably a mis-assignment: deconvolution in healthy men gives ACTH t½ 15 ± 1.2 and 17 ± 0.6 min, and the same insulin study reports ACTH 17, β-endorphin 22 and cortisol 65 min, so the tabulation's pair (22, 66) matches cortisol exactly and matches β-endorphin's value for ACTH. Shortening it is one half of the §9.10 timing calibration and needs the Hopf threshold re-run |
| `k_C` plasma cortisol removal | 0.0105 | 1/min (t½ ≈ 66 min, arithmetic) | H | low | as above [secondary, unverified]; **well sourced**: deconvolution in healthy men gives cortisol t½ 65 ± 5.3 min, inside the 60–90 min plasma range [T]. This row is therefore not the free parameter the timing fix may change |
| `k_S` fast feedback-signal clearance | 0.069 (t½ ≈ 10 min) | 1/min | — | low | [model], chosen so the pulse period matches §9.5 |
| `τ_adrenal` transport + biosynthesis delay | 10 (9.4–15) | min | R (model parameter) | low | Walker, Terry & Lightman 2010 [unverified, via Walker et al. 2012]; delays used in a rat model, not a measured human quantity |
| ACTH latency after CRH challenge | 10 (significant, p < 0.005) | min | R | high | Walker et al. 2012 |
| Corticosterone latency after CRH challenge | 20 (significant, p < 0.05) | min | R | high | Walker et al. 2012 |
| ACTH peak after 100 µg i.v. ovine CRH | ≈ 30 | min | H | low | Müller et al. 1982 [secondary, unverified] |
| Cortisol peak after acute psychosocial stressor onset | 21–40 (significant quadratic effect, t(207) = 4.62, p < .01) | min | H | high | Dickerson & Kemeny 2004 (meta-analysis, 208 studies) |
| Cortisol effect size after stressor termination | d 0.38 (0–20 min), 0.26 (21–40 min), 0.05 n.s. (41–60 min) | — | H | high | Dickerson & Kemeny 2004 |
| Hopf loop gain at τ_adrenal 5 / 10 / 15 min; pituitary-only loop, plasma pool fed back (`k_ACTH`, `k_C`) | 26.3 / 13.6 / 9.3 | — | — | medium | [model] |
| Oscillation period at that threshold, same τ values | 70 / 100 / 124 | min | — | medium | [model] |
| Hopf gain and period at τ 10 min, pituitary-only loop with `k_S` = 0.069/min | 5.4; 66 | —; min | — | medium | [model] |
| Hopf gain and period at τ 5 / 10 / 15 min, the written ODE (feedback at `pvn` and `pituitaryAnt`, `k_S`) | 4.02 / 2.41 / 1.79; 56 / 75 / 91 | —; min | — | medium | [model], `verify-editor` linear check |
| Effective feedback gain of F at basal | n · r^n / (1 + r^n) with r = S_basal / K; = n/2 at K = basal | — | — | high | arithmetic |
| Sustained pulses, constant basal drive (nonlinear, 3-day runs) | n = 4 stable; n = 6 period 76.4 min; n = 8 78.0 min. With r ≥ 2 (K below basal) n = 4 pulses at ≈ 96–104 min | — | — | medium | [model], `verify-editor/hpa.mjs`; `verify-math-simulation/hpa2.mjs` |

The Andersen, Vinther & Ottesen 2013 model structure has no slot in these equations. Its tabulated constants are kept only as a reference for a later port (via arXiv:2311.04570 Table 2, all [secondary, unverified]): saturation constants cortisol 1.12 µg/dL, ACTH 0.78 pg/mL, AVP 1.3; Hill coefficients 4, 3, 3; inhibition of CRH by ACTH 0.160 and by cortisol 0.5; inhibition of ACTH by cortisol 0.304; stimulation of CRH outside the SCN 0.5703, by the hypothalamus 0.4342, by AVP 0.2166; of ACTH by CRH 0.0821; of cortisol by ACTH 0.00430. Reading the 1.12 µg/dL constant against a 12 µg/dL basal (r ≈ 10.7) would make the written ODE pulse at ≈ 104 min, outside §9.10.

Three cautions travel with these numbers into the code.

First, the rate rows tagged [secondary] come from a review tabulation rather than the primary papers, and that review's unit column is internally inconsistent (per-minute removal rates listed with concentration units). The rates are usable; the gains are provisional (§9.11).

Second, the stability check is the reason for the two-variable glucocorticoid design and for n = 6. With the plasma pool as the feedback variable, a pituitary-only loop has a threshold period of ≈ 100 min at τ_adrenal = 10 min, too slow for the ≈ 1/h rhythm (§9.5). Feeding back a signal that clears with t½ ≈ 10 min, at both sites as the ODE does, puts the threshold at gain 2.41 and period ≈ 75 min. With K at basal S the Hill gain is n/2, so n = 4 (gain 2) is stable and n = 6 (gain 3) gives sustained pulses at 76.4 min. The pulses are large in ACTH (max/min 2.4) and in S (1.7) but small in the displayed plasma pool (1.07), which the slow `k_C` smooths. The period moves to 74 min at τ 9.4 and 95 min at τ 15. This is a model finding, not a measurement (§9.11).

Third, the GR-homodimerisation term stays in the code although it is unused by default. The four-variable CRH/ACTH/GR/cortisol model yields one or three positive steady states — a normal low-GR state, a dysregulated hypocortisolaemic high-GR state and an unstable intermediate — with bistability arising specifically from homodimerisation of the cortisol–receptor complex and appearing as the scaled GR degradation rate `k_rd` is lowered (Gupta et al. 2007; published scaled parameters `k_cd` 1, `k_ad` 10, `k_rd` 0.9, `k_cr` 0.05, `k` 0.001, `k_i1` 0.1, `k_i2` 0.1, dimensionless, monostable at these values, medium confidence). Per A.8 decision 24 this is an optional mode and the default scenario stays monostable. It is documented here so it is not later removed as redundant.

Model results with these defaults (`verify-editor/hpa.mjs`; stressor drive of §12.3, adrenaline ×4.1 peak, from rest): ACTH ×1.2 at 3.8 min, ×2.34 at 10 min, peak ×3.57 at 17.4 min; cortisol ×1.1 at 31 min, peak ×1.48 at 73 min, below ×1.2 at 182 min (93 min with e_E = 0). Constant drive keeps pulsing up to drive 8 (period 77–97 min), so no saturated plateau emerges: the equations have no secretion ceiling. An awakening drive with a_CAR 1.0 raises cortisol by only 6 % at 66 min. §9.10 scores these.

### 9.5. Pulsatility, the circadian envelope and the awakening response

Pulsatility is an emergent property of the pituitary–adrenal subsystem under a **constant** CRH drive: delayed feed-forward from ACTH to corticosterone plus nonlinear GR-mediated negative feedback is sufficient (Walker, Terry & Lightman 2010, R). With the §9.4 default (n = 6) the HUD therefore shows ACTH pulses without scripting them; with the n = 4 option the axis is non-pulsatile.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Ultradian pulse frequency, CRH-driven | 0.89 (range 0.79–0.93), period ≈ 65–75 | pulses/h; min | R | high | Walker et al. 2012 |
| Interpulse interval, prior experiments | 47.2–54.6 | min | R | medium | via Walker, Terry & Lightman 2010 |
| Cortisol secretory bursts per 24 h, fed state | 22 ± 1.4 | bursts/24 h | H | low | Bergendahl et al. 1996 [secondary, unverified] |
| Cortisol interburst interval, fed state | 65 ± 4.0 | min | H | low | Bergendahl et al. 1996 [secondary, unverified] |
| Cortisol secretory pulses per 24 h (range across studies) | 15–22 | pulses/24 h | H | low | Veldhuis & Iranmanesh 1989 [secondary, unverified] |
| ACTH secretory bursts per 24 h; interburst interval | 40 ± 1.5; 39 ± 2.3 | bursts/24 h; min | H | low | Veldhuis et al. 1990 [secondary, unverified] |
| Cortisol awakening peak | 30–45 | min after waking | H | high | [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L54] |
| Cortisol awakening rise | +50–75 % in the first 30 min (n = 152, three studies) | % | H | medium | Pruessner et al. 1997 [secondary] |
| Cortisol awakening rise, range across studies | +50–160 % in 30 min | % | H | low | Clow et al. 2004 review [secondary, unverified] |
| Circadian period of the CRH envelope | → §3 (`T_circ` 24.2 h) | h | H | — | owner §3 |

The circadian envelope `C(tH)` (form and gains in §9.4) multiplies the **PVN CRH drive**, not the adrenal: CRH release is influenced by stress, physical activity, illness, blood cortisol levels and the sleep/wake cycle, and in healthy individuals cortisol rises rapidly after waking, peaks within 30–45 min and then falls gradually to a trough in the middle of the night, matching the rest–activity cycle [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L54]. Process C, process S and the arousal state machine belong to §3; this section only reads them, and the awakening response is therefore a property of the state transition, not a scheduled event.

Pulsatility is dose-dependent on the drive, which gives the stressor scenario three qualitatively different regimes from one slider rather than simply larger pulses:

| Regime | Drive (rat equivalent) | Behaviour | Conf. | Source |
|---|---|---|---|---|
| Subthreshold | < 0.5 µg/h i.v. CRH | endogenous pulse train unchanged | high | Walker et al. 2012 |
| Pulsatile | ≈ 0.5 µg/h | ultradian oscillations sustained through the infusion | high | Walker et al. 2012 |
| Saturated plateau | 1.0 and 2.5 µg/h | oscillations damped to a constant elevated level (ceiling effect) | high | Walker et al. 2012 |

These are rat infusion rates measuring corticosterone, not human cortisol doses. The HUD exposes the regime as a normalised drive (0–1) with a species note, never as a dose. The scenario's own drive profile is §12's (15 min psychosocial stressor, pulsatile regime).

### 9.6. SAM axis: the fast channel

The sympatho-adrenal-medullary axis is anatomically a sympathetic ganglion substitute, not a stage of the HPA cascade. Stimuli travel through preganglionic fibres emerging from the thoracic spinal cord and activate the adrenal medulla through acetylcholine; chromaffin cells act as the postganglionic element and release noradrenaline and adrenaline directly into the blood, the medulla being a major contributor to total circulating catecholamines; the resulting sympathoadrenal discharge raises heart rate, cardiac output, blood pressure, triglycerides and glucose [G Sympathoadrenal_system L29, L33; G Adrenaline L93]. Two synapses to blood, and the preganglionic drive `fSymAdr` is owned by §7 and only read here. ACTH also binds receptors on medullary cells [G Sympathoadrenal_system L45], a second, slower input to the same gland.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Adrenaline release onset | < 5 | s | H | low | [G Sympathoadrenal_system L29, L37]; onset figure [T] |
| Adrenaline plasma t½ | 2–3 | min | H | high | [G Adrenaline L54] |
| Adrenaline duration of action | "few minutes" | — | H | high | [G Adrenaline L55] |
| Adrenaline plasma protein binding | 15–20 | % | H | high | [G Adrenaline L50] |
| Adrenaline metabolic clearance rate | 52 ± 4 (basal range) → 89 ± 6 (high) | mL·min⁻¹·kg⁻¹ | H | medium | Clutter et al. 1980 [secondary] |
| Basal plasma adrenaline, supine / standing | 44 ± 11 / 73 ± 17 | pg/mL | H | low | Cryer, Santiago & Shah 1980 [secondary, unverified] |
| Adrenaline threshold, heart rate | 50–100 | pg/mL | H | medium | Clutter et al. 1980 [secondary] |
| Adrenaline threshold, lipolysis and systolic pressure | 75–125 | pg/mL | H | medium | Clutter et al. 1980 [secondary] |
| Adrenaline threshold, glucose, lactate, β-hydroxybutyrate, diastolic pressure | 150–200 | pg/mL | H | medium | Clutter et al. 1980 [secondary] |
| Adrenaline threshold, early insulin suppression | > 400 | pg/mL | H | low | Clutter et al. 1980 [secondary] |
| Relative potency, adrenaline : noradrenaline | ≈ 10 : 1 | — | H | medium | Clutter et al. 1980 [secondary] |
| Plasma noradrenaline threshold for haemodynamic or metabolic effect | > 1,800 | pg/mL | H | medium | Silverberg et al. 1978 [secondary] |
| Plasma noradrenaline t½ after infusion | 2.4 ± 0.7 | min | H | medium | Silverberg et al. 1978 [secondary] |
| Basal noradrenaline production rate | 0.7 | µg/min | H | medium | Silverberg et al. 1978 [secondary] |
| Adrenal medullary output ratio, adrenaline : noradrenaline | ≈ 80 : 20 | % | H | low | [T]; not confirmed in any source read (§9.11) |

Two modelling consequences follow from the threshold rows, and they are the reason this section owns them. First, an acute stressor's adrenaline excursion crosses the heart-rate and lipolysis thresholds but not the insulin threshold, so the HUD can state which effects the circulating hormone is actually producing rather than implying that every catecholamine effect is humoral. Second, plasma noradrenaline needs ≈ 1,800 pg/mL before it acts as a hormone, far above resting spillover, so §7's sympathetic effects on heart and vessels are neural and the `noradrenalinePl` pool is a marker, not an effector, except in extreme states.

The timescale contrast is the whole visual point of the stressor scenario, and the capture states the principle directly: as part of the sympathoadrenal system these chemicals act rapidly and dispel quickly, as opposed to the longer-lasting effect of hormones [G Sympathoadrenal_system L37]. One `cea` activation produces two visibly separate waves (§9.3): sympathetic chain → `adrenalMedulla` → `adrenaline`, present within seconds and gone within minutes; and `pvn` → `pituitaryAnt` → `adrenalCortex` → `cortisol`, with the pituitary node brightening within ≈ 10 min and the plasma field peaking, in human data, at 21–40 min from onset (§9.10 scores the model, which peaks later).

Cortisol's metabolic action is a directional scalar suitable for the HUD: gluconeogenesis in liver (and kidney and small intestine under some conditions), reduced glucose uptake in muscle and adipose tissue, decreased protein synthesis, increased lipolysis, amino acids released from muscle as gluconeogenic substrate, reduced peripheral insulin sensitivity, a permissive effect on glucagon and adrenaline, and synergistic action with catecholamines on muscle glycogen breakdown; the net effect is a rise in blood glucose, further complemented by suppression of the metabolically demanding immune system [G Cortisol L71, L73, L75, L77, L81; G Hypothalamic_E2_80_93pituitary_E2_80_93ad L60]. Acute cortisol promotes lipolysis while chronically raised levels are associated with lipogenesis [G Cortisol L81], so the HUD shows the acute direction only and labels it as such.

### 9.7. Posterior pituitary, RAAS and the slow scalars

Vasopressin has two roles the model must keep separate or it will double-count. Parvocellular PVN neurons supply the HPA co-secretagogue, released with CRH at the median eminence and acting synergistically on corticotropes; magnocellular PVN and SON neurons supply the antidiuretic hormone, released when the body is dehydrated, with potent water-conserving renal effects and potent vasoconstriction [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L39, L43, L45; G Paraventricular_nucleus_of_hypothalamus L48, L52, L56, L71; G Neuroendocrinology L49]. Only the second is a `pituitaryPost` → blood edge; the first never leaves the portal system.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| AVP elimination t½ | 10–20 | min | H | high | [G Vasopressin L47] |
| AVP plasma protein binding | 1 | % | H | high | [G Vasopressin L45] |
| Oxytocin elimination t½ | 1–6 (i.v.) | min | H | high | [G Oxytocin L48] |
| Oxytocin plasma protein binding | 30 | % | H | high | [G Oxytocin L46] |
| AVP osmotic threshold | ≈ 280–284 (fit-dependent: 280 in the review tabulation, 284 as the intercept of the line below) | mOsm/kg | H | low | Robertson, Shelton & Athar 1976; Schrier & Goldberg 1980 [secondary, unverified] |
| AVP–osmolality relation | pAVP ≈ 0.63 · (Posm − 284), a linear approximation; pooled data are better described by an exponential | pg/mL | H | low | Baylis & Robertson, normal subjects (r = +0.80) [secondary, unverified] |
| AVP baroreceptor recruitment | steep rise only for large (≈ ≥ 10 %) falls in volume or pressure | — | H | low | [T] (§9.11) |
| `raas` activation / de-activation τ | 2 / 15 | min | — | low | [model], from component kinetics [T] |
| Renin / angiotensin II / aldosterone t½ | ≈ 15 / ≈ 1 / ≈ 20 | min | H | low | [T] |
| Thyroxine (T4) / triiodothyronine (T3) t½ | ≈ 7 / ≈ 1 | d | H | low | [T] |

Baroreceptor-driven AVP is an AND edge (`autonomic ∧ neuroendocrine`): without visceral afferents there is no baroreceptor signal to release it, and without this network its pressor action is absent. RAAS, by contrast, is renal and nerve-independent, which is why it survives an autonomic switch-off and partly restores blood pressure over minutes (A.5, §7); the capture names it as one of the body's two slower-acting blood-pressure systems alongside atrial natriuretic peptide [G Baroreflex L31]. Its cardiovascular consequences are §7's; this section owns only the `raas` pool and its time constants. `mnpo` thirst is §7's effector target [G Medial_preoptic_nucleus L45, L49].

HPT and HPG are slow scalar set-point modifiers only (`hpt`, `hpg`), with no new pelvic geometry, consistent with the content rules of A.1 and A.8 decision 24. The HPT structure is well specified — hypothalamic TRH → pituitary TSH → thyroid T4 (and less T3, most T3 being produced by peripheral deiodination), with negative feedback from both iodothyronines on pituitary and hypothalamus, plus the Fekete–Lechan long loop, the Brokken–Wiersinga–Prummel ultrashort loop and a proposed TSH–T3 shunt [G Hypothalamic_E2_80_93pituitary_E2_80_93th L27, L37, L39, L41, L43] — but with T4 and T3 half-lives of days, `hpt` is effectively constant within any scenario in §12, which is exactly why a scalar is the honest representation. `hpg` is likewise a scalar with no structures below the diaphragm. Cytokine and TSH-receptor-antibody convergence on TSH release [G Hypothalamic_E2_80_93pituitary_E2_80_93th L45] is noted but not modelled; the immune side is §10's.

Prolactin and the TIDA short loop are **not redefined here**. DOPAMINE.md stays canonical for every dopamine quantity and for the orgasm scenario's internals (A.1), including the TIDA short loop, the prolactin closed form and the arcuate → median eminence → lactotroph chain (DOPAMINE.md §5, §6.7). Pituitary prolactin secretion is regulated by the neurosecretory TIDA neurons of the arcuate nucleus [G Prolactin L40], and the project already draws that path to the median eminence and the portal vessels (`src/anatomy.js` L224) — the same `portal` edge the HPA uses. The two models therefore meet at `medianEminence` and `pituitaryAnt` without either being rewired, and `prolactin` remains an output of the response model, read by this network and not driven by it.

The distant, blood-borne actions of gut hormones are `ne.gut`, but all of their secretion and kinetics belong to §8. What this section fixes is where they act centrally: at the circumventricular windows and the arcuate nucleus, whose projections to the lateral hypothalamus (feeding) and ventromedial hypothalamus (satiety) carry the signal onward, with the vagus providing the efferent limb from those centres [G Vagotomy L54]. Cephalic-phase insulin is `special ∧ autonomic`, with its blood-borne action additionally needing this network (A.5).

### 9.8. Hormone access to the brain, and blood transport

Blood-borne peptides do not reach brain tissue anywhere. Interleukins and signals from immune cells access the hypothalamus via the neurovascular unit or the circumventricular organs [G Neuroimmune_system L49], and the PVN itself is protected by the blood–brain barrier although its neuroendocrine cells extend to sites beyond the barrier, in the median eminence and the posterior pituitary [G Paraventricular_nucleus_of_hypothalamus L42]. The model therefore admits blood-borne peptides only at `ovlt`, `sfo`, `areaPostrema` and `medianEminence`, plus the choroid-plexus route that §10 owns for cytokines. Steroids and thyroid hormones are different: being lipophilic they cross the barrier generally, cortisol subject to active efflux and thyroid hormones to specific transporters.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Peptide entry sites to brain tissue | `ovlt`, `sfo`, `areaPostrema`, `medianEminence`, neurovascular unit | — | H, R | high | [G Neuroimmune_system L49]; [G Paraventricular_nucleus_of_hypothalamus L42] |
| Cortisol brain entry | crosses the barrier, but P-glycoprotein (MDR1) limits cortisol entry relative to corticosterone; contested by later in-situ perfusion work | — | Ms, H (post-mortem) | low | Karssen et al. 2001 [secondary, unverified] |
| Thyroid hormone brain entry | transporter-mediated (MCT8, OATP1C1) | — | H | low | [T] |
| Cortisol GABA-A positive allosteric modulation | 1–10 | pM | in vitro / R | medium | [G Cortisol L63] |
| Cortisol GABA-A negative allosteric modulation | 10–1,000 | nM | in vitro / R | medium | [G Cortisol L63] |
| Model blood transport delay, gland → distant target | 10 | s | — | low | [model] |
| Model blood transport delay, `pituitaryAnt` → `adrenalCortex` | 20 | s | — | low | [model] |
| Pulmonary transit time (right heart → left heart) | ≈ 6–8 | s | H | low | MR perfusion studies [secondary, unverified] |
| Lung (pulmonary capillary) → carotid body transit, the peripheral chemoreflex dead time (§7.9) | ≈ 5 (4–8) | s | H | low | [T] (circulation-time tests: arm-to-tongue ≈ 9–16 s minus arm-to-lung ≈ 4–8 s) |
| One complete circulation at rest | ≈ 60 | s | H | low | [T] |

The GABA-A rows matter beyond pharmacology: they are the one documented route by which this slow network can modulate the fast simulation rather than only slow set points. In vitro, cortisol modulates GABA-A biphasically (potentiation at 1–10 pM, inhibition at 10–1,000 nM), but physiological **free** cortisol is ≈ 5–50 nM (total 100–500 nM, of which 5–10 % is free; the §9.9 basal row gives 12 µg/dL ≈ 330 nM total), so it lies in the inhibitory range both at rest and under stress. The optional gain is therefore negative-only and grows with cortisol; the picomolar potentiation is not reachable in vivo and the sign does not flip. The coupling is implemented as a small, labelled gain on inhibitory synaptic strength in §4's terms, off by default [R, in vitro; low].

Transport delays are short compared with the kinetics of §9.4 and are included only so that the `pituitaryAnt` → `adrenalCortex` edge reads as a long edge down the body (§13). The envelope's shape is set by `τ_adrenal`, `k_S` and `k_C`, never by transport. Reusing the project's existing diffuse-modulator machinery for hormone fields is the right call rather than writing a second system — the dopamine model is already specified as a diffuse, volume-transmitted modulator (DOPAMINE.md §3.4, §3.5) — with two changes: the timescale is two to three orders of magnitude slower, and entry is restricted to the windows above.

Clock presets (A.4, owned by §11) that this network uses: `autonomic` ×1 for the catecholamine flash, `endocrine` ×60 for the HPA, `circadian` ×3,600 for the envelope. One trigger can span them because the clock slews at most one decade per screen second in log space, so the stressor scenario opens at ×1 and ramps to ×60 as the cortisol wave develops. No parameter of this network is ever rescaled per clock preset.

### 9.9. Interventions and off-semantics

Interventions remove nodes; switches remove systems (A.8 decision 4). Both are informative here precisely because the brain-side nodes keep computing in every case.

| Intervention | Removes | Result | Conf. | Source |
|---|---|---|---|---|
| Adrenalectomy | `adrenalCortex`, `adrenalMedulla` | cortisol and adrenaline fall to their basal clamps; neither negative-feedback limb closes, so CRH and ACTH rise to saturation while sympathetic nerve traffic is unchanged. PVN and pituitary nodes saturate bright with the body-wide hormone field absent | medium | derived from the feedback structure [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L49–L50] plus adrenal insufficiency physiology [T] |
| Hypophysectomy | `pituitaryAnt`, `pituitaryPost` | ACTH and cortisol lost, so the slow stress response disappears, but the preganglionic → chromaffin path is intact and the adrenaline surge with its cardiovascular effects survives; AVP and oxytocin release are also lost. The most informative intermediate state in the panel | medium | derived from [G Sympathoadrenal_system L29, L33] plus endocrinology [T] |

A true adrenalectomy would be fatal and the model does not pretend otherwise: per A.8 decision 9, "off" means basal replacement for blood hormones, never zero, because zero cortisol is an adrenal crisis. The CRH/ACTH saturation is the visible, interesting consequence and is shown; the clinical consequence is not simulated. Truncal vagotomy and splenic denervation are §10's interventions; they are read here only through the cytokine → PVN edge.

With the `neuroendocrine` switch off, portal transport, pituitary release to blood, posterior-pituitary release, adrenal cortical and medullary hormone action, RAAS and AVP pressor actions, the distant actions of gut hormones and the HPT/HPG scalars all stop. Hypothalamic neurosecretory neurons keep computing their commands, drawn as low-chroma tints and as efference-only packets fading at `portPortal` and `portNeurohyp`. Blood hormones relax by their own kinetics to the basal values below and are clamped there, tagged "basal" in the HUD. Downstream: no cortisol or adrenaline surge, no RAAS rescue, no cortisol brake on cytokines (so §10's TNF trace runs higher and longer), and in the orgasm scenario prolactin and oxytocin are clamped with the TIDA loop frozen (A.5). In brain-only mode the same clamps apply as a life-support assumption and body vitals read "—" (A.8 decisions 9, 10).

| State variable | Basal clamp | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| `crh` | not meaningfully measurable in peripheral plasma; normalised 1.0 at rest | pg/mL (relative) | H | low | [T] |
| `acth` | 10–50 (model 20) | pg/mL | H | low | [T] |
| `cortisol` | morning 10–15, nadir < 3 (model 12 at waking, 3 at nadir) | µg/dL | H | low | [T] |
| `adrenaline` | 44 ± 11 supine (model 44) | pg/mL | H | low | Cryer, Santiago & Shah 1980 [secondary, unverified] |
| `noradrenalinePl` | 200–300 (model 250) | pg/mL | H | low | [T] |
| `avp` | 1–3 (model 2) | pg/mL | H | low | [T] |
| `oxytocin` | 1–5 (model 2) | pg/mL | H | low | [T] |
| `prolactin` | 5–15 (model 8) | ng/mL | H | low | [T] |
| `raas`, `hpt`, `hpg` | 1.0 | relative | — | — | [model] |

Every basal row is textbook-grade and tagged low; they are display and clamp defaults, not findings, and §12's checkpoints are stated as changes from basal rather than as absolute concentrations.

Photosensitivity and palette (A.9, user decisions 6 and 9): the HPA pulse train at ≈ 1/h and the catecholamine flash are far below 3 flashes per screen second, but heavy time compression of the pulse train interacts with that limit and is resolved jointly with §11 and §13. Hormone fields are restrained, low-chroma tints at or above 5,500 K per A.8 decision 19; 2,300 K amber stays reserved for dopamine, so no hormone tint competes with the existing lantern.

### 9.10. Validation targets

The model column is the §9.4 defaults (n 6, e_E 0.2, G_s 6, τ_adrenal 10 min) run by `verify-editor/hpa.mjs` from rest; "—" marks checks not run in this pass.

| Target | Expected | Tolerance | Species | Owner of the check | Model (§9.4 defaults) | Status |
|---|---|---|---|---|---|---|
| Pituitary node brightens after stressor onset | ≈ 10 min (rat CRH-challenge latency; human psychosocial value not sourced) | qualitative | R | §12 | ACTH ×1.2 at 3.8 min, ×2.34 at 10 min | pass |
| Plasma cortisol first significantly above basal | ≈ 20 min (rat CRH challenge, corticosterone; human psychosocial value not sourced) | qualitative | R | §12 | ×1.1 at 31 min | marginal |
| Cortisol peak after a 15 min psychosocial stressor | 21–40 min from onset (the only binding human cortisol timing) | ±10 min | H | §12 | ×1.48 at 73 min | fail |
| Cortisol at 41–60 min after stressor end | back to basal (d ≈ 0, n.s.) | qualitative | H | §12 | ×1.41 at 56 min, ×1.48 at 75 min; below ×1.2 at 182 min | fail |
| Ultradian pulse period, constant mild drive | 65–75 min | ±15 min | R, H | §12 | 76 min at basal drive, 79 min at drive 1.5 (ACTH max/min 2.4–3.3; plasma cortisol 1.07–1.10) | pass |
| Strong sustained drive | flat elevated plateau, no pulses | qualitative | R | §12 | pulses persist at drive 3–8 (period 86–97 min) | fail (no secretion ceiling) |
| Cortisol awakening peak | 30–45 min after waking, +50–75 % | ±10 min; ±25 % | H | §12 | +6 % at 66 min (a_CAR 1.0) | fail |
| Adrenaline decay after a transient | t½ 2–3 min | ±1 min | H | §12 | t½ 2.5 min (§9.6 kinetics) | pass |
| Adrenaline peak crosses the heart-rate threshold but not the insulin threshold | 100–400 pg/mL | qualitative | H | §12 | ×4.12 of 44 ≈ 181 pg/mL | pass |
| Adrenalectomy | cortisol and adrenaline flat at basal; CRH and ACTH saturate | qualitative | H [T] | §12 | — | — |
| Hypophysectomy | adrenaline surge preserved, cortisol flat | qualitative | H [T] | §12 | — | — |
| Cortisol rise during endotoxaemia, via the cytokine → PVN edge (k_cyto, §10.5) | present | qualitative | H | §10, §12 | ×1.88 at 3.28 h in the §12.12 prototype (earlier kernel) | pass (prototype) |
| `neuroendocrine` off | all hormone pools at basal, tagged; no RAAS rescue; §10 cytokines higher | qualitative | — | §12 | — | — |
| Orgasm scenario, all networks on | traces identical to the legacy path of the same commit (B.13); DOPAMINE.md §9.6 after the §9.8 port | regression | — | §11, §12 | — | — |

The timing failures come from the **delay chain**, not from `k_C` alone. Peak time ≈ `τ_adrenal` + the `S` lag (1/`k_S`) + the ACTH lag, and with the current constants `S` itself already peaks at 40 min, the upper edge of the 21–40 min target; a first-order pool cannot peak before its input. A `k_C` sweep bears this out: at t½ 66 / 35 / 17 / 9 min the cortisol peak sits at 73 / 67 / 59 / 53 min, so even a nine-minute pool leaves the peak 13 min late, and the floor of that sweep is ≈ 40 min. Speeding `k_C` also makes the 41–60 min recovery row *worse*, because the amplitude grows: above ×1.2 until 182 min at t½ 66 min, but until 235 min at 17 min and 393 min at 9 min. And "a sourced faster effective clearance" is not available — the deconvolution value is 65 ± 5.3 min (§9.4), i.e. the current `k_C` is the well-sourced constant.

The open calibration is therefore the chain: ACTH t½ ≈ 10–15 min (`k_ACTH` 0.046–0.069/min; the deconvolution value in healthy men is ≈ 15 min), a human adrenal lag of 3–5 min (the 10 min is a rat model parameter, §9.4), `k_S` ≥ 0.14/min, and a plasma pool kept at the sourced t½ 60–90 min but fed by a faster secretion term. A check run with `τ_adrenal` 5 min, `k_S` 0.14, `k_ACTH` 0.07 and `k_C` 0.03 peaks at 35–37 min and is back below ×1.2 by 89 min; `τ_adrenal` 3 min with `k_S` 0.2 gives 27–30 min. §12.11's Variant E reaches 37.2 min by the same route. The Hopf threshold (§9.4) must be re-run after any of these changes, and a free/total split alone will not fix the timing.

The awakening row is a different failure. It is an **amplitude** failure, not a delay-chain failure: the proposed faster chain still gives only ≈ +10 % at ≈ 71 min against the +50–75 % target, so `a_CAR` and the GR feedback gain are what that row calibrates (§9.11; §12.22).

### 9.11. Open questions

- The fast feedback signal `S` and its clearance `k_S` = 0.069/min are a model choice forced by the stability check of §9.4: with the plasma pool as the feedback variable the threshold period is ≈ 100 min, not the observed 65–75 min. With feedback at both sites and K at basal, pulses need n ≥ 5; the default n = 6 departs from the tabulated 4. Either a sourced free-cortisol or adrenal-output time constant is needed, or the delay model of Walker, Terry & Lightman 2010 must be ported in its own variables rather than reconstructed.
- The defaults fail the human stressor timing and the post-stressor recovery through the **delay chain** (`τ_adrenal`, `k_S`, `k_ACTH`), not through the plasma pool, whose clearance is the best-sourced constant in the block (§9.10); the awakening rise fails on amplitude instead (`a_CAR`, GR gain). Constant strong drive never reaches the rat "saturated plateau", because the equations have no secretion ceiling. A faster delay chain, a saturating ACTH or cortisol secretion term and a free/total split are the candidate fixes, and each needs the Hopf threshold re-run.
- `τ_adrenal` should be cross-checked against human ACTH → cortisol cross-correlation lags before its confidence is raised, and the first two §9.10 latency rows should be re-sourced from human TSST plasma ACTH and cortisol time courses.
- e_E, G_s, a_C and a_CAR are [model] values without calibration data.
- The human-fitted parameter block (saturation constants, Hill coefficients 4/3/3, feedback gains 0.160 / 0.5 / 0.304, five fitted stimulation rates) comes from a secondary review tabulation whose unit column is internally inconsistent, and I could not extract that table's text to verify it. Decide: keep as low-confidence defaults, or obtain Andersen, Vinther & Ottesen 2013 and the Caruso source and verify before the values enter the code.
- The Gupta et al. 2007 model is published dimensionless and the paper does not supply `K_od`, so its scaled time cannot be converted to seconds from that paper alone. Is anchoring it with `k_C` = 0.0105/min from a different, secondary tabulation acceptable, or should the dimensional model be used throughout and Gupta kept only for the optional bistability mode?
- Nearly all the pulsatility and latency data are rat (Sprague-Dawley) and measure corticosterone, not cortisol; the human pulse counts and interburst intervals are [secondary, unverified] deconvolution figures. The CRH dose-response regimes that make the stressor scenario interesting are rat infusion rates. Current decision is a normalised 0–1 drive with a species note — confirm rather than displaying rat doses.
- The adrenal medullary output ratio of adrenaline to noradrenaline (≈ 80 : 20) could not be confirmed in any source read; a targeted search returned only indirect spillover evidence. It is [T] and low, and it matters because it sets how much of `noradrenalinePl` the SAM block contributes.
- Basal plasma adrenaline (44 ± 11 supine) comes from an aggregator fragment of Cryer, Santiago & Shah 1980, and the corresponding noradrenaline values were not recovered. The ACTH, cortisol, AVP, oxytocin and prolactin basal rows are all [T].
- Non-osmotic AVP release is unparameterised: the osmotic threshold and the pAVP–osmolality line are [secondary, unverified], and no source read gives the baroreflex recruitment curve. The AND edge is drawn; its gain is a guess.
- Circulation times are owned here but every value is [T] or [secondary, unverified]; the 10 s and 20 s transport delays are model choices. A sourced systemic transit figure would be worth one targeted search.
- Cortisol's access to brain tissue is contested: Karssen et al. 2001 reports P-glycoprotein limiting cortisol entry, later in-situ perfusion work disputes the corticosterone result. The model currently lets cortisol cross generally with a note; decide whether to carry an efflux factor.
- Does the orgasm scenario's oxytocin route through the shared `pituitaryPost` node, or stay on its own path? Unifying them is cleaner, but DOPAMINE.md is canonical and the scenario's traces must match §9.10's regression row with all networks on (A.8 decision 21). Default: leave the orgasm path untouched.
- At what default clock rate should the ultradian train and the 24 h envelope be shown? Neither is visible at ×1, and heavy compression could push the pulse animation toward the 3 flashes per screen second limit. Needs a decision jointly with §11 and §13.
- How much of the HPG axis should be visible at all? The current reading of A.1's content rules and A.8 decision 24 is a scalar with no structures below the diaphragm; confirm that this satisfies the non-explicit requirement while still being honest that the axis exists.

### 9.12. Sources

**Peer-reviewed and literature**

- Andersen M, Vinther F, Ottesen JT (2013). Three-compartment HPA model with first-order removal. Values used here are from the tabulation in the 2023 review arXiv:2311.04570 (Ahmad, Jena & Priyadarshi, *Mathematical modelling of hypothalamus–pituitary–adrenal axis dynamics: a review, a novel approach, and future*), Table 2 — [secondary], [unverified]: neither the primary paper nor that table's text could be read, only the review's identity and abstract.
- Baylis PH, Robertson GL. AVP–osmolality relation pAVP ≈ 0.63 · (Posm − 284) pg/mL — [secondary], [unverified] (via a review's citation).
- Bergendahl M, Vance ML, Iranmanesh A, Thorner MO, Veldhuis JD (1996). *J Clin Endocrinol Metab*. Fasting and cortisol secretory burst mass; fed-state cortisol bursts 22 ± 1.4 per 24 h, interburst interval 65 ± 4.0 min, 8 healthy men, deconvolution. [secondary], [unverified] (figures from a search summary of the abstract).
- Clow A, Thorn L, Evans P, Hucklebridge F (2004). Review of the awakening cortisol response; +50–160 % in the first 30 min across studies. [secondary], [unverified].
- Clutter WE, Bier DM, Shah SD, Cryer PE (1980). *J Clin Invest* 66:94–101. Epinephrine metabolic clearance rates and physiologic thresholds in man: 30 infusions in 6 subjects, steady-state 24–1,020 pg/mL; thresholds 50–100 (heart rate), 75–125 (glycerol, systolic), 150–200 (glucose, lactate, β-hydroxybutyrate, diastolic), > 400 pg/mL (insulin); MCR 52 ± 4 → 89 ± 6 mL·min⁻¹·kg⁻¹; adrenaline ≈ 10× more potent than noradrenaline. [secondary] (abstract via search summary).
- Cryer PE, Santiago JV, Shah SD (1980). *J Clin Endocrinol Metab*. Single-isotope derivative measurement of plasma catecholamines; epinephrine supine 44 ± 11 and standing 73 ± 17 pg/mL. [secondary], [unverified] (aggregator fragment).
- Dickerson SS, Kemeny ME (2004). *Psychol Bull* 130:355–391. Meta-analysis of 208 acute laboratory stressor studies. Peak cortisol 21–40 min from stressor onset (significant quadratic effect, t(207) = 4.62, p < .01); after stressor termination d = 0.38 (0–20 min), 0.26 (21–40 min), 0.05 n.s. (41–60 min). Verified against the paper's own text.
- Gupta S, Aslakson E, Gurbaxani BM, Vernon SD (2007). *Theor Biol Med Model* 4:8. Four-variable CRH/ACTH/GR/cortisol model; GR homodimerisation; one or three positive steady states; scaled parameter block. [unverified] (PMC1804264 not read).
- Karssen AM, Meijer OC, van der Sandt IC, et al. (2001). *Endocrinology* 142:2686–2694. P-glycoprotein hampers access of cortisol but not corticosterone to mouse and human brain; later in-situ perfusion work disputes the corticosterone finding. [secondary], [unverified].
- Müller OA, et al. (1982). Intravenous ovine and human CRF in normal controls: ACTH maximum ≈ 30 min after 100 µg i.v. oCRF, n = 9. [secondary], [unverified].
- Pruessner JC, Wolf OT, Hellhammer DH, et al. (1997). Free cortisol levels after awakening; +50–75 % within 30 min, n = 152 across three studies. [secondary].
- Robertson GL, Shelton RL, Athar S (1976). *Kidney Int*. The osmoregulation of vasopressin; threshold ≈ 280 mOsm/kg as later tabulated. [secondary], [unverified].
- Silverberg AB, Shah SD, Haymond MW, Cryer PE (1978). *Am J Physiol* 234:E252–E256. Norepinephrine as hormone and neurotransmitter in man: > 1,800 pg/mL required for haemodynamic or metabolic effects; plasma t½ 2.4 ± 0.7 min; basal production 0.7 µg/min; 5 men. [secondary].
- Veldhuis JD, Iranmanesh A (1989). Cortisol secretory pulse counts, 15–22 per 24 h as later cited. [secondary], [unverified].
- Veldhuis JD, Iranmanesh A, et al. (1990). ACTH secretory bursts 40 ± 1.5 per 24 h, interburst interval 39 ± 2.3 min. [secondary], [unverified].
- Walker JJ, Terry JR, Lightman SL (2010). *Proc R Soc B* 277:1627–1633. Delayed pituitary–adrenal model generating ultradian pulses under a constant CRH drive; adrenal delays 9.4, 10, 12, 15 min. Rat. [unverified] (cited via Walker et al. 2012).
- Walker JJ, Spiga F, Waite E, et al. (2012). *PLoS Biol* 10(6):e1001341. Rat (adult male Sprague-Dawley). Constant i.v. CRH 0.5 µg/h sustained ultradian corticosterone oscillations; 1.0 and 2.5 µg/h damped them to a constant elevated level; mean peak frequency 0.89 pulses/h (range 0.79–0.93); ACTH significant from baseline by 10 min (p < 0.005), corticosterone not until 20 min (p < 0.05). The paper reports no half-lives and no numerical adrenal delay.
- Ferguson AV, Latchford KJ, Samson WK (2008). *Expert Opin Ther Targets* 12:717–727. The PVN as a target for integrative treatment of autonomic dysfunction. Cited in [G Paraventricular_nucleus_of_hypothalamus L90].

**Model checks (not sources)** — a delay-loop stability script under `scratchpad/research-neuroendocrine/` produced the pituitary-only Hopf rows of §9.4; the both-site linear check, the nonlinear runs and the §9.10 model column come from `scratchpad/verify-editor/hpa.mjs` and `car.mjs` (with `verify-math-simulation/hpa2.mjs`). They test the parameter set; they do not evidence it.

**Textbook knowledge [T]** — adrenaline onset < 5 s; plasma cortisol t½ 60–90 min; basal ACTH, cortisol, noradrenaline, AVP, oxytocin and prolactin concentrations; adrenal output ratio ≈ 80 : 20; renin, angiotensin II, aldosterone, T4 and T3 half-lives; thyroid-hormone transporters at the blood–brain barrier; one complete circulation ≈ 60 s; thoracic segment levels for the adrenal preganglionics; the non-osmotic AVP recruitment threshold.

**Raw captures** (folder `brain-system/raw/`, stems without the `en_wikipedia_org_api_rest_v1_page_html_` prefix): Adrenaline (L49, L50, L53–L55, L93); Adrenocorticotropic_hormone (L27, L50); Baroreflex (L31); Corticotropin-releasing_hormone (L26, L29); Cortisol (L57, L61, L63, L71, L73, L75, L77, L81); Hypothalamic_E2_80_93pituitary_E2_80_93ad (L27, L29, L33, L39–L41, L43, L45, L47, L49, L50, L54, L56, L58, L60, L62, L66); Hypothalamic_E2_80_93pituitary_E2_80_93th (L25, L27, L29, L37, L39, L41, L43, L45); Hypothalamus (L40); Medial_preoptic_nucleus (L45, L49); Neuroendocrinology (L25, L31, L43, L45, L49, L51, L53, L57, L69); Neuroimmune_system (L49); Paraventricular_nucleus_of_hypothalamus (L38, L42, L46, L48, L52, L54, L56, L60, L62–L64, L68, L70–L72, L78, L80, L82, L84, L90); Sympathoadrenal_system (L23 — carries a quality warning that the article conflates SAM, SNS and HPA, which is why only its anatomical statements are used; L27, L29, L33, L37, L43, L45); Vagotomy (L54, L59); Vasopressin (L45, L47); Volume_transmission. Earlier folder `brain-system/raw/`: Oxytocin (L46, L48, L73), Prolactin (L34, L40).

**Project files** — `brain-system/research/DOPAMINE.md` (canonical for all dopamine quantities, the TIDA short loop, the prolactin closed form and the orgasm scenario's internals: §2.4, §3.4, §3.5, §5, §6.7, §9.6); `brain-system/src/anatomy.js` L166–L173, L190–L192, L224, L238–L242; `brain-system/src/response.js` L1–L7, L164–L170, L255–L265; `RESPONSE.md` (canonical response model).

---

## 10. Neuroimmune network

### 10.1. Scope and architecture

The neuroimmune network (`neuroimmune`, sub-networks `ni.route`, `ni.reflex`, `ni.fever`, `ni.sickness`) is a HUD switch of its own, separate from `neuroendocrine` (A.8 decision 3), because its lesions differ and because two of the model's AND gates need the two apart: cortisol acting on immune cells is `neuroendocrine ∧ neuroimmune`, while the inflammatory-reflex efferent is `autonomic ∧ neuroimmune`.

It is deliberately not a display overlay. It writes into five other systems (§10.7), which is how the switch earns its place: with it off, cytokines run higher and longer, `tSet` stays flat, and nothing else in the model reacts to an infection.

| Sub-network | Contents | Direction |
|---|---|---|
| `ni.route` | vagal immune afferent, CVO and choroid-plexus humoral route, endothelial PGE2 step, cytokine → PVN | immune → brain |
| `ni.reflex` | inflammatory reflex efferent, splenic sympathetic action, glucocorticoid action on immune cells | brain → immune |
| `ni.fever` | set-point shift and its effector recruitment | brain → body |
| `ni.sickness` | the nine sickness-behaviour modifiers | brain → brain and body |

The peripheral innate response at the challenge site is **not** part of this network: it is `tissue` and runs whenever `bodyMode = 'body'` (A.8 decision 9). Switching `neuroimmune` off therefore leaves an immune response that the brain cannot see and cannot damp.

Node ids used here: `macrophages`, `splenicTcells`, `spleen`, `splenicNerve`, `coeliac`, `dmv`, `cn10.aff`, `cn10.para`, `ntsVisc`, `areaPostrema`, `ovlt`, `sfo`, `pvn`, `mnpo`, `mpoa`, `dmh`, `rpa`, `insPost`, `insMid`, `skinVessels`, `bat`, `adrenalMedulla`. All brain coordinates are owned by §3, all body coordinates by §2 (A.2 precedence); the anchors this section reads are spleen (−108, −55, −458) and coeliac ganglia (±18, −10, −470). The neuroendocrine-immune lens's own body coordinates are rejected (A.8 decision 18).

### 10.2. Cytokines and the peripheral innate response

Cytokines are physically unlike hormones in ways that change how they are modelled and drawn: small proteins of ≈ 5–25 kDa, usually too large to cross cell membranes, functioning by interacting with cytokine receptors on the target-cell surface, generally released at lower concentrations than hormones, and signalling autocrine, paracrine and endocrine [G Cytokine L25, L27, L29]. The concentration contrast is stated quantitatively in the capture: classic hormones circulate in nanomolar concentrations that usually vary by less than one order of magnitude, whereas some cytokines circulate in picomolar concentrations that can increase up to 1,000 times during trauma or infection [G Cytokine L78]. That dynamic range is the reason the HUD plots cytokines on a log axis and hormones linearly.

They form a self-amplifying network: cytokines themselves trigger the release of other cytokines and lead to increased oxidative stress, which is what makes them important in chronic inflammation as well as in fever and the hepatic acute-phase response; several inflammatory cytokines are themselves induced by oxidative stress [G Cytokine L70, L72]. Functionally they split into type 1 (TNF, IFN-γ) enhancing cellular immune responses and type 2 (TGF-β, IL-4, IL-10, IL-13) enhancing antibody responses, each subset tending to inhibit the other [G Cytokine L66, L68]. In the body this positive feedback can run away; the model keeps it bounded by making the cytokine chain feed-forward from a decaying LPS source (kinetic block below), so its source term saturates at the dose, and the brakes (§10.5) act on top. A bounded cascade with both brakes removed is therefore a hard check, not a target (§10.9).

LPS is the canonical trigger: lipopolysaccharides trigger the immune system to produce the proinflammatory cytokines IL-1, IL-6 and tumour necrosis factor, which act on the brain by a fast vagal and a slow humoral route [G Sickness_behavior L55]. Historically this was the blood-borne "factor X" shown in the 1960s to act on the brain to induce sickness behaviour, identified in the 1980s as proinflammatory cytokines produced by activated leukocytes [G Sickness_behavior L31].

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Cytokine molecular mass | 5–25 | kDa | general mammalian | high | [G Cytokine L25] |
| Hormone plasma range | nanomolar, < 1 order of magnitude variation | mol/L | general mammalian | high | [G Cytokine L78] |
| Cytokine plasma range | picomolar, up to × 1,000 in trauma or infection | mol/L | general mammalian | high | [G Cytokine L78] |
| `lps` scenario challenge | 2 | ng/kg i.v. | H | — | §12 (scenario input) |
| TNF peak time, 2 ng/kg i.v. | 1.5–2 | h | H | high | Copeland et al. 2005; Calvano & Coyle 2012 |
| TNF peak concentration, 2 ng/kg | 231 ± 35 | pg/mL | H | high | Copeland et al. 2005 |
| TNF peak concentration, 4 ng/kg | 240 ± 70 (saline 35 ± 5) | pg/mL | H | high | Michie et al. 1988 |
| TNF return to baseline | 4–6 | h | H | medium | Copeland et al. 2005 (the paper is internally inconsistent: 4 h in Results, 4–6 h in the abstract) |
| IL-6 peak time and level, 2 ng/kg | 2 h, ≈ 1,000 | h, pg/mL | H | high | Copeland et al. 2005 (1,000 pg/mL at 2 h was the dose-defining target) |
| IL-6 return to baseline | 6 | h | H | medium | Copeland et al. 2005 |
| IL-10 peak time | 3 | h | H | medium | Calvano & Coyle 2012 |
| Core temperature peak, 2 ng/kg | ≈ +1.5 (max approaching 38.5 °C) at 3–5 h, resolved by ≈ 9 h | °C | H | high | Dillingh et al. 2014 (+1.5 °C); Calvano & Coyle 2012 (timing, absolute) |
| Heart-rate rise, 2 ng/kg | ≈ +28, reaching ≥ 90 bpm by 3–4 h, not fully normalised at 24 h | bpm | H | high | Dillingh et al. 2014; Calvano & Coyle 2012 |
| Cortisol response to 2 ng/kg | ≈ × 2 | — | H | medium | Calvano & Coyle 2012 (peak time not stated) |
| Ex vivo cytokine hyporesponsiveness | maximal at 6 h, lasting ≤ 12 h | h | H | high | Dillingh et al. 2014 |
| IL-1β and IFN-γ in plasma, 4 ng/kg | no measurable change | pg/mL | H | high | Michie et al. 1988 |
| HPA-activating cytokines, potency order | IL-1 (most potent) > IL-6, TNF-α, IL-10 | ranking | H | high | [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L66] |

Two cautions travel with this table into the code. First, the rows come from different cohorts and protocols; no single study read here reports TNF, IL-6, temperature, heart rate and cortisol on one time base at 2 ng/kg, so the composite curve is an assembly, not a measured trace, and the tolerances in §10.9 are correspondingly wide. Second, the plasma IL-1β row is a genuine constraint on the model and not an omission: IL-1 is the most potent HPA activator [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L66] yet plasma IL-1β did not rise measurably at 4 ng/kg (Michie et al. 1988, H). The model therefore treats IL-1 action as local and paracrine at the brain's vascular interface and at the afferent terminal, and does **not** drive the PVN from a plasma IL-1β pool. `il1b` remains a state variable (A.3.4) but is read as a tissue-compartment concentration, with `tnf` and `il6` as the plasma-measurable species.

**Kinetic model** (`IM` layer, 10 s; [model], low; the form behind the §12.12 prototype values). Pools are in model units; display scales are set so that the 2 ng/kg peaks read 231 pg/mL TNF and 1,000 pg/mL IL-6 (table above). Time in s.

```
dlps/dt   = −lps / τ_LPS                                   (lps = dose at t0, ng/kg)
dmac/dt   = (lps(t − δ_tx) − mac) / τ_mac                  (macrophage activation; tissue, runs in body mode)
dtnf/dt   = (a_TNF · mac · brake_C · brake_V − tnf) / τ_TNF
dil6/dt   = (a_IL6 · tnf · brake_C² − il6) / τ_IL6
dil10/dt  = (a_IL10 · tnf(t − δ_IL10) · (1 + c_10 · max(0, cortisolRel − 1)) − il10) / τ_IL10   (type 2; not braked by ACh)
dpge2/dt  = (g.neuroimmune · il6 − pge2) / τ_PGE
brake_C   = 1 / (1 + b_C · max(0, cortisolRel − 1) · g.neuroendocrine · g.neuroimmune)   (Th1/Th2 scalar, §10.5)
vagAI     = g.autonomic · g.neuroimmune · pge2/(pge2 + K_V) · (1 + 0.1 · g.enteric) + vns   (vns: slider 0–1, §10.4)
brake_V   = 1 − 0.5 · clamp(vagAI, 0, 1)
tSet      = 37 + min(4.5, ΔT_max · pge2 / (pge2 + K_P))    (§10.6; the 4.5 cap is the 41–42 °C ceiling)
```

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| τ_LPS; transcription delay δ_tx; τ_mac | 600; 2,100; 900 | s | — | low | [model] |
| τ_TNF; τ_IL6; τ_IL10; τ_PGE | 1,500; 4,800; 3,600; 2,700 | s | — | low | [model] |
| IL-10 input delay δ_IL10 (extra transcription and secretion delay) | 4,000–5,000 | s | — | low | [model]. A first-order low-pass of `tnf` **cannot** put the IL-10 peak at 3 h: the peak time of such a filter is gain-independent, so `a_IL10` and `c_10` cannot move it, and τ_IL10 alone gives 1.72 h at 3,600 s, 1.84 h at 5,400 s, 1.94 h at 7,200 s and only 2.60 h at 43,200 s, while flattening the trace. The cortisol term is impotent too, because `tnf` has decayed to ≈ 0.5 % of peak by the time `cortisolRel` peaks at ≈ 3.3 h. An input delay fixes it: δ_IL10 4,000 s gives a peak at 2.83 h and 5,000 s gives 3.10 h, inside the §10.9 target of 3 ± 1 h. Record the simulated peak rather than asserting 3 h |
| a_TNF; a_IL6; a_IL10; c_10 | 14; 2.2; 1.0; 1.0 | model units | — | low | [model]; a_IL10, c_10 and δ_IL10 are still not run in the prototype (§10.10) |
| b_C (glucocorticoid brake gain) | 1.5 | per unit of the cortisol ratio above basal | — | low | [model] |
| K_V (vagal immune afferent half-activation) | 0.4 | PGE2 units | — | low | [model] |

The chain is feed-forward from a decaying source, so it stays bounded with both brakes removed (§10.9). The prototype ran this block with the earlier single-pool HPA kernel and an additive HR law; §12.12 records which numbers depend on that.

Unbraked, with unit gain, the peaks of this block fall at TNF 1.10 h, IL-6 1.80 h, PGE2 2.55 h and IL-10 1.72 h. The TNF figure sits below its 1.5–2 h target (§10.9) and survives only on the ± 0.5 h tolerance, and because `brake_C` grows with the later cortisol rise the brakes move that peak *earlier*, not later: τ_TNF and τ_mac must therefore be raised together with any brake tuning (τ_TNF 3,000 s with τ_mac 2,400 s gives 1.53 h). a_TNF, τ_mac and the brakes cannot be tuned independently.

Cytokines also depolarise sensory neurons directly, which means the infection scenario can legitimately drive the same nociceptive pathway as a manual pain stimulus (§5) rather than needing a separate "malaise" channel. Three convergence mechanisms are named: IL-1β binding the neural receptor IL-1R produces an electrical impulse that creates the sensation of pain; invading bacteria may simultaneously activate inflammasomes and depolarise sensory neurons through hemolysins, which create pores causing potassium efflux and calcium influx; and ATP released from damaged cells binds P2X7 on macrophages and P2X3 on nociceptors together, coupling an action potential to inflammasome activation, with coupled neuropeptide release (substance P, serotonin) amplifying inflammation [G Neuroimmune_system L53, L55, L57, L59] (mouse and in vitro; medium confidence).

Inside the CNS the neuroimmune system is compositionally different from the peripheral immune system, which justifies giving it its own visual vocabulary (§13): it is composed primarily of glial cells — astrocytes, microglia and oligodendrocytes — and among all the haematopoietic cells of the immune system only mast cells are normally present, although during a neuroimmune response certain peripheral immune cells can cross blood- or fluid–brain barriers, with macrophages and T cells documented migrating into the spinal cord after injury and complement components produced directly in the CNS [G Neuroimmune_system L30, L32, L40]. The model draws no glial population as nodes; glia are the implied substrate of the parenchymal cytokine pool.

### 10.3. Immune → brain: two routes, two waves

Two routes with clearly different speeds, which is the single most useful fact for animating the infection scenario: peripherally released cytokines act on the brain via a fast transmission pathway involving primary input through the vagus nerves, and a slow transmission pathway involving cytokines originating from the choroid plexus and circumventricular organs and diffusing into the brain parenchyma by volume transmission [G Sickness_behavior L55]. Peripheral cytokines can enter the brain directly but are large lipophilic polypeptides that generally do not easily passively diffuse across the blood–brain barrier, and they may induce the expression of other cytokines in the brain that themselves cause sickness behaviour [G Sickness_behavior L55]. Interleukins and signals from immune cells access the hypothalamus via the neurovascular unit or the circumventricular organs [G Neuroimmune_system L49].

| Route | Edge chain | Networks | Latency | Conf. |
|---|---|---|---|---|
| Fast neural | peripheral cytokine → `cn10.aff` immune afferent → `ntsVisc` → `pvn`, `mpoa`, `insPost` | `autonomic ∧ neuroimmune` | minutes [model] | low (magnitude) |
| Slow humoral | blood cytokine → choroid plexus, `ovlt`, `sfo`, `areaPostrema` → volume transmission into parenchyma | `neuroimmune` | tens of minutes [model] | low (magnitude) |
| Endothelial | blood cytokine → brain endothelial cells → PGE2 → `mnpo` (EP3; Lazarus et al. 2007), which relays to the warm-sensitive preoptic neurons (`mpoa`) that set `tSet` | `neuroimmune` | see §10.6 | medium |

The two routes are named in the source; the latency magnitudes are a model characterisation, and no source read here gives a number for the slow route, so the HUD labels the inter-wave delay "illustrative" (§10.10). The ordering, however, is not merely illustrative: there is independent functional evidence that the fast route carries the response to small amounts of circulating LPS. In rats, 1 µg/kg LPS produced a monophasic fever in sham-operated animals that was abolished in vagotomised animals, whereas at 1,000 µg/kg hypothermia was deeper after vagotomy (≈ −1.1 °C vs ≈ −0.5 °C), the large-dose response being attributed mostly to non-vagal mechanisms (Romanovsky et al. 1997, R; the vagal dependence is contested in later work and depends on dose and route). The model therefore makes the vagal route dominant at low challenge and the humoral route dominant at high challenge, which is also what makes truncal vagotomy delay rather than abolish the central response (§10.8).

The path from the vagal terminal to the hypothalamic hub is the one the graph already carries: `ntsVisc` → hypothalamus → `pvn` (graph path, 2 hops, Nucleus of the solitary tract → Hypothalamus → Paraventricular nucleus). No new relay is invented; the PVN's NTS and SCN afferents are documented in the PVN capture and are §3's to place.

The destination is not only brainstem and hypothalamus. Insular cortex neurons encode and retrieve specific immune responses (Koren et al. 2021, *Cell* 184:5902–5915.e17, Ms, high confidence, cited at [G Inflammatory_reflex L46]), and the brain can use the inflammatory-reflex circuit to regulate the immune response and to extend immunological memory [G Inflammatory_reflex L27]. The network therefore terminates at `insPost`/`insMid`, which interoception (§5) already needs — the two features share the node, and the insular terminus is what lets the HUD show an immune challenge as an interoceptive percept rather than only as a vital sign.

Reusing the project's existing diffuse-modulator machinery for the humoral route is the right call rather than writing a second system: the corpus contains Volume_transmission and the dopamine model is already specified as a diffuse modulator (DOPAMINE.md §3.4, §3.5). Cytokines differ from that case in timescale — two to three orders of magnitude slower — and in entering only at the CVO windows, so the entry constraint, not the diffusion kernel, is the new code.

### 10.4. The inflammatory reflex

A reflex whose afferent arc and splenic cholinergic endpoint are established; the vagal–splenic efferent link is contested (A.8 #16). It is built with the same afferent and efferent machinery as the somatic reflexes of §6: all reflexes have an afferent and an efferent arc, and the inflammatory reflex has a sensory afferent arc activated by cytokines and a motor or efferent arc that transmits action potentials in the vagus nerve to suppress cytokine production, increased signalling in the efferent arc inhibiting inflammation and preventing organ damage [G Inflammatory_reflex L25].

The efferent arc has a clean molecular endpoint, which gives the model a single cut point. The molecular basis of cytokine-inhibiting signals requires acetylcholine and the α7 nicotinic receptor expressed on cytokine-producing cells; the release of acetylcholine in the spleen suppresses the production of TNF and other cytokines that cause damaging inflammation; signalling in the efferent arc, termed the cholinergic anti-inflammatory pathway, provides a regulatory check on the innate immune response to invasion and injury; and the action potentials arising in the vagus are transmitted to the spleen, where a subset of specialised T cells is activated to secrete acetylcholine [G Inflammatory_reflex L31]. The relay is neural down to the splenic nerve and cellular inside the spleen — the graph carries exactly that chain (`Spleen` → `Acetylcholine-Synthesizing T Cells` → `Acetylcholine` → `Tumor Necrosis Factor (TNF)`).

Drawn route, marked **contested** in the HUD per A.8 decision 16: `dmv` → `cn10.para` → `coeliac` → `splenicNerve` → `splenicTcells` (ChAT⁺) → α7nAChR on `macrophages`. The contest is specific and worth stating accurately, because the HUD label depends on it: electrophysiology in anaesthetised rats found no effect of vagal efferent stimulation on splenic nerve activity, nor on 15 single splenic-projecting neurons recorded in the suprarenal ganglion, the authors concluding that vagal efferent neurons in the rat neither synapse with splenic sympathetic neurons nor drive their ongoing activity (Bratton et al. 2012, *Exp Physiol* 97:1180–1185, R). A later study reported that vagotomy did not change activity in either nerve. The dispute covers **both** the vagus-to-splenic-sympathetic synapse **and** the identity and site of the efferent endpoint: critical reviews conclude that the anti-inflammatory effect of vagal stimulation depends on noradrenaline-containing splenic terminals, that α7-containing nicotinic receptors are essential but their critical location is uncertain and is more likely on splenic sympathetic nerve terminals than on macrophages, that ACh-synthesising T lymphocytes are a non-neural link, and — explicitly — that this pathway is not the efferent arm of the inflammatory reflex response to endotoxaemia (Martelli, McKinley & McAllen 2014, *Auton Neurosci* 182:65–69, R; McAllen et al. 2015, *Arthritis Res Ther*, which rates the evidence inconclusive and implicates an alternative sympathetic pathway). α7-independent vagal effects have been reported in knockout mice (Vida et al., via Komegae et al. 2018), and Simon et al. 2023 (*Front Neurosci*) attributes the effect mainly to noradrenaline at β2-adrenergic receptors on splenic macrophages and finds CD4⁺ T cells dispensable after antibody depletion, a direct challenge to the ChAT⁺ T-cell relay. The in-vivo endpoint and the relay are therefore contested, not established; the in-vitro ACh effect on human macrophages is a separate, solid cell-culture fact. Both versions sit under `autonomic ∧ neuroimmune`, so no switch behaviour depends on which is right, and the HUD's **contested** label is correct for the whole route.

| Element | Detail | Species | Conf. | Source |
|---|---|---|---|---|
| Afferent arc | sensory arc activated by cytokines | R, Ms | high | [G Inflammatory_reflex L25]; Tracey 2002 |
| Efferent endpoint (in vivo) | ACh at α7nAChR on cytokine-producing cells; the receptor's critical location is contested (splenic sympathetic terminals rather than macrophages) | Ms | medium | [G Inflammatory_reflex L31]; Borovikova et al. 2000; contested by Martelli, McKinley & McAllen 2014 and McAllen et al. 2015 |
| Splenic relay | ACh-synthesising T cells; proposed as a non-neural link, and reported dispensable after CD4⁺ depletion | Ms | medium | Rosas-Ballina et al. 2011; contested by Martelli, McKinley & McAllen 2014 and Simon et al. 2023 |
| Alternative efferent account | noradrenaline from splenic sympathetic terminals acting at β2-adrenergic receptors on splenic macrophages | R, Ms | medium | Martelli, McKinley & McAllen 2014; McAllen et al. 2015; Simon et al. 2023 |
| Splenic nerve necessity | required for cholinergic anti-inflammatory control of TNF in endotoxaemia | Ms | high | Rosas-Ballina et al. 2008 [G Inflammatory_reflex L50] |
| Vagus → splenic sympathetic link | no synaptic connection found; ongoing activity not driven | R | high (for the negative result) | Bratton et al. 2012 |
| ACh effect in vitro | reduces TNF and other proinflammatory cytokine release from endotoxin-stimulated human macrophages; does **not** reduce IL-10 | H (cells) | high | Borovikova et al. 2000 |
| VNS in vivo | lowers liver TNF synthesis and peak serum TNF, prevents shock in lethal endotoxaemia | R | high | Borovikova et al. 2000 |
| VNS in animal models | prevents or reverses disease in experimental arthritis, colitis, sepsis, haemorrhagic shock and congestive heart failure | R, Ms | medium | [G Inflammatory_reflex L35]; Tracey 2007 |
| VNS in human disease | implanted stimulation inhibited ex vivo LPS-stimulated whole-blood TNF production for up to 84 days; it rose again when the device was off for 14 days around day 42 and fell again on restarting | H | medium (open-label, n = 17, no control arm) | Koopman et al. 2016 |
| Reflex latency and loop gain | not established by any source read here | — | — | §10.10 |

Two model consequences follow from the Borovikova row that are easy to miss. The brake is **selective**: it suppresses TNF and other proinflammatory species but not IL-10, so in the model the cholinergic term multiplies the type-1 pool only and leaves the type-2 pool alone. And the brake acts on production, not on clearance, so it is implemented as a gain on the source term of `tnf`, which is what makes its removal raise the peak as well as prolong the decay (§10.8).

VNS is exposed as an interactive intervention with a slider (A.5), since the efferent arc can be driven directly and not only reflexively — the demonstration that the reflex is a control loop rather than a fixed animation. The human evidence is reported as experimental: the Koopman trial was open-label with 17 patients and no control arm, and the capture itself carries conflict-of-interest and neutrality warnings [G Inflammatory_reflex L23] plus a press-sourced patient anecdote [G Inflammatory_reflex L37] that the model ignores entirely. The HUD wording stays cautious accordingly: the slider is a relative efferent drive (0–1, model; experimental), never a clinical unit, with the hover tag "Animal and early human data; not a clinical setting" (§13.13). It reproduces the qualitative on/off/on pattern of ex vivo LPS-stimulated TNF production (Koopman et al. 2016, H, open-label, n = 17); model `tnf` is plasma TNF, a different measure.

### 10.5. Brain → immune: the two brakes

Two descending brakes with different switch requirements. Losing either one raises and prolongs the cytokine trace, and that difference is the main thing the two switches teach when toggled separately.

| Brake | Chain | Networks | Mechanism | Speed | Conf. |
|---|---|---|---|---|---|
| Cholinergic | §10.4 | `autonomic ∧ neuroimmune` | α7nAChR-gated suppression of TNF production; IL-10 spared | fast (neural) | high |
| Glucocorticoid | `cortisol` → immune cells | `neuroendocrine ∧ neuroimmune` | Th1 → Th2 shift, below | slow (tens of min) | high |
| Sympathetic lymphoid | `splenicNerve` → `spleen` | `autonomic ∧ neuroimmune` | noradrenergic action on splenic immune cells, drawn alongside the cholinergic route | fast | medium |

The glucocorticoid brake is not blanket suppression but a measurable Th1-to-Th2 shift, which gives the network a second state variable beyond total cytokine load. Cortisol inhibits production of IL-12, IFN-γ, IFN-α and TNF-α by antigen-presenting cells and Th1 cells but upregulates IL-4, IL-10 and IL-13 by Th2 cells; this change results in a shift toward a Th2 response rather than general immunosuppression, and the activation of the stress system during an infection is believed to be a protective mechanism preventing over-activation of the inflammatory response [G Cortisol L87]. Cortisol also suppresses the metabolically demanding processes of the immune system, which further raises glucose availability [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L60]. The model therefore carries a Th1/Th2 balance scalar driven by `cortisol` (owner §9) and applies it as a signed gain on the two cytokine subsets, rather than as one suppression factor — which is also why `il10` rises rather than falls under cortisol, a readout the HUD shows explicitly.

The loop closes in both directions. There is bi-directional communication and feedback between the HPA axis and the immune system: a number of cytokines, such as IL-1, IL-6, IL-10 and TNF-α, can activate the HPA axis, although IL-1 is the most potent, and the HPA axis in turn modulates the immune response, high cortisol suppressing immune and inflammatory activity [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L66]. Cytokines may regulate immune responses partly through activation of the HPA axis [G Neuroimmune_system L53]. The infection scenario is consequently a closed loop, not a one-way cascade, and that is exactly why the saturating term of §10.2 is required. The HPA machinery itself — CRH, ACTH, cortisol kinetics, the MR/GR feedback terms — is §9's and is not restated here; this section owns only the cytokine → `pvn` edge weight, k_cyto = 3 per PGE2 unit in the §9.4 drive term ([model], low; potency order above), and the brake forms of §10.2.

### 10.6. Fever

Fever is a set-point change, not a heat-balance failure, and the capture specifies the mechanism precisely enough to implement. Temperature is regulated in the hypothalamus; the trigger of a fever, called a pyrogen, results in the release of prostaglandin E2; PGE2 in turn acts on the hypothalamus, creating a systemic response causing heat-generating effects to match a new higher temperature set point; of the four receptors PGE2 can bind, a previous study showed the EP3 subtype mediates the fever response; hence the hypothalamus can be seen as working like a thermostat [G Fever L68]. The graph confirms the chain as a two-hop route (Pyrogen → PGE2 → hypothalamic temperature set point).

The model refines the target of that edge beyond the capture on two independent pieces of primary evidence. EP3-expressing neurons of the median preoptic nucleus are necessary for fever: mice with the EP3 receptor deleted only in that region showed no febrile response (Lazarus et al. 2007, *Nat Neurosci* 10:1131–1133, Ms). And the PGE2 that matters is made at the brain's vascular interface: mice lacking microsomal prostaglandin E synthase-1, an inducible terminal isomerase expressed in cytokine-sensitive brain endothelial cells, developed no fever after peripheral LPS and made no central PGE2, yet still responded to PGE2 injected into the brain (Engblom et al. 2003, *Nat Neurosci* 6:1137–1138, Ms). The drawn edge is therefore `tnf`/`il6` in blood → brain endothelium → `pge2` → `mnpo` (EP3; Lazarus et al. 2007), which relays to the warm-sensitive preoptic neurons (`mpoa`) that set `tSet`, with the endothelial step as the gated element — which is the correct place for the switch cut, since it is both the synthesis site and the blood–brain interface, and it explains why a large polypeptide can raise a set point without entering the parenchyma. The effector chain is `mnpo` ⊣ `dmh` → `rpa` → `portSymp` (§3.15): EP3 activation inhibits the tonically inhibitory preoptic output and so disinhibits the thermogenic premotor neurons.

Effectors are recruited to chase the raised set point, and each belongs to a different switch. When the set point is raised, the body increases its temperature through both active generation and retention of heat: peripheral vasoconstriction reduces heat loss through the skin and causes the person to feel cold; noradrenaline increases thermogenesis in brown adipose tissue; and muscle contraction through shivering raises the metabolic rate. If these are insufficient to match the blood temperature in the brain to the new set point, the brain orchestrates heat-effector mechanisms via the autonomic nervous system or the primary motor centre for shivering — increased muscle tone, shivering and release of hormones like adrenaline, and prevention of heat loss through vasoconstriction [G Fever L68, L70, L72].

| Effector | Node | Network required | Source |
|---|---|---|---|
| Peripheral vasoconstriction (reduces skin heat loss; causes the feeling of cold or chills) | `skinVessels` | `autonomic` | [G Fever L42, L68, L73] |
| Brown adipose thermogenesis (noradrenaline-driven) | `bat` | `autonomic` | [G Fever L68] |
| Shivering and increased muscle tone | `shiver`, `emg.<muscle>` | **`somatic`** | [G Fever L42, L68, L72] |
| Adrenaline release | `adrenaline` | `autonomic ∧ neuroendocrine` | [G Fever L72] |
| Set-point shift itself | `tSet` | `neuroimmune` | [G Fever L40, L68] |
| Defervescence: sweating, vasodilation | `sweat`, `sbf` | `autonomic` | [G Fever L42, L75] |

This split is what makes the fever scenario demonstrate the project's central rule. With `somatic` off, fever must rely on vasoconstriction and BAT because shivering is gone (A.5), so the rise is slower and shallower. With `autonomic` off, the set point still moves but almost nothing can chase it. With `neuroimmune` off, `tSet` stays at 37.0 (§7's baseline) and nothing is recruited at all, although the peripheral innate response at the challenge site continues as `tissue`. When the hypothalamic set point moves back to baseline, spontaneously or via medication, normal functions such as sweating and the reverse of the foregoing processes cool the body to the new lower setting, and the person feels hot, becomes flushed and may begin to sweat [G Fever L42, L75].

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Fever threshold (no single agreed upper limit for normal) | 37.2–38.3 (99.0–100.9 °F) | °C | H | high | [G Fever L34, L40] |
| Practical ceiling (clamp) | 41–42 (106–108 °F) | °C | H | high | [G Fever L42] ("fevers do not typically go higher than") |
| Set-point rise, 2 ng/kg i.v. endotoxin | ≈ +1.5 (peak approaching 38.5 °C) | °C | H | high | Dillingh et al. 2014; Calvano & Coyle 2012 |
| Time to temperature peak, 2 ng/kg | 3–5, resolved by ≈ 9 | h | H | medium | Calvano & Coyle 2012; Copeland et al. 2005 (peak ≈ 3 h, plateau ≈ 5 h) |
| Set-point rise, moderate infection (general) | +1.0 to +2.5 | °C | H | low | inferred from the threshold and ceiling rows; [T] |
| Baseline `tSet` | 37.0 | °C | H | — | §7 (owner) |
| Mediator and receptor | PGE2 at EP3, of EP1–4 | identity | H (EP3 evidence Ms) | high | [G Fever L68]; Lazarus et al. 2007 |
| PGE2 synthesis site | mPGES-1 in cytokine-sensitive brain endothelial cells | identity | Ms | high | Engblom et al. 2003 |
| Fever tachycardia in natural febrile infection (Liebermeister-type slope) | ≈ +8.5 per °C | bpm/°C | H | medium | Karjalainen & Viitasalo 1986 (n = 27 young men; febrile mean 84.0 bpm at 38.4 °C axillary, 66.5 bpm after recovery) |
| Fever tachycardia slope implied by 2 ng/kg endotoxin (+28 bpm at +1.5 °C) | ≈ 19 | bpm/°C | H | medium | arithmetic on Dillingh et al. 2014 |
| SA-node direct temperature coefficient k_T in f_T = 1 + k_T · (tCore − 37) (§7.5) | 0.075 (≈ 7.6 bpm/°C at IHR 101) | 1/°C | — | low | [model]; direction [T] (the denervated sinus node accelerates with temperature) |
| PGE2 → autonomic command gains: sympathetic (+), cardiac vagal (−), adrenal medulla (+), each × pge2/(pge2 + K_P) | 0.6; 0.5; 0.3 | tone units | — | low | [model] |
| Set-point law: ΔT_max; K_P | 2.2 °C; 0.6 PGE2 units | — | — | low | [model]; gives +1.50 °C at 2 ng/kg (§12.12) |
| Fever tachycardia, ICU series | 7.24 (men), 9.46 (women) | bpm/°C | H | low | [secondary, unverified] — reported via a search summary of a 2021 ICU study whose citation was not confirmed |
| Plasma iron during fever | lowered (antibacterial) | direction | mammalian | high | [G Sickness_behavior L43] |
| Fever frequency context | part of ≈ 30 % of paediatric healthcare visits; occurs in up to 75 % of seriously sick adults | % | H | high | [G Fever L48] |

The fever-tachycardia slope is the Liebermeister-type figure A.7 asks this section to own; it is now sourced to a primary human study rather than left open. Note that the model applies it as a **check**, not as a driver: `hr` is produced by §7's cardiac model from autonomic tone and intrinsic rate, so the ≈ +28 bpm whole-scenario rise (§10.2) is a validation target on an emergent quantity (§10.9). The two slope rows above describe different settings: natural fever gives ≈ 8.5 bpm/°C, while endotoxin, whose heart rate peaks before temperature and stays raised after it, gives ≈ 19 bpm/°C. The only slope the model checks directly is the k_T term, which §10.9 tests with `autonomic` off. With `autonomic` off the neural part of the slope disappears and only the direct SA-node term remains (IHR · k_T per °C), while `tCore` still rises, which is the designed demonstration.

The threshold is drawn as a **band, not a line**, because sources use values ranging between 37.2 and 38.3 °C [G Fever L40]. Hyperthermia is explicitly distinguished and explicitly not modelled: it is an elevation of body temperature over the temperature set point due to either too much heat production or not enough heat loss, is thus not considered fever, may quickly lead to death and does not respond to antipyretic medications [G Fever L44, L58, L60]. The distinction appears as a HUD label only; the model offers no hyperthermia state. Febrile seizures, disseminated intravascular coagulation and brain injury are named as complications, febrile seizures being more common in young children [G Fever L32, L42]; none is simulated. Delirium and "fever dreams" [G Fever L52] are likewise not simulated. Antipyresis is offered only as a set-point-return control, consistent with the capture's own statement that treatment to reduce fever is generally not required and that treating a fever does not appear to improve or worsen outcomes [G Fever L46, L48] — the HUD therefore does not present an antipyretic as a therapeutic recommendation.

### 10.7. Sickness behaviour as modifiers of other systems

Sickness behaviour is an enumerable set, which makes it implementable as named modifiers on systems owned elsewhere rather than as a vague malaise state. It is a coordinated set of adaptive behavioural changes that develop in ill individuals during the course of an infection; such illness responses include lethargy, depression, anxiety, malaise, loss of appetite, sleepiness, hyperalgesia, reduction in grooming and failure to concentrate; and it is a motivational state that reorganises the organism's priorities to cope with infectious pathogens [G Sickness_behavior L23, L25, L26]. They usually, but not always, accompany fever [G Sickness_behavior L24]. The fever capture independently lists the same cluster as accompanying a fever, adding dehydration [G Fever L52].

Specific advantages are given for several components, which is what fixes the sign of each modifier: anorexia limits food ingestion and therefore reduces iron availability in the gut, iron aiding bacterial reproduction, and plasma iron concentrations are lowered for the same antibacterial reason in fever; a lowered pain threshold ensures the animal does not place pressure on injured and inflamed tissues that might disrupt healing; reduced grooming is adaptive since it reduces water loss; and the metabolic energy not expended in activity is diverted to the fever response while limiting exposure to predators during cognitive and physical impairment [G Sickness_behavior L39, L43].

`sickness.<c>` ∈ [0, 1] for the nine components (A.3.4), each written as a modifier read by another section:

| Component | Modifier | Reader |
|---|---|---|
| hyperalgesia | nociceptive gain ↑ | §5 |
| anorexia | enteric drive ↓, hunger ↓ | §8, §5 |
| lethargy | motor drive ↓, voluntary-action rate ↓ | §3, §6 |
| sleepiness | arousal state biased toward drowsy, sleep pressure ↑ | §3 |
| concentration | cortical network gain ↓ | §3 |
| mood | limbic set points | §3 |
| anxiety | amygdala and BNST set points ↑ | §3 |
| malaise | interoceptive salience ↑ (`insPost` → `insAnt`, `dacc`) | §5, §3 |
| grooming | voluntary-action rate ↓ | §6 |

Three honesty constraints bind this subsection. The evidence is largely animal LPS work generalised to humans [G Sickness_behavior L31, L55], so every component carries medium confidence at best as a human quantity. The capture itself reports contested evolutionary accounts — the Hart adaptation account, the Shakhar & Shakhar 2015 Eyam kin-protection hypothesis, and a costly-signal-of-need reading [G Sickness_behavior L31, L33, L51] — and the model implements the components without endorsing any adaptive explanation; the HUD describes what changes, not why it evolved. Finally, the proposal that major depressive disorder is nearly identical with sickness behaviour, and the associated interferon-α and IL-6 findings linking inflammation-associated mood change to subgenual anterior cingulate activity [G Sickness_behavior L65], are recorded here as a research proposal and are deliberately **not** rendered as a clinical claim anywhere in the HUD. The cancer side-effect note [G Sickness_behavior L69] is likewise not modelled.

One mechanism from the capture is worth implementing because it is cheap and it connects this network to the rest of the project's learning machinery: the components of sickness behaviour can be learned by conditional association — pairing a saccharin solution with a chemical that triggers an aspect of sickness behaviour makes the solution trigger it alone on later occasions [G Sickness_behavior L59] — and the brain can learn to control the components independently of immune activation [G Sickness_behavior L31]. Together with the insular encoding result of §10.3 this supports an optional "recall" demonstration in the infection scenario, off by default and labelled as animal evidence. Acute psychosocial stress enhances the ability of an immune response to trigger both inflammation and behavioural sickness [G Sickness_behavior L55], which is the documented coupling from §12's `stressor` scenario into this one.

### 10.8. Interventions and off-semantics

Interventions remove nodes or edges; switches remove systems (A.8 decision 4). Both are informative here precisely because the brain-side nodes keep computing in every case and the peripheral innate response never stops.

| Intervention | Removes | Result | Conf. | Source |
|---|---|---|---|---|
| Splenic denervation | `splenicNerve` | breaks the reflex selectively: vagal afferent sensing and HPA activation stay intact, the cholinergic brake is gone, so the TNF trace peaks higher and decays more slowly without diverging | high | Rosas-Ballina et al. 2008, Ms |
| Truncal vagotomy | `cn10` trunk including the coeliac/hepatic branch | double-sided: the fast afferent route is lost, so fever onset, sickness behaviour and HPA activation are **delayed to the slow humoral route** rather than abolished (and at a low challenge, strongly blunted); the efferent brake is lost, so TNF runs higher and longer | medium | [G Sickness_behavior L55]; Romanovsky et al. 1997, R; Rosas-Ballina et al. 2008, 2011 |
| VNS (slider) | — (adds drive) | drives the efferent arc directly; TNF falls, IL-10 unchanged | medium | Borovikova et al. 2000; Koopman et al. 2016 |

Vagotomy's granularity matters and the capture defines it. A plain vagotomy eliminates afferent and parasympathetic innervation of the stomach (and, by the capture's wording, of "the left side of the transverse colon"; the model's vagal territory ends at the Cannon–Böhm point, so the distal third is sacral and unaffected — §8.2, §8.19); truncal vagotomy includes division of the main trunk and denervation of the pylorus, requires a pyloric drainage procedure, and also denervates the liver, biliary tree, pancreas, and small and large bowel; highly selective (proximal gastric) vagotomy denervates only the fundus and body of the stomach, preserves the antrum and pylorus, needs no drainage procedure, and does not denervate the liver, biliary tree, pancreas or bowel [G Vagotomy L31, L39, L40]. The intervention therefore exposes at least truncal — which loses the coeliac route to the splenic nerve, so the inflammatory reflex fails — and selective, which does not. The gut consequences belong to §8; what this section reads is the §10.4 route.

With the `neuroimmune` switch off, both directions stop: immune → brain (vagal immune afferent, CVO and humoral route, endothelial PGE2 → `mnpo`, cytokine → PVN) and brain → immune (inflammatory reflex, sympathetic lymphoid action, glucocorticoid action on immune cells). `tSet` stays flat at 37.0 and there is no sickness behaviour. The peripheral innate response at the challenge site continues, because it is `tissue` and not a neural network (A.8 decision 9). Consequences: cytokines highest and most prolonged, both brakes lost; no fever and therefore no fever tachycardia; no HPA activation by infection. Cross-network cases from A.5 that this section is responsible for:

| Other switch off | Neuroimmune consequence |
|---|---|
| Master → brain only | The infection scenario is unavailable (A.3.5). Blood-borne inputs to the brain are clamped basal, so no cytokine pool exists; `tCore` is clamped at 37.0. |
| Somatic | Set point and its autonomic effectors intact; shivering absent, so the rise to the set point is slower and shallower. |
| Autonomic | Fast afferent route lost **and** the cholinergic brake lost: central response falls back to the humoral route and TNF runs higher. Fever vasoconstriction and BAT are gone; shivering remains (`somatic`), so `tCore` still rises. No neural fever tachycardia: HR = IHR · f_T rises only by the direct SA-node term (≈ 7.6 bpm/°C). |
| Enteric | The gut branch of the inflammatory reflex fails (`autonomic ∧ enteric ∧ neuroimmune`); the splenic branch is unaffected while `autonomic` stays on. |
| Neuroendocrine | The glucocorticoid brake is lost, so TNF runs higher; the cholinergic brake remains, so the trace stays bounded. Cytokine → PVN still fires centrally but produces no cortisol. |

### 10.9. Validation targets

| Target | Expected | Tolerance | Species | Conf. |
|---|---|---|---|---|
| TNF peak after 2 ng/kg i.v. endotoxin | 1.5–2 h, ≈ 230 pg/mL | ±0.5 h, ±80 pg/mL | H | high |
| TNF return to baseline | 4–6 h | ±2 h | H | medium |
| IL-6 peak | 2 h, ≈ 1,000 pg/mL | ±0.5 h, ±400 pg/mL | H | high |
| IL-6 return to baseline | ≈ 6 h | ±2 h | H | medium |
| IL-10 peak | ≈ 3 h | ±1 h | H | medium |
| Plasma IL-1β | no measurable rise at this dose range | qualitative | H | high |
| Core temperature | +1.5 °C, peak 3–5 h, resolved ≈ 9 h; within the 37.2–38.3 °C fever band at onset and clamped at 41–42 °C | ±0.5 °C, ±1.5 h | H | high |
| Heart rate, whole scenario (includes the PGE2 sympathetic command) | +28 bpm, ≥ 90 bpm by 3–4 h, not fully normalised at 24 h | ±10 bpm | H | high |
| HR change per °C with `autonomic` off (IHR · f_T, the direct SA-node term) | 7.6 bpm/°C (k_T, §10.6) | ±3 bpm/°C | — | low |
| Cortisol during endotoxaemia | ≈ × 2, via the cytokine → PVN edge | ±50 % | H | medium |
| Ex vivo hyporesponsiveness | maximal at 6 h, gone by 12 h | ±3 h | H | high |
| Splenic denervation | TNF peak higher and decay slower; afferent sensing and HPA intact | qualitative | Ms | high |
| Truncal vagotomy | central response delayed, not abolished, at 2 ng/kg; strongly blunted at a low challenge; TNF higher and longer | qualitative | R, Ms | medium |
| VNS slider | TNF falls, IL-10 unchanged | qualitative | R, Ms, H | medium |
| `neuroimmune` off | `tSet` flat at 37.0; cytokines highest and longest; no HR response to infection | qualitative | — | high |
| `autonomic` off during infection | `tCore` rises (shivering only); HR = IHR · f_T, rising only by the direct temperature term (≈ 7.6 bpm/°C), with no neural fever tachycardia and no vasoconstriction; TNF higher than control | qualitative | — | high |
| Cascade boundedness | no divergence with both brakes removed | hard check | — | — |

The last row is a hard requirement rather than a target: the cytokine cascade is self-amplifying [G Cytokine L70, L72], so the bound of the §10.2 kinetic block (a feed-forward chain from a decaying source) must hold with the glucocorticoid and cholinergic brakes both off. A headless test (§11) asserts it at every clock preset, since the `IM` layer runs at 10 s and the `immune` preset is ×900 (A.4).

Photosensitivity (A.9, user decision 9): the cytokine cascade and the shivering animation must be rate-limited explicitly, because both are candidates for fast repetitive brightness change under the ×900 `immune` preset — the limiter counts flashes in screen time `tS`, so heavy compression of a slow biological process is exactly the dangerous case. Fever vasoconstriction uses the ≤ 15 % dimming with τ ≥ 2 s rule rather than a visible step, and shivering is a low-amplitude modulation disabled under reduced motion (A.8 decision 22). Any immune tint stays low-chroma and at or above 5,500 K per A.8 decision 19; 2,300 K amber is reserved for dopamine, so no cytokine or fever cue competes with the existing lantern. Cytokines are drawn as short-range diffuse clouds around their source tissue with occasional long-range blood transport, distinct from hormones' sustained whole-body tints — a distinction grounded in the physical facts of §10.2 rather than chosen for contrast.

### 10.10. Open questions

- No source read here gives a numeric latency for the slow humoral route through the circumventricular organs and choroid plexus, only that it is slow relative to the vagal route. The two-wave structure of the infection scenario depends on this delay; it is currently a model choice labelled "illustrative" in the HUD and needs a literature value.
- The §10.2 kinetic constants and the §10.6 set-point and PGE2 command gains are [model] fits from the prototype; the cytokine pools need the stated display scaling before their absolute values can be checked against Copeland et al. 2005. **The IL-10 terms (a_IL10, c_10 and the new δ_IL10) are still unrun**, and that is where the error corrected in §10.2 came from: τ_IL10 had been labelled as "set for the 3 h peak" without a simulation, which no first-order low-pass of `tnf` can deliver. Run them before the constants are trusted.
- No source read here gives a latency or a loop gain for the inflammatory reflex itself. The reflex is drawn with the §4 machinery but its timing is unparameterised, so its brake currently acts as a first-order gain with a model time constant rather than a measured one.
- The ICU fever-tachycardia slopes (7.24 bpm/°C men, 9.46 bpm/°C women) came from a search summary whose primary citation was not confirmed; the row is [secondary, unverified] and either needs the primary paper or should be dropped in favour of Karjalainen & Viitasalo 1986 alone.
- The 2 ng/kg composite time course is assembled from several cohorts (Copeland et al. 2005; Calvano & Coyle 2012; Dillingh et al. 2014). No single study read here reports TNF, IL-6, temperature, heart rate and cortisol on one time base, and Copeland et al. is internally inconsistent on TNF's return to baseline. A single-cohort trace would tighten the §10.9 tolerances considerably.
- Peak concentrations for IL-10 and IL-1ra at 2 ng/kg were not obtained; only the IL-10 peak time is sourced. The Th1/Th2 balance scalar of §10.5 cannot be calibrated in absolute units until they are.
- The cortisol response to endotoxin is recorded only as "roughly doubled" with no peak time, so the infection scenario's HPA limb currently inherits §9's stressor kinetics rather than infection-specific ones.
- The set-point rise of +1.0 to +2.5 °C for a general moderate infection remains inferred from the threshold and ceiling rows. The 2 ng/kg endotoxin figure is now sourced, but the general-infection band is not, and it is the one the manual (non-scenario) fever control uses.
- Whether the sympathetic lymphoid brake should have its own weight or be folded into the cholinergic term is undecided. The splenic nerve carries both in the drawing, and no source read here separates their contributions to TNF suppression in a form the model could weight.
- The contested vagal–splenic link (A.8 decision 16) is handled by making the switch behaviour independent of it, but the HUD still has to say something. Decide the exact wording: "contested route" with both citations, or a selector between the two circuit versions. §10.4 now states the contest as covering the endpoint and the relay as well as the synapse, so the wording must not claim an "independently established" cholinergic endpoint.
- The conditional-association and insular-recall demonstrations (§10.3, §10.7) are animal findings. Confirm that they ship as an optional, explicitly labelled overlay rather than as part of the default infection scenario.
- Microglia and astrocytes are the implied substrate of the parenchymal cytokine pool but have no nodes. Decide whether a glial field is worth rendering in the brain during an infection, or whether the pool stays invisible and only its effects are shown.

### 10.11. Sources

**Peer-reviewed**

- Borovikova LV, Ivanova S, Zhang M, Yang H, Botchkina GI, Watkins LR, Wang H, Abumrad N, Eaton JW, Tracey KJ (2000). Vagus nerve stimulation attenuates the systemic inflammatory response to endotoxin. *Nature* 405:458–462. Acetylcholine reduced TNF and other proinflammatory cytokine release from endotoxin-stimulated human macrophages but not IL-10; vagal stimulation in rats lowered liver TNF synthesis and peak serum TNF and prevented shock. Stimulation parameters not obtained — [unverified] for the electrode settings only.
- Bratton BO, Martelli D, McKinley MJ, Trevaks D, Anderson CR, McAllen RM (2012). Neural regulation of inflammation: no neural connection from the vagus to splenic sympathetic neurons. *Exp Physiol* 97:1180–1185. Rat; no effect of vagal efferent stimulation on splenic nerve activity or on 15 single splenic-projecting suprarenal-ganglion neurons. Cited for A.8 decision 16.
- Calvano SE, Coyle SM (2012). Experimental human endotoxemia: a model of the systemic inflammatory response syndrome? *Surg Infect (Larchmt)* 13:293–299. 2 ng/kg i.v. *E. coli* O:113; TNF peak 1.5 h and undetectable by 4 h; IL-6 peak 2 h; IL-10 peak 3 h; mean maximum core temperature approaching 38.5 °C at 3–5 h with resolution by 9 h; mean heart rate ≥ 90 bpm by 3–4 h, not fully normalised at 24 h; cortisol roughly doubled. Peak concentrations are in figures not read.
- Copeland S, Warren HS, Lowry SF, Calvano SE, Remick D (2005). Acute inflammatory response to endotoxin in mice and humans. *Clin Diagn Lab Immunol* 12:60–67. Human 2 ng/kg i.v. over 5 min (NIH reference endotoxin, *E. coli* O113); TNF peak 2 h at 231 ± 35 pg/mL; IL-6 peak 2 h at ≈ 1,000 pg/mL; TNF to baseline by 4 h (Results) or 4–6 h (abstract); IL-6 to baseline at 6 h; core temperature peak ≈ 3 h, plateau ≈ 5 h.
- Dillingh MR, van Poelgeest EP, Malone KE, et al. (2014). Characterization of inflammation and immune cell modulation induced by low-dose LPS administration to healthy volunteers. *J Inflamm (Lond)* 11:28. Randomised, double-blind, placebo-controlled; 0.5, 1 and 2 ng/kg i.v. in three cohorts of eight (six LPS, two placebo); +1.5 °C and +28 bpm at 2 ng/kg; ex vivo cytokine hyporesponsiveness maximal at 6 h and lasting ≤ 12 h. Full text not read; figures from the abstract and indexed excerpts — [unverified] for anything beyond the quoted values.
- Engblom D, Saha S, Engström L, Westman M, Audoly LP, Jakobsson PJ, Blomqvist A (2003). Microsomal prostaglandin E synthase-1 is the central switch during immune-induced pyresis. *Nat Neurosci* 6:1137–1138. Mouse; mPGES-1 knockouts made no central PGE2 and no fever after peripheral LPS but still responded to PGE2 injected into the brain.
- Karjalainen J, Viitasalo M (1986). Fever and cardiac rhythm. *Arch Intern Med* 146:1169–1171. 27 young men with uncomplicated acute febrile infection; 24 h ECG during illness and after recovery; mean axillary temperature 38.4 °C, mean heart rate 84.0 bpm febrile and 66.5 bpm after recovery; ≈ 8.5 bpm per 1 °C.
- Koopman FA, Chavan SS, Miljko S, et al. (2016). Vagus nerve stimulation inhibits cytokine production and attenuates disease severity in rheumatoid arthritis. *PNAS* 113:8284–8289. Open-label, 17 patients, no control arm; implanted stimulation inhibited TNF production up to day 84, with TNF rising during a 14-day off period around day 42 and falling again on restarting.
- Koren T, Yifa R, Amer M, et al. (2021). Insular cortex neurons encode and retrieve specific immune responses. *Cell* 184:5902–5915.e17. Mouse. Cited at [G Inflammatory_reflex L46].
- Lazarus M, Yoshida K, Coppari R, Bass CE, Mochizuki T, Lowell BB, Saper CB (2007). EP3 prostaglandin receptors in the median preoptic nucleus are critical for fever responses. *Nat Neurosci* 10:1131–1133. Mouse; regional EP3 deletion eliminated the febrile response.
- Michie HR, Manogue KR, Spriggs DR, et al. (1988). Detection of circulating tumor necrosis factor after endotoxin administration. *N Engl J Med* 318:1481–1486. 13 healthy men, 4 ng/kg i.v. *E. coli* endotoxin; TNF rose in the 90–180 min window to 240 ± 70 pg/mL against 35 ± 5 pg/mL after saline; ibuprofen pretreatment did not prevent the rise (170 ± 70 pg/mL) but reduced symptoms; plasma IL-1β and IFN-γ unchanged. A published letter questioned whether the assay measured bioactive TNF.
- Romanovsky AA, Simons CT, Székely M, Kulchitsky VA (1997). The vagus nerve in the thermoregulatory response to systemic inflammation. *Am J Physiol* 273:R407–R413. Rat; 1 µg/kg LPS gave monophasic fever in sham animals, abolished after vagotomy; at 1,000 µg/kg hypothermia was deeper after vagotomy (≈ −1.1 vs ≈ −0.5 °C). The vagal dependence is contested in later work and depends on dose and route — [unverified] (abstract and secondary summaries only).
- Rosas-Ballina M, Ochani M, Parrish WR, et al. (2008). Splenic nerve is required for cholinergic antiinflammatory pathway control of TNF in endotoxemia. *PNAS* 105:11008–11013. Mouse. Cited at [G Inflammatory_reflex L50].
- Rosas-Ballina M, Olofsson PS, Ochani M, et al. (2011). Acetylcholine-synthesizing T cells relay neural signals in a vagus nerve circuit. *Science* 334:98–101. Mouse. Cited at [G Inflammatory_reflex L51].
- Tracey KJ (2002). The inflammatory reflex. *Nature* 420:853–859. Cited at [G Inflammatory_reflex L49]; [unverified].
- Tracey KJ (2007). Physiology and immunology of the cholinergic antiinflammatory pathway. *J Clin Invest* 117:289–296. Cited at [G Inflammatory_reflex L52]; [unverified].
- Tracey KJ (2009). Reflex control of immunity. *Nat Rev Immunol* 9:418–428. Cited at [G Inflammatory_reflex L48]; [unverified].
- Shakhar K, Shakhar G (2015). Eyam hypothesis for sickness behaviour. Cited at [G Sickness_behavior L33] as a contested evolutionary account; [recalled], not read.
- Hart BL (1988). Biological basis of the behavior of sick animals. *Neurosci Biobehav Rev* 12:123–137. Cited at [G Sickness_behavior L79] for the component-by-component advantages; [unverified].

**Textbook knowledge [T]** — the +1.0 to +2.5 °C set-point rise for a general moderate infection (inferred from the sourced threshold and ceiling); the characterisation of the vagal route as "minutes" and the humoral route as "tens of minutes".

**Raw captures** (folder `brain-system/raw/`, stems without the `en_wikipedia_org_api_rest_v1_page_html_` prefix): Cortisol (L57, L83, L87); Cytokine (L25, L27, L29, L66, L68, L70, L72, L78, L80); Fever (L31–L34, L40, L42, L44, L46, L48, L50, L52, L56, L58, L60, L62, L68, L70, L72, L73, L75, L77); Gut_E2_80_93brain_axis (L44, L50); Hypothalamic_E2_80_93pituitary_E2_80_93ad (L29, L56, L60, L66); Inflammatory_reflex (L23, L25, L27, L29, L31, L33, L35, L37, L39, L44–L53); Interoception (L21, L33); Neuroimmune_system (L23, L30, L32, L34, L40, L42, L49, L51, L53, L55, L57, L59, L63); Sickness_behavior (L23–L27, L29, L31, L33, L35–L43, L45–L51, L53, L55, L57, L59, L61–L69, L79); Vagotomy (L27, L31, L33, L35, L37, L39, L40, L42, L44, L48).

**Graph queries used** (`graphify-out/graph.json`): `query "How do cytokines reach the brain: vagal afferent, circumventricular organs, PGE2, fever and sickness behaviour" --budget 2500`; `path "Pyrogen" "Hypothalamic temperature set point"` (2 hops); `path "Prostaglandin E2 (PGE2)" "EP3 prostaglandin receptor"` (1 hop); `path "Motor Efferent Arc" "Tumor Necrosis Factor (TNF)"` (3 hops, via the cholinergic anti-inflammatory pathway and acetylcholine); `path "Sensory Afferent Arc" "Motor Efferent Arc" --undirected`; `path "Lipopolysaccharide" "Sickness behavior" --undirected`; `path "Interleukin-1 Beta (IL-1 beta)" "Hypothalamic-Pituitary-Adrenal (HPA) Axis" --undirected`; `path "Cholinergic Anti-Inflammatory Pathway" "Spleen" --undirected`; `path "Nucleus of the solitary tract" "Paraventricular nucleus" --undirected` (2 hops); `path "Dorsal Nucleus of Vagus Nerve" "Spleen" --undirected`; `path "Vagus Nerve Stimulation" "Tumor Necrosis Factor (TNF)" --undirected`; `explain "Inflammatory reflex"`, `explain "Spleen"`, `explain "Acetylcholine-Synthesizing T Cells"`.

**Project files** — `brain-system/research/DOPAMINE.md` §3.4, §3.5 (volume transmission precedent, canonical for all dopamine quantities); `brain-system/research/ANALYSIS.md` §2, §3, §5, §6, §7, §8, §9, §11, §12, §13 and Appendix A.

---

## 11. Integration: switches and simulation architecture

### 11.1. Scope and ownership

This section specifies how Brain System runs its five switchable networks, the master switch and the always-on layers (`cns`, `special`, `tissue`) as one deterministic kernel inside the existing project. Other sections own the rest. Scenario inputs, keyframes, switch-off outcomes, checkpoints and tolerances are in §12. Physiological values are in §3–§10, rendering and HUD in §13, and every dopamine quantity in DOPAMINE.md.

| Content | Defined in | Referenced owners |
|---|---|---|
| Ownership model, edge `nets`, graph schema and sizes, ports | §11.3–§11.5 | A.3, A.5; §3 (port nuclei, coordinates) |
| Kernel layers, step sizes, striding, ordering, RNG, history buffer | §11.6 | A.4 |
| Clock: `kh` range, presets, slew, adaptive targets, anticipation, approach, CPU slicing | §11.7 | A.4 |
| Packets: emission, transport, model-side caps | §11.8 | §13 (display caps) |
| Stimulus pipeline | §11.9 | §5 (receptors, thresholds), §12 (default behaviour per sense), §13 (picking) |
| Switch and intervention execution, AND table | §11.10–§11.12 | A.5; §6–§10 (content) |
| Cross-network coupling list | §11.13 | §3–§10 |
| Orgasm adapter | §11.14 | DOPAMINE.md §6, §9 |
| State texture hand-off | §11.15 | §13 |
| Files, tests, CPU budget, reconciliation | §11.16–§11.18 | — |

The kernel calibration constants used by the scratch prototypes (gains, lags, shares) are not defined here. They are provisional inputs taken from the lens reports, and the owners (§7–§10) replace them.

### 11.2. Architecture

The model is one deterministic multi-rate kernel. It integrates human time `tH` on fixed grids. Screen time `tS` drives it through a single clock (§11.7). Rendering reads kernel state and never writes to it.

| Part | Role | File (B.4 owns the list) |
|---|---|---|
| Graph | Nodes (A.3.2 kinds) and edges, each edge carrying `nets`, fibre class, length and transport | `src/sim/graph.js` |
| Kernel | Layers EV, NF, CV, GI, EN, IM, CR. Event queue, lazy striding, per-layer RNG, time-sliced `advance` | `src/sim/kernel.js` |
| Clock | Sole owner of `kh`. Priority: user lock › scenario delegate › scenario keyframes › adaptive rule. The CPU budget acts through time slicing: the clock commits the `tH` the kernel reached | `src/clock.js` |
| Switches and interventions | Ramped gains `g.<net>`, off-state targets, resting-state cache, node and edge removal | `src/sim/switches.js`, `src/sim/interventions.js` |
| Stimuli | Stimulus record → site → receptor classes → drive and packets | `src/sim/stimuli.js` |
| Scenarios and adapter | Scenario records and checkpoints (§12). Orgasm adapter wrapping `response.js` and `dopamine.js` | `src/sim/scenarios.js`, `src/sim/orgasm-adapter.js` |

### 11.3. Ownership model and edge `nets`

1. Every node has exactly one owner: a sub-network id from A.3.1 (`som.aff`, `ans.symp`, `ne.hpa`, …), or `cns`, `special` or `tissue`.
2. Every edge carries `nets`, the set of networks it needs: somatic 1, autonomic 2, enteric 4, neuroendocrine 8, neuroimmune 16. The run predicate has **three** cases, not two, because `nets = []` alone cannot distinguish an always-on CNS edge from a body-only tissue edge:
   - an edge with a non-empty `nets` runs only when `bodyMode = 'body'` **and** every listed `g.k > 0`;
   - an edge with the **body flag** — a `tissue` edge, or any edge with a body-side endpoint — runs only when `bodyMode = 'body'`;
   - every remaining edge (`cns`, `special`) always runs, in brain-only mode included, which is what keeps the CNS and the §11.9 special-sense injection alive there.

   Its gain is g_e = [bodyOn, if the edge has the body flag or any `nets`] · Π g.k over `nets` (§11.13). Whether the body flag is carried as a sixth mask bit beside the five network bits or derived from endpoint ownership is an implementation choice; the prototype uses a bit.
3. An axon edge belongs to the network of the neuron that owns the axon: the receptor's network for an afferent, the soma's network for an efferent. A humoral edge belongs to the network whose distant action it carries. An edge whose effect needs two systems lists both (AND, §11.11).
4. Cranial nerves are split by functional component (A.8 #6). Visceral afferents, including baro- and chemoreceptors, are autonomic (A.8 #7). The respiratory rhythm is CNS, while phrenic and intercostal output is somatic (A.8 #8). Special senses are always on (A.8 #5).
5. Intracerebral tracts have `nets = []`. Bulbospinal premotor axons are autonomic, and corticospinal and reticulospinal tracts in the cord are somatic (A.3.1).

| Edge (A.3.3 ids) | `nets` | Evidence |
|---|---|---|
| `palm.R` → `drg.C7.R` (Aδ) → `cord.C7.R` | somatic | [G Withdrawal_reflex L31] |
| `cord.C7.R` → `thalVPL.L` (spinothalamic) | somatic | A.3.1 (somatic cord tracts) |
| `thalVPL.L` → `s1.hand.L` | [] | CNS |
| `carotidSinus.R` → `ntsVisc.R` (`cn9.aff`) | autonomic | [G Baroreflex L35] |
| `ntsVisc` → `cvlm` → `rvlm` | [] | [G Baroreflex L37]; graph: CVLM → RVLM (1 hop) |
| `rvlm` → `portSymp` → `cord.T1…L2.iml` | autonomic | [G Baroreflex L37]; graph: RVLM → intermediolateral nucleus (1 hop) |
| `ntsVisc` → `nAmbVagal`, `dmv` → `cardiacPlexus` → `saNode` | [] then autonomic | [G Baroreflex L39] |
| `retina.R` → `opn.R` → `ew` → `ciliaryGang` → `pupilSphincter` | [] up to `ew`, then autonomic | [G Pupillary_light_reflex L56–L59]; graph: pretectal nucleus → EW → ciliary ganglion |
| `medianEminence` → `pituitaryAnt` (portal) | neuroendocrine | graph: median eminence ← hypophyseal portal system → anterior pituitary |
| `adrenalMedulla` → `adrenaline` (blood) | autonomic ∧ neuroendocrine | graph: sympathoadrenal system → adrenal medulla (1 hop) |

The knowledge graph links these chains directly only where the table says so. The other links (for example carotid sinus → NTS, 6 conceptual hops through CN IX) rest on the cited capture lines.

### 11.4. Graph schema and sizes

| Node field | Meaning |
|---|---|
| `id`, `kind`, `owner`, `side` | A.3.2–A.3.3 patterns; `kind` ∈ receptor, ganglion, segment, nucleus, area, port, effector, organ, gland, pool, oscillator |
| `pos` | [x, y, z] mm; the brain frame equals the body frame (A.2) |
| `layer` | NF, CV, GI, EN, IM or CR: the layer that integrates the node |
| `tau, theta, kappa, rmax` | Rate-unit parameters of NF nodes (values per node class, §4) |
| `region`, `area`, `port` | Render region, cortical area attribute, port direction (§11.5) |

| Edge field | Meaning |
|---|---|
| `id` | Stable integer; the order breaks event ties |
| `from, to, kind, fibre` | A.3.2 edge kinds and fibre classes |
| `nets` | Bitmask, AND semantics (§11.3), beside the body flag and the intervention-cut flag (§11.12) |
| `path`, `len` | Polyline id and u-range (u = 0 at the CNS end, A.2). `len` in mm is computed from the polyline at load and never entered by hand |
| `v`, `nSyn`, `delay` | Velocity from A.9 / §4; delay (s) = len_mm / v_mps / 1,000 + nSyn · 0.0006 + (target is a muscle ? 0.0012 : 0), i.e. t_syn 0.6 ms and NMJ delay 0.7 + EMG spread 0.5 ms (Table 4.3a) |
| `w`, `sign`, `transmitter` | Rate coupling of NF edges; defaults Table 4.8e, signs §3.15 |
| `transport` | `ring` (NF → NF, read from history, §11.6), `event` (drive carried by packets, §11.8) or `layer` (blood, portal and volume edges read by CV/EN/IM with their own delays) |

The prototype (`s11/graph.mjs`) builds the graph one id at a time from A.3.3. It uses bilateral instances, one rate node per cortical area and sub-site per side, one segment and one DRG node per side per segment, and one ascending and one descending tract edge per segment. Brain-internal edges use the brain-systems lens density.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Planning size (A.7) | ≈ 500 nodes, ≈ 1,500 edges | count | — | low | A.7 |
| Design size, this section | ≈ 750 nodes, ≈ 2,200 edges (±20 %) | count | — | medium | [model]; itemised count below |
| Itemised count: nodes | 740 (brain 334 incl. 42 ports and 92 cortical-area nodes; body 406) | count | — | medium | prototype `s11/graph.mjs` |
| Itemised count: edges | 2,217 (tract 1,484, axon 665, blood 56, volume 11, portal 1) | count | — | medium | prototype |
| NF rate units; NF ring edges | 637; 2,036 | count | — | medium | prototype |
| Brain-internal edge density | 3.3 per brain node | edges/node | — | low | [model], after the brain-systems lens (≈ 350–400 edges for ≈ 110 nodes) |
| Edges by `nets` | `nets = []` and always on (`cns`, `special`) 1,101; `nets = []` but body-only (`tissue`) 40; somatic 703; autonomic 277; enteric 34; neuroendocrine 33; autonomic∧enteric 12; neuroimmune 7; autonomic∧neuroimmune 6; autonomic∧neuroendocrine 2; autonomic∧enteric∧neuroimmune 1; neuroendocrine∧neuroimmune 1 | count | — | medium | prototype |
| Edges cut by each switch | somatic 703 (31.7 %); autonomic 298 (13.4 %); enteric 47 (2.1 %); neuroendocrine 36 (1.6 %); neuroimmune 15 (0.7 %); master 1,116 = the 1,076 network-gated edges plus the 40 body-only ones (50.3 %) | count | — | medium | prototype |
| Dynamic skin-site receptor nodes | ≤ 64, created per stimulus | count | — | medium | [model] |

Three groups take the count above the planning figure: the per-segment cord tracts (310 edges), the bilateral cortical sub-sites and the bilateral brainstem list (93 nodes). The CPU figures in §11.17 were measured at the itemised size.

### 11.5. Brain ports

Ports are the brain-side boundary nodes (A.3.3). §3 places them and owns the nuclei behind them. Each port's crossing edges carry the `nets` listed here.

| Port | Dir. | `nets` of crossing edges | Behind the port (§3) | Brain only |
|---|---|---|---|---|
| `portDC` | aff | somatic | `gracile`, `cuneate` → contralateral `thalVPL` | silent |
| `portSTT` | aff | somatic | `thalVPL`, `thalVMpo`, `pbn` | silent |
| `portTrig` | aff | somatic | `spV`, `prV`, `mesV` | silent |
| `portVisc` | aff | autonomic | `ntsVisc` | silent; NTS baseline drive falls (A.5) |
| `portSpinoVisc` | aff | autonomic | `pbn`, `thalVMpo` | silent |
| `portCVO` | aff | neuroendocrine; neuroimmune | `areaPostrema`, `sfo`, `ovlt`, `medianEminence` | inputs clamped at basal (A.5) |
| `portGust`, `portVest`, `portCoch`, `portRetina`, `portOlf` | aff | [] (special) | `ntsGust`; `vestNuc`; `cochNuc`; `lgn`, `sc`, `opn`, `scn`; `olfBulb` | injection points (§11.9) |
| `portCST`, `portRS` | eff | somatic | `m1`, `pmd`, `sma`; `pnc`, `gi`, `vestNuc`, `redNucleus` | efference only |
| `portCranMotor` | eff | somatic | `n3 n4 n6 motV n7m nAmbMotor n11 n12` | efference only |
| `portSymp` | eff | autonomic | `rvlm`, `pvn`, `dmh`, `rpa` (bulbospinal) | efference only |
| `portVag`, `portPara`, `portSacral` | eff | autonomic | `nAmbVagal`, `dmv`; `ew`, `ssn`, `isn`; `barrington` | efference only |
| `portPortal`, `portNeurohyp` | eff | neuroendocrine | `pvn`, `arcuate` → `medianEminence`; `son`, `pvn` → `pituitaryPost` | efference only; hormones basal |
| `portImmune` | eff | autonomic ∧ neuroimmune | `dmv` (reflex efferent arc, §11.11) | efference only |

### 11.6. Kernel layers, striding and determinism

| Layer | Step | Method | Striding (state-driven, never `kh`-driven) | Contents |
|---|---|---|---|---|
| EV | exact | Binary heap ordered by (t, edgeId, seq) | — | Packets (§11.8) |
| NF | 0.5 ms | Exponential Euler, r ← F + (r − F)·e^(−h/τ). Only the active set is updated (§11.17). Inputs read from history with linear interpolation of fractional delays | When no node is awake and no wake is pending, the layer jumps to the next 1-s boundary of `tH`. Quasi-static stride: when max \|Δx\| over 1 s < 10⁻³ and no packets are queued, awake nodes are set to r = F(x) and the layer strides 1 s. It never jumps past a known event, a packet arrival or an active gain ramp | Brain, cord, receptors, ganglia, muscle activation |
| CV | 10 ms | Exponential relaxation; dead times as rings sized in seconds. RSA, the OU drive noise and MSNA bursts are seeded analytic overlays of `tH` added at readout (§7.8, §7.14), not states | Coarse 1-s steps after ≥ 10 s of quiescence of the deterministic core (overlays excluded), judged on 1-s boundary values. Only while NF is quiet, no packets are queued, and no gain ramp or pending event lies inside the stride — the same retargeting rule as NF, because a 1-s coarse step across a 1-s gain ramp would apply the whole switch change at one boundary and change the autonomic-off transient (the 108 bpm peak depends on a 0.5-s vagal decay, §11.10) | Heart, vessels, baroreflex, respiration, pupil, SCR, modulator pools |
| GI | 100 ms | Analytic slow-wave phase in `tH`; reflex kernels; transit at 1 s | Jumps to the next 1-s boundary when the gut is empty and no meal input is active (§8) | Enteric layer |
| EN | 1 s | Exponential relaxation; adrenal delay ring | — | Hormones, RAAS, AVP, thermoregulation |
| IM | 10 s | Exponential relaxation; transcription delay ring | — | LPS, cytokines, PGE2, `tSet` |
| CR | 60 s | Per §3 | — | Process C, process S, scheduled `arousalState` transitions (salience-triggered awakenings are NF-step events, §3.11) |

**Lazy striding with retargeting.** A stride is decided at its start but carried out only at its target time. While it runs, the strided layer's state is held, and other layers read that held value. If an event is scheduled inside a pending stride (a click, toggle or scenario input), the stride target is moved back to the event's grid step. A replay that knows the event from the start chooses that same target. Live and replayed runs therefore follow identical trajectories, and events take effect at their true `tH` with no added latency.

**NF active set.** A node goes to sleep when |Δr| ≤ 10⁻⁶ rmax, |F − r| ≤ 10⁻⁶ rmax, it has no external drive, and r − r_rest ≤ 0.1 rmax. A sleeping node keeps its last value, and history reads at or after its sleep step return that value. A changing node schedules each target to wake at step n + d_e on a timing wheel. On waking, a node back-fills the history slots it skipped. During a gain ramp, every NF target of an edge gated by the ramping network is kept awake.

Ordering and determinism rules:

- Each layer keeps an integer step counter; its k-th step ends exactly at k·h. Every trajectory is therefore a function of `tH` and the event log only.
- Each scheduler iteration processes the earliest item. Ties are broken in this order: packet, then event, then layer step, and among layer steps NF, CV, GI, EN, IM, CR.
- Events are snapped up to the NF grid. `kernel.schedule()` accepts only `tH` ≥ the current kernel time.
- Each layer has its own `mulberry32` stream, seeded from (scenario seed × 1,000 + layer index + 1). Draws happen only inside grid steps. `Math.random` is forbidden in the kernel and in the adapter.
- Clicks, toggles and intervention changes are logged with their effective `tH`, so any run can be replayed bit for bit at any frame rate.
- A CPU overrun stops the kernel at a step boundary (time slicing, §11.7), which lowers the effective `kh`. It never changes a step size (A.4).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Steps EV / NF / CV / GI / EN / IM / CR | exact / 0.5 ms / 10 ms / 100 ms (transit 1 s) / 1 s / 10 s / 60 s | — | — | high | A.4; this section |
| NF history ring per source | Next power of two ≥ (longest outgoing delay / 0.5 ms + 3); minimum 8, maximum 8,192 samples (4.096 s), Float32 | samples | — | high | this section; A.4 |
| History memory at the itemised size | 0.24 (fixed 4,096-sample rings: 10.4) | MB | — | high | prototype `s11/run.mjs` |
| Longest ring need | 2.80 s (Cmi 0.5 m/s over 1,196 mm great toe → L5 DRG plus the 203-mm L5 root, §2.14, §2.5) → 8,192 samples | s | — | medium | §2.14 path; A.9 velocity |
| Timing-wheel size | 8,192 | NF steps | — | high | [model] |
| NF sleep thresholds | 10⁻⁶ rmax (change); 0.1 rmax above rest (elevated) | — | — | low | [model] |
| CV quiescence | \|Δhr\| < 0.02 bpm/s and \|Δmap\| < 0.02 mmHg/s on 1-s boundaries of the deterministic core (RSA, OU noise and MSNA overlays excluded), for ≥ 10 s | — | — | low | [model] |
| Coarse-mode simplifications | Dead times collapsed to the current command; the overlays continue analytically | — | — | medium | [model] |
| NF rest settling at load | 3 s of `tH` with full update, cached | s | — | medium | [model] |
| RNG | `mulberry32`, one stream per layer | — | — | high | `src/anatomy.js` L74 |

### 11.7. Clock

`src/clock.js` alone sets `kh`. A user lock overrides a scenario delegate (the orgasm scenario's own clock, §11.14), which overrides scenario keyframes, which override the adaptive rule. The CPU budget acts on all of them through time slicing (below). `kh` moves in log space at no more than 1 decade per screen second, except while the delegate holds the clock (§11.14), and the HUD shows `t 23.0 ms  ×1/100` (A.4).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| `kh` range | 0.005–3,600 | human s per screen s | — | high | A.4 |
| Presets | reflex ×1/100 · pain ×1/10 · autonomic ×1 · gut ×10 · endocrine ×60 · immune ×900 · circadian ×3,600 | — | — | high | A.4 |
| Slew | ≤ 1 | decade per screen s | — | high | A.4 |
| Packet target | clamp(min transit / 2.5 s, 0.005, 1), over leading packets (§11.8) on extracerebral edges ≥ 50 mm | — | — | medium | A.4, refined here |
| Contact heat pending | 0.02 | — | — | medium | [model] |
| Cardiac and electrodermal target | 1 when the breath-averaged `hr` changes by > 3 bpm per 10 s, the breath-averaged \|dMAP/dt\| > 0.15 mmHg/s, the nociceptive command > 0.02, or an evoked (not spontaneous) SCR is active | — | — | low | [model]; on raw values the rule fired in 96 % of CV steps at rest |
| Endocrine target | 60 while any neuroendocrine pool is away from **its current steady-state target**: gap = max over `crhRel`, `acthRel`, `S`, `cortisolRel` and the adrenaline pool of \|x − target\| / max(x, target, 0.1), and the vote applies while gap > 0.08. The target includes the circadian drive and any clamp, so it is not 1. A steady state votes nothing, including the saturated one reached after a gland is removed | — | — | low | [model]. Measuring the distance to 1 instead would hold the clock at ×60 at rest, because the §9.4 circadian envelope (a_C 0.6) puts the resting pools several per cent from basal — `cortisolRel` 0.944 and `acthRel` 0.945 at the default 10:00 start, 1.015 two hours later — and would hold it there for good after adrenalectomy or hypophysectomy, where ACTH saturates. The 0.08 threshold leaves room for the lag of a pool tracking the envelope (τ · dx/dt, up to ≈ 5 %), which 0.03 would not |
| Immune target | 900 when cytokines are present or \|tCore − tSet\| > 0.05 °C | — | — | low | [model] |
| Anticipation | Descent starts when tOnset − tH ≤ H_desc = Δt·Σ_{j=1..J} max(k₁, k·10^(−jΔt)), J = ⌈log₁₀(k/k₁)/Δt⌉. Δt is the **screen** frame time in seconds, with the slew of 1 decade per screen second folded into the exponent; the clock evaluates it with the current frame's dt (clamped at 0.1 s, and 1/60 s before the first frame). Headless form: (k − k₁)/ln 10 | s (human) | — | high | this section |
| Approach of a manual click | log₁₀(k₀/k₁) screen s, plus ≤ 1 frame when H_desc is used | s | — | high | this section |
| Scheduled stimuli | Pull `kh` down in advance when < 2.5 screen s ahead | s | — | high | A.4 |
| CPU budget per frame (kernel incl. NF) | ≤ 1 desktop; ≤ 2 low tier | ms | — | medium | A.7; enforced by time slicing |
| Time-slice check | Every 16 scheduler iterations | — | — | medium | [model] |

**Refinements to the A.4 packet rule.** In the prototype, two kinds of packet held `kh` at its 0.005 floor. Sustained 20-per-s trains on long edges did so, and so did intracerebral packets, whose transit is 2–10 ms. As a result, 200 screen s advanced only 26.9 human s. Counting only leading packets (§11.8) on extracerebral edges lets the same session advance 116.7 human s, while each volley front still travels for ≥ 2.5 screen s (§11.17). Brain packets are still drawn at the `kh` in force.

**Anticipation.** The analytic formula overestimates the human time a stepwise descent takes, by 1.9 % at 60 fps, 11 % at 10 fps and 0.5 % at 240 fps. The descent therefore reaches k₁ early, and the clock then waits (H_analytic − H_desc)/k₁ screen s. Because the relative overestimate is the same at every start, that wait grows with k₀: ≈ 0.4 s from ×1 at 60 fps (0.8 s at 30 fps), but ≈ 25 s from ×60, ≈ 373 s from ×900 and ≈ 1,490 s from ×3,600 (≈ 2,962 s at 30 fps). This is why the stepwise sum H_desc is used rather than the closed form. Because the clock re-solves the descent every frame, frame-time jitter cannot make the descent late: H_desc is an upper bound of the stepwise sum for any frame time, and the per-frame feedback removes the early-arrival wait, so `kh` reaches k₁ at tOnset. The logged tOnset is the one computed from the clicking frame's H_desc. The descent target, once triggered, is held until the episode's hold window ends. Without that hold the target would flicker between k₁ and the preset.

**CPU budget.** Each frame the clock proposes `kh` and h = dtS·kh; `kernel.advance(h, budgetMs)` stops at a step boundary once the frame's budget is spent and returns the `tH` reached; the clock commits that `tH` as the truth (`commit(tReached)`). The effective `kh` for that frame is therefore lower, while step sizes and the trajectory stay unchanged. **While a scenario delegate holds the clock, `commit` is a no-op**: the delegate owns the `tH` axis (§11.14, B.6 step 5), so `commit` leaves `tH` at the adapter's time and the kernel lags behind it and carries the backlog, rather than the kernel's reached time becoming the truth. Everything else that advances in `tH` advances to the committed time. A per-frame governor based on work units could not prevent spikes during a 0.3-s cascade, because the slew limit is slower (§11.17). Time slicing is therefore the enforcement mechanism, and Appendix B implements it (B.4, B.6).

### 11.8. Packets

Packets are records `{t, edgeId, seq, tEmit, amp, lead}`. The display position is u = (tH − tEmit)/(t − tEmit), mapped onto the polyline (afferent packets move 1 → 0, A.2).

- **Emission.** Only `axon` and `tract` edges ≥ 50 mm emit packets. The first packet of a volley (`lead = true`) leaves at the NF step where the source rises 0.1 rmax above rest. Further packets follow every 50 ms per edge while the source stays above threshold. The cap applies to every packet, so a volley that starts less than 50 ms after the previous packet on that edge waits for the cap. The amplitude is the source activation a = r/rmax × U(0.9, 1.1), drawn from the NF stream.
- **Transport.** On `ring` edges packets are for display, the clock and the event log only. The target's input comes from the history ring, so nothing is counted twice. On `event` edges (delays longer than the source ring, non-NF sources, contact-heat receptor events) the packet carries the drive: on arrival it adds an area-preserving Gaussian of σ = max(1 ms, σ_t), truncated at ±3σ, to the target's input (§4.13).
- **Cut edges.** At delivery a packet is scaled by its edge gain at arrival time, and dropped when that gain is 0. The display fades dropped packets (§13). When the gain is 0, efferent port edges emit "efference only" packets, which are drawn but never delivered.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Emission interval per edge | 50 (≤ 20 per s) | ms | — | medium | this section (within the A.7 range of 20–50 ms) |
| Emission threshold | rest + 0.1 rmax | — | — | low | [model] |
| Minimum edge length for packets | 50 | mm | — | medium | A.4 |
| Amplitude jitter | U(0.9, 1.1) | — | — | low | [model] |
| Delivery kernel on `event` edges | Gaussian, σ = max(1, σ_t) (§4.4), truncated at ±3σ | ms | — | low | [model] |
| Display cap | ≤ 3 per s per region (screen time) | — | — | high | §13 |

### 11.9. Stimulus pipeline

1. **Record.** `{sense, mode, site, side, intensity, unit, durationMs, tOnset}` (A.6).
2. **Site resolution.** The click ray hits the skin (sphere-traced body SDF, §13) or, for interoception, an organ volume. It snaps to a site in a 10-mm hash grid that stores the dermatome, nerve, segment, DRG, polyline and length (§2). Up to 64 site-receptor nodes are created on demand, with edges per fibre class (§11.4).
3. **Receptor recruitment.** Every receptor class whose threshold the physical stimulus exceeds is driven, whatever sense was picked. §5 owns the forms, thresholds and τA.
4. **Contact heat.** For contact heat the receptor temperature is T_rec(t) = T_skin + (T_c − T_skin)·erfc(d / (2√(α(t − t₀)))). Transduction starts when T_rec ≥ θ_heat (§5).
5. **Episode.** The click opens an episode. The clock computes the approach (§11.7) and fixes `tOnset` = tH_now + H_desc(kh_now, k₁), the stepwise descent sum, with k₁ the A.4 target of the first packet edge of the picked site; `tOnset` is logged. The descent then starts at the click and reaches k₁ at onset with no wait. That holds under frame-time jitter only because the clock re-solves the descent every frame against the logged `tOnset` (§11.7); with H_desc computed once from a constant frame time it would not.
6. **Downstream.** Packets (§11.8), NF relays, segmental reflexes and other-network outputs follow §5–§10. §12 owns the default behaviour per sense, and §4/§5 own repetition and habituation.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Skin thermal diffusivity α | 1.0 × 10⁻⁷ | m²/s | H | medium | [T] |
| Heat-nociceptor terminal depth d | 150 (50–200) | µm | H | low | [model] |
| Contact temperature T_c | ≈ object temperature (high-effusivity object) | °C | — | low | [model] |
| Transduction time at d = 150 µm, 55 °C, from 32 °C | 224 | ms | — | low | prototype `research-simulation-model/fast.mjs` (scales with d²) |
| Snap grid | 10 | mm | — | high | §13 (picking) |

In brain-only mode, body sites are disabled. Vision, hearing, smell, taste and balance are injected at `portRetina`, `portCoch`, `portOlf`, `portGust` and `portVest` (A.5, A.6). Interoception requires `autonomic` (A.8 #7).

### 11.10. Switch execution

Rules (expanding A.5):

1. **Gains.** For each network, g.k(tH) is piecewise linear with slope ±1 per second of `tH`, starting at the toggle time and clamped to 0–1. Every layer evaluates it at its own step time, so ramps do not depend on the grid. All g are 0 in brain-only mode, so the master transition is a step in g, not a 1-s ramp; the display fades at the §13.15 rate instead. An efferent gain acts at the effector, after the dead time: tone ← relax(tone, g(t) · command(t − D), τ), so a command already in transit is cut when the nerve is cut. D has two parts and only the first justifies that choice: a conduction part (≈ 0.1 s, legitimately gated before the delay) and, for the 2-s sympathetic dead time (A.8 #14), a mostly neuro-effector and second-messenger part that follows transmitter release. Cutting the nerve stops release at once, but transmitter already released keeps acting for that latency, so gating after D removes a lag the body would keep. The model gates after D for simplicity [model]; the alternative (splitting D into D_cond and D_eff) changes HR at 1 s by ≈ 6 bpm (table below). The display ghost follows g(tH), rate-limited to the §13.15 fade (A.5; §13.10).
2. **Off-state targets.** Neural channels relax by their own kinetics toward zero tone (denervation). Hormones relax toward basal and are clamped there (replacement). Intrinsic tissue behaviour continues: the SA node at IHR (§7), ICC slow waves (§8), myogenic tone and the peripheral innate immune response (§10).
3. **Commands.** Brain nodes always compute their commands. When the gain is 0 these appear as efference-only packets (§11.8) and as tints (§13).
4. **Packets.** Packets on edges whose gain reaches 0 are dropped at delivery (§11.8).
5. **Master switch.** `'brain'` freezes and hides every body layer and clamps body inputs to the brain at basal values (A.5). Vitals show "—". `tH`, the CR layer and every CNS layer keep running (A.5 Master row), so the SCN and the arousal state machine are unaffected. Freezing and resetting are not in conflict: nothing integrates while the body is hidden, and on return to `'body'` the body is **re-initialised from the resting-state cache**, so a scenario interrupted by brain-only mode (a fever in progress, say) is not resumed. The cache key is `(switch set, age, posture, fed, time of day at return)` — the same key in §12.1 and in B.4's `settle(init)`. None of those may be dropped: a supine rest cannot be restored for an upright body, and the resting HPA pools depend on the time of day (the §9.4 circadian envelope, a_C 0.6, puts `cortisolRel` at 0.944 at 10:00 and 1.015 two hours later). Restarting from default initial values is not enough: the prototype then shows HR 74.4 bpm and SBP 109 mmHg 5 s after restoring.
6. **Building the cache.** The slow layers (EN, IM and the GI fasting state) are set to their **analytic** rest for the key's time of day, with the circadian phase held fixed; only NF and CV are settled by integration, over 300 s of `tH`, lazily at first use (§11.17). Integrating 300 s from default values cannot reach a circadian rest that differs from basal by a few per cent, because the cortisol pool has t½ ≈ 66 min (§9.4): starting from 1 toward 0.944 it reaches only ≈ 0.984. A "change < ε over 60 s" criterion is likewise too weak for pools with τ ≥ 30 min, which is why the slow layers are set rather than settled. This cache supersedes the per-scenario warm-ups recorded in §12.1.

| Switch off | Gains → 0 on | Off-state targets | Emergent behaviour in the kernel | HUD tag |
|---|---|---|---|---|
| Master | All body edges and layers | Body frozen; brain inputs clamped (cortisol, tCore, PaCO₂, PaO₂ at A.5 values) | NTS visceral drive 0; somatic and visceral thalamic relays silent; preBötC fictive; RVLM, DMV, PVN and EW commands efference only | "—" |
| Somatic | `som.*` edges, somatic cord tracts, cranial GSE/SVE | `emg`, `force`, `shiver` → 0 | No skin, pain, temperature or proprioceptive input reaches the cord. Standing becomes a passive tilt. Fever relies on vasoconstriction and BAT. Startle reduces to autonomic signs | EMG 0; "ventilation maintained" |
| Autonomic | `ans.*` edges (pre- and postganglionic, visceral afferents, bulbospinal) | Tones `v`, `s` → 0; pupil → denervated diameter (§7); SCR, salivation, BAT → 0 | HR → IHR(age) with the direct temperature effect (§7). Baroreflex and peripheral chemoreflex open. RAAS keeps its renal share. No RSA, cephalic phase, vagal satiety or inflammatory reflex | HR "intrinsic" |
| Enteric | `ens.*` edges | Reflex kernels, MMC, tonic inhibition → 0 | Slow waves persist. Sphincters close. Gastric emptying falls to the 5 % floor of §8.8 (G_pyl 0.05), an extreme-case model of ENS loss (pylorospasm and achalasia-like), not a claim about any one disease [model]. Gut branch of the inflammatory reflex lost | motility ≈ 0 |
| Neuroendocrine | Portal, pituitary, adrenal, AVP, RAAS and distant gut-hormone edges | Hormones → basal (clamp) | No cortisol or adrenaline surge, RAAS rescue or cortisol brake. Orgasm scenario: prolactin and oxytocin clamped | "basal" |
| Neuroimmune | All immune ↔ nervous edges | `pge2` brain signal and `vagAI` → 0; `tSet` at baseline (§7) | Cytokines higher and longer; no fever, fever tachycardia, sickness behaviour or infection-driven HPA activation | `tSet` flat |

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Gain ramp duration | 1.0 | s of `tH` | — | high | A.5. The ramp is in `tH` by design, so its screen length varies with `kh`: 200 screen s at the ×1/100 reflex floor and 0.28 ms at ×3,600. At `kh` < 1 the display shows the ghost at the §13.15 `t_fade` rate (≥ 0.8 s of `tS`) while the physical ramp continues underneath, and the HUD marks the toggle with a transient tag (§13.14); at `kh` ≫ 1 the toggle is effectively a step |
| Resting-state cache, slow layers | analytic, not integrated (rule 6) | — | — | medium | [model] |
| Ramp in the prototype (somatic off at 2.1 s) | g = 1.00 at 2.1 s, 0.50 at 2.6 s, 0.00 at 3.1 s; 3 of 283 packets dropped | — | — | high | prototype `s11/run.mjs` |
| Autonomic off from rest, HR | 68 → ≈ 86 at 1 s, ≈ 108 at 3 s (peak), 101.5 at 30 s, 101.0 at 60 s | bpm | — | low | §7.5–§7.8 equations with the gate after the dead time (`verify-math-simulation/cv.mjs`; re-run on the implemented CV layer); gate before the dead time: ≈ 83 at 1 s, 109 at 3 s |
| Autonomic off from rest, SBP | 115 → 111 at 3 s → 93 at 30 s → 92 by 60 s, falling throughout that first minute, then flat at 91.8 from ≈ 120 s (gate before the dead time: ≤ 118 at 2–3 s) | mmHg | — | low | same |
| Autonomic back on | HR 60–76, SBP 99–121 over 60 s while the loop re-engages | bpm, mmHg | — | low | prototype `research-simulation-model/toggle.mjs` (earlier kernel; to be re-run on the §7 equations) |
| Resting-state cache window (NF and CV only) | 300 | s of `tH` per cache key | — | medium | [model]; the CV layer is flat well inside it (SBP 92.07 at 60 s, 91.81 at 120 s and at 300 s) |

The brief HR overshoot to ≈ 108 bpm when autonomic is switched off comes from the vagal/sympathetic timing difference of A.8 #14: vagal tone decays with τ 0.5 s, while sympathetic tone keeps acting through its 2-s dead time and τ_off 10 s. It is consistent with "own kinetics" (A.5) and is physiologically expected for an instantaneous cut. There is no hypertensive transient: §7.5 makes output depend on venous return (co ∝ hr^0.25), so MAP falls as the sympathetic tones decay. The Vitals rows carry the tag "switch transient (model)" while |dMAP/dt| > 0.5 mmHg/s after a toggle (§13.14). The earlier prototype's 151 mmHg came from a CO ∝ HR law that §7 does not use.

### 11.11. Cross-network AND edges

| Function | Chain (A.3.3 ids) | `nets` | When one network is off | Evidence |
|---|---|---|---|---|
| Adrenal adrenaline | `cord.T5…T11.iml` (§7.2) → `splanchnicGreater` → `adrenalMedulla` → `adrenaline` → `heart`, `muscleVessels`, `liver` | autonomic ∧ neuroendocrine | No adrenaline surge; neural sympathetic effects remain if autonomic is on | graph: sympathoadrenal system → adrenal medulla |
| Inflammatory-reflex efferent | `dmv` → `cn10` → `coeliac` → `splenicNerve` → `splenicTcells` → `macrophages` (α7nAChR) | autonomic ∧ neuroimmune | Vagal TNF brake lost | [G Inflammatory_reflex L31]; graph: inflammatory reflex → acetylcholine → α7 nicotinic receptor; route contested (A.8 #16) |
| Vagal immune sensing | `stomachWall`, `liver` → `nodoseGang` → `ntsVisc` | autonomic ∧ neuroimmune | Only the CVO (humoral) route remains | §10 |
| Cortisol on immune cells | `cortisol` → `macrophages` | neuroendocrine ∧ neuroimmune | Glucocorticoid brake lost | §9, §10 |
| Cytokine → PVN | `pge2`/cytokine signal at the CVOs → `pvn` (`portCVO`; k_cyto, §10.5) | neuroimmune; the CRH → ACTH → cortisol output also needs neuroendocrine | No HPA response to infection | [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L66] |
| Vagal motor to the gut wall | `dmv` → `gut.oes…jej` | autonomic ∧ enteric | Vagal motor effective only on the striated oesophagus (A.5) | [G Vagotomy L39] |
| Gut branch of the inflammatory reflex | `dmv` → `gut.*` (enteric cholinergic) → `macrophages` | autonomic ∧ enteric ∧ neuroimmune | Lost if any of the three is off | §8, §10 |
| Baroreceptor-driven AVP | `carotidSinus` → `ntsVisc` → `son`, `pvn` → `pituitaryPost` → `avp` | autonomic ∧ neuroendocrine | No AVP pressor response | [G Baroreflex L35]; §9 |
| Cephalic phase | `retina`, `olfEpith`, `tongueAnt` → … → `dmv` → `gut.*`, `pancreas` | special ∧ autonomic (insulin action also needs neuroendocrine) | No cephalic secretion or insulin | §8 |
| Pupillary light reflex | `retina` → `opn` → `ew` → `ciliaryGang` → `pupilSphincter` | special ∧ autonomic | Pupil fixed at the denervated diameter | [G Pupillary_light_reflex L56–L59] |
| Startle motor | `cochlea` → `cochNuc` → `pnc` → `n7m`, `portRS` → muscles | special ∧ somatic | Central startle only | [G Startle_response L47] |
| Startle autonomic signs | `pnc`, `lc`, `cea` → `rvlm`, `nAmbVagal` → effectors | special ∧ autonomic | No SCR, pupil or HR response | §7 |
| Fever effectors | vasoconstriction and BAT: autonomic; shivering: somatic; set point: neuroimmune | per effector | The remaining effectors chase `tSet` more slowly | §6, §7, §10 |

### 11.12. Interventions

Interventions follow A.5. Only one preset is active at a time, and presets are kept separate from the switches. Each preset removes specific nodes or edges, or fixes a channel, and the rest of the model responds. The content belongs to each owner. An edge removed by a preset carries its own **cut flag**, separate from the `nets` mask and the body flag of §11.3, so a preset can be lifted without recomputing the masks.

| Intervention (owner) | Kernel action |
|---|---|
| Spinal cord injury, level × type × phase (§6) | Remove tract edges that cross the lesion segment in the (ξ, η) map. Scale segmental reflex gains by phase. A lesion at or above T6 activates the dysreflexia rule (§7) |
| Named nerve section with day slider (§6) | Remove the nerve's edges; target `force` → 0; follow the §6 denervation timeline |
| Dorsal rhizotomy (§6) | Remove the afferent root edges of the chosen segments |
| Heart transplant (§7) | Cardiac `v` and `s` fixed at 0; adrenaline still acts (blood edge, gated by neuroendocrine only, §11.13) |
| Atropine (§7) | Muscarinic effect of `v` fixed at 0 (heart, pupil sphincter, glands) |
| Truncal vagotomy (§7) | Remove abdominal `cn10` edges (DMV gastric efferent, abdominal vagal afferents, coeliac branch); cardiac vagus intact [G Vagotomy L39] |
| T2–T3 sympathectomy, stellate option (§7) | Remove hand sudomotor and vasomotor edges; the stellate option also removes the cervical (Horner) channels |
| Pure autonomic failure (§7) | Postganglionic sympathetic gain reduced (§7 sets the value) |
| Adrenalectomy, hypophysectomy (§9) | Remove adrenal or pituitary output edges; the brain commands keep rising because feedback is lost |
| Splenic denervation; vagus nerve stimulation slider (§10) | Remove `splenicNerve`; or add a fixed efferent drive to `vagAI` |

### 11.13. Cross-network coupling

| Writer (layer) | Variable | Reader (layer) | Gate |
|---|---|---|---|
| NF nociceptive relays (`pbn`, `insPost`) | `noci` | CV commands; EN adrenaline | somatic for the afferents; autonomic to act |
| NF startle (`pnc`, `lc`) | `startle`, `lcPhasic` | CV vagal command, pupil, SCR | special ∧ autonomic |
| Scenario stress, `salience` (NF) | stress drive | CV commands; EN CRH, adrenaline | autonomic; neuroendocrine |
| CV baroreceptors | `ntsVisc` drive | CV commands; EN AVP | autonomic; autonomic ∧ neuroendocrine |
| CV `map` | renal perfusion | EN `raas` | neuroendocrine (sympathetic share needs autonomic) |
| CV `s` | sympathetic gut tone | GI antral strength | autonomic |
| GI meal load, duodenal delivery | splanchnic load; `cck`, `glp1`, `pyy` | CV `tpr`; brain (`areaPostrema`, `arcuate`) | tissue; neuroendocrine (distant action) |
| GI vagal afferents | `vagMech`, `vagChem` | NF `ntsVisc`, insula | autonomic |
| EN `adrenaline` | β effect | CV `s_eff` | neuroendocrine (the humoral edge carries its own network, §11.3 rule 3; release is separately gated by autonomic) |
| EN `cortisol` | GR/MR feedback; glucocorticoid brake | EN feedback; IM brakes; brain (crosses the BBB, §9) | neuroendocrine; ∧ neuroimmune for the brake |
| EN `tCore` | temperature | CV `hr` (direct SA effect); IM | tissue |
| IM `pge2`, cytokines | central immune signal | EN `tSet`, CRH drive; CV commands; NF sickness gains (§10) | neuroimmune (+ neuroendocrine for cortisol output) |
| CR `procC`, `arousalState` | state | NF thalamic gain; EN circadian drive | cns |
| Orgasm adapter (§11.14) | command record { tH, cmdSym, cmdVag, cmdSacral, apnoea, omega } | CV (switched modes only); pelvic markers (display, A.8 #21) | §11.14 |

Each layer's equations take the switch gains in the following form. The functions and constants belong to §6–§10. Kernel hormone states are ratios to basal (`acthRel`, `cortisolRel`, `adrenalineRel`, …; basal 1), and §9.9 gives the display units.

```
g_e            = [bodyOn if e has the body flag or any nets] · Π_{k ∈ nets(e)} g.k(tH)   (1 for a cns/special edge; see the three-case predicate, §11.3 rule 2)
NF input       x_i = I_i^ext + Σ_e w_e · g_e · a_src(e)(t − d_e),   a = r / rmax (dimensionless; §4.13; w, I_ext Table 4.8e)
Autonomic tone tone ← relax(tone, g.autonomic(t) · command(t − D), τ)       command always computed; gate after the dead time (§11.10)
Adrenal β      s_eff = s + k_adr · (adrenalineRel − 1) · g.neuroendocrine   (k_adr §7.5; release gated by autonomic, §9.6)
Hormone h      h ← relax(h, g.neuroendocrine · h_cmd + (1 − g.neuroendocrine), τ_h)   h, h_cmd as ratios, basal = 1
Brakes         brake_C uses g.neuroendocrine · g.neuroimmune; brake_V uses g.autonomic · g.neuroimmune (+ g.enteric, gut branch); forms §10.2
Set point      tSet = baseline (§7) + g.neuroimmune · ΔtSet(pge2) (§10.2, §10.6)
SA node        hr ∝ IHR · f_T(tCore), f_T = 1 + k_T · (tCore − 37) (k_T §10.6; law §7.5)
Pupil          pupilD = g.autonomic · D_reflex + (1 − g.autonomic) · D_denervated (§7)
Gut            antral ∝ g.enteric · (a + b · g.autonomic); pyloric G_pyl = max(g.enteric, 0.05), colonic κ × max(g.enteric, 0.05) — one 5 % floor, as §8.8 and §8.13 define it (§8)
Ventilation    somatic off or brain only: PaCO₂, PaO₂ clamped (A.9)
```

### 11.14. Orgasm scenario adapter

With all networks on, every trace equals the reference recorded by the legacy path of the same commit with the same seeded stream (A.8 #21; B.13). Before the DOPAMINE.md §9.8 port that path is the frame-driven `update(dt)` loop, compared for the same frame-time sequence. From the port onward (Phase 0a, B.15, which this document adopts) it is the ported model on the DOPAMINE.md §9.3 0.05-s `tH` grid; the golden traces are recorded again at the port, and DOPAMINE.md §6.9 and §9.6 become its targets (§12.13). The frame-driven legacy traces are not reproduced after the port. Brain-only mode runs the central form. DOPAMINE.md remains canonical for every value.

| Item | Rule |
|---|---|
| Integration step | Runs the body of the `update()` substep loop (`src/response.js` L342–L347, extracted as `advanceHuman(h, S)`, B.5): `_integrate(h, S)`, then the `phaseTh`, `aboveTheta` and `stimOffH` updates, then `_transitions()`, then the `onStep` hook (`src/main.js` L90). `_transitions` reads all three counters, and without them the plateau never ignites |
| Grid, before the port | h = dt·kh in substeps of ≤ 0.5 s, the demo script and the `noClimax` exit in screen time, as today; frame-rate dependent (table below) |
| Grid, after the port | A **step cap** of 0.05 s of `tH`, not a fixed grid (DOPAMINE.md §9.3): fast phases need ≤ 0.05 s, and a larger step is allowed only where DOPAMINE.md §6.8 permits it. This removes frame-rate dependence; the demo script runs in `tH`; the dopamine substeps keep DOPAMINE.md §6.8. The cap bounds the adapter's work per frame: at the recovery delegate's `kh` up to 4,320 and 60 fps a frame covers 72 human s, i.e. ≤ 1,440 response steps and ≤ 3,600 dopamine 0.02-s substeps, which is why B.9 carries a measured adapter cost line of its own — the adapter sits outside the 1 ms kernel budget |
| RNG | `Math.random` (`src/response.js` L189–L217) is replaced by the adapter's seeded stream (§11.6) in both stages, and the reference is recorded with that stream |
| Clock | `kh` comes from the scenario's own clock (the legacy `LogRamp` and `CLOCK` table, L83–L88; after the port the DOPAMINE.md §9.3 clock) through a clock delegate in `src/clock.js`. Its phase changes depend on model state (ignition needs `aboveTheta` ≥ 0.5 s with Aeff ≥ θ, L298; the recovery `kh` = max(60, remaining/20) is set at entry, L145), so it is not a `clockKeys` list (§12.2). The delegate follows the scenario clock verbatim and is exempt from the A.4 slew and range: the 1 → 20 ramp in 1 s (1.30 decades/s), the 60 → recovery ramp (up to 1.85 decades/s), recovery values above 3,600 with long refractory settings, and the instant switch into ONSET or `inevitability`. Source order: user lock › scenario delegate › scenario keyframes › adaptive (A.4) |
| CPU budget | An overrun never changes the delegate's `kh`. The adapter advances first, because the CV layer reads its commands; the kernel then advances within its budget and carries the remainder into the next frame. If the backlog exceeds one frame, the kernel exceeds its budget for that frame rather than fall further behind (§11.7; B.6) |
| Vitals, all networks on | Pass-through: `hr`, `rr`, `sbp` ← `sys`, `dbp` ← `dia` from `vitals()` (L354). The CV layer is slaved to these values, so the regression is exact by construction (A.8 #21; §7.13 V21) |
| Command record (switched modes only) | `{ tH, cmdSym, cmdVag, cmdSacral, apnoea, omega }`, written by the adapter at each substep and read by the CV layer zero-order hold by `tH` (B.6): `tH` (s); `cmdSym` (0–1) = h = clamp(0.3·Ah + 0.7·sigma), the drive of `vitals()`, added as an offset to `tone.symCard`, `tone.symMus` and `tone.symSpl`; `cmdVag` (0–1) = h, subtracted from `tone.vagCard`; `cmdSacral` (0–1) = G, the `fSacral` tone; `apnoea` (bool) = the `vitals()` breath-hold flag, the central apnoea command of §7.9; `omega` (0–1) = Omega, used only for the pelvic markers. §7 owns the offset gains (§7.15) |
| Autonomic off | `hr` = IHR(age) · f_T (§7), tagged "intrinsic". BP at the autonomic-off rest state. The pelvic parasympathetic channel G has no peripheral effect. Central A, D and dopamine unchanged |
| Somatic off | Central arousal path only, with no rhythmic pudendal output stream. A vagal, cord-bypassing visceral afferent route has been proposed from fMRI in five women with spinal cord injury at or above T10 — four complete, one incomplete, three of the five reaching the end point — reporting NTS activation (Komisaruk et al. 2004, *Brain Res* 1024:77, H, low); it would belong to `autonomic` and is not modelled |
| Neuroendocrine off | Prolactin and oxytocin clamped at basal; the TIDA short loop in `dopamine.js` is frozen (DOPAMINE.md §5) |
| Brain only | `response.js` central variables and the dopamine layer only; κ coupling to peripheral vasocongestion removed; vitals "—" |
| Display | Static neutral figure. Once the DOPAMINE.md rule-7 amendment (§11.18) is confirmed by the user (§13.18), the pelvic streams carry schematic, non-rhythmic activity markers (rate and speed not to scale; §13.9, §13.14; A.8 #21); until then they keep their resting display |
| Names (A.3.4) | `sys`/`dia` → `sbp`/`dbp`; `tHuman` → `tH` |

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Adapter grid after the port | 0.05 | s of `tH` | — | high | DOPAMINE.md §9.3; this section |
| Orgasm onset, current `update(dt)`, seed 1, at 30 / 60 / 144 fps | 7.32 / 9.46 / 8.80 | human min | — | high | prototype `research-simulation-model/orgasm.mjs` |
| Orgasm onset, fixed grid, same seed, at 30 / 60 / 144 fps | 8.20 / 8.20 / 8.20 | human min | — | high | same |
| HR maximum, fixed grid vs current | 120.2 vs 120.1 | bpm | — | high | same |

### 11.15. Rendering hand-off: state texture

Per-region state currently reaches the GPU as vec4 uniform arrays, each with `REGION_COUNT` entries (`src/anatomy.js` L48, over the `REGION_IDS` list at L17–L41): `uRegion` and `uTint` in the neuron shader (`src/shaders.js` L30, L63) and `uDA` in the dopamine shader (L122). They are uploaded at `src/renderer.js` L104, L131 and L139.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Current `REGION_COUNT` | 33 | regions | — | high | `LEGACY_REGION_COUNT`, `src/anatomy.js` L49 (the original build, indices 0–32) |
| Guaranteed vertex uniform vectors (WebGL2) | 256 | vec4 | — | high | Khronos GLSL ES 3.00 specification |
| Regions after the §3 additions | 122 (33 + 89, §3.15); 123 with the DOPAMINE.md §7.3 A14 region | regions | — | high | §3.15; B.3 |
| Uniform need per program at R = 122 (24 + 2R neuron shader; 67 + 2R dopamine shader) | ≈ 268; ≈ 311 | vec4 | — | high | B.3 |

Both programs exceed the guaranteed 256 vectors, so per-region state moves to data textures, uploaded with `texSubImage2D` each frame and read with `texelFetch`. This section owns that decision and the indexing; B.7 owns the formats and sizes, and §13 everything the shaders do with the data.

- **Sided brain state.** The kernel's brain graph has one node per side (`thalVPL.R`, `thalVPL.L`; §11.3, §11.4), so brain columns are indexed column = 2·r + s, with s = 0 for x ≥ 0 and for midline regions and s = 1 for x < 0 (244 of 256 columns used). The cortical `area` attribute stores 2·area + s (≤ 92; 255 = none). `statetex.compose` copies the unsided dopamine channels into both columns of a region, so the orgasm regression is unchanged. A unilateral stimulus therefore lights only the hemisphere whose nodes respond.
- **Rest normalisation.** The brain activity channel carries the rest-normalised value of §13.7, 1 at rest, so the brain-only image is unchanged.
- **Textures (B.7).** `uState` (brain): rows region state (the current `uRegion`), tint (`uTint`), `uDA`, path history (`uPathHist`, ≥ 52 texels for the 13 pathways after DOPAMINE.md §7.6 adds slMFB) and sided cortical areas. `uBodyState`: one texel per body graph node (≥ 1,024: 740 nodes, the dynamic skin sites and 20 % margin) with activity, network ghost factor (following g, §13.10) and a display flag. `uEdgeAct`: one texel per edge, 4,096 for ≥ 2,660 edges (the §11.4 itemised size 2,217 + 20 %; the rounder planning figure 2,200 + 20 % would be 2,640).
- **Packets.** One capacity of 256 visible records per frame with the §13.4 per-tier pool, sorted by path and indexed per path (B.7); the kernel's own heap stays ≤ 32 in the prototype (§11.17).

### 11.16. Files, interfaces and tests

B.4 is the single module and interface list (module paths, classes and signatures), and §13.16 and B.5 refer to it. This table fixes only the responsibilities and the interface semantics that §11 owns.

| Module (path in B.4) | Responsibility and required semantics |
|---|---|
| Clock (`src/clock.js`, `SimClock`) | Sole owner of `kh`; source order user lock › scenario delegate › scenario keyframes › adaptive; proposes `kh` and h each frame and commits the `tH` the kernel reached (`commit(tReached)`, §11.7); episodes and anticipation (§11.7, §11.9) |
| Kernel (`src/sim/kernel.js`) | `advance(h, budgetMs) → tReached`, stopping at a step boundary when the budget is spent; `schedule(ev)`; `snapshot()` / `restore(s)` for seeking (§12.2); packets and readouts |
| Switches and interventions (`src/sim/switches.js`, `src/sim/interventions.js`) | Ramps, off-state targets, resting-state cache (§11.10, §11.12) |
| Graph (`src/sim/graph.js`) | Node and edge tables (§11.4), polyline lengths from §2 |
| Stimuli (`src/sim/stimuli.js`) | Site resolution, receptor recruitment, contact heat (§11.9) |
| Scenarios (`src/sim/scenarios.js`) | Scenario records and checkpoint evaluator (§12) |
| Orgasm adapter (`src/sim/orgasm-adapter.js`) | Wraps `ResponseModel` and `DopamineModel` (§11.14) |
| `test/kernel.test.mjs` | Headless Node: replay identity at 10, 23.7, 30, 60, 144 and 240 fps (the one frame-rate set used everywhere), headless random chunks and time-sliced runs; live vs replay identity; striding error bounds; switch matrix (§12); every one of the 32 switch sets reaches a bounded steady state (A.5 composition); packet caps; budget |
| `test/orgasm.test.mjs` | Regression against the legacy path of the same commit (§11.14; B.13): frame-driven before the DOPAMINE.md §9.8 port, the 0.05-s grid after it, with the DOPAMINE.md §9.6–§9.7 targets after the port; exact vitals pass-through with all networks on |

After implementation, run `graphify update .` from `C:\Users\User\projects\galaxy` (project rule).

### 11.17. CPU budget and prototype results

The prototype is in `C:\Users\User\AppData\Local\Temp\claude\C--Users-User-projects-galaxy\641a402d-336b-4b93-bc5d-2e26265edfd2\scratchpad\research-simulation-architecture\s11\`: `graph.mjs`, `core.mjs`, `run.mjs`, `gov.mjs`, `slice.mjs`, `cache.mjs`, output in `results-s11.txt`. It ran on Node 24 on this workstation. Timings vary by about ±50 % between runs, so ranges are given. It is a model check, not a source. The physiology in `core.mjs` is deliberately minimal and serves only to load and couple the layers.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Replay identity (999 samples × 11 states; 10, 23.7, 30, 60, 144, 240 fps; headless random chunks 0.1 ms–3 s; fixed `kh` 1) | max \|Δ\| = 0; packets 1,248, drops 40, identical | — | — | high | `s11/run.mjs` |
| Time-sliced (0.02-ms budget, 484 frames) vs unsliced | max \|Δ\| = 0 | — | — | high | `s11/slice.mjs` |
| Same screen-time actions, live at 30 or 144 vs 60 fps | Event `tH` differs by ≤ 0.97 s, so the log stores `tH` | s | — | high | `s11/run.mjs` |
| Coarse CV striding vs fine only (live session with toggles) | ≤ 0.091 bpm, ≤ 0.075 mmHg; cortisol and tCore identical | — | — | medium | `s11/run.mjs` |
| Coarse CV with RSA dropped, endotoxin course (richer model) | HR peak +24.57 vs +25.25 bpm; tCore maximum identical | — | — | medium | `research-simulation-model/det.mjs` |
| CV step-size invariance, stand test, h_CV 5–50 ms | MAP minimum 72.04–72.54 mmHg; HR maximum 101.71–102.16 bpm | — | — | medium | `research-simulation-model/stab.mjs` |
| Descent 1 → 0.02 at 1 decade/s | 1.70 screen s; 0.3785 / 0.4175 / 0.4236 human s at 10 / 60 / 240 fps (analytic 0.4256) | s | — | high | `s11/run.mjs` |
| Descent 3,600 → 0.02 | 5.27 screen s; 1,534 human s at 60 fps (analytic 1,563) | s | — | high | same |
| Click approach with the analytic onset | 2.17 / 2.57 / 1.92 screen s at 60 / 30 / 144 fps; `kh` at onset 0.020 | s | — | high | same |
| Human time per 200 screen s, before vs after the packet-rule refinement | 26.9 vs 116.7 | s | — | medium | same |
| Full NF update (637 nodes, 2,036 edges) | 80–104 µs/step; 2.7–3.5 ms per frame at `kh` 1 (33.3 steps) | — | — | medium | same |
| Mean awake NF nodes during the hot object | 85.6 (13 % of 637) | nodes/step | — | medium | same |
| Hot object, mean / maximum frame cost at `kh` 0.02 | 0.008–0.011 / 0.17–0.87 | ms | — | medium | same |
| Same at `kh` 0.35 | 0.14–0.20 / 0.97–1.78 | ms | — | medium | same |
| Same at `kh` 1 | 0.38–0.67 / 2.3–3.9 | ms | — | medium | same |
| Rest, at `kh` ≤ 1 / 60 / 900 / 3,600, with CV striding (minimal physiology: no RSA, no OU noise) | ≤ 0.0006 / 0.006–0.011 / 0.09–0.14 / 0.40–0.55 (3.6–4.8 without CV striding) | ms/frame | — | medium | same |
| Endotoxin + stressor course, at `kh` 60 / 900 / 3,600 | 0.02–0.03 / 0.87–1.71 / 0.97–2.61 (fine CV steps during transients); ×900 and ×3,600 exceed the 1-ms desktop budget, so time slicing lowers the effective `kh` | ms/frame | — | medium | same |
| NF unit cost, 637 units: all awake; 85 awake | 30–34; 3.6–3.8 µs/step (≈ 1.0–1.1 ms per frame at `kh` 1 all awake; 7.2–7.6 ms at ×60 and ≈ 110 ms at ×900 with 85 awake and no NF stride) | — | — | medium | `verify-math-simulation/perf.mjs` |
| Hot object, user lock at `kh` 1, unsliced | p95 1.8–3.3, maximum 3.6–9.3 | ms/frame | — | medium | `s11/slice.mjs`, `s11/gov.mjs` |
| Same with a time-sliced 1-ms budget | p95 1.33–1.35, maximum 1.63–2.06; minimum effective `kh` 0.26–0.45; 2.58–2.62 screen s for 2.5 human s | — | — | medium | `s11/slice.mjs` |
| Packets: 0.35-s hot object; 2-s palm stimulus | 622 packets, heap ≤ 23; 45 emitting edges, at most 57 on one edge over 3 s (19 per s), 2,399 total, heap ≤ 32 | — | — | medium | `s11/run.mjs` |
| Load: graph build; NF rest settling; resting-state cache per switch set | 19 ms; 0.37 s; 80 ms | — | — | medium | `s11/cache.mjs` |

The rest figures with CV striding rely on the deterministic-core quiescence rule of §11.6: with the specified physiology, RSA (§7.8) and the OU drive noise (§7.14) would otherwise keep the CV layer from ever striding (|Δhr| between 1-s boundaries reaches 6.5 bpm/s with RSA; only 11.7 % of boundaries pass with the noise alone), and the "without CV striding" figure would apply. They also need the §11.7 cardiac target on breath-averaged values, since the raw rule fired in 96 % of CV steps at rest and pinned the adaptive `kh` at 1, and the NF quasi-static stride of §11.6, without which awake nodes cost 2,000 or 30,000 NF steps per frame at ×60 or ×900. The §11.17 figures must be measured again with the full §7 CV layer and the §3 graph, and reported at ×900 and ×3,600 against the 1-ms budget (§11.19). The kernel cost does not depend on the rendering tier, whose point budgets belong to §13. The low tier gets the 2-ms budget (§11.7). Mobile JavaScript has not been measured. The signal-processing lens estimates it at 3–5 times slower [model], and time slicing enforces the budget either way.

### 11.18. Reconciliation with `src/` and DOPAMINE.md

- `src/response.js`: `CLOCK` (L83) and `LogRamp` (L88) feed `src/clock.js` through the scenario delegate instead of owning the clock (§11.14). `Math.random` (L189–L217) is replaced by the seeded stream. The substep body of `update(dt)` (L341–L348) is extracted as `advanceHuman(h, S)` and called only by the adapter. Its current step cap of 0.5 s is below DOPAMINE.md §9.3's 0.05-s requirement for fast phases; the DOPAMINE.md §9.8 port (Phase 0a, B.15) moves it to the 0.05-s grid.
- `src/main.js`: the `tick()` loop (L166–L235) keeps the 0.1-s frame-dt cap for rendering only. The kernel advances by `kh·dt` with a budget and is independent of that cap.
- `src/shaders.js` L30, L63, L122 and `src/renderer.js` L104, L131, L139: move per-region state to the state texture (§11.15) before the §3 nuclei are added.
- `src/anatomy.js`: the §3 splits (`pallidum` → `gpe` + `gpi`; `raphe` → `dr mnr rmg rpa rob`; `pituitary` → `pituitaryAnt` + `pituitaryPost`) create new region ids. The graph must use the new ids, and DOPAMINE.md terminal fields that map to `pallidum` or `pituitary` must keep their current region assignment.
- DOPAMINE.md §10 rule 7 now allows the neutral body network "as specified" in ANALYSIS.md, but adds that "the dopamine scenario adds nothing below the brainstem except the labelled A11 beam". This conflicts with A.8 #21, so the proposed wording, pending the user's confirmation (§13.18), is: "…except the labelled A11 beam and, when the body is visible, schematic, non-rhythmic activity markers (rate and speed not to scale) on the hypogastric, pelvic-splanchnic and pudendal streams of ANALYSIS.md §11.14; the figure stays static and neutral." Until it is confirmed, the streams keep their resting display.
- DOPAMINE.md §9.6 describes the ported model, which runs its demo stimulus in `tH` on the 0.05-s grid; the frame-driven code misses it until the port (§12.13). Regenerating §9.6 from the post-port code is optional and needs approval (§12.22).
- Geometry: the DOPAMINE.md §7.3 changes are applied first, in Phase 0a (B.15), and every "as today" or "bit-identical" statement in this document refers to that post-port build. The insula follows the DOPAMINE.md §7.3 ribbon (§3.17).
- After implementation, run `graphify update .`.

### 11.19. Open questions

- Graph size: the itemised count (740 nodes, 2,217 edges) exceeds A.7's planning figure (≈ 500, ≈ 1,500). The options are to merge cortical sub-sites into per-side area nodes, to carry one tract bundle per enlargement instead of per segment, or to revise A.7.
- The 50-ms emission interval is the top of A.7's 20–50 ms range. A shorter interval would break the cap of ≤ 20 per s per edge. Is any display case worth an exception?
- The orgasm delegate is exempt from the A.4 slew and range (§11.14). If that exemption is unwanted, the refractory slider would have to be capped at 20 h (so recovery `kh` ≤ 3,600) and the DOPAMINE.md timeline regenerated with slewed ramps.
- Switching autonomic off gives a brief HR overshoot to ≈ 108 bpm and no pressor transient (§11.10). Keep it as kinetics with the "switch transient (model)" tag (proposed), or ramp both tones together during this switch?
- With all networks on, the CV layer is slaved to `vitals()` during the orgasm scenario, so the baroreflex is open there. How should HR and BP stay continuous when a network is toggled mid-scenario and the command record takes over?
- Coarse CV mode now judges quiescence on the deterministic core, with RSA, OU noise and MSNA as seeded overlays (§11.6). In the richer prototype, dropping RSA cost 0.68 bpm at the endotoxin HR peak; the overlay design should remove that error, which needs checking.
- The §11.17 CPU figures must be measured again with the full §7 CV layer, the overlays, the breath-averaged cardiac target and the NF quasi-static stride, and reported at ×900 and ×3,600 against the 1-ms budget.
- Time slicing overshoots the 1-ms budget by up to 1.06 ms with checks every 16 iterations. Should the check be tighter, or should 2 ms be accepted as the desktop worst case?
- The prototype brain graph was random, at the lens's edge density, and it sustained activity after stimuli. The §3 graph needs inhibition and a rest criterion that let activity decay. The active-set fraction (13 %) and the CPU figures must be measured again on it.
- Each cache key's resting-state cache costs 80 ms, computed lazily. Should it be computed in an idle callback or a Web Worker to avoid a frame hitch? Adding the time of day to the key (§11.10 rule 5) widens the key space, which is the reason the slow layers are set analytically rather than integrated per return time.
- There is no pairwise **composition** test. A.5 says switch outcomes are read multiplicatively, but several rules are not edge masks (the hormone clamp h = g·h_cmd + (1 − g), the pupil mix, the antral g.enteric·(a + b·g.autonomic)), so the pairs are not covered by the single-switch matrix of §12.14. Add a composition class that asserts, for the 10 pairs, that each pair outcome equals the pairwise product of the single outcomes wherever the matrix defines both, and that lists the vacuous consequences (autonomic + neuroendocrine reproduces autonomic alone at rest: HR 101.0, SBP 91.8 at 300 s).
- Mobile CPU cost is unmeasured.
- The kernel constants used by the prototypes are provisional. §7–§10 must supply values, and the headless tests must be re-baselined.

### 11.20. Sources

Peer-reviewed (as cited; [unverified] = full text not read):

- Komisaruk BR et al. 2004, *Brain Res* 1024:77–88, fMRI in five women with spinal cord injury at or above T10 (H) (abstract)

Standards:

- Khronos Group, *OpenGL ES Shading Language 3.00 specification* (built-in constant `gl_MaxVertexUniformVectors` ≥ 256)

Textbook knowledge [T]:

- Skin thermal diffusivity (standard biophysics)

Raw captures [G] (folder `brain-system/raw/`):

- Baroreflex L35, L37, L39
- Hypothalamic_E2_80_93pituitary_E2_80_93ad L66
- Inflammatory_reflex L31
- Pupillary_light_reflex L56–L59
- Startle_response L47
- Vagotomy L39
- Withdrawal_reflex L31

Knowledge-graph calls (from `C:\Users\User\projects\galaxy`):

- `graphify query` on the simulation clock and frame loop, and on per-region shader uniforms
- `graphify explain`: `brain-system/src/shaders.js`, `brain-system/src/main.js`, Baroreflex, Startle Reflex, Inflammatory reflex
- `graphify path`:
  - Carotid sinus → NTS
  - NTS → RVLM
  - CVLM → RVLM
  - RVLM → intermediolateral nucleus
  - DMV → spleen
  - celiac ganglion → splenic nerve
  - inflammatory reflex → α7 nicotinic receptor
  - `…Pupillary_light_reflex.md::Pupillary light reflex` → Edinger–Westphal nucleus
  - pretectal nucleus → ciliary ganglion
  - sympathoadrenal system → adrenal medulla
  - median eminence → anterior pituitary
  - IL-1 → PVN

Project files:

- `brain-system/src/response.js` L83, L88, L141–L147, L174, L189–L217, L328, L335–L352, L354
- `brain-system/src/main.js` L90, L166–L235
- `brain-system/src/shaders.js` L30, L63, L122
- `brain-system/src/renderer.js` L104, L131, L139
- `brain-system/src/anatomy.js` `REGION_IDS` L17–L41, `mulberry32` L74, `NUCLEI` L273, `BRAINSTEM` L321–L324
- `brain-system/src/performance.js` L8
- `brain-system/research/DOPAMINE.md` §5, §6.8, §6.9, §9.3, §9.6, §9.7, §10 rule 7

Lens reports: simulation-architecture and signal-processing (full), and the digests of the brain-systems, sensory, somatic-motor, autonomic, enteric, neuroendocrine-immune and body-geometry lenses. Draft carried forward: `scratchpad\drafts\old-09.md`.

Prototypes (model checks, not sources):

- `C:\Users\User\AppData\Local\Temp\claude\C--Users-User-projects-galaxy\641a402d-336b-4b93-bc5d-2e26265edfd2\scratchpad\research-simulation-architecture\s11\` (`results-s11.txt`)
- `C:\Users\User\AppData\Local\Temp\claude\C--Users-User-projects-galaxy\641a402d-336b-4b93-bc5d-2e26265edfd2\scratchpad\research-simulation-model\` (`results.txt`; `toggle.mjs`, `stab.mjs` and `orgasm.mjs` were re-run for this section)

---

## 12. Scenarios and validation

### 12.1. Scope and conventions

This section defines the scripted scenarios of Brain System, how manual stimuli behave by default, the clock keyframes of every scenario and episode, and the tolerance of every checkpoint. It owns three kinds of number: scenario inputs (§12.3), keyframes (§12.4 and the episode clock in §12.17), and tolerances (§12.20). Every physiological target belongs to its owner section and appears here only by reference (A.1, A.7). §11 owns the kernel that runs scenarios, the clock, the stimulus pipeline (including the contact-heat model), switch and intervention semantics, the orgasm adapter and the CPU budget. §13 owns display limits, HUD labels and limb-motion rendering. DOPAMINE.md stays canonical for the orgasm scenario.

| Convention | Rule |
|---|---|
| Time origin | tH = 0 at stimulus onset: start of contact, sound onset, light onset, tap, start of the stand ramp, start of the cephalic phase, stressor onset, or bolus. Times in tables are tH from onset unless marked "screen" (tS). |
| Initial state | Every play starts from the resting steady state for the §11.10 cache key `(switch set, age, posture, fed, time of day)`. That cache supersedes the prototype's rest warm-up of 300 s of tH (1,800 s for `meal`, 600 s for `stressor` and `infection`), which were prototype approximations and are not a second definition: slow pools with τ ≥ 30 min are set analytically rather than integrated (§11.10 rule 6). |
| Paired control | HR changes after brief stimuli are differences from a paired run without the stimulus, so RSA cancels out. |
| Averaging | Stand-test BP and HR are 3-s moving means. Hormones are ratios to basal (×), converted to units by §9. Cytokines are in normalised units (§10). |
| Node paths | Ids follow A.3.3 and edge gates follow A.5. "→" is an axonal or synaptic step; "(blood)" marks a humoral step. |
| Prototype values | Output of the Node model check in `C:\Users\User\AppData\Local\Temp\claude\C--Users-User-projects-galaxy\641a402d-336b-4b93-bc5d-2e26265edfd2\scratchpad\research-simulation-architecture\s12\` (Node 24, this workstation, 2026-10-31; all output in `results.txt`). They are model checks, not sources (§14). Species —; confidence follows their inputs and is low unless a row says otherwise. Polyline lengths are prototype estimates that §2 recomputes. |

The prototype is the earlier `research-simulation-model` kernel, run unchanged on the A.2 frame with the A.9 velocities, delays and path lengths, the A.8 defaults and the A.4 layers. It is extended by `s12.mjs` (meal and loud-sound courses, brain-only command, keyframe screen lengths, habituation arithmetic, transduction sensitivity), `orgasm12.mjs` and `orgasm12b.mjs` (orgasm regression), `rsa.mjs`, `map.mjs`, `pupil.mjs`, `stand2.mjs`, `b30.mjs`, `coarse.mjs` and `acth.mjs`.

### 12.2. Scenario format

```
{ id, label, spanH, seed, brainOnly: 'unavailable' | 'central',
  inputs(tH, sim) → { heat?, sound?, prepulse?, light?, tap?, stand?, cephalic?, eat?, stress?, lps?,
                      baroStep?, valsalva?, cold?, apnoea?, state?, nextStim? },
  clockKeys:   [{ tH0, tH1, kh }],
  checkpoints: [{ id, variable, window, target: '§n.m', tolerance: '§12.20 row', nets }],
  repeat?:     { n, isi } }
```

| Field | Rule |
|---|---|
| `id`, `label` | A.3.5 ids. HUD labels and their placement are §13's. |
| `spanH` | tH from 0 to the end of the last keyframe (§12.4). |
| `seed` | Seeds the per-layer `mulberry32` streams (§11). Default 1. |
| `inputs(tH)` | A pure function of tH and of logged manual events. It never depends on tS or the frame count (A.4). |
| `clockKeys` | Ordered windows. They take priority over the adaptive rule and yield to a user lock (A.4). Falling keyframes are anticipated so that the target kh is reached at the window start. |
| `checkpoints` | Evaluated headless. Each points to a target in its owner section and a tolerance row in §12.20. A checkpoint is evaluated only under the switch set it names. |
| `brainOnly` | The form offered when `bodyMode = 'brain'` (A.3.5; §12.15). |
| `repeat` | Repetition without a state reset (§12.18). |

Playback: Play and Restart both start from the cached resting state, so a restart replays bit-for-bit (§11 determinism). Seeking restores the nearest kernel snapshot, taken every 10 % of the span (`snapshot()` / `restore()`, §11.16), and fast-forwards headless from it in ≤ 8-ms slices (B.12). `orgasm` has no scrubber or seek, only Restart (its manual mode has no fixed span). Toggling a network during a scenario is allowed. Inputs continue unchanged, and checkpoints of the original switch set are marked "not evaluated" for that run.

### 12.3. Scenario inputs

| Scenario | Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|---|
| `hotObject` | Contact temperature. High-effusivity object, so contact temperature ≈ object temperature | 55 | °C | — | medium | [model]. Above the heat-pain range of §5, so thermoreceptors and nociceptors are both driven (A.6). |
| `hotObject` | Site | right palm and palmar fingers (median territory, roots C6–C8); first arrivals from the palm | — | — | medium | [model]; dermatome assignment §2, §6 |
| `hotObject` | End of contact | index fingertip displaced ≥ 5 | mm | — | low | [model] |
| `loudSound` | Probe | broadband noise, 105 dB SPL, 50 ms, rise < 1 ms, both ears | dB SPL, ms | H | medium | [model]; startle-probe class (Blumenthal et al. 2005 [unverified]); startle threshold §6 |
| `loudSound` | Optional prepulse (PPI variant) | 70 dB SPL noise, 20 ms, lead 120 ms | dB SPL, ms | — | low | [model]; lead-interval range and inhibition §5 |
| `brightLight` | Luminance step | 1,000 for 1 s, right eye, from a 100 cd/m² background (the room light of the 4.0-mm baseline, §7.7) | cd/m², s | — | medium | [model] |
| `kneeJerk` | Tap | 2 mm stretch, right patellar tendon | mm | — | medium | [model]; A.6 range |
| `standUp` | Posture change | active stand, supine → upright, 3-s ramp; upright for 300 s | s | H | medium | [model]; active-stand protocol class (Wieling et al. 2007 [unverified]) |
| `meal` | Cephalic phase | 2 min sight and smell of food (vision plus smell class `food`, A.6 default concentration) | min | — | medium | [model] |
| `meal` | Ingestion | 600 kcal mixed meal over 10 min, starting at 2 min | kcal, min | — | medium | [model] |
| `meal` | Energy in the liquid phase | 35 | % | — | low | [model] |
| `stressor` | Drive | psychosocial stressor for 15 min with 1-min onset and offset ramps, at the §9 "pulsatile" drive level | min | H | medium | [model]; TSST class (Kirschbaum, Pirke & Hellhammer 1993 [unverified]) |
| `infection` | Bolus | intravenous endotoxin, single bolus at tH = 0 | 2 ng/kg | H | medium | [model]; human endotoxin dose class (Copeland et al. 2005 [unverified]) |
| `orgasm` | Stimulus | DOPAMINE.md demo cycle | — | — | — | DOPAMINE.md §9.6 |

Inputs never carry physiology. In the prototype, the late cardiac acceleration of `loudSound` was injected as a scenario-side sympathetic kernel γ(t) = (t/35)³·e^{3(1 − t/35)} that peaks at 35 s [model]. In production that command comes from the §7 defence response, and the scenario carries only the sound. The normalised stressor drive (0–1) maps to the central commands in the §11 coupling list and, as u_stress, to the §9.4 drive term (G_s).

Sensitivity of `hotObject` transduction (§11 contact-heat model; heat threshold 43 °C per §5; skin thermal diffusivity 1.0 × 10⁻⁷ m²/s [T]). Values are model outputs in ms, species —, low confidence, [model]:

| Terminal depth | 45 °C | 50 °C | 55 °C | 60 °C |
|---|---|---|---|---|
| 100 µm | 1,328 | 193 | 100 | 69 |
| 150 µm (default) | 2,988 | 435 | 224 | 154 |
| 200 µm | 5,313 | 774 | 398 | 274 |

At 55 °C, transduction takes ≈ 0.2 s at the default depth, so withdrawal, first pain and second pain separate clearly on screen. Diffusion time scales with depth squared [T], so depth is the dominant uncertainty (§12.22).

### 12.4. Clock keyframes

| `id` | Keyframes (tH window → `kh`) | Pre-roll | Screen length (prototype) |
|---|---|---|---|
| `hotObject` | approach from 1 to 0.02 by onset; 0–0.40 s → 0.02; 0.40–1.2 s → 0.3; 1.2–30 s → 1 | 3 s at ×1 | 56.4 s (×0.02 from 4.3 s, ×0.3 from 24.3 s, ×1 from 27.4 s; screen length to be re-run at ×0.3) |
| `loudSound` | approach to 0.005; 0–0.06 s → 0.005; 0.06–0.5 s → 0.1; 0.5–15 s → 1; 15–90 s → 5 | 3 s | 52.6 s |
| `brightLight` | approach to 0.005; 0–0.04 s → 0.005; 0.04–0.12 s → 0.02; 0.12–2.5 s → 0.2; 2.5–15 s → 1 | 3 s | 42.5 s |
| `kneeJerk` | approach to 0.005; 0–0.04 s → 0.005; 0.04–0.5 s → 0.05; 0.5–3 s → 1 | 3 s | 26.0 s |
| `standUp` | 0–60 s → 1; 60–300 s → 10 | 5 s | 89.6 s |
| `meal` | 0–2 min → 10; 2–12 min → 30; 12–60 min → 120; 1–6 h → 600 | — | 87.4 s |
| `stressor` | 0–2 min → 10; 2–20 min → 60; 20 min–3 h → 180 | — | 84.5 s |
| `infection` | 0–30 min → 60; 0.5–8 h → 900 | — | 62.1 s |
| `orgasm` | not a `clockKeys` list: the scenario's own clock (legacy `LogRamp`; after the DOPAMINE.md §9.8 port the DOPAMINE.md §9.3 clock) through the §11.14 delegate, state-triggered | — | ≈ 131 s per demo cycle after the port (DOPAMINE.md §9.6) |

Screen lengths are computed on a 600-Hz screen grid with the A.4 slew (≤ 1 decade per screen s) and anticipation of falling keyframes: species —, high confidence (arithmetic). The keyframes are [model]. They follow four rules:

- Every packet on an edge ≥ 50 mm stays ≥ 2.5 screen s in flight wherever possible (A.4). The palm → `drg.C7` Aδ packet (52.7 ms) takes 2.6 screen s at ×0.02. The C packet's transit is 0.81 s (1,036.8 − 224.0 ms, §12.5) and it is emitted at 224 ms, inside the first (×0.02) window, so it spends its first 0.18 human s there (8.8 screen s) and the remaining 0.64 s at the second keyframe: ≈ 10.6 screen s in all. Taken alone the second window would give 0.81/0.35 = 2.3 screen s, below the 2.5 s rule, so that keyframe is ×0.3 rather than ×0.35 (2.7 screen s for the whole transit on its own); the A.4 target for a 0.81 s transit is clamp(0.81/2.5, …) = 0.32.
- The heartbeat is shown at its real rate only while kh ≤ 1. Above that it is rate-coded, and gut slow waves switch to envelope mode at the `meal` keyframes (A.9, §8, §13).
- Keyframes never change step sizes (A.4).
- No scenario exceeds ≈ 90 screen s apart from `orgasm`, whose clock DOPAMINE.md owns.

### 12.5. Touching a hot object (`hotObject`)

Contact heat reaches the nociceptor terminals only after diffusing through the skin, so transduction sets the start of the response. The Aδ volley then drives the polysynaptic flexor reflex at C6–C8 (§6 owns the circuit) and first pain through the spinothalamic tract. The C volley arrives about 0.8 s later as second pain. Autonomic signs follow through spinoparabrachial input and the central commands (§7, §11).

| Stage | Node path (`nets`) | Prototype | Target (owner) |
|---|---|---|---|
| Receptor at 150 µm reaches 43 °C | `palm` heat nociceptors (receptor kind) | 224.0 ms | — (depends on depth and contact model; §12.3) |
| Aδ packet at the DRG | `palm` → `median` → `plexusBrachial` → `drg.C7`, 791 mm at the A.9 Aδ velocity (`[somatic]`) | 276.7 ms | — |
| Withdrawal EMG | `drg.C7` → `cord.C7.dh` → two interneurons (three synapses) → `cord.C6.vh` → `musculocutaneous` → `biceps` (`[somatic]`) | 293.1 ms (69.1 ms after transduction; analytic 63.9 ms plus rate-unit overhead) | §6.11 EMG onset 250–350 ms from contact |
| Movement onset | EMG onset + electromechanical delay | ≈ 323 ms | §6.11 movement onset 280–380 ms |
| Nociceptive command | `cord.C7.dh` → `pbn` (`[somatic]`) | 293.5 ms | §7, §11 |
| First pain (Aδ) arrives | `cord.C7.dh` → crossed STT → `thalVPL` / `thalVMpo` → `s1.hand` / `insPost` | 301.1 / 299.6 ms | §5 (laser-evoked potential peaks are later than first arrival) |
| Contact broken | biceps force after the A.9 electromechanical delay | 344.5 ms | withdrawal within 0.5 s [G Withdrawal_reflex L31] (§6) |
| Elbow flexion peak | `biceps` → elbow | 28.9° at 610 ms | ≤ 30° (A.8 #22) |
| C volley at the cord | `palm` → `drg.C7` at the C velocity | 1,036.8 ms | — |
| Second pain (C) arrives | STT (C-related velocity, §4) → `thalVMpo` → `insPost` | 1,117.5 ms (893.5 ms after transduction) | §5 C-fibre evoked-potential latency |
| SCR, palm | `pbn` → central command → bulbospinal → `cord.T3.iml` → `chain.T2` → `stellate` → postganglionic C → `sweatPalm` (`[autonomic]`) | 1.66 s | §7 SCR latency |
| HR peak (paired) | noci command → `nAmbVagal` withdrawal and `rvlm` → `cord.T1.iml` → `stellate` → `saNode` (`[autonomic]`) | +6.1 bpm at 1.9 s | §7 |
| Pupil dilation | noci → `ew` inhibition, dilator drive (`[autonomic]`) | 4.00 → 4.35 mm at 3.0 s | §7 |

Contacts on the fingertips (921 mm to `drg.C7`) arrive 8.7 ms (Aδ) and 130 ms (C) after palm contacts, which spreads both volleys in time. Ordering, which the HUD event log should make visible:

1. Withdrawal EMG (293 ms) precedes the first cortical Aδ arrival (300 ms).
2. The hand has left the object (345 ms) about 0.7 s before the C volley reaches the cord.

### 12.6. Sudden loud sound (`loudSound`)

The cochlea and VIII are special senses and are always on. Startle motor output needs `special ∧ somatic`; startle autonomic signs need `special ∧ autonomic` (A.5). The capture gives the primary circuit as auditory nerve → cochlear root neurons → PnC, under 10 ms in the rat, and a human blink at 20–40 ms [G Startle_response L33, L39, L47] (§6 owns both).

| Stage | Node path (`nets`) | Prototype | Target (owner) |
|---|---|---|---|
| ABR wave V | `cochlea` → `cn8.special` → `cochNuc` → `soc` → `ic` (`[]`) | 5.6 ms (inserted from §5; not a test) | §5 |
| MGN, A1 | `ic` → `mgn` → `a1` | not timed (the prototype has no central auditory graph) | §5 |
| Blink EMG | `cochNuc` → `pnc` → `n7m` → `cn7.motor` → `orbicularisOculi` (`[somatic]`) | 24.7 ms in the earlier kernel; the §4.11 rate graph with τ_pnc 20 ms (Table 4.13a) gives 25.2 ms, 26.2 ms with t_rec 1 ms | §6 |
| Neck and leg EMG | `pnc` → `portRS` → `cord.C5.vh` → `sternocleidomastoid`; → `cord.L4.vh` → `quadriceps` (`[somatic]`) | conduction alone 13.1 / 38.6 ms | §6 (75–121 / 145–395 ms [G Startle_response L39]) |
| LC phasic burst | `cochNuc` / `pnc` → `lc` (`[]`) | 100 ms (inserted from §3; not a test) | §3 |
| Pupil dilation | `lc` → `ew` inhibition; `rvlm` → `cord.T1.iml` → `scg` → `pupilDilator` (`[autonomic]`) | 4.00 → 4.80 mm at 2.2 s | §7 psychosensory dilation |
| SCR, palm | sudomotor route as in §12.5 | 1.46 s | §7 |
| HR (paired) | `lc`, `cea` → `nAmbVagal` withdrawal; `rvlm` → `saNode` | +4.7 at 1.2 s; +1.1 at 5 s; +6.8 at 33 s; +0.9 at 90 s | §7 defence response |

The second acceleration comes from the injected kernel (§12.3). Between the two accelerations, HR falls back towards baseline but never below it. The PPI variant (§12.3) must lower blink amplitude without changing the ABR (§5 owns the size of the inhibition).

### 12.7. Bright light (`brightLight`)

The afferent limb (retina, optic nerve, pretectum) is special and CNS. The efferent limb (EW → CN III → ciliary ganglion → sphincter) is autonomic, so the light reflex needs `special ∧ autonomic` (A.5). The capture gives retina → ipsilateral pretectal nucleus → bilateral EW → CN III [G Pupillary_light_reflex L38–L40].

| Stage | Node path | Prototype | Target (owner) |
|---|---|---|---|
| Neural share to the sphincter | `retina` → `cn2` → `opn` → bilateral `ew` → `cn3.para` → `ciliaryGang` → short ciliary → `pupilSphincter`, both eyes; 105 + 8 + 78 + 35 mm (§2.14) | 80.7 ms in the earlier kernel; §4.11 gives 60.1 ms, 85.1 ms with retinal transduction 25 ms [model] (§7.6 split) | — |
| Constriction onset | sphincter dead time 135 ms [model] (§7.6) | 220 ms (calibrated to the target) | §7 PLR latency |
| Constriction | both eyes equal (consensual) | Δ 0.70 mm (4.00 → 3.30, near the §7.7 steady state of 3.28 mm at 1,000 cd/m²); onset 0.23 s, 50 % at 0.39 s, 90 % at 0.76 s; minimum at 1.22 s, the end of the 1-s step; no pupillary escape (§7.7 law, `verify-math-simulation/pupil.mjs`) | §7 |
| Redilation | sphincter relaxation, dilator | back to 10 % of Δ at 4.68 s | §7 |
| Central | `retina` → `lgn` → `v1`; `retina` → `sc`; `retina` → `scn` | not timed | §5, §3 |

### 12.8. Knee jerk (`kneeJerk`)

The patellar reflex is a stretch reflex of segments L2–L4 [G Stretch_reflex L48]. The graph links muscle spindle, stretch reflex and α-motor neuron directly.

| Stage | Node path (`[somatic]`) | Prototype | Target (owner) |
|---|---|---|---|
| Quadriceps EMG | `patellarTendon` → spindle Ia → `femoral` → `drg.L4` → `cord.L4.vh` (one synapse) → `femoral` α-motor → `quadriceps` | 24.2 ms on the A.9 lengths (event analytic 22.5 ms, plus 1 ms tap transduction [model] and 0.7 ms relay); ≈ 24.5 ms on the §2.14 lengths (EV 23.1 ms) | §6.11 patellar 18–23 ms (≈ 1 ms above it from tap onset; inside ±10 %) |
| Antagonist inhibition | Ia inhibitory interneuron → `hamstrings` | not timed | §6 |
| Ascending arrival | Ia → dorsal column → `gracile` → medial lemniscus → `thalVPL` → `s1.leg` | 24.5 ms (analytic 21.4 ms) | §5 |
| Knee extension | `quadriceps` → knee | 3.9° at 154 ms (§6.16 twitch law: ≈ 4.0° at ≈ 155 ms) | ≤ 15° (A.8 #22) |

### 12.9. Standing up (`standUp`)

Standing shifts blood into the legs and splanchnic bed (tissue). Preload, MAP and the carotid pressure fall. The carotid also loses the hydrostatic offset. The baroreflex withdraws vagal tone within a beat and raises sympathetic outflow over seconds. Muscle contraction in an active stand adds a transient fall in resistance and a vagal command, which is the somatic part. RAAS acts over minutes (§9).

Path: `carotidSinus` → `carotidSinusNerve` (`cn9.aff`) and `aorticArch` → `cn10.aff` → `ntsVisc` → `cvlm` → `rvlm` (disinhibited) → bulbospinal → `cord.T1`–`L2.iml` → chain → `muscleVessels`, `splanchnicVessels`, and `stellate` → `saNode`. In parallel, `ntsVisc` → `nAmbVagal` (withdrawal) → `saNode`, and `kidney` → `raas` (blood). The graph links baroreceptor → solitary nucleus, solitary nucleus → CVLM → RVLM and solitary nucleus → nucleus ambiguus directly [G Baroreflex L35–L39].

The values are the §7.5–§7.8 equations: §7.8's own model check where it states a value, otherwise `verify-math-simulation/cv.mjs`, which reproduces that check (vasodilation on total G, §7.8). The earlier kernel's stand values (HR peak +29.5 at 11.2 s, 117/86 at 60 s, autonomic-off nadir −48.7) came from a different HR law, a 9-mmHg hydrostatic offset and a Windkessel stage that §7 does not contain, and are withdrawn.

| Readout | All on | Somatic off (passive tilt) | Autonomic off | Target (owner) |
|---|---|---|---|---|
| Supine | 115/75, HR 68.0 | 115/75, HR 68.0 | 92/65, HR 101.0 | §7 rest; IHR (A.8 #11) |
| HR at 4 s | 99 (§7.8) | 79 | 101 | §7 |
| SBP nadir | 89 (−26) at 7.5 s (§7.8) | −10.7 at 20.5 s | 58 (−34) at ≈ 14 s (§7.8) | §7 initial orthostatic fall |
| MAP nadir | −17.4 (−20 %) at 6.1 s | −3.8 (−4 %) at 3.1 s | −26.5 (−36 %) at 13.9 s | §7 |
| HR peak | 104 (+36) at 10 s (§7.8) | +14.8 at 20.5 s | 0 (intrinsic) | §7 |
| 30:15 ratio | 1.088 | 1.014 | 1.017 | §7 |
| 60 s | 104/75, HR 82.7 | 104/76, HR 82.3 | 70/50 | §7 |
| 180 s | 104/76, HR 82 (§7.8) | 104/76, HR 82.1 | 71/50 (−21/−15 from supine; MAP ≈ 57) (§7.8 SBP) | §7 steady state; OH criterion |
| 180 s, neuroendocrine also off | — | — | not computed: the RAAS → conductance term is not yet defined (§7.15) | §9 RAAS |

The autonomic-off upright MAP of ≈ 57 mmHg at heart level (≈ 39 mmHg at the carotid after the 17.9-mmHg offset, §7.8; ≈ 30 mmHg at the 13.9-s nadir, from the supine autonomic-off MAP of (92 + 2·65)/3 = 74.0 less the 26.5-mmHg nadir, then less the offset) is below the cerebral autoregulation range. The model shows it as a hypotension readout tagged "syncopal range — not a viable steady state", and the HUD states that consciousness and cerebral perfusion are not simulated (§13.14). Its depth is set by the uncalibrated k_R and 40 % non-neural share (§7.15). The three claims that the stand is unchanged with neuroendocrine, enteric or neuroimmune off alone rest on the earlier prototype that this section withdraws (≤ 0.2 mmHg, ≤ 0.2 bpm resolution), and the neuroendocrine case also removes AVP and RAAS, so it needs the §7 equations: those cells are marked "to be re-run on §7" in §12.14 until then.

### 12.10. Eating a meal (`meal`)

| Stage | Node path (`nets`) | Prototype | Target (owner) |
|---|---|---|---|
| Cephalic phase, 0–2 min | `retina`, `olfEpith` → `olfBulb` → `piriform`, `ofcOlf` → `lh`, `arcuate` → `dmv` → `cn10.para` → `gut.fundus` relaxation and `pancreas` cephalic insulin; `ssn`, `isn` → `parotid`, `submandibularGland` (`special ∧ autonomic`; insulin action also needs `neuroendocrine`) | cephalic insulin share present (×1.48 alone, seen with enteric off) | §8 cephalic timing; §7 saliva |
| Ingestion, 2–12 min | `nAmbMotor`, `n12` (`[somatic]`) → pharynx and oesophagus; LES relaxation (`autonomic ∧ enteric`) | not resolved in the lumped core | §8 |
| Gastric distension | `stomachWall` → `cn10.aff` → `nodoseGang` → `ntsVisc` (521 mm, §2.14; 0.5 s at the visceral C velocity) → `pbn`, `insMid` (`[autonomic]`); antral pump `ens.myenteric` | retention at 1/2/4 h after ingestion: 78/58/23 % | §8 |
| Duodenal brake | `gut.duod` → `iCells` → CCK (blood) → `gut.pylorus`; paracrine vagal route | CCK proxy at 50 % of plateau at 9.7 min and 90 % at 27.2 min (from meal start) | §8 |
| Insulin | `pancreas` (blood) | proxy peak ×6.99 at 85 min | §8 |
| Splanchnic load | `splanchnicVessels` dilation, baroreflex compensation | SBP −3.1 mmHg, HR +6.5 bpm | §7 |

The same lumped core, given a standard 255-kcal test meal, retains 60/26/0.5 % at 1/2/4 h (t½ 77 min). The 2-h value lies below the §8 range (§12.20 row 28).

### 12.11. Acute stressor (`stressor`)

One trigger fans out into two channels (§9): a fast sympatho-adrenal channel over seconds to minutes, and a slow HPA channel over tens of minutes. The capture describes lateral amygdala → central nucleus → hypothalamus, and adrenal-medullary catecholamine release under sympathetic drive [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L50, L58]. The graph links ACTH → adrenal cortex → cortisol, and the sympathoadrenal system → adrenal medulla, directly.

Paths:

- HPA: appraisal (`mpfc`, `dacc`) → `amygdala` → `cea` → `pvn` (parvocellular CRH) → `medianEminence` → portal → `pituitaryAnt` → ACTH (blood) → `adrenalCortex` → cortisol (blood). Cortisol feeds back at `pvn`, `pituitaryAnt` and `hippocampus`.
- Sympatho-adrenal: `cea` / `pvn` → `rvlm` → `cord.T5`–`T11.iml` (§7.2) → `splanchnicGreater` → `adrenalMedulla` → adrenaline (blood; `autonomic ∧ neuroendocrine`).
- Cardiac: `rvlm` → `stellate` → `saNode`, plus `nAmbVagal` withdrawal.

| Readout | §9.4 equations, defaults (`verify-editor/hpa.mjs`) | Earlier kernel, stress gain 6 | Earlier kernel, stress gain 15 | Variant E (proposed to §9) | Target (owner) |
|---|---|---|---|---|---|
| HR peak | — (CV not run) | +23.5 at 13.8 min | same | same | §7, §9 (no target fixed) |
| Adrenaline peak | ×4.12 at 14 min (input profile) | ×4.12 at 13.8 min | same | same | §9 |
| ACTH at 10 min; peak | ×2.34; ×3.57 at 17.4 min | ×1.82; ×2.73 at 20.8 min | —; ×5.30 at 20.7 min | ×3.35; ×4.70 at 16.7 min | §9 |
| Cortisol peak | ×1.48 at 73 min | ×1.46 at 66.7 min | ×2.16 at 68.5 min | ×2.21 at 37.2 min | §9 |
| Cortisol back below ×1.2 | 182 min | 128 min | 174 min | 88 min | §9 |
| Ultradian pulses after the stressor | yes: the axis pulses at baseline (ACTH ×2.4 max/min, 76 min) | none | none | none | §9 drive regimes |

The first column is the §9.4 two-pool ODE (n 6, e_E 0.2, G_s 6). The other three come from the earlier single-pool kernel (`research-simulation-model/kernel.mjs`: no S variable, n = 2, F_p = √F_h), which §9.4 does not describe. Variant E is a prototype parameter set for that kernel, not a definition: ACTH t½ 10 min [T], effective free-cortisol τ 45 min, adrenal delay 3 min, stress gain 9 [model]. §9 decides.

### 12.12. Infection and fever (`infection`)

Paths:

- Innate response: endotoxin (blood) → `macrophages` (tissue; always runs in body mode) → TNF → IL-6 (blood).
- Immune → brain, three routes:
  - brain endothelium and `ovlt` → PGE2 → `mnpo` (EP3) → warm-sensitive `mpoa` neurons → `tSet` (`[neuroimmune]`; §10.6). PGE2 acting on the hypothalamus through EP3 raises the set point [G Fever L68].
  - `cn10.aff` → `ntsVisc` (`autonomic ∧ neuroimmune`).
  - cytokines → `pvn` → HPA (output needs `neuroendocrine`).
- Brakes:
  - inflammatory reflex: `dmv` → `cn10` → `coeliac` → `splenicNerve` → `splenicTcells` → ACh → α7nAChR on `macrophages` (`autonomic ∧ neuroimmune`; contested, A.8 #16) [G Inflammatory_reflex L25, L31].
  - cortisol on immune cells (`neuroendocrine ∧ neuroimmune`).
- Fever effectors: `skinVessels` vasoconstriction and `bat` (autonomic), `shiver` (somatic).
- HR: PGE2 sympathetic command, plus the direct temperature effect on `saNode` (tissue).

| Readout (all on) | Prototype | Target (owner) |
|---|---|---|
| TNF peak | 1.06 h | §10 |
| IL-6 peak | 1.66 h | §10 |
| Set-point shift; core temperature peak | +1.50 °C; +1.35 °C at 3.38 h | §10 |
| HR peak | +24.6 bpm at 2.56 h | §10 |
| Cortisol peak | ×1.88 at 3.28 h | §9 |

HR peaks 0.8 h before core temperature, and the ratio +24.6 bpm / +1.35 °C ≈ 18 bpm/°C matches the endotoxin slope of §10.6 (≈ 19), not the natural-fever 8.5 bpm/°C. The prototype used an additive HR law, in which the direct SA-node term was 7.6 bpm/°C × 1.35 °C ≈ 10 bpm and the rest was the PGE2 command. Under §7.5's multiplicative law with f_T = 1 + 0.075·(tCore − 37) (§10.6) the direct term is k_T · hr per °C: 7.6 bpm/°C at IHR (autonomic off) and ≈ 5–7 bpm/°C with autonomic on. The HR rows must be re-run on the §7 law; the immune and temperature rows follow the §10.2 kinetic block and the §7.10 heat balance, which transcribe the prototype.

### 12.13. Orgasm – dopamine (`orgasm`) and the regression requirement

DOPAMINE.md owns inputs, internals and timeline (§9.6). §11 owns the adapter. This section owns the regression requirement:

| # | Requirement |
|---|---|
| R1 | With all networks on and the same seeded stream, every trace equals the reference recorded by the legacy path of the same commit (A.8 #21; §11.14; B.13): before the DOPAMINE.md §9.8 port, the frame-driven `update(dt)` loop for the same frame-time sequence; after it, the ported model on the fixed 0.05-s human-time grid. |
| R2 | After the DOPAMINE.md §9.8 port, the reference is recorded on the DOPAMINE.md §9.3 fixed 0.05-s human-time grid, so it is independent of frame rate; the golden traces are recorded again at the port. |
| R3 | After the DOPAMINE.md §9.8 port, tests assert DOPAMINE.md §6.9 rows on the deterministic reference and the §9.6 timeline within frame sampling, as DOPAMINE.md §9.7 specifies. |
| R4 | Switched and brain-only forms follow the §11 adapter (§12.14, §12.15). Vitals show "—" in brain-only mode. |
| R5 | The body stays a static neutral figure. Once the rule-7 amendment is confirmed (§11.18, §13.18), the pelvic streams carry schematic, non-rhythmic activity markers, rate and speed not to scale (A.8 #21); until then they keep their resting display. |

Prototype on the current `src/response.js`, with `src/dopamine.js` wired as in `src/main.js` L88–L90:

| Run | Inevitability (screen s / human min) | Orgasm phase (human min) | HR max (bpm) |
|---|---|---|---|
| Frame-driven `update(dt)`, seeded noise (seed 1), 30 / 60 / 144 fps | — / 7.28, 9.42, 8.75 | 7.32, 9.46, 8.80 | 120.1 |
| Fixed 0.05-s grid, seeded, at all three fps | — / 8.15–8.16 | 8.20 | 120.2 |
| Frame-driven, deterministic (η = 0, q = 0.5), at all three fps | 62.6 / 10.43–10.44 | 10.47–10.48 | 120.1 |
| Fixed 0.05-s grid, deterministic, at all three fps | 61.9 / 10.32 | 10.36 | 120.1 |
| DOPAMINE.md §9.6 (deterministic) | 51.7 / 8.61 | 8.64 | — |

Three findings:

- The seeded run depends on frame rate because of how often the RNG is called (one Gaussian draw per substep), not because of the integration. At η = 0 the frame-driven model is frame-rate independent.
- The grid moves deterministic ignition 0.7 screen s earlier.
- The current code's deterministic ignition is 10.9 screen s later than DOPAMINE.md §9.6, and plateau entry comes at 5.42–5.55 min instead of 6.28 min. The gap is expected: DOPAMINE.md §9.6 describes the ported model (DOPAMINE.md §9.8), and the code still carries the pre-correction constants; the grid accounts for only 0.7 s of it. R1 holds against the legacy path now; R3 applies after the port (Phase 0a, B.15).

### 12.14. Switch-off outcome matrix

Prototype outcomes. "=" means within ±1 % of all networks on. Stressor values use variant E; `standUp` cells follow the §7 equations (§12.9). Each cell is a single-switch outcome; multi-switch outcomes are derived by the A.5 composition rule, not tabulated, and some single-switch consequences become vacuous under composition.

| Scenario | Brain only | Somatic off | Autonomic off | Enteric off | Neuroendocrine off | Neuroimmune off |
|---|---|---|---|---|---|---|
| `hotObject` | unavailable | no response at all: no EMG, pain, SCR or HR change (A.5) | EMG, contact break and pain arrivals =; no SCR; HR flat at 101.0 (intrinsic); pupils fixed at 5.0 mm | = | = (HR +6.1) | = |
| `loudSound` | central form (§12.15) | no blink or limb startle (efference only); SCR 1.46 s, pupil 4.80 mm, HR = | blink 24.7 ms =; no SCR; pupils fixed at 5.0 mm; HR flat at 101.0 | = | = | = |
| `brightLight` | central form, no pupil | = | no light reflex, pupils fixed at 5.0 mm; central = | = | = | = |
| `kneeJerk` | unavailable | no EMG, movement or S1 arrival | = | = | = | = |
| `standUp` | unavailable | passive tilt: SBP nadir −10.7 at 20.5 s, HR +14.8 at 20.5 s; 180 s = (§7 equations, §12.9) | supine 92/65; SBP nadir 58 at ≈ 14 s; 71/50 at 180 s, syncopal range (§12.9); HR flat | to be re-run on §7 | to be re-run on §7 (it removes AVP and RAAS, so the §7.15 RAAS conductance term must be defined first, §12.9) | to be re-run on §7 |
| `meal` | unavailable | gastric phases =; ingestion shown as efference only, food delivered to the stomach by assumption [model] | retention 81/64/31 %; no cephalic phase; SBP −16.6 at 30 min, plateau −18.6; HR flat | retention 100 %; sphincters closed; no CCK rise; cephalic insulin only | retention 75/53/15 % (no hormonal brake); no insulin action; SBP −4.0 | = |
| `stressor` | central form | = | HR flat at 101.0; no adrenaline; ACTH and cortisol = (×2.21 at 37 min) | = | no adrenaline, ACTH or cortisol rise; HR +10.3 at 1.3 min | = |
| `infection` | unavailable | fever slower and smaller (no shivering): +1.15 °C at 4.06 h; HR +23.1 | TNF AUC +14 %, IL-6 AUC +12 %; fever +1.25 °C at 3.96 h; HR 101.0 + 9.5 (SA-node temperature only) | ≈ = (TNF AUC +1 %) | IL-6 AUC +15 %; cortisol flat; fever +1.41 °C at 3.52 h; HR +21.7 | TNF AUC +15 %, IL-6 AUC +31 %; no fever, HR rise or cortisol rise |
| `orgasm` | central form (§11) | central route only; no rhythmic pudendal stream (§11) | hr = IHR, tagged intrinsic; BP at the autonomic-off rest level; pelvic parasympathetic command has no effect (§11) | = | prolactin and oxytocin clamped; TIDA loop frozen (§11; DOPAMINE.md) | = |

### 12.15. Brain-only forms

| Scenario | Form | What runs and what is shown |
|---|---|---|
| `loudSound` | central | Sound enters at `cochNuc` (`portCoch`, A.5): central auditory stations, `mgn`, `a1`, `pnc`, the `lc` phasic burst (100 ms in the prototype) and `amygdala`. Blink and limb commands end at `portCranMotor` / `portRS` as efference only. No SCR, pupil or HR; vitals "—". |
| `brightLight` | central | Light enters at `retina` (`portRetina`): `lgn`, `v1`, `sc`, `scn`. The `opn` → `ew` command ends as efference only, so there is no pupil response. |
| `stressor` | central | `amygdala`, `pvn` and `rvlm` compute their commands. With cortisol clamped at basal (A.5 life-support rule), the PVN CRH command rises to ×8.5 at 15 min (variant E drive; ×6.0 with the earlier kernel's defaults; with §9.4 it relaxes toward 1 + G_s = ×7 with t½ 4 min), falls below ×1.6 by 30 min, and is shown as a tint. No ACTH, cortisol or adrenaline. |
| `orgasm` | central | DOPAMINE.md quantities; peripheral coupling removed (§11); vitals "—". |
| `hotObject`, `kneeJerk`, `standUp`, `meal`, `infection` | unavailable | Greyed in the Scenarios dropdown (A.3.5). Manual smell and taste stay available (§12.17). |

### 12.16. Optional scenarios

| id (label) | Input | Readouts (owner) | Availability |
|---|---|---|---|
| `valsalva` (Valsalva manoeuvre) | Supine expiratory strain at 40 mmHg for 15 s [T]. It acts on preload and on the arterial baroreceptor input (§11). | Phases I–IV and the Valsalva ratio (§7). With autonomic off: no late phase-II recovery and no phase-IV overshoot (§7). | Brain only: unavailable. Somatic off: unavailable, because the strain is muscular. |
| `coldFace` (Cold face immersion) | Facial cold contact at 10 °C over V1/V2 for 30 s with a breath-hold command [model] | Diving bradycardia and peripheral vasoconstriction (§7) | Needs `somatic ∧ autonomic` (trigeminal afferent, vagal and sympathetic efferent). Brain only: unavailable. |
| `sleepSound` (Sound during sleep) | `arousalState` = N2 (§3), then a 70 dB SPL tone of 50 ms [model]; repeated at 105 dB as a second trial | Thalamic gating and a reduced A1 response (§3, §5); brainstem startle and autonomic signs kept above the startle threshold (§6, §7) | Brain only: central form |

### 12.17. Manual-stimulus default behaviour per sense

Each click opens an episode (A.4). The adaptive rule ignores edges shorter than 50 mm. That would leave the short central auditory, vestibular, olfactory and gustatory paths at ×1, which is invisible, so these senses carry episode keyframes, owned here ([model]). They take priority over the adaptive rule and yield to a user lock.

| Sense (A.6 default; §5 final) | Route and first readouts | Episode clock | Brain only |
|---|---|---|---|
| vision (flash +3 log cd/m²) | `retina` → `cn2` → `lgn` / `sc` / `opn`; pupils of both eyes (§12.7) | as `brightLight` (§12.4) | central form (no pupil) |
| hearing (tone 70 dB, 1,000 Hz) | `cochlea` → `cochNuc` → `ic` → `mgn` → `a1`; `pnc`; stapedius and startle above their thresholds (§5, §6) | 0–0.06 s → 0.005; 0.06–0.5 s → 0.1; then adaptive | central form |
| touch (press 50 mN) | Aβ → `drg` → dorsal column → `cuneate` / `gracile` → `thalVPL` → `s1`; CT → `insPost` | adaptive (fingertip Aβ packet 15 ms → ×0.006) | unavailable |
| pain (heat 50 °C) | Aδ, then C double wave; withdrawal; nociceptive command | adaptive (×0.02, then ×0.32 during C transit, then 1) | unavailable |
| temperature (warm 40 °C / cool 25 °C) | cool Aδ, warm C → `thalVMpo` → `insPost`; `skinVessels` | adaptive (×0.02 cool / ×0.3 warm) | unavailable |
| smell (2 log × threshold, class `food`) | `olfEpith` → `olfBulb` → `piriform` (no thalamic first relay) → `ofcOlf`; cephalic phase for `food` | 0–0.6 s → 0.1; then adaptive | central form (enters at `olfBulb`) |
| taste (10 × threshold) | `tongueAnt` → `cn7.special` → `ntsGust` → `thalVPMpc` → `gust`; salivation; cephalic phase | 0–0.5 s → 0.1; then adaptive | central form (enters at `ntsGust`) |
| balance (yaw 60 deg/s) | `vestLabyrinth` → `vestNuc` → VOR (`n3`, `n6`; eye motor needs somatic); `pivc`. The camera never moves. | 0–0.02 s → 0.005; 0.02–1 s → 0.2; then adaptive | central form (VOR as efference only) |
| proprioception (tap 2 mm / 5° at 10 deg/s) | Ia, II, Ib → segment (stretch reflex) and dorsal column → `s1`, cerebellum | adaptive (×0.005); a tap uses the `kneeJerk` keyframes | unavailable |
| interoception (e.g. baroStep +20 mmHg; gastric 200 mL) | organ afferents → `ntsVisc` or `drg` → `insPost`; baroreflex and vagovagal reflexes (needs autonomic, A.8 #7) | adaptive (×0.005 baroreceptor A-fibre; ×0.2 during the 521-mm vagal C transit, §2.14); then 1 | unavailable |

### 12.18. Repetition and habituation

| Mode | State | Expected behaviour |
|---|---|---|
| Restart | reset to the cached resting state | bit-identical replay (§11) |
| Repeat (`repeat: {n: 5, isi: 20 s}` [model]; offered for `loudSound`, `brightLight`, `sleepSound`) | no reset | habituating readouts decline across trials; non-habituating readouts stay within §12.20 row 44 |
| Manual clicks | never reset | each click acts on the current state, so repetition, habituation and wind-up arise without special cases |

| Readout | Across repeated identical trials | Owner of constants |
|---|---|---|
| Startle blink and limb EMG (`pnc` gain), `lcPhasic`, salience, psychosensory pupil dilation, SCR, cardiac defence | decline, and recover after a novel stimulus (dishabituation) [T] | §3, §4, §6, §7 |
| Stretch reflex, ABR, light reflex, baroreflex gain | unchanged [T] | §5, §6, §7 |
| C-fibre input repeated at ≥ 0.3 Hz | wind-up rather than habituation | §5 |

The §4 prediction trace r̂ cannot carry habituation from one trial to the next: the remaining fraction after an interval is exp(−ISI/τ_pred), 4.5 × 10⁻⁵ at 10 s for τ_pred = 1 s (arithmetic, high confidence). Habituation instead uses the §4.9 slow trace, g_hab = 1/(1 + k_hab·H) with dH/dt = −H/τ_rec + ρ·Σ events, with the §5.12 constants (k_hab 0.25, τ_rec 300 s, ρ 1): at a 20-s interval g_hab is 0.54 at trial 5 and 0.38 at trial 10. Rows 45–46 in §12.20 are therefore implementable; the prototype has not run them yet.

### 12.19. Route evidence for the scenario paths

These are knowledge-graph checks (`graphify path`, undirected). "Direct" means one or two extracted edges along the stated chain. "Conceptual" means the graph connects the endpoints only through unrelated hubs, so the chain rests on the capture text or the owner section.

| Route used above | Graph result | Capture evidence |
|---|---|---|
| Nociceptor → withdrawal reflex | direct (1 hop) | [G Withdrawal_reflex L31] |
| Aδ fibre → DRG → spinothalamic tract → VPL | direct (2 + 1 hops) | — |
| Spinothalamic tract → insula | conceptual (via postcentral gyrus and lateral sulcus) | owner §5 |
| Medial lemniscus → VPL → S1 | direct | [G Dorsal_column_E2_80_93medial_lemniscus_pa L44, L48] |
| Muscle spindle → stretch reflex → α-motor neuron | direct | [G Stretch_reflex L48] |
| Cochlea → PnC → startle | conceptual (6 hops via cortex); no PnC edge | [G Startle_response L33, L47] |
| Retina → EW | 3 hops via ipRGC (inferred) | [G Pupillary_light_reflex L38–L40] |
| EW → ciliary ganglion → iris sphincter → miosis | direct (1 hop each) | — |
| Mydriasis → iris dilator | direct | — |
| Baroreceptor → solitary nucleus → CVLM → RVLM; solitary nucleus → nucleus ambiguus; SA node ↔ heart rate | direct | [G Baroreflex L35–L39] |
| Taste ↔ gustatory cortex | direct; taste → NTS conceptual | [G Taste L25]; NTS relay owner §5 |
| Gut–brain axis → cephalic phase | direct | [G Gut_E2_80_93brain_axis L52] |
| ACTH → adrenal cortex → cortisol | direct | — |
| Amygdala → PVN | 3 hops via NTS | [G Hypothalamic_E2_80_93pituitary_E2_80_93ad L58] |
| Sympathoadrenal system → adrenal medulla | direct | [G Sympathoadrenal_system L27] |
| Inflammatory reflex → splenic nerve → spleen | direct (via the Rosas-Ballina et al. 2008 citation node) | [G Inflammatory_reflex L31, L50] |
| Fever → set point ← PGE2 | direct; PGE2 → preoptic area conceptual (7 hops) | [G Fever L68] |

### 12.20. Checkpoint table

Tolerances are this section's acceptance bands for the implementation, not physiological uncertainty: [model], species —, low confidence. Targets are restated only with their owner. Status vocabulary:

- **pass**: inside the tolerance.
- **fail**: outside it.
- **calibrated**: the target was used to set a parameter, so the row only guards the calibration.
- **inserted**: the value was set by construction.
- **open**: not assertable yet.

| # | Scenario | Readout | Target (owner) | Sp. | Tolerance | Prototype | Status |
|---|---|---|---|---|---|---|---|
| 1 | manual touch (wrist) | Median SEP N20 | 18–20 ms (§5) | H | ±1 ms | event 18.7 (§2.14 lengths); rate graph 19.3–19.4 at h 0.25 and 0.5 ms (§4.13 kernel, §4.11) | pass |
| 2 | manual touch | Fingertip → S1 | 21–24 ms (§5); model 22.3 (§4.11) | H | ±1.5 ms | 22.3 | pass |
| 3 | `kneeJerk` | Quadriceps EMG | 18–23 ms (§6.11) | H | ±2 ms | event 22.5 (23.1 on the §2.14 lengths); kernel 24.2 from tap onset | pass |
| 4 | manual tap (Achilles) | Triceps surae EMG | 30–36 ms (§6.11) | H | ±2 ms | 32.1 (32.8 on the §2.14 lengths) | pass |
| 5 | `loudSound` | Startle blink EMG | 20–40 ms (§6) | H | inside range | rate graph 25.2 ms (26.2 with t_rec) with τ_pnc 20 ms; earlier kernel 24.7 | calibrated (τ_pnc) |
| 6 | `loudSound` | Neck / leg EMG | 75–121 / 145–395 ms (§6) | H | inside range | conduction only 13.1 / 38.6 | fail (needs §6 central delays) |
| 7 | `hotObject` | Contact broken | < 0.5 s (§6) | H | — | 0.345 s | pass |
| 8 | `hotObject` | Elbow / knee motion bounds | ≤ 30° / ≤ 15° (A.8 #22) | — | — | 28.9° / 3.9° | pass |
| 9 | `hotObject` | C arrival at insula after transduction | §5 C-fibre evoked-potential window (≈ 0.75–1.0 s) | H | ±0.2 s | 0.89 s | pass |
| 10 | `hotObject` | Ordering EMG < cortical Aδ < contact break < C at the cord | this section | — | strict order | 293 < 300 < 345 < 1,037 ms | pass |
| 11 | `hotObject`, `loudSound` | SCR latency, palm | 1–3 s (§7) | H | inside range | 1.66 / 1.46 s | pass |
| 12 | `hotObject` | HR rise | +5–15 bpm (§7) | H | inside range; timing per §7 | +6.1 at 1.9 s | pass (amplitude) |
| 13 | `loudSound` | Defence pattern (two accelerations) | §7 | H | both peaks inside §7 windows ±2 s | +4.7 at 1.2 s, +6.8 at 33 s; no deceleration below baseline | partial (second peak injected) |
| 14 | `loudSound` | Pupil dilation | 0.5–1 mm (§7) | H | inside range | 0.80 mm | pass |
| 15 | `brightLight` | Light-reflex onset | 0.2–0.3 s (§7) | H | inside range | 0.22 s | calibrated |
| 16 | `brightLight` | 90 % of constriction | 0.5–1 s (§7) | H | inside range | 0.75 s | pass |
| 17 | `brightLight` | Consensual equality | equal (§7) | H | ±0.05 mm | equal | pass |
| 18 | `standUp` | MAP and SBP nadir | nadir at 7–10 s (§7) | H | ±10 mmHg, ±3 s | §7 equations: MAP −17.4 (−20 %) at 6.1 s; SBP 89 at 7.5 s (§7.8) | pass |
| 19 | `standUp` | HR peak | +20–30 at ≈ 12 s (§7) | H | ±5 bpm, ±3 s | +36 at 10 s (§7.8; +37.1 at 9.1 s in `cv.mjs`) | fail |
| 20 | `standUp` | Upright HR, DBP at 1–3 min | HR +10–15, DBP +5–10 (§7) | H | ±5 bpm, ±5 mmHg | HR +14.7 (60 s) / +14.1 (180 s); DBP +0.3 / +1.3 | pass (marginal, DBP) |
| 21 | `standUp` | 30:15 ratio | §7 criterion | H | per §7 | 1.088; no undershoot | open (§7 to fix the criterion) |
| 22 | `standUp`, autonomic off | Orthostatic hypotension | ≥ 20/10 mmHg within 3 min (§7) | H | — | −22/−15 at 60 s; −21/−15 at 180 s (syncopal range, §12.9) | pass |
| 23 | any, autonomic off | HR = IHR at age 30, flat at 37.0 °C | 101.0 bpm (A.8 #11; §7) | H | ±0.5 bpm | 101.0 | pass |
| 24 | rest, carotid step +5 mmHg | Carotid HR gain | ≈ −0.3 bpm/mmHg (§7, V6, ±5 mmHg step) | H | ±0.1 | −0.26 (§7 equations); −0.20 at a +20 step | pass |
| 25 | rest | Cardiac vagal BRS | ≈ 15.7 ms/mmHg (§7) | H | ±5 | 15.8 (§7.8, analytic) | pass (calibrated) |
| 26 | rest | Mayer-wave band | ≈ 0.1 Hz (§7) | H | ±0.03 Hz | no resonance: the closed-loop MAP spectrum is monotone (§4.12, §7.15) | fail |
| 27 | rest | RSA amplitude | 5–15 bpm (§7) | H | inside range | 9.4 bpm at 14 breaths/min (§7.8); kept in coarse CV mode by the analytic overlay (§11.6) | pass |
| 28 | `meal` (255-kcal test meal) | Gastric retention 1/2/4 h | §8 ranges (37–90 / 30–60 / 0–10 %) | H | inside ranges | 60/26/0.5 % with the former unscaled pyloric brake; to be re-run with `brakeGain` 8, which the §8.15 equations put at 74/46/3 % | fail at 2 h before the retune; expected to pass after it |
| 29 | `meal` | CCK rise and peak | §8 | H | ±5 min | 50 % at 9.7 min, 90 % at 27.2 min | pass |
| 30 | `meal`, autonomic off | Postprandial SBP fall | ≥ 20 mmHg within 30–60 min (§7) | H | — | −16.6 at 30 min, −18.6 at 60 min (aut + NE off: −21.0; that cell needs the §7.15 RAAS term, as the stand does, §12.9) | fail (borderline) |
| 31 | `meal`, enteric off | Emptying falls to the §8.8 5 % floor, sphincters closed | A.5 | — | retention ≥ 95 % at 4 h | 100 % | pass |
| 32 | `stressor` | Cortisol peak | ×2–3 at 20–40 min (§9) | H | ±10 min | §9.4 ×1.48 at 73 min; earlier kernel ×1.46 at 67 min; variant E ×2.21 at 37 min | fail (§9.4, earlier defaults); pass (E) |
| 33 | `stressor` | Cortisol recovery | ≈ 60–90 min after onset (§9) | H | ±15 min | §9.4 182; earlier kernel 128; E 88 | fail (§9.4, earlier defaults); pass (E) |
| 34 | `stressor` | ACTH up by 10 min, peak near stressor end | §9 | H | peak ±5 min of 15 min | §9.4 ×2.34 at 10 min, peak 17.4 min; earlier kernel ×1.82, peak 20.8 min; E ×3.35, peak 16.7 min | pass (§9.4, E); fail (earlier defaults) |
| 35 | `infection` | TNF peak | 1.5–2 h (§10) | H | ±0.5 h | 1.06 h | pass |
| 36 | `infection` | IL-6 peak | ≈ 2 h (§10) | H | ±0.5 h | 1.66 h | pass |
| 37 | `infection` | Fever | +1.5 °C, peak 3–5 h (§10) | H | ±0.5 °C, ±1.5 h | +1.35 at 3.38 h | pass |
| 38 | `infection` | HR rise, whole scenario | +28 bpm, ≥ 90 bpm by 3–4 h (§10) | H | ±10 bpm | +24.6 at 2.56 h (earlier kernel; re-run on the §7.5 law, §12.12) | pass |
| 39 | `infection`, neuroendocrine off | Cytokines higher (glucocorticoid brake lost) | direction (§10) | Ms | direction | IL-6 AUC +15 % | pass |
| 40 | `infection`, autonomic off | TNF higher (inflammatory reflex lost) | direction (§10) | R | direction | TNF AUC +14 % | pass |
| 41 | `infection`, neuroimmune off | No fever, cytokines higher | A.5 | — | ΔtSet = 0 | 0; IL-6 AUC +31 % | pass |
| 42 | all | Determinism across frame rates | §11 | — | max \|Δ\| = 0 | 0 at the §11.16 set (10, 23.7, 30, 60, 144, 240 fps, adaptive) and 60 fps fixed vs a 1-kHz reference; 999 samples × 11 states | pass |
| 43 | `orgasm` | Regression R1–R3 | §12.13; DOPAMINE.md §9.6 after the §9.8 port | — | exact against the legacy path of the same commit (R1); R3 after the port | R1 assertable now; the 10.9-s gap to DOPAMINE.md §9.6 is the expected pre-port difference (§12.13) | open (R3 until Phase 0a) |
| 44 | Repeat, non-habituating readouts | Stretch reflex, ABR, light reflex | unchanged [T] | H | ±5 % per trial | no habituation implemented | pass (trivially) |
| 45 | Repeat `loudSound` ×5 | Blink and SCR amplitude | monotone decline [T] (§4, §6, §7) | H | trial 5 < trial 1 | not run; implementable with the §4.9 trace and §5.12 constants (g_hab 0.54 at trial 5) | open |
| 46 | Repeat after a novel stimulus | Dishabituation | recovery [T] | H | direction | not run; implementable (§4.9) | open |
| 47 | manual tibial stimulus (ankle) | Tibial N22 | 21–23 ms (§5) | H | ±10 % | EV 21.1, NF 21.1 (§4.11) | pass |
| 48 | manual tibial stimulus | Tibial P30 | ≈ 30 ms (§5) | H | ±10 % | EV 28.7, NF 28.6 | pass |
| 49 | manual tibial stimulus | Tibial P37 | 37–40 ms, a peak (§5) | H | arrival ≤ peak (§5.1) | EV 33.4, NF 34.0 | pass as upper bound; onset pending §5 |
| 50 | `hotObject` | Withdrawal EMG onset from contact | 250–350 ms (§6.11) | — | inside range | 293.1 ms | pass (target is the §6.10 composition) |
| 51 | `hotObject` | Movement onset from contact | 280–380 ms (§6.11) | — | inside range | ≈ 323 ms | pass (target is the §6.10 composition) |
| 52 | `infection`, autonomic off | HR change per °C (IHR · f_T, direct SA-node term) | 7.6 bpm/°C (§10.9) | — | ±3 bpm/°C | +9.5 bpm at +1.25 °C = 7.6 bpm/°C | pass (calibrated, k_T) |

### 12.21. Tests

The §11 headless harness runs:

- each core scenario under the seven switch sets of §12.14 (63 cells, of which the five brain-only "unavailable" ones are skipped: 58 runs), asserting the matrix cells and rows 3–41 and 47–52;
- all 32 switch sets reaching a bounded steady state (A.5 composition);
- a **composition** class: for each of the 10 switch pairs, the pair outcome equals the pairwise product of the two single-switch outcomes wherever §12.14 defines both, with the vacuous consequences listed. The matrix is single-switch only, and several switch rules are not edge masks (the hormone clamp, the pupil mix, the antral g.enteric·(a + b·g.autonomic)), so "read multiplicatively" (A.5) is an assertion to test, not an identity. Autonomic + neuroendocrine, autonomic + neuroimmune and enteric + autonomic are the pairs with the most non-mask rules;
- the optional scenarios;
- one manual stimulus per sense with its episode clock;
- the repetition rows 44–46;
- the orgasm regression row 43 against the legacy path of the same commit (the 0.05-s grid after the DOPAMINE.md §9.8 port).

On this workstation the prototype needs 12 s for the fast scenarios and 17 s for the slow ones under all switch sets.

### 12.22. Open questions

- HPA calibration (§9). The §9.4 equations and the earlier kernel's defaults fail rows 32–33 (late cortisol peak and slow recovery), while variant E passes them — and variant E's route is exactly the one §9.10 now names: a shorter ACTH t½ and a shorter adrenal lag, i.e. the **delay chain**, not the plasma pool, whose clearance is the best-sourced constant in the block. A free/total cortisol split alone will not reconcile them. The §9.4 default (n = 6) now pulses at baseline, so the "pulsatile" regime is visible in ACTH, but strong drive gives no saturated plateau (§9.10).
- Startle limb latencies (§6). Conduction explains only 13–39 ms of the 75–395 ms bands, and §6.11 now supplies the [model] recruitment delays (neck 68, shoulder 85, arm 115, leg 150 ms). The bands themselves are capture figures with no primary source and are probably movement, not EMG, latencies, so the comparison is indicative only.
- Defence response (§7). The second acceleration was injected and the intervening deceleration is missing. §7 must provide the command and its windows.
- Baroreflex (§7). On the §7 equations BRS passes (15.8 ms/mmHg) but the stand HR peak is +36 bpm (row 19) and there is no Mayer resonance (row 26). A second-order vascular stage (Windkessel, τ ≈ 1.5 s) tuned to K/K_c 0.5–0.7 at 0.08–0.12 Hz would address the resonance (§4.12, §7.15). §7 must fix the 30:15 criterion; the §7 equations give 1.088 with no undershoot.
- Gastric emptying (§8). The 2 h retention failure was the unscaled pyloric brake, now re-tuned with `brakeGain` 8 (§8.8); rows 28 and the §8.13 outputs must be re-run on the kernel to confirm. The 600-kcal splanchnic load still lowers SBP by 3 mmHg at 6 h.
- Postprandial hypotension with autonomic off reaches −18.6 mmHg. It depends on the [model] renin sympathetic share and the splanchnic gain (§7, §9).
- Endotoxin HR peaks 0.8 h before core temperature (§10). Is a delayed central sickness drive wanted?
- Orgasm regression. The current code's deterministic ignition (62.6 s / 10.43 min) differs from DOPAMINE.md §9.6 (51.7 s / 8.61 min) because §9.6 describes the ported model. Phase 0a (B.15) applies the DOPAMINE.md §9.8 port and records the references again; regenerating §9.6 from the post-port code instead is optional and needs approval. DOPAMINE.md values are not changed here.
- Habituation (§4.9, §5.12). The slow trace and its constants exist; its reset rule on Restart (reset to the cached resting state, H = 0) should be confirmed.
- ABR wave V and the LC phasic latency are inserted, not computed. The rate graph for central auditory stations and the LC (§3, §11) must reproduce them.
- `meal` with somatic off delivers food to the stomach by assumption. Is that acceptable, or should the scenario be unavailable?
- `meal` is unavailable in brain-only mode (A.3.5), although smell and taste could run a central cephalic form. Should a central form be offered?
- Pupillary escape during a sustained light step is not modelled by the §7.7 law.
- Contact-heat terminal depth (150 µm) is [model] and dominates the transduction time (§12.3); the §6.11 withdrawal targets are composed from it, so a measured contact-heat withdrawal latency would test both.
- The episode keyframes for hearing, balance, smell and taste override the A.4 adaptive rule. Should §11 lower the 50-mm edge threshold for central paths instead?

### 12.23. Sources

Peer-reviewed (as cited here; [unverified] = full text not read):

- Blumenthal TD et al. 2005, guidelines for human startle eyeblink EMG studies [unverified]
- Copeland S et al. 2005, acute inflammatory response to endotoxin in mice and humans [unverified]
- Kirschbaum C, Pirke KM & Hellhammer DH 1993, Trier Social Stress Test [unverified]
- Rosas-Ballina M et al. 2008, splenic nerve required for cholinergic anti-inflammatory control of TNF in endotoxaemia (mouse), via [G Inflammatory_reflex L50] [unverified]
- Wieling W et al. 2007, initial orthostatic hypotension [unverified]

Textbook [T]: skin thermal diffusivity and diffusion time scaling with depth squared; standard Valsalva manoeuvre (40 mmHg, 15 s); habituation of startle, SCR and orienting responses and its absence in monosynaptic reflexes, ABR and the light reflex.

Raw captures [G] (folder `brain-system/raw/`): Baroreflex L35–L39; Dorsal_column_E2_80_93medial_lemniscus_pa L44, L48; Fever L68; Gut_E2_80_93brain_axis L52; Hypothalamic_E2_80_93pituitary_E2_80_93ad L50, L58; Inflammatory_reflex L25, L31, L50; Pupillary_light_reflex L38–L40; Startle_response L33, L39, L47; Stretch_reflex L48; Sympathoadrenal_system L27; Taste L25; Withdrawal_reflex L31.

Project files: `brain-system/src/response.js` (`C`, CLOCK L83, `_demoStimulus` L174, `_startTrain` L188–L207, `_integrate` L211–L218, `update` L337–L354); `brain-system/src/main.js` L88–L90; `brain-system/research/DOPAMINE.md` §6.9, §9.3, §9.6, §9.7.

Prototype (a model check, not a source): `C:\Users\User\AppData\Local\Temp\claude\C--Users-User-projects-galaxy\641a402d-336b-4b93-bc5d-2e26265edfd2\scratchpad\research-simulation-architecture\s12\results.txt`, the scripts beside it, and the graph path logs `paths1.txt`–`paths3.txt` in the same folder.

---

## 13. Rendering, visual design, HUD, performance and safety

### 13.1. Scope, ownership and realism classes

This section turns model state into light and defines how the user acts on the model. The display layer reads the A.3.4 state and never writes to it. It runs on screen time `tS`, and the model runs on human time `tH` (A.4). This section is the only place that defines visual, colour, camera, packet-display, photosensitivity and HUD values. Every other number comes from its owner:

| Values | Owner |
|---|---|
| Body coordinates, extents, BSA, path lengths | §2 |
| Brain coordinates, neuron counts, modulator states | §3 |
| Conduction velocities, analytic arrival times | §4 |
| Stimulus ranges, thresholds, two-point limits, valid sites | §5 |
| Joint angles, EMG, reflex timing, axon counts | §6 |
| Cardiovascular, pupil, sudomotor and thermal states | §7 |
| Gut rhythms and transit | §8 |
| Hormones | §9 |
| Cytokines | §10 |
| Clock, kernel layers, packet emission, graph, file list, CPU budget | §11 |
| Scenarios, checkpoints | §12 |
| Dopamine visuals and dopamine safety rules | DOPAMINE.md §8, §10 |

| Element | Class | Rule | Disclosure |
|---|---|---|---|
| Positions of brain and body structures | to scale | Taken only from §2 (body) and §3 (brain), within their tolerances. The renderer never moves them. | "Estimated position" where confidence is low (§13.14) |
| Path lengths, velocities, synaptic delays, arrival order | model scale (consistent with the readouts) | Packets on modelled edges travel at the §4 velocity (one default per fibre class) along the drawn §2 polyline (±20–40 mm, schematic in the pelvis). Velocities are never rescaled per fibre class (A.4). | Live log shows fibre class and velocity |
| Time | to scale in `tH` | `tS` differs from `tH` only by `kh` (§11). The clock is always visible while anything moves. | `t 23.0 ms  ×1/100` (A.4) |
| Rhythms (heart, respiration, slow waves, MMC) | to scale in `tH` | Drawn cycle by cycle only under the rhythm rule (§13.9). Otherwise drawn as an envelope. | Vitals show the real rate |
| Nerve width, ganglia, nuclei < 50 mm³, adrenals, ENS ganglion mesh | enlarged | Minimum drawn sizes as in §13.3 | "Enlarged for legibility" |
| Star counts | not proportional to cells | Budgets follow legibility (§13.4), as in DOPAMINE.md §7.4 | "1 star ≈ N cells"; "stars mark tissue, not cells" for skin and organs |
| Body brightness | normalised | Flux ratios and the body zoom law (§13.3) | "Brightness normalised for visibility" |
| Blood-borne signals | schematic | Haze along the §2 great vessels plus glows at the source and the targets | "Plasma level, not vessels" |
| Pelvic structures | schematic | Nerves and plexuses, bladder, rectum and an unlabelled pelvic-floor field only (A.1) | "Schematic" |
| Genitals, nipples, navel geometry, hair, facial features beyond a minimal face, audio | omitted | Never drawn and never played (A.1; A.8 #23) | About text |

Principles:

1. The brain stays the visual centre in every framing except organ close-ups (§13.3).
2. Hue is never the only code. Every code also has a non-hue carrier (§13.5).
3. 2,300 K amber means dopamine and nothing else (A.8 #19).
4. Packets are population volleys. Spikes are never drawn. Above the packet-rate cap, activity becomes shimmer (§13.8).
5. Body packets on modelled edges are slowed only by the disclosed clock. Declared exceptions: the dopamine tract flow (DOPAMINE.md §8.1, a declared visual slowdown) and the orgasm-scenario pelvic markers (A.8 #21; §13.9), both disclosed as not to scale (§13.14).
6. A network that is switched off stays visible as a ghost (§13.10).
7. The figure is clinical and non-explicit (§13.2).
8. The photosensitivity limiter has the last word on every amplitude, fade and rate (§13.15).

DOPAMINE.md §8.5 forbids "travelling comets at a physical speed" on dopamine tracts, and that rule still holds there. Body packets are a different thing. They show the modelled human conduction velocity of their fibre class (§4) along schematic routes under a disclosed clock, computed from §2 lengths and §4 velocities. The drawn geometry and the timing readouts therefore agree, because both come from the same model, not because the model matches every body.

### 13.2. Body surface, skin sampling and the clinical mannequin

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Body signed-distance field (mm, A.2 frame), smooth union of | a scalp ellipsoid fitted around `sdCerebrum`; a face ellipsoid; a neck cylinder; the torso lofted through the §2.6 elliptical sections; tapered limb capsules (§2.6 radii); a hand box with 5 digit capsules (§2.6 finger and thumb radii); a foot box with a toe-row fillet | — | — | low | [model]; geometry §2 |
| Smooth-union radius: torso–limb, neck–torso | 15 | mm | — | low | [model] |
| Smooth-union radius: hand, foot, digits | 8 | mm | — | low | [model] |
| Crotch fillet radius (smooth surface into the thighs) | 40 | mm | — | low | [model]; A.1 |
| Iso-surface sampling grid, high and ultra / low and medium | 4 / 6 | mm | — | low | [model] |
| Skin sampling | uniform by area (area CDF, as `surfaceGrid`, `src/brain.js` L62), then fixed quotas per Lund–Browder region | — | — | low | [model] |
| Skin facing law | flux × mix(0.35, 1, smoothstep(−0.3, 0.4, n·v)) × (0.6 + 0.4·\|n·v\|^0.5) | — | — | low | [model], after `src/shaders.js` L75 |
| Head-skin and sense-organ factor | 0.35 · smoothstep(5, 8, d), d = camera distance (units); 0 at d ≤ 5; full sense organs in Head and neck | — | — | low | [model] |
| Skin density, low / medium / high / ultra | 0.47 / 0.84 / 1.36 / 2.09 | stars/cm² | — | high | computed from §13.4 budgets and the §2.2 BSA |
| Mean skin-star spacing | 14.6 / 10.9 / 8.6 / 6.9 | mm | — | high | computed |
| Same in the Whole body view (0.547 px/mm) | 8.0 / 6.0 / 4.7 / 3.8 | px | — | high | computed |
| Torso sections | elliptical, as drawn in §2.6 (superellipse deferred, §13.18) | — | — | low | [model] |

| Lund–Browder region | Share (% BSA) | Skin stars low / medium / high / ultra | Species | Conf. | Source |
|---|---|---|---|---|---|
| Head / neck | 7 / 2 | 630 / 1,120 / 1,820 / 2,800 and 180 / 320 / 520 / 800 | H | medium | Lund & Browder 1944 |
| Anterior trunk / posterior trunk | 13 / 13 | 1,170 / 2,080 / 3,380 / 5,200 each | H | medium | same |
| Buttocks (2 × 2.5) | 5 | 450 / 800 / 1,300 / 2,000 | H | medium | same |
| Perineal share, folded into the smooth pelvic shell | 1 | 90 / 160 / 260 / 400 | H | medium | same; A.1 |
| Upper arms (2 × 4) / forearms (2 × 3) / hands (2 × 2.5) | 8 / 6 / 5 | 720 / 1,280 / 2,080 / 3,200; 540 / 960 / 1,560 / 2,400; 450 / 800 / 1,300 / 2,000 | H | medium | same |
| Thighs (2 × 9.5) / legs (2 × 7) / feet (2 × 3.5) | 19 / 14 / 7 | 1,710 / 3,040 / 4,940 / 7,600; 1,260 / 2,240 / 3,640 / 5,600; 630 / 1,120 / 1,820 / 2,800 | H | medium | same |

The Lund–Browder quotas keep the density uniform by region, so the head receives no extra stars that would veil the brain. The renderer adds points with `ONE, ONE` blending and no depth test (`src/renderer.js` L117–L118), so every face and scalp star in front of the brain adds light on top of it. The head-skin factor removes that light at the three brain-view distances (`src/main.js` L46–L48). With the body on, those views stay as they are today.

The touch-receptor overlay (Views, off by default) adds no points. It reweights skin-star flux by (2 mm ÷ two-point threshold)², using the §5 thresholds, so fingertips and lips stand out as in the sensory homunculus [G Somatosensory_system L48; G Postcentral_gyrus L39].

Mannequin content rules. These apply in every mode and every view:

- The figure has no sex characteristics and is built on male reference proportions (Drillis & Contini 1966; §2); female proportions are not modelled (disclosed in About, §13.14). A smooth crotch fillet joins the trunk to the thighs. There is no genital, nipple, navel or hair geometry. The umbilicus is only an unlit landmark for the T10 site.
- The face is minimal: eye clusters (an iris ring of stars around a dark pupil disc), a nose ridge and ear forms. There are no lips, brows or expression.
- The pelvis contains only the schematic plexuses and nerves of §2, the bladder, the rectum and an unlabelled pelvic-floor field. The pudendal stream ends at the perineal midline (A.1).
- The trunk and pelvis never move. The pelvic region never changes luminance rhythmically (§13.9).
- Response profiles never become sex-coded presets or colours.

DOPAMINE.md §10 rule 7 permits the neutral body network "as specified" in ANALYSIS.md, and the rules above are that specification. Rule 7 also states that the dopamine scenario adds nothing below the brainstem except the labelled A11 beam. The pelvic markers of A.8 #21 therefore wait for the rule-7 amendment proposed in §11.18 and the user's confirmation (§13.18); until both exist, the pelvic streams keep their resting display during `orgasm`.

### 13.3. Internal structures, flux, depth and brain dominance

| Structure | Construction | Flux ratio (× mean brain neuron-star flux) | Species | Conf. | Source |
|---|---|---|---|---|---|
| Skin | §13.2 | 0.15 (0.12–0.20) | — | low | [model] |
| Solid organs | clusters in the §2.8 volumes, carved as in §2.8 (cardiac notch, domes) | 0.38 (0.30–0.45) | — | low | [model] |
| Hollow organs (stomach, intestines, bladder, rectum) | wall shells 3–5 mm thick on the §2.9 centrelines and radii, so the ENS mesh can sit on them | 0.38 (0.30–0.45) | — | low | [model] |
| Muscles at rest | haze around the §2.13 centres | 0.10 | — | low | [model] |
| Nerve streams at rest | Catmull–Rom splines through the §2.12 waypoints; 6–40 jittered streamlines per nerve, each carrying one fibre class in proportion to the §6 composition; cross-section σ 1–4 mm; minimum drawn width 2 mm; density ∝ log₁₀(axon count, §6), with a floor so that the trochlear nerve stays visible | 0.30 (0.25–0.40) | — | low | [model] |
| Spinal cord | the `BRAINSTEM` tube continued along the §2 canal, with enlargements, a dim grey-matter butterfly, white-matter stars on the §6 tract map, DRG clusters and cauda equina roots | 0.5 (grey matter 0.3) | — | low | [model] |
| Ganglia and plexuses | clusters at the §2.11 positions, minimum radius 4 mm | 0.5 | — | low | [model] |
| ENS mesh | myenteric shell at 0.9 r and submucosal shell at 0.7 r (sparse above the pylorus, §8); polygonal ganglion mesh with drawn spacing 6–10 mm; ICC dots on high and ultra only | 0.2 (ICC 0.08) | — | low | [model] |
| Blood haze | points along the §2.10 vessels plus a sparse whole-body haze | 0.1 | — | low | [model] |
| Faint skeleton (off by default, §13.15) | jittered vertebral bodies, pelvic rim, rib hints | 0.08 | — | low | [model] |
| Chyme marker | soft points inside the gut tube | 0.15 | — | low | [model] |

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Torso attenuation envelope | elliptic cylinder, half-breadth 160, half-depth 120, centre y −15, z −835 to −185 | mm | — | low | [model], fitted to the §2.6 loft |
| Torso attenuation length λ_body (exp(−L/λ)) | 150 | mm | — | low | [model] |
| Brain attenuation length (unchanged) | 60 | mm | — | high | `src/main.js` L159 |
| Attenuation colour | neutral (multiplies flux only) | — | — | high | `src/shaders.js` L16–L19 |
| Brain flux factor | 1 + 0.4 · smoothstep(5, 8, d) | — | — | low | [model] |
| Brain zoom law (unchanged) | (3.6/d)², with field-of-view correction | — | — | high | `src/main.js` L192 |
| Body zoom law | (3.6/d)^γ_body, γ_body = 1.0, tuned by the luminance test | — | — | low | [model] |
| Dimming of one resolved dot at the Whole body distance, brain law / body law | 1.06 × 10⁻² / 0.103 | — | — | high | computed |
| Target: brain mean luminance ÷ brightest organ cluster | ≥ 3 | ratio | — | low | [model] |
| Target: brain ÷ skin veil | ≥ 8 | ratio | — | low | [model] |
| Target: skin veil ÷ brain (visibility floor), Whole body and Upper body | ≥ 0.02 | ratio | — | low | [model] |
| Views exempt from the organ ratio | Thorax, Abdomen (organs may reach 1 × brain) | — | — | low | [model] |

Depth attenuation runs the torso envelope through the same ray–ellipsoid path that `tissuePath` uses for the brain (`src/shaders.js` L36–L49). The limbs and neck are thin and receive no attenuation.

The body needs its own zoom exponent for the following reason. Per-star energy scales with `uZoom` (`src/shaders.js` L94). Brain stars overlap, so the brain's surface brightness stays constant under the inverse-square law. Skin and nerve stars are sparse, resolved points, so under the same law each dot would almost vanish in the Whole body view. With γ_body = 1, a dot dims as 1/d instead. This is a disclosed display normalisation, not physics. The measured ratio targets set it (§13.17), not intuition.

### 13.4. Point budgets, level of detail and lazy generation

| Quantity | Low | Medium | High | Ultra | Species | Conf. | Source |
|---|---|---|---|---|---|---|---|
| Skin | 27,000 | 48,000 | 78,000 | 120,000 | — | low | [model] |
| Organs | 22,000 | 44,000 | 72,000 | 116,000 | — | low | [model] |
| Muscles | 3,000 | 6,000 | 10,500 | 15,000 | — | low | [model] |
| Bone (faint skeleton) | 2,250 | 4,500 | 7,500 | 10,500 | — | low | [model] |
| Spinal cord, roots, DRG | 5,000 | 10,000 | 15,000 | 22,500 | — | low | [model] |
| Peripheral and cranial nerves | 18,000 | 36,000 | 60,000 | 90,000 | — | low | [model] |
| Autonomic chain, ganglia, splanchnic and vagal streams | 5,000 | 10,000 | 16,000 | 24,000 | — | low | [model] |
| Enteric mesh | 4,000 | 8,000 | 14,000 | 20,000 | — | low | [model] |
| Vascular tree, capillary beds, blood haze and immune speckle | 36,000 | 72,000 | 120,000 | 192,000 | — | low | [model]; PULSE.md §9, §13 |
| **Body total** | **122,250** | **238,500** | **393,000** | **610,000** | — | low | [model]; A.7 |

> **Dense star model (6 November 2026).** At the user's request the glass shells were replaced by a
> denser, sharper body of stars. Each budget group above grew by:
> - skin ×3, nerves ×3;
> - cord ×2.5;
> - organs, ganglia and enteric mesh ×2;
> - muscle, bone and vessels ×1.5.
>
> The earlier totals were 32.5k / 63k / 104k / 158k. The simple HUD's Detailed style draws every
> star, 0.8 × the point size at the same energy, with a class gain `keep × boost`
> (renderer `PARAMS.style`). The nervous system gets boost 1.6–2.0 and the skin 3.4, so the
> silhouette reads. The Stars style draws a random `keep` share of each class (the earlier budgets)
> at the earlier per-star flux, which keeps the earlier look.
>
> The heart takes 55 % of the organ stars (≈ 39,600 at High, ≈ 63,800 at Ultra), so the organ budget
> rose to 22k / 44k / 72k / 116k. The other organ shares were scaled so that their counts stay as
> before. The Stars style keeps the earlier look (other organs 17,600 / 32,400, heart 2,400 / 39,600),
> and in Detailed the heart stars carry 0.8 × the organ star flux. The totals before the heart were
> 78.5k / 151k / 248.5k / 378k. See research/HEART.md §6.
>
> **Vascular tree (PULSE.md §9).** The vessel group grew to 18k / 36k / 60k / 96k for a branching tree
> of named arteries and veins with their twigs, which takes 87.5 % of it (15,750 / 31,500 / 52,500 /
> 84,000). The earlier vessel, haze and immune stars keep their counts (2,250 / 4,500 / 7,500 /
> 12,000) and are bit-identical. The Stars style draws no tree star; Detailed draws the tree in place
> of the earlier great-vessel polylines. The totals before the tree were 88.5k / 171k / 280.5k / 430k.
> The second pass (PULSE.md §13) doubled the vessel group to 36k / 72k / 120k / 192k for the organ
> trees, the finer branches and the capillary beds; the tree now takes 93.75 % of it.
| Packet pool | 128 | 192 | 256 | 256 | — | low | [model] |
| Brain-side points (neurons, DA somata, axons, release sites, lanterns at 400) | ≈ 73,900 | ≈ 150,900 | ≈ 270,900 | ≈ 443,900 | — | high | `src/performance.js` L8–L13; DOPAMINE.md §9.2 |
| New brain nuclei (§3): a separate buffer (`TIERS.extra`) added on top of `TIERS.neurons`, 5.3 / 5.0 / 4.5 / 4.5 % of it, so existing structures keep every star (B.8) | 3,200 | 6,500 | 10,800 | 18,000 | — | low | [model]; ≥ 77 new-star structures (B.8) |
| All points drawn in body views (body + brain side + new nuclei) | 109,600 | 220,400 | 385,700 | 619,900 | — | high | computed |
| Body share of all points | 29.7 % | 28.6 % | 27.0 % | 25.5 % | — | high | computed |
| Minimum stars per new brain nucleus, met by every tier prefix (stars stratified in three blocks of 40) | 40 | 80 | 120 | 120 | — | low | [model]; A.7 |

| Organ star share (by visible area, not cell count) | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Intestines / lungs / heart / liver | 22 / 18 / 12 / 12 | % of organ budget | — | low | [model] |
| Kidneys and adrenals / stomach / sense organs | 7 / 6 / 6 | % | — | low | [model] |
| Spleen / pancreas / bladder and rectum / thyroid / other | 3 / 3 / 3 / 1 / 7 | % | — | low | [model] |

| LOD rule | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Brain prefix when the brain spans < 150 px | draw 45 % of the shuffled neuron buffer, flux × 1/0.45 | — | — | low | [model]; prefix uniformity from `shuffleRecords`, `src/brain.js` L119 |
| Presets that trigger it (1,080-px canvas) | Whole body only (brain 94 px); every other body preset ≥ 161 px (§13.11) | — | — | high | computed |
| Fine nerve branches (LOD 2) and the ENS base mesh | drawn at ≥ 0.8 px/mm (camera distance ≤ 23.9 units at 1,080 px) | px/mm | — | low | [model] |
| Intercostal nerves on the low tier | every other one | — | — | low | [model] |
| ENS close-up buffer | + 3 × the enteric budget (6,000 / 12,000 / 21,000 / 30,000), only in Abdomen or at ≥ 2.0 px/mm with the gut centroid in view; limb skin and limb nerves outside the view are skipped in the same frame | points | — | low | [model]; A.8 #20 |
| Budget check for the close-up buffer | freed points (59 % of skin + 50 % of nerves) 8,310 / 15,440 / 25,340 / 38,600 ≥ added points at every tier | points | — | high | computed |

Lazy generation:

- At first load the brain is generated and drawn first. The body is then built in main-thread slices whose length B.9 owns (≤ 8 ms), using a narrow-band iso-surface (a coarse 24-mm pass, then the 4- or 6-mm grid only near the surface) or a Web Worker; the target is the body visible ≤ 2 s after the first brain frame at the high tier. A full 4-mm grid would take ≈ 12–24 s at these slice lengths. The body fades in over t_fade (§13.15).
- A start in brain-only mode never builds the body. The first switch to Whole body builds it.
- The geometry seed is fixed and does not depend on the tier. Buffers are generated at the generation tier and shuffled, so adaptive downgrades draw prefixes and never rebuild; a rebuild happens only on a manual upgrade above the generation tier (B.8), through the same path as `replaceBrain` (`src/renderer.js` L34).
- Body counts follow the active `performance.js` tier. A frame-budget overrun lowers the render scale and then the tier. A model-budget overrun slows the clock through time slicing, never the step size (A.4; §11.7).

### 13.5. Network palette

All body colours come from the project's Planck × CIE pipeline (`src/color.js` L28–L48). A helper `cctDuvRGB(T, duv)` offsets each colour perpendicular to the Planckian locus in CIE 1960 UCS, with positive Duv greener (Ohno 2014). ΔE2000 follows Sharma, Wu & Dalal (2005). Separations are computed at equal relative luminance Y, with Y 0.35 as the reference because body stars are dim. Neither draft palette was kept. One draft reached only ΔE2000 9.4 at Y 0.35 (somatic afferent against neuroendocrine). The other placed neuroimmune at OKLCH hue 112°, inside the warm sector reserved for dopamine. A constrained grid search (CCT ≥ 5,500 K; |Duv| ≤ 0.020; OKLCH C ≤ 0.09; linear red ratio ≤ 0.42; hue outside 30–125° wherever C ≥ 0.02; both somatic colours on the locus) gave the palette below.

| Role | CCT (K), Duv | sRGB | OKLCH L / C / h | Red ratio | Nearest role (ΔE2000, Y 0.35) | Species | Conf. | Source |
|---|---|---|---|---|---|---|---|---|
| Afferent packets, every network ("toward the brain"); somatic swatch | 13,000, 0 | #bccdff | 0.853 / 0.072 / 270 | 0.237 | neuroimmune 11.2 | — | low | [model]; computed |
| Somatic efferent packets | 6,000, 0 | #fff4f1 | 0.974 / 0.013 / 35 (near-neutral) | 0.360 | parasympathetic 12.2 | — | low | [model]; computed |
| Sympathetic | 10,000, −0.020 | #e0c3ff | 0.862 / 0.087 / 306 | 0.324 | neuroendocrine 11.1 | — | low | [model]; computed |
| Parasympathetic, incl. vagus | 6,000, +0.0125 | #f2ffe5 | 0.984 / 0.037 / 128 | 0.334 | enteric 11.5 | — | low | [model]; computed |
| Enteric | 8,500, +0.020 | #c7feff | 0.960 / 0.055 / 198 | 0.223 | neuroimmune 10.9 | — | low | [model]; computed |
| Neuroendocrine (blood haze, gland glow) | 5,500, −0.0175 | #ffd2e6 | 0.908 / 0.056 / 350 | 0.411 | sympathetic 11.1 | — | low | [model]; computed |
| Neuroimmune (speckle) | 13,000, +0.015 | #a5dcff | 0.869 / 0.074 / 237 | 0.181 | enteric 10.9 | — | low | [model]; computed |
| Structural (skin, organs, bone, muscle, cord, resting somatic streams) | 7,500, 0 | #ebecff | 0.949 / 0.025 / 282 | 0.310 | — | — | low | [model]; computed |
| Chyme marker | 6,000, 0 | #fff4f1 | as somatic efferent | 0.360 | — | — | low | [model] |
| Brain neuron stars (unchanged) | 7,000–9,500, 0 | #f4f2ff – #d1dcff | — | 0.32–0.27 | — | — | high | DOPAMINE.md §8.2 |
| Dopamine lantern (reserved, unchanged) | 2,300 (floor 2,200) | #ff9d38 | 0.780 / 0.159 / 61 | 0.727 | — | — | high | DOPAMINE.md §8.2 |

| Check | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Minimum pairwise ΔE2000, seven coloured roles, Y 0.6 / 0.35 / 0.15 | 11.4 / 10.9 / 8.9 (the Y 0.6 minimum is afferent–neuroimmune, the other two enteric–neuroimmune) | ΔE2000 | — | high | computed (`s13final.mjs`), re-checked against an independent CIEDE2000 implementation validated on the Sharma test pair (2.0425) |
| Same under simulated dichromacy, Y 0.35: protan / deutan / tritan | 1.0 (afferent/sympathetic) / 0.1 (sympathetic/neuroimmune) / 3.4 (enteric/neuroimmune) | ΔE2000 | — | low | computed with Machado, Oliveira & Fernandes 2009 matrices |
| Every body colour against dopamine amber | ≥ 24.9 | ΔE2000 | — | high | computed |
| Resting streams (network tint mixed 0.4 into the structural neutral) against structural | 6.3–7.8 | ΔE2000 | — | high | computed |
| Structural against neuron stars | 2.1–5.2 (shared tissue-white family; separated by flux and position) | ΔE2000 | — | high | computed |
| Constraints on every body colour | CCT ≥ 5,500 K; \|Duv\| ≤ 0.020; C ≤ 0.09; red ratio ≤ 0.42; hue outside 30–125° when C ≥ 0.02 | — | — | low | [model]; A.8 #19 |

Assignment rules. Afferent packets always use the afferent colour, whatever their network, and that includes visceral afferents. Efferent packets use the colour of their division (somatic efferent, sympathetic, parasympathetic or enteric motor). Resting streams carry their network tint at weight 0.4. Mixed bundles such as the vagus draw each streamline in the colour of its fibre class, in proportion to the §6 composition, so no blended colours are invented. Colour never encodes temperature, pressure or concentration. Those values live in Vitals.

Under dichromacy several pairs collapse completely. Hue therefore never carries a code alone:

| Code | Non-hue carrier |
|---|---|
| Afferent vs efferent | direction of travel (toward or away from the brain); afferent packets are always the coolest colour |
| Somatic | continuous limb and trunk streams, segmental roots, cord tracts |
| Autonomic | beaded chain beside the vertebrae, prevertebral ganglia, vagus; sympathetic and parasympathetic are separated by anatomy (thoracolumbar vs craniosacral outflow) |
| Enteric | mesh on the gut wall only |
| Neuroendocrine | diffuse haze along vessels and slow gland glows; no streams |
| Neuroimmune | granular speckle at the source tissue and the spleen; no streams |
| Network off | 8 % ghost, fully desaturated |
| Dopamine | lantern luminance and spread (DOPAMINE.md §8.2) |

### 13.6. Modulator tints

Modulator tints sit on source nuclei only (user decision 6). They are never applied to projection fields, lanterns, dopamine somata, release sites or tracts (DOPAMINE.md §8.5). The current additive term `uTint·(R.w·aPos.w·0.6·att)` (`src/shaders.js` L93) almost disappears into the white base star. The tints are therefore specified as a chromaticity substitution, which keeps luminance as the activity channel:

colour = flux · mix(base, tint · Y_base/Y_tint, m), with m = 0.8 · a_mod and a_mod = clamp(mod/mod_max, 0, 1). mod_max comes from the §3 state table, or from DOPAMINE.md §8.1 for its four modulators. Tints have OKLCH C 0.074–0.084 and L 0.86–0.97 (gamut-limited). ΔE2000 is evaluated at Y 0.35 on a 9,500 K base star mixed 0.4 toward 7,000 K; the Rendered C column is the OKLCH chroma of the rendered hex (`verify-editor/tint.mjs` reproduces every rendered hex).

| Modulator | Source nuclei (A.3.3) | Hue h | Tint sRGB | Rendered sRGB (m = 0.8) | Rendered C | ΔE2000 vs untinted / vs amber | Species | Conf. | Source |
|---|---|---|---|---|---|---|---|---|---|
| Prolactin (rose) | `pituitaryAnt` | 0 | #ffc0d2 | #ffcbdf | 0.064 | 15.9 / 23.9 | — | low | [model]; hue family DOPAMINE.md §8.1 |
| Serotonin (violet) | `dr mnr rmg rpa rob` | 305 | #e1caff | #e1cfff | 0.068 | 9.5 / 32.2 | — | low | same |
| GABA brake (teal) | `rmtg`, `vta` | 200 | #a6fbff | #b4f6ff | 0.067 | 17.0 / 34.8 | — | low | same |
| μ-opioid tone (sage) | `pag`, `arcuate` | 140 | #d3ffca | #dbffdc | 0.059 | 21.7 / 30.5 | — | low | same |
| Noradrenaline | `lc` | 232 | #a2dfff | #afe0ff | 0.066 | 11.6 / 36.2 | — | low | [model] |
| Acetylcholine | `nbm msdb hdb ppn ldt` | 170 | #b4ffe4 | #c3ffef | 0.064 | 20.1 / 34.0 | — | low | [model] |
| Histamine | `tmn` | 25 | #ffbfb9 | #ffcacb | 0.060 | 17.4 / 17.6 | — | low | [model] |
| Orexin | `lh` | 126 (moved from 120, inside the 30–125° reserved sector) | #e9ffc9 | #ecffdc | 0.050 | 20.5 / 29.2 | — | low | [model]; `verify-editor/tint.mjs` |
| Oxytocin | — | — | — | gauge only | — | — | — | high | DOPAMINE.md §8.1 |
| Current additive mapping, rendered vs untinted (four DOPAMINE.md tints) | 1.7–6.4 | ΔE2000 | — | — | — | — | — | high | computed (`s13tints.mjs`) |
| Current DOPAMINE.md swatches, GABA vs opioid, Y 0.35 / 0.6 | 7.2 / 8.3 | ΔE2000 | — | — | — | — | — | high | computed |

| Rule or set | Value | Species | Conf. | Source |
|---|---|---|---|---|
| Tints shown at once | ≤ 4, chosen in the Modulators legend | — | high | A.7 |
| Pairwise rendered ΔE2000 of co-displayed tints | ≥ 10 | — | low | A.7 |
| Mutually exclusive pairs (< 10) | prolactin/histamine 5.6; GABA/noradrenaline 8.7; GABA/acetylcholine 7.3; opioid/acetylcholine 6.7; opioid/orexin 4.0; acetylcholine/orexin 9.7 | — | high | computed (`modtint.mjs`; orexin rows `verify-editor/tint.mjs`) |
| Every tint against every network role that can share a view (pituitary, PVN, arcuate, LC, raphe, brainstem ports) | ΔE2000 ≥ 10, or the network glow on brain-side targets is drawn neutral (flux only, no hue). Adopted: hormone and cytokine target glows on brain nuclei are neutral (§13.8), because prolactin vs neuroendocrine (1.7), noradrenaline vs neuroimmune (1.3), GABA vs enteric (2.8) and serotonin vs sympathetic (3.6) cannot be told apart | — | high | computed (`verify-safety-wording/pair.mjs`) |
| Default set `orgasm`: prolactin, serotonin, GABA, opioid | min 11.0 (prolactin/serotonin) | — | high | computed |
| Default set "arousal" for manual stimuli and `loudSound`, `brightLight`, `standUp`, `meal`: noradrenaline, acetylcholine, serotonin, histamine | min 15.4 (serotonin/histamine) | — | high | computed |
| Default set "pain" for `hotObject` and manual pain: noradrenaline, serotonin, opioid, histamine | min 15.4 (serotonin/histamine) | — | high | computed |
| Default set "hypothalamic" for `stressor`, `infection`, `sleepSound`: histamine, orexin, serotonin, noradrenaline (acetylcholine replaced, because orexin at 126° sits 9.7 from it) | min 15.4 (serotonin/histamine) | — | high | computed |
| Limits on every tint | rendered C ≤ 0.08 (below the 0.12–0.15 lantern cap, DOPAMINE.md §8.5); hue outside the reserved warm sector 30–125° (the same sector as the body palette, §13.5); red ratio ≤ 0.50 (maximum 0.46); ΔE2000 to amber ≥ 17 | — | low | [model] |

If a user picks a tint that conflicts with one already shown, the choice is refused and the HUD names the conflicting tint. Tints also collapse under dichromacy, so the legend always names the source nuclei, and values are read from gauges. The substitution mapping changes how the four DOPAMINE.md tints render, but it does not change the orgasm-scenario traces (A.8 #21). It needs a matching revision of the DOPAMINE.md §8.1 mapping row. Until that revision is adopted, the orgasm scenario keeps the additive DOPAMINE.md tints, and the shortfall listed above remains (§13.18).

### 13.7. Brain, organ and effector display

| State (owner) | Display | Mapping | Limit |
|---|---|---|---|
| `a.<node>` of brain nuclei and cortical `area` patches (§3); cord segments, ganglia, ports (§6, §7) | star flux through the region data texture (§11.15), indexed per side | R.x = clamp(1 + 0.8·(a − a_rest), 0.6, 1.8), with a_rest the node's settled value from the §11.6 rest settling, so R.x = 1 at rest and the brain-only image is unchanged; `statetex.compose` writes this rest-normalised value (B.4) | low-pass τ ≥ 0.3 s `tS` |
| `modNE modACh mod5HT modHA modOX` (§3); DA modulators (DOPAMINE.md §5) | tint on source nuclei | §13.6 | ≤ 4 at once |
| DA variables | lanterns, embers, flares, tract flow | DOPAMINE.md §8.1, unchanged | DOPAMINE.md §10 |
| `arousalState`, `procS`, `procC`, `salience`, `lcPhasic`, `predErr` (§3) | activity of their nodes (LC, insula, dACC); Brain systems readout | — | no global brightening |
| `hr` (§7) | heart cluster beat or steady glow | §13.9 | ≤ 8 % of maximum |
| `rr`, `respPhase`, `vt` (§7); `diaphragmExc` (§6) | uniform lung scale about the hila of ±2 % × (`vt` ÷ resting VT, §7); diaphragm sheet displaced at true scale | — | rhythm rule (§13.9) |
| `pupilD.L`, `pupilD.R` (§7) | iris-ring inner radius = `pupilD`/2; outer radius 6 mm covers the physiological range [G Pupillary_response L23] | geometry only | no luminance change |
| `fSudo.<site>` (§7) | sparkle at palm, sole, forehead and axilla stars | patch mean ≤ +10 %, τ ≥ 1 s | ≤ 2 Hz per star, asynchronous |
| `sbf`, `tone.fSymSkin` (§7) | distal skin flux × (1 − 0.15·constriction); dilation ≤ +10 % | τ ≥ 2 s | ≤ 15 % dimming |
| `scl`, `scr`, `tCore`, `tSkin`, `tSet` (§7, §10) | Vitals only | — | never colour |
| `bat`, adrenal, spleen, liver, kidney activity (§7, §9, §10) | cluster flux | ≤ +50 % | τ ≥ 1 s (BAT ≥ 2 s) |
| `bladderVol`, `rectalVol` (§7, §8) | shell radius through the §2 volume law | geometry only | slew ≤ 5 % per s `tS` |
| `emg.<muscle>` (§6) | muscle haze, flux × (1 + 0.5·emg) | τ ≥ 150 ms small, ≥ 300 ms large muscles | ≤ +50 % |
| `shiver` (§6) | steady haze ∝ shiver plus twinkle | never modulated at tremor rate | ≤ 2 Hz per star |
| `joint.<joint>` (§6) | rigid limb rotation | §13.9 | A.8 #22 |
| `swPhase[i]`, `gutC[i]`, `gutX[i]` (§8) | slow-wave ripple travelling aborally; radius × (1 − 0.3·`gutC`); motor-neuron stars brighter | ripple ≤ 10 %; motor stars ≤ +30 % | rhythm rule |
| `gastricSolid`, `gastricLiquid`, `colon[3]` (§8) | chyme marker | flux 0.15 | — |
| Gut hormones (§8); HPA, SAM and posterior-pituitary hormones (§9) | blood haze plus target glow | §13.8 | ≤ 10 % of maximum per ⅓ s |
| `tnf il1b il6 il10` (§10) | speckle at the challenge site and the spleen | §13.8 | τ ≥ 2 s |
| `pge2` (§10) | preoptic node activity | as `a.<node>` | — |
| `sickness.<c>` (§10) | Vitals list | — | — |
| `g.<id>` (A.5) | network ghosting | §13.10 | fade per §13.15 |
| `psi`, `rec.<site>` (§5) | stimulus readout; receptor glyph at the site | — | — |
| `tH`, `kh` (§11) | status clock | A.4 format | always visible |

### 13.8. Packets, shimmer and blood-borne signals

A packet is the drawn form of one population volley on one edge (`EV`, §11). Its centre sits at the arc parameter u interpolated between emission and arrival, and afferent packets move from u = 1 to u = 0 (A.2). A mixed nerve carrying an Aδ front and a C tail therefore shows a double wave: first and second pain. Fibre class is shown by width and grain, not hue. Myelinated classes give a narrow bright core. C-class packets are wider, dimmer and grainy. While the Live dropdown is open, expected arrivals from the §4 analytic overlay appear as small ticks at each station, and the simulation then confirms or corrects them.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Profile along the fibre | symmetric Gaussian, no tail; σ 12 (fine nerves) to 20 (trunks) | mm | — | low | [model] |
| Peak gain | +60 % of the resting stream flux at a full volley, × tanh(volley size) | — | — | low | [model] |
| Class factors (gain; σ) | Aα, Aβ, Ia, Ib, II 1.0; Aδ, Aγ 0.8; B 0.7; C, Cpost, CT, Cmi and visceral C 0.6 with σ × 1.5 | — | — | low | [model] |
| Discrete-packet limit | ≤ 2 per s `tS` past any point of a bundle and per limiter window; otherwise shimmer | 1/s | H | medium | W3C 2023 (whose ceiling is 3); §13.15. Each packet is a ≥ 10 % luminance pulse, i.e. a flash, so a cap of 3 would sit exactly on the Harding hazard onset that §13.15 says is never reached, and the §13.17 flash analysis fails at a third flash. The cap is therefore 2, safe by construction rather than by the limiter |
| Shimmer | stream flux × (1 + 0.6·ā), ā = edge activity low-passed with τ ≥ 0.3 s; per-star twinkle ±10 % at 0.2–2 Hz, desynchronised | — | — | low | [model]; DOPAMINE.md §10 rule 3 |
| Relay arrival glow (DRG, nucleus, thalamus, cortical patch) | ≤ +40 % flux; rise ≥ 50 ms only for glows below 1 % of the flash area, otherwise the regional low-pass (τ ≥ 0.3 s) governs the rise; decay τ ≥ 0.3 s; ≤ 2 Hz per point | — | — | low | [model] |
| Efference-only packets (A.5) | 50 % gain, desaturated; fade over the last 30 mm or 0.4 s `tS`, whichever is longer; a port marker of 6 neutral points remains | mm, s | — | low | [model] |
| Packets on a cut edge | fade out over 0.3 s `tS` | s | — | low | [model]; A.5 |
| Packets evaluated per vertex | ≤ 8, from the per-path packet table: packets sorted by path each frame, with an index texture (path → first record and count, B.7) | — | — | low | [model] |
| Arrival-tick lifetime | 2 | s `tS` | — | low | [model] |
| Canvas packet labels ("Aδ 15 m/s") | off by default; every arrival is logged in Live | — | — | low | [model] |

Hormones and cytokines never travel as packets. Moving blobs along vessels would read as pumping and would add flashes.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Haze level | H = clamp(0.5 · log₂(c/c_basal), 0, 1); haze flux × (1 + 0.5·H) | — | — | low | [model] |
| Target organs and target nuclei (adrenal cortex, liver, spleen, PVN, hippocampus, area postrema, arcuate) | ≤ +30 % flux, weighted by the §9 and §10 receptor weights; organs carry the network hue, brain nuclei glow neutral (flux only) so they never compete with modulator tints (§13.6) | — | — | low | [model] |
| Haze and target rise and fall | τ ≥ 2 s `tS`; ≤ 10 % of maximum luminance per ⅓ s | — | H | medium | [model]; DOPAMINE.md §10 rule 2 |
| Cytokine speckle density | clamp(log₁₀(c/c_basal)/2, 0, 1) (saturates at 100 × basal) | — | — | low | [model] |
| Contested route (inflammatory-reflex efferent, A.8 #16) | 60 % opacity, dashed legend "Contested route" | — | — | low | [model]; DOPAMINE.md §10 rule 9 |

### 13.9. Rhythms, heartbeat and limb motion

> **Heart (6 November 2026).** The heart is drawn per beat, in screen time, up to 150 bpm, regardless
> of `kh`. The photosensitivity limit concerns the screen frequency, which is the heart rate itself,
> not the time compression. Time compression does not speed the beat; slow motion slows it. Above
> 150 bpm the heart shows a steady glow. See research/HEART.md.

Rhythm rule. A periodic luminance or motion is drawn cycle by cycle only while its screen frequency (f × `kh`) is at most 1 Hz. Above that it is drawn as its cycle mean (envelope mode), and the numeric rate goes to Vitals. The only exceptions are small-point twinkle at ≤ 2 Hz and the heartbeat row below.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Rhythm-rule threshold | 1 | Hz `tS` | — | low | [model] |
| Switch to envelope: stomach (≈ 3 per min) / duodenum (≈ 12 per min) | `kh` ≈ 20 / ≈ 5 | — | H | medium | computed; rates [G Interstitial_cell_of_Cajal L60–L63], owner §8 |
| Switch to envelope: respiration at `rr` 14 (§7) | `kh` ≈ 4.3 | — | H | high | computed |
| Heart cluster luminance swing per beat | ≤ 8 % of maximum | — | — | low | [model]; A.9 |
| Per-beat display condition | `kh` ≤ 1 and `hr` ≤ 150 bpm (≤ 2.5 Hz); otherwise a steady glow ∝ `hr`/rest within ±15 %, τ ≥ 2 s | — | — | low | [model]; A.9 |
| Beat shape | raised cosine, ≥ 150 ms `tS` | — | — | low | [model] |
| SA → AV → ventricle sequence on small points | shown at `kh` ≤ 0.1; ≤ 2 Hz per point | — | — | low | [model] |
| Heart size, Thorax view / Whole body view | ≈ 297 × 271 (≈ 63,000 px², about 2.9 × the flash area) / ≈ 57 × 52 | px | — | high | computed from §2.8 extents |
| Pelvic streams in `orgasm` (only after the rule-7 amendment is confirmed, §13.18) | schematic, non-rhythmic activity markers, not modelled volleys: ≤ 0.5 per s per stream, jittered ±40 %, never phase-locked to the contraction model; rate and speed not to scale (§13.14); ≤ +30 % gain; the contraction rhythm appears only in the HUD trace | 1/s | — | low | [model]; A.8 #21 |

| Limb motion (rigid segment transforms in the vertex shader) | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Segments | ≈ 20, with two-bone blending over 30 mm at joints | — | — | low | [model] |
| Withdrawal: elbow / wrist | ≤ 30 / ≤ 20 | deg | — | low | A.8 #22 |
| Knee jerk: knee extension | ≤ 15 | deg | — | low | A.8 #22 |
| Startle: head and shoulders | ≤ 5 | deg | — | low | A.8 #22 |
| Screen angular speed of any segment | ≤ 60 | deg/s `tS` | — | low | [model] |
| Trunk and pelvis; rhythmic motion | never | — | — | high | A.8 #22 |
| Reduced motion | no limb motion; muscle haze only | — | — | high | §13.15 |

Joint angles come from `joint.<joint>` (§6) and are clamped to these limits. The physiological `posture` does not change the drawn geometry (A.2). The startle cascade (§6; [G Startle_response L39]) is the heaviest load the limiter has to handle, so it is played slowed (§12), and its packets fall under the bundle and window caps.

### 13.10. Switches, interventions and brain-only display

| Event | Display |
|---|---|
| Network off (`net.<id>` false) | The ghost factor follows g.<id>(tH) (§11.10), limited so that it never changes faster than the §13.15 fade (≥ 0.8 s `tS`); the network is drawn fully off only when g = 0. Ghost = 8 % flux, fully desaturated. At slow clocks the display therefore never claims a network is off while the model still delivers its packets. Packets on cut edges fade in 0.3 s. Brain commands continue as efference-only packets that end at the port (A.5). Readouts take their tags: "intrinsic" (HR, autonomic off), "basal" (hormones), "ventilation maintained (model assumption)". |
| Network on | The cross-fade reverses. Packets resume with the next volley. |
| Master → Brain only | The body fades out, then its draw calls are skipped. From a body view the camera flies to the last brain view (default Whole brain). The five switches are greyed but remember their state. Body vitals show "—". Sense organs are not drawn, and special-sense packets start at the first central station (A.5). |
| Master → Whole body | Body states reset to rest (A.5). The body fades in, and the camera flies to Upper body. |
| Intervention preset (one at a time, §11) | A neutral ring of 12 points (6,000 K) marks the lesion site, labelled in Live. Removed nodes and edges become ghosts. An "Intervention" badge appears in Vitals. |
| Scenario unavailable in brain-only mode (A.3.5) | The entry is greyed, and its tooltip reads "Needs the body". |
| Brain systems overlay (display only, A.5) | Member flux × 1.6 and non-member flux × 0.7, with the fade of §13.15. Network arcs stay at ≤ 15 % of tract luminance and follow the §3 haemodynamic response; they are labelled "functional connectivity (fMRI correlation)" and are off by default (A.8 #23). |

### 13.11. Camera

Yaw follows `src/camera.js` L136–L139. Yaw 0 puts the eye anterior, yaw > 0 moves it toward the patient's right (+x), and yaw π gives a posterior view. The pixel scale at a 1,080-px canvas is 19.15 / d px/mm for the vertical field of view of 0.55 rad.

| View preset | Target (x, y, z) units / distance / yaw / pitch | Brain length (1,080 px) | Species | Conf. | Source |
|---|---|---|---|---|---|
| Brain: Whole / Cutaway / Dopamine (unchanged) | as `src/main.js` L46–L48; distances 3.6 / 3.2 / 3.0 | 914 px at 3.6 | — | high | `src/main.js` L44–L48 |
| Whole body | (0, −0.2, −7.9) / 35 / −0.35 / 0.10 | 94 px (0.547 px/mm) | — | high | computed: 1,760 mm + 12 % margin gives 34.9 |
| Upper body (default in whole-body mode) | (0, 0, −2.46) / 13.6 / −0.35 / 0.10 | 242 px | — | high | computed: vertex to umbilicus + 15 % |
| Head and neck | (0, 0.1, −0.4) / 6.7 / −0.5 / 0.15 | 491 px | — | low | [model] |
| Thorax | (−0.1, 0, −3.3) / 6.7 / −0.25 / 0.10 | 491 px | — | low | [model] |
| Abdomen | (0, 0.1, −5.9) / 8.6 / −0.25 / 0.10 | 383 px | — | low | [model] |
| Torso | (0, 0, −4.6) / 14.3 / −0.35 / 0.10 | 230 px | — | low | [model] |
| Spine (posterior) | (0, −0.6, −4.3) / 15.9 / π / 0.10 | 207 px | — | low | [model] |
| Right arm | (2.2, −0.2, −5.5) / 17.5 / +0.6 / 0.10 | 188 px | — | low | [model] |
| Right leg | (0.9, 0, −12.0) / 20.4 / +0.45 / 0.10 | 161 px | — | low | [model] |

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Vertical field of view (unchanged; widened when aspect < 1.2) | 0.55 | rad | — | high | `src/main.js` L86; `src/camera.js` L143 |
| `minDistance` (unchanged) / `maxDistance` (was 7) | 0.9 / 45 | units | — | low | `src/main.js` L86; [model] |
| Far plane (was 50) / near plane (was 0.01) | 150 / 0.01 · max(1, d/4) | units | — | low | `src/camera.js` L144; [model] |
| Fly-to | existing exponential approach at 3.5 s⁻¹ (95 % in 0.86 s), applied to log distance; with reduced motion, a cross-fade over t_fade (§13.15); view changes are limited to one per t_fade, and repeated V presses queue | s | — | low | `src/camera.js` L111; [model] |
| Distance fit rule (portrait and narrow canvases) | d = max(H_view / (2·tan(fovEff/2)), W_view / (2·aspect·tan(fovEff/2))), from each view's box with margin (Whole body 1,971 × 627 mm); the table distances are the landscape values, and the §13.4 brain-span LOD rule is evaluated in actual pixels | units | — | low | [model]; `src/camera.js` L143 widens fovEff when aspect < 1.2 |
| Auto-orbit | 0.03 rad/s in brain views (unchanged); off in body views and with reduced motion | rad/s | — | low | `src/main.js` L86; [model] |
| Camera shake; camera response to any stimulus | 0; none (balance stimuli appear only as labyrinth and VOR-marker activity) | — | — | high | A.6 |

Brain-only mode offers only the three brain views.

### 13.12. Picking, stimulus sites and keyboard access

A click is unprojected to a ray in mm and sphere-traced against the §13.2 field to find the skin hit. The hit snaps to the nearest valid sample in a hash grid. Each sample stores its dermatome and nerve territory (§6), its segment and its path length (§2.14). Hover highlights only the sites valid for the chosen sense (A.6; final list §5). A selection places a neutral 12-point ring and opens the readout lines: Site, Dermatome, Nerve, Segment, Path, Predicted (§4 overlay) and Perceived (ψ, §5). Applying the stimulus opens an episode. During the approach phase (A.4) the ring contracts (a fixed ring under reduced motion, §13.15). Stimuli are never drawn as flames or objects. A light stimulus is a local retinal glow, never a screen flash, and no sound is ever played (A.6).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Sphere tracing | ≤ 64 steps, stop at 0.5 mm | — | — | low | [model] |
| Hash-grid cell / skin snap radius | 10 / 30 (beyond that, "no valid site") | mm | — | low | [model] |
| Special-sense hit volumes (eyes, ears, nose, tongue, labyrinth) | 1.5 × the drawn size | — | — | low | [model] |
| Joint and tendon pick spheres | radius 25 | mm | — | low | [model] |
| Interoception | the ray ignores skin and hits the §2.8 organ volumes and receptor sites; site-free modes (e.g. `co2`) apply from the dropdown (§5) | — | — | low | [model]; A.6 |
| Digits | nearest digit capsule (§2.6) within the hand; every digit also in the keyboard list | — | — | low | [model] |
| Approach ring | 20 → 5 mm over the approach phase (log₁₀(k₀/k₁) screen s, ≈ 1.7 s from ×1 to ×0.02), ≤ 10 % of maximum luminance; a fixed 10-mm ring fading in under reduced motion | mm | — | low | [model]; A.4 |
| Retinal stimulus glow | ramped over ≥ 300 ms `tS`, confined to the eye cluster | ms | — | low | [model] |
| Touch target of any site marker | ≥ 24 × 24 | CSS px | H | high | W3C 2023 (SC 2.5.8) |
| Never pickable | S4–S5 perianal band [G Dermatome_anatomy L88]; perineal region; pelvic-floor field | — | H | high | A.1 |
| `dermatome.S3` (ischial tuberosity [G Dermatome_anatomy L87]) | pickable only while \|wrap(yaw − π)\| < π/2, wrapping to (−π, π] — equivalently cos(yaw) < 0, a posterior view. Without the wrap the rule fails for unwrapped yaw: a camera behind the figure at yaw −3.0 rad gives \|−3.0 − π\| ≈ 6.1 > π/2. The rule is evaluated on the camera yaw whatever the pitch. `dermatome.S4`, `.S5`, the perineal region and the pelvic-floor field have no pick sample at all, from any view | — | — | high | A.1; [model] |
| Brain-only mode | body picking disabled; chips Eye, Ear, Nose, Tongue, Head offer vision, hearing, smell, taste and balance (side L / R / both) | — | — | high | A.5, A.6 |

The keyboard site list is a fully keyboard-operable alternative to clicking (arrow keys move, Enter applies, Escape clears). The Side control mirrors bilateral entries. Each entry gives the same readout as a click.

| Group | Entries (A.3.3 ids; descriptions in brackets) |
|---|---|
| Skin, upper limb and neck | `indexTip`; thumb pad (`dermatome.C6`); middle-finger pad (`dermatome.C7`); little-finger pad (`dermatome.C8`); `palm`; `forearmDorsal`; lateral elbow crease (`dermatome.C5`); medial elbow crease (`dermatome.T1`); acromioclavicular joint (`dermatome.C4`); supraclavicular fossa (`dermatome.C3`); occipital protuberance (`dermatome.C2`) |
| Skin, face and trunk | `foreheadV1`, `cheekV2`, `chinV3`; `dermatome.T4`; `dermatome.T6`; `umbilicus`; `dermatome.T12`; posterior thorax at T6 |
| Skin, lower limb | anterior thigh (`dermatome.L2`); medial knee (`dermatome.L3`); medial malleolus (`dermatome.L4`); dorsum of foot (`dermatome.L5`); `heel`; `footSole`; `bigToe`; popliteal fossa (`dermatome.S2`) |
| Tendons and joints | `bicepsTendon`, `tricepsTendon`, `patellarTendon`, `achillesTendon`; `shoulder`, `elbow`, `wrist`, `finger`, `hip`, `knee`, `ankle` |
| Special senses | `retina`, `cochlea`, `olfEpith`, `tongueAnt`, `tonguePost`, `vestLabyrinth` |
| Interoception | `carotidSinus`, `aorticArch`, `lungStretch`, `stomachWall`, `duodenum`, `colonRectum`, `bladder` |

### 13.13. HUD dropdowns, labels and controls

Every dropdown is collapsible. Its head shows the title, at most one short status chip (for example the FPS badge or the "rat-calibrated" pill, `index.html` L39, L127) and the chevron; never a subtitle line, tagline or one-line summary (user decision 7). Open states are remembered per dropdown, as now (`src/ui.js` L76–L79). The existing vitals dropdown titled "Body" (`index.html` L94, store key `vitals`) is renamed **Vitals** and keeps its key. The new **Body** dropdown takes the key `body`. Default at first load: whole body, all networks on, the orgasm scenario playing in demo mode on the Dopamine system view (`?scenario=none`: the Upper body view, no scenario), all dropdowns collapsed (A.7).

| Dropdown (order) | Contents and exact labels | Brain-only mode |
|---|---|---|
| Body | Segmented control "Brain only" / "Whole body"; switches "Somatic", "Autonomic", "Enteric", "Neuroendocrine", "Neuroimmune", each with its §13.5 swatch and a pattern glyph | switches greyed, state remembered |
| Interventions | "None"; "Spinal cord injury" (level, type, phase); "Nerve section" (nerve, day); "Dorsal rhizotomy"; "Heart transplant"; "Atropine"; "Truncal vagotomy"; "Sympathectomy T2–T3" (stellate option); "Pure autonomic failure"; "Adrenalectomy"; "Hypophysectomy"; "Splenic denervation"; "Vagus nerve stimulation (relative efferent drive 0–1, model; experimental)" (slider; hover "Animal and early human data; not a clinical setting", §10.4); one at a time (§11) | greyed |
| Stimulus | Sense ("Vision", "Hearing", "Touch", "Pain", "Temperature", "Smell", "Taste", "Balance", "Proprioception", "Interoception"); Mode; Intensity (physical units, §5 markers); Duration; Side; Site ("Pick on body" or the keyboard list); "Apply"; Repeat (count, interval, §12); readout lines (§13.12); "Clear" | special senses only |
| Scenarios | A.3.5 labels; Play/Pause, Restart; scrubber on a log₁₀(`tH`) axis from 1 ms to the scenario span with §12 checkpoint ticks; seeking restores the nearest snapshot (every 10 % of the span) and fast-forwards deterministically (§12.2); "Orgasm – dopamine" has Restart only. The "Orgasm – dopamine" entry carries its existing options, moved from Settings (`index.html` L151–L195): mode, stimulation level, response profile, refractory duration, post-orgasm hypothesis | per A.3.5 |
| Time | Clock readout (A.4 format) followed by "lock", "scenario" or "auto"; presets "Reflex", "Pain", "Autonomic", "Gut", "Endocrine", "Immune", "Circadian"; log slider over the A.4 `kh` range; "Lock", "Auto", "Pause" | available |
| Brain systems | Overlays "Thalamocortical", "Basal ganglia loops", "Cerebellar loops", "Limbic", "Hypothalamus", "Brainstem centres", "Large-scale networks (functional connectivity)"; "State" select (`wakeAlert` … `rem`, §3) | available |
| Vitals | "Heart rate", "Blood pressure", "Respiration", "Pupil L/R", "Skin conductance", "Core temperature" (with set point), "Skin temperature", "Gut motility", "Cortisol", "Adrenaline", "IL-6", "Sickness behaviour"; "Contractions" (orgasm scenario only); tags "intrinsic", "basal", "clamped", "ventilation maintained (model assumption)", "central chemoreflex only", "switch transient (model)", "syncopal range — not a viable steady state", "—"; an "Intervention" chip in the head while a preset is active; 60 s `tS` sparklines labelled with the `tH` span they cover | body values "—" |
| Live | Event log (`tH`, station, event, fibre class and velocity, simulated vs analytic latency and target range), ≤ 50 entries, newest first; phase description; last stimulus path | available |
| Dopamine | existing (DOPAMINE.md §8.6) | available |
| Modulators | legend of ≤ 4 active tints with source-nucleus names and the exclusive-pair rule (§13.6); gauges incl. noradrenaline, acetylcholine, histamine, orexin, oxytocin | available |
| Views | Brain: "Whole brain", "Cutaway", "Dopamine system". Body: "Whole body", "Upper body", "Head and neck", "Thorax", "Abdomen", "Torso", "Spine", "Right arm", "Right leg". Toggles: "Skeleton" (off), "Touch receptors" (off), "Labels" (off) | body views hidden |
| Performance | existing, plus "Quality" (moved from Settings), body points, packets drawn, model ms per frame, "Clock lowered by budget" | available |
| Settings | "Age" (default 30, §11), "Reduced motion" (System / On), "Reset", "About" | available |

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Clock units: < 100 ms / 100 ms–1 s / 1–60 s / 1–60 min / ≥ 1 h | ms with 1 decimal / whole ms / s with 1 decimal / min / h:mm:ss | — | — | low | [model]; `src/main.js` L33–L37 |
| Readout precision: heart rate, blood pressure, adrenaline, IL-6 / pupil / skin conductance / temperatures / cortisol | whole numbers / 0.1 mm / 0.1 µS / 0.1 °C / 0.1 µg/dL | — | — | low | [model] |
| HUD text refresh | 0.12 | s | — | high | `src/main.js` L210 |
| Event-log announcements (`aria-live="polite"`) | ≤ 1 per 2 | s | — | low | [model] |
| Clock step per key press | 1 decade of `kh` (the A.4 slew still applies) | — | — | low | [model] |

Existing keys keep their meaning: Space, D, P, V, H, I, F and Esc (`src/ui.js` L404–L446). New keys are B (master switch), L (clock lock), `[` and `]` (clock down or up one decade) and Enter (apply the armed stimulus while focus is in the Stimulus dropdown or site list). Network switches get no global keys, so that they cannot be toggled by accident. Stimulate and Distract (`index.html` L214–L215) appear only while the orgasm scenario is active. The HUD dims at the climax (`src/ui.js` L552–L554; `style.css` L67) in that scenario only, over t_fade (§13.15). Opacity fades are not motion, so the fade also runs under reduced motion: `.hud` is removed from the reduced-motion rule (`style.css` L563–L567), which today makes the dim instant. The canvas `aria-label` (`index.html` L11) changes with the mode.

### 13.14. Disclosures and uncertainty labels

| Item | Label | Where |
|---|---|---|
| Neural structures (nuclei, cortex, cord grey matter, ganglia, ENS) | "1 star ≈ N neurons", where N = count from the owner section (§3; §6 for the cord; §8 for the ENS) ÷ stars drawn at the current tier | hover, About |
| Nerve streams | "Stars mark fibre bundles; density not proportional to axon count" | hover |
| Skin and non-neural organs | "Stars mark tissue, not cells" | hover, About |
| Nerves, ganglia, adrenals, cranial-nerve nuclei, nuclei < 50 mm³, ENS ganglia | "Enlarged for legibility" | hover |
| Sense organs, brainstem relays, low-confidence body coordinates (§2, §3) | "Estimated position" (body ± 20–40 mm, A.2) | hover |
| Pelvic nerves and plexuses | "Schematic" | hover |
| Hormone and cytokine glows | "Plasma level, not vessels" | legend |
| Body brightness | "Brightness normalised for visibility" | About |
| Packets on modelled edges | "Population volleys at modelled human conduction velocities (one default per fibre class) along schematic routes, slowed only by the shown clock; not single spikes" | About, Live |
| Pelvic streams, orgasm scenario (once confirmed, §13.18) | "Schematic activity marker; timing not to scale" | legend, Live |
| Inflammatory-reflex efferent | "Contested route" | legend, Live |
| Immune → brain inter-wave delay (§10.3) | "Illustrative timing" | Live |
| Locomotor CPG (§6.13) | "Inferred in humans" | hover |
| Rate-unit limits (§4.5) | "Model simplification" | hover, About |
| Stimuli below the perceptual threshold (§5) | "Not perceived" | Stimulus readout |
| Brain only | "Isolated-brain model: body inputs silent, blood values held at rest (model assumption)" | Body dropdown hover, About |
| Switch transients and the autonomic-off upright pressure (§11.10, §12.9) | "Switch transient (model)"; "Syncopal range — not a viable steady state; consciousness and cerebral perfusion are not simulated" | Vitals |
| Reference figure | "A figure without sex characteristics, built on male reference proportions (Drillis & Contini 1966); female proportions are not modelled" | About |
| Photosensitivity | "Flashing is limited to WCAG 2.3.1 thresholds; this lowers but does not remove risk for photosensitive viewers" (DOPAMINE.md §10 rule 3) | About |
| Dopamine values | "Rat-calibrated model" | Dopamine (DOPAMINE.md §10 rule 8) |
| Audio | "No sound is played" | About |

Uncertainty rules:

1. Every displayed quantity carries an A.1 species badge, or "model" for design choices, and a three-step confidence glyph.
2. Low-confidence values show at most two significant figures, and show a range when the owner gives one.
3. A model latency always appears next to its target range from §4, §5 or §6. It is never shown alone.
4. Dynamics transferred from another species name that species in Live and in checkpoint labels (§12).
5. Every time value in the HUD is `tH`. A screen-time figure never appears without the clock.
6. Scenario outputs are labelled "model run, seed n", never as population means.

### 13.15. Photosensitivity limiter and reduced motion

These limits apply in screen time `tS` to the composited frame. Everything drawn is included: packets, glows, tints, haze, toggles, lanterns, camera moves and HUD.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Flash rate | WCAG ceiling ≤ 3 general or red flashes in any 1 s; **display target ≤ 2** (A.9; user decision 9). The limiter triggers before a window would register a third flash (sixth opposing transition) in any 1 s, so displayed flash rates stay below 3 Hz, the hazard onset of Harding et al. 2005 (≥ 3 Hz), and every per-source cap (packets, §13.8) is set at 2 so no single source needs the limiter to stay inside it | 1/s | H | high | W3C 2023 (SC 2.3.1, which permits up to three flashes); Harding et al. 2005 [unverified: abstract read] |
| General flash | a pair of opposing changes of ≥ 10 % of maximum relative luminance, with the darker state < 0.80 | — | H | high | W3C 2023; DOPAMINE.md §10 rule 1 |
| Red flash | a transition to or from R/(R+G+B) ≥ 0.8 with a chromaticity change > 0.2 in CIE 1976 UCS (linear RGB) | — | H | high | W3C 2023; DOPAMINE.md §10 rule 4 |
| Flash area | 0.006 sr = 25.1 % of a 10° field (0.0239 sr) | sr | H | high | W3C 2023; computed |
| Flash area on screen | 21,824 (25 % of a 341 × 256 CSS px 10° field, WCAG Note 1, which W3C calls more conservative than the 96-ppi CSS pixel); a fixed upper bound: a runtime value may only reduce it, never enlarge it. The 96-ppi estimate (≈ 30,900) covers up to 0.008 sr on common 80–90 ppi monitors and is not used | CSS px² | H | high | W3C 2023; DOPAMINE.md §10 rules 1–2 (same value) |
| 10° evaluation window | 341 × 256 CSS px (may only shrink at runtime) | CSS px | H | high | W3C 2023 |
| Most provocative flicker band | 15–25 Hz, within 1–65 Hz (the 2026 consensus advises avoiding bright flashing at 10–20 Hz) | Hz | H | medium | Fisher et al. 2005 [unverified: abstract read]; Fisher et al. 2026 [unverified] |
| Regional low-pass (sources ≥ 1 % of the flash area) | τ ≥ 0.3 (passes 17 % of a 3 Hz and 8.8 % of a 6 Hz modulation) | s | — | high | computed; A.9 |
| Global (frame-mean) low-pass | τ ≥ 0.5 | s | — | low | A.9 |
| Large-area slew | any region larger than the flash area changes by ≤ 10 % of maximum per ⅓ s | — | H | medium | DOPAMINE.md §10 rule 2 |
| Packets; single points | ≤ 2 per s past any bundle point and per window (§13.8); ≤ 2 Hz per point | 1/s, Hz | — | low | DOPAMINE.md §10 rule 3; tightened from 3 so that the packet stream cannot itself reach the flash ceiling |
| Toggle and overlay fade | t_fade = max(0.8 s, ΔL_max ÷ 0.3 s⁻¹), ΔL_max = largest regional change as a fraction of maximum; ghost at 8 % flux | s | — | low | A.5; A.9; [model] |
| Heartbeat | ≤ 8 % of maximum; per beat in screen time at `hr` ≤ 150 bpm, any `kh` | — | — | low | §13.9; A.9 |
| Vasoconstriction dimming | ≤ 15 %, τ ≥ 2 s | — | — | low | A.9 |
| Lantern colour | ≥ 2,200 K (default 2,300 K); displayed red ratio ≤ 0.75 | K | — | high | DOPAMINE.md §10 rule 4 |
| Red ratio, body colours / modulator tints | maximum 0.411 / 0.46 | — | — | high | computed (§13.5, §13.6) |
| Periodic structures (ribs, intercostal streams, dermatome bands) | ≤ 5 light–dark pairs over the whole pattern, static or changing (DOPAMINE.md §10 rule 5); otherwise irregular, jittered and ≤ 30 % Michelson; never a regular grating of 1–8 cycles/deg | pairs | H | medium | DOPAMINE.md §10 rule 5; Harding et al. 2005 [unverified: abstract read]; Fisher et al. 2026 [unverified] |
| Stripe contrast | ≤ 30 % Michelson, irregular and jittered | — | — | low | [model]; DOPAMINE.md §10 rule 5 |
| Rib and intercostal period, Whole body / Upper body | 13.1 px ≈ 3.0 cycles/deg / 33.8 px ≈ 1.2 cycles/deg at 60 cm; a rib cage has ≈ 12 pairs at any scale | — | — | high | computed (24 mm spacing, 60 cm; 39.6 CSS px per degree) |
| CSS px per degree by viewing distance (D · tan 1° · 3.7795) | 39.6 at 60 cm; 49.5 at 75 cm; 52.8 at 80 cm; 59.4 at 90 cm | CSS px/deg | H | high | computed. The spatial-frequency hazard grows with distance, so a period stated for one distance has no margin |
| Limiter cells | ≤ 4 CSS px (≈ 0.1°); each cell accumulates the projected area of the sources whose own luminance change is ≥ 10 % of maximum (darker state < 0.80) or that make a red transition, with a 1-s transition history | CSS px, s | — | low | [model] |
| Limiter windows | the 10° window (341 × 256 CSS px), sliding by one cell | CSS px | — | low | W3C 2023; [model] |

Pattern rules. Ribs are drawn as irregular, non-periodic hints only, never as a regular grating of 1–8 cycles/deg. The period rule is stated for a **range** of viewing distances, not for one: it must stay ≥ 60 CSS px (≥ 2.5 px/mm for the 24-mm spacing), which keeps the pattern at ≤ 0.66 cycles/deg at 60 cm and ≤ 0.99 at 90 cm, outside the provocative band over the whole 50–90 cm desktop range. A 40-px period would be 0.99 cycles/deg at exactly 60 cm and 1.24 at 75 cm, i.e. inside the band, so it is not used. Of the presets only Thorax and Head and neck reach 60 px; Abdomen (2.227 px/mm × 24 mm = 53 px) does not, and ribs there stay in the jittered, non-periodic form. The skeleton is off by default. Intercostal streams and dermatome bands are jittered and kept at ≤ 30 % contrast, and they are never lit in phase, so a mass volley never lights every intercostal at once. The intestine is a non-periodic random-walk tube, never regular parallel loops (§2.9).

Limiter. Every frame, each light source adds its projected area and its own luminance transition to the cells it covers. A window registers a flash when the cells with concurrent opposing transitions cover > 25 % of it (> 21,824 CSS px²), so widespread low-contrast flicker on scattered stars is counted even when the window mean changes little. When a window would register a third flash within 1 s, or the large-area slew limit would be broken, a gain is applied to the sources in that window, the most recent first, and the window is forced into shimmer. The large-area slew limit applies to any connected set of cells larger than the flash area. The cost does not depend on point counts. The rhythm rule (§13.9) removes periodic sources before they reach the limiter. A view change is user-initiated: it is exempt from the large-area slew limit but counts as one transition, and view changes are limited to one per t_fade (§13.11).

| Reduced motion (`prefers-reduced-motion` or Settings) | Effect | Source |
|---|---|---|
| Limb motion | off; muscle haze only | [model] |
| Breathing, gut and bladder geometry | frozen at mean values; traces stay in Vitals | [model] |
| Packets | a static highlight of the active path at 30 %, advancing hop by hop with a 1 s fade per hop | [model] |
| Heartbeat pulse | off (steady glow) | [model] |
| Shimmer and twinkle amplitudes | halved | DOPAMINE.md §10 rule 6 |
| Auto-orbit | off (currently spin/3, `src/camera.js` L44) | DOPAMINE.md §10 rule 6 |
| Fly-to | cross-fade over t_fade | [model] |
| Gut slow-wave ripple | static envelope (cycle mean), no travelling luminance | [model] |
| Approach ring | fixed 10-mm ring fading in over the approach | [model] |
| Efference-only packets | static port highlight | [model] |
| Dopamine tract flow | off | DOPAMINE.md §10 rule 6 |
| HUD climax dim; body fade-in | opacity fade over t_fade (not motion; kept) | [model] |

### 13.16. Rendering implementation and reconciliation with `src/`

B.4 owns the module and interface list (§11.16). The display-side responsibilities are body generation (SDF, skin sampling, budgets, seeded `mulberry32` generation; `src/body/generate.js`), picking (`src/body/picking.js`), the palette (`cctDuvRGB`, §13.5–§13.6, an extension of `color.js`), packets, effectors and the limiter (`src/safety.js`), together with the HUD in `src/ui.js`, `index.html` and `style.css`. Each body point carries its position in mm and base flux; a normal, or `pathId` and u; the eight B.7 network bits, with "structural" carried by the tissue class; and kind and LOD level. One body program reads a vector of eight display gains, which carry the cross-fades. Packets live in a float texture of (pathId, u, σ, gain, class), sorted by path with a path index (B.7). Per-region brain state moves to the sided state textures (§11.15). The current uniform arrays (`src/shaders.js` L30, L63, L122) cannot hold the 122 regions of §3 (123 with the DOPAMINE.md A14 region).

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Display-side CPU (packet table, effectors, limiter, picking) | ≤ 0.5 | ms/frame | — | low | [model]; the model kernel budget is §11 |
| Packet-table upload | ≤ 256 × 5 | floats/frame | — | high | §13.4 pool |
| Lazy body build slice | ≤ 8 (B.9 owns it); body visible ≤ 2 s after the first brain frame at the high tier | ms/frame | — | low | [model] |

| Current state | Change | Owner |
|---|---|---|
| Vitals dropdown titled "Body" (`index.html` L94) | renamed "Vitals"; new "Body" dropdown for the switches | §13.13 |
| Orgasm options and View select in Settings (`index.html` L151–L195) | orgasm options → Scenarios; View → Views; Quality → Performance | §13.13 |
| Stimulate and Distract always visible (`index.html` L214–L215) | visible only in the orgasm scenario | §13.13 |
| Additive modulator tints (`src/dopamine.js` L82–L86; `src/shaders.js` L93) | chromaticity substitution, pending a DOPAMINE.md §8.1 revision | §13.6 |
| Uniform arrays (`src/shaders.js` L30, L63, L122) | region data texture | §11 |
| Reduced-motion auto-orbit spin/3 (`src/camera.js` L44) | off | DOPAMINE.md §10 rule 6 |
| `maxDistance` 7 (`src/main.js` L86); far 50, near 0.01 (`src/camera.js` L144) | 45; 150; 0.01 · max(1, d/4) | §13.11 |
| Fibre tracts 4,200 K (`src/main.js` L162) | 5,500–6,000 K | DOPAMINE.md §8.2 |
| Static canvas `aria-label` (`index.html` L11) | changes with the mode | §13.13 |
| Reduced-motion rule for `.hud` (`style.css` L563–L567) | removed: the HUD opacity fade runs over t_fade | §13.13, §13.15 |
| Brain-only rendering | identical to the post-port build (DOPAMINE.md §9.8 port, Phase 0a, B.15) apart from the §3 geometry additions and the rows above | A.2 |

### 13.17. Verification

These tests run headless at fixed seeds, with WebGL readback where an image is needed.

| Test | Pass criterion |
|---|---|
| Brain-only image regression | Matches the post-port build (golden images recorded in Phase 0a, B.15) except inside the structures changed by §3 and the §13.16 rows |
| Brain views with the body on | At camera distance ≤ 5 units, body contributions add ≤ 1 % of the brain's mean luminance |
| Luminance ratios | Captured frames in every §13.11 preset meet the §13.3 targets |
| Flash analysis | Every frame of every §12 scenario, the startle volley, all switch toggles and view changes, replayed at 10, 30, 60 and 144 fps and at `kh` ∈ {preset, 0.005, 3,600}: the per-cell area rule of §13.15 never registers more than 2 flashes (5 opposing transitions) in any 1-s window, and no slew violation |
| Rhythm rule | No luminance or motion component above 1 Hz on screen except point twinkle ≤ 2 Hz and the heartbeat case, at every A.4 preset |
| Palette | The ΔE2000 script reproduces §13.5 (minimum ≥ 10.9 at Y 0.35) and every co-displayed tint pair ≥ 10 (§13.6); red-ratio limits met; any palette edit reruns it |
| Picking | Every keyboard site and 1,000 random clicks resolve to the §6 dermatome and nerve; no ray from any view returns S4–S5, a perineal site or the pelvic-floor field |
| Packet order | Drawn arrival order equals the §4 analytic order in every §12 scenario |
| Switch fades | Ghost reached within the §13.15 fade ± 0.05 s; no packet survives on a cut edge after 0.3 s |
| Point budgets | Drawn counts per tier match §13.4; the ENS close-up buffer never raises the total above the tier total |

### 13.18. Open questions

- The chromaticity-substitution tints (§13.6) change how the four DOPAMINE.md tints render. Should DOPAMINE.md §8.1 adopt the change, or should the orgasm scenario keep additive tints whose rendered contrast is ΔE2000 1.7–6.4 against untinted stars, with GABA and opioid only 7.2 apart?
- Every network swatch and tint set collapses under simulated dichromacy (ΔE2000 0.1–3.4 for swatches). Is redundant coding enough, or should Settings offer a CVD palette mode?
- The body zoom exponent γ_body = 1 and the §13.3 luminance targets are design values. They need rendered calibration across tiers, displays and exposure.
- Should torso sections become superellipses (exponent ≈ 2.5–3, §2.16)? That would correct the chest wall by ≈ 15 mm, and the §2.7 sites would have to be re-snapped.
- Skeleton: keep it off by default, or redesign the rib hints (fewer, jittered) so they can stay on in the Upper body view?
- Limb motion: are the A.8 #22 rigid motions legible at scenario clock rates, or should the figure show muscle haze only?
- Heart: whole-cluster beat at ≤ 8 %, or only the conduction sequence on small points?
- Canvas packet labels are off by default. Are they needed in limb close-ups?
- Digit picking: are digit capsules plus the keyboard list enough, or is a finer hand mesh needed for median, ulnar and radial territories?
- The orgasm pelvic-marker rule (schematic, non-rhythmic, ≤ 0.5 per s, rate and speed not to scale) is a content choice. It needs the user's confirmation that it may amend DOPAMINE.md §10 rule 7 ("adds nothing below the brainstem except the A11 beam") with the §11.18 wording; until then the streams keep their resting display.
- The full texts of Harding et al. 2005 and Fisher et al. 2005 were not read, only their abstracts. Wilkins 1995 and the CIEDE2000 origin paper are [recalled].
- The lazy-build slice, the ultra-tier body generation time and the display CPU budget are unmeasured.
- Should the flash area and window shrink on touch devices, which are viewed at about 30–40 cm? The §13.15 bound may be reduced at runtime, never enlarged.
- The tint changes of this round (orexin to 126°, the hypothalamic default set, neutral brain-side target glows) need the ΔE2000 script rerun on the final shader colours.

### 13.19. Sources

Peer-reviewed

- Fisher RS, Harding G, Erba G, Barkley GL, Wilkins A 2005. Photic- and pattern-induced seizures: a review for the Epilepsy Foundation of America Working Group. *Epilepsia* 46:1426–1441. [unverified: abstract read]
- Fisher RS, Wilkins A, et al. 2026. Visually-provoked seizures: consensus of the Epilepsy Foundation Working Group. *Epilepsia* 67:565–581, doi 10.1111/epi.18702. Avoid static or oscillating stripes of ≈ 1–8 cycles per degree and bright flashing at 10–20 Hz. [unverified: cited from the fact-check; not read]
- Harding G, Wilkins AJ, Erba G, Barkley GL, Fisher RS 2005. Photic- and pattern-induced seizures: expert consensus of the Epilepsy Foundation of America Working Group. *Epilepsia* 46:1423–1425. [unverified: abstract read]
- Lund CC, Browder NC 1944. The estimation of areas of burns. *Surg Gynecol Obstet* 79:352–358. (bibliography checked; shares as on standard charts)
- Luo MR, Cui G, Rigg B 2001. The development of the CIE 2000 colour-difference formula: CIEDE2000. *Color Res Appl* 26:340–350. [recalled]
- Machado GM, Oliveira MM, Fernandes LAF 2009. A physiologically-based model for simulation of color vision deficiency. *IEEE Trans Vis Comput Graph* 15:1291–1298. (matrices used as a model check)
- Ohno Y 2014. Practical use and calculation of CCT and Duv. *LEUKOS* 10:47–55 (online 2013).
- Sharma G, Wu W, Dalal EN 2005. The CIEDE2000 color-difference formula: implementation notes, supplementary test data, and mathematical observations. *Color Res Appl* 30:21–30. (the implementation reproduces their test pair 1)

Books [T]

- Harding GFA, Jeavons PM 1994. *Photosensitive Epilepsy*. Mac Keith Press.
- Wilkins AJ 1995. *Visual Stress*. Oxford University Press. [recalled]

Standards and specifications

- W3C 2023. Web Content Accessibility Guidelines 2.2: SC 2.3.1 Three Flashes or Below Threshold; SC 2.5.8 Target Size (Minimum); glossary entries for general and red flash thresholds and relative luminance.
- Ottosson B 2020. OKLab colour space (web publication; used only to report chroma and hue). [T]

Raw captures (`brain-system/raw/`)

- [G Dermatome_anatomy L87–L88]: S3 ischial point; S4–S5 perianal band.
- [G Interstitial_cell_of_Cajal L58–L63]: slow-wave rates used in the rhythm-rule examples.
- [G Somatosensory_system L48]; [G Postcentral_gyrus L39]: somatotopy and homunculus for the touch overlay.
- [G Pupillary_response L23]: pupil range covered by the iris ring.
- [G Startle_response L39]: rostrocaudal startle cascade, the worst-case limiter load.

Project files

- `brain-system/src/renderer.js` L34, L108–L118; `src/shaders.js` L16–L19, L30, L36–L49, L59–L63, L75, L93–L94, L122; `src/camera.js` L44, L111, L136–L144; `src/main.js` L33–L37, L46–L48, L86, L159, L162, L192, L210; `src/performance.js` L8–L13; `src/color.js` L28–L48; `src/dopamine.js` L82–L86; `src/brain.js` L62, L119; `src/ui.js` L76–L79, L404–L446, L552–L554; `index.html` L11, L94, L151–L195, L214–L215; `style.css` L67.
- `brain-system/research/DOPAMINE.md` §7.4, §8.1, §8.2, §8.5, §8.6, §9.2, §10.

Model checks (not sources): `C:\Users\User\AppData\Local\Temp\claude\C--Users-User-projects-galaxy\641a402d-336b-4b93-bc5d-2e26265edfd2\scratchpad\research-body-geometry-design\` `s13merge.mjs`, `s13merge2.mjs` (palette comparison and search), `s13final.mjs` (palette metrics, camera scales, heart size, flash area, rib frequency, budgets), `s13tints.mjs` (additive tints as rendered), with `lib13.mjs`; and `...\scratchpad\research-visual-hud\modtint.mjs` (substitution tints, rerun with the orexin hue at 120°).

---

## 14. Sources

### 14.1. Citation rules

- Each section's own Sources subsection is authoritative for that section; §14 indexes those lists and adds nothing they lack. The tags follow §1.9.
- Peer-reviewed works appear alphabetically as Author Year with a species tag where the citing lens stated or the work is unambiguous, and the sections that rely on them (A.7 lens assignment). No journal, title or page details are given, so that none is invented; the citing section holds any verified detail. Entries that no final section cites are removed at assembly.
- Textbook knowledge [T] is listed by claim in each section, not by book, and lowers confidence by one step. Secondary tabulations are listed with their carrier. Raw captures locate claims but never alone support a high-confidence number; their known errors are in §1.11.
- Scratch prototypes in the session scratchpad `research-<lens>` folders are model checks, not sources.

### 14.2. Peer-reviewed literature

**A** Aaronson et al. 1985 (§8); Abell et al. 2008 (H §8); Ackerley et al. 2014 (H §5); Adrian et al. 1985 (H §8); Agostoni et al. 1957 (C §8) [secondary]; Airaksinen et al. 1991 (H §3) [unverified]; Albin, Young & Penney 1989 (§3); Albus 1971 (§3); Alexander, DeLong & Strick 1986 (§3); Andersen, Vinther & Ottesen 2013 (H §9; A.8 #24) [secondary]; Andreasen et al. 2008 (H §10); Andrews, Halpern & Purves 1997 (H §3); Andrews-Hanna et al. 2010 (H §3); Angeli et al. 2018 (H §8); Aston-Jones & Bloom 1981 (R §3); Aston-Jones & Cohen 2005 (§3); Aston-Jones et al. 1994 (Mk §3); Aw et al. 1996 (H §5); Azevedo et al. 2009 (H §1, §3).

**B** Bahney & von Bartheld 2018 (H §6); Baker et al. 1990 and 1991, two papers (H §3, dorsal and median raphe); Baker et al. 2019 (H §8, gut motility); Bandler & Shipley 1994 (§3); Barnes 1986 (§7); Basbaum & Fields 1984 (§5); Bastos et al. 2015 (Mk §3); Bayliss & Starling 1899 (D §8); Beckstead, Morse & Norgren 1980 (Mk §3); Bellville et al. 1979 (H §7) [recalled]; Benarroch 1993 (§7); Benedek & Kaernbach 2011 (H §7); Bengel et al. 2001 (H §7); Benson et al. 1986 (H §5); Bergamin & Kardon 2003 (H §5, §7); Berger, Saul & Cohen 1989 (D §3, §4, §7); Berthoud & Powley 1992 (R §8); Bertini, Bianchi & Ghezzi 1988 (Ms §10); Blakemore, Wolpert & Frith 1998 (H §4); Blumenthal et al. 2005 (H §5); Bluthé et al. 1994 (R §10); Borbély 1982 (§3); Borovikova et al. 2000 (R §10); Borst & Karemaker 1983 (H §4, §7); Borst et al. 1982 (H §7); Boyd & Kalu 1979 (C §4) [secondary]; Boynton et al. 1996 (H §3); Braddom & Johnson 1974 (H §6); Bragard, Chen & Plaghki 1996 (H §4); Bratton et al. 2012 (R §10; A.8 #16); Bravo et al. 2011 (Ms §8); Bremer 1935 (C §1; A.8 #5) [unverified]; Brener, Hendrix & McHugh 1983 (H §8); Brett, Johnsrude & Owen 2002 (§2); Brodoehl, Witte & Klingner 2016 (H §2); Brookes 2001 (GP §8) [recalled].

**C** Campbell, Gooden & Horowitz 1975 (H §7); Carandini & Heeger 2012 (§4); Caterina et al. 1997, 1999 (R §5); Cavanagh & Komi 1979 (H §4, §11); Chandrashekar et al. 2010 (Ms §5); Chaudhry & Cornblath 1992 (H §6); Cole & Sedgwick 1992 (H §6); Colebatch & Halmagyi 1992 (H §5); Copeland et al. 2005 (H §10, §12); Craig 2002, 2009 (§3, §5, §7, §8); Cruccu et al. 2008 (H §3, §5); Cryer 1980 (H §7); Cummings et al. 1987 (H §8, colonic fermentation); Cummings et al. 2001 (H §8, ghrelin); Curcio et al. 1990; Curcio & Allen 1990 (H §5); Cypess et al. 2009 (H §7); Czeisler et al. 1999 (H §3).

**D** Daan, Beersma & Borbély 1984 (H §3); Dalton 2000 (H §5); Dampney 1994 (§7); Dantzer et al. 2008 (§10); Davis et al. 1982 (R §1, §5, §6); Davis & Whalen 2001 (§3); de Boer, Karemaker & Strackee 1987 (H §4); Deacon et al. 1995 (H §8); Del Negro, Funk & Feldman 2018 (§3); DeLong 1971 (Mk §3); Destexhe, Rudolph & Paré 2003 (§4); Di Russo et al. 2002 (H §5); Diamant & Bortoff 1969 (D §8); Dickerson & Kemeny 2004 (H §4, §9, §11); Dimitrijevic, Gerasimenko & Pinter 1998 (H §6); Dimitrova et al. 2002 (H §3); Dinning et al. 2014 (H §8); Ditunno et al. 2004 (H §6, §7); Dodgson 2004 (H §2); Drillis & Contini 1966 (H §2; A.2) [secondary]; DuBois & DuBois 1916 (H §2); Dumoulin et al. 2000 (H §3, §5).

**E–F** Eckberg 1983 (H §7); Eickhoff et al. 2006 (H §3, §5); Eisenhofer et al. 1997 (H §8); Elashoff, Reedy & Meyer 1982 (H §8); Ellis 1981 (H §5, §7); Ewing et al. 1978 (H §7); Fagius & Wallin 1980 (H §5, §7); Falco et al. 1992 (H §6); Feinstein et al. 1955 (H §6); Felleman & Van Essen 1991 (Mk §3); Ferguson et al. 2008 (§9); Fernández & Goldberg 1971 (SM §1, §5) [unverified]; Fischer & Boch 1983 (Mk §5); Fisher et al. 2026 (H §13) [unverified]; Foote, Aston-Jones & Bloom 1980 (§3); Fowler, Griffiths & de Groat 2008 (§7); Fox et al. 2005 (H §3); Freeman 2008; Freeman et al. 2011 (H §7); Frijns et al. 1997 (H §6); Friston 2005 (§4); Frostell et al. 2016 (H §6); Fuller et al. 2011 (§3); Furness 2012; Furness et al. 2014 (§8).

**G** Gamlin et al. 2007 (Mk §5); García-Gomar et al. 2019 (H §5); Gentet, Stuart & Clements 2000 (§4); Georgopoulos et al. 1986 (Mk §4); German et al. 1988 (H §3); Gershon & Tack 2007 (H §1, §8) [unverified]; Gilbey et al. 1984 (§7); Gilmor et al. 1999 (H §3); Glick et al. 1984 (H §8); Glover 1999 (H §3); Goldberg & Fernández 1971 (SM §5); Goodale & Milner 1992 (§3); Gooden 1994 (H §7); Gottfried & Zald 2005 (H §5); Grabherr et al. 2008 (H §5); Graham & Clifton 1966 (§7); Greenwood 1990 (H §5); Gribble & Reimann 2016 (§8); Gupta et al. 2007 (— §9; A.8 #24); Guyenet 2006 (§7); Guyenet & Bayliss 2015 (§3).

**H** Hall & McCloskey 1983 (H §5); Hardman et al. 2002 (H §3) [unverified]; Hartline & Ratliff 1957 (§4); Hecht et al. 1937; Hecht, Shlaer & Pirenne 1942 (H §5); Heeger 1992 (C §4); Henneman 1957 (C §6); Hodgkin & Huxley 1952 (Sq §4); Hoeks & Levelt 1993 (H §3, §7); Humphrey & Williamson 2001 (§7); Hunt & Stubbs 1975 (H §8); Hursh 1939 (C §1, §4).

**J–K** Jacobs & Fornal 1999 (C §3); Jacobson & Sapolsky 1991 (§3); Jankovski, Plaghki & Mouraux 2013 (H §5); Jansen & Lipsitz 1995 (H §7); Johansson & Birznieks 2004 (H §4); Johansson & Vallbo 1979 (H §5); John et al. 2013 (§3); Johnson & Phillips 1981 (H §5); Jonas et al. 1992 (H §5, §6); Jørgensen et al. 2000 (H §8); Jose & Collison 1970 (H §7; A.8 #11); Joshi et al. 2016 (Mk §3, §7); Kaelberer et al. 2018 (Ms §8); Kahrilas et al. 2015 (H §8); Kakigi & Shibasaki 1991 (H §11); Kanwisher et al. 1997 (H §5); Karjalainen & Viitasalo 1986 (H §10, §11); Katz & Miledi 1965 (frog §4); Keay & Bandler 2001 (§3); Kellow et al. 1986 (H §8); Kelly & Strick 2003 (Mk §3); Kent et al. 1972 (§7) [secondary]; Keren et al. 2009 (H §3); Keuken et al. 2014 (H §3); Kimura 1973 (H §5, §6); Kirschbaum, Pirke & Hellhammer 1993 (H §11); Ko et al. 2004 (H §6); Kobal & Hummel 1988 (H §5); Kobayakawa et al. 1999 (H §5) [unverified]; Komisaruk et al. 2004 (H §11); Koren et al. 2021 (Ms §10); Krassioukov et al. 2009 (H §6, §7); Krogh, Mosdal & Laurberg 2000 (H §8); Kuffler 1953 (C §4).

**L** La Rovere et al. 2008 (H §7); Ladabaum et al. 2001 (H §8); Lassek & Rasmussen 1939 (H §3, §6); Lassek 1940 (H §6) [unverified]; Laude et al. 2004 (H §7); LeDoux 2000 (§3); Lee & Tatton 1975 (H §5); Lee, Hassani & Jones 2005 (R §3); Lemon 2008 (§6); Levy 1971 (D §7); Liddle et al. 1985 (H §8); Liégeois-Chauvel et al. 1994 (H §5); Loewenstein & Mendelson 1965 (C §5); Löken et al. 2009 (H §5); Lu et al. 2006 (R §3); Lund & Browder 1944 (H §2).

**M** Malnic et al. 2004 (H §5); Maresh et al. 2008 (H §5); Marr 1969 (§3); Marsden, Merton & Morton 1976 (H §5); Matteoli et al. 2014 (Ms §8); Matthews 1991 (§6); McCormick & Bal 1997 (§3); McKemy et al. 2002 (§5); Melzack & Wall 1965 (§5); Mendell 1966 (C §5); Méndez-Bértolo et al. 2016 (H §3); Menon & Uddin 2010 (§3); Mesulam et al. 1983 (§3); Metcalf et al. 1987 (H §8); Michie et al. 1988 (H §10); Mileykovskiy, Kiyashchenko & Siegel 2005 (R §3); Minami & McCallum 1984 (§8); Minassian et al. 2004 (H §6); Mittal et al. 1995 (H §8); Miura et al. 2002 (H §6); Morosan et al. 2001 (H §3, §5); Morrison & Nakamura 2011, 2019 (§3, §7); Mouton et al. 1994 (H §1, §3) [unverified]; Muller et al. 2014 (Ms §8); Murphy et al. 2014 (H §3).

**N–O** Nakamura & Morrison 2008 (R §5); Nambu et al. 2000; Nambu, Tokuno & Takada 2002 (Mk §3); Namer et al. 2008 (H §5); Norcliffe-Kaufmann et al. 2018 (H §7); O'Grady et al. 2010 (H §8); Odom et al. 2016 (H §3); Olausson et al. 2002 (H §5); Olshausen & Field 1996 (§4); Öngür & Price 2000 (§3); Ouyang, Sunshine & Reynolds 1989 (H §8).

**P–R** Palmiter 2018 (§3); Park & Blanke 2019 (H §3, §5); Paus 1996 (H §3); Peier et al. 2002 (§5); Perry, Oehler & Cowey 1984 (Mk §5); Potts, Shi & Raven 1993 (H §7); Prechtl & Powley 1990 (R §8); Quirk, Repa & LeDoux 1995 (R §3); Rae et al. 1998 (H §8) [secondary]; Raichle et al. 2001 (H §3); Rao & Ballard 1999 (§3, §4); Rao et al. 2000; Rao et al. 2002 (H §8); Raphan, Matsuo & Cohen 1979 (Mk §1, §5); Rauschecker & Tian 2000 (Mk §5); Read 1967 (H §7); Rebollo et al. 2018 (H §8); Rexed 1952 (C §6); Richardson et al. 1977 (H §8); Rodieck 1965 (C §4); Rolke et al. 2006 (H §5); Rosas-Ballina et al. 2008, 2011 (Ms §10; A.8 #16); Rosenblueth & Simeone 1934 (§7); Ross et al. 2010 (Ms §5); Rossini et al. 2015 (H §6); Rowell 1974 (H §7); Rushton 1951 (§4).

**S** Sabatini & Regehr 1996 (R §4); Sanders, Koh & Ward 2006; Sanders, Ward & Koh 2014 (§8); Sandrini et al. 2005 (H §5, §6); Saper, Chou & Scammell 2001; Saper, Scammell & Lu 2005; Saper, Romanovsky & Scammell 2012; Saper & Lowell 2014 (§3, §10); Sarosiek et al. 2010 (H §8); Schmelz et al. 1997 (H §5); Schmidt et al. 1995 (H §5); Schmolesky et al. 1998 (Mk §3, §5); Schneider, Richter & Kastner 2004 (H §3); Schultz 1998 (Mk §5); Schumann & Amaral 2005 (H §3); Schwarzacher, Rüb & Deller 2011 (H §1, §3); Seeley et al. 2007 (H §3); Sehic & Blatteis 1996 (GP §10); Sender, Fuchs & Milo 2016 (H §8); Servan-Schreiber, Printz & Cohen 1990 (§4); Sessler 2008 (H §7); Shahani et al. 1984 (H §7); Sherman & Guillery 2002 (§3); Singh et al. 2020 (H §3); Sitek et al. 2019 (H §3); Smit et al. 1999 (H §7); Smith et al. 1981 (R §8); Smith et al. 1991 (R §1, §3, §7); Smyth, Sleight & Pickering 1969 (H §7); Soffer & Adrian 1992 (§8); Spoendlin & Schrott 1989 (H §5, §6); Sprangers et al. 1991 (H §11); Srinivasan, Laughlin & Dubs 1982 (§4); Sridharan, Levitin & Menon 2008 (H §3); Stanghellini et al. 1983 (H §8); Steiner 1973 (H §5); Steriade, McCormick & Sejnowski 1993 (§3); Stevens 1957 (H §4, §5); Story et al. 2003 (§5); Sudo et al. 2004 (Ms §8); Sun & Chen 2007 (Ms §5); Swanson & Sawchenko 1983 (R §3); Szurszewski 1981 (§8).

**T–U** Taché et al. 2001 (R §8); Tack et al. 2006 (H §8); Takahashi, Lin & Sakai 2006 (Ms §3); Tanaka, Monahan & Seals 2001 (H §7); Taruno et al. 2013 (Ms §5); Teff 2011 (H §8); Teghtsoonian 1971 (§5); Thach 1968 (Mk §3); Thannickal et al. 2000; Thannickal, Lai & Siegel 2007 (H §3); Tipton 1989 (H §7); Todd 2010 (§5); Tomasch 1969 (H §3); Tougas et al. 2000 (H §8); Tracey 2002, 2007, 2009 (§10); Treede et al. 2003 (H §3, §5); Trendelenburg 1917 (GP §8); Tu et al. 2018 (§5); Uddin, Yeo & Spreng 2019 (§3); Ungerleider & Mishkin 1982 (Mk §3); Ursino 1998 (§7; A.8 #14) [recalled].

**V–Z** Vallbo & Johansson 1984 (H §5); Van Boven & Johnson 1994 (H §5); Van Horn, Erişir & Sherman 2000 (C §3); van Kerkoerle et al. 2014 (Mk §3); van Marken Lichtenbelt et al. 2009 (H §7); Vantrappen et al. 1977, 1979 (H §8); Veldhuizen et al. 2011 (H §5); Verrillo 1963 (H §5); Vila et al. 2007 (H §7); Virtanen et al. 2009 (H §7); Walker, Terry & Lightman 2010 (R §9; A.8 #24); Walker et al. 2012 (R §9); Wang et al. 2003 (Ms §10); Wang et al. 2015 (H §8); Warner & Cox 1962 (D §4, §7); Weinstein 1968 (H §2, §5); West & Gundersen 1990 (H §3); Westerman & Smith 1984 (Gb §5); Wieling et al. 2007 (H §7, §11); Willer 1977 (H §5, §6); Wilson & Cowan 1972 (§4); Yano et al. 2015 (Ms §8); Yates 1992 (§5); Yeo et al. 2011 (H §3); Yousry et al. 1997 (H §3, §6); Zaborszky et al. 2008 (H §3); Zagorodnyuk & Brookes 2000 (GP §8); zu Eulenburg et al. 2012 (H §3, §5).

### 14.3. Secondary tabulations

| Value from | Carried by | Used in |
|---|---|---|
| Andersen, Vinther & Ottesen 2013; Caruso (fitted HPA gains, saturation constants, Hill exponents) | 2023 review arXiv:2311.04570, Table 2 (unit column internally inconsistent) | §9; A.8 #24 |
| Agostoni et al. 1957 (vagal afferent fraction) | Prechtl & Powley 1990 | §8 |
| Drillis & Contini 1966 (segment height fractions) | Winter, *Biomechanics and Motor Control of Human Movement* | §2; A.2 |
| Kent et al. 1972 (baroreflex logistic); EuroBaVar data (Laude et al. 2004) | Heusser et al. 2021 | §7 |
| Borst & Karemaker 1983 (vagal and sympathetic heart-rate delays) | Karemaker & de Boer 2017; de Boer & Karemaker 2019 | §4 |
| Boyd & Kalu 1979 (velocity–diameter factor) | Arbuthnott et al. (PMC1274542) | §4 |
| Moon & Spencer 1944 (pupil diameter) | Watson & Yellott 2012 | §5 |
| Rae et al. 1998 (colonic slow waves) | Reviews (PMC4508510; Frontiers in Physiology 2015) | §8 |
| Ursino 1998 (model structure) | Kana 2018 (arXiv:1901.05071); ICCS 2024 re-implementation | §7 |

### 14.4. Textbooks, handbooks, atlases and standards

- **Textbooks and monographs:** Gray's Anatomy (1918 edition); Kandel et al., *Principles of Neural Science*; Moore, *Clinically Oriented Anatomy*; Winter, *Biomechanics and Motor Control of Human Movement*; Kendall, McCreary & Provance, *Muscles: Testing and Function*; Furness 2006, *The Enteric Nervous System*; Mathias & Bannister, *Autonomic Failure*; Stevens 1975, *Psychophysics*; Stein & Meredith 1993 (multisensory integration, C); Eckberg & Sleight 1992 (human baroreflexes); Harding & Jeavons 1994 (photosensitive epilepsy); Loewenfeld (the pupil; edition not checked); Dawson, Schell & Filion 2007 (chapter, *Handbook of Psychophysiology*).
- **Atlases:** Naidich et al. 2009 (Duvernoy's atlas of the human brain stem and cerebellum); Paxinos & Huang 1995 (human brainstem).
- **Standards and guidelines:** W3C WCAG 2.2 (SC 2.3.1, whose text is unchanged from 2.1; SC 2.3.2; SC 2.5.8, which exists only in 2.2), and ITC/Ofcom guidance on flashing images and regular patterns (both as in DOPAMINE.md §11.4); ASIA ISNCSCI and ISAFSCI standards (via Krassioukov et al. 2009); Semmes–Weinstein monofilament norms; Gordon et al. 2014, ANSUR II anthropometric survey (technical report; numbers not verified in its tables). Guideline papers already listed in §14.2: Abell et al. 2008, Blumenthal et al. 2005, Cruccu et al. 2008, Freeman et al. 2011, Kahrilas et al. 2015, Odom et al. 2016, Rao et al. 2002, Rossini et al. 2015.

### 14.5. Sources identified by venue or without a year

- Venue only: Afr J Neurol Sci 2022 normative blink-reflex study (§6); Brain Pathology 2025, doi 10.1111/bpa.70011, PPN stereology, n = 4 (§3); Frontiers in Physiology 2020 heart-transplant review (fphys.2020.579449) and ESC Heart Failure 2021 review (§7); Frontiers in Physiology 2021 simulated-dive data (§7); Korean normative sympathetic skin response study 2009 (§7); Paraplegia 1986 follow-up study (§8); MMC variability study, PubMed 1563314 (§8); ISBS proceedings critique of Drillis & Contini (§2).
- Without a year (to be completed or downgraded to [T]): Hensel, thermoreceptor static curves (§5); Rossi et al., Leone et al., Qiu et al., spinothalamic velocity (§4); Mizoguchi et al., gustatory latency (§5); Bassotti, colonic motility (§8).

### 14.6. Raw captures

All 137 captures in `brain-system/raw/` were made for this work; each section's Sources subsection gives the lines it used.

| Group | Stems | Main section |
|---|---|---|
| Neurons, membranes, conduction (11) | Action_potential, Biological_neuron_model, Cable_theory, Group_A_nerve_fiber, Group_C_nerve_fiber, Hodgkin_E2_80_93Huxley_model, Myelin, Nerve_conduction_velocity, Neuron, Neurotransmitter, Synapse | §4 |
| Coding and psychophysics (8) | Lateral_inhibition, Neural_adaptation, Neural_coding, Predictive_coding, Receptive_field, Stevens_27s_power_law, Temporal_difference_learning, Weber_E2_80_93Fechner_law | §4, §5 |
| Overviews (5) | Central_nervous_system, Human_body, Human_brain, Nervous_system, Peripheral_nervous_system | §1, §2 |
| Brain structures (22) | Amygdala, Basal_forebrain, Basal_ganglia, Brainstem, Cerebellum, Cerebral_cortex, Hippocampus, Hypothalamus, Insular_cortex, Large-scale_brain_network, Limbic_system, Locus_coeruleus, Medial_preoptic_nucleus, Motor_cortex, Paraventricular_nucleus_of_hypothalamus, Postcentral_gyrus, Raphe_nuclei, Respiratory_center, Reticular_formation, Striatum, Suprachiasmatic_nucleus, Thalamus | §3 |
| Dopamine and neuromodulation (14) | Autoreceptor, Dopamine, Dopamine_receptor, Dopamine_transporter, Dopaminergic_pathways, Incertohypothalamic_pathway, Mesocortical_pathway, Neuromodulation, Nigrostriatal_pathway, Reward_system, Substantia_nigra, Tuberoinfundibular_pathway, Ventral_tegmental_area, Volume_transmission | DOPAMINE.md; §3 |
| Sensory systems (20) | Auditory_cortex, Auditory_system, Cochlea, Dorsal_column_E2_80_93medial_lemniscus_pa, Interoception, Mechanoreceptor, Nociception, Olfactory_system, Pain, Proprioception, Retina, Sensory_nervous_system, Sensory_neuron, Somatosensory_system, Spinothalamic_tract, Taste, Thermoreceptor, Vestibular_system, Visual_cortex, Visual_system | §5 |
| Somatic system and reflexes (22) | Brachial_plexus, Central_pattern_generator, Corticospinal_tract, Cranial_nerves, Dermatome_anatomy, Golgi_tendon_organ, Lumbar_plexus, Motor_neuron, Muscle_spindle, Neuromuscular_junction, Phrenic_nerve, Pudendal_nerve, Reflex_arc, Sacral_plexus, Sciatic_nerve, Somatic_nervous_system, Spinal_cord, Spinal_cord_injury, Spinal_nerve, Startle_response, Stretch_reflex, Withdrawal_reflex | §6 |
| Autonomic system (15) | Autonomic_nervous_system, Baroreflex, Dysautonomia, Fight-or-flight_response, Heart_rate, Parasympathetic_nervous_system, Pelvic_splanchnic_nerves, Pupillary_light_reflex, Pupillary_response, Sympathectomy, Sympathetic_nervous_system, Sympathetic_trunk, Thermoregulation, Vagotomy, Vagus_nerve | §7 |
| Enteric system (6) | Enteric_nervous_system, Gut_E2_80_93brain_axis, Hirschsprung_27s_disease, Interstitial_cell_of_Cajal, Myenteric_plexus, Submucosal_plexus | §8 |
| Neuroendocrine (9) | Adrenaline, Adrenocorticotropic_hormone, Corticotropin-releasing_hormone, Cortisol, Hypothalamic_E2_80_93pituitary_E2_80_93ad, Hypothalamic_E2_80_93pituitary_E2_80_93th, Neuroendocrinology, Sympathoadrenal_system, Vasopressin | §9 |
| Neuroimmune (5) | Cytokine, Fever, Inflammatory_reflex, Neuroimmune_system, Sickness_behavior | §10 |

Stems omit the prefix `en_wikipedia_org_api_rest_v1_page_html_` and `.md`. `_E2_80_93` encodes an en dash and `_27` an apostrophe. Long stems are truncated: `…_ad` and `…_th` are the hypothalamic–pituitary–adrenal and hypothalamic–pituitary–thyroid axes, and `Dorsal_column_E2_80_93medial_lemniscus_pa` is the dorsal column–medial lemniscus pathway. `Volume_transmission` resolves to the Neuromodulation article and duplicates its text; `Temporal_difference_learning` holds no subject content (DOPAMINE.md §2.5).

Earlier captures: `brain-system/raw/` holds 11 physiology captures (Human_sexual_response_cycle, Mesolimbic_pathway, Nucleus_accumbens, Orgasm, Oxytocin, Periaqueductal_gray, Prolactin, Refractory_period_sex, Sex_flush, Sexual_arousal, Vasocongestion). They are used through DOPAMINE.md §11.1 and `RESPONSE.md` §11 and cited with a folder prefix. The same folder holds 4 astrophysics captures (Active_galactic_nucleus, Astrophysical_jet, Barred_spiral_galaxy, Messier_87). `anger-galaxy/raw/` holds 10 captures (Anger, Density_wave_theory, Diffraction_spike, Galaxy_rotation_curve, H_II_region, Initial_mass_function, Ring_galaxy, Spiral_galaxy, Starburst_galaxy, Stellar_classification), the rendering heritage of `anger-galaxy/research/ANALYSIS.md`. Neither the astrophysics nor the anger captures are physiological sources.

### 14.7. Project documents and code

`brain-system/research/DOPAMINE.md` (canonical for dopamine; its §11 sources cover every dopamine value cited here); `RESPONSE.md` (canonical response model §7.4–§7.9; its §11 sources); `anger-galaxy/research/ANALYSIS.md` (rendering heritage); `brain-system/README.md`, `brain-system/index.html` and `brain-system/src/*.js`, cited by file and line where a section reconciles with code (§11); `graphify-out/graph.json`, used to locate captures.

### 14.8. Open questions

- The lens lists conflict on the year of the corticospinal axon count (Lassek & Rasmussen 1939 or 1940); §3 and §6 must agree on one citation.
- "Baker et al." names two different author groups (raphe counts 1990–1991; gut motility 2019), and "Cummings et al." names two (1987, 2001); the citing sections should add a distinguishing detail once verified.
- Venue-only and undated entries (§14.5) need full author–year citations or downgrading to [T].
- Full texts are unread for every entry tagged [unverified], [recalled] or [secondary]. Whether to add DOI or PMID identifiers once entries are verified is undecided.

---

## Appendix A. Framework contract

This appendix is binding for every section of `brain-system/research/ANALYSIS.md`. If a section disagrees with it, this appendix wins until the contract itself is revised. `research/DOPAMINE.md` stays canonical for every dopamine quantity and for the orgasm scenario's internals, so ANALYSIS.md cites it and never restates or changes those values. Document date: 2026-10-31.

### A.1 Conventions

| Topic | Rule |
|---|---|
| Language | English only. British spelling (colour, centre, oesophagus, haemodynamic), as in DOPAMINE.md. Tone is clinical, scientific and non-explicit. |
| Headings | `## N. Title` and `### N.M. Title`, numbered and in sentence case. Content follows a heading directly: no subtitle, tagline or one-line summary under any heading. |
| Numbers | Use tables for numbers, not prose. Prose explains mechanisms and decisions and cites table rows by section (§7.4). Each number is defined in exactly one section (see A.7). Every other section references that section and does not restate the number. A short inline restatement is allowed only when followed by its owner reference, e.g. "IHR ≈ 101 bpm (§7.5)". |
| Quantity table columns | `Quantity · Value · Unit · Species · Conf. · Source`. Coordinate tables: `Structure · id · Position (x, y, z) mm · Extent mm · Frame · Conf. · Source`. |
| Evidence tags | **Author Year** for peer-reviewed work ("A & B Year"; three or more authors "A et al. Year"). **[T]** for textbook knowledge, which lowers confidence by one step. **[G file Lx]** for a raw capture: file stem without the `en_wikipedia_org_api_rest_v1_page_html_` prefix, folder `brain-system/raw/` unless prefixed (e.g. [G Oxytocin L73]). **[model]** for a design or calibration choice of this project. Modifiers: **[recalled]** (value from memory, not checked against the original), **[secondary]** (taken from a secondary tabulation, e.g. "Andersen et al. 2013 via arXiv:2311.04570") and **[unverified]** (full text not read). A value tagged [recalled] or [secondary] is at most low confidence unless an independent source agrees. Never invent a citation: if unsure, write [T] and lower the confidence. |
| Species tags | **H** human, **Mk** macaque, **SM** squirrel monkey, **R** rat, **Ms** mouse, **C** cat, **D** dog, **GP** guinea pig, **Gb** gerbil, **Sq** squid, **—** model choice. Every quantity carries a species tag. |
| Confidence | **high** (replicated direct measurement), **medium** (one line of evidence or indirect), **low** (estimate, extrapolation, design choice or contested). These are the DOPAMINE.md definitions. |
| Notation | En dash for ranges (18–23), "≈" for approximate, Unicode minus "−" in numbers, "× 10ⁿ" for powers, comma thousands (86,000). Code identifiers and file paths in backticks. Cross-references: "§7.4" within ANALYSIS.md, "DOPAMINE.md §6.4", "`src/anatomy.js` L321". |
| Units | SI with mm, ms, s, min, h, mmHg, bpm, °C, dB SPL, cd/m², µS, pg/mL, µg/dL, pM. The kernel uses seconds for time, mm for length and m/s for velocity. Because m/s = mm/ms, delay in ms = L_mm / v_mps. |
| Content rules | No genital structures. Pelvic anatomy appears only as schematic nerves and plexuses, bladder, rectum and an unlabelled pelvic-floor field. The pudendal nerve ends at the perineal midline. The S4–S5 perianal band, perineal sites and the pelvic-floor field are never pickable from any view; `dermatome.S3` is pickable only from posterior views (§13.12). The orgasm scenario is described only clinically and by reference to DOPAMINE.md. |
| Open questions | Every section ends with `### N.last. Open questions` (bullets), listing unverified values and decisions that need data. |

### A.2 Coordinate frames

| Item | Fixed value |
|---|---|
| Brain frame | MNI-152 mm. Origin ≈ anterior commissure; x right, y anterior, z superior (right-handed). Bilateral structures are listed for the right side; mirror x for the left. `mid: true` / x = 0 marks single midline structures. |
| Body frame | **Identical to the brain frame**: same origin, axes and mm. No transform exists between brain and body. Existing `anatomy.js` coordinates, after the DOPAMINE.md §7.3 port, map unchanged, and brain-only mode renders exactly as the post-port build (the DOPAMINE.md §9.8 port, applied in Phase 0a, B.15) apart from the additions listed in §3 and §13. |
| Scene scale | `MM = 0.01` render units per mm (1 unit = 100 mm). The figure spans z +0.88 to −16.72 units. |
| Head | MNI-scale, not rescaled (≈ 5–10 % larger than a native head; accepted). Scalp vertex (0, −20, +88). Head soft-tissue envelope is in §2. |
| Body | Standing anatomical position: palms forward, thumbs lateral, feet slightly apart (≈ 60 mm between the medial borders, §2.6), head in MNI orientation. Model stature **1,760 mm** vertex to sole (native-equivalent 1,745 mm). Floor plane **z = −1,672**. Height above floor h = z + 1,672. |
| Landmarks below the chin | z = f · 1,760 − 1,672, with Drillis & Contini (1966) height fractions (shoulder .818, elbow .630, wrist .485, fingertip .377, trochanter .530, knee .285, ankle .039). |
| Brain–body boundary | Cervicomedullary junction **(0, −45, −72)** (DOPAMINE.md §2.4). Everything above it is CNS ("brain"). The existing `BRAINSTEM` tube continues to (0, −46, −88) and is drawn as today, but functionally it is upper cord. Structures are assigned whole to one side, never split by the plane: `spV` (drawn to z −70, standing for the caudal nucleus that reaches C2) is `cns` and computed in brain-only mode; `n11` (C1–C5), `phrenicNuc` and the C1–C2 roots are body, so XI has no brain-only form and its commands end at `portCranMotor`. The plane is a rendering and ownership convention, not a cut through any node. |
| Spinal cord | Continues from the tube end along the §2 canal centreline. Conus tip **(0, −63, −499)** (L1–L2 vertebrae). Drawn length 435 mm along the curve (≈ 450 in adult men [G Spinal_cord L45]; 3 % short, accepted). Dural sac ends at S2 (z −676). |
| Left/right | Left-sided organs (stomach, spleen, descending colon, left lung, heart apex) have negative x. |
| Posture of organs | Standing approximations (1–5 cm lower than supine atlases). Physiological posture is a state variable (`posture`); drawn geometry does not change with it. |
| Precision | 1 mm for body points, 0.5 mm for brainstem nuclei. Body coordinates carry ±20–40 mm unless stated otherwise. |
| Local coordinates | Spline routes: `pathId` and arc parameter **u ∈ [0, 1]**, with u = 0 at the CNS end and u = 1 at the peripheral end (afferent packets move 1 → 0). Gut: in-vivo arc length **s** in cm from the upper oesophageal sphincter (owner §8.2), the only coordinate the gut model uses; the drawn arc length **`sDraw`** (cm, owner §2.9) is mapped from s by the §2.9 breakpoint table. Cord cross-section: **(ξ, η)**, with ξ = x / transverse radius and η = AP offset / AP radius (+ anterior). Spinal level: segment label (C1…Co1) distinct from vertebral label (vertebra C1…S5). |
| Coordinate precedence (where lenses disagree) | 1. `src/anatomy.js` entries as revised by the DOPAMINE.md §7.3 port, which Phase 0a applies first (B.15) (never moved further; only split as listed in §3). 2. Body: the body-geometry lens tables (landmarks, vertebrae, cord segments, exits/DRG, organs, sense organs, joints, dermatome points, great vessels, ganglia, named-nerve waypoints). Exception: gut-tube centrelines and radii come from the enteric lens (it must clear solid organs within ±20 mm). Somatic-lens waypoints are used only for nerves absent from the body-geometry list, re-snapped to its exits and joints. 3. Brain: the brain-systems lens table; then the domain lens for structures it lacks (cranial nerve motor nuclei and attachments: somatic lens; sensory relays: sensory lens; Barrington, SSN, ISN, MnPO, CeA: autonomic lens). The neuroendocrine-immune lens's body coordinates are **rejected** (wrong scale: adrenals at z −1030), and its brain coordinates yield to the above. |

Fixed anchors (owner §2 or §3): vertex (0, −20, 88); eye globe centre (±33, 60, −38), corneal apex (±33, 72, −38); cochlea (±39, −22, −45); heart centre (−22, 15, −352); SA node (30, 0, −312); carotid bifurcation (±25, 5, −120); adrenals R (42, −42, −447), L (−38, −36, −448); spleen (−108, −55, −458); coeliac ganglia (±18, −10, −470); index fingertip (±258, −15, −1000); hip centre (±88, −10, −732); knee (±80, −32, −1170).

### A.3 Naming

#### A.3.1 Networks, layers and switches

| id | HUD label | Meaning |
|---|---|---|
| `bodyMode` | Brain only / Whole body | Master switch: `'brain'` or `'body'`. |
| `somatic` | Somatic | Spinal and trigeminal GSA afferents (touch, pain, temperature, proprioception), α and γ motor neurons, cranial GSE/SVE motor (III, IV, VI, V motor, VII motor, IX/X branchiomotor via `nAmbMotor`, XI, XII), phrenic and intercostal output, somatic cord tracts and spinal motor circuits incl. CPG interneurons. |
| `autonomic` | Autonomic | Extrinsic sympathetic and parasympathetic outflow (IML T1–L2, sacral S2–S4, EW/III, SSN/VII, ISN/IX, `nAmbVagal`/`dmv`/X, all ganglia and postganglionics, bulbospinal premotor axons) plus all visceral afferents (vagal and glossopharyngeal incl. baro- and chemoreceptors; spinal visceral afferents and their ascending relays). |
| `enteric` | Enteric | Myenteric and submucosal plexuses. |
| `neuroendocrine` | Neuroendocrine | Hypophyseal portal transport, pituitary and adrenal hormone release and action, posterior pituitary release, RAAS, the distant (blood-borne) actions of gut hormones, HPT/HPG scalars. |
| `neuroimmune` | Neuroimmune | All immune–nervous coupling in both directions, fever set-point shift, sickness behaviour. |
| `cns` | — | Brain above the junction. Always simulated; never switched. |
| `special` | — | Special-sense afferents (I, II, VIII, gustatory VII/IX/X). Always on, in both modes. |
| `tissue` | — | Non-neural body: SA node, ICC, muscle, organs, blood, kidney, peripheral immune cells. Runs whenever `bodyMode = 'body'`; never switched. |

Sub-network ids (used for ownership, edge tags and interventions; **not** HUD switches): `som.aff`, `som.motor`, `som.tract`; `ans.symp`, `ans.para`, `ans.vaff`; `ens.myenteric`, `ens.submucosal`; `ne.hpa`, `ne.sam`, `ne.post`, `ne.raas`, `ne.gut`, `ne.scalar`; `ni.route`, `ni.reflex`, `ni.fever`, `ni.sickness`.

#### A.3.2 Node and edge types

Node `kind` ∈ `receptor`, `ganglion`, `segment`, `nucleus`, `area` (cortical patch), `port` (brain-side boundary), `effector`, `organ`, `gland`, `pool` (volume- or blood-borne quantity), `oscillator`.
Edge `kind` ∈ `axon` (peripheral, with fibre class), `tract` (CNS bundle), `portal`, `blood` (humoral), `volume`.
Fibre class ids: `Ia`, `Ib`, `II`, `Abeta`, `Adelta`, `C`, `CT`, `Cmi` (itch), `Agamma`, `Aalpha` (α-motor), `B`, `Cpost`, `cns`.
Ids are camelCase ASCII. A sided instance is `id.R` / `id.L`; midline nodes have no suffix. Sub-parts use dots (`cord.C7.dh`, `gut.antrum`). The ids below may be extended following these patterns, but never renamed.

#### A.3.3 Main node ids

| Group | ids |
|---|---|
| Existing brain (unchanged) | `REGION_IDS` of `anatomy.js`; NUCLEI `thalamus caudate putamen nacc amygdala hippocampus hypothalamus mpoa pvn arcuate pituitary stalk zonaIncerta pag rmtg dentate`; DA groups per DOPAMINE.md. Splits: `pallidum` → `gpe` + `gpi`; `raphe` tube → `dr mnr rmg rpa rob`; `pituitary` → `pituitaryAnt` (y > −2) + `pituitaryPost` (y ≤ −2). |
| Thalamus | `thalAnt thalMD thalVA thalVL thalVPL thalVPM thalVPMpc thalVMpo thalCM thalPulv thalRet lgn mgn` |
| Basal ganglia, forebrain, limbic | `stn snr vp nbm msdb hdb bnst habenula cea` |
| Hypothalamus, CVOs | `scn son vlpo lh tmn dmh vmh mammillary mnpo ovlt sfo areaPostrema medianEminence pineal` |
| Brainstem | `lc ppn ldt pbn pno pnc gi mrf vestNuc ntsGust ntsVisc dmv nAmbMotor nAmbVagal rvlm cvlm preBotC rtn io gracile cuneate spV prV mesV motV cochNuc soc ic sc opn ew n3 n4 n6 n7m n12 ssn isn barrington redNucleus pontineNuc fastigial interposed flocculus nodulus olfBulb olfTubercle` (`nts` = `ntsGust` ∪ `ntsVisc`) |
| Cortical areas (an `area` attribute on existing cortical stars, not new regions) | `v1 v4 mt ffa a1 pt s1 m1` (somatotopic sub-sites `.face .hand .trunk .leg .foot`), `ba3a ba2 sma preSma pmd pmv fef s2 pivc insPost insMid insAnt gust areaG piriform ofcOlf dlpfc ips ppc angular tpj pcc precuneus mpfc dacc sgacc pgacc entorhinal parahipp rsc` |
| Brain ports (afferent) | `portDC portSTT portTrig portVisc portGust portSpinoVisc portCVO portVest portCoch portRetina portOlf` |
| Brain ports (efferent) | `portCST portRS portCranMotor portSymp portVag portPara portSacral portPortal portNeurohyp portImmune` |
| Cord | `cord.C1 … cord.Co1`; parts `.dh .vh .iml` (T1–L2) `.spn` (S2–S4) `.clarke` (T1–L2); `phrenicNuc` (C3–C5), `n11` (C1–C5), `cpgL` (L1–L2), `onuf` (S2) |
| Spinal nerves, DRG | `sn.C1 … sn.Co1`, `drg.C1 … drg.Co1` |
| Somatic nerves | `plexusCervical plexusBrachial plexusLumbar plexusSacral phrenic axillary musculocutaneous radial median ulnar intercostal.T1…T11 subcostal femoral saphenous obturator sciatic tibial commonFibular pudendal` |
| Cranial nerves | `cn1 … cn12` with components `cnN.som`, `.motor`, `.para`, `.aff` (visceral), `.special` (e.g. `cn7.motor`, `cn7.para`, `cn7.special`, `cn10.aff`, `cn10.para`); `vagus` ≡ `cn10` |
| Autonomic | `scg mcg stellate chain.T1…T12 chain.L1…L4 chain.S1…S4 impar cardiacPlexus coeliac smg img aorticorenal supHypogastric infHypogastric splanchnicGreater splanchnicLesser splanchnicLeast splanchnicLumbar splanchnicPelvic ciliaryGang pterygopalatineGang oticGang submandibularGang nodoseGang carotidSinusNerve splenicNerve` |
| Receptor and stimulus sites | `retina cochlea vestLabyrinth olfEpith tongueAnt tonguePost carotidSinus carotidBody aorticArch lungStretch stomachWall duodenum colonRectum bladder`; skin sites `dermatome.C2 … dermatome.S3`, `indexTip palm forearmDorsal footSole heel bigToe umbilicus foreheadV1 cheekV2 chinV3`; tendons `bicepsTendon tricepsTendon patellarTendon achillesTendon`; joints `shoulder elbow wrist finger hip knee ankle` |
| Effectors and organs | `saNode avNode heart ventricles lungs airways diaphragm intercostalMuscles pupilSphincter pupilDilator lacrimal parotid submandibularGland sublingual sweatPalm sweatSole sweatForehead sweatAxilla skinVessels muscleVessels splanchnicVessels bat adrenalCortex adrenalMedulla thyroid liver spleen splenicTcells pancreas kidney bladder rectum macrophages`; muscles `biceps triceps deltoid forearmFlexors forearmExtensors quadriceps hamstrings gastrocSoleus tibialisAnt adductors glutealMax rectusAbdominis erectorSpinae sternocleidomastoid trapezius masseter orbicularisOculi stapedius extraocular pelvicFloor` |
| Gut | `gut.oes gut.les gut.fundus gut.corpus gut.antrum gut.pylorus gut.duod gut.jej gut.ileum gut.icv gut.caecum gut.colAsc gut.colTrans gut.colDesc gut.sigmoid gut.rectum gut.ias gut.eas`; cells indexed `gut[i]` by s; enteroendocrine `ecCells iCells lCells xaCells mCells gCells` |

#### A.3.4 State variables (canonical names, units, owner)

| Group (owner) | Variables (unit) |
|---|---|
| Global (§11) | `tH` human time (s); `tS` screen time (s); `kh` (human s per screen s); `bodyMode`; `net.<id>` (bool); `g.<id>` ramped network gain (0–1); `posture` (supine/upright); `age` (y, default 30) |
| Brain (§3) | `r.<node>` (Hz); `a.<node>` (0–1, = r/rmax); `modNE modACh mod5HT modHA modOX` (relative, wake = 1); DA variables as named in DOPAMINE.md; `arousalState` (wakeAlert, wakeRelaxed, n1, n2, n3, rem); `procS` (0–1); `procC` (−1…1); `salience` (0–1); `predErr`; `lcPhasic` (0–1) |
| Perception (§5) | `psi` perceived magnitude (a.u.); `rec.<site>` receptor population rate (Hz) |
| Cardiorespiratory (§7) | `hr` (bpm); `hp` heart period (s); `sbp dbp map pp` (mmHg); `co` (L/min); `sv` (mL); `tpr` (mmHg·min/L); `contractility` (1 = rest); `rr` respiratory rate (breaths/min, as in `response.js`); `vt` (L); `ve` (L/min); `respPhase` (0–1); `paco2 pao2` (mmHg) |
| Autonomic channels (§7) | `fSymCard fSymMus fSymSpl fSymSkin fSudo.<site> fSymAdr fSymBat fSymPup fSymGut fVagCard fVagGut fEw fSal fSacral` (spikes/s); normalised `tone.<channel>` = f/f_max (0–1) for cross-network readers |
| Other autonomic effectors (§7) | `pupilD.L pupilD.R` (mm); `scl scr` (µS); `tCore tSkin` (°C); `tSet` (°C; baseline §7, fever shift §10); `sweat` (L/h); `sbf` skin blood flow (L/min); `bat` (0–1); `bladderVol` (mL) |
| Somatic (§6) | `emg.<muscle>` (0–1); `force.<muscle>` (0–1); `joint.<joint>` (deg); `diaphragmExc` (mm); `shiver` (0–1); `reflexGain` (relative) |
| Gut (§8) | `swPhase[i]` (rad); `gutX[i]` (0–1); `gutC[i]` (0–1); `gastricSolid` (kcal); `gastricLiquid` (mL); `emptyRate` (kcal/min); `colon[3]` (relative); `mmcPhase` (1, 2, 3); `fed` (bool); `satiety hunger` (0–1); `rectalVol` (mL); `vagMech vagChem spinNoci` (Hz); `cck glp1 pyy` (pM); `ghrelin motilin gastrin insulin ec5ht` (relative) |
| Endocrine (§9) | display units below; the kernel carries each as a ratio to basal (`crhRel`, `acthRel`, `cortisolRel`, `adrenalineRel`, …; basal 1; §9.4, §11.13): `crh` (pg/mL); `acth` (pg/mL); `cortisol` (µg/dL, plasma total); `adrenaline noradrenalinePl` (pg/mL); `avp oxytocin` (pg/mL); `prolactin` (ng/mL); `raas` (relative); `hpt hpg` (relative scalars) |
| Immune (§10) | `lps` (ng/kg-equivalent); `tnf il1b il6 il10` (pg/mL); `pge2` (relative); `sickness.<c>` (0–1) for c ∈ lethargy, mood, anxiety, malaise, anorexia, sleepiness, hyperalgesia, grooming, concentration |

`response.js` keeps its internal names. §11 maps them (`sys`/`dia` → `sbp`/`dbp`, `tHuman` → `tH`).

#### A.3.5 Scenarios

| id | HUD label | Owner of inputs | Brain-only |
|---|---|---|---|
| `hotObject` | Touching a hot object | §12 | unavailable (greyed) |
| `loudSound` | Sudden loud sound | §12 | central form |
| `brightLight` | Bright light | §12 | central form (no pupil) |
| `kneeJerk` | Knee jerk | §12 | unavailable |
| `standUp` | Standing up | §12 | unavailable |
| `meal` | Eating a meal | §12 | unavailable |
| `stressor` | Acute stressor | §12 | central form (no cortisol) |
| `infection` | Infection and fever | §12 | unavailable |
| `orgasm` | Orgasm – dopamine | DOPAMINE.md; adapter §11 | central form |
| optional | `valsalva` Valsalva manoeuvre, `coldFace` Cold face immersion, `sleepSound` Sound during sleep | §12 (brief) | per scenario |

### A.4 Clocks and time scales

| Name | Definition |
|---|---|
| `tH` | Human (physiological) time in s. Every model input and output is a function of tH only. |
| `tS` | Screen time in s. Photosensitivity limits are stated in tS. |
| `kh` | Clock rate in human s per screen s (the `response.js` convention). Range **0.005–3,600**. HUD shows `t 23.0 ms  ×1/100` (×1/n when kh < 1, ×n when kh > 1). |
| Presets | `reflex` ×1/100 · `pain` ×1/10 · `autonomic` ×1 · `gut` ×10 · `endocrine` ×60 · `immune` ×900 · `circadian` ×3,600 |
| Owner | One clock (`src/clock.js`) owns kh. Sources, in priority order: user lock › scenario delegate (the orgasm scenario's own clock, §11.14) › scenario keyframes › adaptive rule. Slew ≤ 1 decade per screen s in log space (a LogRamp; log-time playback emerges from this). While the orgasm delegate holds the clock, kh follows that clock verbatim, including ramps steeper than 1 decade per s, the instant switch into ONSET or `inevitability` and recovery values above 3,600 (§11.14). |
| Adaptive rule (manual stimuli) | Each click opens an **episode**. Before onset, an approach phase of log₁₀(k₀/k₁) screen s (≈ 1.7 s from ×1 to ×0.02) lowers kh; tOnset = tH_now + H_desc(kh_now, k₁) (§11.7, §11.9). Target = minimum over active layers: **leading** packets (§11.8) in flight on **extracerebral** edges ≥ 50 mm give clamp(min transit / 2.5 s, 0.005, 1) — counting sustained trains and intracerebral packets as well holds kh at its 0.005 floor, so that 200 screen s advance only 26.9 human s instead of 116.7 (§11.7); breath-averaged cardiac or evoked skin-conductance transients give 1 (§11.7); any neuroendocrine pool away from its current target gives 60 (§11.7); immune active gives 900. Scheduled stimuli less than 2.5 screen s ahead pull kh down in advance. |
| Invariants | Velocities are never rescaled per fibre class. Step sizes never depend on kh. If the CPU budget is exceeded, the kernel stops at a step boundary and the clock commits the time reached (time slicing, §11.7), which lowers the effective kh; the step size never changes. While a scenario delegate holds the clock, `commit` is a no-op and the kernel lags the delegate's tH, carrying the backlog (§11.7, §11.14, B.6). |

Kernel layers (owner §11; fixed grids, deterministic, seeded `mulberry32` per layer):

| Layer | Step | Contents |
|---|---|---|
| `EV` | exact event times | Volley packets; delay = Σ L/v + n_syn · t_syn; ties broken by (t, edgeId, seq) |
| `NF` | 0.5 ms | Fast neural rate graph (brain, cord, reflexes), receptors, muscle activation. History ring per source of 0.5 ms × up to 8,192 samples (4.096 s, §11.6). Strides to the next 1 s boundary when idle (state-driven, not kh-driven). |
| `CV` | 10 ms | Heart, vessels, baroreflex, respiration, pupil, skin conductance, modulator pools; RSA, drive noise and MSNA bursts are seeded analytic overlays (§11.6) |
| `GI` | 100 ms | Enteric reflex kernels and contraction filters. Slow-wave phase is analytic in tH. Transit compartments update at 1 s inside this layer. |
| `EN` | 1 s | Hormones, RAAS, thermoregulation |
| `IM` | 10 s | Cytokines, PGE2, set point |
| `CR` | 60 s | Circadian process C and sleep pressure S |

### A.5 Network switch semantics

Rules common to all switches:
- Each edge carries `nets` (a set). The predicate has three cases (§11.3 rule 2): an edge with a non-empty `nets` runs only if `bodyMode = 'body'` and **all** listed networks are on; an edge carrying the **body flag** (a `tissue` edge, or any edge with a body-side endpoint) runs only in whole-body mode; every remaining edge — `cns` and `special`, which have `nets = []` — always runs, so the CNS and the special-sense injection keep working in brain-only mode. Reading the first case as if it applied to `nets = []` as well would stop the whole CNS in brain-only mode, contradicting the Master row below.
- Switching ramps `g.<net>` between 0 and 1 over 1.0 s of tH (the master switch is a step, since all g are 0 in brain-only mode); efferent gains act at the effector, after the dead time (§11.10, which records the conduction/effector split that choice simplifies). The display ghost follows g.<net>(tH), rate-limited so that it never changes faster than the §13.15 fade t_fade (≥ 0.8 s tS); a network is drawn fully off only when g = 0. Ghost = 8 % flux, fully desaturated.
- "Off" removes drive. States relax by their own kinetics to the off-state: intrinsic behaviour for neural targets (denervation), basal values for blood hormones (replacement, never zero).
- Brain nodes always keep computing their commands, shown as tints and as "efference only" packets that fade at the port.
- In-flight packets on cut edges fade out.
- The master switch freezes and hides the body: nothing integrates while it is hidden, so a scenario interrupted by brain-only mode is not resumed. Body states reset to the resting steady state when the body is switched back on, taken from the §11.10 cache keyed by `(switch set, age, posture, fed, time of day at return)`.
- Brain-systems toggles in the HUD are display overlays only; brain simulation is never switched.
- Switch sets compose by the edge mask alone: with several networks off, every edge listing any of them stops, and the per-network consequence rows of this table, §5–§10 and §12.14 are read multiplicatively. Several switch rules are not edge masks, however (the hormone clamp h = g·h_cmd + (1 − g), the pupil mix, the antral g.enteric·(a + b·g.autonomic)), so the multiplicative reading is a property the §12.21 composition tests must assert for the 10 pairs, not an identity. A row's consequence may become vacuous under composition (for example, "shivering absent" adds nothing once `tSet` is flat, and "the splenic branch is unaffected" holds only while `autonomic` is on). §12.14 lists single-switch outcomes; multi-switch outcomes are derived, not tabulated, and the headless tests assert that all 32 switch sets reach a bounded steady state (§11.16; §12.21).

| Switch off | What turns off | What keeps running autonomously | What compensates or emerges | Readouts |
|---|---|---|---|---|
| **Master → Brain only** | Every body node and edge: cord below z −72, PNS, ganglia, organs, blood, immune tissue. All non-special afferent ports go silent. All efferent ports end as efference only. | All CNS: rate graph, arousal state machine, SCN, preBötC (fictive), RVLM tonic drive, PVN/pituitary commands, modulators, dopamine model. Special senses are injected at the first central station (retina/optic nerve start, `olfBulb`, `cochNuc`, `vestNuc`, `ntsGust`); sense organs are not drawn. | None. Blood-borne inputs to the brain are clamped at basal (life-support assumption: cortisol basal, tCore 37.0, paco2 40, pao2 95). NTS baseline drive falls; somatic and visceral thalamic relays receive nothing. | Body vitals "—" |
| **Somatic** | Spinal and trigeminal GSA afferents; α and γ motor neurons; cranial GSE/SVE motor (eye movements, jaw, face incl. blink and stapedius, pharynx and larynx, XI, XII); phrenic and intercostal output; somatic cord tracts and spinal CPG. All somatic reflexes. | Special senses; preBötC rhythm; motor commands in M1, PnC and others (efference only); autonomic, enteric, endocrine and immune networks. | Ventilation maintained at the central rhythm with clamped gases (model assumption). Central RSA persists [model]. No shivering, so fever relies on vasoconstriction and BAT. Standing up becomes a passive tilt. Startle reduces to autonomic signs. Body-surface touch, pain, temperature and proprioception produce no central or autonomic response at all. | EMG/force 0; "ventilation maintained (model assumption)" |
| **Autonomic** | All sympathetic and parasympathetic preganglionic and postganglionic outflow (incl. adrenal medulla drive); all visceral afferents, so baroreflex and peripheral chemoreflex loops open and interoception stimuli produce nothing central. | SA node at IHR(age) (§7), still temperature-sensitive; myogenic vascular tone; ENS (peristalsis, local reflexes, small-bowel MMC uncoordinated with the stomach); HPA through blood; central CO₂ chemoreception (RTN is CNS), which alone regulates ventilation and holds resting PaCO₂ within ±2 mmHg of 40 (§7.9; HUD "central chemoreflex only"); respiratory rhythm. | Pupils fixed at the denervated diameter, no light reflex. RAAS keeps only its **non-neural** renin share (≈ 40 %: macula densa and renal baroreceptor, §7.15); the sympathetic ≈ 60 % goes with the autonomic switch, and that remaining share partly restores BP over minutes. Orthostatic and postprandial hypotension; on standing it is severe, with upright MAP in the syncopal range (§12.9); the model does not simulate loss of consciousness. No SCR, salivation, lacrimation, RSA, BAT, cephalic phase, vagal satiety or inflammatory reflex, so TNF is higher. | HR flat at intrinsic, tagged "intrinsic" |
| **Enteric** | Myenteric and submucosal neurons: peristaltic reflex, MMC, secretomotor reflexes, tonic inhibition, rectoanal inhibitory reflex. | ICC slow waves (non-neural) with weak non-propagated contractions; enteroendocrine release; extrinsic nerves (vagal motor effective only on striated oesophagus; vagal mechanosensitivity ×0.5). | Sphincters closed (LES, pylorus, ileocaecal valve, IAS). Gastric emptying falls to the §8.8 5 % floor and transit stalls — an extreme-case model of ENS loss, pylorospasm and achalasia-like, by design [model]; Hirschsprung disease is segmental distal aganglionosis and is not the analogue (the stomach is not aganglionic in it), so no single disease is claimed. Shown quietly. Gut branch of the inflammatory reflex fails. | Motility index ≈ 0 |
| **Neuroendocrine** | Portal transport, pituitary release to blood, posterior pituitary release, adrenal cortical and medullary hormone action, RAAS/AVP pressor actions, distant actions of gut hormones, HPT/HPG scalars. | Hypothalamic neurosecretory neurons compute commands (tints); all neural networks; paracrine actions within the gut wall. | Blood hormones relax to basal and are clamped there. No cortisol or adrenaline surge. No RAAS rescue. No cortisol brake on cytokines. Orgasm scenario: prolactin and oxytocin clamped, TIDA loop frozen. | Hormones tagged "basal" |
| **Neuroimmune** | Immune → brain (vagal immune afferent, CVO/humoral route, endothelial PGE2 → `mnpo`, cytokine → PVN). Brain → immune (inflammatory reflex, sympathetic lymphoid action, glucocorticoid action on immune cells). Fever shift; sickness behaviour. | Peripheral innate response at the challenge site (`tissue`); tSet stays 37.0. | Cytokines higher and more prolonged (both brakes lost). No fever, no fever tachycardia, no sickness behaviour. HPA not activated by infection. | Cytokines shown; tSet flat |

Cross-network AND edges (an edge needs every listed network): adrenal adrenaline **release** `autonomic ∧ neuroendocrine` (its β1 **receptor effect** on the heart is `neuroendocrine` alone, because a denervated target still responds to circulating adrenaline, §7.5, §11.13); inflammatory-reflex efferent and vagal immune sensing `autonomic ∧ neuroimmune`; cortisol on immune cells `neuroendocrine ∧ neuroimmune`; cytokine → PVN `neuroimmune` (its hormonal output also needs `neuroendocrine`); vagal motor to gut smooth muscle and secretion `autonomic ∧ enteric`; gut branch of the inflammatory reflex `autonomic ∧ enteric ∧ neuroimmune`; baroreceptor-driven AVP `autonomic ∧ neuroendocrine`; cephalic phase `special ∧ autonomic` (insulin action also needs `neuroendocrine`); fever effectors: vasoconstriction and BAT `autonomic`, shivering `somatic`, set point `neuroimmune`; pupillary light reflex `special ∧ autonomic`; startle motor `special ∧ somatic`; startle autonomic signs `special ∧ autonomic`.

Interventions (owner §11 for semantics; one preset at a time; each removes specific nodes or edges and lets the rest respond; separate from switches): §6 spinal cord injury (level C2/C4/C6/T1/T6/T10/L2/S2 × complete/Brown-Séquard/central/anterior × phase), named peripheral nerve section with day slider, dorsal rhizotomy. §7 heart transplant, atropine, truncal vagotomy, T2–T3 sympathectomy (stellate option), pure autonomic failure. §9 adrenalectomy, hypophysectomy. §10 splenic denervation, vagus nerve stimulation (slider).

### A.6 Sensory modalities and stimulus parameters

Fixed order and ids: `vision`, `hearing`, `touch`, `pain` (incl. itch), `temperature`, `smell`, `taste`, `balance`, `proprioception`, `interoception`. A stimulus record is `{sense, mode, site, side, intensity, unit, durationMs, tOnset}`.

One receptor model serves all modes: a physical stimulus drives every receptor class whose threshold it exceeds, whatever sense was picked (e.g. 55 °C drives thermoreceptors and nociceptors). Ranges and markers below are defaults; §5 owns their final values and sources.

| Sense | Modes | Parameter (unit): range, default | Markers | Valid sites |
|---|---|---|---|---|
| vision | flash, step | luminance (log₁₀ cd/m²): −6…+5, +3; duration (ms) 10–2,000 | scotopic threshold −6 | eye L/R/both |
| hearing | click, tone, noise | level (dB SPL): 0–130, 70; tone frequency (Hz) 125–8,000, 1,000; rise (ms) 0.5–20, 5 | stapedius ≈ 85, startle ≈ 90, pain 130 | ear L/R/both |
| touch | press, vibration, stroke | force (mN, log): 0.1–10,000, 50; vibration (Hz) 5–400, 250; stroke velocity (cm/s) 0.3–30, 3 | fingertip threshold ≈ 0.7 mN; CT optimum 1–10 cm/s | skin |
| pain | heat, cold, pinprick, pressure, itch | heat (°C) 45–60, 50; cold (°C) 0–15, 5; pinprick (mN) 8–512, 256; pressure (kPa) 100–800, 500; itch (relative) 0–1, 0.5 | heat pain 43–47 °C; cold pain 5–15 °C; pressure pain 300–500 kPa | skin |
| temperature | warm, cool | contact temperature (°C) 15–45, 40 (warm) / 25 (cool); ramp (°C/s) 0.5–5, 1; skin baseline 32 °C | detection +1–2 / −0.5–1 °C | skin |
| smell | odour | concentration (log₁₀ × threshold) 0–8, 2; class food/neutral/aversive | trigeminal co-activation > 4 | nose L/R/both |
| taste | sweet, salty, sour, bitter, umami | concentration (× threshold) 0–100, 10 | 1 = threshold | tongue anterior/posterior, L/R |
| balance | rotation, linear, tilt | peak angular velocity (deg/s) 0–300, 60, axis yaw/pitch/roll; linear (m/s²) 0–10, 1; tilt (deg) 0–30 | yaw threshold 0.5–1.5 deg/s | head (both labyrinths). The camera never moves. |
| proprioception | imposedMovement, tendonTap | movement (deg) 0–30, 5 at (deg/s) 1–100, 10; tap stretch (mm) 0.5–5, 2 | joint threshold 0.5–1 deg proximal | joints, tendons |
| interoception | baroStep, lungInflation, gastricDistension, duodenalLipid, colorectalDistension, bladderFill, co2 | baroStep (mmHg) −40…+40, +20; lungs (L) 0–3, 1; gastric (mL) 0–400, 200; duodenal lipid (kcal) 0–100, 30; colorectal (mL) 0–300, 100; bladder (mL) 0–600, 300; ΔPaCO₂ (mmHg) 0–20, 5 | sensation thresholds per §5 | organs (ray hits organ volumes, not skin) |

Brain-only mode offers vision, hearing, smell, taste and balance only. Audio is never played.

### A.7 Outline: contents, owned numbers, cross-references

Lens sources: brain-systems → §3; signal-processing → §4; sensory → §5; somatic-motor → §6; autonomic → §7; enteric → §8; neuroendocrine-immune → §9, §10; body-geometry-design → §2, §13; simulation-architecture → §11, §12. Every section reads A.5 and A.8.

| § | Title | Must contain | Owns (defined only here) | Must cross-reference |
|---|---|---|---|---|
| 1 | Purpose, scope and conventions | Status line and date; the request restated clinically; scope and exclusions; the two modes and five networks in one paragraph each; relation to DOPAMINE.md (canonical for dopamine) and `RESPONSE.md` (canonical response model); conventions (from A.1); reading guide; section numbers citable from `src/`; **corrections to the raw captures** table (Respiratory_center L40 DRG → preBötC is the rhythm generator; Neuromodulation L54 15,000 → LC 22,000–51,000 per LC; serotonin share → ≈ 90–95 % gut, ≈ 1–2 % brain; Vestibular cupula 20 s → afferent ≈ 5 s plus velocity storage ≈ 15 s; Ia 80–120 m/s is cat; Startle < 10 ms is rat; SCN "10,000" and PVN "100,000" are rodent; thalamus volumes have no side basis); content rules | Conventions; corrections table (corrected values cite their owner) | All sections (guide); DOPAMINE.md §1, §10, §11; Appendix A |
| 2 | Frames and the reference body | Frame table; brain–body identity mapping; reference subject; head soft tissue and sense organs; vertebral column; cord geometry (segments, enlargements, conus, cauda equina); exits and DRG; dermatome key points; joints, limb radii, torso loft; solid organs; gut-tube centrelines, radii, pacemaker, Cannon–Böhm point; great vessels; ganglia and plexuses; all nerve waypoints (somatic, cranial extracranial, phrenic, intercostal, vagus, sympathetic chain, splanchnics, schematic pelvic); muscle centres; standard path lengths; tolerances | Every body-frame coordinate and extent; stature 1,760 mm; mass 75 kg; BSA 1.91 m²; cord length, diameters, levels; path lengths | §3 (junction, brain coordinates); §4 (path use); §6 (dermatome assignment, root composition); §7, §8 (organ roles); §13 (rendering, camera) |
| 3 | Brain systems | Thalamocortical system; cortical hierarchy and areas; BG loops (five channels, direct/indirect/hyperdirect); cerebellar loops (forward model, self-touch attenuation); limbic system; hypothalamus as integrator; brainstem centres; ascending modulators; arousal and sleep state machine; salience and large-scale networks (overlay, default off); voluntary action; brain ports; brain-graph node list; MNI coordinate table for all new structures (incl. cranial nerve nuclei and attachments, autonomic and sensory relays, CVOs, cortical areas); neuron counts; firing rates; `anatomy.js` geometry changes after the DOPAMINE.md §7.3 port (splits, the DOPAMINE.md §7.3 insula ribbon, tectal bumps, CVLM, LGN/MGN outside the thalamus ellipsoid) | MNI coordinates of new brain structures; non-DA neuron counts; central firing rates and timing (BG, cerebellum, LC phasic, 5-HT, PPN); T_circ 24.2 h; sleep cycle; process S τ; EEG bands; state modulator table; modulator pool τ; salience parameters; HRF; simple reaction times; amygdala fear latency | DOPAMINE.md §2.4, §5, §6; §4, §5, §6 (motor, CMCT), §7, §9, §10, §11 (ports), §13 (tints, budgets) |
| 4 | Signal processing | Membrane and spike (HH as squid inspector, LIF); synapses; conduction (CV table incl. CNS tracts; temperature and age factors); coding and the limits of rate units; receptive fields and DoG; adaptation filter forms; gain control (Naka–Rushton, normalisation, NE gain); predictive coding and habituation; psychophysical laws; latency method with **model-vs-target table**; delayed-loop stability; three-fidelity formalism; node-class τ; analytic arrival-time overlay | CV table; t_syn; NMJ delay; EMG spread; electromechanical delay; synaptic τ and reversal potentials; HH/LIF parameters; node-class τ; sigmoid θ, κ; rmax; DoG; n; NE gain; τ_pred; loop-stability margins; myelin diameter factor | §2 (paths), §5 (τA, exponents, targets), §6, §7 (loop parameters), §11 (steps, history), §13 (rate rendering) |
| 5 | Sensory systems | Per modality in A.6 order: receptors, transduction, fibre class (→ §4), adaptation, threshold, intensity coding, relay stations with node ids and per-station latency, cortical maps, descending control (gate, PAG–RVM), outputs (→ §6, §7, §9), multisensory SC; brain-only behaviour; habituation/PPI; DA coupling (→ DOPAMINE.md); stimulus parameter table; valid sites | Receptor counts and densities; thresholds; τA per receptor; Stevens exponents; Weber fractions; all sensory and perceptual latencies (SEP, ABR, MGN, A1, LGN/V1/MT/V4, SC, LEP, OERP, gustatory, HEP); two-point thresholds; vibration bands; dark and olfactory adaptation; vestibular thresholds and τ; interoceptive sensation thresholds (bladder, rectal, gastric); slider ranges and markers | §2, §3, §4, §6, §7, §8, §11 (pipeline), §12, §13 (picking) |
| 6 | Somatic nervous system | Functional components and ownership; cord tract map (ξ, η); segment–vertebra rule (→ §2); 31 pairs; plexuses and named nerves (roots, territories, muscles); dermatomes and myotomes; **12-cranial-nerve table** (components, nuclei → §3, owner network per component, axon counts); descending pathways; motor units, NMJ, size principle; reflex circuits and **reflex latency table** (stretch incl. H, Ib, withdrawal and crossed extension, RIII, blink R1/R2, corneal, jaw, VOR, stapedius, startle cascade, M2, Babinski); voluntary command; CPGs (phrenic output, locomotor); respiration-under-somatic-off rule; SCI and denervation presets; which reflexes move the figure | Tract map; cord neuron count; CST counts and decussation; plexus roots; cranial axon counts; motor-unit rates; NMJ quantal data; every somatic reflex latency and threshold (incl. startle threshold); CMCT; diaphragm excursion; locomotor CPG; SCI distribution, phases, gains; denervation timeline | §2, §3, §4, §5, §7 (shared nerves, T6 rule), §11, §12, §13 (motion) |
| 7 | Autonomic nervous system | Definition (ENS separate); anatomy; transmitter/receptor table; central autonomic network; efferent channels; effector dynamics (heart period, vessels, contractility, venous, pupil, sweat, salivary, lacrimal, bladder, BAT, airways); reflexes (baroreflex, chemoreflex, PLR, orthostatic, Valsalva, diving, cardiopulmonary, RSA, defence); respiratory control; thermoregulation; lesion presets; off-behaviour; validation targets | HR 68; BP 115/75; MAP 88; IHR(age); HRmax; vagal and sympathetic delays/τ; baroreflex parameters and BRS; orthostatic values; OH criterion; pupil values (range, baseline 4.0, denervated 5.0, PLR, kernel); SCR/SSR; rr 14; VT; HCVR; chemoreflex dynamics; RSA; tSet 37.0 and thermo thresholds; sweat; skin blood flow; saliva; bladder capacity; diving; defence response; dysreflexia (T6, SBP +20); MSNA rates | §2, §3, §4, §5, §6, §8, §9 (adrenal, AVP, RAAS), §10 (fever, reflex efferent), §11, §12, §13 |
| 8 | Enteric nervous system and gut–brain axis | ENS anatomy and classes; ICC slow waves; electromechanical gate; peristaltic reflex; MMC and fed pattern; oesophagus, LES, TLESR, sphincters; emptying and transit; HAPC; extrinsic innervation and afferent levels; enteroendocrine cells and **gut hormones (secretion, kinetics, targets)**; serotonin; microbiota; cephalic phase; gut–brain routes and central integration; hybrid motility model; ENS-off and autonomic-off behaviour; interoceptive gut stimuli; tests | All ENS and gut numbers incl. hormone kinetics, vagal afferent fraction, MMC, transit, slow waves, cephalic timing, microbiota, 5-HT distribution, model segment resolution | §2, §3, §4, §5, §7, §9, §10, §11, §12 (meal), §13 (envelope mode) |
| 9 | Neuroendocrine network | Parvocellular/magnocellular; portal vs axonal; HPA (delay ODE, pulses, circadian, CAR, GR/MR, drive regimes, optional bistability); SAM (drive → §7, plasma kinetics); posterior pituitary; RAAS; HPT/HPG scalars (no pelvic geometry); prolactin and TIDA (→ DOPAMINE.md); CVOs; actions on the brain (**peptides enter at CVOs; cortisol and thyroid hormones cross the BBB**); gut hormones' central actions (→ §8); blood transport times; lesions; off-semantics; validation | HPA rates, delays, gains; pulse period; CAR; drive regimes; adrenaline t½, onset, adrenaline:noradrenaline ratio; plasma catecholamines; AVP/OT; RAAS τ; basal clamp values; cortisol GABA-A ranges; circulation times | §2, §3, §7, §8, §10, §11, §12 (stressor, infection, orgasm), §13; DOPAMINE.md §5 |
| 10 | Neuroimmune network | Cytokines (identity, mass, potency); peripheral innate model; immune → brain routes with latencies; inflammatory reflex (contested route, α7nAChR); splenic sympathetic action; glucocorticoid brake; fever (set point, EP3, bounds, effectors → §6, §7); sickness behaviour mapped to modifiers of other systems; insula immune encoding; interventions; off-semantics; endotoxaemia validation | Cytokine values; LPS model; route latencies; set-point law, thresholds, ceiling 41–42 °C; Liebermeister slope; brake forms; sickness modifiers; VNS | §2, §3, §6, §7, §8, §9, §11, §12, §13 |
| 11 | Integration: switches and simulation architecture | Ownership model and edge `nets`; full switch table (expanding A.5) and AND table; interventions; graph schema and sizes (≈ 500 nodes, ≈ 1,500 edges); ports (→ §3); kernel layers, striding, determinism; clock (A.4); stimulus pipeline; model-side packet caps; cross-network coupling list (writer → reader); orgasm adapter (with all networks on, identical to the legacy path of the same commit; brain-only = central form); per-region state as a data texture; interface semantics (B.4 holds the module list); CPU budget; headless tests; `graphify update .`; reconciliation with `src/` and DOPAMINE.md (proposed rule-7 amendment pending user confirmation, splits, port order) | Step sizes; kh range, presets, slew, anticipation; CPU budget (≤ 1 ms/frame desktop, ≤ 2 ms low tier); history buffer; packet emission (every 20–50 ms, ≤ 20 /s per edge); graph sizes; RNG rules | §3–§10 (semantics), §12, §13; DOPAMINE.md §6, §9 |
| 12 | Scenarios and validation | Scenario format (id, label, span, inputs(tH), clock keyframes, checkpoints); the nine core scenarios: inputs, staged timeline with node paths, expected readouts **by reference**, keyframes, **switch-off outcome matrix**, brain-only form; optional scenarios; manual-stimulus default behaviour per sense; repetition and habituation; checkpoint table (target → owner, tolerance); orgasm regression requirement | Scenario inputs (hot object 55 °C on right palm and fingers; 105 dB SPL broadband noise 50 ms, rise < 1 ms, both ears; 1,000 cd/m² for 1 s, right eye; patellar tap 2 mm right; active stand supine → upright over 3 s; 600 kcal mixed meal over 10 min after 2 min sight/smell; 15 min psychosocial stressor, pulsatile regime; i.v. endotoxin 2 ng/kg); keyframes; tolerances | §5–§11, §13; DOPAMINE.md §9.6 |
| 13 | Rendering, visual design, HUD, performance and safety | Body SDF and skin sampling (Lund–Browder); non-explicit mannequin; organs, nerves, cord, faint skeleton, enteric mesh; flux ratios; depth attenuation; brain dominance and LOD; point budgets; palette (CCT/Duv tints, afferent/efferent, network swatches, modulator tints with pairwise ΔE2000 ≥ 10, ≤ 4 at once); packet and shimmer display; organ-response display; limb motion; camera presets and limits; picking and site snapping; HUD dropdowns and labels; disclosures (1 star ≈ N, enlarged for legibility, estimates); photosensitivity limiter; reduced motion and keyboard sites; lazy body generation | All visual numbers; point budgets (body 88.5k / 171k / 280.5k / 430k per tier, the dense star model; new brain nuclei a separate buffer of 4.5–5.3 % on top of the neuron budget, ≥ 120 stars each at high tier, ≥ 40 at low); colours; packet σ and gain; fades; camera values; photosensitivity numbers; HUD labels | §2, §3, §11, §12; DOPAMINE.md §8, §10; `performance.js` |
| 14 | Sources | Written by the §1 writer: peer-reviewed (alphabetical, only as cited; no invented details), textbooks, [secondary] tabulations, [G] captures by folder and stem. Scratch prototypes are model checks, not sources. | — | All sections |

HUD dropdowns (owner §13; titles only): **Body** (master and five switches, greyed but remembered in brain-only mode), **Interventions**, **Stimulus**, **Scenarios**, **Time**, **Brain systems** (overlays only), **Vitals** (the existing vitals panel renamed and extended), **Live** (incl. event log), **Dopamine**, **Modulators** (legend incl. NE, ACh, HA, OX tints), **Views**, **Performance**, **Settings**. Default at first load: whole body, all networks on, the orgasm scenario playing in demo mode on the "Dopamine system" view (user decision, 5 November 2026; `?scenario=none` opens at rest on the "Upper body" view).

### A.8 Decisions on disputed points

| # | Decision | Why |
|---|---|---|
| 1 | Body frame as in A.2 (vertex +88, floor −1,672, model stature 1,760 mm, head unscaled). | Brain-only rendering must stay identical. It is the only internally consistent set from vertebrae through organs to camera presets. Other lenses' floors (−1,660 to −1,670) are within ±12 mm and are re-snapped. |
| 2 | Conus at z −499; drawn cord 435 mm along the curve (≈ 450 in adult men [G Spinal_cord L45]; 3 % short, accepted). | Conus level matches [G Spinal_cord L72]. The somatic lens's 473 mm and the simulation lens's −530 are too long. |
| 3 | Five network switches; neuroendocrine and neuroimmune are separate. | Distinct systems and lesions, and the AND gates (cortisol brake, splenic reflex) need them apart. The user wrote "networks". |
| 4 | Lesions live in Interventions, not as sub-switches. | User decision 2 (one switch per network). A lesion removes a node; a switch removes a system. |
| 5 | Special senses are always on and retained in brain-only mode (a partial analogue of the encéphale isolé, Bremer 1935, C). | Retina, optic nerve and olfactory bulb are CNS; hearing, balance and taste, whose receptors and ganglia are peripheral, are kept by design. This keeps brain-only meaningful and keeps the special senses out of the somatic switch. |
| 6 | Cranial nerves are switched by functional component: GSE/SVE/GSA somatic, GVE/GVA autonomic, SSA/SVA special. §6 still describes all twelve. | Honours the user's grouping while keeping each switch physiologically coherent. |
| 7 | Visceral afferents (incl. baro- and chemoreceptors) belong to autonomic. | Agreement across lenses. Interoception therefore requires autonomic. |
| 8 | Respiration: rhythm is CNS; phrenic and intercostal output is somatic; peripheral chemoreceptor afferents are autonomic; RTN is CNS. Somatic off or brain only means "ventilation maintained (model assumption)". | Avoids simulated hypoxia propagating into every network. |
| 9 | Off means denervation for nerves and basal replacement for hormones; the peripheral immune tissue response continues. With autonomic off the adrenal medullary drive is held at basal by that same replacement convention, so plasma adrenaline stays at basal rather than falling. This is a display convention, not physiology: real cord-section patients show roughly 90 % lower resting adrenaline (0.005 against 0.06 ng/mL in quadriplegics [secondary, unverified]). The adrenalectomy and hypophysectomy presets (§11.12) likewise assume glucocorticoid replacement, for the same reason. | Zero cortisol would be an adrenal crisis. The immune response is tissue, not a neural network. |
| 10 | Brain-only vitals show "—"; internal values are clamped at basal. | Displayed numbers would imply a body. |
| 11 | Autonomic-off HR = IHR = 118.1 − 0.57 · age (Jose & Collison 1970, H), ≈ 101 bpm at the default age of 30. | Physiologically correct; tagged "intrinsic" so the rise is not read as activation. |
| 12 | Baseline HR 68, BP 115/75, MAP 88, rr 14 (`response.js`). | Keeps the orgasm calibration. The simulation lens's MAP 93 is recalibrated. |
| 13 | CV defaults (A.9). Ia/Ib 65 m/s (H), not 80–120 (C). | Human reflex timing on the §2 geometry (A.9 checks). |
| 14 | Vagal HR dead time 0.3 s, τ 0.5 s; sympathetic dead time 2.0 s, τ_on 4 s, τ_off 10 s. | Vagal bandwidth must pass RSA at ≈ 0.25 Hz. Ursino τ 1.5 s is [recalled]. Asymmetric sympathetic decay reflects noradrenaline clearance. |
| 15 | Vestibular: cupula/afferent τ 5 s plus velocity storage 15 s. | The capture's 20 s conflates the two (Fernández & Goldberg 1971, SM; Raphan et al. 1979, Mk). |
| 16 | Inflammatory-reflex efferent drawn as DMV → vagus → coeliac ganglion → splenic nerve → ChAT⁺ T cells → α7nAChR (Rosas-Ballina et al. 2011, Ms), marked contested (Bratton et al. 2012, R: no vagal–splenic connection). | Both versions sit under `autonomic ∧ neuroimmune`, so switch behaviour does not depend on which is right. |
| 17 | Cardiac vagal output from `nAmbVagal` (primary) with a minor `dmv` share; human split unknown. | Rat and cat data. |
| 18 | Coordinate precedence as in A.2; neuroendocrine-lens body coordinates rejected. | One geometry owner per frame (§2 body, §3 brain). |
| 19 | Body colours use the CCT/Duv palette; all body colours ≥ 5,500 K; a warm sympathetic hue is rejected; 2,300 K amber is reserved for dopamine. | A warm hue would read as dopamine. User decision 9 sets the lantern colour ≥ 2,200 K. |
| 20 | The body-geometry point budgets win; ENS density increases only in gut close-ups via LOD. | Integrated budget across tiers. |
| 21 | Orgasm scenario: identical traces with all networks on, against the legacy path of the same commit (§11.14). If the body is visible it stays static and neutral. DOPAMINE.md rule 7 already allows the neutral static figure. Schematic, non-rhythmic activity markers on the hypogastric, pelvic-splanchnic and pudendal streams (rate and speed not to scale) need the rule-7 amendment proposed in §11.18, which is pending user confirmation (§13.18); until then the streams keep their resting display. | User decisions 4 and 5. |
| 22 | Minimal rigid limb motion (withdrawal: elbow ≤ 30°, wrist ≤ 20°; knee jerk ≤ 15°; startle ≤ 5°); no trunk or pelvic rhythm; disabled under reduced motion. | Legibility of reflexes. |
| 23 | No audio. Sleep is a state selector plus the optional `sleepSound`. Large-scale networks are an optional overlay, off by default, labelled as functional connectivity. | Safety and scientific honesty. |
| 24 | HPA defaults: Andersen et al. 2013 elimination rates [secondary]; adrenal delay 10 min (Walker et al. 2010, R, a rat model parameter); normalised two-pool ODE with feedback at `pvn` and `pituitaryAnt`, Hill exponent 6 (§9.4); Gupta et al. 2007 bistability is an optional mode. HPG/HPT are scalars only. | Sourced pulsatility; non-explicit rule. |
| 25 | Kernel on fixed grids with state-driven striding; a budget overrun stops the kernel at a step boundary (time slicing), which lowers the effective kh. | Determinism across frame rates and headless tests. |

### A.9 Shared reference values (defaults fixed now; the owner section defines and sources them)

| Quantity | Default | Owner |
|---|---|---|
| Reference subject | A figure without sex characteristics, built on male reference proportions (Drillis & Contini 1966; female proportions not modelled), 30 y, 75 kg, BSA 1.91 m², tCore 37.0 °C | §2, §7 |
| Fibre CV (m/s) | Ia/Ib 65; II 45; Aβ 65 / 50, arm proximal / distal of the wrist, leg above / below the knee; Aδ 15; C 1.0; CT 0.9; Cmi 0.5; Aγ 25; α-motor 55 arm / 50 leg; B 8; Cpost 1.0; visceral afferent C 1.0 (A-fibre baroreceptor 15) | §4 |
| CNS tract CV (m/s) | Dorsal column 55; medial lemniscus 45; lemniscal thalamocortical 35; STT 10 (Aδ-related) / 2.2 (C-related); corticospinal 60; optic 8; LC axons 0.5; bulbospinal autonomic 3; other CNS default 20 (low) | §4 |
| Delays | Synapse 0.6 ms; NMJ 0.7 ms; EMG spread 0.5 ms; electromechanical 30 ms | §4, §6 |
| Standard path lengths (mm; architect's polyline sums over the A.2 waypoints; §2 recomputes and may revise by ≤ 10 %) | index fingertip → C7 DRG 921; wrist → C7 DRG 738; C7 DRG → C7 segment 22; C7 segment → cuneate 100; cuneate → VPL 71; VPL → S1 hand 60; quadriceps (via psoas) → L4 DRG 413; L4 DRG → L4 segment 173; calf → S1 DRG 663; S1 DRG → S1 segment 194; great toe → L5 DRG 1,156; cord junction → conus 435; carotid sinus → NTS 100; SA node → `nAmbVagal` 312; stomach → NTS 502 | §2 |
| Resulting checks with these defaults | N20 (wrist) 18.6 ms; fingertip → S1 22.3 ms; patellar 22.5 ms; Achilles 32.1 ms (EV, §4.11; targets §5, §6.11). §4.11 gives the values on the §2.14 lengths (18.7, 22.3, 23.1, 32.8 ms) | §4 |
| Pupil | Baseline 4.0 mm; autonomic off 5.0 mm fixed | §7 |
| Blood gases when ventilation is maintained | PaCO₂ 40, PaO₂ 95 mmHg | §6, §7 |
| Photosensitivity | flash ceiling ≤ 3 per s per region (tS, the WCAG limit) with a display target of ≤ 2, and every per-source cap set at 2: ≤ 2 packets per s past any bundle point and per limiter window (§13.8); regional low-pass τ ≥ 0.3 s; global τ ≥ 0.5 s; any region larger than the flash area (0.006 sr, ≤ 21,824 CSS px², §13.15) changes by ≤ 10 % of maximum relative luminance per ⅓ s; toggle fade t_fade ≥ 0.8 s (§13.15); heartbeat ≤ 8 % luminance at real rate only when kh ≤ 1 and HR ≤ 150, otherwise rate-coded; vasoconstriction dimming ≤ 15 % with τ ≥ 2 s | §13 |

### A.10 Working rules for writers

- Before reading code or captures, run `graphify query "<question>" --budget 2500` from `C:\Users\User\projects\galaxy`, then read raw files only at the lines the graph points to. When a query comes back thin, read the captures in `brain-system/raw/` directly.
- Scratch scripts go only under the session scratchpad `research-<lens>` folders.
- Cite only sources you can name with confidence. Otherwise write [T] and lower the confidence.

---

## Appendix B. Implementation plan and integration with the current code

### B.1. Scope and ownership

This appendix turns §2–§13 into code: new modules and their interfaces, the change to each existing file in `brain-system/src/`, the GPU data layout, point budgets per tier, timings, HUD fields and controls, the switch, stimulus and scenario user interface, the integration of the orgasm scenario, tests and a phased build order.

It owns only implementation targets tagged [model]: the module and interface list (B.4; §11.16 fixes the semantics), texture formats and sizes, the floor-stratified order of the extra brain buffer, generation and seek slice lengths, element ids, URL parameters, key bindings, readout precision, the event-log length, the episode-end rule and the test layout. Everything else is referenced to its owner:

| Topic | Owner |
|---|---|
| Kernel layers, step sizes, clock range, presets, slew and adaptive rule, CPU budget, packet caps, history buffer, graph schema and sizes, ports, switch and AND semantics, interventions, orgasm adapter semantics, per-region data texture (decision) | A.4, A.5, §11 |
| Scenario format, inputs, spans, clock keyframes, staged timelines, switch-off outcome matrix, manual-stimulus defaults per sense, repetition and habituation, checkpoints and tolerances, orgasm regression requirement | §12 |
| Point budgets, LOD, colours, camera values, picking and site snapping, photosensitivity numbers, HUD labels, disclosures | §13 |
| Body coordinates and standard path lengths | §2 |
| Brain coordinates, splits and new brain geometry | §3 |
| Physiological values | §3–§10 |
| Every dopamine quantity; the orgasm scenario's internals, including its clock regime | DOPAMINE.md |

Cross-references to §2–§13 are given at section level, because the subsection numbers of those sections are not fixed here.

### B.2. Integration principles

1. **One project.** All work happens in `brain-system/`. No new project, build step or framework. Plain ES modules are served as today by `start.bat` (Python `http.server` on 127.0.0.1:8768).
2. **Brain-only rendering stays as the post-port build** (A.2). Phase 0a (B.15) applies the DOPAMINE.md §9.8 port, including its §7.3 geometry and construction details, and records new golden images. From then on the neuron buffer from `generateBrain` (seed 1848) keeps every position and flux bit for bit. Allowed differences:
   - the additions listed in §3 and §13;
   - region relabels for the splits of A.3.3, whose dopamine channels are inherited from the parent region (B.5), so they look unchanged;
   - the move of per-region state from uniform arrays to a texture that carries the same values.
3. **The orgasm traces stay identical** (A.8 #21). With all networks on and the same seeded stream, every `ResponseModel` and `DopamineModel` state variable equals the legacy path of the same commit at every human substep (§11.14): before the DOPAMINE.md §9.8 port, for the same frame-time sequence; from Phase 0a onward, on the DOPAMINE.md §9.3 0.05-s grid, with the golden traces recorded again at the port. §12 states the checkpoint; B.14 holds the harness.
4. **Everything is computed in human time.** Kernel inputs are functions of tH only, on fixed grids (A.4, A.8 #25), so traces do not depend on frame rate or clock rate. The orgasm scenario is the exception until the DOPAMINE.md §9.8 port lands (B.13).
5. **Modules are added, not rewritten.** The kernel, the body and the HUD extensions are new files. Existing files change only at the points listed in B.5. `response.js` and `dopamine.js` keep their equations.
6. **Safety and content rules are enforced by tests**: photosensitivity (A.9, §13), the non-explicit figure (A.1), English only, and no subtitles under HUD headings (B.14).
7. **The knowledge graph is updated after every phase** with `graphify update .` (project `CLAUDE.md`).

### B.3. Current code baseline

| File | Role today | Facts that constrain integration |
|---|---|---|
| `src/main.js` | Entry point, single animation loop | `tick(now)` L166–232. Frame dt clamped at 0.1 s (L167). `model.update(sdt)` advances human time and returns kh (L174). `dopamine.updateVisuals` runs in screen time (L176). `model.onStep` hands every human substep to the dopamine layer (L90). Three views at camera distance 3.0–3.6 units (L45–50); `maxDistance: 7` (L86). The climax dims the HUD and stops auto-orbit, keyed on the phase id `inevitability` (L179–182). HUD refresh every 0.12 s (L208–231); the clock line reads "1 s = …" (L218). `window.__brain` test hook (L160). Generation tier = detected tier + 1 (L66); manual upgrades regenerate the brain (L125–139). |
| `src/response.js` | Sexual-response driver of the dopamine layer | `CLOCK` per phase (L83–86) and `LogRamp` (L88–100). `_enter` switches to ×1 instantly at `inevitability` (L146–147). `update(dt)` takes ceil(human/0.5) substeps per frame (L335–352). The demo script advances in **screen** time (`_demoStimulus`, L173). `Math.random` at L189, L198, L201, L202 and L217, so runs are not reproducible. `vitals()` is algebraic: HR 68 rising to 125 (field) or 175 (lab) (L354–365). DOPAMINE.md §9.8 lists the pending port. |
| `src/dopamine.js` | Dopamine layer (DOPAMINE.md §6) | `region`, `tint` and `da` arrays of `REGION_COUNT` × 4, plus `pathHist` (L93–96). `step` substeps at 0.02 s of human time (L189–190). `_activity` overwrites the activity channel every frame from imaging targets that equal 1 at rest (L335–365). Modulator tints on `R.pituitary`, `R.raphe`, `R.rmtg`/`R.vta` and `R.pag`/`R.arcuate` (L82–87). No random numbers of its own. |
| `src/anatomy.js` | Procedural MNI brain | `MM = 0.01` (L7). `REGION_IDS` (L17–L41) with `REGION_COUNT` (L48) and `LEGACY_REGION_COUNT` = 33 for the original build (L49). `mulberry32` (L74). `HULL` (L125). `NUCLEI` (L273). `DA_GROUPS` (L308). `BRAINSTEM` tube ends at (0, −46, −88) (L321–L324). `PATHWAYS` (L335). `TERMINALS` (L368). `spline` (L386). All post-port lines (DOPAMINE.md §7.3). |
| `src/brain.js` | Point generation | 12-float record (L12). `SHARES` (L140). `generateBrain` (L144) draws everything from one seeded stream and shuffles at the end (L254), so any structure inserted into it moves every later point. Insula shell (L184–193). |
| `src/shaders.js` | GLSL ES 3.00 | `uRegion[33]` (L30), `uTint[33]` (L63), `uDA[33]` (L122), `uPathHist[48]` (12 pathways × 16 samples; L6, L123). `tissuePath` assumes a brain-only envelope (L33–49). |
| `src/renderer.js` | HDR pipeline | Additive `ONE, ONE` blending (L117–118). Each tier draws a prefix of each shuffled range with compensating flux gain (L49–63). Per-region uploads at L104, L131, L139–140. |
| `src/camera.js` | Orbit camera | Near 0.01 and far 50 hard-coded (L144). `flyTo` (L107). No unprojection, so no picking. |
| `src/performance.js` | Tiers, adaptive quality | `TIERS` (L8–13). `AdaptiveQuality` (L50–144). |
| `src/gl-utils.js` | WebGL helpers | `createInterleavedVAO` supports float attributes only (L56–66). |
| `src/ui.js`, `index.html` | HUD | `Hud` (L151). Dropdown state under the prefix `brain-system.drop.` (L72). `show()` prints a dash for `null` (L30–34). Performance and Settings become popovers below 760 px (L236–261). Keys Space, D, P, V, H, I, F, Esc (L404–444). The vitals dropdown is titled "Body" (`index.html` L94). Settings holds the orgasm controls (L150–211). The ids `stim-level` and `stim-val` are taken by the orgasm stimulation slider (L158–160). Dropdown headings already carry short chips (`.pill` L39, `.badge` L127). Control bar: Stimulate, Distract, Pause, View (L213–218). |
| `brain-system/` | — | No `test/` directory and no `package.json`. |

Uniform budget of the current shaders, counting one slot per uniform in the worst case (R = `REGION_COUNT`):

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Neuron vertex shader | ≈ 24 + 2·R | vec4 slots | — | medium | [model] count of `shaders.js` L21–31, L55–63 |
| Dopamine vertex shader | ≈ 67 + 2·R | vec4 slots | — | medium | [model] count of `shaders.js` L21–31, L118–124 |
| R today / after A.3.3 | 33 / 122 | regions | — | high | `LEGACY_REGION_COUNT`, `anatomy.js` L49; A.3.3 (89 new ids: 6 split, 13 thalamic, 9 basal-forebrain and limbic, 14 hypothalamic and CVO, 47 brainstem) |
| Slots at R = 122 (neuron / dopamine) | ≈ 268 / ≈ 311 | vec4 slots | — | medium | [model] arithmetic |
| R at which the dopamine shader passes 256 slots | ≈ 94 | regions | — | medium | [model] arithmetic; limit B.7 |

Per-region state therefore moves to a texture (§11 decision; layout in B.7). The ≈ 46 cortical areas of A.3.3 are an attribute, not regions.

### B.4. New modules and interfaces

| Path | Exports | Kernel layer (A.4) | Semantics owner |
|---|---|---|---|
| `src/clock.js` | `SimClock`, `PRESETS`; re-exports `LogRamp` from `response.js` | owns kh | A.4, §11 |
| `src/sim/kernel.js` | `Kernel` | EV, NF, CV, GI, EN, IM, CR | §11 |
| `src/sim/graph.js` | `buildGraph`, schema constants (A.3.2) | — | §11 |
| `src/sim/brainnet.js` | `BrainNet`: rate graph, arousal state machine, salience, modulator pools, ports | NF, CR | §3, §4 |
| `src/sim/sensory.js` | receptor transduction, adaptation, `psi` | NF | §5 |
| `src/sim/somatic.js` | dorsal horn, reflex circuits, motor pools, EMG, force, joints, CPGs | NF | §6 |
| `src/sim/autonomic.js` | heart, vessels, baroreflex, respiration, pupil, SCR, thermoregulation, bladder | CV, EN | §7 |
| `src/sim/enteric.js` | `GutModel` | GI | §8 |
| `src/sim/endocrine.js` | HPA, SAM, posterior pituitary, RAAS, HPT/HPG scalars | EN | §9 |
| `src/sim/immune.js` | LPS, cytokines, PGE2, set point, sickness | IM | §10 |
| `src/sim/stimuli.js` | `SENSES`, `validSites`, `resolveSite`, `makeStimulus`, `predictArrivals` | EV | §4, §5 |
| `src/sim/scenarios.js` | `SCENARIOS` (data in the §12 format), `ScenarioPlayer` | inputs(tH) | §12 |
| `src/sim/orgasm-adapter.js` | `OrgasmAdapter` | wraps `ResponseModel` and `DopamineModel` | §11, DOPAMINE.md |
| `src/sim/interventions.js` | `INTERVENTIONS`, `apply(kernel, preset)` | — | §11 with §6, §7, §9, §10 |
| `src/body/frame.js` | body-frame constants, vertebra, segment and exit tables, `canalAt`, `dermatomeAt` | — | §2 |
| `src/body/geometry.js` | body SDF, organs, nerve and vessel splines, sites | — | §2, §13 |
| `src/body/generate.js` | `generateBody`, `generateBodyChunks` | — | §13 |
| `src/body/picking.js` | `pick(ray, opts)` | — | §13 |
| `src/statetex.js` | `StateTextures` | — | B.7 |
| `src/safety.js` | `PhotoLimiter` | — | §13 |
| `src/ui-body.js` | dropdowns Body, Interventions, Stimulus, Scenarios, Time, Brain systems, Views | — | §13 (labels), B.10 |
| `test/*.test.mjs` | headless tests | — | B.14 |

The interfaces below are the code-level contract. Names follow A.3; units are human seconds, mm and m/s.

```js
// src/clock.js
export const PRESETS = { reflex: 0.01, pain: 0.1, autonomic: 1, gut: 10, endocrine: 60, immune: 900, circadian: 3600 }; // A.4
export class SimClock {
  tH; tS; kh; source;                 // 'user' | 'scenario' | 'delegate' | 'adaptive'
  lock(kh /* or null */);             // user lock, priority 1 (A.4)
  setKeyframes(schedule /* or null */); // scenario keyframes (§12), slew-limited (A.4)
  delegate(fn /* (dtS) => kh, or null */); // exempt source used verbatim; orgasm scenario only (B.13)
  setAdaptiveTarget(kh);              // from the kernel's layer activity (A.4 rule)
  anticipate(tOnsetH);                // pull kh down ahead of a scheduled stimulus (A.4)
  descent(kh, k1);                    // H_desc, the stepwise descent sum of §11.7 (human s)
  propose(dtS);                       // -> { t0H, h, kh }: the frame's proposal (A.4 priority, slew)
  commit(tReachedH);                  // -> { t0H, t1H, kh }: the kernel's reached time is the truth (§11.7)
  label();                            // 't 23.0 ms  ×1/100' (A.4)
}

// src/sim/graph.js
export function buildGraph({ brain, body });  // -> { nodes, edges (CSR), index: Map }
// node { id, kind, pos (mm), side, nets }; edge { from, to, kind, fibre, nets (bitmask, AND), len (mm), v (m/s), nSyn, sign, pathId }

// src/sim/kernel.js
export class Kernel {
  constructor({ graph, seed = 1, age = 30 });
  setBodyMode(mode); setNet(id, on); setIntervention(preset /* or null */); setPosture(p); setArousalState(s);
  setExternalCommands(src);   // ZOH reader of OrgasmAdapter command records (B.13)
  schedule(stimulus);         // A.6 record, tOnset in tH
  settle(init);               // resting steady state for the §11.10 key {switch set, age, posture, fed, timeOfDay},
                              // cached per key; slow layers set analytically, NF and CV settled over 300 s of tH
  advance(h, budgetMs);       // human seconds; fixed grids, state-driven striding (A.4); stops at a step
                              // boundary when budgetMs is spent; -> tReached (human s), §11.7
  snapshot(); restore(s);     // seeking (§12.2): snapshots every 10 % of a scenario span
  t;                          // kernel time (human s)
  state;                      // named Float64Array views (A.3.4)
  packets(out);               // visible packets { pathId, uHead, sigmaU, gain, fibre, dir }, sorted by pathId
  events(out);                // arrivals and reflex onsets for the event log
  cpuMs;                      // cost of the last advance(), reported only (budget.test.mjs, Performance)
}

// src/sim/scenarios.js
export class ScenarioPlayer {
  select(id); play(); stop(); restart(); repeat(); seek(tH);
  active; progress; stage;    // read by the HUD
}

// src/sim/orgasm-adapter.js
export class OrgasmAdapter {
  constructor(response, dopamine);
  start({ mode, profile, tref, hypothesis, seed = 1 }); stop();
  clock(dtS);                 // scenario clock step -> kh (the SimClock delegate; legacy LogRamp before the port)
  advance(dtS, t0H, h, source);  // update() substep body: S from the demo script (screen dt before the port, tH
                              // after) or the level, then advanceHuman(h, S).
                              // -> { tReachedH, khEnd }: the clock owns tH and kh, so it must be given both back.
                              // A frame that enters ONSET runs its remainder at the new kh, so tReachedH is not
                              // t0H + h and khEnd is not the kh the frame started with (B.13; DOPAMINE.md §9.3)
  commands;                   // ring of command records { tH, cmdSym, cmdVag, cmdSacral, apnoea, omega } per substep (fields §11.14); read only in switched modes
  climax;                     // true in 'inevitability', 'orgasm' and, after the port, 'onset'
  active;
}

// src/statetex.js
export class StateTextures {
  constructor(gl, { regions, areas, bodyNodes, edges, packets, gutSegments });
  compose({ dopamine, brainnet, kernel }); // column 2·r + s (s = 0 for x ≥ 0 and midline, 1 for x < 0; §11.15):
                                           // activity = dopamine.region[PARENT[r]*4] × brainnet.activity[r, s],
                                           // brainnet.activity rest-normalised, 1 at rest (§13.7); unsided dopamine
                                           // channels copied into both columns
  upload(); bind(program);
}

// src/body/generate.js
export function generateBody({ budget, lod }, seed);       // -> { points, ranges, sites, hash }
export function* generateBodyChunks(opts, seed, sliceMs = 8);

// src/body/picking.js
export function pick(ray, { sense, bodyMode, yaw }); // -> { site, point, normal } or null; S4–S5, perineal and
                                                      // pelvic-floor sites never returned; dermatome.S3 only while |yaw − π| < π/2 (§13.12)
```

### B.5. Changes to existing files

| File | Change | Preserved behaviour (test, B.14) |
|---|---|---|
| `src/main.js` | (1) Replace `model.update(sdt)` (L174) with `const p = clock.propose(sdt); if (adapter.active) adapter.advance(sdt, p.t0H, p.h); const tR = kernel.advance(p.h, budgetMs); const s = clock.commit(tR);` (B.6). `dopamine.updateVisuals(sdt, response, s.kh)` (L176) stays. (2) Move the `onStep` wiring (L90) into the adapter. (3) Add `statetex.compose/upload`, `PhotoLimiter.scale` and the body render parameters. (4) Extend `VIEWS` and `VIEW_ORDER` with the body views (camera values §13), keeping the keys `whole`, `cutaway`, `dopamine`. (5) Camera `maxDistance` and far plane from §13. (6) Gate climax dimming (L179–182) on `adapter.active && adapter.climax`. (7) Replace the clock line (L218) with `clock.label()` and extend the HUD payload (B.10). (8) URL parameters `body` (0/1), `nets` (comma list of networks on), `scenario`, `seed`, `time` (preset name or locked kh); `view` and `quality` stay. (9) Generate the body after the first brain frame (B.9). (10) Expose `kernel`, `clock`, `scenarios`, `stimuli`, `adapter`, `safety` on `window.__brain`. (11) Body flux keys in `tune` (values §13). | `?body=0&scenario=orgasm&view=whole` reproduces the post-port brain image and the camera apart from the §3 additions, and runs the §11.14 central form (κ coupling removed, so its dopamine traces differ from the legacy path; user decision, 4 November 2026); with every network on in whole-body mode the traces equal the legacy path (A.8 #21); Vitals read "—" in brain-only mode (A.8 #10); a `view` URL parameter overrides the fly-to on scenario selection (geometry and orgasm-regression tests). |
| `src/anatomy.js` | Phase 0a applies the DOPAMINE.md §7.3 changes (NUCLEI radii and positions, thalamus rotation, DA_GROUPS shares, A8, the A13 move, the A14 and `medianEminence`/`pituitaryGland` region ids, the first `BRAINSTEM` point, voids). Then append the new ids after the last post-port id, so earlier indices stay. Aliases `R.gpe = R.pallidum`, `R.dr = R.raphe`, `R.pituitaryAnt = R.pituitaryGland`. New exports, contents from §3 and §11: `NUCLEI_V2`, `RELABEL` (split rules of A.3.3 and any further §3 relabels), `PARENT` (region whose dopamine channels a new id inherits), `AREAS`, `BRAIN_TRACTS`, `PORTS`. | After Phase 0a, `NUCLEI`, `DA_GROUPS`, `BRAINSTEM`, `PATHWAYS`, `TERMINALS` unchanged; `DopamineModel` indices stay valid. |
| `src/brain.js` | Phase 0a applies the DOPAMINE.md §9.8 construction details and the §7.3 insula ribbon; after that `generateBrain` is untouched. New: `applyRelabel(brain)` rewrites only the region float (a2.x) of relabelled stars; `generateBrainExtra({ neurons }, seed = 1849)` builds a separate buffer with `NUCLEI_V2`, the `gpe`/`gpi` ellipsoids, `rmg`/`rpa`/`rob`, tectal bumps, CVLM, LGN and MGN (§3) in floor-stratified order (B.8); `areaIds(brain)` returns a `Uint8Array` holding 2·area + side (255 = none; §11.15). | Positions and flux of the post-port buffer bit-identical per tier. |
| `src/renderer.js` | Replace the per-region uploads (L104, L131, L139–140) with the `uState` texture. Add a VAO for the extra brain buffer (neuron program), the area attribute at location 3, and a body VAO and program drawn once per tissue-class range, with per-class gains normalised to a reference tier as in L56–60. `setTier` and `pointCount` include extra and body counts. New `replaceBody`, `setBodyFade`, and an optional luminance monitor (async readback of the smallest bloom level behind `?safetyMonitor=1`). | Same shading for brain-only inputs. |
| `src/shaders.js` | `COMMON`: the arrays become `uniform highp sampler2D uState;` with `texelFetch` accessors `regionState`, `regionTint`, `daState`, `pathHistAt`, `areaState`. `NEURON_VS`: `layout(location = 3) in uint aArea;`, flux × area factor (1 at rest), overlay tint. `DA_VS`: `pathRate` reads row 3. New `BODY_VS` (reusing `STAR_FS`) implementing the §13 formulas: ghost blend, body fade, head-skin fade, torso attenuation, facing, packets and edge activity, organ responses, rigid limb transforms. | Brain constants, `tissuePath`, twinkle and lantern code unchanged. |
| `src/performance.js` | `TIERS` gains `extra`, `body`, `bodyLod`, `packets` (B.8) and `gutSegments` (§8). `AdaptiveQuality` unchanged. A kernel overrun is absorbed by time slicing, which lowers the effective kh (A.4), never the render tier. | Tier detection and hysteresis unchanged. |
| `src/camera.js` | `near`/`far` options with the distance-dependent near plane (§13); `unproject(clientX, clientY)` returns a ray in mm; `flyTo` eases distance in log space (brain-to-body distance ratio ≈ 10, §13). | Orbit, inertia, auto-spin unchanged. |
| `src/ui.js` | Today's panels stay; new dropdowns live in `ui-body.js` and use the same storage prefix and `show()`. Handlers: `onBodyMode`, `onNet`, `onIntervention`, `onSense`, `onPick`, `onApply`, `onClear`, `onScenario`, `onPlay`, `onStop`, `onRestart`, `onRepeat`, `onSeek`, `onTimePreset`, `onTimeLock`, `onTimeRate`, `onOverlay`, `onArousalState`, `onAge`, `onReducedMotion`. The popover list (L241) and the Esc handler gain the right-column dropdowns. Space and D act only while the orgasm scenario is active. Key B toggles the master switch. | Existing keys and dropdown persistence. |
| `index.html` | Rename the vitals title "Body" to "Vitals" (L94), keeping `data-store="vitals"`. Add the new sections (B.10). Move mode, level, profile, refractory duration and hypothesis (L151–195) into the orgasm block of Scenarios with the same ids. Move the `view` select to Views and the `quality` select to Performance. Show Stimulate and Distract only during the orgasm scenario. Update About with the §13 disclosures and the new keys. | Element ids unchanged, so existing bindings survive. |
| `style.css` | Switch, segmented-control, radio-list and progress-bar styles; greyed (`aria-disabled`) state. | Existing rules unchanged. |
| `src/response.js` | Inject a seeded stream (`this.rand`, default `mulberry32(seed)`) at L189, L198, L201, L202 and L217. Extract `advanceHuman(h, S)` (the substep loop of L339–348) and `stimulusFor(dtS)` (L337–338); `update(dt)` becomes `kh = this.kh.step(dt); S = stimulusFor(dt); advanceHuman(dt * kh, S); phaseT += dt`. Export `CLOCK`, `LogRamp` and an `Seff` getter (DOPAMINE.md §9.1). `vitals()` stays for regression only. | Equations untouched; legacy `update(dt)` bit-identical. |
| `src/dopamine.js` | No code change beyond the Phase 0a port (DOPAMINE.md §9.8). Arrays grow with `REGION_COUNT` (L93–96). Its activity channel (1 at rest) is multiplied in `statetex` by the rest-normalised `BrainNet` activity (1 at rest, §13.7). | DOPAMINE.md §9.7 tests (after the port). |
| `src/color.js` | Add `cctDuvRGB(T, duv)` (palette §13). | `blackbodyRGB` unchanged. |
| `src/gl-utils.js` | Add `createDataTexture`, `updateDataTexture`, integer attributes (`vertexAttribIPointer`) in `createInterleavedVAO`, and `readPixelsAsync`. | Existing helpers unchanged. |
| `README.md`, `research/` | Features, controls, disclosures, test command. The DOPAMINE.md rule-7 amendment proposed in §11.18, only after the user confirms it (§13.18). | — |
| `brain-system/package.json` (new) | `{ "type": "module", "private": true }`, so Node runs `src/*.js` as ES modules in tests. | Browser unaffected. |

### B.6. Frame loop and data flow

`main.js` `tick(now)` runs these steps in order:

1. **Timing.** Clamp dt at 0.1 s (unchanged); `resize()`; `quality.sample(dt, gpuMs)`. Paused frames pass dt = 0 to the clock.
2. **Clock proposal.** `clock.propose(dt)` returns `{ t0H, h, kh }`. Source priority follows A.4; while the orgasm scenario holds the clock, the delegate returns the scenario's kh verbatim (B.13).
3. **Orgasm adapter.** If active, `adapter.advance(dt, t0H, h, source)` runs the substep body from t0H and appends one command record per substep, returning `{ tReachedH, khEnd }`. It normally covers [t0H, t0H + h], but a frame that enters ONSET runs its remainder at the new kh, so it may cover less (B.13). It runs before the kernel, because the CV layer reads its commands. Otherwise both models stay dormant (B.13).
4. **Kernel.** `tR = kernel.advance(h, budgetMs)` steps the EV queue and the NF, CV, GI, EN, IM and CR layers on their fixed grids and stops at a step boundary when the budget (§11.7) is spent. In switched modes the CV layer reads adapter command records zero-order-hold at each CV step (latest record with tH ≤ t); with all networks on, the vitals pass through from `vitals()` (§11.14). Stimuli and scenario inputs are evaluated at grid times in tH.
5. **Clock commit.** `clock.commit(tR)` makes the reached time the truth, so a CPU overrun lowers the effective kh for the frame (§11.7). While the orgasm delegate holds the clock, **`commit` is a no-op**: `tH` stays at the adapter's `tReachedH` and the delegate's kh stays at its `khEnd`, which the clock takes from step 3. The delegate's kh is never changed by an overrun; the kernel lags the adapter by the unfinished remainder, which it carries into the next frame, and when that backlog would exceed one frame the kernel exceeds its budget instead of falling further behind.
6. **Screen-time filters.** `dopamine.updateVisuals(dt, response, kh)` (unchanged) and `brainnet.updateVisuals(dt, kh)`.
7. **State textures.** `statetex.compose()` then `upload()`.
8. **Photosensitivity limiter.** `PhotoLimiter.scale()` receives each change source (packets, organ glows, network fades, lanterns) with its projected area and its own luminance transition and returns amplitude factors (per-cell rule §13.15).
9. **Camera.** `camera.update()`; climax handling only inside the orgasm scenario.
10. **Render.** Background, neurons, extra brain nuclei, body (if visible), dopamine system, lanterns, bloom, composite.
11. **HUD.** Every 0.12 s of screen time (as today) with the B.10 payload; the event log reads `kernel.events()`.

### B.7. GPU data layout and memory

| Texture or buffer | Format | Size | Contents | Upload |
|---|---|---|---|---|
| `uState` (brain) | RGBA32F | 256 × 5 texels | sided columns 2·r + s (244 used for 122 regions; 246 with A14; §11.15); row 0: activity (rest-normalised), E, spread, modulator; row 1: tint rgb, amount; row 2: ν/ν₀, spike phase, release phase; row 3: path history (≥ 52 texels for the 13 pathways after DOPAMINE.md §7.6 adds slMFB); row 4: area activity and overlay (≈ 46 areas × 2 sides) | every frame |
| `uBodyState` | RGBA16F | 1,024 × 2 | per body node (740 nodes, the ≤ 64 dynamic skin sites and 20 % margin; §11.4): activity, ghost factor (follows g), response, network index; organ row | every frame |
| `uEdgeAct` | RGBA16F | 128 × 32 | per edge (≈ 2,200 ± 20 %, up to 2,660; §11.4): low-passed activity, efference-only flag, ghost factor | every frame |
| `uPackets` | RGBA32F | 256 × 2 | ≤ 256 visible packets, sorted by pathId: pathId, uHead, σu, gain / fibre, direction, age (display caps §13) | every frame |
| `uPathIndex` | RG32F | one texel per drawn path | first record and count (≤ 8) of each path's packets in `uPackets`, so a vertex reads at most 8 records (§13.8) | every frame |
| `uGut` | RGBA16F | 256 × 1 | per gut segment (resolution §8): contraction, slow-wave phase, excitability, bolus | every frame |
| Area attribute | `Uint8Array`, location 3, `vertexAttribIPointer` | 1 B per star (neuron and extra buffers) | 2·area + side (≤ 92), 255 = none | at generation |
| Body vertex record | `Float32Array`, 16 floats | 64 B per point | a0: pos.xyz (units), flux · a1: normal.xyz (0 for volumes), seed · a2: nodeId, pathId (−1 = none), u (A.2), tissue class · a3: network bitmask, LOD, side, rigid segment id | at generation |

Width 256 holds the 122 regions per side (244 columns). If §3's final list exceeds 128 regions, the width becomes 512; every width stays within the ES 3.0 minimum `MAX_TEXTURE_SIZE`. Float textures read with `texelFetch` and `NEAREST` filtering need no extension, and the RGBA16F textures accept `Float32Array` uploads with type `FLOAT`. Vertex-shader texture reads use at most five of the guaranteed 16 vertex texture units.

Tissue classes match the nine budget groups of §13: skin, organ, muscle, bone, cord, nerve, ganglion, enteric, vessel/immune; "structural" (§13.5) is carried by the tissue class. The network bitmask holds eight display bits: somatic afferent, somatic efferent, sympathetic, parasympathetic, visceral afferent, enteric, neuroendocrine, neuroimmune. This is the single bit list (§13.16).

The body vertex shader declares matrices and common scalars (≈ 16 slots), `uNetGain` (2 vec4), `uOrgan[16]` (heart beat, lung scale, diaphragm, pupil radii, bladder radius, vasoconstriction dimming and others) and `uJoint[40]` (20 rigid segments × quaternion and translation): ≈ 74 slots, well under 256.

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Minimum vertex uniform vectors (ES 3.0 / WebGL2) | 256 | vec4 | — | high | Khronos OpenGL ES 3.0 specification |
| Minimum `MAX_TEXTURE_SIZE` | 2,048 | texels | — | high | Khronos OpenGL ES 3.0 specification |
| Minimum vertex texture image units | 16 | units | — | high | Khronos OpenGL ES 3.0 specification |
| State textures on the GPU (sum of the table above, `uPathIndex` sized for 1,024 paths) | ≈ 86 | KB | — | medium | [model] arithmetic |
| Data passed from JS per frame (all textures as `Float32Array`) | ≈ 136 | KB | — | medium | [model] arithmetic |
| GPU vertex memory at ultra (brain 400,000 × 48 B; dopamine system 43,500 × 48 B; extra 18,000 × 48 B; body 610,000 × 64 B; area 0.42 MB) | ≈ 61.6 | MB | — | medium | [model] from `performance.js` L12, B.8 and §13 |
| Kernel history rings at the itemised size (variable per-source rings, layout §11.6) | ≈ 0.24 | MB (`Float32Array`) | — | high | §11.6 (10.4 MB with fixed 4,096-sample rings) |

### B.8. Point budgets per tier

| Item | Low | Medium | High | Ultra | Species | Conf. | Source |
|---|---|---|---|---|---|---|---|
| Neuron stars (`TIERS.neurons`) | 60,000 | 130,000 | 240,000 | 400,000 | — | high | `performance.js` L9–12 |
| Dopamine somata / axon / release points | 3,500 / 6,000 / 4,000 | 3,500 / 10,000 / 7,000 | 3,500 / 16,000 / 11,000 | 3,500 / 24,000 / 16,000 | — | high | DOPAMINE.md §9.2 |
| New brain nuclei (`TIERS.extra`, a separate buffer on top of `TIERS.neurons`) | 3,200 (5.3 %) | 6,500 (5.0 %) | 10,800 (4.5 %) | 18,000 (4.5 %) | — | medium | share and floors §13; values [model] |
| Body (`TIERS.body`) | 122,250 | 238,500 | 393,000 | 610,000 | — | medium | §13.4 (dense star model, vascular tree with capillaries) |
| Visible packets (`TIERS.packets`) | ≤ 256 | ≤ 256 | ≤ 256 | ≤ 256 | — | medium | texture capacity B.7; caps §11, §13 |
| Total drawn in body views (before brain LOD; lanterns 400 included) | 165,600 | 328,400 | 562,200 | 891,900 | — | medium | [model] sum; §13.4 |

The §13 floors per nucleus bind at the low and medium tiers, which therefore take 5.3 % and 5.0 % rather than 4.5 %:

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| New ids that need new stars | ≥ 77 | structures (bilateral pair = 1) | — | low | [model]: 89 new ids minus 11 thalamic subnuclei inside the post-port thalamus (`thalAnt` included, §3.17) and the relabelled split ids `mnr`, `pituitaryPost`; plus new stars for `gpe`/`gpi` (drawn as ellipsoids, §3.17) and for `rmg`, `rpa`, `rob`, which lie outside the raphe tube |
| Stars to meet the low / medium / high floor (40 / 80 / 120 per structure) | 3,080 / 6,160 / 9,240 | stars | — | low | [model] arithmetic with the §13 floor |

How the budgets are drawn:

- Every class range is shuffled at generation. A tier draws a prefix of each range with flux gain to compensate, as `renderer.js` L49–63 does today.
- The extra brain buffer is **floor-stratified** in three blocks: block 1 holds 40 stars of every structure, block 2 adds 40 more, block 3 adds 40 more (the §13 floors 40 / 80 / 120), and the remainder follows; each block is shuffled internally. Any tier prefix therefore meets its floor even though the buffer is generated at `genTier`.
- In whole-body framings the brain draws a reduced prefix (fraction §13).
- The body and the extra buffer are generated at `genTier` (`main.js` L66). Adaptive downgrades draw prefixes and never rebuild; only manual tier upgrades above `genTier` regenerate them with `replaceBrain`/`replaceBody` (§13.4).
- The model's CPU cost does not depend on the tier (§11).

### B.9. Timings

| Quantity | Value | Unit | Species | Conf. | Source |
|---|---|---|---|---|---|
| Clock range, presets, slew, approach phase | as fixed in A.4 | — | — | — | A.4 (owner §11) |
| Kernel steps EV / NF / CV / GI / EN / IM / CR | as fixed in A.4 | — | — | — | A.4 (owner §11) |
| Network gain ramp `g.<net>` / display ghost | 1.0 (tH) / follows g, rate-limited to t_fade ≥ 0.8 (tS) | s | — | — | A.5; §13.15 |
| Response-model substep in the orgasm scenario | ≤ 0.5 (legacy); DOPAMINE.md §9.3 after the port | s (tH) | — | high | `response.js` L340 |
| Dopamine substep (legacy) | 0.02 | s (tH) | — | high | `dopamine.js` L189–190 |
| Kernel CPU budget | ≤ 1 (desktop) / ≤ 2 (low tier) | ms per frame | — | — | §11 |
| HUD text refresh | 0.12 | s (tS) | — | high | `main.js` L210 |
| Vitals sparkline | 0.1 per sample, 600 samples | s (tS) | — | medium | [model], same scheme as `main.js` L100, L199–205 |
| Body generation slice | ≤ 8, narrow-band iso-surface or Web Worker; body visible ≤ 2 s after the first brain frame at the high tier | ms per slice | — | medium | [model]; §13.4 |
| Body fade-in after generation | t_fade (≥ 0.8) | s (tS) | — | — | §13.15 |
| Seek fast-forward slice | ≤ 8, from the nearest 10 % snapshot (§12.2) | ms per frame | — | medium | [model] |
| Event log length | ≤ 50 | entries | — | — | §13.13 |
| Episode end (manual stimulus) | no packets in flight and every transient within 5 % of baseline | — | — | low | [model] |
| Prototype kernel cost at kh = 3,600 | 0.62 | ms per 60-fps frame | — | medium | model check (prototype `results.txt`) |
| Seek cost per human hour / per 8 h at that cost (rest) | ≈ 37 / ≈ 300 | ms | — | low | [model] arithmetic |
| Seek cost on the active `infection` course (§11.17: 0.87–1.71 ms per 15 human s at ×900) | ≈ 0.21–0.41 s per human hour; ≈ 1.6–3.1 s over the 8 h span, at most one 10 % snapshot interval (≤ 0.8 h, ≤ 0.33 s) per seek | — | — | low | [model] arithmetic (10 % of the §12.2 `infection` span of 8 h) |
| Legacy dopamine substeps per 60-fps frame at kh = 900 | 750 | substeps | — | high | [model] arithmetic from the 0.02-s substep |
| Adapter substeps per 60-fps frame after the port, at kh = 900 / 3,600 / 4,320 (the recovery delegate's ceiling) | response (0.05-s cap) 300 / 1,200 / 1,440; dopamine (0.02 s) 750 / 3,000 / 3,600 | substeps | — | high | [model] arithmetic from the §11.14 step cap |
| Adapter CPU cost per 60-fps frame at kh = 900 / 3,600 / 4,320 | to be measured (`budget.test.mjs`); the adapter sits **outside** the ≤ 1 ms kernel budget, so this row is the only bound on its cost | ms per frame | — | — | §11.14 |
| Human time passed in a 1-s log ramp from ×10 to ×1 | ≈ 3.9 | s (tH) | — | high | [model] arithmetic: 9 / ln 10 |

Seeking from the nearest snapshot is affordable even on the active course, spread over ≤ 8 ms slices. The production graph is larger (§11); `budget.test.mjs` reports the real figure. `orgasm` has no seek (§12.2).

At load the brain is generated and rendered first. The body follows in slices and fades in; the app opens with whole body, all networks on and the orgasm scenario playing in demo mode on the "Dopamine system" view (A.7); `?scenario=none` opens at rest on the "Upper body" view. `?body=0` starts in brain-only mode and defers body generation until the master switch first turns on.

### B.10. HUD dropdowns, fields and controls

> **Default interface (user decisions, 5 November 2026).** The app opens with a simple HUD
> (`src/ui-simple.js`) of four controls. The person's emotion and the way the brain is shown are
> separate states: an emotion never moves the camera, and a view never changes the emotion.
> - **Emotion: Calm, Stress or Pleasure.** Calm stops every scenario; Stress plays `stressor`;
>   Pleasure plays the orgasm scenario in demo mode, without its fly-to.
> - **View:** whole brain, cutaway, dopamine system or upper body.
> - **Quality:** Auto (the adaptive tier of `performance.js`) or a fixed tier.
> - **Pause.**
>
> Its readouts are a plain-language story of the current stage and one meter with its percentage,
> the only number shown: stress hormones (plasma adrenaline over rest, log scale, full at ×4) or
> accumbens dopamine.
>
> Stress is drawn on the brain, display only [model]:
> - The stress circuit (amygdala, CeA, BNST, hypothalamus, PVN, LH, DMH, LC, PAG, RVLM; anterior
>   insula, dACC, sgACC) brightens to ×2.2 through the brain-systems overlay, and the other regions
>   dim to ×0.45. Both scale from 0.45 at the start to 1 at the meter's top.
> - The circuit's regions take a blue tint (#5CB8FF) through the BrainNet tint channel.
>
> In the simple HUD the dopamine display is the one from before the whole-body build. The user asked
> for it back, and these are display choices [model]:
> - The climax reward is pulse-locked: the §6.10 switch is on, as it was by default before the
>   DOPAMINE.md §9.8 port.
> - The fibre flow uses the old 0.5-s travel (`histStep` 0.5/16 s).
> - There is no 2-s pulse-locked floor on the glows; the 0.3-s floor stays.
> - A dopamine wave, like an expanding shock-wave ring, runs from the VTA (`shaders.js` `WAVE`, used
>   by `NEURON_VS` and `DA_VS`):
>   - The climax starts one shell at 55 mm/s; each contraction starts a weaker one at 80 mm/s, scaled
>     by the contraction's amplitude.
>   - A shell is Gaussian, 5 mm wide plus 0.12 mm per mm of radius. It rises over 0.35 s and fades
>     between 70 and 115 mm.
>   - It pushes the points it crosses up to 1.6 mm outward.
>   - It brightens neurons ×(1 + 2·w), adds amber, and lights the dopamine somata, fibres and release
>     sites ×(1 + 4·w).
>   - At most about 1.25 shells start per second. Reduced motion halves the climax wave and its
>     push, and drops the others.
>
> **Superseded on 6 November 2026.** The user found the glass shells distorted and jagged, and
> asked for a sharper, denser star model instead. The shells, `glass.js` and the `glass` program
> were removed. The style choice is now Detailed (default) or Stars (§13.4, the dense star model).
> The anatomical colours below stay with Detailed. The rest of this note records the glass as it
> was.
>
> **Glass style (stage 1 of the visual upgrade).** The simple HUD also has a style choice: Glass
> (default) or Stars (the earlier look, kept as a preset). Glass meshes the existing procedural
> fields at load, with no downloaded meshes (DOPAMINE.md §7.2):
> - the cerebrum hull with the `folding` field pressed in to 0.35 of its depth;
> - the cerebellum, the skin (`bodySDF`) and the organ groups of `ORGANS` (heart, lungs, liver,
>   spleen, kidney, pelvic).
>
> Meshing uses naive surface nets on a grid of 2.8–1.8 mm for the brain, 10–5.5 mm for the skin and
> 5–3.2 mm for the organs, from the Low to the Ultra tier. Smoothing removes seams and terracing:
> - the sampled field takes 1–2 [1 2 1]/4 blur passes, which melt the seams where `bodySDF` switches
>   primitives at its z guards;
> - the mesh takes 3–8 Taubin passes (λ 0.5, μ −0.53);
> - normals are area-weighted mesh normals.
>
> The shells are meshed for the tier that renders now, not the generated maximum. A tier change must
> hold for 2 s before remeshing. The work runs in slices of ≈ 6 ms (≈ 120k triangles at Low, 267k at
> High).
>
> Drawing (`glass` program) is additive, so the shell order does not matter:
> - back faces are culled;
> - a Fresnel rim (1 − |n·v|)^3.5 that fades just before the silhouette, which gives a soft edge
>   without multisampling;
> - rim and highlight fade where `fwidth` of the facing term is large (thin folds seen edge-on), so
>   rotation does not shimmer;
> - a face tint of 0.02 and a small highlight;
> - the cutaway plane applies;
> - HDR gains are 0.2 for the brain and 0.2 for the body (with the body fade);
> - the neuron and body stars dim to ×0.85 and ×0.6.
>
> Colours follow anatomy atlases:
> - Shells: brain pink-lavender, skin faint peach, heart red, lungs pink, liver red-brown, spleen
>   purple, kidneys maroon, bladder pale yellow.
> - Brain stars turn pink-lavender.
> - Body stars take one colour per tissue class through `BODY_VS` `uAnat`, a chromaticity
>   substitution at equal luminance: skin peach, organs rose, muscle red-brown, bone ivory, cord and
>   nerves yellow, ganglia pale gold, enteric yellow-green, vessels red.
> - Packets keep their network colours, and dopamine keeps its amber.
>
> Stars restores the exact earlier gains. Real anatomical meshes and tractography are stage 2 and
> need the user's go-ahead on downloaded open data.
>
> The full HUD specified below is unchanged and opens with `?advanced=1`.

Every dropdown keeps today's pattern: a heading button with title, optional status chip and chevron, a body hidden when closed, no subtitle, and open state saved under `brain-system.drop.<store>`. Titles and labels follow A.3 and A.7; §13 owns their wording. The left column holds data (Vitals, Live, Dopamine, Modulators); the right column holds controls (Body, Interventions, Stimulus, Scenarios, Time, Brain systems, Views, Performance, Settings). Below 760 px the right-column dropdowns become popovers, as Performance and Settings are today. New stimulus ids use the prefix `sens-`, because `stim-level` and `stim-val` belong to the orgasm slider.

| Section id (`data-store`) | Controls (element ids) | Readouts | Brain-only mode |
|---|---|---|---|
| `drop-body` (`body`) | `body-mode` segmented control (Brain only / Whole body); switches `net-somatic`, `net-autonomic`, `net-enteric`, `net-neuroendocrine`, `net-neuroimmune` (`role="switch"`, swatch per §13) | — | network switches greyed (`aria-disabled`) but remembered (A.7) |
| `drop-interventions` (`interventions`) | `intervention` select (None plus the A.5 presets); parameter rows `sci-level`, `sci-type`, `sci-phase`, `nerve`, `nerve-day`, `vns` | active preset | greyed |
| `drop-stimulus` (`stimulus`) | `sens-sense` (A.6 order), `sens-mode`, `sens-intensity` (log where A.6 says so; `datalist` markers from §5), `sens-duration`, `sens-side`, `sens-pick` (toggles site picking), `sens-site` (keyboard preset list, §13), `sens-apply` ("Apply"), `sens-repeat-n` and `sens-repeat-isi` (Repeat, §12), `sens-clear` ("Clear") | `sens-site-info` (dermatome · nerve · segment · path length · predicted first arrival from `predictArrivals`, §4), `sens-psi` | vision, hearing, smell, taste, balance only (A.6) |
| `drop-scenarios` (`scenarios`) | `scenario` radio group (A.3.5 labels, then the optional scenarios); `scn-play`, `scn-stop`, `scn-restart`, `scn-repeat`; `scn-progress` (bar with stage markers; a click seeks); block `scn-orgasm` with `mode-demo`, `mode-manual`, `stim-level`, `profile`, `tref`, `hypothesis` (moved, ids kept) | current stage | unavailable scenarios greyed (A.3.5); a running one stops when the master switch goes to brain only |
| `drop-time` (`time`) | `time-auto` switch (Auto / Lock), `time-preset` segmented control (seven A.4 presets), `time-rate` log slider (A.4 range) | `time-readout` (A.4 format), `time-human` (tH since episode or scenario start) | unchanged |
| `drop-brainsys` (`brainsys`) | overlay switches Thalamocortical, Basal ganglia loops, Cerebellar loops, Limbic, Hypothalamus, Brainstem centres, "Large-scale networks (functional connectivity)" (off by default, A.8 #23); `arousal-state` select (A.3.4) | arousal state | unchanged |
| `drop-vitals` (`vitals`) | sparkline variable select | rows below | every body row shows "—" (A.8 #10) |
| `drop-live` (`live`) | — | `phase-desc` (stage text), `event-log` (ordered list of ≤ 50 entries, newest first, e.g. "22.3 ms · S1 hand · Aβ 65 m/s") | unchanged |
| `drop-dopamine`, `drop-modulators` | unchanged; Modulators adds NE, ACh, HA and OX rows (≤ 4 tints at once, §13) | — | unchanged |
| `drop-views` (`views`) | `view` select (moved) with Whole body, Upper body, Head and neck, Whole brain (`whole`), Cutaway (`cutaway`), Dopamine system (`dopamine`), Thorax, Abdomen, Torso, Spine, Right arm, Right leg (camera values §13) | — | body views hidden (§13.13) |
| `drop-perf` (`perf`) | `quality` select (moved) | existing rows plus `kernel-ms`, `clock-limited` flag, body and extra point counts | unchanged |
| `drop-settings` (`settings`) | `age` slider (A.3.4 default), `reduced-motion` (System / On; limb motion off under it, A.8 #22), `reset`, `info-btn` | — | unchanged |

Vitals rows (variables A.3.4; tags A.5; precision [model]):

| Row | Variable | Unit | Precision | Tag when a network is off |
|---|---|---|---|---|
| Heart rate | `hr` | bpm | 1 | "intrinsic" (autonomic; A.8 #11) |
| Blood pressure | `sbp`/`dbp` (`map` in the title attribute) | mmHg | 1 | "switch transient (model)" after a toggle; "syncopal range — not a viable steady state" (autonomic-off stand, §12.9) |
| Respiration | `rr` | /min | 1 | "ventilation maintained (model assumption)" (somatic; A.8 #8); "central chemoreflex only" (autonomic, §7.9) |
| Pupils | `pupilD.L` / `pupilD.R` | mm | 0.1 | "fixed" (autonomic) |
| Skin conductance | `scl` | µS | 0.1 | "denervated" (autonomic) |
| Core temperature | `tCore`, with `tSet` when they differ by > 0.1 °C | °C | 0.1 | — |
| Skin temperature | `tSkin` | °C | 0.1 | — |
| Gut motility | motility index (§8) | % | 1 | "≈ 0" (enteric) |
| Cortisol | `cortisol` | µg/dL | 0.1 | "basal" (neuroendocrine) |
| Adrenaline | `adrenaline` | pg/mL | 1 | "basal" (neuroendocrine or autonomic) |
| IL-6, TNF | `il6`, `tnf` | pg/mL | 1 | — |
| Sickness behaviour | `sickness.<c>` (§10.7) | list of active components | — | — (neuroimmune off: none) |
| Contractions | `pulses` (existing) | count | 1 | shown only in the orgasm scenario |

Status header: the title "Brain System", the current stage name in `phase-name` ("Rest" when nothing plays) and `clock.label()` in `clock`. The arousal and refractory meters (`index.html` L22–30) appear only during the orgasm scenario. The control bar shows Pause and View; Stimulate and Distract are added during the orgasm scenario.

| Key | Action | Condition |
|---|---|---|
| P, V, H, I, F | Pause, next view, hide HUD, About, fullscreen | always (existing); V cycles the views available in the current mode |
| Space (hold), D | Stimulate, Distract | orgasm scenario only (existing behaviour) |
| B | Toggle the master switch | new |
| L; `[`, `]` | Clock lock; clock down or up one decade | new (§13.13) |
| Enter | Apply the armed stimulus | focus inside the Stimulus dropdown or site list |
| Esc | Cancel site picking, close dropdown, popover or dialog | extends the existing handler |

### B.11. Switches, interventions and the stimulus panel

**Switches.** A network switch calls `kernel.setNet(id, on)`; the kernel ramps `g.<id>` and the renderer's ghost factor follows g, rate-limited to t_fade (A.5; §13.10). The master switch calls `kernel.setBodyMode`: the body freezes and hides, the vitals pass `null` to `show()` and so read "—", and body state resets to the resting steady state on return (A.5). In brain-only mode the network switches keep their values.

**Interventions.** One preset at a time. `kernel.setIntervention(preset)` removes the nodes or edges defined in §11; the rest of the model settles by its own dynamics. Parameter rows appear only for the selected preset.

**Stimulus panel.**

1. Choose a sense. `validSites` highlights the valid sites and greys the rest.
2. Pick a site on the figure (`sens-pick`) or from the keyboard list (`sens-site`).
3. `resolveSite` snaps the pick to a site record (rules §13). The S4–S5 perianal band, perineal sites and the pelvic-floor field are never pickable from any view; `dermatome.S3` is pickable only from posterior views (A.1; §13.12).
4. Apply. `makeStimulus` builds the A.6 record with `tOnset = tH_now + clock.descent(kh_now, k1)`, the stepwise descent sum H_desc of §11.7 (headless form (kh_now − k1)/ln 10), with k1 the A.4 target of the first packet edge of the picked site; then `clock.anticipate(tOnset)` is called and the stimulus is scheduled. The descent starts at once and reaches k1 at onset, with no wait at the slow target.
5. The episode ends by the B.9 rule; the adaptive clock rule (A.4) handles the rest.

Default sites, routes and returned responses per sense are §12's.

### B.12. Scenario player and scenario UI

`SCENARIOS` entries are plain objects in the §12 format (id, label, span, init, events, inputs(tH), keyframes, stages, checkpoints, brain-only form). `ScenarioPlayer` implements:

| Action | Behaviour |
|---|---|
| Select | Stops a running scenario; shows `scn-orgasm` only for `orgasm`; greys unavailable entries by mode (A.3.5). |
| Play | Reset the kernel, `settle(init)` (cached per init key), seed the streams (default 1 [model] or `?seed`), then run the span. Two Plays with the same switches give bit-identical traces (A.8 #25). |
| Stop | Inputs end; the scenario's clock source is released, so the adaptive rule applies again (A.4); states relax by their own dynamics. |
| Restart | Same as Play (habituation reset). |
| Repeat | Re-delivers the scenario's events from the current state without reset, at the §12 interval, which keeps habituation; offered for the scenarios §12 lists. |
| Seek | Restore the nearest kernel snapshot (taken every 10 % of the span, `Kernel.snapshot()`), then fast-forward to the target tH without rendering, in ≤ 8 ms slices (B.9; §12.2). Not offered for `orgasm` (Restart only). |
| Keyframes | Resolved at load into a slew-limited screen-time schedule in log space; each ramp starts early enough to reach its tH boundary (A.4 anticipation). A user lock overrides keyframes. The schedule affects display only, never traces. |
| Stage text | Neutral and clinical, every number with species and method, in the style of DOPAMINE.md §9.9; stage name in `phase-name`, text in Live. |

### B.13. The orgasm scenario

**Selection.** Choosing "Orgasm – dopamine" in Scenarios, or loading with `?scenario=orgasm`, calls `adapter.start()`. It resets `ResponseModel` with the seeded stream and resets `DopamineModel`, restores the `scn-orgasm` settings, shows the arousal and refractory meters and the Stimulate and Distract buttons (Space and D work as today), and flies the camera to the existing Dopamine system view unless a `view` URL parameter is set.

**Body during the scenario.** If the body is visible it stays static and neutral (A.8 #21; DOPAMINE.md §10 rule 7). Once the rule-7 amendment proposed in §11.18 is confirmed by the user (§13.18), the schematic streams `splanchnicPelvic` (S2–S4 anterior rami to `infHypogastric` [G Pelvic_splanchnic_nerves L33]), `supHypogastric`/`infHypogastric` and `pudendal` (S2–S4 [G Pudendal_nerve L30]), ending at the perineal midline (A.1), carry schematic, non-rhythmic activity markers, rate and speed not to scale (§13.9); until then they keep their resting display. Limb motion is off. The contraction rhythm appears only in the `pulses` row. HUD dimming and the auto-orbit stop at the climax apply only inside the scenario, through `adapter.climax`, which also covers the post-port phase id `onset` (DOPAMINE.md §9.8).

**Outside the scenario.** Both models are reset to rest and held dormant; `updateVisuals` keeps running in screen time, so the resting embers still twinkle. Dormancy depends on state (no orgasm scenario active), not on kh, as A.4 requires for striding. It also avoids the cost of the legacy 0.02-s dopamine substep at the slow presets (B.9). Stopping the scenario sets manual mode, level 0, and releases the clock delegate.

**Coupling.** With all networks on, the vitals pass through from `vitals()` (`response.js` L354–365), exactly (§11.14; A.8 #21; §7.13 V21). Only with a network switched off do the adapter's command records (fields §11.14) drive the CV layer, so the switches act on the vitals; in brain-only mode they read "—" (A.8 #10).

**Clock.** While the scenario is active and no user lock is set, `clock.delegate(adapter.clock)` makes kh equal to the scenario clock's value of the same frame (the legacy `LogRamp` before the port, the DOPAMINE.md §9.3 clock after it), and h = dt·kh is computed exactly as `response.js` does — **except in a frame that enters ONSET**, where the remainder of the frame runs at the new kh (DOPAMINE.md §9.3), so the frame covers less than dt·kh and `advance` reports the `tReachedH` and `khEnd` it actually reached (B.4, B.6 step 5). This keeps the instant switch at ignition (L146–147; the instant switch into ONSET after the port, DOPAMINE.md §9.3), which a slew-limited ramp could not reproduce: ignition depends on state, so it cannot be anticipated, and a ramp from ×10 to ×1 would pass more human time (B.9) than the whole reflex phase lasts. The delegate is exempt from the A.4 slew and range (A.4; §11.14). A CPU overrun never changes the delegate's kh; the kernel carries the remainder (B.6). A user lock replaces the delegate; traces then differ from the legacy path, as expected.

**Regression.** The harness (B.14) runs the legacy path and the adapter path of the same commit with the same seeded stream and compares every state variable at every human substep, and the vitals for exact identity with `vitals()` with all networks on; switched modes follow §12.14. Before the DOPAMINE.md §9.8 port the comparison uses the same frame-time sequence, because the legacy response model sizes its substeps from kh and runs the demo script in screen time, so the scenario stays frame-rate dependent and is excluded from the cross-frame-rate determinism test. Phase 0a (B.15) applies the port first, which adds the 0.05-s grid and input interpolation (DOPAMINE.md §6.8); the golden traces are recorded again then, and the DOPAMINE.md §6.9, §9.6 and §9.7 targets apply from that point.

### B.14. Tests

Run from `brain-system/` with `node --test` (default discovery of `**/*.test.mjs`) on Node 24. Tests import only DOM-free modules (`anatomy`, `brain`, `shaders`, `color`, `response`, `dopamine`, `sim/*`, `body/*`), helped by `package.json`. They seed every stream, sample the kernel in human time and keep golden traces in `test/golden/`.

| File | Covers | Pass criterion | Phase |
|---|---|---|---|
| `dopamine.test.mjs` | DOPAMINE.md §9.7 suite | as stated there | 0a (after the port) |
| `orgasm-regression.test.mjs` | legacy vs adapter state identity (same commit); exact vitals identity with `vitals()` with all networks on; switch behaviour of the adapter | A.8 #21; §12.13 R1; switched modes per §12.14; §11.14 semantics | 0, then 0a (re-recorded), then 5 for switched-mode vitals |
| `determinism.test.mjs` | all kernel states at shared tH samples at 10, 23.7, 30, 60, 144 and 240 fps, adaptive and locked clock (orgasm before the port excluded, B.13); switch ramps; master switch | max \|Δ\| = 0 (A.8 #25); A.5 | 2 onward |
| `latency.test.mjs` | §4.11 rows on the §2.14 lengths: N20, fingertip → S1, tibial N22, P30 and P37, patellar, Achilles; analytic overlay (§4) vs simulated arrivals | §4 tolerances; §12.20 rows 1–4 and 47–49 | 4 |
| `switches.test.mjs` | every A.5 row on a probe stimulus, every cross-network AND edge | A.5 outcomes; §12 switch-off matrix | 4–8 |
| `scenarios.test.mjs` | all §12 checkpoints | §12 tolerances | 2–8 |
| `geometry.test.mjs` | post-port neuron buffer per tier (seed 1848) bit-identical; uniform-slot count < 256 per program; body path lengths vs §2.14 (A.9 within 10 %); no ray from any §13.11 view or 1,000 random camera poses returns S4–S5, perineal or pelvic-floor sites, and `dermatome.S3` only from posterior views; no body points of excluded structures in the pelvic box (A.1); brainstem tube and pairwise nucleus checks of §3.16 | exact; A.9 tolerance | 0a, 1, 3 |
| `safety.test.mjs` | per-cell luminance in screen time for every frame of every §12 scenario, the startle volley, all switch toggles and view changes, at 10, 30, 60 and 144 fps (a subset of the §11.16 frame-rate set) and `kh` ∈ {preset, 0.005, 3,600} | the §13.15 per-cell area rule never exceeded (≤ 2 flashes per 1-s window); A.9 and §13 limits | 3 onward |
| `budget.test.mjs` | kernel ms per frame at each A.4 preset | reported against the §11 budget; not gating | 2 onward |
| `hud-static.test.mjs` | parses `index.html`: each `.drop-head` holds one `.drop-title`, at most one short chip (`.pill` or `.badge`) and `.chev`; nothing between `.drop-h` and `.drop-body`; titles match A.7; no Cyrillic or Uzbek-specific characters (ʻ, ʼ) in project text files | exact | 2 onward |
| Browser smoke check (preview) | `?scenario=hotObject&seed=1&quality=low`; `?body=0&scenario=orgasm` | no console errors; `window.__brain.kernel` advances | each phase |

### B.15. Phased build order

| Phase | Deliverables | Exit criteria |
|---|---|---|
| 0. Groundwork | `package.json`, `test/`; seeded stream, `advanceHuman` and `stimulusFor` in `response.js`; `src/clock.js` with the delegate; `OrgasmAdapter` driving today's brain-only app; golden traces of the legacy path | state identity in `orgasm-regression.test.mjs`; app unchanged to the eye |
| 0a. DOPAMINE.md port | the DOPAMINE.md §9.8 port in full: response model on the §9.3 0.05-s grid with ONSET, the closed-loop dopamine changes, and the §7.3 geometry and construction details (thalamus, putamen, pallidum, amygdala, hippocampus, caudate, insula ribbon, first `BRAINSTEM` point, `sdCerebellum`, A8, A13, A14 and `pituitaryGland` regions, voids); new golden images and traces | `dopamine.test.mjs`; R1 against the post-port legacy path; DOPAMINE.md §6.9 and §9.6 targets (§12.13 R3); §3.16 tube checks re-run (§3.16 values are already post-port) |
| 1. Brain state and additions | `statetex.js` (sided columns, rest-normalised activity), shader migration, `REGION_IDS` appended, `RELABEL`/`PARENT`, `generateBrainExtra`, area attribute (§3) | `geometry.test.mjs` (brain part); brain-only view unchanged from the post-port build apart from the additions |
| 2. Kernel and brain graph | `kernel.js` (EV, NF, CR), `graph.js` (brain), `brainnet.js`, `sensory.js` (special senses), `stimuli.js` (brain-only senses), `scenarios.js`; Time, Stimulus, Scenarios (orgasm moved) and Brain systems dropdowns; central forms of `loudSound`, `brightLight`, `stressor` | `determinism.test.mjs`, `hud-static.test.mjs` |
| 3. Body geometry and rendering | `body/frame.js`, `geometry.js`, `generate.js`, `picking.js`; body pass; camera limits and views; master switch and Body dropdown (network switches still inert); body after the first frame | `geometry.test.mjs` (body part), `safety.test.mjs` on the static figure and fades; adaptive quality stable at each tier |
| 4. Somatic | cord, roots and nerves in the graph; `somatic.js`, reflexes, limb motion; neural part of `hotObject`; `kneeJerk`; somatic switch; §6 interventions | `latency.test.mjs`; somatic rows of `switches.test.mjs`; §12 checkpoints of `kneeJerk` and the neural part of `hotObject` |
| 5. Autonomic and cardiorespiratory | `autonomic.js` with the baroreflex loop (carotid sinus and aortic arch afferents in IX and X → NTS → CVLM ⊣ RVLM → IML; NTS → nucleus ambiguus and DMV [G Baroreflex L35–L39]), respiration, pupil with the light reflex (retina → pretectal nuclei → Edinger–Westphal → ciliary ganglion → sphincter [G Pupillary_light_reflex L56–L59]), SCR, thermoregulation core; orgasm vitals from the CV layer in switched modes only (pass-through with all networks on); `standUp`; autonomic parts of `hotObject`, `loudSound`, `brightLight`; autonomic switch; §7 interventions | switched-mode vitals part of `orgasm-regression.test.mjs`; §12 checkpoints of `standUp`, `hotObject`, `loudSound`, `brightLight` |
| 6. Neuroendocrine | `endocrine.js`; full `stressor`; RAAS; adrenal AND edge; §9 interventions | §12 checkpoints of `stressor` and the RAAS part of `standUp` |
| 7. Enteric | `enteric.js`, `uGut`, gut rendering; `meal`; enteric switch | §12 checkpoints of `meal` |
| 8. Neuroimmune | `immune.js`, fever, sickness behaviour; `infection`; inflammatory reflex (efferent and contested status per A.8 #16; acetylcholine acting on α7 nicotinic receptors in the spleen [G Inflammatory_reflex L25–L31]); neuroimmune switch; §10 interventions | §12 checkpoints of `infection` |
| 9. Completion | optional scenarios; safety monitor audit; README and About disclosures; DOPAMINE.md rule-7 amendment (§11.18) and the pelvic markers, only if the user has confirmed them (§13.18) | all tests; manual review under reduced motion |

Every phase ends with `graphify update .` from `C:\Users\User\projects\galaxy`.

### B.16. Open questions

- **Clock delegation.** Settled: §11.14 and A.4 name the delegate's exemption from the slew and range (including recovery values above 3,600 with long refractory settings).
- **Port order.** Settled: Phase 0a applies the DOPAMINE.md §9.8 port before the body work, so the frame-driven golden traces of Phase 0 are used only until then. Doing the port inside Phase 0 would record the traces once.
- **Dopamine outside the orgasm scenario.** The two models are dormant outside the scenario. If §3 or §5 adds a phasic dopamine input for other stimuli (for example sweet taste), the dormancy rule needs a second wake condition and a cheaper substep at high kh.
- **Floor definition.** The §13 floors are read here per structure with a bilateral pair counted once. Counted per side, the low-tier floor would need up to twice the B.8 figure, beyond the §13 share.
- **Relabel inheritance.** Relabelled stars inherit the parent's dopamine channels through `PARENT`, so brain-only rendering stays unchanged. Should split structures such as `gpi` ever get dopamine channels of their own, DOPAMINE.md would need a mapping row.
- **Seed.** Scenarios use a fixed seed. Should a "vary seed" option show trial-to-trial variability?
- **Restart and Repeat.** Restart resets habituation and Repeat keeps it. Is that clear without explanatory subtitles?
- **Region texture width.** 256 texels hold the 122 sided regions of A.3.3 (244 columns); growth beyond 128 regions doubles the width.
- **HUD on phones.** Thirteen dropdowns are heavy below 760 px; §13 should decide whether some right-column dropdowns merge into tabs there.
- **Half-float uploads.** RGBA16F textures are fed from `Float32Array` for simplicity; packing to `Uint16Array` halves the JS-side transfer if profiling shows the upload matters.

### B.17. Sources

**Standards and specifications.** Khronos OpenGL ES 3.0 specification (minimum vertex uniform vectors, minimum texture size, minimum vertex texture image units, valid internal format and type combinations). WCAG SC 2.3.1 (the 2.2 and current 2.1 texts carry the same 341 × 256 CSS px note), via A.9 and §13.

**Raw captures** (`brain-system/raw/`): [G Baroreflex L35–L39]; [G Pupillary_light_reflex L56–L59]; [G Inflammatory_reflex L25–L31]; [G Pelvic_splanchnic_nerves L33]; [G Pudendal_nerve L30]. Graph checks with `graphify path`: Pretectal nucleus → Edinger–Westphal nucleus → Ciliary ganglion; Pelvic splanchnic nerves → Inferior hypogastric plexus; `Pudendal_nerve.md::Pudendal nerve` → Sacral plexus; `Vagus_nerve.md::Vagus nerve` → Spleen (through the enteric capture). The graph holds no direct baroreflex chain, so that route was read from the capture.

**Project files.** `brain-system/src/`: `main.js`, `response.js`, `dopamine.js`, `anatomy.js`, `brain.js`, `shaders.js`, `renderer.js`, `camera.js`, `performance.js`, `gl-utils.js`, `ui.js`, at the lines cited; `brain-system/index.html`, `brain-system/start.bat`; `brain-system/research/DOPAMINE.md` §6, §6.8, §9.1–§9.3, §9.7–§9.9, §10.

**Model checks** (not sources). Scratch prototype in `C:\Users\User\AppData\Local\Temp\claude\C--Users-User-projects-galaxy\641a402d-336b-4b93-bc5d-2e26265edfd2\scratchpad\research-simulation-architecture\`: `proto.mjs`, `run.mjs`, `results.txt` (identical traces at 23.7–144 fps with adaptive and fixed clocks; kernel cost per frame at kh 0.025–3,600).
