// AudioWorklet processor: GTCRN noise removal, one GTCRN state per channel.
//
// GTCRN is loaded as plain JavaScript (vendor/gtcrn.js, made by build-gtcrn.sh),
// because the player page forbids compiling WebAssembly. Measured in Node
// (2026-11-05): 1.2 ms per 16 ms frame per channel.
//
// The browser hands over 128-sample blocks; GTCRN's 48 kHz mode works on
// 768-sample frames (6 blocks). Input blocks are written straight into GTCRN's
// input buffer; once it is full, the frame is denoised and played back over the
// next 6 blocks. That adds 768 samples (16 ms) to GTCRN's own 18.5 ms delay.
import * as gt from './vendor/gtcrn.js';

gt._initialize();

const FRAME = 768; // GTCRN frame at 48 kHz: 16 ms
const BLOCK = 128; // AudioWorklet block size
// GTCRN's memory never grows (build-gtcrn.sh turns growth off), so one view is enough.
const heap = new Float32Array(gt.memory.buffer);

function createChannel() {
  const state = gt.gtcrn_create();
  const inPtr = gt.malloc(FRAME * 4);
  const outPtr = gt.malloc(FRAME * 4);
  if (!state || !inPtr || !outPtr) throw new Error('GTCRN: out of memory');
  const inAt = inPtr >> 2;
  const outAt = outPtr >> 2;

  const playing = new Float32Array(FRAME); // last denoised frame
  let fill = 0; // samples of the current frame received so far

  return (inBlock, outBlock) => {
    heap.set(inBlock, inAt + fill);
    outBlock.set(playing.subarray(fill, fill + BLOCK));
    fill += BLOCK;
    if (fill === FRAME) {
      gt.gtcrn_process_48k(state, inPtr, outPtr);
      playing.set(heap.subarray(outAt, outAt + FRAME));
      fill = 0;
    }
  };
}

class GtcrnProcessor extends AudioWorkletProcessor {
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

registerProcessor('ntu-cool-video-gtcrn', GtcrnProcessor);
