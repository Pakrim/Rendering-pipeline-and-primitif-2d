/* Module 2 -- 24-spoke asterisk, one spoke every 15 degrees.
 * Each spoke is checked for endpoint, 8-connectivity, bounds, length R +/-1,
 * and reflection symmetry (exact and +/-1 pixel tolerance).
 *
 *   node draw_asterisk.mjs
 */
import { Framebuffer, lineBresenham } from "./raster.mjs";
import { mkdirSync } from "node:fs";

mkdirSync("out", { recursive: true });

const W = 64, H = 64, CX = 32, CY = 32, R = 24, SPOKES = 24;
const RGB = [255, 220, 80];
const fb = new Framebuffer(W, H);
const spokes = [];

for (let i = 0; i < SPOKES; i++) {
  const deg = i * 360 / SPOKES;
  const rad = deg * Math.PI / 180;
  const ex = Math.round(CX + R * Math.cos(rad));
  const ey = Math.round(CY - R * Math.sin(rad));
  const pts = lineBresenham(CX, CY, ex, ey, fb, RGB);

  let maxLen = 0, connected = true, inBounds = true;
  for (let k = 0; k < pts.length; k++) {
    const [x, y] = pts[k];
    maxLen = Math.max(maxLen, Math.hypot(x - CX, y - CY));
    if (x < 0 || y < 0 || x >= W || y >= H) inBounds = false;
    if (k > 0) {
      const [px, py] = pts[k - 1];
      if (Math.max(Math.abs(x - px), Math.abs(y - py)) !== 1) connected = false;
    }
  }

  const first = pts[0], last = pts[pts.length - 1];
  const endsOk = first[0] === CX && first[1] === CY && last[0] === ex && last[1] === ey;
  const lenOk = Math.abs(maxLen - R) <= 1;
  spokes.push({ deg, ex, ey, pts, maxLen, connected, inBounds, endsOk, lenOk });
}

const lit = new Set();
for (const s of spokes) for (const [x, y] of s.pts) lit.add(`${x},${y}`);
const key = (x, y) => `${x},${y}`;

const reflect = [
  ["x-axis", (x, y) => [x, 2 * CY - y]],
  ["y-axis", (x, y) => [2 * CX - x, y]],
  ["y=x", (x, y) => [y, x]],
  ["y=-x+2c", (x, y) => [2 * CY - y, 2 * CX - x]],
];

function exactMisses(fn) {
  let n = 0;
  for (const [x, y] of [...lit].map(p => p.split(",").map(Number))) {
    const [rx, ry] = fn(x, y);
    if (!lit.has(key(rx, ry))) n++;
  }
  return n;
}

function toleranceMisses(fn) {
  let n = 0;
  for (const [x, y] of [...lit].map(p => p.split(",").map(Number))) {
    const [rx, ry] = fn(x, y);
    let found = false;
    for (let dy = -1; dy <= 1 && !found; dy++)
      for (let dx = -1; dx <= 1 && !found; dx++)
        if (lit.has(key(rx + dx, ry + dy))) found = true;
    if (!found) n++;
  }
  return n;
}

console.log("spoke  angle  endpoint   pixels  length  gaps  bounds  ends  length-check");
for (const s of spokes) {
  const status = s.connected && s.inBounds && s.endsOk && s.lenOk ? "ok" : "FAIL";
  console.log(
    `${String(s.deg).padStart(5)}  ${s.deg.toString().padStart(3)}°  ` +
    `(${s.ex},${s.ey})`.padEnd(9) +
    `  ${String(s.pts.length).padStart(3)}    ${s.maxLen.toFixed(2)}   ` +
    `${s.connected ? "ok" : "NO"}    ${s.inBounds ? "ok" : "NO"}     ` +
    `${s.endsOk ? "ok" : "NO"}    ${s.lenOk ? "ok" : "FAIL"}`
  );
}

console.log("\nreflection       exact-mismatch  +/-1-mismatch");
let symmetryOk = true;
for (const [name, fn] of reflect) {
  const exact = exactMisses(fn), tol = toleranceMisses(fn);
  if (tol !== 0) symmetryOk = false;
  console.log(`${name.padEnd(16)} ${String(exact).padStart(8)}       ${String(tol).padStart(6)}`);
}

const allSpokesOk = spokes.every(s => s.connected && s.inBounds && s.endsOk && s.lenOk);
console.log(`\nOCTANT TEST: ${allSpokesOk && symmetryOk ? "PASS" : "FAIL"} ` +
  `(${spokes.filter(s => s.lenOk).length}/${SPOKES} spokes within ${R} ±1)`);
fb.writePPM("out/asterisk.ppm");
console.log("wrote out/asterisk.ppm");

if (!allSpokesOk || !symmetryOk) throw new Error("asterisk check failed");
