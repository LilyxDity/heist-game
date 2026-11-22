// Keyboard and mouse. WASD or arrows to move, Shift to sneak, E to grab
// loot, Q for a smoke bomb, F for the EMP, P or Esc to pause, M to mute,
// R to retry. The mouse only clicks the on-screen buttons; the game never
// needs it to move.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_RESTART = 'restart';
export const ACTION_MUTE = 'mute';
export const ACTION_INTERACT = 'interact';
export const ACTION_SMOKE = 'smoke';
export const ACTION_EMP = 'emp';

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyR: ACTION_RESTART,
  KeyM: ACTION_MUTE,
  KeyE: ACTION_INTERACT,
  KeyQ: ACTION_SMOKE,
  KeyF: ACTION_EMP,
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // keys pressed since the last read (edge triggers)
  const clicks = []; // {x, y} in canvas pixels, since the last read
  let mouse = { x: 0, y: 0, inside: false };

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(event.code);
    keys.add(event.code);
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function toCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }
  function onClick(event) {
    clicks.push(toCanvas(event));
  }
  function onMove(event) {
    mouse = { ...toCanvas(event), inside: true };
  }
  function onLeave() {
    mouse = { x: 0, y: 0, inside: false };
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);

  return {
    // A unit move vector from the keys held down (zero when none are held).
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.sqrt(2);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    sneaking() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    // Actions pressed since the last call, each reported exactly once.
    takeActions() {
      const actions = [];
      for (const code of pressed) {
        const action = KEY_ACTIONS[code];
        if (action) actions.push(action);
      }
      pressed.clear();
      return actions;
    },
    // Clicks since the last call, each reported exactly once.
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
    mouse() {
      return mouse;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    },
  };
}
