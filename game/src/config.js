// The Midnight Vault — all the numbers that define the room, the crew and
// the loot. One place to tune the game: speeds, costs, timings, positions.

export const VIEW = { width: 1280, height: 720 };

// Thickness of the outer wall ring around the room.
export const WALL = 20;

// The room's floor, in canvas pixels. The thief, guards and cameras all
// stay inside this rectangle.
export const ROOM = { x: WALL, y: WALL, w: VIEW.width - WALL * 2, h: VIEW.height - WALL * 2 };

// The exit door: a gap in the top wall. Slip out here with the diamond.
export const EXIT = { x: 1120, y: 0, w: 80, h: 26, triggerY: 42, minX: 1116, maxX: 1204 };

// Display cases, the vault plinth and pillars. These block movement and
// block sight: crouch behind one and a cone cannot find you.
export const WALLS = [
  { x: 220, y: 150, w: 200, h: 44 }, // west display case, upper
  { x: 860, y: 150, w: 200, h: 44 }, // east display case, upper
  { x: 220, y: 480, w: 200, h: 44 }, // west display case, lower
  { x: 860, y: 480, w: 200, h: 44 }, // east display case, lower
  { x: 560, y: 300, w: 160, h: 60 }, // central vault plinth
  { x: 470, y: 322, w: 36, h: 36 }, // pillar, left of the plinth
  { x: 774, y: 322, w: 36, h: 36 }, // pillar, right of the plinth
];

// Where the thief starts a run: bottom-left corner, out of every cone.
export const THIEF_SPAWN = { x: 140, y: 640 };

// Thief movement.
export const THIEF = {
  radius: 14,
  walkSpeed: 152,
  sneakSpeed: 72,
  // How close the thief must be to lift something.
  grabReach: 56,
};

// Everything there is to steal. The diamond is the job; the rest is bonus.
export const LOOT = [
  { kind: 'diamond', name: 'Star of Meridian', x: 640, y: 250, value: 50000, color: '#7fe7ff' },
  { kind: 'gold', name: 'Gold bar', x: 180, y: 360, value: 8000, color: '#ffd34d' },
  { kind: 'gold', name: 'Gold bar', x: 1100, y: 360, value: 8000, color: '#ffd34d' },
  { kind: 'ruby', name: 'Ruby idol', x: 320, y: 100, value: 12000, color: '#ff5d73' },
  { kind: 'emerald', name: 'Emerald mask', x: 960, y: 100, value: 12000, color: '#4de89a' },
  { kind: 'sapphire', name: 'Sapphire egg', x: 980, y: 620, value: 15000, color: '#6f8cff' },
];

// The three guards. Each one walks a straight beat between two points and
// turns around at the ends. Beats run down open lanes, never through a case.
export const GUARDS = [
  {
    name: 'A',
    waypoints: [[200, 90], [1080, 90]],
    patrolSpeed: 62,
    chaseSpeed: 168,
    visionRange: 265,
    // Half of the vision cone, in radians.
    visionHalfAngle: 0.62,
  },
  {
    name: 'B',
    waypoints: [[200, 400], [1080, 400]],
    patrolSpeed: 62,
    chaseSpeed: 168,
    visionRange: 265,
    visionHalfAngle: 0.62,
  },
  {
    name: 'C',
    waypoints: [[1080, 640], [200, 640]],
    patrolSpeed: 62,
    chaseSpeed: 168,
    visionRange: 265,
    visionHalfAngle: 0.62,
  },
];

// The two wall cameras. They sweep back and forth around a fixed base
// direction and never move from their mount.
export const CAMERAS = [
  { x: 640, y: 26, baseAngle: Math.PI / 2, sweep: 0.85, sweepSpeed: 0.55, phase: 0, range: 300, halfAngle: 0.5 },
  { x: 26, y: 360, baseAngle: 0, sweep: 0.85, sweepSpeed: 0.45, phase: 1.7, range: 300, halfAngle: 0.5 },
];

// Gadgets. Both cost score, not lives: spend them when a cone is about to
// catch you, not before.
export const GADGETS = {
  smoke: { key: 'Q', cost: 2500, startCount: 3, radius: 95, lifetime: 6, label: 'Smoke bomb' },
  emp: { key: 'F', cost: 5000, startCount: 2, disableSeconds: 6, label: 'EMP burst' },
};

// The alarm. It climbs while anyone can see the thief and falls slowly
// while nobody can. At 100 the museum locks down and the police are called.
export const ALARM = {
  max: 100,
  // A guard staring at the thief fills the meter in about five seconds;
  // a chase on top of that cuts it to roughly three. Being seen has to
  // hurt, or the meter is decoration.
  guardSeenRate: 18,
  cameraSeenRate: 22,
  chaseRate: 14,
  decayRate: 2.5,
  lockdownSeconds: 12,
};

// How suspicion grows and fades for a guard. Close and standing up fills
// the meter fast; sneaking and distance slow it right down.
export const SUSPICION = {
  baseRate: 55,
  closeBonus: 90,
  sneakFactor: 0.45,
  decayRate: 20,
  investigateAt: 45,
  chaseAt: 100,
  // How long a guard remembers where it last saw the thief.
  memorySeconds: 4,
};

// Catching, scoring and grades.
export const RULES = {
  catchDistance: 30,
  escapeBonus: 5000,
  ghostMaxAlarm: 20,
  smoothMaxAlarm: 60,
};

// Colours for the night-museum look: deep blue floor, brass trim, warm light.
export const COLORS = {
  floor: '#141a2e',
  floorTile: '#182036',
  wall: '#2c3350',
  wallTrim: '#c9a24b',
  caseGlass: '#3d5a80',
  caseBase: '#232c4a',
  plinth: '#3a2f5e',
  exitDoor: '#2fae6e',
  thief: '#e8e6df',
  thiefHood: '#232838',
  guard: '#31456e',
  guardAlert: '#a33327',
  coneCalm: '255, 210, 90',
  coneAlert: '255, 70, 50',
  camera: '#8a93a8',
  hudPanel: 'rgba(8, 12, 24, 0.72)',
  text: '#f2ead8',
  mutedText: '#9aa3bd',
};
