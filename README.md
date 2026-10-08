# 龍鑄 DragonForge

D&D 5e 3D 角色建立器（PoC）。純前端靜態網站：Vite + Three.js，不需要後端。

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 輸出 dist/，可直接部署到 GitHub Pages
```

## 功能
- **3D 捏臉（VRM 動漫模型）**：使用 three-vrm 載入 10 個 VRoid 官方樣本模型（MToon 著色、表情、眨眼、視線追蹤、頭髮物理）。可選素體、借用其他模型的髮型、調整膚色／髮色／瞳色／服裝色、身高／體格／頭身比、表情；種族特徵（尖耳、獸耳、角、尾巴、翅膀、獠牙、鬍鬚）與職業裝備（武器、披風、肩甲、法袍、帽子）掛在骨骼上。
- **Q 版積木模式**：程序化生成的模型（toon 著色＋描邊），載入最快，適合舊手機；可調整身高、體格、體型、頭身比、膚色、瞳色、眼睛發光、眉型、紋樣、鬍鬚、9 種髮型、耳朵（尖耳／貓耳／狐耳／兔耳）、角、尾巴、翅膀、獠牙、龍吻、頭飾、服裝配色與靈光色；武器與服裝隨職業改變。
- **舞台演出**：魔法陣、泛光、粒子、鏡頭運鏡、施法特效、升級橫幅、合成音效（WebAudio）。
- **制式 5e 規則（SRD 5.1）**：9 個種族（含龍裔血統）、14 個職業 1–20 級（含奇械師／工匠 Artificer，以及 UA 試玩版心靈使 Psion）、購點／標準數組／4d6 擲骰、屬性值提升、背景、技能、豁免、生命值、AC、法術位（全施法者／半施法者／奇械師／契約魔法）、戲法與法術數量，以及 264 道法術（SRD 為主）。
- **自訂工坊**：自訂種族（屬性加值、技能、特性、3D 外觀預設）與自訂法術（環級、學派、職業、特效顏色）；可匯出內容包 JSON 或分享碼給團員。
- **角色卡 PNG**：1080×1350（4:5）角色卡，手機上的 Discord 也看得清楚；可下載、複製（電腦版貼到 Discord）或用系統分享（手機選 Discord）。角色資料藏在 PNG 的 tEXt 區塊，原檔拖回網站即可匯入。
- **角色庫**：儲存在瀏覽器 localStorage；可匯出／匯入 JSON、複製分享連結（角色與它用到的自訂內容會一起壓縮進網址）、下載立繪、列印角色卡。

## 結構
- `src/data/rules.js`：種族、職業、背景、法術位表
- `src/data/spells.js`：法術資料
- `src/state.js`：角色狀態與規則推導
- `src/scene/avatar.js`：Q 版模型、共用配件與姿勢
- `src/scene/vrmAvatar.js`：VRM 模型載入、換髮、調色、骨骼比例與配件掛點
- `src/scene/stage.js`：場景、後製、鏡頭、特效
- `src/main.js`：介面與各步驟
- `src/workshop.js`：自訂工坊
- `src/card.js`：角色卡繪製與 PNG 資料嵌入

## 3D 模型
`public/models/` 內的 VRM 來自 VRoid Project 官方釋出的早期樣本模型（[OpenGameArt 彙整](https://opengameart.org/content/vroid-studio-cc0-models)）。模型內嵌的授權資訊：素體與髮型樣本標示為 CC0；其餘樣本允許任何人使用、商用、修改與再散布，且不需署名。

模型已用 `tools/optimize-vrm.mjs` 壓縮（貼圖縮小、移除未使用的 morph target），每個約 2.4–4.4MB：

```bash
node tools/optimize-vrm.mjs 原始.vrm public/models/<id>.vrm public/models/<id>.jpg
```

新增模型時，也要在 `src/scene/vrmAvatar.js` 的 `VRM_MODELS` 加一筆。

規則內容依據 System Reference Document 5.1（CC-BY-4.0）。
