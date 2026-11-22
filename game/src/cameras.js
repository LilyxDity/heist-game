// The wall cameras. Each one is bolted to a wall and sweeps its cone back
// and forth. A camera never chases anyone — it just watches, and while it
// watches the thief the alarm climbs fast. An EMP burst knocks a camera
// out for a few seconds; smoke blinds it like it blinds a guard.

import { CAMERAS } from './config.js';
import { angleDiff, distance, lineOfSightClear, segmentCrossesCircle } from './geometry.js';

// Build one camera from its config entry.
export function makeCamera(def, index) {
  return {
    id: index,
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    sweep: def.sweep,
    sweepSpeed: def.sweepSpeed,
    phase: def.phase,
    range: def.range,
    halfAngle: def.halfAngle,
    // The direction the lens points right now.
    angle: def.baseAngle,
    seen: false,
    // Seconds of EMP shutdown left. Above zero the camera is dead.
    disabledLeft: 0,
  };
}

export function makeCameras() {
  return CAMERAS.map((def, i) => makeCamera(def, i));
}

// Can this camera see the thief? Same rules as a guard's eyes, except a
// camera's cone sweeps on its own and an EMP can switch it off.
export function cameraCanSee(cam, thief, walls, smoke) {
  if (cam.disabledLeft > 0) return false;
  const dist = distance(cam.x, cam.y, thief.x, thief.y);
  if (dist > cam.range) return false;
  const angle = Math.atan2(thief.y - cam.y, thief.x - cam.x);
  if (Math.abs(angleDiff(angle, cam.angle)) > cam.halfAngle) return false;
  if (!lineOfSightClear(cam.x, cam.y, thief.x, thief.y, walls)) return false;
  for (const cloud of smoke) {
    if (segmentCrossesCircle(cam.x, cam.y, thief.x, thief.y, cloud.x, cloud.y, cloud.radius)) {
      return false;
    }
  }
  return true;
}

// One fixed step: sweep the lens and check the thief. `time` is the run
// clock, so both cameras sweep in a steady rhythm.
export function updateCamera(cam, dt, time, thief, walls, smoke) {
  if (cam.disabledLeft > 0) {
    cam.disabledLeft = Math.max(0, cam.disabledLeft - dt);
    cam.seen = false;
    return;
  }
  cam.angle = cam.baseAngle + Math.sin(time * cam.sweepSpeed + cam.phase) * cam.sweep;
  cam.seen = cameraCanSee(cam, thief, walls, smoke);
}
