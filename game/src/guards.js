// The guards. Each one walks a beat, watches a cone, and gets suspicious.
// A guard has four moods: patrol (walking the beat), suspicious (going to
// look at something), chase (running at the thief) and search (lost the
// thief, looking around). Suspicion is the meter between them.

import { GUARDS, SUSPICION, RULES, ROOM } from './config.js';
import { angleDiff, distance, lineOfSightClear, moveCircle, segmentCrossesCircle } from './geometry.js';

// Build one guard from its config entry. Guards start on the first point
// of their beat, facing down the lane.
export function makeGuard(def, index) {
  const start = def.waypoints[0];
  const next = def.waypoints[1];
  return {
    id: index,
    name: def.name,
    x: start[0],
    y: start[1],
    // Radians: 0 points east, PI/2 points south (down the screen).
    facing: Math.atan2(next[1] - start[1], next[0] - start[0]),
    mode: 'patrol',
    suspicion: 0,
    seen: false,
    waypoints: def.waypoints,
    wpIndex: 1,
    patrolSpeed: def.patrolSpeed,
    chaseSpeed: def.chaseSpeed,
    visionRange: def.visionRange,
    visionHalfAngle: def.visionHalfAngle,
    lastSeenX: start[0],
    lastSeenY: start[1],
    memoryLeft: 0,
    searchLeft: 0,
    pauseLeft: 0,
  };
}

export function makeGuards() {
  return GUARDS.map((def, i) => makeGuard(def, i));
}

// Can this guard see the thief right now? Range, cone, a clear line past
// the cases, and no smoke cloud sitting between the two of them.
export function guardCanSee(g, thief, walls, smoke) {
  const dist = distance(g.x, g.y, thief.x, thief.y);
  if (dist > g.visionRange) return false;
  const angle = Math.atan2(thief.y - g.y, thief.x - g.x);
  if (Math.abs(angleDiff(angle, g.facing)) > g.visionHalfAngle) return false;
  if (!lineOfSightClear(g.x, g.y, thief.x, thief.y, walls)) return false;
  for (const cloud of smoke) {
    if (segmentCrossesCircle(g.x, g.y, thief.x, thief.y, cloud.x, cloud.y, cloud.radius)) {
      return false;
    }
  }
  return true;
}

function walkToward(g, tx, ty, speed, dt, walls) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return 0;
  const step = Math.min(dist, speed * dt);
  const mx = (dx / dist) * step;
  const my = (dy / dist) * step;
  g.facing = Math.atan2(dy, dx);
  moveCircle(g, mx, my, 14, walls, ROOM);
  return dist - step;
}

// One fixed step of one guard. Returns 'caught' when the guard lays a hand
// on the thief, 'chase' the first step a chase begins, and null otherwise.
export function updateGuard(g, dt, ctx) {
  const { thief, walls, smoke } = ctx;

  const sees = guardCanSee(g, thief, walls, smoke);
  g.seen = sees;

  if (sees) {
    const dist = distance(g.x, g.y, thief.x, thief.y);
    const closeness = 1 - dist / g.visionRange;
    let rate = SUSPICION.baseRate + SUSPICION.closeBonus * closeness;
    if (thief.sneaking) rate *= SUSPICION.sneakFactor;
    g.suspicion = Math.min(SUSPICION.chaseAt, g.suspicion + rate * dt);
    g.lastSeenX = thief.x;
    g.lastSeenY = thief.y;
    g.memoryLeft = SUSPICION.memorySeconds;
    if (g.suspicion >= SUSPICION.chaseAt && g.mode !== 'chase') {
      g.mode = 'chase';
      return 'chase';
    }
    if (g.suspicion >= SUSPICION.investigateAt && g.mode === 'patrol') {
      g.mode = 'suspicious';
    }
  } else {
    g.suspicion = Math.max(0, g.suspicion - SUSPICION.decayRate * dt);
    if (g.mode === 'chase') {
      g.memoryLeft -= dt;
      if (g.memoryLeft <= 0) {
        g.mode = 'search';
        g.searchLeft = 3;
      }
    }
  }

  if (g.mode === 'patrol') {
    if (g.pauseLeft > 0) {
      g.pauseLeft -= dt;
      return null;
    }
    const target = g.waypoints[g.wpIndex];
    const remaining = walkToward(g, target[0], target[1], g.patrolSpeed, dt, walls);
    if (remaining <= 2) {
      // Turn around at the end of the beat and pause a beat to look around.
      g.wpIndex = g.wpIndex + 1 >= g.waypoints.length ? 0 : g.wpIndex + 1;
      g.pauseLeft = 0.7;
    }
    return null;
  }

  if (g.mode === 'suspicious') {
    const remaining = walkToward(g, g.lastSeenX, g.lastSeenY, g.patrolSpeed * 1.3, dt, walls);
    if (remaining <= 10) {
      g.mode = 'search';
      g.searchLeft = 2.5;
    }
    return null;
  }

  if (g.mode === 'chase') {
    const tx = g.seen ? thief.x : g.lastSeenX;
    const ty = g.seen ? thief.y : g.lastSeenY;
    walkToward(g, tx, ty, g.chaseSpeed, dt, walls);
    if (distance(g.x, g.y, thief.x, thief.y) <= RULES.catchDistance) {
      return 'caught';
    }
    return null;
  }

  // search: stand still and sweep the room, then give up and go back.
  g.searchLeft -= dt;
  g.facing += 1.7 * dt;
  if (g.searchLeft <= 0) {
    g.mode = 'patrol';
    g.suspicion = Math.min(g.suspicion, SUSPICION.investigateAt - 1);
  }
  return null;
}
