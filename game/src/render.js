// The renderer: one canvas, everything drawn in code — the vault hall, the
// sweeping vision cones (raycast, so they wrap around the pillars), the
// guards, the cameras, the loot and the thief, plus the HUD bar along the
// bottom and the title, pause and end screens. No images, no fonts to load.
import { CAMERA, COLORS, COVER, ENTRY, EXIT, GADGETS, GUARD, VAULT, WALL, WORLD } from './config.js';
import { GUARD_CHASE } from './guards.js';
import { BLOCKERS } from './geometry.js';
import { STATUS_CAUGHT, STATUS_ESCAPED, STATUS_POLICE } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export const HUD_HEIGHT = 64;
export const CANVAS_WIDTH = WORLD.width;
export const CANVAS_HEIGHT = WORLD.height + HUD_HEIGHT;

const FONT = 'system-ui, "Segoe UI", Arial, sans-serif';
const CONE_RAYS = 26;

function money(value) {
  return `$${value.toLocaleString('en-US')}`;
}

function clock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function pointInBlocker(x, y) {
  return BLOCKERS.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

// A vision cone as a polygon: cast rays across the cone and stop each one
// where it first hits a wall, a pillar or a case, so the cone hugs the cover.
function conePolygon(ox, oy, facing, range, halfAngle) {
  const points = [[ox, oy]];
  for (let i = 0; i <= CONE_RAYS; i += 1) {
    const angle = facing - halfAngle + (2 * halfAngle * i) / CONE_RAYS;
    let reach = range;
    for (let d = 12; d <= range; d += 10) {
      const x = ox + Math.cos(angle) * d;
      const y = oy + Math.sin(angle) * d;
      if (x < WALL || x > WORLD.width - WALL || y < WALL || y > WORLD.height - WALL || pointInBlocker(x, y)) {
        reach = d;
        break;
      }
    }
    points.push([ox + Math.cos(angle) * reach, oy + Math.sin(angle) * reach]);
  }
  return points;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let buttons = [];

  function text(str, x, y, size, color, align = 'left', weight = 600) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function drawFloor() {
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = COLORS.floorTile;
    for (let y = 0; y < WORLD.height / 80; y += 1) {
      for (let x = 0; x < WORLD.width / 80; x += 1) {
        if ((x + y) % 2 === 0) ctx.fillRect(x * 80, y * 80, 80, 80);
      }
    }
    // The red carpet runs from the entry door up to the vault.
    ctx.fillStyle = COLORS.carpet;
    ctx.fillRect(596, VAULT.y + VAULT.h, 88, WORLD.height - WALL - (VAULT.y + VAULT.h));
    ctx.fillStyle = COLORS.carpetEdge;
    ctx.fillRect(596, VAULT.y + VAULT.h, 4, WORLD.height - WALL - (VAULT.y + VAULT.h));
    ctx.fillRect(680, VAULT.y + VAULT.h, 4, WORLD.height - WALL - (VAULT.y + VAULT.h));
  }

  function drawWalls(state) {
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(0, 0, WORLD.width, WALL);
    ctx.fillRect(0, WORLD.height - WALL, WORLD.width, WALL);
    ctx.fillRect(0, 0, WALL, WORLD.height);
    ctx.fillRect(WORLD.width - WALL, 0, WALL, WORLD.height);
    ctx.fillStyle = COLORS.wallTop;
    ctx.fillRect(0, WALL - 4, WORLD.width, 4);
    ctx.fillRect(0, WORLD.height - WALL, WORLD.width, 4);
    // Entry door (bottom centre) and service exit (top right): dark openings.
    ctx.fillStyle = '#0c0f16';
    ctx.fillRect(ENTRY.x, WORLD.height - WALL, ENTRY.w, WALL);
    ctx.fillRect(EXIT.x, 0, EXIT.w, WALL);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(ENTRY.x, WORLD.height - WALL, ENTRY.w, WALL);
    ctx.strokeStyle = state.thief.hasDiamond ? '#59d98c' : '#5a6b87';
    ctx.strokeRect(EXIT.x, 0, EXIT.w, WALL);
    text('ENTRY', ENTRY.x + ENTRY.w / 2, WORLD.height - WALL - 14, 11, COLORS.muted, 'center');
    text('SERVICE EXIT', EXIT.x + EXIT.w / 2, WALL + 16, 11, state.thief.hasDiamond ? '#59d98c' : COLORS.muted, 'center');
    if (state.thief.hasDiamond) {
      text('▲ GET OUT', EXIT.x + EXIT.w / 2, WALL + 34, 12, '#59d98c', 'center', 800);
    }
  }

  function drawCover() {
    for (const rect of COVER) {
      ctx.fillStyle = COLORS.cover;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = COLORS.coverTop;
      ctx.fillRect(rect.x, rect.y, rect.w, 8);
      ctx.strokeStyle = '#4a5c80';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      if (rect.kind === 'case') {
        ctx.fillStyle = 'rgba(140, 180, 220, 0.18)';
        ctx.fillRect(rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12);
        ctx.strokeStyle = 'rgba(200, 225, 255, 0.5)';
        ctx.beginPath();
        ctx.moveTo(rect.x + 10, rect.y + rect.h - 10);
        ctx.lineTo(rect.x + rect.w - 14, rect.y + 10);
        ctx.stroke();
      } else if (rect.kind === 'crate') {
        ctx.strokeStyle = '#7a5c33';
        ctx.beginPath();
        ctx.moveTo(rect.x + 6, rect.y + 6);
        ctx.lineTo(rect.x + rect.w - 6, rect.y + rect.h - 6);
        ctx.moveTo(rect.x + rect.w - 6, rect.y + 6);
        ctx.lineTo(rect.x + 6, rect.y + rect.h - 6);
        ctx.stroke();
      } else {
        ctx.fillStyle = COLORS.gold;
        ctx.fillRect(rect.x + 8, rect.y + 8, rect.w - 16, 3);
      }
    }
  }

  function drawDiamondIcon(x, y, size, glow) {
    if (glow) {
      const gradient = ctx.createRadialGradient(x, y, 2, x, y, size * 2.4);
      gradient.addColorStop(0, COLORS.goldGlow);
      gradient.addColorStop(1, 'rgba(255, 201, 60, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, size * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = COLORS.diamond;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.8, y - size * 0.2);
    ctx.lineTo(x + size * 0.45, y + size);
    ctx.lineTo(x - size * 0.45, y + size);
    ctx.lineTo(x - size * 0.8, y - size * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawVaultAndLoot(state) {
    // The vault pedestal.
    ctx.fillStyle = '#3a2f22';
    ctx.fillRect(VAULT.x, VAULT.y, VAULT.w, VAULT.h);
    ctx.fillStyle = '#57462e';
    ctx.fillRect(VAULT.x, VAULT.y, VAULT.w, 10);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(VAULT.x + 1, VAULT.y + 1, VAULT.w - 2, VAULT.h - 2);
    text('VAULT', VAULT.x + VAULT.w / 2, VAULT.y + VAULT.h + 14, 11, COLORS.muted, 'center');

    for (const item of state.loot) {
      if (item.taken) continue;
      if (item.kind === 'diamond') {
        const bob = Math.sin(state.time * 2.2) * 3;
        drawDiamondIcon(item.x, item.y + bob, 13, true);
        text('★ STAR OF MERIDIAN ★', item.x, item.y - 34, 13, COLORS.gold, 'center', 800);
      } else if (item.kind === 'gold') {
        ctx.fillStyle = COLORS.gold;
        ctx.fillRect(item.x - 11, item.y - 7, 22, 14);
        ctx.fillStyle = '#ffe27a';
        ctx.fillRect(item.x - 11, item.y - 7, 22, 4);
        ctx.strokeStyle = '#a87c1f';
        ctx.lineWidth = 1;
        ctx.strokeRect(item.x - 11.5, item.y - 7.5, 23, 15);
      } else {
        // Painting: a gilt frame on the wall with a little landscape in it.
        ctx.fillStyle = '#8a6d2f';
        ctx.fillRect(item.x - 16, item.y - 20, 32, 40);
        ctx.fillStyle = '#274b73';
        ctx.fillRect(item.x - 12, item.y - 16, 24, 32);
        ctx.fillStyle = '#e8d27a';
        ctx.beginPath();
        ctx.arc(item.x - 4, item.y - 8, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2f7a4a';
        ctx.fillRect(item.x - 12, item.y + 4, 24, 12);
      }
    }
  }

  function drawCones(state) {
    for (const camera of state.cameras) {
      if (camera.disabledLeft > 0) continue;
      const poly = conePolygon(camera.x, camera.y, camera.angle, CAMERA.viewRange, CAMERA.viewHalfAngle);
      ctx.fillStyle = COLORS.cameraCone;
      ctx.strokeStyle = COLORS.cameraConeEdge;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i][0], poly[i][1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    for (const guard of state.guards) {
      const poly = conePolygon(guard.x, guard.y, guard.facing, GUARD.viewRange, GUARD.viewHalfAngle);
      ctx.fillStyle = guard.mode === GUARD_CHASE ? 'rgba(255, 82, 82, 0.28)' : COLORS.guardCone;
      ctx.strokeStyle = guard.mode === GUARD_CHASE ? 'rgba(255, 82, 82, 0.6)' : COLORS.guardConeEdge;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i][0], poly[i][1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawSmoke(state) {
    for (const cloud of state.smoke) {
      const alpha = Math.min(1, cloud.ttl / 2);
      ctx.fillStyle = `rgba(200, 205, 215, ${0.55 * alpha})`;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(220, 224, 232, ${0.4 * alpha})`;
      ctx.beginPath();
      ctx.arc(cloud.x - 20, cloud.y - 12, cloud.radius * 0.6, 0, Math.PI * 2);
      ctx.arc(cloud.x + 24, cloud.y + 10, cloud.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      const off = camera.disabledLeft > 0;
      ctx.fillStyle = '#141a28';
      ctx.fillRect(camera.x - 12, camera.y - 10, 24, 16);
      ctx.strokeStyle = off ? '#5a6b87' : '#ff7a5d';
      ctx.lineWidth = 2;
      ctx.strokeRect(camera.x - 12, camera.y - 10, 24, 16);
      ctx.fillStyle = off ? '#5a6b87' : '#ff5252';
      ctx.beginPath();
      ctx.arc(camera.x, camera.y + 8, 5, 0, Math.PI * 2);
      ctx.fill();
      // A short barrel showing where the lens points.
      const bx = camera.x + Math.cos(camera.angle) * 14;
      const by = camera.y + 8 + Math.sin(camera.angle) * 14;
      ctx.strokeStyle = off ? '#5a6b87' : '#ffb199';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(camera.x, camera.y + 8);
      ctx.lineTo(bx, by);
      ctx.stroke();
      if (off) text('OFF', camera.x, camera.y + 30, 11, '#8fd8ff', 'center', 800);
      else if (camera.seen) text('● REC', camera.x, camera.y + 30, 11, '#ff5252', 'center', 800);
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(guard.x, guard.y + 12, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Body: a red-uniformed guard with a facing tick.
      ctx.fillStyle = '#c93a3a';
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7d1f1f';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffd9d9';
      ctx.beginPath();
      ctx.arc(guard.x + Math.cos(guard.facing) * 6, guard.y + Math.sin(guard.facing) * 6, 5, 0, Math.PI * 2);
      ctx.fill();
      text(guard.name, guard.x, guard.y - 26, 10, COLORS.muted, 'center', 700);
      // Suspicion bar above the head.
      if (guard.suspicion > 1 && guard.mode !== GUARD_CHASE) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(guard.x - 16, guard.y - 22, 32, 5);
        ctx.fillStyle = guard.suspicion > 60 ? '#ff5252' : '#ffc93c';
        ctx.fillRect(guard.x - 16, guard.y - 22, (32 * guard.suspicion) / 100, 5);
      }
      if (guard.mode === GUARD_CHASE) {
        text('!', guard.x, guard.y - 40, 26, '#ff5252', 'center', 900);
      } else if (guard.suspicion > 25) {
        text('?', guard.x, guard.y - 40, 22, '#ffc93c', 'center', 900);
      }
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(thief.x, thief.y + 12, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (thief.sneaking) {
      ctx.strokeStyle = 'rgba(89, 217, 140, 0.8)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(thief.x, thief.y, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = COLORS.thief;
    ctx.beginPath();
    ctx.arc(thief.x, thief.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a6478';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Hood and facing tick.
    ctx.fillStyle = COLORS.thiefDark;
    ctx.beginPath();
    ctx.arc(thief.x, thief.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd9d9';
    ctx.beginPath();
    ctx.arc(thief.x + Math.cos(thief.facing) * 6, thief.y + Math.sin(thief.facing) * 6, 3, 0, Math.PI * 2);
    ctx.fill();
    if (thief.hasDiamond) drawDiamondIcon(thief.x, thief.y - 26, 7, false);
  }

  function drawFloating(state) {
    for (const item of state.floating) {
      ctx.globalAlpha = Math.min(1, item.ttl);
      text(item.text, item.x, item.y, 14, item.color, 'center', 800);
      ctx.globalAlpha = 1;
    }
  }

  function drawAlerts(state) {
    if (state.lockdown) {
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 6);
      ctx.fillStyle = `rgba(255, 40, 40, ${0.12 + 0.08 * pulse})`;
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      ctx.fillStyle = 'rgba(20, 0, 0, 0.75)';
      ctx.fillRect(WORLD.width / 2 - 260, 76, 520, 40);
      ctx.strokeStyle = '#ff5252';
      ctx.lineWidth = 2;
      ctx.strokeRect(WORLD.width / 2 - 260, 76, 520, 40);
      text(`LOCKDOWN — POLICE IN ${Math.max(0, Math.ceil(state.policeLeft))}s — RUN!`, WORLD.width / 2, 97, 20, '#ff6b6b', 'center', 900);
      return;
    }
    if (state.spotted) {
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 8);
      const gradient = ctx.createRadialGradient(
        WORLD.width / 2, WORLD.height / 2, WORLD.height * 0.36,
        WORLD.width / 2, WORLD.height / 2, WORLD.height * 0.75,
      );
      gradient.addColorStop(0, 'rgba(255, 40, 40, 0)');
      gradient.addColorStop(1, `rgba(255, 40, 40, ${0.22 + 0.14 * pulse})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      if (Math.floor(state.time * 3) % 2 === 0) {
        text('SPOTTED!', WORLD.width / 2, 96, 26, '#ff5252', 'center', 900);
      }
    }
  }

  function drawInteractPrompt(target) {
    if (!target) return;
    const label = target.kind === 'diamond' ? 'GRAB THE STAR OF MERIDIAN' : `GRAB ${target.label}`;
    const w = 30 + label.length * 9;
    ctx.fillStyle = 'rgba(10, 14, 24, 0.85)';
    ctx.fillRect(target.x - w / 2, target.y - 58, w, 26);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(target.x - w / 2, target.y - 58, w, 26);
    text(`E — ${label}`, target.x, target.y - 45, 13, COLORS.gold, 'center', 800);
  }

  function alarmColor(value) {
    if (value < 40) return COLORS.alarmLow;
    if (value < 75) return COLORS.alarmMid;
    return COLORS.alarmHigh;
  }

  function drawHud(state, muted) {
    const y0 = WORLD.height;
    ctx.fillStyle = '#0d111c';
    ctx.fillRect(0, y0, WORLD.width, HUD_HEIGHT);
    ctx.fillStyle = '#232c42';
    ctx.fillRect(0, y0, WORLD.width, 2);

    // Left: loot and the diamond status icon (dimmed until it is stolen).
    text('LOOT', 18, y0 + 20, 11, COLORS.muted, 'left', 800);
    text(money(state.thief.lootTaken), 18, y0 + 42, 22, COLORS.gold, 'left', 800);
    ctx.globalAlpha = state.thief.hasDiamond ? 1 : 0.25;
    drawDiamondIcon(196, y0 + 30, 9, false);
    ctx.globalAlpha = 1;
    text(state.thief.hasDiamond ? 'DIAMOND SECURED' : 'DIAMOND: ON THE PEDESTAL', 212, y0 + 30, 11, state.thief.hasDiamond ? '#59d98c' : COLORS.muted, 'left', 700);

    // Centre: the alarm meter.
    const meterX = WORLD.width / 2 - 190;
    const meterW = 380;
    text('ALARM', meterX, y0 + 20, 11, COLORS.muted, 'left', 800);
    text(`${Math.floor(state.alarm)}%`, meterX + meterW, y0 + 20, 11, alarmColor(state.alarm), 'right', 800);
    ctx.fillStyle = '#1d2536';
    ctx.fillRect(meterX, y0 + 28, meterW, 16);
    ctx.fillStyle = alarmColor(state.alarm);
    ctx.fillRect(meterX, y0 + 28, (meterW * state.alarm) / 100, 16);
    ctx.strokeStyle = '#3a4763';
    ctx.lineWidth = 1;
    ctx.strokeRect(meterX + 0.5, y0 + 28.5, meterW - 1, 15);

    // Right: gadgets and the clock.
    const gx = WORLD.width - 18;
    text(`TIME ${clock(state.time)}`, gx, y0 + 20, 13, COLORS.text, 'right', 700);
    const smokeLabel = `Q  SMOKE ×${state.smokeLeft}`;
    const empLabel = `F  EMP ×${state.empLeftCount}`;
    text(smokeLabel, gx - 150, y0 + 42, 12, state.smokeLeft > 0 ? COLORS.text : '#4a556e', 'right', 700);
    text(empLabel, gx, y0 + 42, 12, state.empLeftCount > 0 ? COLORS.text : '#4a556e', 'right', 700);
    if (state.empLeft > 0) text(`CAMERAS DOWN ${Math.ceil(state.empLeft)}s`, gx - 150, y0 + 20, 11, '#8fd8ff', 'right', 800);
    if (muted) text('MUTED', 18, y0 + 58, 10, COLORS.muted, 'left', 700);

    // Bottom line: objective and controls.
    const objective = state.thief.hasDiamond
      ? 'OBJECTIVE: Reach the SERVICE EXIT (top right) — get out clean.'
      : 'OBJECTIVE: Steal the STAR OF MERIDIAN from the vault, then reach the SERVICE EXIT.';
    text(objective, 18, y0 + 58, 11, COLORS.muted, 'left', 600);
    text('WASD move · SHIFT sneak · E grab · Q smoke · F EMP · P pause', WORLD.width - 18, y0 + 58, 11, COLORS.muted, 'right', 600);
  }

  function drawButton(id, x, y, w, h, label) {
    buttons.push({ id, x, y, w, h });
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#131720';
    text(label, x + w / 2, y + h / 2 + 1, 20, '#131720', 'center', 900);
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(8, 10, 18, 0.72)';
    ctx.fillRect(0, 0, WORLD.width, CANVAS_HEIGHT);
    text('THE MIDNIGHT VAULT', WORLD.width / 2, 190, 62, COLORS.text, 'center', 900);
    text('A ONE-ROOM HEIST AT THE MERIDIAN GALLERY', WORLD.width / 2, 238, 18, COLORS.gold, 'center', 700);
    text('Three guards. Two cameras. One diamond. Cross the hall, take the Star of Meridian,', WORLD.width / 2, 300, 16, COLORS.muted, 'center', 600);
    text('and slip out through the service exit before the alarm brings the police.', WORLD.width / 2, 324, 16, COLORS.muted, 'center', 600);
    text('WASD / ARROWS — move          SHIFT — sneak (harder to spot)', WORLD.width / 2, 372, 15, COLORS.text, 'center', 600);
    text('E — grab loot          Q — smoke bomb ($2,500)          F — EMP, kills cameras ($5,000)', WORLD.width / 2, 398, 15, COLORS.text, 'center', 600);
    text('Stay out of the cones. If a guard fills with suspicion, it chases. If the alarm maxes out,', WORLD.width / 2, 438, 14, COLORS.muted, 'center', 600);
    text('you have 12 seconds before the police storm in.', WORLD.width / 2, 460, 14, COLORS.muted, 'center', 600);
    drawButton('start', WORLD.width / 2 - 130, 500, 260, 56, 'START THE HEIST');
    text('or press ENTER', WORLD.width / 2, 578, 13, COLORS.muted, 'center', 600);
    if (best > 0) text(`BEST TAKE: ${money(best)}`, WORLD.width / 2, 614, 15, COLORS.gold, 'center', 800);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(8, 10, 18, 0.66)';
    ctx.fillRect(0, 0, WORLD.width, CANVAS_HEIGHT);
    text('PAUSED', WORLD.width / 2, CANVAS_HEIGHT / 2 - 20, 48, COLORS.text, 'center', 900);
    text('Press P or Esc to resume · R to restart the heist', WORLD.width / 2, CANVAS_HEIGHT / 2 + 28, 16, COLORS.muted, 'center', 600);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(8, 10, 18, 0.78)';
    ctx.fillRect(0, 0, WORLD.width, CANVAS_HEIGHT);
    const escaped = state.status === STATUS_ESCAPED;
    const title = escaped ? 'CLEAN GETAWAY' : state.status === STATUS_CAUGHT ? 'CAUGHT!' : 'THE POLICE STORMED IN';
    const color = escaped ? COLORS.gold : '#ff5252';
    text(title, WORLD.width / 2, 190, 56, color, 'center', 900);
    const sub = escaped
      ? `You slipped out of the Meridian Gallery with the Star of Meridian. Grade: ${state.grade}`
      : state.status === STATUS_CAUGHT
        ? 'A guard got hands on you. Read the cones, then move — the hall rewards patience.'
        : 'The alarm maxed out and the police arrived before you reached the exit.';
    text(sub, WORLD.width / 2, 242, 16, COLORS.muted, 'center', 600);

    const rows = escaped
      ? [
          ['Loot taken', money(state.thief.lootTaken)],
          ['Time bonus', `+${money(state.timeBonus)}`],
          ['Gadgets used', `-${money(state.gadgetCost)}`],
          ['FINAL SCORE', money(state.score)],
        ]
      : [
          ['Loot taken', money(state.thief.lootTaken)],
          ['Time survived', clock(state.time)],
          ['Peak alarm', `${Math.floor(state.maxAlarm)}%`],
        ];
    let y = 310;
    for (const [label, value] of rows) {
      const strong = label === 'FINAL SCORE';
      text(label, WORLD.width / 2 - 190, y, strong ? 20 : 16, strong ? COLORS.gold : COLORS.text, 'left', strong ? 900 : 600);
      text(value, WORLD.width / 2 + 190, y, strong ? 20 : 16, strong ? COLORS.gold : COLORS.text, 'right', strong ? 900 : 600);
      y += strong ? 44 : 34;
    }
    if (escaped && state.score >= best && best > 0) text('NEW BEST TAKE!', WORLD.width / 2, y + 6, 16, '#59d98c', 'center', 900);
    drawButton('retry', WORLD.width / 2 - 130, 520, 260, 56, escaped ? 'HEIST AGAIN' : 'TRY AGAIN');
    text('or press R', WORLD.width / 2, 598, 13, COLORS.muted, 'center', 600);
  }

  function drawWorld(state, interactTarget) {
    drawFloor();
    drawCover();
    drawWalls(state);
    drawVaultAndLoot(state);
    drawCones(state);
    drawSmoke(state);
    drawCameras(state);
    drawGuards(state);
    drawThief(state);
    drawFloating(state);
    drawInteractPrompt(interactTarget);
    drawAlerts(state);
  }

  return {
    draw(state, screen, best, interactTarget, muted) {
      buttons = [];
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawWorld(state, screen === SCREEN_PLAY ? interactTarget : null);
      drawHud(state, muted);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawOver(state, best);
    },
    buttons() {
      return buttons;
    },
  };
}
