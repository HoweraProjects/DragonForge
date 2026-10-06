// 壓縮 VRM（GLB）內的貼圖，讓模型適合在手機上載入。
// 用法：node tools/optimize-vrm.mjs <輸入.vrm> <輸出.vrm> [縮圖輸出.jpg]
// - 一般貼圖最大 1024px，法線貼圖 512px，不透明者轉成 JPEG
// - VRM 擴充資料（表情、彈簧骨、MToon 參數）原封不動保留
import fs from 'node:fs';
import sharp from 'sharp';

const [, , inPath, outPath, thumbPath] = process.argv;
const buf = fs.readFileSync(inPath);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('不是 GLB 檔');
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLen));

const viewData = json.bufferViews.map((v) => bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength));
const thumbIdx = json.extensions?.VRM?.meta?.texture;
const thumbImage = thumbIdx != null && thumbIdx >= 0 ? json.textures[thumbIdx]?.source : -1;

for (const [i, img] of json.images.entries()) {
  const src = viewData[img.bufferView];
  const name = img.name || '';
  const isNormal = /_nml$/i.test(name);
  const isThumb = i === thumbImage;
  const max = isThumb ? 256 : isNormal ? 512 : /Face|Eye|Brow|Mouth|Matcap|Shader/.test(name) ? 512 : 1024;
  let pipe = sharp(src);
  const meta = await pipe.metadata();
  if (meta.width > max || meta.height > max) pipe = pipe.resize(max, max, { fit: 'inside' });
  const stats = await sharp(src).stats();
  let out; let mime;
  if (stats.isOpaque && !isNormal) { out = await pipe.jpeg({ quality: 86, mozjpeg: true }).toBuffer(); mime = 'image/jpeg'; }
  else { out = await pipe.png({ compressionLevel: 9, palette: !isNormal, quality: 90 }).toBuffer(); mime = 'image/png'; }
  if (out.length < src.length) { viewData[img.bufferView] = out; img.mimeType = mime; }
  if (isThumb && thumbPath) await sharp(src).resize(256, 256, { fit: 'cover', position: 'top' }).jpeg({ quality: 82 }).toFile(thumbPath);
}

// 移除 VRM 表情沒用到的 morph target（臉部網格佔大半檔案）
{
  const groups = json.extensions?.VRM?.blendShapeMaster?.blendShapeGroups || [];
  const usedByMesh = new Map();
  for (const g of groups) for (const b of g.binds || []) { if (!usedByMesh.has(b.mesh)) usedByMesh.set(b.mesh, new Set()); usedByMesh.get(b.mesh).add(b.index); }
  json.meshes.forEach((m, mi) => {
    const n = m.primitives[0].targets?.length || 0; if (!n) return;
    const keep = [...(usedByMesh.get(mi) || [])].sort((a, b) => a - b);
    const remap = new Map(keep.map((old, i) => [old, i]));
    for (const p of m.primitives) if (p.targets) p.targets = keep.map((k) => p.targets[k]);
    if (m.weights) m.weights = keep.map((k) => m.weights[k] || 0);
    if (m.extras?.targetNames) m.extras.targetNames = keep.map((k) => m.extras.targetNames[k]);
    for (const p of m.primitives) if (p.extras?.targetNames) p.extras.targetNames = keep.map((k) => p.extras.targetNames[k]);
    for (const g of groups) for (const b of g.binds || []) if (b.mesh === mi) b.index = remap.get(b.index);
  });
}
// 回收沒被引用的 accessor / bufferView
{
  const usedAcc = new Set();
  for (const m of json.meshes) for (const p of m.primitives) {
    Object.values(p.attributes).forEach((a) => usedAcc.add(a)); if (p.indices != null) usedAcc.add(p.indices);
    (p.targets || []).forEach((t) => Object.values(t).forEach((a) => usedAcc.add(a)));
  }
  (json.skins || []).forEach((s) => s.inverseBindMatrices != null && usedAcc.add(s.inverseBindMatrices));
  (json.animations || []).forEach((an) => an.samplers.forEach((s) => { usedAcc.add(s.input); usedAcc.add(s.output); }));
  const accMap = new Map(); const newAcc = [];
  json.accessors.forEach((a, i) => { if (usedAcc.has(i)) { accMap.set(i, newAcc.length); newAcc.push(a); } });
  const ra = (i) => accMap.get(i);
  for (const m of json.meshes) for (const p of m.primitives) {
    for (const k of Object.keys(p.attributes)) p.attributes[k] = ra(p.attributes[k]);
    if (p.indices != null) p.indices = ra(p.indices);
    if (p.targets) p.targets = p.targets.map((t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, ra(v)])));
  }
  (json.skins || []).forEach((s) => { if (s.inverseBindMatrices != null) s.inverseBindMatrices = ra(s.inverseBindMatrices); });
  (json.animations || []).forEach((an) => an.samplers.forEach((s) => { s.input = ra(s.input); s.output = ra(s.output); }));
  json.accessors = newAcc;
  const usedView = new Set(); newAcc.forEach((a) => a.bufferView != null && usedView.add(a.bufferView)); json.images.forEach((im) => usedView.add(im.bufferView));
  const viewMap = new Map(); const newViews = []; const newData = [];
  json.bufferViews.forEach((v, i) => { if (usedView.has(i)) { viewMap.set(i, newViews.length); newViews.push(v); newData.push(viewData[i]); } });
  newAcc.forEach((a) => { if (a.bufferView != null) a.bufferView = viewMap.get(a.bufferView); });
  json.images.forEach((im) => { im.bufferView = viewMap.get(im.bufferView); });
  json.bufferViews = newViews; viewData.length = 0; viewData.push(...newData);
}

// 重新打包 bufferViews（4 bytes 對齊）
const parts = []; let offset = 0;
json.bufferViews.forEach((v, i) => {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) { parts.push(Buffer.alloc(pad)); offset += pad; }
  v.byteOffset = offset; v.byteLength = viewData[i].length;
  parts.push(viewData[i]); offset += viewData[i].length;
});
const tail = (4 - (offset % 4)) % 4; if (tail) parts.push(Buffer.alloc(tail));
const newBin = Buffer.concat(parts);
json.buffers = [{ byteLength: newBin.length }];

let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
const jpad = (4 - (jsonBuf.length % 4)) % 4; jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jpad, 0x20)]);
const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonBuf.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(newBin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
const total = 12 + 8 + jsonBuf.length + 8 + newBin.length; header.writeUInt32LE(total, 8);
fs.writeFileSync(outPath, Buffer.concat([header, jh, jsonBuf, bh, newBin]));
console.log(`${inPath.split('/').pop()}: ${(buf.length / 1048576).toFixed(1)}MB → ${(total / 1048576).toFixed(1)}MB`);
