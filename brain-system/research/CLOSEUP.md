# Close-up clarity of the body

The user reported that the body's systems, fibres and organs became blurry when the camera zoomed in
(7 November 2026). They asked for the organs and every system to look clearer and sharper close up.
The heart already had its own close-up (`HEART.md` §8). This note extends the idea to the whole body.

## 1. What was measured

The app ran on port 8770 at Ultra, with a 1,280 × 800 viewport and a device pixel ratio of 1.

**Density.**
- The body buffer holds 610,000 stars at Ultra, spread over the whole figure.
- A sphere 30 mm across in the abdomen held about 330 of them, 270 of which were vessel stars.
- Close to the camera, 1 mm covers 10–20 px, but the star count stays the same. A structure then
  breaks into sparse dots, which the eye reads as fog.

**Gaussian clouds.**
- A nerve is a bundle of jittered streamlines with a cross-section σ of 1–4 mm.
- Most organs are filled ellipsoids.
- At 100 mm a 3-mm nerve becomes a soft band more than 200 px wide, with no edge.

**Overlap.**
- The light of skin front and back, organs, vessels and nerves adds up. Close up, the layers in front
  of and behind the structure in view wash out its contrast.

**Resolution.**
- On a Retina screen the High tier renders at a device pixel ratio of 1.5, so 75 % of the screen's
  pixels. The browser then scales the image up, which softens one-pixel stars.
- The adaptive render scale can lower it further.

**Ruled out.**
- Bloom: switching it off changed the close-up hardly at all.
- The brain: its 400,000 stars are dense and evenly spread, and a close-up of it stays crisp. It is
  left as it is.

## 2. The user's decisions (7 November 2026)

- **The full focus region**: close-up stars for every body system round the point in view, built on
  demand: Medium +100k, High +200k, Ultra +300k.
- **Full resolution when close**: the device's own pixel ratio while the camera is near the body,
  if the GPU has room.
- **For the heart**:
  - the conduction system is quieter in the opened heart;
  - structure names also work on touch, with a long press.

## 3. The focus region

`generateFocusRegionChunks` in `src/body/generate.js` builds the close-up stars. It runs the body's
own generators in a region mode.

**What the region holds.**
- The region is a sphere round the camera's pivot.
- Every entry writes only its expected share of the sphere: the count it would write for the whole
  body × k, times the share of its distribution inside the sphere.
- The region therefore holds k × the body buffer's stars there, in the same mixture.

**How each kind of entry is sampled.**
- **Curves** (nerve and autonomic streams, roots, ribs, the earlier great vessels, the vascular tree
  and the capillary beds) sample their parameter only where the curve passes near the sphere. This
  uses `curveRegion` and `curveU`.
- **Other entries** are probed once per region with 192 samples, and their stars are rejected outside
  the sphere.
- **Custom samplers:**
  - the skin uses only the iso-surface cells near the sphere;
  - the cord uses only the arcs near the sphere;
  - the enteric mesh, the gut wall and the ileal immune speckle use only the gut-table rows near the
    sphere;
  - the blood haze is sampled uniformly in the sphere.
- **The heart** is left out; it has its own close-up.
- **Nerve streamlines** now come from a seeded stream per path. The region therefore draws the same
  fibres as the body buffer.

**Flux.** A class whose share estimate fell short or over has its stars' flux scaled, so each class
carries k × its light there. In Node, at k = 4, the counts per class come out at 3.4–5.5 × k.

**Speed.** One region takes 45–110 ms in Node, and it is sliced in the app.

**When `main.js` rebuilds it.**
- The camera is within 600 mm of its pivot.
- The pivot has held still for 0.25 s.
- The pivot has moved 45 % of the radius, or the wanted radius has left 0.6–1.6 of the built one.

**Radius, k and stars.**
- The radius is 0.9 × the distance, kept within 50–200 mm.
- k = min(6, cap ÷ the body's stars in the sphere).
- The stars are tagged LOD + 8 and shuffled.
- A new region fades in over 0.35 s.

**In `BODY_VS`.** It works as the heart's law (`HEART.md` §8.1) does:
- The wanted density is (q/q0)², with q0 = 2 px/mm.
- The close-up stars fade in by rank.
- The region's edge softens over its outer 30 %.
- Past D_max the stars grow, at most ×1.5.

**Light.** The law differs from the heart's in one respect.
- With full energy conservation, each star became faint. The close-up then read as a dim fog: denser,
  but no sharper.
- Each region star therefore gives back the drawn density to the power 0.25 (`PARAMS.focus.conserve`).
- So the body's surface brightness falls off far less as the camera nears it. The structures stay
  bright, and each one is drawn in many more fine stars.
- The change follows the zoom: it is continuous and driven by the user, and it never flashes.

**Uniforms.**
- The region's centre and radius, D_max, the fade-in weight and the slab's strength are in
  `uFocus[2]`.
- The two slots come from the rigid-joint uniforms, which drop from 20 to 16 segments. `rigidAt` uses
  0–13.
- `BODY_VS` now uses 104 of its 110 slots.

## 4. The focus slab

This applies in Detailed only, with a strength of 0 at 700 mm from the pivot rising to 1 at 300 mm.
d is the distance from the camera to the pivot.
- Body stars nearer than 0.35–0.75 d fade out.
- Those beyond 1.25 d dim, with a length of 0.8 d.

So skin and ribs in front of an organ, and the far side of the body behind it, no longer wash out
the structures at the pivot. The heart keeps its own depth cue.

## 5. Resolution

While the body is visible, the camera is within 600 mm of its pivot (off again past 750 mm) or the
Heart view is on, and the render scale is 1:
- the canvas takes the device's pixel ratio, up to 2;
- if the GPU then needs more than 10 ms a frame, it falls back to the tier's ratio for 5 s;
- it returns only below 5 ms.

## 6. Measured in the app

Ultra, 1,280 × 800:

| Close-up | Pivot | Body stars in the region | Region stars | D_max |
|---|---|---|---|---|
| Abdomen | 160 mm | 90,766 (sphere of 144 mm) | 302,805 | 4.3 |
| Neck | 140 mm | 65,842 | 297,452 | 5.5 |

- The region stars cost 0.65 ms of GPU time per frame on an M4 (3.08 ms against 2.41 ms).
- In the close-ups the vessels read as branching lines, the ganglia as clusters, and the cord, the
  roots and the nerves as fibre bundles.
- Before, they were a dim scatter.

## 7. Tests

`test/closeup.test.mjs` has 5 tests:
- for three regions (abdomen, neck and thigh):
  - every star lies inside the sphere;
  - there are no heart stars;
  - the LOD tag is set;
  - each class has k × its count and its light;
- the body build stays deterministic;
- the shader hooks stay within the slot budget, and the joint slots still cover the rigid segments.

`test/shaders.test.mjs` now expects `uJoint[32]`. The full suite has 611 tests: 579 pass, 4 known
arm64 golden failures, 28 todo. `tsc` is clean.
