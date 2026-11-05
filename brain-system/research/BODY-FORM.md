# Body form: analysis of the human shape for the skin field

The skin of the reference body (`src/body/geometry.js` `bodySDF`) was a mannequin of about twenty
primitives:
- eight elliptical torso sections;
- conical upper arms and thighs;
- a box hand;
- a straight foot slab.

Seen through the glass shell (5 November 2026), it read as a column: no chest or abdomen in profile,
no lumbar curve, no buttocks, no shoulder caps, straight cylindrical limbs. The user asked for the
human form to be analysed first and the body built from that analysis. This note is the analysis.
The build follows it in the same file, keeping the frame, the joints and the landmarks of
ANALYSIS.md §2.6 and §2.7.

## 1. Data and method

**Source.** ANSUR II, the 2012 anthropometric survey of US Army personnel (Gordon et al. 2014,
NATICK/TR-15/007). It covers 4,082 men and 1,986 women, measured by trained anthropometrists. The
values below are the 50th percentiles reported by the ANSUR II data explorer
(ergoassessment.cam/ansur-2-data-explorer). Stature is given as a mean and SD: men 175.6 ± 6.9 cm,
women 162.8 ± 6.4 cm.

**Sex-neutral reference at 1,760 mm.** The reference body is sex-neutral (A.1) with a stature of
1,760 mm (A.2). Each target below is the mean of the male and the female value, each first scaled to
1,760 mm by the stature ratio (× 1.002 for men, × 1.081 for women). Lengths and heights therefore
match a 50th-percentile man. Girths fall between the sexes.

**Frame.** The frame is the body frame of A.2: x to the right, y anterior, z superior, in mm. The
origin is near the anterior commissure, and the floor is at z = −1,672. A standing height h is at
z = h − 1,672.

## 2. Targets

| Measure (ANSUR II no.) | Men p50 | Women p50 | Neutral at 1,760 mm | Current model | Note |
|---|---|---|---|---|---|
| Acromion height (2) | 1,439 | 1,332 | z ≈ −231 | lm.acromion z −232 | kept |
| Waist height (90) | 1,055 | 977 | z ≈ −605 | narrowest section z −560 | waist moves down |
| Crotch height (27) | 845 | 780 | z ≈ −830 | torso floor z −835 | kept |
| Knee height (56) | 487 | 448 | z ≈ −1,183 | knee joint z −1,170 | kept |
| Biacromial breadth (8) | 415 | 365 | 405 (half 203) | acromion x 200 | kept |
| Bideltoid breadth (11) | 509 | 450 | 498 (half 249) | ≈ 470 (shoulder joint 185 + arm 50) | deltoid caps missing |
| Chest breadth (23) | 289 | 268 | 290 (half 145) | 330 (a 165) | too wide; lungs (x ±140) need ≈ ±155 |
| Chest depth (25) | 253 | 245 | 259 | 250 | kept |
| Chest circumference (24) | 1,056 | 940 | ≈ 1,037 | ≈ 1,000 | — |
| Waist breadth (86) | 325 | 298 | 324 (half 162) | 290 (a 145) | waist too narrow and too high |
| Waist depth (88) | 234 | 209 | 230 | 220 | — |
| Waist circumference (87) | 937 | 852 | ≈ 930 | ≈ 800 | — |
| Hip breadth, standing (50) | 344 | 353 | 363 (half 181) | 350 (a 175) | — |
| Buttock depth (17) | 246 | 231 | 248 | 250, but symmetric | no posterior bulge: buttocks missing |
| Buttock circumference (16) | 1,017 | 1,018 | ≈ 1,059 | ≈ 950 | — |
| Thigh circumference (78) | 624 | 613 | ≈ 644 (r ≈ 102) | cone r 95 at the hip joint | thigh starts too thin and tapers linearly |
| Calf circumference (21) | 392 | 372 | ≈ 397 (r ≈ 63) | r 62, centred | no posterior calf bulge |
| Ankle circumference (4) | 228 | 215 | ≈ 230 (r ≈ 37) | r 37 | kept |
| Neck circumference (62) | 395 | 328 | ≈ 375 (r ≈ 60) | 60 × 58 cylinder | kept; trapezius slope missing |
| Biceps circumference, flexed (9) | 357 | 304 | ≈ 343 (relaxed ≈ 310, r ≈ 49) | cone 50 → 40 | no biceps or triceps profile |
| Forearm circumference, flexed (38) | 310 | 263 | ≈ 297 (relaxed ≈ 270) | 45 × 40 | — |
| Wrist circumference (92) | 176 | 154 | ≈ 171 | 30 × 20 | kept |

The landmark heights and breadths of §2.6 already match ANSUR II within a few millimetres. What
the current skin lacks is form: the contours that the body's muscles, fat and skeleton give it.

## 3. Form, region by region (surface anatomy)

- **Neck and shoulder line.** The neck is inclined slightly forward. From its base, the trapezius
  slopes down and out to the acromion, so the shoulder line falls about 30 mm over 140 mm; there is
  no notch between neck and arm.
- **Shoulders.** The deltoid caps the joint and makes the widest point of the upper body (bideltoid
  ≈ 500 mm). Its fibres converge to the deltoid tuberosity, about a third of the way down the arm.
- **Chest.** The front is flattened and slightly convex, with the pectoral mass between the
  sternum and the axilla. The sternum lies on the midline: jugular notch y 60, sternal angle y 80,
  xiphoid y 92. Below the xiphoid the costal margin falls back slightly.
- **Back.** The upper back is broad and flat over the scapulae (y ≈ −140). It curves forward into
  the lumbar lordosis (y ≈ −115 at the waist) and backward again over the buttocks (y ≈ −160).
- **Waist and flank.** The narrowest section is just above the iliac crest. The flank widens
  smoothly over the crest into the hips.
- **Abdomen.** It is gently convex in front (y ≈ 95–100) and falls back to the pubic region
  (symphysis y 55 at z −757).
- **Pelvis and buttocks.** The hips are widest at the trochanters (half-breadth ≈ 180). The gluteal
  mass rounds the back and ends at the gluteal fold, where the thigh begins.
- **Thigh.** It is thickest just below the gluteal fold (r ≈ 100) and tapers non-linearly. The
  quadriceps rounds the front, the adductors fill the medial side high up, and the vastus medialis
  makes a bulge just above the knee on the inside.
- **Knee.** It is narrower than the thigh and calf, with the patella in front.
- **Leg.** The calf (gastrocnemius) bulges behind and is widest about 120 mm below the knee. The
  medial head reaches lower than the lateral. The shin is flat in front, and the leg tapers to the
  ankle.
- **Ankle and foot.** The malleoli project on both sides; the lateral one is lower. The heel is
  rounded behind, the medial arch is raised, and the foot spreads to the toes.
- **Arm.** The biceps rounds the front, the triceps the back. The arm narrows at the elbow, where
  the epicondyles make it wider side to side.
- **Forearm.** The flexor and extensor masses make it thickest about a quarter of the way down. It
  tapers to a flattened wrist.
- **Hand.** The palm is a slightly domed slab, thickest at the thenar eminence at the base of the
  thumb. The fingers taper.

## 4. Defects of the current skin

1. The torso sections are ellipses centred on one line. Front and back cannot differ, so the
   profile has no chest, abdomen, lordosis or buttocks.
2. With only eight sections and smoothstep joins, the waist sits at z −560 instead of about −605,
   and the upper torso is a block 330 mm wide.
3. The limbs are straight cones or linearly tapered ellipses: no muscle bellies, joints or calf.
4. There are no deltoids. A single cone stands in for the trapezius.
5. There are no gluteal masses; the crotch fillet only rounds the inner thighs.
6. The hand is a box and the foot a slab without an arch or malleoli.
7. Primitives are switched on by hard z and x guards. Where a guard cuts a term that is near the
   minimum, the field jumps, which showed as seams in the glass shell.

## 5. Modelling method

- **Torso.** Sections every 40–80 mm from the neck base to the crotch. Each section has a
  half-breadth `a`, a front `yf` and a back `yb`, and the line of greatest breadth at
  `ym = yb + 0.45·(yf − yb)`. The front and the back are separate half-superellipses. Their
  exponents of 2.1–2.6 give the flatter chest and back and the rounder waist. Parameters are
  interpolated with a Catmull–Rom spline over z, so the profile is smooth (C¹). The distance is the
  first-order estimate (r − 1)/|∇r|, scaled to stay conservative.
- **Muscle masses.** Ellipsoids smooth-unioned onto the trunk and limbs, with radii from §2 and §3:
  - deltoids, trapezius ridge, pectorals and scapular backs;
  - gluteal masses;
  - vastus medialis, patella, gastrocnemius and malleoli;
  - thenar eminence.
- **Limbs.** Profile keys along the joint axes of §2.6, with elliptical sections and a section-centre
  offset. The offset carries the calf behind the shin and the biceps and quadriceps in front.
  - Thigh: r ≈ 100 below the fold, r ≈ 60 at the knee.
  - Leg: calf r ≈ 63 at 120 mm below the knee, ankle r ≈ 37.
  - Upper arm: about 49 at the biceps, narrowing to the elbow.
  - Forearm: about 45 × 40 at a quarter of its length, flattened to 30 × 20 at the wrist.
- **Seamless guards.** A primitive is skipped only when a lower bound of its distance (to its
  bounding sphere) is at least `k` above the running minimum. In that case the smooth union equals
  the minimum exactly, so skipping it changes nothing and leaves no seam.
- **Unchanged in the first pass** (the head and neck follow in §8):
  - the head, the neck cylinder and the sense organs (§2.3);
  - the joints and landmarks (§2.6, §2.7);
  - the internal trunk field `sdTorso`, which places the gut and the regions;
  - every nerve route and site.

## 6. Constraints and acceptance

- The skin passes within 25 mm of every skin site (§2.7 snap), and the landmarks stay on or near
  it.
- The organs and the gut stay inside, with an abdominal wall ≥ 15 mm over the gut (§2.15). The
  lungs need a chest half-breadth of about 155 mm, slightly over the ANSUR II chest breadth.
- A.1: no genital, nipple or navel geometry. The pelvic exclusions and picking rules are unchanged
  (geometry-body tests).
- Measured on the new field, at the §2 levels: breadths, depths and circumferences within about 5 %
  of the neutral targets, except the chest breadth set by the lungs.
- The front, side and back silhouettes show the curves of §3. The glass shell has no seams or bumps.

## 7. Result (as built)

The form is built in `src/body/geometry.js` (`FORM`, `bodySDF`) and measured by
`test/body-form.test.mjs`.

| Measure | Built | Neutral target | Note |
|---|---|---|---|
| Bideltoid half-breadth | 249 | 249 | deltoid caps |
| Chest depth (z −330) | 250 | 259 | front y 107, back −143 |
| Waist (z −605): breadth × depth, girth | 302 × 212, 829 | 324 × 230, ≈ 930 | narrower; see below |
| Buttocks (z −790): depth | 240 | 248 | cleft kept at the midline |
| Upper thigh girth (z −880) | ≈ 600 | ≈ 620–644 | — |
| Calf girth (z −1,290) | 404 | ≈ 397 | — |
| Ankle girth (z −1,560) | 239 | ≈ 230 | — |
| Forearm girth (z −620) | 276 | ≈ 270 relaxed | — |
| Wrist girth (z −810) | 175 | ≈ 171 | — |
| Neck girth (z −150) | 401 | ≈ 375 | §2.3 neck cylinder |

Compromises, all forced by the fixed §2.6 joints and §2.8 organs:
- **Waist.** The elbows hang at x 195 (§2.6), so a waist half-breadth of 162 would fuse the forearms
  into the flank. The waist is 148, which keeps an 8-mm gap; that is within the ANSUR II range
  (5th percentile, men: 272 mm).
- **Chest.** The chest half-breadth of 150 is set by the lungs (x ±140) plus their wall. The upper
  arm rests against the chest wall, as it does in the anatomical position, with a crease between
  them.

**Continuity.** Near the skin, the field changes by less than 1.6 mm per mm everywhere. Each limb
segment runs on past its joint, so no two caps share a plane. The guards are seamless, and the
field costs ≈ 0.5 µs per evaluation.

**Unchanged.** Every skin site lies on the new skin (within 3 mm), and every geometry and somatic
test passes.

## 8. Head, face and neck (second pass, 5 November 2026)

Seen through the glass, the head of §2.3 was a set of ellipsoids:
- a blob face with round holes for the eyes;
- a stick nose and oval ears;
- a flat shelf under the jaw;
- a vertical neck cylinder with a ledge where it met the occiput.

The user asked for the head, face and body to read as a true human form, and for transparency to
stay as it is. The second pass changes the shape only; the textures, the glass and the stars are
unchanged.

### 8.1 Targets

Craniofacial norms: Farkas (1994) for soft-tissue landmarks, and ANSUR II head measures made neutral
at 1,760 mm as in §1.

| Measure | Neutral target | Built | Note |
|---|---|---|---|
| Head breadth (eu–eu) | ≈ 152 | 154.5 | the brain needs x ±66 plus the scalp and skull |
| Head length (g–op) | ≈ 202 | 203 | glabella y 91, opisthocranion y −112 |
| Vertex | z ≈ 89 | 91.5 | head height to the menton ≈ 250 |
| Bizygomatic breadth (zy–zy) | ≈ 140 | 140.5 | — |
| Bigonial breadth (go–go) | ≈ 104 | 105 | — |
| Face height (n–gn) | ≈ 118 | 119 | nasion z −40, menton z −159 |
| Nose width (al–al) | ≈ 33 | 33 | — |
| Eye fissure | ≈ 30 × 11 | 30 × 11 | almond, around the §2.3 corneal apex |
| Ear | length ≈ 62, width ≈ 34 | 62 × 34 | turned 25° forward, leaning 15° back |
| Neck girth (z −150) | ≈ 375 | within 10 % | — |

The §2.3 points are kept: nasion, pronasale, subnasale, the corneal apex, the eye, the meatus and the
mandibular plane. They agree with these norms; for example, the eyes lie at the head's vertical
midpoint.

### 8.2 Form

- **Cranium.** A vault, a narrower frontal mass (which gives the temples), a wide temporal base at
  ear level, and the occiput and nape over the cerebellum. The brain surface lies at least 7 mm
  under the skin; the old head left 2.4 mm at the occiput.
- **Face.** The upper face and a lower-face mass over the masseters, both cut by the mandibular
  plane, with:
  - the cheeks, the malar eminences and the supraorbital ridge;
  - the dental arches under the lips and the chin.
- **Eyes.** The orbit is recessed. The lids are a shell round the §2.3 eye, and they part in an
  almond fissure (`eyeFissure`) instead of the old 14-mm round hole. Skin stars keep 1 mm from it.
- **Nose.** A dorsum profile from the nasion to the tip, the lobule and the alae.
- **Mouth.** Upper and lower lips (mouth width ≈ 52) and a thin slab for the mouth line.
- **Ear.** An oval plate with a rolled helix, the concha around the meatus, the tragus and the
  lobule.
- **Neck.** No longer a cylinder: four extra torso sections from under the skull to the neck base,
  so the head, neck and trunk are one surface. The sternomastoids run from the mastoids to the
  sternum and give the V of the neck.

## 9. Shoulders, chest, limbs, hands and feet (second pass)

- **Shoulders.** A probe found no skin at the front of the shoulder, between the chest and the arm,
  down to the axilla. The pass adds:
  - the clavicles and a supraclavicular slope from the neck base to the shoulder;
  - the anterior and posterior axillary folds.

  The deltoid now joins the arm. Each arm meets the trunk with a radius of 18 mm over the shoulder,
  falling to 5 mm below the axilla (`FORM.armJoin`). The shoulder is one surface; the chest, flank
  and hip keep a crease.
- **Chest.** The pectoral ellipsoids read as two mounds. They are now a flat plate under a flatter
  chest front, which gives a neutral, broad chest.
- **Torso spline.** The rows are unevenly spaced, so the section spline is now Hermite in z. The
  uniform Catmull–Rom changed slope at each row and drew a crease line across the chest. Between the
  1-mm table rows the values are interpolated linearly, so the surface has no terraces.
- **Joints.** Two equal limb sections overlapping under a 15-mm smooth union stand about 4 mm proud,
  which made a band round the knee. Segments now:
  - join with 3 mm (`PARAMS.kJoint`);
  - run 30 % of their radius past the joint;
  - shrink smoothly there (`PROFILE_ROUND`).

  The patella and the vastus medialis are flatter. The thigh starts inside the pelvis, so the hip
  has no flat cap.
- **Hand.** The palm is two blended masses, carpus and metacarpus, about 80 wide at the knuckles,
  with thenar and hypothenar eminences. The digits have three tapering phalanges that bow slightly
  towards the palm. The bases are spread to a hand breadth of about 80, and the fingertips of §2.6
  are kept.
- **Foot.** It has:
  - a rounded heel;
  - a body that rises to the instep under the ankle and flattens to the ball (breadth ≈ 100);
  - a flat sole lifted under the medial arch;
  - five toes, the big toe medial.

  Foot length ≈ 267, from heel contact (78, −95) to the toe tip.
- **Field quality.** Near the skin, the field changes by less than 1.3 mm per mm on a 4-mm grid over
  the whole body. Ellipsoid carves (eye, orbit, concha, arch) use a bounded inside distance. On
  average, the field costs ≈ 0.4 µs per evaluation near the skin (old field: 0.35 µs).

**Display.** On 6 November 2026 the glass shells gave way to the Detailed star style: 2–3 × denser,
sharper body stars, with a brighter nervous system (ANALYSIS.md §13.4). The skin stars sample this
same field, so the form above is what they draw.

`test/body-form.test.mjs` checks:
- the head and face proportions, the eye fissure and the brain depth;
- the hand and foot measures and the free arch;
- that the knee and the elbow carry no band.

## Sources

- Gordon C. C. et al. (2014). *2012 Anthropometric Survey of U.S. Army Personnel: Methods and
  Summary Statistics.* NATICK/TR-15/007, US Army Natick Soldier RD&E Center.
  apps.dtic.mil/sti/tr/pdf/ADA611869.pdf
- ANSUR II data explorer (50th percentiles by sex): ergoassessment.cam/ansur-2-data-explorer
- Farkas L. G. (1994). *Anthropometry of the Head and Face*, 2nd ed. Raven Press. Soft-tissue
  craniofacial norms of North American adults.
