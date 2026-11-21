# 🧩 ai-food-shorts

> 半自動 AI 美食 Shorts 流程：9:16 關鍵影格文生圖 → Google Flow 圖生影 → FFmpeg 一鍵成片（含字幕與響度正規化）。

**版本**：0.2.1

## 這個技能做什麼

| 階段 | 內容 | 誰做 |
|---|---|---|
| 一 | 分鏡企劃、10 張 9:16 關鍵影格、SRT 字幕 | Agent 自動 |
| 二 | 圖生影（Google Flow / Veo 3.1） | **使用者手動**（30–60 分/支） |
| 三 | 拼接、加速、字幕燒錄、響度正規化 | Agent 自動 |

階段二是人工操作，這是刻意設計——用關鍵影格鎖畫面再圖生影，能把影片模型的抽卡次數壓到最低。

## 環境需求

- **Python 3.9+**
- **FFmpeg**（需含 `libass`，用來燒字幕）
  - Windows：`winget install Gyan.FFmpeg` 或下載 full build
  - macOS：`brew install ffmpeg`
  - 驗證：`ffmpeg -filters | grep ass` 有輸出即可
- 產出物：1080×1920 / 30fps / H.264 / AAC 192k

## 🚀 Antigravity 一鍵安裝方式

> ⚠️ **必須整包安裝**。`SKILL.md` 依賴 `references/` 與 `scripts/`，只複製 SKILL.md 會得到一個跑不動的技能。

### 🌐 免下載！Windows (PowerShell) 雲端一行直裝

```powershell
$u="https://github.com/Lin-Yu-kuan/art/archive/refs/heads/main.zip"; $d="$HOME\.gemini\config\skills\ai-food-shorts"; $t=Join-Path $env:TEMP ("skills-"+[guid]::NewGuid()); Invoke-WebRequest $u -OutFile "$t.zip" -ErrorAction Stop; Expand-Archive "$t.zip" $t -Force -ErrorAction Stop; New-Item -ItemType Directory -Path $d -Force | Out-Null; Copy-Item "$t\art-main\ai-food-shorts\*" $d -Recurse -Force -ErrorAction Stop; Remove-Item "$t.zip",$t -Recurse -Force -ErrorAction SilentlyContinue; Write-Host "✅ ai-food-shorts 技能套件已成功安裝！" -ForegroundColor Green
```

### 🍎 免下載！macOS / Linux 雲端一行直裝

```bash
mkdir -p "$HOME/.gemini/config/skills" && curl -fsSL "https://github.com/Lin-Yu-kuan/art/archive/refs/heads/main.tar.gz" | tar -xz -C "$HOME/.gemini/config/skills" --strip-components=1 "art-main/ai-food-shorts/" && echo "✅ ai-food-shorts 技能套件已成功安裝！"
```

### 💬 免開終端機！聊天框「自然語言安裝」

> 「請幫我從 GitHub 安裝 `Lin-Yu-kuan/art` 的 `ai-food-shorts` 技能到我的技能目錄。」

### 💻 本機維護者軟連結（Symlink，改動即時生效）

Windows 需管理員權限或開啟開發人員模式：

```powershell
New-Item -ItemType SymbolicLink -Path "$HOME\.gemini\config\skills\ai-food-shorts" -Target (Get-Location).Path -Force
```

```bash
ln -sfn "$(pwd)" "$HOME/.gemini/config/skills/ai-food-shorts"
```

### 📁 已 Clone 完整倉庫者的本地安裝

```powershell
Copy-Item -Path ".\ai-food-shorts" -Destination "$HOME\.gemini\config\skills\ai-food-shorts" -Recurse -Force
```

```bash
cp -r ./ai-food-shorts "$HOME/.gemini/config/skills/ai-food-shorts"
```

## 使用

在對話中直接說：

- 「用 ai-food-shorts 做一道蒜香奶油牛排的短片企劃」
- 「用 ai-food-shorts 剪輯 `projects/20261118_garlic_butter_steak`」

或直接呼叫腳本：

```bash
# 先看計畫，不編碼
python scripts/assemble_shorts.py --project ./projects/20261118_garlic_butter_steak --dry-run

# 實際出片
python scripts/assemble_shorts.py --project ./projects/20261118_garlic_butter_steak

# 覆寫既有輸出
python scripts/assemble_shorts.py --project ./projects/20261118_garlic_butter_steak --force
```

## 目錄結構

```text
ai-food-shorts/
├── SKILL.md                          # 技能定義與完整工作流程
├── README.md                         # 本文件
├── assets/
│   ├── README.md                     # 分身圖放置說明
│   └── host_avatar.png               # （選用）主持人分身參考圖
├── references/
│   ├── style_guide.md                # 視覺鎖定詞庫、防穿幫、模型成本分級
│   └── storyboard_template.md        # storyboard.md 輸出格式範本
└── scripts/
    └── assemble_shorts.py            # 階段三自動剪輯
```

## 產出物

```text
projects/<YYYYMMDD>_<dish_slug>/
├── keyframes/01.png … 10.png
├── clips/01.mp4 … 10.mp4             # 使用者從 Google Flow 下載
├── output/
│   ├── final_short.mp4               # 成片
│   ├── subtitles.ass                 # 由 SRT 轉出，可直接微調
│   └── assemble_report.json          # 每鏡長度、來源解析度、警告
├── storyboard.md
└── subtitles.srt
```

## 疑難排解

| 症狀 | 原因 | 處置 |
|---|---|---|
| `找不到 ffmpeg` | 未安裝或不在 PATH | 安裝 FFmpeg 並重開終端機 |
| `此 FFmpeg 未編譯 libass` | 精簡版 build | 換 full build，或加 `--no-subs` |
| 字幕在畫面正中間 | 0.1.x 的 PlayRes bug | 升級到 0.2.0 |
| 字幕與畫面不同步 | SRT 用了原始素材時軸 | SRT 要寫「加速後」的累計時間 |
| `輸出檔已存在` | 防覆寫保護 | 加 `--force` 或 `--out` |
| 鏡頭順序錯亂 | 檔名沒補零 | 用 `01.mp4`…`10.mp4` |

## Changelog

### 0.2.1

- **修正 Shot 1 Veo 3.1 音訊失敗問題**：從 `style_guide.md` 與 `storyboard_template.md` 的分身登場 Prompt 移除容易觸發 `Audio generation failed` 的 `gentle natural breathing`、`room tone`、`hiss` 描述，改為食物滋滋聲，並在 `SKILL.md` 常見失敗表補上處置方式。

### 0.2.0

- **修正字幕位置 bug**：原 `force_style` 的 `MarginV=180` 被 libass 當成 PlayRes 單位（預設 288）而非像素，實際位移 1200px，字幕落在畫面正中央。改為將 SRT 轉成帶 `PlayResX/Y: 1080/1920` 的 ASS 再燒錄，`--font-size` / `--margin-v` 從此是**真實像素**。
- **修正安裝方式**：原本一行安裝只下載 `SKILL.md`，缺 `references/` 與 `scripts/` 完全跑不動。
- **移除硬編碼路徑**：`C:\Users\...\antigravity\scratch\...` 改為相對於當前工作目錄的 `projects/`。
- **修正工具名**：`image-generator` → WorkBuddy 的 `ImageGen`（Antigravity 環境仍用原名）。
- **修正檔名排序**：`sorted()` 改自然排序，`1/2/10.mp4` 不再排成 `1/10/2`。
- **新增防覆寫保護**：輸出檔存在時預設拒絕，需 `--force` 或 `--out`。
- **新增音軌長度對齊**：`apad` + `atrim` 讓每段音訊精準等長於畫面，避免累積性音畫不同步。
- **新增 `--dry-run`**：先看剪輯計畫與警告再編碼。
- **新增警告系統**：片段過短、非 9:16、字幕時軸與成片長度不符，都會明確提示。
- **新增 `assemble_report.json`**：記錄每鏡的來源長度、取用長度、輸出長度。
- **響度目標改 -14 LUFS**（原 -16），對齊 YouTube 正規化。
- **移除失效的自動更新章節**：原本指向 `github.com/user/art` 佔位符且無 `.skillkit/skills.json`。
- **誠實標註流程性質**：文件開頭明確說明階段二為人工操作。

### 0.1.0

- 初版：三階段流程、style guide、FFmpeg 拼接腳本。
