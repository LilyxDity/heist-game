// Geometry: angles, line of sight, raycasts and circle-vs-wall movement.
// Everything the guards see and everything the thief bumps into goes
// through here, so the rules stay the same for every system.

// Smallest signed difference between two angles, in (-PI, PI].
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

// Do segments (a-b) and (c-d) cross? Standard orientation test.
function orientation(ax, ay, bx, by, cx, cy) {
  const v = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (v === 0) return 0;
  return v > 0 ? 1 : 2;
}

function onSegment(ax, ay, bx, by, cx, cy) {
  return (
    bx <= Math.max(ax, cx) && bx >= Math.min(ax, cx) &&
    by <= Math.max(ay, cy) && by >= Math.min(ay, cy)
  );
}

export function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const o1 = orientation(ax, ay, bx, by, cx, cy);
  const o2 = orientation(ax, ay, bx, by, dx, dy);
  const o3 = orientation(cx, cy, dx, dy, ax, ay);
  const o4 = orientation(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(ax, ay, cx, cy, bx, by)) return true;
  if (o2 === 0 && onSegment(ax, ay, dx, dy, bx, by)) return true;
  if (o3 === 0 && onSegment(cx, cy, ax, ay, dx, dy)) return true;
  if (o4 === 0 && onSegment(cx, cy, bx, by, dx, dy)) return true;
  return false;
}

// Does the segment from (x1, y1) to (x2, y2) touch a rectangle? Checked by
// testing the four edges, plus the case where both ends sit inside it.
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const { x, y, w, h } = rect;
  if (x1 >= x && x1 <= x + w && y1 >= y && y1 <= y + h) return true;
  if (x2 >= x && x2 <= x + w && y2 >= y && y2 <= y + h) return true;
  const rx = x + w;
  const ry = y + h;
  return (
    segmentsCross(x1, y1, x2, y2, x, y, rx, y) ||
    segmentsCross(x1, y1, x2, y2, rx, y, rx, ry) ||
    segmentsCross(x1, y1, x2, y2, rx, ry, x, ry) ||
    segmentsCross(x1, y1, x2, y2, x, ry, x, y)
  );
}

// True when nothing stands between two points: no wall in the way.
export function lineOfSightClear(x1, y1, x2, y2, walls) {
  for (const wall of walls) {
    if (segmentHitsRect(x1, y1, x2, y2, wall)) return false;
  }
  return true;
}

// Cast a ray from (x, y) along `angle` up to maxDist. Returns the distance
// to the nearest wall, or maxDist when the ray reaches open floor. Walls are
// tested edge by edge; the ray/edge crossing point gives the hit distance.
export function rayHitDistance(x, y, angle, maxDist, walls) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = maxDist;
  const x2 = x + dx * maxDist;
  const y2 = y + dy * maxDist;
  for (const rect of walls) {
    const edges = [
      [rect.x, rect.y, rect.x + rect.w, rect.y],
      [rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h],
      [rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h],
      [rect.x, rect.y + rect.h, rect.x, rect.y],
    ];
    for (const [ex1, ey1, ex2, ey2] of edges) {
      const hit = raySegmentHit(x, y, x2, y2, ex1, ey1, ex2, ey2);
      if (hit !== null && hit < best) best = hit;
    }
  }
  return best;
}

// Distance along ray (x1,y1)-(x2,y2) where it meets segment (x3,y3)-(x4,y4),
// or null when they never meet. Solved as a 2x2 linear system.
function raySegmentHit(x1, y1, x2, y2, x3, y3, x4, y4) {
  const rdx = x2 - x1;
  const rdy = y2 - y1;
  const sdx = x4 - x3;
  const sdy = y4 - y3;
  const denom = rdx * sdy - rdy * sdx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((x3 - x1) * sdy - (y3 - y1) * sdx) / denom;
  const u = ((x3 - x1) * rdy - (y3 - y1) * rdx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return t * Math.hypot(rdx, rdy);
}

// Does a circle at (cx, cy) with radius r overlap a rectangle?
export function circleHitsRect(cx, cy, r, rect) {
  const nearX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const nearY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const ddx = cx - nearX;
  const ddy = cy - nearY;
  return ddx * ddx + ddy * ddy < r * r;
}

// Does the circle overlap any wall in the list?
export function circleHitsAnyWall(cx, cy, r, walls) {
  for (const wall of walls) {
    if (circleHitsRect(cx, cy, r, wall)) return true;
  }
  return false;
}

// Move a circle by (dx, dy), sliding along walls: try x first, then y, and
// keep whichever axis is free. The room bounds clamp the result.
export function moveCircle(pos, dx, dy, radius, walls, room) {
  const nextX = pos.x + dx;
  if (!circleHitsAnyWall(nextX, pos.y, radius, walls)) {
    pos.x = nextX;
  }
  const nextY = pos.y + dy;
  if (!circleHitsAnyWall(pos.x, nextY, radius, walls)) {
    pos.y = nextY;
  }
  pos.x = Math.max(room.x + radius, Math.min(room.x + room.w - radius, pos.x));
  pos.y = Math.max(room.y + radius, Math.min(room.y + room.h - radius, pos.y));
}

// Is the point inside the rectangle (edges included)?
export function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

// Is the segment from (x1, y1) to (x2, y2) passing through a circle?
// Used to tell whether a smoke cloud sits between two pairs of eyes.
export function segmentCrossesCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const nearX = x1 + t * dx;
  const nearY = y1 + t * dy;
  const ddx = cx - nearX;
  const ddy = cy - nearY;
  return ddx * ddx + ddy * ddy < r * r;
}
