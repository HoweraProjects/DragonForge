import './style.css';
import { Stage } from './scene/stage.js';
import { sfx } from './sfx.js';
import {
  state, update, on, emit, derive, stepStatus, replaceState, newCharacter, DEFAULT_LOOK,
  allRaces, allSpells, getRace, getClass, getSpell, pointsSpent, mod, fmt, roster, encodeShare, decodeShare,
  ABILITIES, SKILLS, CLASSES, BACKGROUNDS, POINT_COST, STANDARD_ARRAY,
} from './state.js';
import { SCHOOLS, ALIGNMENTS } from './data/rules.js';
import { openWorkshop } from './workshop.js';
import { renderCard, extractFromPng, setCustomResolver } from './card.js';
import { VRM_MODELS, modelThumb, preloadModel } from './scene/vrmAvatar.js';

// ---------- 工具 ----------
export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hexRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`; };
const abName = (id) => ABILITIES.find((a) => a.id === id)?.name || id;
const skName = (id) => SKILLS.find((s) => s.id === id)?.name || id;

export function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2200);
}
function banner(en, zh) {
  const b = document.createElement('div'); b.className = 'banner'; b.innerHTML = `<div class="b-in"><div class="b-en">${en}</div><div class="b-zh">${zh}</div></div>`;
  $('#app').append(b); setTimeout(() => b.remove(), 2300);
}
function download(name, href) { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); }
export function downloadJSON(name, obj) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  download(name, url); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- 3D 舞台 ----------
const stage = new Stage($('#stage'));
export { stage };
window.__stage = stage;
let lookQueued = false;
function refreshAvatar() {
  if (lookQueued) return; lookQueued = true;
  setTimeout(() => {
    lookQueued = false;
    stage.setLook(state.look, getClass(state.classId), {
      onProgress: (p) => setLoader(`召喚模型中… ${Math.round(p * 100)}%`),
      onState: (st, err) => {
        if (st === 'loading') setLoader('召喚模型中…');
        if (st === 'ready') { setLoader(null); stage.focus(STEPS[stepIdx].id === 'look' ? lookCam() : STEPS[stepIdx].cam); }
        if (st === 'error') { setLoader(null); console.error(err); toast('模型載入失敗，改用 Q 版模型'); update((s) => { s.look.model = 'chibi'; }, { look: true }); }
      },
    });
  }, 0);
}
function setLoader(text) {
  let el = $('#loader');
  if (!text) { el?.classList.add('out'); setTimeout(() => el?.remove(), 400); return; }
  if (!el) { el = document.createElement('div'); el.id = 'loader'; el.innerHTML = '<i></i><span></span>'; $('#app').append(el); }
  el.classList.remove('out'); el.querySelector('span').textContent = text;
}
function applyAccent() {
  const c = state.look.aura;
  document.documentElement.style.setProperty('--accent', c);
  document.documentElement.style.setProperty('--accent-rgb', hexRgb(c));
  stage.setAccent(c);
}
function updateShift() {
  // 讓角色置中於面板以外的可視區域
  const wide = innerWidth > 900;
  const panelW = wide ? $('#panel').offsetWidth + 16 : 0;
  const navW = wide ? 100 : 0;
  const h = innerHeight;
  const cam = stage.camera;
  if (wide) cam.setViewOffset(innerWidth, h, (panelW - navW) / 2, 0, innerWidth, h);
  else cam.setViewOffset(innerWidth, h, 0, $('#panel').offsetHeight * 0.42, innerWidth, h);
}
addEventListener('resize', updateShift);

// ---------- 步驟 ----------
const ICON = {
  race: '<path d="M12 3c-3 4-6 5-6 10a6 6 0 0 0 12 0c0-5-3-6-6-10z"/><path d="M9 14c1 1 5 1 6 0"/>',
  class: '<path d="M5 19 19 5M15 5h4v4M7 13l4 4M4 20l2-2"/>',
  abilities: '<path d="M12 3 20 8v8l-8 5-8-5V8z"/><path d="M12 8l4 2.5v4L12 17l-4-2.5v-4z"/>',
  background: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  skills: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8"/>',
  spells: '<path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z"/>',
  look: '<circle cx="12" cy="9" r="5"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  summary: '<path d="M6 3h12v18l-6-4-6 4z"/><path d="M9 8h6M9 11h6"/>',
};
const STEPS = [
  { id: 'race', zh: '種族', en: 'ORIGIN', sub: '選擇你的血脈。種族決定屬性加值、天賦與外貌基礎。', cam: 'full' },
  { id: 'class', zh: '職業', en: 'CALLING', sub: '選擇職業與等級。職業決定戰鬥方式、生命骰與裝備。', cam: 'full' },
  { id: 'abilities', zh: '屬性', en: 'ATTRIBUTES', sub: '以購點、標準數組或擲骰決定六大屬性。', cam: 'side' },
  { id: 'background', zh: '背景', en: 'HISTORY', sub: '在成為冒險者之前，你是誰？', cam: 'upper' },
  { id: 'skills', zh: '技能', en: 'EXPERTISE', sub: '從職業技能清單中挑選熟練項目。', cam: 'upper' },
  { id: 'spells', zh: '法術', en: 'ARCANA', sub: '挑選戲法與法術。懸停可預覽施法特效。', cam: 'upper' },
  { id: 'look', zh: '外觀', en: 'VISAGE', sub: '捏臉系統：體型、五官、髮型、種族特徵與服裝。', cam: 'face' },
  { id: 'summary', zh: '完成', en: 'LEGEND', sub: '確認角色卡，儲存、匯出或分享給你的團隊。', cam: 'summary' },
];
let stepIdx = 0;
let lookTab = 'base';
let spellFilter = { lv: 0, q: '', school: '' };
let poolPick = null; // 標準數組 / 擲骰：目前選中的數值索引
let rolling = false;

function renderNav() {
  const st = stepStatus();
  $('#steps').innerHTML = STEPS.map((s, i) => `
    <button class="step-btn ${i === stepIdx ? 'active' : ''} ${st[s.id] ? 'done' : ''}" data-step="${i}">
      <span class="hex"></span><svg viewBox="0 0 24 24">${ICON[s.id]}</svg><span class="lbl">${s.zh}</span><span class="dot"></span>
      <span class="tip">${String(i + 1).padStart(2, '0')} · ${s.en}</span>
    </button>`).join('');
}

function goStep(i, { silent = false } = {}) {
  i = Math.max(0, Math.min(STEPS.length - 1, i));
  const changed = i !== stepIdx; stepIdx = i;
  const s = STEPS[i];
  if (!silent) { sfx.whoosh(); }
  stage.focus(s.id === 'look' ? lookCam() : s.cam);
  renderNav(); renderPanel(true);
  if (changed && s.id === 'summary') setTimeout(() => { stage.play('flourish', 1.8); }, 500);
}

function lookCam() { return { base: 'full', body: 'full', face: 'face', hair: 'upper', traits: 'upper', outfit: 'full', aura: 'full' }[lookTab] || 'full'; }

function renderPanel(enter = false) {
  const s = STEPS[stepIdx]; const body = $('#panelBody');
  const scroll = body.scrollTop;
  $('#panelEn').textContent = s.en; $('#panelTitle').textContent = s.zh; $('#panelIdx').textContent = String(stepIdx + 1).padStart(2, '0');
  $('#panelSub').textContent = s.sub;
  body.innerHTML = RENDER[s.id]();
  body.classList.toggle('enter', enter);
  if (enter) body.scrollTop = 0; else body.scrollTop = scroll;
  $('#prevBtn').disabled = stepIdx === 0;
  $('#nextBtn').innerHTML = stepIdx === STEPS.length - 1 ? '鍛造完成 <span>✦</span>' : '下一步 <span>›</span>';
  $('#progressBar').style.width = `${((stepIdx + 1) / STEPS.length) * 100}%`;
  body.querySelectorAll('input[type=range]').forEach(setRangeFill);
  if (s.id === 'summary') queueMicrotask(updatePortrait);
}
function setRangeFill(r) { const p = ((r.value - r.min) / (r.max - r.min)) * 100; r.style.setProperty('--p', `${p}%`); }

function renderHUD() {
  const d = derive();
  $('#hud').innerHTML = `
    <div class="hud-id">
      <div class="hud-lv">LV <b>${state.level}</b></div>
      <div class="hud-name">${esc(state.name || '無名冒險者')}</div>
      <div class="hud-cls">${esc(d.race.name)} · ${esc(d.cls.name)}${state.level >= d.cls.subclassLevel ? ` · ${esc(d.cls.subclass.name)}` : ''}</div>
    </div>
    <div class="hud-stats">
      <div class="hs hp"><b>${d.hp}</b><span>生命</span></div>
      <div class="hs ac"><b>${d.ac}</b><span>護甲</span></div>
      <div class="hs"><b>${fmt(d.init)}</b><span>先攻</span></div>
      <div class="hs"><b>${d.speed}</b><span>速度</span></div>
      <div class="hs"><b>${fmt(d.pb)}</b><span>熟練</span></div>
    </div>`;
  const nm = $('#charName'); if (document.activeElement !== nm) nm.value = state.name;
}

// ---------- 各步驟畫面 ----------
const asiChips = (r) => {
  const out = Object.entries(r.asi || {}).map(([k, v]) => `<span class="chip gold">${abName(k)} +${v}</span>`);
  if (r.asiChoice) out.push(`<span class="chip gold">任選 ${r.asiChoice.count} 項 +${r.asiChoice.amount}</span>`);
  return out.join('');
};
const RACE_COLORS = { human: '#e9c46a', 'high-elf': '#7dffcf', 'hill-dwarf': '#ff9a5a', lightfoot: '#ffd166', dragonborn: '#ff5a4a', 'rock-gnome': '#b388ff', 'half-elf': '#5ad1ff', 'half-orc': '#9be36d', tiefling: '#ff5a8a' };

const RENDER = {
  race() {
    const races = allRaces(); const d = derive(); const r = d.race;
    let h = `<div class="sec">血脈 <small>${races.length} 種</small></div><div class="grid c3">`;
    for (const x of races) {
      const c = hexRgb(x.color || RACE_COLORS[x.id] || '#ff7ad9');
      h += `<button class="card ${x.id === state.raceId ? 'sel' : ''}" style="--c:${c}" data-act="race" data-id="${esc(x.id)}">
        ${x.custom ? '<span class="badge">自訂</span>' : ''}
        <div class="card-glyph">${esc(x.name[0])}</div><div class="card-name">${esc(x.name)}</div><div class="card-en">${esc(x.en || '')}</div>
        <div class="chips">${asiChips(x)}</div></button>`;
    }
    h += `<button class="card" data-act="workshop" data-tab="race" style="--c:255,122,217;border-style:dashed"><div class="card-glyph">＋</div><div class="card-name">自訂種族</div><div class="card-en">HOMEBREW</div><div class="chips"><span class="chip custom">工坊</span></div></button>`;
    h += `</div><div class="detail"><h3>${esc(r.name)} <small class="muted" style="font-family:var(--display);font-size:12px;letter-spacing:2px">${esc(r.en || '')}</small></h3>
      ${r.blurb ? `<p class="blurb">「${esc(r.blurb)}」</p>` : ''}
      <div class="stat-row"><div class="stat"><b>${esc(r.size)}</b><span>體型</span></div><div class="stat"><b>${r.speed} 呎</b><span>速度</span></div><div class="stat"><b>${r.darkvision ? r.darkvision + ' 呎' : '—'}</b><span>黑暗視覺</span></div></div>
      <div class="chips" style="margin-bottom:8px">${asiChips(r)}${r.languages ? `<span class="chip">${esc(r.languages)}</span>` : ''}</div>
      <ul class="traits">${(r.traits || []).map((t) => `<li><b>${esc(t.name)}</b>${esc(t.desc)}</li>`).join('')}</ul>`;
    if (r.choice) {
      h += `<div class="sec">${esc(r.choice.label)}</div><div class="grid c2">`;
      for (const o of r.choice.options) {
        const on = state.raceChoice[r.choice.key] === o.id;
        h += `<button class="toggle ${on ? 'on' : ''}" data-act="raceChoice" data-key="${r.choice.key}" data-id="${o.id}" style="display:flex;align-items:center;gap:8px;text-align:left"><span class="swatch" style="background:${o.color};width:18px;height:18px;flex:none"></span><span><b>${o.name}</b> <small class="muted">${o.dmg} · ${o.area}</small></span></button>`;
      }
      h += `</div>`;
    }
    if (r.asiChoice) {
      h += `<div class="sec">屬性彈性 <span class="count ${state.raceAsi.length >= r.asiChoice.count ? 'full' : ''}">${state.raceAsi.length}/${r.asiChoice.count}</span></div><div class="grid c6">`;
      for (const a of ABILITIES) {
        const ex = r.asiChoice.exclude?.includes(a.id); const on = state.raceAsi.includes(a.id);
        h += `<button class="toggle ${on ? 'on' : ''}" ${ex ? 'disabled' : ''} data-act="raceAsi" data-id="${a.id}">${a.name}</button>`;
      }
      h += `</div>`;
    }
    if (r.skillChoice) {
      h += `<div class="sec">種族技能 <span class="count ${state.raceSkills.length >= r.skillChoice.count ? 'full' : ''}">${state.raceSkills.length}/${r.skillChoice.count}</span></div><div class="grid c3">`;
      for (const s of SKILLS) h += `<button class="toggle ${state.raceSkills.includes(s.id) ? 'on' : ''}" data-act="raceSkill" data-id="${s.id}">${s.name}</button>`;
      h += `</div>`;
    }
    if (r.bonusCantrip) h += `<div class="note">此種族可額外習得一道戲法，請在「法術」步驟中挑選。</div>`;
    h += `</div>`;
    return h;
  },

  class() {
    const d = derive(); const c = d.cls;
    let h = `<div class="level-ctl"><div class="level-num"><small>LEVEL</small>${state.level}</div>
      <button class="lv-btn" data-act="lv" data-d="-1">−</button>
      <div class="rng"><input type="range" min="1" max="20" value="${state.level}" data-input="level" /></div>
      <button class="lv-btn" data-act="lv" data-d="1">＋</button></div>`;
    h += `<div class="grid c3">`;
    for (const x of CLASSES) {
      h += `<button class="card ${x.id === state.classId ? 'sel' : ''}" style="--c:${hexRgb(x.color)}" data-act="class" data-id="${x.id}">
        <div class="card-glyph">${x.name[0]}</div><div class="card-name">${x.name}</div><div class="card-en">${x.en}</div>
        <div class="chips"><span class="chip">d${x.hd}</span>${x.caster ? '<span class="chip acc">施法</span>' : ''}</div></button>`;
    }
    h += `</div><div class="detail"><h3>${c.name} <small class="muted" style="font-family:var(--display);font-size:12px;letter-spacing:2px">${c.en}</small></h3>
      <p class="blurb">「${c.blurb}」</p>
      <div class="stat-row"><div class="stat"><b>d${c.hd}</b><span>生命骰</span></div><div class="stat"><b>${d.hp}</b><span>最大生命</span></div><div class="stat"><b>${c.primary.map(abName).join('/')}</b><span>主屬性</span></div></div>
      <ul class="traits">
        <li><b>豁免</b>${c.saves.map(abName).join('、')}</li>
        <li><b>護甲</b>${c.armor}</li><li><b>武器</b>${c.weapons}</li>
        <li><b>技能</b>${c.skillList === 'any' ? '任選' : c.skillList.map(skName).join('、')}（選 ${c.skillCount}）</li>
        <li><b>起始裝備</b>${c.gear}</li>
      </ul>
      <div class="sec">職業特性 <small>Lv.1–20</small></div><ul class="traits">`;
    const feats = [...c.features, [c.subclassLevel, `子職業：${c.subclass.name}`, c.subclass.desc]].sort((a, b) => a[0] - b[0]);
    for (const [lv, n, ds] of feats) h += `<li class="${lv > state.level ? 'locked' : ''}"><span class="lv">Lv${lv}</span><b>${n}</b>${ds}</li>`;
    h += `</ul></div>`;
    return h;
  },

  abilities() {
    const d = derive();
    const m = state.method;
    let h = radar(d.scores);
    h += `<div class="seg">${[['pointbuy', '購點制 27'], ['standard', '標準數組'], ['roll', '4d6 擲骰']].map(([k, n]) => `<button class="${m === k ? 'on' : ''}" data-act="method" data-id="${k}">${n}</button>`).join('')}</div>`;
    if (m === 'pointbuy') {
      const left = 27 - pointsSpent(state.base);
      h += `<div class="points-left ${left < 0 ? 'over' : ''}"><span>剩餘點數</span><b>${left}</b></div>`;
    } else {
      if (m === 'roll') {
        h += `<button class="big-btn" data-act="roll" style="margin-top:12px">🎲 擲骰 4d6 去最低 ×6</button>`;
        if (state.rollDetail) h += `<div class="dice-tray" id="diceTray">${state.rollDetail.map((ds) => diceSet(ds)).join('')}</div>`;
      }
      h += `<div class="sec" style="margin-top:14px">數值池 <small>點選數值，再點選屬性欄位</small></div><div class="pool">`;
      const used = Object.values(state.assign);
      state.pool.forEach((v, i) => { h += `<button class="pool-v ${used.includes(i) ? 'used' : ''} ${poolPick === i ? 'pick' : ''}" data-act="pick" data-i="${i}">${v}</button>`; });
      h += `</div>`;
    }
    h += `<div class="ab-rows">`;
    for (const a of ABILITIES) {
      const base = d.base[a.id]; const rb = d.racial[a.id]; const gb = state.growth[a.id] || 0;
      const primary = d.cls.primary.includes(a.id);
      let mid = '';
      if (m === 'pointbuy') {
        const canUp = base < 15 && 27 - pointsSpent(state.base) >= POINT_COST[base + 1] - POINT_COST[base];
        mid = `<button class="pm" data-act="pb" data-id="${a.id}" data-d="-1" ${base <= 8 ? 'disabled' : ''}>−</button><span class="basev">${base}</span><button class="pm" data-act="pb" data-id="${a.id}" data-d="1" ${canUp ? '' : 'disabled'}>＋</button>`;
      } else {
        const idx = state.assign[a.id];
        mid = `<button class="slot ${idx != null ? 'filled' : ''} ${poolPick != null ? 'target' : ''}" data-act="slot" data-id="${a.id}">${idx != null ? state.pool[idx] : '—'}</button>`;
      }
      if (rb) mid += `<span class="rb">+${rb}</span>`;
      if (gb) mid += `<span class="gb">+${gb}</span>`;
      h += `<div class="ab-row ${primary ? 'primary' : ''}"><div class="ab-name"><b>${a.name}</b><span>${a.en}</span></div><div class="ab-mid">${mid}</div>
        <div class="ab-total"><b>${d.scores[a.id]}</b><span>${fmt(d.mods[a.id])}</span></div></div>`;
    }
    h += `</div>`;
    if (d.asiTotal > 0) {
      h += `<div class="sec">屬性值提升 <small>ASI</small><span class="count ${d.asiUsed === d.asiTotal ? 'full' : ''}">${d.asiUsed}/${d.asiTotal}</span></div>
        <div class="note">依等級獲得的屬性值提升（每次 +2，可分配）。若想改選專長，可與 DM 討論後保留點數。</div><div class="grid c3">`;
      for (const a of ABILITIES) {
        const g = state.growth[a.id] || 0;
        h += `<div class="toggle" style="display:flex;align-items:center;justify-content:space-between"><span>${a.name}</span>
          <span><button class="pm lv-btn" style="width:24px;height:24px;font-size:14px" data-act="asi" data-id="${a.id}" data-d="-1">−</button>
          <b style="font-family:var(--num);margin:0 6px;color:#ff7ad9">+${g}</b>
          <button class="pm lv-btn" style="width:24px;height:24px;font-size:14px" data-act="asi" data-id="${a.id}" data-d="1">＋</button></span></div>`;
      }
      h += `</div>`;
    }
    h += `<div class="note">金色為種族加值，粉色為等級提升；屬性上限 20。標「主」者為職業主屬性。</div>`;
    return h;
  },

  background() {
    const d = derive(); const bg = d.bg;
    let h = `<div class="sec">出身</div><div class="grid c3">`;
    for (const b of BACKGROUNDS) {
      h += `<button class="card ${b.id === state.bgId ? 'sel' : ''}" data-act="bg" data-id="${b.id}" style="padding:10px"><div class="card-name">${b.name}</div><div class="card-en">${b.en}</div>
        <div class="chips">${b.skills.map((s) => `<span class="chip">${skName(s)}</span>`).join('')}</div></button>`;
    }
    h += `</div><div class="detail"><h3>${bg.name}</h3><ul class="traits">
      <li><b>技能熟練</b>${bg.custom ? '任選兩項' : bg.skills.map(skName).join('、')}</li>
      <li><b>背景特性</b>${bg.feature}</li>${bg.extra ? `<li><b>其他熟練</b>${bg.extra}</li>` : ''}</ul>`;
    if (bg.custom) {
      h += `<div class="sec">自選技能 <span class="count ${state.bgSkills.length === 2 ? 'full' : ''}">${state.bgSkills.length}/2</span></div><div class="grid c3">`;
      for (const s of SKILLS) h += `<button class="toggle ${state.bgSkills.includes(s.id) ? 'on' : ''}" data-act="bgSkill" data-id="${s.id}">${s.name}</button>`;
      h += `</div>`;
    }
    h += `</div><div class="sec">陣營</div><div class="grid c3">${ALIGNMENTS.map((a) => `<button class="toggle ${state.alignment === a ? 'on' : ''}" data-act="align" data-id="${a}">${a}</button>`).join('')}</div>`;
    h += `<div class="sec">角色扮演</div>`;
    for (const [k, n, ph] of [['personality', '性格特點', '我總是……'], ['ideal', '理想', '我相信……'], ['bond', '牽絆', '我願意為……付出一切'], ['flaw', '缺點', '我無法抗拒……'], ['backstory', '背景故事', '在那個雨夜……']]) {
      h += `<label class="field"><span>${n}</span><textarea data-input="trait" data-key="${k}" placeholder="${ph}" rows="${k === 'backstory' ? 4 : 2}">${esc(state.traits[k])}</textarea></label>`;
    }
    h += `<label class="field"><span>玩家名稱</span><input data-input="player" value="${esc(state.player)}" placeholder="你的名字" /></label>`;
    return h;
  },

  skills() {
    const d = derive(); const c = d.cls;
    const list = c.skillList === 'any' ? SKILLS.map((s) => s.id) : c.skillList;
    let h = `<div class="sec">職業技能 <span class="count ${state.skills.length === c.skillCount ? 'full' : ''}">${state.skills.length}/${c.skillCount}</span></div>
      <div class="note">金色菱形為背景／種族已提供的熟練；藍框為${c.name}可選技能。熟練加值 ${fmt(d.pb)}。</div><div class="skill-list">`;
    for (const s of d.skills) {
      const fromOther = s.src.some((x) => x !== '職業');
      const mine = state.skills.includes(s.id);
      const avail = list.includes(s.id) && !fromOther;
      const cls = fromOther ? 'locked' : mine ? 'prof' : '';
      h += `<button class="skill ${cls} ${avail && !mine ? 'avail' : ''}" ${avail ? '' : 'disabled'} data-act="skill" data-id="${s.id}">
        <span class="box"></span><span class="nm">${s.name}<small>${s.en}</small></span>
        <span class="src">${s.src.map((x) => `<span class="chip ${x === '職業' ? 'acc' : 'gold'}">${x}</span>`).join('')}<span class="chip">${abName(s.ab)}</span></span>
        <span class="bn">${fmt(s.bonus)}</span></button>`;
    }
    h += `</div><div class="sec">豁免檢定</div><div class="grid c3">`;
    for (const s of d.saves) h += `<div class="toggle ${s.prof ? 'on' : ''}" style="display:flex;justify-content:space-between"><span>${s.name}</span><b style="font-family:var(--num)">${fmt(s.bonus)}</b></div>`;
    h += `</div><div class="stat-row"><div class="stat"><b>${d.passive}</b><span>被動察覺</span></div><div class="stat"><b>${fmt(d.pb)}</b><span>熟練加值</span></div></div>`;
    return h;
  },

  spells() {
    const d = derive(); const m = d.magic; const r = d.race;
    if (!m && !r.bonusCantrip) {
      return `<div class="empty" style="padding-top:30px"><div style="font-size:46px;margin-bottom:10px">⚔</div>${d.cls.name}不使用法術。<br/><small class="muted">（若加入施法子職業或自訂規則，可與 DM 討論）</small></div>`;
    }
    const spells = allSpells();
    let h = '';
    if (m) {
      h += `<div class="magic-head"><div class="stat"><b>${m.dc}</b><span>法術豁免 DC</span></div><div class="stat"><b>${fmt(m.atk)}</b><span>法術攻擊</span></div><div class="stat"><b>${abName(m.ab)}</b><span>施法屬性</span></div></div>`;
      if (m.slots.length) {
        h += `<div class="slots-row">${m.slots.map((n, i) => (n ? `<div class="slot-lv">${i + 1}環 ${'<i class="gem"></i>'.repeat(n)}</div>` : '')).join('')}${m.type === 'pact' ? '<span class="chip acc">契約魔法：短休恢復</span>' : ''}</div>`;
      } else h += `<div class="note warn">${d.cls.name}在 2 級才開始施法。提升等級即可挑選法術。</div>`;
      if (m.prepared) h += `<div class="note">法師每日可從法術書中準備 ${m.prepared} 道法術。</div>`;
    }
    // 種族戲法
    if (r.bonusCantrip) {
      const pool = spells.filter((s) => s.level === 0 && s.classes.includes(r.bonusCantrip.list));
      h += `<div class="sec">種族戲法 <span class="count ${state.raceCantrips.length === r.bonusCantrip.count ? 'full' : ''}">${state.raceCantrips.length}/${r.bonusCantrip.count}</span></div>`;
      h += `<details ${state.raceCantrips.length ? '' : 'open'}><summary class="muted" style="cursor:pointer;font-size:12.5px;margin-bottom:6px">從${r.bonusCantrip.list === 'wizard' ? '法師' : r.bonusCantrip.list}戲法中挑選（點此展開）</summary>${pool.map((s) => spellCard(s, state.raceCantrips.includes(s.id), 'raceCantrip')).join('')}</details>`;
    }
    if (!m) return h;
    const tabs = [0, ...m.slots.map((_, i) => i + 1)];
    if (m.cantrips === 0 && tabs[0] === 0) tabs.shift();
    if (!tabs.includes(spellFilter.lv)) spellFilter.lv = tabs[0] ?? 0;
    h += `<div class="sec">${m.cantrips ? `戲法 <span class="count ${state.cantrips.length === m.cantrips ? 'full' : ''}" style="margin-left:0">${state.cantrips.length}/${m.cantrips}</span>` : ''}
      ${m.spells ? `<span style="margin-left:14px">${m.label}</span> <span class="count ${state.spells.length === m.spells ? 'full' : ''}" style="margin-left:0">${state.spells.length}/${m.spells}</span>` : ''}</div>`;
    h += `<div class="spell-filters">${tabs.map((l) => `<button class="toggle ${spellFilter.lv === l ? 'on' : ''}" data-act="sfLv" data-id="${l}">${l === 0 ? '戲法' : `${l} 環`}</button>`).join('')}</div>`;
    h += `<div style="display:flex;gap:6px;margin-bottom:8px"><input class="inp" placeholder="搜尋法術…" data-input="sq" value="${esc(spellFilter.q)}" style="flex:1" />
      <select class="inp" data-input="school" style="width:110px"><option value="">全部學派</option>${Object.entries(SCHOOLS).map(([k, v]) => `<option value="${k}" ${spellFilter.school === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></div>`;
    const q = spellFilter.q.trim().toLowerCase();
    const list = spells.filter((s) => s.level === spellFilter.lv && s.classes.includes(m.list) && (!spellFilter.school || s.school === spellFilter.school) && (!q || s.name.includes(q) || (s.en || '').toLowerCase().includes(q)));
    const chosen = spellFilter.lv === 0 ? state.cantrips : state.spells;
    // 已選的排在前面
    list.sort((a, b) => (chosen.includes(b.id) ? 1 : 0) - (chosen.includes(a.id) ? 1 : 0));
    h += `<div id="spellList">${list.map((s) => spellCard(s, chosen.includes(s.id), spellFilter.lv === 0 ? 'cantrip' : 'spell')).join('') || '<div class="empty">沒有符合的法術</div>'}</div>`;
    h += `<div class="note">想要團隊專屬的法術？到 <a href="#" data-act="workshop" data-tab="spell" style="color:var(--accent)">工坊</a> 自訂法術，指定職業後就會出現在這裡。</div>`;
    return h;
  },

  look() {
    const L = state.look; const tabs = [['base', '素體', 'BASE'], ['body', '體型', 'BODY'], ['face', '臉部', 'FACE'], ['hair', '髮型', 'HAIR'], ['traits', '特徵', 'TRAITS'], ['outfit', '服裝', 'GEAR'], ['aura', '光效', 'AURA']];
    let h = `<div class="look-tabs" style="grid-template-columns:repeat(7,1fr)">${tabs.map(([k, n, e]) => `<button class="look-tab ${lookTab === k ? 'on' : ''}" data-act="lookTab" data-id="${k}">${n}<small>${e}</small></button>`).join('')}</div>`;
    h += `<div class="look-actions"><button class="toggle" data-act="randomLook">🎲 隨機外觀</button><button class="toggle" data-act="resetLook">↺ 種族預設</button><button class="toggle" data-act="snap">📸 拍立繪</button></div>`;
    const P = LOOK_PANELS[lookTab];
    h += P(L);
    return h;
  },

  summary() {
    const d = derive(); const st = stepStatus();
    const missing = STEPS.filter((s) => !st[s.id] && s.id !== 'summary').map((s) => s.zh);
    let h = `<div class="sheet-hero"><div class="portrait" id="portrait"></div><div>
      <input class="inp sheet-name" data-input="name" value="${esc(state.name)}" placeholder="輸入角色名稱" style="font-size:20px;padding:6px 8px" />
      <div class="sheet-sub">Lv.${state.level} ${esc(d.race.name)}${d.race.choice && state.raceChoice[d.race.choice.key] ? `（${esc(d.race.choice.options.find((o) => o.id === state.raceChoice[d.race.choice.key])?.name || '')}）` : ''} · ${d.cls.name}${state.level >= d.cls.subclassLevel ? `（${d.cls.subclass.name}）` : ''}</div>
      <div class="sheet-sub">${d.bg.name} · ${state.alignment}</div>
      <div class="stat-row"><div class="stat"><b style="color:#ff6b7d">${d.hp}</b><span>生命</span></div><div class="stat"><b style="color:#9fd3ff">${d.ac}</b><span>護甲</span></div><div class="stat"><b>${d.speed}</b><span>速度</span></div></div>
      </div></div>`;
    if (missing.length) h += `<div class="note warn">尚未完成：${missing.join('、')}。仍可儲存，但建議補齊。</div>`;
    h += `<div class="sheet-abs">${ABILITIES.map((a) => `<div class="sab"><span>${a.name}</span><b>${fmt(d.mods[a.id])}</b><small>${d.scores[a.id]}</small></div>`).join('')}</div>`;
    h += `<dl class="kv">
      <dt>熟練加值</dt><dd>${fmt(d.pb)}　先攻 ${fmt(d.init)}　被動察覺 ${d.passive}</dd>
      <dt>豁免熟練</dt><dd>${d.saves.filter((s) => s.prof).map((s) => `${s.name} ${fmt(s.bonus)}`).join('、')}</dd>
      <dt>技能</dt><dd>${d.skills.filter((s) => s.prof).map((s) => `${s.name} ${fmt(s.bonus)}`).join('、') || '—'}</dd>
      <dt>護甲武器</dt><dd>${d.cls.armor}；${d.cls.weapons}</dd>
      <dt>裝備</dt><dd>${d.cls.gear}</dd>
      ${d.magic ? `<dt>施法</dt><dd>DC ${d.magic.dc}，攻擊 ${fmt(d.magic.atk)}${d.magic.slots.length ? `，法術位 ${d.magic.slots.map((n, i) => `${i + 1}環×${n}`).filter((x) => !x.endsWith('×0')).join(' ')}` : ''}</dd>` : ''}
      ${[...state.raceCantrips, ...state.cantrips].length ? `<dt>戲法</dt><dd>${[...state.raceCantrips, ...state.cantrips].map((id) => getSpell(id)?.name).filter(Boolean).join('、')}</dd>` : ''}
      ${state.spells.length ? `<dt>法術</dt><dd>${state.spells.map((id) => getSpell(id)).filter(Boolean).sort((a, b) => a.level - b.level).map((s) => `${s.name}<small class="muted">(${s.level})</small>`).join('、')}</dd>` : ''}
    </dl>`;
    h += `<div class="sec">種族與職業特性</div><ul class="traits">${(d.race.traits || []).map((t) => `<li><b>${esc(t.name)}</b>${esc(t.desc)}</li>`).join('')}${d.features.map(([lv, n, ds]) => `<li><span class="lv">Lv${lv}</span><b>${n}</b>${ds}</li>`).join('')}</ul>`;
    h += `<div class="sec">輸出</div>
      <button class="big-btn gold" data-act="forge">✦ 鍛造完成並存入角色庫 ✦</button>
      <button class="big-btn" data-act="card" style="margin-top:8px">🖼 產生角色卡 PNG（可貼到 Discord）</button>
      <div class="sheet-actions">
        <button class="toggle" data-act="dlPortrait">下載立繪 PNG</button>
        <button class="toggle" data-act="exportChar">匯出角色 JSON</button>
        <button class="toggle" data-act="shareChar">複製分享碼</button>
        <button class="toggle" data-act="print">列印角色卡</button>
      </div>`;
    return h;
  },
};

function radar(scores) {
  const cx = 115; const cy = 105; const R = 80;
  const pt = (i, r) => { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  let s = `<div class="radar-wrap"><svg class="radar" viewBox="0 0 230 210">`;
  for (const f of [0.25, 0.5, 0.75, 1]) s += `<polygon class="grid-poly" points="${ABILITIES.map((_, i) => pt(i, R * f).join(',')).join(' ')}"/>`;
  ABILITIES.forEach((_, i) => { const [x, y] = pt(i, R); s += `<line class="axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`; });
  s += `<polygon class="val" points="${ABILITIES.map((a, i) => pt(i, R * Math.max(0.08, (scores[a.id] - 3) / 17)).join(',')).join(' ')}"/>`;
  ABILITIES.forEach((a, i) => { const [x, y] = pt(i, R + 16); s += `<text x="${x}" y="${y - 3}" text-anchor="middle">${a.name}</text><text class="v" x="${x}" y="${y + 11}" text-anchor="middle">${scores[a.id]}</text>`; });
  return s + `</svg></div>`;
}

function diceSet(ds, rollingNow = false) {
  const sorted = [...ds].sort((a, b) => a - b); const drop = ds.indexOf(sorted[0]);
  return `<div class="dice-set">${ds.map((v, i) => `<span class="die ${rollingNow ? 'rolling' : i === drop ? 'drop' : ''}">${v}</span>`).join('')}<span class="sum">${rollingNow ? '?' : ds.reduce((a, b) => a + b, 0) - sorted[0]}</span></div>`;
}

function spellCard(s, on, kind) {
  const sc = s.custom ? (s.vfx || SCHOOLS[s.school]?.color || '#ff7ad9') : SCHOOLS[s.school]?.color || '#5ad1ff';
  return `<button class="spell ${on ? 'on' : ''}" style="--sc:${sc}" data-act="${kind}" data-id="${esc(s.id)}" data-color="${sc}">
    <span class="check"></span>
    <div class="row1"><span class="nm">${esc(s.name)}</span><span class="en">${esc(s.en || '')}</span></div>
    <div class="chips" style="margin-top:4px"><span class="chip" style="color:${sc};border-color:${sc}55">${SCHOOLS[s.school]?.name || s.school}</span>${s.conc ? '<span class="chip">專注</span>' : ''}${s.ritual ? '<span class="chip">儀式</span>' : ''}${s.custom ? '<span class="chip custom">自訂</span>' : ''}</div>
    <div class="desc">${esc(s.desc)}</div>
    <div class="props">${esc([s.time, s.range, s.comp, s.duration].filter(Boolean).join(' · '))}</div>
    <span class="cast" data-act="preview" data-color="${sc}">▶ 預覽</span>
  </button>`;
}

// ---------- 捏臉面板 ----------
const SKINS = ['#fbe3d3', '#f1d3b8', '#e8b996', '#d9a07a', '#b97e58', '#8d5a3b', '#5e3a26', '#7f9c6a', '#6a8fb5', '#b5475a', '#9b6bc9', '#c9c2d6', '#3a3346'];
const HAIRS = ['#120d0b', '#3b2a20', '#6b4423', '#a8672f', '#d9a441', '#f3e1a8', '#f5f5f5', '#9aa3b5', '#c0392b', '#ff7ad9', '#7b5cff', '#3fa7ff', '#2ee6a6', '#1b1f3a'];
const EYES = ['#4fa3ff', '#2ee6a6', '#7d5a3c', '#3b2a20', '#9b6bc9', '#ff4d6d', '#ffcc33', '#e8e8f0', '#ff8a3d', '#00d2ff'];
const CLOTH = ['#1b1f3a', '#2b3a67', '#22202e', '#5a1e2e', '#7a2a5a', '#2f5a34', '#3a4a2a', '#5a2a1e', '#c46a2b', '#e8e2d0', '#d8dde8', '#24183a', '#0e3b43'];
const ACCENTS = ['#c9a24a', '#e9c46a', '#b9c4d0', '#ff7ad9', '#a46bff', '#5ad1ff', '#7dff9a', '#ff6a3d', '#2b4aa0', '#3a2a22'];
const AURAS = ['#5ad1ff', '#ff4d3d', '#ff7ad9', '#ffe08a', '#7dff9a', '#9fb4ff', '#ffd166', '#9be36d', '#b388ff', '#ff6a3d', '#a46bff', '#00ffd5'];

const ORIG_KEYS = ['skin', 'hairColor', 'eyeColor', 'outfit1', 'outfit2'];
function swatches(key, list, label) {
  const cur = String(state.look[key]).toLowerCase();
  const orig = ORIG_KEYS.includes(key) ? `<button class="swatch orig ${cur === 'orig' ? 'on' : ''}" title="模型原色" data-act="lookSet" data-key="${key}" data-v="orig">原</button>` : '';
  const val = cur === 'orig' ? '#888888' : cur;
  return `<div class="sec">${label}</div><div class="swatches">${orig}${list.map((c) => `<button class="swatch ${cur === c ? 'on' : ''}" style="background:${c}" data-act="lookSet" data-key="${key}" data-v="${c}"></button>`).join('')}
    <label class="swatch custom-color ${list.includes(cur) || cur === 'orig' ? '' : 'on'}" title="自訂顏色"><input type="color" value="${val}" data-input="lookColor" data-key="${key}" /></label></div>`;
}
const isVRM = () => state.look.model !== 'chibi';
function modelGrid(key, label, allowSame) {
  const cur = state.look[key] || '';
  const items = allowSame ? [{ id: '', name: '與素體相同', tag: '' }, ...VRM_MODELS] : VRM_MODELS;
  return `<div class="sec">${label}</div><div class="model-grid">${items.map((m) => `<button class="model-card ${cur === m.id ? 'on' : ''}" data-act="lookSet" data-key="${key}" data-v="${m.id}">
    ${m.id ? `<img src="${modelThumb(m.id)}" alt="" loading="lazy" />` : '<div class="same">＝</div>'}<span>${m.name}</span></button>`).join('')}</div>`;
}
function slider(key, label, min, max, step, fmtFn = (v) => v) {
  const v = state.look[key];
  return `<div class="slider"><div class="top"><span>${label}</span><b data-out="${key}">${fmtFn(v)}</b></div><input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-input="lookRange" data-key="${key}" /></div>`;
}
function options(key, label, opts, cols = 4) {
  const cur = String(state.look[key]);
  return `<div class="sec">${label}</div><div class="opt-grid ${cols === 3 ? 'c3' : ''}">${opts.map(([v, n, icon]) => `<button class="opt ${cur === String(v) ? 'on' : ''}" data-act="lookSet" data-key="${key}" data-v="${v}">${icon ? `<svg viewBox="0 0 32 32">${icon}</svg>` : ''}${n}</button>`).join('')}</div>`;
}
function sw(key, label) { return `<button class="switch ${state.look[key] ? 'on' : ''}" data-act="lookToggle" data-key="${key}" style="width:100%"><span>${label}</span><i></i></button>`; }
const pct = (v) => `${Math.round(v * 100)}%`;
const I = {
  none: '<circle cx="16" cy="16" r="9"/><path d="M10 22 22 10"/>',
  short: '<path d="M7 18c0-8 4-11 9-11s9 3 9 11"/><path d="M9 14l3 3 2-4 3 4 2-4 3 4"/>',
  long: '<path d="M8 26V14c0-5 4-8 8-8s8 3 8 8v12"/><path d="M11 13l3 3 2-3 3 3"/>',
  ponytail: '<path d="M8 17c0-6 4-10 8-10s8 4 8 10"/><path d="M24 12c4 2 5 8 3 14"/>',
  twintails: '<path d="M9 16c0-6 3-9 7-9s7 3 7 9"/><path d="M8 12c-3 3-4 8-2 13M24 12c3 3 4 8 2 13"/>',
  bun: '<circle cx="16" cy="7" r="4"/><path d="M8 19c0-6 3-9 8-9s8 3 8 9"/>',
  spiky: '<path d="M7 19 6 9l5 4 2-8 3 7 3-7 2 8 5-4-1 10"/>',
  mohawk: '<path d="M16 4v18M13 6h6M13 10h6M13 14h6"/><path d="M8 22c0-3 2-6 8-6s8 3 8 6"/>',
  braids: '<path d="M9 16c0-6 3-9 7-9s7 3 7 9"/><circle cx="9" cy="20" r="2"/><circle cx="9" cy="24" r="2"/><circle cx="23" cy="20" r="2"/><circle cx="23" cy="24" r="2"/>',
};

const LOOK_PANELS = {
  base(L) {
    return options('model', '模型風格', [['vrm', '動漫 VRM'], ['chibi', 'Q 版積木']], 3)
      + (isVRM() ? modelGrid('vrmBody', '素體（臉型、體型與基礎服裝）', false) + `<div class="note">模型來自 VRoid Project 官方釋出的樣本（CC0／允許修改與再散布）。第一次選用時需下載約 2–4MB。</div>`
        : `<div class="note">Q 版積木模型完全由程式生成，載入最快，適合較舊的手機。</div>`);
  },
  body(L) {
    return slider('height', '身高', 0.55, 1.25, 0.01, pct) + slider('build', '體格（纖細 ↔ 壯碩）', 0, 1, 0.01, pct) + (isVRM() ? '' : slider('bodyType', '體型（陽剛 ↔ 柔美）', 0, 1, 0.01, pct)) + slider('headSize', '頭部比例', 0.85, 1.3, 0.01, pct)
      + swatches('skin', SKINS, '膚色');
  },
  face(L) {
    if (isVRM()) {
      return options('expression', '表情', [['neutral', '平靜'], ['happy', '開心'], ['relaxed', '從容'], ['angry', '生氣'], ['sad', '哀傷']], 3)
        + slider('eyeGlow', '眼睛發光', 0, 1, 0.01, pct) + swatches('eyeColor', EYES, '瞳色')
        + options('beard', '鬍鬚', [['none', '無'], ['short', '短鬚'], ['long', '長鬚'], ['braided', '矮人辮鬚']]);
    }
    return slider('eyeSize', '眼睛大小', 0.7, 1.45, 0.01, pct) + slider('brow', '眉型（溫和 ↔ 銳利）', 0, 1, 0.01, pct) + slider('eyeGlow', '眼睛發光', 0, 1, 0.01, pct)
      + swatches('eyeColor', EYES, '瞳色')
      + options('markings', '臉部紋樣', [['none', '無'], ['tribal', '部族紋'], ['runes', '發光符文']], 3)
      + options('beard', '鬍鬚', [['none', '無'], ['short', '短鬚'], ['long', '長鬚'], ['braided', '矮人辮鬚']]);
  },
  hair(L) {
    if (isVRM()) return modelGrid('vrmHair', '髮型（可借用其他模型的頭髮）', true) + swatches('hairColor', HAIRS, '髮色');
    return options('hairStyle', '髮型', [['none', '光頭', I.none], ['short', '短髮', I.short], ['spiky', '刺蝟頭', I.spiky], ['long', '長髮', I.long], ['ponytail', '馬尾', I.ponytail], ['twintails', '雙馬尾', I.twintails], ['bun', '盤髮', I.bun], ['braids', '雙辮', I.braids], ['mohawk', '莫霍克', I.mohawk]])
      + swatches('hairColor', HAIRS, '髮色');
  },
  traits(L) {
    return options('earType', '耳朵', [['human', '人類'], ['elf', '尖耳'], ['cat', '貓耳'], ['fox', '狐耳'], ['bunny', '兔耳'], ['none', '無']], 3)
      + slider('ears', '耳朵長度', 0, 1, 0.01, pct)
      + options('hornStyle', '角', [['none', '無'], ['ram', '羊角'], ['swept', '後掠角'], ['demon', '惡魔角'], ['straight', '直角']], 3)
      + swatches('hornColor', ['#2a2024', '#4a3a30', '#e8dcc0', '#8a2a2a', '#3a2a5a', '#c9a24a', '#e6eef5'], '角與翼骨顏色')
      + options('tail', '尾巴', [['none', '無'], ['devil', '惡魔尾'], ['dragon', '龍尾'], ['cat', '貓尾'], ['fox', '狐尾']], 3)
      + options('wings', '翅膀', [['none', '無'], ['feather', '羽翼'], ['bat', '蝠翼']], 3)
      + `<div class="sec">其他</div>` + sw('tusks', '獠牙') + (isVRM() ? '' : sw('snout', '龍吻（龍裔頭型）'));
  },
  outfit(L) {
    return swatches('outfit1', CLOTH, '主色') + swatches('outfit2', ACCENTS, '飾色')
      + options('headwear', '頭飾', [['auto', '依職業'], ['none', '無'], ['hood', '兜帽'], ['wizardHat', '巫師帽'], ['circlet', '頭環'], ['helmet', '頭盔']], 3)
      + `<div class="sec">配件</div>` + sw('showWeapon', '顯示武器 / 法器') + sw('cape', '披風');
  },
  aura(L) {
    return swatches('aura', AURAS, '靈光色（介面與魔法陣同步變色）')
      + `<div class="note">靈光色會同步改變整個介面主題、魔法陣、武器附魔與發光紋樣。</div>`
      + `<button class="big-btn" data-act="pose">✦ 擺個姿勢</button>`;
  },
};

// ---------- 種族 / 職業外觀套用 ----------
const CLASS_PALETTE = {
  barbarian: ['#5a2a1e', '#c9a24a'], bard: ['#7a2a5a', '#e9c46a'], cleric: ['#d6ccb0', '#c9a24a'], druid: ['#2f5a34', '#9be36d'],
  fighter: ['#2b3a67', '#c9a24a'], monk: ['#c46a2b', '#3a2a22'], paladin: ['#34467a', '#e9c46a'], ranger: ['#3a4a2a', '#8a6a3a'],
  rogue: ['#22202e', '#b388ff'], sorcerer: ['#5a1e2e', '#ff6a3d'], warlock: ['#24183a', '#a46bff'], wizard: ['#1b1f3a', '#e9c46a'],
};
function applyRaceLook(L, race, prevRace) {
  const rl = race.look || {};
  for (const k of ['height', 'skin', 'hornStyle', 'tail', 'tusks', 'snout', 'wings']) L[k] = rl[k] ?? DEFAULT_LOOK[k];
  L.build = rl.build ?? 0.5;
  L.ears = rl.ears ?? 0;
  L.earType = rl.earType ?? (rl.ears > 0 ? 'elf' : 'human');
  if (rl.eyeColor) L.eyeColor = rl.eyeColor; else if (prevRace?.look?.eyeColor === L.eyeColor) L.eyeColor = DEFAULT_LOOK.eyeColor;
  if (rl.beard) L.beard = rl.beard; else if (prevRace?.look?.beard === L.beard) L.beard = 'none';
  if (rl.hairStyle) L.hairStyle = rl.hairStyle; else if (prevRace?.look?.hairStyle === L.hairStyle) L.hairStyle = 'short';
  if (rl.hairColor) L.hairColor = rl.hairColor;
  L.hornColor = rl.hornColor ?? (prevRace?.look?.hornColor === L.hornColor ? DEFAULT_LOOK.hornColor : L.hornColor);
  if (race.choice && state.raceChoice[race.choice.key]) {
    const o = race.choice.options.find((x) => x.id === state.raceChoice[race.choice.key]); if (o?.color && race.id === 'dragonborn') L.skin = o.color;
  }
}

// ---------- 互動 ----------
const ACT = {
  race(el) {
    const id = el.dataset.id; if (id === state.raceId) return;
    const prev = getRace(state.raceId); const r = getRace(id);
    update((s) => {
      s.raceId = id; s.raceAsi = []; s.raceSkills = []; s.raceCantrips = []; s.raceChoice = {};
      if (r.choice) s.raceChoice[r.choice.key] = r.choice.options[0].id;
      applyRaceLook(s.look, r, prev);
    }, { look: true });
    sfx.forge(); stage.burst(r.color || RACE_COLORS[id] || state.look.aura, { count: 160 }); stage.play('flourish', 1.6);
  },
  raceChoice(el) {
    update((s) => { s.raceChoice[el.dataset.key] = el.dataset.id; const r = getRace(s.raceId); applyRaceLook(s.look, r, r); }, { look: true });
    const o = getRace(state.raceId).choice.options.find((x) => x.id === el.dataset.id);
    sfx.select(); stage.burst(o.color === '#2b2d3a' ? '#9b6bc9' : o.color, { count: 80, flash: 0.2 });
  },
  raceAsi(el) {
    const r = getRace(state.raceId); const id = el.dataset.id;
    update((s) => { if (s.raceAsi.includes(id)) s.raceAsi = s.raceAsi.filter((x) => x !== id); else if (s.raceAsi.length < r.asiChoice.count) s.raceAsi.push(id); else { s.raceAsi.shift(); s.raceAsi.push(id); } });
    sfx.click();
  },
  raceSkill(el) {
    const r = getRace(state.raceId); const id = el.dataset.id;
    update((s) => { if (s.raceSkills.includes(id)) s.raceSkills = s.raceSkills.filter((x) => x !== id); else if (s.raceSkills.length < r.skillChoice.count) s.raceSkills.push(id); else { s.raceSkills.shift(); s.raceSkills.push(id); } s.skills = s.skills.filter((x) => !s.raceSkills.includes(x)); });
    sfx.click();
  },
  class(el) {
    const id = el.dataset.id; if (id === state.classId) return;
    const c = getClass(id);
    update((s) => {
      s.classId = id; s.skills = []; s.cantrips = []; s.spells = [];
      s.look.aura = c.color; [s.look.outfit1, s.look.outfit2] = CLASS_PALETTE[id];
    }, { look: true });
    applyAccent(); sfx.forge(); stage.burst(c.color, { count: 160 }); setTimeout(() => stage.play(c.caster ? 'cast' : 'flourish', 1.5), 150);
    banner(c.en.toUpperCase(), c.name);
  },
  lv(el) { setLevel(state.level + Number(el.dataset.d)); },
  method(el) {
    const m = el.dataset.id; poolPick = null;
    update((s) => { s.method = m; s.assign = {}; if (m === 'standard') s.pool = [...STANDARD_ARRAY]; if (m === 'roll') { s.pool = []; s.rollDetail = null; } });
    sfx.click();
  },
  pb(el) {
    const id = el.dataset.id; const dlt = Number(el.dataset.d);
    update((s) => { s.base[id] = Math.max(8, Math.min(15, s.base[id] + dlt)); });
    sfx.click();
  },
  pick(el) { const i = Number(el.dataset.i); if (Object.values(state.assign).includes(i)) { const ab = Object.keys(state.assign).find((k) => state.assign[k] === i); update((s) => { delete s.assign[ab]; }); } poolPick = poolPick === i ? null : i; sfx.click(); renderPanel(); },
  slot(el) {
    const id = el.dataset.id;
    if (poolPick == null) { if (state.assign[id] != null) { update((s) => { delete s.assign[id]; }); sfx.click(); } return; }
    const i = poolPick; poolPick = null;
    update((s) => { for (const k of Object.keys(s.assign)) if (s.assign[k] === i) delete s.assign[k]; s.assign[id] = i; });
    sfx.select();
    // 自動選下一個未使用的數值
    const used = Object.values(state.assign); const nxt = state.pool.findIndex((_, j) => !used.includes(j));
    if (nxt >= 0 && Object.keys(state.assign).length < 6) { poolPick = nxt; renderPanel(); }
  },
  roll() {
    if (rolling) return; rolling = true; sfx.dice();
    const final = Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6)));
    let n = 0; const tray = document.createElement('div'); tray.className = 'dice-tray';
    const btn = $('[data-act=roll]'); btn.after(tray); $('#diceTray')?.remove();
    const iv = setInterval(() => {
      tray.innerHTML = final.map(() => diceSet(Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6)), true)).join('');
      if (++n % 3 === 0) sfx.dice();
      if (n > 12) {
        clearInterval(iv); rolling = false;
        const pool = final.map((ds) => ds.reduce((a, b) => a + b, 0) - Math.min(...ds));
        update((s) => { s.rollDetail = final; s.pool = pool; s.assign = {}; });
        poolPick = 0; renderPanel(); sfx.select();
        const tot = pool.reduce((a, b) => a + b, 0);
        toast(`擲骰總和 ${tot}${tot >= 80 ? '　——天選之人！' : tot <= 65 ? '　——命運多舛……' : ''}`);
        stage.burst(state.look.aura, { count: 70, ring: false, flash: 0.1 });
      }
    }, 70);
  },
  asi(el) {
    const id = el.dataset.id; const dlt = Number(el.dataset.d); const d = derive();
    if (dlt > 0 && (d.asiUsed >= d.asiTotal || d.scores[id] >= 20)) { sfx.error(); return; }
    update((s) => { s.growth[id] = Math.max(0, (s.growth[id] || 0) + dlt); }); sfx.click();
  },
  bg(el) { update((s) => { s.bgId = el.dataset.id; s.bgSkills = []; const bg = BACKGROUNDS.find((b) => b.id === s.bgId); s.skills = s.skills.filter((x) => !bg.skills.includes(x)); }); sfx.select(); },
  bgSkill(el) { const id = el.dataset.id; update((s) => { if (s.bgSkills.includes(id)) s.bgSkills = s.bgSkills.filter((x) => x !== id); else if (s.bgSkills.length < 2) s.bgSkills.push(id); s.skills = s.skills.filter((x) => !s.bgSkills.includes(x)); }); sfx.click(); },
  align(el) { update((s) => { s.alignment = el.dataset.id; }); sfx.click(); },
  skill(el) {
    const id = el.dataset.id; const c = getClass(state.classId);
    if (!state.skills.includes(id) && state.skills.length >= c.skillCount) { sfx.error(); toast(`最多選擇 ${c.skillCount} 項職業技能`); return; }
    update((s) => { s.skills = s.skills.includes(id) ? s.skills.filter((x) => x !== id) : [...s.skills, id]; }); sfx.click();
  },
  cantrip(el, ev) { toggleSpell('cantrips', el, ev, derive().magic.cantrips); },
  spell(el, ev) { toggleSpell('spells', el, ev, derive().magic.spells); },
  raceCantrip(el, ev) { toggleSpell('raceCantrips', el, ev, getRace(state.raceId).bonusCantrip.count); },
  preview(el, ev) { ev.stopPropagation(); stage.castSpell(el.dataset.color); sfx.cast(); },
  sfLv(el) { spellFilter.lv = Number(el.dataset.id); sfx.click(); renderPanel(); },
  lookTab(el) { lookTab = el.dataset.id; sfx.click(); stage.focus(lookCam()); renderPanel(); },
  lookSet(el) {
    const k = el.dataset.key; let v = el.dataset.v;
    if (typeof DEFAULT_LOOK[k] === 'number') v = Number(v);
    update((s) => { s.look[k] = v; }, { look: true });
    if (k === 'aura') { applyAccent(); stage.burst(v, { count: 60, flash: 0.15 }); }
    sfx.click();
  },
  lookToggle(el) { const k = el.dataset.key; update((s) => { s.look[k] = !s.look[k]; }, { look: true }); sfx.click(); },
  randomLook() {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    update((s) => {
      const L = s.look;
      if (L.model !== 'chibi') { L.vrmBody = pick(VRM_MODELS).id; L.vrmHair = Math.random() < 0.5 ? '' : pick(VRM_MODELS).id; L.expression = pick(['neutral', 'happy', 'relaxed', 'neutral']); }
      L.height = +(0.92 + Math.random() * 0.16).toFixed(2) * (getRace(s.raceId).look?.height ?? 1); L.build = Math.random(); L.bodyType = Math.random(); L.headSize = 0.92 + Math.random() * 0.2;
      L.eyeSize = 0.85 + Math.random() * 0.45; L.brow = Math.random(); L.eyeColor = Math.random() < 0.5 ? 'orig' : pick(EYES); L.hairColor = Math.random() < 0.5 ? 'orig' : pick(HAIRS);
      L.hairStyle = getRace(s.raceId).look?.snout ? 'none' : pick(['short', 'spiky', 'long', 'ponytail', 'twintails', 'bun', 'braids', 'mohawk']);
      L.outfit1 = pick(CLOTH); L.outfit2 = pick(ACCENTS); L.markings = pick(['none', 'none', 'tribal', 'runes']);
      if (!getRace(s.raceId).look?.skin) L.skin = Math.random() < 0.7 ? 'orig' : pick(SKINS);
    }, { look: true });
    sfx.forge(); stage.burst(state.look.aura, { count: 100 });
  },
  resetLook() { update((s) => { const r = getRace(s.raceId); Object.assign(s.look, { ...DEFAULT_LOOK, model: s.look.model, vrmBody: s.look.vrmBody, vrmHair: s.look.vrmHair, aura: s.look.aura, outfit1: s.look.outfit1, outfit2: s.look.outfit2 }); applyRaceLook(s.look, r, null); }, { look: true }); sfx.select(); },
  snap() { const url = stage.snapshot(); download(`${state.name || 'portrait'}.png`, url); sfx.select(); toast('立繪已下載'); },
  pose() { stage.play(['flourish', 'cheer', 'cast'][Math.floor(Math.random() * 3)], 1.6); stage.burst(state.look.aura, { count: 80, flash: 0.1 }); sfx.cast(); },
  forge() {
    sfx.forge(); stage.burst(state.look.aura, { count: 260, flash: 0.6 }); stage.play('cheer', 2);
    setTimeout(() => { const pic = stage.snapshot(270, 360, 'image/jpeg'); const id = roster.save(state, pic); if (id) { update((s) => { s.id = id; }, { silent: true }); toast('角色已存入角色庫'); } else toast('儲存失敗：瀏覽器儲存空間不足，請先匯出 JSON'); }, 900);
    banner('LEGEND FORGED', state.name || '無名冒險者');
  },
  dlPortrait() { ACT.snap(); },
  exportChar() { downloadJSON(`${state.name || 'character'}.dndforge.json`, { type: 'dndforge-character', version: 1, character: state, customRaces: neededCustom().races, customSpells: neededCustom().spells }); toast('已匯出 JSON'); },
  async shareChar() {
    const code = await encodeShare({ c: state, ...neededCustom() });
    const url = `${location.origin}${location.pathname}#c=${code}`;
    try { await navigator.clipboard.writeText(url); toast('分享連結已複製到剪貼簿'); } catch { prompt('複製以下連結', url); }
  },
  print() { buildPrintSheet(); setTimeout(() => print(), 100); },
  card() { openCardModal(); },
  workshop(el, ev) { ev?.preventDefault(); openWorkshop(el?.dataset?.tab || 'race'); },
};

function neededCustom() {
  const races = []; const spells = [];
  const r = getRace(state.raceId); if (r.custom) races.push(stripCustom(r));
  for (const id of [...state.cantrips, ...state.spells, ...state.raceCantrips]) { const s = getSpell(id); if (s?.custom) spells.push(stripCustom(s)); }
  return { races, spells };
}
const stripCustom = (o) => { const { custom: _c, ...rest } = o; return rest; };

function toggleSpell(key, el, ev, max) {
  if (ev.target.closest('[data-act=preview]')) return;
  const id = el.dataset.id;
  const has = state[key].includes(id);
  if (!has && state[key].length >= max) { sfx.error(); toast(max ? `已達上限 ${max} 道` : '目前等級無法習得'); return; }
  update((s) => { s[key] = has ? s[key].filter((x) => x !== id) : [...s[key], id]; });
  if (!has) { stage.castSpell(el.dataset.color); sfx.cast(); } else sfx.click();
}

function setLevel(lv) {
  lv = Math.max(1, Math.min(20, lv)); if (lv === state.level) return;
  const up = lv > state.level;
  update((s) => {
    s.level = lv;
    // 降級時修剪超出的選擇
    const d = derive(s);
    if (d.asiUsed > d.asiTotal) s.growth = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    if (d.magic) {
      s.cantrips = s.cantrips.slice(0, d.magic.cantrips); s.spells = s.spells.filter((id) => (getSpell(id)?.level || 0) <= d.magic.maxLv).slice(0, d.magic.spells);
    } else { s.cantrips = []; s.spells = []; }
  });
  if (up) { sfx.level(); stage.burst(state.look.aura, { count: 50, flash: 0.12, ring: true }); if (lv % 5 === 0 || lv === 20) banner('LEVEL UP', `等級 ${lv}`); }
  else sfx.click();
}

// 事件委派
const panel = $('#panelBody');
panel.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act]; if (fn) fn(el, ev);
});
panel.addEventListener('pointerover', (ev) => { const b = ev.target.closest('button:not(:disabled)'); if (b) sfx.hover(); if (b?.classList.contains('model-card') && b.dataset.v) preloadModel(b.dataset.v); });
panel.addEventListener('input', (ev) => {
  const el = ev.target; const k = el.dataset.input; if (!k) return;
  if (k === 'level') { setLevel(Number(el.value)); setRangeFill(el); return; }
  if (k === 'lookRange') {
    const key = el.dataset.key; const v = Number(el.value);
    update((s) => { s.look[key] = v; }, { silent: true, look: true });
    setRangeFill(el); const out = panel.querySelector(`[data-out="${key}"]`); if (out) out.textContent = key === 'height' || key === 'build' || key === 'bodyType' || key.includes('Size') || key === 'ears' || key === 'brow' || key === 'eyeGlow' || key === 'headSize' ? pct(v) : v;
    return;
  }
  if (k === 'lookColor') { const key = el.dataset.key; update((s) => { s.look[key] = el.value; }, { silent: true, look: true }); if (key === 'aura') applyAccent(); return; }
  if (k === 'trait') { update((s) => { s.traits[el.dataset.key] = el.value; }, { silent: true }); return; }
  if (k === 'player') { update((s) => { s.player = el.value; }, { silent: true }); return; }
  if (k === 'name') { update((s) => { s.name = el.value; }, { silent: true }); renderHUD(); renderNav(); return; }
  if (k === 'sq') { spellFilter.q = el.value; const pos = el.selectionStart; renderPanel(); const ni = panel.querySelector('[data-input=sq]'); ni.focus(); ni.setSelectionRange(pos, pos); return; }
  if (k === 'school') { spellFilter.school = el.value; renderPanel(); }
});
panel.addEventListener('change', (ev) => { if (ev.target.dataset.input === 'lookColor') renderPanel(); });

$('#steps').addEventListener('click', (ev) => { const b = ev.target.closest('[data-step]'); if (b) goStep(Number(b.dataset.step)); });
$('#steps').addEventListener('pointerover', (ev) => { if (ev.target.closest('[data-step]')) sfx.hover(); });
$('#prevBtn').onclick = () => goStep(stepIdx - 1);
$('#nextBtn').onclick = () => { if (stepIdx === STEPS.length - 1) ACT.forge(); else goStep(stepIdx + 1); };
$('#charName').addEventListener('input', (e) => { update((s) => { s.name = e.target.value; }, { silent: true }); renderHUD(); renderNav(); if (STEPS[stepIdx].id === 'summary') { const n = panel.querySelector('[data-input=name]'); if (n) n.value = e.target.value; } });
$('#camctl').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cam]'); if (!b) return; sfx.click();
  if (b.dataset.cam === 'pose') ACT.pose(); else stage.focus(b.dataset.cam);
});
document.querySelector('.top-actions').addEventListener('click', (e) => {
  const b = e.target.closest('[data-top]'); if (!b) return;
  const a = b.dataset.top;
  if (a === 'mute') { const m = sfx.toggle(); b.classList.toggle('muted', m); }
  if (a === 'workshop') { sfx.click(); openWorkshop('race'); }
  if (a === 'roster') { sfx.click(); openRoster(); }
  if (a === 'new') {
    if (!confirmInline(b, '再按一次以清空目前角色')) return;
    const keepLook = { ...DEFAULT_LOOK };
    replaceState({ ...newCharacter(), look: keepLook }); applyRaceLook(state.look, getRace(state.raceId), null);
    applyAccent(); goStep(0); stage.burst(state.look.aura, { count: 160, flash: 0.4 }); sfx.forge(); toast('開始鍛造新角色');
  }
});
$('#muteIcon').closest('button').classList.toggle('muted', sfx.muted);
addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select') || !$('#modal').hidden) return;
  if (e.key === 'ArrowRight') goStep(stepIdx + 1);
  if (e.key === 'ArrowLeft') goStep(stepIdx - 1);
});

function confirmInline(btn, msg) {
  if (btn.dataset.armed) { delete btn.dataset.armed; return true; }
  btn.dataset.armed = '1'; toast(msg); setTimeout(() => delete btn.dataset.armed, 2500); return false;
}

// ---------- 角色庫 ----------
export function openModal(html) {
  const m = $('#modal'); $('#modalBox').innerHTML = html; m.hidden = false;
  return $('#modalBox');
}
export function closeModal() { $('#modal').hidden = true; $('#modalBox').innerHTML = ''; }
$('#modal').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) { sfx.click(); closeModal(); } });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

function openRoster() {
  const list = roster.list();
  const box = openModal(`<div class="modal-head"><div><div class="en">ROSTER</div><h2>角色庫</h2></div>
    <button class="ghost-btn" data-r="import" style="margin-left:auto">匯入 JSON / 分享碼</button><button class="x" data-close>✕</button></div>
    <div class="modal-body">${list.length ? `<div class="roster-grid">${list.map((c) => `<div class="roster-card"><div class="pic" style="background-image:url(${c.portrait || ''})"></div>
      <div class="info"><b>${esc(c.name)}</b><small>Lv.${c.data.level} ${esc(getRace(c.data.raceId).name)} · ${esc(getClass(c.data.classId).name)}</small></div>
      <div class="acts"><button data-r="load" data-id="${c.id}">載入</button><button data-r="export" data-id="${c.id}">匯出</button><button data-r="del" data-id="${c.id}">刪除</button></div></div>`).join('')}</div>`
      : '<div class="empty">角色庫空空如也。<br/>在「完成」步驟按下「鍛造完成」即可存入。</div>'}
    <input type="file" accept=".json,application/json,.png,image/png" id="rosterFile" hidden /></div>`);
  box.onclick = async (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    const id = b.dataset.id; const entry = roster.list().find((x) => x.id === id);
    if (b.dataset.r === 'load') { loadCharacter(entry.data); closeModal(); toast(`已載入 ${entry.name}`); }
    if (b.dataset.r === 'export') downloadJSON(`${entry.name}.dndforge.json`, { type: 'dndforge-character', version: 1, character: entry.data });
    if (b.dataset.r === 'del') { if (!confirmInline(b, '再按一次確認刪除')) return; roster.remove(id); openRoster(); }
    if (b.dataset.r === 'import') {
      const code = prompt('貼上分享連結／分享碼；留空則選擇 JSON 或角色卡 PNG 檔案');
      if (code) { try { await importShare(code.includes('#c=') ? code.split('#c=')[1] : code); closeModal(); } catch { toast('分享碼無效'); } }
      else if (code === '') box.querySelector('#rosterFile').click();
    }
  };
  box.querySelector('#rosterFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (await importFile(f)) closeModal();
  };
}

import { custom, saveCustom } from './state.js';
function importCustoms(races = [], spells = []) {
  let n = 0;
  for (const r of races || []) if (!custom.races.some((x) => x.id === r.id)) { custom.races.push(r); n++; }
  for (const s of spells || []) if (!custom.spells.some((x) => x.id === s.id)) { custom.spells.push(s); n++; }
  if (n) { saveCustom(); toast(`同時匯入 ${n} 項自訂內容`); }
}
async function importShare(code) {
  const j = await decodeShare(code);
  importCustoms(j.races, j.spells);
  loadCharacter(j.c); toast(`已載入分享角色：${j.c.name || '無名冒險者'}`);
}
function loadCharacter(data) {
  replaceState(data); applyAccent(); goStep(STEPS.length - 1, { silent: true });
  stage.burst(state.look.aura, { count: 200, flash: 0.5 }); sfx.forge();
}

// ---------- 角色卡 PNG ----------
setCustomResolver(neededCustom);
async function openCardModal() {
  const box = openModal(`<div class="modal-head"><div><div class="en">CHARACTER CARD</div><h2>角色卡</h2></div><button class="x" data-close>✕</button></div>
    <div class="modal-body card-modal"><div class="card-preview"><div class="empty">鍛造角色卡中…</div></div>
    <div class="card-side">
      <p class="muted" style="font-size:13px;line-height:1.8;margin-top:0">圖上即是完整角色卡，丟到 Discord 就能直接看。圖片裡也藏有角色資料：把原始檔拖回龍鑄（或在角色庫匯入）即可還原角色。</p>
      <div class="note warn" style="font-size:12px">Discord 可能會重新壓縮預覽圖；要還原角色時，請用 Discord 的「開啟原始檔」下載的 PNG。</div>
      <div class="card-btns">
        <button class="big-btn gold" data-c="share" hidden>📤 分享（Discord 等 App）</button>
        <button class="big-btn" data-c="copy" hidden>📋 複製圖片（電腦版 Ctrl+V 貼上）</button>
        <button class="big-btn" data-c="download">⬇ 下載 PNG</button>
      </div>
    </div></div>`);
  sfx.forge(); stage.burst(state.look.aura, { count: 120, flash: 0.25 });
  let blob;
  try { blob = await renderCard(stage); } catch (e) { console.error(e); box.querySelector('.card-preview').innerHTML = '<div class="empty">產生失敗</div>'; return; }
  if (!box.isConnected) return;
  const url = URL.createObjectURL(blob);
  box.querySelector('.card-preview').innerHTML = `<img src="${url}" alt="角色卡" />`;
  const fname = `${(state.name || 'character').replace(/[\\/:*?"<>|]/g, '_')}.dndforge.png`;
  const file = new File([blob], fname, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) box.querySelector('[data-c=share]').hidden = false;
  if (window.ClipboardItem && navigator.clipboard?.write && matchMedia('(pointer: fine)').matches) box.querySelector('[data-c=copy]').hidden = false;
  box.querySelector('.card-btns').onclick = async (e) => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    if (b.dataset.c === 'download') { download(fname, url); toast('角色卡已下載'); }
    if (b.dataset.c === 'copy') { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast('已複製，到 Discord 按 Ctrl+V 貼上'); } catch { toast('瀏覽器不允許複製圖片，請改用下載'); } }
    if (b.dataset.c === 'share') { try { await navigator.share({ files: [file], title: state.name || '角色卡' }); } catch (err) { if (err.name !== 'AbortError') toast('分享失敗，請改用下載'); } }
  };
}

async function importFile(f) {
  try {
    if (f.type === 'image/png' || f.name.toLowerCase().endsWith('.png')) {
      const code = await extractFromPng(f);
      if (!code) { toast('這張圖片沒有龍鑄角色資料（可能被壓縮過，請用原始檔）'); return false; }
      await importShare(code); return true;
    }
    const j = JSON.parse(await f.text());
    if (j.type === 'dndforge-pack') { importCustoms(j.races, j.spells); return true; }
    importCustoms(j.customRaces, j.customSpells); loadCharacter(j.character || j); toast('已匯入角色'); return true;
  } catch { toast('檔案格式錯誤'); return false; }
}
// 拖放匯入
addEventListener('dragover', (e) => { if ([...e.dataTransfer.items].some((i) => i.kind === 'file')) { e.preventDefault(); document.body.classList.add('dropping'); } });
addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
addEventListener('drop', async (e) => {
  e.preventDefault(); document.body.classList.remove('dropping');
  const f = e.dataTransfer.files[0]; if (f && await importFile(f)) closeModal();
});

// ---------- 立繪 / 列印 ----------
let portraitTimer;
function updatePortrait() {
  clearTimeout(portraitTimer);
  portraitTimer = setTimeout(() => { const p = $('#portrait'); if (p) p.style.backgroundImage = `url(${stage.snapshot(300, 400, 'image/jpeg')})`; }, 1300);
}
function buildPrintSheet() {
  const d = derive(); let el = $('#printSheet');
  if (!el) { el = document.createElement('div'); el.id = 'printSheet'; $('#app').append(el); }
  const spells = [...state.raceCantrips, ...state.cantrips, ...state.spells].map(getSpell).filter(Boolean).sort((a, b) => a.level - b.level);
  el.innerHTML = `<div class="ps-top"><img src="${stage.snapshot(420, 560)}" /><div style="flex:1"><h1>${esc(state.name || '無名冒險者')}</h1>
    <div>Lv.${state.level} ${esc(d.race.name)} ${d.cls.name}${state.level >= d.cls.subclassLevel ? `（${d.cls.subclass.name}）` : ''}　${d.bg.name}　${state.alignment}　玩家：${esc(state.player)}</div>
    <div class="ps-grid">${ABILITIES.map((a) => `<div class="ps-box">${a.name}<b>${fmt(d.mods[a.id])}</b>${d.scores[a.id]}</div>`).join('')}</div>
    <div class="ps-grid">${[['生命', d.hp], ['護甲', d.ac], ['先攻', fmt(d.init)], ['速度', d.speed], ['熟練', fmt(d.pb)], ['被動察覺', d.passive]].map(([n, v]) => `<div class="ps-box">${n}<b>${v}</b></div>`).join('')}</div></div></div>
    <div class="ps-cols"><div>
      <h3>豁免</h3><table>${d.saves.map((s) => `<tr><td>${s.prof ? '●' : '○'} ${s.name}</td><td>${fmt(s.bonus)}</td></tr>`).join('')}</table>
      <h3>技能</h3><table>${d.skills.map((s) => `<tr><td>${s.prof ? '●' : '○'} ${s.name}（${abName(s.ab)}）</td><td>${fmt(s.bonus)}</td></tr>`).join('')}</table>
      <h3>熟練與裝備</h3><div>護甲：${d.cls.armor}<br/>武器：${d.cls.weapons}<br/>裝備：${d.cls.gear}<br/>語言：${esc(d.race.languages || '')}</div>
    </div><div>
      <h3>特性</h3>${(d.race.traits || []).map((t) => `<div><b>${esc(t.name)}</b>：${esc(t.desc)}</div>`).join('')}${d.features.map(([lv, n, ds]) => `<div><b>${n}</b>（${lv}）：${ds}</div>`).join('')}<div><b>${d.bg.name}</b>：${d.bg.feature}</div>
      ${d.magic ? `<h3>施法（DC ${d.magic.dc}／攻擊 ${fmt(d.magic.atk)}）</h3><div>法術位：${d.magic.slots.map((n, i) => (n ? `${i + 1}環×${n}` : '')).join(' ')}</div>` : ''}
      ${spells.length ? `<table>${spells.map((s) => `<tr><td>${s.level || '戲'}</td><td><b>${esc(s.name)}</b> ${esc(s.time || '')}・${esc(s.range || '')}</td></tr>`).join('')}</table>` : ''}
      <h3>角色扮演</h3><div>性格：${esc(state.traits.personality)}<br/>理想：${esc(state.traits.ideal)}<br/>牽絆：${esc(state.traits.bond)}<br/>缺點：${esc(state.traits.flaw)}<br/>${esc(state.traits.backstory)}</div>
    </div></div>`;
}

// ---------- 狀態監聽 ----------
on('change', () => { renderPanel(); renderNav(); renderHUD(); });
on('look', refreshAvatar);
on('custom', () => { renderPanel(); });

// ---------- 開場 ----------
function start() {
  sfx.unlock(); sfx.forge();
  $('#intro').classList.add('out');
  stage.burst(state.look.aura, { count: 220, flash: 0.7 });
  setTimeout(() => { stage.focus(STEPS[stepIdx].cam); stage.play('flourish', 1.8); }, 150);
  setTimeout(() => $('#intro').remove(), 1300);
}
$('#startBtn').onclick = start;

// 初始化
applyAccent();
refreshAvatar();
renderNav(); renderPanel(); renderHUD(); updateShift();
// 分享連結
if (location.hash.startsWith('#c=')) {
  importShare(location.hash.slice(3)).catch(() => toast('分享連結無效')).finally(() => history.replaceState(null, '', location.pathname));
}
export { renderPanel, applyRaceLook, loadCharacter };
