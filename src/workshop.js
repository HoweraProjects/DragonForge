// 工坊：自訂種族 / 自訂法術 / 內容包匯入匯出
import { openModal, closeModal, toast, esc, downloadJSON, stage, applyRaceLook } from './main.js';
import { custom, saveCustom, state, update, ABILITIES, SKILLS, CLASSES, encodeShare, decodeShare, DEFAULT_LOOK, getClass } from './state.js';
import { SCHOOLS } from './data/rules.js';
import { sfx } from './sfx.js';

let tab = 'race';
let editing = null; // 正在編輯的項目

const blankRace = () => ({
  id: '', name: '', en: '', group: '自訂', size: '中型', speed: 30, darkvision: 0, asi: {}, asiChoice: null,
  languages: '通用語', skills: [], traits: [{ name: '', desc: '' }], blurb: '', color: '#ff7ad9',
  look: { height: 1, skin: '#e8b996', earType: 'human', ears: 0, hornStyle: 'none', tail: 'none', wings: 'none', tusks: false, snout: false },
});
const blankSpell = () => ({ id: '', name: '', en: '', level: 1, school: 'evocation', classes: ['wizard'], time: '1 動作', range: '60 呎', comp: 'V, S', duration: '即效', conc: false, ritual: false, desc: '', vfx: '' });

export function openWorkshop(t = 'race') { tab = t; editing = null; render(); }

function render() {
  const box = openModal(`<div class="modal-head"><div><div class="en">HOMEBREW WORKSHOP</div><h2>自訂工坊</h2></div><span class="muted" style="font-size:12px">自訂內容存在此瀏覽器，可匯出內容包分享給團員</span><button class="x" data-close>✕</button></div>
    <div class="modal-tabs">${[['race', '自訂種族'], ['spell', '自訂法術'], ['pack', '內容包']].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>
    <div class="modal-body">${tab === 'race' ? raceForm() : tab === 'spell' ? spellForm() : packView()}</div>`);
  box.querySelector('.modal-tabs').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; editing = null; sfx.click(); render(); } };
  bind(box);
}

const sel = (name, opts, cur) => `<select name="${name}">${opts.map(([v, n]) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
const f = (label, inner, cls = '') => `<label class="field ${cls}"><span>${label}</span>${inner}</label>`;

function raceForm() {
  const r = editing || (editing = blankRace());
  const L = { ...blankRace().look, ...r.look };
  return `<div class="ws-cols"><form id="wsForm" autocomplete="off">
    <div class="form-grid">
      ${f('種族名稱 *', `<input name="name" required value="${esc(r.name)}" placeholder="例：月影狐族" />`)}
      ${f('英文名', `<input name="en" value="${esc(r.en)}" placeholder="Moonfox" />`)}
      ${f('體型', sel('size', [['微型', '微型'], ['小型', '小型'], ['中型', '中型'], ['大型', '大型']], r.size))}
      ${f('速度（呎）', `<input name="speed" type="number" min="0" max="120" step="5" value="${r.speed}" />`)}
      ${f('黑暗視覺（呎）', `<input name="darkvision" type="number" min="0" max="240" step="30" value="${r.darkvision || 0}" />`)}
      ${f('語言', `<input name="languages" value="${esc(r.languages || '')}" />`)}
      ${f('簡介', `<input name="blurb" value="${esc(r.blurb || '')}" placeholder="一句話描述這個種族" />`, 'full')}
    </div>
    <div class="sec">屬性加值</div>
    <div class="asi-inputs">${ABILITIES.map((a) => `<label>${a.name}<input name="asi_${a.id}" type="number" min="-4" max="4" value="${r.asi?.[a.id] || 0}" /></label>`).join('')}</div>
    <div class="form-grid" style="margin-top:6px">
      ${f('另可自選 N 項屬性', `<input name="asiChoiceCount" type="number" min="0" max="6" value="${r.asiChoice?.count || 0}" />`)}
      ${f('自選屬性每項 +', `<input name="asiChoiceAmt" type="number" min="1" max="2" value="${r.asiChoice?.amount || 1}" />`)}
    </div>
    <div class="sec">固定技能熟練</div>
    <div class="grid c6" style="grid-template-columns:repeat(6,1fr)">${SKILLS.map((s) => `<label class="toggle ${r.skills?.includes(s.id) ? 'on' : ''}" style="font-size:12px;padding:5px 2px"><input type="checkbox" name="skill" value="${s.id}" ${r.skills?.includes(s.id) ? 'checked' : ''} hidden />${s.name}</label>`).join('')}</div>
    <div class="sec">種族特性 <button type="button" class="ghost-btn" data-w="addTrait" style="margin-left:auto;height:28px;order:3">＋ 新增</button></div>
    <div id="traitRows">${(r.traits || []).map((t, i) => `<div class="trait-row"><input class="inp" name="tname" value="${esc(t.name)}" placeholder="特性名稱" /><input class="inp" name="tdesc" value="${esc(t.desc)}" placeholder="效果說明" /><button type="button" data-w="delTrait" data-i="${i}">✕</button></div>`).join('')}</div>
    <div class="sec">外觀預設（3D 模型）</div>
    <div class="form-grid">
      ${f('耳朵', sel('earType', [['human', '人類'], ['elf', '尖耳'], ['cat', '貓耳'], ['fox', '狐耳'], ['bunny', '兔耳'], ['none', '無']], L.earType))}
      ${f('耳朵長度 0–1', `<input name="ears" type="number" min="0" max="1" step="0.1" value="${L.ears}" />`)}
      ${f('角', sel('hornStyle', [['none', '無'], ['ram', '羊角'], ['swept', '後掠角'], ['demon', '惡魔角'], ['straight', '直角']], L.hornStyle))}
      ${f('尾巴', sel('tail', [['none', '無'], ['devil', '惡魔尾'], ['dragon', '龍尾'], ['cat', '貓尾'], ['fox', '狐尾']], L.tail))}
      ${f('翅膀', sel('wings', [['none', '無'], ['feather', '羽翼'], ['bat', '蝠翼']], L.wings))}
      ${f('身高倍率', `<input name="height" type="number" min="0.55" max="1.25" step="0.05" value="${L.height}" />`)}
      ${f('預設膚色', `<input name="skin" type="color" value="${L.skin}" style="height:38px;padding:2px" />`)}
      ${f('卡片主題色', `<input name="color" type="color" value="${r.color || '#ff7ad9'}" style="height:38px;padding:2px" />`)}
      <label class="field"><span>其他</span><label class="toggle ${L.tusks ? 'on' : ''}" style="display:inline-block;margin-right:6px"><input type="checkbox" name="tusks" ${L.tusks ? 'checked' : ''} hidden />獠牙</label><label class="toggle ${L.snout ? 'on' : ''}" style="display:inline-block"><input type="checkbox" name="snout" ${L.snout ? 'checked' : ''} hidden />龍吻</label></label>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px"><button type="button" class="toggle" data-w="preview" style="flex:1">👁 預覽外觀</button><button type="submit" class="big-btn gold" style="flex:2">${r.id ? '儲存變更' : '建立種族'}</button></div>
  </form>
  <div class="ws-list"><div class="sec">已建立的種族</div>${custom.races.some((x) => !x.packLabel) ? custom.races.filter((x) => !x.packLabel).map((x) => `<div class="ws-item"><span class="swatch" style="background:${x.color || '#ff7ad9'};width:14px;height:14px"></span><div class="nm"><b>${esc(x.name)}</b><small>${Object.entries(x.asi || {}).filter(([, v]) => v).map(([k, v]) => `${ABILITIES.find((a) => a.id === k).name}${v > 0 ? '+' : ''}${v}`).join(' ')}</small></div><button data-w="editRace" data-id="${esc(x.id)}">編輯</button><button class="del" data-w="delRace" data-id="${esc(x.id)}">刪除</button></div>`).join('') : '<div class="muted" style="font-size:13px">尚無自訂種族</div>'}
    <div class="note">建立後會出現在「種族」步驟的列表中，並套用你設定的 3D 外觀預設。</div></div></div>`;
}

function spellForm() {
  const s = editing || (editing = blankSpell());
  const casterClasses = CLASSES.filter((c) => c.caster || ['wizard'].includes(c.id));
  return `<div class="ws-cols"><form id="wsForm" autocomplete="off">
    <div class="form-grid">
      ${f('法術名稱 *', `<input name="name" required value="${esc(s.name)}" placeholder="例：星屑流彈" />`)}
      ${f('英文名', `<input name="en" value="${esc(s.en)}" placeholder="Stardust Barrage" />`)}
      ${f('環級', sel('level', Array.from({ length: 10 }, (_, i) => [i, i === 0 ? '戲法' : `${i} 環`]), s.level))}
      ${f('學派', sel('school', Object.entries(SCHOOLS).map(([k, v]) => [k, v.name]), s.school))}
      ${f('施法時間', `<input name="time" value="${esc(s.time)}" />`)}
      ${f('射程', `<input name="range" value="${esc(s.range)}" />`)}
      ${f('成分', `<input name="comp" value="${esc(s.comp)}" />`)}
      ${f('持續時間', `<input name="duration" value="${esc(s.duration)}" />`)}
    </div>
    <div class="sec">可習得職業</div>
    <div class="grid c4">${casterClasses.map((c) => `<label class="toggle ${s.classes.includes(c.caster?.list || c.id) ? 'on' : ''}"><input type="checkbox" name="classes" value="${c.caster?.list || c.id}" ${s.classes.includes(c.caster?.list || c.id) ? 'checked' : ''} hidden />${c.name}</label>`).join('')}</div>
    <div class="form-grid" style="margin-top:8px">
      <label class="field"><span>標籤</span><label class="toggle ${s.conc ? 'on' : ''}" style="display:inline-block;margin-right:6px"><input type="checkbox" name="conc" ${s.conc ? 'checked' : ''} hidden />專注</label><label class="toggle ${s.ritual ? 'on' : ''}" style="display:inline-block"><input type="checkbox" name="ritual" ${s.ritual ? 'checked' : ''} hidden />儀式</label></label>
      ${f('特效顏色（留白則依學派）', `<input name="vfx" type="color" value="${s.vfx || SCHOOLS[s.school].color}" style="height:38px;padding:2px" />`)}
    </div>
    ${f('效果說明 *', `<textarea name="desc" required rows="4" placeholder="傷害骰、豁免、範圍、升環效果……">${esc(s.desc)}</textarea>`)}
    <div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="toggle" data-w="castPreview" style="flex:1">✦ 施法預覽</button><button type="submit" class="big-btn gold" style="flex:2">${s.id ? '儲存變更' : '建立法術'}</button></div>
  </form>
  <div class="ws-list"><div class="sec">已建立的法術</div>${custom.spells.length ? custom.spells.map((x) => `<div class="ws-item"><span class="swatch" style="background:${x.vfx || SCHOOLS[x.school].color};width:14px;height:14px"></span><div class="nm"><b>${esc(x.name)}</b><small>${x.level ? `${x.level} 環` : '戲法'} · ${SCHOOLS[x.school].name}</small></div><button data-w="editSpell" data-id="${esc(x.id)}">編輯</button><button class="del" data-w="delSpell" data-id="${esc(x.id)}">刪除</button></div>`).join('') : '<div class="muted" style="font-size:13px">尚無自訂法術</div>'}
    <div class="note">自訂法術會依你勾選的職業，出現在「法術」步驟的對應環級中。</div></div></div>`;
}

function packView() {
  const packRaces = custom.races.filter((x) => x.packLabel).length;
  return `${packRaces ? `<div class="note" style="display:flex;align-items:center;gap:10px">已匯入擴充包種族 ${packRaces} 個（在種族頁可用「擴充包」篩選）。<button class="toggle" data-w="clearPack" style="margin-left:auto">移除擴充包種族</button></div>` : ''}
  ${packRaces ? '' : `<div class="detail" style="margin:0 0 16px"><h3>官方種族擴充包</h3><p class="muted" style="font-size:13px">PHB、VGM、MTF、ERLW、EGW、GGR、MOT、VRGR 等書的 135 個種族與亞種（資料參考 5etools 中文版）。</p><button class="big-btn gold" data-w="loadOfficial">載入擴充包種族</button></div>`}
  <div class="grid c2" style="gap:16px">
    <div class="detail"><h3>匯出內容包</h3><p class="muted" style="font-size:13px">目前有 ${custom.races.filter((x) => !x.packLabel).length} 個自訂種族、${custom.spells.length} 道自訂法術。匯出後傳給團員，對方匯入即可使用相同的自訂內容。</p>
      <button class="big-btn" data-w="exportPack">下載內容包 JSON</button>
      <button class="toggle" data-w="copyPack" style="width:100%;margin-top:8px">複製內容包分享碼</button></div>
    <div class="detail"><h3>匯入內容包</h3><p class="muted" style="font-size:13px">支援 JSON 檔或分享碼。相同 ID 的項目會被覆蓋更新。</p>
      <button class="big-btn" data-w="importFile">選擇 JSON 檔案</button>
      <textarea class="inp" id="packCode" rows="3" placeholder="或在此貼上分享碼" style="margin-top:8px"></textarea>
      <button class="toggle" data-w="importCode" style="width:100%;margin-top:6px">匯入分享碼</button>
      <input type="file" id="packFile" accept=".json,application/json" hidden /></div>
  </div>`;
}

const slug = (s) => (s.en || s.name).toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-|-$/g, '') || `x${Date.now()}`;

function readRace(form) {
  const fd = new FormData(form); const g = (k) => fd.get(k);
  const asi = {}; for (const a of ABILITIES) { const v = Number(g(`asi_${a.id}`)) || 0; if (v) asi[a.id] = v; }
  const cnt = Number(g('asiChoiceCount')) || 0;
  const names = fd.getAll('tname'); const descs = fd.getAll('tdesc');
  const traits = names.map((n, i) => ({ name: n.trim(), desc: (descs[i] || '').trim() })).filter((t) => t.name);
  const dv = Number(g('darkvision')) || 0;
  if (dv && !traits.some((t) => t.name === '黑暗視覺')) traits.unshift({ name: '黑暗視覺', desc: `${dv} 呎內視昏暗如明亮光照。` });
  return {
    id: editing?.id || `custom-${slug({ name: g('name'), en: g('en') })}-${Date.now().toString(36).slice(-4)}`,
    name: g('name').trim(), en: g('en').trim(), group: '自訂', size: g('size'), speed: Number(g('speed')) || 30, darkvision: dv,
    asi, asiChoice: cnt ? { count: cnt, amount: Number(g('asiChoiceAmt')) || 1, exclude: [] } : null,
    languages: g('languages'), skills: fd.getAll('skill'), traits, blurb: g('blurb').trim(), color: g('color'),
    look: { height: Number(g('height')) || 1, skin: g('skin'), earType: g('earType'), ears: Number(g('ears')) || 0, hornStyle: g('hornStyle'), tail: g('tail'), wings: g('wings'), tusks: !!g('tusks'), snout: !!g('snout'), hairStyle: g('snout') ? 'none' : undefined },
  };
}
function readSpell(form) {
  const fd = new FormData(form); const g = (k) => fd.get(k);
  return {
    id: editing?.id || `custom-${slug({ name: g('name'), en: g('en') })}-${Date.now().toString(36).slice(-4)}`,
    name: g('name').trim(), en: g('en').trim(), level: Number(g('level')), school: g('school'), classes: fd.getAll('classes'),
    time: g('time'), range: g('range'), comp: g('comp'), duration: g('duration'), conc: !!g('conc'), ritual: !!g('ritual'), desc: g('desc').trim(), vfx: g('vfx'),
  };
}

function bind(box) {
  const form = box.querySelector('#wsForm');
  if (form) {
    form.addEventListener('change', (e) => { if (e.target.type === 'checkbox') e.target.parentElement.classList.toggle('on', e.target.checked); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (tab === 'race') {
        const r = readRace(form);
        const i = custom.races.findIndex((x) => x.id === r.id); if (i >= 0) custom.races[i] = r; else custom.races.push(r);
        saveCustom(); sfx.forge(); stage.burst(r.color, { count: 150, flash: 0.3 });
        toast(`種族「${r.name}」已${i >= 0 ? '更新' : '建立'}`);
      } else {
        const s = readSpell(form);
        if (!s.classes.length) { toast('請至少勾選一個職業'); sfx.error(); return; }
        const i = custom.spells.findIndex((x) => x.id === s.id); if (i >= 0) custom.spells[i] = s; else custom.spells.push(s);
        saveCustom(); sfx.cast(); stage.castSpell(s.vfx || SCHOOLS[s.school].color);
        toast(`法術「${s.name}」已${i >= 0 ? '更新' : '建立'}`);
      }
      editing = null; render();
    });
  }
  box.querySelector('.modal-body').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-w]'); if (!b) return;
    const w = b.dataset.w;
    if (w === 'addTrait') { editing = { ...readRace(form), id: editing.id }; editing.traits.push({ name: '', desc: '' }); render(); }
    if (w === 'delTrait') { const r = { ...readRace(form), id: editing.id }; const names = new FormData(form).getAll('tname'); const descs = new FormData(form).getAll('tdesc'); r.traits = names.map((n, i) => ({ name: n, desc: descs[i] })).filter((_, i) => i !== Number(b.dataset.i)); editing = r; render(); }
    if (w === 'preview') {
      const r = readRace(form);
      update((s) => { applyRaceLook(s.look, { look: r.look }, null); }, { look: true });
      sfx.select(); stage.burst(r.color, { count: 100 }); stage.focus('full');
      toast('已將外觀套用到目前角色（預覽）');
    }
    if (w === 'castPreview') { const s = readSpell(form); stage.castSpell(s.vfx || SCHOOLS[s.school].color); sfx.cast(); }
    if (w === 'editRace') { editing = structuredClone(custom.races.find((x) => x.id === b.dataset.id)); render(); }
    if (w === 'editSpell') { editing = structuredClone(custom.spells.find((x) => x.id === b.dataset.id)); render(); }
    if (w === 'delRace' || w === 'delSpell') {
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = '確定？'; return; }
      const key = w === 'delRace' ? 'races' : 'spells';
      custom[key] = custom[key].filter((x) => x.id !== b.dataset.id);
      if (key === 'races' && state.raceId === b.dataset.id) update((s) => { s.raceId = 'human'; });
      if (key === 'spells') update((s) => { s.spells = s.spells.filter((x) => x !== b.dataset.id); s.cantrips = s.cantrips.filter((x) => x !== b.dataset.id); });
      saveCustom(); sfx.click(); render();
    }
    if (w === 'loadOfficial') { b.disabled = true; b.textContent = '載入中…'; await loadOfficialPack(); render(); }
    if (w === 'clearPack') { if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = '再按一次確認'; return; } custom.races = custom.races.filter((x) => !x.packLabel); if (custom.races.every((x) => x.id !== state.raceId) && state.raceId.startsWith('pk-')) update((st) => { st.raceId = 'human'; }); saveCustom(); toast('已移除擴充包種族'); render(); }
    if (w === 'exportPack') downloadJSON('dndforge-homebrew-pack.json', { type: 'dndforge-pack', version: 1, races: custom.races, spells: custom.spells });
    if (w === 'copyPack') { const code = await encodeShare({ races: custom.races, spells: custom.spells }); try { await navigator.clipboard.writeText(code); toast('分享碼已複製'); } catch { box.querySelector('#packCode').value = code; toast('請手動複製下方分享碼'); } }
    if (w === 'importFile') box.querySelector('#packFile').click();
    if (w === 'importCode') { try { mergePack(await decodeShare(box.querySelector('#packCode').value)); } catch { toast('分享碼無效'); sfx.error(); } }
  });
  const pf = box.querySelector('#packFile');
  if (pf) pf.onchange = async (e) => { try { mergePack(JSON.parse(await e.target.files[0].text())); } catch { toast('檔案格式錯誤'); sfx.error(); } };
}

export async function loadOfficialPack() {
  try {
    const p = await fetch(`${import.meta.env.BASE_URL}packs/official-races.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    mergePack(p, { silentRender: true });
  } catch { toast('擴充包載入失敗'); sfx.error(); }
}

function mergePack(p, { silentRender = false } = {}) {
  let n = 0;
  for (const r of p.races || p.customRaces || []) { const i = custom.races.findIndex((x) => x.id === r.id); if (i >= 0) custom.races[i] = r; else custom.races.push(r); n++; }
  for (const s of p.spells || p.customSpells || []) { const i = custom.spells.findIndex((x) => x.id === s.id); if (i >= 0) custom.spells[i] = s; else custom.spells.push(s); n++; }
  saveCustom(); sfx.forge(); toast(`已匯入 ${n} 項內容`); if (!silentRender) render();
}

export { closeModal };
