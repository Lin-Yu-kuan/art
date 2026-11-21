# 🧩 motion-showreel

> 用程式碼逐幀渲染動態圖形影片：確定性 render(t) 加 ffmpeg 合成，輸出 MP4 與可重建原始碼，不需顯示卡。

**這是「用程式碼畫動畫」，不是擴散模型生成影片。** 頁面暴露一個確定性的 `render(t)` 純函式，Playwright 逐幀截圖，再由 ffmpeg 合成 MP4。因此不需要 GPU、不需要下載模型權重、不需要雲端 API（只有要 TTS 旁白時才需要對應憑證）。

## ✨ 能做什麼

| 場景 | 說明 |
|---|---|
| 片頭 / Logo 演繹 / 動態字型 | 5–60 秒短片，動效密度高 |
| 產品功能展示、UI 動效 | 介面元素逐個動作，可精確到幀 |
| 動態排版 / 卡點影片 | 節拍網格驅動，剪點落在拍上 |
| 知識科普、白板講解、帶旁白解說 | 口播驅動模式，畫面跟隨真實語音時間戳 |
| 資料爆點、生成藝術循環 | 循環接縫由工具驗收 |
| 長片 | 按章節製作，最長 20 分鐘（1200 秒） |

**做不好的**：寫實人物、複雜手部／布料／毛髮、需要真實物理精度的東西、照片級產品（除非你提供模型或圖片）。這些請改用影片生成模型（如 Wan2.2、HunyuanVideo）或實拍。

## 📦 內含什麼

- **43 種風格庫**（`references/styles/`）：swiss-editorial、水墨、risograph、synthwave、像素遊戲、漫畫分鏡、國潮、白板講解、cel-anime-80s、cinematic-title…每個風格定義「外觀 + 運動 + 鏡頭語法 + 聲音調色盤」，並標註「辨識訊號」與「最俗的版本」。
- **兩種配樂引擎**：`score.mjs`（Node 內建合成器，零依賴）與 `score.tone.js`（Tone.js 離線渲染，可下載 CC BY 鋼琴取樣）。
- **剪輯工作區**：帶聲音預覽、拖動、逐幀檢查、多軌調音，確認後一鍵匯出。
- **驗收工具**：尺寸、幀率、時長、幀數、音軌、黑幀、響度、真峰值、循環接縫，任一項 FAIL 即退出碼 1。
- **參考片拆解**：給一支參考影片，量出剪點、節拍網格、每段運動熱圖。

## ⚙️ 依賴需求

| 依賴 | 要求 |
|---|---|
| Node.js | 18+ |
| Playwright + Chromium | 由 `scripts/setup.sh` 自動安裝（約 150MB） |
| ffmpeg | 需系統自備，工具不會代裝 |
| TTS（可選） | Gemini / MiniMax / OpenAI，或自訂適配器；不用 TTS 則完全離線 |

首次使用先跑環境檢查：

```bash
sh scripts/setup.sh        # 安裝 Playwright + Chromium，並跑 check-env
node scripts/check-env.mjs # 只檢查，不安裝
cd scripts && npm run test:smoke   # 快速自檢（約 15 秒）
cd scripts && npm run test:full    # 完整測試（含整片渲染，10–30 分鐘）
```

## 🚀 安裝

> ⚠️ **必須整包安裝**。`SKILL.md` 依賴 `references/`、`scripts/` 與 `assets/`，只複製 `SKILL.md` 會得到一個跑不動的技能。

### WorkBuddy

```bash
git clone https://github.com/Lin-Yu-kuan/art /tmp/art-src
cp -r /tmp/art-src/motion-showreel "$HOME/.workbuddy-ai/skills/motion-showreel"
```

Windows PowerShell：

```powershell
Copy-Item -Path ".\motion-showreel" -Destination "$HOME\.workbuddy-ai\skills\motion-showreel" -Recurse -Force
```

### Antigravity / Gemini

### 🌐 免下載！Windows (PowerShell) 雲端一行直裝

```powershell
$u="https://github.com/Lin-Yu-kuan/art/archive/refs/heads/main.zip"; $b="$HOME\.gemini\config\skills"; $t=Join-Path $env:TEMP ("skills-"+[guid]::NewGuid()); Invoke-WebRequest $u -OutFile "$t.zip" -ErrorAction Stop; Expand-Archive "$t.zip" $t -Force -ErrorAction Stop; @("motion-showreel") | ForEach-Object { $d="$b\$_"; New-Item -ItemType Directory -Path $d -Force | Out-Null; Copy-Item "$t\art-main\$_\*" $d -Recurse -Force -ErrorAction Stop }; Remove-Item "$t.zip",$t -Recurse -Force -ErrorAction SilentlyContinue; Write-Host "✅ motion-showreel 技能套件已成功安裝！" -ForegroundColor Green
```

### 🍎 免下載！macOS / Linux 雲端一行直裝

```bash
mkdir -p "$HOME/.gemini/config/skills" && curl -fsSL "https://github.com/Lin-Yu-kuan/art/archive/refs/heads/main.tar.gz" | tar -xz -C "$HOME/.gemini/config/skills" --strip-components=1 "art-main/motion-showreel/" && echo "✅ motion-showreel 技能套件已成功安裝！"
```

### 💬 免開終端機！聊天框「自然語言安裝」

> 「請幫我從 GitHub 安裝 `Lin-Yu-kuan/art` 的 `motion-showreel` 技能到我的技能目錄。」

### 💻 本機維護者軟連結（Symlink，修改即時生效）

在技能目錄下執行（Windows 需管理員權限或開發人員模式；Windows 目錄連結用 `mklink /J` 不需要管理員權限）：

```powershell
New-Item -ItemType SymbolicLink -Path "$HOME\.gemini\config\skills\motion-showreel" -Target (Get-Location).Path -Force
```

```bash
ln -sfn "$(pwd)" "$HOME/.gemini/config/skills/motion-showreel"
```

### 📁 已 Clone 完整倉庫者的本地安裝

```powershell
Copy-Item -Path ".\motion-showreel" -Destination "$HOME\.gemini\config\skills\motion-showreel" -Recurse -Force
```

```bash
cp -r ./motion-showreel "$HOME/.gemini/config/skills/motion-showreel"
```

## 🎬 怎麼用

裝好後直接在對話框說：

- 「用 motion-showreel 做一支 15 秒的季度產品發布片頭，橫屏，BGM 你合成，不要口播」
- 「把這篇文章做成 3 分鐘帶旁白的解說影片，豎屏」

技能會依序停下來問你三件事：**需求 → 風格方向（會渲三張關鍵幀給你選）→ 匯出前預覽**。這三個確認點不是可省略的流程，跳過它們的結果就是抽卡。

想直接手動跑：

```bash
sh scripts/scaffold.sh my-reel --audio synth      # 建專案
node scripts/render.mjs my-reel --still 0.5,3,7 --sheet   # 渲靜幀看畫面
node scripts/editor.mjs my-reel --size 1920x1080 --fps 30 # 開工作區預覽
sh my-reel/build.sh --subframes 2 --grain 4       # 確認後出片
```

## ⚠️ 兩個一定要知道的事

1. **預設審美會撞牆**。沒有強約束時，模型會滑向「深色背景 + 置中大字 + 元素一起淡入 + 紫藍漸變發光」，配樂則是 A 小調四踩。**上限取決於你給的視覺方向**（對標作品 + 禁止清單），技能不會替你有品味。
2. **渲染時間線性增長**。30fps、2 分鐘 = 3600 幀；開 `--subframes` 運動模糊會翻倍。短片很舒服，長片要排隊。

## 📂 檔案目錄結構

```text
motion-showreel/
├── SKILL.md              # 技能定義、工作流、底線
├── README.md             # 本說明檔案
├── LICENSE.upstream      # 上游 MIT 授權（ConardLi/garden-skills）
├── assets/
│   ├── editor/           # 剪輯工作區前端
│   └── starter/          # 專案起始模板
├── references/
│   ├── formats.md        # 10 類用途（A–J）
│   ├── craft.md          # 手法庫：節奏、運動、轉場、排版
│   ├── stack.md          # 頁面契約、確定性、各技術的坑
│   ├── recipes.md        # 現成寫法
│   ├── sound.md          # 配樂與混音
│   ├── narration.md      # TTS 與口播時間軸
│   ├── long-form.md      # 20 分鐘長片分章
│   ├── review.md         # 審片表與驗收清單
│   ├── editor.md         # 工作區操作
│   ├── progress.md       # 製作進度頁
│   ├── brief-template.md # brief 模板
│   └── styles/           # 43 種風格 + INDEX + _template
└── scripts/              # setup / scaffold / render / editor / audio /
                          # narration / inspect / build-long / progress / preview
                          # lib/（共用模組）· test/（node --test 測試）
```

## 🔄 智慧無感自動更新（已安裝者）

在對話框說「幫我更新 motion-showreel」或「檢查 motion-showreel 最新版本」，Agent 會比對 `.skillkit/skills.json` 的版本與 SHA-256，驗證通過才備份並**整包覆蓋**。這是套件型技能，更新時不會只換 `SKILL.md`（只換會讓 `scripts/` 與文件版本漂移）。

## 🩺 疑難排解

| 症狀 | 原因 | 處置 |
|---|---|---|
| `[x] node` / `[x] ffmpeg` | 未安裝或不在 PATH | 安裝後重開終端機，再跑 `node scripts/check-env.mjs` |
| `browser not found` / 啟動 Chromium 失敗 | 未跑 setup 或 Playwright 版本不符 | `sh scripts/setup.sh` |
| 渲出的字型不對／方塊字 | 字型沒自託管或沒載完 | 字型放進專案 `fonts/`，載入完成才設 `READY = true` |
| 畫面每次渲出來不同 | 用了 `Math.random`／`Date.now`／CSS 動畫 | 跑 `render.mjs --determinism`，改成只由 `t` 決定 |
| 匯出後某幾幀文字疊印 | 子幀運動模糊遇上文案硬切 | 見 `references/stack.md` 的可選取樣上下文 |
| `timeline DUR must be positive…` | `DUR` 沒寫或超過 1200 秒 | 在 `timeline.js` 寫正確秒數，與使用者確認後再建 |
| 驗收 FAIL：`duration` 不符 | `DUR` 與實際幀數不一致 | 改 `DUR` 或重新確認片長，不要手動改檢查參數 |
| 驗收顯示 `NOT CHECKED` | 沒傳 `--expect-*` | 補上尺寸、幀率、時長、`--audio` 後重跑 |
| 工作區改了音軌但匯出沒變化 | 改了工作階段卻繞回 `build.sh` 原混音 | 用工作區「匯出影片」，或先寫回 `audio/final.wav` |
| Windows 執行 `sh` 失敗 | 沒有 POSIX shell | 裝 Git for Windows，用 Git Bash 執行 `sh scripts/...` |
| Windows 跑 `test:full` 出現 `spawn ENAMETOOLONG`／`EPERM: symlink` | 測試用到超長命令列與 symlink，Windows 需管理員或開發人員模式 | 本機只跑 `npm run test:smoke`；`test:full` 交給 CI 或 WSL |
| `npm test` 跑很久 | 測試真的在渲幀與編碼 | 用 `npm run test:smoke` 快速自檢，`npm run test:full` 交付前跑 |

## Changelog

### 0.2.2

- **繁體中文移植收尾**：`references/` 全部文件、剪輯工作區與進度頁介面字串改為台灣繁體中文（先前只有 `SKILL.md` 與 `README.md` 是繁體，其餘仍為簡體）。
- **對話語言約定**：新增語言條款，對話、`brief.md`、畫面文案與字幕預設使用台灣繁體中文。
- **更新流程改為整包覆蓋**：原本只覆寫 `SKILL.md`，會造成 `scripts/`、`references/` 與文件版本漂移；改為下載整包、驗證 `SKILL.md` SHA-256、備份整個資料夾後覆蓋。
- **倉庫位址**：`repository`／`update_url` 從佔位符 `user/art` 改為 `Lin-Yu-kuan/art`。
- **README**：補 WorkBuddy 安裝方式、疑難排解與本 Changelog；`formats.md` 更正為 10 類用途。
- **測試分層**：新增 `test:smoke`（快速自檢）與 `test:full`（完整渲染），CI 只跑 smoke。

### 0.2.1

- 移植自上游 `ConardLi/garden-skills` 的 `motion-showreel` v0.2.1，改為繁體中文並調整安裝指引。

## 📄 授權與出處

本技能移植自 [ConardLi/garden-skills](https://github.com/ConardLi/garden-skills) 的 `motion-showreel` v0.2.1，MIT 授權（見 `LICENSE.upstream`）。本倉庫版本改為台灣繁體中文（含 `references/` 與工作區介面）、調整跨技能引用與安裝指引，技術指令與工具行為保持一致。
