// Keyboard input. Two parts: the keys currently held down (for movement)
// and a persistent edge queue of single presses (for E, Q, F, Enter, R).
//
// The queue matters: the game steps on a fixed clock, and a key pressed on
// a frame where no step runs must not vanish. Presses sit in the queue
// until the step loop drains them, however many frames that takes.

export const MOVE_KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

const SNEAK_KEYS = ['ShiftLeft', 'ShiftRight'];

// Keys the page should swallow instead of scrolling or tabbing away.
const SWALLOW = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
]);

export function createInput() {
  const held = new Set();
  const edgeQueue = [];

  function onKeyDown(event) {
    if (SWALLOW.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    edgeQueue.push(event.code);
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onBlur() {
    held.clear();
  }

  return {
    attach(target) {
      target.addEventListener('keydown', onKeyDown);
      target.addEventListener('keyup', onKeyUp);
      target.addEventListener('blur', onBlur);
    },

    detach(target) {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },

    isHeld(code) {
      return held.has(code);
    },

    // The held movement direction as a unit-ish vector, or (0, 0).
    moveVector() {
      let x = 0;
      let y = 0;
      if (MOVE_KEYS.left.some((c) => held.has(c))) x -= 1;
      if (MOVE_KEYS.right.some((c) => held.has(c))) x += 1;
      if (MOVE_KEYS.up.some((c) => held.has(c))) y -= 1;
      if (MOVE_KEYS.down.some((c) => held.has(c))) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.SQRT2;
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },

    isSneaking() {
      return SNEAK_KEYS.some((c) => held.has(c));
    },

    // Take every queued press out of the queue, in order, and hand them
    // back. The queue stays alive between frames: nothing is ever dropped
    // just because a frame had no fixed step in it.
    drainEdges() {
      if (edgeQueue.length === 0) return [];
      return edgeQueue.splice(0, edgeQueue.length);
    },

    pendingEdges() {
      return edgeQueue.length;
    },
  };
}
