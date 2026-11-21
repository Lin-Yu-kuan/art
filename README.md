# 🧠 AI Art & Media Skills - AI Agent 技能庫

收錄高品質的 AI Agent 技能集合（Skills），遵循標準通用 Agent Skill 規範，專為 **Google Antigravity** 及支援 Agent Skill 規範的 AI 工具打造。

[![Total Skills](https://img.shields.io/badge/Skills-2%20個專業技能-purple.svg)](#-領域分類目錄-skill-catalog)
[![Domains](https://img.shields.io/badge/Domains-1%20大領域體系-blue.svg)](#-領域分類目錄-skill-catalog)
[![Zero Download](https://img.shields.io/badge/Install-零下載雲端一行直裝-brightgreen.svg)](#-領域全家桶一鍵安裝-domain-bundles)
[![Auto Update](https://img.shields.io/badge/Update-自然語言無感更新-orange.svg)](#-智慧無感自動更新已安裝者)

---

## 🧭 快速領域導覽

- **✍️ 內容創作與個人社群 (Content & Social Voice)**（2）：[`ai-food-shorts`](./ai-food-shorts) 、 [`motion-showreel`](./motion-showreel)

---

## 🎯 我該用哪個技能？（觸發詞對照）

| 技能 | 版本 | 觸發詞 |
|---|---|---|
| [`ai-food-shorts`](./ai-food-shorts) | v0.2.1 | `美食短片`、`AI做菜`、`food shorts`、`Google Flow` |
| [`motion-showreel`](./motion-showreel) | v0.3.0 | `動態圖形`、`motion graphics`、`片頭動畫`、`動效影片`、`code video` |

---

## 📦 領域分類目錄 (Skill Catalog)

點擊下方各領域表格中的**技能名稱**或**詳細說明**即可查看完整文件與單獨一鍵安裝指令：

### ✍️ 內容創作與個人社群 (Content & Social Voice)
> 具備個人真實語氣、適度吐槽且嚴守事實邊界的跨平台社群貼文寫作與改稿。

| 技能名稱 | 版本 | 核心功能簡介 | 子類別 | 類型 | 說明文件 |
|---|---|---|---|---|---|
| [**ai-food-shorts**](./ai-food-shorts) | `v0.2.1` | 半自動 AI 美食 Shorts 流程：9:16 關鍵影格文生圖、Google Flow 圖生影 Prompt、FFmpeg 一鍵成片（含字幕與響度正規化）。 | `影像創作 / 短影音` | 📦 套件 | [查看說明](./ai-food-shorts/README.md) |
| [**motion-showreel**](./motion-showreel) | `v0.3.0` | 用程式碼逐幀渲染動態圖形影片：確定性 render(t) 加 ffmpeg 合成，輸出 MP4 與可重建原始碼，不需顯示卡。 | `影像創作 / 動態圖形` | 📦 套件 | [查看說明](./motion-showreel/README.md) |

---

## 🎁 領域全家桶一鍵安裝 (Domain Bundles)

不想一個一個技能分開貼指令？您可以根據需求，直接選擇**「全庫一鍵全裝」**或按領域選擇**「主題全家桶」**！

### 🌟 方案 A：全庫技能一鍵全裝（一次擁有全部技能）
- **Windows (PowerShell)**：
  ```powershell
  $u="https://github.com/Lin-Yu-kuan/art/archive/refs/heads/main.zip"; $b="$HOME\.gemini\config\skills"; $t=Join-Path $env:TEMP ("skills-"+[guid]::NewGuid()); Invoke-WebRequest $u -OutFile "$t.zip" -ErrorAction Stop; Expand-Archive "$t.zip" $t -Force -ErrorAction Stop; @("ai-food-shorts","motion-showreel") | ForEach-Object { $d="$b\$_"; New-Item -ItemType Directory -Path $d -Force | Out-Null; Copy-Item "$t\art-main\$_\*" $d -Recurse -Force -ErrorAction Stop }; Remove-Item "$t.zip",$t -Recurse -Force -ErrorAction SilentlyContinue; Write-Host "✅ AI Art & Media Skills 全庫 (2 個技能) 已成功安裝！" -ForegroundColor Green
  ```
- **macOS / Linux**：
  ```bash
  mkdir -p "$HOME/.gemini/config/skills" && curl -fsSL "https://github.com/Lin-Yu-kuan/art/archive/refs/heads/main.tar.gz" | tar -xz -C "$HOME/.gemini/config/skills" --strip-components=1 "art-main/ai-food-shorts/" "art-main/motion-showreel/" && echo "✅ AI Art & Media Skills 全庫 (2 個技能) 已成功安裝！"
  ```

### 📚 方案 B：按領域全家桶安裝
<details>
<summary><b>點擊展開各領域組合包一行直裝指令（國考包 / 開發治理包 / 前端創作包）</b></summary>

#### ✍️ 內容創作與個人社群 (Content & Social Voice)（含 `ai-food-shorts` + `motion-showreel`）
- **Windows (PowerShell)**：
  ```powershell
  $u="https://github.com/Lin-Yu-kuan/art/archive/refs/heads/main.zip"; $b="$HOME\.gemini\config\skills"; $t=Join-Path $env:TEMP ("skills-"+[guid]::NewGuid()); Invoke-WebRequest $u -OutFile "$t.zip" -ErrorAction Stop; Expand-Archive "$t.zip" $t -Force -ErrorAction Stop; @("ai-food-shorts","motion-showreel") | ForEach-Object { $d="$b\$_"; New-Item -ItemType Directory -Path $d -Force | Out-Null; Copy-Item "$t\art-main\$_\*" $d -Recurse -Force -ErrorAction Stop }; Remove-Item "$t.zip",$t -Recurse -Force -ErrorAction SilentlyContinue; Write-Host "✅ 社群創作 / 語氣改寫 全家桶已安裝完成！" -ForegroundColor Green
  ```
- **macOS / Linux**：
  ```bash
  mkdir -p "$HOME/.gemini/config/skills" && curl -fsSL "https://github.com/Lin-Yu-kuan/art/archive/refs/heads/main.tar.gz" | tar -xz -C "$HOME/.gemini/config/skills" --strip-components=1 "art-main/ai-food-shorts/" "art-main/motion-showreel/" && echo "✅ 社群創作 / 語氣改寫 全家桶已安裝完成！"
  ```

</details>

---

## 🚀 單一技能通用安裝指南

每個技能目錄內均有詳細的專屬安裝說明（支援 Windows PowerShell 一行直裝、macOS/Linux 一行直裝、對話框自然語言安裝與本機 Symlink）。

### 本地複製安裝（已 Clone 本倉庫者）
將目標 Skill 資料夾複製到 Antigravity 全域技能目錄：
- **Windows (PowerShell)**：
  ```powershell
  Copy-Item -Path ".\<skill-name>" -Destination "$HOME\.gemini\config\skills\<skill-name>" -Recurse -Force
  ```
- **macOS / Linux**：
  ```bash
  cp -r ./<skill-name> "$HOME/.gemini/config/skills/<skill-name>"
  ```

---

## 🔄 智慧無感自動更新（已安裝者）

本倉庫所有技能的 `SKILL.md` 均內建 `version`、`repository`、`update_url` 與自動更新指引；更新來源的版本與 SHA-256 統一記在 `.skillkit/skills.json`。

一旦您安裝過任何技能，若想取得 GitHub 上的最新版本，**不需要手動重新下載或尋找目錄**！  
只要在 Antigravity 對話框中說：
> 「幫我更新 [技能名稱]」或「檢查 [技能名稱] 最新版本」

Agent 會先讀取 `.skillkit/skills.json` 比對版本：相同就回報「已是最新」；不同才下載並驗證 SHA-256、備份原檔、覆寫更新，最後回報版本差異。校驗不符或下載失敗一律中止，不會無條件靜默覆寫。

---

## 🛠️ 倉庫自動化維護與治理工具

為解決技能數量持續增長帶來的維護負擔，本倉庫的治理工具獨立放在同層的 `skillkit` 資料夾（另一個 repo），不隨本倉庫複製：

```powershell
# 1. 檢查所有技能是否符合規範（Frontmatter、版本、更新網址、安裝指令）
.skillkit/manage.cmd lint

# 2. 一鍵同步：注入共用行為準則到各 SKILL.md、生成根目錄 README.md 與 .skillkit/skills.json
.skillkit/manage.cmd sync

# 3. CI 用：只檢查 README 是否與技能元資料同步，不寫入檔案
.skillkit/manage.cmd sync --check
```

---

## 📂 專案結構規範

本倉庫採用**「實體扁平相容 + 邏輯領域分群」**的 Monorepo 架構，確保所有雲端更新網址永久穩定：

```text
AI Art & Media Skills/
├── GEMINI.md                      # 本倉庫專屬開發規範（含領域分類、零下載安裝與自動更新標準）
├── LICENSE                        # MIT 授權條款
├── .skillkit/                     # 治理設定與索引（config.json、skills.json、manage.cmd）
├── README.md                      # 技能庫領域總覽首頁（由 skillkit 自動同步）
├── .github/workflows/skills-ci.yml # 推送時自動執行 lint、sync --check 與測試
├── scripts/
│   └── manage.py                  # 技能規範體檢 (lint) 與總目錄自動生成 (sync) 工具
├── ai-food-shorts/                # [影像創作 / 短影音]
│   ├── SKILL.md
│   ├── README.md
│   ├── assets/
│   ├── projects/
│   ├── references/
│   └── scripts/
└── motion-showreel/               # [影像創作 / 動態圖形]
    ├── SKILL.md
    ├── README.md
    ├── assets/
    ├── LICENSE.upstream
    ├── references/
    └── scripts/
```

---

## 📄 License
MIT License
