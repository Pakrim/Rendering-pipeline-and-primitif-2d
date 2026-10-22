/* Sample-centre check: a 2x2 rect at (1,1) on a 6x6 framebuffer.
 * Centre rule lights 4 pixels; the inclusive-index rule lights 9 because
 * pixel centres at 3.5 are outside [1,3).
 *
 *   node check_sample_centre.mjs
 */
import { Framebuffer } from "./raster.mjs";
import { mkdirSync } from "node:fs";

mkdirSync("out", { recursive: true });

const W = 6, H = 6;
const X0 = 1, Y0 = 1, X1 = 3, Y1 = 3;
const RGB = [255, 220, 80];

function render(rule) {
  const fb = new Framebuffer(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = x + 0.5, sy = y + 0.5;
      const lit = rule === "centre"
        ? sx >= X0 && sx < X1 && sy >= Y0 && sy < Y1
        : x >= X0 && x <= X1 && y >= Y0 && y <= Y1;
      if (lit) fb.set(x, y, RGB);
    }
  }
  return fb;
}

function ascii(fb) {
  const rows = [];
  for (let y = 0; y < H; y++) {
    let row = "";
    for (let x = 0; x < W; x++) {
      const p = fb.get(x, y);
      row += p[0] || p[1] || p[2] ? "#" : ".";
    }
    rows.push(row);
  }
  return rows;
}

function countLit(fb) {
  let n = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = fb.get(x, y);
      if (p[0] || p[1] || p[2]) n++;
    }
  return n;
}

const centre = render("centre");
const corner = render("corner");
const nCentre = countLit(centre);
const nCorner = countLit(corner);

console.log(`2x2 rectangle at (${X0},${Y0}) on a ${W}x${H} framebuffer`);
console.log(`centre rule: sample (x+0.5,y+0.5) inside [${X0},${X1}) x [${Y0},${Y1})`);
console.log(`  pixels lit = ${nCentre}`);
for (const row of ascii(centre)) console.log(`  ${row}`);
console.log(`corner rule: x,y in [${X0},${X1}] x [${Y0},${Y1}] (both ends inclusive)`);
console.log(`  pixels lit = ${nCorner}`);
for (const row of ascii(corner)) console.log(`  ${row}`);
console.log(`difference = ${nCorner - nCentre} pixels`);

centre.writePPM("out/sample_centre.ppm");
corner.writePPM("out/sample_corner.ppm");
console.log("wrote out/sample_centre.ppm, out/sample_corner.ppm");

if (nCentre !== 4 || nCorner !== 9)
  throw new Error(`unexpected counts: centre=${nCentre}, corner=${nCorner}`);
