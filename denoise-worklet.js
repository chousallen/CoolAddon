// AudioWorklet processor: GTCRN noise removal for up to two channels.
//
// GTCRN is loaded as plain JavaScript (vendor/gtcrn.js, made by build-gtcrn.sh),
// because the player page forbids compiling WebAssembly. Measured in Node
// (2026-11-06): about 1.1 ms per 16 ms frame per channel on a fast laptop,
// 2.5 ms on a slow one in power-saver.
//
// The browser hands over 128-sample blocks; GTCRN's 48 kHz mode works on
// 768-sample frames (6 blocks). Input blocks are collected until a frame is
// full, then the frame is denoised and played back over the next 6 blocks. That
// adds 768 samples (16 ms) to GTCRN's own 18.5 ms delay.
//
// Lecture videos are usually mono recordings stored as stereo, with left and
// right equal. Then GTCRN runs once and both sides play the result, which
// halves the work. When the sides differ, each side is denoised on its own.
import * as gt from './vendor/gtcrn.js';

gt._initialize();

const FRAME = 768; // GTCRN frame at 48 kHz: 16 ms
const BLOCK = 128; // AudioWorklet block size
// Left and right count as equal when no sample differs by more than this
// (-60 dB of full scale; decoded AAC lectures differ by at most ~3e-4).
const SAME = 1e-3;
// After the sides have differed, wait this many equal frames (0.5 s) before
// sharing again, so the mode does not flip back and forth.
const SETTLE = 30;
// GTCRN's memory never grows (build-gtcrn.sh turns growth off), so one view is enough.
const heap = new Float32Array(gt.memory.buffer);

function createState() {
  const state = gt.gtcrn_create();
  const inPtr = gt.malloc(FRAME * 4);
  const outPtr = gt.malloc(FRAME * 4);
  if (!state || !inPtr || !outPtr) throw new Error('GTCRN: out of memory');
  return { state, inPtr, outPtr };
}

function destroyState(st) {
  gt.gtcrn_destroy(st.state);
  gt.free(st.inPtr);
  gt.free(st.outPtr);
}

function denoise(st, input, output) {
  heap.set(input, st.inPtr >> 2);
  gt.gtcrn_process_48k(st.state, st.inPtr, st.outPtr);
  output.set(heap.subarray(st.outPtr >> 2, (st.outPtr >> 2) + FRAME));
}

class GtcrnProcessor extends AudioWorkletProcessor {
  states = []; // one GTCRN state per side, made when first needed
  input = [new Float32Array(FRAME), new Float32Array(FRAME)]; // frame being collected
  playing = [new Float32Array(FRAME), new Float32Array(FRAME)]; // last denoised frame
  fill = 0; // samples of the current frame received so far
  equalFrames = SETTLE; // equal frames in a row (start ready to share)
  shared = false; // whether the last frame was shared

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    const n = Math.min(input.length, output.length, 2);
    for (let c = 0; c < n; c++) {
      this.input[c].set(input[c], this.fill);
      output[c].set(this.playing[c].subarray(this.fill, this.fill + BLOCK));
    }
    this.fill += BLOCK;
    if (this.fill === FRAME) {
      this.fill = 0;
      if (n > 0) this.denoiseFrame(n);
    }
    return true;
  }

  denoiseFrame(n) {
    const [left, right] = this.input;
    const first = (this.states[0] ??= createState());
    if (n === 1) {
      denoise(first, left, this.playing[0]);
      return;
    }
    let diff = 0;
    for (let i = 0; i < FRAME; i++) diff = Math.max(diff, Math.abs(left[i] - right[i]));
    this.equalFrames = diff <= SAME ? this.equalFrames + 1 : 0;
    if (this.equalFrames >= SETTLE) {
      for (let i = 0; i < FRAME; i++) left[i] = 0.5 * (left[i] + right[i]);
      denoise(first, left, this.playing[0]);
      this.playing[1].set(this.playing[0]);
      this.shared = true;
    } else {
      // The right side's state is out of date after sharing: start it fresh,
      // as at the start of a stream, instead of from old history.
      if (this.shared && this.states[1]) {
        destroyState(this.states[1]);
        this.states[1] = null;
      }
      this.shared = false;
      denoise(first, left, this.playing[0]);
      denoise((this.states[1] ??= createState()), right, this.playing[1]);
    }
  }
}

registerProcessor('ntu-cool-video-gtcrn', GtcrnProcessor);
