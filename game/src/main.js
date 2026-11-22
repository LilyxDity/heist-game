// The Midnight Vault — bootstrap. Wires the canvas, the input, the sound
// and the world together, then runs the loop: a fixed sixty-steps-a-second
// clock for the simulation, drawing every animation frame.
//
// The loop drains the input edge queue inside world.step, so a key pressed
// on a frame where no fixed step runs is still honoured by the next step
// instead of being lost.

import { VIEW } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createState, step, reset, STEP } from './world.js';
import { draw } from './render.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') || '1', 10);
const seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : 1;
const shotName = params.get('shot') || '';

const state = createState(seed);
const staged = shotName ? applyShot(state, shotName) : false;

const input = createInput();
input.attach(window);

const audio = createAudio();

// The handle the page, the tests and the screenshots use to reach the game.
window.__heist = {
  state,
  version: '1.0.0',
  restart() {
    // A fresh run, same seed, same object identity.
    reset(state, seed);
    state.status = 'playing';
  },
};

let lastTime = performance.now();
let accumulator = 0;
let framesDrawn = 0;

function frame(now) {
  const elapsed = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (staged) {
    // A staged shot is a still life: render the moment, never step it, or
    // the chase in the spotted shot would end before the screenshot lands.
    draw(ctx, state);
  } else {
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      step(state, STEP, input, audio);
      accumulator -= STEP;
      steps += 1;
    }
    if (steps === 5) accumulator = 0;
    draw(ctx, state);
  }

  framesDrawn += 1;
  if (framesDrawn === 2) {
    // The page is up and a frame is on the screen: screenshots may fire.
    window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

// Keep the canvas at its design size; CSS scales it to the window.
canvas.width = VIEW.width;
canvas.height = VIEW.height;

requestAnimationFrame(frame);
