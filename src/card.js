// 角色卡 PNG：畫出可直接閱讀的角色卡，並把角色資料藏進 PNG 的 tEXt 區塊，拖回網站即可匯入
import { state, derive, getSpell, fmt, ABILITIES, encodeShare } from './state.js';

const W = 1080; const H = 1350; // 4:5，Discord 手機版預覽最佳比例
const KEY = 'dndforge';

// ---------- PNG tEXt 區塊 ----------
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function textChunk(keyword, text) {
  const data = new TextEncoder().encode(`${keyword}\0${text}`); // text 為 base64url，純 ASCII
  const type = new TextEncoder().encode('tEXt');
  const out = new Uint8Array(12 + data.length); const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length); out.set(type, 4); out.set(data, 8);
  const crcIn = new Uint8Array(4 + data.length); crcIn.set(type); crcIn.set(data, 4);
  dv.setUint32(8 + data.length, crc32(crcIn));
  return out;
}

export function embedText(pngBytes, keyword, text) {
  const iend = pngBytes.length - 12; // IEND 固定 12 bytes
  const chunk = textChunk(keyword, text);
  const out = new Uint8Array(pngBytes.length + chunk.length);
  out.set(pngBytes.subarray(0, iend)); out.set(chunk, iend); out.set(pngBytes.subarray(iend), iend + chunk.length);
  return out;
}

export function readText(pngBytes, keyword = KEY) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((b, i) => pngBytes[i] === b)) return null;
  const dv = new DataView(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength);
  let p = 8;
  while (p + 8 <= pngBytes.length) {
    const len = dv.getUint32(p); const type = String.fromCharCode(...pngBytes.subarray(p + 4, p + 8));
    if (type === 'tEXt') {
      const data = pngBytes.subarray(p + 8, p + 8 + len); const z = data.indexOf(0);
      const k = new TextDecoder('latin1').decode(data.subarray(0, z));
      if (k === keyword) return new TextDecoder('latin1').decode(data.subarray(z + 1));
    }
    if (type === 'IEND') break;
    p += 12 + len;
  }
  return null;
}

// ---------- 繪製 ----------
const FONT_SERIF = '"Noto Serif TC", serif';
const FONT_SANS = '"Noto Sans TC", sans-serif';
const FONT_NUM = 'Rajdhani, "Noto Sans TC", sans-serif';
const FONT_DISPLAY = 'Cinzel, "Noto Serif TC", serif';

function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }

function cutRect(g, x, y, w, h, c = 18) {
  g.beginPath(); g.moveTo(x + c, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h - c); g.lineTo(x + w - c, y + h); g.lineTo(x, y + h); g.lineTo(x, y + c); g.closePath();
}

// 中文逐字換行；回傳實際使用的行數
function wrap(g, text, x, y, maxW, lineH, maxLines = 99) {
  const lines = []; let line = '';
  for (const ch of text) {
    if (ch === '\n') { lines.push(line); line = ''; continue; }
    if (g.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; } else line += ch;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) { let l = shown[maxLines - 1]; while (g.measureText(`${l}…`).width > maxW) l = l.slice(0, -1); shown[maxLines - 1] = `${l}…`; }
  shown.forEach((l, i) => g.fillText(l, x, y + i * lineH));
  return shown.length;
}

function section(g, label, x, y, w, accent) {
  g.font = `700 32px ${FONT_SERIF}`; g.fillStyle = '#e9c46a'; g.textBaseline = 'alphabetic';
  g.fillText(label, x, y);
  const tw = g.measureText(label).width;
  const grd = g.createLinearGradient(x + tw + 14, 0, x + w, 0); grd.addColorStop(0, 'rgba(233,196,106,0.5)'); grd.addColorStop(1, 'rgba(233,196,106,0)');
  g.fillStyle = grd; g.fillRect(x + tw + 14, y - 9, w - tw - 14, 1.5);
}

export async function renderCard(stage) {
  await Promise.all([`900 64px ${FONT_SERIF}`, `600 26px ${FONT_SERIF}`, `400 24px ${FONT_SANS}`, `700 40px Rajdhani`, `700 20px Cinzel`].map((f) => document.fonts.load(f).catch(() => {})));
  const d = derive();
  const accent = state.look.aura;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');

  // 背景
  g.fillStyle = '#0a0816'; g.fillRect(0, 0, W, H);
  let grd = g.createRadialGradient(300, 450, 50, 300, 450, 900); grd.addColorStop(0, `${accent}55`); grd.addColorStop(1, 'transparent');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  grd = g.createRadialGradient(W, H, 0, W, H, 700); grd.addColorStop(0, 'rgba(233,196,106,0.12)'); grd.addColorStop(1, 'transparent');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // 星點
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.35})`; g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5); }
  // 外框
  g.strokeStyle = 'rgba(233,196,106,0.55)'; g.lineWidth = 2; cutRect(g, 18, 18, W - 36, H - 36, 36); g.stroke();
  g.strokeStyle = `${accent}88`; g.lineWidth = 1; cutRect(g, 28, 28, W - 56, H - 56, 30); g.stroke();

  // 標頭
  const PAD = 56;
  g.textBaseline = 'alphabetic';
  g.font = `700 26px ${FONT_DISPLAY}`; g.fillStyle = accent;
  g.fillText(`D&D 5E  ·  LEVEL ${state.level}`, PAD, 84);
  g.font = `900 72px ${FONT_SERIF}`; g.fillStyle = '#fff';
  const name = state.name || '無名冒險者';
  let size = 72; while (g.measureText(name).width > W - PAD * 2 && size > 36) { size -= 4; g.font = `900 ${size}px ${FONT_SERIF}`; }
  g.shadowColor = accent; g.shadowBlur = 24; g.fillText(name, PAD, 152); g.shadowBlur = 0;
  const ancestry = d.race.choice && state.raceChoice[d.race.choice.key] ? `（${d.race.choice.options.find((o) => o.id === state.raceChoice[d.race.choice.key])?.name || ''}）` : '';
  g.font = `500 30px ${FONT_SANS}`; g.fillStyle = '#c9c2e3';
  const sub = `${d.race.name}${ancestry} · ${d.cls.name}${state.level >= d.cls.subclassLevel ? `（${d.cls.subclass.name}）` : ''} · ${d.bg.name} · ${state.alignment}`;
  wrap(g, sub, PAD, 198, W - PAD * 2, 34, 1);

  // 立繪
  const PX = PAD; const PY = 230; const PW = 420; const PH = 560;
  const pic = await loadImage(stage.snapshot(600, 800, 'image/jpeg'));
  g.save(); cutRect(g, PX, PY, PW, PH, 28); g.clip(); g.drawImage(pic, PX, PY, PW, PH);
  grd = g.createLinearGradient(0, PY + PH - 160, 0, PY + PH); grd.addColorStop(0, 'transparent'); grd.addColorStop(1, 'rgba(10,8,22,0.9)');
  g.fillStyle = grd; g.fillRect(PX, PY + PH - 160, PW, 160); g.restore();
  g.strokeStyle = accent; g.lineWidth = 2; cutRect(g, PX, PY, PW, PH, 28); g.stroke();
  g.font = `500 26px ${FONT_SANS}`; g.fillStyle = '#fff'; g.textAlign = 'left';
  g.fillText(`${d.race.size}${d.race.darkvision ? ` · 黑暗視覺 ${d.race.darkvision} 呎` : ''}`, PX + 20, PY + PH - 24);

  // 右欄：數值
  const RX = PX + PW + 34; const RW = W - PAD - RX;
  const vit = [['生命', d.hp, '#ff6b7d'], ['護甲', d.ac, '#9fd3ff'], ['先攻', fmt(d.init), '#fff'], ['速度', d.speed, '#fff'], ['熟練', fmt(d.pb), '#fff'], ['被動察覺', d.passive, '#fff']];
  const bw = (RW - 20) / 3; const bh = 106;
  vit.forEach(([n, v, col], i) => {
    const x = RX + (i % 3) * (bw + 10); const y = PY + Math.floor(i / 3) * (bh + 10);
    g.fillStyle = 'rgba(255,255,255,0.04)'; cutRect(g, x, y, bw, bh, 12); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.stroke();
    g.textAlign = 'center'; g.font = `700 56px ${FONT_NUM}`; g.fillStyle = col; g.fillText(String(v), x + bw / 2, y + 58);
    g.font = `500 25px ${FONT_SANS}`; g.fillStyle = '#b3acd0'; g.fillText(n, x + bw / 2, y + 91);
  });

  // 六大屬性
  let y = PY + bh * 2 + 10 + 50;
  section(g, '屬性', RX, y, RW); y += 18;
  const aw = (RW - 20) / 3; const ah = 118;
  ABILITIES.forEach((a, i) => {
    const x = RX + (i % 3) * (aw + 10); const yy = y + Math.floor(i / 3) * (ah + 10);
    const primary = d.cls.primary.includes(a.id);
    g.fillStyle = primary ? 'rgba(233,196,106,0.08)' : 'rgba(255,255,255,0.03)'; cutRect(g, x, yy, aw, ah, 14); g.fill();
    g.strokeStyle = primary ? 'rgba(233,196,106,0.6)' : 'rgba(255,255,255,0.12)'; g.lineWidth = 1.5; g.stroke();
    g.textAlign = 'center';
    g.font = `500 26px ${FONT_SANS}`; g.fillStyle = '#c9c2e3'; g.fillText(a.name, x + aw / 2, yy + 34);
    g.font = `700 54px ${FONT_NUM}`; g.fillStyle = accent; g.fillText(fmt(d.mods[a.id]), x + aw / 2, yy + 82);
    g.font = `700 26px ${FONT_NUM}`; g.fillStyle = '#fff'; g.fillText(String(d.scores[a.id]), x + aw / 2, yy + 108);
  });
  y += ah * 2 + 10 + 4;
  g.textAlign = 'left';
  g.font = `500 28px ${FONT_SANS}`; g.fillStyle = '#ece8f6';
  wrap(g, `豁免　${d.saves.filter((s) => s.prof).map((s) => `${s.name} ${fmt(s.bonus)}`).join('　')}`, RX, y + 34, RW, 34, 1);

  // 下方全寬區
  y = 900; const FW = W - PAD * 2; const BODY = `400 29px ${FONT_SANS}`; const LH = 40;
  section(g, '技能熟練', PAD, y, FW); y += 46;
  g.font = BODY; g.fillStyle = '#ece8f6';
  y += wrap(g, d.skills.filter((s) => s.prof).map((s) => `${s.name}${fmt(s.bonus)}`).join('　') || '—', PAD, y, FW, LH, 2) * LH + 16;

  const m = d.magic;
  const spellNames = [...state.raceCantrips, ...state.cantrips, ...state.spells].map(getSpell).filter(Boolean).sort((a, b) => a.level - b.level);
  if (m || spellNames.length) {
    section(g, m ? `施法 DC ${m.dc}　攻擊 ${fmt(m.atk)}${m.slots.length ? `　${m.slots.map((n, i) => (n ? `${i + 1}環×${n}` : '')).filter(Boolean).join(' ')}` : ''}` : '戲法', PAD, y, FW); y += 46;
    g.font = BODY; g.fillStyle = '#ece8f6';
    y += wrap(g, spellNames.map((s) => (s.level ? `${s.name}` : `${s.name}◇`)).join('、') || '尚未選擇法術', PAD, y, FW, LH, 2) * LH + 16;
  }
  const featNames = [...(d.race.traits || []).map((t) => t.name), ...d.features.map((f) => f[1])];
  section(g, '特性', PAD, y, FW); y += 46;
  g.font = BODY; g.fillStyle = '#ece8f6';
  wrap(g, featNames.join('、'), PAD, y, FW, LH, Math.max(1, Math.floor((H - 96 - y) / LH) + 1));

  // 頁尾
  g.textAlign = 'left'; g.font = `700 22px ${FONT_DISPLAY}`; g.fillStyle = '#e9c46a'; g.fillText('DRAGONFORGE · 龍鑄', PAD, H - 48);
  g.textAlign = 'right'; g.font = `400 21px ${FONT_SANS}`; g.fillStyle = '#6f6890';
  g.fillText(`${state.player ? `玩家：${state.player}　` : ''}原圖拖回龍鑄可匯入角色`, W - PAD, H - 48);

  // 輸出 PNG 並嵌入角色資料
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const code = await encodeShare({ c: state, ...neededCustomForCard() });
  const out = embedText(bytes, KEY, code);
  return new Blob([out], { type: 'image/png' });
}

let neededCustomForCard = () => ({});
export function setCustomResolver(fn) { neededCustomForCard = fn; }

export async function extractFromPng(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return readText(bytes);
}
