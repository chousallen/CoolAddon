// AudioWorklet processor: RNNoise noise removal, one RNNoise state per channel.
//
// RNNoise is loaded as plain JavaScript (vendor/rnnoise.js, made by build-vendor.mjs),
// because the player page forbids compiling WebAssembly. Measured in Chrome
// (2026-11-05): 0.46 ms per 10 ms frame per channel.
//
// The buffering below is ported from @sapphi-red/web-noise-suppressor 0.4.1
// (src/rnnoise/processor.ts, MIT): the browser hands over 128-sample blocks,
// RNNoise works on 480-sample frames, so samples go through a 1920-sample ring
// and come out 640 samples (13 ms at 48 kHz) later.
import * as rn from './vendor/rnnoise.js';

rn.emscripten_stack_init();
rn.__wasm_call_ctors();

const FRAME = 480; // RNNoise frame: 10 ms at 48 kHz
const BLOCK = 128; // AudioWorklet block size
const RING = 1920;
const DELAY = (Math.floor(FRAME / BLOCK) + 1) * BLOCK + BLOCK; // 640
const SCALE = 0x7fff; // RNNoise expects 16-bit sample values
// RNNoise's memory never grows (build-vendor.mjs refuses growth), so one view is enough.
const heap = new Float32Array(rn.memory.buffer);

function createChannel() {
  const state = rn.rnnoise_create(0); // 0 = built-in model
  const inPtr = rn.malloc(FRAME * 4);
  const outPtr = rn.malloc(FRAME * 4);
  if (!state || !inPtr || !outPtr) throw new Error('RNNoise: out of memory');
  const inAt = inPtr >> 2;
  const outAt = outPtr >> 2;

  const ring = new Float32Array(RING);
  let input = 0;
  let pos = RING - FRAME * 2;

  function denoiseFrame(frame) {
    for (let i = 0; i < FRAME; i++) heap[inAt + i] = frame[i] * SCALE;
    rn.rnnoise_process_frame(state, outPtr, inPtr);
    for (let i = 0; i < FRAME; i++) frame[i] = heap[outAt + i] / SCALE;
  }

  return (inBlock, outBlock) => {
    ring.set(inBlock, input);
    input = (input + BLOCK) % RING;
    // 128, 512, 1024, 1536: the first multiple of 128 after each multiple of 480.
    if (input === 128 || input === 512 || input === 1024 || input === 1536) {
      pos = (pos + FRAME) % RING;
      denoiseFrame(ring.subarray(pos, pos + FRAME));
    }
    const start = (input + (RING - DELAY)) % RING;
    outBlock.set(ring.subarray(start, start + BLOCK));
  };
}

class RnnoiseProcessor extends AudioWorkletProcessor {
  channels = [];

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    for (let c = 0; c < input.length && c < output.length; c++) {
      (this.channels[c] ??= createChannel())(input[c], output[c]);
    }
    return true;
  }
}

registerProcessor('ntu-cool-video-rnnoise', RnnoiseProcessor);
