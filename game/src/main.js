// Gobble Run — boot and main loop. Fixed-step simulation (1/60 s) with
// render interpolation, so motion stays smooth at any refresh rate.
// `?shot=<name>&seed=7` stages a deterministic screenshot and sets
// window.__shotReady after two frames.
import * as THREE from 'three';
import { STEP, MAX_FRAME, TRACK_LENGTH } from './config.js';
import { World, STATE_TITLE, STATE_PLAY, STATE_PAUSE, STATE_END, EVENT_HIT, EVENT_CORN, EVENT_NEAR_MISS, EVENT_STAGE, EVENT_ESCAPED, EVENT_OVER, EVENT_OVEN_WARN, EVENT_OVEN_HOT } from './world.js';
import { createInput } from './input.js';
import { makeTextures } from './textures.js';
import { ProceduralAudio } from './audio.js';
import { buildTurkey } from './turkey.js';
import { buildFarmer, FARMER_CHASE, FARMER_SEARCH, FARMER_CORNER } from './farmer.js';
import { buildFarm } from './scene.js';
import { createHud } from './hud.js';
import { createCameraRig } from './render.js';
import { HandRolledComposer, PRESETS } from './post.js';
import { PooledParticles } from './particles.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 7) || 7;
const debug = params.get('debug') === '1';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 800);
camera.position.set(0, 4.2, 7.5);

const textures = makeTextures();
const farm = buildFarm(scene, textures);
const turkey = buildTurkey(textures);
scene.add(turkey.group);
const farmer = buildFarmer(textures);
scene.add(farmer.group);
const particles = new PooledParticles(scene);
const composer = new HandRolledComposer(renderer, 1280, 720);
composer.bindSun(farm.sun);
composer.setPreset('medium');
const rig = createCameraRig(camera);
const hud = createHud();
const audio = new ProceduralAudio();
const world = new World(seed);
const input = createInput(canvas);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  composer.setSize(Math.round(w * renderer.getPixelRatio()), Math.round(h * renderer.getPixelRatio()));
}
window.addEventListener('resize', resize);
resize();

// Quality auto-detect: few cores or little memory starts on Low.
try {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (cores <= 2 || mem <= 2) composer.setPreset('low');
  else if (cores >= 8 && mem >= 8 && (window.devicePixelRatio || 1) >= 2) composer.setPreset('high');
} catch {
  // Keep the default Medium preset.
}

let prevLane = 0;
let prevY = 0;
let prevDistance = 0;
let prevFarmerMode = 0;
let accumulator = 0;
let lastNow = performance.now();
let frameTimes = [];
let slowSince = null;
let presetLevel = composer.presetName === 'low' ? 0 : composer.presetName === 'high' ? 2 : 1;
const PRESET_ORDER = ['low', 'medium', 'high'];
let framesRendered = 0;

function applyEvents(events) {
  if (events & EVENT_HIT) {
    audio.hit();
    rig.addTrauma(0.7);
    composer.hitPulse();
    particles.burst(world.player.lane, 1.2, -world.distance, 0x8a5a30, 26, 4, 3);
    hud.toast('OUCH! -1 feather');
  }
  if (events & EVENT_CORN) {
    audio.pickup();
    particles.burst(world.player.lane, 1.2, -world.distance, 0xf2c230, 8, 2, 2);
  }
  if (events & EVENT_NEAR_MISS) {
    hud.toast(world.stage === 2 ? 'CLOSE! +100' : 'CLOSE! +50');
    audio.whoosh();
  }
  if (events & EVENT_STAGE) {
    const names = ['THE FARMYARD', 'THE BARN', 'THE KITCHEN — mind the oven!'];
    hud.banner(names[world.stage]);
    audio.sting();
  }
  if (events & EVENT_OVEN_WARN) {
    audio.ovenWarn();
    hud.toast('OVEN BLAST — MOVE!');
  }
  if (events & EVENT_OVEN_HOT) {
    audio.ovenBlast();
    rig.addTrauma(0.3);
    // Burst at the blast itself, not at Pip — he should have moved.
    const oven = world.entities.find((e) => e.active && e.kind === 'oven' && e.ovenPhase === 'hot');
    const bx = oven ? oven.lane : world.player.lane;
    const bz = oven ? oven.z : world.distance;
    particles.burst(bx, 1.5, -bz, 0xff7a1e, 30, 4, 4);
  }
  if (events & EVENT_ESCAPED) {
    audio.fanfare();
    particles.burst(world.player.lane, 2, -world.distance, 0xffd23e, 60, 6, 5);
    particles.burst(world.player.lane, 2, -world.distance, 0xffffff, 40, 6, 5);
  }
}

function syncVisuals(alpha) {
  const p = world.player;
  const lane = prevLane + (p.lane - prevLane) * alpha;
  const y = prevY + (p.y - prevY) * alpha;
  const dist = prevDistance + (world.distance - prevDistance) * alpha;
  turkey.group.position.set(lane, y, -dist);
  turkey.update(p.runPhase, p.speedNorm, p.y > 0.05 ? 1 : 0, p.dashT > 0 ? 1 : 0, Math.max(0, p.flare), p.steerLean);
  farmer.group.position.set(lane * 0.6, 0, -dist + world.gap);
  const mode = world.farmerMode === 1 ? FARMER_SEARCH : world.farmerMode === 2 ? FARMER_CORNER : FARMER_CHASE;
  farmer.update(1 / 60, p.speedNorm, mode, world.time);
  // CORNER sting fires once, on entering corner mode — the old
  // per-frame call while floor(time*4)%2===0 stacked ~6 stings per
  // sim-second (≈30/s at 60 fps) into a dissonant pile-up.
  if (world.farmerMode === 2 && prevFarmerMode !== 2) audio.sting();
  prevFarmerMode = world.farmerMode;
  farm.sync(world);
  rig.update(1 / 60, lane, y, dist, p.steerLean, p.dashT > 0, world.time);
}

function renderFrame(alpha) {
  syncVisuals(alpha);
  if (farm.update(1 / 60, world.distance, world.time)) {
    renderer.shadowMap.needsUpdate = true;
  }
  composer.render(scene, camera, world.time, 1 / 60);
  framesRendered += 1;
}

function stepWorld(actions) {
  prevLane = world.player.lane;
  prevY = world.player.y;
  prevDistance = world.distance;
  const events = world.step(actions, input.steer());
  applyEvents(events);
  if (world.state === STATE_END) hud.showEnd(world);
  if (world.state === STATE_PAUSE) hud.show('pause');
  return events;
}

function frame(now) {
  const dt = Math.min(MAX_FRAME, Math.max(0, (now - lastNow) / 1000));
  lastNow = now;
  frameTimes.push(dt * 1000);
  if (frameTimes.length > 240) frameTimes.shift();
  // Auto-degrade: sustained slow frames drop one preset level.
  const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  if (avg > 24 && presetLevel > 0) {
    if (slowSince === null) slowSince = now;
    else if (now - slowSince > 2000) {
      presetLevel -= 1;
      composer.setPreset(PRESET_ORDER[presetLevel]);
      frameTimes = [];
      slowSince = null;
    }
  } else {
    slowSince = null;
  }

  const actions = input.take();
  if (actions.mute) audio.setMuted(!audio.muted);
  if (world.state === STATE_TITLE) {
    if (actions.start) {
      audio.ensure();
      audio.startAmbience();
      audio.gobble();
      world.start();
      hud.show('play');
    }
    world.step(actions, 0);
  } else if (world.state === STATE_PLAY) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      stepWorld(actions);
      accumulator -= STEP;
      steps += 1;
      if (world.state !== STATE_PLAY) break;
    }
    if (steps === 5) accumulator = 0;
  } else if (world.state === STATE_PAUSE) {
    if (actions.pause || actions.restart) {
      if (actions.restart) {
        world.start();
        hud.show('play');
      } else {
        world.state = STATE_PLAY;
        hud.show('play');
      }
    }
  } else if (world.state === STATE_END) {
    if (actions.restart) {
      world.start();
      hud.show('play');
    }
  }

  hud.update(world, dt);
  particles.update(dt);
  renderFrame(accumulator / STEP);

  if (debug && framesRendered % 300 === 0) {
    const info = renderer.info.render;
    console.log(`[gobble] frames=${framesRendered} calls=${info.calls} tris=${info.triangles} avgMs=${avg.toFixed(1)} preset=${composer.presetName}`);
  }
  window.__frameStats = frameStats();
  requestAnimationFrame(frame);
}

function frameStats() {
  if (frameTimes.length === 0) return { mean: 0, p95: 0, n: 0, preset: composer.presetName };
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return { mean, p95, n: sorted.length, preset: composer.presetName, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
}

window.__game = { world, composer, renderer, scene, camera };
window.__frameStats = { mean: 0, p95: 0, n: 0, preset: composer.presetName };

// Buttons on the DOM screens.
document.getElementById('btn-start').addEventListener('click', () => input.press('start'));
document.getElementById('btn-restart').addEventListener('click', () => input.press('restart'));
document.getElementById('btn-resume').addEventListener('click', () => input.press('pause'));
document.getElementById('btn-pause-restart').addEventListener('click', () => input.press('restart'));
document.getElementById('btn-mute').addEventListener('click', () => input.press('mute'));
document.querySelectorAll('[data-quality]').forEach((btn) => {
  btn.addEventListener('click', () => {
    composer.setPreset(btn.dataset.quality);
    presetLevel = PRESET_ORDER.indexOf(btn.dataset.quality);
  });
});

if (shotName) {
  // Deterministic staging: simulate synchronously, then paint twice.
  hud.showTitle(world.best);
  const staged = stageShot(shotName, world);
  if (staged.screen === 'title') {
    hud.showTitle(0);
    turkey.group.position.set(0, 0, 0);
    camera.position.set(0.5, 2.2, 5.5);
    camera.lookAt(0, 1.2, -2);
  } else if (staged.screen === 'end') {
    hud.showEnd(world);
  } else {
    hud.show('play');
    if (staged.toast) hud.toast(staged.toast);
  }
  prevLane = world.player.lane;
  prevY = world.player.y;
  prevDistance = world.distance;
  hud.update(world, 0.016);
  // Snap the damped chase camera onto the player first: with only two
  // staged frames the 1-exp(-dt*6) easing would otherwise leave the
  // camera a hundred metres behind Pip.
  camera.position.set(world.player.lane * 0.55, 4.2 + world.player.y * 0.35, -world.distance + 7.5);
  camera.lookAt(world.player.lane * 0.8, 1.1 + world.player.y * 0.3, -world.distance - 12);
  renderFrame(1);
  renderFrame(1);
  if (staged.screen === 'title') {
    // Hero framing for the cover: low orbit in front of Pip. Pip and
    // Hodge flank the centred text column (Pip far left, Hodge far
    // right) so neither is covered by the story text or START button.
    // Positions are set on the groups directly for this one staged
    // frame; the real title screen is untouched.
    camera.position.set(0, 1.9, 5.2);
    camera.lookAt(0, 1.1, -3);
    turkey.group.position.set(-3.4, 0, -0.8);
    farmer.group.position.set(5.0, 0, -5.0);
    farmer.group.rotation.y = 0;
    composer.render(scene, camera, world.time, 1 / 60);
  }
  if (staged.screen === 'end') {
    // Victory framing: pull the camera back and up so the MAPLEWOOD EDGE
    // sign drops below the HUD strip (no more "1000 m" overlap), Pip
    // stands left of the RUN AGAIN button, and the stage label names the
    // gate instead of the kitchen. Staged frame only.
    camera.position.set(0, 5.0, -world.distance + 10);
    camera.lookAt(0, 2.0, -world.distance - 12);
    turkey.group.position.set(-3.0, 0, -world.distance);
    document.getElementById('hud-stage').textContent = 'MAPLEWOOD EDGE';
    composer.render(scene, camera, world.time, 1 / 60);
  }
  window.__shotReady = true;
} else {
  hud.showTitle(world.best);
  requestAnimationFrame(frame);
}
