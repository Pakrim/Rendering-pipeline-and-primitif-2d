/* Lab 3 -- Three.js render of the Lab 1 floor plan.
 *
 * The from-scratch rasteriser remains the reference: same 800x600 size, same
 * y-down pixel space, same palette and clear colour. The library takes over
 * vertex transform, clipping, rasterisation, MSAA and fragment output; the
 * conventions below are still ours to get right.
 */
import * as THREE from "three";

const W = 800;
const H = 600;

const canvas = document.getElementById("c");
const status = document.getElementById("status");
const toolchain = document.getElementById("toolchain");
const cvdToggle = document.getElementById("cvd");
const fillToggle = document.getElementById("fill");

// Keep this table in sync with plan.mjs CATEGORY_RGB and the legend markup.
// The Lab 3 copy of myplan.json uses the canonical five category names.
const CATEGORY = {
  wall:   { hex: 0x440154, label: "dinding" },
  cella:  { hex: 0x3b528b, label: "cella" },
  stair:  { hex: 0x21918c, label: "tangga" },
  shrine: { hex: 0x5ec962, label: "shrine" },
  axis:   { hex: 0xfde725, label: "sumbu" },
};

// Accept the original Lab 1 names too, in case the root file is served.
const CATEGORY_ALIASES = { room: "cella", door: "shrine" };

const FILL_RGB = 0xe6ecf5; // plan.mjs triangle fill: [230, 236, 245]
const CLEAR_RGB = 0x121216; // plan.mjs framebuffer background: [18, 18, 22]

// No retina scaling: the PNG must be exactly 800x600, matching the PPM.
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(CLEAR_RGB);

// Pixel-space orthographic camera. top=0, bottom=H makes y grow downward,
// matching raster.mjs. All geometry sits at z=0, inside near/far.
const camera = new THREE.OrthographicCamera(0, W, 0, H, -1, 1);

let plan;
let worldToScreen;
let group;
let ready = false;

/** Mirrors plan.mjs makeWorldToScreen(): metres y-up -> pixels y-down. */
function makeWorldToScreen(p) {
  const s = p.scale_px_per_m;
  const [ox, oy] = p.origin_m;
  return ([xm, ym]) => [
    Math.round((xm + ox) * s),
    Math.round(H - 1 - (ym + oy) * s),
  ];
}

function categoryOf(name) {
  return CATEGORY_ALIASES[name] ?? name;
}

function disposeGroup() {
  if (!group) return;
  scene.remove(group);
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  group = null;
}

function build(fillSilhouette) {
  disposeGroup();
  group = new THREE.Group();

  // The scratch rasteriser fan-triangulates the silhouette at integer
  // coordinates and samples pixel centres. Keep the vertices at integers here
  // too, so the fill edge lands on the same sample centres.
  if (fillSilhouette && plan.silhouette) {
    const shape = new THREE.Shape();
    plan.silhouette.points.map(worldToScreen).forEach(([x, y], i) => {
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({
      color: FILL_RGB,
      side: THREE.DoubleSide, // y-down flips winding; keep both faces visible
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 0;
    group.add(mesh);
  }

  // One LineSegments per category instead of one Line per polyline: fewer
  // draw calls, and the category colour stays a single material property.
  const byCategory = new Map();
  for (const pl of plan.polylines) {
    const cat = categoryOf(pl.category);
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    const bucket = byCategory.get(cat);
    const pts = pl.points.map(worldToScreen);

    const pushSegment = (a, b) => {
      // Bresenham lights pixel (x,y), whose sample centre is (x+0.5,y+0.5).
      // Shift WebGL line endpoints to the centres; otherwise a 1 px line on an
      // integer boundary is split by MSAA across two rows/columns.
      bucket.push(a[0] + 0.5, a[1] + 0.5, 0);
      bucket.push(b[0] + 0.5, b[1] + 0.5, 0);
    };

    for (let i = 0; i + 1 < pts.length; i++) pushSegment(pts[i], pts[i + 1]);
    if (pl.closed && pts.length > 2) pushSegment(pts[pts.length - 1], pts[0]);
  }

  let layer = 1;
  for (const [cat, positions] of byCategory) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: CATEGORY[cat]?.hex ?? 0xffffff,
      depthTest: false,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geo, mat);
    // Preserve the polyline order from the plan; axis is drawn last, as in
    // plan.mjs, even though every category is batched separately.
    lines.renderOrder = layer++;
    group.add(lines);
  }

  scene.add(group);
  renderer.render(scene, camera);
}

function draw() {
  renderer.render(scene, camera);
}

function applyCvd() {
  document.body.classList.toggle("cvd-deuteranopia", cvdToggle.checked);
}

function exportPng() {
  draw();
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "plan_three.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Small hook for the headless browser verification. It is not used by the UI,
// but it avoids a fragile "click a download button and find the file" step.
window.__lab3 = {
  get ready() { return ready; },
  render: draw,
  exportDataURL() {
    draw();
    return canvas.toDataURL("image/png");
  },
  setDeuteranopia(on) {
    cvdToggle.checked = Boolean(on);
    applyCvd();
  },
  getInfo() {
    return {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      lines: renderer.info.render.lines,
      points: renderer.info.render.points,
      pixelRatio: renderer.getPixelRatio(),
      outputColorSpace: renderer.outputColorSpace,
      size: [renderer.domElement.width, renderer.domElement.height],
    };
  },
};

async function start() {
  const planUrl = new URL("./myplan.json", import.meta.url);
  const response = await fetch(planUrl, { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status} untuk ${planUrl}`);

  plan = await response.json();
  worldToScreen = makeWorldToScreen(plan);

  const segmentCount = plan.polylines.reduce(
    (n, pl) => n + pl.points.length - 1 + (pl.closed ? 1 : 0),
    0
  );

  build(fillToggle.checked);
  applyCvd();

  const categories = [...new Set(plan.polylines.map((pl) => categoryOf(pl.category)))];
  status.textContent =
    `Denah dimuat: ${plan.polylines.length} polyline, ${segmentCount} segmen, ` +
    `${categories.length} kategori.`;
  toolchain.textContent =
    `Three.js r${THREE.REVISION} · ${W} × ${H} px · pixelRatio 1`;

  ready = true;
}

cvdToggle.addEventListener("change", applyCvd);
fillToggle.addEventListener("change", () => {
  build(fillToggle.checked);
  status.textContent = fillToggle.checked
    ? "Siluet terisi ditampilkan."
    : "Siluet terisi disembunyikan; outline tetap tampil.";
});
document.getElementById("export").addEventListener("click", exportPng);

start().catch((err) => {
  console.error(err);
  status.textContent =
    `Gagal memuat denah: ${err.message}. Jalankan dari folder web, ` +
    `misalnya "npx serve web".`;
  status.classList.add("error");
});
