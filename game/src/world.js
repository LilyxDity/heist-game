// The world: one heist, from the moment the thief slips in to the getaway.
// It owns the thief, the guards, the cameras, the loot, the alarm meter and
// the gadgets, and steps them all forward in fixed 1/60 s slices. Each step
// returns the events it caused (pickup, spotted, caught, escaped), so the
// shell can play sounds and announce them.
import { ALARM, CAMERA, COLORS, EXIT, GADGETS, LOOT_VALUE, STEP, TIME_BONUS_CAP_SECONDS, TIME_BONUS_PER_SECOND, WALL } from './config.js';
import { createCameras, disableCameras, updateCamera } from './cameras.js';
import { createGuards, guardCatchesThief, updateGuard } from './guards.js';
import { createLoot, createThief, grabLoot, lootInReach, updateThief } from './thief.js';

export const STATUS_PLAYING = 'playing';
export const STATUS_CAUGHT = 'caught';
export const STATUS_POLICE = 'police';
export const STATUS_ESCAPED = 'escaped';

export const EVENT_PICKUP = 'pickup';
export const EVENT_DIAMOND = 'diamond';
export const EVENT_SPOTTED = 'spotted';
export const EVENT_ALARM_TICK = 'alarm-tick';
export const EVENT_GADGET = 'gadget';
export const EVENT_CAUGHT = 'caught';
export const EVENT_POLICE = 'police';
export const EVENT_ESCAPED = 'escaped';
export const EVENT_LOCKDOWN = 'lockdown';

export function createWorld(random) {
  const state = {
    random,
    thief: createThief(),
    guards: createGuards(),
    cameras: createCameras(),
    loot: createLoot(),
    alarm: 0,
    maxAlarm: 0,
    lockdown: false,
    policeLeft: 0,
    smoke: [], // {x, y, radius, ttl}
    empLeft: 0,
    smokeLeft: GADGETS.smokeCount,
    empLeftCount: GADGETS.empCount,
    gadgetCost: 0,
    time: 0,
    status: STATUS_PLAYING,
    spotted: false,
    exitHintLeft: 0,
    alarmTickLeft: 0,
    floating: [], // {x, y, text, color, ttl}
    score: 0,
    timeBonus: 0,
    grade: '',
  };

  function reset() {
    // Fresh state, copied field by field onto the same object the shell
    // already holds — copy fresh.state, not the fresh world wrapper.
    const fresh = createWorld(random);
    Object.assign(state, fresh.state);
  }

  function addFloating(x, y, text, color) {
    state.floating.push({ x, y, text, color, ttl: 2.2 });
  }

  function gradeFor(maxAlarm) {
    if (maxAlarm < 25) return 'GHOST';
    if (maxAlarm < 60) return 'SMOOTH';
    return 'LOUD';
  }

  function finishEscape() {
    state.status = STATUS_ESCAPED;
    state.timeBonus = Math.max(0, TIME_BONUS_CAP_SECONDS - Math.floor(state.time)) * TIME_BONUS_PER_SECOND;
    state.score = state.thief.lootTaken + state.timeBonus - state.gadgetCost;
    state.grade = gradeFor(state.maxAlarm);
  }

  // One fixed step. `move` is the thief's move vector, `sneaking` its
  // stance, and `actions` the edge-triggered actions pressed this frame.
  function step(dt, move, sneaking, actions) {
    const events = [];
    if (state.status !== STATUS_PLAYING) return events;
    state.time += dt;

    updateThief(state.thief, move, sneaking, dt);

    for (const action of actions) {
      if (action === 'interact') {
        const item = grabLoot(state.thief, state.loot);
        if (item) {
          addFloating(item.x, item.y - 24, `+$${item.value.toLocaleString('en-US')} ${item.label}`, item.kind === 'diamond' ? COLORS.diamond : COLORS.gold);
          events.push(item.kind === 'diamond' ? EVENT_DIAMOND : EVENT_PICKUP);
        }
      } else if (action === 'smoke' && state.smokeLeft > 0) {
        state.smokeLeft -= 1;
        state.gadgetCost += GADGETS.smokeCost;
        state.smoke.push({ x: state.thief.x, y: state.thief.y, radius: GADGETS.smokeRadius, ttl: GADGETS.smokeSeconds });
        addFloating(state.thief.x, state.thief.y - 28, `SMOKE  -$${GADGETS.smokeCost.toLocaleString('en-US')}`, '#cfd6e4');
        events.push(EVENT_GADGET);
      } else if (action === 'emp' && state.empLeftCount > 0) {
        state.empLeftCount -= 1;
        state.gadgetCost += GADGETS.empCost;
        state.empLeft = GADGETS.empSeconds;
        disableCameras(state.cameras, GADGETS.empSeconds);
        addFloating(state.thief.x, state.thief.y - 28, `EMP — CAMERAS DOWN  -$${GADGETS.empCost.toLocaleString('en-US')}`, '#8fd8ff');
        events.push(EVENT_GADGET);
      }
    }

    for (const cloud of state.smoke) cloud.ttl -= dt;
    state.smoke = state.smoke.filter((cloud) => cloud.ttl > 0);
    if (state.empLeft > 0) state.empLeft = Math.max(0, state.empLeft - dt);
    if (state.exitHintLeft > 0) state.exitHintLeft -= dt;
    for (const text of state.floating) {
      text.ttl -= dt;
      text.y -= 22 * dt;
    }
    state.floating = state.floating.filter((text) => text.ttl > 0);

    for (const guard of state.guards) updateGuard(guard, dt, state.thief, state.smoke, state.lockdown);
    for (const camera of state.cameras) updateCamera(camera, dt, state.thief, state.smoke);

    // The alarm: the worst eye on the thief sets the rate; hidden, it falls.
    const seenByGuard = state.guards.some((guard) => guard.seen);
    const seenByCamera = state.cameras.some((camera) => camera.seen);
    const wasSpotted = state.spotted;
    state.spotted = seenByGuard || seenByCamera;
    if (state.spotted && !wasSpotted) events.push(EVENT_SPOTTED);
    if (state.spotted) {
      let rate = 0;
      if (seenByGuard) rate = Math.max(rate, ALARM.guardSightRate);
      if (seenByCamera) rate = Math.max(rate, CAMERA.alarmRate);
      state.alarm = Math.min(100, state.alarm + rate * dt);
      state.alarmTickLeft -= dt;
      if (state.alarmTickLeft <= 0) {
        state.alarmTickLeft = 0.5;
        events.push(EVENT_ALARM_TICK);
      }
    } else if (!state.lockdown && state.alarm < 100) {
      // A maxed alarm never decays away on its own: it locks the gallery down.
      state.alarm = Math.max(0, state.alarm - ALARM.decayRate * dt);
    }
    state.maxAlarm = Math.max(state.maxAlarm, state.alarm);

    if (state.alarm >= 100 && !state.lockdown) {
      state.lockdown = true;
      state.policeLeft = ALARM.lockdownSeconds;
      events.push(EVENT_LOCKDOWN);
    }
    if (state.lockdown) {
      state.policeLeft -= dt;
      if (state.policeLeft <= 0) {
        state.status = STATUS_POLICE;
        events.push(EVENT_POLICE);
        return events;
      }
    }

    // A chasing guard that closes the gap ends the run.
    if (state.guards.some((guard) => guardCatchesThief(guard, state.thief))) {
      state.status = STATUS_CAUGHT;
      events.push(EVENT_CAUGHT);
      return events;
    }

    // The service exit, top right: open only to a thief carrying the diamond.
    const thief = state.thief;
    const atExit = thief.y <= WALL + 16 && thief.x >= EXIT.x - 6 && thief.x <= EXIT.x + EXIT.w + 6;
    if (atExit) {
      if (thief.hasDiamond) {
        finishEscape();
        events.push(EVENT_ESCAPED);
      } else if (state.exitHintLeft <= 0) {
        state.exitHintLeft = 2.5;
        addFloating(thief.x, thief.y + 34, 'LOCKED — STEAL THE DIAMOND FIRST', '#ff8a8a');
      }
    }
    return events;
  }

  return { state, reset, step, lootInReach: () => lootInReach(state.thief, state.loot) };
}

export { STEP };
