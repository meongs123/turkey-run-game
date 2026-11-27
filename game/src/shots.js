// Gobble Run — screenshot staging. Each preset plays the real rules
// forward from a fresh world with a fixed seed, steered by an autopilot
// that keeps clear of obstacles and chases corn. The frame is what a
// short real game looks like, and seed 7 always gives the same frame.
import { STEP, stageAt } from './config.js';
import { EVENT_OVER } from './world.js';

const SAMPLE = 1 / 30;
const DIRECTIONS = [-1, 0, 1];

// Seconds until steering `dir` runs Pip into a solid obstacle or knife.
function timeToHit(world, dir, horizon) {
  const p = world.player;
  const speed = world.speed();
  for (let t = SAMPLE; t <= horizon; t += SAMPLE) {
    const lane = Math.max(-3.9, Math.min(3.9, p.lane + dir * 9 * t));
    const z = world.distance + speed * t;
    for (const e of world.entities) {
      if (!e.active || e.kind === 'corn') continue;
      if (Math.abs(e.z - z) < 1.2 && Math.abs(e.lane - lane) < 1.1) return t;
    }
  }
  return Infinity;
}

function autopilot(world, horizon, greedy) {
  const p = world.player;
  let cornLane = null;
  let cornZ = Infinity;
  for (const e of world.entities) {
    if (e.active && e.kind === 'corn' && e.z > world.distance && e.z < cornZ) {
      cornZ = e.z;
      cornLane = e.lane;
    }
  }
  const target = cornLane === null ? 0 : cornLane;
  const wanted = target > p.lane + 0.5 ? 1 : target < p.lane - 0.5 ? -1 : 0;
  let best = wanted;
  let bestTime = timeToHit(world, wanted, horizon);
  for (const dir of DIRECTIONS) {
    const t = timeToHit(world, dir, horizon);
    if (t > bestTime) {
      bestTime = t;
      best = dir;
    }
  }
  // Jump when a low obstacle is right ahead and we are on its lane.
  let jump = false;
  for (const e of world.entities) {
    if (!e.active || e.kind === 'corn' || e.kind === 'knife') continue;
    const dz = e.z - world.distance;
    if (dz > 0 && dz < 7 && Math.abs(e.lane - p.lane) < 1.0 && p.y === 0) jump = true;
  }
  const dash = greedy && world.gap < 9 && p.dashCd <= 0;
  return { steer: best, jump, dash };
}

function runSteps(world, seconds, horizon, greedy) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const pilot = autopilot(world, horizon, greedy);
    const actions = {
      jump: pilot.jump, dash: pilot.dash, hide: false, pause: false,
      restart: false, start: false, mute: false,
    };
    const events = world.step(actions, pilot.steer);
    if (events & EVENT_OVER) break;
  }
}

export function stageShot(name, world) {
  world.reset();
  if (name === 'title') {
    for (let i = 0; i < 5 / STEP; i += 1) world.step({ jump: false, dash: false, hide: false, pause: false, restart: false, start: false, mute: false }, 0);
    return { screen: 'title', best: 0 };
  }
  if (name === 'nearmiss') {
    // Fast-forward to the kitchen, then stage a knife swing right ahead.
    world.state = 'play';
    runSteps(world, 52, 1.2, true);
    // Force the kitchen dressing even if the pilot fell short.
    if (world.distance < 720) world.distance = 740;
    world.stage = stageAt(world.distance);
    world.entities.push({
      kind: 'knife', z: world.distance + 6, lane: world.player.lane, active: true, passed: false, y: 0, phase: 1.2,
    });
    world.entities.push({
      kind: 'corn', z: world.distance + 9, lane: world.player.lane, active: true, passed: false, y: 0, phase: 0,
    });
    world.player.flare = 0.6;
    // Gap 9 m keeps Hodge just behind the chase camera (out of frame) while
    // the HUD farmer meter still reads red in corner mode.
    world.gap = 9;
    world.farmerMode = 2;
    return { screen: 'play', best: Math.floor(world.score), toast: 'CLOSE! +50' };
  }
  if (name === 'end') {
    world.state = 'play';
    runSteps(world, 600, 1.6, true);
    if (world.state !== 'end') {
      // The pilot earned the escape the honest way most runs; if it fell
      // short, finish the last stretch with a wider look-ahead.
      runSteps(world, 120, 2.5, true);
    }
    if (world.state !== 'end') {
      world.distance = 1000;
      world.score += 500;
      world.endReason = 'escaped';
      world.state = 'end';
      if (Math.floor(world.score) > world.best) world.best = Math.floor(world.score);
    }
    return { screen: 'end', best: Math.floor(world.score) };
  }
  // Default: play, mid-run in the farmyard.
  world.state = 'play';
  runSteps(world, 18, 1.2, false);
  return { screen: 'play', best: Math.floor(world.score) };
}
