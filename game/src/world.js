// Gobble Run — the simulation. Fixed-step world: player motion, spawning,
// collisions, scoring, the farmer gap, stages and the hide/dash economy.
// Pure numbers in, events out; rendering never feeds back into it.
import {
  STEP, TRACK_LENGTH, TRACK_HALF_WIDTH, LANES, PLAYER, FARMER, SCORE,
  SPAWN, OVEN, stageAt, runSpeedAt, spawnIntervalAt,
} from './config.js';
import { makeRng } from './rng.js';

export const STATE_TITLE = 'title';
export const STATE_PLAY = 'play';
export const STATE_PAUSE = 'pause';
export const STATE_END = 'end';
export const EVENT_OVER = 1;
export const EVENT_HIT = 2;
export const EVENT_CORN = 4;
export const EVENT_NEAR_MISS = 8;
export const EVENT_STAGE = 16;
export const EVENT_ESCAPED = 32;
export const EVENT_OVEN_WARN = 64;
export const EVENT_OVEN_HOT = 128;

const OBSTACLE_KINDS = ['fence', 'hay', 'pumpkin', 'crate'];
const OBSTACLE_HEIGHT = { fence: 1.0, hay: 1.5, pumpkin: 0.9, crate: 1.2 };

export class World {
  constructor(seed = 7) {
    this.seed = seed;
    this.reset();
  }

  reset() {
    this.rng = makeRng(this.seed);
    this.state = STATE_TITLE;
    this.time = 0;
    this.distance = 0;
    this.score = 0;
    this.corn = 0;
    this.nearMiss = 0;
    this.lives = 3;
    this.gap = FARMER.startGap;
    this.farmerMode = 0; // 0 chase, 1 search, 2 corner
    this.searchTimer = 0;
    this.stage = 0;
    this.entities = [];
    this.spawnTimer = 1.2;
    this.knifeTimer = 2;
    this.ovenTimer = 5;
    this.player = {
      lane: 0, y: 0, vy: 0, jumping: false, coyote: 0,
      dashT: 0, dashCd: 0, hidden: 0, invuln: 0, flare: 0,
      runPhase: 0, steerLean: 0, speedNorm: 0,
    };
    this.endReason = null; // 'escaped' | 'caught'
    this.best = 0;
    try {
      this.best = Number(localStorage.getItem('gobble-run-best') || 0) || 0;
    } catch {
      this.best = 0;
    }
    this._spawnedCorn = 0;
  }

  start() {
    this.reset();
    this.state = STATE_PLAY;
  }

  speed() {
    return runSpeedAt(this.distance);
  }

  // One fixed step. `actions` is the consumed input object; `steer` -1..1.
  // Returns an event bitmask for sounds and HUD feedback.
  step(actions, steer) {
    let events = 0;
    if (this.state === STATE_TITLE) {
      this.time += STEP;
      this.player.runPhase += STEP * 5;
      return events;
    }
    if (this.state !== STATE_PLAY) return events;
    this.time += STEP;
    const p = this.player;

    if (actions.mute) this.mutedToggle = !this.mutedToggle;
    if (actions.pause) {
      this.state = STATE_PAUSE;
      return events;
    }

    const speed = this.speed();
    const dashing = p.dashT > 0;
    const moveSpeed = dashing ? PLAYER.dashSpeed : speed;
    p.speedNorm = (moveSpeed - PLAYER.baseSpeed) / (PLAYER.topSpeed - PLAYER.baseSpeed + 6);

    // Steering: smooth lane offset toward the intent.
    const targetLane = Math.max(-TRACK_HALF_WIDTH + 0.6, Math.min(TRACK_HALF_WIDTH - 0.6, p.lane + steer * PLAYER.steerSpeed * STEP));
    p.steerLean += (steer - p.steerLean) * Math.min(1, STEP * 10);
    p.lane = targetLane;
    p.runPhase += STEP * (6 + p.speedNorm * 9);

    // Dash.
    if (actions.dash && p.dashCd <= 0 && p.hidden <= 0) {
      p.dashT = PLAYER.dashTime;
      p.dashCd = PLAYER.dashCooldown;
      p.invuln = Math.max(p.invuln, PLAYER.dashTime);
      this.gap = Math.min(30, this.gap + FARMER.dashBonus);
    }
    if (p.dashT > 0) p.dashT -= STEP;
    if (p.dashCd > 0) p.dashCd -= STEP;
    if (p.invuln > 0) p.invuln -= STEP;
    if (p.flare > 0) p.flare -= STEP;

    // Hide in a haystack.
    if (actions.hide && p.hidden <= 0) {
      const nearHay = this.entities.some((e) => e.active && e.kind === 'hay' && Math.abs(e.z - this.distance) < 3 && Math.abs(e.lane - p.lane) < 1.2);
      if (nearHay) {
        p.hidden = PLAYER.hideTime;
        this.farmerMode = 1;
        this.searchTimer = 2.5;
        this.gap = FARMER.searchGap;
      }
    }
    if (p.hidden > 0) {
      p.hidden -= STEP;
      if (p.hidden <= 0 && this.farmerMode === 1) this.farmerMode = 0;
    }

    // Jump with coyote time, no double jump.
    if (p.y <= 0) p.coyote = PLAYER.coyote;
    else p.coyote -= STEP;
    if (actions.jump && (p.y <= 0 || p.coyote > 0) && p.hidden <= 0) {
      p.vy = PLAYER.jumpVelocity;
      p.jumping = true;
      p.coyote = 0;
    }
    if (p.y > 0 || p.vy > 0) {
      p.vy -= PLAYER.gravity * STEP;
      p.y += p.vy * STEP;
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
        p.jumping = false;
      }
    }

    // Advance.
    const prevDistance = this.distance;
    this.distance += moveSpeed * STEP;
    this.score += moveSpeed * STEP * SCORE.perMetre;

    // Stage changes.
    const newStage = stageAt(this.distance);
    if (newStage !== this.stage) {
      this.stage = newStage;
      this.score += SCORE.stageBonus[newStage];
      events |= EVENT_STAGE;
    }

    // Farmer gap.
    if (this.farmerMode === 1) {
      this.searchTimer -= STEP;
      if (this.searchTimer <= 0) this.farmerMode = 0;
    } else {
      const catchUp = 0.15 * this.stage;
      this.gap -= (FARMER.baseClose + catchUp - (dashing ? 1.2 : 0)) * STEP;
      if (this.gap < FARMER.cornerGap) this.farmerMode = 2;
      else if (this.farmerMode === 2) this.farmerMode = 0;
    }

    this._spawn();
    events |= this._ovens();
    events |= this._collide(prevDistance);
    this._prune();

    if (this.distance >= TRACK_LENGTH) {
      this.distance = TRACK_LENGTH;
      this.score += SCORE.escapeBonus;
      this._finish('escaped');
      events |= EVENT_ESCAPED | EVENT_OVER;
    } else if (this.gap <= 0 || this.lives <= 0) {
      this._finish('caught');
      events |= EVENT_OVER;
    }
    return events;
  }

  _finish(reason) {
    this.endReason = reason;
    this.state = STATE_END;
    const finalScore = Math.floor(this.score);
    if (finalScore > this.best) {
      this.best = finalScore;
      try {
        localStorage.setItem('gobble-run-best', String(finalScore));
      } catch {
        // In-memory best only.
      }
    }
  }

  // Lanes blocked by a solid hazard (obstacle, knife, oven) near z.
  // Anything that spawns consults this, so one lane is always open.
  _blockedLanesAt(z) {
    const blocked = [false, false, false];
    for (const e of this.entities) {
      if (!e.active || e.kind === 'corn') continue;
      if (Math.abs(e.z - z) < 2.5) {
        for (let i = 0; i < 3; i += 1) {
          if (Math.abs(e.lane - LANES[i]) < 1.1) blocked[i] = true;
        }
      }
    }
    return blocked;
  }

  _freeLaneAt(z, exclude = []) {
    const blocked = this._blockedLanesAt(z);
    const free = [];
    for (let i = 0; i < 3; i += 1) {
      if (!blocked[i] && !exclude.includes(i)) free.push(i);
    }
    return free;
  }

  // True while an oven is warning or burning: knives stay holstered for
  // the whole window, so an oven can never coincide with a knife — and
  // therefore never with knife + farmer-corner together. Deliberately
  // warn/hot only, not the idle approach: suppressing knives from the
  // moment an oven is placed 48 m out would gut the kitchen's knives
  // for ~4 s of every 7–10 s oven cycle.
  _ovenPending() {
    return this.entities.some((e) => e.active && e.kind === 'oven'
      && (e.ovenPhase === 'warn' || e.ovenPhase === 'hot'));
  }

  // Any oven placed ahead and not yet spent (idle included): only one
  // blast is ever in flight at a time.
  _ovenPlaced() {
    return this.entities.some((e) => e.active && e.kind === 'oven' && e.ovenPhase !== 'done');
  }

  _spawn() {
    this.spawnTimer -= STEP;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = spawnIntervalAt(this.distance);
      const stage = this.stage;
      const z = this.distance + SPAWN.ahead;
      const free = this._freeLaneAt(z);
      if (free.length > 0) {
        const laneIdx = free[this.rng.int(0, free.length - 1)];
        const kind = stage === 2
          ? this.rng.pick(['crate', 'fence', 'pumpkin'])
          : this.rng.pick(OBSTACLE_KINDS);
        const lane = LANES[laneIdx] + this.rng.range(-0.6, 0.6);
        this.entities.push({
          kind, z, lane, active: true, passed: false, y: 0, phase: this.rng.next() * 6,
        });
        // Second obstacle at the same z, different lane — a slalom, never
        // a wall: _freeLaneAt re-checked after the first one landed.
        if (this.rng.chance(SPAWN.doubleChance)) {
          const free2 = this._freeLaneAt(z);
          if (free2.length > 0) {
            const laneIdx2 = free2[this.rng.int(0, free2.length - 1)];
            const kind2 = stage === 2
              ? this.rng.pick(['crate', 'fence', 'pumpkin'])
              : this.rng.pick(OBSTACLE_KINDS);
            this.entities.push({
              kind: kind2, z, lane: LANES[laneIdx2] + this.rng.range(-0.6, 0.6),
              active: true, passed: false, y: 0, phase: this.rng.next() * 6,
            });
          }
        }
      }
      // Corn line: 1-4 cobs in a lane that is free at that z.
      if (this.rng.chance(SPAWN.cornChance)) {
        const cornZ = this.distance + SPAWN.ahead + 4;
        const freeCorn = this._freeLaneAt(cornZ);
        const cornLane = freeCorn.length > 0
          ? LANES[freeCorn[this.rng.int(0, freeCorn.length - 1)]]
          : this.rng.pick(LANES);
        const n = 1 + this.rng.int(0, SPAWN.cornMax - 1);
        for (let i = 0; i < n; i += 1) {
          this.entities.push({
            kind: 'corn', z: cornZ + i * 3, lane: cornLane, active: true, passed: false, y: 0, phase: 0,
          });
        }
      }
    }
    // Swinging knives appear from 250 m, faster in the kitchen — but never
    // while an oven is pending, and never into a lane already blocked.
    if (this.distance > SPAWN.knifeFrom && !this._ovenPending()) {
      this.knifeTimer -= STEP;
      if (this.knifeTimer <= 0) {
        this.knifeTimer = this.stage === 2 ? 2.2 : 3.2;
        const z = this.distance + SPAWN.ahead;
        const free = this._freeLaneAt(z);
        if (free.length > 0) {
          const laneIdx = free[this.rng.int(0, free.length - 1)];
          this.entities.push({
            kind: 'knife', z, lane: LANES[laneIdx], active: true, passed: false, y: 0, phase: this.rng.next() * 6,
          });
        } else {
          this.knifeTimer = 0.8;
        }
      }
    }
    // Kitchen oven: one blast at a time, one lane wide, placed ahead.
    // Held back while a knife sits within 35 m ahead, so the telegraph
    // never has to compete with a blade for the player's attention.
    if (this.distance > SPAWN.ovenFrom && !this._ovenPlaced()) {
      this.ovenTimer -= STEP;
      if (this.ovenTimer <= 0) {
        const knifeNear = this.entities.some((e) => e.active && e.kind === 'knife'
          && e.z > this.distance && e.z < this.distance + 35);
        if (knifeNear) {
          this.ovenTimer = 1.2;
        } else {
          this.ovenTimer = this.rng.range(OVEN.minGap, OVEN.maxGap);
          this.entities.push({
            kind: 'oven', z: this.distance + OVEN.ahead, lane: this.rng.pick(LANES),
            active: true, passed: false, y: 0, phase: this.rng.next() * 6,
            ovenPhase: 'idle', ovenT: 0,
          });
        }
      }
    }
  }

  // Oven telegraph state machine: idle (placed, faint marker) -> warn
  // (door flare + HUD + sound, >= 1.0 s) -> hot (burning, 0.8 s) -> done.
  // The warn starts when Pip is 16 m out, so even at a full dash the
  // player gets the better part of a second to change lanes.
  _ovens() {
    let events = 0;
    for (const e of this.entities) {
      if (!e.active || e.kind !== 'oven') continue;
      const dz = e.z - this.distance;
      if (e.ovenPhase === 'idle' && dz <= OVEN.warnRange) {
        e.ovenPhase = 'warn';
        e.ovenT = OVEN.warnTime;
        events |= EVENT_OVEN_WARN;
      } else if (e.ovenPhase === 'warn') {
        e.ovenT -= STEP;
        if (e.ovenT <= 0) {
          e.ovenPhase = 'hot';
          e.ovenT = OVEN.activeTime;
          events |= EVENT_OVEN_HOT;
        }
      } else if (e.ovenPhase === 'hot') {
        e.ovenT -= STEP;
        if (e.ovenT <= 0) {
          e.ovenPhase = 'done';
          e.active = false;
        }
      }
      if (dz < -2) e.active = false;
    }
    return events;
  }

  _collide(prevDistance) {
    let events = 0;
    const p = this.player;
    for (const e of this.entities) {
      if (!e.active) continue;
      const dz = e.z - this.distance;
      if (dz < -2) {
        e.active = false;
        continue;
      }
      if (e.kind === 'corn') {
        if (Math.abs(dz) < 1.0 && Math.abs(e.lane - p.lane) < 1.0 && p.y < 1.6 && p.hidden <= 0) {
          e.active = false;
          this.corn += 1;
          this.score += SCORE.corn;
          this.gap = Math.min(30, this.gap + FARMER.cornBonus);
          events |= EVENT_CORN;
        }
        continue;
      }
      if (e.kind === 'knife') {
        const bladeLow = Math.sin(this.time * 2.2 + e.phase) > -0.2;
        if (Math.abs(dz) < 0.9 && Math.abs(e.lane - p.lane) < 0.9 && bladeLow && p.invuln <= 0 && p.hidden <= 0) {
          e.active = false;
          events |= this._hit();
        } else if (!e.passed && dz < -1) {
          e.passed = true;
          if (Math.abs(e.lane - p.lane) < 1.6) events |= this._nearMiss();
        }
        continue;
      }
      if (e.kind === 'oven') {
        // Only the burning window hurts: the warning glow is safe, and a
        // jump cannot clear the flames (apex ~1.3 m < 1.5 m) — the dodge
        // is a lane change or a dash, which is what the telegraph is for.
        if (e.ovenPhase === 'hot' && Math.abs(dz) < 1.2 && Math.abs(e.lane - p.lane) < OVEN.halfWidth && p.y < OVEN.height && p.invuln <= 0 && p.hidden <= 0) {
          e.active = false;
          events |= this._hit();
        } else if (!e.passed && dz < -1) {
          e.passed = true;
          // Only a blast that actually fired counts as a near miss;
          // dashing through during the warning is a clean dodge.
          if (e.ovenPhase === 'hot' && Math.abs(e.lane - p.lane) < 1.7) events |= this._nearMiss();
        }
        continue;
      }
      // Solid obstacles.
      const height = OBSTACLE_HEIGHT[e.kind] || 1;
      if (Math.abs(dz) < 0.8 && Math.abs(e.lane - p.lane) < 0.95 && p.y < height && p.invuln <= 0 && p.hidden <= 0) {
        e.active = false;
        events |= this._hit();
      } else if (!e.passed && dz < -1) {
        e.passed = true;
        if (Math.abs(e.lane - p.lane) < 1.7) events |= this._nearMiss();
      }
    }
    return events;
  }

  _hit() {
    this.lives -= 1;
    this.gap = Math.max(0, this.gap - FARMER.hitPenalty);
    this.player.invuln = 1.0;
    this.player.flare = 0;
    return EVENT_HIT;
  }

  _nearMiss() {
    this.nearMiss += 1;
    const bonus = SCORE.nearMiss * (this.stage === 2 ? 2 : 1);
    this.score += bonus;
    this.player.flare = 0.6;
    return EVENT_NEAR_MISS;
  }

  _prune() {
    if (this.entities.length > 220) {
      this.entities = this.entities.filter((e) => e.active && e.z > this.distance - SPAWN.behind);
    }
  }
}
