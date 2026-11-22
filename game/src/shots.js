// Screenshot staging: ?shot=cover|spotted|loot|escape (with ?seed=) puts
// the game into a fixed, photogenic moment for the screenshots the entry
// ships. The staged state is a real game state — the same fields, the same
// values a player could reach — just placed there directly instead of
// played into. The plain game (no ?shot=) never touches this file's code.

import { finishEscape, setMessage } from './world.js';

// Put a guard mid-beat: at (x, y), facing along its lane, walking towards
// the waypoint numbered `to`.
function placeGuard(state, index, x, y, facing, to) {
  const g = state.guards[index];
  g.x = x;
  g.y = y;
  g.facing = facing;
  g.wpIndex = to;
  g.mode = 'patrol';
  g.suspicion = 0;
  g.seen = false;
  g.memoryLeft = 0;
}

function placeCamera(state, index, angle) {
  state.cameras[index].angle = angle;
  state.cameras[index].seen = false;
  state.cameras[index].disabledLeft = 0;
}

function takeLoot(state, kind) {
  const item = state.loot.find((i) => i.kind === kind && !i.taken);
  if (!item) return;
  item.taken = true;
  state.thief.lootTaken += item.value;
  state.thief.lootCount += 1;
  if (kind === 'diamond') state.thief.hasDiamond = true;
}

// The cover: the whole room in one frame — thief mid-floor, cones
// sweeping, the diamond glowing, the alarm meter up top.
function stageCover(state) {
  state.status = 'playing';
  state.thief.x = 400;
  state.thief.y = 500;
  state.thief.facing = -Math.PI / 2;
  placeGuard(state, 0, 620, 90, 0, 1);
  placeGuard(state, 1, 480, 400, Math.PI, 0);
  placeGuard(state, 2, 820, 640, Math.PI, 1);
  placeCamera(state, 0, Math.PI / 2 + 0.45);
  placeCamera(state, 1, -0.35);
  state.alarm = 6;
  state.maxAlarm = 6;
  setMessage(state, 'Get the Star of Meridian. Get out the roof door.', 4);
}

// Spotted: guard B has the thief dead in his cone and is already running.
function stageSpotted(state) {
  state.status = 'playing';
  state.thief.x = 540;
  state.thief.y = 400;
  state.thief.facing = 0;
  placeGuard(state, 0, 700, 90, 0, 1);
  placeGuard(state, 2, 500, 640, 0, 0);
  const b = state.guards[1];
  b.x = 640;
  b.y = 400;
  b.facing = Math.PI;
  b.mode = 'chase';
  b.suspicion = 100;
  b.seen = true;
  b.lastSeenX = state.thief.x;
  b.lastSeenY = state.thief.y;
  b.memoryLeft = 4;
  placeCamera(state, 0, Math.PI / 2 - 0.3);
  placeCamera(state, 1, 0.2);
  state.alarm = 79;
  state.maxAlarm = 79;
  state.spotted = true;
  state.everSpotted = true;
  setMessage(state, 'SPOTTED — run!', 4);
}

// The grab: the thief's hand is on the Star of Meridian. She stands just
// above the plinth, in open floor, so the grab reads clearly.
function stageLoot(state) {
  state.status = 'playing';
  state.thief.x = 640;
  state.thief.y = 272;
  state.thief.facing = -Math.PI / 2;
  takeLoot(state, 'diamond');
  placeGuard(state, 0, 300, 90, 0, 1);
  placeGuard(state, 1, 900, 400, 0, 1);
  placeGuard(state, 2, 400, 640, 0, 0);
  placeCamera(state, 0, Math.PI / 2 + 0.2);
  placeCamera(state, 1, 0.4);
  state.alarm = 12;
  state.maxAlarm = 12;
  setMessage(state, '+$50,000 — Star of Meridian', 4);
}

// The getaway: the win screen, score and grade, after a quiet run.
function stageEscape(state) {
  takeLoot(state, 'diamond');
  takeLoot(state, 'gold');
  state.thief.x = 1160;
  state.thief.y = 40;
  state.thief.facing = -Math.PI / 2;
  placeGuard(state, 0, 500, 90, Math.PI, 0);
  placeGuard(state, 1, 700, 400, 0, 1);
  placeGuard(state, 2, 900, 640, Math.PI, 1);
  state.alarm = 34;
  state.maxAlarm = 34;
  state.everSpotted = false;
  finishEscape(state);
}

const STAGES = {
  cover: stageCover,
  spotted: stageSpotted,
  loot: stageLoot,
  escape: stageEscape,
};

// Stage the state for a named shot, or leave it alone when the name is
// not one of the four. Returns true when a stage was applied.
export function applyShot(state, name) {
  const stage = STAGES[name];
  if (!stage) return false;
  stage(state);
  return true;
}

// The four shots the entry ships, in the order they are named on disk.
export const SHOT_NAMES = ['cover', 'spotted', 'loot', 'escape'];
