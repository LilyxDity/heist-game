// Shared geometry: line of sight past the cover, circle-versus-rectangle
// collision for walking, and angle helpers.
import { COVER, VAULT, WALL, WORLD } from './config.js';

// Every rectangle that blocks sight or movement: the cover plus the vault.
export const BLOCKERS = [...COVER, VAULT];

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

// Shortest signed turn from angle `from` toward angle `to`, in (-PI, PI].
export function angleDelta(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function segmentIntersectsRect(x1, y1, x2, y2, rect) {
  // Liang-Barsky clipping: the segment crosses the rectangle exactly when
  // the clipped parameter interval is non-empty.
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const edges = [
    [-dx, x1 - rect.x],
    [dx, rect.x + rect.w - x1],
    [-dy, y1 - rect.y],
    [dy, rect.y + rect.h - y1],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}

// True when nothing solid stands between two points. Smoke is checked by
// the caller: it blinds eyes but is not a wall.
export function hasLineOfSight(x1, y1, x2, y2) {
  for (const rect of BLOCKERS) {
    if (segmentIntersectsRect(x1, y1, x2, y2, rect)) return false;
  }
  return true;
}

function circleHitsRect(x, y, radius, rect) {
  const nearestX = clamp(x, rect.x, rect.x + rect.w);
  const nearestY = clamp(y, rect.y, rect.y + rect.h);
  return distance(x, y, nearestX, nearestY) < radius;
}

// Move a circle by (dx, dy), sliding along walls and cover instead of
// passing through them. Returns the new position.
export function moveCircle(x, y, radius, dx, dy) {
  let nextX = x + dx;
  let nextY = y + dy;
  const minX = WALL + radius;
  const maxX = WORLD.width - WALL - radius;
  const minY = WALL + radius;
  const maxY = WORLD.height - WALL - radius;
  nextX = clamp(nextX, minX, maxX);
  nextY = clamp(nextY, minY, maxY);
  // Slide: try the full move first, then each axis on its own.
  if (BLOCKERS.some((rect) => circleHitsRect(nextX, nextY, radius, rect))) {
    if (!BLOCKERS.some((rect) => circleHitsRect(nextX, y, radius, rect))) {
      nextY = y;
    } else if (!BLOCKERS.some((rect) => circleHitsRect(x, nextY, radius, rect))) {
      nextX = x;
    } else {
      nextX = x;
      nextY = y;
    }
  }
  return { x: nextX, y: nextY };
}

// True when a point sits inside a cone (origin, facing, range, half-angle)
// with a clear line of sight to it.
export function inVisionCone(ox, oy, facing, range, halfAngle, tx, ty) {
  const dist = distance(ox, oy, tx, ty);
  if (dist > range) return false;
  const toTarget = Math.atan2(ty - oy, tx - ox);
  if (Math.abs(angleDelta(facing, toTarget)) > halfAngle) return false;
  return hasLineOfSight(ox, oy, tx, ty);
}
