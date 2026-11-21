# 技術棧：頁面契約、確定性和各技術的坑

目錄：1 頁面契約 · 2 確定性 · 3 按畫面選技術 · 4 Canvas 2D · 5 DOM / SVG · 6 WebGL 後期 · 7 Three.js · 8 p5.js · 9 字型 · 10 素材 · 11 多畫幅 · 12 效能與渲染時間

---

## 1. 頁面契約

```js
window.DUR = 16;                  // 秒，render.mjs 用它算總幀數（timeline.js 匯出）
window.render = (t) => { ... };   // 畫出第 t 秒；確定性；可以返回 Promise（比如要等影片幀解碼）
window.READY = true;              // 字型、圖片、模型、紋理全部載入完以後再設定
```

- 渲染工具用 HTTP 服務專案目錄（這樣 ES module、字型、glTF 都能載入），視口 = `--size`，DPR = `--dpr`。頁面通過 `stageSize()` 讀 `?w=&h=`，按這個尺寸排版。
- 頁面裡的 JS 報錯、必需的腳本 404，工具都會立刻退出並列印錯誤；可選檔案 404 只會警告。
- `--out` 相對執行命令時的工作目錄解析，與專案引數分別計算；沒有先進入專案目錄時，傳 `<slug>/qa/...` 或絕對路徑。
- 預覽：`npx serve <slug>` 或任意靜態服務，開啟 `index.html?w=1920&h=1080`，在控制台呼叫 `render(3.2)` 就能看第 3.2 秒。也可以臨時加一個 `?play=1` 分支，用 rAF 驅動 `render(performance.now()/1000 % DUR)` 方便除錯，但**渲染時這個分支不能執行**。

### 子幀取樣中的文字和硬切（可選）

使用 `--subframes 2` 等運動模糊設定時，兩個取樣可能跨過文案切換點，把新舊文字混在一幀裡。需要避免這種情況的專案可顯式啟用取樣上下文：

```js
window.RENDER_CONTEXT = true;
window.render = (t, frame = {}) => {
  const copyTime = frame.frameTime ?? t;
  // 文案內容、硬切狀態由 copyTime 決定。
  const caption = copyTime < 2 ? 'BEFORE' : 'AFTER';
  // 物體運動、文字位移和有意的淡化仍用 t，保留運動模糊。
  drawScene(t, caption);
};
```

啟用後，渲染器額外傳入 `{ frameTime, fps }`：`t` 是當前子幀時間，`frameTime` 是這一輸出幀的準確時間，包含分段匯出的起點。普通預覽和手動呼叫仍可只傳 `t`，因此第二個引數應保留預設值和回退。未啟用的舊專案仍按原來的一引數 `render(t)` 呼叫，不改變預設取樣、幀率或效果。不要將所有動畫時間取整，也不要把有意的交叉淡化改成硬切。

### 預設工作區與輕量除錯預覽

製作預設執行 `node <skill>/scripts/editor.mjs <slug> --size <本片尺寸> --fps <本片幀率>`，主動開啟工作區，讓使用者確認預覽後再生成 MP4，詳見 `editor.md`。下面的 `preview.mjs` 保留為輕量除錯工具，不自動替代工作區審片。

`preview.mjs` 在記憶體中加入控制元件，不修改專案原始檔，舊專案可直接使用。新腳手架也包含 `preview.js`，便於通過普通靜態服務預覽；手動接入時複製該檔案，並在 `body` 中加入 `<script type="module" src="./preview.js"></script>`。控制元件只在 `?preview=1` 且不是 `render=1` 時執行，不改變頁面的 `render(t)`。

```bash
node <skill>/scripts/preview.mjs <slug> --size 1920x1080 --fps 30
# 指定專案內音軌（路徑相對專案）：
node <skill>/scripts/preview.mjs <slug> --size 1080x1920 --audio audio/final.wav
```

開啟列印的本機地址，點選播放。支援暫停、拖動、左右逐幀和預覽倍速；有音軌時以 `audio.currentTime` 驅動畫面，無音軌時用預覽時鐘。未指定音軌時按 `audio/final.wav`、`audio/narration.wav`、`audio/music.wav` 查詢。音軌尚未生成就做無聲動作預演，不能據此宣稱音畫已對齊。

畫面按指定寬高等比適配視窗，並給控制元件留出空間；縮放視窗不改變取幀尺寸。場景佈局仍按頁面契約使用 `stageSize()`，不要依賴預覽視窗的 `innerWidth` 或 `vw/vh`。

預覽控制元件與即時狀態只負責呼叫 `render(t)`，正式渲染仍按確定性時間取幀；`?render=1` 時不建立播放器、控制元件或動畫循環。倍速隻影響預覽，不改變原稿、音訊檔案或匯出規格。用代表性連續片段檢查主體狀態、鏡頭承接與關鍵詞事件，不以幀率數字代替觀感審查。

## 2. 確定性

渲染器會按任意順序、任意次數呼叫 `render(t)`：多個 worker 分段並行、單幀預覽、只重渲一段、運動模糊的子幀。只要有一點狀態藏在上一幀裡，重渲出來的畫面就會不一樣。

| 禁止 | 改成 |
|---|---|
| `Math.random()` | `rng(seed)`（在 render 裡按固定種子新建）或 `hash(i, seed)` |
| `Date.now()` / `performance.now()` / rAF / `setTimeout` | 只用引數 t |
| CSS `transition` / `animation` / Web Animations | 在 render(t) 裡直接寫樣式（transform、opacity、clip-path…） |
| 逐幀累加的位置、速度（`x += v`） | 解析式 `x(t)`；彈簧用 `spring` / `springTo` |
| 物理 / 流體等必須累積的模擬 | 從 0 固定步長推到 t（可以快取，但單幀也必須能算對），或者預先烘焙成陣列 |
| `<video>` 元素自然播放 | 設定 `video.currentTime = t` 並等 `seeked` 事件（render 返回 Promise），或者先用 ffmpeg 拆成圖片序列 |
| 視口相關的隨機佈局 | 種子化，並且只依賴 W/H |

每次大改後跑一次 `render.mjs <slug> --determinism`。

## 3. 按畫面選技術

**先定畫面風格，再選能做出這種風格的最簡單的技術。**能用一種做完就不要混三種；要混時按「內容層 → 質感層」疊，每一層都能單獨跑、單獨檢查。

| 技術 | 擅長 | 不擅長 |
|---|---|---|
| Canvas 2D | 像素、扁平圖形、幾何、排版、粒子（幾千個以內）、手繪線條；規則網格的偽 3D 體塊（`camera3d` + `drawBoxes`，recipes.md 第 15 節） | 上萬個粒子、逐像素的質感、互相穿插的 3D 物體 |
| DOM / CSS / SVG | 介面動效、真實的文字排版、SVG 描邊、產品截圖卡片 | 成千上萬個元素、複雜質感 |
| WebGL 片元著色器 | CRT、顆粒、色差、半調、液態、噪聲場、SDF 圖形 | 直接畫內容和文字（一般先用 Canvas 畫，再當紋理送進著色器） |
| Three.js | 3D 場景、擠出文字、例項化陣列、玻璃金屬材質、空間鏡頭 | 寫實人物 |
| p5.js + p5.brush | 彩鉛、水彩、蠟筆筆觸 | 渲染速度（筆刷很慢，先測單幀耗時） |
| Remotion / HyperFrames | 多場景長片，使用者已經在用或者點名要用 | 十幾秒的短片（單 HTML 更快），不要主動引入 |

## 4. Canvas 2D

- `setupCanvas(canvas, W, H)` 按 DPR 設定畫布尺寸，並把上下文縮放到 CSS 像素。**每一幀用 `ctx.save()` / `ctx.restore()` 包起來，不要 `setTransform(1,0,0,1,0,0)`**，否則 `--dpr 2` 時只會畫滿左上角四分之一。
- 每一幀先把背景整個填滿（不要依賴 `clearRect` 後的透明背景）。
- 文字：先 `await loadFonts([...])`，`ctx.font` 裡的字號單位是 CSS 像素。`measureText` 可以拿到字寬來排字距。
- 像素風：離屏畫布 + `imageSmoothingEnabled = false` + 整數倍放大 + 座標取整。
- 模糊、發光：`ctx.filter = 'blur(8px)'` 能用但慢，大面積的光暈放到 WebGL 裡做。
- 合成模式（`globalCompositeOperation`：`multiply`、`screen`、`destination-in` 做遮罩）是排版遮罩的利器。
- **文字禁入區**：大字和繁忙的內容（3D 體塊、粒子、拼貼、陣列）同屏時，先用 `measureText` 算出字的矩形（含升部 / 降部，再外擴約 0.15 個字號），把它當成內容不能進入的區域：用相機的取景中心（`cx / cy`）、主體的輪廓（圓形島、遮罩）或圖層順序把內容擋在外面。字壓在同色的繁忙圖形上，縮圖裡會讀成亂碼，自查時容易誤判成字型或程式碼錯誤。每個有大字的鏡頭至少渲一張靜幀，專門看字的邊緣。

## 5. DOM / SVG

- 所有樣式在 render(t) 裡直接寫：`el.style.transform = ...`。不要依賴 CSS 過渡。
- **會被縮放、包含文字的元素不要加 `will-change: transform`**，否則文字會被柵格化後再縮放，變糊。
- SVG 描邊動畫：`pathLength="1"` + `stroke-dasharray="1"` + 在 render 裡設定 `stroke-dashoffset = 1 - k`。
- 形狀變形：同一個 `<div>` 改 `width`、`height`、`border-radius`、`background`（形變容器內部的內容另外安排進場和出場）。
- DOM 裡的文字排版質量最好（連字、字距、中文標點擠壓），適合大量文字。
- 截圖類素材用 `<img>`，提前 `decode()`。

## 6. WebGL 後期

做法：內容畫在一塊 2D 畫布上 → 每幀作為紋理上傳 → 全屏三角形跑片元著色器 → 輸出到顯示畫布。完整模板見 recipes.md 的「WebGL 後期」。

- `getContext('webgl2', { preserveDrawingBuffer: true, antialias: false })`，每幀畫完呼叫 `gl.finish()`。
- 時間相關的效果把 `t` 作為 uniform 傳進去，噪聲用 `hash(uv + floor(t * fps))` 這類確定性寫法。
- **先渲一幀確認著色器真的生效了**（編譯失敗時畫面是黑的或者只顯示原始內容），再渲整片。
- 軟體渲染（SwiftShader）下很慢；macOS 上渲染工具預設使用 Metal。

## 7. Three.js

- 安裝到專案裡：`cd <slug> && npm i three`，在 `index.html` 裡用 importmap：
  ```html
  <script type="importmap">{ "imports": { "three": "./node_modules/three/build/three.module.js", "three/addons/": "./node_modules/three/examples/jsm/" } }</script>
  ```
  不要在渲染時依賴 CDN。
- `new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })`，`setPixelRatio(devicePixelRatio)`，`setSize(W, H)`。
- `render(t)` 裡：設定相機位置和朝向、物體變換、材質引數、燈光 → `renderer.render(scene, camera)`。不用 `THREE.Clock`；動畫剪輯用 `mixer.setTime(t)`。
- 後期（EffectComposer、bloom、景深）可以用，但每加一層都要確認幀時間。
- 載入 glTF / 紋理 / HDRI 時，全部 `await` 完成後再設定 READY。

## 8. p5.js

- 用例項模式 + `noLoop()`，在 `window.render = t => { T = t; p.redraw(); }` 裡驅動；`draw()` 只讀 `T`。`randomSeed`、`noiseSeed` 每幀按固定值重設。
- p5.brush 很慢，先測單幀耗時再決定時長和幀率；筆觸的隨機種子用 `floor(t * 12)`，筆觸每秒只變 12 次，看起來像手繪動畫，鏡頭仍然每幀平滑。

## 9. 字型

- **自託管**：把 `.woff2` 放進 `fonts/`，用 `@font-face` 宣告，`loadFonts()` 等它載入完再 READY。渲染時不要連結 Google Fonts。
- 拉取開源字型：`https://github.com/google/fonts/tree/main/ofl/<family>`（OFL 授權）。
- **中文**：完整的 CJK 字型有幾 MB 到十幾 MB。可以按用到的字做子集：Google Fonts CSS API 帶 `&text=` 引數，只返回這些字的字形，例如 `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@900&text=<URL 編碼的文字>`，把它指向的字型檔案下載到 `fonts/` 再本地載入。文案改了要重新做子集。沒有網路時用系統字型兜底：`"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`（不同機器渲染結果會不一樣，在交付說明裡寫明）。
- 數字跳動用 `font-variant-numeric: tabular-nums`（Canvas 裡選等寬數字的字型）。

## 10. 素材

- 使用者給的 logo、截圖、產品圖、字型：複製到 `assets/`，用相對路徑引用，不要熱鏈。
- **品牌任務必須用真實的 logo**，拿不到就停下來問，不要用一個色塊寫上品牌名冒充。
- 產品介面要用真實截圖（可以用 Playwright 截使用者給的網址，2× DPR），不要用 CSS 畫一個假介面冒充真實產品。
- 只用自己有權使用的素材，交付時把來源和授權寫清楚。

## 11. 多畫幅

- 所有佈局都從 `W`、`H` 推導：單位 `U = Math.min(W, H) / 1080`，位置用比例或網格。
- 9:16 和 16:9 不是簡單的裁切：豎屏的字要更大、排成縱向，安全區上下各留約 12%（平台 UI 會蓋住）。要出多個畫幅時，用同一條時間軸，每個畫幅單獨調版式，然後分別渲染（`--size 1080x1920`）。
- 不要把 16:9 的成片直接裁成豎屏。

## 12. 效能與渲染時間

超過 2 分鐘使用 `long-form.md` 的分章構建器，最大 1200 秒。原 `render.mjs --start --duration` 保留為取幀工具；`build-long.mjs` 在其上提供持久快取、重試和斷點恢復。音訊合成也按章，不能讓多個整片 PCM bus 耗盡記憶體。有口播時先按 `narration.md` 準備真實音訊和句段時間，再寫鏡頭時間軸。

- 渲染工具會列印每個樣本的毫秒數。預估：**總時間 ≈ 單幀耗時 × 幀數 × 子幀數 ÷ worker 數 × 1.2**。
- 參考量級（Apple Silicon、1080p）：Canvas 2D 簡單場景 15–40 毫秒/幀，DOM 排版 30–60 毫秒，WebGL 後期 +20–80 毫秒，Three.js 帶後期 80–300 毫秒。
- worker 預設 3 個，CPU 核多可以開到 4–6 個；WebGL 重的頁面 worker 太多反而更慢。
- 先在工作區即時預覽節奏，使用者確認後才渲染 MP4；`--subframes`、`--dpr`、幀率按 brief 的最終規格匯出，不為預覽擅自改動成片規格。只有使用者同意需要離線片段時才生成低清樣片。
- 渲染出錯時先在工作區定位和修正；使用者確認後可只重渲那一段：`--start 6 --duration 3 --out out/seg.mp4`，再按確認規格重建整片。
