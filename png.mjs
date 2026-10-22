/* Lab 3 -- dependency-free PNG reader for the comparison step.
 *
 * `compare.mjs` originally needed the optional `pngjs` package to read a PNG.
 * Lab 3 exports its canvas as PNG, and the repo must keep only `three` and
 * `serve` as dependencies, so this module decodes the subset a browser canvas
 * produces: 8-bit greyscale/RGB/RGBA, non-interlaced, filter types 0-4.
 * PPM remains the primary path in compare.mjs.
 */
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { Framebuffer } from "./raster.mjs";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function readPNG(path) {
  const buf = readFileSync(path);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error(`${path}: bukan berkas PNG`);
  }

  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];

  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }

    off += 12 + len;
  }

  if (!width || !height) throw new Error(`${path}: IHDR tidak ditemukan`);
  if (bitDepth !== 8) throw new Error(`${path}: hanya bit depth 8 yang didukung`);
  if (interlace !== 0) throw new Error(`${path}: PNG interlaced tidak didukung`);
  if (![0, 2, 4, 6].includes(colorType)) {
    throw new Error(`${path}: color type ${colorType} tidak didukung`);
  }

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length < height * (stride + 1)) {
    throw new Error(`${path}: data IDAT terpotong`);
  }

  const pixels = Buffer.alloc(height * stride);
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const row = y * stride;
    const prev = (y - 1) * stride;

    for (let x = 0; x < stride; x++) {
      const value = raw[src++];
      const left = x >= channels ? pixels[row + x - channels] : 0;
      const up = y > 0 ? pixels[prev + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[prev + x - channels] : 0;

      let out;
      switch (filter) {
        case 0: out = value; break;
        case 1: out = value + left; break;
        case 2: out = value + up; break;
        case 3: out = value + ((left + up) >> 1); break;
        case 4: out = value + paeth(left, up, upLeft); break;
        default: throw new Error(`${path}: filter PNG ${filter} tidak didukung`);
      }
      pixels[row + x] = out & 0xff;
    }
  }

  const fb = new Framebuffer(width, height);
  for (let p = 0; p < width * height; p++) {
    const i = p * channels;
    let r;
    let g;
    let b;
    if (colorType === 0 || colorType === 4) {
      r = g = b = pixels[i];
    } else {
      r = pixels[i];
      g = pixels[i + 1];
      b = pixels[i + 2];
    }
    fb.data[p * 3] = r;
    fb.data[p * 3 + 1] = g;
    fb.data[p * 3 + 2] = b;
  }
  return fb;
}
