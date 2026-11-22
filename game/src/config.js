// THE MIDNIGHT VAULT — tuning constants.
//
// One file holds every number that defines the heist: the hall, the thief,
// the guards, the cameras, the loot, the alarm and the gadgets. Change a
// value here and the whole game retunes; nothing else needs to know.

export const WORLD = { width: 1280, height: 720 };
export const WALL = 24; // thickness of the outer walls, in pixels
export const STEP = 1 / 60; // fixed simulation step, in seconds

// The thief. Walking is quick; sneaking is slower but shrinks the range at
// which guards and cameras can spot you.
export const THIEF = {
  radius: 13,
  walkSpeed: 185,
  sneakSpeed: 108,
  startX: 640,
  startY: 648,
};

// A guard. Suspicion climbs while the thief is inside its vision cone
// (half as fast while the thief sneaks) and falls when the thief is hidden.
// At 100 the guard gives chase; a chaser that closes in ends the run.
export const GUARD = {
  radius: 14,
  patrolSpeed: 72,
  chaseSpeed: 168,
  viewRange: 215,
  viewHalfAngle: 0.6, // about 34 degrees either side of where it faces
  suspectRate: 55, // suspicion points per second of clear sight
  suspectDecay: 22,
  chaseMemory: 4, // seconds a guard keeps hunting after losing sight
  catchRange: 26,
};

// A wall camera. It sweeps back and forth and never moves, but while the
// thief stands in its cone the alarm climbs directly.
export const CAMERA = {
  viewRange: 295,
  viewHalfAngle: 0.46, // about 26 degrees either side of where it points
  sweepSpeed: 0.55, // radians per second
  alarmRate: 10, // alarm points per second of clear sight
};

// The alarm. It rises while any eye is on the thief and drains slowly while
// hidden. At 100 the gallery locks down and the police get a 12-second
// countdown before they storm in.
export const ALARM = {
  guardSightRate: 14,
  decayRate: 2,
  lockdownSeconds: 12,
};

// Gadgets cost score, not money in hand: smoke blinds every eye for a
// while, the EMP shuts the cameras off. Spend them where they buy time.
export const GADGETS = {
  smokeCount: 2,
  smokeCost: 2500,
  smokeRadius: 95,
  smokeSeconds: 6,
  empCount: 1,
  empCost: 5000,
  empSeconds: 12,
};

export const LOOT_VALUE = { diamond: 500000, gold: 25000, painting: 15000 };
export const TIME_BONUS_PER_SECOND = 100; // per second under five minutes
export const TIME_BONUS_CAP_SECONDS = 300;

// Cover that blocks both sight and movement: pillars, glass display cases
// and crates. The vision cones and the thief's collision both use these.
export const COVER = [
  { x: 265, y: 105, w: 70, h: 70, kind: 'pillar' }, // top-left pillar
  { x: 945, y: 105, w: 70, h: 70, kind: 'pillar' }, // top-right pillar
  { x: 265, y: 505, w: 70, h: 70, kind: 'pillar' }, // bottom-left pillar
  { x: 945, y: 505, w: 70, h: 70, kind: 'pillar' }, // bottom-right pillar
  { x: 235, y: 273, w: 130, h: 54, kind: 'case' }, // west display case
  { x: 915, y: 273, w: 130, h: 54, kind: 'case' }, // east display case
  { x: 570, y: 132, w: 140, h: 54, kind: 'case' }, // north display case
  { x: 500, y: 596, w: 60, h: 60, kind: 'crate' }, // entry crates
  { x: 720, y: 596, w: 60, h: 60, kind: 'crate' },
];

// The pedestal at the heart of the hall, holding the Star of Meridian.
export const VAULT = { x: 595, y: 270, w: 90, h: 60 };

// Doors: in through the bottom centre, out through the top right.
export const ENTRY = { x: 600, y: 696, w: 80, h: 24 };
export const EXIT = { x: 1120, y: 0, w: 80, h: 24 };

// Everything worth stealing: the diamond on its pedestal, gold bars and
// two paintings on the walls.
export const LOOT = [
  { id: 'diamond', kind: 'diamond', x: 640, y: 300, label: 'STAR OF MERIDIAN', value: LOOT_VALUE.diamond },
  { id: 'gold-west', kind: 'gold', x: 170, y: 330, label: 'GOLD BAR', value: LOOT_VALUE.gold },
  { id: 'gold-east', kind: 'gold', x: 1110, y: 330, label: 'GOLD BAR', value: LOOT_VALUE.gold },
  { id: 'gold-north', kind: 'gold', x: 640, y: 159, label: 'GOLD BAR', value: LOOT_VALUE.gold },
  { id: 'painting-west', kind: 'painting', x: 60, y: 90, label: 'PAINTING', value: LOOT_VALUE.painting },
  { id: 'painting-east', kind: 'painting', x: 1220, y: 630, label: 'PAINTING', value: LOOT_VALUE.painting },
];

// The three guards and their patrol routes: name, waypoints, start index.
export const GUARD_DEFS = [
  { name: 'ROOK', waypoints: [[180, 120], [180, 600]], start: 0 },
  { name: 'VEGA', waypoints: [[470, 392], [810, 392]], start: 0 },
  { name: 'MARLOWE', waypoints: [[1100, 120], [1100, 600]], start: 1 },
];

// Cameras on the north wall, sweeping their cones across the hall.
export const CAMERA_DEFS = [
  { x: 420, y: 30, baseAngle: Math.PI / 2, sweep: 0.7, phase: 0 },
  { x: 860, y: 30, baseAngle: Math.PI / 2, sweep: 0.7, phase: Math.PI },
];

// Palette: dark hall, warm gold loot, amber danger, teal-safe cover tones.
export const COLORS = {
  floor: '#1b2334',
  floorTile: '#202a40',
  carpet: '#7a1f2b',
  carpetEdge: '#a83240',
  wall: '#2e3a52',
  wallTop: '#42506e',
  cover: '#31405f',
  coverTop: '#3d4f73',
  glass: '#5f7ea8',
  gold: '#ffc93c',
  goldGlow: 'rgba(255, 201, 60, 0.35)',
  diamond: '#bfe9ff',
  thief: '#e8ecf4',
  thiefDark: '#232a3a',
  guard: '#ff5d5d',
  guardCone: 'rgba(255, 190, 60, 0.20)',
  guardConeEdge: 'rgba(255, 190, 60, 0.45)',
  cameraCone: 'rgba(255, 120, 90, 0.16)',
  cameraConeEdge: 'rgba(255, 120, 90, 0.4)',
  alarmLow: '#59d98c',
  alarmMid: '#ffc93c',
  alarmHigh: '#ff5252',
  smoke: 'rgba(200, 205, 215, 0.55)',
  text: '#eef1f7',
  muted: '#9aa7bd',
};

export const BEST_KEY = 'midnight-vault-best';
export const LIVES = 1;
