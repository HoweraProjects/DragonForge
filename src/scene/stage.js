// 3D 舞台：鍛造祭壇、魔法陣、粒子、泛光後製、鏡頭運鏡
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildAvatar, POSES } from './avatar.js';
import { VRMAvatar } from './vrmAvatar.js';

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

function circleTexture(inner = false) {
  const S = 1024; const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'); g.translate(S / 2, S / 2);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8;
  const ring = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
  if (!inner) {
    ring(500, 6); ring(470, 2); ring(400, 3); ring(385, 1.5);
    g.font = '44px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 48; i++) { g.save(); g.rotate((i / 48) * Math.PI * 2); g.fillText(RUNES[i % RUNES.length], 0, -437); g.restore(); }
    for (let i = 0; i < 96; i++) { g.save(); g.rotate((i / 96) * Math.PI * 2); g.fillRect(-1, -400, 2, i % 4 === 0 ? 22 : 10); g.restore(); }
  } else {
    ring(330, 3); ring(250, 2); ring(120, 2);
    const star = (n, r, skip) => { g.lineWidth = 2.5; g.beginPath(); for (let i = 0; i <= n; i++) { const a = ((i * skip) / n) * Math.PI * 2 - Math.PI / 2; const x = Math.cos(a) * r; const y = Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
    star(7, 330, 3); star(6, 250, 1);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.arc(Math.cos(a) * 330, Math.sin(a) * 330, 26, 0, Math.PI * 2); g.stroke(); g.font = '30px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(RUNES[i * 3], Math.cos(a) * 330, Math.sin(a) * 330); }
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t;
}

function spriteTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, aberr: { value: 0.0015 }, flash: { value: 0 }, flashColor: { value: new THREE.Color(1, 1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float aberr; uniform float flash; uniform vec3 flashColor; varying vec2 vUv;
    float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r = length(d);
      vec2 off = d * aberr * (1.0 + r * 4.0);
      vec4 c = texture2D(tDiffuse, vUv);
      c.r = texture2D(tDiffuse, vUv + off).r;
      c.b = texture2D(tDiffuse, vUv - off).b;
      c.rgb *= smoothstep(0.95, 0.25, r);
      c.rgb += (rand(vUv * 800.0 + time) - 0.5) * 0.025;
      c.rgb += flashColor * flash * (1.0 - r);
      gl_FragColor = c;
    }`,
};

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    const renderer = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.mobile = matchMedia('(pointer: coarse)').matches;
    renderer.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1.5 : 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#07060f', 0.055);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
    camera.position.set(0, 1.4, 6.5);
    const controls = this.controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.07; controls.enablePan = false;
    controls.minDistance = 0.9; controls.maxDistance = 9; controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.75;
    controls.target.set(0, 1.0, 0);
    controls.addEventListener('start', () => { this.camTween = null; this.lastInteract = performance.now(); });

    this.accent = new THREE.Color('#5ad1ff');

    // 背景天幕
    const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { time: { value: 0 }, accent: { value: this.accent } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float time; uniform vec3 accent; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
        void main(){
          float y = vP.y;
          vec3 col = mix(vec3(0.02,0.015,0.05), vec3(0.06,0.03,0.12), smoothstep(-0.2, 0.6, y));
          col += accent * 0.06 * smoothstep(0.3, -0.1, abs(y - 0.05));
          vec3 sp = floor(vP * 260.0);
          float s = step(0.9965, h(sp)) * (0.5 + 0.5 * sin(time * 2.0 + h(sp + 1.0) * 40.0));
          col += vec3(s) * smoothstep(0.0, 0.3, y);
          float neb = sin(vP.x * 6.0 + time * 0.05) * sin(vP.y * 5.0) * sin(vP.z * 4.0 + 1.3);
          col += mix(vec3(0.25,0.08,0.4), accent * 0.5, 0.5 + 0.5 * sin(time*0.1)) * max(0.0, neb) * 0.12 * smoothstep(-0.1, 0.5, y);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    scene.add(sky); this.sky = sky;

    // 光源
    const hemi = this.hemi = new THREE.HemisphereLight('#8fa8ff', '#1a0f24', 0.55); scene.add(hemi);
    const key = this.keyLight = new THREE.DirectionalLight('#fff1dd', 1.7); key.position.set(2.5, 5, 3.5);
    key.castShadow = true; key.shadow.mapSize.setScalar(this.mobile ? 1024 : 2048); key.shadow.camera.left = -2; key.shadow.camera.right = 2; key.shadow.camera.top = 3; key.shadow.camera.bottom = -1; key.shadow.bias = -0.0005; key.shadow.radius = 4;
    scene.add(key);
    const rim = this.rimLight = new THREE.DirectionalLight('#5ad1ff', 1.8); rim.position.set(-3, 3, -4); scene.add(rim);
    const rim2 = this.rimLight2 = new THREE.DirectionalLight('#ff7ad9', 0.9); rim2.position.set(3.5, 1.5, -3); scene.add(rim2);
    const under = this.underLight = new THREE.PointLight('#5ad1ff', 1.5, 3, 2); under.position.set(0, 0.7, 1.2); scene.add(under);

    // 地板：石台
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: '#07060d', roughness: 0.55, metalness: 0.3, envMapIntensity: 0.15 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.7, 0.12, 64), new THREE.MeshStandardMaterial({ color: '#15121f', roughness: 0.6, metalness: 0.4, envMapIntensity: 0.3 }));
    dais.position.y = 0.06 - 0.001; dais.receiveShadow = true; scene.add(dais);
    const daisRim = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.012, 8, 128), new THREE.MeshBasicMaterial({ color: '#fff', toneMapped: false }));
    daisRim.rotation.x = Math.PI / 2; daisRim.position.y = 0.11; scene.add(daisRim); this.daisRim = daisRim;

    const mkCircle = (tex, size, y) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: this.accent.clone().multiplyScalar(1.6), toneMapped: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = y; scene.add(m); return m;
    };
    this.circleOuter = mkCircle(circleTexture(false), 3.2, 0.125);
    this.circleInner = mkCircle(circleTexture(true), 2.3, 0.13);
    this.circleFar = mkCircle(circleTexture(false), 9, 0.01); this.circleFar.material.opacity = 0.18;

    // 光柱
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.5, 7, 48, 1, true), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { time: { value: 0 }, color: { value: this.accent }, boost: { value: 0 } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float time; uniform vec3 color; uniform float boost; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 1.5); float a = (1.0 - vUv.y) * 0.9 * (0.55 + 0.45 * sin(vUv.x * 40.0 + time * 1.5) * sin(vUv.y * 9.0 - time * 2.0));
          gl_FragColor = vec4(color * 1.4, (boost * 0.22) * a * f); }`,
    }));
    beam.position.y = 3.5; scene.add(beam); this.beam = beam;

    // 漂浮粒子
    const N = 600; const pg = new THREE.BufferGeometry(); const pos = new Float32Array(N * 3); const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { const r = 0.4 + Math.random() * 3.5; const a = Math.random() * Math.PI * 2; pos.set([Math.cos(a) * r, Math.random() * 4, Math.sin(a) * r], i * 3); seed[i] = Math.random(); }
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.motes = new THREE.Points(pg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, color: { value: this.accent }, tex: { value: spriteTexture() }, px: { value: renderer.getPixelRatio() } },
      vertexShader: `uniform float time; uniform float px; attribute float seed; varying float vA;
        void main(){ vec3 p = position; float t = time * (0.08 + seed * 0.12) + seed * 10.0; p.y = mod(p.y + t, 4.2);
          float ang = time * 0.05 * (seed - 0.5); p.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xz;
          vA = smoothstep(0.0, 0.6, p.y) * smoothstep(4.2, 3.0, p.y) * (0.4 + 0.6 * sin(time * 3.0 + seed * 30.0) * 0.5 + 0.3);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (18.0 + seed * 22.0) * px / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D tex; uniform vec3 color; varying float vA; void main(){ vec4 t = texture2D(tex, gl_PointCoord); gl_FragColor = vec4(color * 2.0, t.a * vA); }`,
    }));
    scene.add(this.motes);

    // 環繞符文
    this.runeRing = new THREE.Group(); scene.add(this.runeRing);
    for (let i = 0; i < 12; i++) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.font = '92px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#fff'; g.shadowBlur = 16; g.fillText(RUNES[(i * 5) % RUNES.length], 64, 70);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: this.accent.clone().multiplyScalar(1.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.7 }));
      const a = (i / 12) * Math.PI * 2; sp.position.set(Math.cos(a) * 1.9, 0.6 + (i % 3) * 0.55, Math.sin(a) * 1.9); sp.scale.setScalar(0.22);
      this.runeRing.add(sp);
    }

    // 後製
    const composer = this.composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.5, 0.92);
    composer.addPass(this.bloom);
    this.post = new ShaderPass(VignetteShader); composer.addPass(this.post);
    composer.addPass(new OutputPass());

    this.avatarHolder = new THREE.Group(); this.avatarHolder.position.y = 0.12; scene.add(this.avatarHolder);
    this.avatar = null;
    this.bursts = [];
    this.action = null; this.mouse = new THREE.Vector2();
    this.clock = new THREE.Clock();
    this.lastInteract = 0; this.autoRotate = true;
    this.sprite = spriteTexture();

    window.addEventListener('pointermove', (e) => { this.mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); });
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
    this.focus('intro', true);
    renderer.setAnimationLoop(() => this.tick());
  }

  resize() {
    const el = this.canvas.parentElement; const w = el.clientWidth; const h = el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // 窄螢幕時拉遠
    this.camera.fov = w / h < 0.8 ? 38 : 30;
    this.camera.updateProjectionMatrix();
  }

  setAccent(hex) {
    this.targetAccent = new THREE.Color(hex);
  }

  disposeProcedural() {
    if (this.avatar && !this.avatar.isVRM) {
      this.avatarHolder.remove(this.avatar.root);
      this.avatar.root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); if (o.material.dispose && !o.material.isShaderMaterial) o.material.dispose(); } });
    }
  }

  // 依序處理外觀更新；載入中又有新請求時，只處理最新的那一筆
  async setLook(look, cls, cb = {}) {
    this.pendingLook = { look: structuredClone(look), cls, cb };
    if (this.lookRunning) return;
    this.lookRunning = true;
    try {
      while (this.pendingLook) { const job = this.pendingLook; this.pendingLook = null; await this.applyLook(job.look, job.cls, job.cb); }
    } finally { this.lookRunning = false; }
  }

  // MToon 對光比較敏感，VRM 模式降低整體亮度
  setLightProfile(vrm) {
    this.lightK = vrm ? 0.55 : 1;
    this.hemi.intensity = vrm ? 0.35 : 0.55; this.keyLight.intensity = vrm ? 1.0 : 1.7;
    this.rimLight.intensity = vrm ? 0.9 : 1.8; this.rimLight2.intensity = vrm ? 0.45 : 0.9;
  }

  async applyLook(look, cls, { onProgress, onState } = {}) {
    this.setLightProfile(look.model !== 'chibi');
    if (look.model === 'chibi') {
      if (this.vrm) this.avatarHolder.remove(this.vrm.root);
      this.disposeProcedural();
      this.avatar = buildAvatar(look, { cls });
      this.avatarHolder.add(this.avatar.root);
      return;
    }
    if (!this.vrm) this.vrm = new VRMAvatar();
    const needLoad = this.vrm.bodyId !== look.vrmBody || (this.vrm.hairId || this.vrm.bodyId) !== (look.vrmHair || look.vrmBody);
    if (needLoad) {
      onState?.('loading');
      if (!this.avatar) { this.avatar = buildAvatar({ ...look, model: 'chibi' }, { cls }); this.avatarHolder.add(this.avatar.root); }
      try { await this.vrm.setModels(look.vrmBody, look.vrmHair, onProgress); } catch (err) { onState?.('error', err); return; }
    }
    this.disposeProcedural();
    if (this.vrm.root.parent !== this.avatarHolder) this.avatarHolder.add(this.vrm.root);
    this.vrm.apply(look, cls);
    this.avatar = this.vrm;
    if (needLoad) onState?.('ready');
  }

  // 鏡頭預設位
  focus(name, instant = false) {
    const h = this.avatar ? this.avatar.headTopY + 0.12 : 1.9;
    const presets = {
      intro: { t: [0, 1.4, 0], p: [0, 2.6, 11] },
      full: { t: [0, h * 0.52, 0], p: [0.9, h * 0.62, 5.6 + h * 0.4] },
      side: { t: [0, h * 0.5, 0], p: [3.6, h * 0.65, 3.8] },
      upper: { t: [0, h * 0.78, 0], p: [0.5, h * 0.82, 2.7] },
      face: { t: [0, h - 0.17 * (h / 1.9), 0], p: [0.25, h - 0.12, 1.05 + h * 0.18] },
      back: { t: [0, h * 0.55, 0], p: [-1.5, h * 0.7, -4.5] },
      summary: { t: [0.45, h * 0.52, 0], p: [-0.6, h * 0.6, 5.2 + h * 0.3] },
    };
    const pr = presets[name] || presets.full;
    const t = new THREE.Vector3(...pr.t); const p = new THREE.Vector3(...pr.p);
    // 直式螢幕：拉遠鏡頭，讓整個角色入鏡
    if (this.camera.aspect < 0.8) { const k = name === 'face' ? 1.5 : 1.75; p.sub(t).multiplyScalar(k).add(t); }
    if (instant) { this.controls.target.copy(t); this.camera.position.copy(p); this.camTween = null; return; }
    this.camTween = { t0: this.controls.target.clone(), p0: this.camera.position.clone(), t1: t, p1: p, start: performance.now(), dur: 1100 };
    this.focusName = name;
  }

  play(actionName, dur = 1.4) { this.action = { name: actionName, start: performance.now(), dur }; }

  // 爆發特效：光環衝擊波 + 粒子
  burst(color = '#5ad1ff', { at = null, count = 120, ring = true, flash = 0.35, up = 1 } = {}) {
    const c = new THREE.Color(color);
    const origin = at ? at.clone() : new THREE.Vector3(0, 0.15, 0);
    const N = count; const g = new THREE.BufferGeometry(); const pos = new Float32Array(N * 3); const vel = [];
    for (let i = 0; i < N; i++) {
      pos.set([origin.x, origin.y, origin.z], i * 3);
      const a = Math.random() * Math.PI * 2; const sp = 0.6 + Math.random() * 2.2;
      vel.push(new THREE.Vector3(Math.cos(a) * sp, (Math.random() * 2.5 + 0.5) * up, Math.sin(a) * sp));
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: this.sprite, size: 0.09, color: c.clone().multiplyScalar(2.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.scene.add(pts);
    const b = { pts, vel, life: 0, max: 1.6 };
    if (ring) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 64), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      r.rotation.x = -Math.PI / 2; r.position.copy(origin); r.position.y = Math.max(0.14, origin.y); r.scale.setScalar(0.1); this.scene.add(r); b.ring = r;
    }
    this.bursts.push(b);
    if (flash) { this.post.uniforms.flash.value = flash; this.post.uniforms.flashColor.value.copy(c); }
    this.beamBoost = 1;
  }

  handWorld() {
    const v = new THREE.Vector3();
    if (this.avatar) this.avatar.rig.handR.getWorldPosition(v); else v.set(0, 1.2, 0.3);
    return v;
  }

  castSpell(color) {
    this.play('cast', 1.3);
    setTimeout(() => {
      const at = this.handWorld();
      this.burst(color, { at, count: 90, ring: false, flash: 0.15, up: 0.6 });
      // 法術陣
      const tex = this.circleInner.material.map;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(color).multiplyScalar(2.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      m.position.copy(at); m.lookAt(this.camera.position); this.scene.add(m);
      this.bursts.push({ sigil: m, life: 0, max: 1.2 });
    }, 380);
  }

  // 立繪：暫時改用固定的全身構圖（不受面板偏移影響），渲染後還原
  snapshot(w = 768, h = 1024, type = 'image/png') {
    const r = this.renderer; const cam = this.camera;
    const prev = new THREE.Vector2(); r.getSize(prev);
    const saved = { pos: cam.position.clone(), aspect: cam.aspect, fov: cam.fov, view: cam.view ? { ...cam.view } : null, rot: this.avatarHolder.rotation.y };
    const hTop = this.avatar ? this.avatar.headTopY + 0.15 : 2;
    const target = new THREE.Vector3(0, hTop * 0.5, 0);
    cam.clearViewOffset(); cam.fov = 30; cam.aspect = w / h;
    const dist = (hTop * 0.56) / Math.tan(THREE.MathUtils.degToRad(15)) + 0.3;
    cam.position.set(dist * 0.22, hTop * 0.6, dist); cam.lookAt(target);
    cam.updateProjectionMatrix(); this.avatarHolder.rotation.y = 0.25;
    if (this.avatar) this.animateAvatar(this.time || 0, 0.016);
    const flash = this.post.uniforms.flash.value; this.post.uniforms.flash.value = 0; this.beam.material.uniforms.boost.value = 0; // 分頁在背景時動畫迴圈可能暫停，拍照前先套用姿勢
    r.setSize(w, h, false); this.composer.setSize(w, h);
    this.composer.render();
    const url = this.canvas.toDataURL(type, 0.88);
    this.post.uniforms.flash.value = flash;
    r.setSize(prev.x, prev.y, false); this.composer.setSize(prev.x, prev.y);
    cam.position.copy(saved.pos); cam.aspect = saved.aspect; cam.fov = saved.fov; this.avatarHolder.rotation.y = saved.rot;
    if (saved.view) cam.setViewOffset(saved.view.fullWidth, saved.view.fullHeight, saved.view.offsetX, saved.view.offsetY, saved.view.width, saved.view.height);
    cam.updateProjectionMatrix(); cam.lookAt(this.controls.target);
    return url;
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.2); const t = this.clock.elapsedTime;
    this.time = t;
    // 主題色漸變
    if (this.targetAccent) {
      this.accent.lerp(this.targetAccent, 1 - Math.pow(0.02, dt));
      const a2 = this.accent.clone().multiplyScalar(1.6);
      this.circleOuter.material.color.copy(a2); this.circleInner.material.color.copy(a2); this.circleFar.material.color.copy(a2);
      this.rimLight.color.copy(this.accent); this.underLight.color.copy(this.accent);
      this.daisRim.material.color.copy(this.accent).multiplyScalar(2.2);
      this.runeRing.children.forEach((s) => s.material.color.copy(a2));
    }
    this.circleOuter.rotation.z += dt * 0.12; this.circleInner.rotation.z -= dt * 0.25; this.circleFar.rotation.z += dt * 0.02;
    this.runeRing.rotation.y += dt * 0.18;
    this.runeRing.children.forEach((s, i) => { s.position.y = 0.6 + (i % 3) * 0.55 + Math.sin(t * 1.2 + i) * 0.08; });
    this.sky.material.uniforms.time.value = t; this.motes.material.uniforms.time.value = t; this.beam.material.uniforms.time.value = t;
    this.beamBoost = Math.max(0, (this.beamBoost || 0) - dt * 0.8);
    this.beam.material.uniforms.boost.value = this.beamBoost;
    this.underLight.intensity = (1.4 + Math.sin(t * 2) * 0.3 + this.beamBoost * 6) * (this.lightK ?? 1);
    this.post.uniforms.time.value = t;
    this.post.uniforms.flash.value = Math.max(0, this.post.uniforms.flash.value - dt * 1.2);

    // 鏡頭補間
    if (this.camTween) {
      const k = Math.min(1, (performance.now() - this.camTween.start) / this.camTween.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.controls.target.lerpVectors(this.camTween.t0, this.camTween.t1, e);
      this.camera.position.lerpVectors(this.camTween.p0, this.camTween.p1, e);
      if (k >= 1) this.camTween = null;
    }
    this.controls.update();
    // 閒置時角色緩慢轉身展示
    if (this.avatar) {
      const idle = performance.now() - this.lastInteract > 6000 && this.autoRotate && !this.camTween;
      const targetRot = idle ? Math.sin(t * 0.25) * 0.5 : 0;
      this.avatarHolder.rotation.y += (targetRot - this.avatarHolder.rotation.y) * dt * 1.5;
      this.animateAvatar(t, dt);
    }

    // 特效
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]; b.life += dt; const k = b.life / b.max;
      if (b.pts) {
        const p = b.pts.geometry.attributes.position;
        for (let j = 0; j < b.vel.length; j++) { const v = b.vel[j]; v.y -= dt * 1.2; v.multiplyScalar(1 - dt * 1.4); p.setXYZ(j, p.getX(j) + v.x * dt, p.getY(j) + v.y * dt, p.getZ(j) + v.z * dt); }
        p.needsUpdate = true; b.pts.material.opacity = 1 - k;
      }
      if (b.ring) { b.ring.scale.setScalar(0.1 + k * 3.2); b.ring.material.opacity = (1 - k) * 0.9; }
      if (b.sigil) { b.sigil.scale.setScalar(0.3 + Math.min(1, k * 3) * 1.2); b.sigil.rotation.z += dt * 3; b.sigil.material.opacity = 1 - k; }
      if (k >= 1) { [b.pts, b.ring, b.sigil].forEach((o) => { if (o) { this.scene.remove(o); o.geometry.dispose(); o.material.dispose(); } }); this.bursts.splice(i, 1); }
    }
    this.composer.render();
  }

  animateAvatar(t, dt) {
    const av = this.avatar; const { anim, weapon } = av;
    const base = POSES.base; const wp = POSES[weapon] || {};
    let act = null; let w = 0;
    if (this.action) {
      const k = (performance.now() - this.action.start) / 1000 / this.action.dur;
      w = k < 0.25 ? k / 0.25 : k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      w = w * w * (3 - 2 * w);
      act = POSES[this.action.name];
      if (k >= 1) this.action = null;
    }
    const breathe = Math.sin(t * 1.6);
    const J = {};
    for (const j of ['shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'thighL', 'thighR', 'kneeL', 'kneeR', 'spine', 'head', 'hips']) {
      const b = wp[j] || base[j] || [0, 0, 0];
      const a = act && act[j] ? act[j] : b;
      J[j] = [b[0] + (a[0] - b[0]) * w, b[1] + (a[1] - b[1]) * w, b[2] + (a[2] - b[2]) * w];
    }
    // 呼吸與擺動
    J.spine[0] += breathe * 0.015;
    J.shoulderL[2] -= breathe * 0.025; J.shoulderR[2] += breathe * 0.025;
    J.hips[1] += Math.sin(t * 0.7) * 0.03;
    // 頭部看向滑鼠
    J.head[1] += this.mouse.x * 0.35 - this.avatarHolder.rotation.y * 0.5; J.head[0] += -this.mouse.y * 0.18;
    if (av.isVRM) {
      av.pose(J, t, dt, { lookTarget: this.camera });
    } else {
      const { rig } = av;
      for (const [j, r] of Object.entries(J)) rig[j]?.rotation.set(r[0], r[1], r[2]);
      rig.hips.position.y = 0.92 + breathe * 0.004;
    }
    // 眨眼
    const blink = (t % 4.2) < 0.12 ? 0.1 : 1;
    anim.eyes.forEach((e) => { e.scale.y = blink; });
    // 頭髮 / 尾巴 / 翅膀 / 披風
    anim.hairSways.forEach((h, i) => { h.o.rotation.x = Math.sin(t * 1.8 + (h.phase || 0)) * h.amp * 0.5; h.o.rotation.z = Math.sin(t * 1.3 + (h.phase || 0) + i) * h.amp * 0.6; });
    anim.tails.forEach((g) => { g.rotation.y = Math.sin(t * 1.4) * 0.45; g.rotation.x = Math.sin(t * 0.9) * 0.12; });
    anim.wings.forEach(({ g, s }) => { g.rotation.y = s * (0.55 + Math.sin(t * 1.5) * 0.18); g.rotation.z = s * Math.sin(t * 1.5) * 0.05; });
    anim.floaters.forEach((f) => {
      if (f.base != null) f.o.position.y = f.base + Math.sin(t * 2) * f.amp;
      if (f.spin) { if (f.axis === 'z') f.o.rotation.z += 0.016 * f.spin; else { f.o.rotation.x += 0.012 * f.spin; f.o.rotation.y += 0.016 * f.spin; } }
      if (f.pulse) f.o.scale.setScalar(1 + Math.sin(t * 6) * 0.15);
    });
    if (anim.skirt) anim.skirt.rotation.z = Math.sin(t * 1.1) * 0.02;
    if (anim.cape) {
      const p = anim.cape.geometry.attributes.position; const b0 = anim.capeBase;
      for (let i = 0; i < p.count; i++) {
        const x = b0[i * 3]; const y = b0[i * 3 + 1];
        const k = -y; // 0 at top → 1.05 bottom
        p.setZ(i, -k * 0.22 - Math.abs(x) * 0.25 * (1 - k) + Math.sin(t * 2.2 + k * 4 + x * 3) * 0.035 * k);
        p.setX(i, x * (1 + k * 0.25));
      }
      p.needsUpdate = true; anim.cape.geometry.computeVertexNormals();
    }
  }
}
