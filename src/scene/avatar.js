// 程序化動漫風角色模型：以基本幾何體拼裝，toon 著色 + 反轉外殼描邊
import * as THREE from 'three';

// ---------- 材質工具 ----------
const gradientMap = (() => {
  const data = new Uint8Array([70, 70, 70, 255, 165, 165, 165, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
})();

const outlineMat = new THREE.ShaderMaterial({
  uniforms: { thickness: { value: 0.012 }, color: { value: new THREE.Color('#0b0710') } },
  vertexShader: `uniform float thickness;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      mv.xyz += n * thickness * (0.6 + 0.4 * clamp(-mv.z / 4.0, 0.0, 2.0));
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }`,
  side: THREE.BackSide,
});

export function toon(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
}
export function metal(color, rough = 0.32) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: rough });
}
export function glow(color, intensity = 3) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false });
}

export function mesh(geo, mat, { outline = true, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  if (outline) { const o = new THREE.Mesh(geo, outlineMat); o.raycast = () => {}; m.add(o); }
  return m;
}

// 錐狀曲管（角、尾巴用）
export function taperTube(curve, r0, r1, segs = 24, radial = 10) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = []; const idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; const p = curve.getPointAt(t);
    const r = THREE.MathUtils.lerp(r0, r1, Math.pow(t, 0.9));
    const N = frames.normals[i]; const B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      pos.push(p.x + r * (Math.cos(a) * N.x + Math.sin(a) * B.x), p.y + r * (Math.cos(a) * N.y + Math.sin(a) * B.y), p.z + r * (Math.cos(a) * N.z + Math.sin(a) * B.z));
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j; const b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export const cap = (r, len, rs = 14) => new THREE.CapsuleGeometry(r, len, 6, rs);
export const sph = (r, ws = 24, hs = 18) => new THREE.SphereGeometry(r, ws, hs);

// 動漫臉型：下半部收窄成尖下巴
function headGeometry(r) {
  const g = new THREE.SphereGeometry(r, 40, 32);
  const p = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const ny = v.y / r;
    if (ny < 0) {
      const k = 1 - 0.32 * Math.pow(-ny, 1.4);
      v.x *= k;
      v.z = v.z * (1 - 0.12 * -ny) + (v.z > 0 ? 0.05 * r * -ny : 0);
      v.y *= 1.12;
    } else {
      v.y *= 1.04;
    }
    v.z *= 0.96;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// 動漫眼睛（自訂 shader：虹膜漸層 + 瞳孔 + 高光，可發光）
function eyeMaterial(color, glowAmt) {
  return new THREE.ShaderMaterial({
    uniforms: { iris: { value: new THREE.Color(color) }, glow: { value: glowAmt }, blink: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 iris; uniform float glow; varying vec2 vUv;
      void main(){
        vec2 p = vUv - 0.5; p.y *= 0.82;
        float d = length(p);
        if (d > 0.5) discard;
        vec3 sclera = vec3(0.86, 0.84, 0.88);
        float irisR = 0.36;
        vec3 col = sclera;
        if (length(p - vec2(0.0, -0.02)) < irisR) {
          float t = clamp((p.y + 0.3) / 0.6, 0.0, 1.0);
          col = mix(iris * 1.35, iris * 0.35, t);
          float ring = smoothstep(irisR - 0.04, irisR, length(p - vec2(0.0,-0.02)));
          col = mix(col, iris * 0.2, ring);
          if (length(p - vec2(0.0, -0.01)) < 0.13) col = mix(vec3(0.02), iris*0.4, glow);
        }
        float hl = smoothstep(0.075, 0.05, length(p - vec2(-0.11, 0.12)));
        float hl2 = smoothstep(0.04, 0.025, length(p - vec2(0.1, -0.13)));
        col = mix(col, vec3(0.9), max(hl, hl2 * 0.8));
        float lid = smoothstep(0.28, 0.42, p.y + 0.06);
        col = mix(col, vec3(0.05, 0.03, 0.06), lid);
        gl_FragColor = vec4(col * (0.92 + glow * 2.5), 1.0);
      }`,
    toneMapped: false,
  });
}

// ---------- 角色建構 ----------
const ORIG = { skin: '#f1d3b8', hairColor: '#3b2a20', eyeColor: '#4fa3ff', outfit1: '#2b3a67', outfit2: '#c9a24a' };
export function buildAvatar(look, ctx) {
  const L = { ...look };
  for (const [k, v] of Object.entries(ORIG)) if (!L[k] || L[k] === 'orig') L[k] = v;
  const cls = ctx.cls; // 職業資料
  const root = new THREE.Group();
  const rig = {};
  const anim = { capeVerts: null, tails: [], hairSways: [], wings: [], eyes: [], floaters: [] };

  const height = L.height;
  // 越矮的角色頭身比越 Q（二頭身化）
  const headScale = L.headSize * (1 + Math.max(0, 1 - height) * 0.7);
  const fem = L.bodyType; // 0 = 陽剛, 1 = 柔美
  const build = L.build; // 0 = 纖細, 1 = 壯碩

  const skinM = toon(L.skin);
  const hairM = toon(L.hairColor);
  const o1 = toon(L.outfit1);
  const o2 = toon(L.outfit2);
  const darkCloth = toon(new THREE.Color(L.outfit1).multiplyScalar(0.45));
  const leather = toon('#3a2a22');
  const goldM = metal(L.outfit2, 0.28);
  const steelM = metal('#737b8a', 0.5);
  const hornM = toon(L.hornColor);
  const outfit = cls.outfit;
  const armored = outfit === 'plate';
  const bareArms = outfit === 'fur' || outfit === 'monk';

  root.scale.setScalar(height);

  // 骨架
  const hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips); rig.hips = hips;
  const spine = new THREE.Group(); spine.position.y = 0.04; hips.add(spine); rig.spine = spine;
  const chest = new THREE.Group(); chest.position.y = 0.2; spine.add(chest); rig.chest = chest;

  const shoulderW = 0.17 + (1 - fem) * 0.04 + build * 0.04;
  const waistW = 0.12 - fem * 0.015 + build * 0.03;
  const hipW = 0.13 + fem * 0.03 + build * 0.02;
  const limbR = 0.042 + build * 0.022 - fem * 0.006;

  // 骨盆
  const pelvis = mesh(sph(1, 24, 16), armored ? darkCloth : darkCloth);
  pelvis.scale.set(hipW, 0.11, 0.1); pelvis.position.y = 0.0; hips.add(pelvis);

  // 軀幹（lathe）
  const prof = [
    [0.001, -0.24], [waistW + 0.01, -0.22], [waistW, -0.12], [waistW + 0.012, 0.0],
    [shoulderW * 0.86 + fem * 0.012, 0.1], [shoulderW * 0.92, 0.18], [shoulderW, 0.24], [shoulderW * 0.75, 0.3], [0.05, 0.33], [0.001, 0.335],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const torsoGeo = new THREE.LatheGeometry(prof, 32);
  const torsoMat = armored ? metal(new THREE.Color(L.outfit1).lerp(new THREE.Color('#9aa4b4'), 0.45), 0.5) : bareArms && outfit === 'fur' ? skinM : o1;
  const torso = mesh(torsoGeo, torsoMat);
  torso.scale.set(1, 1, 0.68); torso.position.y = -0.0; spine.add(torso);
  if (fem > 0.55) {
    for (const s of [-1, 1]) {
      const b = mesh(sph(0.06 * (0.6 + fem * 0.6)), torsoMat);
      b.position.set(s * 0.06, 0.14, 0.085); b.scale.set(1, 0.9, 0.8); spine.add(b);
    }
  }
  // 腰帶
  const belt = mesh(new THREE.TorusGeometry(waistW + 0.012, 0.018, 8, 32), leather);
  belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.7, 1); belt.position.y = -0.17; spine.add(belt);
  const buckle = mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), goldM); buckle.position.set(0, -0.17, (waistW + 0.012) * 0.7 + 0.015); spine.add(buckle);

  // 職業服裝
  if (outfit === 'fur') {
    // 毛皮披肩
    const furGeo = new THREE.IcosahedronGeometry(1, 2);
    const pp = furGeo.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < pp.count; i++) { v.fromBufferAttribute(pp, i); v.multiplyScalar(1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.18); pp.setXYZ(i, v.x, v.y, v.z); }
    furGeo.computeVertexNormals();
    const fur = mesh(furGeo, toon('#6b4a32'));
    fur.scale.set(shoulderW * 1.25, 0.08, 0.13); fur.position.y = 0.25; spine.add(fur);
    const loin = mesh(new THREE.CylinderGeometry(hipW * 1.02, hipW * 1.25, 0.28, 16, 1, true), o1);
    loin.position.y = -0.26; hips.add(loin);
  }
  if (armored) {
    for (const s of [-1, 1]) {
      const pad = mesh(new THREE.SphereGeometry(0.095 + build * 0.02, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), goldM.clone());
      pad.material.color.set(L.outfit2);
      pad.position.set(s * shoulderW * 1.02, 0.24, 0); pad.rotation.z = -s * 0.5; pad.scale.set(1, 0.85, 1);
      spine.add(pad);
      const pad2 = mesh(new THREE.SphereGeometry(0.075 + build * 0.02, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), steelM);
      pad2.position.set(s * shoulderW * 1.12, 0.19, 0); pad2.rotation.z = -s * 0.9; spine.add(pad2);
    }
    const tabard = mesh(new THREE.PlaneGeometry(0.16, 0.42, 1, 6), o2, { outline: false });
    tabard.material = toon(L.outfit2, { side: THREE.DoubleSide });
    tabard.position.set(0, -0.32, waistW * 0.75 + 0.03); hips.add(tabard);
    const emblem = mesh(new THREE.OctahedronGeometry(0.035), glow(L.aura, 2), { outline: false });
    emblem.position.set(0, 0.12, shoulderW * 0.62 + 0.02); emblem.scale.set(1, 1.4, 0.3); spine.add(emblem);
  }
  const robed = ['wizard', 'sorcerer', 'cleric', 'warlock', 'druid'].includes(outfit);
  if (robed) {
    const len = outfit === 'cleric' ? 0.62 : 0.78;
    const skirt = mesh(new THREE.CylinderGeometry(waistW + 0.02, 0.24 + build * 0.04, len, 28, 6, true), toon(L.outfit1, { side: THREE.DoubleSide }));
    skirt.position.y = -len / 2 - 0.12; skirt.scale.z = 0.85; hips.add(skirt);
    anim.skirt = skirt;
    const trim = mesh(new THREE.TorusGeometry(0.24 + build * 0.04, 0.012, 6, 40), goldM, { outline: false });
    trim.rotation.x = Math.PI / 2; trim.position.y = -len - 0.12; trim.scale.y = 0.85; hips.add(trim);
    const stole = mesh(new THREE.PlaneGeometry(0.06, 0.5), toon(L.outfit2, { side: THREE.DoubleSide }), { outline: false });
    for (const s of [-1, 1]) { const st = stole.clone(); st.position.set(s * 0.06, 0.02, shoulderW * 0.66); st.rotation.x = -0.12; spine.add(st); }
  }
  if (outfit === 'monk') {
    const sash = mesh(new THREE.TorusGeometry(waistW + 0.02, 0.03, 8, 32), o2); sash.rotation.x = Math.PI / 2; sash.scale.y = 0.7; sash.position.y = -0.15; spine.add(sash);
    const tail = mesh(new THREE.PlaneGeometry(0.06, 0.32), toon(L.outfit2, { side: THREE.DoubleSide }), { outline: false });
    tail.position.set(0.08, -0.32, 0.09); tail.rotation.z = 0.15; spine.add(tail);
  }
  if (outfit === 'bard') {
    const ruff = mesh(new THREE.TorusGeometry(0.075, 0.025, 8, 24), toon('#f5efe6')); ruff.rotation.x = Math.PI / 2; ruff.position.y = 0.31; spine.add(ruff);
    const sash = mesh(new THREE.TorusGeometry(0.17, 0.016, 6, 32), o2); sash.rotation.set(Math.PI / 2, 0.6, 0); sash.scale.set(1, 0.7, 1); sash.position.y = 0.06; spine.add(sash);
  }

  // 披風
  if (L.cape && L.wings === 'none' && ['plate', 'ranger', 'rogue', 'warlock', 'sorcerer', 'bard'].includes(outfit)) {
    const cg = new THREE.PlaneGeometry(shoulderW * 2.3, 1.05, 8, 14);
    cg.translate(0, -0.525, 0);
    const capeMat = toon(outfit === 'plate' ? L.outfit2 : new THREE.Color(L.outfit1).multiplyScalar(0.6), { side: THREE.DoubleSide });
    const cape = mesh(cg, capeMat);
    cape.position.set(0, 0.27, -0.1); spine.add(cape);
    anim.cape = cape; anim.capeBase = Float32Array.from(cg.attributes.position.array);
  }

  // 脖子與頭
  const neck = new THREE.Group(); neck.position.y = 0.31; spine.add(neck); rig.neck = neck;
  const head = new THREE.Group(); head.position.y = 0.0; neck.add(head); rig.head = head;
  const hr = 0.128;
  head.scale.setScalar(headScale);
  const headPivot = new THREE.Group(); headPivot.position.y = hr * 1.0; head.add(headPivot);
  const skull = mesh(headGeometry(hr), skinM); headPivot.add(skull);

  const faceZ = hr * 0.93;
  if (L.snout) {
    // 龍裔吻部
    const snout = mesh(cap(hr * 0.34, hr * 0.95, 16), skinM);
    snout.rotation.x = Math.PI / 2 + 0.12; snout.position.set(0, -hr * 0.3, hr * 0.85); snout.scale.set(1.1, 0.85, 1);
    headPivot.add(snout);
    const jaw = mesh(cap(hr * 0.24, hr * 0.75, 12), toon(new THREE.Color(L.skin).lerp(new THREE.Color('#f2d9a0'), 0.15)));
    jaw.rotation.x = Math.PI / 2 + 0.22; jaw.position.set(0, -hr * 0.55, hr * 0.72); headPivot.add(jaw);
    const brow = mesh(cap(hr * 0.12, hr * 0.9, 8), skinM); brow.rotation.z = Math.PI / 2; brow.position.set(0, hr * 0.32, hr * 0.78); headPivot.add(brow);
    for (const s of [-1, 1]) {
      const n = mesh(sph(hr * 0.045, 8, 6), toon('#140c10'), { outline: false });
      n.position.set(s * hr * 0.14, -hr * 0.12, hr * 1.55); headPivot.add(n);
    }
    // 頭冠骨刺
    for (let i = 0; i < 5; i++) {
      const sp = mesh(new THREE.ConeGeometry(hr * 0.12, hr * 0.5, 8), hornM);
      const a = -0.2 + i * 0.32;
      sp.position.set(0, Math.cos(a) * hr * 1.0, -Math.sin(a) * hr * 1.0 - 0.0);
      sp.rotation.x = -a - 0.6; headPivot.add(sp);
    }
  }

  // 眼睛
  const eyeY = L.snout ? hr * 0.15 : -hr * 0.05;
  const eyeX = L.snout ? hr * 0.48 : hr * 0.38;
  const eyeW = hr * 0.42 * L.eyeSize; const eyeH = hr * 0.5 * L.eyeSize;
  for (const s of [-1, 1]) {
    const eg = new THREE.Group();
    const dir = new THREE.Vector3(s * eyeX, eyeY, 0).setZ(Math.sqrt(Math.max(0, hr * hr - eyeX * eyeX - eyeY * eyeY)));
    eg.position.copy(dir.clone().multiplyScalar(1.005));
    eg.lookAt(dir.clone().multiplyScalar(3));
    if (L.snout) eg.rotateY(s * 0.25);
    const em = eyeMaterial(L.eyeColor, L.eyeGlow);
    const e = new THREE.Mesh(new THREE.PlaneGeometry(eyeW, eyeH), em);
    eg.add(e);
    // 睫毛
    const lash = new THREE.Mesh(new THREE.TorusGeometry(eyeW * 0.5, hr * 0.028, 4, 16, Math.PI), toon('#120a10'));
    lash.position.set(0, eyeH * 0.04, 0.002); lash.scale.set(1.08, 0.9, 1); eg.add(lash);
    if (fem > 0.5) {
      const flick = new THREE.Mesh(new THREE.ConeGeometry(hr * 0.03, hr * 0.12, 4), toon('#120a10'));
      flick.position.set(s * eyeW * 0.55, eyeH * 0.28, 0.003); flick.rotation.z = -s * 1.0; eg.add(flick);
    }
    // 眉毛
    const brow = new THREE.Mesh(cap(hr * 0.022, eyeW * 0.75, 6), toon(new THREE.Color(L.hairColor).multiplyScalar(0.8)));
    brow.rotation.z = Math.PI / 2 + s * (0.15 - (L.brow - 0.5) * 0.6);
    brow.position.set(s * eyeW * 0.05, eyeH * 0.62 + (L.brow - 0.5) * hr * 0.1, 0.004); eg.add(brow);
    headPivot.add(eg);
    anim.eyes.push(e);
    if (L.eyeGlow > 0.4) {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(eyeW * 1.6, eyeH * 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(L.eyeColor).multiplyScalar(2), transparent: true, opacity: 0.25 * L.eyeGlow, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      gl.position.z = 0.004; eg.add(gl);
    }
  }
  if (!L.snout) {
    // 鼻子與嘴巴
    const nose = new THREE.Mesh(sph(hr * 0.05, 8, 6), toon(new THREE.Color(L.skin).multiplyScalar(0.85)));
    nose.position.set(0, -hr * 0.32, faceZ * 1.02); nose.scale.set(0.8, 1, 0.7); headPivot.add(nose);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(hr * 0.12, hr * 0.018, 4, 12, Math.PI * 0.7), toon('#6b2b33'));
    mouth.rotation.z = Math.PI + Math.PI * 0.15; mouth.position.set(0, -hr * 0.47, faceZ * 0.86); headPivot.add(mouth);
    // 腮紅
    if (fem > 0.4) for (const s of [-1, 1]) {
      const bl = new THREE.Mesh(new THREE.CircleGeometry(hr * 0.12, 16), new THREE.MeshBasicMaterial({ color: '#ff6b81', transparent: true, opacity: 0.25, depthWrite: false }));
      const d = new THREE.Vector3(s * hr * 0.5, -hr * 0.3, 0); d.z = Math.sqrt(hr * hr - d.x * d.x - d.y * d.y) * 0.98;
      bl.position.copy(d.multiplyScalar(1.01)); bl.lookAt(d.clone().multiplyScalar(3)); bl.scale.y = 0.6; headPivot.add(bl);
    }
  }
  if (L.tusks) for (const s of [-1, 1]) {
    const t = mesh(new THREE.ConeGeometry(hr * 0.06, hr * 0.28, 8), toon('#f3ead2'));
    t.position.set(s * hr * 0.24, -hr * 0.5, faceZ * 0.8); t.rotation.set(-0.3, 0, -s * 0.2); headPivot.add(t);
  }
  // 紋身 / 符文
  if (L.markings !== 'none') {
    const mm = glow(L.markings === 'runes' ? L.aura : '#222', L.markings === 'runes' ? 2.2 : 1);
    if (L.markings === 'tribal') mm.color.set('#1b1420');
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const st = new THREE.Mesh(new THREE.PlaneGeometry(hr * 0.04, hr * 0.22), mm);
        const d = new THREE.Vector3(s * hr * (0.55 + i * 0.08), -hr * (0.18 + i * 0.04), 0); d.z = Math.sqrt(Math.max(0.0001, hr * hr - d.x * d.x - d.y * d.y));
        st.position.copy(d.multiplyScalar(1.012)); st.lookAt(d.clone().multiplyScalar(3)); st.rotateZ(s * 0.4); headPivot.add(st);
      }
    }
    const dot = new THREE.Mesh(new THREE.CircleGeometry(hr * 0.05, 6), mm);
    dot.position.set(0, hr * 0.35, faceZ * 1.0); headPivot.add(dot);
  }

  const parts = { skinM, hairM, hornM, goldM, steelM };
  buildEars(headPivot, hr, L, parts);
  buildHorns(headPivot, hr, L, parts);

  // 頭髮
  buildHair(headPivot, hr, L, hairM, anim);
  buildBeard(headPivot, hr, L, parts, faceZ);
  buildHeadwear(headPivot, hr, L, cls, parts);

  // 手臂
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'L' : 'R';
    const sh = new THREE.Group(); sh.position.set(s * (shoulderW + 0.005), 0.25, 0); spine.add(sh); rig['shoulder' + side] = sh;
    const ua = mesh(cap(limbR * 1.05, 0.2), bareArms ? skinM : o1); ua.position.y = -0.13; sh.add(ua);
    const el = new THREE.Group(); el.position.y = -0.27; sh.add(el); rig['elbow' + side] = el;
    const fa = mesh(cap(limbR * 0.92, 0.18), bareArms ? skinM : armored ? steelM : o1); fa.position.y = -0.12; el.add(fa);
    if (robed) { // 寬袖
      const sl = mesh(new THREE.CylinderGeometry(limbR * 1.1, limbR * 2.4, 0.18, 16, 1, true), toon(L.outfit1, { side: THREE.DoubleSide })); sl.position.y = -0.17; el.add(sl);
    }
    const cuff = mesh(new THREE.CylinderGeometry(limbR * 1.15, limbR * 1.15, 0.05, 14), armored ? goldM : leather); cuff.position.y = -0.2; el.add(cuff);
    const hand = new THREE.Group(); hand.position.y = -0.26; el.add(hand); rig['hand' + side] = hand;
    const hm = mesh(sph(limbR * 1.05, 14, 10), outfit === 'monk' ? toon('#efe6d8') : armored ? steelM : skinM); hm.scale.set(0.9, 1.15, 0.7); hm.position.y = -0.03; hand.add(hm);
  }
  // 腿
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'L' : 'R';
    const th = new THREE.Group(); th.position.set(s * hipW * 0.55, -0.02, 0); hips.add(th); rig['thigh' + side] = th;
    const tm = mesh(cap(limbR * 1.35 + fem * 0.006, 0.32), darkCloth); tm.position.y = -0.2; th.add(tm);
    const kn = new THREE.Group(); kn.position.y = -0.42; th.add(kn); rig['knee' + side] = kn;
    const sm = mesh(cap(limbR * 1.1, 0.3), armored ? steelM : darkCloth); sm.position.y = -0.2; kn.add(sm);
    const boot = mesh(cap(limbR * 1.25, 0.16), armored ? goldM : leather); boot.position.set(0, -0.3, 0); kn.add(boot);
    const foot = mesh(cap(limbR * 1.05, 0.1), armored ? steelM : leather); foot.rotation.x = Math.PI / 2; foot.position.set(0, -0.44, 0.045); kn.add(foot);
  }

  buildTail(hips, L, parts, anim);
  buildWings(spine, L, parts, anim);

  // 武器
  if (L.showWeapon) buildWeapon(rig, cls.weapon, L, { steelM, goldM, leather, o1, o2 }, anim);

  root.traverse((o) => { if (o.isMesh && o.material !== outlineMat) o.receiveShadow = false; });
  return { root, rig, anim, weapon: cls.weapon, headTopY: (0.92 + 0.04 + 0.31 + hr * 2 * headScale) * height, chestY: (0.92 + 0.3) * height };
}

function buildHair(head, hr, L, hairM, anim) {
  const st = L.hairStyle;
  if (st === 'none') return;
  const hairCap = (scale = 1.07) => {
    const g = new THREE.SphereGeometry(hr * scale, 32, 22, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const m = mesh(g, hairM); m.rotation.x = -0.62; m.position.set(0, hr * 0.02, -hr * 0.04); head.add(m); return m;
  };
  const bangs = (n = 7, len = 0.55, spread = 1.5) => {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5; const a = t * spread;
      const c = mesh(new THREE.ConeGeometry(hr * 0.2, hr * len * (1 - Math.abs(t) * 0.3), 6), hairM);
      c.scale.z = 0.45;
      c.position.set(Math.sin(a) * hr * 0.98, hr * 0.5 - Math.abs(t) * hr * 0.14, Math.cos(a) * hr * 0.9);
      c.rotation.set(Math.PI - 0.35, 0, -t * 0.7 + Math.sin(i * 7.1) * 0.12);
      c.rotation.y = a;
      head.add(c);
    }
    // 側髮
    for (const s of [-1, 1]) {
      const sd = mesh(new THREE.ConeGeometry(hr * 0.22, hr * 1.0, 6), hairM);
      sd.scale.z = 0.5; sd.position.set(s * hr * 0.88, -hr * 0.15, hr * 0.2); sd.rotation.set(Math.PI, 0, s * 0.08); head.add(sd);
    }
  };

  if (st === 'short' || st === 'long' || st === 'ponytail' || st === 'twintails' || st === 'bun' || st === 'braids') { hairCap(); bangs(); }
  if (st === 'spiky') {
    hairCap(1.06); bangs(6, 0.6, 1.3);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2; const tilt = 0.6 + (i % 3) * 0.25;
      const c = mesh(new THREE.ConeGeometry(hr * 0.24, hr * (0.8 + (i % 2) * 0.3), 6), hairM);
      const dir = new THREE.Vector3(Math.sin(a) * Math.sin(tilt), Math.cos(tilt), Math.cos(a) * Math.sin(tilt) - 0.35).normalize();
      c.position.copy(dir.clone().multiplyScalar(hr * 1.05));
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      head.add(c);
    }
  }
  if (st === 'mohawk') {
    for (let i = 0; i < 7; i++) {
      const a = -0.5 + i * 0.32;
      const c = mesh(new THREE.ConeGeometry(hr * 0.15, hr * 0.7, 6), hairM);
      const dir = new THREE.Vector3(0, Math.cos(a), -Math.sin(a));
      c.position.copy(dir.clone().multiplyScalar(hr * 1.0)); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); c.scale.z = 0.4; head.add(c);
    }
  }
  if (st === 'long') {
    const back = mesh(new THREE.CylinderGeometry(hr * 1.02, hr * 1.25, hr * 3.2, 24, 4, true, Math.PI * 0.55, Math.PI * 0.9), toon(L.hairColor, { side: THREE.DoubleSide }));
    back.position.set(0, -hr * 1.3, -hr * 0.12); head.add(back);
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.6 + (i / 6) * Math.PI * 0.8;
      const c = mesh(new THREE.ConeGeometry(hr * 0.28, hr * 0.7, 5), hairM);
      c.position.set(Math.sin(a) * hr * 1.15, -hr * 3.1, Math.cos(a) * hr * 1.1 - hr * 0.12); c.rotation.x = Math.PI; head.add(c);
    }
    anim.hairSways.push({ o: back, amp: 0.04 });
  }
  const chainTail = (origin, n, r0, dir, sway) => {
    const g = new THREE.Group(); g.position.copy(origin); head.add(g);
    let parent = g;
    for (let i = 0; i < n; i++) {
      const seg = new THREE.Group(); seg.position.copy(i === 0 ? new THREE.Vector3() : dir.clone().multiplyScalar(hr * 0.42));
      const m = mesh(sph(hr * (r0 - i * r0 * 0.07), 14, 10), hairM); m.scale.set(1, 1.5, 1); seg.add(m);
      parent.add(seg); parent = seg;
      anim.hairSways.push({ o: seg, amp: 0.06 + i * 0.015, phase: i * 0.5 + sway });
    }
  };
  if (st === 'ponytail') {
    const tie = mesh(new THREE.TorusGeometry(hr * 0.16, hr * 0.05, 6, 12), toon(L.outfit2)); tie.position.set(0, hr * 0.55, -hr * 0.95); tie.rotation.x = 0.8; head.add(tie);
    chainTail(new THREE.Vector3(0, hr * 0.45, -hr * 1.1), 7, 0.3, new THREE.Vector3(0, -1, -0.25).normalize(), 0);
  }
  if (st === 'twintails') {
    for (const s of [-1, 1]) {
      const tie = mesh(sph(hr * 0.14), toon(L.outfit2)); tie.position.set(s * hr * 0.85, hr * 0.5, -hr * 0.4); head.add(tie);
      chainTail(new THREE.Vector3(s * hr * 0.95, hr * 0.35, -hr * 0.45), 8, 0.28, new THREE.Vector3(s * 0.25, -1, -0.1).normalize(), s);
    }
  }
  if (st === 'bun') {
    const b = mesh(sph(hr * 0.45), hairM); b.position.set(0, hr * 0.85, -hr * 0.65); head.add(b);
    const pin = mesh(cap(hr * 0.03, hr * 1.1, 6), toon(L.outfit2)); pin.position.copy(b.position); pin.rotation.z = 1.2; head.add(pin);
  }
  if (st === 'braids') {
    for (const s of [-1, 1]) chainTail(new THREE.Vector3(s * hr * 0.8, -hr * 0.4, -hr * 0.1), 7, 0.2, new THREE.Vector3(s * 0.1, -1, 0.15).normalize(), s * 2);
  }
}

export function buildWeapon(rig, type, L, M, anim) {
  const hand = rig.handR; const handL = rig.handL;
  const aura = L.aura;
  const g = new THREE.Group();
  if (type === 'sword') {
    const blade = mesh(new THREE.BoxGeometry(0.045, 0.75, 0.012), M.steelM); blade.position.y = 0.48;
    const tip = mesh(new THREE.ConeGeometry(0.032, 0.1, 4), M.steelM); tip.position.y = 0.9; tip.scale.z = 0.3;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.7, 0.014), glow(aura, 2.5)); edge.position.y = 0.48;
    const guard = mesh(new THREE.BoxGeometry(0.2, 0.03, 0.05), M.goldM); guard.position.y = 0.1;
    const grip = mesh(cap(0.018, 0.12), M.leather);
    const pommel = mesh(sph(0.03), M.goldM); pommel.position.y = -0.09;
    g.add(blade, tip, edge, guard, grip, pommel);
    g.rotation.set(Math.PI / 2 + 0.25, 0, 0); g.position.y = -0.04; hand.add(g);
    const shield = new THREE.Group();
    const sm = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.035, 6), toon(L.outfit1)); sm.rotation.x = Math.PI / 2; shield.add(sm);
    const rim = mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 6), M.goldM); shield.add(rim);
    const boss = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), glow(aura, 2.5)); boss.position.z = 0.03; shield.add(boss);
    shield.position.set(-0.3, -0.02, 0.16); shield.rotation.set(0, -0.6, 0); rig.spine.add(shield);
  } else if (type === 'greataxe' || type === 'warhammer') {
    const haft = mesh(cap(0.022, 1.05), M.leather); haft.position.y = 0.3;
    g.add(haft);
    if (type === 'greataxe') {
      for (const s of [-1, 1]) {
        const shape = new THREE.Shape(); shape.moveTo(0, 0.07); shape.quadraticCurveTo(0.2, 0.2, 0.26, 0.22); shape.quadraticCurveTo(0.2, 0, 0.26, -0.22); shape.quadraticCurveTo(0.2, -0.2, 0, -0.07);
        const bg = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 });
        const b = mesh(bg, M.steelM); b.scale.set(s * 0.72, 0.72, 1); b.position.set(0, 0.74, -0.01); g.add(b);
        const e = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.005, 4, 20, 1.1), glow(aura, 1.3)); e.rotation.z = s > 0 ? -0.55 : Math.PI - 0.55; e.position.set(0, 0.74, 0.005); e.scale.setScalar(0.7); g.add(e);
      }
    } else {
      const headM = mesh(new THREE.BoxGeometry(0.28, 0.14, 0.14), M.steelM); headM.position.y = 0.76; g.add(headM);
      const band = mesh(new THREE.BoxGeometry(0.06, 0.16, 0.16), M.goldM); band.position.y = 0.76; g.add(band);
      const rune = new THREE.Mesh(new THREE.CircleGeometry(0.04, 6), glow(aura, 3)); rune.position.set(0, 0.76, 0.08); g.add(rune);
    }
    g.rotation.set(Math.PI / 2 + 0.15, 0, 0); g.position.set(0, -0.04, 0); hand.add(g);
  } else if (type === 'mace') {
    const haft = mesh(cap(0.018, 0.4), M.leather); haft.position.y = 0.15; g.add(haft);
    const hd = mesh(new THREE.IcosahedronGeometry(0.075, 0), M.goldM); hd.position.y = 0.4; g.add(hd);
    const core = new THREE.Mesh(sph(0.04), glow(aura, 3)); core.position.y = 0.4; g.add(core);
    g.rotation.set(Math.PI / 2 + 0.2, 0, 0); g.position.y = -0.04; hand.add(g);
    const shield = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 32), M.goldM);
    shield.rotation.set(Math.PI / 2, -0.6, 0, 'YXZ'); shield.position.set(-0.3, -0.02, 0.16); rig.spine.add(shield);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), glow(aura, 2.5)); sun.position.set(-0.29, -0.02, 0.185); sun.rotation.y = -0.6; rig.spine.add(sun);
  } else if (type === 'staff' || type === 'orb') {
    if (type === 'staff') {
      const shaftCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.9, 0), new THREE.Vector3(0.01, 0, 0), new THREE.Vector3(-0.02, 0.6, 0), new THREE.Vector3(0.05, 0.75, 0)]);
      const shaft = mesh(taperTube(shaftCurve, 0.022, 0.016, 24, 8), toon('#5a3d2b')); g.add(shaft);
      const claw = new THREE.Group(); claw.position.y = 0.82;
      for (let i = 0; i < 4; i++) { const c = mesh(new THREE.ConeGeometry(0.015, 0.16, 5), M.goldM); c.position.set(Math.sin(i * 1.57) * 0.05, 0, Math.cos(i * 1.57) * 0.05); c.rotation.set(Math.cos(i * 1.57) * -0.5, 0, Math.sin(i * 1.57) * 0.5); claw.add(c); }
      g.add(claw);
      const orb = new THREE.Mesh(sph(0.06), glow(aura, 4)); orb.position.y = 0.86; g.add(orb); anim.floaters.push({ o: orb, base: 0.86, amp: 0.012 });
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.004, 6, 32), glow(aura, 3)); halo.position.y = 0.86; g.add(halo); anim.floaters.push({ o: halo, spin: 1.2 });
      g.position.set(0, -0.04, 0); g.rotation.set(Math.PI / 2, 0, 0); g.scale.setScalar(1.3); hand.add(g);
    } else {
      const orbG = new THREE.Group(); orbG.position.set(0, -0.2, 0.05);
      const orb = new THREE.Mesh(sph(0.07, 24, 16), glow(aura, 4)); orbG.add(orb);
      for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.11 + i * 0.025, 0.004, 6, 40), glow(aura, 2.5)); r.rotation.set(Math.random() * 3, Math.random() * 3, 0); orbG.add(r); anim.floaters.push({ o: r, spin: 0.8 + i * 0.6 }); }
      hand.add(orbG); anim.floaters.push({ o: orbG, base: -0.2, amp: 0.02 });
    }
  } else if (type === 'bow') {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.03, -0.55, 0), new THREE.Vector3(-0.1, -0.25, 0), new THREE.Vector3(-0.05, 0, 0), new THREE.Vector3(-0.1, 0.25, 0), new THREE.Vector3(0.03, 0.55, 0)]);
    const limb = mesh(taperTube(curve, 0.018, 0.012, 30, 8), toon('#4a3020')); g.add(limb);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 1.1, 4), glow(aura, 2.5)); string.position.x = 0.03; g.add(string);
    g.rotation.set(0, Math.PI / 2, 0.0); g.position.set(0, -0.05, 0); handL.add(g);
    // 箭筒
    const quiver = mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.42, 12), M.leather); quiver.position.set(0.1, 0.12, -0.16); quiver.rotation.z = 0.5; rig.spine.add(quiver);
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 3), toon(L.outfit2)); f.position.set(0.17 + i * 0.012, 0.3 + i * 0.01, -0.16 + (i - 1.5) * 0.015); f.rotation.z = 0.5; rig.spine.add(f); }
  } else if (type === 'daggers') {
    for (const h of [hand, handL]) {
      const d = new THREE.Group();
      const bl = mesh(new THREE.ConeGeometry(0.025, 0.28, 4), M.steelM); bl.position.y = 0.18; bl.scale.z = 0.3; d.add(bl);
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.24, 0.01), glow(aura, 3)); e.position.y = 0.17; d.add(e);
      const gd = mesh(new THREE.BoxGeometry(0.09, 0.02, 0.03), M.goldM); gd.position.y = 0.04; d.add(gd);
      const gr = mesh(cap(0.014, 0.06), M.leather); gr.position.y = -0.01; d.add(gr);
      d.rotation.set(Math.PI / 2 + (h === hand ? 0.4 : -2.6), 0, 0); d.position.y = -0.04; h.add(d);
    }
  } else if (type === 'lute') {
    const body = mesh(sph(0.16, 24, 16), toon('#a0602f')); body.scale.set(1, 1.25, 0.45);
    const neckM = mesh(new THREE.BoxGeometry(0.04, 0.42, 0.025), toon('#3a2418')); neckM.position.y = 0.36;
    const headM = mesh(new THREE.BoxGeometry(0.05, 0.1, 0.03), toon('#3a2418')); headM.position.set(0, 0.6, -0.02); headM.rotation.x = 0.4;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), glow(aura, 2.5)); hole.position.set(0, 0.03, 0.073);
    for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.7, 3), glow('#fff2c0', 1.5)); st.position.set(-0.012 + i * 0.008, 0.25, 0.075); g.add(st); }
    g.add(body, neckM, headM, hole);
    g.position.set(0.0, 0.0, 0.17); g.rotation.set(0.1, 0, 0.9); rig.spine.add(g);
    anim.lute = g;
  } else if (type === 'tome') {
    const book = new THREE.Group(); book.position.set(-0.16, 0.0, 0.32); book.rotation.set(0.25, 0.3, 0);
    const cover = mesh(new THREE.BoxGeometry(0.22, 0.03, 0.28), toon('#2a1838')); book.add(cover);
    const pages = mesh(new THREE.BoxGeometry(0.2, 0.035, 0.26), toon('#f2e6c9')); pages.position.y = 0.02; book.add(pages);
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), glow(aura, 3.5)); eye.rotation.x = -Math.PI / 2; eye.position.y = 0.045; book.add(eye);
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.16 + i * 0.04, 0.003, 4, 48), glow(aura, 2)); r.rotation.x = Math.PI / 2; r.position.y = 0.06 + i * 0.03; book.add(r); anim.floaters.push({ o: r, spin: (i % 2 ? -1 : 1) * (0.6 + i * 0.3), axis: 'z' }); }
    rig.spine.add(book); anim.floaters.push({ o: book, base: 0.0, amp: 0.02 });
  } else if (type === 'gadget') {
    // 符文工匠錘
    const haft = mesh(cap(0.016, 0.38), M.leather); haft.position.y = 0.14; g.add(haft);
    const headM = mesh(new THREE.BoxGeometry(0.16, 0.08, 0.08), M.steelM); headM.position.y = 0.36; g.add(headM);
    const band = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), M.goldM); band.rotation.z = Math.PI / 2; band.position.y = 0.36; g.add(band);
    const rune = new THREE.Mesh(new THREE.CircleGeometry(0.025, 6), glow(aura, 3)); rune.position.set(0, 0.36, 0.042); g.add(rune);
    g.rotation.set(Math.PI / 2 + 0.2, 0, 0); g.position.y = -0.04; hand.add(g);
    // 發條無人機：齒輪環 + 發光核心，懸浮於左肩
    const drone = new THREE.Group(); drone.position.set(-0.3, 0.42, 0.05);
    const core = new THREE.Mesh(sph(0.045), glow(aura, 4)); drone.add(core);
    const shell = mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 24), M.goldM); drone.add(shell); anim.floaters.push({ o: shell, spin: 1.4 });
    const gear = new THREE.Group();
    for (let i = 0; i < 10; i++) { const t = mesh(new THREE.BoxGeometry(0.02, 0.025, 0.012), M.steelM); const a = (i / 10) * Math.PI * 2; t.position.set(Math.cos(a) * 0.11, Math.sin(a) * 0.11, 0); t.rotation.z = a; gear.add(t); }
    const ring = mesh(new THREE.TorusGeometry(0.1, 0.006, 4, 32), M.steelM); gear.add(ring);
    drone.add(gear); anim.floaters.push({ o: gear, spin: -1.2, axis: 'z' });
    rig.spine.add(drone); anim.floaters.push({ o: drone, base: 0.42, amp: 0.025 });
  } else if (type === 'fists') {
    for (const h of [hand, handL]) {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 20), glow(aura, 3)); wrap.rotation.x = Math.PI / 2; wrap.position.y = 0.0; h.add(wrap);
      const aur = new THREE.Mesh(sph(0.075, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(aura).multiplyScalar(2), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      aur.position.y = -0.03; h.add(aur); anim.floaters.push({ o: aur, pulse: true });
    }
  }
}

// ---------- 姿勢 ----------
const D = THREE.MathUtils.degToRad;
export const POSES = {
  base: {
    shoulderL: [0, 0, D(-8)], shoulderR: [0, 0, D(8)], elbowL: [D(-10), 0, 0], elbowR: [D(-10), 0, 0],
    thighL: [0, 0, D(-3)], thighR: [0, 0, D(3)], kneeL: [0, 0, 0], kneeR: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0], hips: [0, 0, 0],
  },
  sword: { shoulderR: [D(-15), 0, D(14)], elbowR: [D(-55), 0, 0], shoulderL: [D(-35), D(-10), D(-14)], elbowL: [D(-70), 0, D(20)], thighL: [D(-8), 0, D(-6)], thighR: [D(10), 0, D(6)], kneeL: [D(12), 0, 0] },
  greataxe: { shoulderR: [D(-30), 0, D(20)], elbowR: [D(-50), 0, 0], shoulderL: [D(-40), 0, D(-25)], elbowL: [D(-60), 0, D(30)], thighL: [D(-6), 0, D(-10)], thighR: [D(8), 0, D(10)] },
  warhammer: { shoulderR: [D(-20), 0, D(18)], elbowR: [D(-50), 0, 0], shoulderL: [D(-35), D(-10), D(-14)], elbowL: [D(-70), 0, D(20)] },
  mace: { shoulderR: [D(-15), 0, D(14)], elbowR: [D(-55), 0, 0], shoulderL: [D(-35), D(-10), D(-14)], elbowL: [D(-70), 0, D(20)] },
  staff: { shoulderR: [D(-12), 0, D(16)], elbowR: [D(-45), 0, D(-10)], shoulderL: [D(-10), 0, D(-12)], elbowL: [D(-30), 0, 0] },
  orb: { shoulderR: [D(-30), 0, D(20)], elbowR: [D(-85), 0, D(-10)], shoulderL: [D(-5), 0, D(-10)], elbowL: [D(-25), 0, 0] },
  bow: { shoulderL: [D(-10), 0, D(-14)], elbowL: [D(-30), 0, 0], shoulderR: [D(-5), 0, D(10)], elbowR: [D(-20), 0, 0] },
  daggers: { shoulderR: [D(-25), 0, D(25)], elbowR: [D(-70), 0, 0], shoulderL: [D(-25), 0, D(-25)], elbowL: [D(-70), 0, 0], spine: [D(8), 0, 0], kneeL: [D(15), 0, 0], kneeR: [D(15), 0, 0], thighL: [D(-12), 0, D(-8)], thighR: [D(-6), 0, D(8)] },
  lute: { shoulderR: [D(-30), D(10), D(8)], elbowR: [D(-70), D(30), D(20)], shoulderL: [D(-45), 0, D(-30)], elbowL: [D(-60), 0, D(40)] },
  tome: { shoulderL: [D(-35), 0, D(-14)], elbowL: [D(-75), 0, D(15)], shoulderR: [D(-5), 0, D(10)], elbowR: [D(-20), 0, 0] },
  gadget: { shoulderR: [D(-15), 0, D(14)], elbowR: [D(-60), 0, 0], shoulderL: [D(-20), 0, D(-16)], elbowL: [D(-45), 0, D(10)] },
  fists: { shoulderR: [D(-45), 0, D(20)], elbowR: [D(-100), 0, 0], shoulderL: [D(-55), 0, D(-20)], elbowL: [D(-110), 0, 0], thighL: [D(-15), 0, D(-10)], thighR: [D(10), 0, D(10)], kneeL: [D(15), 0, 0], kneeR: [D(10), 0, 0] },
  none: {},
  // 動作
  cast: { shoulderR: [D(-95), 0, D(5)], elbowR: [D(-10), 0, 0], spine: [D(-4), D(-10), 0], head: [D(-5), 0, 0] },
  cheer: { shoulderR: [D(-170), 0, D(-10)], elbowR: [D(-15), 0, 0], shoulderL: [D(-20), 0, D(-30)], spine: [D(-6), 0, 0], head: [D(-15), 0, 0] },
  flourish: { shoulderR: [D(-120), D(20), D(40)], elbowR: [D(-30), 0, 0], spine: [D(-5), D(20), 0], hips: [0, D(10), 0] },
};

// ---------- 可共用的配件（程序化模型與 VRM 模型共用） ----------
export function buildEars(headPivot, hr, L, M) {
  const { skinM, hairM, hornM, goldM, steelM } = M;
  // 耳朵
  const earType = L.earType;
  if (earType === 'elf' || earType === 'human') {
    const len = earType === 'elf' ? 0.25 + L.ears * 1.1 : 0;
    for (const s of [-1, 1]) {
      const eg = new THREE.Group(); eg.position.set(s * hr * 0.95, -hr * 0.12, -hr * 0.05); headPivot.add(eg);
      if (len > 0) {
        const ear = mesh(new THREE.ConeGeometry(hr * 0.16, hr * len, 10), skinM);
        ear.scale.z = 0.4; ear.rotation.z = -s * (Math.PI / 2 - 0.45); ear.rotation.y = s * 0.25;
        ear.position.set(s * hr * len * 0.42, hr * len * 0.18, -hr * 0.05); eg.add(ear);
      } else {
        const ear = mesh(sph(hr * 0.16, 12, 10), skinM); ear.scale.set(0.45, 1, 0.75); eg.add(ear);
      }
    }
  } else if (earType === 'cat' || earType === 'fox' || earType === 'bunny') {
    for (const s of [-1, 1]) {
      const h = earType === 'bunny' ? 0.95 : earType === 'fox' ? 0.55 : 0.42;
      const ear = mesh(new THREE.ConeGeometry(hr * (earType === 'bunny' ? 0.16 : 0.24), hr * h * (1 + L.ears), 4), hairM);
      ear.scale.z = 0.45;
      ear.position.set(s * hr * 0.55, hr * (0.95 + h * 0.3), -hr * 0.05); ear.rotation.z = -s * 0.32; headPivot.add(ear);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(hr * 0.12, hr * h * 0.7 * (1 + L.ears), 4), toon('#ffb3c1'));
      inner.scale.z = 0.2; inner.position.set(0, -hr * 0.04, hr * 0.05); ear.add(inner);
    }
  }
}

export function buildHorns(headPivot, hr, L, M) {
  const { skinM, hairM, hornM, goldM, steelM } = M;
  // 角
  const hs = L.hornStyle;
  if (hs !== 'none') {
    for (const s of [-1, 1]) {
      let curve; let r0 = hr * 0.13;
      if (hs === 'ram') {
        const pts = []; const c = new THREE.Vector3(s * hr * 1.0, hr * 0.42, -hr * 0.05);
        for (let i = 0; i <= 24; i++) { const t = i / 24; const a = Math.PI * 0.55 + t * Math.PI * 1.75; const rr = hr * (0.62 - t * 0.3); pts.push(new THREE.Vector3(c.x + s * t * hr * 0.4, c.y + Math.sin(a) * rr, c.z + Math.cos(a) * rr)); }
        curve = new THREE.CatmullRomCurve3(pts); r0 = hr * 0.17;
      } else if (hs === 'swept') {
        curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * hr * 0.15, hr * 0.25, -hr * 0.35), new THREE.Vector3(s * hr * 0.25, hr * 0.35, -hr * 0.9), new THREE.Vector3(s * hr * 0.3, hr * 0.55, -hr * 1.35)]);
      } else if (hs === 'demon') {
        curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * hr * 0.3, hr * 0.35, 0), new THREE.Vector3(s * hr * 0.35, hr * 0.85, -hr * 0.1), new THREE.Vector3(s * hr * 0.15, hr * 1.25, hr * 0.05)]);
      } else { // straight / unicorn-ish
        curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * hr * 0.1, hr * 0.4, hr * 0.15), new THREE.Vector3(s * hr * 0.15, hr * 0.8, hr * 0.3)]);
        r0 = hr * 0.09;
      }
      const horn = mesh(taperTube(curve, r0, hr * 0.012, 32, 10), hornM);
      if (hs !== 'ram') horn.position.set(s * hr * 0.42, hr * 0.62, hr * 0.12);
      headPivot.add(horn);
    }
  }
}

export function buildBeard(headPivot, hr, L, M, faceZ) {
  const { skinM, hairM, hornM, goldM, steelM } = M;
  // 鬍子
  if (L.beard !== 'none' && !L.snout) {
    const bm = hairM;
    const chin = mesh(sph(hr * 0.5, 20, 14), bm); chin.scale.set(1.1, 0.75, 0.6); chin.position.set(0, -hr * 0.78, hr * 0.42); headPivot.add(chin);
    const mous = mesh(cap(hr * 0.06, hr * 0.35, 6), bm); mous.rotation.z = Math.PI / 2; mous.position.set(0, -hr * 0.4, faceZ * 0.92); headPivot.add(mous);
    if (L.beard === 'long') { const c = mesh(new THREE.ConeGeometry(hr * 0.42, hr * 1.4, 14), bm); c.rotation.x = Math.PI; c.position.set(0, -hr * 1.5, hr * 0.45); c.scale.z = 0.55; headPivot.add(c); }
    if (L.beard === 'braided') {
      for (const s of [-0.5, 0.5]) for (let i = 0; i < 6; i++) {
        const b = mesh(sph(hr * (0.14 - i * 0.012), 10, 8), bm); b.position.set(s * hr * 0.45, -hr * (1.05 + i * 0.2), hr * (0.45 - i * 0.02)); headPivot.add(b);
        if (i === 2 || i === 4) { const ring = mesh(new THREE.TorusGeometry(hr * 0.12, hr * 0.03, 6, 12), goldM, { outline: false }); ring.rotation.x = Math.PI / 2; ring.position.copy(b.position); headPivot.add(ring); }
      }
    }
  }
}

export function buildHeadwear(headPivot, hr, L, cls, M) {
  const { skinM, hairM, hornM, goldM, steelM } = M;
  // 頭飾
  let hw = L.headwear;
  if (hw === 'auto') hw = { wizard: 'wizardHat', rogue: 'hood', ranger: 'hood', cleric: 'circlet', warlock: 'horns-circlet' }[cls.id] || 'none';
  if (hw === 'wizardHat') {
    const brim = mesh(new THREE.CylinderGeometry(hr * 2.0, hr * 2.0, hr * 0.06, 36), toon(L.outfit1)); brim.position.y = hr * 0.78; brim.rotation.x = -0.08; headPivot.add(brim);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, hr * 0.9, -hr * 0.1), new THREE.Vector3(0, hr * 1.6, -hr * 0.5), new THREE.Vector3(hr * 0.2, hr * 1.9, -hr * 1.0)]);
    const cone = mesh(taperTube(curve, hr * 0.95, hr * 0.03, 30, 24), toon(L.outfit1)); cone.position.y = hr * 0.78; cone.rotation.x = -0.08; headPivot.add(cone);
    const band = mesh(new THREE.TorusGeometry(hr * 0.94, hr * 0.07, 8, 32), toon(L.outfit2)); band.rotation.x = Math.PI / 2 - 0.08; band.position.y = hr * 0.86; headPivot.add(band);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(hr * 0.12), glow(L.aura, 3)); star.position.set(0, hr * 0.9, hr * 0.95); headPivot.add(star);
  } else if (hw === 'hood') {
    const hood = mesh(new THREE.SphereGeometry(hr * 1.32, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), toon(new THREE.Color(L.outfit1).multiplyScalar(0.7), { side: THREE.DoubleSide }));
    hood.rotation.x = -0.55; hood.position.set(0, hr * 0.0, -hr * 0.2); headPivot.add(hood);
  } else if (hw === 'circlet' || hw === 'horns-circlet') {
    const c = mesh(new THREE.TorusGeometry(hr * 1.02, hr * 0.04, 6, 40), goldM, { outline: false }); c.rotation.x = Math.PI / 2 - 0.25; c.position.y = hr * 0.45; headPivot.add(c);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(hr * 0.1), glow(L.aura, 3)); gem.position.set(0, hr * 0.62, hr * 0.98); gem.scale.y = 1.4; headPivot.add(gem);
  } else if (hw === 'helmet') {
    const h = mesh(new THREE.SphereGeometry(hr * 1.12, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), steelM); h.position.y = hr * 0.05; headPivot.add(h);
    const crest = mesh(new THREE.BoxGeometry(hr * 0.12, hr * 0.5, hr * 1.6), toon(L.outfit2)); crest.position.y = hr * 1.1; headPivot.add(crest);
  }
}

export function buildTail(hips, L, M, anim) {
  const { skinM, hairM, hornM, goldM, steelM } = M;
  // 尾巴
  if (L.tail !== 'none') {
    const tg = new THREE.Group(); tg.position.set(0, -0.06, -0.09); hips.add(tg);
    const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.15, -0.15), new THREE.Vector3(0.05, -0.3, -0.35), new THREE.Vector3(0.15, -0.25, -0.55), new THREE.Vector3(0.22, -0.05, -0.62)];
    const cfg = { devil: [0.022, 0.006, skinM], dragon: [0.085, 0.012, skinM], cat: [0.03, 0.025, hairM], fox: [0.06, 0.03, hairM] }[L.tail] || [0.03, 0.01, skinM];
    const tm = mesh(taperTube(new THREE.CatmullRomCurve3(pts), cfg[0], cfg[1], 30, 10), cfg[2]);
    tg.add(tm);
    if (L.tail === 'devil') { const tip = mesh(new THREE.ConeGeometry(0.045, 0.1, 4), skinM); tip.position.copy(pts[4]); tip.rotation.z = -0.8; tip.scale.z = 0.3; tg.add(tip); }
    if (L.tail === 'fox') { const fc = new THREE.CatmullRomCurve3(pts.slice(1)); const fluff = mesh(taperTube(fc, 0.07, 0.035, 24, 12), hairM); tg.add(fluff); const tip = mesh(sph(0.045), toon('#fff6ea')); tip.position.copy(pts[4]); tg.add(tip); }
    anim.tails.push(tg);
  }
}

export function buildWings(spine, L, M, anim) {
  const { skinM, hairM, hornM, goldM, steelM } = M;
  // 翅膀
  if (L.wings !== 'none') {
    for (const s of [-1, 1]) {
      const wg = new THREE.Group(); wg.position.set(s * 0.07, 0.18, -0.1); spine.add(wg);
      if (L.wings === 'feather') {
        const fm = toon('#f7f3ff');
        const n = 11; const up = new THREE.Vector3(0, 1, 0);
        const P = (t) => new THREE.Vector3(s * 0.62 * t, 0.06 + 0.5 * t - 0.12 * t * t, -0.04 - 0.08 * t);
        const bone = mesh(taperTube(new THREE.CatmullRomCurve3([0, 0.33, 0.66, 1].map(P)), 0.035, 0.015, 20, 8), fm); wg.add(bone);
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1); const root = P(t);
          const len = 0.22 + 0.5 * t;
          const dir = new THREE.Vector3(s * (0.15 + 0.55 * t), -1 + 0.35 * t, -0.1).normalize();
          for (const layer of [0, 1]) {
            const L2 = layer ? len * 0.55 : len;
            const f = mesh(cap(layer ? 0.05 : 0.045, L2, 8), layer ? toon('#ffffff') : fm);
            f.scale.z = 0.22;
            f.position.copy(root).addScaledVector(dir, L2 / 2); f.position.z -= layer ? -0.01 : 0;
            f.quaternion.setFromUnitVectors(up, dir);
            wg.add(f);
          }
          if (i % 2 === 0) { const gf = new THREE.Mesh(cap(0.008, len * 0.9, 6), glow(L.aura, 1.6)); gf.position.copy(root).addScaledVector(dir, len / 2); gf.position.z -= 0.02; gf.quaternion.setFromUnitVectors(up, dir); wg.add(gf); }
        }
      } else { // bat
        const shape = new THREE.Shape();
        shape.moveTo(0, 0); shape.lineTo(0.75, 0.42); shape.quadraticCurveTo(0.68, 0.1, 0.78, -0.12); shape.quadraticCurveTo(0.6, -0.08, 0.52, -0.3); shape.quadraticCurveTo(0.38, -0.18, 0.26, -0.36); shape.quadraticCurveTo(0.15, -0.15, 0, -0.1);
        const mg = new THREE.ShapeGeometry(shape, 12);
        const memb = mesh(mg, toon(new THREE.Color(L.hornColor).lerp(new THREE.Color(L.skin), 0.3), { side: THREE.DoubleSide }));
        memb.scale.x = s; wg.add(memb);
        const bone = mesh(taperTube(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.4, 0.3, 0.01), new THREE.Vector3(s * 0.75, 0.42, 0.01)]), 0.025, 0.008, 16, 6), hornM);
        wg.add(bone);
      }
      wg.rotation.y = s * 0.5;
      anim.wings.push({ g: wg, s });
    }
  }
}
