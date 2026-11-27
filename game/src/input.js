// Gobble Run — input. Keyboard, mouse drag and DOM buttons all feed one
// small action object; the world consumes the queued one-shot actions each
// fixed step, so a key pressed between steps is never lost.
export function createInput(canvas) {
  const held = new Set();
  const queue = {
    jump: false,
    dash: false,
    hide: false,
    pause: false,
    restart: false,
    start: false,
    mute: false,
  };
  let steerKeys = 0;
  let dragSteer = null;
  let dragging = false;
  let dragStartX = 0;
  let dragStartSteer = 0;

  function press(action) {
    queue[action] = true;
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    const key = event.key;
    held.add(key);
    if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'W') {
      press('jump');
      event.preventDefault();
    } else if (key === 'Shift') {
      press('dash');
    } else if (key === 's' || key === 'S' || key === 'ArrowDown') {
      press('hide');
    } else if (key === 'p' || key === 'P' || key === 'Escape') {
      press('pause');
    } else if (key === 'r' || key === 'R') {
      press('restart');
    } else if (key === 'Enter') {
      press('start');
    } else if (key === 'm' || key === 'M') {
      press('mute');
    }
    steerKeys = (held.has('a') || held.has('A') || held.has('ArrowLeft') ? -1 : 0)
      + (held.has('d') || held.has('D') || held.has('ArrowRight') ? 1 : 0);
  }

  function onKeyUp(event) {
    held.delete(event.key);
    steerKeys = (held.has('a') || held.has('A') || held.has('ArrowLeft') ? -1 : 0)
      + (held.has('d') || held.has('D') || held.has('ArrowRight') ? 1 : 0);
  }

  function onPointerDown(event) {
    if (event.button === 2) {
      press('dash');
      return;
    }
    if (event.button !== 0) return;
    dragging = true;
    dragStartX = event.clientX;
    dragStartSteer = dragSteer === null ? 0 : dragSteer;
  }

  function onPointerMove(event) {
    if (!dragging) return;
    const width = canvas.clientWidth || 1;
    dragSteer = Math.max(-1, Math.min(1, dragStartSteer + ((event.clientX - dragStartX) / width) * 3));
  }

  function onPointerUp(event) {
    if (event.button === 0) {
      dragging = false;
      dragSteer = null;
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    // -1..1 steer intent for this frame; keys win over an idle drag.
    steer() {
      if (steerKeys !== 0) return steerKeys;
      return dragSteer === null ? 0 : dragSteer;
    },
    // Take and clear the one-shot actions queued since the last step.
    take() {
      const out = { ...queue };
      queue.jump = false;
      queue.dash = false;
      queue.hide = false;
      queue.pause = false;
      queue.restart = false;
      queue.start = false;
      queue.mute = false;
      return out;
    },
    press,
  };
}
