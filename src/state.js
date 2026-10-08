import { ABILITIES, SKILLS, RACES, CLASSES, BACKGROUNDS, POINT_COST, STANDARD_ARRAY, ASI_LEVELS, spellSlots } from './data/rules.js';
import { SPELLS } from './data/spells.js';

const DRAFT_KEY = 'dndforge.draft.v1';
const CUSTOM_KEY = 'dndforge.custom.v1';
const ROSTER_KEY = 'dndforge.roster.v1';

const safeGet = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; /* 無痕模式或空間不足 */ } };

// ---------- 自訂內容（種族 / 法術） ----------
export const custom = safeGet(CUSTOM_KEY, { races: [], spells: [] });
export function saveCustom() { safeSet(CUSTOM_KEY, custom); emit('custom'); }

export const allRaces = () => [...RACES, ...custom.races.map((r) => ({ ...r, custom: true }))];
export const allSpells = () => [...SPELLS, ...custom.spells.map((s) => ({ ...s, custom: true }))];
export const getRace = (id) => allRaces().find((r) => r.id === id) || RACES[0];
export const getClass = (id) => CLASSES.find((c) => c.id === id) || CLASSES[0];
export const getBg = (id) => BACKGROUNDS.find((b) => b.id === id) || BACKGROUNDS[0];
export const getSpell = (id) => allSpells().find((s) => s.id === id);

// ---------- 外觀預設 ----------
export const DEFAULT_LOOK = {
  bodyType: 0.35, height: 1, build: 0.5, headSize: 1,
  model: 'vrm', vrmBody: 'shino', vrmHair: '', expression: 'neutral',
  skin: 'orig', eyeColor: 'orig', eyeSize: 1, eyeGlow: 0, brow: 0.5,
  hairStyle: 'short', hairColor: 'orig', beard: 'none',
  earType: 'human', ears: 0, hornStyle: 'none', hornColor: '#2a2024',
  tail: 'none', wings: 'none', tusks: false, snout: false,
  markings: 'none', headwear: 'auto',
  outfit1: '#2b3a67', outfit2: '#c9a24a', aura: '#5ad1ff', showWeapon: true, cape: true,
};

export function newCharacter() {
  return {
    name: '', player: '', level: 1, alignment: '中立善良',
    raceId: 'human', raceChoice: {}, raceAsi: [], raceSkills: [],
    classId: 'fighter', bgId: 'soldier', bgSkills: [],
    method: 'pointbuy',
    base: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
    pool: [...STANDARD_ARRAY], assign: {}, growth: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    skills: [], cantrips: [], spells: [], raceCantrips: [],
    traits: { personality: '', ideal: '', bond: '', flaw: '', backstory: '' },
    look: { ...DEFAULT_LOOK },
  };
}

export let state = Object.assign(newCharacter(), safeGet(DRAFT_KEY, {}));
state.look = { ...DEFAULT_LOOK, ...state.look };

// ---------- 事件 ----------
const listeners = {};
export function on(ev, fn) { (listeners[ev] ||= []).push(fn); }
export function emit(ev, data) { (listeners[ev] || []).forEach((f) => f(data)); }

let saveTimer;
export function update(fn, opts = {}) {
  fn(state);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => safeSet(DRAFT_KEY, state), 250);
  if (!opts.silent) emit('change', opts);
  if (opts.look) emit('look');
}
if (typeof addEventListener === 'function') addEventListener('pagehide', () => safeSet(DRAFT_KEY, state));
export function replaceState(s) {
  state = Object.assign(newCharacter(), structuredClone(s));
  state.look = { ...DEFAULT_LOOK, ...state.look };
  safeSet(DRAFT_KEY, state);
  emit('change', { full: true }); emit('look');
}

// ---------- 規則推導 ----------
export const mod = (score) => Math.floor((score - 10) / 2);
export const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
export const profBonus = (lv) => 2 + Math.floor((lv - 1) / 4);

export function pointsSpent(base) {
  return ABILITIES.reduce((sum, a) => sum + (POINT_COST[base[a.id]] ?? 99), 0);
}

export function baseScores(s = state) {
  if (s.method === 'pointbuy') return { ...s.base };
  const out = {};
  for (const a of ABILITIES) {
    const idx = s.assign[a.id];
    out[a.id] = idx != null && s.pool[idx] != null ? s.pool[idx] : 8;
  }
  return out;
}

export function racialBonus(s = state) {
  const race = getRace(s.raceId);
  const out = Object.fromEntries(ABILITIES.map((a) => [a.id, race.asi?.[a.id] || 0]));
  if (race.asiChoice) for (const ab of s.raceAsi.slice(0, race.asiChoice.count)) out[ab] += race.asiChoice.amount;
  return out;
}

export function asiPointsTotal(s = state) {
  const cls = getClass(s.classId);
  const lvls = [...ASI_LEVELS, ...(cls.asiExtra || [])];
  return lvls.filter((l) => l <= s.level).length * 2;
}

export function derive(s = state) {
  const race = getRace(s.raceId);
  const cls = getClass(s.classId);
  const bg = getBg(s.bgId);
  const base = baseScores(s);
  const racial = racialBonus(s);
  const scores = {}; const mods = {};
  for (const a of ABILITIES) {
    scores[a.id] = Math.min(20, base[a.id] + racial[a.id] + (s.growth[a.id] || 0));
    mods[a.id] = mod(scores[a.id]);
  }
  const pb = profBonus(s.level);

  // 技能來源
  const skillSrc = {};
  const add = (id, src) => { if (id) (skillSrc[id] ||= []).push(src); };
  (bg.custom ? s.bgSkills : bg.skills).forEach((id) => add(id, '背景'));
  (race.skills || []).forEach((id) => add(id, '種族'));
  if (race.skillChoice) s.raceSkills.slice(0, race.skillChoice.count).forEach((id) => add(id, '種族'));
  s.skills.forEach((id) => add(id, '職業'));
  const skills = SKILLS.map((sk) => ({ ...sk, prof: !!skillSrc[sk.id], src: skillSrc[sk.id] || [], bonus: mods[sk.ab] + (skillSrc[sk.id] ? pb : 0) }));

  const saves = ABILITIES.map((a) => ({ ...a, prof: cls.saves.includes(a.id), bonus: mods[a.id] + (cls.saves.includes(a.id) ? pb : 0) }));

  // HP
  const conM = mods.con;
  let hp = cls.hd + conM + (s.level - 1) * (cls.hd / 2 + 1 + conM);
  hp += (race.hpPerLevel || 0) * s.level;
  hp = Math.max(s.level, hp);

  // AC
  let ac; const a = cls.ac;
  if (a.kind === 'unarmored') ac = 10 + mods.dex + mods[a.bonus];
  else ac = a.base + Math.min(mods.dex, a.dex) + (a.shield ? 2 : 0);

  let speed = race.speed;
  if (cls.id === 'monk' && s.level >= 2) speed += s.level >= 18 ? 30 : s.level >= 14 ? 25 : s.level >= 10 ? 20 : s.level >= 6 ? 15 : 10;
  if (cls.id === 'barbarian' && s.level >= 5) speed += 10;

  // 施法
  let magic = null;
  const c = cls.caster;
  if (c) {
    const abM = mods[c.ab];
    const slots = spellSlots(c, s.level);
    const maxLv = slots.length;
    const cantrips = c.cantrips ? c.cantrips[s.level - 1] : 0;
    let spells = 0; let label = '已知法術';
    if (c.known) spells = c.known[s.level - 1];
    else if (c.preparedTable) { spells = c.preparedTable[s.level - 1]; label = '準備法術'; }
    else if (c.spellbook) { spells = 6 + 2 * (s.level - 1); label = '法術書'; }
    else if (c.prepared === 'full') { spells = Math.max(1, abM + s.level); label = '準備法術'; }
    else if (c.prepared === 'half') { spells = s.level < 2 ? 0 : Math.max(1, abM + Math.floor(s.level / 2)); label = '準備法術'; }
    else if (c.prepared === 'artificer') { spells = Math.max(1, abM + Math.floor(s.level / 2)); label = '準備法術'; }
    magic = { ab: c.ab, list: c.list, type: c.type, slots, maxLv, cantrips, spells, label, dc: 8 + pb + abM, atk: pb + abM,
      prepared: c.spellbook ? Math.max(1, abM + s.level) : null };
  }

  const features = cls.features.filter(([lv]) => lv <= s.level);
  if (s.level >= cls.subclassLevel) features.push([cls.subclassLevel, cls.subclass.name, cls.subclass.desc]);
  features.sort((x, y) => x[0] - y[0]);

  const perception = skills.find((x) => x.id === 'perception');
  return {
    race, cls, bg, base, racial, scores, mods, pb, skills, saves, hp, ac, speed,
    init: mods.dex, passive: 10 + perception.bonus, magic, features,
    asiTotal: asiPointsTotal(s), asiUsed: ABILITIES.reduce((t, x) => t + (s.growth[x.id] || 0), 0),
  };
}

// 驗證：每個步驟是否完成
export function stepStatus(s = state) {
  const d = derive(s);
  const out = {};
  out.race = !d.race.asiChoice || s.raceAsi.length >= d.race.asiChoice.count;
  if (d.race.skillChoice) out.race &&= s.raceSkills.length >= d.race.skillChoice.count;
  out.class = true;
  if (s.method === 'pointbuy') out.abilities = pointsSpent(s.base) === 27;
  else out.abilities = ABILITIES.every((a) => s.assign[a.id] != null);
  out.abilities &&= d.asiUsed === d.asiTotal;
  out.background = !d.bg.custom || s.bgSkills.length === 2;
  out.skills = s.skills.length === d.cls.skillCount;
  const m = d.magic;
  const needRaceCantrip = d.race.bonusCantrip ? d.race.bonusCantrip.count : 0;
  out.spells = (!m || (s.cantrips.length === m.cantrips && s.spells.length === m.spells)) && s.raceCantrips.length === needRaceCantrip;
  out.look = true;
  out.summary = !!s.name;
  return out;
}

// ---------- 角色庫 ----------
export const roster = {
  list: () => safeGet(ROSTER_KEY, []),
  save(char, portrait) {
    const list = roster.list();
    const id = char.id || `c${Date.now()}`;
    char.id = id;
    const entry = { id, name: char.name || '無名冒險者', at: Date.now(), portrait, data: structuredClone(char) };
    const i = list.findIndex((x) => x.id === id);
    if (i >= 0) list[i] = entry; else list.unshift(entry);
    return safeSet(ROSTER_KEY, list) ? id : null;
  },
  remove(id) { safeSet(ROSTER_KEY, roster.list().filter((x) => x.id !== id)); },
};

// ---------- 分享碼（壓縮 + base64url） ----------
export async function encodeShare(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const buf = new Uint8Array(await new Response(cs).arrayBuffer());
  let bin = ''; buf.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function decodeShare(code) {
  const b64 = code.trim().replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(ds).text());
}

export { ABILITIES, SKILLS, CLASSES, BACKGROUNDS, POINT_COST, STANDARD_ARRAY };
