// Gobble Run — HUD and screens. Plain DOM over the canvas: sharp text at
// any size, untouched by the 3D post chain. All updates are text writes
// and class toggles, never layout rebuilds.
import { SCORE } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const scoreEl = el('hud-score');
  const bestEl = el('hud-best');
  const distEl = el('hud-distance');
  const distFill = el('hud-distance-fill');
  const stageEl = el('hud-stage');
  const livesEl = el('hud-lives');
  const staminaFill = el('hud-stamina-fill');
  const farmerEl = el('hud-farmer');
  const farmerFill = el('hud-farmer-fill');
  const bannerEl = el('hud-banner');
  const toastEl = el('hud-toast');
  const screens = {
    title: el('screen-title'),
    pause: el('screen-pause'),
    end: el('screen-end'),
  };
  const endTitle = el('end-title');
  const endText = el('end-text');
  const endScore = el('end-score');
  const endStats = el('end-stats');
  const titleBest = el('title-best');
  let bannerTimer = 0;
  let toastTimer = 0;
  let toastPriority = 0;

  function show(name) {
    for (const key of Object.keys(screens)) {
      screens[key].classList.toggle('hidden', key !== name);
    }
    document.getElementById('hud').classList.toggle('hidden', name === 'title');
  }

  function showTitle(best) {
    show('title');
    titleBest.textContent = best > 0 ? `BEST ${best}` : 'BEST —';
  }

  function showEnd(world) {
    show('end');
    const escaped = world.endReason === 'escaped';
    endTitle.textContent = escaped ? 'ESCAPED!' : 'CAUGHT!';
    endTitle.classList.toggle('escaped', escaped);
    endText.textContent = escaped
      ? 'Pip made it to Maplewood Edge. Thanksgiving is cancelled — for the turkey, anyway.'
      : 'Sunday dinner… Farmer Hodge finally got his turkey.';
    endScore.textContent = `SCORE ${Math.floor(world.score)}  ·  BEST ${world.best}`;
    const seconds = Math.floor(world.time);
    endStats.textContent = `Distance ${Math.floor(world.distance)} m  ·  Bonus 🦃 ${world.corn} × ${SCORE.corn} = ${world.corn * SCORE.corn}  ·  Near misses ${world.nearMiss}  ·  Time ${seconds}s`;
  }

  function banner(text) {
    bannerEl.textContent = text;
    bannerEl.classList.remove('hidden');
    bannerTimer = 1.5;
  }

  // Single-slot toast with priority (F-D): the oven warn is priority 1
  // and lives 1.1 s — longer than the 1.0 s warn — so a routine
  // "CLOSE! +50" near-miss toast cannot overwrite "OVEN BLAST — MOVE!"
  // mid-warn. Priority resets when the toast expires, so later toasts
  // show normally.
  function toast(text, priority = 0) {
    if (priority < toastPriority && toastTimer > 0) return;
    toastPriority = priority;
    toastEl.textContent = text;
    toastEl.classList.remove('hidden');
    toastTimer = priority > 0 ? 1.1 : 0.9;
  }

  function update(world, dt) {
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) bannerEl.classList.add('hidden');
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) {
        toastEl.classList.add('hidden');
        toastPriority = 0;
      }
    }
    scoreEl.textContent = String(Math.floor(world.score)).padStart(6, '0');
    bestEl.textContent = `BEST ${world.best}`;
    distEl.textContent = `${Math.floor(world.distance)} m`;
    distFill.style.width = `${Math.min(100, (world.distance / 1000) * 100)}%`;
    stageEl.textContent = ['FARMYARD', 'BARN', 'KITCHEN'][world.stage];
    const feathers = '🪶'.repeat(Math.max(0, world.lives)) + '·'.repeat(Math.max(0, 3 - world.lives));
    livesEl.textContent = feathers;
    livesEl.classList.toggle('hurt', world.lives < 3);
    const stamina = 1 - Math.max(0, world.player.dashCd) / 2.5;
    staminaFill.style.width = `${Math.round(stamina * 100)}%`;
    const gap = Math.max(0, world.gap);
    farmerEl.textContent = world.farmerMode === 1 ? 'FARMER: SEARCHING…' : `FARMER ${gap.toFixed(0)} m`;
    farmerFill.style.width = `${Math.min(100, (gap / 30) * 100)}%`;
    farmerFill.classList.toggle('danger', world.farmerMode === 2);
  }

  return { show, showTitle, showEnd, banner, toast, update };
}
