// The wall cameras. Each one sweeps its cone back and forth across the
// hall. A camera never chases, but while the thief stands in its cone the
// alarm climbs — and an EMP is the only thing that shuts one up.
import { CAMERA, CAMERA_DEFS } from './config.js';
import { distance, inVisionCone } from './geometry.js';

export function createCameras() {
  return CAMERA_DEFS.map((def) => ({
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    sweep: def.sweep,
    phase: def.phase,
    angle: def.baseAngle,
    time: def.phase,
    disabledLeft: 0, // seconds of EMP shutdown remaining
    seen: false, // thief in this camera's cone right now
  }));
}

export function updateCamera(camera, dt, thief, smokeClouds) {
  camera.time += dt;
  camera.angle = camera.baseAngle + Math.sin(camera.time * CAMERA.sweepSpeed) * camera.sweep;
  if (camera.disabledLeft > 0) {
    camera.disabledLeft = Math.max(0, camera.disabledLeft - dt);
    camera.seen = false;
    return;
  }
  const inSmoke = smokeClouds.some((cloud) => distance(thief.x, thief.y, cloud.x, cloud.y) < cloud.radius);
  camera.seen = !inSmoke && inVisionCone(camera.x, camera.y, camera.angle, CAMERA.viewRange, CAMERA.viewHalfAngle, thief.x, thief.y);
}

export function disableCameras(cameras, seconds) {
  for (const camera of cameras) camera.disabledLeft = seconds;
}
