# Gobble Run — A Turkey's Thanksgiving Escape

[![make.fun](https://make.fun/badge/turkey-run-game-01.svg)](https://make.fun/bounty/turkey-run-game-01?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)
[![rank](https://make.fun/badge/turkey-run-game-01/meongs123/turkey-run-game/rank.svg)](https://make.fun/bounty/turkey-run-game-01?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)
[![reward](https://make.fun/badge/turkey-run-game-01/meongs123/turkey-run-game/reward.svg)](https://make.fun/bounty/turkey-run-game-01?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)

Entry for the [make.fun](https://make.fun/bounty/turkey-run-game-01?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01) bounty **"turkey-run-game-01"** (`turkey-run-game-01`).

Pip the turkey is on the run from Farmer Hodge on Thanksgiving morning.
Dodge fences, hay bales, pumpkins and crates, slip past the swinging
carving knives in the kitchen, hide in the haystacks to lose the farmer —
and reach Maplewood Edge, 1000 m away, before dinner. 3 stages (Farmyard →
Barn → Kitchen), 3 feather-lives, dash with stamina, corn +25, near miss
+50 (×2 in the Kitchen), escape bonus +500. Farmer Hodge chases in three
states: chase, search, and corner — when the gap closes under 6 m he
sprints and the screen edge burns red.

## How to play

- **A / D** or **← / →** steer · mouse drag steers too
- **Space / W / ↑** jump (coyote time 0.12 s, no double jump)
- **Shift** or right click — dash (burst + 0.35 s invulnerable, 2.5 s cooldown)
- **S / ↓** near a haystack — hide for 3 s, the farmer loses the trail
- **P / Esc** pause · **R** restart · **Enter** start · **M** mute

## Play it

Serve `game/` with any static server and open `game/index.html` in a desktop browser (no network needed):

```
node serve.ts
# then open http://localhost:8080
```

Screenshots are deterministic staged renders of the game itself:
`?shot=title|play|nearmiss|end&seed=7`.

## Tech

Three.js vendored locally (`game/vendor/three.module.js` + `three.core.js`),
100% procedural — no model, texture, or audio files. Textures are runtime
canvas paintings, audio is WebAudio synthesis, the world is seeded so every
`?shot=` preset reproduces the same frame. Fixed timestep 1/60 s with render
interpolation, damped camera (1-exp(-dt*6)), FOV kick on dash, decaying
trauma shake, object pooling, InstancedMesh dressing, zero allocation in the
hot path. Hand-rolled post chain: HalfFloat render target → half-res bloom
(threshold 0.75, strength 0.55) → grade pass (ACES approx + sRGB + vignette +
radial chromatic aberration + grain) → FXAA. Quality presets Low / Medium /
High with auto-detect and auto-degrade.
