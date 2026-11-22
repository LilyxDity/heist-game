// The thief. One hooded figure, quick on her feet, quieter when she
// sneaks. She lifts loot with E, throws smoke with Q and fires an EMP
// with F — the last two cost score, so they are decisions, not reflexes.

import { THIEF, THIEF_SPAWN, GADGETS, ROOM, WALLS } from './config.js';
import { distance, moveCircle } from './geometry.js';

// A fresh thief at the spawn corner, pockets empty.
export function makeThief() {
  return {
    x: THIEF_SPAWN.x,
    y: THIEF_SPAWN.y,
    radius: THIEF.radius,
    // Radians: -PI/2 faces up the screen, towards the vault.
    facing: -Math.PI / 2,
    sneaking: false,
    moving: false,
    lootTaken: 0,
    lootCount: 0,
    hasDiamond: false,
  };
}

// One fixed step: read the held keys, walk or sneak, slide along the cases.
export function updateThief(thief, dt, input) {
  const move = input.moveVector();
  thief.sneaking = input.isSneaking();
  thief.moving = move.x !== 0 || move.y !== 0;
  if (!thief.moving) return;
  const speed = thief.sneaking ? THIEF.sneakSpeed : THIEF.walkSpeed;
  thief.facing = Math.atan2(move.y, move.x);
  moveCircle(thief, move.x * speed * dt, move.y * speed * dt, thief.radius, WALLS, ROOM);
}

// Lift the nearest loot within reach. Returns the item taken, or null when
// nothing is close enough to grab.
export function tryGrab(state) {
  const thief = state.thief;
  let best = null;
  let bestDist = THIEF.grabReach;
  for (const item of state.loot) {
    if (item.taken) continue;
    const d = distance(thief.x, thief.y, item.x, item.y);
    if (d <= bestDist) {
      best = item;
      bestDist = d;
    }
  }
  if (!best) return null;
  best.taken = true;
  thief.lootTaken += best.value;
  thief.lootCount += 1;
  if (best.kind === 'diamond') thief.hasDiamond = true;
  return best;
}

// Throw a smoke bomb at the thief's feet. A cloud blooms, and nobody can
// see through it while it lasts. Returns true when a bomb was spent.
export function useSmoke(state) {
  if (state.smokeLeft <= 0) return false;
  state.smokeLeft -= 1;
  state.gadgetCost += GADGETS.smoke.cost;
  state.smoke.push({
    x: state.thief.x,
    y: state.thief.y,
    radius: GADGETS.smoke.radius,
    left: GADGETS.smoke.lifetime,
  });
  return true;
}

// Fire the EMP. Every camera goes dark for a few seconds. Returns true
// when a charge was spent.
export function useEmp(state) {
  if (state.empLeftCount <= 0) return false;
  state.empLeftCount -= 1;
  state.gadgetCost += GADGETS.emp.cost;
  for (const cam of state.cameras) {
    cam.disabledLeft = GADGETS.emp.disableSeconds;
    cam.seen = false;
  }
  return true;
}
