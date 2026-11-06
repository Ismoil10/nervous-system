# Heart: anatomy, the beat and its response to emotion

The user asked for a full simulation of the heart: how it beats, and how it reacts to the person's
emotional state (the simple HUD's Calm, Stress and Pleasure). This note is the analysis and the
design; `src/heart.js`, `src/body/heart-form.js` and the heart stars of `src/body/generate.js` build
it.

## 1. What existed (6 November 2026)

- **Simulation** (`src/sim/autonomic.js`, ANALYSIS.md §7.5):
  - beat-averaged `hr` from the intrinsic rate and the vagal and sympathetic cardiac tones
    (`IHR · f_T · (1 + kS·s) / (1 + kV·v)`);
  - `aut.hrInst` with respiratory sinus arrhythmia;
  - `contractility`, `co`, `sv`, blood pressure and the baroreflex.

  Stress raises the sympathetic tone and adrenaline and lowers the vagal tone. Pleasure (the orgasm
  scenario) drives the HUD vitals through the legacy envelope `HR = 68 + 57·h` (RESPONSE.md §4.1).
- **Not present:**
  - a beat clock, the cardiac cycle and an ECG;
  - conduction delays;
  - chambers and valves: the heart was four ellipsoids and two dots;
  - any heart display. §13.7 and §13.9 specify one, but nothing drove it.

## 2. Anatomy (adult, neutral)

Mass ≈ 300 g, length ≈ 12 cm, breadth ≈ 8.5 cm. The base faces right, back and up; the apex points
left, forward and down, in the 5th intercostal space at the midclavicular line (§2.8, apex
(−80, 50, −384)).

| Part | Model | Wall |
|---|---|---|
| Left ventricle | ellipsoid of radius 31 mm whose equator lies 0.25 of the way to the apex, cut by the base plane; length ≈ 110 mm; it carries the septum | 10 mm |
| Right ventricle | crescent outside the LV, radii 33 × 28 mm, equator 0.2, reaching 0.8 of the length and ending short of the apex | 4 mm |
| Right atrium | right of the base, under the superior vena cava; with its appendage | 2.5 mm |
| Left atrium | behind, under the bifurcation; with its appendage | 2.5 mm |
| Valve rings | tricuspid, mitral, aortic, pulmonary: the fibrous skeleton, in the base plane and the outflow tracts | ring |
| Roots | aorta and pulmonary trunk, short tubes from the semilunar valves | 2 mm |

The second pass (§6) adds fibres, leaflets, papillary muscles, the great vessels and the coronary
vessels to this table.

### Conduction system

- **SA node:** (30, 0, −312), at the junction of the superior vena cava and the right atrium (§2.8).
- **Atrial conduction:** the internodal tracts (anterior, middle, posterior) to the AV node, and
  Bachmann's bundle to the left atrium.
- **AV node:** (5, −2, −350), in Koch's triangle (§2.8).
- **His bundle**, then the left bundle (anterior, posterior and septal fascicles down the left septal
  surface) and the right bundle (down the right septal side and the moderator band to the RV free
  wall).
- **Purkinje network:** subendocardial strands from the apex region up the free walls.

The routes and node ids are kept (`saNode`, `avNode`, `ventricles`, `heart`), so the sympathetic
and vagal cardiac routes of §7.2 still end on them.

## 3. The beat

### 3.1 Electrical sequence and timing (one beat, from the SA firing)

| Event | Rest (68 bpm) | Law | Source |
|---|---|---|---|
| Atrial activation (P) | 0–90 ms | P ≈ 90 ms; velocity ≈ 1 m/s over ≈ 85 mm | Guyton & Hall ch. 10 |
| AV delay | to PR − 30 ms | slow nodal conduction (≈ 0.05 m/s) | Guyton & Hall |
| PR interval | 0.167 s | PR = 0.12 + 0.05·clamp((RR − 0.333)/0.667, 0, 1.5): 0.17 s at 60 bpm, 0.13 s at 120, 0.12 s at 180 | normal range 0.12–0.20 s |
| His–Purkinje | PR − 30 ms to PR + 20 ms | 2–4 m/s | Durrer et al. 1970 |
| Ventricular activation (QRS) | 90 ms | septum first (left to right), then the apex, the free walls endocardium to epicardium, the base last | Durrer et al. 1970 |
| QT | 0.39 s | Fridericia: QT = 0.40·RR^(1/3) | Fridericia 1920 |

### 3.2 Mechanics (Wiggers cycle)

- **Atrial systole:** from 0.6·P for 100 ms. The atria shrink by up to 10 % and add the last ≈ 15 %
  of filling (the "atrial kick").
- **Isovolumic contraction:** from PR + 20 ms to PR + 70 ms.
- **Ejection:** to the end of the T wave (QT − 20 ms), fast first: V = 1 − EF·(1 − (1 − x)²).
- **Isovolumic relaxation:** 60 ms.
- **Rapid filling** (≈ 70 % of the stroke volume, 110 ms), then diastasis.

At high rates diastole shortens first. When the next beat starts before filling ends, filling is cut
short there, and the next beat starts from that volume.

- **Volumes at rest:** EDV 120 mL, ESV 48 mL, SV ≈ 72 mL, EF 0.60 (the kernel's SV is 73.5).
- **Ejection fraction:** EF = clamp(0.60 + 0.25·(contractility − 1), 0.50, 0.78). Sympathetic
  stimulation raises it towards 0.75–0.80.
- **Wall motion (display):**
  - the base (AV plane) descends towards the apex by 12 mm at rest end-systole (normal mitral
    annular excursion 12–15 mm);
  - the ventricular wall moves 12 % inwards.

  Both scale with the stroke (EF/0.60).

### 3.3 ECG (HUD trace)

A sum of Gaussian waves in the beat time: P, Q, R, S and T, at the times above. It is a schematic
lead-II trace, not a diagnostic one.

## 4. Response to emotion

| State | HR | Contractility / EF | Other | Sources |
|---|---|---|---|---|
| Calm | ≈ 68, with respiratory sinus arrhythmia ±5 bpm (faster on inspiration) | EF 0.60 | high vagal tone | §7.5; kernel |
| Stress | rises over tens of seconds as the sympathetic tone (2 s dead time, τ 4 s) and adrenaline (half-life 2.5 min) build; laboratory mental stress gives +10–25 bpm | rises (β1): EF towards 0.70+ | the PR interval shortens with the rate; RSA shrinks as vagal tone falls | §7.3–§7.5, §12.11; kernel |
| Pleasure (arousal to orgasm) | plateau ≈ 104–111, peak ≈ 125 (typical), back near rest within minutes | ↑ with blood pressure (SBP +45 at the peak) | — | RESPONSE.md §4.1; legacy envelope |

The heart model reads these from the simulation; it adds no physiology of its own:
- rate from the HUD vitals (`hr`, the legacy envelope during Pleasure);
- beat-to-beat variation from `aut.hrInst / hr` (RSA);
- contractility from the kernel's `contractility`, or from the systolic pressure when the legacy
  envelope drives the vitals: 1 + (SBP − 115)/120.

## 5. Display

- **Beats in screen time.** Each beat is drawn at the model rate in screen seconds. Time compression
  (`kh` > 1) does not speed the beat up; slow motion (`kh` < 1) slows it. §13.9 allowed per-beat
  drawing only at `kh` ≤ 1. This changes that rule: the photosensitivity limit concerns the screen
  frequency, which is the heart rate itself, not the compression.
- **Above 150 bpm** (2.5 Hz, §13.9): a steady glow ∝ HR/68 within ±15 %, with no per-beat motion or
  wave.
- **The wave.** A bright band runs through the conduction system and the walls at each star's
  activation time:
  - the SA node;
  - across the atria;
  - slowly through the AV node;
  - fast down the His bundle, the bundle branches and the Purkinje strands;
  - out through the ventricular walls.

  The band is energy-conserving: the rest of the heart dims by the band's mean gain, so the heart's
  total light does not pulse. That meets the 8 % per-beat swing of §13.9 by construction.
- **Motion.** The chambers contract with the volume curves (§3.2): the atria, then the ventricles,
  and the base descends. Reduced motion turns the motion off and keeps the wave.
- **Heart view.** A camera close on the heart. The skin, muscle and bone dim to 0.3 there, and so
  does every non-heart organ, so the heart reads through the chest.
- **HUD.** In the Body and Heart views the simple HUD shows a patient monitor instead of a single
  heart-rate number. See §7.

## 6. Realistic heart (second pass)

The user asked for a more realistic heart, drawn from many more stars. `HEART_FORM`
(`src/body/heart-form.js`) holds the geometry; `heartEntries` in `src/body/generate.js` makes the
stars.

### 6.1 Geometry

- **Ventricles:** each is an ellipsoid whose equator lies part of the way to the apex, cut by the base
  plane.
  - LV: radius 31 mm, wall 10 mm, equator 0.25.
  - RV: a crescent outside the LV, radii 33 × 28 mm, wall 4 mm, equator 0.2, reaching 0.8 of the
    length.
- **Myocardial fibres:** 65 % of the wall stars sit on strands of equal depth.
  - The helix angle turns from +60° (endocardium) to −60° (epicardium).
  - The RV ranges ±20° (Streeter et al. 1969).
  - There are 1,800 LV and 700 RV fibres, 16–40 mm long.
- **Atria and appendages.**
- **Valve rings** and **valve leaflets**, closed in the ring plane: tricuspid 3, mitral 2, aortic 3,
  pulmonary 3.
- **Papillary muscles** (2 LV, 1 RV) with chordae.
- **Great vessels:** aorta, pulmonary trunk, left and right pulmonary arteries, SVC, IVC and 4
  pulmonary veins. The venous ones are drawn blue.
- **Coronary arteries** on the epicardium: LAD, D1, D2, LCx, OM, RCA, acute marginal, PDA.
- **Coronary veins:** great cardiac vein, coronary sinus, middle cardiac vein.
- **Conduction system:** SA node, internodal tracts, Bachmann's bundle, AV node, His bundle, bundle
  branches and 90 Purkinje strands.

Each heart star carries four values in its normal slot:
- τ, its activation place: 0–1 atrial, 1–2 AV node, 2–3 His–Purkinje and ventricles;
- −1 for inert parts, −2 for venous roots, −(2 + valve index) for leaflets;
- a part code 1–15;
- its axial place, 0 at the apex to 1 at the base.

### 6.2 Display

- The vertex shader `BODY_VS` takes the beat as uniforms `uHeartT`, `uHeartM`, `uHeartK` and
  `uHeartV`, now 110 slots (the test limit).
- **Colours:**
  - myocardium red;
  - oxygenated vessels bright red;
  - venous vessels blue;
  - valves, leaflets and chordae ivory;
  - the conduction system in the nerve gold.
- **Heart view** (the simple HUD button "Heart"; also in the full HUD's view list): a close camera;
  heart stars ×2.2; everything else ×0.18, and nerves, cord and ganglia ×0.4.
- **HUD:** one number, the beats per minute, and a scrolling ECG trace in the Body and Heart views.

### 6.3 Budgets

- The organ budget is now 22k / 44k / 72k / 116k (low, medium, high, ultra). Body totals are 88.5k /
  171k / 280.5k / 430k. Before this change they were 78.5k / 151k / 248.5k / 378k.
- The heart takes 55 % of the organ stars: ≈ 39,600 at High and ≈ 63,800 at Ultra.
- The other organ shares were scaled so that their counts stay as before: heart 55, intestines 10,
  lungs 9, liver 6, kidney 4, stomach 3.5, sense 3.5, spleen 2, pancreas 1.5, pelvic 1.5, thyroid 0.5,
  other 3.5 (per cent).
- The Stars style keeps the earlier look: other organs keep 17,600 / 32,400 and the heart 2,400 /
  39,600. In Detailed, heart stars carry 0.8 × the organ star flux.

### 6.4 Measured in the app

- Calm: 68 per minute.
- Stress: 78 → 83 per minute, contractility 1.09.
- Pleasure: 89 (arousal) → 125 per minute (climax).

### 6.5 Tests

`test/heart.test.mjs` has 10 tests. The full suite has 564 tests: 532 pass, 4 known arm64 golden
failures, 28 todo. `tsc` is clean.

## 7. Patient monitor

The heart-rate readout of §5 is replaced by a patient monitor. It is the panel `#shud-monitor`,
drawn by `SimpleHud.drawMonitor` in `src/ui-simple.js`. The logic is in `src/monitor.js`
(`MONITOR`, `RespTrace`, `isAlarm`, `monitorValues`). The arterial wave, `arterialWave`, is in
`src/heart.js`.

The panel appears in the Body and Heart views. It is styled as a bedside monitor: a black screen,
conventional channel colours, sweep traces with an erase bar, and large tabular numbers with their
alarm limits. A value outside its limits turns yellow (#ffcc00). It never flashes (§13.15).

Channels:

- **ECG** lead II and **HR** (green, limits 50–120 bpm).
- **ART**: the arterial pressure trace, with systolic/diastolic and the mean in brackets (red,
  systolic limits 90–160 mmHg).
- **RESP**: the impedance trace and the respiratory rate (yellow, limits 8–25 /min).
- **TEMP**: core temperature (white, limits 35.5–38.0 °C).
- **ADR**: plasma adrenaline in pg/mL (limits 0–100).
- **CORT**: plasma cortisol in µg/dL (limits 5–25).

ADR and CORT are orange tiles marked as model blood values. In practice they are blood tests, not
bedside sensors.

Arterial wave. The wave rises over 80 ms. It falls late in systole to 0.75. A dicrotic notch of
0.10 lasts 30 ms at valve closure. Then it runs off exponentially to the diastolic value at the next
beat. The wave is scaled to the simulated SBP and DBP.

Respiration. Rate and tidal volume come from the simulation. Inspiration takes 40 % of the breath.
Expiration is exponential. The trace has 50 samples/s over 8 s.

Like the heartbeat, every trace runs in screen time. Time compression never speeds it up.

Not shown: SpO₂ and capnography. The model does not compute them.

Measured in the app under Stress: HR 77–79; ART 118/80 (93); RR 14; TEMP 37.0; ADR 72–98 pg/mL;
CORT 11.3 µg/dL.

Tests: `test/monitor.test.mjs` has 3 tests. The full suite has 567 tests: 535 pass, 4 known arm64
golden failures, 28 todo. `tsc` is clean.

## 8. Close-up detail (third pass)

The user asked for the heart down to its finest anatomical elements. It had to stay crisp, clear and
easy to read when the camera is close.

### 8.0 Analysis and decisions

**What was there before (6 November 2026).**
- About 39,600 heart stars at High and 63,800 at Ultra.
- A star's size is fixed in pixels: about 2.4 px, with a core of about 1 px.
- The density is fixed per tier.

**The problem.**
- The Heart view sits at 300 mm, where 1 mm is about 6.4 px. There the spacing between stars on
  screen is about 3 px.
- At the camera's closest, 90 mm, 1 mm is about 21 px. The heart covers 11 times the screen area and
  the spacing opens to about 10 px, so the surface breaks into sparse dots.
- The stars add their light, so the front wall, the back wall and everything inside overlap.

**The user's decisions (6 November 2026).**
- All four groups of fine structures:
  - the inner walls;
  - the valve apparatus;
  - the septum and the openings;
  - the surface vessels and fat.
- A depth cue, and a section that opens the heart on request.
- Structure names on hover only.
- Close-up stars built on demand, per tier: Low +0, Medium +60k, High +150k, Ultra +250k.

### 8.1 Close-up level of detail

The density law is in `HEART_LOD` and `heartDensity` in `src/body/heart-form.js`. `BODY_VS` applies
it per star.

- **The wanted density.** Each heart star computes its own scale from its view depth,
  q = `uPxMm`·`uDist`/depth, in px/mm at the 1,080-px reference. The wanted density is
  max(1, (q/q0)²), with q0 = 4.5 px/mm. That keeps the spacing of the stars on screen constant.
- **The close-up stars.** `generateHeartCloseUpChunks` in `src/body/generate.js` builds them.
  - They come from the same structures and shares as the body's heart.
  - They are tagged LOD 4 and shuffled.
  - They are built in ≤ 8 ms slices, the first time the camera nears the heart in Detailed. A tier
    change discards them.
  - Each star has a rank, taken from its seed. A star fades in once the filled share passes its
    rank, over a window of 0.08 in rank, so stars never pop in.
- **D_max.** It is 1 + (drawn close-up stars ÷ drawn heart stars): 3.5 at Medium, 4.8 at High, 4.9
  at Ultra. The renderer passes it in `uPulse.w`, which was unused; 1 means no close-up stars.
- **Energy.** Every heart star's flux is divided by the expected drawn density. That density
  integrates the fade window exactly, `rampInt` in the shader. So the heart's light does not change
  as stars are added.
- **Past D_max.** The stars grow as (want/D_max)^0.25, at most ×1.5. The point spread function
  conserves energy, so this changes no brightness.
- **Unchanged parts.** The size law of the other body stars stays as it was.

### 8.2 Fine anatomy

`HEART_FORM` and `heartEntries` hold it. About a fifth of the heart's stars belong to it. The other
parts' shares fall in proportion.

**Ventricles.**
- **Trabeculae carneae** (Ho 2009): strands on the endocardium, raised 0.6–2.2 mm into the cavity.
  They run mostly along the axis and branch once in a third of cases.
  - LV: 320 fine strands over the apical two thirds.
  - RV: 200 coarse strands over the free wall.
- **Septomarginal trabecula (moderator band)**, from the septum to the anterior papillary muscle.
- **Three false tendons** across the LV.
- **Papillary muscles with their heads:**
  - LV: anterolateral (2 heads) and posteromedial (3 heads);
  - RV: anterior, posterior and septal.

**Chordae tendineae.**
- Per head: 5 in the LV and 4 in the RV.
- Each trunk fans into 3 branches over its last 30 %.
- Primary chordae reach the free edge (0.15–0.35 of the ring radius). Secondary chordae reach the
  rough zone (0.45–0.65).
- Ten tertiary chordae run from the basal LV wall to the posterior mitral leaflet.

**Leaflets.**
- **Tricuspid:** anterior 150°, posterior 90°, septal 120° of the ring (Silver et al. 1971).
- **Mitral:** the anterior leaflet faces the aortic valve. The coaptation line is a curve behind
  the centre. The posterior leaflet has the clefts of the P1–P3 scallops.
- **Semilunar valves:** three cusps each. Each cusp has a nodule of Arantius at the middle of its
  free edge, and a lunula along both sides of the coaptation lines.

**Aortic and pulmonary roots.**
- The sinuses of Valsalva bulge ×1.3 of the ring radius above the cusps, up to the sinotubular
  junction 18 mm above the ring.
- The left and right coronary ostia open in their sinuses.
- The left main runs to the LAD and LCx, and the proximal RCA runs from its ostium.

**Right atrium.** See Wilcox et al. 2004 and Sweeney & Rosenquist 1979.
- **Crista terminalis:** a C-shaped ridge from the SVC to the IVC.
- **Pectinate muscles:** 14 ridges from the crista towards the auricle, and meridian ridges inside
  both auricles.
- **Fossa ovalis:** 18 × 14 mm, a thin floor recessed 1.2 mm, ringed by the limbus, which is widest
  above.
- **Coronary sinus ostium:** about 10 mm, with its rim and the Thebesian valve over its lower half.
- **Eustachian valve:** along the anterior lip of the IVC.
- **Tendon of Todaro:** from the Eustachian valve to the central fibrous body.
- The atrial wall leaves the fossa and the ostium to their own stars.

**Septum.** The membranous septum is a fibrous oval below the aortic valve.

**Conduction system.**
- **SA node:** a crescent along the sulcus terminalis.
- **Inferior nodal extensions:** the slow pathway, towards the coronary sinus ostium.
- **Left bundle branch:** a fan of 9 fascicles over the septal endocardium. Its flux is 1.1 × the
  organ flux, because it is a thin sheet.
- **Purkinje strands:** each has two twigs, so the network reads as a mesh.

**Vessels.**
- The vessels taper by 45 % from origin to end.
- New arteries: the second obtuse marginal, the posterolateral branch, the conus branch, the SA and
  AV nodal arteries, and four septal perforators inside the septum.
- New veins: the small cardiac vein, the posterior vein of the LV, two anterior cardiac veins, the
  oblique vein of the left atrium, and the coronary sinus to its ostium.

**Epicardial fat** (Iacobellis et al. 2005).
- Lobules along the atrioventricular and interventricular grooves, lying round their vessels.
- It is thickest at the base.
- It is pale yellow at 0.55 × the organ flux, so the vessels read through it.

**Pericardium.** A faint sac 4.5 mm outside the heart.
- Its brightness follows mix(0.12, 1, (1 − |n·v|)²), with n the normal of an envelope ellipsoid.
- It reads as an outline and never veils the heart.

**New part codes.** 16 trabecula, 17 pectinate, 18 fat, 19 pericardium, 20 atrial fibrous tissue.

### 8.3 Depth cue and focus

- **The depth cue.** It applies in Detailed only. Stars beyond t0 = −22 mm along the line of sight
  from the heart's centre dim as exp(−(t − t0)/λ):
  - λ = 30 mm for walls;
  - λ = 70 mm for the inner parts: valves, leaflets, chordae, the conduction system and fibrous
    tissue;
  - a gain of 1.25 keeps the front surface as bright as before.
- **The focus.** `uHeartK.w` is now continuous, 0–1, and eases over 0.3 s. It is 1 in the Heart
  view. In Detailed it rises as the camera comes within about 160–240 mm of the heart and looks at
  it.
- **The rest of the body.** It dims with the focus, to 0.18, and to 0.4 for nerves, cord and
  ganglia. Body stars 12–45 mm in front of the camera fade out, so close-ups are not crossed by skin
  and ribs.

### 8.4 Section

- **The plane.** It is fitted through the apex, both atrioventricular valves and both atrial
  centres, each within 9 mm of it: the four-chamber plane, `HEART_SECTION`.
- **Opening.** The C key, or the heart button in the simple HUD corner, opens the heart. The button
  shows only while the heart is in focus.
  - The half towards the camera goes. The plane sweeps in from 95 mm outside over 0.6 s, so the
    change is gradual and does not flash.
  - In the Heart view the camera also turns to face the cut.
  - Leaving the heart closes it.
  - The amount is in `uHeartV.w`, which was unused.
- **When open.**
  - Depth is measured behind the cut face, with a steeper λ: 14 mm for walls and 32 mm for inner
    parts. The chambers read as hollows.
  - Wall stars within 4 mm of the face are lifted ×1.5.
- **The cut face.** Stars spread through a volume leave a thin slice sparse, so a separate layer is
  added. It has 30k / 60k / 100k stars (Medium, High, Ultra), within 4 mm of the plane on either
  side, tagged LOD 5. It is drawn only while the heart is open, at 0.7 × flux.

### 8.5 Stars style

- The Stars style keeps its earlier look. It draws no fine anatomy (parts 16–20), no depth cue and
  no close-up stars.
- Its heart share is raised by the ratio of all heart stars to those of the earlier parts. It still
  draws 2,400 heart stars at High.
- The energy-conserving wave mean is taken over the stars each style draws: `HeartBeat.setStars`
  keeps two samples.

### 8.6 Hover names

- `src/heart-ui.js` reads the heart stars of the body buffer, which carry their structure id in the
  path-position slot.
- Under a still mouse, about 8 times a second, it weights the stars in a 8-px cone round the cursor
  ray as the shader draws them, with a bias to the front. The structure with the largest weight is
  named in a small tooltip.
- `LABEL_NAMES` holds 98 names. There are no numbers. It works with the mouse only.

### 8.6a Follow-up (7 November 2026)

At the user's request:
- **The opened heart.** The conduction system dims to 0.55 × as the section opens, so the walls lead.
  This is `PARAMS.heart.openConduction`.
- **Touch.** On touch screens, a long press of 550 ms names the structure under the finger. The name
  sits above the finger for 2.5 s.

The same close-up idea now covers the whole body; see `research/CLOSEUP.md`.

### 8.7 Budgets and measurements

- **Uniforms.** `BODY_VS` stays within its 110 slots: two unused components are reused, and the
  constants are compiled in.
- **Generation.** In Node, the close-up and the cut face take 0.25 s at High: 150,000 + 60,000
  stars. They are built in slices in the app.
- **Measured in the app** (Apple M4, High, 1,024 × 768), GPU time per frame:

  | View | With the close-up | Without it |
  |---|---|---|
  | Heart view | 2.35 ms | 1.85 ms |
  | 90 mm | 2.32 ms | 1.47 ms |

- **Photosensitivity.** Nothing new pulses:
  - the close-up and the section are static, or ramp over 0.3–0.6 s;
  - the wave stays energy-conserving.

### 8.8 Tests

`test/heart-detail.test.mjs` has 8 tests:
- every structure has stars and a name;
- the atrial landmarks;
- the section plane;
- the density law's energy conservation, by Monte Carlo over the ranks;
- the close-up and cut-face buffers;
- the shader hooks and the slot budget;
- the hover pick;
- the focus and section ramps.

`test/geometry-body.test.mjs` now allows heart parts up to 20. The full suite has 606 tests: 574
pass, 4 known arm64 golden failures, 28 todo. `tsc` is clean.

## Sources

- Hall J. E., Hall M. E. (2021). *Guyton and Hall Textbook of Medical Physiology*, 14th ed.,
  chapters 9–11 (cardiac cycle, conduction, ECG).
- Durrer D. et al. (1970). Total excitation of the isolated human heart. *Circulation* 41: 899–912.
- Fridericia L. S. (1920). Die Systolendauer im Elektrokardiogramm bei normalen Menschen und bei
  Herzkranken. *Acta Med Scand* 53: 469–486.
- Wiggers C. J. (1915). *Modern Aspects of the Circulation in Health and Disease.* Lea & Febiger.
- Masters W. H., Johnson V. E. (1966). *Human Sexual Response*; RESPONSE.md §4.1 for the envelope.
- Kudielka B. M. et al. (2004). Acute HPA axis responses, heart rate, and mood changes to
  psychosocial stress (TSST). *Psychoneuroendocrinology* 29: 983–992 (heart rate +10–25 bpm).
- Streeter D. D. et al. (1969). Fiber orientation in the canine left ventricle during diastole and
  systole. *Circulation Research* 24: 339–347.
- Silver M. D. et al. (1971). Morphology of the human tricuspid valve. *Circulation* 43: 333–348.
- Sweeney L. J., Rosenquist G. C. (1979). The normal anatomy of the atrial septum in the human
  heart. *American Heart Journal* 98: 194–199.
- Wilcox B. R., Cook A. C., Anderson R. H. (2004). *Surgical Anatomy of the Heart*, 3rd ed.
  Cambridge University Press (papillary muscles, the triangle of Koch, the sinuses of Valsalva).
- Ho S. Y. (2009). Anatomy and myoarchitecture of the left ventricular wall in normal and in
  disease. *European Journal of Echocardiography* 10: iii3–iii7.
- Iacobellis G. et al. (2005). Epicardial adipose tissue: anatomic, biomolecular and clinical
  relationships with the heart. *Nature Clinical Practice Cardiovascular Medicine* 2: 536–543.
