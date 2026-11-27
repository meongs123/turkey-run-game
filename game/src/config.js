// Gobble Run — tuning constants. One place for every number the game
// balances on, so a balance pass touches this file and nothing else.
export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;
export const TRACK_LENGTH = 1000;
export const TRACK_HALF_WIDTH = 4.5;
export const LANES = [-2.6, 0, 2.6];

export const STAGES = [
  { name: 'THE FARMYARD', from: 0, to: 300, banner: 'THE FARMYARD — run, Pip, run!' },
  { name: 'THE BARN', from: 300, to: 700, banner: 'THE BARN — mind the crates!' },
  { name: 'THE KITCHEN', from: 700, to: 1000, banner: 'THE KITCHEN — mind the oven!' },
];

export const PLAYER = {
  baseSpeed: 8,
  topSpeed: 14,
  steerSpeed: 9,
  jumpVelocity: 7.4,
  gravity: 21,
  coyote: 0.12,
  dashSpeed: 24,
  dashTime: 0.35,
  dashCooldown: 2.5,
  hideTime: 3,
  radius: 0.55,
};

export const FARMER = {
  startGap: 14,
  baseClose: 0.35,
  hitPenalty: 6,
  dashBonus: 4,
  cornBonus: 0.4,
  searchGap: 18,
  cornerGap: 6,
};

export const SCORE = {
  perMetre: 10,
  corn: 25,
  nearMiss: 50,
  stageBonus: [0, 100, 200],
  escapeBonus: 500,
};

export const SPAWN = {
  startInterval: 1.35,
  endInterval: 0.55,
  knifeFrom: 250,
  ovenFrom: 700,
  ahead: 70,
  behind: 12,
  // Second obstacle at the same z: 0.35 — always in a different lane, and
  // every spawn leaves at least one lane free at its z afterwards
  // (obstacle, double, knife and oven all check the same _freeLaneAt
  // helper, and the double/knife refuse to take the last free lane), so
  // at least one of the three lanes is open at every distance. The double
  // is additionally suppressed within 12 m of an active oven, and an oven
  // never takes a nearby double's only free lane, so the oven's ~12 m hot
  // window cannot turn the double's free lane into a burning lane (world.js).
  doubleChance: 0.35,
  cornChance: 0.85,
  cornMax: 4,
};

// Kitchen oven hazard: one lane at a time, telegraphed before it fires.
// warnRange is the distance at which the warning starts (≈1.2 s of travel
// at kitchen speed, never below the 0.8 s fairness floor); warnTime is the
// glow + HUD + audio telegraph, activeTime the burning window. The blast
// covers one lane only. Placement keeps every knife ±12 m clear of the
// oven's spawn z (any lane); its lane is picked around any double
// obstacle within 12 m, so the oven never takes the double's only free
// lane (world.js); no NEW knife spawns while it warns/burns. Corner
// mode is gap-driven and can still coincide with an oven warn.
// minGap/maxGap is the quiet time between blasts: 3–5 s, so the 300 m
// kitchen (~23 s) holds two or three ovens per run instead of one —
// and the second blast still lands before the finish line, where a
// 7–10 s gap pushed it past 1000 m and it could never warn.
export const OVEN = {
  warnTime: 1.0,
  activeTime: 0.8,
  minGap: 3,
  maxGap: 5,
  ahead: 48,
  warnRange: 16,
  halfWidth: 1.15,
  height: 1.5,
};

export const CAMERA = {
  offset: [0, 4.2, 7.5],
  fov: 55,
  dashFov: 62,
  damp: 6,
  shakeDecay: 2.2,
  shakeMax: 0.25,
};

export const POST = {
  bloomThreshold: 0.75,
  bloomStrength: 0.55,
  vignetteOffset: 0.28,
  vignetteDarkness: 0.55,
  caBase: 0.00035,
  caHit: 0.0012,
  grain: 0.03,
};

export function stageAt(distance) {
  if (distance < 300) return 0;
  if (distance < 700) return 1;
  return 2;
}

export function runSpeedAt(distance) {
  const t = Math.min(1, distance / TRACK_LENGTH);
  return PLAYER.baseSpeed + (PLAYER.topSpeed - PLAYER.baseSpeed) * t;
}

export function spawnIntervalAt(distance) {
  const t = Math.min(1, distance / TRACK_LENGTH);
  return SPAWN.startInterval + (SPAWN.endInterval - SPAWN.startInterval) * t;
}
