import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { crownGeo, rootGeo, TEX_ENAMEL_B, TEX_ENAMEL_R, TEX_ROOT_B } from './teeth.js';

/* ───────────────────────── helpers ───────────────────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const sm5 = t => t * t * t * (t * (t * 6 - 15) + 10);
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_MOBILE = matchMedia('(max-width: 820px)').matches || /Mobi|Android/i.test(navigator.userAgent);
const BASE = 'https://discoverydental.com/';
const AQUA = 0x5df2e0, GOLD = 0xf3cd8a, RED = 0xff3b2a;

/* ───────────────────────── renderer ───────────────────────── */
const canvas = $('#gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.body.classList.add('no-gl');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03141b);
scene.fog = new THREE.FogExp2(0x03141b, 0.017);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 200);
scene.add(camera);
// lights ride with the camera so every stage is lit the same way
const keyL = new THREE.PointLight(0xfff2e0, 38, 0, 2); keyL.position.set(3.5, 4.5, 3); camera.add(keyL);
const rimA = new THREE.PointLight(AQUA, 60, 0, 2); rimA.position.set(-6, 2.5, -9); camera.add(rimA);
const rimG = new THREE.PointLight(GOLD, 34, 0, 2); rimG.position.set(6, -2, -8); camera.add(rimG);
const fillL = new THREE.PointLight(0x9fd8ff, 8, 0, 2); fillL.position.set(-3, -2, 4); camera.add(fillL);

/* post */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.38, 0.7, 0.92);
composer.addPass(bloom);
const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAb: { value: 0 }, uFlash: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uAb,uFlash; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
  void main(){
    vec2 c=vUv-.5; float r=dot(c,c);
    vec2 off=c*(0.0015+uAb*0.02)*(0.4+r*2.);
    vec3 col; col.r=texture2D(tDiffuse,vUv+off).r; col.g=texture2D(tDiffuse,vUv).g; col.b=texture2D(tDiffuse,vUv-off).b;
    col*=1.0-smoothstep(0.08,0.72,r*1.8)*0.6;
    col+=(h(vUv*vec2(1920.,1080.)+uTime)-.5)*0.02;
    col+=uFlash*vec3(.85,1.,1.)*(1.-r*1.6);
    gl_FragColor=vec4(col,1.);
  }`
};
const finalPass = new ShaderPass(FinalShader);
composer.addPass(finalPass);
composer.addPass(new OutputPass());

/* ───────────────────────── textures ───────────────────────── */
function radialTex(stops, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const TEX_GLOW_AQ = radialTex([[0, 'rgba(93,242,224,.55)'], [.35, 'rgba(43,184,173,.18)'], [1, 'rgba(3,20,27,0)']]);
const TEX_GLOW_GD = radialTex([[0, 'rgba(243,205,138,.5)'], [.4, 'rgba(243,160,90,.14)'], [1, 'rgba(3,20,27,0)']]);
const TEX_GLOW_RD = radialTex([[0, 'rgba(255,70,50,.6)'], [.4, 'rgba(255,60,40,.16)'], [1, 'rgba(3,20,27,0)']]);
const TEX_POOL = radialTex([[0, 'rgba(93,242,224,.38)'], [.5, 'rgba(93,242,224,.1)'], [1, 'rgba(93,242,224,0)']]);
const TEX_STAR = (() => {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.12, 'rgba(255,255,255,.7)'); gr.addColorStop(.4, 'rgba(180,255,245,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  const ln = (x0, y0, x1, y1) => { const l = g.createLinearGradient(x0, y0, x1, y1); l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(.5, 'rgba(255,255,255,.95)'); l.addColorStop(1, 'rgba(255,255,255,0)'); g.strokeStyle = l; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  ln(0, s / 2, s, s / 2); ln(s / 2, 0, s / 2, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const TEX_BONE = (() => {
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, s, s); const r = rng(5);
  for (let i = 0; i < 900; i++) { const x = r() * s, y = r() * s, rad = 1 + r() * 5; g.fillStyle = r() > .5 ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t;
})();

/* ───────────────────────── geometry: teeth ───────────────────────── */
function smoothNormals(geo) {
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = Math.round(p.getX(i) * 1500) + ',' + Math.round(p.getY(i) * 1500) + ',' + Math.round(p.getZ(i) * 1500);
    let e = map.get(k); if (!e) { e = [0, 0, 0, []]; map.set(k, e); }
    e[0] += n.getX(i); e[1] += n.getY(i); e[2] += n.getZ(i); e[3].push(i);
  }
  for (const e of map.values()) { const l = Math.hypot(e[0], e[1], e[2]) || 1; for (const i of e[3]) n.setXYZ(i, e[0] / l, e[1] / l, e[2] / l); }
  n.needsUpdate = true; return geo;
}
/* materials */
const matEnamel = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, vertexColors: true, roughness: 1, roughnessMap: TEX_ENAMEL_R, metalness: 0, ior: 1.55, specularIntensity: 1,
  bumpMap: TEX_ENAMEL_B, bumpScale: 1.4, clearcoat: 1, clearcoatRoughness: .05,
  sheen: .4, sheenRoughness: .4, sheenColor: new THREE.Color(0xffe6c4),
  iridescence: .2, iridescenceIOR: 1.3, envMapIntensity: 1.05
});
const matEnamelPlain = new THREE.MeshPhysicalMaterial({ color: 0xf8f3ea, roughness: .16, clearcoat: 1, clearcoatRoughness: .07, envMapIntensity: 1.15 });
const matDentin = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: .55, bumpMap: TEX_ROOT_B, bumpScale: 1.6, clearcoat: .3, clearcoatRoughness: .45, sheen: .3, sheenColor: new THREE.Color(0xf3e2b8), envMapIntensity: .85 });
const TEX_GUM = (() => { const sz = 256, c = document.createElement('canvas'); c.width = c.height = sz; const g = c.getContext('2d'); const r = rng(33); g.fillStyle = '#808080'; g.fillRect(0, 0, sz, sz); for (let i = 0; i < 5200; i++) { g.fillStyle = (r() > .5 ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + (.1 + r() * .25) + ')'; g.beginPath(); g.arc(r() * sz, r() * sz, .8 + r() * 2.2, 0, 7); g.fill(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 3); t.anisotropy = 8; return t; })();
const matGum = new THREE.MeshPhysicalMaterial({ bumpMap: TEX_GUM, bumpScale: 1.2, color: 0xdf6a80, roughness: .38, clearcoat: .55, clearcoatRoughness: .25, sheen: 1, sheenColor: new THREE.Color(0xffb7c4), envMapIntensity: .9 });
function fresnelMat(color, power = 2.2, base = .04, op = 1) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOp: { value: op }, uPow: { value: power }, uBase: { value: base } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uOp,uPow,uBase; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),uPow); gl_FragColor=vec4(uColor*(f*1.5+uBase*3.),(f*.9+uBase)*uOp); }'
  });
}

const CUFF_GEO = smoothNormals(new THREE.LatheGeometry([[0, .1], [.7, .1], [.98, .02], [1.0, -.14], [.9, -.3], [.7, -.45], [.4, -.55], [0, -.58]].map(p => new THREE.Vector2(p[0], p[1])), IS_MOBILE ? 40 : 72));
/* hero tooth assembly */
const GEO = {
  heroCrown: crownGeo('molar', 2.3, 1.95, .96, { segs: IS_MOBILE ? 96 : 180, prof: IS_MOBILE ? 70 : 130 }),
  rootL: rootGeo(2.1, .46, -1, .45, { seg: IS_MOBILE ? 48 : 84, N: IS_MOBILE ? 40 : 72 }), rootR: rootGeo(2.1, .46, 1, .45, { seg: IS_MOBILE ? 48 : 84, N: IS_MOBILE ? 40 : 72 })
};
function makeTooth(crownMat = matEnamel, rootMat = matDentin) {
  const g = new THREE.Group();
  const crown = new THREE.Mesh(GEO.heroCrown, crownMat);
  const rl = new THREE.Mesh(GEO.rootL, rootMat); rl.position.set(-.42, .42, 0);
  const rr = new THREE.Mesh(GEO.rootR, rootMat); rr.position.set(.42, .42, 0);
  g.add(crown, rl, rr); g.userData = { crown, roots: [rl, rr] };
  g.position.y = -.1; const outer = new THREE.Group(); outer.add(g); outer.userData = g.userData; return outer;
}

/* ───────────────────────── sparkles ───────────────────────── */
class Sparkles {
  constructor(max) {
    this.max = max; this.cur = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.age = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('aA', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPx: { value: 800 } },
      vertexShader: `attribute vec3 aCol; attribute float aSize; attribute float aA; uniform float uPx; varying vec3 vC; varying float vA;
        void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=max(aSize*uPx/max(-mv.z,.1),0.)*(.35+.65*aA); vC=aCol; vA=aA; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 p=gl_PointCoord-.5; float d=length(p); float glow=exp(-d*d*26.);
        float cx=smoothstep(.04,0.,abs(p.x))*smoothstep(.5,0.,abs(p.y)); float cy=smoothstep(.04,0.,abs(p.y))*smoothstep(.5,0.,abs(p.x));
        float a=(glow+.9*(cx+cy))*vA; if(a<.01) discard; gl_FragColor=vec4(vC*1.7,a); }`
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.geo = g; this.tmp = new THREE.Color();
  }
  emit(x, y, z, vx, vy, vz, color, size, life) {
    const i = this.cur; this.cur = (i + 1) % this.max; this.tmp.set(color);
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = this.tmp.r; this.col[i * 3 + 1] = this.tmp.g; this.col[i * 3 + 2] = this.tmp.b;
    this.size[i] = size; this.life[i] = life; this.age[i] = 0; this.alpha[i] = 0;
  }
  burst(p, n, color = AQUA, speed = 2.4, size = .16, life = 1.4) {
    if (REDUCED) n = Math.ceil(n / 3);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), s = speed * (.35 + Math.random() * .85);
      this.emit(p.x, p.y, p.z, Math.sin(b) * Math.cos(a) * s, Math.sin(b) * Math.sin(a) * s, Math.cos(b) * s, Math.random() > .75 ? GOLD : color, size * (.5 + Math.random()), life * (.6 + Math.random() * .7));
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.age[i] += dt; const u = this.age[i] / this.life[i];
      if (u >= 1) { this.life[i] = 0; this.alpha[i] = 0; continue; }
      const k = Math.pow(.18, dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] *= k; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = Math.sin(Math.PI * Math.pow(u, .7));
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aA.needsUpdate = true;
    this.geo.attributes.aCol.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true;
  }
}
const sparkles = new Sparkles(IS_MOBILE ? 900 : 2000); scene.add(sparkles.points);

/* ───────────────────────── world ───────────────────────── */
const STAGE_DX = 20, N = 8; const T0 = performance.now();
const stages = [];
function stageGroup(i) { const g = new THREE.Group(); g.position.x = i * STAGE_DX; scene.add(g); return g; }

/* ambient star-dust */
{
  const COUNT = IS_MOBILE ? 1400 : 3000, pos = new Float32Array(COUNT * 3), col = new Float32Array(COUNT * 3), siz = new Float32Array(COUNT), ph = new Float32Array(COUNT);
  const r = rng(3), c = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = -25 + r() * (STAGE_DX * (N - 1) + 50); pos[i * 3 + 1] = (r() - .5) * 22; pos[i * 3 + 2] = -34 + r() * 40;
    c.set(r() > .72 ? GOLD : r() > .4 ? AQUA : 0xffffff); const k = .35 + r() * .65; col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
    siz[i] = .035 + Math.pow(r(), 3) * .16; ph[i] = r() * 6.283;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  var dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPx: { value: 800 }, uTime: { value: 0 } },
    vertexShader: `attribute vec3 aCol; attribute float aSize; attribute float aPh; uniform float uPx,uTime; varying vec3 vC; varying float vT;
      void main(){ vec3 p=position; p.y+=sin(uTime*.2+aPh)*.35; p.x+=cos(uTime*.15+aPh*1.7)*.3; vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
      gl_PointSize=aSize*uPx/max(-mv.z,.1); vC=aCol; vT=.55+.45*sin(uTime*1.3+aPh*5.); }`,
    fragmentShader: 'varying vec3 vC; varying float vT; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); a*=a; gl_FragColor=vec4(vC*vT*1.6,a*vT); }'
  });
  const dust = new THREE.Points(g, dustMat); dust.frustumCulled = false; scene.add(dust);
}

/* per-stage ambience: glow sprites, light pool, halo ring */
function ambience(i, group, { glow = TEX_GLOW_AQ, gold = true, pool = true } = {}) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  sp.scale.set(24, 24, 1); sp.position.set(1, .4, -8); group.add(sp);
  if (gold) {
    const sg = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX_GLOW_GD, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: .4 }));
    sg.scale.set(11, 11, 1); sg.position.set(-5, -2.5, -6); group.add(sg);
  }
  if (pool) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshBasicMaterial({ map: TEX_POOL, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    p.rotation.x = -Math.PI / 2; p.position.y = -2.75; group.add(p);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, .012, 8, 220), new THREE.MeshBasicMaterial({ color: AQUA, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, fog: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = -2.74; group.add(ring);
    const ring2 = ring.clone(); ring2.scale.setScalar(1.35); ring2.material = ring.material.clone(); ring2.material.opacity = .22; group.add(ring2);
  }
}

/* tags (html labels pinned to 3D) */
const tagLayer = $('#tags'), TAGS = [], _v = new THREE.Vector3();
function addTag(stage, text, getPos, cls = '') {
  const el = document.createElement('div'); el.className = 'tag ' + cls; el.innerHTML = '<i></i><span>' + text + '</span>'; tagLayer.appendChild(el);
  const t = { stage, el, getPos, show: 1, _o: -1 }; TAGS.push(t); return t;
}

/* stage helper for picking & spin */
function pickable(stage, meshes) { stage.pick = meshes; }

/* ═══════ STAGE 0 — HERO ═══════ */
{
  const g = stageGroup(0); ambience(0, g, {});
  const tooth = makeTooth(); const spin = new THREE.Group(); spin.add(tooth); g.add(spin); spin.scale.setScalar(.001);
  // halos
  const halos = [3.0, 3.6, 4.3].map((r, k) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, .008 + k * .003, 8, 220), new THREE.MeshBasicMaterial({ color: k === 1 ? GOLD : AQUA, transparent: true, opacity: .45 - k * .08, blending: THREE.AdditiveBlending, fog: false }));
    m.rotation.set(1.2 + k * .4, k * .6, k); g.add(m); return m;
  });
  // orbiting satellites (tiny pearls)
  const sats = [0, 1, 2, 3, 4].map(k => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(.085 + k * .01, 24, 16), matEnamelPlain); g.add(m); return m;
  });
  // twinkle stars
  const stars = [[2.4, 1.8, .8], [-2.6, 1.1, 1.1], [1.6, -1.8, 1.6], [-1.9, -1.6, .6], [.3, 2.8, .2], [2.9, -.3, -.4]].map((p, k) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX_STAR, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    s.position.set(...p); s.scale.setScalar(.7); s.userData.ph = k * 1.3; g.add(s); return s;
  });
  const st = { i: 0, group: g, spin, vy: .35, idle: .35, pop: 0, pickT: tooth.userData.crown, init: 0 };
  st.pick = [tooth.userData.crown, ...tooth.userData.roots];
  st.update = (t, dt, a) => {
    st.init = clamp((performance.now() - T0 - 400) / 1900, 0, 1); const s = sm5(st.init) * (1 + st.pop * .09);
    st.pop = damp(st.pop, 0, 5, dt); spin.scale.setScalar(Math.max(.001, s));
    spin.position.y = Math.sin(t * .8) * .12;
    spin.rotation.x = damp(spin.rotation.x, -ptr.sy * .22, 3, dt); spin.rotation.z = damp(spin.rotation.z, ptr.sx * .12, 3, dt);
    halos.forEach((h, k) => { h.rotation.z += dt * (.12 + k * .05) * (k % 2 ? -1 : 1); h.rotation.x += dt * .03; });
    sats.forEach((m, k) => { const an = t * (.35 + k * .08) + k * 1.26; const R = 3.0 + (k % 3) * .6; m.position.set(Math.cos(an) * R, Math.sin(an * 1.3 + k) * 1.3, Math.sin(an) * R * .6); });
    stars.forEach(s => { s.material.opacity = .25 + .75 * Math.max(0, Math.sin(t * 1.7 + s.userData.ph)); s.scale.setScalar(.35 + .55 * Math.max(0, Math.sin(t * 1.7 + s.userData.ph))); });
    if (a > .3 && Math.random() < dt * 14) { const an = Math.random() * 6.283, R = 1.6 + Math.random(); sparkles.emit(g.position.x + Math.cos(an) * R, -1 + Math.random() * 3, Math.sin(an) * R * .7, 0, .25, 0, Math.random() > .6 ? GOLD : AQUA, .07 + Math.random() * .08, 1.8); }
  };
  st.onClick = (hit) => { st.pop = 1; const p = hit ? hit.point : new THREE.Vector3(g.position.x, .5, 0); sparkles.burst(p, 70, AQUA, 3.2, .17, 1.6); ping(0); flash(.35); };
  stages.push(st);
}

/* ═══════ STAGE 1 — iTERO SCAN / X-RAY ═══════ */
const scanState = { mode: 'scan', mix: 0 };
{
  const g = stageGroup(1); ambience(1, g, {});
  const spin = new THREE.Group(); g.add(spin);
  const planeSolid = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), planeWire = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const solidMat = matEnamel.clone(); solidMat.clippingPlanes = [planeSolid];
  const dentSolid = matDentin.clone(); dentSolid.clippingPlanes = [planeSolid];
  const solid = new THREE.Group(); // clipped real tooth
  const crown = new THREE.Mesh(GEO.heroCrown, solidMat); const rl = new THREE.Mesh(GEO.rootL, dentSolid), rr = new THREE.Mesh(GEO.rootR, dentSolid);
  rl.position.set(-.42, .42, 0); rr.position.set(.42, .42, 0); solid.add(crown, rl, rr); solid.position.y = -.1;
  // wire & points (lo-res) above the scan line
  const lowCrown = crownGeo('molar', 2.3, 1.95, .96, { segs: 30, prof: 18 });
  const ptsCrown = crownGeo('molar', 2.3, 1.95, .96, { segs: 44, prof: 26 });
  const lowRL = rootGeo(2.1, .46, -1, .45, { seg: 14, N: 12 }), lowRR = rootGeo(2.1, .46, 1, .45, { seg: 14, N: 12 });
  const wireMat = new THREE.MeshBasicMaterial({ color: AQUA, wireframe: true, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false, clippingPlanes: [planeWire] });
  const ptsMat = new THREE.PointsMaterial({ color: 0xbffff8, size: .05, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false, clippingPlanes: [planeWire], map: TEX_STAR });
  const wire = new THREE.Group();
  const wc = new THREE.Mesh(lowCrown, wireMat), wl = new THREE.Mesh(lowRL, wireMat), wr = new THREE.Mesh(lowRR, wireMat); wl.position.set(-.42, .42, 0); wr.position.set(.42, .42, 0);
  const pc = new THREE.Points(ptsCrown, ptsMat); wire.add(wc, wl, wr, pc); wire.position.y = -.1; wire.scale.setScalar(1.008);
  // x-ray
  const xm = fresnelMat(0x9ffcf2, 1.5, .1, 1);
  const xray = new THREE.Group(); const xc = new THREE.Mesh(GEO.heroCrown, xm), xl = new THREE.Mesh(GEO.rootL, xm), xr = new THREE.Mesh(GEO.rootR, xm);
  xl.position.set(-.42, .42, 0); xr.position.set(.42, .42, 0); xray.add(xc, xl, xr);
  const pulpMat = new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
  const chamber = new THREE.Mesh(new THREE.SphereGeometry(.5, 24, 16), pulpMat); chamber.scale.set(1.1, .85, .7); chamber.position.set(0, 1.0, 0);
  const canalL = new THREE.Mesh(rootGeo(1.8, .09, -1, .45, { seg: 10, N: 10 }), pulpMat); canalL.position.set(-.42, .55, 0);
  const canalR = new THREE.Mesh(rootGeo(1.8, .09, 1, .45, { seg: 10, N: 10 }), pulpMat); canalR.position.set(.42, .55, 0);
  xray.add(chamber, canalL, canalR); xray.position.y = -.1; xray.visible = false; xray.userData.mats = [xm, pulpMat];
  spin.add(solid, wire, xray);
  // beam
  const beam = new THREE.Mesh(new THREE.CircleGeometry(2.3, 72), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec2 vP; uniform float uT; void main(){ float r=length(vP)/2.3; float e=smoothstep(.55,1.,r)*(.7+.3*sin(uT*30.)); float c=(1.-r)*.1; float rings=.08*smoothstep(.02,0.,abs(fract(r*5.)-.5)-.47); gl_FragColor=vec4(vec3(.36,.95,.88)*(e+c+rings)*1.6,(e+c+rings)*.9); }'
  }));
  beam.rotation.x = -Math.PI / 2; g.add(beam);
  const beamRing = new THREE.Mesh(new THREE.TorusGeometry(2.3, .014, 8, 120), new THREE.MeshBasicMaterial({ color: 0xcffff9, blending: THREE.AdditiveBlending, transparent: true })); beamRing.rotation.x = Math.PI / 2; g.add(beamRing);
  const st = { i: 1, group: g, spin, vy: .3, idle: .3, pick: [crown, rl, rr] };
  const tg = [addTag(1, 'Enamel', v => v.set(g.position.x + 1.05, 1.5, .5), ''), addTag(1, 'Dentin', v => v.set(g.position.x - 1.0, .9, .4), ''), addTag(1, 'Pulp', v => v.set(g.position.x, 1.05, .3), 'gold'), addTag(1, 'Root canals', v => v.set(g.position.x + .9, -.9, .2), '')];
  st.update = (t, dt, a) => {
    scanState.mix = damp(scanState.mix, scanState.mode === 'xray' ? 1 : 0, 6, dt);
    const xr_ = scanState.mix > .5; solid.visible = wire.visible = !xr_; xray.visible = xr_; beam.visible = beamRing.visible = !xr_;
    xm.uniforms.uOp.value = xr_ ? 1 : 0;
    const ph = (Math.sin(t * .75) * .5 + .5), y = lerp(-2.0, 2.3, sm5(ph));
    planeSolid.constant = y + g.position.y; planeWire.constant = -(y + g.position.y);
    beam.position.y = y; beamRing.position.y = y; beam.material.uniforms.uT.value = t;
    const pulse = .75 + .25 * Math.sin(t * 4); pulpMat.opacity = pulse;
    tg.forEach(x => x.show = scanState.mix);
    st.idle = scanState.mode === 'xray' ? 0 : .3;
    if (scanState.mode === 'xray') { const target = Math.round(spin.rotation.y / (Math.PI * 2)) * Math.PI * 2; spin.rotation.y = damp(spin.rotation.y, target, 4, dt); }
    if (a > .4 && !xr_ && Math.random() < dt * 40) sparkles.emit(g.position.x + (Math.random() - .5) * 3.6, y, (Math.random() - .5) * 3, 0, .5, 0, AQUA, .06, .9);
  };
  st.xmat = xm; stages.push(st);
}

/* ═══════ ARCH BUILDER (Invisalign + Whitening) ═══════ */
const ARCH_DEF = [['incisor', .95, 1.55, .62], ['incisor', .78, 1.36, .6], ['canine', .88, 1.62, .82], ['premolar', .92, 1.2, .94], ['premolar', .95, 1.15, .96], ['molar', 1.28, 1.05, 1.0]];
const AK = .115, AZ0 = 1.9, archZ = x => AZ0 - AK * x * x;
function xAtArc(s) { let x = 0, L = 0; const dx = .01; while (L < s && x < 12) { L += Math.hypot(dx, archZ(x + dx) - archZ(x)); x += dx; } return x; }
const ARCH = (() => {
  const out = []; let s = 0;
  ARCH_DEF.forEach(([type, w, h, dr], idx) => {
    const x = xAtArc(s + w / 2); s += w + .05;
    out.push({ type, w, h, dr, idx, x, z: archZ(x), ry: Math.atan(2 * AK * x), geo: crownGeo(type, w, h, dr, { segs: IS_MOBILE ? 64 : 110, prof: IS_MOBILE ? 48 : 80 }) });
  }); return out;
})();
const ARCH_MAXX = Math.max(...ARCH.map(d => d.x)) + .75;
const GUM_GEO = (() => {
  const pts = []; for (let k = 0; k <= 90; k++) { const x = -ARCH_MAXX + (2 * ARCH_MAXX) * k / 90; pts.push(new THREE.Vector3(x, 0, archZ(x))); }
  const t = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, .66, 28, false); t.scale(1, .7, 1); return smoothNormals(t);
})();
function buildArch({ crooked = true, perMat = false, seed = 7 } = {}) {
  const g = new THREE.Group(), teeth = [], r = rng(seed);
  const gum = new THREE.Mesh(GUM_GEO, matGum); gum.position.y = -.04; g.add(gum);
  for (const e of [-1, 1]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(.66, 28, 18), matGum); cap.scale.set(1, .7, 1); cap.position.set(e * ARCH_MAXX, -.04, archZ(ARCH_MAXX)); g.add(cap); }
  const amps = [1.7, 1.5, 1.2, .8, .5, .3];
  for (const sd of [1, -1]) for (const d of ARCH) {
    const amp = amps[d.idx], k = crooked ? 1 : 0;
    const off = { dx: (r() - .5) * .7 * amp * k, dz: (r() - .5) * .9 * amp * k, ry: (r() - .5) * 1.1 * amp * k, rz: (r() - .5) * .3 * amp * k, rx: (r() - .5) * .25 * amp * k };
    const mesh = new THREE.Mesh(d.geo, perMat ? matEnamel.clone() : matEnamel); mesh.rotation.order = 'YXZ'; g.add(mesh);
    const cf = new THREE.Mesh(CUFF_GEO, matGum); cf.scale.set(d.w * .42, 1, d.w * d.dr * .42); cf.position.y = .03; mesh.add(cf);
    teeth.push({ mesh, d, side: sd, base: { x: sd * d.x, z: d.z, ry: sd * d.ry }, off, hover: 0, local: 0, prev: 0, rank: clamp((sd * d.x / ARCH_MAXX + 1) / 2, 0, 1) });
  }
  return { group: g, teeth, gum };
}
function placeArch(arch, a, t) {
  const k = 1 - a;
  for (const T of arch.teeth) {
    const m = T.mesh, b = T.base, o = T.off, h = T.hover;
    m.position.set(b.x + o.dx * k, .2 + h * .28, b.z + o.dz * k);
    m.rotation.set(o.rx * k, b.ry + o.ry * k, o.rz * k); m.scale.setScalar(1 + h * .05);
  }
}

/* ═══════ STAGE 2 — INVISALIGN ═══════ */
const alignState = { v: 0, target: 0, touched: false, auto: 0, autoRunning: false };
{
  const g = stageGroup(2); ambience(2, g, {});
  const arch = buildArch({ crooked: true }); arch.group.position.y = -.9; arch.group.scale.setScalar(.8); g.add(arch.group);
  const ghostMat = fresnelMat(AQUA, 2.0, .035, .9);
  const ghosts = arch.teeth.map(T => { const m = new THREE.Mesh(T.d.geo, ghostMat); m.rotation.order = 'YXZ'; m.position.set(T.base.x, .2, T.base.z); m.rotation.y = T.base.ry; m.scale.setScalar(1.06); arch.group.add(m); return m; });
  const st = { i: 2, group: g, arch, pick: arch.teeth.map(T => T.mesh), hoverT: null, lastTray: 0 };
  addTag(2, 'Treatment goal', v => v.set(g.position.x - 2.4, .6, 1.2), '');
  st.update = (t, dt, a) => {
    if (a > .7 && !alignState.touched && !alignState.autoRunning && alignState.auto === 0) { alignState.autoRunning = true; alignState.auto = 1; alignState.target = 0; setTimeout(() => runAlignAuto(), 700); }
    alignState.v = damp(alignState.v, alignState.target, 4.5, dt);
    const ease = sm5(clamp(alignState.v, 0, 1));
    placeArch(arch, ease, t);
    ghostMat.uniforms.uOp.value = .25 + .75 * (1 - ease) + .0; ghosts.forEach(m => m.visible = ease < .985);
    arch.group.rotation.y = Math.sin(t * .3) * .07 + ptr.sx * .1; arch.group.rotation.x = ptr.sy * .04;
    arch.teeth.forEach(T => { T.hover = damp(T.hover, T === st.hoverT ? 1 : 0, 10, dt); });
    const tray = 1 + Math.round(alignState.v * 23); if (tray !== st.lastTray) { st.lastTray = tray; $('#alignOut').textContent = tray + ' / 24'; }
    if (ease > .985 && !st.done) { st.done = true; sparkles.burst(new THREE.Vector3(g.position.x, 1, 2), 60, AQUA, 3, .14, 1.4); flash(.25); ping(2); }
    if (ease < .9) st.done = false;
  };
  st.onClick = (hit) => { if (hit) { const T = arch.teeth.find(x => x.mesh === hit.object); if (T) { T.hover = 1.5; sparkles.burst(hit.point, 18, AQUA, 1.6, .1, 1); ping(1 + (T.d.idx % 3)); } } };
  st.onHover = (hit) => { st.hoverT = hit ? arch.teeth.find(x => x.mesh === hit.object) : null; };
  stages.push(st);
}
function runAlignAuto() {
  const t0 = performance.now(); const dur = 3600;
  const step = () => { if (alignState.touched) { alignState.autoRunning = false; return; } const u = clamp((performance.now() - t0) / dur, 0, 1); alignState.target = u; setAlignUI(u); if (u < 1) requestAnimationFrame(step); else alignState.autoRunning = false; };
  step();
}
function setAlignUI(u) { const el = $('#align'); el.value = Math.round(u * 100); el.style.setProperty('--v', el.value + '%'); }

/* ═══════ STAGE 3 — WHITENING ═══════ */
const shadeState = { v: 0, target: 0, anim: false };
const SHADES = ['A4', 'A3.5', 'A3', 'A2', 'A1', 'B1', '0M3', '0M2', '0M1'];
{
  const g = stageGroup(3); ambience(3, g, {});
  const arch = buildArch({ crooked: false, perMat: true, seed: 11 }); arch.group.position.y = -.9; arch.group.scale.setScalar(.8); g.add(arch.group);
  const cA = new THREE.Color(0xd3b774), cB = new THREE.Color(0xfffcf4), tmp = new THREE.Color();
  const st = { i: 3, group: g, arch, pick: arch.teeth.map(T => T.mesh), hoverT: null };
  st.update = (t, dt, a) => {
    shadeState.v = damp(shadeState.v, shadeState.target, shadeState.anim ? 2.2 : 6, dt);
    placeArch(arch, 1, t);
    for (const T of arch.teeth) {
      const raw = clamp(shadeState.v * 1.55 - T.rank * .55, 0, 1); T.local = damp(T.local, raw, 12, dt);
      tmp.copy(cA).lerp(cB, sm5(T.local)); T.mesh.material.color.copy(tmp);
      const dv = Math.abs(T.local - T.prev) / Math.max(dt, .001); T.prev = T.local;
      T.mesh.material.emissive.setRGB(1, .98, .9); T.mesh.material.emissiveIntensity = clamp(dv * .35, 0, .9) + .0;
      T.hover = damp(T.hover, T === st.hoverT ? 1 : 0, 10, dt);
      if (T.local > .96 && !T.shone) { T.shone = true; const p = new THREE.Vector3(); T.mesh.getWorldPosition(p); p.y += T.d.h * .75; sparkles.burst(p, 9, 0xffffff, 1.4, .12, 1.1); }
      if (T.local < .6) T.shone = false;
    }
    arch.group.rotation.y = Math.sin(t * .3 + 1) * .07 + ptr.sx * .1; arch.group.rotation.x = ptr.sy * .04;
    const idx = clamp(Math.floor(shadeState.v * 8.99), 0, 8); const lbl = SHADES[idx]; const o = $('#shadeOut'); if (o.textContent !== lbl) o.textContent = lbl;
  };
  st.onClick = (hit) => { if (hit) { sparkles.burst(hit.point, 24, 0xffffff, 1.8, .12, 1.1); ping(3); } };
  st.onHover = (hit) => { st.hoverT = hit ? arch.teeth.find(x => x.mesh === hit.object) : null; };
  stages.push(st);
}

/* ═══════ STAGE 4 — IMPLANT (explode) ═══════ */
const implantState = { v: 0, target: 0, hover: null };
const PART_INFO = {
  crown: ['Porcelain crown', 'Custom-shaped and shaded so it blends in with your natural teeth.'],
  abut: ['Abutment', 'The connector that joins the crown to the implant below.'],
  screw: ['Titanium implant', 'A small titanium post placed in the jawbone to anchor your new tooth.'],
  bone: ['Jawbone', 'Healthy bone supports the implant — the foundation of the whole restoration.']
};
{
  const g = stageGroup(4); ambience(4, g, {});
  const imp = new THREE.Group(); imp.scale.setScalar(.9); imp.position.y = -.1; g.add(imp);
  const mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); imp.add(m); return m; };
  const crownMat = matEnamel.clone();
  const crown = mk(crownGeo('molar', 2.2, 1.5, .98, { segs: IS_MOBILE ? 80 : 150, prof: IS_MOBILE ? 60 : 110 }), crownMat);
  const abutMat = new THREE.MeshPhysicalMaterial({ color: 0xe0bd72, metalness: 1, roughness: .22, clearcoat: .6, envMapIntensity: 1.5 });
  const abutGeo = new THREE.LatheGeometry([[0, -.55], [.42, -.55], [.4, -.35], [.5, -.1], [.56, .15], [.5, .35], [.42, .55], [0, .55]].map(p => new THREE.Vector2(p[0], p[1])), 48); smoothNormals(abutGeo);
  const abut = mk(abutGeo, abutMat);
  const screwMat = new THREE.MeshPhysicalMaterial({ color: 0xc3ccd6, metalness: 1, roughness: .26, clearcoat: .4, envMapIntensity: 1.6 });
  const sg = new THREE.CylinderGeometry(.34, .2, 2.1, 56, 150, false); { const p = sg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z); if (r < .02 || Math.abs(y) > 1.04) continue; const th = Math.atan2(z, x), k = (r + .055 * Math.sin(Math.PI * 2 * (y / .17 - th / (Math.PI * 2)))) / r; p.setXYZ(i, x * k, y, z * k); } smoothNormals(sg); }
  const screw = mk(sg, screwMat);
  const boneMat = new THREE.MeshPhysicalMaterial({ color: 0xe8d9bb, roughness: .8, bumpMap: TEX_BONE, bumpScale: 2.2, transparent: true, opacity: .52, depthWrite: false, side: THREE.DoubleSide });
  const bg = new THREE.CylinderGeometry(1.55, 1.35, 1.9, 72, 20); { const p = bg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z); if (r < .05) continue; const n = 1 + .05 * Math.sin(Math.atan2(z, x) * 5 + y * 3) + .03 * Math.sin(y * 7); p.setXYZ(i, x * n, y, z * n); } smoothNormals(bg); }
  const bone = mk(bg, boneMat);
  const gumRing = mk(new THREE.TorusGeometry(.68, .3, 24, 64), matGum); gumRing.rotation.x = Math.PI / 2; gumRing.scale.set(1, 1, .8);
  const parts = { crown, abut, screw, bone };
  const mats = { crown: crownMat, abut: abutMat, screw: screwMat, bone: boneMat };
  const base = { crown: .2, abut: -.2, screw: -1.75, bone: -1.9, gum: -.98 };
  const lift = { crown: 3.1, abut: 1.5, screw: .45, bone: -.9, gum: -.9 };
  const st = { i: 4, group: g, pick: [crown, abut, screw, bone], imp };
  const TAGOFF = { crown: [1.35, .5], abut: [1.0, 0], screw: [.85, .7], bone: [1.7, -.6] };
  [['Porcelain crown', 'crown'], ['Abutment', 'abut'], ['Titanium implant', 'screw'], ['Jawbone', 'bone']].forEach(([txt, key]) => {
    addTag(4, txt, v => { parts[key].getWorldPosition(v); v.x += TAGOFF[key][0]; v.y += TAGOFF[key][1]; });
  });
  st.update = (t, dt, a) => {
    implantState.v = damp(implantState.v, implantState.target, 5, dt); const e = sm5(implantState.v);
    crown.position.y = base.crown + lift.crown * e; abut.position.y = base.abut + lift.abut * e; screw.position.y = base.screw + lift.screw * e;
    bone.position.y = base.bone + lift.bone * e; gumRing.position.y = base.gum + lift.gum * e;
    imp.rotation.y = t * .25 + ptr.sx * .4; imp.rotation.x = ptr.sy * .08;
    for (const k in mats) { const m = mats[k], h = implantState.hover === k ? 1 : 0; m.userData.h = damp(m.userData.h || 0, h, 10, dt); if (m.emissive) { m.emissive.setHex(AQUA); m.emissiveIntensity = m.userData.h * .35; } }
    const lbl = e < .04 ? 'Assembled' : e > .96 ? 'Exploded' : Math.round(e * 100) + '%'; const eo = $('#explodeOut'); if (eo.textContent !== lbl) eo.textContent = lbl;
  };
  st.onHover = (hit) => {
    const k = hit ? Object.keys(parts).find(x => parts[x] === hit.object) : null;
    if (k !== implantState.hover) { implantState.hover = k; const c = $('#partCard'); if (k) { c.innerHTML = '<h4>' + PART_INFO[k][0] + '</h4><p>' + PART_INFO[k][1] + '</p>'; } else { c.innerHTML = '<h4>Hover a part</h4><p>Crown, abutment, titanium implant and bone — each does its own job.</p>'; } }
  };
  st.onClick = (hit) => { if (hit) { sparkles.burst(hit.point, 26, AQUA, 1.8, .12, 1.1); ping(2); } };
  stages.push(st);
}

/* ═══════ STAGE 5 — EMERGENCY ═══════ */
const reliefState = { relief: 0, target: 0 };
{
  const g = stageGroup(5); ambience(5, g, { glow: TEX_GLOW_RD, gold: false });
  const crownM = matEnamel.clone(), rootM = matDentin.clone();
  const tooth = makeTooth(crownM, rootM); const spin = new THREE.Group(); spin.add(tooth); g.add(spin);
  const redL = new THREE.PointLight(RED, 0, 0, 2); redL.position.set(5 * STAGE_DX, .6, 2.4); scene.add(redL);
  const rings = [0, 1, 2].map(k => { const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.035, 128), new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); m.position.z = -.3; g.add(m); return m; });
  const glowSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX_GLOW_RD, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); glowSp.scale.set(8, 8, 1); glowSp.position.z = -1; g.add(glowSp);
  const cRed = new THREE.Color(RED), cAq = new THREE.Color(AQUA), cc = new THREE.Color();
  const st = { i: 5, group: g, spin, vy: 0, idle: 0, pick: [tooth.userData.crown], lights: [redL] };
  st.update = (t, dt, a) => {
    reliefState.relief = damp(reliefState.relief, reliefState.target, 2.4, dt); const rl = reliefState.relief;
    const pulse = .5 + .5 * Math.sin(t * (6 - rl * 4.5)); cc.copy(cRed).lerp(cAq, rl);
    crownM.emissive.copy(cc); crownM.emissiveIntensity = (.12 + pulse * .38) * (1 - rl * .6);
    rootM.emissive.copy(cc); rootM.emissiveIntensity = (.2 + pulse * .45) * (1 - rl * .7);
    redL.color.copy(cc); redL.intensity = (14 + pulse * 26) * (1 - rl * .35) * (a > .1 ? 1 : 0);
    glowSp.material.color.copy(cc.clone().lerp(new THREE.Color(1, 1, 1), .0)); glowSp.material.opacity = (.55 + pulse * .35);
    const shiver = (1 - rl) * .035; tooth.position.x = Math.sin(t * 52) * shiver; tooth.position.y = Math.cos(t * 47) * shiver * .6;
    spin.rotation.y = Math.sin(t * .5) * .5 + (st.vy); spin.rotation.x = -ptr.sy * .15; spin.rotation.z = ptr.sx * .08;
    rings.forEach((m, k) => { const u = ((t * (.55 - rl * .2) + k / 3) % 1); m.scale.setScalar(1.4 + u * 4.2); m.material.opacity = (1 - u) * (1 - u) * .6 * (a > .05 ? 1 : 0); m.material.color.copy(cc); });
    if (a > .4 && rl > .5 && Math.random() < dt * 22) sparkles.emit(g.position.x + (Math.random() - .5) * 3, -1 + Math.random() * 3, (Math.random() - .5) * 2, 0, .4, 0, AQUA, .08, 1.6);
  };
  st.onClick = () => {};
  stages.push(st);
}

/* ═══════ STAGE 6 — SERVICE CONSTELLATION ═══════ */
const SERVICES = [
  ['Invisalign®', 'Clear aligners that straighten your teeth without drawing attention.', 'invisalign/', AQUA],
  ['Porcelain Veneers', 'Fix chips, hide stains and close gaps with natural-looking results.', 'veneers/', GOLD],
  ['Teeth Whitening', 'A brighter smile that makes other people say “wow.”', 'teeth-whitening/', 0xfff3d2],
  ['Dental Implants', 'High-quality implants that restore your smile’s function and aesthetics.', 'dental-implants/', 0xb7c6d6],
  ['Emergency Dentist', 'Same-day relief for toothaches, chips, lost fillings, swelling and more.', 'emergency-dentistry-ajax/', 0xff7a66],
  ['Family Dentistry', 'Comprehensive, personalized care for every age in your household.', 'family-dentistry/', 0x7ff0c4],
  ['Crowns & Bridges', 'Strong, natural-looking restorations for damaged or missing teeth.', 'crowns-and-bridges/', 0xf0d9a8],
  ['Dental Fillings', 'Repair cavities and protect the tooth underneath.', 'fillings/', 0x9fd8ff],
  ['Dental Sealants', 'A thin protective layer that helps guard against decay.', 'sealants/', 0x8fe8ff],
  ['Tooth Extractions', 'Gentle, careful care when a tooth needs to come out.', 'tooth-extractions/', 0xd6a9ff],
  ['Digital X-rays & iTero', 'Digital imaging and scanning for a clear, precise picture of your smile.', 'services/', AQUA],
  ['Conscious Sedation', 'Gentle options so even anxious patients can feel at ease.', 'services/', 0xffc2d4]
];
const svcState = { hover: -1, sel: -1, speed: 1 };
{
  const g = stageGroup(6); ambience(6, g, { gold: true });
  const core = makeTooth(); core.scale.setScalar(.6); const coreSpin = new THREE.Group(); coreSpin.add(core); g.add(coreSpin);
  const shapes = [() => new THREE.IcosahedronGeometry(.3, 1), () => new THREE.OctahedronGeometry(.34), () => new THREE.TorusGeometry(.26, .09, 16, 40), () => new THREE.DodecahedronGeometry(.3), () => new THREE.SphereGeometry(.28, 32, 20), () => new THREE.TorusKnotGeometry(.2, .07, 80, 12)];
  const ringDefs = [[3.1, .45, 0, -.25], [4.1, -.4, 0, .55], [5.1, .95, 0, .1]];
  const ringGroups = ringDefs.map(([R, rx, ry, rz]) => { const rg = new THREE.Group(); rg.rotation.set(rx, ry, rz); g.add(rg); const l = new THREE.Mesh(new THREE.TorusGeometry(R, .006, 6, 220), new THREE.MeshBasicMaterial({ color: AQUA, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, fog: false })); l.rotation.x = Math.PI / 2; rg.add(l); return { rg, R }; });
  const orbs = SERVICES.map((s, i) => {
    const grp = ringGroups[i % 3]; const holder = new THREE.Group(); grp.rg.add(holder);
    const mat = new THREE.MeshPhysicalMaterial({ color: s[3], emissive: s[3], emissiveIntensity: .45, metalness: .35, roughness: .2, clearcoat: 1, envMapIntensity: 1.2 });
    const m = new THREE.Mesh(shapes[i % shapes.length](), mat); holder.add(m);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX_GLOW_AQ, color: s[3], blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .55, fog: false })); halo.scale.setScalar(1.7); holder.add(halo);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(.62, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); holder.add(hit); hit.userData.idx = i;
    const o = { holder, m, halo, hit, mat, ring: grp, ang0: (Math.floor(i / 3)) / 4 * 6.283 + (i % 3) * .5, k: 1, i };
    o.tag = addTag(6, s[0], v => holder.getWorldPosition(v), 'svc'); return o;
  });
  const st = { i: 6, group: g, pick: orbs.map(o => o.hit), orbs, T: 0 };
  st.update = (t, dt, a) => {
    const busy = svcState.hover >= 0 || svcState.sel >= 0; svcState.speed = damp(svcState.speed, busy ? .12 : 1, 3, dt); st.T += dt * svcState.speed;
    coreSpin.rotation.y = t * .3; coreSpin.position.y = Math.sin(t * .8) * .08;
    ringGroups.forEach((r, k) => { r.rg.rotation.y += dt * .03 * (k % 2 ? -1 : 1) * svcState.speed; });
    orbs.forEach(o => {
      const an = o.ang0 + st.T * (.28 - (o.i % 3) * .05) * (o.i % 2 ? 1 : -1); const R = o.ring.R;
      o.holder.position.set(Math.cos(an) * R, 0, Math.sin(an) * R);
      const want = svcState.hover === o.i || svcState.sel === o.i ? 1.55 : 1; o.k = damp(o.k, want, 9, dt); o.m.scale.setScalar(o.k); o.m.rotation.x += dt * .6; o.m.rotation.y += dt * .8;
      o.halo.scale.setScalar(1.5 + o.k * .9); o.mat.emissiveIntensity = .35 + (o.k - 1) * .9; o.halo.material.opacity = .4 + (o.k - 1) * .6;
      o.tag.el.classList.toggle('hot', svcState.hover === o.i || svcState.sel === o.i);
    });
  };
  st.onHover = (hit) => { svcState.hover = hit ? hit.object.userData.idx : -1; };
  st.onClick = (hit) => { if (hit) selectService(hit.object.userData.idx, hit.point); };
  stages.push(st);
}
function selectService(i, p) {
  svcState.sel = i; const s = SERVICES[i]; $('#svcTitle').textContent = s[0]; $('#svcText').textContent = s[1]; const a = $('#svcLink'); a.textContent = 'Learn more ↗'; a.href = BASE + s[2];
  if (p) sparkles.burst(p, 40, s[3], 2.2, .13, 1.2); ping(i % 5); flash(.15);
}

/* ═══════ STAGE 7 — VISIT ═══════ */
{
  const g = stageGroup(7); ambience(7, g, { gold: true });
  const gold = new THREE.PointLight(GOLD, 0, 0, 2); gold.position.set(7 * STAGE_DX + 2, 1.5, 3); scene.add(gold);
  const tooth = makeTooth(); const spin = new THREE.Group(); spin.add(tooth); g.add(spin);
  const crownRing = new THREE.Mesh(new THREE.TorusGeometry(2.6, .02, 8, 200), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, fog: false }));
  crownRing.rotation.x = 1.15; g.add(crownRing);
  const st = { i: 7, group: g, spin, vy: .25, idle: .25, pick: [tooth.userData.crown, ...tooth.userData.roots], lights: [gold] };
  st.update = (t, dt, a) => {
    gold.intensity = 40 * a;
    spin.rotation.x = damp(spin.rotation.x, -ptr.sy * .2, 3, dt); spin.position.y = Math.sin(t * .7) * .1; crownRing.rotation.z += dt * .2;
    if (a > .3 && Math.random() < dt * 30) { const an = Math.random() * 6.283, R = 1 + Math.random() * 3.6; sparkles.emit(g.position.x + Math.cos(an) * R, -2.4, Math.sin(an) * R * .8, 0, .5 + Math.random() * .8, 0, Math.random() > .5 ? GOLD : 0xfff3d2, .07 + Math.random() * .08, 3.2); }
  };
  st.onClick = (hit) => { sparkles.burst(hit ? hit.point : new THREE.Vector3(g.position.x, .5, 0), 90, GOLD, 3.4, .17, 1.8); ping(4); flash(.3); };
  stages.push(st);
}

/* ───────────────────────── audio ───────────────────────── */
let actx = null, soundOn = false;
const SCALE = [0, 2, 4, 7, 9, 12];
function ping(i = 0, vol = .05) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume();
    const f = 523.25 * Math.pow(2, SCALE[i % SCALE.length] / 12), t0 = actx.currentTime;
    [1, 2.01, 3.02].forEach((m, k) => { const o = actx.createOscillator(), gn = actx.createGain(); o.type = 'sine'; o.frequency.value = f * m; gn.gain.setValueAtTime(0, t0); gn.gain.linearRampToValueAtTime(vol / (k + 1), t0 + .01); gn.gain.exponentialRampToValueAtTime(.0001, t0 + 1.4 / (k + 1)); o.connect(gn).connect(actx.destination); o.start(t0); o.stop(t0 + 1.5); });
  } catch (e) { /* audio unavailable */ }
}

/* ───────────────────────── pointer / input ───────────────────────── */
const ptr = { nx: 0, ny: 0, sx: 0, sy: 0, cx: innerWidth / 2, cy: innerHeight / 2, down: false, drag: false, moved: 0, lastX: 0, onCanvas: false, wx: 0, wy: 0, wz: 0 };
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
let flashV = 0; function flash(v) { flashV = Math.max(flashV, v); }
const cur = $('#cursor'); let curX = innerWidth / 2, curY = innerHeight / 2;
addEventListener('pointermove', e => {
  ptr.nx = e.clientX / innerWidth * 2 - 1; ptr.ny = -(e.clientY / innerHeight) * 2 + 1; ptr.cx = e.clientX; ptr.cy = e.clientY; ptr.onCanvas = e.target === canvas;
  if (ptr.down) { const dx = e.clientX - ptr.lastX; ptr.moved += Math.abs(dx); ptr.lastX = e.clientX; const s = stages[activeI()]; if (s && s.spin && ptr.moved > 4 && ptr.onCanvasDown) { ptr.drag = true; s.spin.rotation.y += dx * .012; s.vy = dx * .012 / Math.max(.008, 1 / 60) * .6; } }
});
addEventListener('pointerdown', e => { ptr.down = true; ptr.moved = 0; ptr.lastX = e.clientX; ptr.onCanvasDown = e.target === canvas; ptr.drag = false; });
addEventListener('pointerup', e => {
  const wasClick = ptr.down && ptr.moved < 6 && ptr.onCanvasDown && e.target === canvas; ptr.down = false;
  if (wasClick) { const s = stages[activeI()]; if (s && s.onClick) { const hit = pickAt(s); s.onClick(hit); } }
});
addEventListener('pointerleave', () => { ptr.onCanvas = false; });
function pickAt(s) { if (!s.pick) return null; ndc.set(ptr.nx, ptr.ny); ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(s.pick, false); return h[0] || null; }
$$('a,button,input').forEach(el => { el.addEventListener('pointerenter', () => cur.classList.add('hot')); el.addEventListener('pointerleave', () => cur.classList.remove('hot')); });

/* UI wiring */
const alignEl = $('#align'), shadeEl = $('#shade'), explEl = $('#explode');
[alignEl, shadeEl, explEl].forEach(el => { const f = () => el.style.setProperty('--v', el.value + '%'); el.addEventListener('input', f); f(); });
alignEl.addEventListener('input', () => { alignState.touched = true; alignState.target = alignEl.value / 100; ping(Math.floor(alignEl.value / 18), .025); });
$('#alignReplay').addEventListener('click', () => { alignState.touched = false; alignState.target = 0; alignState.v = 0; setAlignUI(0); setTimeout(runAlignAuto, 250); });
shadeEl.addEventListener('input', () => { shadeState.anim = false; shadeState.target = shadeEl.value / 100; });
$('#brightenBtn').addEventListener('click', () => { shadeState.anim = true; shadeState.target = 1; shadeEl.value = 100; shadeEl.style.setProperty('--v', '100%'); ping(5); flash(.2); });
explEl.addEventListener('input', () => { implantState.target = explEl.value / 100; });
$$('#scanSeg button').forEach(b => b.addEventListener('click', () => { $$('#scanSeg button').forEach(x => x.classList.toggle('on', x === b)); scanState.mode = b.dataset.mode; flash(.45); ping(scanState.mode === 'xray' ? 4 : 0); }));
$('#reliefBtn').addEventListener('click', () => {
  reliefState.target = reliefState.target ? 0 : 1; const on = reliefState.target === 1;
  $('#reliefLbl').textContent = on ? 'Relief achieved ✓' : 'Feel the pain'; $('#reliefBtn').classList.toggle('relief', on);
  $('#reliefNote').textContent = on ? 'That’s the Discovery Dental difference: calm, caring, same-day help.' : 'Tap the button to see how we change the story.';
  if (on) { sparkles.burst(new THREE.Vector3(5 * STAGE_DX, .6, 1), 90, AQUA, 3.4, .17, 1.8); flash(.5); ping(4, .07); }
});
const soundBtn = $('#soundBtn');
soundBtn.addEventListener('click', () => { soundOn = !soundOn; soundBtn.setAttribute('aria-pressed', soundOn); $('#soundLbl').textContent = soundOn ? 'Sound on' : 'Sound off'; if (soundOn) ping(0); });

/* chapters / scroll */
const sections = $$('.chapter'); const dotsEl = $('#dots');
sections.forEach((s, i) => { const b = document.createElement('button'); b.setAttribute('aria-label', s.dataset.name); b.innerHTML = '<span>' + s.dataset.name + '</span>'; b.addEventListener('click', () => s.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' })); dotsEl.appendChild(b); });
const dotBtns = $$('button', dotsEl);
$$('[data-go]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); sections[+a.dataset.go].scrollIntoView({ behavior: 'smooth' }); }));
$$('.split').forEach(h => { let n = 0; const walk = node => { [...node.childNodes].forEach(c => { if (c.nodeType === 3) { const frag = document.createDocumentFragment(); c.textContent.split(/(\s+)/).forEach(w => { if (!w.trim()) { frag.appendChild(document.createTextNode(w)); return; } const sp = document.createElement('span'); sp.className = 'w'; sp.style.setProperty('--i', n++); sp.textContent = w; frag.appendChild(sp); }); c.replaceWith(frag); } else if (c.nodeType === 1) walk(c); }); }; walk(h); });
$$('.chapter .rv').forEach((el, k) => { el.style.setProperty('--i', 3 + (k % 6)); });
let tops = [], sceneP = 0, scrollP = 0;
function measure() { tops = sections.map(s => s.offsetTop); }
function scrollProgress() {
  const y = scrollY + 1; let i = 0; for (let k = 0; k < tops.length; k++) if (y >= tops[k] - 1) i = k;
  if (i >= tops.length - 1) return tops.length - 1;
  return i + clamp((y - tops[i]) / (tops[i + 1] - tops[i]), 0, 1);
}
const activeI = () => clamp(Math.round(sceneP), 0, N - 1);

/* camera path */
const KEYS = [
  { p: [0, .8, 9.2], l: [0, .1, 0] }, { p: [1.2, 1.0, 10.4], l: [0, .1, 0] }, { p: [-.3, 5.6, 14.2], l: [-.9, .1, .6] }, { p: [-.3, 4.8, 14.4], l: [-.9, .1, .6] },
  { p: [0, 1.5, 12.4], l: [0, .5, 0] }, { p: [-1.2, .6, 8.8], l: [0, .1, 0] }, { p: [0, 2.8, 13.4], l: [0, 0, 0] }, { p: [0, .6, 9.8], l: [0, .2, 0] }
];
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tA = new THREE.Vector3(), tB = new THREE.Vector3();
let fit = 1;
function layout() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h;
  const desk = w >= 900; camera.setViewOffset(w, h, desk ? -w * .13 : 0, desk ? 0 : h * .13, w, h); camera.updateProjectionMatrix();
  fit = clamp(1.32 / camera.aspect, 1, 2.6);
  const px = renderer.domElement.height ? renderer.getPixelRatio() * h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) : 800;
  sparkles.mat.uniforms.uPx.value = px; dustMat.uniforms.uPx.value = px; measure();
}
addEventListener('resize', layout); layout(); addEventListener('load', measure);

/* ───────────────────────── main loop ───────────────────────── */
let last = performance.now(), T = 0, prevP = 0, introT = 0, started = false;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
  scrollP = scrollProgress(); sceneP = damp(sceneP, scrollP, REDUCED ? 30 : 5, dt);
  const vel = Math.abs(sceneP - prevP) / Math.max(dt, .001); prevP = sceneP;
  ptr.sx = damp(ptr.sx, ptr.nx, 4, dt); ptr.sy = damp(ptr.sy, ptr.ny, 4, dt);
  introT = clamp((performance.now() - T0) / 2800, 0, 1); const intro = 1 - sm5(introT);

  // camera
  const pf = clamp(sceneP, 0, N - 1), i0 = Math.min(N - 2, Math.floor(pf)), f = pf - i0;
  const e = sm5(clamp((f - .16) / .68, 0, 1)); const k0 = KEYS[i0], k1 = KEYS[i0 + 1];
  tA.set(k0.p[0] + i0 * STAGE_DX, k0.p[1], k0.p[2]); tB.set(k1.p[0] + (i0 + 1) * STAGE_DX, k1.p[1], k1.p[2]); camPos.lerpVectors(tA, tB, e);
  tA.set(k0.l[0] + i0 * STAGE_DX, k0.l[1], k0.l[2]); tB.set(k1.l[0] + (i0 + 1) * STAGE_DX, k1.l[1], k1.l[2]); camLook.lerpVectors(tA, tB, e);
  const arc = Math.sin(Math.PI * e) * (REDUCED ? 0 : 1);
  camPos.y += arc * 1.1; camPos.z += arc * 2.6;
  const dirv = tA.copy(camPos).sub(camLook); dirv.multiplyScalar(fit); camPos.copy(camLook).add(dirv);
  camPos.x += ptr.sx * .55; camPos.y += ptr.sy * .38 + intro * 1.2; camPos.z += intro * 6;
  camera.position.copy(camPos); camera.lookAt(camLook); camera.rotation.z += arc * .035 * (i0 % 2 ? -1 : 1); camera.updateMatrixWorld();

  // pointer in world for sparkle trail
  ray.setFromCamera(ndc.set(ptr.nx, ptr.ny), camera); const dist = camPos.distanceTo(camLook);
  ptr.wx = ray.ray.origin.x + ray.ray.direction.x * dist * .92; ptr.wy = ray.ray.origin.y + ray.ray.direction.y * dist * .92; ptr.wz = ray.ray.origin.z + ray.ray.direction.z * dist * .92;
  if (!REDUCED && ptr.onCanvas && (Math.abs(ptr.nx - (ptr._px || 0)) + Math.abs(ptr.ny - (ptr._py || 0))) > .004) { sparkles.emit(ptr.wx, ptr.wy, ptr.wz, (Math.random() - .5) * .6, (Math.random() - .5) * .6 - .15, (Math.random() - .5) * .6, Math.random() > .7 ? GOLD : AQUA, .05 + Math.random() * .07, .9 + Math.random() * .6); }
  ptr._px = ptr.nx; ptr._py = ptr.ny;

  // stages
  const ai = activeI();
  for (const s of stages) {
    const d = Math.abs(sceneP - s.i), near = d < .86; s.group.visible = near;
    if (!near) { if (s.lights) s.lights.forEach(l => { l.intensity = 0; }); continue; }
    if (s.spin) { s.vy = damp(s.vy, ptr.down && ptr.drag ? s.vy : (s.idle ?? .3), ptr.drag && ptr.down ? 0 : 2, dt); if (!(s.i === 5)) s.spin.rotation.y += (ptr.drag && ptr.down ? 0 : s.vy * dt); }
    s.update(T, dt, clamp(1 - d * 1.2, 0, 1));
  }
  // hover picking on active stage
  const sA = stages[ai]; let hit = null;
  if (sA && sA.pick && ptr.onCanvas) { hit = pickAt(sA); }
  if (sA && sA.onHover) sA.onHover(hit);
  canvas.style.cursor = hit ? 'pointer' : (sA && sA.spin ? (ptr.down && ptr.drag ? 'grabbing' : 'grab') : 'default');

  sparkles.update(dt);
  dustMat.uniforms.uTime.value = T;
  flashV = damp(flashV, 0, 5, dt); finalPass.uniforms.uFlash.value = flashV; finalPass.uniforms.uTime.value = T % 10; finalPass.uniforms.uAb.value = damp(finalPass.uniforms.uAb.value, clamp(vel * .5, 0, 1), 6, dt);
  bloom.strength = .38 + flashV * .8;

  // html state
  sections.forEach((s, i) => s.classList.toggle('on', Math.abs(sceneP - i) < .55));
  dotBtns.forEach((b, i) => b.classList.toggle('on', i === ai));
  $('#progFill').style.width = (sceneP / (N - 1) * 100) + '%';
  for (const t of TAGS) {
    const a = clamp(1 - Math.abs(sceneP - t.stage) * 2.4, 0, 1) * t.show;
    if (a < .01) { if (t._o !== 0) { t.el.style.opacity = 0; t._o = 0; } continue; }
    t.getPos(_v); _v.project(camera); if (_v.z > 1) { t.el.style.opacity = 0; continue; }
    t.el.style.opacity = a.toFixed(3); t._o = a; t.el.style.transform = 'translate(' + ((_v.x * .5 + .5) * innerWidth).toFixed(1) + 'px,' + ((-_v.y * .5 + .5) * innerHeight).toFixed(1) + 'px)';
  }
  curX = damp(curX, ptr.cx, 18, dt); curY = damp(curY, ptr.cy, 18, dt); cur.style.transform = 'translate(' + curX.toFixed(1) + 'px,' + curY.toFixed(1) + 'px)';
  composer.render(dt);
  if (!started) { started = true; requestAnimationFrame(() => { $('#loader').classList.add('done'); }); }
}
measure();
requestAnimationFrame(frame);
window.__dd = { stages, camera, scene, renderer, get p() { return sceneP; } };
