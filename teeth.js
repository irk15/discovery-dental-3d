/* Discovery Dental — anatomical tooth generator.
   Teeth are modelled as signed-distance fields (cusps, fossae, developmental grooves, marginal ridges,
   lingual scoops, tapered curved roots) and polygonised with marching tetrahedra. Normals come from the field
   gradient (perfectly smooth), vertex colour carries enamel→dentin translucency + baked cavity occlusion. */
import * as THREE from 'three';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; };
const smax = (a, b, k) => -smin(-a, -b, k);
const gau = (x, z, cx, cz, k) => Math.exp(-((x - cx) * (x - cx) + (z - cz) * (z - cz)) * k);
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/* cheap smooth 3D value noise for organic irregularity */
const hash3 = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), u), l(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), u), v),
    l(l(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), u), l(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), u), v), w) - .5;
}
const supe = (x, z, a, b, n) => Math.pow(Math.pow(Math.abs(x) / a, n) + Math.pow(Math.abs(z) / b, n), 1 / n);
const ell = (x, y, z, cx, cy, cz, rx, ry, rz) => { const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz; return (Math.sqrt(px * px + py * py + pz * pz) - 1) * Math.min(rx, ry, rz); };

/* ─────────── crown fields (normalised space: x,z ≈ [-1,1], y ∈ [0,~1.1], +z = buccal/labial) ─────────── */
const FIELD = {
  molar(x, y, z) {
    const prof = .66 + .34 * sst(0, .5, y) - .14 * sst(.5, 1.1, y), a = 1.02 * prof, b = .94 * prof;
    const dSide = (supe(x, z, a, b, 2.6) - 1) * .78 * Math.min(a, b);
    const g = (cx, cz, k) => gau(x, z, cx, cz, k), r = Math.hypot(x, z);
    const H = .72 + .34 * (g(.48, .46, 5.5) * 1.05 + g(-.48, .46, 5.5) + g(.5, -.44, 5.5) * .92 + g(-.5, -.44, 5.5) * .95)
      - .36 * g(0, -.02, 6.5) - .12 * Math.exp(-x * x * 90) * Math.exp(-z * z * 1.3) - .11 * Math.exp(-z * z * 90) * Math.exp(-x * x * 1.1)
      + .07 * Math.exp(-(r - .82) * (r - .82) * 55) - .05 * (g(.26, .22, 90) + g(-.28, -.2, 90) + g(.0, .55, 70)) + .018 * Math.sin(x * 19 + z * 7) * sst(.3, .9, y);
    let d = smax(dSide, (y - H) * .62, .15);
    d = smax(d, -y, .13);
    return d + vnoise(x * 9, y * 9, z * 9) * .004;
  },
  premolar(x, y, z) {
    const prof = .7 + .3 * sst(0, .5, y) - .16 * sst(.5, 1.1, y), a = .92 * prof, b = 1.0 * prof;
    const dSide = (supe(x, z, a, b, 2.3) - 1) * .78 * Math.min(a, b);
    const g = (cx, cz, k) => gau(x, z, cx, cz, k);
    const H = .8 + .34 * g(0, .5, 5.5) + .26 * g(0, -.5, 6) - .12 * Math.exp(-z * z * 55) * Math.exp(-x * x * .9)
      + .07 * Math.exp(-((Math.hypot(x * 1.1, z) - .8) ** 2) * 55) - .05 * g(.3, 0, 60) - .05 * g(-.3, .05, 60);
    let d = smax(dSide, (y - H) * .62, .14); d = smax(d, -y, .05);
    return d + vnoise(x * 9, y * 9, z * 9) * .004;
  },
  canine(x, y, z) {
    const a = .56 + .44 * sst(0, .5, y) - .16 * sst(.75, 1.2, y), b = (.62 + .26 * sst(0, .4, y)) * (1 - .3 * sst(.7, 1.2, y));
    const dSide = (supe(x, z, a, b, 2.2) - 1) * .78 * Math.min(a, b);
    const H = 1.2 - .95 * Math.pow(Math.abs(x) / a, 1.12) - .22 * Math.abs(z) / b;
    let d = smax(dSide, (y - H) * .55, .12);
    const ling = ell(x, y, z, 0, .5, -.9, .36, .3, .34); d = smax(d, -ling, .16);
    d = smin(d, ell(x, y, z, 0, .18, -.55, .3, .2, .2), .1);
    d = smax(d, -y, .05);
    return d + vnoise(x * 9, y * 9, z * 9) * .004;
  },
  incisor(x, y, z) {
    const a = .66 + .34 * sst(0, .7, y), b = (.5 + .12 * sst(0, .5, y)) * (1 - .24 * sst(.72, 1.05, y));
    const dSide = (supe(x, z, a, b, 2.4) - 1) * .8 * Math.min(a, b);
    const H = 1.0 - .05 * x * x * x * x + .016 * (.5 + .5 * Math.cos(x * 9.5)) * (z > 0 ? 1 : .3);
    let d = smax(dSide, (y - H) * .7, .09);
    const ling = ell(x, y, z, 0, .62, -.82, .55, .36, .36); d = smax(d, -ling, .12);
    d = smin(d, ell(x, y, z, 0, .2, -.45, .28, .2, .18), .09);
    d = smax(d, -y, .05);
    return d - .012 * Math.exp(-x * x * 18) * sst(.25, .8, y) * (z > 0 ? 1 : 0) + vnoise(x * 8, y * 8, z * 8) * .004;
  }
};
const BOX = { molar: [-1.2, 1.2, -.08, 1.2, -1.15, 1.15], premolar: [-1.1, 1.1, -.08, 1.25, -1.15, 1.15], canine: [-1.1, 1.1, -.08, 1.3, -1.1, 1.1], incisor: [-1.15, 1.15, -.08, 1.12, -.95, .8] };

/* ─────────── marching tetrahedra ─────────── */
const TETS = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];
const CO = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
function polygonize(f, [x0, x1, y0, y1, z0, z1], nx, ny, nz) {
  const sx = (x1 - x0) / nx, sy = (y1 - y0) / ny, sz = (z1 - z0) / nz, X = nx + 1, Y = ny + 1, Z = nz + 1;
  const val = new Float32Array(X * Y * Z); const id = (i, j, k) => (i * Y + j) * Z + k;
  for (let i = 0; i < X; i++) for (let j = 0; j < Y; j++) for (let k = 0; k < Z; k++) val[id(i, j, k)] = f(x0 + i * sx, y0 + j * sy, z0 + k * sz);
  const pos = [], tri = [], map = new Map(); const total = X * Y * Z;
  const vtx = (a, b) => {
    const lo = Math.min(a, b), hi = Math.max(a, b), key = lo * total + hi; let v = map.get(key); if (v !== undefined) return v;
    const dec = n => [Math.floor(n / (Y * Z)), Math.floor(n / Z) % Y, n % Z]; const pa = dec(lo), pb = dec(hi), va = val[lo], vb = val[hi], t = va / (va - vb);
    v = pos.length / 3; pos.push(x0 + (pa[0] + (pb[0] - pa[0]) * t) * sx, y0 + (pa[1] + (pb[1] - pa[1]) * t) * sy, z0 + (pa[2] + (pb[2] - pa[2]) * t) * sz); map.set(key, v); return v;
  };
  const cid = new Int32Array(8), cv = new Float32Array(8);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    let neg = 0; for (let c = 0; c < 8; c++) { const q = id(i + CO[c][0], j + CO[c][1], k + CO[c][2]); cid[c] = q; cv[c] = val[q]; if (cv[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    for (const T of TETS) {
      const ins = [], out = []; for (const c of T) (cv[c] < 0 ? ins : out).push(c);
      if (ins.length === 0 || ins.length === 4) continue;
      if (ins.length === 1) tri.push(vtx(cid[ins[0]], cid[out[0]]), vtx(cid[ins[0]], cid[out[1]]), vtx(cid[ins[0]], cid[out[2]]));
      else if (ins.length === 3) tri.push(vtx(cid[out[0]], cid[ins[0]]), vtx(cid[out[0]], cid[ins[1]]), vtx(cid[out[0]], cid[ins[2]]));
      else { const a = vtx(cid[ins[0]], cid[out[0]]), b = vtx(cid[ins[0]], cid[out[1]]), c2 = vtx(cid[ins[1]], cid[out[1]]), d = vtx(cid[ins[1]], cid[out[0]]); tri.push(a, b, c2, a, c2, d); }
    }
  }
  return { pos: new Float32Array(pos), tri };
}

/* ─────────── finish: normals, AO, colour, uv ─────────── */
const _c = new THREE.Color();
function finish(f, raw, colorFn, eps) {
  const n = raw.pos.length / 3, P = raw.pos, N = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    let gx = f(x + eps, y, z) - f(x - eps, y, z), gy = f(x, y + eps, z) - f(x, y - eps, z), gz = f(x, y, z + eps) - f(x, y, z - eps); const l = Math.hypot(gx, gy, gz) || 1; gx /= l; gy /= l; gz /= l;
    N[i * 3] = gx; N[i * 3 + 1] = gy; N[i * 3 + 2] = gz;
    let occ = 0; for (let s = 1; s <= 5; s++) { const h = eps * 5 * s * .9; occ += (h - f(x + gx * h, y + gy * h, z + gz * h)) / (h * 1.0) * (1 / s); } const ao = clamp(1 - occ * .22, .35, 1);
    colorFn(_c, y, ao, gy); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    uv[i * 2] = Math.atan2(z, x) / (Math.PI * 2) + .5; uv[i * 2 + 1] = y * .55;
  }
  /* orient triangles with the field gradient, split uv seam */
  const idx = []; const dup = new Map(); const U = Array.from(uv); const Pn = Array.from(P), Nn = Array.from(N), Cn = Array.from(col);
  const T = raw.tri;
  for (let t = 0; t < T.length; t += 3) {
    let a = T[t], b = T[t + 1], c = T[t + 2];
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az, vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (fx * (N[a * 3] + N[b * 3] + N[c * 3]) + fy * (N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1]) + fz * (N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2]) < 0) { const q = b; b = c; c = q; }
    const u0 = U[a * 2], u1 = U[b * 2], u2 = U[c * 2];
    if (Math.max(u0, u1, u2) - Math.min(u0, u1, u2) > .5) {
      const fix = v => { const vu = U[v * 2]; if (vu > .5) return v; const k = v; let d = dup.get(k); if (d === undefined) { d = Pn.length / 3; Pn.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); Nn.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); Cn.push(col[v * 3], col[v * 3 + 1], col[v * 3 + 2]); U.push(vu + 1, U[v * 2 + 1]); dup.set(k, d); } return d; };
      a = fix(a); b = fix(b); c = fix(c);
    }
    idx.push(a, b, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(Pn, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Cn, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(idx);
  return g;
}

const cDent = new THREE.Color(0xe8d199), cMid = new THREE.Color(0xf1e7cd), cIns = new THREE.Color(0xe8eef0), cBlue = new THREE.Color(0xd5e4ee), cStain = new THREE.Color(0xb48650);
function enamelColor(c, y, ao, gy) {
  c.copy(cDent).lerp(cMid, sst(0, .4, y)).lerp(cIns, sst(.55, .95, y)).lerp(cBlue, sst(.9, 1.1, y) * .45);
  const cav = clamp((1 - ao) * 2.2, 0, 1) * sst(.45, .85, y); c.lerp(cStain, cav * .4); c.multiplyScalar(.72 + .28 * ao);
}

export function crownGeo(type, w, h, dr, { segs = 72, prof = 44 } = {}) {
  const f = FIELD[type], B = BOX[type];
  const nx = Math.max(16, Math.round(segs * .6)), ny = Math.max(16, Math.round(prof * 1.15)), nz = Math.max(16, Math.round(segs * .6));
  const raw = polygonize(f, B, nx, ny, nz); const eps = (B[1] - B[0]) / nx * .6;
  const g = finish(f, raw, enamelColor, eps);
  g.computeBoundingBox(); const bb = g.boundingBox; const P = g.attributes.position, Nm = g.attributes.normal;
  const cx = (bb.max.x + bb.min.x) / 2, cz = (bb.max.z + bb.min.z) / 2, sx = w / (bb.max.x - bb.min.x), sy = h / (bb.max.y - bb.min.y), sz = (w * dr) / (bb.max.z - bb.min.z);
  for (let i = 0; i < P.count; i++) {
    P.setXYZ(i, (P.getX(i) - cx) * sx, (P.getY(i) - bb.min.y) * sy, (P.getZ(i) - cz) * sz);
    let nx_ = Nm.getX(i) / sx, ny_ = Nm.getY(i) / sy, nz_ = Nm.getZ(i) / sz; const l = Math.hypot(nx_, ny_, nz_) || 1; Nm.setXYZ(i, nx_ / l, ny_ / l, nz_ / l);
  }
  g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}

const cRootTop = new THREE.Color(0xe8d6a8), cRootTip = new THREE.Color(0xc4a566);
export function rootGeo(len, r, dir, bend = .45, { seg = 28, N = 28 } = {}) {
  const cx = t => dir * bend * t * t;
  const f = (x, y, z) => {
    const t = clamp(-y / len, -.5, 1.2), tc = clamp(t, 0, 1);
    const R = r * Math.pow(Math.max(1 - tc, .0001), .4) * 1.1 * (1 + .12 * sst(0, .3, tc) * Math.cos(t * 5)) + .012;
    const px = x - cx(tc), pz = z / .82; const th = Math.atan2(pz, px);
    let rad = Math.hypot(px, pz) - R * (1 + .05 * Math.cos(3 * th + tc * 2) + .018 * Math.sin(tc * 20 + th * 2));
    rad -= .02 * Math.exp(-px * px * 30) * (pz > 0 ? 1 : 0) * (1 - tc) * R * 4;
    let d = rad * .8; d = smax(d, y - .42, .1); d = smax(d, -len * 1.03 - y, .08);
    return d + vnoise(x * 7, y * 7, z * 7) * .006;
  };
  const m = r * 1.45 + Math.abs(bend) * 1.2; const B = [Math.min(0, dir * bend) - m, Math.max(0, dir * bend) + m, -len * 1.06, .46, -m, m];
  const nx = Math.max(10, Math.round(seg * .6)), ny = Math.max(14, Math.round(N * 1.3)), nz = nx;
  const raw = polygonize(f, B, nx, ny, nz);
  return finish(f, raw, (c, y, ao) => { const tt = clamp(-y / len, 0, 1.1); c.copy(cRootTop).lerp(cRootTip, sst(.1, 1, tt)); c.multiplyScalar(.6 + .4 * ao); }, (B[1] - B[0]) / nx * .6);
}

/* procedural enamel micro-detail: perikymata striations, pits, craze lines */
function microTex(kind, size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const r = rng(kind === 'bump' ? 11 : 12);
  const base = kind === 'bump' ? 128 : 44; g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, size, size);
  const lite = kind === 'rough' ? 'rgba(110,110,110,' : 'rgba(255,255,255,', dark = kind === 'rough' ? 'rgba(10,10,10,' : 'rgba(0,0,0,';
  for (let y = 0; y < size; y += 3) { g.strokeStyle = (r() > .5 ? lite : dark) + (.05 + r() * .09) + ')'; g.lineWidth = .8 + r() * 1.6; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= size; x += 16) g.lineTo(x, y + Math.sin(x * .045 + y * .6) * 1.6); g.stroke(); }
  for (let i = 0; i < 9000; i++) { const x = r() * size, y = r() * size, rad = .4 + r() * 1.3; g.fillStyle = (r() > .45 ? dark : lite) + (.08 + r() * .22) + ')'; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
  for (let i = 0; i < 14; i++) { g.strokeStyle = dark + (.07 + r() * .08) + ')'; g.lineWidth = .7; g.beginPath(); let x = r() * size, y = r() * size; g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (r() - .5) * 10; y += 12 + r() * 20; g.lineTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); t.anisotropy = 8; return t;
}
export const TEX_ENAMEL_B = microTex('bump'), TEX_ENAMEL_R = microTex('rough');
export const TEX_ROOT_B = (() => { const s = 512, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'); const r = rng(21); g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
  for (let x = 0; x < s; x += 2) { g.strokeStyle = (r() > .5 ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + (.05 + r() * .12) + ')'; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= s; y += 24) g.lineTo(x + Math.sin(y * .03 + x) * 2, y); g.stroke(); }
  for (let i = 0; i < 6000; i++) { g.fillStyle = (r() > .5 ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + (.06 + r() * .16) + ')'; g.beginPath(); g.arc(r() * s, r() * s, .5 + r() * 1.6, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 3); t.anisotropy = 8; return t; })();
