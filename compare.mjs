/* Module 2 -- compare two rasters (PPM, or browser PNG via png.mjs).
 *   node compare.mjs A.ppm B.png [--diff out/diff.ppm --scale 6]
 * Prints size, identical-pixel count, PSNR, SSIM, max |diff|; optionally
 * writes an amplified difference image. A format/decoder error exits non-zero,
 * never counted as a match.
 *
 * Lab 3 note: the Three.js deliverable is PNG, so the optional `pngjs`
 * dependency was replaced by the small built-in reader in png.mjs. The repo
 * still depends only on three and serve. */
import { Framebuffer } from "./raster.mjs";
import { psnr, ssim, pixelStats } from "./metrics.mjs";
import { readPNG } from "./png.mjs";

async function load(path) {
  const lp = path.toLowerCase();
  if (lp.endsWith(".ppm")) return Framebuffer.readPPM(path);
  if (lp.endsWith(".png")) return readPNG(path);
  throw new Error(`unsupported file type: ${path}`);
}

const files = process.argv.slice(2).filter((s) => !s.startsWith("--"));
if (files.length < 2) {
  console.error("usage: node compare.mjs A B [--diff out.ppm --scale N]");
  process.exit(1);
}
const A = await load(files[0]);
const B = await load(files[1]);
if (A.w !== B.w || A.h !== B.h) {
  console.error(`size mismatch: ${A.w}x${A.h} vs ${B.w}x${B.h} -- ` +
    `set renderer.setPixelRatio(1) and an explicit size before exporting.`);
  process.exit(2);
}
const st = pixelStats(A, B);
const p = psnr(A, B);
console.log(`same size ${A.w}x${A.h}   identical pixels: ${st.identical}/${st.total}   ` +
  `PSNR: ${p === Infinity ? "inf" : p.toFixed(1)} dB   SSIM: ${ssim(A, B).toFixed(3)}   ` +
  `max |diff|: ${st.maxAbs}`);

const di = process.argv.indexOf("--diff");
if (di >= 0) {
  const si = process.argv.indexOf("--scale");
  const scale = si >= 0 ? +process.argv[si + 1] : 6;
  const D = new Framebuffer(A.w, A.h);
  for (let i = 0; i < D.data.length; i++)
    D.data[i] = Math.min(255, Math.abs(A.data[i] - B.data[i]) * scale);
  D.writePPM(process.argv[di + 1]);
  console.log(`wrote ${process.argv[di + 1]} (|A-B| x${scale})`);
}
