// The screenshot scenes behind ?shot=cover|spotted|loot|escape. Each one
// sets the real game state to a moment a player actually reaches —
// mid-crossing, caught in a cone, diamond in hand, the getaway screen —
// then runs the world forward a few fixed steps so the patrols and camera
// sweeps sit naturally. The frame is painted by the same renderer the game
// plays with.
import { GADGETS, STEP } from './config.js';
import { GUARD_CHASE } from './guards.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { STATUS_ESCAPED } from './world.js';

function idle(world, seconds) {
  for (let t = 0; t < seconds; t += STEP) world.step(STEP, { x: 0, y: 0 }, false, []);
}

function placeGuard(guard, x, y, facing, suspicion = 0) {
  guard.x = x;
  guard.y = y;
  guard.facing = facing;
  guard.suspicion = suspicion;
  guard.pauseLeft = 0;
}

// The cover: the thief crossing the hall, every system visible in one
// frame — the room, the guards with their cones, the cameras, the diamond
// on its pedestal and the alarm meter with a little heat on it.
function stageCover(world) {
  const s = world.state;
  s.thief.x = 430;
  s.thief.y = 470;
  s.thief.facing = Math.PI / 4;
  s.thief.sneaking = true;
  placeGuard(s.guards[0], 180, 300, Math.PI / 2);
  placeGuard(s.guards[1], 560, 392, 0);
  placeGuard(s.guards[2], 1100, 420, -Math.PI / 2);
  s.cameras[0].time = 1.2;
  s.cameras[1].time = 4.4;
  s.alarm = 32;
  s.maxAlarm = 32;
  const gold = s.loot.find((item) => item.id === 'gold-west');
  gold.taken = true;
  s.thief.lootTaken += gold.value;
  s.thief.lootCount += 1;
  idle(world, 0.8);
  return { screen: SCREEN_PLAY };
}

// Spotted: Vega has the thief dead in its cone and is closing in, the
// alarm is high and the frame is flashing red.
function stageSpotted(world) {
  const s = world.state;
  s.thief.x = 700;
  s.thief.y = 330;
  s.thief.facing = Math.PI;
  s.thief.sneaking = false;
  placeGuard(s.guards[0], 180, 520, -Math.PI / 2);
  placeGuard(s.guards[1], 585, 392, -0.5, 100);
  s.guards[1].mode = GUARD_CHASE;
  s.guards[1].lastSeenX = s.thief.x;
  s.guards[1].lastSeenY = s.thief.y;
  s.guards[1].memoryLeft = 4;
  placeGuard(s.guards[2], 1100, 200, Math.PI / 2);
  s.cameras[0].time = 2.6;
  s.cameras[1].time = 0.4;
  s.alarm = 74;
  s.maxAlarm = 74;
  s.time = 96;
  idle(world, 0.4);
  return { screen: SCREEN_PLAY };
}

// The grab: the thief has just lifted the Star of Meridian off its pedestal.
function stageLoot(world) {
  const s = world.state;
  s.thief.x = 640;
  s.thief.y = 372;
  s.thief.facing = -Math.PI / 2;
  s.thief.sneaking = true;
  const diamond = s.loot.find((item) => item.kind === 'diamond');
  diamond.taken = true;
  s.thief.hasDiamond = true;
  s.thief.lootTaken += diamond.value;
  s.thief.lootCount += 1;
  const gold = s.loot.find((item) => item.id === 'gold-north');
  gold.taken = true;
  s.thief.lootTaken += gold.value;
  s.thief.lootCount += 1;
  s.floating.push({ x: 640, y: 250, text: '+$500,000 STAR OF MERIDIAN', color: '#bfe9ff', ttl: 2.2 });
  placeGuard(s.guards[0], 180, 180, Math.PI / 2);
  placeGuard(s.guards[1], 810, 392, Math.PI, 18);
  placeGuard(s.guards[2], 1100, 560, -Math.PI / 2);
  s.cameras[0].time = 3.8;
  s.cameras[1].time = 1.0;
  s.alarm = 18;
  s.maxAlarm = 18;
  s.time = 141;
  idle(world, 0.5);
  return { screen: SCREEN_PLAY };
}

// The getaway: the end screen with the score broken down.
function stageEscape(world) {
  const s = world.state;
  s.thief.x = 1160;
  s.thief.y = 60;
  s.thief.hasDiamond = true;
  s.thief.lootTaken = 550000;
  s.thief.lootCount = 3;
  for (const item of s.loot) {
    if (item.kind === 'diamond' || item.id === 'gold-west' || item.id === 'gold-north') item.taken = true;
  }
  s.smokeLeft = GADGETS.smokeCount - 1;
  s.gadgetCost = GADGETS.smokeCost;
  s.time = 187;
  s.alarm = 41;
  s.maxAlarm = 41;
  s.status = STATUS_ESCAPED;
  s.timeBonus = (300 - 187) * 100;
  s.score = s.thief.lootTaken + s.timeBonus - s.gadgetCost;
  s.grade = 'SMOOTH';
  placeGuard(s.guards[0], 180, 420, Math.PI / 2);
  placeGuard(s.guards[1], 640, 392, Math.PI);
  placeGuard(s.guards[2], 1100, 300, -Math.PI / 2);
  return { screen: SCREEN_OVER };
}

export function stageShot(name, world) {
  world.reset();
  if (name === 'cover') return stageCover(world);
  if (name === 'spotted') return stageSpotted(world);
  if (name === 'loot') return stageLoot(world);
  if (name === 'escape') return stageEscape(world);
  idle(world, 1.5);
  return { screen: SCREEN_TITLE };
}
