// The thief. WASD or arrow keys to move, Shift to sneak (slower, harder
// to spot), E to grab loot within reach. The thief faces the way it moves.
import { LOOT, THIEF } from './config.js';
import { distance, moveCircle } from './geometry.js';

export const INTERACT_RANGE = 46;

export function createThief() {
  return {
    x: THIEF.startX,
    y: THIEF.startY,
    facing: -Math.PI / 2, // starts looking up the hall, toward the vault
    sneaking: false,
    moving: false,
    hasDiamond: false,
    lootTaken: 0, // value of everything grabbed so far
    lootCount: 0,
  };
}

export function updateThief(thief, move, sneaking, dt) {
  thief.sneaking = sneaking;
  thief.moving = move.x !== 0 || move.y !== 0;
  if (!thief.moving) return;
  const speed = sneaking ? THIEF.sneakSpeed : THIEF.walkSpeed;
  const moved = moveCircle(thief.x, thief.y, THIEF.radius, move.x * speed * dt, move.y * speed * dt);
  thief.x = moved.x;
  thief.y = moved.y;
  thief.facing = Math.atan2(move.y, move.x);
}

// The loot item within grabbing range, if any (nearest one wins).
export function lootInReach(thief, loot) {
  let best = null;
  let bestDist = INTERACT_RANGE;
  for (const item of loot) {
    if (item.taken) continue;
    const d = distance(thief.x, thief.y, item.x, item.y);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}

// Grab the item in reach: returns it, or null when nothing is close by.
export function grabLoot(thief, loot) {
  const item = lootInReach(thief, loot);
  if (!item) return null;
  item.taken = true;
  thief.lootTaken += item.value;
  thief.lootCount += 1;
  if (item.kind === 'diamond') thief.hasDiamond = true;
  return item;
}

// Fresh loot for a new run (the layout in config.js is the template).
export function createLoot() {
  return LOOT.map((item) => ({ ...item, taken: false }));
}
