// The world: the whole game state and one fixed step of it. The state is a
// single plain object so the page, the tests and the screenshots can all
// read it through window.__heist.state, and so a restart can swap in a
// fresh one without changing the object's identity.
//
// Statuses: 'title' -> 'playing' -> 'caught' | 'police' | 'escaped'.
// The alarm climbs while anyone sees the thief; at 100 the museum locks
// down and the police arrive twelve seconds later.

import { ALARM, EXIT, GADGETS, LOOT, RULES, WALLS } from './config.js';
import { makeGuards, updateGuard } from './guards.js';
import { makeCameras, updateCamera } from './cameras.js';
import { makeThief, updateThief, tryGrab, useSmoke, useEmp } from './thief.js';

export const STEP = 1 / 60;

// A brand-new run: title screen up, thief at the spawn, everyone on beat.
export function createState(seed) {
  return {
    seed: seed || 1,
    status: 'title',
    paused: false,
    time: 0,
    alarm: 0,
    maxAlarm: 0,
    lockdown: false,
    policeLeft: ALARM.lockdownSeconds,
    spotted: false,
    everSpotted: false,
    score: 0,
    grade: '—',
    endReason: '',
    thief: makeThief(),
    guards: makeGuards(),
    cameras: makeCameras(),
    loot: LOOT.map((item) => ({ ...item, taken: false })),
    walls: WALLS,
    smoke: [],
    smokeLeft: GADGETS.smoke.startCount,
    empLeftCount: GADGETS.emp.startCount,
    gadgetCost: 0,
    message: '',
    messageLeft: 0,
    blipLeft: 0,
  };
}

// Restart in place: copy a fresh state over this one, field by field, so
// every reference to the state object keeps working. Copying the fresh
// state itself — not any wrapper around it — is what makes this correct.
export function reset(state, seed) {
  const fresh = createState(seed === undefined ? state.seed : seed);
  Object.assign(state, fresh);
}

export function setMessage(state, text, seconds) {
  state.message = text;
  state.messageLeft = seconds || 2.5;
}

function money(n) {
  return '$' + n.toLocaleString('en-US');
}

// The getaway pays off: loot, minus what the gadgets cost, plus a bonus
// for getting out at all. The grade reads the worst the alarm ever got.
export function finishEscape(state) {
  state.status = 'escaped';
  state.score = Math.max(0, state.thief.lootTaken - state.gadgetCost + RULES.escapeBonus);
  if (state.maxAlarm <= RULES.ghostMaxAlarm) state.grade = 'GHOST';
  else if (state.maxAlarm <= RULES.smoothMaxAlarm) state.grade = 'SMOOTH';
  else state.grade = 'LOUD';
  state.endReason = 'You slipped out the roof door with the Star of Meridian.';
}

function finishCaught(state) {
  state.status = 'caught';
  state.endReason = 'A guard got a hand on you under the skylight.';
}

function finishPolice(state) {
  state.status = 'police';
  state.endReason = 'The police arrived while the doors were locked down.';
}

function startRun(state) {
  reset(state, state.seed);
  state.status = 'playing';
  setMessage(state, 'Get the Star of Meridian. Get out the roof door.', 4);
}

// Handle one pressed key. The queue is drained by the step loop, so a key
// pressed on a frame with no step in it is still honoured by the next one.
function handleEdge(state, code, audio) {
  if (code === 'KeyM') {
    audio.toggleMute();
    return;
  }

  if (state.status === 'title') {
    if (code === 'Enter' || code === 'Space') {
      audio.click();
      startRun(state);
    }
    return;
  }

  if (state.status === 'caught' || state.status === 'police' || state.status === 'escaped') {
    if (code === 'KeyR' || code === 'Enter') {
      audio.click();
      startRun(state);
    }
    return;
  }

  if (state.status !== 'playing') return;

  if (code === 'KeyP' || code === 'Escape') {
    state.paused = !state.paused;
    return;
  }
  if (state.paused) return;

  if (code === 'KeyE') {
    const item = tryGrab(state);
    if (item) {
      audio.pickup(item.kind === 'diamond');
      setMessage(state, `+${money(item.value)} — ${item.name}`, 2.5);
      if (item.kind === 'diamond') {
        setMessage(state, 'The Star is yours. Now get out — roof door, top right.', 4);
      }
    }
    return;
  }

  if (code === 'KeyQ') {
    if (useSmoke(state)) {
      audio.smoke();
      setMessage(state, `Smoke out. −${money(GADGETS.smoke.cost)}`, 2);
    } else {
      setMessage(state, 'No smoke bombs left.', 1.5);
    }
    return;
  }

  if (code === 'KeyF') {
    if (useEmp(state)) {
      audio.emp();
      setMessage(state, `EMP fired — cameras dark. −${money(GADGETS.emp.cost)}`, 2);
    } else {
      setMessage(state, 'No EMP charges left.', 1.5);
    }
  }
}

// One fixed step of the world: a sixtieth of a second of play.
export function step(state, dt, input, audio) {
  for (const code of input.drainEdges()) {
    handleEdge(state, code, audio);
  }

  if (state.status !== 'playing' || state.paused) return;

  state.time += dt;

  updateThief(state.thief, dt, input);

  for (const guard of state.guards) {
    const event = updateGuard(guard, dt, {
      thief: state.thief,
      walls: state.walls,
      smoke: state.smoke,
    });
    if (event === 'chase') audio.alert();
    if (event === 'caught') {
      audio.caught();
      finishCaught(state);
      return;
    }
  }

  for (const cam of state.cameras) {
    updateCamera(cam, dt, state.time, state.thief, state.walls, state.smoke);
  }

  for (let i = state.smoke.length - 1; i >= 0; i -= 1) {
    state.smoke[i].left -= dt;
    if (state.smoke[i].left <= 0) state.smoke.splice(i, 1);
  }

  // The alarm: up while anyone watches, down while nobody does — but never
  // down from a full alarm, or the lockdown would flicker and the police
  // countdown with it.
  let rate = 0;
  let anySeen = false;
  let anyChase = false;
  for (const guard of state.guards) {
    if (guard.seen) {
      rate += ALARM.guardSeenRate;
      anySeen = true;
    }
    if (guard.mode === 'chase') {
      rate += ALARM.chaseRate;
      anyChase = true;
    }
  }
  for (const cam of state.cameras) {
    if (cam.seen) {
      rate += ALARM.cameraSeenRate;
      anySeen = true;
    }
  }
  state.spotted = anySeen || anyChase;
  if (state.spotted) state.everSpotted = true;

  if (rate > 0) {
    state.alarm = Math.min(ALARM.max, state.alarm + rate * dt);
    state.blipLeft -= dt;
    if (state.alarm >= 50 && state.blipLeft <= 0) {
      audio.alarmBlip();
      state.blipLeft = 1.1;
    }
  } else if (state.alarm < ALARM.max) {
    state.alarm = Math.max(0, state.alarm - ALARM.decayRate * dt);
  }
  state.maxAlarm = Math.max(state.maxAlarm, state.alarm);

  if (state.alarm >= ALARM.max && !state.lockdown) {
    state.lockdown = true;
    state.policeLeft = ALARM.lockdownSeconds;
    audio.alert();
    setMessage(state, 'LOCKDOWN — the police are on their way!', 4);
  }

  if (state.lockdown) {
    state.policeLeft -= dt;
    if (state.policeLeft <= 0) {
      audio.caught();
      finishPolice(state);
      return;
    }
  }

  if (state.messageLeft > 0) state.messageLeft -= dt;

  // The getaway: diamond in hand, through the roof door at the top right.
  const thief = state.thief;
  if (
    thief.hasDiamond &&
    thief.y <= EXIT.triggerY &&
    thief.x >= EXIT.minX &&
    thief.x <= EXIT.maxX
  ) {
    audio.win();
    finishEscape(state);
  }
}
