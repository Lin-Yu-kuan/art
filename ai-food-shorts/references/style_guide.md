# AI 美食短片視覺與防穿幫規範（Style Guide）

本規範旨在鎖定頻道一致的視覺語言，並最大化節省 Google Flow（Veo 3.1）的 AI Credits 消耗。

---

## 1. 頻道視覺鎖定詞庫（Visual Anchors）

所有 **Shot 2～10（料理過程 POV）** 的 Image Prompt 必須包含以下核心風格設定，確保不同集數看起來像同一間廚房：

- **畫面比例**：`9:16 vertical aspect ratio`
- **視角**：`First-person POV looking slightly down at the kitchen counter`（或局部特寫 `Extreme close-up macro shot`）
- **核心場景**：`Aged dark walnut wooden countertop, seasoned matte black cast iron skillet, warm cozy kitchen background softly blurred`
- **光線色調**：`Warm golden-hour side lighting, rich appetizing food colors, realistic food photography, shallow depth of field, 35mm lens`

---

## 2. 開頭分身登場規範（Shot 1：Host Avatar Intro，選用）

若專案有設定主持人分身參考圖（`assets/host_avatar.png` 或 `.jpg`），**Shot 1（約 1.5～2 秒）** 專門用來建立頻道辨識度：

- **構圖原則**：半身中景（Medium shot），主角站在同一間暖色調木質廚房裡，身穿簡約深灰或黑色圍裙，面前擺著該集料理的成品（或關鍵食材），對鏡頭自然微笑。
- **Google Flow 防臉崩與防音訊失敗守則**：
  - 絕對不要要求「大笑、說話、快速轉頭、大幅度揮手」。
  - 避免在有人臉的 Shot 1 寫 `breathing`（呼吸聲）、`room tone`、`hiss` 等音訊描述，容易觸發 Veo 3.1 `Audio generation failed`。
  - 僅使用**極微幅動態**詞彙：`Subtle warm smile, slight nod toward camera, warm steam gently rising from the dish, natural ambient kitchen light, soft sizzling sound from the hot dish.`（若仍遇音訊失敗，可移除最後的音效描述只留純畫面動態）。
  - 這樣既能讓觀眾看到你的分身，又幾乎不會消耗額外重試點數。
- **Shot 2 之後**：立即切換為無臉的第一人稱 POV 料理特寫，完全避免跨鏡頭臉部漂移問題。

---

## 3. Google Flow（Veo 3.1）省點數與防穿幫守則

1. **模型選擇優先序**：
   - **日常主力**：`Veo 3.1 Lite`（720p，10 Credits/次）— 手機直式觀看畫質已足夠，成本最低。
   - **高動態/液體鏡頭**：`Veo 3.1 Fast`（20 Credits/次）— 用於倒醬汁、翻炒、油花濺起等較複雜物理動態。
   - **避免使用**：`Veo 3.1 Quality`（100 Credits/次），除非極特殊需求，否則過於消耗額度。
2. **避開 AI 手部穿幫與審查誤判**：
   - ❌ **禁用**：雙手同時入鏡、手指交疊拿筷子夾細麵、快速切菜連拍、血淋淋的生肉特寫（易觸發安全過濾）。
   - ✅ **改用**：單手局部入鏡（只拍握住鍋柄或撒鹽的手指尖）、刀刃壓切食材的微距特寫、食材直接落入熱鍋的瞬間。
3. **原生 ASMR 音效關鍵字（務必寫入 Video Prompt）**：
   - 熱油煎烤：`Loud crisp sizzling sound of hot oil and searing meat in cast iron pan`
   - 切菜：`Crisp rhythmic knife chopping sound on wooden cutting board`
   - 倒醬汁/湯汁：`Thick rich sauce pouring and bubbling gently`
   - 酥脆外皮：`Satisfying loud crunch sound`
   - 灑調味料：`Soft gentle sprinkling sound`

---

## 4. 字幕與剪輯節奏規範

這一節的數值與 `scripts/assemble_shorts.py` 的預設參數**一一對應**。改動任一邊時請同步另一邊。

### 4.1 剪輯節奏

| 項目 | 值 | 對應參數 |
|---|---|---|
| 輸出規格 | 1080×1920 / 30fps | 固定 |
| 首鏡長度 | 1.8s | `--intro-duration` |
| 一般鏡頭 | 2.5s | `--clip-duration` |
| 加速倍率 | 1.25x | `--speed` |
| 每鏡原始素材需求 | ≈3.13s | `2.5 × 1.25` |
| 總長 | 20～30s | — |

> Veo 預設輸出 8 秒，腳本只取前 3.13 秒。**因此「鏡頭前 3 秒就要有動作」**——Image Prompt 若把關鍵動作放在後半段，會被裁掉。

### 4.2 字幕樣式

| 項目 | 值 | 對應參數 |
|---|---|---|
| 字體 | Arial | `--font` |
| 字級 | 96px（畫面真實像素） | `--font-size` |
| 距底部 | 240px | `--margin-v` |
| 顏色 | 白字 + 3px 黑描邊 + 1px 陰影 | 寫在 `output/subtitles.ass` |
| 對齊 | 置中、底部對齊 | — |

240px 是為了避開 Shorts 介面的進度條與說明文字。**不要調到 150 以下**，會被 UI 蓋住。

### 4.3 文案規則

- 全大寫英文，**不加標點**（`SEAR` 而非 `Searing...`）
- 每條 **0～4 個單字**：2.5 秒內看不完的字幕等於沒有
- 用「動作的聲音」而不是「食材名稱」：`SIZZLE` > `BEEF`、`CRUNCH` > `FRIED CHICKEN`
- 允許留空：不是每鏡都需要字幕，留白反而有節奏感
- 動詞現在式、單音節優先

### 4.4 字幕時軸

SRT 寫的是**加速後**的時間軸，不是原始素材時間：

```
Shot 1  00:00:00,000 → 00:00:01,800
Shot 2  00:00:01,800 → 00:00:04,300
Shot 3  00:00:04,300 → 00:00:06,800
```

字幕結束時間必須等於成片總長。腳本會在差距超過 0.5 秒時警告。
