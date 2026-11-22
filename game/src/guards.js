// The guards. Each one walks its patrol route, pauses at every waypoint
// to look around, and watches a vision cone ahead of it. A thief inside
// the cone builds suspicion; a full suspicion bar turns the guard into a
// chaser, and a chaser that reaches the thief ends the heist. Lose sight
// for a while and the guard gives up and walks back to its route.
import { GUARD, GUARD_DEFS } from './config.js';
import { angleDelta, distance, inVisionCone, moveCircle } from './geometry.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_CHASE = 'chase';
export const GUARD_RETURN = 'return';

const PAUSE_SECONDS = 1.4; // how long a guard looks around at each waypoint
const LOOK_AROUND = 0.9; // radians per second while pausing

export function createGuards() {
  return GUARD_DEFS.map((def, index) => {
    const [startX, startY] = def.waypoints[def.start];
    const next = def.waypoints[(def.start + 1) % def.waypoints.length];
    return {
      name: def.name,
      x: startX,
      y: startY,
      facing: Math.atan2(next[1] - startY, next[0] - startX),
      waypoints: def.waypoints,
      waypointIndex: (def.start + 1) % def.waypoints.length,
      pauseLeft: index * 0.5, // stagger the patrols so the cones never sync up
      mode: GUARD_PATROL,
      suspicion: 0,
      seen: false, // thief in this guard's cone right now
      lastSeenX: 0,
      lastSeenY: 0,
      memoryLeft: 0,
    };
  });
}

// Does this guard see the thief right now? Smoke blinds it; sneaking
// shrinks the range a little, since a crouched thief is harder to spot.
export function guardSeesThief(guard, thief, smokeClouds) {
  if (smokeClouds.some((cloud) => distance(thief.x, thief.y, cloud.x, cloud.y) < cloud.radius)) {
    return false;
  }
  const range = thief.sneaking ? GUARD.viewRange * 0.82 : GUARD.viewRange;
  return inVisionCone(guard.x, guard.y, guard.facing, range, GUARD.viewHalfAngle, thief.x, thief.y);
}

function walkToward(guard, targetX, targetY, speed, dt) {
  const dist = distance(guard.x, guard.y, targetX, targetY);
  if (dist < 1) return true;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + ((targetX - guard.x) / dist) * step;
  const ny = guard.y + ((targetY - guard.y) / dist) * step;
  const moved = moveCircle(guard.x, guard.y, GUARD.radius, nx - guard.x, ny - guard.y);
  guard.x = moved.x;
  guard.y = moved.y;
  const wanted = Math.atan2(targetY - guard.y, targetX - guard.x);
  guard.facing += angleDelta(guard.facing, wanted) * Math.min(1, dt * 8);
  return dist <= step + 1;
}

export function updateGuard(guard, dt, thief, smokeClouds, lockdown) {
  guard.seen = guardSeesThief(guard, thief, smokeClouds);

  if (guard.seen) {
    guard.lastSeenX = thief.x;
    guard.lastSeenY = thief.y;
    guard.memoryLeft = GUARD.chaseMemory;
    const rate = thief.sneaking ? GUARD.suspectRate * 0.5 : GUARD.suspectRate;
    guard.suspicion = Math.min(100, guard.suspicion + rate * dt);
    if (guard.suspicion >= 100 && guard.mode !== GUARD_CHASE) {
      guard.mode = GUARD_CHASE;
    }
  } else {
    guard.memoryLeft = Math.max(0, guard.memoryLeft - dt);
    if (guard.mode !== GUARD_CHASE) {
      guard.suspicion = Math.max(0, guard.suspicion - GUARD.suspectDecay * dt);
    }
  }

  if (guard.mode === GUARD_CHASE) {
    // Hunt the last place the thief was seen; give up when the trail is cold.
    const reached = walkToward(guard, guard.lastSeenX, guard.lastSeenY, GUARD.chaseSpeed, dt);
    if (!guard.seen && (guard.memoryLeft <= 0 || reached)) {
      guard.mode = GUARD_RETURN;
      guard.suspicion = 40;
    }
    return;
  }

  if (guard.mode === GUARD_RETURN) {
    // Walk back to the nearest waypoint, then resume the patrol.
    let nearest = 0;
    let nearestDist = Infinity;
    guard.waypoints.forEach(([wx, wy], index) => {
      const d = distance(guard.x, guard.y, wx, wy);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = index;
      }
    });
    if (walkToward(guard, guard.waypoints[nearest][0], guard.waypoints[nearest][1], GUARD.patrolSpeed * 1.4, dt)) {
      guard.mode = GUARD_PATROL;
      guard.waypointIndex = (nearest + 1) % guard.waypoints.length;
      guard.pauseLeft = 0.6;
    }
    return;
  }

  // Patrol: walk to the next waypoint, pause there and look around.
  if (guard.pauseLeft > 0) {
    guard.pauseLeft -= dt;
    guard.facing += LOOK_AROUND * dt * (guard.waypointIndex % 2 === 0 ? 1 : -1);
    return;
  }
  const [tx, ty] = guard.waypoints[guard.waypointIndex];
  const speed = lockdown ? GUARD.patrolSpeed * 1.5 : GUARD.patrolSpeed;
  if (walkToward(guard, tx, ty, speed, dt)) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    guard.pauseLeft = PAUSE_SECONDS;
  }
}

// A chasing guard that closes the gap ends the run.
export function guardCatchesThief(guard, thief) {
  return guard.mode === GUARD_CHASE && distance(guard.x, guard.y, thief.x, thief.y) < GUARD.catchRange;
}
