# Anger Galaxy

The dynamics of human anger, modeled through a realistic spiral galaxy:
stars move according to differential rotation and (kinematic) density-wave theory,
while anger is mapped onto real galactic phenomena — starburst, the shock-wave ring,
supernovae and the superwind. Scientific basis: [research/ANALYSIS.md](research/ANALYSIS.md).

## Getting started
Double-click `start.bat` — it starts a local server and opens
`http://127.0.0.1:8765/` in the browser (requires Python). Or:

```bash
python -m http.server 8765 --bind 127.0.0.1
```

Requires WebGL2 (Chrome, Edge, Firefox). To pick the quality manually: `?quality=low|medium|high|ultra`.

## Controls
Mouse — rotate, wheel — zoom, `G` — provoke, `Space` — pause / resume, `S` — camera shake on/off,
`H` — hide the HUD, `F` — fullscreen, `I` — About, `Esc` — close About.
In "Manual" mode you set the anger level with the slider in the Settings dropdown.

## Interface
- Top left, always visible: the title, the current phase and the anger meter.
- **Live data** (directly below, collapsed by default): the phase description,
  a 60-second anger sparkline, heart rate, rotation speed, star formation, arm pitch and time scale.
- **Performance** (top right, collapsed by default): a live FPS badge stays visible while collapsed;
  the body shows FPS and GPU time, quality tier, star count, render resolution and GPU name.
- Bottom bar: **Provoke** and **Pause** are always visible, next to **Settings**
  (collapsed by default, opens upward) with the Auto cycle / Manual switch, the anger slider,
  the Camera shake switch, the quality select and the About button.
- Each dropdown remembers whether it was left open, and the Camera shake choice is remembered too
  (it starts off when the system asks for reduced motion).

## Structure
| File | Purpose |
|---|---|
| `src/galaxy-model.js` | Rotation curve, kinematic density-wave geometry |
| `src/astro.js` | Planck + CIE colors, IMF, galaxy components, background sky |
| `src/shaders.js` | Orbits on the GPU, PSF, dust extinction, bloom, ACES |
| `src/renderer.js` | HDR render order and bloom chain |
| `src/anger.js` | Anger arousal cycle and anger → galaxy parameters |
| `src/events.js` | Supernovae and the shock-wave ring |
| `src/performance.js` | Hardware detection and adaptive quality |
| `src/camera.js`, `src/ui.js`, `src/main.js` | Camera, HUD, animation loop |

## Performance
Orbits are computed entirely on the GPU. The initial quality is chosen from the GPU name,
CPU thread count, memory and device type; an adaptive controller then tunes the render
scale and tier based on GPU time and FPS. GPU time on a GTX 1060 (1024×768):
Low 0.4 ms · Medium 0.7 ms · High 1.1 ms · Ultra (400,000 stars) 1.7 ms.

## Graphify
Anger Galaxy lives in `anger-galaxy/` inside the `galaxy` workspace. The workspace knowledge graph
(this project's code, research and raw sources) is in `../graphify-out/` (`graph.html` — interactive view).
After code changes, run from the workspace root: `graphify update .`
