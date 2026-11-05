// Benchmark for vendor/gtcrn.js: per-frame time from a cold start, and
// garbage-collection count. Run: node tools/bench-gtcrn.mjs [path/to/gtcrn.js] [--out file]
// --out writes all output samples (Float32, little-endian) for comparing builds.
//
// One GTCRN state processes 1300 frames of 768 samples (48 kHz, 16 ms each) of a
// fixed test signal: a 220 Hz tone with slow amplitude change plus low noise.
import { writeFileSync } from 'node:fs';
import { PerformanceObserver } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const outFile = outAt >= 0 ? args.splice(outAt, 2)[1] : null;
const modPath = resolve(args[0] ?? 'vendor/gtcrn.js');

let gcCount = 0;
let gcMs = 0;
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) { gcCount++; gcMs += e.duration; }
}).observe({ entryTypes: ['gc'] });

const FRAME = 768;
const FRAMES = 1300;
const g = await import(pathToFileURL(modPath));
g._initialize();
const state = g.gtcrn_create();
const inPtr = g.malloc(FRAME * 4);
const outPtr = g.malloc(FRAME * 4);
const heap = new Float32Array(g.memory.buffer);

let seed = 1;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
const out = outFile ? new Float32Array(FRAMES * FRAME) : null;
const times = [];
for (let f = 0; f < FRAMES; f++) {
  for (let i = 0; i < FRAME; i++) {
    const n = f * FRAME + i;
    heap[(inPtr >> 2) + i] = 0.2 * Math.sin(2 * Math.PI * 220 * n / 48000) *
      (0.6 + 0.4 * Math.sin(n / 20000)) + 0.02 * noise();
  }
  const t0 = performance.now();
  g.gtcrn_process_48k(state, inPtr, outPtr);
  times.push(performance.now() - t0);
  if (out) out.set(heap.subarray(outPtr >> 2, (outPtr >> 2) + FRAME), f * FRAME);
}
await new Promise((r) => setTimeout(r, 50)); // let the GC observer report

const band = (a, b) => {
  const t = times.slice(a, b);
  return `${(t.reduce((s, x) => s + x, 0) / t.length).toFixed(1)}/${Math.max(...t).toFixed(1)}`;
};
const warm = times.slice(300).sort((a, b) => a - b);
const pct = (p) => warm[Math.floor(p * (warm.length - 1))].toFixed(2);
const first150 = times.slice(0, 150).reduce((s, x) => s + x, 0); // 150 frames = 2.4 s of audio
console.log(`file ${modPath}`);
console.log(`mean/max ms  frames 1-10 ${band(0, 10)} | 10-50 ${band(10, 50)} | 50-150 ${band(50, 150)} | 150-300 ${band(150, 300)} | 300+ ${band(300, FRAMES)}`);
console.log(`first frame ${times[0].toFixed(1)} ms; compute for first 2.4 s of audio ${first150.toFixed(0)} ms`);
console.log(`warm (300+) p50 ${pct(0.5)} p90 ${pct(0.9)} p99 ${pct(0.99)} max ${pct(1)} ms`);
console.log(`garbage collections ${gcCount} (${gcMs.toFixed(0)} ms total)`);
if (out) { writeFileSync(outFile, Buffer.from(out.buffer)); console.log(`wrote ${outFile}`); }
