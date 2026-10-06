// 把 5etools 格式的 races.json 轉成龍鑄的內容包（團內私用，不要放進公開 repo）
// 用法：node tools/import-5etools-races.mjs <races.json> <輸出 pack.json>
import fs from 'node:fs';

const [, , inPath, outPath] = process.argv;
const all = JSON.parse(fs.readFileSync(inPath, 'utf8')).race;

// 核心 SRD 已內建的項目，略過
const BUILTIN = new Set(['Human|PHB|', 'Elf|PHB|High', 'Dwarf|PHB|Hill', 'Halfling|PHB|Lightfoot', 'Dragonborn|PHB|', 'Gnome|PHB|Rock', 'Half-Elf|PHB|', 'Half-Orc|PHB|', 'Tiefling|PHB|']);
const isUA = (src) => /^UA/.test(src || '');
const hasCJK = (s) => /[一-鿿]/.test(s || '');
const SKILL = { 'animal handling': 'animal', 'sleight of hand': 'sleight' };
const SKILLS = ['acrobatics', 'animal', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight', 'stealth', 'survival'];
const LANG = { common: '通用語', elvish: '精靈語', dwarvish: '矮人語', giant: '巨人語', gnomish: '侏儒語', goblin: '地精語', halfling: '半身人語', orc: '獸人語', abyssal: '深淵語', celestial: '天界語', draconic: '龍語', infernal: '煉獄語', primordial: '原初語', sylvan: '木族語', undercommon: '地底通用語', aquan: '水族語', auran: '風族語' };
const SKIP_TRAITS = new Set(['Age', 'Alignment', 'Size', 'Languages', 'Speed', 'Creature Type']);

// 原站沒翻譯的名稱：補上中文（只翻名稱，特性說明維持原文）
const NAME_ZH = {
  Aetherborn: '以太生族', Aven: '艾文', Changeling: '變形者', 'Dwarf (Kaladesh)': '矮人（卡拉德許）', 'Goblin (Ixalan)': '地精（依夏蘭）',
  'Goblin (Zendikar)': '地精（贊迪卡）', 'Human (Ixalan)': '人類（依夏蘭）', 'Human (Zendikar)': '人類（贊迪卡）', Kalashtar: '卡拉什塔爾', Kor: '寇族',
  Leonin: '獅族', Locathah: '洛卡薩魚人', 'Merfolk (Ixalan)': '人魚（依夏蘭）', 'Merfolk (Zendikar)': '人魚（贊迪卡）', 'Orc (Ixalan)': '獸人（依夏蘭）',
  Satyr: '薩提爾', Shifter: '獸化人', 'Vampire (Ixalan)': '吸血鬼（依夏蘭）', 'Vampire (Zendikar)': '吸血鬼（贊迪卡）', Verdan: '維丹', Warforged: '機關人',
  'Grotag Tribe': '格羅塔部族', 'Lavastep Tribe': '熔步部族', 'Tuktuk Tribe': '圖圖部族', Blue: '藍', Green: '綠', 'Cosi Creed': '科西信條', 'Emeria Creed': '艾梅莉亞信條', 'Ula Creed': '烏拉信條',
  Beasthide: '獸皮', Longtooth: '長牙', Swiftstride: '迅步', Wildhunt: '狂獵', 'Hawk-Headed': '鷹首', 'Ibis-Headed': '朱鷺首',
  'Bishatar and Tirahar': '比沙塔與提拉哈', Vadahar: '瓦達哈', 'Joraga Nation': '約拉加族', 'Mul Daya Nation': '穆戴亞族', 'Tajuru Nation': '塔居魯族',
  Gavony: '加沃尼', Kessig: '凱斯格', Nephalia: '涅法利亞', Stensia: '斯坦西亞',
};
const zh = (n) => NAME_ZH[n] || n;
const byKey = new Map(all.map((r) => [`${r.name}|${r.source}`, r]));
const byEng = new Map(all.map((r) => [`${r.ENG_name || r.name}|${r.source}`, r]));

// 去掉 5etools 標記：{@spell 火焰箭|PHB} → 火焰箭
const clean = (s) => String(s).replace(/\{@\w+ ([^}|]*)(\|[^}]*)?\}/g, '$1').replace(/\s+/g, ' ').trim();
function flat(e) {
  if (e == null) return '';
  if (typeof e === 'string') return clean(e);
  if (Array.isArray(e)) return e.map(flat).filter(Boolean).join(' ');
  if (e.type === 'list') return (e.items || []).map((i) => `・${flat(i.entries || i.entry || i)}`).join(' ');
  if (e.type === 'table') return (e.rows || []).map((r) => r.map(flat).join('：')).join('；');
  if (e.entries) return (e.name ? `${clean(e.name)}：` : '') + flat(e.entries);
  if (e.entry) return flat(e.entry);
  return '';
}

function resolveCopy(r) {
  if (!r._copy) return r;
  const base = byKey.get(`${r._copy.name}|${r._copy.source}`) || byEng.get(`${r._copy.name}|${r._copy.source}`);
  if (!base) return r;
  const merged = { ...resolveCopy(base), ...r };
  const mods = r._copy._mod?.entries; let entries = [...(merged.entries || [])];
  for (const m of [].concat(mods || [])) {
    if (m.mode === 'replaceArr') { const i = entries.findIndex((x) => x.name === m.replace); const items = [].concat(m.items); if (i >= 0) entries.splice(i, 1, ...items); }
    if (m.mode === 'appendArr') entries.push(...[].concat(m.items));
  }
  merged.entries = entries; delete merged._copy;
  return merged;
}

function mergeSub(base, sr) {
  const r = { ...base };
  for (const k of ['speed', 'darkvision', 'size', 'skillProficiencies', 'languageProficiencies', 'resist']) if (sr[k] != null) r[k] = sr[k];
  if (sr.ability) {
    if (sr.overwrite?.ability || !base.ability) r.ability = sr.ability;
    else { const a = { ...(base.ability?.[0] || {}) }; for (const [k, v] of Object.entries(sr.ability[0] || {})) a[k] = k === 'choose' ? v : (a[k] || 0) + v; r.ability = [a]; }
  }
  let entries = [...(base.entries || [])];
  for (const e of sr.entries || []) {
    const ow = e.data?.overwrite;
    const i = ow ? entries.findIndex((x) => x.name === ow) : -1;
    if (i >= 0) entries[i] = e; else entries.push(e);
  }
  r.entries = entries;
  return r;
}

const SIZE = { T: '微型', S: '小型', M: '中型', L: '大型' };
function speedOf(sp) {
  if (typeof sp === 'number') return { walk: sp, extra: '' };
  if (!sp) return { walk: 30, extra: '' };
  const walk = typeof sp.walk === 'number' ? sp.walk : 30;
  const extra = [['fly', '飛行'], ['swim', '游泳'], ['climb', '攀爬'], ['burrow', '掘穴']].filter(([k]) => sp[k]).map(([k, n]) => `${n} ${sp[k] === true ? walk : typeof sp[k] === 'object' ? sp[k].number : sp[k]} 呎`).join('、');
  return { walk, extra };
}

// 依種族名稱猜一個 3D 外觀預設
function lookFor(en) {
  const n = (en || '').toLowerCase();
  const L = {};
  const has = (...ks) => ks.some((k) => n.includes(k));
  if (has('elf', 'eladrin', 'firbolg', 'goblin', 'hobgoblin', 'bugbear', 'gith', 'vedalken', 'satyr', 'changeling', 'kalashtar', 'hexblood', 'fairy')) { L.earType = 'elf'; L.ears = has('goblin', 'bugbear') ? 0.8 : 0.6; }
  if (has('tabaxi', 'leonin')) { L.earType = 'cat'; L.ears = 0.4; L.tail = 'cat'; }
  if (has('rabbit', 'harengon')) { L.earType = 'bunny'; L.ears = 0.4; }
  if (has('shifter')) { L.earType = 'fox'; L.ears = 0.3; }
  if (has('aarakocra', 'aven', 'owlfolk', 'aasimar')) L.wings = 'feather';
  if (has('fairy')) L.wings = 'feather';
  if (has('tiefling')) { L.hornStyle = 'ram'; L.tail = 'devil'; L.skin = '#b5475a'; }
  if (has('dragonborn')) { L.hornStyle = 'swept'; L.tail = 'dragon'; }
  if (has('kobold')) { L.hornStyle = 'swept'; L.tail = 'dragon'; L.height = 0.6; L.skin = '#a0522d'; }
  if (has('lizardfolk', 'viashino', 'troglodyte')) { L.tail = 'dragon'; L.skin = '#5f8a5a'; }
  if (has('minotaur')) { L.hornStyle = 'straight'; L.build = 0.9; L.height = 1.12; }
  if (has('satyr')) L.hornStyle = 'ram';
  if (has('orc', 'bugbear')) L.tusks = true;
  if (has('orc')) L.skin = '#7f9c6a';
  if (has('goliath', 'firbolg', 'loxodon', 'bugbear', 'centaur')) { L.height = 1.15; L.build = 0.9; }
  if (has('goliath')) L.skin = '#9a9a9e';
  if (has('goblin', 'halfling', 'gnome', 'kobold', 'grung')) L.height = L.height || 0.62;
  if (has('dwarf', 'duergar')) { L.height = 0.78; L.build = 0.85; L.beard = 'braided'; }
  if (has('genasi')) L.skin = has('fire') ? '#c4502b' : has('water') ? '#3b7fb5' : has('earth') ? '#8a6a45' : has('air') ? '#9fc4dc' : '#6aa0c0';
  if (has('triton', 'locathah', 'merfolk', 'vedalken')) L.skin = '#5a8fb8';
  if (has('yuan-ti')) L.skin = '#6f9a5f';
  if (has('gith')) L.skin = '#a4b86a';
  if (has('warforged')) L.skin = '#8a8f99';
  if (has('skeleton', 'zombie', 'reborn', 'dhampir', 'changeling')) L.skin = '#d8dde0';
  if (has('grung')) L.skin = '#4aa36a';
  if (has('drow')) L.skin = '#5a4a6a';
  return L;
}
const COLORS = ['#ff9a5a', '#7dffcf', '#ffd166', '#9be36d', '#5ad1ff', '#b388ff', '#ff7ad9', '#ff5a6e', '#e9c46a'];

// 同名種族優先採用玩家用的版本（DMG 的多半是 NPC 版）
const PRIORITY = ['PHB', 'VGM', 'MTF', 'ERLW', 'EGW', 'GGR', 'MOT', 'TCE', 'VRGR', 'EEPC', 'TTP', 'OGA', 'LR', 'AI', 'PSK', 'PSZ', 'PSA', 'PSX', 'PSI', 'PSD', 'AWM', 'DMG'];
const rank = (src) => { const i = PRIORITY.indexOf(src); return i < 0 ? 50 : i; };
const candidates = [];
const out = []; const seen = new Map();
for (const raw of all) {
  if (isUA(raw.source)) continue;
  const base = resolveCopy(raw);
  const variants = (base.subraces || []).filter((s) => !isUA(s.source));
  const list = variants.length ? variants.map((s) => [s, mergeSub(base, s)]) : [[null, base]];
  for (const [sr, r] of list) {
    const subEn = sr?.ENG_name || sr?.name || '';
    if (BUILTIN.has(`${base.ENG_name}|${base.source}|${subEn.split(' ')[0] || ''}`)) continue;
    const name = sr?.name ? `${zh(base.name)}（${zh(sr.name)}）` : zh(base.name);
    const en = `${base.ENG_name || (hasCJK(base.name) ? '' : base.name)}${subEn ? ` (${subEn})` : ''}`.trim();
    const src = sr?.source || raw.source;
    const key = (en || name).toLowerCase().replace(/\s+/g, ' ');

    const ab = r.ability?.[0] || {};
    const asi = {}; let asiChoice = null;
    for (const [k, v] of Object.entries(ab)) {
      if (k === 'choose') { const from = v.from || ['str', 'dex', 'con', 'int', 'wis', 'cha']; asiChoice = { count: v.count || 1, amount: v.amount || 1, exclude: ['str', 'dex', 'con', 'int', 'wis', 'cha'].filter((x) => !from.includes(x)) }; }
      else asi[k] = v;
    }
    const skills = []; let skillChoice = null;
    for (const [k, v] of Object.entries(r.skillProficiencies?.[0] || {})) {
      if (k === 'choose') skillChoice = { count: v.count || 1, list: 'any' };
      else if (k === 'any') skillChoice = { count: v, list: 'any' };
      else { const id = SKILL[k] || k; if (SKILLS.includes(id)) skills.push(id); }
    }
    const langs = Object.entries(r.languageProficiencies?.[0] || {}).map(([k, v]) => (k === 'anyStandard' ? `任選 ${v} 種` : k === 'other' ? '其他' : LANG[k] || k)).join('、');
    const sp = speedOf(r.speed);
    const traits = (r.entries || []).filter((e) => e && typeof e === 'object' && e.name && !SKIP_TRAITS.has(e.ENG_name)).map((e) => ({ name: clean(e.name), desc: flat(e.entries || e.entry) }));
    if (sp.extra) traits.unshift({ name: '移動方式', desc: sp.extra });
    const look = lookFor(`${base.ENG_name} ${subEn}`);
    candidates.push({ key, rank: rank(src), race: {
      id: `pk-${(en || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${raw.source.toLowerCase()}`,
      name, en, group: base.name, size: (r.size || ['M']).map((s) => SIZE[s] || s).join('或'),
      speed: sp.walk, darkvision: r.darkvision || 0, asi, asiChoice, languages: langs,
      skills, skillChoice, traits, blurb: `出自 ${sr?.source || raw.source}${(sr?.page || raw.page) ? ` p.${sr?.page || raw.page}` : ''}${hasCJK(base.name) && (!sr?.name || hasCJK(sr.name)) ? '' : '（特性說明為英文原文）'}`,
      color: COLORS[candidates.length % COLORS.length], look, packLabel: src, untranslated: !hasCJK(base.name) || (sr?.name && !hasCJK(sr.name)),
    } });
  }
}
for (const c of candidates) { const prev = seen.get(c.key); if (!prev || c.rank < prev.rank) seen.set(c.key, c); }
out.push(...[...seen.values()].map((c) => c.race));
out.sort((a, b) => a.group.localeCompare(b.group, 'zh-Hant') || a.name.localeCompare(b.name, 'zh-Hant'));
fs.writeFileSync(outPath, JSON.stringify({ type: 'dndforge-pack', version: 1, name: '官方種族擴充（團內私用）', races: out, spells: [] }, null, 1));
console.log(`輸出 ${out.length} 個種族 → ${outPath}`);
