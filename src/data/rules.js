// D&D 5e 制式規則資料（以 SRD 5.1 為主，CC-BY-4.0）

export const ABILITIES = [
  { id: 'str', name: '力量', en: 'STR' },
  { id: 'dex', name: '敏捷', en: 'DEX' },
  { id: 'con', name: '體質', en: 'CON' },
  { id: 'int', name: '智力', en: 'INT' },
  { id: 'wis', name: '感知', en: 'WIS' },
  { id: 'cha', name: '魅力', en: 'CHA' },
];

export const SKILLS = [
  { id: 'acrobatics', name: '特技', en: 'Acrobatics', ab: 'dex' },
  { id: 'animal', name: '馴獸', en: 'Animal Handling', ab: 'wis' },
  { id: 'arcana', name: '奧秘', en: 'Arcana', ab: 'int' },
  { id: 'athletics', name: '運動', en: 'Athletics', ab: 'str' },
  { id: 'deception', name: '欺瞞', en: 'Deception', ab: 'cha' },
  { id: 'history', name: '歷史', en: 'History', ab: 'int' },
  { id: 'insight', name: '洞悉', en: 'Insight', ab: 'wis' },
  { id: 'intimidation', name: '威嚇', en: 'Intimidation', ab: 'cha' },
  { id: 'investigation', name: '調查', en: 'Investigation', ab: 'int' },
  { id: 'medicine', name: '醫藥', en: 'Medicine', ab: 'wis' },
  { id: 'nature', name: '自然', en: 'Nature', ab: 'int' },
  { id: 'perception', name: '察覺', en: 'Perception', ab: 'wis' },
  { id: 'performance', name: '表演', en: 'Performance', ab: 'cha' },
  { id: 'persuasion', name: '說服', en: 'Persuasion', ab: 'cha' },
  { id: 'religion', name: '宗教', en: 'Religion', ab: 'int' },
  { id: 'sleight', name: '巧手', en: 'Sleight of Hand', ab: 'dex' },
  { id: 'stealth', name: '隱匿', en: 'Stealth', ab: 'dex' },
  { id: 'survival', name: '求生', en: 'Survival', ab: 'wis' },
];

export const SCHOOLS = {
  abjuration: { name: '防護', color: '#5ad1ff' },
  conjuration: { name: '咒法', color: '#ffd166' },
  divination: { name: '預言', color: '#c3b6ff' },
  enchantment: { name: '惑控', color: '#ff7ad9' },
  evocation: { name: '塑能', color: '#ff6a3d' },
  illusion: { name: '幻術', color: '#9d7bff' },
  necromancy: { name: '死靈', color: '#7dff9a' },
  transmutation: { name: '變化', color: '#ffb347' },
};

export const ALIGNMENTS = ['守序善良', '中立善良', '混亂善良', '守序中立', '絕對中立', '混亂中立', '守序邪惡', '中立邪惡', '混亂邪惡'];

// ---------- 種族 ----------
// look: 3D 外觀預設值（捏臉系統會套用）
export const RACES = [
  {
    id: 'human', name: '人類', en: 'Human', group: '人類', size: '中型', speed: 30,
    asi: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, darkvision: 0,
    languages: '通用語、任選一種',
    traits: [{ name: '多才多藝', desc: '所有屬性值 +1。' }],
    look: { height: 1.0, ears: 0, hornStyle: 'none', tail: 'none', tusks: false, snout: false },
    blurb: '短命而野心勃勃，人類是多元宇宙中最具適應力的種族。',
  },
  {
    id: 'high-elf', name: '高等精靈', en: 'High Elf', group: '精靈', size: '中型', speed: 30,
    asi: { dex: 2, int: 1 }, darkvision: 60, skills: ['perception'],
    languages: '通用語、精靈語、任選一種',
    traits: [
      { name: '黑暗視覺', desc: '60 呎內視昏暗如明亮光照。' },
      { name: '敏銳感官', desc: '熟練察覺技能。' },
      { name: '妖精血統', desc: '對魅惑的豁免具優勢，魔法無法使你入睡。' },
      { name: '冥想', desc: '每日只需冥想 4 小時代替睡眠。' },
      { name: '精靈武器訓練', desc: '熟練長劍、短劍、短弓與長弓。' },
      { name: '戲法', desc: '從法師法術表中習得一道戲法（智力施法）。' },
    ],
    bonusCantrip: { list: 'wizard', count: 1 },
    look: { height: 0.98, ears: 1.0, hornStyle: 'none', tail: 'none', tusks: false, snout: false },
    blurb: '優雅而長壽，與魔法有著與生俱來的親和力。',
  },
  {
    id: 'hill-dwarf', name: '丘陵矮人', en: 'Hill Dwarf', group: '矮人', size: '中型', speed: 25,
    asi: { con: 2, wis: 1 }, darkvision: 60, hpPerLevel: 1,
    languages: '通用語、矮人語',
    traits: [
      { name: '黑暗視覺', desc: '60 呎內視昏暗如明亮光照。' },
      { name: '矮人韌性', desc: '對毒素豁免具優勢，並具毒素傷害抗性。' },
      { name: '矮人戰鬥訓練', desc: '熟練戰斧、手斧、輕錘與戰錘。' },
      { name: '石材知識', desc: '與石造工藝相關的歷史檢定加倍熟練加值。' },
      { name: '矮人堅韌', desc: '最大生命值 +1，且每升一級再 +1。' },
      { name: '重甲不減速', desc: '穿著重甲不會降低速度。' },
    ],
    look: { height: 0.78, build: 0.85, ears: 0, hornStyle: 'none', tail: 'none', tusks: false, snout: false, beard: 'braided' },
    blurb: '堅如磐石的工匠與戰士，恪守氏族榮耀。',
  },
  {
    id: 'lightfoot', name: '輕足半身人', en: 'Lightfoot Halfling', group: '半身人', size: '小型', speed: 25,
    asi: { dex: 2, cha: 1 }, darkvision: 0,
    languages: '通用語、半身人語',
    traits: [
      { name: '幸運', desc: '攻擊、屬性或豁免檢定擲出 1 時可以重骰。' },
      { name: '勇敢', desc: '對恐懼的豁免具優勢。' },
      { name: '半身人靈巧', desc: '可穿過比你體型大的生物的空間。' },
      { name: '天生隱匿', desc: '可躲藏在比你大至少一級體型的生物身後。' },
    ],
    look: { height: 0.62, ears: 0.35, hornStyle: 'none', tail: 'none', tusks: false, snout: false },
    blurb: '樂天知命的小個子，運氣總站在他們這邊。',
  },
  {
    id: 'dragonborn', name: '龍裔', en: 'Dragonborn', group: '龍裔', size: '中型', speed: 30,
    asi: { str: 2, cha: 1 }, darkvision: 0,
    languages: '通用語、龍語',
    traits: [
      { name: '龍族血統', desc: '選擇一種龍族血統，決定吐息武器與傷害抗性。' },
      { name: '吐息武器', desc: '以一個動作吐息，2d6 傷害（6/11/16 級提升），豁免 DC = 8 + 體質調整值 + 熟練加值。短休或長休後恢復。' },
      { name: '傷害抗性', desc: '對血統對應的傷害類型具抗性。' },
    ],
    choice: {
      key: 'ancestry', label: '龍族血統', options: [
        { id: 'black', name: '黑龍', dmg: '強酸', area: '5×30 呎直線（敏捷）', color: '#2b2d3a' },
        { id: 'blue', name: '藍龍', dmg: '閃電', area: '5×30 呎直線（敏捷）', color: '#2f6fd6' },
        { id: 'brass', name: '黃銅龍', dmg: '火焰', area: '5×30 呎直線（敏捷）', color: '#c9a24a' },
        { id: 'bronze', name: '青銅龍', dmg: '閃電', area: '5×30 呎直線（敏捷）', color: '#a0703a' },
        { id: 'copper', name: '紅銅龍', dmg: '強酸', area: '5×30 呎直線（敏捷）', color: '#c26a3c' },
        { id: 'gold', name: '金龍', dmg: '火焰', area: '15 呎錐形（敏捷）', color: '#e8c04a' },
        { id: 'green', name: '綠龍', dmg: '毒素', area: '15 呎錐形（體質）', color: '#3f9a5a' },
        { id: 'red', name: '紅龍', dmg: '火焰', area: '15 呎錐形（敏捷）', color: '#b8322a' },
        { id: 'silver', name: '銀龍', dmg: '寒冷', area: '15 呎錐形（體質）', color: '#b9c4d0' },
        { id: 'white', name: '白龍', dmg: '寒冷', area: '15 呎錐形（體質）', color: '#e6eef5' },
      ],
    },
    look: { height: 1.08, build: 0.8, ears: 0, skin: '#b8322a', hornStyle: 'swept', tail: 'dragon', tusks: false, snout: true, hornColor: '#e8dcc0', hairStyle: 'none', beard: 'none' },
    blurb: '流著龍血的驕傲戰士，吐息足以焚盡敵陣。',
  },
  {
    id: 'rock-gnome', name: '岩侏儒', en: 'Rock Gnome', group: '侏儒', size: '小型', speed: 25,
    asi: { int: 2, con: 1 }, darkvision: 60,
    languages: '通用語、侏儒語',
    traits: [
      { name: '黑暗視覺', desc: '60 呎內視昏暗如明亮光照。' },
      { name: '侏儒狡黠', desc: '對魔法的智力、感知、魅力豁免具優勢。' },
      { name: '工匠知識', desc: '與魔法物品、煉金物品或技術裝置相關的歷史檢定加倍熟練加值。' },
      { name: '修補匠', desc: '熟練修補匠工具，可製作小型發條裝置。' },
    ],
    look: { height: 0.6, ears: 0.55, hornStyle: 'none', tail: 'none', tusks: false, snout: false },
    blurb: '好奇心旺盛的發明家，腦中永遠有下一個點子。',
  },
  {
    id: 'half-elf', name: '半精靈', en: 'Half-Elf', group: '半精靈', size: '中型', speed: 30,
    asi: { cha: 2 }, asiChoice: { count: 2, amount: 1, exclude: ['cha'] }, darkvision: 60,
    skillChoice: { count: 2, list: 'any' },
    languages: '通用語、精靈語、任選一種',
    traits: [
      { name: '黑暗視覺', desc: '60 呎內視昏暗如明亮光照。' },
      { name: '妖精血統', desc: '對魅惑的豁免具優勢，魔法無法使你入睡。' },
      { name: '技能多樣', desc: '任選兩項技能熟練。' },
      { name: '屬性彈性', desc: '魅力以外任選兩項屬性 +1。' },
    ],
    look: { height: 1.0, ears: 0.5, hornStyle: 'none', tail: 'none', tusks: false, snout: false },
    blurb: '行走於兩個世界之間，天生的外交家。',
  },
  {
    id: 'half-orc', name: '半獸人', en: 'Half-Orc', group: '半獸人', size: '中型', speed: 30,
    asi: { str: 2, con: 1 }, darkvision: 60, skills: ['intimidation'],
    languages: '通用語、獸人語',
    traits: [
      { name: '黑暗視覺', desc: '60 呎內視昏暗如明亮光照。' },
      { name: '威嚇', desc: '熟練威嚇技能。' },
      { name: '堅忍不拔', desc: '生命值降至 0 但未死亡時，改為降至 1。每次長休恢復一次。' },
      { name: '野蠻攻擊', desc: '近戰武器重擊時額外擲一顆武器傷害骰。' },
    ],
    look: { height: 1.08, build: 0.95, ears: 0.4, skin: '#7f9c6a', hornStyle: 'none', tail: 'none', tusks: true, snout: false },
    blurb: '兼具人類的意志與獸人的蠻力，生來就為戰鬥而生。',
  },
  {
    id: 'tiefling', name: '提夫林', en: 'Tiefling', group: '提夫林', size: '中型', speed: 30,
    asi: { cha: 2, int: 1 }, darkvision: 60,
    languages: '通用語、煉獄語',
    traits: [
      { name: '黑暗視覺', desc: '60 呎內視昏暗如明亮光照。' },
      { name: '煉獄抗性', desc: '具火焰傷害抗性。' },
      { name: '煉獄遺緒', desc: '習得奇術戲法；3 級可施展地獄斥責（2 級），5 級可施展黑暗術，各每日一次，以魅力施法。' },
    ],
    bonusCantripFixed: ['thaumaturgy'],
    look: { height: 1.0, ears: 0.6, skin: '#b5475a', hornStyle: 'ram', tail: 'devil', tusks: false, snout: false, eyeColor: '#ffcc33', hornColor: '#5a3346' },
    blurb: '背負惡魔血脈的烙印，在偏見中鍛造自己的命運。',
  },
];

// ---------- 職業 ----------
const FULL = [null, [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];

export function spellSlots(caster, level) {
  if (!caster) return [];
  if (caster.type === 'full') return FULL[level] || [];
  if (caster.type === 'half') return level < 2 ? [] : FULL[Math.ceil(level / 2)];
  if (caster.type === 'artificer') return FULL[Math.ceil(level / 2)]; // 半施法但向上取整，1 級即有法術位
  if (caster.type === 'pact') {
    const n = level === 1 ? 1 : level <= 10 ? 2 : level <= 16 ? 3 : 4;
    const lv = Math.min(5, Math.ceil(level / 2));
    const arr = new Array(lv).fill(0); arr[lv - 1] = n; return arr;
  }
  return [];
}

const tiers = (a, b, c) => Array.from({ length: 20 }, (_, i) => (i + 1 >= 10 ? c : i + 1 >= 4 ? b : a));

export const CLASSES = [
  {
    id: 'barbarian', name: '野蠻人', en: 'Barbarian', hd: 12, primary: ['str'], saves: ['str', 'con'],
    skillCount: 2, skillList: ['animal', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
    armor: '輕甲、中甲、盾牌', weapons: '簡易武器、軍用武器', ac: { kind: 'unarmored', bonus: 'con' },
    gear: '巨斧、兩把手斧、探險家套組、四根標槍', weapon: 'greataxe', outfit: 'fur', color: '#ff4d3d',
    subclassLevel: 3, subclass: { name: '狂戰士之道', desc: '狂暴時可進入狂亂狀態，以附贈動作進行額外近戰攻擊。' },
    features: [
      [1, '狂暴', '附贈動作進入狂暴：力量檢定與豁免具優勢、近戰傷害加值、鈍擊/穿刺/揮砍抗性。'],
      [1, '無甲防禦', '未著甲時 AC = 10 + 敏捷 + 體質調整值。'],
      [2, '魯莽攻擊', '本回合力量近戰攻擊具優勢，但敵人攻擊你也具優勢。'],
      [2, '危機感知', '對可見效果的敏捷豁免具優勢。'],
      [5, '額外攻擊', '攻擊動作可攻擊兩次。'],
      [5, '快速移動', '未著重甲時速度 +10 呎。'],
      [11, '不屈狂暴', '狂暴時降至 0 生命值可進行體質豁免改為 1。'],
      [20, '原初勇士', '力量與體質 +4，上限 24。'],
    ],
    blurb: '憤怒是武器，傷疤是勳章。',
  },
  {
    id: 'bard', name: '吟遊詩人', en: 'Bard', hd: 8, primary: ['cha'], saves: ['dex', 'cha'],
    skillCount: 3, skillList: 'any',
    armor: '輕甲', weapons: '簡易武器、手弩、長劍、細劍、短劍', ac: { base: 11, dex: 99 },
    gear: '細劍、外交官套組、魯特琴、皮甲、匕首', weapon: 'lute', outfit: 'bard', color: '#ff7ad9',
    caster: { ab: 'cha', type: 'full', list: 'bard', cantrips: tiers(2, 3, 4), known: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22] },
    subclassLevel: 3, subclass: { name: '逸聞學院', desc: '額外三項技能熟練；可用激勵骰削弱敵人的攻擊或檢定。' },
    features: [
      [1, '施法', '以魅力施法，習得固定法術。'],
      [1, '吟遊激勵', '附贈動作給予盟友一顆激勵骰（d6，逐級提升）。'],
      [2, '萬事通', '未熟練的屬性檢定加上一半熟練加值。'],
      [2, '休憩之歌', '短休時盟友額外恢復生命。'],
      [3, '專精', '兩項熟練技能熟練加值加倍。'],
      [5, '激勵泉源', '短休即可恢復吟遊激勵。'],
      [10, '魔法奧秘', '從任何職業法術表習得兩道法術。'],
    ],
    blurb: '以歌聲編織魔法，以故事改寫命運。',
  },
  {
    id: 'cleric', name: '牧師', en: 'Cleric', hd: 8, primary: ['wis'], saves: ['wis', 'cha'],
    skillCount: 2, skillList: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
    armor: '輕甲、中甲、盾牌', weapons: '簡易武器', ac: { base: 14, dex: 2, shield: true },
    gear: '硬頭錘、鱗甲、輕弩與 20 支弩矢、祭司套組、盾牌、聖徽', weapon: 'mace', outfit: 'cleric', color: '#ffe08a',
    caster: { ab: 'wis', type: 'full', list: 'cleric', cantrips: tiers(3, 4, 5), prepared: 'full' },
    subclassLevel: 1, subclass: { name: '生命領域', desc: '熟練重甲；治療法術額外恢復 2 + 法術環級生命。' },
    features: [
      [1, '施法', '以感知施法，每日長休後準備法術。'],
      [1, '神聖領域', '選擇一個領域，獲得領域法術與能力。'],
      [2, '引導神力', '驅散不死生物或使用領域神力。'],
      [5, '摧毀不死', '驅散時直接摧毀低挑戰等級的不死生物。'],
      [10, '神聖介入', '祈求神祇直接介入。'],
    ],
    blurb: '神祇在人間的代言者，信仰即是力量。',
  },
  {
    id: 'druid', name: '德魯伊', en: 'Druid', hd: 8, primary: ['wis'], saves: ['int', 'wis'],
    skillCount: 2, skillList: ['arcana', 'animal', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'],
    armor: '輕甲、中甲、盾牌（非金屬）', weapons: '木棍、匕首、飛鏢、標槍、錘矛、長棍、彎刀、鐮刀、投石索、矛', ac: { base: 11, dex: 99, shield: true },
    gear: '木盾、彎刀、皮甲、探險家套組、德魯伊法器', weapon: 'staff', outfit: 'druid', color: '#7dff9a',
    caster: { ab: 'wis', type: 'full', list: 'druid', cantrips: tiers(2, 3, 4), prepared: 'full' },
    subclassLevel: 2, subclass: { name: '大地結社', desc: '額外戲法、自然恢復法術位，並依地形獲得結社法術。' },
    features: [
      [1, '德魯伊語', '知曉德魯伊的秘密語言。'],
      [1, '施法', '以感知施法，每日準備法術。'],
      [2, '野性變身', '以動作變身為曾見過的野獸。'],
      [18, '永恆之軀', '每十年才老化一年。'],
      [20, '大德魯伊', '無限次野性變身。'],
    ],
    blurb: '自然的守望者，與萬物共鳴。',
  },
  {
    id: 'fighter', name: '戰士', en: 'Fighter', hd: 10, primary: ['str', 'dex'], saves: ['str', 'con'],
    skillCount: 2, skillList: ['acrobatics', 'animal', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'],
    armor: '所有護甲、盾牌', weapons: '簡易武器、軍用武器', ac: { base: 16, dex: 0, shield: true },
    gear: '鎖子甲、長劍與盾牌、輕弩與 20 支弩矢、地城探索者套組', weapon: 'sword', outfit: 'plate', color: '#9fb4ff',
    asiExtra: [6, 14],
    subclassLevel: 3, subclass: { name: '勇士', desc: '重擊範圍擴大為 19–20，後續更提升至 18–20。' },
    features: [
      [1, '戰鬥風格', '選擇一種戰鬥風格（防禦、決鬥、巨武器、箭術…）。'],
      [1, '回氣', '附贈動作恢復 1d10 + 戰士等級生命。'],
      [2, '動作如潮', '每短休一次，獲得一個額外動作。'],
      [5, '額外攻擊', '攻擊動作可攻擊兩次（11 級三次、20 級四次）。'],
      [9, '不屈', '重骰一次失敗的豁免。'],
    ],
    blurb: '戰場上的大師，以鋼鐵與意志取勝。',
  },
  {
    id: 'monk', name: '武僧', en: 'Monk', hd: 8, primary: ['dex', 'wis'], saves: ['str', 'dex'],
    skillCount: 2, skillList: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'],
    armor: '無', weapons: '簡易武器、短劍', ac: { kind: 'unarmored', bonus: 'wis' },
    gear: '短劍、地城探索者套組、10 支飛鏢', weapon: 'fists', outfit: 'monk', color: '#5ad1ff',
    subclassLevel: 3, subclass: { name: '散手之道', desc: '疾風連擊命中時可推倒、推開或使敵人無法反應。' },
    features: [
      [1, '無甲防禦', '未著甲時 AC = 10 + 敏捷 + 感知調整值。'],
      [1, '武術', '徒手攻擊使用武術骰，可以附贈動作再徒手攻擊。'],
      [2, '氣', '使用氣點施展疾風連擊、堅忍防禦、疾步如風。'],
      [2, '無甲移動', '速度 +10 呎，並逐級提升。'],
      [5, '震懾拳', '命中後消耗 1 氣點使目標震懾。'],
      [5, '額外攻擊', '攻擊動作可攻擊兩次。'],
      [7, '反射閃避', '敏捷豁免成功不受傷害，失敗減半。'],
    ],
    blurb: '肉身即兵器，心靈即盾牌。',
  },
  {
    id: 'paladin', name: '聖騎士', en: 'Paladin', hd: 10, primary: ['str', 'cha'], saves: ['wis', 'cha'],
    skillCount: 2, skillList: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
    armor: '所有護甲、盾牌', weapons: '簡易武器、軍用武器', ac: { base: 16, dex: 0, shield: true },
    gear: '鎖子甲、軍用武器與盾牌、五支標槍、祭司套組、聖徽', weapon: 'warhammer', outfit: 'plate', color: '#ffd166',
    caster: { ab: 'cha', type: 'half', list: 'paladin', cantrips: null, prepared: 'half' },
    subclassLevel: 3, subclass: { name: '奉獻之誓', desc: '以引導神力祝聖武器、驅散邪惡；神聖光環守護盟友。' },
    features: [
      [1, '神聖感知', '感知 60 呎內的天界、邪魔與不死生物。'],
      [1, '聖療', '擁有 5 × 等級的治療池。'],
      [2, '戰鬥風格', '選擇一種戰鬥風格。'],
      [2, '施法', '以魅力施法（半施法者）。'],
      [2, '神聖斬擊', '命中時消耗法術位造成額外 2d8 光耀傷害。'],
      [5, '額外攻擊', '攻擊動作可攻擊兩次。'],
      [6, '守護光環', '10 呎內盟友豁免加上你的魅力調整值。'],
    ],
    blurb: '以誓言為劍，以信念為盾。',
  },
  {
    id: 'ranger', name: '遊俠', en: 'Ranger', hd: 10, primary: ['dex', 'wis'], saves: ['str', 'dex'],
    skillCount: 3, skillList: ['animal', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'],
    armor: '輕甲、中甲、盾牌', weapons: '簡易武器、軍用武器', ac: { base: 14, dex: 2 },
    gear: '鱗甲、兩把短劍、長弓與 20 支箭、探險家套組', weapon: 'bow', outfit: 'ranger', color: '#9be36d',
    caster: { ab: 'wis', type: 'half', list: 'ranger', cantrips: null, known: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11] },
    subclassLevel: 3, subclass: { name: '獵人', desc: '選擇獵人技藝：巨像殺手、巨人剋星或群體破壞者。' },
    features: [
      [1, '宿敵', '選擇宿敵類型，追蹤與回憶相關知識具優勢。'],
      [1, '自然探索者', '在偏好地形中旅行與探索更有效率。'],
      [2, '戰鬥風格', '選擇一種戰鬥風格。'],
      [2, '施法', '以感知施法（半施法者）。'],
      [5, '額外攻擊', '攻擊動作可攻擊兩次。'],
    ],
    blurb: '荒野中的獵手，箭矢永不落空。',
  },
  {
    id: 'rogue', name: '盜賊', en: 'Rogue', hd: 8, primary: ['dex'], saves: ['dex', 'int'],
    skillCount: 4, skillList: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight', 'stealth'],
    armor: '輕甲', weapons: '簡易武器、手弩、長劍、細劍、短劍', ac: { base: 11, dex: 99 },
    gear: '細劍、短弓與 20 支箭、竊賊套組、皮甲、兩把匕首、盜賊工具', weapon: 'daggers', outfit: 'rogue', color: '#b388ff',
    asiExtra: [10],
    subclassLevel: 3, subclass: { name: '竊賊', desc: '以附贈動作使用物品或巧手；攀爬迅速。' },
    features: [
      [1, '專精', '兩項熟練技能熟練加值加倍。'],
      [1, '偷襲', '具優勢或盟友在旁時，額外造成 1d6 傷害（逐級提升）。'],
      [1, '盜賊黑話', '知曉盜賊們的暗語。'],
      [2, '靈巧動作', '以附贈動作疾走、撤離或躲藏。'],
      [5, '直覺閃避', '以反應將一次攻擊傷害減半。'],
      [7, '反射閃避', '敏捷豁免成功不受傷害，失敗減半。'],
    ],
    blurb: '陰影是盟友，弱點是機會。',
  },
  {
    id: 'sorcerer', name: '術士', en: 'Sorcerer', hd: 6, primary: ['cha'], saves: ['con', 'cha'],
    skillCount: 2, skillList: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
    armor: '無', weapons: '匕首、飛鏢、投石索、長棍、輕弩', ac: { base: 10, dex: 99 },
    gear: '輕弩與 20 支弩矢、奧術法器、地城探索者套組、兩把匕首', weapon: 'orb', outfit: 'sorcerer', color: '#ff6a3d',
    caster: { ab: 'cha', type: 'full', list: 'sorcerer', cantrips: tiers(4, 5, 6), known: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15] },
    subclassLevel: 1, subclass: { name: '龍族血脈', desc: '未著甲 AC = 13 + 敏捷；生命值每級 +1；對應元素法術增傷。' },
    features: [
      [1, '施法', '以魅力施法，魔力與生俱來。'],
      [1, '術法起源', '選擇魔力的來源。'],
      [2, '魔力泉源', '術法點與法術位互相轉換。'],
      [3, '超魔', '改變法術的運作方式（雙生、瞬發、延長…）。'],
    ],
    blurb: '魔法流淌在血液中，無需書本。',
  },
  {
    id: 'warlock', name: '契術師', en: 'Warlock', hd: 8, primary: ['cha'], saves: ['wis', 'cha'],
    skillCount: 2, skillList: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'],
    armor: '輕甲', weapons: '簡易武器', ac: { base: 11, dex: 99 },
    gear: '輕弩與 20 支弩矢、奧術法器、學者套組、皮甲、兩把匕首', weapon: 'tome', outfit: 'warlock', color: '#a46bff',
    caster: { ab: 'cha', type: 'pact', list: 'warlock', cantrips: tiers(2, 3, 4), known: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15] },
    subclassLevel: 1, subclass: { name: '邪魔宗主', desc: '擊倒敵人時獲得臨時生命；之後獲得黑暗的祝福。' },
    features: [
      [1, '異界宗主', '與強大存在締結契約。'],
      [1, '契約魔法', '法術位少但短休即恢復，且總以最高環施放。'],
      [2, '魔能祈喚', '習得改造能力的祈喚（如苦痛衝擊）。'],
      [3, '契約恩賜', '鍊之契約、刃之契約或書之契約。'],
      [11, '秘法玄奧', '每日一次施展 6 環以上法術。'],
    ],
    blurb: '以靈魂換取力量，契約永不落空。',
  },
  {
    id: 'wizard', name: '法師', en: 'Wizard', hd: 6, primary: ['int'], saves: ['int', 'wis'],
    skillCount: 2, skillList: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'],
    armor: '無', weapons: '匕首、飛鏢、投石索、長棍、輕弩', ac: { base: 10, dex: 99 },
    gear: '長棍、奧術法器、學者套組、法術書', weapon: 'staff', outfit: 'wizard', color: '#5ad1ff',
    caster: { ab: 'int', type: 'full', list: 'wizard', cantrips: tiers(3, 4, 5), prepared: 'full', spellbook: true },
    subclassLevel: 2, subclass: { name: '塑能學派', desc: '塑形法術保護盟友；強化戲法與塑能法術傷害。' },
    features: [
      [1, '施法', '以智力施法，法術記錄於法術書。'],
      [1, '奧術恢復', '短休時恢復部分法術位。'],
      [2, '奧術傳統', '選擇一個魔法學派。'],
      [18, '法術精通', '無限次施展一道 1 環與 2 環法術。'],
      [20, '招牌法術', '兩道 3 環法術各可免費施展一次。'],
    ],
    blurb: '以知識撬開宇宙的法則。',
  },
  {
    id: 'artificer', name: '奇械師', en: 'Artificer', hd: 8, primary: ['int'], saves: ['con', 'int'],
    skillCount: 2, skillList: ['arcana', 'history', 'investigation', 'medicine', 'nature', 'perception', 'sleight'],
    armor: '輕甲、中甲、盾牌', weapons: '簡易武器', ac: { base: 14, dex: 2, shield: true },
    gear: '兩把簡易武器、輕弩與 20 支弩矢、鱗甲、盜賊工具、地城探索者套組', weapon: 'gadget', outfit: 'artificer', color: '#ffa94d',
    caster: { ab: 'int', type: 'artificer', list: 'artificer', cantrips: Array.from({ length: 20 }, (_, i) => (i + 1 >= 14 ? 4 : i + 1 >= 10 ? 3 : 2)), prepared: 'artificer' },
    subclassLevel: 3, subclass: { name: '鍊金師', desc: '以法術位製作實驗藥劑；治療與強酸、火焰、毒素法術額外加上智力調整值。' },
    features: [
      [1, '魔法巧匠', '以盜賊工具或工匠工具賦予微小物件發光、留言、氣味等小型魔法效果。'],
      [1, '施法', '以智力施法（向上取整的半施法者），必須以工具作為施法法器。'],
      [2, '注入奇械', '長休時將魔法注入物品，製作魔法裝備（如附魔武器、儲法法杖）。'],
      [3, '恰當工具', '花 1 小時以工匠工具憑空打造一套工匠工具。'],
      [6, '工具專精', '使用工具的屬性檢定熟練加值加倍。'],
      [7, '靈光一閃', '以反應為自己或盟友的屬性檢定或豁免加上智力調整值。'],
      [10, '魔法物品熟手', '可同調 4 件魔法物品，製作常見與非常見物品更快更便宜。'],
      [11, '儲法物品', '將一道 1～2 環法術存入物品，供任何人使用多次。'],
      [14, '魔法物品專家', '可同調 5 件魔法物品，無視職業、種族與等級的同調限制。'],
      [18, '魔法物品大師', '可同調 6 件魔法物品。'],
      [20, '靈魂奇械', '每件同調物品使豁免 +1；降至 0 生命時可犧牲一件注入改為 1 生命。'],
    ],
    blurb: '以齒輪與符文重塑魔法——亦稱「工匠」，發明即是咒語。',
  },
  {
    id: 'psion', name: '心靈使', en: 'Psion', hd: 6, primary: ['int'], saves: ['int', 'wis'], beta: 'UA 2025/10',
    skillCount: 2, skillList: ['arcana', 'insight', 'intimidation', 'investigation', 'medicine', 'perception', 'persuasion'],
    armor: '無', weapons: '簡易武器', ac: { base: 10, dex: 99 },
    gear: '矛、兩把匕首、輕弩與 20 支弩矢、弩矢匣、地城探索者套組、6 金幣（或改拿 50 金幣）', weapon: 'psi', outfit: 'psion', color: '#ff5ca8',
    caster: { ab: 'int', type: 'full', list: 'psion', cantrips: tiers(2, 3, 4), preparedTable: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22] },
    subclassLevel: 3, subclass: { name: '念動者', desc: '念力推拉可改擲 1d4 並附加擊倒、束縛或念力箭效果；法師之手射程與負重提升；永遠準備雲刃、浮空術、護盾術、雷鳴波等念動法術。' },
    features: [
      [1, '心靈能量', '獲得心靈能量骰（4d6，5 級 6d8、9 級 8d8、11 級 8d10、13 級 10d10、17 級 12d12），短休恢復一顆、長休全滿。附贈動作念力推拉生物，並擁有 30 呎心靈感應。'],
      [1, '施法', '以智力施法（全施法者）；心靈法術不需言語與一般材料成分。'],
      [1, '隱微念力', '習得法師之手，可不需姿勢成分並讓幽靈手隱形。'],
      [2, '心靈修練', '習得兩項修練（如生物回饋、毀滅思緒、心靈反衝），以心靈能量骰強化法術與檢定；5、10、13、17 級各再獲得一項。'],
      [5, '心靈復原', '冥想 1 分鐘恢復所有心靈能量骰，每長休一次。'],
      [7, '心靈湧動', '擲心靈能量骰後可消耗一顆生命骰，將 1～3 的結果視為 4。'],
      [18, '心靈儲備', '擲先攻時，心靈能量骰回復至至少四顆。'],
      [19, '史詩恩賜', '獲得一項史詩恩賜專長。'],
      [20, '燃燒生命力', '每回合一次，消耗一或兩顆生命骰，額外擲等量的心靈能量骰。'],
    ],
    blurb: '心念一動，萬物隨之起舞。（Unearthed Arcana 試玩職業）',
  },
];

// ---------- 背景 ----------
export const BACKGROUNDS = [
  { id: 'acolyte', name: '侍僧', en: 'Acolyte', skills: ['insight', 'religion'], feature: '信仰庇護：可在神殿獲得庇護與協助。', extra: '兩種語言' },
  { id: 'charlatan', name: '騙徒', en: 'Charlatan', skills: ['deception', 'sleight'], feature: '假身分：擁有一套完整的偽造身分。', extra: '偽裝套組、偽造套組' },
  { id: 'criminal', name: '罪犯', en: 'Criminal', skills: ['deception', 'stealth'], feature: '犯罪人脈：可聯絡地下世界的線人。', extra: '盜賊工具、一種賭具' },
  { id: 'entertainer', name: '藝人', en: 'Entertainer', skills: ['acrobatics', 'performance'], feature: '應眾要求：總能找到地方表演換取食宿。', extra: '偽裝套組、一種樂器' },
  { id: 'folk-hero', name: '平民英雄', en: 'Folk Hero', skills: ['animal', 'survival'], feature: '鄉野款待：平民願意收留並掩護你。', extra: '一種工匠工具、陸上載具' },
  { id: 'guild-artisan', name: '公會工匠', en: 'Guild Artisan', skills: ['insight', 'persuasion'], feature: '公會會員：受到公會的支援。', extra: '一種工匠工具、一種語言' },
  { id: 'hermit', name: '隱士', en: 'Hermit', skills: ['medicine', 'religion'], feature: '發現：在隱居中得知一個重大秘密。', extra: '草藥套組、一種語言' },
  { id: 'noble', name: '貴族', en: 'Noble', skills: ['history', 'persuasion'], feature: '特權地位：上流社會願意接見你。', extra: '一種賭具、一種語言' },
  { id: 'outlander', name: '化外之民', en: 'Outlander', skills: ['athletics', 'survival'], feature: '漫遊者：記憶地形，總能找到食物與水。', extra: '一種樂器、一種語言' },
  { id: 'sage', name: '賢者', en: 'Sage', skills: ['arcana', 'history'], feature: '研究者：知道去哪裡找到想要的知識。', extra: '兩種語言' },
  { id: 'sailor', name: '水手', en: 'Sailor', skills: ['athletics', 'perception'], feature: '船上通行：可免費搭船。', extra: '航海工具、水上載具' },
  { id: 'soldier', name: '士兵', en: 'Soldier', skills: ['athletics', 'intimidation'], feature: '軍階：軍方人員認可你的階級。', extra: '一種賭具、陸上載具' },
  { id: 'urchin', name: '街童', en: 'Urchin', skills: ['sleight', 'stealth'], feature: '城市秘徑：在城市中移動速度加倍。', extra: '偽裝套組、盜賊工具' },
  { id: 'custom', name: '自訂背景', en: 'Custom', skills: [], custom: true, feature: '與 DM 討論自訂背景特性。', extra: '' },
];

export const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const ASI_LEVELS = [4, 8, 12, 16, 19];
