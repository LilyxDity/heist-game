// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens:
// title, play, paused and game over.
//
// ?seed=N fixes the patrol phases. ?shot=cover|spotted|loot|escape (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_ALARM_TICK,
  EVENT_CAUGHT,
  EVENT_DIAMOND,
  EVENT_ESCAPED,
  EVENT_GADGET,
  EVENT_LOCKDOWN,
  EVENT_PICKUP,
  EVENT_POLICE,
  EVENT_SPOTTED,
  STATUS_PLAYING,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_EMP,
  ACTION_INTERACT,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  ACTION_SMOKE,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH, createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score lasts this visit.
  }
}

// A small live snapshot for play-testing and debugging from the console.
window.__heist = {
  get state() {
    return world.state;
  },
};

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, readBest(), null, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  // Edge actions for the world (grab, smoke, EMP) queue up here until a
  // fixed step consumes them: a press must never be lost to a short frame
  // that runs no step at all.
  const edgeQueue = [];
  const EDGE_ACTIONS = {
    [ACTION_INTERACT]: 'interact',
    [ACTION_SMOKE]: 'smoke',
    [ACTION_EMP]: 'emp',
  };

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.click();
    announce('Playing. Steal the Star of Meridian, then reach the service exit.');
  }

  function handleEvents(events) {
    for (const event of events) {
      if (event === EVENT_PICKUP) audio.pickup();
      else if (event === EVENT_DIAMOND) {
        audio.diamond();
        announce('You have the diamond. Reach the service exit.');
      } else if (event === EVENT_GADGET) audio.gadget();
      else if (event === EVENT_SPOTTED) {
        audio.spotted();
        announce('Spotted! Get out of the cone.');
      } else if (event === EVENT_ALARM_TICK) audio.alarmTick();
      else if (event === EVENT_LOCKDOWN) announce('Lockdown! The police are on their way.');
      else if (event === EVENT_CAUGHT || event === EVENT_POLICE) {
        audio.caught();
        screen = SCREEN_OVER;
        announce(event === EVENT_CAUGHT ? 'Caught by a guard.' : 'The police stormed in.');
      } else if (event === EVENT_ESCAPED) {
        audio.escaped();
        screen = SCREEN_OVER;
        if (world.state.score > best) {
          best = world.state.score;
          saveBest(best);
        }
        announce(`Clean getaway. Score ${world.state.score}.`);
      }
    }
  }

  function clickHits(button, click) {
    return click.x >= button.x && click.x <= button.x + button.w && click.y >= button.y && click.y <= button.y + button.h;
  }

  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    const actions = input.takeActions();
    for (const action of actions) {
      if (EDGE_ACTIONS[action]) edgeQueue.push(EDGE_ACTIONS[action]);
    }
    const clicks = input.takeClicks();

    if (actions.includes(ACTION_MUTE)) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }

    if (screen === SCREEN_TITLE) {
      if (actions.includes(ACTION_CONFIRM)) startGame();
      for (const click of clicks) {
        if (renderer.buttons().some((button) => button.id === 'start' && clickHits(button, click))) startGame();
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions.includes(ACTION_PAUSE)) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions.includes(ACTION_RESTART)) {
        startGame();
      } else {
        accumulator += elapsed;
        while (accumulator >= STEP) {
          accumulator -= STEP;
          const stepActions = edgeQueue.splice(0, edgeQueue.length);
          const events = world.step(STEP, input.moveVector(), input.sneaking(), stepActions);
          handleEvents(events);
          if (world.state.status !== STATUS_PLAYING) {
            accumulator = 0;
            break;
          }
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions.includes(ACTION_PAUSE) || actions.includes(ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions.includes(ACTION_RESTART)) {
        startGame();
      }
    } else if (screen === SCREEN_OVER) {
      if (actions.includes(ACTION_RESTART) || actions.includes(ACTION_CONFIRM)) startGame();
      for (const click of clicks) {
        if (renderer.buttons().some((button) => button.id === 'retry' && clickHits(button, click))) startGame();
      }
    }

    const interactTarget = screen === SCREEN_PLAY ? world.lootInReach() : null;
    renderer.draw(world.state, screen, best, interactTarget, audio.isMuted());
    requestAnimationFrame(frame);
  }

  renderer.draw(world.state, screen, best, null, audio.isMuted());
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
