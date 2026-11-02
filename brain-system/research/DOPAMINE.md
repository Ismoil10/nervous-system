# Brain System — dopamine during the sexual response (orgasm scenario): analysis and design rationale

Status: canonical specification for `brain-system/src/dopamine.js`, `response.js` (as a port of the
corrected galaxy model) and the dopamine parts of `anatomy.js`, `brain.js`, `shaders.js` and the HUD.
The synthesis step that wrote this text could not save it, so the code was written against an
unsaved draft; this version restores that draft and revises it after successive fact-check rounds
of the text, the code and the literature. Where `src/` differs from this text, the text is canonical and §9.8
lists the change. Every number below either has a source or is marked as a model choice. Date:
2026-10-31.

**User decisions this text implements.** Dopamine plus its modulators (prolactin, GABA, opioids,
serotonin acting on dopamine) are shown in the model and in the HUD, the modulators with restrained,
labelled tints on their source nuclei (§1, §8.1); the HUD uses collapsible dropdowns without
secondary subtitle lines (§8.6, §9.5); all project files are in English; photosensitivity safety
and a lantern colour of at least 2,200 K are hard limits (§10).

**Section numbers cited from `src/`, `README.md` and `index.html`:** §2 anatomy, §3 kinetics, §4
evidence, §5 modulators, §6 dopamine model, §7 geometry and point budgets, §8 visual mapping and
colour, §9 implementation targets, §10 safety and uncertainty rules, §11 sources.

**Conventions.**

- Evidence tags: **[G file Lx]** a raw capture located through the knowledge graph (file prefix
  `en_wikipedia_org_api_rest_v1_page_html_` omitted; `brain-system/raw/` unless the folder is
  given); **author + year** peer-reviewed literature; **[T]** textbook knowledge, lower confidence;
  **[model]** a design or calibration choice of this project.
- Confidence: **high** (replicated, direct measurement), **medium** (single line of evidence or
  indirect), **low** (estimate, extrapolation or hypothesis).
- Species: **R** rat, **Ms** mouse, **Mk** macaque, **H** human. Almost every dopamine
  concentration and kinetic value in this document comes from rodents. Human evidence on dopamine
  during sexual activity is indirect only (§4.1).
- Coordinates: MNI-152 millimetres, x → right, y → anterior, z → superior. Bilateral structures
  are given for the right side; mirror x for the left.
- Companion documents: the whole-body response model is specified and fact-checked in
  `RESPONSE.md` §3–§7. Its corrected equations (§7.4–§7.9 there) are the
  **one canonical response model** of this project. `brain-system/src/response.js` is a copy of the
  galaxy code that still carries the pre-correction constants; it must be ported (§6.7). The
  dopamine model here **reads** that model; it does not re-derive arousal, vasocongestion, hormones
  or the phase machine. It writes back exactly one variable, the dopaminergic drive D (§6.7).

---

## 1. Purpose and framing

The visualisation shows a human brain built from tiny cool-white stars (neurons). Dopamine
release appears as warm amber lantern light that gathers around the release sites of the
dopaminergic terminal fields and spreads between the stars. The viewer follows dopamine through
the sexual response cycle: anticipation, excitement, plateau, the brief onset window before the climax
(a point of inevitability only with the emission setting), orgasm, resolution and recovery.

- **Primary layer: dopamine.** Seven A-groups (A8–A14) feed seven model populations: A8 is pooled
  with A9 (SNc), A10 is split into lateral and medial VTA, and A11, A12, A13 and A14 are one
  population each. They feed nine terminal compartments,
  modelled explicitly with firing rates, release, uptake, receptor occupancy and a
  reward-prediction-error term (§6). The response model's drive D is computed from this layer, so
  there is one dopamine signal, not two (§6.7).
- **Modulators act on dopamine and are shown with restrained, labelled tints.** Prolactin, GABA,
  endogenous opioids, serotonin and oxytocin enter the model only as terms on dopamine firing,
  release or recruitment (gain, recruitment, pauses, the TIDA brake; §5). Their activity appears as
  HUD gauges and, except oxytocin (gauge only), as low-chroma tints on the cool neuron stars of their
  source nuclei (for the pituitary, on the glandular haze sprites of the gland, which the
  neuron-star shader also draws): pituitary gland (prolactin, rose), raphe (serotonin, violet), RMTg
  and VTA (GABA, teal), PAG and arcuate (μ-opioid tone, sage). The tints are desaturated at least
  50 % toward grey, stay below the lantern chroma cap, are never amber and never touch dopamine
  lanterns, dopamine somata, release sites, tracts or any point that carries dopamine amber (the
  median eminence and stalk, which carry the TIDA dopamine glow, are a region of their own and are
  never tinted, §7.3), and the legend says they mark modulator activity, not dopamine (§8.1, §9.5).
- **What dopamine means here.** Mesolimbic dopamine is linked to motivation and anticipation
  (incentive salience, "wanting"; Berridge & Robinson 1998) and to reward-prediction error
  (Schultz, Dayan & Montague 1997), not to pleasure itself ("liking"; Berridge & Kringelbach 2015)
  [G Dopamine.md L64, L66; G Reward_system.md L21, L37]. The two accounts are distinct and partly
  competing; the model uses both (§6). The amber light therefore peaks with anticipation and
  approach and is not drawn as a "pleasure meter".
- **What the model is not.** Human dopamine has never been measured during sexual arousal or
  orgasm (§4.1). The model is a mean-field description calibrated on rat microdialysis and
  voltammetry and driven by an illustrative human response model. Its numbers are
  plausible-by-construction, not measurements of anyone, and the HUD says so.
- **Tone.** Clinical and non-explicit. In this scenario: no genital or sexual anatomy, no
  silhouettes or posed bodies, no suggestive shapes or wording. The neutral star-built body network
  of `research/ANALYSIS.md` may be shown as specified there; the dopamine scenario adds nothing
  below the brainstem except the labelled A11 beam toward the spinal cord (§10).

---

## 2. The human dopamine system

### 2.1. Cell groups

Catecholamine cell groups are numbered A1–A17. Dahlström & Fuxe 1964 named A1–A12 in rat; A13–A16
were added later and A17 is the retina (Björklund & Lindvall 1984; Björklund & Dunnett 2007). The
human brain has "more than 10 dopaminergic cell groups" [G Dopaminergic_pathways.md L25].

| Group | Location | Projection / role | Human count (both sides) | Used in model |
|---|---|---|---|---|
| A8 | retrorubral field, caudal and dorsolateral to SN | striatum and limbic targets (dorsal tier) | ~5–15 % of midbrain DA cells (Mk, H) | drawn; firing pooled with SNc |
| A9 | substantia nigra pars compacta (SNc) | nigrostriatal → dorsal striatum | 2.0–4.2 × 10⁵ (bilateral; Brichta & Greengard 2014, the source of [G Nigrostriatal_pathway.md L39]) | population **SNc** |
| A10 | ventral tegmental area (PN, PBP) plus midline IF, RLi, CLi; dorsocaudal extension into ventral PAG and dorsal raphe | mesolimbic, mesocortical, mesoamygdaloid, mesohippocampal | ~15–30 % of midbrain DA cells | populations **VTA-l**, **VTA-m** |
| A11 | dorsal posterior hypothalamus, periventricular grey | diencephalospinal (hypothalamospinal) tract, all spinal levels [G Dopaminergic_pathways.md L25, L43] | unknown (rodent ~10²–10³ per side) | population **A11** (rodent-derived) |
| A12 | arcuate (infundibular) nucleus | tuberoinfundibular → median eminence → portal blood → lactotrophs [G Tuberoinfundibular_pathway.md L21] | unknown | population **A12** (TIDA) |
| A13 | medial zona incerta | incertohypothalamic → MPOA, PVN, dorsomedial hypothalamus [G Incertohypothalamic_pathway.md L17] | unknown | population **A13** |
| A14 | rostral periventricular hypothalamus (incl. parvocellular PVN TH cells) | MPOA, PVN; portal blood | unknown | population **A14** |
| A15 | BNST, anterior/retrochiasmatic hypothalamus | local | unknown; human status uncertain | not drawn |
| A16 | olfactory bulb periglomerular interneurons | local interneurons | numerous; ~2× in Parkinson's disease (Huisman, Uylings & Hoogland 2004) | not drawn |
| A17 | retinal amacrine cells | local | — | not drawn |

**Model populations.** Seven A-groups (A8–A14) feed seven model populations: A8 is pooled with A9
(SNc; A8 is drawn but has no firing variable of its own), A10 is split into medial and lateral VTA
because the two halves differ in projection and physiology (§3.1), and A11, A12, A13 and A14 are one
population each. Wording in `README.md`, `index.html` and `dopamine.js` should say "seven A-groups
(A8–A14) feed seven model populations (A8 pooled with A9, A10 split in two)" (§9.8). A15–A17 are
omitted because they are local interneurons or retinal cells with no projection to the modelled
fields.

**VTA heterogeneity.** The VTA is an *area*, not a nucleus, because its borders with the SN are
indistinct in primates [G Ventral_tegmental_area.md L39]. Its PN and PBP subregions are rich in
dopamine cells, while the parafasciculus retroflexus area and the rostromedial tegmental nucleus
(RMTg, "tail of the VTA") contain few small TH⁺ cells [G Ventral_tegmental_area.md L49]. In rat
about 60–65 % of VTA neurons are dopaminergic, 30–35 % GABAergic and 2–5 % glutamatergic
(Nair-Roberts et al. 2008, R); the SNc is far more homogeneously dopaminergic. Human proportions are
unknown. A rodent mesohabenular projection releases glutamate and GABA, not dopamine [G
Ventral_tegmental_area.md L63].

**Primate tiers.** The VTA, PBP, calbindin-positive dorsal-tier SNc and A8 form a continuous
"dorsal tier" that projects to the ventral striatum, ventromedial caudate, cortex and limbic
structures. The calbindin-negative ventral tier of the SNc projects to dorsolateral sensorimotor
putamen and is the most vulnerable in Parkinson's disease [G Nigrostriatal_pathway.md L39–L45];
Haber, Fudge & McFarland 2000; Haber & Knutson 2010 (Mk, H).

### 2.2. Neuron counts and proportions

| Quantity | Value | Source | Species | Confidence |
|---|---|---|---|---|
| All neurons | 86 × 10⁹ (cerebellum 69 × 10⁹, cerebral cortex 16.3 × 10⁹, rest 0.69 × 10⁹) | Azevedo et al. 2009; [G Human_brain.md L46] | H | high |
| Midbrain DA neurons (A8 + A9 + A10, both sides) | 4–6 × 10⁵ (≈ 0.0005–0.0007 % of all neurons) | Björklund & Dunnett 2007 | H | medium |
| Same, rat / mouse | ~4 × 10⁴ / 2–3 × 10⁴ | Björklund & Dunnett 2007 | R, Ms | medium |
| SNc DA cells | 2.0–4.2 × 10⁵ TH⁺ cells, bilateral (≈ 1–2.1 × 10⁵ per side; mouse 8–12 × 10³) | [G Nigrostriatal_pathway.md L39]; its source, Brichta & Greengard 2014 (Fig. 1: "bilaterally") | H, Ms | medium |
| Pigmented SN neurons, controls | ~5.5 × 10⁵ (whether per side or bilateral must be checked before use as a per-side number) | Pakkenberg et al. 1991 | H | medium |
| Age-related loss of pigmented SN neurons | ~5 % per decade | Fearnley & Lees 1991 | H | medium |
| Split of midbrain DA cells | SNc (A9) ~60–75 %, A10 ~15–30 %, A8 ~5–15 %; the model uses 67 / 23 / 10 % | Hirsch, Graybiel & Agid 1988 (melanized neurons counted by group); François et al. 1999; exact percentages [T] | Mk, H | medium–low |
| Amygdala neurons | ≈ 1.2 × 10⁷ per side (one hemisphere counted in each of 10 brains) | Schumann & Amaral 2005 | H | medium |
| Hippocampal neurons | ≈ 4 × 10⁷ per side (granule cells 15, CA1 16, subiculum 4.5, CA3–2 2.7, hilus 2.0 × 10⁶) | West & Gundersen 1990 | H | medium |
| Striatum, thalamus, hypothalamus, brainstem neurons | order of magnitude only: ~10⁸, ~10⁷, ~10⁶–10⁷, ~10⁸ | [T] | H | low |
| Medium spiny neurons as share of striatal neurons | ~75–80 % in primates (rodent ~95 %) | Graveland & DiFiglia 1985; [G Striatum.md L73] gives the rodent value | Mk, H, R | medium |

Derived per-side estimate (2–3 × 10⁵ midbrain DA neurons per side, half the bilateral 4–6 × 10⁵,
× 67 / 23 / 10 %): SNc ~130–200 k, A10 ~45–70 k, A8 ~20–30 k (low confidence). This agrees with the
bilateral SNc count of 2.0–4.2 × 10⁵ (≈ 100–210 k per side), so the bilateral total and the HUD
value "1 DA cell star ≈ 170" stand. The star budgets of §7.5 use only the percentages. In primates
the SNc dominates; rodent ratios, with VTA and SN nearer parity, are not carried over. The current `anatomy.js` DA_GROUPS shares (VTA 0.30, SNc 0.52, A11 0.03, A12–A14
0.05 each) put the VTA at ~37 % of the midbrain somata, which is a rodent-like ratio; §7.3 gives the
corrected shares.

**Arbor size.** A single rat nigrostriatal axon covers on average ~2.7 % and up to ~6 % of the
striatum, with ~47 cm of axon (Matsuda et al. 2009; [G Nigrostriatal_pathway.md L45]). Each human
SNc neuron is estimated to form 1–2.4 × 10⁶ synapses (Bolam & Pissadaki 2012, extrapolation).
Visually, one source star lights a broad territory, never a single partner.

### 2.3. Pathways and targets

| Pathway | Source → target | Route | Role relevant here | Evidence |
|---|---|---|---|---|
| Mesolimbic | VTA → NAcc (shell, core), olfactory tubercle; minor → amygdala, hippocampus, septum | medial forebrain bundle (MFB) through lateral hypothalamus, lateral preoptic area, substantia innominata | wanting, anticipation, prediction error, approach | [G raw Mesolimbic_pathway.md L31, L39]; [G Dopaminergic_pathways.md L39, L54] |
| Mesocortical (meso- and nigrocortical in primates) | VTA (medial) → vmPFC, OFC, ACC; in primates also dorsal-tier SNc and A8, and the innervation is far more widespread than in rodents: motor and premotor cortex (areas 4 and 6) receive dense dopamine input, comparable to or denser than prefrontal cortex | MFB, then the anterior limb of the internal capsule (human "superolateral MFB") | salience, evaluation | [G Mesocortical_pathway.md L27]; Berger, Gaspar & Verney 1991; Williams & Goldman-Rakic 1998 (Mk); Coenen et al. 2012 |
| Nigrostriatal | SNc (+ A8) → putamen, caudate | MFB, fanning dorsolaterally through internal capsule and globus pallidus | motor vigour; not sex-specific | [G Nigrostriatal_pathway.md L43] |
| Incertohypothalamic | A13 (+ A14) → MPOA, PVN, DMH | short intrahypothalamic | autonomic and neuroendocrine integration "during sexual behaviour" | [G Incertohypothalamic_pathway.md L17]; Hull, Muschamp & Sato 2004 (R) |
| Tuberoinfundibular | A12 → external zone of the median eminence, where the axons end; dopamine then reaches anterior-pituitary lactotrophs through the long hypophyseal portal vessels | 3–5 mm axon, then a blood vessel; only tuberohypophyseal A12/A14 fibres run down the stalk, and they end in the intermediate and neural lobes, not the anterior lobe | tonic inhibition of prolactin via lactotroph D2 | [G Tuberoinfundibular_pathway.md L21, L23, L40]; [G raw Prolactin.md L40]; Ben-Jonathan & Hnasko 2001 |
| Diencephalospinal | A11 → dorsal horn, intermediolateral column, lumbosacral cord (spinal ejaculation generator, sacral parasympathetic nucleus) | descending ~45–50 cm in the periventricular grey and the dorsal longitudinal fasciculus beside the PAG, then the dorsolateral funiculus (rat) | spinal sexual reflexes (rodent) | [G Dopaminergic_pathways.md L43]; Skagerberg & Lindvall 1985 (R) |

**Simplifications.** The model draws and computes only the rows above. It omits the olfactory
tubercle and the septum/BNST targets of the mesolimbic pathway, VTA → olfactory bulb and SNc →
subthalamic nucleus [G Dopaminergic_pathways.md L39, L54–L58], and it has no separate dorsal-tier
SNc → cortex compartment: the primate motor/premotor innervation appears only as a visual weight on
the cortical field (§8.1), and the cortical compartment is fed from the VTA in the equations (§6.5).

Projections are **predominantly ipsilateral** ("project ipsilaterally", [G Nigrostriatal_pathway.md
L43]): each hemisphere has its own set of tracts. A sparse crossed nigrostriatal / mesostriatal
component (~1 % of labelled SN/VTA cells in rat, decussating in the ventral tegmental decussation;
Fass & Butcher 1981) exists and is not modelled. Medial DA cells project to medial and ventral
striatum and lateral SNc to lateral and caudal putamen, with a striato-nigro-striatal "ascending
spiral" from shell to core to ventromedial caudate to dorsolateral putamen (Haber, Fudge & McFarland
2000; Fallon & Moore 1978).

**Primate thalamus.** In primates, but not rodents, the midline, mediodorsal and intralaminar
thalamus receives substantial dopamine from hypothalamic, periaqueductal, ventral mesencephalic and
parabrachial DA neurons (Sánchez-González et al. 2005, Mk, H). This overlaps the
subparafascicular/intralaminar thalamus reported as activated at ejaculation in one PET study of
men (Holstege et al. 2003); the same group's re-analysis found that much of that pattern could not
be attributed to ejaculation (Georgiadis et al. 2007; §4.4).

**Terminal density ranking** (histology, tissue dopamine and PET; semi-quantitative): dorsolateral
putamen ≥ caudate ≈ NAcc core > NAcc shell ≈ olfactory tubercle ≫ central amygdala > basolateral
amygdala ≈ midline thalamus > cingulate and motor cortex > dorsolateral and orbital PFC >
hippocampus. Striatal tissue dopamine is ~3–6 µg/g wet weight, about two orders of magnitude above
neocortex (Kish, Shannak & Hornykiewicz 1988, H). Rat neostriatum holds ~0.1 DA varicosities per µm³
(≈ 10⁸ per mm³), the densest monoaminergic innervation in the brain (Doucet, Descarries & Garcia
1986, R).

| Target | Relative terminal weight w_true (putamen = 1) | Visual weight w_vis = √w_true (§8.3) |
|---|---|---|
| Dorsal striatum (putamen, caudate) | 1.0 / 0.8 | 1.0 / 0.89 |
| NAcc core / shell | 0.85 / 0.65 | 0.92 / 0.81 |
| Median eminence (local, TIDA) | 0.6 | 0.77 |
| MPOA / PVN | 0.3 / 0.25 | 0.55 / 0.50 |
| Amygdala (central / basolateral) | 0.3 / 0.15 | 0.55 / 0.39 |
| Midline thalamus, pallidum | 0.1 / 0.2 | 0.32 / 0.45 |
| Cingulate and motor cortex | 0.06 | 0.24 |
| PFC, OFC | 0.03 | 0.17 |
| Hippocampus | 0.02 | 0.14 |
| Other cortex | 0.01 | 0.10 |
| Cerebellum | ≈ 0 | 0 |

w_true is a synthesis (Berger, Gaspar & Verney 1991; Haber & Knutson 2010; Sánchez-González et al.
2005; numeric values [T], low confidence). Motor/premotor cortex is ranked above PFC because of the
primate pattern; the current `brain.js` DA_WEIGHT (frontal 0.06 against pfc 0.32) inverts it and
must change (§7.3). Hippocampal dopamine comes partly from locus coeruleus terminals that co-release
dopamine (Kempadoo et al. 2016; Takeuchi et al. 2016, Ms); this is not modelled, and the hippocampus
has no compartment of its own (it is drawn from the amygdala compartment with w_vis 0.14, §6.5, §8.1).

### 2.4. MNI coordinates and extents of every structure in the model

Values are centroids and half-extents (radii) of soft ellipsoids or tubes; small hypothalamic and
midbrain nuclei carry ±3–5 mm uncertainty. Linear MNI152 templates are larger than typical native
brains, by roughly 5–10 % per axis ([T], medium; Lancaster et al. 2007 quantify the related
MNI–Talairach difference); multiply lengths by ~0.93 and volumes by ~0.8 for native size. Volumes
quoted for real structures are typical adult native MRI or stereology values per side; the model's
ellipsoid volume (4/3·π·r_x·r_y·r_z) is given next to them where the two differ. **All model
volumes are MNI-space; compare model × 0.8 with native values.** Axis-aligned ellipsoids underfill
the real lens and wedge shapes of the basal ganglia and thalamus, and they cannot be inflated to
native MRI volumes around fixed centres without overlapping each other (§7.3); the shortfall is
accepted and disclosed, not closed by inflating the shapes.

**Dopamine sources**

| Structure | Centre (mm) | Half-extents / shape (mm) | Size | Source | Confidence |
|---|---|---|---|---|---|
| VTA (A10: PN, PBP) | (±4, −16, −12) | (3, 5, 3.5), Gaussian edge; envelope x 0…±8, y −10…−24, z −6…−18 | ~100–200 mm³ per side | [G Ventral_tegmental_area.md L35, L43]; D'Ardenne et al. 2008; Murty et al. 2014; Pauli, Nili & Tyszka 2018 | low |
| Midline IF / RLi / CLi | (0, −20, −11) | (2, 4, 3), single midline column | — | Halliday & Törk 1986 [T] | low |
| SNc (A9) | (±10.5, −18.5, −13), the midpoint of the drawn axis (code centre (±11, −18, −12)) | oblique band running anterolateral to posteromedial along the axis (±13, −13, −10) → (±8, −24, −16), 15–20 × 6–10 × 3–5 mm, dorsal to SNr above the cerebral peduncle; drawn as a rotated ellipsoid with half-axes 8.5 along (∓0.37, −0.81, −0.45), so its tips lie at (±13.7, −11.6, −9.2) and (±7.3, −25.4, −16.8) (the rostral tip 4.75 mm from the STN centre (±12, −13, −5)), 4 mediolateral along (±0.91, −0.41, 0) and 2 dorsoventral along (∓0.18, −0.41, 0.90); a half-length of 6.75 mm would end exactly at the two axis points (the code's axis-aligned (3.5, 7, 2.8) ellipsoid is a simplification, §7.3) | SNc ~100–200 mm³ per side (neuromelanin MRI); whole SN ~400–500 mm³ | [G Substantia_nigra.md L56]; Keuken et al. 2014 | low |
| A8 retrorubral field | (±10, −26, −13) | (2.5, 3, 2.5) | — | François et al. 1999 (Mk) [T] | low |
| A11 | (±3.5, −14, −5) | (1.5, 2, 1.5), on the ventricle wall, lateral to the third-ventricle lumen (at x ±3, 7.4 % of it lay inside a lumen of half-width 2 mm; at ±3.5, none); drawn inside a posterior hypothalamic / periventricular-grey ellipsoid (±3.8, −14, −5.2) r (1.8, 2.6, 2.0) that §7.3 adds (99.9 % of the A11 volume), because the brainstem filler that holds it in the code no longer reaches it (§7.2 item 6) | — | [T] | low |
| A12 arcuate | (±3, −7, −13) | (1.0, 2.6, 1.8), on the ventricle wall, lateral to the third-ventricle lumen (code (±2, −7, −13), (1.8, 2.6, 1.8): ~29 % of it inside the model lumen of half-width 2 mm (x within ±2) with its sloping floor, ~44 % with a flat floor at z −14) | — | Baroncini et al. 2012; Mai, Paxinos & Voss atlas [T] | low |
| A13 medial (rostromedial) zona incerta | (±7, −12, −5) | (2, 3, 1.8); medial ZI at the dorsal hypothalamic border, inside a rostromedial ZI ellipsoid (±7.2, −12, −4.8) r (2.5, 3.4, 2.0) that §7.3 adds (99.9 % of the A13 volume; the drawn whole-ZI ellipsoid, x 9.8–14.2, is lateral to it, and the site lies outside the thalamus and hypothalamus ellipsoids) | — | [T], extrapolated from rat and primate maps; A13 lies beside the dorsomedial hypothalamus and the mammillothalamic tract. The code's (±12, −16, −3) is the whole-ZI centroid in the lateral ZI, just above the subthalamic nucleus (±12, −13, −5), which is unlikely for A13; plausible range (±6–9, −11…−14, −4…−6) | low |
| A14 periventricular | (±2.8, −1, −9) | sheet r (0.8, 7, 5): x ±2.0–3.6, y +6…−8, z −14…−4, on the ventricle wall (code (±2.5, −1, −8) r (1.2, 4, 2.5); a sheet at x ±1–2.5 would lie ~57 % inside the lumen) | — | [T] | low |
| RMTg (GABA "brake", non-DA) | (±4, −28, −18) | (2, 3, 2) | — | [G Ventral_tegmental_area.md L49, L57] [T] | low |
| Landmarks: red nucleus, STN | (±5, −20, −8); (±12, −13, −5) | — | — | [T] | medium |

**Terminal fields and other model structures**

| Structure | Centre (mm) | Half-extents / shape (mm) | Volume (per side) | Source | Confidence |
|---|---|---|---|---|---|
| NAcc (shell + core) | (±10, +12, −8) | (5, 6, 4.5); extent x ±4…±16, y +4…+20, z −14…0 | 0.5–0.8 cm³ (model 0.57 cm³ MNI ≈ 0.45 cm³ native, slightly below) | Harvard–Oxford atlas; Pauli et al. 2018 | medium |
| NAcc core (sub-volume) | (±11.5, +12.5, −6.5) | (3.2, 4, 3.2); shell = remainder (medial and ventral) | — | [model] | low |
| Caudate | head (±13, +14, +8), body to (±18, −16, +22), tail curving into the temporal lobe; in MNI space the head reaches about y +25, a few mm behind the callosal genu | tube, radius 7 → 1.6 mm; the coded tube starts at the head centroid with a flat cap and stops at y ≈ 19, so add a leading point (±12, +23, +6, r 4.5) (§7.3) | 3.5–4.5 cm³ (code tube ≈ 3.7 cm³ MNI; with the leading point 4.7 cm³ MNI ≈ 3.7 cm³ native) | Harvard–Oxford | medium |
| Putamen | (±25, +2, 0); model (±26, 2, 3) | model (5, 18, 11) → 4.1 cm³ MNI (≈ 3.3 cm³ native; code (5.5, 15, 9) → 3.1 cm³); model extent x 21–31, y −16…+20, z −8…+14; atlas extent x ±16…±33, y −20…+22, z −10…+16 (an oblique lens, so an ellipsoid underfills the bounding box) | 4.5–5.5 cm³ | Harvard–Oxford; MRI volume [T] | medium |
| Globus pallidus | (±19, −4, 0); model (±18.5, −4, −1) | model (3.5, 9, 6) → 0.79 cm³ MNI (≈ 0.6 cm³ native; code (3.5, 8, 5) → 0.59 cm³) | ~1.5–2 cm³ | [T] | medium |
| Amygdala (central nucleus) | (±23, −4, −19); CeA (±22, −6, −14); model (±23, −4, −17) | model (7, 8, 7) → 1.64 cm³ MNI ≈ 1.31 cm³ native, inside the real range (code centre (23, −5, −18), same radii, overlapped by the hippocampal head, §7.3; moving the head alone removes the overlap, so the radii are not shrunk) | 1.2–1.8 cm³ | Harvard–Oxford | medium |
| Hippocampus | head (±25, −10, −20), body (±30, −26, −11), tail (±22, −38, +2); the head lies posteroinferior to the amygdala, separated by the uncal recess | tube, radius 5.5 → 3 mm (model control points §7.3) | 3–4.5 cm³ (model tube 2.8 cm³ MNI ≈ 2.2 cm³ native, below the real range; code tube 2.7 cm³ MNI) | Harvard–Oxford | medium |
| Thalamus | (±11, −18, +7); model (±11, −18, 8) | model (8.5, 16, 9.5) → 5.4 cm³ MNI (≈ 4.3 cm³ native; code (8, 15, 9) → 4.5 cm³); floor z −1.5, clear of the zona incerta; long axis rotated 15° about z, anterior pole medial, to keep ≈ 1.35 mm of internal capsule between thalamus and pallidum (§7.3) | 6–8 cm³ | [T] | medium |
| vmPFC / medial OFC | (±5, +42, −14) | cortical sheet; drawn in the code's `ofc` region (`corticalRegion` labels (5, 42, −14) `ofc`), not in `pfc` | — | meta-analytic convention [T] | medium |
| Lateral OFC | (±32, +40, −14) | cortical sheet | — | [T] | medium |
| Pregenual / dorsal ACC | (±4, +34, +18) | cortical sheet | — | [T] | medium |
| DLPFC | (±42, +32, +28) | cortical sheet | — | [T] | medium |
| Insula (anterior) | (±36, +16, 0); whole insula centre ≈ (±36, −4, +2); the insula spans about y −30…+25 | cortical sheet; the coded ribbon (centre (±36, −9, 2), y half-extent 17) spans only y −26…+8 and omits the anterior insula (§7.3) | — | [T] | medium |
| Hypothalamus (whole) | (±5, −3, −10); model (±5.5, −3, −10) | x ±2…±8, y +6…−14, z −15…−4; model (3.5, 9, 5), x ±2…±9, lateral to the third-ventricle lumen | 0.35–0.55 cm³ per side (bilateral ≈ 0.8–1.1 cm³; Klomp et al.; Peper et al.; Makris et al. 2013; Schindler et al. 2013); model ellipsoid 0.66 cm³ per side MNI ≈ 0.53 cm³ native, inside the real range (code (±5, −3, −10) r (4.5, 9, 5) = 0.85 cm³ MNI, 7.4 % of it inside the lumen) | MRI volumetry (Schindler et al. 2013, prior-study table); Baroncini et al. 2012 for position only | low–medium |
| MPOA | (±3.5, +4, −10); model (±4, +4, −10) | model (2.0, 3.2, 3) → 80 mm³, above the optic chiasm, rostral to the AC plane, lateral to the lumen (code (±3.5, +4, −10) r (2.6, 3.2, 3) → 105 mm³, 5.7 % inside the lumen); **enlarged for legibility** | a few mm³ to low tens of mm³ (human stereology, [T]) | [G Medial_preoptic_nucleus.md L47, L55]; [T] | low |
| PVN | (±3.5, −4, −6) | (1.5, 3, 2.4) → 45 mm³, dorsal sheet on the third-ventricle wall, lateral to the lumen (code (±3, −4, −6), (1.8, 3, 2.4) → 54 mm³); **enlarged for legibility** | a few mm³ to low tens of mm³ ([T]) | [G Paraventricular_nucleus_of_hypothalamus.md L42]; [T] | low |
| Arcuate (A12 region) | (±3, −7, −13) | (1.0, 3, 2) → 25 mm³, on the infundibular wall lateral to the lumen (code (±2, −7, −13), (2, 3, 2) → 50 mm³, ~28 % inside the model lumen of half-width 2 mm (x within ±2) with its sloping floor, ~42 % with a flat floor at z −14); **enlarged for legibility** | a few mm³ ([T]) | [T] | low |
| Median eminence | (0, −6, −15) | (2.5, 2.5, 1.5); with the stalk, region `medianEminence` (the ME dopamine compartment, never tinted; §7.3) | — | [T] | low |
| Pituitary (gland, not neurons) | (0, 0, −32) | (6, 4.5, 3); anterior lobe in the front two thirds (y ≈ −1…+4.5), posterior lobe behind it (y ≈ −4.5…−1); stalk (0, −6, −15) → (0, −1, −28); the gland haze is region `pituitaryGland` (prolactin tint, no dopamine amber; §7.3) | 0.5–1 g | [T] | low |
| Mammillary bodies (landmark) | (±3, −11, −14) | — | — | [T] | low |
| PAG | (0, −31, −8) | (6, 5, 6) around the aqueduct | — | [T] | low |
| Spinal target (lumbosacral) | off-frame, ~45–50 cm caudal | drawn as a beam leaving the medulla below z = −72 (the code labels points spinal below z = −64, §9.8) | — | [T] | — |

**Gross brain (procedural envelope)**

| Part | MNI extent / centre | Real size | Source | Confidence |
|---|---|---|---|---|
| Cerebrum | target x ±70; y −104 (occipital pole) … +70 (frontal pole); z −45 (temporal base; orbital surface ≈ −25) … +78. The procedural hull (`sdCerebrum`) measures 1,386 cm³ for both hemispheres (2 × 10⁶-sample Monte Carlo) with extents x −68…+68, y −103…+69, z −42…+76 (136 × 172 × 118 mm): MNI152 size | native cerebrum ~1,000–1,100 cm³ [T] (MNI-space hull × ~0.8 ≈ 1,110 cm³); whole brain 1,260 cm³ (men) / 1,130 cm³ (women) [G Human_brain.md L66]. The hull is MNI-sized, not a native adult volume | Mazziotta et al. 2001; Fonov et al. 2011 | medium |
| Cerebellum | target x ±49–52; y −36 … −92; z −14 … −65 (the inferior surface, lobules VIIIb/IX and the tonsils, reaches about z −60 to −70; medium confidence); hemispheres (±23, −63, −42). The code's `sdCerebellum` measures 124 cm³ MNI (≈ 99 cm³ native), x ±49, y −90…−36, z −58…−14: the width is realistic, but the cerebellum is 25–35 % too small as well as too shallow (inferior surface 5–10 mm too high; height 44 mm against ~50 mm). Cerebellum : cerebrum is 0.089 in the model against ≈ 0.12–0.15 real, independent of the scale factor. The MNI-space target is ≈ 160–185 cm³ (130–150 / 0.8), to be checked against the SUIT mask. The §7.3 change (inferior half lowered, tentorial carve) gives ≈ 137 cm³ MNI (≈ 109 cm³ native), z −65…−16, about a fifth to a third of the gap; the optional posterior enlargement of §7.3 gives ≈ 152 cm³ MNI | 130–150 cm³ native | Azevedo et al. 2009; [T]; check against the SUIT/MNI cerebellar mask | medium |
| Brainstem | midbrain (0, −24, −10), pons (0, −26, −30), medulla (0, −38, −55), cord junction (0, −45, −72) | 7.5–8 cm long | [T] | low |
| AC, PC | (0, +2, −4); (0, −24, −2); AC–PC ≈ 26 mm | — | Brett, Johnsrude & Owen 2002 [T] | medium |
| Third ventricle | real lumen x ±1–3, y ≈ +5 (lamina terminalis) … −26 (posterior commissure, pineal and suprapineal recesses, opening of the aqueduct), z from the floor to +8 (narrowest ventrally, at the infundibular recess); the floor lies near z −14 in front (infundibular recess, tuber cinereum) and rises behind the mammillary bodies toward the aqueduct. The model lumen stops at y −20 (floor z −4), because behind it the §7.2 brainstem tube leaves almost nothing to carve (0.2 % of its stars lie above z −4). Model lumen: x within ±2 mm, y +4…−20, z from a sloping floor to +8, with z_floor = −14 for y ≥ −6 and z_floor = −14 + (−6 − y)·10/14 behind it (−4 at y −20), so the lumen stays above the mammillary bodies and out of the midbrain. The periventricular dopamine groups, A11, the PVN, the arcuate, the MPOA and the hypothalamus ellipsoid sit lateral to it | — | [T] | medium |
| Corpus callosum | genu (0, +30, +5), body top (0, 0, +25), splenium (0, −40, +10) | 70–80 mm long | Aboitiz et al. 1992 [T] | low |
| Temporal pole | (±42, +18, −36) | — | [T] | medium |

The centroids in `brain-system/src/anatomy.js` are plausible and on the correct side (thalamus
±11, −18, 7; putamen ±25, 2, 1; pallidum ±19, −3, 0; NAcc ±10, 12, −8; amygdala ±23, −5, −18; VTA
±4, −16, −12 medial to SNc ±11, −18, −12; PAG 0, −31, −7; dentate ±15, −57, −35). The exceptions are:
the SNc is axis-aligned rather than oblique; A13 sits at the whole-ZI centroid; A8 and the midline
column are missing; after the ×0.8 conversion, thalamus, putamen and pallidum are 40–77 % below
typical MRI volumes (code; 26–68 % with the §7.3 radii), a shortfall that is accepted and
disclosed, not closed by inflating the ellipsoids, which would make the thalamus swallow the zona
incerta, push the pallidum into the putamen and close the internal capsule (§7.3 gives
non-overlapping radii); the small hypothalamic nuclei are enlarged (stated as schematic), and the
code's whole-hypothalamus ellipsoid (0.85 cm³ MNI) is larger than real (the §7.3 shape is in
range); the cerebellum is too small and too shallow; the cerebellar hull interpenetrates the
inferior temporal surface of the cerebrum (4.1 cm³, at y −59…−37; none of it occipital), and below
the occipital lobe an empty wedge of 12–15 mm at y −84 (8 mm at y −76) separates the cerebrum base
from the cerebellar top, where only the thin tentorium lies in reality; the hippocampal head tube
starts inside the amygdala ellipsoid (the two fields share ≈ 300 mm³, ≈ 18 % of the amygdala); the
caudate tube stops at y ≈ 19 and omits the anterior 6–8 mm of the head; the insula ribbon spans only
y −26…+8 and omits the anterior insula; the brainstem tube starts in the diencephalon at
(0, −16, 0), so brainstem-labelled stars fill the subthalamus around A11, A13 and the zona incerta
(moving it leaves A11 and A13 without tissue unless the two ellipsoids of §7.3 are added);
the cortical ribbon is also sampled on the surface of the inferior-medial notch, which is mostly not
cortex but the cut where hypothalamus, midbrain and pons emerge: about 4,000 cortical stars lie on
that surface at 240 k (≈ 2,500 of them at |x| ≤ 15 mm, −45 < y ≤ +5, all labelled `parietal`), and
≈ 1,200–1,300 cortical stars fall inside the midbrain, SN, PAG, hypothalamus and amygdala volumes,
so cool "cortex" stars mix with the dopamine sources; the A12, A14 and arcuate ellipsoids lie
partly inside the third-ventricle lumen, and the hypothalamus, MPOA and A11 ellipsoids by 5.7–7.4 %;
the tuberoinfundibular spline runs into the gland; and the A11 spline runs through the ventral
tegmentum. §7.2 and §7.3 list the changes.

### 2.5. Corrections to the raw captures

| Capture | Problem | Correction |
|---|---|---|
| [G Paraventricular_nucleus_of_hypothalamus.md L42] | "The PVN accounts for only about 1% of the brain volume" would be ~12 cm³, larger than the whole hypothalamus; "100,000 neurons in 0.5 mm³" (rat) looks high | Real PVN ≈ 0.002 % of brain volume; treat the rat count as unverified (~10⁴ is more usual [T]) |
| [G Substantia_nigra.md L58] | SNc "medial to the pars reticulata" | SNc lies dorsal (dorsomedial) to SNr |
| [G Striatum.md L73] | ~40 % of MSNs co-express D1 and D2 | Adult rodent histology finds co-expression mainly in NAcc shell and in a smaller fraction overall [T]; not used |
| [G Temporal_difference_learning.md] | the capture holds only navigation boilerplate (0 mentions of dopamine) | reward-prediction-error physiology taken from Schultz, Dayan & Montague 1997; Bayer & Glimcher 2005; Cohen et al. 2012 |
| [G Volume_transmission.md] | resolved to the Neuromodulation article | used only for "hundreds of milliseconds to several minutes" (L21) and the dopamine-system list (L56) |

A graph check found no path between the Prolactin node and the Ventral tegmental area node
(`graphify path`), consistent with the absence of a documented prolactin → mesolimbic link (§5).

---

## 3. Cellular physiology and kinetics

### 3.1. Firing

- **Pacemaking.** Isolated midbrain DA neurons fire slowly and regularly (~1–5 Hz) from intrinsic
  L-type Ca²⁺ (Cav1.3), HCN and Na⁺ leak currents, so a tonic baseline exists without input (Grace &
  Onn 1989; Bean 2007; Wilson & Callaway 1993; R).
- **Tonic and burst modes in vivo.** Irregular single spikes at 2–10 Hz (mean ~4–5 Hz) alternate with
  bursts of 2–10 spikes at 15–30 Hz lasting ~100–300 ms. Classic burst criterion: onset at an
  interspike interval ≤ 80 ms, end at ≥ 160 ms (Grace & Bunney 1984a, 1984b; R).
- **Population activity.** In anaesthetised rat about half of VTA DA neurons are silent, held off by
  tonic ventral-pallidal GABA. Tonic extracellular dopamine follows the *number* of active neurons
  (ventral subiculum drive); phasic dopamine follows bursting (PPTg glutamate) (Floresco et al. 2003;
  Grace 1991; R). The model therefore carries most of the tonic change in recruitment, not in
  per-cell rate.
- **Phasic responses.** Unexpected rewards and reward-predicting cues evoke short bursts at 50–110 ms
  latency, ≤ 200–300 ms long; omitted rewards produce pauses of a few hundred ms (Schultz, Dayan &
  Montague 1997; Schultz 1998; Mk). Positive errors are coded roughly linearly in rate, negative
  errors with a compressed range because of the low baseline (Bayer & Glimcher 2005; Mk).
- **Human recordings** exist for monetary reward only: SN neurons in Parkinson's patients (Zaghloul
  et al. 2009) and sub-second striatal voltammetry tracking prediction errors (Kishida et al. 2016).
  None during sexual activity.
- **Bursts need glutamate.** NMDA-receptor input from PFC, PPTg/LDTg, lateral hypothalamus, preoptic
  area and PAG drives bursts; GABA from NAcc, ventral pallidum, dorsal raphe, lateral hypothalamus,
  PAG, BNST and the RMTg restrains firing; the lateral habenula drives the RMTg to pause DA neurons
  after negative events [G Ventral_tegmental_area.md L55, L57]; Jhou et al. 2009; Matsumoto &
  Hikosaka 2007.
- **Medial vs lateral VTA.** Mesoprefrontal and medial-shell-projecting neurons (medial/posterior
  VTA) fire faster, have little DAT, small Ih and no impulse-regulating autoreceptors, and respond to
  salient and aversive events; lateral VTA neurons projecting to the lateral shell carry the classic
  prediction error (Chiodo et al. 1984; Lammel et al. 2008, 2011; R, Ms). The model splits the VTA
  into **VTA-l** and **VTA-m** for this reason.
- **VTA GABA neurons** encode expected reward and subtract it from DA output (Cohen et al. 2012;
  Eshel et al. 2015; Ms).
- **Conduction.** DA axons are thin and unmyelinated (~0.5–1 m/s [T]): VTA → NAcc ≈ 35–40 mm path
  (35–80 ms), VTA → DLPFC ≈ 90–100 mm (100–200 ms), A11 → sacral cord ≈ 45–50 cm (0.5–1 s). These
  delays are invisible at every clock of the model.

### 3.2. Release

- One vesicle holds ~3,000 dopamine molecules (Pothos, Davila & Sulzer 1998; R).
- Only ~30–40 % of striatal varicosities form classical synapses and ~20–30 % carry active-zone-like
  release machinery, so release per action potential is sparse (Descarries et al. 1996; Liu et al.
  2018; Pereira et al. 2016; R, Ms).
- Bursts release disproportionately more dopamine than the same number of regular spikes, because
  uptake saturates locally and release facilitates (Gonon 1988; R). In the model this supralinearity
  emerges from Michaelis–Menten uptake.
- **Short-term plasticity** (Montague et al. 2004, Table 1, freely moving rat, striatum, irregular
  trains, mean ± SEM, n = 6): release a₀ = 20 ± 2 nM per pulse awake (60 nM anaesthetised);
  facilitation k₁ = 1.010 ± 0.001, τ₁ = 5.45 ± 0.47 s; short-term depression k₂ = 0.984 ± 0.008,
  τ₂ = 4.38 ± 0.28 s. A third, long-term depression has τ₃ ≥ 10 min (≈ 14 min anaesthetised); no
  k₃ is reported. In the paper each factor is multiplied by k at every impulse and relaxes back to 1
  with first-order kinetics, dI/dt = (1 − I)/τ, I ← k·I at each impulse. This model uses a
  **log-domain variant**, d lnF/dt = ν·ln k − lnF/τ (§6.4 (6)), which stays bounded at any rate. Its
  net steady state is ρ/ρ₀ = exp(−0.0164·(ν − ν₀)) (0.94 at a sustained 8 Hz for ν₀ = 4 Hz). The
  published form gives net facilitation instead (×1.13 at 8 Hz relative to 4 Hz) and diverges for a
  sustained ν ≥ 1/(τ₁·ln k₁) ≈ 18 Hz, which the population ceiling of 20 Hz would reach. The model
  keeps only the facilitation and the short-term depression (§6.5).
- **Synthesis is not limiting.** Tyrosine hydroxylase is near substrate saturation at normal brain
  tyrosine; D2 autoreceptors reduce synthesis through Gi/cAMP (Daubner, Le & Wang 2011; [G
  Dopaminergic_pathways.md L29]). Vesicle depletion over a 10–60 min episode is not modelled.

### 3.3. Uptake and clearance

- **DAT, Michaelis–Menten.** dC/dt = release − V_max·C/(K_m + C); in vivo apparent K_m ≈ 0.2 µM;
  caudate–putamen V_max ≈ 3–4 µM/s; NAcc lower, shell lower than core (Wightman & Zimmerman 1990;
  Garris & Wightman 1994; Jones et al. 1995; Jones, O'Dell, Marshall & Wightman 1996; Wu et al.
  2001; R). The DAT protein itself [G Dopamine_transporter.md L33].
- **Cortex and amygdala.** Release rate constants are ~8× and uptake rate constants ~50× lower in
  both mPFC and basolateral amygdala than in caudate–putamen and NAcc, yet 10–20 Hz stimulation
  evoked similar extracellular levels in all four regions (Garris & Wightman 1994); estimates of the uptake difference
  range 10–80× between studies (Cass & Gerhardt 1995). DAT is sparse and extrasynaptic there, and the
  noradrenaline transporter clears much of the dopamine (Sesack et al. 1998; Morón et al. 2002).
- **Metabolism.** Striatal dopamine is mostly re-taken and either repackaged by VMAT2 or broken down
  by intraneuronal MAO; in PFC, COMT is important (COMT knockout and tolcapone raise frontal, not
  striatal, dopamine) (Gogos et al. 1998; Tunbridge et al. 2004; Karoum, Chrapusta & Egan 1994;
  [G Dopamine.md L45]).
- **Hypothalamus and median eminence.** TIDA dopamine is cleared by portal blood flow, not DAT
  (Ben-Jonathan & Hnasko 2001). Hypothalamic clearance constants are not measured; the model uses
  slow linear clearance (§6.5, assumption).

### 3.4. Diffusion and volume transmission

Neuromodulator actions through G-protein-coupled receptors last "hundreds of milliseconds to
several minutes" [G Volume_transmission.md L21]. With extracellular tortuosity λ ≈ 1.6 and volume
fraction α ≈ 0.2, dopamine's effective diffusion coefficient is D* ≈ 2.5–3 × 10⁻⁶ cm²/s; one
quantum activates receptors within a sphere of ~7–8 µm radius, and a transient spreads ~10 µm before
striatal uptake removes it (Nicholson & Syková 1998; Cragg & Rice 2004; Rice & Cragg 2008; R). The
spread radius r ≈ √(6 D* τ_clear) with τ_clear at C₀ is ~9–10 µm (dorsal striatum), ~11–12 µm
(core), ~16–18 µm (shell), ~39–48 µm (PFC, amygdala), ~70–77 µm (hypothalamus) and ~87–95 µm
(median eminence). **Real dopamine diffusion is
therefore invisible at brain scale.** The millimetre-scale lantern spread in the visualisation stands
for *population recruitment* (the share of release sites in a field that are active), with a
region-specific persistence taken from τ_clear (§8.3). The About text states this.

### 3.5. Receptors and autoreceptors

- **Abundance.** D1 > D2 > D3 > D5 > D4; D1 and D2 are 10–100× more abundant than D3–D5 [G
  Dopamine_receptor.md L33].
- **Affinity.** Most D1 receptors are in a low-affinity state (EC₅₀ ≈ 1 µM); D2 in the high-affinity
  state binds at ~10–25 nM; D3 tighter still (Richfield, Penney & Young 1989; Sokoloff et al. 1990;
  Dreyer et al. 2010; R).
- **Occupancy.** With the high-affinity-state K_d of 10 nM used in rodent-based modelling, tonic
  10–20 nM occupies 50–67 % of D2 receptors (60 % at 15 nM) and D1 ~1–2 % (volume average); D1
  occupancy rises substantially only near release sites during bursts. These are modelled values,
  not measurements. The classic "D1 detects
  phasic, D2 detects tonic and pauses" split (Dreyer et al. 2010) is contested: striatal D2 receptors
  also respond quickly to phasic release (Marcott, Mamaligas & Ford 2014), and with abundance and
  kinetics included D1 and D2 populations respond similarly (Hunger, Kumar & Schmidt 2020). The model
  exports both occupancies but does not give the two receptor classes separate colours.
- **Human PET caveat.** AMPT depletion raised striatal [¹²³I]IBZM binding by 28 ± 16 % (SPECT,
  n = 9; Laruelle et al. 1997), implying that only ~10–30 % of striatal D2 receptors are occupied by
  endogenous dopamine (≈ 22 % at the mean; Laruelle 2000), far below the microdialysis-based model
  estimate. The HUD's "D2 occupancy" is the rat-calibrated model value and is labelled so.
- **Somatodendritic D2 autoreceptors** (D2Sh, presynaptic [G Dopamine_receptor.md L49]) produce a
  GIRK-mediated IPSC lasting ~0.5–1 s after dendritic release, a short negative feedback on firing;
  autoreceptors are ~6–10× more agonist-sensitive than postsynaptic receptors (Beckstead et al. 2004;
  Skirboll, Grace & Bunney 1979; R, Ms).
- **Terminal D2 autoreceptors** depress release maximally 150–300 ms after a short burst, and the
  effect is gone within ~0.6–0.8 s (anaesthetised mice; Benoit-Marand, Borrelli & Gonon 2001);
  deleting them raises release and motivation (Bello et al. 2011). The model's binding rates give a
  slower time constant (≈ 1.1 s at rest, §6.5). TAAR1 opposes D2 autoreceptor action on DAT [G Autoreceptor.md L29, L35].
- Mesocortical terminals lack synthesis-modulating autoreceptors (Chiodo et al. 1984); TIDA neurons
  lack typical D2 autoreceptor control (Ben-Jonathan & Hnasko 2001).

### 3.6. Extracellular concentrations

| Region | Tonic (rat) | Method / source | Confidence |
|---|---|---|---|
| Striatum, NAcc | ~5–20 nM (NAcc ~4–5 nM by no-net-flux) | microdialysis; Parsons & Justice 1992 | medium |
| Same | ~90 nM | FSCAV; Atcherley et al. 2015 | low (method-dependent) |
| PFC | ~0.5–2 nM | microdialysis [T] | medium |
| Phasic transients, NAcc | ~30–200 nM near the electrode; rise 0.1–0.3 s, decay 0.5–1.5 s including electrode lag. Sexual-behaviour transients: 200–500 nM, 200–900 ms at the female's presentation and approach (Robinson et al. 2001); mean 210 nM, 530 ms (125 transients, 17 male rats; Robinson, Heien & Wightman 2002) | FSCV; Robinson et al. 2001; Robinson, Heien & Wightman 2002; Phillips et al. 2003; Wightman et al. 2007 | medium |

The choice of tonic level changes the meaning of the D2 channel (0.50–0.60 occupancy at 10–15 nM
vs 0.90 at 90 nM, with K_d = 10 nM). The model uses the microdialysis range. FSCV electrodes record
transients near release sites, whereas each model compartment is a volume average over a whole
field in which only part of the release sites are recruited, so model transients are smaller (tens
of nM, §6.9 row 4); the model's transient size is therefore calibrated loosely, not against the
electrode values.

### 3.7. Parameter table

| Parameter | Value | Unit | Region | Source | Species | Confidence |
|---|---|---|---|---|---|---|
| Tonic rate, lateral VTA / SNc | 4 | Hz (population mean) | VTA-l, SNc | Grace & Bunney 1984 | R | high |
| Tonic rate, medial VTA | 5 | Hz | VTA-m | Chiodo et al. 1984 (faster mesocortical cells) | R | medium |
| Tonic rate, A11–A14 | 2 | Hz | hypothalamic groups | assumption | — | low |
| Fraction of DA neurons active at rest | ~0.5 | — | VTA | Floresco et al. 2003 | R | medium |
| Intraburst rate; spikes per burst | 15–30; 2–10 | Hz; — | midbrain | Grace & Bunney 1984 | R | high |
| Phasic latency; duration | 50–110; ≤ 200–300 | ms | midbrain | Schultz 1998 | Mk | high |
| Population-mean soft ceiling ν_sat | 20 | Hz | midbrain | [model]: ν is a population mean; bursts are a few spikes at 15–30 Hz lasting < 0.5 s and not every neuron bursts (Grace & Bunney 1984), so a population mean of 30 Hz for ~1 s is implausible | — | low |
| Pause floor (population) | 0.5 × tonic | — | midbrain | [model]; negative errors have a compressed range (Bayer & Glimcher 2005) | Mk | low |
| Facilitation k₁, τ₁ | 1.010, 5.45 | —, s | striatum | Montague et al. 2004, Table 1 (irregular trains, n = 6); used in a log-domain variant (§6.4 (6)) | R | medium |
| Short-term depression k₂, τ₂ | 0.984, 4.38 | —, s | striatum | Montague et al. 2004, Table 1; the long-term depression (τ₃ ≥ 10 min, no k₃ reported) is omitted, §6.5 | R | medium |
| Release per pulse a₀ | 20 (awake), 60 (anaesthetised) | nM | striatum | Montague et al. 2004, Table 1; not used directly (the model derives q from C₀, §6.5) | R | medium |
| K_m (DAT, apparent) | 0.2 | µM | all DAT regions | Wightman & Zimmerman 1990; Montague et al. 2004 | R | high |
| V_max | 4.0 / 2.5 / 1.2 | µM/s | dorsal striatum / NAcc core / shell | Garris & Wightman 1994; Jones et al. 1996; Wu et al. 2001 (representative values) | R | medium |
| V_max (cortex, amygdala) | 0.1 | µM/s | mPFC, BLA | Garris & Wightman 1994; Cass & Gerhardt 1995 | R | low |
| Linear clearance (NET, COMT, diffusion) | 0.5 / 0.3 / 0.1 | s⁻¹ | PFC / amygdala / striatum | Morón et al. 2002; [model] | R | low |
| Linear clearance, hypothalamus; median eminence | 0.3; 0.2 | s⁻¹ | MPOA, PVN, cord; ME | assumption (portal flow for ME) | — | low |
| Clearance time τ_clear = 1/(V_max/(K_m+C₀) + k_l) | 0.055 / 0.085 / 0.18 / 1.0 / 1.3 / 3.3 / 5 | s | dStr / core / shell / PFC / amygdala / hypothalamus / ME | derived | R | medium |
| Tonic concentration C₀ | 20 / 15 / 15 / 2 / 5 / 5 / 5 / 20 / 2 | nM | dStr / core / shell / PFC / amygdala / MPOA / PVN / ME / cord | Parsons & Justice 1992; [model] for hypothalamus, ME, cord | R | medium–low |
| Effective diffusion D* | 2.5–3 × 10⁻⁶ | cm²/s | brain | Nicholson & Syková 1998 | R | medium |
| Quantal size | ~3,000 | molecules | midbrain neurons | Pothos, Davila & Sulzer 1998 | R | medium |
| Varicosity density | ~0.1 | µm⁻³ | neostriatum | Doucet, Descarries & Garcia 1986 | R | medium |
| D1 K_d (low-affinity state) | 1,000 | nM | striatum | Richfield et al. 1989; Dreyer et al. 2010 | R | medium |
| D2 K_d (high-affinity state) | 10 | nM | striatum | Dreyer et al. 2010 (rodent-based modelling; the low-affinity state binds far more weakly) | R | medium |
| Terminal autoreceptor K_d; τ | 30; ≈ 1.1 at rest in the model (measured effect gone within ~0.6–0.8 s) | nM; s | striatum | Benoit-Marand et al. 2001 (time course); K_d and rates [model] | Ms | low |
| Somatodendritic IPSC duration | ~1 | s | midbrain | Beckstead et al. 2004 | R, Ms | high |
| Conduction velocity | 0.5–1 | m/s | DA axons | [T] | R | low |
| TIDA oscillation period | ~20 | s | arcuate | Lyons, Horjales-Araujo & Broberger 2010 (synchronised oscillation in slices); used as a ±8 % modulation of A12 drive, in-vivo relevance unknown | R | medium (period); low (use) |

---

## 4. Dopamine across the sexual response cycle and orgasm

### 4.1. Evidence classes and their limits

| Class | What it measures | Time resolution | Species | Limits |
|---|---|---|---|---|
| Microdialysis | extracellular dopamine (tonic) | 1–15 min bins | R (mostly male) | cannot resolve the climax |
| Fast-scan cyclic voltammetry (FSCV) | sub-second transients near the electrode | ~0.1 s | R (male) | sparse data around ejaculation; electrode lag |
| [¹¹C]raclopride PET | displacement of D2 binding (5–15 % for rewards) | minutes | H | **no study of orgasm known**; one nonhuman-primate study (n = 4, amphetamine 0.2 and 0.4 mg/kg, simultaneous microdialysis) found a mean ratio of ~44 % extracellular rise per 1 % binding reduction at 0.2 mg/kg (Breier et al. 1997); natural rewards give far smaller signals |
| H₂¹⁵O PET, fMRI | regional blood flow / BOLD, not dopamine | 2-min scans, ~20–90 s analysis windows (PET), ~2 s (fMRI) | H | effective PET resolution ≈ 11 mm (scanner 4.5 mm plus 10-mm smoothing in Holstege et al. 2003) against a VTA ~5–8 mm across: cannot separate VTA from SN, zona incerta and thalamus |
| Pharmacology | effects of agonists, antagonists, reuptake inhibitors | days | H, R | indirect |

**Human dopamine release during sexual arousal or orgasm has never been measured directly.** Every
statement about human timing is inferred from blood flow, BOLD, pharmacology or rat data
(`RESPONSE.md` §5.1, §6 caveats).

**Key studies by species, sex, method and sampling interval.** Every number used in §4 and in the
HUD comes from one of these rows and keeps its species tag.

| Study | Species, sex | Method (sampling) | Finding used here |
|---|---|---|---|
| Pfaus et al. 1990 | rat, male | microdialysis, NAcc and striatum (samples of several minutes) | NAcc dopamine rises with a receptive female behind a screen, before contact, and further during copulation |
| Damsma et al. 1992 | rat, male | microdialysis (samples of several minutes) | NAcc rise larger than dorsal striatum; not reproduced by forced locomotion, a novel chamber or odours |
| Fiorino, Coury & Phillips 1997 | rat, male | microdialysis, NAcc, 15-min samples | +44 % with the female behind a screen, +95 % in the first copulation sample; stays raised through copulation and returns to baseline only after 30 min without mounting (satiety, 7.8 ± 0.5 ejaculations in ~2.4 h); DOPAC and HVA stay raised; renewed copulation with a novel female raises it again (+34 %), her presentation behind a screen alone does not (+12 %, n.s.). The samples cannot resolve a single post-ejaculatory interval |
| Robinson et al. 2001 | rat, male | fast-scan cyclic voltammetry, NAcc (~0.1 s) | sub-second transients (200–500 nM, 200–900 ms) linked mainly to the female's presentation and to approach; no ejaculation-locked transients were reported |
| Robinson, Heien & Wightman 2002 | rat, male | FSCV, dorsal and ventral striatum | 125 transients in 17 rats (210 ± 10 nM, 530 ± 20 ms); ~6-fold more frequent at conspecific introduction, habituating; during copulation ~20 % of that frequency, some immediately before intromissions |
| Mermelstein & Becker 1995 | rat, female | microdialysis, NAcc and striatum (samples of several minutes) | larger rise when the female paces copulation |
| Hull et al. 1995 | rat, male | microdialysis, MPOA (samples of several minutes) | MPOA dopamine rises before and during copulation in males that copulate |
| Lorrain et al. 1997 | rat, male | microdialysis of LH and MPOA serotonin (6-min samples) | LH (anterior LHA) 5-HT measured in 6-min samples (n = 7) through four ejaculatory series: PEI samples pooled were significantly above baseline, copulation and post-copulation; individually significant only in the 2nd and 3rd PEI (the 1st PEI sample was measured but not significant on its own); MPOA 5-HT unchanged; an LH SSRI (alaproclate) impaired copulation; NAcc dopamine not measured |
| Lorrain et al. 1999 | rat, male | microdialysis of NAcc dopamine (3-min samples, Exp. 1); reverse dialysis of 5-HT into the anterior LH (10-min samples, Exp. 2) | NAcc dopamine high during copulation and falling after each ejaculation (copulation samples above both baseline and post-ejaculatory samples; no post-ejaculatory–baseline difference reported; n = 6), confirming earlier electrochemical recordings; reverse dialysis of 5-HT into the anterior LH lowered NAcc dopamine below its pre-perfusion baseline and abolished the female-evoked rise (Exp. 2); a post-ejaculatory fall below pre-test baseline is not reported (Exp. 1) |
| Holstege et al. 2003 | human, male, 11 recruited, 8 ejaculations analysed | H₂¹⁵O PET, 2-min scans, 20-s analysis windows, 10-mm smoothing | mesodiencephalic activation at ejaculation (blood flow, not dopamine); no timing before the climax |
| Georgiadis et al. 2007 | human, male (re-analysis); female (method test) | H₂¹⁵O PET; the 2003 20-s-versus-120-s method tested on a newer data set (11 women, motor-imitation and clitoral-stimulation scans), and the original 2003 male data re-analysed with equal 120-s images | comparing 20-s with 120-s images of the same condition reproduced most of the 2003 pattern, which was therefore "largely artefactual": the clusters in the midbrain (VTA), thalamus, striatum, cerebellar hemispheres and parts of the neocortex can no longer be attributed to ejaculation (the left dentate cluster was not reproduced by the method test and is kept as a true feature). In the re-analysis only decreases survived correction (prefrontal cortex, and to a lesser extent posterior parietal cortex); increases appeared only at uncorrected P < 0.001, in the left deep cerebellar nuclei (dentate), a left lateral rostral midbrain / internal pallidum / ventral thalamus cluster, the anterior vermis and the pons. The 120-s images include late plateau and early resolution, so the authors call these changes ejaculation-related, not ejaculation-specific |
| Georgiadis et al. 2006 | human, female (12) | H₂¹⁵O PET | orgasm mainly associated with neocortical blood-flow decreases, particularly left lateral OFC, inferior temporal gyrus and anterior temporal pole; the deep cerebellar nuclei appear only as a correlation with rectal-pressure variability, the ventral midbrain and right caudate as correlations with perceived sexual arousal |
| Wise, Frangos & Komisaruk 2017 | human, female (10) | fMRI BOLD (~2 s) | NAcc, VTA region and other areas rise toward orgasm and decline afterwards; no region decreased (orbitofrontal and other frontal regions rose); BOLD, not dopamine |
| Komisaruk et al. 2004 | human, female with spinal cord injury (3 of 5 reached orgasm) | fMRI BOLD | frontal, anterior cingulate, parietal and insular cortex, cerebellum and the paraventricular region activated at orgasm; BOLD, not dopamine |
| Weintraub et al. 2010 | human, Parkinson's disease, both sexes | cross-sectional survey | dopamine agonists associated with impulse-control disorders, including compulsive sexual behaviour; indirect |

### 4.2. Anticipatory (appetitive) phase

- The anticipation of most rewards increases brain dopamine [G Dopamine.md L64]; mesolimbic firing
  rises in anticipation [G raw Mesolimbic_pathway.md L39]. Wanting maps to
  appetitive, approach and anticipatory behaviour [G Reward_system.md L21, L37].
- **Rat, male.** NAcc dopamine rises significantly when a receptive female is presented behind a
  screen, before contact, and rises further during copulation, to roughly 1.4–2× baseline in
  microdialysis samples several minutes long; dorsal striatal dopamine rises only during copulation
  and less. A multi-intromission rat session is an analogy for the human plateau, not a
  measurement of it. Forced locomotion, a novel chamber and sex odours alone do not
  reproduce it (Pfaus et al. 1990; Damsma et al. 1992). Voltammetry showed the NAcc signal rising to
  ~170 % of baseline in copulating males, much less with non-receptive females or males (Mas et al.
  1990). FSCV recorded sub-second NAcc transients at the female's introduction and during approach
  (Robinson et al. 2001); no ejaculation-locked transients were reported. Transient frequency rose
  ~6-fold when any conspecific was introduced and habituated with repetition; during copulation
  transients were rarer (~20 % of the introduction rate), some immediately before intromissions
  (Robinson, Heien & Wightman 2002). The phasic signal is therefore tied
  to **cue onset** (the partner's presentation), not to the start of genital stimulation. The model
  has no cue input, so its opening transient is triggered by stimulation onset and stands in for
  this anticipatory cue signal (§6.6).
- **MPOA, male rat.** MPOA dopamine rose during pre-copulatory exposure in every male that went on
  to copulate and kept rising during copulation; not in non-copulating castrates, with another male
  or with wheel running; testosterone is permissive (Hull et al. 1995). MPOA dopamine comes mainly
  from A14/A13, not the VTA (Hull, Muschamp & Sato 2004).
- **Rat, female.** NAcc and striatal dopamine rose more when the female could pace copulation, and
  with 1-min sampling rose *before* coital stimulation only when mating ran at her preferred rate,
  read as anticipation (Mermelstein & Becker 1995; Jenkins & Becker 2003). MPOA dopamine is linked to
  female solicitation [G Medial_preoptic_nucleus.md L63].
- **Antagonists.** Haloperidol in the NAcc reduced only anticipatory behaviour; in the MPOA it
  reproduced nearly all systemic effects (Pfaus & Phillips 1991, R).
- **Human.** The ventral striatum responds to cues predicting erotic pictures and to the pictures
  (Sescousse, Redouté & Dreher 2010, fMRI, men; meta-analyses Sescousse et al. 2013 and Stoléru et
  al. 2012, the latter of visual sexual stimuli in men). L-dopa increased and haloperidol decreased
  responses of the NAcc and dorsal ACC to subliminal sexual stimuli (Oei et al. 2012; fMRI, 53 young
  men, backward masking). Dopamine agonists in Parkinson's disease are associated with impulse-control
  disorders, including compulsive sexual behaviour (any ICD 17.1 % on agonists vs 6.9 % without;
  n = 3,090; Weintraub et al. 2010). A non-sexual anchor: [¹¹C]raclopride PET showed striatal
  dopamine release while people listened to music they found intensely pleasurable, and fMRI in the
  same listeners placed caudate activity in the ~15 s before the emotional peak and NAcc activity at
  the peak (Salimpoor et al. 2011, H). The seconds-scale split is BOLD, not dopamine.
- **Ramps.** Striatal dopamine ramps up over seconds as a goal approaches, scaling with proximity and
  value, and NAcc release can dissociate from VTA spiking (Howe et al. 2013; Hamid et al. 2016;
  Mohebi et al. 2019; R).

### 4.3. Consummatory phase

- Copulation keeps NAcc dopamine raised in 3–15 min microdialysis bins (Damsma et al. 1992; Lorrain
  et al. 1999; Fiorino, Coury & Phillips 1997; R).
- **MPOA D1/D2 hypothesis.** Low-to-moderate MPOA dopamine acting on D1-like receptors favours
  erection and parasympathetic reflexes; higher levels acting on D2-like receptors favour ejaculation
  and sympathetic reflexes (Hull et al. 1989; Dominguez & Hull 2005; Hull & Dominguez 2007; R). This
  conflicts with the usual affinity order and is a rat-specific hypothesis (low confidence). The MPOA
  is necessary for male copulation in rats [G Medial_preoptic_nucleus.md L65].
- **PVN.** Incertohypothalamic dopamine acts on D2-like receptors on PVN oxytocin neurons; their
  spinal projections are implicated in erection [G Paraventricular_nucleus_of_hypothalamus.md L70];
  Argiolas & Melis 2005 (R). Oxytocin injected into the caudal VTA raised NAcc and PVN dopamine and
  caused erection (Melis et al. 2007; R): a DA → OT → DA loop.
- **Human.** fMRI in 10 women found NAcc, insula, ACC, OFC, hypothalamus and the VTA region rising
  toward orgasm and declining afterwards (Wise, Frangos & Komisaruk 2017). This is BOLD, not
  dopamine.

### 4.4. Ejaculation and orgasm

- **Rat.** Microdialysis bins (3–15 min) cannot resolve the climax. FSCV transients are reported at
  the female's introduction and approach; no ejaculation-locked transients were reported (Robinson
  et al. 2001; Robinson, Heien & Wightman 2002). **There is no evidence for dopamine bursts locked to
  individual orgasmic contractions.**
- **Human.** H₂¹⁵O PET at ejaculation showed primary activation of the mesodiencephalic transition
  zone including the VTA, plus zona incerta, subparafascicular and intralaminar thalamus, lateral
  putamen/claustrum and cerebellum; amygdala and entorhinal cortex decreased; MPOA and hypothalamus
  did not increase (Holstege et al. 2003; men; compared by the authors to a heroin "rush"). The
  region also contains GABA and glutamate neurons and adjacent zona incerta, so the activation was
  not necessarily dopaminergic. **The finding is disputed:** the same group tested the 2003 method
  (20-s against 120-s images) on a newer data set of 11 women and found that comparing 20-s with
  120-s images of the same condition reproduced most of the 2003 pattern, which was therefore
  "largely artefactual": the clusters in the midbrain (VTA), thalamus, striatum, cerebellar
  hemispheres and parts of the neocortex can no longer be attributed to ejaculation. Re-analysing
  the original male data with equal 120-s images, only decreases survived correction (prefrontal
  cortex, and to a lesser extent posterior parietal cortex); increases appeared only at uncorrected
  P < 0.001, in the left deep cerebellar nuclei (dentate), a left lateral rostral midbrain /
  internal pallidum / ventral thalamus cluster, the anterior vermis and the pons (Georgiadis et al.
  2007). The 120-s images include late plateau and early resolution, so the authors call these
  changes ejaculation-related, not ejaculation-specific. In women, PET at orgasm showed mainly
  neocortical decreases (left lateral OFC, inferior temporal gyrus, anterior temporal pole), with
  the deep cerebellar nuclei only as a correlation with rectal-pressure variability (Georgiadis et
  al. 2006), and fMRI shows a broad rise toward orgasm that includes the ventral tegmental region
  (Wise, Frangos & Komisaruk 2017; BOLD). Cerebellar increases are the most consistently reported
  change at the climax: the deep cerebellar nuclei in PET of men (Holstege et al. 2003, whose
  cerebellar-hemisphere clusters the re-analysis judged artefactual; uncorrected in Georgiadis et
  al. 2007) and, as a correlation only, of women (Georgiadis et al. 2006), and the cerebellum in
  fMRI of women (Komisaruk et al. 2004, n = 3; Wise, Frangos & Komisaruk 2017). **Prefrontal and
  orbitofrontal changes are disputed:** PET reports decreases (women, Georgiadis et al. 2006; men,
  Georgiadis et al. 2007), while fMRI in women reports frontal increases (Komisaruk et al. 2004) and
  orbitofrontal increases with no region decreasing (Wise, Frangos & Komisaruk 2017), possibly a
  difference of method.
- **No pre-climax recording.** VTA firing in the seconds before ejaculation or orgasm has never
  been recorded in any species. Dopamine ramps toward distant rewards have been reported in rats in
  navigation tasks (Howe et al. 2013), and the PET study above gives no timing before the climax.
- **Model consequence.** In the model, midbrain firing ramps as the expected reward approaches
  across the onset window (reward-prediction framework; not measured during sex), followed by a
  smooth consummatory shoulder through the train, scaled by how surprising the reward is (§6.6).
  A pulse-locked variant exists only as a labelled hypothesis switch, off by default.

### 4.5. The post-orgasmic period

- **Satiety data (male rats, 15-min samples).** NAcc dopamine rose 44 % with a receptive female
  behind a screen and 95 % in the first copulation sample, stayed raised through copulation, and
  returned to baseline only in the 30-min period without mounting at sexual satiety (7.8 ± 0.5
  ejaculations in ~2.4 h), while DOPAC and HVA stayed raised. Renewed copulation with a novel female
  raised it again (+34 % in the first 15-min sample, against +95 % initially); presenting her behind
  a screen alone did not (+12 %, n.s.) (Coolidge effect; Fiorino, Coury & Phillips 1997). The 15-min
  samples cannot resolve a 5–7-min post-ejaculatory interval. Rat "satiety" means exhaustion after
  many ejaculations; applying it to a single orgasm mixes up the protocols. Because the metabolites
  stayed raised, the decline at satiety is read as a **gain change rather than vesicle depletion**
  (interpretation; not tested directly).
- **Measured and inferred (male rats).** With microdialysis in 3-min samples, NAcc dopamine was high
  during copulation and fell after each ejaculation, from its copulation level (Lorrain et al. 1999,
  confirming earlier electrochemical recordings); whether it fell below rest is not reported,
  because no post-ejaculatory–baseline difference was reported. Lateral-hypothalamic serotonin
  rises during post-ejaculatory intervals (6-min samples; significant when the PEI samples are
  pooled, and individually in the 2nd and 3rd PEI; the 1st PEI sample alone was not significant;
  Lorrain et al. 1997), and reverse dialysis of 5-HT into the anterior LH lowers NAcc dopamine below
  its pre-perfusion baseline and abolishes the female-evoked rise (Lorrain et al. 1999). An LH SSRI
  impaired copulation (Lorrain et al. 1997), but its effect on NAcc dopamine was not measured. A
  serotonergic mechanism for the post-ejaculatory fall, and a dip **below rest**, are inferred.
- **Resolution.** No method has resolved a single-orgasm dopamine time course at sub-minute
  resolution in any species (microdialysis bins are 3–15 min), and there are no human data. Both
  data sets are compatible with both model readings, which both fall from the plateau. "Sustained"
  (falls from the plateau but stays above rest) is the default as a model choice; "dip" (falls
  below rest) is the alternative (§6.10). Men show genital and subjective habituation to a repeated
  erotic stimulus and recovery with a novel one (O'Donohue & Geer 1985; Koukounas & Over 2000);
  comparable data in women are sparse, and none include dopamine.
- **In rats, the conditioned reward of ejaculation or paced mating depends on opioids rather than
  dopamine (place-preference studies; no human data).** One ejaculation produces a conditioned
  place preference blocked by naloxone but not by pimozide (Agmo & Berenfeld 1990, male rats, one
  pimozide dose);
  naloxone also blocks the place preference from paced mating in females (Paredes & Martínez 2001),
  and dopamine antagonists do not (García Horsman & Paredes 2004; R).
- **Prolactin** rises after orgasm in both sexes, not with arousal alone (Exton et al. 1999, 2001),
  is still raised at 60 min after orgasm, the end of sampling (men and women, coitus, continuous
  blood sampling; Exton et al. 2001, Psychoneuroendocrinology 26:287; review: "for over an hour",
  Krüger et al. 2002), and rises ~400 % more after
  intercourse than after masturbation [G raw Refractory_period_sex.md L25, L29];
  Brody & Krüger 2006. Its causal role in refractoriness is unresolved: no
  prolactin involvement in the mouse refractory period (Valente, Marques & Lima 2021), no rise in one
  multi-orgasmic man (Haake et al. 2002), and the human cabergoline/protirelin study (Krüger et al.
  2003b, n = 10; the cabergoline effects were abolished by co-administered protirelin) remains
  confounded by the central actions of both drugs (D2 agonism, TRH). With 2-min sampling, prolactin
  rose immediately after orgasm and stayed raised to the end of the 40-min recording (men; Krüger
  et al. 2003a, n = 10). The
  mechanism of the surge is
  unknown: reduced TIDA inhibition is one hypothesis; prolactin-releasing factors (for example
  oxytocin, VIP, TRH and serotonergic input; [T]) are alternatives. No human or animal study has
  measured TIDA activity at orgasm.

### 4.6. Translating rat time courses to human phases

Translation is by phase, not by one allometric factor.

| Rat observation | Rat timing | Human counterpart in the response model | Scaling |
|---|---|---|---|
| Female behind screen → NAcc and MPOA rise | minutes before contact | stimulation onset and the excitement build; the onset transient stands in for the cue signal because no separate cue input exists (§6.7) | ×1 |
| Copulation → tonic elevation | ejaculation latency typically ~5–15 min in standard copulation tests [T] | excitement + plateau (IELT median 5.4 min, Waldinger et al. 2005) | ×1 |
| Sub-second transients | 0.2–0.9 s | phasic events | never rescaled (cellular) |
| Post-ejaculatory interval: NAcc falls from its copulation level (Lorrain et al. 1999); whether it stays above rest or dips below it via LH serotonin (inferred) is unresolved | first PEI ~5–7 min, with an "absolute" refractory part marked by 22-kHz calls (Barfield & Geyer 1972) | refractory inhibition I, T_ref default 15 min; hypothesis switch (§6.10) | ×2–3 (default); ≥ ×100 for a 12-h profile |
| Satiety after several ejaculation series | hours; recovery over days (Beach & Jordan 1956) | repeated orgasms within a session, never one orgasm | optional slow satiety gain (§6.10) |

### 4.7. Sex and profiles

Nearly all dopamine data are from male rats; female data exist mainly for paced mating. The
response profiles are response patterns available to any body (`RESPONSE.md` §7.9) and the dopamine model has no sex parameter. The MPOA testosterone permissive
factor is fixed at 1.

### 4.8. Schematic time course (model, default profile)

```
                 baseline  excitement      plateau   onset orgasm  early res.  late res.   recovery
NAcc (sustained) ▂▂▂▂▂▂▃▄▅▅▆▆▆▆▆▇▇▇▇▇▇▇▇▇▇▇▇▇▇██████▆▅▄▄▃▃▃▃▃▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂   ×1 → ×1.46 → ×1.25 (+1 min) → ×1.07 (+10 min) → ×1
NAcc (dip)       ................................................▃▂▁▁▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂   → ×0.955 at ≈ +3.5 min → ×1 by ~10 min
VTA phasic       ......▲(onset).......~~~slow waves~~~~▲▲▲▲▲▲▄▂......(▼ pause on distraction)
MPOA (A13/A14)   ▂▂▂▂▂▂▄▅▆▆▆▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▅▁▁▂▂▃▃▂▂▂▂▂▂▂▂▂▂▂▂   ×1.6 → ×0.8 → ×1
Median eminence  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▃▂▁▁▂▃▅▆▇▇▇▇▇▇▆▆▅▅▅▄▄▄   ×0.42 → ×1.5 → ×1.2 at 60 min
Spinal (A11)     ▂▂▂▂▂▂▂▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▅██▄▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂   ×2.4 at the end of the train
```

Columns are schematic, not to scale; numbers are from the deterministic reference of §6.9 (the
20-seed ranges are given there). The post-orgasm course of NAcc dopamine is unresolved (§4.5); both
rows are model readings, and "sustained" is the default as a model choice.

---

## 5. Modulators acting on dopamine

Every modulator enters the model as a multiplicative or additive term on dopamine firing, release
or recruitment. Its own activity is shown only as a HUD gauge and, for prolactin, serotonin, GABA
and μ-opioid tone, as a restrained, labelled tint on its source nucleus (§1, §8.1; for prolactin
the pituitary gland haze, not the median eminence or stalk); never as amber, never as a glow and
never on a lantern, dopamine soma, release site, tract or any point that carries dopamine amber.
Oxytocin is a gauge only.

Evidence grades: **established (rodent)** = replicated mechanism, mostly rat or mouse; **hypothesis**
= proposed, unmeasured in the relevant setting; **speculative** = weak or indirect support;
**argued against** = direct evidence opposes it.

| Modulator (model input) | Site | Mechanism | Sign on DA | Timescale | Evidence (grade) | Model term (default) |
|---|---|---|---|---|---|---|
| Prolactin R (short loop) | arcuate A12 → median eminence | short-loop feedback: prolactin excites TIDA neurons within minutes (depolarisation and a switch from phasic to tonic firing through a TRP-like current plus inhibition of a BK-type K⁺ current, rat slices) and over hours raises TH activity | + on TIDA DA | minutes to hours | **established (rodent)**: Lyons, Hellysaz & Broberger 2012; Freeman et al. 2000; Grattan 2015 (Lyons et al. 2010 is the source of the TIDA oscillation only, §3.7) | A12 drive × (1 + 0.5·R); the only place prolactin acts on dopamine by default |
| Orgasm (TIDA withdrawal) | arcuate | proposal that reduced TIDA output contributes to the post-orgasmic prolactin surge; alternatives are prolactin-releasing factors (oxytocin, VIP, TRH, serotonergic input; [T]) | − on TIDA DA | seconds to minutes | **hypothesis** (Krüger et al. 2002); TIDA activity at orgasm never measured | A12 drive × (1 − s_T·Ω̃), s_T = 0.6 (assumption) |
| Prolactin R on mesolimbic DA | VTA / NAcc | proposed dampening after orgasm | − | tens of minutes | **speculative** (Krüger et al. 2002); a causal role of prolactin in refractoriness is **argued against** (Valente, Marques & Lima 2021, mice); no graph path | z_R = **0**; opt-in hypothesis z_R = 0.2 |
| GABA (VTA interneurons, RMTg, LHb, ventral pallidum) | VTA | tonic inhibition; LHb → RMTg pauses DA after negative events; holds ~50 % of DA cells silent | − | 0.1 s to minutes | **established (rodent)**: Floresco et al. 2003; Jhou et al. 2009; Matsumoto & Hikosaka 2007 (Mk); Cohen et al. 2012 | Γ = (1 + 1.5·X)(1 − g_Ψ·Ψ̂); drive ∝ 2/(1 + Γ) |
| μ-opioid (response Ψ) | VTA GABA interneurons, RMTg | hyperpolarises GABA neurons → disinhibits DA | + | minutes (Ψ τ = 15 min) | **established mechanism (rodent slices)**: Johnson & North 1992; Jalabert et al. 2011; activity during sex unmeasured | the (1 − g_Ψ·Ψ̂) term in Γ; g_Ψ = 0.5 ("sustained") or 0.3 ("dip") |
| κ-opioid (dynorphin) | DA terminals, VTA | direct inhibition of DA neurons and release; dynorphin released by D1-MSNs | − | minutes | mechanism **established (rodent)**: Spanagel, Herz & Shippenberg 1992; Margolis et al. 2003; activity-dependent feedback during sex is a **hypothesis** | K_j driven by the *relative* excess of D1 activation, g_K = 0.2, τ_K = 300 s (striatal regions): a ≈ 6 % brake in plateau |
| Serotonin (lateral hypothalamus; 5-HT2C) | LH, VTA GABA cells | in male rats LH 5-HT rises during post-ejaculatory intervals, and raising it experimentally lowers NAcc DA; tonic 5-HT2C restrains mesolimbic DA | − | [model] τ_Z = 60 s, rising after the orgasm end and decaying with I; the data resolve only minutes | **single studies (male rat)**: LH 5-HT rises during post-ejaculatory intervals (6-min samples; significant pooled and individually in the 2nd and 3rd PEI; Lorrain et al. 1997, n = 7) and reverse dialysis of 5-HT into the anterior LH lowers NAcc DA (Lorrain et al. 1999, n = 6); tonic 5-HT2C restraint of mesolimbic DA is **established (rodent)** (Di Matteo et al. 1999); a rise after a single (first) ejaculation was measured but not individually significant; it and a dip below rest are **inferred** | Z = low-pass of I (τ_Z = 60 s); g_mod = 1/(1 + z_Z·Z), z_Z = 0.2 ("sustained", default) or 0.5 ("dip") |
| Oxytocin O | VTA; PVN | central oxytocin from parvocellular PVN projections acts in the VTA; intra-VTA oxytocin raised NAcc DA and caused erection; DA in PVN activates OT neurons | + | minutes | **rat evidence**: Melis et al. 2007 (male rats, intra-VTA injection); Hung et al. 2017 (Ms). O from `response.js` is *plasma* (posterior-pituitary) oxytocin, used as a **proxy** for central release (assumption) | + 0.15·min(O, 1.3) in VTA-l drive, + 0.2·min(O, 1.3) in VTA-m drive (small, labelled) |
| Somatodendritic D2 autoreceptors | midbrain | GIRK IPSC after dendritic release | − (on firing) | ~1 s | **established (rodent)**: Beckstead et al. 2004 | g_sd = 1.2/(1 + 0.2·ν̄/ν₀) |
| Terminal D2 autoreceptors | terminals | release depression after impulses; TAAR1 opposes | − (on release) | 0.1–1 s | **established (rodent)**: Benoit-Marand et al. 2001; [G Autoreceptor.md L29] | F_aut, strength 1 (striatum, amygdala), 0.5 (PFC), 0 (hypothalamus, ME) |
| Catecholamines N (salience proxy) | medial VTA | medial VTA neurons respond to salient events | + | minutes | Lammel et al. 2011 (Ms); use of N as a proxy is a **model choice** | + 0.25·(N − 0.1) in VTA-m drive |

Notes:

1. **Prolactin.** The only established prolactin → dopamine link is the short-loop feedback onto TIDA
   neurons (rodent evidence), and it is the only place prolactin acts on dopamine by default.
   Prolactin acts on dopamine nowhere else: it no longer gates the response model's D (§6.7), and
   the mesolimbic brake is an opt-in hypothesis. R itself is the empirical closed form of the
   response model (human data), exogenous to the dopamine layer and not driven by TIDA dopamine.
   The median-eminence glow is a consequence of R, never its cause: a dip while Ω̃ is high
   (withdrawal hypothesis, share s_T), then a short-loop rebound that peaks with R at ~30 min
   (1.5× rest). From 10 to 60 min, lactotroph D2 occupancy (0.71–0.75) is above its resting 0.67
   while prolactin stays raised. In a negative feedback loop this is what a sustained releasing
   drive produces: the surge is maintained by releasing factors overriding the dopamine brake. For
   the same reason a TIDA withdrawal can be at most one contributor to the onset of the surge. The
   parent analysis uses R only as a marker (`RESPONSE.md` §6, §7.4).
2. **Opioids.** μ disinhibition raises and κ inhibition lowers dopamine; both systems are tonically
   active and the net direction after orgasm is unknown (human naloxone data conflict). With the
   default "sustained" setting, μ disinhibition holds NAcc at 1.25× rest at +1 min, 1.11× at +5 min,
   1.07× at +10 min and 1.04× at +20 min, within 1 % of rest by ~40 min (§6.9); this is labelled
   hypothetical.
3. **Serotonin.** Z stands for lateral-hypothalamic 5-HT and is driven by the refractory variable I.
   With the "dip" hypothesis (z_Z = 0.5) it pulls NAcc to 0.955× rest at ≈ +3.5 min (0.92–0.96 over
   20 seeds); with the default (z_Z = 0.2) it only shortens the post-orgasmic elevation. Neither
   course has been measured.
4. **Oxytocin.** Plasma O stands in for central PVN oxytocin (assumption). Peripheral oxytocin
   crosses the blood–brain barrier poorly, central and peripheral release need not coincide in
   time, and peripheral assays are often invalid (McCullough, Churchland & Mendez 2013). The gain
   is kept small and the About text names the proxy (§9.8).
5. **Not modelled:** striatal cholinergic interneurons and endocannabinoids (local release control),
   glutamate co-release, noradrenergic co-release in hippocampus, testosterone (permissive factor 1).

---

## 6. The mathematical model

### 6.1. Design principles

1. **Inputs only from the response model.** Arousal, vasocongestion, sympathetic tone, myotonia,
   catecholamines, oxytocin, prolactin, opioid tone, refractory inhibition, the generator Ω, the
   contraction train and the phase machine all come from the response model, which is the corrected
   galaxy model (`RESPONSE.md` §7.4–§7.9) ported to `response.js` (§6.7).
   The dopamine model adds no physiology of its own beyond dopamine and the dopamine-acting parts of
   the modulators.
2. **One dopamine signal.** The response model's dopaminergic drive D is computed from the
   dopamine layer (closed loop, §6.7), so the arousal feedback and the displayed dopamine cannot
   disagree, and, by default, prolactin acts on dopamine in one place only (the TIDA short loop;
   the opt-in z_R hypothesis adds a second).
3. **Mean-field rate model.** Population-average firing rates drive regional extracellular
   concentrations through release minus Michaelis–Menten uptake (Wightman & Zimmerman 1990;
   Montague et al. 2004). Conductance models are unnecessary at these timescales. Because ν is a
   population mean, it saturates softly at 20 Hz, well below intraburst rates.
4. **Three time layers.** Sub-second (phasic firing, concentration, D1), seconds (autoreceptors,
   release plasticity, D2), minutes (recruitment from the response model, modulators, κ feedback).
5. **Tonic change through recruitment** (Floresco et al. 2003), **phasic change through a temporal-
   difference prediction error** (Schultz, Dayan & Montague 1997), **post-orgasmic course as a
   hypothesis switch** (Fiorino et al. 1997 vs Lorrain et al. 1999).
6. **Every number is either sourced (§3.7) or a declared model choice.**

### 6.2. Inputs from `response.js`

Read after each human-time integration step (`ResponseModel._integrate` followed by
`_transitions`), together with a snapshot of the same variables taken before the step, so that
every input can be interpolated inside the step (§6.4 (12), §6.8):

| Variable (code name) | Meaning | Use in the dopamine model |
|---|---|---|
| `phase`, `phaseTh` | phase id (`onset` replaces `inevitability`, §6.7); human seconds in phase | value feature Φ; onset ramp; learning at the orgasm end |
| `p.Tpre`, `p.uPre` | onset window length (0–3 s, default 1.5 s) and emission setting | length of the value ramp |
| `St` (S̃) | smoothed stimulation 0–1 | S_eff, value feature, A13/A14 drive |
| `X` | inhibitory cue (distraction) | VTA GABA tone Γ; value feature |
| `A` | central arousal (deterministic) | A13/A14 drive |
| `Aeff` (A_obs) | felt arousal incl. slow waves η, clamp(A + η, 0, 1) | VTA and SNc drive; value feature |
| `G` | genital vasocongestion | A11, A13, A14 drive |
| `M` | myotonia | SNc drive |
| `N` | catecholamines | VTA-m salience term |
| `O` | plasma oxytocin (proxy for central release) | VTA drive |
| `R` | prolactin (empirical closed form) | TIDA (A12) drive; opt-in mesolimbic hypothesis |
| `Psi` (Ψ) | opioid tone (peak ≈ 0.83 for the 15.5-s default orgasm; 0.67–0.92 over 20 seeds, depending on the train length) | μ-opioid disinhibition through Γ |
| `I` | refractory inhibition (rises in step with the pulses, then decays) | S_eff, value feature, serotonin proxy Z, A13/A14 suppression |
| `H` | post-orgasmic hypersensitivity | S_eff |
| `Omega` (Ω) | generator envelope | A11, A12 (via Ω̃), A13 drive |
| `train` {`times`, `amps`, `t`, `next`, `q`} | contraction train (`t` is the train-relative time, already exported) | reward kernel during the orgasm phase; intensity q sets the obtained reward |
| `khNow` | human seconds per screen second for the current frame (a number, set in `update()` before the step loop; `kh` itself is a `LogRamp`) | h_max switch (§6.8); rendering (§8.4) |
| `tHuman` | absolute human time | interpolated time (§6.4 (12)); the 20-s TIDA oscillation in P_A12 |
| `tIgnite` | human time at ONSET entry | t_ig, the value ramp (§6.4 (4)) |
| `D` (written, not read) | dopaminergic drive of the arousal equation | set by the dopamine layer after each step (§6.4 (11)) |

S_eff is recomputed exactly as in the response model: S_eff = S̃·(1 − I)·(1 − 0.9·H). `response.js`
should expose it (§6.7).

### 6.3. State variables

| Symbol | Meaning | Unit | Count |
|---|---|---|---|
| P̄_i | low-passed population recruitment (1 = rest) | — | 7 |
| ν_i, ν̄_i | population-mean firing rate; its 1-s low-pass | Hz | 7 + 3 |
| ln F_i, ln D_i | release facilitation and depression (log-domain variant of Montague et al. 2004) | — | 14 |
| C_j | extracellular dopamine | nM | 9 |
| C̄_j | 10-s low-pass of C_j (tonic level) | nM | 9 |
| θ1_j, θ2_j, θa_j | D1, D2 and terminal-autoreceptor occupancy | — | 27 |
| K_j | κ-opioid (dynorphin) feedback | — | 3 |
| V̂, ŵ, Φ_ig, t_ig | low-passed value; learned value of the orgasm reward; value and time at ignition | —, —, —, s | 4 |
| Z | serotonergic satiety proxy | — | 1 |
| Ω̃ | low-passed generator envelope for TIDA | — | 1 |

About 85 scalars. Populations i ∈ {VTA-l, VTA-m, SNc, A11, A12, A13, A14}; regions j ∈ {NAcc core,
NAcc shell, dorsal striatum, PFC (mPFC, OFC, ACC), amygdala, MPOA, PVN, median eminence,
lumbosacral cord (drawn as an upper-cervical proxy, §7.6)}. The hippocampus has no compartment; it is
drawn from the amygdala compartment with w_vis 0.14 (§8.1; the current code uses 0.4 × the amygdala
glow).

### 6.4. Equations

Time t in human seconds; concentrations in nM; rates in Hz. clamp(x) = min(1, max(0, x)) unless
bounds are given.

```
(1) Derived inputs (each input u is first interpolated inside the response step, see (12))
  S_eff = S̃ · (1 − I) · (1 − 0.9·H)
  Ψ̂    = clamp(Ψ / Ψ_pk)                       Ψ_pk = 0.9, a normaliser at the upper end: with the corrected
                                                 response model (dΨ/dt = 0.025·Ω − Ψ/τ_Ψ) a default orgasm
                                                 peaks at Ψ ≈ 0.83 (0.67–0.92 over 20 seeds), so Ψ̂ = 0.92
                                                 for the deterministic default. Ψ̂ reaches the clamp (1)
                                                 for orgasm phases longer than ≈ 18 s and stays there
                                                 over repeated orgasms, because Ψ accumulates with
                                                 τ_Ψ = 15 min (multiple profile, stimulation held: Ψ ≈ 4.4
                                                 after 10 orgasms, Ψ > 0.9 for 90 % of the time after the
                                                 first)
  Ô     = min(O, 1.3)
  N'    = clamp(N − 0.1, 0, 1.2)
  dZ/dt = (I − Z) / τ_Z                         τ_Z = 60 s, rising and falling (lateral-hypothalamic 5-HT proxy)
  dΩ̃/dt = (Ω − Ω̃) / τ_Ω                        τ_Ω = 2 s rising, 120 s falling

(2) Modulator gains
  Γ     = (1 + g_X·min(1, X)) · (1 − g_Ψ·Ψ̂)      VTA GABA tone (LHb/RMTg via X; μ-opioid disinhibition)
  g_mod = 1 / [ (1 + z_Z·Z) · (1 + z_R·R) ]      serotonergic satiety; prolactin hypothesis (z_R = 0 by default)

(3) Tonic recruitment (each P_i = 1 at rest)
  P_VTAl = 2·(1 + 0.70·Aeff + 0.35·S_eff + g_O·Ô) / (1 + Γ) · g_mod
  P_VTAm = 2·(1 + 0.35·Aeff + 0.15·S_eff + 0.25·N' + 0.20·Ô) / (1 + Γ) · g_mod
  P_SNc  = (1 + 0.25·Aeff + 0.35·M) · √g_mod
  P_A11  = 1 + 1.5·Ω + 0.3·G
  P_A12  = (1 + g_TR·R) · (1 − s_T·Ω̃) · (1 + a_T·sin(2π·t/20 s))      a_T = 0.08 (rat slice oscillation)
  P_A13  = [1 + 0.5·(0.4·min(1, S̃) + 0.6·A) + 0.3·G + 0.3·Ω] / (1 + 0.5·I)
  P_A14  = [1 + 0.6·(0.4·min(1, S̃) + 0.6·A) + 0.2·G] / (1 + 0.5·I)
  dP̄_i/dt = (P_i − P̄_i) / τ_P                   τ_P = 5 s  (recruitment cannot switch instantly)

(4) Temporal-difference error δ (1/s)
  Value feature Φ ∈ [0, 1]:
    baseline, excitement, plateau, resolution, recovery, no-climax:
      Φ = min(1, φ_S·min(1, S̃) + φ_A·Aeff²) · (1 − 0.8·min(1, X)) · (1 − I)
    onset (ONSET, formerly "inevitability"):
      Φ = Φ_ramp = Φ_ig + (1 − Φ_ig) · min(1, t_ig / T_φ),   T_φ = max(T_pre, 1.5 s)
      (Φ_ig = Φ at ignition, t_ig = human time since ignition; the ramp may outlast a short ONSET)
    orgasm:  Φ = min(Φ_ramp, 1 − 𝒢(t_tr))        (remaining expected reward of the train)
    A cancelled ONSET (stimulation released, u_pre off) returns to PLATEAU and to the first formula,
    which gives a negative δ.
  Reward kernel of the train (t_tr = train time, α_k = a_k / Σa with Σa over all pulses of the train,
  minor tail pulses included, u_k = t_tr − t_k > 0):
    g(t_tr) = Σ_k α_k · (u_k / τ_r²) · e^(−u_k/τ_r)                     (alpha kernel, unit area per orgasm)
    𝒢(t_tr) = Σ_k α_k · [1 − (1 + u_k/τ_r) · e^(−u_k/τ_r)]               (cumulative)
    At the contraction frequency (1.25 Hz) the kernel's gain is 1/(1 + (2π·1.25 Hz·τ_r)²) ≈ 0.016
    (−36 dB), so δ follows the reward rate of the whole train, not individual contractions.
  V = ŵ·Φ,   dV̂/dt = (V − V̂) / τ_V
  r(t) = R_obt · g(t_tr) during the orgasm phase, 0 otherwise;   R_obt = r_0 + r_q·q
  δ = r + dV̂/dt                    (dV̂/dt taken as the secant of the exact update, §6.8)
  At the orgasm end t_e:  ŵ ← ŵ + α_w·(c_w·R_obt − ŵ);  V̂ is re-seated to V with δ = 0 (no derivative)
  for the rest of the response step in which the orgasm ends and the next one (two response steps,
  ≤ 0.1 s while the 0.05-s cap applies). c_w < 1 keeps learning incomplete, so later orgasms still
  produce a (smaller) error.
  Pulse-locked hypothesis (off by default; no evidence links dopamine to individual contractions):
    during the train δ = (R_obt − ŵ)·Σ_k α_k·e^(−u_k/τ_k)/τ_k, τ_k = 0.3 s, replaces δ entirely (no
    dV̂/dt term and no r); Φ = remaining pulse share only keeps V̂ consistent for the end of the train.

(5) Firing (soft saturation of the population mean)
  ν_T,i = ν0_i · P̄_i · g_sd,i                                          (tonic rate)
  x_i   = β_i · δ
  ν_i   = ν_T,i + (ν_sat − ν_T,i) · tanh( ν_T,i·x_i / (ν_sat − ν_T,i) )   for x_i ≥ 0
  ν_i   = ν_T,i · max(f_p, 1 + x_i)                                     for x_i < 0  (partial pause)
  (slope ν_T at x = 0, as in the linear form ν_T·(1 + x); bounded by ν_sat = 20 Hz without a clamp
  as long as ν_T < ν_sat: the largest steady ν_T with the defaults is 9.7 Hz (VTA-l) and 11.3 Hz
  (VTA-m), but user-tuned gains could reach ν_sat, where the formula divides by zero, so implement
  it with ν_T clamped to ≤ 0.95·ν_sat)
  g_sd,i = (1 + k_sd) / (1 + k_sd·ν̄_i/ν0_i)   for VTA-l, VTA-m, SNc;  1 for A11–A14
  dν̄_i/dt = (ν_i − ν̄_i) / τ_sd

(6) Release plasticity (log-domain variant of Montague et al. 2004; facilitation and short-term
    depression only)
  d lnF_i/dt = ν_i·ln k_F − lnF_i / τ_F
  d lnD_i/dt = ν_i·ln k_dep − lnD_i / τ_dep
  ρ_i = exp(lnF_i + lnD_i) / exp(lnF_i + lnD_i)|ν=ν0                   (= 1 at rest)
  In the paper each factor relaxes back to 1 with first-order kinetics (dI/dt = (1 − I)/τ, I ← k·I at
  each impulse); the log-domain form agrees to first order, stays bounded at any rate and has a net
  steady-state depression of 6 % at 8 Hz, whereas the published form gives net facilitation (+13 %)
  and diverges for a sustained ν ≥ 18 Hz (§3.2). This is a model choice [model].
  The paper's long-term depression (τ₃ ≥ 10 min) is omitted: no k₃ is reported, and its effect over a
  5–9 min build is unknown. An optional term d lnL_i/dt = ν_i·ln k_L − lnL_i / τ_L (τ_L ≈ 10 min) can
  be added without other changes, but any k_L is a model choice; habituation across orgasms is
  carried by ŵ instead.

(7) Extracellular dopamine, region j
  dC_j/dt = q_j · F_aut,j · F_K,j · Σ_i π_ij·ν_i·ρ_i − V_max,j·C_j/(K_m + C_j) − k_l,j·C_j
  q_j = [ V_max,j·C0_j/(K_m + C0_j) + k_l,j·C0_j ] / Σ_i π_ij·ν0_i     (tonic firing reproduces C0_j)

(8) Receptors and terminal autoreceptors
  dθ_x/dt = k_on,x·C_j·(1 − θ_x) − k_off,x·θ_x          x ∈ {D1, D2, aut}
  F_aut,j = (1 + a_j·θa0_j) / (1 + a_j·θa_j)              (= 1 at rest)

(9) κ-opioid (dynorphin) feedback, striatal regions only (hypothesis)
  dK_j/dt = ( g_K · max(0, θ1_j/θ1_0,j − 1) − K_j ) / τ_K,     F_K,j = 1 / (1 + K_j)
  The drive is the *relative* change in D1 occupancy. An absolute drive k_K·(θ1 − θ1_0) (the current
  code, k_K = 1, τ_K = 120 s) reaches only K ≈ 0.007 in the default cycle (≤ 0.012 with stimulation
  held in the multiple profile) because θ1 itself is only 0.015–0.054 (rest to the highest climax
  peak), so it would brake release by ≈ 1 % at most. With the relative drive, F_K = 0.943 in plateau
  (a 5.7 % brake; 6.8 % at most).

(10) Readouts
  C_j, C̄_j (τ = 10 s), frame-mean C_j over all substeps of a frame (if no substep ran in a frame,
  for example while paused or in ONSET with T_pre = 0, it keeps its previous value or equals the
  current C_j; the accumulators are reset only after a frame with at least one substep), phasic C_j − C̄_j,
  ν_i/ν0_i, ρ_i, θ1_j, θ2_j, δ, Γ, Ψ̂, Z, g_mod;
  lactotroph D2 occupancy at the median eminence (a consequence of R, not its cause); PVN D2 occupancy.

(11) Coupling back to the response model (default, closed loop, §6.7)
  D = clamp( 0.2 + k_B·(C̄_shell / C0_shell − 1) ),     k_B = 1.6
  the value is written directly into D after every response step (no τ_D filter and no phasic
  impulse; C̄ already has τ = 10 s); it replaces the response model's own D*, its low-pass and its
  phasic impulse.

(12) Input interpolation inside a response step
  For a response step from t_n to t_n + Δ with n = ceil(Δ/h) dopamine substeps, every state input u
  (S̃, Aeff, A, X, I, H, G, M, N, O, R, Ψ, Ω) is evaluated at the end of substep s as
  u_n + ((s + 1)/n)·(u_n+1 − u_n), and so is absolute time. Φ is therefore piecewise linear in time,
  not a staircase. Phase-relative clocks are not interpolated: t_ig is computed from the interpolated
  absolute time and the ignition time, clamped at ≥ 0, and the train time as
  t_tr = max(0, t_tr(end) − (1 − (s + 1)/n)·Δ). Substeps use the end-of-step phase (a step containing
  a transition is treated as already in the new phase), and Φ_ig is Φ at the last substep before the
  ignition step.
```

### 6.5. Parameters

**Populations**

| Population | ν₀ (Hz) | β (s) | Autoreceptor g_sd | Source / note |
|---|---|---|---|---|
| VTA-l (PBP; NAcc core, lateral shell) | 4 | 25 | yes | Grace & Bunney 1984; β [model], tuned so that default peaks stay at 12–20 Hz (§6.9 row 8) |
| VTA-m (PN/IF; mPFC, medial shell, amygdala) | 5 | 10 | yes | Chiodo et al. 1984; Lammel et al. 2008; β [model]. VTA-m pools medial-shell- and amygdala-projecting cells, which do carry autoreceptors; omitting the mesoprefrontal exception (no impulse-regulating autoreceptors, §3.1) is a simplification [model] |
| SNc (+ A8; dorsal striatum) | 4 | 6 | yes | Grace & Bunney 1984; smaller cue responses in dorsal striatum (Damsma et al. 1992); a burst gain well below the VTA's [model] |
| A11 (spinal) | 2 | 0 | no | assumption |
| A12 (TIDA) | 2 | 0 | no | no autoreceptor control (Ben-Jonathan & Hnasko 2001) |
| A13, A14 (MPOA, PVN) | 2 | 0 | no | assumption |

ν_sat = 20 Hz (soft, population mean); f_p = 0.5; k_sd = 0.2; τ_sd = 1 s (Beckstead et al. 2004);
τ_P = 5 s [model]. Units, species and sources of every value are in §3.7; values without a source
are marked [model] or assumption.

**Regions** (K_m = 200 nM everywhere; π = share of input from each population)

| Region | C₀ (nM) | V_max (nM/s) | k_l (s⁻¹) | Sources π | a (autoreceptor) | κ feedback | q (nM per impulse, i.e. nM·s⁻¹ per Hz) | τ_clear at C₀ |
|---|---|---|---|---|---|---|---|---|
| NAcc core | 15 | 2,500 | 0.1 | VTA-l 0.85, VTA-m 0.15 | 1 | yes | 42.4 | 85 ms |
| NAcc shell | 15 | 1,200 | 0.1 | VTA-l 0.6, VTA-m 0.4 | 1 | yes | 19.4 | 176 ms |
| Dorsal striatum | 20 | 4,000 | 0.1 | SNc 0.9, VTA-l 0.1 | 1 | yes | 91.4 | 55 ms |
| PFC (mPFC, OFC, ACC) | 2 | 100 | 0.5 | VTA-m 0.9, VTA-l 0.1 | 0.5 | no | 0.41 | 1.0 s |
| Amygdala (also drawn on the hippocampus, w_vis 0.14) | 5 | 100 | 0.3 | VTA-m 0.6, VTA-l 0.2, SNc 0.2 | 1 | no | 0.86 | 1.27 s |
| MPOA | 5 | 0 | 0.3 | A14 0.6, A13 0.4 | 0 | no | 0.75 | 3.3 s |
| PVN | 5 | 0 | 0.3 | A13 0.5, A14 0.5 | 0 | no | 0.75 | 3.3 s |
| Median eminence (portal) | 20 | 0 | 0.2 | A12 1.0 | 0 | no | 2.0 | 5.0 s |
| Lumbosacral cord | 2 | 0 | 0.3 | A11 1.0 | 0 | no | 0.30 | 3.3 s |

Sources: §3.3, §3.6, §3.7; hypothalamic, median-eminence and cord values are assumptions (low
confidence). Tonic C₀ is a parameter: lowering it lowers D2 occupancy. The hippocampus has no
compartment of its own (its dopamine is sparse and partly of locus coeruleus origin, §2.3); this
matches the current code, and an earlier draft's hippocampal field (C₀ 1 nM, V_max 50 nM/s) is
dropped. The PFC compartment is fed from the VTA only; primate dorsal-tier SNc input to cortex
is not computed (§2.3).

q follows from the microdialysis C₀ and V_max (§6.4 (7)), not from measured release per impulse.
It implies ~90 nM per population impulse in dorsal striatum, ≈ 4.5× the awake per-pulse release of
Montague et al. 2004 (a₀ = 20 nM; with a₀ = 20 nM and V_max = 4 µM/s, tonic 4 Hz would give
C₀ ≈ 4 nM, the no-net-flux value), and a PFC/striatum release ratio of ≈ 1/220, far below the ~1/8
measured by Garris & Wightman 1994. Evoked PFC transients are therefore 10–25 times smaller than in
the striatum (with the release, uptake, autoreceptor and plasticity terms of §6.4 (6)–(8), a forced
20-Hz train of 2 s gives PFC +4.6 nM against +65 nM in NAcc core and +105 nM in dorsal striatum,
amygdala +11 nM; 10 Hz for 5 s gives +1.8, +22, +34 and +4.5 nM), not the "similar levels" those
authors report; cortical transients are deliberately small [model].

**Receptors and plasticity**

| Parameter | Value | Note |
|---|---|---|
| D1: k_on, k_off | 0.01 nM⁻¹s⁻¹, 10 s⁻¹ | K_d = 1 µM, equilibrates in ~0.1 s (EC₅₀ from Dreyer et al. 2010; rates [model]) |
| D2: k_on, k_off | 0.02 nM⁻¹s⁻¹, 0.2 s⁻¹ | K_d = 10 nM, equilibrates in ~1–5 s |
| Terminal autoreceptor: k_on, k_off | 0.02 nM⁻¹s⁻¹, 0.6 s⁻¹ | K_d = 30 nM [model]; τ = 1/(k_on·C + k_off) ≈ 1.1 s at rest (1.7 s as C → 0), slower than the measured effect, which is maximal at 150–300 ms and gone within ~0.6–0.8 s (mice; Benoit-Marand et al. 2001). Faster rates with the same K_d (0.05 nM⁻¹s⁻¹, 1.5 s⁻¹, τ ≈ 0.44 s) would lower the onset and climax peaks by ~4–5 % and require a re-run of §6.9 |
| k_F, τ_F; k_dep, τ_dep | 1.010, 5.45 s; 0.984, 4.38 s | Montague et al. 2004, Table 1 (irregular trains, n = 6; medium confidence), used in the log-domain variant of §6.4 (6); long-term depression omitted (τ₃ ≥ 10 min, no k₃ reported) |
| g_K, τ_K | 0.2, 300 s | κ feedback on the relative D1 excess (hypothesis, inferred from rodent pharmacology, never measured during sex; Spanagel et al. 1992 for the sign) |

**Prediction error and modulators**

| Parameter | Value | Note |
|---|---|---|
| φ_S, φ_A | 0.3, 0.45 | value shares of stimulation and arousal [model] |
| τ_V | 0.4 s | value smoothing [model]. Because Φ follows S̃ (τ = 1 s), the population onset burst lasts ≈ 1.6 s at half maximum and the NAcc transient peaks ≈ 0.6 s after contact (FWHM ≈ 1.3 s); the width is set mainly by S̃, and even τ_V → 0 leaves ≈ 0.7 s. This is a smoothed population stand-in, several times longer than single-unit bursts (≤ 200–300 ms, Schultz 1998). A ≤ 300-ms burst would need Φ driven from an unsmoothed contact signal with τ_V ≈ 0.1 s, a refit of β and a re-run of §6.9 |
| ŵ₀, α_w, c_w | 0.5, 0.3, 0.8 | initial value, learning rate, learning ceiling [model] |
| r_0, r_q | 0.6, 0.8 | obtained reward R_obt = 0.6 + 0.8·q (default q ≈ 0.5 → 1.0) [model] |
| τ_r | 1.0 s | consummatory reward kernel, alpha shape (smooth, not pulse-locked) [model] |
| T_φ,min | 1.5 s | shortest value ramp at ignition, so that a short or zero T_pre does not steepen the anticipatory ramp; because the consummatory reward then begins while the ramp is still rising, the populations still reach 19.1–19.5 Hz (≈ 97 % of ν_sat; §6.6, §6.9 row 8) [model] |
| g_X, g_Ψ | 1.5, 0.5 ("sustained", default) or 0.3 ("dip") | GABA tone gains [model] |
| z_Z | 0.2 ("sustained", default) or 0.5 ("dip") | model choice; the dip reading is inferred from Lorrain et al. 1997, 1999 (§4.5, §6.10) |
| z_R | 0 (opt-in hypothesis 0.2) | Krüger et al. 2002 (hypothesis); Valente, Marques & Lima 2021 (against a causal role in refractoriness) |
| g_O | 0.15 | Melis et al. 2007 (sign, male rats), magnitude [model]; O is a proxy for central oxytocin |
| g_TR, s_T, a_T | 0.5, 0.6, 0.08 | TIDA short loop (rodent); TIDA share of the prolactin surge (assumption); 20-s oscillation amplitude [model] |
| k_B | 1.6 | closed-loop slope; fit 1.60 against the open-loop D state (phasic transient added to D), 1.71 against D* itself (§6.7) |

### 6.6. How phasic bursts and pauses arise

Numbers are from the deterministic reference simulation of §6.9 (corrected response model,
closed loop, "sustained" default), with 20-seed ranges where the level noise matters.

- **Stimulation onset.** Φ rises with S̃ (τ 1 s), so dV̂/dt is briefly positive: a burst in VTA-l
  (10.7 Hz peak 0.6 s after onset, above half maximum for ≈ 1.6 s) with an NAcc core transient of
  +23 nM (peak 38.3 nM) 0.6 s after onset (10–90 % rise 0.33 s, FWHM 1.3 s). This is a smoothed
  population stand-in, several times longer than single-unit bursts (≤ 200–300 ms, Schultz 1998),
  because Φ follows S̃ (§6.5, τ_V). In rats the phasic signal belongs to the cue, the partner's
  presentation (§4.2); the model has no cue input, so this transient stands in for it. It replaces
  the ad-hoc `phasic` impulse in `response.js`.
- **Excitement and plateau.** As A rises, φ_A·Aeff² grows slowly: a small sustained positive δ (a
  ramp, Howe et al. 2013). The Ornstein–Uhlenbeck arousal waves η in Aeff give slow fluctuations of
  VTA-l rate (4.5–9.4 Hz in plateau over 20 seeds; 6.9 Hz without the waves) without any added noise
  source.
- **Onset window (ONSET).** In the model, midbrain firing ramps as the expected reward approaches
  (reward-prediction framework; not measured during sex, §4.4). Φ is driven to 1 over
  T_φ = max(T_pre, 1.5 s): VTA-l 17.4 Hz, VTA-m 13.7 Hz, SNc 9.1 Hz; NAcc core peaks at 53.3 nM
  (3.55× rest) 0.7 s after ignition (52.2–53.0 nM over 20 seeds). With the emission setting
  (T_pre = 2.5 s) the peaks are 15.0 Hz and 44.8 nM; with T_pre ≤ 0.5 s, 19.1–19.5 Hz and
  57–60 nM, close to the soft ceiling. This stands beside, but is not derived from, the PET
  activation of the mesodiencephalic junction at ejaculation reported in one study of men (Holstege
  et al. 2003; largely not confirmed by its re-analysis, Georgiadis et al. 2007), which is blood
  flow, not dopamine.
- **Orgasm.** The reward is delivered as a smooth alpha-kernel envelope over the train (τ_r = 1 s).
  δ = r + dV̂/dt reduces to (R_obt − ŵ)·g(t) once the anticipatory derivative has decayed, so the
  size of the consummatory shoulder is set by surprise. With the defaults (R_obt ≈ 1.0, ŵ = 0.5)
  the shoulder holds NAcc core at ≈ 34–40 nM from train time 0.5 to 4 s (peak 39.8 nM at 2 s, mean
  37.4 nM over train time 1–4 s), falls to ≈ 24 nM by the end of the regular train (7.5 s) and to
  ≈ 19–20 nM by ≈ 10 s. The residual ripple at the contraction rhythm is
  ≤ 2.9 nM (peak-to-peak of the linearly detrended NAcc core within one contraction interval, about
  8 % of the shoulder); no evidence links dopamine to individual contractions, and the default never
  follows them.
- **After the train.** V̂ is re-seated, so the drop of value at the orgasm end does not create an
  artificial dip. Recruitment falls as A collapses, Z rises and I suppresses A13/A14, while μ-opioid
  disinhibition rises. With the default "sustained" setting NAcc stays above rest: 1.25× at +1 min,
  1.11× at +5 min, 1.07× at +10 min, 1.04× at +20 min, within 1 % of rest by ~40 min. With "dip" it
  falls to 0.955× at ≈ +3.5 min (0.92–0.96 over 20 seeds, median +3.2 min) and is back at rest by
  ~10 min.
- **Distraction (X), stimulation withdrawal, cancelled ONSET.** Φ falls, so δ is negative: a
  **negative reward-prediction error** (the model analogue of the omission pauses of Schultz 1998).
  The pause is bounded by the floor f_p = 0.5. For a distraction pulse X ← min(1, X + 0.6) 30 s into
  plateau, VTA-l falls from 6.9 to 3.4 Hz and NAcc core to 0.72× rest 0.4 s after the cue, and it
  stays below 0.8× rest for ~0.8 s. A distraction then lowers tonic drive for ~20 s through Γ (X
  decays with τ 20 s).
- **Learning and habituation.** After each orgasm ŵ moves toward 0.8·R_obt. With stimulation held
  (multiple profile, 2,000 s from stimulation start; 10 orgasms deterministic, 12–17 over seeds
  1–5), ŵ rises from 0.50 (0.59 after the first orgasm) to 0.78–0.81. The consummatory shoulder
  (mean NAcc core over train time 1–4 s) rises above the pre-ignition level C̄ by ≈ 16–17 nM at the
  first orgasm and by ≈ 6–9.5 nM at the last (−40 to −60 %), while the absolute shoulder falls only
  5–16 % (38–40 → 33–37 nM), because NAcc stays at 1.5–1.8× rest between peaks (deterministic;
  1.0–2.6× with the level noise). The anticipatory onset peak rises from 52–53 to 55–57 nM: the
  prediction error moves from the reward to its predictor, as in TD learning. The overall climax
  peak therefore stays within 52–58 nM.

### 6.7. Coupling back to `response.js`, and known input issues

**Closed loop (default).** The response model's D is no longer computed by its own D* line. After
every response step the dopamine layer writes D = clamp(0.2 + k_B·(C̄_shell/C0_shell − 1)),
k_B = 1.6, from the slow (τ = 10 s) shell concentration. **Fit procedure:** least squares through
(0, 0) of D − 0.2 on C̄_shell/C0 − 1, sampled every 1 s in EXCITEMENT and PLATEAU of the open-loop
reference (S = 1 from 60 s, seeds 1–10), where D is the galaxy D state:
D = D_lp + 0.1·e^(−(t − t_on)/2 s), dD_lp/dt = (D* − D_lp)/30 s, with t_on the last time S rose
through 0.05. The phasic transient is added to D, not integrated into it: this reading reproduces
the galaxy build table to within ±0.01 (27 of 30 entries exactly; A(2 min) 0.3748, G(7 min) 0.6448
and G(15 min) 0.6746 lie within 0.0005 of a rounding boundary, so their rounding depends on the
order of updates inside a step), whereas integrating it (D += 0.1·e^(−t/2 s)·dt, the form the old
`response.js` intends; its onset test reads S̃ after the update, so at k_h = 10 and S = 1 the
impulse fires only above ≈ 195 fps) gives A(1 min) 0.20 and D(1 min) 0.54 against the table's 0.19
and 0.51 (16 of 30 entries). Result: k_B = 1.60 (R² 0.92,
4,477 samples; the integrated reading gives 1.62). Against D* itself the fit gives 1.71 (R² 0.97).
1.6 is used. Consequences:

- **One dopamine signal.** The displayed accumbens dopamine and the drive in the arousal term
  (1 + γ·D) cannot contradict each other. The hypothesis switch now also changes the arousal
  feedback after orgasm (D at +5 min ≈ 0.40 with "sustained", 0.34–0.44 over 20 seeds; ≈ 0.17 with
  "dip", 0.12–0.19).
- **Prolactin acts in one place.** D no longer contains a satiety gate, so prolactin does not
  suppress D (the old Q = max(I, R) gate is removed with D*); its only default action on dopamine is
  the TIDA short loop (§5).
- **Phasic flares never feed A directly** (C̄ has τ = 10 s).
- **Distraction now also lowers D.** The galaxy D* has no X dependence, but in the closed loop a
  distraction lowers Γ-gated recruitment and therefore C̄_shell and D. One press 30 s into plateau
  takes D from 0.85 to 0.60 (open loop 0.87 → 0.84), so the return to θ takes ≈ 0.4 min longer
  (5.1 against 4.7 min after the cue); the immediate fall of A is almost unchanged (0.78 → 0.66, open
  loop 0.67).
- **Timeline preserved** (simulated, §6.9 row 20): the median θ crossing is 7.37 min after
  stimulation starts (10–90 %: 6.63–8.13 min, 300 seeds; deterministic 8.12 min), against 7.42 min
  (6.70–8.19; deterministic 8.12 min) for the open-loop §7.4 D with the same seeds, which reproduces
  the galaxy figures (median 7.4 min, 10–90 % 6.8–8.2 min, deterministic 8.1 min): over ten
  300-seed batches the open-loop medians are 7.41–7.49 min, the 10 % points 6.65–6.86 min and the
  90 % points 8.07–8.26 min. No run failed to ignite and none ran away.
- Refit k_B with the procedure above whenever drive gains change.

If the closed loop is ever switched off, the response model's D must be renamed in the HUD and in
this text as an abstract "motivational drive", stated to be uncoupled from the displayed nM values.

**Canonical response model: port the corrected galaxy equations.** `brain-system/src/response.js`
is a copy of the galaxy code with the constants from before the RESPONSE.md §7.4 correction. Every
result in §6.9 and §9.6 assumes these changes, all from `RESPONSE.md`
§7.2–§7.9 except the rows marked "this document":

| Item | Current `response.js` | Corrected (canonical) |
|---|---|---|
| Threshold θ | 0.92 | 0.85 |
| τ_A; baseline loss | 440 s; λ = 0.10 | 600 s; λ = 0.03 + λ_s·s, λ_s = 0.15 |
| Genital coupling | κ·(G − A)/720 s | κ·S_eff·max(0, G − A)/60 s (raises A only, only while stimulated) |
| Decay terms on A | s·X inside the 1/τ_A bracket, (λ + s·X + a_H·S̃·H)·A/440 s | remove s·X from the bracket; − A·[s·X/20 s + (1 − S̃)/180 s + max(0, I − 0.08)/90 s] |
| Ceiling on A | A ≤ 1 − I; Aeff = clamp(A + η, 0, 1 − I) | A ≤ 1; A_obs = clamp(A + η, 0, 1) |
| Autonomic arousal | Ah = max(Aeff, 0.92·Ω) in σ* and vitals h; A^1.5 in M | â = min(1, max(A/θ, Ω)) in σ*, M (â^1.5), F and h |
| Satiety gate of D | Q = max(I, R), which keeps D suppressed for ~95 min whatever T_ref | removed (galaxy: Q = I; here D comes from the dopamine layer) |
| Onset phase | `inevitability`, 2.5 s for every profile, irreversible | `onset`: T_pre 0–3 s (default 1.5 s), interruptible (ONSET → PLATEAU when S̃ < 0.5); with the emission setting (u_pre on, T_pre ≈ 2.5 s), irreversible; 2.5 s on screen, so k_h = T_pre/2.5 s |
| Ω during ONSET | phaseTh / 2.5 s | phaseTh / T_pre; after a cancel Ω decays with τ = 2 s; with T_pre = 0 no human time passes in ONSET, so Ω (like all physiology) is held and set to 1 at ORGASM entry (galaxy: "physiology paused when T_pre = 0") |
| Arousal after the train | A_res = 0.35 + 0.4·(1 − I₀) | A_res = 0.35 + 0.45·(1 − I₀) |
| Refractory variable I | steps from 0 to I₀ at the orgasm end | rises in step with the pulses (I ← I + (I_tgt − I_start)·a_k/Σa) and reaches I_tgt at t_e |
| Oxytocin | 1e-3·A secretion; 0.035·Ω; + 0.03·a per pulse | 5e-4·A secretion; 0.03·Ω; no per-contraction bolus |
| Opioid tone Ψ | 0.05·Ω (peak ≈ 1.5) | 0.025·Ω (peak ≈ 0.83 for a 15.5-s orgasm; 0.67–0.92 over seeds) |
| Vasopressin fall | τ 600 s | τ 20 min |
| Prolactin R | no c_ctx; decline τ 25 min; R = min(1.5, Σ_k R_k) over the last four orgasm ends (`_Rat`) | c_ctx = 0.3 + 0.7·I₀; decline τ 40 min (t½ ≈ 28 min); keep R = min(1.5, Σ_k R_k) (this document: the galaxy sum has no ceiling, see point (e) below), summed over all orgasm ends of the session |
| Flush | smoothstep(0.6, 0.95, Aeff) | smoothstep(0.7, 1.0, â) |
| Vitals | RR 14 + 22·h; DBP 75 + 0.45·ΔSBP·h; upper-range HR_pk 175 | ΔRR 13 (upper range 26); ΔDBP 8 (upper range 50); upper-range HR_pk 180 |
| Phase transitions | EXCITEMENT → PLATEAU and RES_EARLY → PLATEAU test A ≥ 0.75; PLATEAU → EXCITEMENT at A < 0.6; EXCITEMENT → BASELINE after `phaseTh > 20`; no-climax exit at A < 0.1 plus 6 screen s; PLATEAU → NO_CLIMAX counts S < 0.05; no NO_CLIMAX → EXCITEMENT or RECOVERY → EXCITEMENT, so with T_ref > 30 min a stimulated user stays in RECOVERY until R < 0.2 | RESPONSE.md §7.6 table verbatim: A_obs ≥ 0.75; A_obs < 0.7 with S̃ > 0.05; A < 0.03 and S̃ < 0.02 held for 20 s; S̃ < 0.05 for ≥ 60 s and A < 0.6; NO_CLIMAX → BASELINE at G < 0.1; NO_CLIMAX → EXCITEMENT on S_eff > 0.05; RECOVERY → EXCITEMENT on S_eff > 0.05 and I < 0.08 |
| No-climax clock | k_h = 60 | max(60, remaining/30 s), remaining = time until G < 0.1, computed once at phase entry (as the recovery clock, §9.3) |
| Clock ramps (this document; the RESPONSE.md §9.2 ramps are for the astro clock) | log ramp over 1 s, instant into ONSET; not specified for T_pre = 0; the human time of a frame is computed once at the frame's k_h, so after a mid-frame ignition the rest of that frame runs ONSET at k_h = 10 | the same: at every phase change except an instant switch into ONSET, log₁₀ k_h moves linearly from its current value to the target over 1 s of screen time (so k_h changes exponentially; `LogRamp`; a first-order approach with τ = 1 s in log space would add ≈ 1 s of screen time to each ramped phase and shift §9.6). On a transition into ONSET, stop the frame's human integration at the transition and spend the remaining screen time at the new k_h (otherwise, at 10 fps, up to 0.5 human s of the 1.5-s ONSET runs in the ignition frame and ONSET lasts 1.70–2.50 s on screen instead of 2.5 s; at 30 and 60 fps one step per frame gives 2.50 s). With T_pre = 0: k_h = 0 during ONSET (no log ramp into or out of it, since log₁₀ 0 is undefined); the clock switches instantly from 0 to 1 at ONSET → ORGASM, with normal ramps after that; ONSET ends after 2.5 s of screen time; zero-length response steps call no `onStep`, and the dopamine layer runs no substep when Δ = 0 (the frame-mean C_j then keeps its previous value, §6.4 (10)) |
| Contraction train | tail of 0–2 minor pulses, intervals 3 s ± 25 %; Δ₀ = 0.8 s and the M&J pattern fixed | RESPONSE.md §7.5: 0–3 minor pulses, amplitude 0.10–0.20, intervals 2–4 s (this port draws each uniformly in 2–4 s); Δ₀ (0.6–0.9 s) and the EMG-like pattern as parameters; t_e = 2 s after the last pulse |
| Ω during the tail (this document's reading of RESPONSE.md §7.4) | Ω = 1 for the whole orgasm phase | the same: Ω = 1 from the first pulse until t_e, then decays with τ = 20 s (see the galaxy notes below) |
| Plateau-without-climax profile | gate active | orgasm gate disabled (RESPONSE.md §7.9) |
| Extended profile (RESPONSE.md §7.9) | q = 1, interval growth 1.04, tail of 0–3 pulses; no amplitude envelope | galaxy: "longer tail, so the orgasm phase may exceed 40 s; q-envelope with 2–3 maxima". Neither is in the code: with q = 1 (15 pulses, a 12.8-s regular train), growth 1.04 and three 3-s tail pulses the orgasm phase lasts 24 s (§6.9 profile table), and even five 4-s tail pulses give only ≈ 35 s. This port records both as omitted; reaching > 40 s would need about seven or more 4-s tail pulses or a defined envelope (for example a_k × (1 + 0.3·sin(2π·k/5))), either of which needs a re-run of the extended row of §6.9 |
| Onset spasm (RESPONSE.md §7.5) | absent | optional, off by default (when on, it fills the ONSET window and sets T_pre to its duration, ≤ 3 s) |
| Integration step (this document, §6.8) | ≤ 0.5 s | ≤ 0.5 s, but ≤ 0.05 s while S and S̃ differ by more than 0.02 and during ONSET and ORGASM |
| Deterministic reference (this document, §6.9, §9.7) | η, q ± 15 % and the tail drawn from `Math.random` directly | constructor options `{ rng = Math.random, deterministic = false }`; `deterministic` sets η = 0, q = p.q exactly and the tail to two pulses at amplitude 0.15, the first 3 s after the last regular pulse and the second 3 s later (three such pulses, each 3 s apart, for the extended profile) |
| Demo script and initial state (this document; needed to reproduce the demo-mode results of §6.9 and §9.6) | `_demoStimulus`: in BASELINE S = 1 once the demo time exceeds 3 s of screen time; S = 1 in EXCITEMENT, PLATEAU, the onset phase and ORGASM, 0 in the resolution and recovery phases (multiple profile: S = 1 in RESOLUTION_EARLY while demoPeaks < 2); plateau-without-climax profile: S = 0 once the demo time exceeds 75 s (12 human min after stimulation starts); demo time counts screen seconds and restarts at BASELINE re-entry; S is evaluated once per frame, at its start. Rapid profile: both post-orgasm G time constants (60 s and 10 min) × 0.5 (`gDecayScale`). After the orgasm, while S_eff > 0.05, G ← max(G after the two-stage decay, that value relaxed toward ν with τ_G) (galaxy: "effective new stimulation can raise G again"). Initial state: σ = 0.1, N = 0.1, D = 0.2, all other states 0 | the same, except the multiple-profile row of §9.8 (stimulation released when the second ORGASM phase begins) |

**Galaxy text points this port settles** (the galaxy document should be corrected to match):
(a) RESPONSE.md §7.4 says both that "the contraction train runs at Ω = 1" and that "after the last
pulse, Ω decays with τ = 20 s"; this port keeps Ω = 1 until t_e. Decaying from the last pulse
instead lowers the Ψ peak from 0.83 to 0.78 and moves the "dip" minimum from 0.955× to 0.946×.
(b) With T_pre = 0, k_h = 0 and a human-time "T_pre elapsed" transition would never run; ONSET must
end on screen time (row above). (c) The galaxy distraction control does not state its size; this
port uses X ← min(1, X + 0.6) per press, as the code does. (d) Galaxy §7.4's opioid "peak ≈ 0.8–0.9
for a default orgasm" holds for a 15-s orgasm (0.83); trains of 8–19 s give 0.67–0.92. (e) Ψ and R
exceed their declared ranges (RESPONSE.md §7.3: Ψ 0–1, R 0–~1.5) with repeated orgasms, because both
accumulate: with stimulation held in the multiple profile, Ψ reaches ≈ 4.4 after 10 orgasms, the
uncapped R sum 2.6 and O 2.7. Ô and Ψ̂ are capped in the dopamine layer, and R is capped at 1.5 (row
above); the galaxy text should state the caps. (f) Galaxy §5.3/§6: Fiorino et al. 1997 used 15-min
samples and cannot resolve a single ejaculation; NAcc dopamine falls after each ejaculation from
its copulation level (Lorrain et al. 1999, 3-min samples); microdialysis bins are 3–15 min, not
5–10 min. The RESPONSE.md §5.3 post-orgasm row ("stays raised after a single ejaculation … declines
only with satiety") should read: NAcc dopamine falls from its copulation level after each
ejaculation (rat, 3-min samples; Lorrain et al. 1999) but stays above baseline in 15-min samples
across repeated ejaculations until satiety (Fiorino, Coury & Phillips 1997); a single
post-ejaculatory interval is not resolved. (g) Galaxy §5.2: add Georgiadis et al. 2007 to the
ventral-midbrain (VTA) entry (the 2003 pattern "largely artefactual", §4.4); the cerebellum row's
sources should read Holstege et al. 2003 (hemisphere clusters artefactual, Georgiadis et al. 2007),
Georgiadis et al. 2007 (deep nuclei, vermis; uncorrected), Georgiadis et al. 2006 (correlation with
rectal pressure only), Komisaruk et al. 2004 and Wise et al. 2017; and the OFC rows should mark the
PET decrease as disputed by the fMRI increase (§4.4). (h) Galaxy §6 serotonin: LH 5-HT was
significant in the pooled post-ejaculatory samples and individually in the 2nd and 3rd PEI (Lorrain
et al. 1997). (i) Galaxy §7.4: write the phasic transient as D = D_lp + 0.1·e^(−(t − t_on)/2 s),
dD_lp/dt = (D* − D_lp)/τ_D, with t_on the last time S rose through 0.05; read as an impulse
integrated into dD/dt, which the current wording suggests, it gives A(1 min) 0.20 and D(1 min) 0.54
instead of the table's 0.19 and 0.51.
The galaxy's own timing figures need no correction: with the phasic transient added to D (§6.7,
fit procedure, point (i)) its build table (to within ±0.01), the deterministic 8.1 min, the 7.4-min
median with 6.8–8.2 min, the rapid profile's 2.7 min (2.68 open loop; 2.45 closed loop) and the
8.8-min rebuild are all reproduced.

**Remaining input gaps.** S_eff is not exported (the dopamine layer recomputes it; export it as
`Seff`). There is no cue/anticipation input before contact, so dopamine
cannot rise before stimulation, unlike the rat screen-phase data; an optional future input K(t)
belongs in the ρ (spontaneous desire) term of the response model, not in the dopamine layer.

### 6.8. Numerical integration

- **Placement.** `ResponseModel.update(dt)` splits each frame into human steps ≤ 0.5 s. The dopamine
  model must step **inside** that loop, after each `_integrate` and `_transitions`, so that it sees
  phase edges and the train timing at full resolution. The hook already exists: the property
  `ResponseModel.onStep`, called as `this.onStep?.(h, S)` after `_transitions` (`main.js` sets
  `model.onStep = (h) => dopamine.step(h, model)`). Extend it to pass the pre-step snapshot: take
  `prev = this.snapshot()` before `_integrate` and call `this.onStep?.(h, prev)`; the second
  argument S is unused by the dopamine layer, so nothing is lost.
- **Substeps.** Each response step of length Δ is divided into n = ceil(Δ/h_max) substeps with
  h_max = 0.02 s while k_h ≤ 20 (all phases with phasic content) and h_max = 0.1 s when k_h > 20 (late
  resolution and recovery, where only tonic dynamics matter). k_h is the current frame's clock:
  `update()` steps the `LogRamp` at its start and returns `{ kh }`; store that number on the model as
  `khNow` before the step loop, so that `step` sees the current frame's value (`model.kh` is the
  `LogRamp` object, not a number).
- **Frame-rate independence.** Response inputs held constant over a response step (up to 0.5 s of
  human time) make δ a staircase and the phasic peaks depend on the frame rate. Two rules remove
  this: (a) inputs are interpolated linearly inside each response step (§6.4 (12)); (b) the response
  step is capped at 0.05 s while S and S̃ differ by more than 0.02 and during ONSET and ORGASM.
  Simulated in demo mode (frame dt clamped at 0.1 s as in `main.js`), the onset NAcc core peak,
  taken as the maximum over all dopamine substeps, is 44.7 / 40.9 / 38.8 / 38.3 nM at 10 / 30 /
  60 / 240 fps with neither rule (VTA-l 15.5 → 10.9 Hz), 38.2–38.9 nM with interpolation alone, and
  38.30 nM at every frame rate with both (climax 53.28–53.32 nM). Sampling only at frame ends
  under-reads the peak (33.6 nM at 10 fps with both rules), so tests and HUD peaks use the substep
  maximum. Adaptive quality can lower the frame rate on weak GPUs, so both rules are required.
- **Update rule.** Every linear or linearised first-order state uses the exact exponential update for
  coefficients frozen over the substep: x ← x* + (x − x*)·e^(−k·h). For C_j the clearance is
  linearised at the current value, k_eff = V_max/(K_m + C_j) + k_l, with C* = J/k_eff. This is
  unconditionally stable and keeps C positive. Receptors, filters and release-plasticity logs use the
  same rule. The value filter uses V̂ ← V + (V̂ − V)·e^(−h/τ_V), and δ uses the secant
  dV̂/dt = (V̂_new − V̂_old)/h; this is the form behind every §6.9 value. The form (V − V̂_old)/τ_V
  gives peaks ≈ 1 % higher (onset 38.7 nM, VTA-l 10.8 Hz; climax 53.6 nM, VTA-l / VTA-m / SNc 17.5 /
  13.8 / 9.2 Hz).
- **Stability.** Each concentration equation is monotone with local eigenvalue −(V_max·K_m/(K_m + C)² +
  k_l) < 0. k_l > 0, release depression and the soft ceiling (ν ≤ 20 Hz by construction) keep it
  globally bounded. The eigenvalue is largest as C → 0, k_max = V_max/K_m + k_l = 20.1 s⁻¹ in the
  dorsal striatum, so explicit Euler would need h < 2/k_max ≈ 0.10 s for stability and h < 0.05 s
  to avoid overshoot; the exponential update has no such limit.
- **Accuracy.** Tonic values are identical (Δ ratio ≤ 0.01) at Δ = 0.5, 0.05 and 0.01 s. Phasic
  peaks are independent of the frame rate once inputs are interpolated and the step cap applies
  (above).
- **Cost.** ~85 scalars. In the default cycle the largest load is recovery (k_h ≈ 190, 0.1-s
  substeps): ≈ 190 substeps per frame at the 0.1-s frame clamp (≈ 32 at 60 fps); early resolution
  (k_h 20, 0.02-s substeps) needs 100 at the clamp. A 12-h refractory profile reaches k_h ≈ 2,070
  in recovery: ≈ 350 substeps per frame at 60 fps but ≈ 2,100 (plus ≈ 410 response steps) at the
  10-fps clamp. A reference JavaScript implementation costs ≈ 3 µs per substep, so the default cycle
  stays below 1 ms per frame (≈ 0.6 ms at the clamp), but the 12-h profile at 10 fps needs ≈ 6.5 ms.
  When k_h > 200, either cap the human time advanced per frame or raise h_max to 0.5 s (only tonic
  dynamics remain).
- **Determinism.** The dopamine model has no random numbers of its own; all stochasticity comes from
  η and the train in `response.js`.

### 6.9. Validation targets and model results

Reference simulation: the equations above, closed loop (k_B = 1.6), coupled to a port of the
corrected galaxy response model with every row of the §6.7 table (single profile, T_pre = 1.5 s,
interruptible; Ω = 1 until t_e); "sustained" default; S = 1 from 60 s until the orgasm end, then 0;
Δ = 0.05 s; dopamine substeps 0.017 s (n = 3 per step, h_max 0.02 s); unless stated. The reference
is **deterministic** so that it can be reproduced from the text: level noise η = 0, q = 0.5
(9 regular pulses at train times 0, 0.80, 1.60, 2.40, 3.26, 4.20, 5.21, 6.29 and 7.47 s) and two
minor tail pulses of amplitude 0.15 at train times 10.47 s and 13.47 s (3 s after pulse 9 and 3 s
apart), so t_e = 15.47 s (RESPONSE.md §7.5 example). Where the level noise or the random train matters,
the median and range over 20 seeds (q ± 15 %, 0–3 tail pulses, 8.3–19.3-s trains) are given as well.
The text alone suffices to reproduce this table: an implementation written only from §6.4–§6.5,
§6.7 (including its demo-script and initial-state row, which the demo-mode results need) and galaxy
§7.2–§7.9 reproduces every deterministic row, the §6.6 figures, the profile table and the §9.6
timeline (§11.2). All concentrations are rat-calibrated model values; human values
are unknown.

| # | Quantity | Target (source, species) | Model result |
|---|---|---|---|
| 1 | Tonic NAcc / dorsal striatum / PFC | 5–20 / 5–20 / 0.5–2 nM (Parsons & Justice 1992; Morón et al. 2002; R) | 15 / 20 / 2.0 nM |
| 2 | Receptor occupancy in NAcc core (modelled, high-affinity-state K_d from rodent-based modelling; Dreyer et al. 2010) | D2 0.5–0.67 / D1 0.01–0.05 at rest | rest D2 0.60 / D1 0.015; plateau mean 0.69 / 0.021; climax peak 0.81 / 0.050; +5 min 0.62 ("sustained") or 0.59 ("dip") |
| 3 | Clearance half-time t½ = ln2·τ_clear | dorsal striatum 40–60 ms; NAcc core 60–110 ms; shell 120–230 ms; PFC ≥ 0.7–1 s (Wu et al. 2001; Garris & Wightman 1994; R) | 37.9 ms (2 ms below target); 59.1 ms; 122 ms; 0.697 s; amygdala 0.880 s; hypothalamus 2.31 s; median eminence 3.47 s (ln 2·τ_clear at C₀). Clearance slows above C₀: a core transient peaking at 50 nM falls halfway to rest in ≈ 71 ms (chord t½ at 50 nM 68.6 ms, local-slope t½ 86 ms) |
| 4 | Onset transient (NAcc core), standing in for the cue transient | tens of nM volume-averaged, rise 0.1–0.3 s, decay < 1.5 s (FSCV, male rats; Robinson et al. 2001; Phillips et al. 2003; electrode values are larger, §3.6) | +23 nM (peak 38.3 nM) at 0.6 s (10–90 % rise 0.33 s, slightly slower than the FSCV range because Φ follows S̃, §6.5 τ_V; FWHM 1.3 s; 34 / 22 / 18 nM at 1 / 2 / 3 s); shell +18 nM; dorsal striatum +12 nM; VTA-l 10.7 Hz (FWHM 1.6 s), a smoothed population stand-in (§6.5, τ_V) |
| 5 | Onset transient (PFC, amygdala) | smaller, later, longer (sparse DAT) | +0.9 nM at 1.4 s; +2.2 nM at 1.5 s |
| 6 | Tonic rise during stimulation | +40–100 % in samples of several minutes; ~170 % by voltammetry; dorsal striatum smaller (Damsma et al. 1992; Mas et al. 1990; male rats) | NAcc core +29 / +35 / +42 / +45 / +46 % at 1 / 2 / 4 / 6 / 7 min; plateau mean core 1.46×, shell 1.41×, dorsal striatum 1.33×, PFC 1.41× (core 1.45–1.47× over 20 seeds) |
| 7 | MPOA rise | present before and during copulation (Hull et al. 1995, male rats; magnitude not verified) | +43 % (2 min), +54 % (4 min), +61 % (7 min); plateau 1.61× |
| 8 | Peak population rates | 12–20 Hz (population mean), never at the ceiling with defaults; SNc below the VTA | VTA-l 17.4, VTA-m 13.7, SNc 9.1 Hz (soft ceiling 20 Hz). T_pre ≤ 0.5 s: VTA-l 19.1–19.5 Hz; held repeated orgasms or the pulse-locked hypothesis: up to 19.9 Hz (SNc ≤ 14.0 Hz) |
| 9 | Climax | no data in any species; peaks set by the equations, not by a ceiling | core 53.3 nM (3.55×) 0.7 s after ignition (52.2–53.0 nM over 20 seeds); shell 46.8; dorsal striatum 45.4 (2.27×); PFC 4.6; amygdala 11.1; train shoulder ≈ 34–40 nM from train time 0.5 to 4 s (peak 39.8 nM at 2 s, mean 37.4 nM over train time 1–4 s), ≈ 24 nM at the end of the regular train, ≈ 19–20 nM by 10 s; ripple at the contraction rhythm ≤ 2.9 nM (peak-to-peak of the linearly detrended NAcc core within one contraction interval). T_pre 2.5 s (emission setting): core 44.8 nM. Pulse-locked hypothesis: dorsal striatum 55 nM, core swinging 17–51 nM over the regular train, ripple 16–24 nM per contraction interval; lantern E (§8.1 mapping, τ_vis 0.3 s) would swing 0.10 (core) and 0.12 (dorsal striatum) within a contraction interval, against 0.021 / 0.016 by default, hence the τ_vis ≥ 2 s rule of §6.10 (0.016 / 0.017) |
| 10 | Return after orgasm (per hypothesis) | unresolved: NAcc falls from its copulation level after ejaculation (Lorrain et al. 1999) and, in 15-min samples, stays above baseline across repeated ejaculations until satiety (Fiorino et al. 1997); a dip below rest is inferred (Lorrain et al. 1997, 1999); male rats; no human data | "sustained": 1.28× (+0.5 min), 1.25× (+1), 1.18× (+2), 1.11× (+5), 1.07× (+10), 1.04× (+20), 1.02× (+30); 10-min bins 1.13 / 1.05 / 1.03; never below rest (20 seeds: +10 min 1.08, 1.05–1.09). "dip": 1.10× (+0.5), 1.04× (+1), 0.98× (+2), 0.96× (+5), 1.00× (+10), 1.02× (+20); minimum 0.955× at +3.5 min (20 seeds: median 0.95, 0.92–0.96, at +2.7–4.1 min) |
| 11 | MPOA after orgasm | — (no data) | 0.81–0.83× at +0.5–2 min; 0.88× at +5 min; 1.0× by ~20 min |
| 12 | Median eminence (TIDA) | consequence of R: brief dip (withdrawal hypothesis), then short-loop rebound (rodent) | 0.42× at +17 s after t_e (0.42–0.45 at +9–25 s over 20 seeds); 1.43–1.51× at 20–30 min (with the R plateau); 1.21× at 60 min; lactotroph D2 0.46 (trough) → 0.75 (20–30 min) against 0.67 at rest |
| 13 | Spinal (A11; lumbosacral proxy) | — (rodent) | ×2.4 at the end of the train (2.3–2.4 over 20 seeds); baseline (< 1.02×) by ~20 min |
| 14 | Distraction pause (negative RPE); X ← min(1, X + 0.6) once, 30 s after plateau entry | partial, short (Bayer & Glimcher 2005, Mk) | VTA-l 6.9 → 3.4 Hz; core 21.8 → 10.9 nM (0.72× rest) 0.4 s after the cue, below 0.8× for 0.8 s; D2 0.69 → 0.63; A 0.78 → 0.66 over 20 s; D 0.85 → 0.60 (open loop 0.87 → 0.84); next θ 5.1 min after the cue (open loop 4.7) |
| 15 | Stimulation withdrawn 30 s into plateau (negative RPE) | bounded and brief | core 0.74× rest at +0.4 s, below 0.8× for ~1 s; 1.22× at +30 s, 1.14× at +2 min, 1.05× at +5 min |
| 16 | Repeated orgasms, stimulation held (multiple profile, 2,000 s from stimulation start) | smaller consummatory error after learning; no runaway | 10 orgasms deterministic (12–17 over seeds 1–5); ŵ 0.50 → 0.79 (0.78–0.81); shoulder (mean core, train time 1–4 s) above the pre-ignition C̄ 16.5 → 8.9 nM (−46 %; −40 to −60 % over seeds), absolute shoulder 38.5 → 35.2 nM (−5 to −16 % over seeds); onset peak 53 → 55–57 nM; NAcc between peaks (t_e + 5 s to the next ignition) 1.52–1.79× (0.96–2.56× over seeds) |
| 17 | Prolactin → mesolimbic opt-in (z_R = 0.2) | — (speculative) | NAcc 1.06 / 0.94 / 0.91 / 0.90 / 0.92 in 10-min bins after the orgasm; minimum 0.90× at +30 min |
| 18 | κ-opioid brake | 5–10 % in plateau (hypothesis) | F_K = 0.943 in plateau (5.7 %), 6.8 % at most |
| 19 | Bounds | positive, finite, no runaway | no NaN or negative value; C/C₀ in [0.42, 3.82] over the default, "dip", pulse-locked, distraction, withdrawal and held-stimulation runs (up to 4.0× with T_pre ≤ 0.5 s); max D2 0.83, max D1 0.054; returns to rest |
| 20 | Response timeline with the closed loop | RESPONSE.md §7.4: θ median 7.4 min, deterministic 8.1 min; rebuild ≈ 8.8 min after T_ref; R < 0.2 at ≈ 95 min | θ median 7.37 min (10–90 %: 6.63–8.13; 300 seeds; deterministic 8.12); open loop with the same seeds ≈ 7.4 (6.70–8.19; deterministic 8.12; ten 300-seed batches: 10 % points 6.65–6.86, 90 % points 8.07–8.26); stimulation resumed at T_ref = 15 min: next θ 8.0 min later ("sustained") or 8.4 min ("dip"), against 8.8 min open loop; T_ref = 10 s with stimulation held: 7.6 / 7.8 min after t_e (open loop 8.8); baseline re-entered 94.4 min after the orgasm end; R(60 min) = 0.47 |
| 21 | Frame-rate independence | onset peak identical at 10–240 fps | 38.30 nM at 10, 30, 60 and 240 fps (maximum over dopamine substeps, with interpolation and step cap) |

**Expected ranges by profile and hypothesis** (demo mode, 60 fps, deterministic as above, 1-s clock
ramps; NAcc core relative to rest; "late res." = mean from 5 to 30 min after the (last) orgasm end;
the multiple profile runs the corrected demo script of §9.8, which releases stimulation when the
second ORGASM phase begins; the extended profile uses q = 1, interval growth 1.04 and three tail
pulses, an orgasm phase of 24 s):

| Profile | First θ after stimulation start | Climax core peak | VTA-l / SNc max | Lowest NAcc after the climax or withdrawal: "sustained" / "dip" | Late res.: "sustained" / "dip" | Screen cycle |
|---|---|---|---|---|---|---|
| Single peak (default) | 8.1 min | 53.3 nM | 17.4 / 9.1 Hz | 1.00 / 0.955 (at +3.5 min) | 1.05 / 1.01 | 131 s |
| Multiple peaks | 8.1 min; second peak 33.4 s of screen time later (2.7 human min); with stimulation held, a peak every ≈ 33 s (≈ 2.7 human min) | 53.3 nM first, 57.3 nM second ("dip" 57.1) | 19.5 / 9.6 Hz | between the peaks 1.52 / 1.47; after the second peak 1.00 / 1.00 (with I₀ = 0.05, I decays with τ_I = 20 s, so Z stays below 0.02 and there is no dip) | 1.13 / 1.08 | ≈ 165 s (two peaks; the demo releases stimulation at the second orgasm, §9.8) |
| Rapid rise | 2.45 min | 54.8 nM | 17.4 / 8.9 Hz | 1.00 / 0.965 (at +3.7 min) | 1.05 / 1.01 | 97 s |
| Plateau without climax | no climax | — | 10.7 / 5.8 Hz | 0.73 / 0.73 (negative RPE at withdrawal, 1.3 s below 0.8×) | — | 112 s (no-climax clock max(60, remaining/30 s)) |
| Extended | 8.1 min | 53.3 nM | 17.4 / 9.1 Hz | 1.00 / 0.99 (at +3.0 min) | 1.07 / 1.02 | 140 s |
| Older adult (T_ref 12 h) | 9.0 min | 53.2 nM | 17.4 / 9.1 Hz | 0.90 (at +52 min) / 0.77 (at +34 min) | 0.95 / 0.79 | 135 s (recovery capped on screen) |

The older-adult profile holds refractory inhibition for hours, so Z stays high and NAcc stays below
rest through late resolution, mildly with "sustained" and clearly with "dip"; the HUD should say
so. The negative-RPE dip of the no-climax profile is bounded by f_p = 0.5 (0.52× rest with
f_p = 0.35, the current code's floor). With the level noise the demo's first θ for the single
profile varies between ≈ 6.9 and 8.5 human min over 20 seeds, and the cycle between 119 and 134 s.

Unit tests in Node should assert rows 1, 2, 4–9, 10 (both hypotheses), 14, 15, 18 and 20 within
±20 %; row 3 as analytic values to 3 significant figures; row 19 as bounds checks; row 21 as the
maximum over all dopamine substeps, equal within ±0.5 nM at 10, 30, 60 and 240 fps.

### 6.10. Hypothesis switches

Exposed in a collapsed "Hypotheses" dropdown of the HUD with one control per row (§9.5). One rule
covers every hypothesis channel (climax dopamine, post-orgasm course, TIDA withdrawal, A11,
prolactin → mesolimbic, κ feedback, session satiety; §9.5, §10 rule 9): its HUD badge is always
shown; only when a switch is set away from its default are the visual elements it alone produces
(for example the pulse-locked spark modulation) drawn at ≤ 70 % opacity with a dashed legend entry.
Default-on channels (the A11 beam, the TIDA withdrawal dip, κ feedback) are drawn normally:

| Switch | Default | Alternative | Evidence |
|---|---|---|---|
| Climax dopamine | smooth onset ramp + consummatory envelope (alpha kernel, τ_r = 1 s) | pulse-locked bursts (τ_k = 0.3 s), drawn only on small points (somata embers, release sparks), never on lantern glows, ≤ ±15 % luminance. The switch replaces δ in the model, so the shared C_j follows the contractions (core 17–51 nM, §6.9 row 9); while it is on, lantern E and spread therefore use τ_vis ≥ 2 s during ORGASM, which brings the per-contraction swing of E from 0.10–0.12 back to the default level (0.016–0.017, against 0.021 / 0.016 for NAcc core / dorsal striatum in the default mode; tested at ≤ 0.025, §9.7); somata and release sparks read the unfiltered ν and C, capped at ±15 % luminance, and the HUD shows the unfiltered C | no data for either; nothing links dopamine to individual contractions |
| Prolactin on mesolimbic DA | off (z_R = 0) | z_R = 0.2, labelled "speculative" | Krüger et al. 2002 (hypothesis) vs Valente, Marques & Lima 2021 (mice, against a causal role in refractoriness) |
| Post-orgasm NAcc | **"Sustained above rest (default; model choice)"**: z_Z = 0.2, g_Ψ = 0.5 | "Serotonergic dip below rest (rat, inferred from Lorrain et al. 1997, 1999)": z_Z = 0.5, g_Ψ = 0.3 | both rest on male-rat data and both fall from the plateau: NAcc falls from its copulation level after ejaculation (Lorrain et al. 1999) and, in 15-min samples, stays above baseline across repeated ejaculations until satiety (Fiorino et al. 1997); whether it dips below rest is unknown. Neither reading is established, neither has sub-minute resolution or a human counterpart, and "sustained" is the default as a model choice. Prolactin is not part of either option |
| κ-opioid feedback | g_K = 0.2 on the relative D1 excess | 0 | Spanagel et al. 1992 (direction only); hypothesis |
| Session satiety | off | g_sat = 1/(1 + (n_eff/3)²), n_eff = Σ_k e^(−(t − t_e,k)/3 h), multiplies P_VTAl,m; a "novel stimulus" event halves n_eff (a partial reset) | rat only (Beach & Jordan 1956; Fiorino et al. 1997: renewed copulation with a novel female restored only part of the rise, +34 % against +95 %); off because the demo loops |
| TIDA withdrawal share | s_T = 0.6 (assumption) | 0 (prolactin-releasing factors only) | unresolved; TIDA activity at orgasm never measured |
| Onset window | T_pre = 1.5 s, interruptible | emission setting: u_pre on, T_pre ≈ 2.5 s, cannot be cancelled | RESPONSE.md §7.2, §7.4, §7.9; the emission setting applies to bodies with a prostate and seminal vesicles and is never a sex-coded preset |

---

## 7. The brain geometry

### 7.1. Frame and units

All geometry is stored in MNI millimetres and mapped by `MM = 0.01` render units per mm (1 unit =
10 cm) with z up, matching the camera (`brain-system/src/anatomy.js` L7–L8; `camera.js`). The camera
target `CENTER = (0, −16, 6)` mm is the centre of the bounding box. A narrow field of view (0.55 rad,
`main.js`) keeps perspective distortion low on a solid object.

### 7.2. Procedural construction (no downloaded meshes)

1. **Cerebrum** (signed distance field per hemisphere, `sdCerebrum`): one ellipsoid centred
   (0, −17, 14) with radii (68, 86, 62) mm, a flattened orbital and basal surface at z = −23 in front
   that rises 0.12 mm per mm behind y = −10, temporal lobes (±43, −15, −21) with radii (24, 44, 21)
   smoothly unioned (k = 5 mm), an inferior-medial notch where diencephalon and brainstem emerge, and
   the longitudinal fissure as a plane 1 mm from the midline (2 mm gap). Measured volume 1,386 cm³
   for both hemispheres (2 × 10⁶-sample Monte Carlo), extents 136 × 172 × 118 mm (x −68…68,
   y −103…69, z −42…76). That is the size of the MNI152 template, which is enlarged relative to native
   brains; a native adult cerebrum is about 1,000–1,100 cm³ [T]. The hull is not, and should not be
   described as, a native adult volume.
2. **Folding.** Gyri and sulci from warped ridged gradient noise (spacing ≈ 14 mm) plus explicit major
   sulci with depths: central 20 mm, Sylvian 26 mm, parieto-occipital 18 mm, calcarine 16 mm,
   cingulate 12 mm. Calibration targets: gyrification index ≈ 2.5–2.6 and total cortical area
   ~1,800–2,400 cm² (Zilles et al. 1988), crown-to-crown spacing 12–20 mm, about two thirds of the
   cortex buried in sulci. Real sulci are narrow clefts between broad rounded gyri, not sine waves
   (Tallinen et al. 2014).
3. **Cortical ribbon.** Points fill a 2.5 mm ribbon under the hull (mean thickness 2.5 mm, range
   1–4.5 mm; Fischl & Dale 2000), pushed into sulci and dimmed there (flux × e^(−depth/6 mm)). The
   medial face leaves the callosal window empty. The ribbon must not follow the inferior-medial
   notch, which is mostly not cortex but the cut where hypothalamus, midbrain and pons emerge:
   reject cortical samples whose surface point lies within 1.5 mm of the notch ellipsoid
   (0, −22, −43) r (23, 40, 36) at |x| ≤ 15 mm and −45 < y ≤ +8; label the remaining notch-surface
   points with |x| > 15 mm `temporal` (uncus, parahippocampal gyrus) and the medial ones at
   y ≤ −45 `temporal` (basal occipitotemporal surface; `occipital` behind y −72) (the code labels
   all of them `parietal`); and reject any cortical point that falls inside a NUCLEI, DA_GROUPS or
   BRAINSTEM volume. At 240 k this frees ≈ 2,950 samples (≈ 2,650 from the medial notch window, the
   rest from deep volumes elsewhere) for the convexity (§2.4, §7.3).
4. **Cerebellum** (`sdCerebellum`): hemispheres (±23, −63, −37) with radii (26, 27, 21) and a vermis
   (0, −61, −31), notched for the fourth ventricle and pons, with a tentorial upper surface. Measured
   124 cm³ MNI (≈ 99 cm³ native), x ±49, y −90…−36, z −58…−14: the width is realistic, but the
   cerebellum is 25–35 % too small as well as 5–10 mm too shallow (cerebellum : cerebrum 0.089 against
   ≈ 0.12–0.15 real). The hull also interpenetrates the inferior temporal surface of the cerebrum
   hull (4.1 cm³ at y −59…−37, about 95 % of it inside the temporal lobe and none occipital), where
   the tentorium should separate them, so cortical and cerebellar points intermix there; and below
   the occipital lobe an empty wedge of 12–15 mm at y −84 (8 mm at y −76) separates the cerebrum
   base from the cerebellar top, where only the thin tentorium lies in reality. Lower only the
   inferior half: keep the hemisphere centres (±23, −63, −37) with r_z 21 above z −37 and use r_z 28
   below it, and give the vermis r_z 25 below z −31 (in `sdEllipsoid`, r_z = z < c_z ? r_down : r_up);
   keep the tentorial plane, and inside `sdCerebellum` subtract the cerebrum with a 1.5-mm tentorial
   gap, d = smax(d, −sdCerebrum(x, y, z, sign x) + 1.5, 2). Result (Monte Carlo): ≈ 137 cm³ MNI
   (≈ 109 cm³ native), z −65…−16, no overlap, gaps unchanged; that closes about a fifth to a third of
   the gap to the MNI-space target of ≈ 160–185 cm³, to be checked against the SUIT/MNI cerebellar
   mask. (Lowering the whole hull instead, centres z −42 with r_z 23 and vermis z −35, also moves the
   tentorial surface down and widens the occipital gap to 14–19 mm; with the carve it gives 136 cm³.)
   To approach the target and narrow the gap, optionally also enlarge posteriorly: hemispheres
   (±24, −65, −37) r (26, 29, 24) with r_z 28 below the centre, vermis (0, −61, −31) r (10, 28, 21)
   with r_z 25 below, tentorial slope 0.30 instead of 0.35: ≈ 152 cm³ MNI, y −94…−36, z −65…−16,
   gap at y −84 10–12 mm (y −94 is 2 mm beyond the −92 target).
   Folia groups ~2.2 mm apart around a transverse axis; grooves lower the areal luminance by at most
   30 % (point rejection and dimming combined) so the regular stripes never form a high-contrast
   grating (photosensitivity, §10). Single folia (1–2 mm) are finer than the point spacing and are
   not drawn.
5. **Deep nuclei** as filled soft ellipsoids or tubes at the §2.4 centroids (Gaussian density falloff
   at the edge for the VTA and the hypothalamic nuclei, whose borders are indistinct; not yet in the
   code, §9.8).
6. **Brainstem and upper cord** as a tube swept through (0, −24, −4), (0, −24, −10), (0, −26, −22),
   (0, −27, −33), (0, −34, −47), (0, −40, −60), (0, −44, −74), (0, −46, −88) with elliptical cross-
   sections of semi-axes 12–17 × 8–13 mm (midbrain, pons) narrowing to 6 × 5 mm (cord); the first
   point has semi-axes (12, 8). The code's first point (0, −16, 0) with semi-axes (13, 11) lies in the
   diencephalon (inside the third ventricle, 8 mm in front of the posterior commissure): ≈ 8 % of the
   brainstem stars then lie above z −4, in the thalamic floor and subthalamus, around the A11, A13
   and zona-incerta groups. With (0, −24, −4, 12, 8) only 0.2 % do. That filler is, however, the
   only tissue around A11 in the code: the code tube holds all of A11, whereas the new tube holds
   20 % of A11 at its §7.3 position and none of A13 at its §7.3 site, and no other drawn structure
   reaches either group. The new first point therefore needs the two ellipsoids of §7.3, a
   rostromedial ZI around A13 and a posterior hypothalamic ellipsoid around A11, or their somata
   float in empty space. A8 and the RMTg lie inside the tube, and most of the VTA (≈ 80–95 %, depending on the membership test), the red nucleus
   (≈ 90–100 %) and the midline column (≈ 90–100 %); the PAG protrudes 2–4 mm dorsally and above
   z −4 (≈ 70–75 % inside), and the SNc lies at the anterolateral surface of the tube (≈ 55–65 % of
   the code's ellipsoid inside), which is why §7.3 adds the crus ellipsoids.
7. **White matter and voids.** The corpus callosum is a faint arch (axons, 32 % flux, ≤ 1 % of
   points). Voids remove only white-matter, brainstem and cortical points, never nucleus or dopamine
   points (§7.3); with the §7.3 positions no dopamine soma and no nucleus star lies inside the
   third-ventricle lumen except ≈ 2 thalamic stars at its medial edge (0.02 % of the 15°-yawed
   thalamus, protected by the void rule), so the ventricles hold almost no neuron stars, though a
   few protected dopamine axon and varicosity points (≈ 40–50 at 240 k) still cross it.
8. **Pituitary** is glandular tissue, drawn as a faint haze of wide soft sprites, not as neuron
   stars, joined to the median eminence by the stalk. The gland haze (region `pituitaryGland`) and
   the median eminence with the stalk (region `medianEminence`) are separate regions; the stalk
   keeps its haze sprites (kind GLAND) under `medianEminence` (§7.3).

### 7.3. Recommended changes to the current geometry

| Change | Reason |
|---|---|
| Draw the SNc as a rotated ellipsoid centred at (±10.5, −18.5, −13), the midpoint of the axis (±13, −13, −10) → (±8, −24, −16) (13.5 mm between these points), with half-axes 8.5 along (∓0.37, −0.81, −0.45) (tips at (±13.7, −11.6, −9.2) and (±7.3, −25.4, −16.8)), 4 along (±0.91, −0.41, 0) and 2 along (∓0.18, −0.41, 0.90) (a half-length of 6.75 mm would end exactly at the two axis points); enclose the SN with a pair of cerebral-peduncle (crus) ellipsoids ventral and lateral to it, because the round brainstem tube does not reach the crura and the rotated SNc would otherwise protrude in front of the midbrain filler: centre (±13.5, −18, −16.5), long axis parallel to the SNc axis, (∓0.37, −0.81, −0.45), half-length 9 mm; mediolateral half-width 4 mm along (±0.91, −0.41, 0); dorsoventral half-thickness 2.5 mm along (∓0.18, −0.41, 0.90); region `brainstem`, kind BRAINSTEM (white matter drawn as filler neurons, like the rest of the brainstem tube). Checked (Monte Carlo): extent x 8.6–18.5, y −25.5…−10.3, z −21…−12; ≈ 1 % of the rotated SNc ellipsoid above inside it (none if the SNc were centred at the code's (±11, −18, −12)), and 66 % of the SNc inside the new brainstem tube; no overlap with VTA, STN, red nucleus, mammillary bodies, hypothalamus or amygdala | SN is an oblique band running anterolateral to posteromedial (Keuken et al. 2014); the earlier rostral end (±14, −12, −8) lay 3.7 mm from the STN centre, at its edge; the new rostral tip lies 4.75 mm from it, outside an STN envelope of r (3, 4.5, 2) |
| Add A8 at (±10, −26, −13) and the midline IF/RLi/CLi column at (0, −20, −11) | A8 is ~5–15 % of midbrain DA cells; the midline column bridges the two VTAs |
| DA_GROUPS shares: SNc 0.57, VTA + midline 0.20, A8 0.086, A11, A12, A13, A14 0.036 each (= the 3,500-soma split of §7.5; 67 / 23 / 10 % of the midbrain somata) instead of VTA 0.30, SNc 0.52, A11 0.03, A12–A14 0.05 | primate proportions (§2.2); otherwise label the shares as a visual weighting |
| Move the A13 lantern group to (±7, −12, −5); keep the non-dopaminergic whole-ZI ellipsoid at (±12, −16, −3) and add a rostromedial ZI ellipsoid (±7.2, −12, −4.8) r (2.5, 3.4, 2.0) (71 mm³; NUCLEI share ≈ 0.005, the density of the whole ZI), region `zonaIncerta`, kind nucleus, inside which the A13 somata sit (99.9 % of the A13 volume; medial ZI at the dorsal hypothalamic border) | A13 is the rostromedial zona incerta; the whole-ZI centroid is lateral, above the STN (low confidence, extrapolated from rat and primate). The site (7, −12, −5) lies outside the whole-ZI ellipsoid (x 9.8–14.2), the thalamus, the hypothalamus and the new brainstem tube, so without the added ellipsoid its somata would float in empty space. Checked (Monte Carlo): the ellipsoid spans x 4.7–9.7, y −15.4…−8.6, z −6.8…−2.8 and has no overlap with the 15°-yawed thalamus, the hypothalamus, the whole-ZI ellipsoid, A11, the third-ventricle lumen or the new brainstem tube; 2.5 % of it lies inside an STN envelope of r (3, 4.5, 2) around (±12, −13, −5). An earlier proposal, (±8.5, −12.5, −4.5) r (2.2, 3, 1.6), held only 43 % of A13 and lay 21 % inside that STN envelope |
| NUCLEI radii: do not inflate the axis-aligned ellipsoids to native MRI volumes; they cannot reach those volumes without overlapping. Use thalamus (±11, −18, 8) r (8.5, 16, 9.5) → 5.4 cm³ (floor z −1.5, clear of the ZI); putamen (±26, 2, 3) r (5, 18, 11) → 4.1 cm³ (also the TERMINALS entry; extent x 21–31, y −16…+20, z −8…+14); pallidum (±18.5, −4, −1) r (3.5, 9, 6) → 0.79 cm³. Checked overlaps (Monte Carlo): pallidum inside putamen 1 % (25 % now), ZI inside thalamus 2 % (9 % now), no thalamus–pallidum contact, but the minimum thalamus–pallidum clearance, which stands for the posterior limb of the internal capsule (real thickness ≈ 5–7 mm [T]), falls to ≈ 0.25–0.3 mm (code ≈ 1.1 mm). Shifting the pallidum 1 mm laterally restores ≈ 1.0 mm but puts 8.7 % of it inside the putamen. Preferred: rotate the thalamus ellipsoid 15° about z, anterior pole medial (long axis (∓sin 15°, cos 15°, 0) = (∓0.26, 0.97, 0)); at the same volume this gives 1.35 mm clearance, ZI inside thalamus 1.7 %, 5.0 mm to the putamen and a medial edge at x ≈ 1.8 (0.02 % inside the third-ventricle lumen). Rotation support is needed for the SNc anyway | these are MNI-space volumes (≈ 4.3 / 3.3 / 0.6 cm³ native) against typical MRI volumes of 6–8, 4.5–5.5 and 1.5–2 cm³ per side ([T]); the current radii give 4.5, 3.1 and 0.59 cm³. Inflating the radii around unchanged centres to 6.6 / 4.7 / 1.3 cm³ would drop the thalamic floor to z −4 (ZI 72 % inside the thalamus), push the pallidum 36 % into the putamen and make the thalamus touch the pallidum, deleting the internal capsule. Only rotated or wedge shapes could reach MRI volumes; the shortfall is disclosed (§2.4) |
| Amygdala (±23, −4, −17) r (7, 8, 7) (centre moved, radii kept; NUCLEI and the amygdala TERMINALS entry); hippocampus control points (±26, −12, −21, 5.5) → (±29, −21, −15, 5.5) → (±30, −31, −7, 4.5) → (±24, −39, 3, 3) in NUCLEI, and the first three of these points for the hippocampus TERMINALS tube | the hippocampal head point (25, −8, −20, r 6) lies inside the amygdala ellipsoid: the two fields share ≈ 300 mm³ (18 % of the amygdala), so their stars and lanterns interpenetrate. With these values (swept-disc Monte Carlo) the overlap is ≈ 21 mm³ (1.3 %), the amygdala is 1.64 cm³ MNI (≈ 1.31 cm³ native, inside 1.2–1.8 cm³), and the tube is 2.8 cm³ MNI (≈ 2.2 cm³ native; code tube 2.7 cm³; head now starting at y ≈ −9 instead of −5). Shrinking the amygdala to (7, 7.5, 6.5) is not needed (moving the head alone removes the overlap) and would take it below the native range (1.43 cm³ MNI ≈ 1.14 native). The real head lies posteroinferior to the amygdala, separated by the uncal recess |
| Caudate: add a leading control point (±12, +23, +6, r 4.5) before (13, 15, 8, 7) in NUCLEI and in the caudate TERMINALS tube | the tube starts at the head centroid with a flat cap and stops at y ≈ 19; the head reaches about y +25 in MNI space. With the point the tube reaches y ≈ 24, clear of the NAcc and of the frontal-horn void, and measures 4.7 cm³ MNI (≈ 3.7 cm³ native; code ≈ 3.7 cm³ MNI) |
| Insula ribbon (`brain.js`): centre (±37, −3, 4) with half-extents (4, 26, 11), i.e. x = side·(37 + 4·dx/l), y = −3 + 26·dy/l, z = 4 + 11·dz/l | the coded ribbon (centre (±36, −9, 2), half-extents (4, 17, 10)) spans only y −26…+8 and omits the anterior insula at (±36, +16, 0), which no star reaches; the new one spans y −29…+23, z −7…+15, and its inner face (x ≥ 34) stays clear of the putamen (x ≤ 31) |
| BRAINSTEM: replace the first control point (0, −16, 0, 13, 11) with (0, −24, −4, 12, 8) (§7.2 item 6), together with the rostromedial ZI ellipsoid (A13 row above) and the posterior hypothalamic ellipsoid (row below) | the first point lies in the diencephalon, so brainstem-labelled stars fill the subthalamus around A11, A13 and the zona incerta; once it moves, A11 and A13 need tissue of their own |
| Hypothalamus ellipsoid (±5.5, −3, −10) r (3.5, 9, 5) instead of (±5, −3, −10) r (4.5, 9, 5); MPOA (±4, +4, −10) r (2.0, 3.2, 3) (also its TERMINALS entry and the end of the incertohypothalamic → MPOA route); A11 (±3.5, −14, −5) (also the start of the diencephalospinal route), and A11 sits in a posterior hypothalamic / periventricular-grey ellipsoid (±3.8, −14, −5.2) r (1.8, 2.6, 2.0) (39 mm³; NUCLEI share ≈ 0.002, the density of the hypothalamus), region `hypothalamus`, kind nucleus, because the brainstem filler no longer reaches it | as coded, a lumen of half-width 2 mm contains 7.4 % of the hypothalamus, 5.7 % of the MPOA and 7.4 % of A11; with these values none. The new hypothalamus is 0.66 cm³ MNI ≈ 0.53 cm³ native, inside the real 0.35–0.55 cm³ range, so it no longer needs the "enlarged" label; the MPOA falls from 105 to 80 mm³. The hypothalamus ellipsoid ends at y −12, so at (±3.5, −14, −5) only 20 % of A11 lies in any drawn structure (all of it in the new brainstem tube) unless the posterior ellipsoid is added; with it 99.9 % does. Checked (Monte Carlo): the posterior ellipsoid (x 2.0–5.6, y −16.6…−11.4, z −7.2…−3.2) has no overlap with the third-ventricle lumen, the hypothalamus, the thalamus, the PVN or the VTA; 27 % of it lies inside the new brainstem tube (the diencephalic–mesencephalic junction) and 3.7 % inside the rostromedial ZI |
| Keep the small hypothalamic nuclei (MPOA 80 mm³; PVN 45 mm³ and arcuate 25 mm³ with the wall placement below) enlarged, and label them "hypothalamic nuclei and dopamine groups enlarged for legibility" in the HUD | human nuclei are a few to low tens of mm³ ([T], low); the whole hypothalamus (0.35–0.55 cm³ per side, §2.4) is drawn at its real size |
| `sdCerebellum`: lower only the inferior half: hemisphere centres stay at (±23, −63, −37) with r_z 21 above z −37 and 28 below; vermis r_z 25 below z −31 (asymmetric r_z in `sdEllipsoid`); keep the tentorial plane; subtract the cerebrum with a 1.5-mm tentorial gap (§7.2 item 4). Optional posterior enlargement: hemispheres (±24, −65, −37) r (26, 29, 24), r_z 28 below; vermis (0, −61, −31) r (10, 28, 21), r_z 25 below; tentorial slope 0.30 (also the `surfaceGrid` centre and the folia axis in `brain.js`) | inferior surface −58 → −65 mm, volume 124 → ≈ 137 cm³ MNI (≈ 99 → 109 cm³ native, still below 130–150 cm³; Monte Carlo), cerebrum overlap 4.1 cm³ → 0, superior surface and occipital gap unchanged; with the enlargement ≈ 152 cm³ MNI and a 10–12-mm gap at y −84. Lowering the whole hull (centres z −42, r_z 23; vermis z −35) would give 139 cm³ before and 136 cm³ after the carve, and widen the gap to 14–19 mm |
| Tuberoinfundibular spline: start at A12 (3, −7, −13) and end the axon at the median eminence (0.8, −6, −15); draw the ME → anterior-lobe leg as portal-vessel transport in a different style; optional tuberohypophyseal fibres to the posterior lobe (§7.6) | TIDA axons end in the external zone of the median eminence; dopamine reaches lactotrophs by blood [G Tuberoinfundibular_pathway.md L21]. Starting at the old A12 centre (2, −7, −13) would put 27 % of the centreline inside the lumen |
| Split the region `pituitary` into `medianEminence` (ME terminal field, stalk and portal wash; the ME dopamine compartment) and `pituitaryGland` (lobe haze); `MODULATORS.prolactin.regions = [pituitaryGland]`; DA_WEIGHT (or the §8.1 bathing weight) of `pituitaryGland` = 0. The stalk NUCLEI entry keeps kind GLAND (haze sprites, not neuron stars) under region `medianEminence`, so the GLAND test in `brain.js` must accept both regions (not only `pituitaryGland`); the ME TERMINALS entry, `FIELDS.medEminence.regions`, the tuberoinfundibular pathway's `to` and the `_activity` case move to `medianEminence`; the gland entry becomes `pituitaryGland`, kind GLAND | one region id now carries both the prolactin tint (`uTint[r]·uRegion[r].w`) and the ME dopamine glow (`uRegion[r].y` = E_ME, bathing weight 0.5), so the rose tint and the amber land on the same stalk and ME sprites, against §1 and user decision (1). The split gives each signal its own points, as the A14 split below does for A14 and the PVN |
| Cortical ribbon (`brain.js`): reject samples within 1.5 mm of the notch ellipsoid (0, −22, −43) r (23, 40, 36) with x within ±15 mm and −45 < y ≤ +8; label notch-surface points lateral to x ±15 mm `temporal`, and medial ones at y ≤ −45 `temporal` (`occipital` behind y −72); reject cortical points inside any NUCLEI, DA_GROUPS or BRAINSTEM volume (§7.2 item 3) | the ribbon follows the notch surface into the diencephalon and midbrain: ≈ 4,060 of 144,000 cortical stars lie on it (replay at 240 k, seed 1848): ≈ 2,540 in the medial window −45 < y ≤ +5, ≈ 1,130 lateral to x ±15 mm, ≈ 120 medial at y +5…+8 (posterior orbital surface, anterior perforated substance), ≈ 90 medial in front of y +8 (labelled `ofc`) and ≈ 180 medial behind y −45 (basal occipitotemporal surface), all but the `ofc` ones labelled `parietal`; ≈ 1,200–1,300 cortical stars fall inside midbrain, SN, PAG, hypothalamus and amygdala volumes. Frees ≈ 2,950 samples for the convexity (≈ 2,830 with the window ending at y +5) |
| Diencephalospinal spline: route dorsally along the PAG and the dorsal brainstem (§7.6); label the cord field "lumbosacral targets (proxy)" | the current route runs through the ventral tegmentum beside the VTA, ~10 mm anterior to the periaqueductal route; the relevant terminals are lumbosacral, outside the model volume |
| `brain.js` DA_WEIGHT: replace the per-region weights by the §8.1 bathing rule, in which E already carries w_vis, so `frontal` is lit at w_vis 0.24 and `pfc`/`ofc` at 0.17 (ratio √2 = √(w_true motor / w_true PFC), §2.3, §8.3). If DA_WEIGHT is kept instead (with w_vis = 1 in the bathing term), use `frontal` 0.38 and `pfc` 0.27 (0.38/√2), not 0.38 against 0.32 (ratio 1.19). Optionally split a premotor/motor region (y < +10) from posterior PFC | primate motor and premotor cortex receive dopamine comparable to or denser than PFC (Berger, Gaspar & Verney 1991); the code's `frontal` 0.06 against `pfc` 0.32 inverts this. The code's `frontal` region is not only motor and premotor cortex: it covers everything from the central sulcus forward to y +22 that is not ACC or OFC, including posterior DLPFC (areas 8/9), which without the split is bathed more brightly than anterior PFC |
| Give A14 its own region id (it currently shares `R.pvn` with the PVN terminal field) | the dopamine model drives A14 somata and the PVN field separately |
| Carve the lateral ventricles as voids: frontal horn (±6, +14, +16) r (3, 8, 5); body (±9, −10, +23) r (4, 14, 3); atrium (±28, −40, +12) r (4, 5, 4); temporal horn (±36, −20, −8.5) r (1.5, 9, 2), lateral and superior to the hippocampus. Carve the third ventricle: x within ±2 mm, y +4…−20, z from a sloping floor to +8; the floor is z = −14 for y ≥ −6 and rises linearly to z = −4 at y = −20 (z_floor = −14 + (−6 − y)·10/14), so the lumen stays above the mammillary bodies and out of the midbrain. Rule: voids remove only white-matter, brainstem and cortical points, never nucleus or dopamine points | With the current populations the lateral voids remove ≈ 10–20 of 240,000 stars (callosal white-matter points only; no cortex or brainstem point falls inside them, and the caudate and hippocampus stars they touch are protected); they guard any future white-matter filler. The lumens lie medial to the caudate head and body and superolateral to the hippocampus; centres at (±12, 15, 15), (±18, −10, 22) and (±32, −20, −15) would lie inside the caudate and the hippocampus and delete them (overlap with these radii, measured on the §7.3 shapes: frontal horn, body and atrium inside the caudate with its leading point 3 %, 0.3 %, 0 %; temporal horn inside the hippocampus 0 %, and 0 % inside the amygdala and putamen, 100 % inside the cerebrum hull and clear of the insula ribbon; at the earlier (±35, −20, −10) it lay 11.5 % inside the §7.3 hippocampus). A flat third-ventricle floor at z −14 back to y −20 would reach into the rostral midbrain (50 % of the midline IF/RLi/CLi column, 7 % of the VTA, part of the mammillary bodies) and, with the protection rule, delete only the brainstem filler there (≈ 170 stars), cutting a slot through the midbrain while the nucleus stars in the "lumen" stay. With the sloping floor and the §7.3 positions the lumen holds no dopamine soma and no nucleus star except ≈ 2 thalamic stars at its medial edge (0.02 % of the 15°-yawed thalamus, protected by the rule), and removes ≈ 45–75 brainstem stars (≈ 60 on average over five seeds; ≈ 160–200 with a flat floor) and 3 cortical stars at 240 k; ≈ 40–50 protected dopamine axon and varicosity points still cross it |
| Place the periventricular groups on the third-ventricle wall: A14 (±2.8, −1, −9) r (0.8, 7, 5), a sheet x ±2.0–3.6, y −8…+6, z −14…−4; A12 (±3, −7, −13) r (1.0, 2.6, 1.8); arcuate (±3, −7, −13) r (1.0, 3, 2); PVN (±3.5, −4, −6) r (1.5, 3, 2.4); one depth, z −13, for A12 and the arcuate | as coded, the model lumen (half-width 2 mm, x within ±2, sloping floor) would contain ~21 % of A14, ~29 % of A12, ~28 % of the arcuate and ~13 % of the PVN (~57 % of the documented A14 sheet; a flat floor at z −14 would give ~44 % of A12 and ~42 % of the arcuate); with these values none. The void rule above protects them in any case |
| Spinal TERMINALS tube [[2.5, −45.5, −74, 3], [2.5, −47.5, −88, 3]] instead of [[3, −42, −66, 3], [3, −46, −86, 3]]: the grey-matter proxy medial to the dorsolateral-funiculus route of §7.6 | the coded tube starts in the medulla, above the z < −72 spinal label; the new one lies ≈ 97 % inside the cord part of the brainstem tube, whereas a tube centred on the route itself ([[3.5, −46, −74, 3], [3.5, −49, −88, 3]]), which runs along the dorsolateral surface of the cord, would put ≈ 26 % of the target proxy outside the cord |
| Add 2–3 mm of petalia asymmetry (right frontal, left occipital; left Sylvian end lower and more posterior) | a mirror-perfect brain looks synthetic (Toga & Thompson 2003) |
| (putamen: see the NUCLEI row above) | the model putamen spans y −16…+20, z −8…+14; the atlas lens (y −20…+22, z −10…+16) cannot be filled by an axis-aligned ellipsoid without overlapping the pallidum |
| Optional: V1 density ×1.5–2 around the calcarine sulcus | primate V1 has ~2–2.5× the neurons per unit area (Rockel, Hiorns & Powell 1980; Collins et al. 2010) |

### 7.4. Point budget per structure

Real neuron counts are extremely lopsided (cerebellum ~80 % of neurons in ~10 % of the volume; all
deep structures < 1 %). Allocation proportional to neuron counts would give the striatum ~350 points
and the SN + VTA ~2 points out of 300,000, so the budget follows **grey-matter volume for the two
cortical sheets** and **deliberate oversampling for deep structures**, and the HUD discloses
"1 star ≈ N neurons" per region (the galaxy projects disclose their clocks the same way).

Shares (neuron stars, `brain.js` SHARES): cortex 58.5 % + insula 1.6 %, cerebellum 16.5 %, deep
nuclei 16.5 %, brainstem 5.9 %, white matter 1 %. The cortex : cerebellum split (≈ 78 : 22) is
close to their grey-matter volume ratio (~500 : ~105 cm³ native, ≈ 83 : 17) and slightly favours
the cerebellum.

The "1 star ≈" column is computed at the high tier; the HUD computes it from the active tier (at
400 k a cortical star stands for ≈ 7 × 10⁴ neurons, at 60 k for ≈ 5 × 10⁵).

| Structure | Stars at high tier (240 k) | Real neurons (both sides) | 1 star ≈ | Note |
|---|---|---|---|---|
| Cerebral cortex + insula | 144,200 | 1.63 × 10¹⁰ | 1.1 × 10⁵ | Azevedo et al. 2009 |
| Cerebellum | 39,600 | 6.9 × 10¹⁰ | 1.7 × 10⁶ | undersampled ×15 relative to cortex |
| Striatum (caudate, putamen, NAcc) | ~15,300 | ~10⁸ | ~7 × 10³ | oversampled ×15 |
| Thalamus | ~9,000 | ~10⁷ | ~10³ | low confidence |
| Hippocampus | ~3,600 | ~8 × 10⁷ (≈ 4 × 10⁷ per side; West & Gundersen 1990) | ~2 × 10⁴ | medium confidence |
| Amygdala | ~3,150 | 2.4 × 10⁷ (1.2 × 10⁷ per side; Schumann & Amaral 2005) | ~8 × 10³ | medium confidence |
| Hypothalamus (incl. MPOA, PVN, arcuate and the posterior hypothalamic ellipsoid of §7.3) | ~2,800 | ~10⁶–10⁷ | ~10³ | low confidence |
| Brainstem | 14,200 | ~10⁸ | ~10⁴ | low confidence |
| Midbrain DA somata (separate buffer) | 3,000 | 4–6 × 10⁵ | ~170 | Björklund & Dunnett 2007 |
| Hypothalamic and A11 DA somata | 500 | unknown | — | oversampled for legibility; labelled |

Tier totals of neuron stars are 60 k / 130 k / 240 k / 400 k (`performance.js` TIERS). At the low tier
raise the deep-nucleus share to 0.22 and lower the cortex share to 0.53 so that the dopamine circuit
stays legible when the shells are thinned. `main.js` generates the populations once, at the tier
above the starting one (`genTier`, headroom for upgrades), and a lower tier draws a uniform prefix of
the shuffled buffer, so a tier-specific share cannot be set by changing SHARES alone: it needs
either regeneration when the low tier is active, or a buffer ordered in two blocks (deep-nucleus
records first) so that the low-tier prefix over-represents the nuclei. The fixed-count
non-dopaminergic VTA stars of §7.5 are written at the very start of that leading block and left
out of the shuffle, so every tier draws all of them. Per-point flux is lognormal (σ = 0.6 in ln; many faint, 1–3 %
bright stars; Buzsáki & Mizuseki 2014). Deep-nucleus points carry 0.85× flux so that dense floors do
not become false hot spots (the code uses 0.42×, §9.8).

### 7.5. Dopamine-system points

| Population | Count | Basis |
|---|---|---|
| DA somata (always drawn) | 3,500: SNc 2,000; VTA + midline 700; A8 300; A11, A12, A13, A14 125 each | SNc 67 %, A10 23 %, A8 10 % of the midbrain somata (§2.2); hypothalamic counts unknown |
| Non-DA stars inside the VTA | a fixed count of 0.35/0.65 × the VTA and midline DA somata (≈ 380 for 700), placed in the VTA and midline-column ellipsoids in proportion to their DA somata and kept in the neuron-star buffer (`vtaOther`, region `vta`; region `vtaMedial` within 3.5 mm of the midline if that id is added, §8.1), written in the leading, unshuffled block of the buffer (the two-block ordering of §7.4) so that every tier draws all of them. They are drawn cool-white by the neuron-star shader, which applies the teal GABA tint (§8.1); bathing weight 0, never amber. They are not written to the DA buffer, whose budget has no room for them (§7.6) and whose shaders never read `uTint` | rat VTA ~35 % GABA + glutamate (Nair-Roberts et al. 2008). The code draws them as a share of the neuron-star tier (`vtaOther` = round(0.165·N·0.004/0.878): 45 / 98 / 180 / 301 at the low / medium / high / ultra tiers) beside the code's 1,050 VTA somata, i.e. ≈ 15 % of the VTA stars at the high tier (≈ 4 % at the low tier, ≈ 22 % at ultra), against the 35 % target (§9.8) |
| RMTg | small cool cluster | GABA "brake"; dims as μ-opioid tone rises (disinhibition) |
| Axon points (per tier) | 6 k / 10 k / 16 k / 24 k | split by pathway (table §7.6) |
| Release-site points (varicosities, per tier) | 4 k / 7 k / 11 k / 16 k | ∝ true field volume (4/3·π·r_x·r_y·r_z for ellipsoids, the swept volume for tubes, the cortical sheet area × 2.5 mm for cortical fields) × w_true (§2.3). The code allocates by r_x·r_y·r_z, a fixed 900 for every tube, 2,500 for every cortical field and a per-entry `density`, which allocates the spinal proxy 6.2 % of all release sites, more than NAcc shell and core together (6.1 %) or the amygdala (3.4 %), and the putamen 25.8 %. Because the axon pass overruns its budget (by 309 points at 240 k) and the spinal field is written last, only 377 of its 687 allocated sites are generated at the 240 k budget (3.5 %; 87 of 250 at 60 k), fewer than NAcc shell and core together (671) (§7.6, §9.8) |
| Lantern sprites | 300–400 | per field: putamen 80, caudate 44, NAcc shell 28, core 12, amygdala 16, hippocampus 8, MPOA 6, PVN 4, median eminence 2, PFC 52, OFC 28, ACC 20, cord 4 |

The SNc cluster is drawn slightly denser and dimmer at rest than the VTA (neuromelanin makes the human
SNc visibly dark), so amber there reads as ember-like. The current code draws its somata from the
DA_GROUPS shares, which give a rodent-like VTA : SNc ratio; §7.3 gives the corrected shares.

### 7.6. Dopamine fibre tracts (control points, MNI mm, right side; mirrored)

Centripetal Catmull–Rom splines through the control points; 6–90 jittered streamlines per pathway
(≈ 1.1·√points, at least 6), cross-section σ ≈ 1 mm in the MFB widening to a 2–9 mm terminal fan.
Tracts are faint dots, never glowing tubes. The axon shares sum to 1.000 with the optional
tuberohypophyseal fibres (nigrostriatal → putamen 0.26 when they are not drawn). Summing to 1.000 is
necessary but not sufficient: the generator must write exactly round(axon·share) points per pathway
(per = floor(count/fibres) points on every fibre, plus one extra point on the first
(count mod fibres) fibres), and `da.total` must be the sum of the actual record counts (somata,
axons, release sites; the release-site counts round to 11,001 at 240 k). `brain.js` writes
fibres × ceil(count/fibres) points per pathway, which overruns the axon budget even with these
shares (+114 / +121 / +177 / +331 points at the four tiers; +164 / +235 / +309 / +498 with the
code's shares, which sum to 1.010); because `dput` stops at `da.total`, the overrun deletes the
release sites of the last TERMINALS entry, the spinal field (§7.5, §9.8). The flow source is the
population whose firing history drives the amber flow along the tract (§8.1).

| Pathway | Control points | Axon share | Terminal fan (mm) | Flow source |
|---|---|---|---|---|
| Mesolimbic VTA → NAcc (MFB) | (4, −16, −12) → (6, −9, −11) → (8, −1, −10) → (9, 6, −9) → (10, 12, −8) | 0.20 | 4.5 | VTA-l |
| Mesoamygdaloid (MFB, then the sublenticular / ventral amygdalofugal path) | (4, −16, −12) → (6, −9, −11) → (10, −4, −10) → (16, −3, −12) → (20, −4, −15) → (23, −4, −17) (the §7.3 amygdala centre) | 0.05 | 5 | VTA-m |
| Mesohippocampal (branching from the mesoamygdaloid route) | … (20, −4, −15) → (25, −11, −20) → (28, −20, −14) | 0.03 | 5 | VTA-m |
| Mesocortical, medial (subgenual route) → medial / frontopolar PFC (BA 10/32) | (4, −16, −12) → (6, −8, −10) → (8, 2, −8) → (9, 14, −6) → (9, 26, −2) → (8, 38, 6) → (7, 48, 15) | 0.10 | 9 | VTA-m |
| Mesocortical, orbital | … (8, 2, −8) → (10, 14, −7) → (15, 25, −12) → (20, 36, −16) | 0.05 | 8 | VTA-m |
| Mesocortical, cingulate | … (8, 14, −4) → (7, 25, 6) → (6, 30, 18) → (5, 22, 30) | 0.05 | 7 | VTA-m |
| slMFB → DLPFC (new; lights the `frontal`/`pfc` field through §8.1) | (4, −16, −12) → (8, −11, −8) → (11, −4, −3) → (15, 5, 2) → (20.5, 16, 5) → (22, 28, 10) → (34, 36, 24), through the gap between caudate head and putamen (the anterior limb of the internal capsule); the centreline spends 0 % in the caudate, putamen, pallidum and NAcc (an earlier route through (17, 16, 6) ran 17 % of it inside the caudate tube) | 0.04 | 9 | VTA-m |
| Nigrostriatal → putamen | (11, −18, −12) → (14, −12, −8) → (18, −7, −3) → (22, −2, 1) → (25, 3, 1) | 0.255 | 9 | SNc |
| Nigrostriatal → caudate | (11, −18, −12) → (13, −10, −6) → (14, −2, 2) → (14, 6, 7) → (13, 13, 9) | 0.13 | 6 | SNc |
| Incertohypothalamic → MPOA | (7, −12, −5) → (6, −6, −6) → (5, −2, −8) → (4, 4, −10) (the §7.3 MPOA centre) | 0.03 | 2.5 | A13 |
| Incertohypothalamic → PVN | (7, −12, −5) → (5, −8, −5) → (3.5, −4, −6) (the PVN centre, not its medial edge) | 0.02 | 2 | A13 |
| Tuberoinfundibular (axons end at the median eminence) | (3, −7, −13) (the A12 centre on the ventricle wall) → (0.8, −6, −15) | 0.015 | 2 | A12 |
| Portal leg (vascular, not axonal; diffuse non-fibrous wash in its own style) | (0, −6, −15) → (0, −3, −22) → (0, −1, −28) → (0, +2, −31) (anterior lobe) | — | — | — (follows the median-eminence concentration) |
| Tuberohypophyseal (optional; A12/A14 fibres to the intermediate and neural lobes) | (0.8, −6, −15) → (0, −4, −22) → (0, −2, −28) → (0, −3, −31) (posterior lobe) | 0.005 | 1.5 | A12 |
| Diencephalospinal (A11; dorsal route along the PAG and the dorsal brainstem, rat-based) | (3.5, −14, −5) → (2.5, −24, −9) → (2, −32, −13) → (2.5, −34, −22) → (3, −36, −34) → (3, −40, −48) → (3.5, −45, −62) → (3.5, −48, −76) → (3.5, −49, −88), continuing off-frame; the drawn cord field stands in for lumbosacral targets | 0.025 | 2 | A11 |

A14 → MPOA/PVN input (60 % of the MPOA source mix and 50 % of the PVN mix, §6.5) is short-range and
periventricular and is not drawn as a tract. The earlier mesoamygdaloid route ran a third of its
length outside all modelled tissue, below the diencephalon, and the earlier mesohippocampal route
ran through the SNc ellipsoid; the routes above follow the MFB and the sublenticular path (low
confidence).

The MFB runs through the lateral hypothalamus, lateral to the fornix and medial to the internal
capsule; human tractography describes a superolateral branch along the anterior limb of the internal
capsule to prefrontal and orbitofrontal cortex (Coenen et al. 2012). All waypoints are designed from
atlas landmarks (low confidence); diffusion MRI cannot see thin unmyelinated dopamine axons directly.
Straight-line checks: VTA → NAcc ≈ 30 mm, VTA → vmPFC (±5, +42, −14) ≈ 58 mm, VTA → end of the medial
mesocortical route (7, 48, 15) ≈ 70 mm, VTA → DLPFC ≈ 74 mm, SNc → putamen ≈ 27 mm, SNc → caudate head
≈ 38 mm. The vmPFC itself is fed by the orbital route and drawn in the code's `ofc` region (§2.4).

---

## 8. Visual mapping

### 8.1. Mapping table

| Model variable | What the viewer sees | Mapping | Limits |
|---|---|---|---|
| Neuron stars (all regions) | cool-white stars, slow asynchronous twinkle (spontaneous activity) | blackbody 7,000–9,500 K, lognormal flux; twinkle ±10 % at 0.2–0.6 Hz | never a flash; no synchronised twinkle |
| C̄_j (tonic) | lantern **ember** in field j | T_j = clamp(0.3 + 0.5·log₂(C̄_j/C0_j)) → 0.3 at rest, 0.59 at ×1.5, 0.8 at ×2, 0 at ≤ ×0.66 | colour 2,200–2,300 K |
| C_j − C̄_j (phasic) | lantern **flare** in field j | F_j = clamp(0.5·log₂(C_j/C̄_j)) using the frame-mean C_j when k_h > 2 | flare core may warm-whiten to 2,700 K; rise and fall both use τ_vis (floor 0.3 s, one symmetric filter as in the code) until the large-area slew limiter of §10 rule 2 exists and is tested |
| Lantern intensity | glow brightness | E_j = w_vis,j · clamp(T_j + 0.6·F_j, 0, 1.3) → `uRegion[j].y` | brightest lantern ≤ 3–6× the brightest neuron star |
| Neuron-star bathing (the `uAmber` term of the neuron-star shader) | faint amber on ordinary neuron stars of a lit region | amber = 0.3·d_point·E_r, where d_point is a per-point jitter (0.75–1.25) and E_r already carries w_vis; DA_WEIGHT therefore becomes 1 for every lit region and 0 for the tinted modulator regions (`pituitaryGland`, raphe, RMTg, VTA, PAG, arcuate) and the cerebellum (if DA_WEIGHT is kept instead, w_vis is set to 1 in this term, §7.3) | never on points that carry a modulator tint; ≤ the lantern caps |
| Spread | share of the field's lanterns and release sites lit | s_j = clamp(0.25 + 0.75·T_j + 0.3·F_j) → `uRegion[j].z` | — |
| Release rate Σπν ρ | sparks at release sites (varicosity points) | spark phase advances ∝ release rate / tonic release (`uDA[j].z`) | each site ≤ 2 Hz visual, desynchronised |
| ν_i/ν₀ (cell group) | DA somata ember and twinkle | level → `uDA[g].x`; spike phase advances ∝ ν (`uDA[g].y`) | individual spikes only at k_h ≤ 2; each soma ≤ 2 Hz visual |
| ν history per pathway | faint amber flow along the tract from source to field | `pathHist` sampled every 0.125 s screen; 16 samples → 2 s travel (declared visual slowdown; real conduction 40–200 ms in the brain, 0.5–1 s for the spinal tract, §3.1) | flow amplitude ≤ 15 % of tract luminance |
| τ_clear,j | persistence and halo size | τ_vis,j = max(0.3 s, 0.5·τ_clear,j / max(1, k_h)) screen, as in the code (`dopamine.js` `updateVisuals`, with τ_clear at the current C_j) and the README; during ONSET (k_h < 1, including k_h = 0 with T_pre = 0) the k_h = 1 values of §8.4 apply ("every large-area brightness change is low-passed, τ ≥ 0.3 s"); spread uses max(0.5 s, τ_vis,j); halo factor (τ_clear,j/τ_clear,dStr)^0.2. While the pulse-locked switch is on, lantern E and spread use τ_vis ≥ 2 s during ORGASM (§6.10); somata and release sparks read the unfiltered ν and C, capped at ±15 % luminance, and the HUD shows the unfiltered C | halo ≤ 10 mm and ≤ 1.5× field radius; the floor may be lowered (for example to 0.15 s) only after the large-area slew limiter of §10 rule 2 is implemented and tested (§9.7) |
| Median eminence C | warm glow at the median eminence, where TIDA axons end; the leg to the anterior lobe is drawn as a diffuse, non-fibrous wash down the stalk (portal blood), never as an axon | E_ME as above, on region `medianEminence` (ME, stalk, portal wash) | never tinted; the gland haze (`pituitaryGland`) carries no dopamine amber |
| Spinal C (A11) | faint beam leaving the medulla through the frame bottom | E_cord as above | labelled "lumbosacral targets (proxy); rodent evidence" |
| θ2, θ1 (NAcc) | HUD gauges | — | labelled "rat-calibrated model" |
| Γ, Ψ̂, Z, O, R | HUD gauges with the sign of their effect on dopamine; R, Z, Γ/(1 + Γ) and Ψ̂ also as restrained tints on the cool neuron stars of their source nuclei (for the pituitary, on the glandular haze sprites of region `pituitaryGland`, which the neuron-star shader draws; never on `medianEminence`, which carries the ME dopamine glow) (prolactin: pituitary gland, rose; serotonin: raphe, violet; GABA: RMTg and VTA non-dopaminergic stars, teal; μ-opioid: PAG and arcuate, sage); oxytocin O gauge only | additive `uTint[r]·uRegion[r].w` term in the neuron-star vertex shader only, on regions whose bathing weight is 0, so that no tinted point also carries dopamine amber; the amount relaxes with τ 0.5 s screen toward clamp(R/1.2), Z, clamp(1.2·(Γ/(1 + Γ) − 0.5)) and clamp(Ψ̂) | never in the lantern or dopamine-point shaders (lanterns, somata, release sites, tracts); colours desaturated ≥ 50 % toward grey, chroma below the lantern cap, never amber; legend: "faint tints mark modulator activity on their source nuclei, not dopamine" |
| RMTg | cool cluster with the teal GABA tint ∝ clamp(1.2·(Γ/(1 + Γ) − 0.5)) (shared with the VTA's non-dopaminergic neuron stars); optionally dims slightly as Ψ̂ rises | optional flux × (1 − 0.3·Ψ̂) | cool, never amber |
| Imaging-based activity (optional overlay, off) | small brightness changes of cool stars (cerebellum ↑; PAG ↑ only in fMRI of women; lateral OFC ↓ in PET of women, a disputed finding: OFC ↑ in fMRI of women, §4.4) | ±10–20 % flux → `uRegion[j].x` | labelled "blood flow, not dopamine"; never warm |

Region mapping from `anatomy.js` REGION_IDS to model compartments: `naccCore` → core, `naccShell` →
shell, `dorsalStriatum` → dorsal striatum, `pallidum` → dorsal striatum × w 0.45, `pfc`/`ofc`/`acc`
→ PFC, `frontal` (motor, premotor) → PFC × w 0.24, `insula`/`parietal`/`temporal`/`occipital` → PFC ×
w 0.10, `amygdala` → amygdala, `hippocampus` → amygdala compartment with w_vis 0.14 (no
compartment of its own; replaces the code's 0.4 × the amygdala glow, which would give 0.22),
`thalamus` → PFC × w 0.32 (proxy for the
primate thalamic supply), `mpoa` → MPOA, `pvn` → PVN, `hypothalamus` → mean(MPOA, PVN) × 0.5,
`medianEminence` (median eminence, stalk, portal wash) → median eminence, `pituitaryGland` → none
(prolactin tint only), `spinal` → cord, `cerebellum`, `whiteMatter` → none. `dorsalStriatum` is
split by a new `caudate` id so that the putamen takes w_vis 1.0 and the caudate 0.89 (one
`uRegion[r].y` cannot carry both). Somata: `vta` → VTA-l (|x| ≥ 3.5 mm) and a new `vtaMedial` id →
VTA-m (|x| < 3.5 mm, incl. the midline column), because one `uDA[vta]` slot cannot carry two
populations (alternatively carry the VTA-m level in `uDA[vta].w`); `snc` and A8 → SNc, `a11` → A11,
`arcuate` → A12, `zonaIncerta` → A13, `a14` (own id, §7.3) → A14.

### 8.2. Colour temperatures and limits

Computed with the project's Planck × CIE pipeline (`brain-system/src/color.js` `blackbodyRGB`,
D65; red ratio R/(R+G+B) on linear sRGB values, as in the WCAG definition):

| Role | Temperature | sRGB | Red ratio | Rule |
|---|---|---|---|---|
| Never used | 1,800 K / 1,900 K / 2,000 K | #ff8100 / — / #ff8d15 | 0.82 / 0.805 / 0.785 | the WCAG saturated-red ratio (≥ 0.8) is crossed between ≈ 1,900 and 1,960 K (linear sRGB, negative channels clipped to 0; below ~1,900 K the linear blue channel is negative) |
| Lantern ember (tonic) | 2,200–2,300 K | #ff982f – #ff9d38 | 0.75 / 0.73 | default 2,300 K; floor 2,200 K (a margin, not the criterion) |
| Lantern flare core | 2,500–2,700 K | #ffa64a – #ffae59 | 0.69 / 0.66 | only with F_j > 0.5 |
| Overexposed lantern core (ACES roll-off) | → ~3,000 K | #ffb96e | 0.61 | emergent from tone mapping |
| Fibre tracts | 5,500–6,000 K | #ffeee1 – #fff4f1 | 0.38 / 0.36 | neutral; the current 4,200 K (#ffd8af) reads slightly warm and should move up |
| Neuron stars | 7,000–9,500 K | #f4f2ff – #d1dcff | 0.32–0.27 | never above 12,000 K (#c0d1ff) |
| Background | near-black, very slightly blue-grey | — | — | not pure black |

**After tone mapping.** The ratios above are scene colours. The displayed pixel passes the
composite shader (mesopic desaturation that ends at luminance l = 0.12, then ACES, then gamma). The
ACES toe expands channel differences at low-to-mid levels, so the displayed ratio of 2,300 K amber
peaks at 0.79 for dim pixels (scene luminance ≈ 0.11 after exposure) and that of 2,200 K at 0.80;
bright cores fall to 0.5 and below. Extending the desaturation band to l = 0.2 (smoothstep(0.004,
0.2, l)) keeps 2,300 K at ≤ 0.73 at every level (simulated, §11.2). The `color.js` comment that the
criterion is reached "below 2,200 K" is wrong and should cite these numbers (§9.8). The flash rules
of §10 keep any such pixels from flashing over a large area in any case.

The cool-white versus amber contrast lies on the blue–yellow axis, which people with common red–green
colour-vision deficiencies still see; dopamine is coded redundantly by luminance and spread for tritan
and monochrome viewing [T].

### 8.3. Glow size, spread and persistence by region

| Field | w_vis | τ_clear | Halo factor | Lantern radius (mm) | Visual character |
|---|---|---|---|---|---|
| Dorsal striatum | 1.0 / 0.89 | 55 ms | 1.0 | 6.8 (putamen), 4 (caudate tube) | crisp, brief flares; strong ember |
| NAcc core | 0.92 | 85 ms | 1.09 | ~3 | crisp |
| NAcc shell | 0.81 | 176 ms | 1.26 | 3.8 | slightly softer |
| Amygdala | 0.55 | 1.27 s | 1.88 | 5.5 | dim, slow, diffuse |
| PFC / OFC / ACC | 0.17 / 0.17 / 0.24 | 1.0 s | 1.79 | 7 | faint wide wash over the cortical sheet |
| Hippocampus (amygdala compartment, own w_vis) | 0.14 | 1.27 s | 1.88 | 4 | barely visible |
| MPOA / PVN | 0.55 / 0.50 | 3.3 s | 2.27 | 2.2 / 1.7 | small, slow lanterns |
| Median eminence | 0.77 | 5 s | 2.47 | 2 | slow glow down the stalk (region `medianEminence`) |
| Cord | 0.55 | 3.3 s | 2.27 | 2–4 | beam |

Halo factors use the exact τ_clear at C₀ (54.7 ms, 85.3 ms, 176 ms, 1.005 s, 1.269 s, 3.33 s, 5 s).

Lantern sprites use a two-Gaussian profile (soft core plus a halo carrying ~15 % of the light) and
widen with the tissue path L in front of them (×(1 + 0.6·L/λ)) to suggest scattering. Depth
attenuation e^(−L/λ) is neutral in colour: warm hue is reserved for dopamine.

### 8.4. Clock-dependent rendering

The response model runs at k_h = 10 (baseline to plateau), T_pre/2.5 s (ONSET, 0.6 by default),
1 (orgasm), 20 (early resolution), 60 or more (late resolution, recovery, no climax), ramping in log
space over 1 s at every phase change and switching instantly into ONSET (`response.js` CLOCK and
`_enter`; §9.3).

- **k_h ≤ 2** (ONSET, orgasm): phasic flares, soma spikes and pauses are rendered individually,
  still subject to the photosensitivity limits. The contraction rhythm never modulates the
  lantern glows beyond the default per-contraction swing of E (≤ 0.025 peak-to-peak, §9.7), far
  below a visible or flash-relevant change (§6.10, §10).
- **k_h > 2**: a 4 Hz pacemaker would appear at 40 Hz on screen, and a 0.5 s transient would last
  50 ms. Only rate-coded fields are drawn: soma twinkle rate saturates at 2 Hz visual, release-site
  sparks are desynchronised, and the flare channel uses frame-mean concentrations, so phasic activity
  appears as a slightly denser sparkle and a brighter ember, never as a strobe.
- Persistence τ_vis = max(0.3 s, 0.5·τ_clear/max(1, k_h)) means kinetic contrast between striatum and
  cortex is visible mainly during the climax (at k_h = 1: striatum 0.3 s, PFC 0.5 s, amygdala 0.64 s,
  hypothalamus 1.67 s); during the build the tonic channel dominates.

### 8.5. Realistic, not garish

- Desaturate dim halos (mesopic vision; Kirk & O'Brien 2011) and let bright cores roll toward pale
  warm white through the existing ACES tone map at fixed exposure.
- Cap lantern chroma (OKLCH C ≤ 0.12–0.15 at mid lightness).
- Halo radius ≤ 10 mm (~6 % of brain length); total dopamine-glow luminance ≤ 35 % of frame luminance
  at peak.
- No glowing outlines, tubes or constant-width tracts; no flame flicker; no travelling "comets" at a
  physical speed (conduction finishes within a frame).
- The bloom is energy-conserving; the brightest lantern stays within 3–6× the brightest neuron star.
- Modulators get only restrained, labelled tints on their source nuclei (§8.1; for prolactin the
  pituitary gland haze): never on lanterns, dopamine somata, release sites, tracts or any point that
  carries dopamine amber (the median eminence and stalk are a region of their own), never
  saturated, never amber.
- Cerebellar folia and gyral stripes stay static and low-contrast.

### 8.6. HUD readouts

Every HUD panel is a collapsible dropdown with a title only, no secondary subtitle lines (user
decision). The compact status header is the one element that stays visible: a short block (title,
phase, arousal meter, clock, refractory meter, as in the current `index.html`) without subtitle
lines (it may also be made a dropdown). Short badges in a title row (for example "rat-calibrated" or the FPS badge) are allowed;
they are not subtitle lines. Dopamine panel (each value with a species/evidence badge, a short pill
in the value row): NAcc core and shell (nM; tonic C̄ and last peak, the peak taken as the substep
maximum), dorsal striatum (nM), PFC (nM), amygdala and PVN (nM), MPOA (% baseline), median eminence
/ TIDA (% baseline), spinal A11 (% baseline, "lumbosacral proxy; rodent"), VTA-l rate (Hz,
population mean) with a burst/pause indicator from the sign of δ, SNc and TIDA rates (Hz), the
prediction error δ, D2 and D1 occupancy in NAcc ("rat-calibrated model"). The amygdala, PVN, SNc,
TIDA, δ and net-gain rows of the current HUD stay. Modulator panel: gauges for GABA tone Γ, μ-opioid Ψ̂, serotonin Z,
prolactin R with its TIDA effect and oxytocin O, each with its tint swatch (oxytocin none), and the
net modulator gain on midbrain drive (g_mod). Also the clock (human seconds per screen second), the "Hypotheses" dropdown (§6.10) and the scale and
evidence disclosures listed in §9.5.

---

## 9. Implementation targets

### 9.1. Files and interfaces

- `brain-system/src/dopamine.js`: `class DopamineModel { reset(); setHypothesis(id); setSwitch(name,
  value); novelStimulus(); step(h, model, prev); updateVisuals(dtScreen, model, kh); modulators(model);
  readouts() }`. `setHypothesis(id)` keeps selecting the post-orgasm course (`sustained`/`dip`);
  `setSwitch` sets the other §6.10 rows (`pulseLocked`, `zR`, `kappa`, `satiety`, `sT`), and
  `novelStimulus()` is the session-satiety "novel stimulus" event; the onset-window row is set on
  the response model with `ResponseModel.setOnset({ Tpre, uPre })`. `main.js` and `ui.js` get one
  handler per §6.10 row (today only `onHypothesis` is wired). Keep the existing
  exports `POPS`, `FIELDS`, `PARAMS`, `HYPOTHESES`, `MODULATORS` (no rename to `REGIONS`, which would
  read like `anatomy.js` REGION_IDS); inside the project only `DopamineModel` is imported (by
  `main.js`), and `MODULATORS` is used by the constructor. `ui.js` imports nothing from
  `dopamine.js` and keeps its own `DA_FIELDS` and `MODULATORS` row lists, which must be updated for
  §8.6 (§9.8 HUD row). `step` implements §6.4, interpolating inputs between `prev` and `model`, takes
  k_h from `model.khNow` (the k_h value `update()` computes for the frame, stored before the step
  loop; `update()` itself returns `{ kh }`) for the h_max switch, and writes `model.D`.
  `updateVisuals` gets the screen dt, which the screen-time low-pass τ_vis, the spark and spike phase
  accumulation and the `pathHist` cadence need; it fills `region`, the modulator channel
  `region[r*4+3]`, `da` and `pathHist`, and resets the frame-mean accumulators only after a frame in
  which at least one substep ran: in a frame without substeps (paused frames, where `main.js` passes
  a zero step while k_h stays at 10–190, and every ONSET frame with T_pre = 0) the frame mean keeps
  its previous value (or equals the current C_j), never 0/0, which would write NaN into F_j and keep
  the lanterns broken through every later relax step. `tint` is set once in the constructor from
  `MODULATORS`; `MODULATORS.gaba.regions = [rmtg, vta, vtaMedial]` once `vtaMedial` is added, so the
  teal tint reaches the non-dopaminergic VTA stars of both halves (§7.5).
- `brain-system/src/response.js`: port the corrected galaxy equations (§6.7 table), including the
  ONSET phase with T_pre, u_pre and the cancel path; keep the `onStep` property, take
  `prev = this.snapshot()` before `_integrate` and call `this.onStep?.(h, prev)` after `_transitions`
  (`main.js`: `model.onStep = (h, prev) => dopamine.step(h, model, prev)`); `snapshot()` returns
  { tHuman, phase, St, Aeff, A, X, I, H, G, M, N, O, R, Psi, Omega, train.t }; cap the human step at
  0.05 s while S̃ moves and in ONSET/ORGASM; on a transition into ONSET, stop the frame's human
  integration at the transition and spend the remaining screen time at the new k_h (§6.7 clock
  row); store the frame's k_h as `khNow` before the step loop; expose `tHuman` and `tIgnite`;
  export `Seff`; take the constructor options `{ rng = Math.random, deterministic = false }`, where
  `deterministic` sets η = 0, q = p.q exactly and the tail to the fixed reference tail (two pulses
  at amplitude 0.15, the first 3 s after the last regular pulse and the second 3 s later; three such
  pulses, each 3 s apart, for the extended profile), so that §9.7 can run the §6.9
  reference without patching `Math.random`; remove D* and the `phasic` impulse, because D is
  written by the dopamine layer (closed loop).
- Uniforms (already declared in `shaders.js`): `uRegion[r] = (activity, E, spread, modulator
  amount)`; `uTint[r]` = the `MODULATORS` colour for source-nucleus regions, 0 elsewhere (`uTint`
  holds fixed RGB; `uRegion[r].w` scales it by modulator activity, and only the neuron-star shader
  reads it); `uDA[g] = (ν/ν₀, soma spike phase, release spark phase, −)`; `uPathHist` (16 samples per
  pathway, newest first). The uniforms are indexed per region, so REGION_IDS needs the ids
  `medianEminence` and `pituitaryGland` (replacing `pituitary`), `a14`, `caudate` and `vtaMedial`
  (VTA-m somata and the midline column; or carry the VTA-m level in `uDA[vta].w`), with the array
  sizes in `shaders.js` raised to match. `MODULATORS.prolactin.regions = [pituitaryGland]`.

### 9.2. Point counts

| Item | Low | Medium | High | Ultra |
|---|---|---|---|---|
| Neuron stars | 60,000 | 130,000 | 240,000 | 400,000 |
| of which non-DA VTA stars (leading, unshuffled block; §7.5) | 380 | 380 | 380 | 380 |
| DA somata | 3,500 | 3,500 | 3,500 | 3,500 |
| Axon points | 6,000 | 10,000 | 16,000 | 24,000 |
| Release-site points | 4,000 | 7,000 | 11,000 | 16,000 |
| Lantern sprites | 300–400 | 300–400 | 300–400 | 300–400 |

### 9.3. Timings and clocks

- Human step ≤ 0.5 s, and ≤ 0.05 s while S and S̃ differ by more than 0.02 and during ONSET and
  ORGASM; dopamine substep 0.02 s (k_h ≤ 20) or 0.1 s (k_h > 20); inputs interpolated inside each
  human step.
- Clocks: k_h = 10 (baseline–plateau) / T_pre/2.5 s (ONSET; 2.5 s on screen) / 1 (orgasm) / 20
  (early resolution) / 60 (late resolution) / max(60, remaining/20 s) (recovery; remaining = time
  until I < 0.08 and R < 0.2) / max(60, remaining/30 s) (no climax; remaining = time until G < 0.1).
  `remaining` is computed once, at phase entry (as `_enter` does with `_recoveryRemaining()`), and
  k_h then ramps to that fixed value; recomputing it every frame would make k_h decay with screen
  time and stretch the default recovery from ≈ 20 s to ≈ 43 s (20·ln(3,863/1,200) + 1,200/60 s).
  At every phase change except an instant switch into ONSET, log₁₀ k_h moves linearly from its
  current value to the target over 1 s of screen time (so k_h itself changes exponentially;
  `LogRamp`). The §9.6 timeline depends on this: the 1 → 20 ramp at early-resolution entry costs
  0.68 s of screen time, so that phase lasts 15.7 s; a first-order approach with τ = 1 s in log space
  would cost 1.69 s, and 8-s ramps grow the cycle from 131 to 143 s.
  On a transition into ONSET the rest of the frame runs at the new k_h (§6.7, §9.1). With
  T_pre = 0, no human time passes during ONSET (k_h = 0; physiology and Ω held), ONSET ends after
  2.5 s of screen time, the clock switches instantly from 0 to 1 at ONSET → ORGASM (a log ramp
  cannot start at log₁₀ 0), zero-length response steps call no `onStep`, and the dopamine layer runs
  no substep when Δ = 0 (the frame mean then keeps its previous value, §6.4 (10), §9.1).
- `pathHist` advances every 0.125 s of screen time (2 s travel along any tract).
- Visual persistence: τ_vis = max(0.3 s, 0.5·τ_clear/max(1, k_h)) screen (during ONSET, including
  k_h = 0 with T_pre = 0, the k_h = 1 values of §8.4 apply); a lower floor only after the
  large-area slew limiter of §10 rule 2 is implemented and tested.

### 9.4. Glow radii and colours

Lantern ember 2,300 K (`DOPAMINE_RGB`), flare core up to 2,700 K, floor 2,200 K; neuron stars 7,000–
9,500 K (`NEURON_WARM`, `NEURON_COOL`); fibres 6,000 K at 10–20 % of the median neuron star flux. Lantern
radii as in §8.3; halo cap 10 mm.

### 9.5. HUD fields and disclosures

Phase; human time and clock; the dopamine and modulator panels of §8.6; a collapsed "Hypotheses"
dropdown with one control per §6.10 row; and a collapsed "Scale and evidence" dropdown (also in the
About dialog, never as subtitle lines under panel titles) with these fixed lines: "1 DA cell star ≈
170 midbrain dopamine neurons"; "1 cortical star ≈ N neurons, 1 cerebellar star ≈ M" (N and M
computed from the active tier: 1.1 × 10⁵ and 1.7 × 10⁶ at the high tier); "glow spread shows
recruitment of release sites: tens to hundreds of times wider than real diffusion (≈ 20–30×
hypothalamus and median eminence, ≈ 115–180× amygdala and PFC, ≈ 200–750× striatum)" (lantern
radius of §8.3 over the spread radius of §3.4); "flow along tracts is a slowed visual cue (2 s on
screen; real conduction 0.04–0.2 s in the brain, 0.5–1 s to the lumbosacral cord)"; "concentrations are rat-calibrated; human dopamine during sexual activity has never been
measured"; "hypothalamic nuclei and dopamine groups enlarged for legibility"; "spinal
field stands in for lumbosacral targets"; "oxytocin input is plasma oxytocin used as a proxy for
central release"; "D2 occupancy is a modelled high-affinity-state value"; "rose, violet, teal and sage
tints on their source nuclei mark modulator activity (prolactin on the pituitary gland, serotonin on
the raphe, GABA on the RMTg and VTA, opioids on the PAG and arcuate), not dopamine"; "the shapes of
thalamus, putamen and pallidum are smaller than real (MNI-space ellipsoids)". Badges (short pills)
always mark the hypothesis channels (climax dopamine, post-orgasm course, TIDA withdrawal, A11,
prolactin → mesolimbic, κ feedback, session satiety); ≤ 70 % opacity and a dashed legend apply only
to elements produced by a non-default setting (§6.10).

### 9.6. Default timeline (demo cycle)

Demo mode with the ported response model, the closed loop and the "sustained" default (single
profile, deterministic train and no level noise as in §6.9, 60 fps, 1-s clock ramps; simulated).
Because the demo draws the same 15.5-s train as the §6.9 reference, its values match §6.9 to within
frame sampling; tests use the §6.9 values. The build length is seed-dependent: with the level noise,
ignition falls at ≈ 44–54 s of screen time over 20 seeds (human ≈ 6.9–8.5 min after stimulation
starts); deterministically at 51.7 s.

| Screen time | Human time | Phase (k_h) | Dopamine layer |
|---|---|---|---|
| 0–3.0 s | 0–0.5 min | baseline (10) | resting embers: NAcc 15 nM, D2 0.60; somata twinkle slowly |
| 3.0 s | 0.5 min | excitement begins | onset transient: VTA-l 10.7 Hz, NAcc core 38.3 nM (2.55×); drawn as one soft flare lasting ≥ 0.3 s |
| 3.0–37.7 s | 0.5–6.28 min | excitement (10) | NAcc ember ×1.3 at 10 s → ×1.45; MPOA → ×1.6; dorsal striatum → ×1.3; PFC wash → ×1.4; median eminence unchanged |
| 37.7–51.7 s | 6.28–8.61 min | plateau (10) | NAcc ×1.46 (with the level noise ×1.0–1.9, VTA-l 4.5–9.4 Hz in slow waves); MPOA ×1.6 |
| 51.7–54.2 s | 8.61–8.64 min | onset (0.6; 2.5 s on screen) | VTA-l 7.0 → 17.4 Hz; NAcc core 1.5 → 3.55× (peak 53.3 nM); PFC and amygdala rise slowly (×1.4 → ×2.2–2.3) |
| 54.2–69.8 s | 8.64–8.89 min | orgasm (1) | smooth consummatory envelope (≈ 34–40 nM from train time 0.5 to 4 s, peak 39.8 nM at 2 s, mean 37.4 nM over train time 1–4 s, then decay); A11 beam ×2.4; median eminence starts to dim (0.55 at the end) |
| 69.8–85.5 s | 8.89–13.90 min | early resolution (1 → 20) | NAcc 1.27 → 1.11×; MPOA 0.8×; median eminence trough 0.42× at ~71 s; Z gauge rises to ~0.72; with the default T_ref the refractory period is still running |
| 85.5–110.9 s | 13.9–38.9 min | late resolution (60) | NAcc 1.11 → 1.02×; median eminence rebounds to ×1.5; MPOA back to 1.0; the refractory period ends (I < 0.08) at t_e + 15 min ≈ 23.9 min, ≈ 10 s into this phase (≈ 96 s on screen) |
| 110.9–131.3 s | 38.9–103.3 min | recovery (60 → ~190, the target fixed at entry) | median eminence declines from ×1.5 toward ×1.1; all other fields at rest; stimulation is no longer gated (I ≈ 0.006) |
| 131.3 s | 103.3 min | baseline | the demo restarts stimulation 3 s later |

One full demo cycle lasts ≈ 131 s of screen time (deterministic; ≈ 119–134 s over 20 seeds with the
level noise and the random train). With "dip", NAcc falls to 0.955× at ≈ 3.5 human min after the orgasm end
(≈ 81 s on screen) instead of staying above rest. The multiple profile, with the corrected demo
script (§9.8), runs two peaks 33.4 s of screen time apart and returns to baseline at ≈ 165 s:
early resolution 103.2 s, late resolution 118.9 s, recovery 144.3 s, baseline 164.6 s (§6.9 profile
table).

### 9.7. Tests

A Node test (`brain-system/test/dopamine.test.mjs`) runs `response.js` with the dopamine model in human
time (Δ = 0.05 s) and asserts the §6.9 rows on the deterministic reference (constructed with
`{ deterministic: true }`, §9.1: η = 0, q = 0.5, tail pulses at train times 10.47 and 13.47 s,
amplitude 0.15), plus the seed statistics where §6.9 gives them (a seeded `rng` passed to the
constructor). A second test runs demo mode in screen time at 10, 30, 60 and 240 fps and asserts:
the same onset peak as the maximum over dopamine substeps (row 21); ONSET lasting 2.5 s on screen
at every frame rate; that no region's rendered relative luminance, measured from the composited
frame, changes by more than 0.1 (of display white, 1.0) per ⅓ s of screen time once its projected
glow exceeds the area limit (§10 rule 2); that no set of concurrently changing pixels larger than
0.006 sr within any 10° field (21,824 CSS px², converted to pixels of the composited frame, which is
the canvas drawing buffer, with (`canvas.width` / `canvas.clientWidth`)² only; an offscreen render
target would also take (adaptive render scale)², §10 rule 1) shows
more than three flashes per second; that in both modes of the climax switch lantern E varies by
≤ 0.025 within any contraction interval (detrended peak-to-peak; default 0.021 / 0.016 for NAcc core
/ dorsal striatum, pulse-locked with τ_vis 2 s 0.016 / 0.017; §6.10); that no single point twinkles
faster than 2 Hz; and that `prefers-reduced-motion` halves the twinkle, flare and imaging
amplitudes, stops the auto-orbit and stops the tract flow (§10 rule 6). A third test runs the
multiple profile in demo mode and asserts that the cycle passes RESOLUTION_EARLY → LATE → RECOVERY
→ BASELINE after the second peak (§9.8 demo row). A fourth test runs the `brain.js` generator at
every tier and asserts that every pathway receives exactly round(axon·share) axon points, that
every TERMINALS field, the spinal field included, receives its allocated count of release sites,
and that `da.total` equals the number of records written (§7.6).

### 9.8. Reconciliation with the current code

The code was written against an unsaved draft and diverges from this text. This text is canonical.

| Item | Current code | Canonical (this text) | Section |
|---|---|---|---|
| Response model | pre-correction galaxy constants, Q = max(I, R), `inevitability` 2.5 s, s·X inside the 1/τ_A bracket, Ah and A^1.5, 0.035·Ω oxytocin, vasopressin fall 600 s, vitals, phase transitions, no-climax clock 60, tail 0–2 pulses | corrected RESPONSE.md §7.4–§7.9 port, ONSET with T_pre/u_pre and cancel, and every other row of the §6.7 table | §6.7 |
| Dopamine interface (`dopamine.js`, `response.js`, `main.js`) | `step(h, model)` from `onStep(h, S)`; inputs read from the post-step model; k_h not available in `step` | `step(h, model, prev)` from `onStep(h, prev)` with the pre-step snapshot (`snapshot()` contents as in §9.1); `khNow` set before the step loop; `tHuman` and `tIgnite` exposed; existing exports kept (only `DopamineModel` is imported, by `main.js`); `response.js` constructor options `{ rng, deterministic }` for the §6.9 reference; on a transition into ONSET the rest of the frame runs at the new k_h; `setSwitch(name, value)`, `novelStimulus()` and `ResponseModel.setOnset({ Tpre, uPre })` with one `main.js`/`ui.js` handler per §6.10 row (today only `onHypothesis`) | §6.2, §6.7, §6.8, §6.10, §9.1 |
| Dopaminergic drive D | own D* in `response.js`, never shown, not computed from dopamine | D = clamp(0.2 + 1.6·(C̄_shell/C0 − 1)) written by `dopamine.js` | §6.4 (11), §6.7 |
| Firing | ν·(1 + βδ), hard clamp at 30 Hz | soft saturation at ν_sat = 20 Hz | §6.4 (5) |
| β (VTA-l, VTA-m, SNc) | 35, 15, 18 s | 25, 10, 6 s | §6.5 |
| Pause floor f_p | 0.35 | 0.5 | §6.5 |
| Climax reward | pulse-locked kernel (τ 0.3 s) by default | alpha envelope τ_r = 1 s by default; pulse-locked only as an off-by-default switch on small points | §6.4 (4), §6.10 |
| Value ramp at ignition | 2.5 s, hard-coded | T_φ = max(T_pre, 1.5 s); orgasm Φ = min(Φ_ramp, 1 − 𝒢) | §6.4 (4) |
| κ-opioid feedback | k_K·(θ1 − θ1_0), k_K = 1, τ_K = 120 s (< 1 % brake) | g_K·(θ1/θ1_0 − 1), g_K = 0.2, τ_K = 300 s (≈ 6 % brake) | §6.4 (9) |
| Serotonin proxy Z | τ 30 s rising, 1 s falling | τ_Z = 60 s both ways | §6.4 (1) |
| A13 drive | no Ω term | + 0.3·Ω | §6.4 (3) |
| TIDA 20-s oscillation | present (±8 %) | kept and documented (a_T = 0.08) | §6.4 (3) |
| Hippocampus | drawn from the amygdala field at 0.4× (≈ 0.22 with the §8.3 amygdala w_vis) | no compartment of its own; drawn from the amygdala compartment with its own w_vis 0.14 | §6.5, §8.1, §8.3 |
| Ψ normalisation | min(1, Ψ) with Ψ peaking at ~1.5 | Ψ/0.9 after the port | §6.4 (1) |
| Hypotheses | `satiety` {g5HT 0.5, gPRL 0.2, gPsi 0.3} by default; `sustained` {0.1, 0, 0.5} | `sustained` {z_Z 0.2, g_Ψ 0.5} by default; `dip` {z_Z 0.5, g_Ψ 0.3}; prolactin brake z_R separate, 0 by default, opt-in 0.2 | §6.10 |
| Input handling | inputs constant over a response step (frame-rate dependent δ) | linear interpolation inside the step plus the 0.05-s step cap | §6.4 (12), §6.8 |
| Hypothesis labels (`index.html`) | "Serotonergic satiety (dip)" (default), "Sustained (rat PEI)"; one select | "Sustained above rest (default; model choice)", "Serotonergic dip below rest (rat, inferred from Lorrain et al. 1997, 1999)"; a "Hypotheses" dropdown with one control per §6.10 row | §6.10, §9.5 |
| Phase texts (`response.js` PHASES) | state inferred or rat findings as human facts; "within about a minute"; "about half of the D2 receptors"; 2.5-s reflex phase for every profile | wording of §9.9 | §9.9 |
| Phase id `inevitability` outside `response.js` | hard-coded in `dopamine.js` (`_phi`, `step`), `main.js` (climax HUD dimming and camera stop) and the README intro ("the point of inevitability") | `onset` / "onset window" everywhere, or the value ramp and the HUD dimming break when only `response.js` is ported | §6.7, §9.9 |
| `README.md`, About text | "seven dopaminergic cell groups"; "Nothing flashes more than three times per second"; "lantern colour never goes below 2,200 K (WCAG saturated-red limit)"; prolactin hypothesis only; "Amber threads" (tracts); "Cool-white stars … brightness follows regional activity reported by human PET and fMRI"; README: "`prefers-reduced-motion` slows the camera and stops its drift"; About: "The effect of prolactin on brain dopamine is a hypothesis" | "seven A-groups (A8–A14) feed seven model populations (A8 pooled with A9, A10 split in two)"; the WCAG wording of §10 rule 3; "WCAG saturated red is reached between ≈ 1,900 and 1,960 K; 2,200 K is a margin"; name the oxytocin proxy; "prolactin: established short-loop action on TIDA neurons (rodent); a brake on mesolimbic dopamine is an opt-in hypothesis"; "reduced motion: auto-orbit off, twinkle, flare and imaging amplitudes halved, tract flow off" (§10 rule 6); neutral fibres with a faint amber flow; the imaging overlay is optional and off by default; keep the τ ≥ 0.3 s low-pass statement (§8.1) | §2.1, §5, §8.1, §8.2, §10 |
| Modulator tint legend (README, About) | the About legend names the raphe, RMTg, pituitary and PAG, omits the VTA and the arcuate and does not say the tints are not dopamine; README leaves out the VTA (it names the PAG and arcuate); the HUD dot titles name all six tinted regions | name all tinted regions: pituitary gland (prolactin), raphe (serotonin), RMTg and VTA (GABA), PAG and arcuate (opioids); "tints mark modulator activity, not dopamine" | §1, §8.1, §9.5 |
| Pituitary region (`anatomy.js`, `brain.js`, `dopamine.js`) | one region `pituitary` holds the gland haze, the stalk and the ME terminal field; it carries the prolactin tint (`MODULATORS.prolactin`) and the ME dopamine glow (`FIELDS.medEminence`, DA_WEIGHT 0.5) on the same points | split into `medianEminence` (ME field, stalk, portal wash; ME compartment; never tinted) and `pituitaryGland` (lobe haze; prolactin tint; bathing weight 0); the stalk keeps kind GLAND (haze sprites) under `medianEminence`; the ME TERMINALS entry, `FIELDS.medEminence.regions`, the tuberoinfundibular `to` and the `_activity` case move to `medianEminence` | §1, §7.3, §8.1, §9.1 |
| Neuron-star bathing (`shaders.js`, `brain.js` DA_WEIGHT) | amber = `aMeta.y`·E·`uDaGain` with DA_WEIGHT on top of the region's lantern weight (double weighting; frontal 0.06 against pfc 0.32) | 0.3·d_point·E_r with E_r carrying w_vis; weight 1 for lit regions, 0 for tinted modulator regions and the cerebellum (or keep DA_WEIGHT with w_vis = 1 in this term, frontal 0.38, pfc 0.27) | §7.3, §8.1 |
| Region ids (`anatomy.js` REGION_IDS, `shaders.js` array sizes) | one `vta`, one `dorsalStriatum`, one `pituitary`; A14 shares `pvn` | add `vtaMedial` (or `uDA[vta].w`), `caudate`, `a14`, `medianEminence`, `pituitaryGland` | §8.1, §9.1 |
| `color.js` comment | criterion reached "below 2,200 K" | R/(R+G+B) = 0.73 at 2,300 K; ≥ 0.8 only below ≈ 1,900–1,960 K; check after tone mapping | §8.2 |
| Composite shader | mesopic band ends at l = 0.12 (displayed amber up to 0.79) | smoothstep(0.004, 0.2, l) (≤ 0.73) | §8.2 |
| Twinkle rates (`shaders.js`) | soma spike rate min(3, 0.4·ν)·k with k = 0.6–1.4 (up to 4.2 Hz); release sparks up to ~3 Hz at C/C0 ≈ 3 and higher at the climax | cap k·rate at 2 Hz per point | §8.1, §10 |
| Release-spark phase (`dopamine.js` `updateVisuals`) | advances by 6·C_j/C0_j per screen s (a concentration ratio) | ∝ Σπν ρ / tonic release (`uDA[j].z`), capped at 2 Hz per site | §8.1 |
| Lantern mapping (`dopamine.js` `updateVisuals`) | tonicE = clamp(0.5 + 0.5·log₂), phasicE = clamp(log₂(C/C̄), 0, 1.5), E = w·(0.65·T + 0.8·F), spread 0.15 + 0.75·T + 0.35·F | T = clamp(0.3 + 0.5·log₂(C̄/C0)), F = clamp(0.5·log₂(C/C̄)), E = w_vis·clamp(T + 0.6·F, 0, 1.3), s = clamp(0.25 + 0.75·T + 0.3·F); τ_vis as in the code, max(0.3 s, 0.5·τ_clear/max(1, k_h)) (one symmetric filter for rise and fall, floor 0.3 s); a frame without substeps keeps the previous frame mean (§9.1); τ_vis ≥ 2 s for lantern E and spread during ORGASM while the pulse-locked switch is on | §6.10, §8.1 |
| w_vis | core 0.85, shell 0.8, dorsal striatum 0.6, PFC 0.45, amygdala 0.4, MPOA 0.7, PVN 0.6, ME 0.6, cord 0.35; OFC drawn at × 0.8 of PFC | §8.3: dorsal striatum 1.0 / 0.89, core 0.92, shell 0.81, ME 0.77, amygdala 0.55, MPOA 0.55, PVN 0.50, cord 0.55, PFC / OFC 0.17, ACC 0.24 | §8.3 |
| Flare channel | instantaneous C; one colour (`DOPAMINE_RGB`, 2,300 K) | frame-mean C when k_h > 2; 2,500–2,700 K flare core when F > 0.5 | §8.1, §8.2 |
| Tracts (`shaders.js`, `main.js`) | amber threads: colour uFibre·0.25 + uAmber·0.55·rate on a 4,200 K fibre (≈ 52 % amber at rest, ≈ 87 % at the climax) | neutral 5,500–6,000 K fibre at 10–20 % of the median star flux; amber flow ≤ 15 % of tract luminance | §8.1, §8.2, §9.4 |
| `pathHist` cadence | 0.5/16 s per sample (0.5 s travel) | 0.125 s per sample (2 s travel) | §8.1, §9.3 |
| Region → compartment | only terminal-field regions get E; pallidum, frontal, insula, parietal, temporal, occipital, thalamus and hypothalamus are never lit | §8.1 mapping, including pallidum, `frontal`, the other cortical lobes, thalamus and hypothalamus | §8.1 |
| VTA somata | mean of VTA-l and VTA-m | VTA-l for somata more than 3.5 mm from the midline, VTA-m for those within 3.5 mm (incl. the midline column), through the `vtaMedial` region id or `uDA[vta].w` | §8.1, §9.1 |
| Non-DA stars inside the VTA (`brain.js` `vtaOther`) | a share of the neuron-star tier (45 / 98 / 180 / 301 at the four tiers) beside 1,050 VTA somata: ≈ 15 % of the VTA stars at the high tier (≈ 4 % at the low tier, ≈ 22 % at ultra), against the 35 % target | a fixed count of 0.35/0.65 × the VTA and midline DA somata (≈ 380), kept in the neuron-star buffer (`vtaOther`, region `vta`; `vtaMedial` within 3.5 mm of the midline if that id is added) in the leading, unshuffled block so that every tier draws all of them; cool-white with the teal GABA tint of the neuron-star shader, bathing weight 0; `MODULATORS.gaba.regions` gains `vtaMedial` | §7.4, §7.5, §8.1, §9.1 |
| Release-site allocation (`brain.js` `fieldVol`) | r_x·r_y·r_z per ellipsoid, a fixed 900 per tube and 2,500 per cortical field, × `density`: allocates the spinal proxy 6.2 % of all sites (687 at 240 k), more than NAcc shell and core together (6.1 %), but the axon overrun (next row) leaves it 377 generated sites (3.5 %), fewer than the accumbens (671) | true field volume × w_true (or reword §7.5 to describe density weights) | §7.5 |
| Axon budget overrun (`brain.js` axon pass, `main.js` `daBudget`) | fibres × ceil(count/fibres) points per pathway, shares summing to 1.010, `da.total` = 3,500 + axon + vari: the axon pass overruns by +164 / +235 / +309 / +498 points at the four tiers, and since `dput` stops at `da.total` the spinal release sites are cut by 45 % at 240 k (377 of 687) and by 65 % at 60 k (87 of 250) | exactly round(axon·share) points per pathway (floor(count/fibres) per fibre plus one on the first count mod fibres fibres); `da.total` from the actual record counts | §7.6, §9.7 |
| Cortical ribbon (`brain.js` cortex loop) | samples the notch surface (≈ 4,060 stars at 240 k, ≈ 2,540 of them in the medial window, nearly all labelled `parietal`); ≈ 1,200–1,300 cortical stars inside midbrain, SN, PAG, hypothalamus and amygdala | reject the medial notch window (−45 < y ≤ +8) and deep-volume points; label lateral notch points, and medial ones behind y −45, `temporal` (`occipital` behind y −72) | §2.4, §7.2, §7.3 |
| Imaging-based activity overlay (`_activity`) | always on, +57 to +85 % and −30 to −40 % | optional, off by default, ±10–20 %, labelled "blood flow, not dopamine" | §8.1 |
| HUD units and fields (`index.html`; `ui.js` with its own `DA_FIELDS` and `MODULATORS` row lists) | MPOA, ME and A11 in nM; NAcc rows show instantaneous C and its ratio ("34 nM · ×2.3"); "VTA" = mean of VTA-l and VTA-m; burst indicator only; opioid gauge clamp(Ψ); one hypothesis select; an always-visible status header and title-row pills/badges | % baseline for MPOA, ME and A11; NAcc rows: tonic C̄ and last peak (substep maximum); VTA-l; burst/pause from the sign of δ; Ψ̂; the §6.10 control set; disclosures in a collapsed dropdown; the status header and title-row badges stay, as do the amygdala, PVN, SNc, TIDA, δ and net-gain rows; update the `ui.js` row lists | §8.6, §9.5, §6.10 |
| Large-area slew limiter | absent | per field, when the projected glow exceeds the rule-1 area limit (21,824 CSS px²), clamp ΔE so that its rendered relative luminance changes by ≤ 0.1 of display white per ⅓ s screen; required before any persistence floor below 0.3 s | §10 rule 2, §9.7 |
| Reduced motion | auto-orbit off only (`main.js`, `camera.js`; instant HUD fade) | also halve twinkle, flare and imaging amplitudes and stop the tract flow | §10 rule 6 |
| Pathway flow sources (`dopamine.js` PATH_SOURCE) | `incertoMpoa` driven by A14; no slMFB pathway | both incertohypothalamic tracts from A13; slMFB → DLPFC from VTA-m (§7.6) | §7.6 |
| Demo script, multiple profile (`response.js` `_demoStimulus`) | ends after two peaks only because the current A_res (0.35 + 0.4·(1 − 0.05) = 0.73) is below the 0.75 test of RESOLUTION_EARLY → PLATEAU, which reads A; after the port (A_res 0.78, test on A_obs) the same script keeps stimulation on: RESOLUTION_EARLY → PLATEAU fires at every t_e, peaks repeat every 33.4 s of screen time (2.7 human min) and the cycle never ends | release stimulation when the second ORGASM phase begins (demoPeaks ≥ 1 and phase = orgasm, and keep it off for the rest of the cycle; never during ONSET, where releasing cancels it), so S̃ ≈ 0 by t_e and the cycle runs RESOLUTION_EARLY → LATE → RECOVERY → BASELINE (≈ 165 s). Stopping only at demoPeaks ≥ 2 fails: demoPeaks rises at t_e, when S̃ ≈ 1 and S_eff ≈ 0.09 > 0.05, so RESOLUTION_EARLY → PLATEAU fires in the same step and the cycle ends through RESOLUTION_NO_CLIMAX (HUD: "ended without orgasm … no prolactin surge") with prolactin still ≈ 0.5 | §6.9, §9.6 |
| Construction details (`brain.js`, `anatomy.js`) | folia period 2.4 mm; groove points rejected (≤ 35 %) and dimmed (30 %), ≈ 55 % areal drop; sulcal dimming e^(−d/5); no Gaussian edge for the VTA and hypothalamic nuclei; nucleus flux 0.42× base; spinal label below z = −64, and the spinal TERMINALS tube [[3, −42, −66, 3], [3, −46, −86, 3]] starting in the medulla; `anatomy.js` comment "Volume ≈ 1,050 cm³" | folia 2.2 mm; combined groove drop and dim ≤ 30 % (e.g. reject ≤ 0.15, dim ≤ 0.18); e^(−d/6); Gaussian edges; 0.85×; z < −72 with the spinal TERMINALS tube [[2.5, −45.5, −74, 3], [2.5, −47.5, −88, 3]] (grey-matter proxy medial to the §7.6 route, ≈ 97 % inside the cord); "≈ 1,386 cm³ (MNI-sized)" | §7.2, §7.4, §7.6, §2.4 |
| Geometry (`anatomy.js`, `brain.js`) | see §7.3 (SNc axis and centre and crus ellipsoids, A8 and midline column, A13 site and rostromedial ZI, posterior hypothalamic ellipsoid around A11, NUCLEI radii and thalamus rotation, hypothalamus, MPOA and A11 positions, amygdala and hippocampus, caudate head, insula ribbon, brainstem first point, periventricular groups, voids with the sloping third-ventricle floor, cerebellum, cortical notch rejection, pituitary split, DA_WEIGHT, splines) | §7.3 | §2.4, §7.2, §7.3, §7.6 |

### 9.9. Phase texts (user-facing, neutral, species-tagged)

| Phase | Text |
|---|---|
| Baseline | Resting tone. In the model, midbrain dopamine neurons fire at about 4 Hz and accumbens dopamine sits near 15 nM, which occupies about 60 % of high-affinity D2 receptors (rat-calibrated values). |
| Excitement | Arousal builds. In male rats, accumbens dopamine rises when a receptive partner is presented and rises further during copulation (microdialysis, samples of several minutes); the model's opening transient stands in for that anticipatory cue signal. In the model, medial preoptic dopamine climbs with arousal, as it does in male rats before and during copulation (microdialysis); its role in humans is unknown. |
| Plateau | High, fluctuating arousal. Model accumbens dopamine averages about 1.45 times rest, inside the 1.4–2-fold rise measured in male rats during copulation (microdialysis). |
| Onset | A brief onset window; with the emission setting it cannot be stopped. In the model, midbrain firing ramps as the expected reward approaches (reward-prediction framework; not measured during sex). |
| Orgasm | Rhythmic contractions begin about 0.6–0.8 s apart (human recordings, both sexes). Human imaging at the climax is not consistent: most studies report cerebellar increases, but prefrontal and orbitofrontal blood flow fell in PET studies (women; men on re-analysis), while an fMRI study of women found orbitofrontal increases and no region decreasing. A ventral-midbrain increase reported in one PET study of men was largely not confirmed by its re-analysis; fMRI in women shows a broad rise that includes the ventral tegmental region. None of these methods measures dopamine. Model dopamine follows a smooth reward envelope; no data link dopamine to individual contractions. Prolactin is released (human blood samples); a withdrawal of tuberoinfundibular dopamine is one proposed mechanism (hypothesis). |
| Early resolution | What accumbens dopamine does now is unresolved. In male rats it falls from its copulation level after ejaculation but, in 15-min samples, stays above baseline across repeated ejaculations and returns to baseline only at satiety (microdialysis). Whether it dips below rest, possibly through lateral-hypothalamic serotonin, is unknown. The model shows the selected hypothesis. The model assumes a post-orgasmic opioid contribution (rat place-preference studies; unmeasured in humans). |
| Late resolution | Prolactin stays raised (men and women, blood samples after coitus; still raised 60 min after orgasm, the end of sampling). In the model its short-loop feedback (rodent evidence) drives tuberoinfundibular dopamine above rest, as a consequence of prolactin, not its cause. With the default setting the refractory period ends during this phase. |
| Recovery | Return toward baseline. In the model prolactin declines slowly (human blood samples show it still raised at 60 min; the later decline is a model assumption), and the median-eminence dopamine rebound fades with it. Orgasm is possible again once refractory inhibition ends: with the default setting this happened during late resolution; with long settings (for example the older-adult profile) it still gates stimulation here, and settings without an obligatory refractory period have none. |
| No climax | The plateau ended without orgasm. In the model, withdrawing stimulation briefly pauses midbrain firing (a negative reward-prediction error); dopamine and arousal then decline slowly, with no prolactin surge. |

---

## 10. Realism, safety and uncertainty rules

**Photosensitivity**

1. Never more than three flashes in any one second (WCAG 2.1, SC 2.3.1). A "flash" is a pair of
   opposing luminance changes of ≥ 10 % of maximum relative luminance where the darker state is below
   0.80, over a combined area of concurrently flashing pixels > 0.006 sr within any 10° visual field
   (25 % of that field). For web content WCAG's own estimate is the binding one: a 10° field is a
   341 × 256 CSS-px rectangle (Note 1 of the glossary entry, 1024 × 768 at 75–85 ppi, which WCAG
   notes is more conservative than the nominal 96 ppi), so the area limit is 21,824 CSS px² (for
   example 170 × 128 px = 21,760 px²), independent of canvas size. A test or limiter that counts
   pixels converts it with the actual ratio of buffer pixels to CSS pixels: (`canvas.width` /
   `canvas.clientWidth`)² for the canvas drawing buffer, which holds the composited frame, and
   additionally × (adaptive render scale)² for an offscreen render target sized by that scale; never
   with `devicePixelRatio`², because `main.js` caps the buffer DPR per quality tier, and the render
   scale reaches only the offscreen targets (applying it to the composited frame would shrink the
   limit by scale², to 0.72× at the low tier's 0.85). (For reference only: at 60 cm and 96 ppi,
   0.006 sr would be ≈ 30,900 CSS px², which on an 80-ppi monitor at the same distance covers
   0.0086 sr, 44 % above the threshold; this value is not used.) §9.7's area test uses
   21,824 CSS px².
2. Large-area slew limit: any region whose projected glow exceeds the area limit (21,824 CSS px²,
   rule 1) may change its displayed relative luminance by at most 0.1 (of display white, 1.0) per
   ⅓ s of screen time; the bilateral striatal glow on a large monitor can reach this area. The limit
   applies to the rendered luminance after w_vis, halo gain, bloom and tone mapping, not to the
   model variable E. Not yet implemented (§9.8); until it is, the persistence floor stays at
   τ_vis ≥ 0.3 s (§8.1).
3. No set of concurrently changing pixels whose combined area within any 10° field exceeds 0.006 sr
   produces more than three flashes (pairs of opposing ≥ 10 % changes) per second; lantern glows and
   fields obey this. Individual points smaller than 0.1° (≈ 1 mm, ≈ 4 CSS px at 60 cm; somata embers,
   release sparks) twinkle asynchronously and are each capped at 2 Hz visual. (The current shader
   lets a soma twinkle at up to 4.2 Hz and sparks at ~3 Hz or more; these small, desynchronised
   points form a fine balanced pattern (WCAG's exception covers a fine, balanced pattern such as
   white noise with elements smaller than 0.1°, not single points as such) and stay within the WCAG
   threshold provided their concurrently changing area in any 10° field stays below the rule-1
   limit; but the absolute claim "nothing flashes more than three times per second" in `README.md`
   is untrue until the cap is applied, §9.8. Passing the WCAG threshold is a guideline, not a
   guarantee of safety for every viewer.) Individual spikes are never drawn at k_h > 2. The
   contraction rhythm (≤ 1.7 Hz) never modulates the dopamine lantern glows beyond the default
   per-contraction swing of E (≤ 0.025 peak-to-peak, §9.7), far below a visible or flash-relevant
   change; with the pulse-locked hypothesis switch it reaches small points only, at ≤ ±15 %, and
   the lanterns are held to that default swing by τ_vis ≥ 2 s (§6.10). The 8–13 Hz component of
   the response model is never rendered.
4. Lantern colour stays at 2,300 K by default and never below 2,200 K. The WCAG saturated-red ratio
   (R/(R+G+B) ≥ 0.8, linear sRGB, negative channels clipped to 0) is reached between ≈ 1,900 and
   1,960 K before tone mapping (0.75 at 2,200 K, 0.73 at 2,300 K); WCAG's red flash also requires a
   chromaticity change > 0.2 (CIE 1976 UCS), so the ratio test alone is conservative. After the
   composite pass the displayed ratio must stay ≤ 0.75 (§8.2).
5. Cerebellar folia and gyral stripes are static, irregular, never a regular grating of more than
   five light–dark pairs in any orientation (the broadcast pattern rule for changing patterns, which
   is conservative here: the 2005 consensus allows up to eight pairs for static or smoothly drifting
   patterns; Harding & Jeavons 1994; Wilkins 1995; Harding et al. 2005; Fisher et al. 2005 on
   contrast, spatial frequency and area), and low in contrast ([model] ≤ 30 % Michelson). The cited
   guidance states absolute luminance conditions instead of a relative contrast (ITC/Ofcom: darker
   bars below 160 cd/m² and ≥ 20 cd/m² darker than the lighter bars; EFA consensus 2005: lightest
   stripe > 50 cd/m², > 0.006 sr, ≥ 0.5 s, ≤ 5 pairs if changing, ≤ 8 if static), which a web canvas
   cannot verify without the display's luminance. The 2026 Epilepsy Foundation consensus, which
   replaces the 2005 one, advises designers to avoid oscillating or static stripes of about 1–8
   cycles per degree (per its abstract); its full thresholds must be checked before release.
6. With `prefers-reduced-motion`: modulation amplitudes (twinkle, flare, imaging overlay) halved,
   auto-orbit off, tract flow off. The current code only stops the auto-orbit (§9.8).

**Content**

7. Clinical and non-explicit. In this scenario: no genital or sexual anatomy, no silhouettes or posed
   bodies, no body-shaped glows, suggestive shapes, wording or sound. The neutral star-built body
   network of `research/ANALYSIS.md` may be shown as specified there; the dopamine scenario adds
   nothing below the brainstem except the labelled A11 beam. Profiles are response patterns, never
   sex-coded presets or colours.

**Species and uncertainty**

8. Every concentration and kinetic number is rat-calibrated and labelled so in the HUD and the About
   text; the About text states that human dopamine during sexual arousal and orgasm has never been
   measured and that the PET "VTA" activation at ejaculation (one study of men, largely not confirmed
   by its re-analysis, Georgiadis et al. 2007) is blood flow in a region that PET cannot separate
   from SN, zona incerta and thalamus.
9. Hypothesis channels (climax dopamine, post-orgasm course, TIDA withdrawal, A11, prolactin →
   mesolimbic, κ feedback, session satiety) always carry a HUD badge; elements produced by a
   non-default setting are drawn at ≤ 70 % opacity with a dashed legend (§6.10, §9.5).
10. Disputed findings are never presented as settled: prolactin as a cause of refractoriness, the
    mechanism of the prolactin surge (TIDA withdrawal vs releasing factors), the post-orgasmic course
    of NAcc dopamine (whether it stays above rest or dips below it; "sustained" is the default as a
    model choice, and neither reading is established), the PET ventral-midbrain ("VTA") activation
    at ejaculation (Holstege et al. 2003 vs Georgiadis et al. 2007), prefrontal/orbitofrontal
    deactivation at orgasm (PET decreases, Georgiadis et al. 2006, 2007, vs fMRI increases, Komisaruk
    et al. 2004; Wise, Frangos & Komisaruk 2017, who found no region decreasing), a pre-climax firing ramp,
    dopamine locked to contractions, the D1-phasic/D2-tonic split, the MPOA D1/D2 switch, the human
    relevance of MPOA dopamine (no preoptic or hypothalamic blood-flow increase at ejaculation in
    men, Holstege et al. 2003; fMRI in women reports hypothalamic rises, Wise, Frangos & Komisaruk
    2017, and, in 3 women with spinal cord injury, paraventricular activation, Komisaruk et al.
    2004; neither resolves the preoptic area), dopamine as a pleasure signal. Every user-facing number names
    its species, sex and method (§9.9).
11. The millimetre glow spread is explained as recruitment, not diffusion; the tract flow as a slowed
    visual cue, not conduction.
12. Point budgets disclose neurons per star; deep structures and dopamine cell groups are oversampled
    on purpose.

**Avoid**

- A pulsing "orgasm flash" across the brain; a nucleus or lantern pulsing at the contraction rhythm;
  dopamine bursts per contraction as fact; a whole-brain amber flood; amber in the cerebellum;
  saturated, glowing or amber modulator colours, or any modulator tint on a dopamine lantern, soma,
  release site, tract or any other point that carries dopamine amber (including the median eminence
  and stalk); unlabelled modulator tints; neon saturation; glowing tubes for tracts; drawing crossed (contralateral)
  dopamine tracts (the sparse crossed nigrostriatal component is not modelled); rendering the
  pituitary as neurons; drawing the portal (vascular) leg of the tuberoinfundibular system as an
  axon; an emission-type irreversible onset presented as universal.

---

## 11. Sources

### 11.1. Raw captures used (located with `graphify query` / `explain` / `path`)

`brain-system/raw/en_wikipedia_org_api_rest_v1_page_html_*.md`:

| File | Lines used |
|---|---|
| Ventral_tegmental_area.md | L35, L39, L43, L49, L55, L57, L63 |
| Substantia_nigra.md | L56, L58 (corrected), L82, L84 |
| Nigrostriatal_pathway.md | L39, L43, L45, L57 |
| Dopaminergic_pathways.md | L23, L25, L29, L37–L44 (pathway table), L54–L58 (minor pathways: VTA → cingulate, olfactory bulb; SNc → STN) |
| Mesocortical_pathway.md | L27 |
| Tuberoinfundibular_pathway.md | L19, L21 (axons end at the median eminence), L23, L40 (portal capillaries at the median eminence) |
| Incertohypothalamic_pathway.md | L17 |
| Medial_preoptic_nucleus.md | L47, L55, L63, L65 |
| Paraventricular_nucleus_of_hypothalamus.md | L42 (corrected), L46, L60, L70 |
| Dopamine.md | L45, L64, L66 |
| Dopamine_receptor.md | L33, L49 |
| Dopamine_transporter.md | L33 |
| Autoreceptor.md | L23, L29, L35 |
| Reward_system.md | L21, L33, L37 |
| Striatum.md | L73 (co-expression figure not used) |
| Human_brain.md | L46, L66 |
| Volume_transmission.md (resolved to Neuromodulation) | L9, L21, L56 |
| Temporal_difference_learning.md | whole file checked: no dopamine content |

`brain-system/raw/en_wikipedia_org_api_rest_v1_page_html_*.md`: Mesolimbic_pathway.md L23, L31,
L39; Prolactin.md L34, L40; Refractory_period_sex.md L25, L29, L33; Medial and dopamine-related nodes
of Nucleus_accumbens.md L41, L53; Periaqueductal_gray.md L34–L44.

Graph checks: `graphify query` on dopamine, VTA, NAcc, prolactin, TIDA and arousal (2,500-token
budget); `graphify explain` on the Tuberoinfundibular pathway node; `graphify path` Prolactin →
Ventral tegmental area (no path).

### 11.2. Project files

- `RESPONSE.md` §5.1–§5.3 (imaging caveats, activation table, time course),
  §6 (neurochemistry table and caveats), §7.2–§7.9 (response model, phase machine, clocks, profiles),
  §10 (realism and photosensitivity rules). Cited by section because that file is being revised in
  parallel; as of writing §5.2 starts near L541, §6 near L657, §7.4 near L770 and §10 near L1388.
- `brain-system/src/response.js`, cited by name because line numbers drift: `C` and `CLOCK`
  (constants, clocks), `Aeff` and `Ah` (getters), `_enter`, `_Iat` and `_Rat` (I and R closed
  forms), `_startTrain` (train), `_integrate` (integration), `_transitions` (phase machine), `update`
  (update loop and `onStep` hook), `vitals`.
- `brain-system/src/anatomy.js` (regions, nuclei, DA groups, pathways, terminal fields), `brain.js`
  (point populations, shares, DA weights), `shaders.js` (uniform layout), `performance.js` (tiers),
  `color.js` (blackbody colours), `main.js` (views, budgets, frame dt clamp 0.1 s), `dopamine.js`
  (implementation that diverges from this text, §9.8).
- Reference simulation. **The text alone suffices to reproduce §6.9 and §9.6**: independent
  implementations written only from RESPONSE.md §7.2–§7.9, the §6.7 port table (including its
  demo-script and initial-state row) and §6.4–§6.5 give the
  same deterministic values (for example onset 38.30 nM at +0.58 s with VTA-l 10.70 Hz; climax
  53.29 nM at +0.70 s with 17.41 / 13.66 / 9.10 Hz; θ 8.12 min; "sustained" 1.28 / 1.25 / 1.18 /
  1.11 / 1.07 / 1.04 / 1.02× at +0.5 / 1 / 2 / 5 / 10 / 20 / 30 min; "dip" minimum 0.955× at
  +3.48 min; the §9.6 phase entries within one frame). The scripts are scratch files outside the
  repository and are not canonical; the test of §9.7 (`brain-system/test/`) is meant to replace
  them. Round 3 (text edits only; no equation or parameter changed, so the round-2 simulation
  values stand), in the sibling folder `editor-r3\`: `geo1.mjs` (A13 and A11 tissue, rostromedial
  ZI and posterior hypothalamic ellipsoids), `geo2.mjs` (slMFB route, voids, lumen fractions, SNc
  centre and crus, spinal terminal tube, brainstem stars in the lumen), `notch.mjs` and
  `notch2.mjs` (cortical notch replay at 240 k), `axon.mjs` (axon-budget overrun and spinal release
  sites with the real generator) and `build.mjs` (galaxy build table with both phasic readings,
  `LogRamp` cost, Z in the multiple profile); an independent text-only implementation by the
  kinetics review of round 3 reproduced every §6.9 row, the profile table and the §9.6 phase times
  once given the demo-script row of §6.7. Round 2, in
  `C:\Users\User\AppData\Local\Temp\claude\C--Users-User-projects-galaxy\641a402d-336b-4b93-bc5d-2e26265edfd2\scratchpad\editor-r2\`:
  `model.mjs` (response port with both readings of the open-loop phasic transient, dopamine layer),
  `build.mjs` (galaxy build table), `ref.mjs`, `demo.mjs`, `profiles.mjs` and `multi_fix.mjs`
  (reference rows, demo timeline, profile table, multiple-profile demo script), `theta.mjs`,
  `batches.mjs`, `rebuild.mjs` and `kb.mjs` (θ timing, refractory rebuilds, k_B fit), `distr.mjs`,
  `psi.mjs`, `shoulder.mjs`, `vform.mjs`, `pfc.mjs`, `pulselock.mjs`, `onset10.mjs`, `me.mjs` and
  `arith.mjs` (§6.6–§6.10 details), `geo.mjs`, `lumen.mjs`, `tubes2.mjs`, `thal.mjs`, `crus.mjs`,
  `bs.mjs`, `rel.mjs`, `notch.mjs` and `voids.mjs` (geometry; the last two replay the `brain.js`
  generator at 240 k). Round 1, in the sibling folder `editor-r1\`:
  `model.mjs` (response port, dopamine model, human-time and demo drivers), `v_galaxy.mjs` (checks
  against the galaxy build table, θ, O, R and refractory intervals), `ref.mjs` and `rows.mjs` (§6.9
  rows), `seeds.mjs` (20-seed distributions), `theta.mjs` (θ timing over 300 seeds, refractory
  intervals, k_B fit), `exp2.mjs` (T_pre, pulse-locked, distraction, withdrawal, Ω reading, bounds),
  `learn.mjs` (repeated orgasms), `demo.mjs`, `timeline.mjs`, `profiles.mjs` and `fps.mjs` (demo
  timeline, profile table, frame rates), `misc*.mjs` (prolactin opt-in, cost, τ_V sweep, faster
  autoreceptor, rapid profile, cerebellum overlap), `geo.mjs`, `geo2.mjs` and `routes.mjs` (nucleus
  radii and overlaps, amygdala–hippocampus and caudate tubes, tentorial overlap, tract routes). The
  earlier reference (`rm74.mjs`, `da_v2.mjs`, `v2run.mjs`, `e1.mjs`–`e10.mjs`, one folder up) used the
  code's tail and no-climax clock and is superseded; colour checks `red2.mjs` and `red3.mjs` (red ratio
  before and after tone mapping) are unchanged.

### 11.3. Literature

- **Cell groups, counts, anatomy:** Dahlström & Fuxe 1964; Björklund & Lindvall 1984; Björklund &
  Dunnett 2007; Azevedo et al. 2009; Pakkenberg et al. 1991; Fearnley & Lees 1991; Hirsch, Graybiel &
  Agid 1988; François et al. 1999; Nair-Roberts et al. 2008; Oades & Halliday 1987; Halliday & Törk
  1986; Haber, Fudge & McFarland 2000; Haber & Knutson 2010; Fallon & Moore 1978; Matsuda et al. 2009;
  Bolam & Pissadaki 2012; Doucet, Descarries & Garcia 1986; Descarries et al. 1996; Ehringer &
  Hornykiewicz 1960; Kish, Shannak & Hornykiewicz 1988; Berger, Gaspar & Verney 1991; Williams &
  Goldman-Rakic 1998; Sánchez-González et al. 2005; Kempadoo et al. 2016; Takeuchi et al. 2016; Lu et al. 2006; Skagerberg & Lindvall 1985;
  Giuliano & Allard 2001; Huisman, Uylings & Hoogland 2004; Schumann & Amaral 2005; West & Gundersen
  1990; Brichta & Greengard 2014; Graveland & DiFiglia 1985; Fass & Butcher 1981; Coenen et al. 2012.
- **MNI space, atlases and volumetry:** Mazziotta et al. 2001; Fonov et al. 2011; Lancaster et al.
  2007; Brett, Johnsrude & Owen 2002; Pauli, Nili & Tyszka 2018; Keuken et al. 2014; Murty et al. 2014;
  D'Ardenne et al. 2008; Baroncini et al. 2012; Mai, Paxinos & Voss (Atlas of the Human Brain); Aboitiz
  et al. 1992; hypothalamic volumetry: Klomp et al.; Peper et al.; Makris et al. 2013; Terlevic et al.;
  Schindler et al. 2013 (PLoS One; prior-study table).
- **Cortex and geometry:** Fischl & Dale 2000; Zilles et al. 1988; Tallinen et al. 2014; Toga &
  Thompson 2003; Sereno et al. 2020; Rockel, Hiorns & Powell 1980; Collins et al. 2010; Buzsáki &
  Mizuseki 2014.
- **Firing and prediction error:** Grace & Bunney 1984a, 1984b; Grace & Onn 1989; Grace 1991; Bean
  2007; Wilson & Callaway 1993; Floresco et al. 2003; Chiodo et al. 1984; Lammel et al. 2008, 2011;
  Schultz, Dayan & Montague 1997; Montague, Dayan & Sejnowski 1996; Schultz 1998; Doya 2000; Bayer &
  Glimcher 2005; Hyland et al. 2002; Zaghloul et al. 2009; Kishida et al. 2016; Cohen et al. 2012;
  Eshel et al. 2015; Matsumoto & Hikosaka 2007; Jhou et al. 2009; Barrot et al. 2012; Overton & Clark
  1997; Howe et al. 2013; Gershman 2014; Hamid et al. 2016; Mohebi et al. 2019.
- **Release, uptake, diffusion, receptors:** Pothos, Davila & Sulzer 1998; Gonon 1988; Montague et
  al. 2004; Cragg 2003; Liu et al. 2018; Pereira et al. 2016; Daubner, Le & Wang 2011; Wightman &
  Zimmerman 1990; Garris & Wightman 1994; Jones et al. 1995; Jones, O'Dell, Marshall & Wightman 1996;
  Wu et al. 2001; Cass & Gerhardt 1995; Sesack et al. 1998; Morón et al. 2002; Gogos et al. 1998;
  Tunbridge et al. 2004; Karoum, Chrapusta & Egan 1994; Parsons & Justice 1992; Atcherley et al. 2015;
  Nicholson & Syková 1998; Cragg & Rice 2004; Rice & Cragg 2008; Richfield, Penney & Young 1989;
  Sokoloff et al. 1990; Dreyer et al. 2010; Marcott, Mamaligas & Ford 2014; Hunger, Kumar & Schmidt
  2020; Beckstead et al. 2004; Skirboll, Grace & Bunney 1979; Benoit-Marand, Borrelli & Gonon 2001;
  Bello et al. 2011; Laruelle et al. 1997; Laruelle 2000; Best, Nijhout & Reed 2009.
- **Dopamine and sexual behaviour:** Pfaus et al. 1990; Damsma et al. 1992; Mas et al. 1990; Robinson
  et al. 2001; Robinson, Heien & Wightman 2002; Phillips et al. 2003; Wightman et al. 2007; Fiorino,
  Coury & Phillips 1997; Hull et al. 1989, 1995; Hull, Muschamp & Sato 2004; Dominguez & Hull 2005;
  Hull & Dominguez 2007; Mermelstein & Becker 1995; Jenkins & Becker 2003; Pfaus & Phillips 1991;
  Lorrain et al. 1997, 1999; Agmo & Berenfeld 1990; Paredes & Martínez 2001; Melis et al. 2007;
  Argiolas & Melis 2005; Barfield & Geyer 1972; Beach & Jordan 1956; Waldinger et al. 2005;
  O'Donohue & Geer 1985; Koukounas & Over 2000; Holstege et al. 2003; Georgiadis et al. 2006, 2007;
  Komisaruk et al. 2004; Wise, Frangos & Komisaruk 2017; Sescousse, Redouté & Dreher 2010;
  Sescousse et al. 2013; Stoléru et al. 2012; Oei et al. 2012; Weintraub et al. 2010; Salimpoor et al.
  2011; Koepp et al. 1998; Breier et al. 1997; Berridge & Robinson 1998; Berridge & Kringelbach 2015;
  García Horsman & Paredes 2004; Exton et al. 1999 (Psychosom Med 61:280); Exton et al. 2001
  (Psychoneuroendocrinology 26:287, coitus, 10 couples, sampling to 60 min after orgasm).
- **Modulators:** Johnson & North 1992; Jalabert et al. 2011; Margolis et al. 2003; Spanagel, Herz &
  Shippenberg 1992; Di Chiara & Imperato 1988; Di Matteo et al. 1999; Hung et al. 2017; Lyons,
  Horjales-Araujo & Broberger 2010; Lyons, Hellysaz & Broberger 2012; Freeman et al. 2000;
  Ben-Jonathan & Hnasko 2001; Grattan 2015; Demarest & Moore 1979; Krüger et al. 2002; Krüger et al. 2003a (J Endocrinol
  177:57, 2-min sampling); Krüger et al. 2003b (J Endocrinol 179:357, cabergoline/protirelin); Brody &
  Krüger 2006; Valente, Marques & Lima 2021; Haake et al. 2002; McCullough, Churchland & Mendez 2013.
- **Vision, colour and photosensitivity:** Kirk & O'Brien 2011; Harding & Jeavons 1994; Fisher et al.
  2005 (Epilepsia 46:1426); Harding, Wilkins, Erba, Barkley & Fisher 2005 (EFA expert consensus,
  Epilepsia 46:1423); Fisher et al. 2026 ("Visually-provoked seizures: Consensus of the Epilepsy
  Foundation Working Group", Epilepsia 67:565, doi 10.1111/epi.18702; replaces the 2005 consensus;
  thresholds to be checked before release); Wilkins 1995.

### 11.4. Standards

- W3C, WCAG 2.1 (Recommendation, current text; first published 2018) and WCAG 2.2, Success Criteria
  2.3.1 (Three Flashes or Below Threshold) and 2.3.2 (Three Flashes), with the glossary entries
  "general flash and red flash thresholds" (0.006 sr within any 10° field; Note 1: a 341 × 256 px
  rectangle at 1024 × 768 estimates a 10° field and is more conservative than the nominal 96 ppi,
  "it is lower resolutions that are used to define the thresholds"; Note 3: R/(R+G+B) ≥ 0.8 and a
  CIE 1976 UCS chromaticity change > 0.2), the exception for a fine, balanced pattern with elements
  smaller than 0.1°, and the Understanding document for SC 2.3.1.
- ITC/Ofcom guidance on flashing images and regular patterns (more than five light–dark pairs of
  stripes as a potentially harmful pattern; darker bars below 160 cd/m² and ≥ 20 cd/m² darker than
  the lighter bars).

### 11.5. Textbook knowledge (lower confidence)

- Conduction velocity of unmyelinated dopamine axons (0.5–1 m/s) and the derived delays.
- MNI coordinates of hypothalamic sub-nuclei, A11, A13 (rostromedial ZI, extrapolated from rat and
  primate), A14, A8, the midline column, RMTg, PAG, median eminence, pituitary lobes and the A11
  descending route; brainstem and cerebellar extents (inferior cerebellar surface about z −60 to −70);
  ventricle paths.
- Typical native MRI volumes per side (thalamus 6–8, putamen 4.5–5.5, pallidum 1.5–2 cm³; model
  ellipsoids are MNI-space and smaller, §2.4), human hypothalamic nucleus volumes (a few to low tens
  of mm³), native cerebrum volume (~1,000–1,100 cm³) and the size of linear MNI templates relative to
  native brains.
- Rat ejaculation latency in standard copulation tests (~5–15 min).
- Exact percentages of the primate midbrain dopamine split (SNc 60–75 %, A10 15–30 %, A8 5–15 %).
- Candidate prolactin-releasing factors (oxytocin, VIP, TRH, serotonergic input).
- Neuron counts of striatum, thalamus, hypothalamus and brainstem (order of magnitude; hippocampus
  and amygdala now from stereology, §2.2).
- Semi-quantitative terminal-density weights w_true; cortical tissue dopamine; PET binding ranges.
- Basal PFC dopamine by microdialysis; adult D1/D2 co-expression; rat PVN neuron count.
- Colour-vision deficiency prevalence; mesopic desaturation.
