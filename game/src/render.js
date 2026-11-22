// Rendering: everything the player sees, drawn on one canvas. The room
// first, then cones, loot, smoke, the crew, the thief, and finally the HUD
// and the screens. No images, no fonts from the network — shapes and text
// only, so the game renders the same offline.

import { VIEW, WALL, ROOM, EXIT, COLORS } from './config.js';
import { mulberry32 } from './random.js';
import { rayHitDistance } from './geometry.js';

// The outer wall ring, as rectangles, so raycast cones stop at the room.
const BORDER = [
  { x: 0, y: 0, w: VIEW.width, h: WALL },
  { x: 0, y: VIEW.height - WALL, w: VIEW.width, h: WALL },
  { x: 0, y: 0, w: WALL, h: VIEW.height },
  { x: VIEW.width - WALL, y: 0, w: WALL, h: VIEW.height },
];

function money(n) {
  return '$' + n.toLocaleString('en-US');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A vision cone clipped by the walls: sample rays across the cone and let
// each one stop at the first case or wall it meets. The polygon that comes
// back is what the guard or camera can actually see.
function conePath(ctx, x, y, angle, halfAngle, range, walls) {
  const steps = 26;
  const allWalls = walls.concat(BORDER);
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i <= steps; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / steps;
    const dist = rayHitDistance(x, y, a, range, allWalls);
    ctx.lineTo(x + Math.cos(a) * dist, y + Math.sin(a) * dist);
  }
  ctx.closePath();
}

function drawFloor(ctx, state) {
  ctx.fillStyle = COLORS.floor;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // Large quiet tiles.
  ctx.strokeStyle = COLORS.floorTile;
  ctx.lineWidth = 1;
  for (let x = ROOM.x; x <= ROOM.x + ROOM.w; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, ROOM.y);
    ctx.lineTo(x, ROOM.y + ROOM.h);
    ctx.stroke();
  }
  for (let y = ROOM.y; y <= ROOM.y + ROOM.h; y += 80) {
    ctx.beginPath();
    ctx.moveTo(ROOM.x, y);
    ctx.lineTo(ROOM.x + ROOM.w, y);
    ctx.stroke();
  }

  // A little worn-carpet speckle, seeded so every run looks the same.
  const rng = mulberry32(state.seed * 7919 + 13);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
  for (let i = 0; i < 110; i += 1) {
    const x = ROOM.x + rng() * ROOM.w;
    const y = ROOM.y + rng() * ROOM.h;
    ctx.fillRect(x, y, 2, 2);
  }

  // The red carpet runner from the door to the vault: the obvious route,
  // and the most watched one.
  ctx.fillStyle = 'rgba(122, 32, 48, 0.35)';
  ctx.fillRect(608, ROOM.y, 64, 260);
  ctx.strokeStyle = 'rgba(201, 162, 75, 0.5)';
  ctx.strokeRect(608, ROOM.y, 64, 260);
}

function drawWalls(ctx, state) {
  // Outer ring with a brass trim line.
  ctx.fillStyle = COLORS.wall;
  ctx.fillRect(0, 0, VIEW.width, WALL);
  ctx.fillRect(0, VIEW.height - WALL, VIEW.width, WALL);
  ctx.fillRect(0, 0, WALL, VIEW.height);
  ctx.fillRect(VIEW.width - WALL, 0, WALL, VIEW.height);
  ctx.strokeStyle = COLORS.wallTrim;
  ctx.lineWidth = 2;
  ctx.strokeRect(WALL - 1, WALL - 1, VIEW.width - WALL * 2 + 2, VIEW.height - WALL * 2 + 2);

  // The exit door: a lit gap in the top wall, top right.
  ctx.fillStyle = COLORS.exitDoor;
  ctx.fillRect(EXIT.x, 0, EXIT.w, WALL);
  ctx.fillStyle = '#d8ffe9';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', EXIT.x + EXIT.w / 2, WALL / 2 + 1);

  // Display cases: dark bases with a glassy top.
  for (const wall of state.walls) {
    const isPlinth = wall.w === 160 && wall.h === 60;
    ctx.fillStyle = isPlinth ? COLORS.plinth : COLORS.caseBase;
    roundRect(ctx, wall.x, wall.y, wall.w, wall.h, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(125, 180, 220, 0.28)';
    roundRect(ctx, wall.x + 4, wall.y + 4, wall.w - 8, wall.h - 8, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(201, 162, 75, 0.55)';
    ctx.lineWidth = 1;
    roundRect(ctx, wall.x, wall.y, wall.w, wall.h, 6);
    ctx.stroke();
  }
}

function drawLoot(ctx, state) {
  const t = state.time;
  for (const item of state.loot) {
    if (item.taken) continue;
    const pulse = 1 + 0.12 * Math.sin(t * 3 + item.x);
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.scale(pulse, pulse);

    // A soft glow so loot reads at a glance across the room.
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
    glow.addColorStop(0, item.color);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (item.kind === 'diamond') {
      // Four-point star, slowly turning.
      ctx.rotate(Math.sin(t * 0.8) * 0.25);
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(6, -6);
      ctx.lineTo(20, 0);
      ctx.lineTo(6, 6);
      ctx.lineTo(0, 20);
      ctx.lineTo(-6, 6);
      ctx.lineTo(-20, 0);
      ctx.lineTo(-6, -6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.kind === 'gold') {
      ctx.fillStyle = item.color;
      roundRect(ctx, -14, -7, 28, 14, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(-14, -7, 28, 4);
    } else {
      // Ruby, emerald, sapphire: a cut gem.
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(11, -3);
      ctx.lineTo(8, 11);
      ctx.lineTo(-8, 11);
      ctx.lineTo(-11, -3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(6, -3);
      ctx.lineTo(0, 2);
      ctx.lineTo(-6, -3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(242, 234, 216, 0.85)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(item.name, item.x, item.y + 22);
  }
}

function drawSmoke(ctx, state) {
  for (const cloud of state.smoke) {
    const fade = Math.min(1, cloud.left / 1.5);
    ctx.fillStyle = `rgba(190, 195, 205, ${0.5 * fade})`;
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(220, 224, 232, ${0.35 * fade})`;
    ctx.beginPath();
    ctx.arc(cloud.x - 22, cloud.y - 12, cloud.radius * 0.55, 0, Math.PI * 2);
    ctx.arc(cloud.x + 24, cloud.y + 14, cloud.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGuards(ctx, state) {
  for (const guard of state.guards) {
    // The beat, faintly, so the player can read the patrol before moving.
    ctx.strokeStyle = 'rgba(154, 163, 189, 0.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(guard.waypoints[0][0], guard.waypoints[0][1]);
    ctx.lineTo(guard.waypoints[1][0], guard.waypoints[1][1]);
    ctx.stroke();
    ctx.setLineDash([]);

    // The vision cone.
    const hot = guard.mode === 'chase' || guard.seen;
    const warm = guard.mode === 'suspicious' || guard.suspicion >= 45;
    const rgb = hot ? COLORS.coneAlert : COLORS.coneCalm;
    const alpha = hot ? 0.3 : warm ? 0.2 : 0.13;
    conePath(ctx, guard.x, guard.y, guard.facing, guard.visionHalfAngle, guard.visionRange, state.walls);
    ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
    ctx.fill();

    // The guard: a navy body, a cap brim pointing where he looks.
    ctx.fillStyle = guard.mode === 'chase' ? COLORS.guardAlert : COLORS.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d1226';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#d8c27a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.facing) * 20, guard.y + Math.sin(guard.facing) * 20);
    ctx.stroke();

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(guard.name, guard.x, guard.y + 1);

    // Suspicion meter over the head, once he notices anything.
    if (guard.suspicion > 4) {
      const w = 34;
      ctx.fillStyle = 'rgba(8, 12, 24, 0.8)';
      ctx.fillRect(guard.x - w / 2, guard.y - 30, w, 6);
      ctx.fillStyle = guard.suspicion >= 100 ? '#ff4b38' : guard.suspicion >= 45 ? '#ffb02e' : '#ffe066';
      ctx.fillRect(guard.x - w / 2, guard.y - 30, (w * guard.suspicion) / 100, 6);
    }
    if (guard.mode === 'chase') {
      ctx.fillStyle = '#ff4b38';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText('!', guard.x, guard.y - 40);
    }
  }
}

function drawCameras(ctx, state) {
  for (const cam of state.cameras) {
    const disabled = cam.disabledLeft > 0;
    const rgb = cam.seen ? COLORS.coneAlert : COLORS.coneCalm;
    if (!disabled) {
      conePath(ctx, cam.x, cam.y, cam.angle, cam.halfAngle, cam.range, state.walls);
      ctx.fillStyle = `rgba(${rgb}, ${cam.seen ? 0.28 : 0.12})`;
      ctx.fill();
    }

    // The mount: a little bracket on the wall and a lens that follows it.
    ctx.fillStyle = disabled ? '#555c6e' : COLORS.camera;
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d1226';
    ctx.lineWidth = 2;
    ctx.stroke();
    const lensX = cam.x + Math.cos(cam.angle) * 12;
    const lensY = cam.y + Math.sin(cam.angle) * 12;
    ctx.fillStyle = disabled ? '#3a3f4d' : cam.seen ? '#ff4b38' : '#ff5d5d';
    ctx.beginPath();
    ctx.arc(lensX, lensY, 4, 0, Math.PI * 2);
    ctx.fill();
    if (disabled) {
      ctx.fillStyle = '#c8cdd8';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EMP', cam.x, cam.y - 20);
    }
  }
}

function drawThief(ctx, state) {
  const thief = state.thief;
  const r = thief.sneaking ? 12 : thief.radius;

  // A pool of light under the thief's feet: the dark hood would vanish
  // into the dark floor without it, and the player must always find
  // themselves at a glance.
  const glow = ctx.createRadialGradient(thief.x, thief.y, 2, thief.x, thief.y, r + 16);
  glow.addColorStop(0, 'rgba(232, 230, 223, 0.22)');
  glow.addColorStop(1, 'rgba(232, 230, 223, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(thief.x, thief.y, r + 16, 0, Math.PI * 2);
  ctx.fill();

  // A faint ring while sneaking: the game telling you you are quieter.
  if (thief.sneaking) {
    ctx.strokeStyle = 'rgba(127, 231, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(thief.x, thief.y, r + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Hooded figure: dark hood, pale face, looking where she moves.
  ctx.fillStyle = COLORS.thiefHood;
  ctx.beginPath();
  ctx.arc(thief.x, thief.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0d1226';
  ctx.lineWidth = 2;
  ctx.stroke();
  const fx = thief.x + Math.cos(thief.facing) * (r - 3);
  const fy = thief.y + Math.sin(thief.facing) * (r - 3);
  ctx.fillStyle = COLORS.thief;
  ctx.beginPath();
  ctx.arc(fx, fy, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  if (thief.hasDiamond) {
    ctx.fillStyle = '#7fe7ff';
    ctx.beginPath();
    ctx.moveTo(thief.x, thief.y - 24);
    ctx.lineTo(thief.x + 4, thief.y - 16);
    ctx.lineTo(thief.x, thief.y - 12);
    ctx.lineTo(thief.x - 4, thief.y - 16);
    ctx.closePath();
    ctx.fill();
  }
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.hudPanel;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(201, 162, 75, 0.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 8);
  ctx.stroke();
}

function drawHud(ctx, state) {
  // The alarm meter: big, top left, impossible to miss.
  panel(ctx, 28, 28, 348, 56);
  ctx.fillStyle = COLORS.mutedText;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('A L A R M', 42, 48);
  const barX = 42;
  const barY = 54;
  const barW = 320;
  const barH = 16;
  ctx.fillStyle = '#0d1226';
  roundRect(ctx, barX, barY, barW, barH, 4);
  ctx.fill();
  const frac = state.alarm / 100;
  const alarmColor = state.alarm >= 75 ? '#ff4b38' : state.alarm >= 40 ? '#ffb02e' : '#37c978';
  ctx.fillStyle = alarmColor;
  if (frac > 0) {
    roundRect(ctx, barX, barY, Math.max(6, barW * frac), barH, 4);
    ctx.fill();
  }
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(state.alarm)}%`, barX + barW, 48);

  // Loot, top right.
  panel(ctx, 904, 28, 348, 56);
  ctx.fillStyle = COLORS.mutedText;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('L O O T', 918, 48);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(money(state.thief.lootTaken), 918, 72);
  ctx.textAlign = 'right';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = state.thief.hasDiamond ? '#7fe7ff' : COLORS.mutedText;
  ctx.fillText(state.thief.hasDiamond ? '◆ Star secured' : '◆ Star not taken', 1238, 48);
  ctx.fillStyle = COLORS.mutedText;
  ctx.fillText(`${state.thief.lootCount} / 6 items`, 1238, 70);

  // Gadgets, bottom left.
  panel(ctx, 28, 648, 400, 44);
  ctx.fillStyle = COLORS.text;
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Q  Smoke ×${state.smokeLeft}  ($2,500)`, 42, 676);
  ctx.fillText(`F  EMP ×${state.empLeftCount}  ($5,000)`, 232, 676);

  // Controls, bottom right.
  ctx.fillStyle = COLORS.mutedText;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('WASD move · Shift sneak · E grab · P pause · M mute', 1252, 676);

  // A running message under the action, centre screen.
  if (state.messageLeft > 0 && state.message) {
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(state.message).width + 28;
    panel(ctx, (VIEW.width - w) / 2, 596, w, 34);
    ctx.fillStyle = COLORS.text;
    ctx.textBaseline = 'middle';
    ctx.fillText(state.message, VIEW.width / 2, 614);
    ctx.textBaseline = 'alphabetic';
  }

  // Lockdown: the police countdown, flashing, centre top.
  if (state.lockdown && state.status === 'playing') {
    const blink = Math.sin(state.time * 8) > 0;
    const label = `LOCKDOWN — POLICE IN ${Math.max(0, state.policeLeft).toFixed(1)}s`;
    ctx.font = 'bold 22px system-ui, sans-serif';
    const w = ctx.measureText(label).width + 36;
    ctx.fillStyle = blink ? 'rgba(163, 32, 24, 0.92)' : 'rgba(90, 16, 12, 0.92)';
    roundRect(ctx, (VIEW.width - w) / 2, 100, w, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, VIEW.width / 2, 123);
    ctx.textBaseline = 'alphabetic';
  }
}

function overlay(ctx, alpha) {
  ctx.fillStyle = `rgba(6, 9, 18, ${alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function centerText(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, VIEW.width / 2, y);
  ctx.textBaseline = 'alphabetic';
}

function drawTitle(ctx, state) {
  overlay(ctx, 0.82);
  centerText(ctx, 'THE MIDNIGHT VAULT', 168, 'bold 64px system-ui, sans-serif', COLORS.text);
  centerText(ctx, 'a one-room stealth heist', 214, 'italic 20px system-ui, sans-serif', COLORS.mutedText);
  ctx.strokeStyle = COLORS.wallTrim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(440, 248);
  ctx.lineTo(840, 248);
  ctx.stroke();

  const lines = [
    'The Star of Meridian sits on its pedestal in the middle of the room.',
    'Three guards walk their beats. Two cameras sweep the floor.',
    'Read the cones before you move — a case blocks sight as well as feet.',
    '',
    'WASD / arrows — move        Shift — sneak (slower, harder to spot)',
    'E — lift loot        Q — smoke bomb ($2,500)        F — EMP ($5,000)',
    '',
    'Grab the diamond, then slip out the green EXIT door, top right.',
    'If the alarm hits 100%, the museum locks down and the police come.',
  ];
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW.width / 2, 292 + i * 28);
  });
  const blink = Math.sin(state.time * 4) > -0.2;
  if (blink) centerText(ctx, '— press ENTER to begin —', 592, 'bold 20px system-ui, sans-serif', '#ffd34d');
  centerText(ctx, 'GHOST: never raise the alarm above 20% · SMOOTH: under 60% · LOUD: the rest', 640, '13px system-ui, sans-serif', COLORS.mutedText);
}

function drawPause(ctx) {
  overlay(ctx, 0.6);
  centerText(ctx, 'PAUSED', 330, 'bold 48px system-ui, sans-serif', COLORS.text);
  centerText(ctx, 'Press P to keep going', 390, '18px system-ui, sans-serif', COLORS.mutedText);
}

function drawEnd(ctx, state) {
  overlay(ctx, 0.78);
  let title = '';
  let color = COLORS.text;
  if (state.status === 'escaped') {
    title = 'CLEAN GETAWAY';
    color = '#37c978';
  } else if (state.status === 'caught') {
    title = 'CAUGHT';
    color = '#ff4b38';
  } else {
    title = 'THE POLICE ARRIVED';
    color = '#ff4b38';
  }
  centerText(ctx, title, 190, 'bold 56px system-ui, sans-serif', color);
  centerText(ctx, state.endReason, 240, '18px system-ui, sans-serif', COLORS.text);

  if (state.status === 'escaped') {
    centerText(ctx, `GRADE  ${state.grade}`, 300, 'bold 30px system-ui, sans-serif', '#ffd34d');
    const rows = [
      ['Loot lifted', money(state.thief.lootTaken)],
      ['Gadgets spent', '−' + money(state.gadgetCost)],
      ['Getaway bonus', '+' + money(5000)],
      ['SCORE', money(state.score)],
    ];
    ctx.font = '18px system-ui, sans-serif';
    rows.forEach((row, i) => {
      const y = 352 + i * 34;
      ctx.textAlign = 'left';
      ctx.fillStyle = row[0] === 'SCORE' ? '#ffd34d' : COLORS.text;
      ctx.font = row[0] === 'SCORE' ? 'bold 20px system-ui, sans-serif' : '18px system-ui, sans-serif';
      ctx.fillText(row[0], 480, y);
      ctx.textAlign = 'right';
      ctx.fillText(row[1], 800, y);
    });
    centerText(ctx, `Loudest the alarm ever got: ${Math.round(state.maxAlarm)}%`, 500, '15px system-ui, sans-serif', COLORS.mutedText);
  } else {
    centerText(ctx, `Loot lifted before it ended: ${money(state.thief.lootTaken)}`, 310, '18px system-ui, sans-serif', COLORS.text);
    centerText(ctx, `Loudest the alarm ever got: ${Math.round(state.maxAlarm)}%`, 348, '15px system-ui, sans-serif', COLORS.mutedText);
  }
  centerText(ctx, '— press R to run it again —', 580, 'bold 20px system-ui, sans-serif', '#ffd34d');
}

// Draw one frame of the game.
export function draw(ctx, state) {
  drawFloor(ctx, state);
  drawWalls(ctx, state);
  drawLoot(ctx, state);
  drawGuards(ctx, state);
  drawCameras(ctx, state);
  drawSmoke(ctx, state);
  drawThief(ctx, state);
  if (state.status !== 'title') drawHud(ctx, state);
  if (state.status === 'title') drawTitle(ctx, state);
  else if (state.paused) drawPause(ctx);
  else if (state.status === 'caught' || state.status === 'police' || state.status === 'escaped') {
    drawEnd(ctx, state);
  }
}
