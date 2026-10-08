// VRM 動漫模型：素體＋可替換髮型＋調色＋骨骼比例＋奇幻配件
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { toon, metal, glow, mesh, sph, buildWeapon, buildEars, buildHorns, buildBeard, buildHeadwear, buildTail, buildWings } from './avatar.js';

// 模型皆來自 VRoid Project 官方釋出的樣本（CC0／允許修改與再散布）
export const VRM_MODELS = [
  { id: 'shino', name: '千駄谷篠', tag: '女' },
  { id: 'bibi', name: '比比', tag: '女' },
  { id: 'vita', name: '維塔', tag: '女' },
  { id: 'victoria', name: '維多利亞', tag: '女' },
  { id: 'shibu', name: '千駄谷澀', tag: '女' },
  { id: 'hair_female', name: '長髮少女', tag: '女' },
  { id: 'base_female', name: '素體・女', tag: '女' },
  { id: 'fumiriya', name: '櫻田史利矢', tag: '男' },
  { id: 'hair_male', name: '短髮少年', tag: '男' },
  { id: 'base_male', name: '素體・男', tag: '男' },
];
// 模型走 jsDelivr CDN（比 GitHub Pages 快很多）；tag 固定版本，模型更新時記得改 tag
const MODEL_CDN = 'https://cdn.jsdelivr.net/gh/HoweraProjects/DragonForge@models-v1/public/models/';
const LOCAL = `${import.meta.env.BASE_URL}models/`;
const modelBase = import.meta.env.DEV ? LOCAL : MODEL_CDN;
export const modelThumb = (id) => `${modelBase}${id}.jpg`;

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));
const bufferCache = new Map();

async function fetchModel(id, onProgress) {
  if (!bufferCache.has(id)) {
    bufferCache.set(id, (async () => {
      let res = await fetch(`${modelBase}${id}.vrm`).catch(() => null);
      if (!res?.ok) res = await fetch(`${LOCAL}${id}.vrm`); // CDN 失敗時退回同站
      if (!res.ok) throw new Error(`模型載入失敗：${id}`);
      const total = Number(res.headers.get('content-length')) || 0;
      if (!res.body || !total) return res.arrayBuffer();
      const reader = res.body.getReader(); const chunks = []; let got = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onProgress?.(got / total); }
      const out = new Uint8Array(got); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
      return out.buffer;
    })().catch((e) => { bufferCache.delete(id); throw e; }));
  }
  return bufferCache.get(id);
}

async function loadVRM(id, onProgress) {
  const buf = await fetchModel(id, onProgress);
  const gltf = await loader.parseAsync(buf.slice(0), '');
  const vrm = gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons?.(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((o) => { o.frustumCulled = false; if (o.isMesh) o.castShadow = true; });
  return vrm;
}

export function preloadModel(id) { return fetchModel(id).catch(() => {}); }

// ---------- 調色 ----------
const isOrig = (v) => !v || v === 'orig';
function avgColor(tex) {
  const img = tex?.image; if (!img) return new THREE.Color(1, 1, 1);
  const c = document.createElement('canvas'); c.width = c.height = 24; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, 24, 24);
  const d = g.getImageData(0, 0, 24, 24).data; let r = 0; let gg = 0; let b = 0; let n = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
  if (!n) return new THREE.Color(1, 1, 1);
  return new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
}
function tint(mat, hex, mul = 1) {
  const ud = mat.userData;
  if (!ud.orig) ud.orig = { color: mat.color.clone(), shade: mat.shadeColorFactor?.clone(), avg: avgColor(mat.map) };
  mat.color.copy(ud.orig.color); if (mat.shadeColorFactor && ud.orig.shade) mat.shadeColorFactor.copy(ud.orig.shade);
  if (isOrig(hex)) return;
  const t = new THREE.Color(hex).multiplyScalar(mul); const a = ud.orig.avg;
  const k = new THREE.Color(Math.min(4, t.r / Math.max(0.04, a.r)), Math.min(4, t.g / Math.max(0.04, a.g)), Math.min(4, t.b / Math.max(0.04, a.b)));
  mat.color.multiply(k); if (mat.shadeColorFactor) mat.shadeColorFactor.multiply(k);
}
function category(name) {
  if (/_SKIN/.test(name)) return 'skin';
  if (/_HAIR/.test(name)) return 'hair';
  if (/FaceBrow/.test(name)) return 'brow';
  if (/EyeIris/.test(name)) return 'iris';
  if (/(Tops|Onepice|Onepiece)/.test(name)) return 'top';
  if (/Bottoms/.test(name)) return 'bottom';
  if (/(Accessory|Tie)/.test(name)) return 'acc';
  if (/Shoes/.test(name)) return 'shoes';
  return 'other';
}
function forMaterials(root, fn) {
  root.traverse((o) => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => fn(m, o)); });
}

// ---------- 姿勢對應（程序化骨架 → VRM 正規化骨骼） ----------
const qa = new THREE.Quaternion(); const qb = new THREE.Quaternion(); const e = new THREE.Euler();
const Z90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
const Zm90 = Z90.clone().invert();
const FINGERS = ['Index', 'Middle', 'Ring', 'Little'];

export class VRMAvatar {
  constructor() {
    this.root = new THREE.Group();
    this.isVRM = true;
    this.anim = { tails: [], wings: [], floaters: [], hairSways: [], eyes: [] };
    this.weapon = 'none';
    this.headTopY = 1.6;
    this.body = null; this.hair = null; this.bodyId = null; this.hairId = null;
    this.extras = new THREE.Group();
    this.loading = null;
  }

  async setModels(bodyId, hairId, onProgress) {
    hairId = hairId || bodyId;
    const jobs = [];
    if (bodyId !== this.bodyId) jobs.push(loadVRM(bodyId, onProgress).then((v) => ['body', v, bodyId]));
    const wantHair = hairId !== bodyId ? hairId : null;
    if (wantHair !== this.hairId) jobs.push(wantHair ? loadVRM(wantHair, onProgress).then((v) => ['hair', v, wantHair]) : Promise.resolve(['hair', null, null]));
    const results = await Promise.all(jobs);
    for (const [slot, vrm, id] of results) {
      const old = this[slot];
      if (old) { this.root.remove(old.scene); VRMUtils.deepDispose(old.scene); }
      this[slot] = vrm; this[`${slot}Id`] = id;
      if (vrm) this.root.add(vrm.scene);
    }
    // 換頭髮：素體藏起自己的頭髮，髮型來源只顯示頭髮
    const hasHairSrc = !!this.hair;
    this.body.scene.traverse((o) => { if (o.isMesh) o.visible = !(hasHairSrc && /_HAIR/.test(o.material?.name || '')); });
    if (this.hair) this.hair.scene.traverse((o) => { if (o.isMesh) o.visible = /_HAIR/.test(o.material?.name || ''); });
    return results.length > 0;
  }

  bone(name, raw = true) {
    const h = this.body.humanoid; return raw ? h.getRawBoneNode(name) : h.getNormalizedBoneNode(name);
  }

  apply(L, cls) {
    if (!this.body) return;
    const all = [this.body, this.hair].filter(Boolean);
    const isPlate = cls.outfit === 'plate';
    for (const v of all) {
      forMaterials(v.scene, (m) => {
        switch (category(m.name)) {
          case 'skin': tint(m, L.skin); break;
          case 'hair': tint(m, L.hairColor); break;
          case 'brow': tint(m, L.hairColor, 0.8); break;
          case 'iris': tint(m, L.eyeColor);
            if (m.emissive) { m.emissive.set(isOrig(L.eyeColor) ? '#ffffff' : L.eyeColor); m.emissiveIntensity = L.eyeGlow * 1.6; }
            break;
          case 'top': tint(m, isPlate && !isOrig(L.outfit1) ? new THREE.Color(L.outfit1).lerp(new THREE.Color('#9aa4b4'), 0.35).getHexString().padStart(7, '#') : L.outfit1); break;
          case 'bottom': tint(m, L.outfit1, 0.55); break;
          case 'acc': tint(m, L.outfit2); break;
          case 'shoes': tint(m, isOrig(L.outfit2) ? 'orig' : '#3a2a22'); break;
          default: break;
        }
      });
    }
    // 骨骼比例
    const height = L.height;
    this.root.scale.setScalar(height);
    const headK = L.headSize * (1 + Math.max(0, 1 - height) * 0.75);
    const b = 0.88 + L.build * 0.26;
    const set = (n, x, y, z) => { const o = this.bone(n); if (o) o.scale.set(x, y, z); };
    set('head', headK, headK, headK);
    set('chest', b, 1, b); set('neck', 1 / b, 1, 1 / b);
    for (const s of ['left', 'right']) { set(`${s}UpperArm`, 1, b, b); set(`${s}LowerArm`, 1, 1 / b, 1 / b); set(`${s}UpperLeg`, b, 1, b); set(`${s}LowerLeg`, 1 / b, 1, 1 / b); }
    if (this.hair) { this.hair.scene.scale.setScalar(1); }
    // 表情
    this.expression = L.expression || 'neutral';
    // 配件
    this.buildExtras(L, cls);
    // 高度
    this.root.updateWorldMatrix(true, true);
    const hb = new THREE.Vector3(); this.bone('head').getWorldPosition(hb);
    this.headTopY = hb.y + 0.13 * headK * height;
    this.weapon = L.showWeapon ? cls.weapon : 'none';
  }

  adapter(boneName, { yFlip = true, z = 0, pos = null } = {}) {
    const g = new THREE.Group();
    g.rotation.set(0, yFlip ? Math.PI : 0, z, 'YZX');
    if (pos) g.position.set(...pos);
    this.bone(boneName).add(g); this.attached.push(g);
    return g;
  }

  buildExtras(L, cls) {
    (this.attached || []).forEach((g) => { g.parent?.remove(g); g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); });
    this.attached = [];
    this.anim = { tails: [], wings: [], floaters: [], hairSways: [], eyes: [] };
    const skin = isOrig(L.skin) ? '#f6d7c3' : L.skin;
    const hair = isOrig(L.hairColor) ? '#6b4a3a' : L.hairColor;
    const o1 = isOrig(L.outfit1) ? '#3b3f5c' : L.outfit1; const o2 = isOrig(L.outfit2) ? '#c9a24a' : L.outfit2;
    const M = { skinM: toon(skin), hairM: toon(hair), hornM: toon(L.hornColor), goldM: metal(o2, 0.3), steelM: metal('#737b8a', 0.5), leather: toon('#3a2a22'), o1: toon(o1), o2: toon(o2) };
    const LL = { ...L, skin, hairColor: hair, outfit1: o1, outfit2: o2 };
    const hr = 0.088;
    const head = this.adapter('head', { pos: [0, 0.075, 0] });
    head.position.set(0, 0.075, -0.005);
    // 頭部：只有非人類耳朵才加
    if (L.earType === 'elf') { const eg = new THREE.Group(); eg.position.set(0, 0.0, -0.005); eg.scale.set(1.25, 1.1, 1); head.add(eg); buildEars(eg, hr, { ...LL, ears: Math.max(0.35, L.ears) }, M); }
    else if (L.earType !== 'human' && L.earType !== 'none') { const eg = new THREE.Group(); eg.position.y = 0.022; eg.scale.setScalar(1.15); head.add(eg); buildEars(eg, hr, LL, M); }
    if (L.hornStyle !== 'none') { const hg = new THREE.Group(); hg.position.set(0, 0.03, 0.005); hg.scale.setScalar(1.3); head.add(hg); buildHorns(hg, hr, LL, M); }
    if (L.tusks) for (const s of [-1, 1]) { const t = mesh(new THREE.ConeGeometry(0.005, 0.022, 8), toon('#f3ead2')); t.position.set(s * 0.018, -0.052, 0.06); t.rotation.set(-0.2, 0, -s * 0.15); head.add(t); }
    if (L.beard !== 'none') {
      // 動漫臉不加八字鬍，只在下巴下方掛鬍子
      const bm = M.hairM; const bg = new THREE.Group(); bg.position.set(0, -0.072, 0.04); head.add(bg);
      const chin = mesh(sph(0.03, 16, 12), bm); chin.scale.set(1.3, 0.8, 0.75); bg.add(chin);
      if (L.beard === 'long') { const c = mesh(new THREE.ConeGeometry(0.036, 0.12, 12), bm); c.rotation.x = Math.PI; c.position.set(0, -0.07, 0.005); c.scale.z = 0.6; bg.add(c); }
      if (L.beard === 'braided') for (const sx of [-0.016, 0.016]) for (let i = 0; i < 6; i++) {
        const b = mesh(sph(0.013 - i * 0.0011, 10, 8), bm); b.position.set(sx, -0.02 - i * 0.02, 0.006 - i * 0.002); bg.add(b);
        if (i === 2 || i === 4) { const r = mesh(new THREE.TorusGeometry(0.011, 0.003, 6, 12), M.goldM, { outline: false }); r.rotation.x = Math.PI / 2; r.position.copy(b.position); bg.add(r); }
      }
    }
    const hatHead = this.adapter('head'); hatHead.position.set(0, 0.095, -0.01);
    buildHeadwear(hatHead, 0.112, LL, cls, M);
    // 背部：尾巴、翅膀、披風
    const hips = this.adapter('hips'); hips.position.set(0, 0.0, 0);
    if (L.tail !== 'none') { const t = new THREE.Group(); t.scale.setScalar(0.85); hips.add(t); buildTail(t, LL, M, this.anim); }
    const spine = this.adapter('spine'); spine.position.set(0, -0.04, 0);
    if (L.wings !== 'none') { const w = new THREE.Group(); w.position.y = 0.06; w.scale.setScalar(0.85); spine.add(w); buildWings(w, LL, M, this.anim); }
    if (L.cape && L.wings === 'none' && ['plate', 'ranger', 'rogue', 'warlock', 'sorcerer', 'bard', 'psion'].includes(cls.outfit)) {
      const cg = new THREE.PlaneGeometry(0.4, 0.95, 8, 14); cg.translate(0, -0.475, 0);
      const cape = mesh(cg, toon(cls.outfit === 'plate' ? o2 : new THREE.Color(o1).multiplyScalar(0.6), { side: THREE.DoubleSide }));
      const up = this.adapter('upperChest' in this.body.humanoid.humanBones && this.bone('upperChest') ? 'upperChest' : 'chest');
      up.position.set(0, 0.1, 0); cape.position.set(0, 0.04, -0.1); up.add(cape);
      this.anim.cape = cape; this.anim.capeBase = Float32Array.from(cg.attributes.position.array);
    }
    // 職業外觀
    if (cls.outfit === 'plate') {
      for (const [side, s] of [['left', 1], ['right', -1]]) {
        const sh = this.adapter(`${side}UpperArm`);
        const pad = mesh(new THREE.SphereGeometry(0.075, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.goldM); pad.position.set(s * 0.02, 0.01, 0); pad.rotation.z = -s * 0.35; pad.scale.set(1.1, 0.8, 1); sh.add(pad);
        const pad2 = mesh(new THREE.SphereGeometry(0.06, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.steelM); pad2.position.set(s * 0.055, -0.03, 0); pad2.rotation.z = -s * 0.9; sh.add(pad2);
      }
      const tab = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.36), toon(o2, { side: THREE.DoubleSide })); tab.position.set(0, -0.2, 0.115); hips.add(tab);
      const em = new THREE.Mesh(new THREE.OctahedronGeometry(0.025), glow(L.aura, 2)); em.position.set(0, -0.08, 0.118); em.scale.set(1, 1.4, 0.3); hips.add(em);
    }
    if (['wizard', 'sorcerer', 'cleric', 'warlock', 'druid'].includes(cls.outfit)) {
      const len = cls.outfit === 'cleric' ? 0.55 : 0.7;
      const robe = mesh(new THREE.CylinderGeometry(0.135, 0.25, len, 28, 4, true), toon(o1, { side: THREE.DoubleSide }));
      robe.position.y = -len / 2 + 0.02; robe.scale.z = 0.85; hips.add(robe); this.anim.skirt = robe;
      const trim = mesh(new THREE.TorusGeometry(0.25, 0.01, 6, 40), M.goldM, { outline: false }); trim.rotation.x = Math.PI / 2; trim.position.y = -len + 0.02; trim.scale.y = 0.85; hips.add(trim);
      const sash = mesh(new THREE.TorusGeometry(0.137, 0.014, 8, 32), M.o2); sash.rotation.x = Math.PI / 2; sash.scale.y = 0.85; sash.position.y = 0.02; hips.add(sash);
    }
    if (cls.outfit === 'fur') {
      const furGeo = new THREE.IcosahedronGeometry(1, 2);
      const fur = mesh(furGeo, toon('#6b4a32')); fur.scale.set(0.2, 0.06, 0.12);
      const up = this.adapter('upperChest' in this.body.humanoid.humanBones && this.bone('upperChest') ? 'upperChest' : 'chest'); up.position.set(0, 0.11, 0); up.add(fur);
    }
    if (cls.outfit === 'monk') {
      const sash = mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 32), M.o2); sash.rotation.x = Math.PI / 2; sash.scale.y = 0.8; sash.position.y = 0.04; hips.add(sash);
    }
    // 武器（手部轉接座讓手的局部座標與程序化骨架一致）
    if (L.showWeapon) {
      const handR = this.adapter('leftHand', { z: Math.PI / 2 }); handR.children.length; handR.position.set(0, 0, 0);
      const handL = this.adapter('rightHand', { z: -Math.PI / 2 });
      const wrapR = new THREE.Group(); wrapR.position.y = -0.04; handR.add(wrapR);
      // 劍、槌類斜向外側，避免擋住臉
      if (['sword', 'mace', 'warhammer', 'greataxe', 'gadget'].includes(cls.weapon)) wrapR.rotation.y = 0.65;
      const wrapL = new THREE.Group(); wrapL.position.y = -0.04; handL.add(wrapL);
      const sp = new THREE.Group(); sp.position.set(0, 0.06, -0.01); sp.scale.setScalar(0.88); spine.add(sp);
      buildWeapon({ handR: wrapR, handL: wrapL, spine: sp }, cls.weapon, LL, { steelM: M.steelM, goldM: M.goldM, leather: M.leather, o1: M.o1, o2: M.o2 }, this.anim);
    }
    this.grip = L.showWeapon && cls.weapon !== 'none';
  }

  // joints：與程序化骨架同名的歐拉角 [x,y,z]
  pose(J, t, dt, extra) {
    if (!this.body) return;
    const h = this.body.humanoid;
    // VRM 0.x 的正規化骨骼空間面向 -Z：把世界座標下的旋轉轉過去（x、z 分量取負）
    const v0 = this.body.meta?.metaVersion === '0';
    const setQ = (name, q) => { const n = h.getNormalizedBoneNode(name); if (!n) return; n.quaternion.copy(q); if (v0) { n.quaternion.x *= -1; n.quaternion.z *= -1; } };
    const eq = (a) => qa.setFromEuler(e.set(a[0], a[1], a[2], 'XYZ'));
    // 手臂：程序化 R(+x) ＝ VRM 左；L(-x) ＝ VRM 右
    const arm = (my, el, side) => {
      const out = side === 'left' ? 1 : -1;
      const up = eq([my[0], my[1], my[2] + out * 0.08]).clone().multiply(side === 'left' ? Zm90 : Z90);
      setQ(`${side}UpperArm`, up);
      const conj = side === 'left' ? Z90 : Zm90; const inv = side === 'left' ? Zm90 : Z90;
      const low = conj.clone().multiply(eq(el)).multiply(inv);
      setQ(`${side}LowerArm`, low);
    };
    arm(J.shoulderR, J.elbowR, 'left');
    arm(J.shoulderL, J.elbowL, 'right');
    setQ('leftUpperLeg', eq(J.thighR).clone()); setQ('rightUpperLeg', eq(J.thighL).clone());
    setQ('leftLowerLeg', eq(J.kneeR).clone()); setQ('rightLowerLeg', eq(J.kneeL).clone());
    setQ('spine', eq(J.spine).clone());
    setQ('hips', eq(J.hips).clone());
    setQ('neck', eq([J.head[0] * 0.4, J.head[1] * 0.4, J.head[2] * 0.4]).clone());
    setQ('head', eq([J.head[0] * 0.6, J.head[1] * 0.6, J.head[2] * 0.6]).clone());
    // 握拳
    const curl = this.grip ? 1.15 : 0.35;
    for (const side of ['left', 'right']) {
      const s = side === 'left' ? -1 : 1;
      for (const f of FINGERS) for (const seg of ['Proximal', 'Intermediate', 'Distal']) {
        setQ(`${side}${f}${seg}`, qb.setFromAxisAngle(new THREE.Vector3(0, 0, 1), s * curl));
      }
      setQ(h.getNormalizedBoneNode(`${side}ThumbProximal`) ? `${side}ThumbProximal` : `${side}ThumbMetacarpal`, qb.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -s * curl * 0.5));
    }
    // 表情與眨眼
    const em = this.body.expressionManager;
    if (em) {
      for (const k of ['happy', 'angry', 'sad', 'relaxed', 'surprised']) em.setValue(k, 0);
      if (this.expression !== 'neutral') em.setValue(this.expression, this.expression === 'happy' ? 0.7 : 0.6);
      const blinkPhase = t % 4.2;
      em.setValue('blink', this.expression === 'happy' ? 0 : blinkPhase < 0.07 ? blinkPhase / 0.07 : blinkPhase < 0.14 ? 1 - (blinkPhase - 0.07) / 0.07 : 0);
    }
    if (extra?.lookTarget && this.body.lookAt) this.body.lookAt.target = extra.lookTarget;
    this.body.update(dt);
    if (this.hair) {
      // 髮型來源跟隨素體的骨骼
      const hh = this.hair.humanoid;
      for (const name of Object.keys(h.humanBones)) {
        const src = h.getNormalizedBoneNode(name); const dst = hh.getNormalizedBoneNode(name);
        if (src && dst) dst.quaternion.copy(src.quaternion);
      }
      const hs = hh.getRawBoneNode('head'); const bs = this.bone('head'); if (hs && bs) hs.scale.copy(bs.scale);
      // 對齊兩個模型的頭部位置（不同素體身高不同）
      this.root.updateMatrixWorld(true);
      const pa = this.root.worldToLocal(bs.getWorldPosition(new THREE.Vector3()));
      const pb = this.root.worldToLocal(hs.getWorldPosition(new THREE.Vector3()));
      this.hair.scene.position.add(pa.sub(pb));
      this.hair.update(dt);
    }
  }

  dispose() {
    for (const v of [this.body, this.hair]) if (v) VRMUtils.deepDispose(v.scene);
  }
}
