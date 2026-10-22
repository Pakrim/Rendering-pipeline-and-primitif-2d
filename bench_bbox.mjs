/* Module 2 -- bounding-box clamp benchmark.
 *
 * A small triangle on a 2000x2000 framebuffer. The clamped path visits only
 * its ~10x10 bounding box; the fullFrame path visits every pixel. Both must
 * produce identical bytes.
 *
 *   node bench_bbox.mjs
 */
import { Framebuffer, triangle } from "./raster.mjs";
import os from "node:os";

const W = 2000, H = 2000;
const A = [995, 995], B = [1004, 995], C = [995, 1004];
const RGB = [230, 120, 40];
const REPS_CLAMPED = 10000, REPS_FULL = 100;

function measure(opts, reps, warmup) {
  const fb = new Framebuffer(W, H);
  for (let i = 0; i < warmup; i++) triangle(fb, A, B, C, RGB, opts);
  const t0 = performance.now();
  for (let i = 0; i < reps; i++) triangle(fb, A, B, C, RGB, opts);
  return { fb, ms: performance.now() - t0 };
}

const clamped = measure({}, REPS_CLAMPED, 1000);
const full = measure({ fullFrame: true }, REPS_FULL, 3);

let maxDiff = 0;
for (let i = 0; i < clamped.fb.data.length; i++)
  maxDiff = Math.max(maxDiff, Math.abs(clamped.fb.data[i] - full.fb.data[i]));

let lit = 0;
for (let i = 0; i < clamped.fb.data.length; i += 3)
  if (clamped.fb.data[i] || clamped.fb.data[i + 1] || clamped.fb.data[i + 2]) lit++;

const cpu = os.cpus()[0]?.model ?? "unknown";
const clampedPer = clamped.ms / REPS_CLAMPED;
const fullPer = full.ms / REPS_FULL;
console.log(`framebuffer ${W}x${H}, triangle A(${A}) B(${B}) C(${C})`);
console.log(`cpu: ${cpu}; node: ${process.version}; ${process.platform}/${process.arch}`);
console.log(`clamped bbox : ${clampedPer.toFixed(4)} ms/call ` +
  `(${REPS_CLAMPED} reps, total ${clamped.ms.toFixed(1)} ms)`);
console.log(`full frame   : ${fullPer.toFixed(2)} ms/call ` +
  `(${REPS_FULL} reps, total ${full.ms.toFixed(1)} ms)`);
console.log(`ratio full/clamped = ${(fullPer / clampedPer).toFixed(1)}x`);
console.log(`identical bytes: max|diff|=${maxDiff}; lit pixels=${lit}`);

if (maxDiff !== 0) throw new Error("clamped and full-frame outputs differ");
