/* Module 2 -- load a floor plan (metres, y-up) and render it as 2D primitives.
 * The single worldToScreen() has the y-flip and origin baked in -- unit-tested
 * in tests.mjs on a known point. */
import { readFileSync } from "node:fs";
import { Framebuffer, polyline, triangle } from "./raster.mjs";

export const CATEGORY_RGB = {
  // viridis 5-step ramp (luminance varies -> CVD- and grayscale-safe, Module 1)
  wall:   [68, 1, 84],
  cella:  [59, 82, 139],
  stair:  [33, 145, 140],
  shrine: [94, 201, 98],
  axis:   [253, 231, 37],
};

export function loadPlan(path = "pusaka_plan.json") {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** metres (y-up) -> screen pixels (y-down), given the plan's scale + origin
 * and the framebuffer height. Deterministic; the ONLY place the flip lives. */
export function makeWorldToScreen(plan, H) {
  const s = plan.scale_px_per_m;
  const [ox, oy] = plan.origin_m;
  return ([xm, ym]) => [
    Math.round((xm + ox) * s),
    Math.round(H - 1 - (ym + oy) * s),
  ];
}

/* Lab 3 fix: the student footprint is concave (the anjuang sticks out on the
 * left). A triangle fan from point 0 overfills that notch, so the scratch fill
 * and the Three.js ShapeGeometry disagreed by ~10k pixels. Ear clipping keeps
 * both renderers on the same polygon. */
function signedArea2(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    a += x1 * y2 - x2 * y1;
  }
  return a;
}

function pointInTriangle(p, a, b, c) {
  const d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
  const d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1]);
  const d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1]);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

export function triangulatePolygon(points) {
  if (points.length < 3) return [];
  const orient = Math.sign(signedArea2(points)) || 1;
  const remaining = points.map((_, i) => i);
  const triangles = [];

  while (remaining.length > 3) {
    let found = false;
    for (let i = 0; i < remaining.length; i++) {
      const ia = remaining[(i - 1 + remaining.length) % remaining.length];
      const ib = remaining[i];
      const ic = remaining[(i + 1) % remaining.length];
      const a = points[ia], b = points[ib], c = points[ic];

      // Convex only; reflex and collinear vertices are not ears.
      const cross = (b[0] - a[0]) * (c[1] - b[1]) -
        (b[1] - a[1]) * (c[0] - b[0]);
      if (orient * cross <= 0) continue;

      let contains = false;
      for (const j of remaining) {
        if (j === ia || j === ib || j === ic) continue;
        if (pointInTriangle(points[j], a, b, c)) { contains = true; break; }
      }
      if (contains) continue;

      triangles.push([ia, ib, ic]);
      remaining.splice(i, 1);
      found = true;
      break;
    }
    if (!found) break; // degenerate input: keep the remainder as a fan
  }

  if (remaining.length === 3) triangles.push(remaining);
  return triangles;
}

export function renderPlan(fb, plan, { fillSilhouette = false } = {}) {
  const w2s = makeWorldToScreen(plan, fb.h);
  if (fillSilhouette && plan.silhouette) {
    const p = plan.silhouette.points.map(w2s);
    for (const [ia, ib, ic] of triangulatePolygon(p)) {
      let A = p[ia], B = p[ib], C = p[ic];
      // ensure total > 0 for our convention; swap B,C if not
      const tot = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      if (tot < 0) [B, C] = [C, B];
      triangle(fb, A, B, C, [230, 236, 245]);
    }
  }
  let segs = 0;
  for (const pl of plan.polylines) {
    const pts = pl.points.map(w2s);
    const rgb = CATEGORY_RGB[pl.category] || [255, 255, 255];
    polyline(fb, pts, rgb, !!pl.closed);
    segs += pl.points.length - 1 + (pl.closed ? 1 : 0);
  }
  return segs;
}

export function newFramebufferForPlan(plan, w, h) {
  const fb = new Framebuffer(w, h, [18, 18, 22]);
  return fb;
}
