# storyboard.md 輸出格式範本

複製以下結構填寫。**所有 Prompt 與字幕用英文**，說明文字用繁體中文。
時間欄位一律是「**加速後**」的時間軸（首鏡 1.80s、之後每鏡 2.50s 累加），這是腳本實際輸出的長度。

---

```markdown
# <料理名稱> — AI 美食 Shorts 分鏡表

- 專案：projects/<YYYYMMDD>_<dish_slug>
- 總長：<XX.X> 秒 / <N> 個鏡頭
- 規格：1080×1920、30fps、1.25x 加速、ASMR 原生音、極簡英文字幕
- 模型策略：主力 Veo 3.1 Lite（10 credits/次），高動態鏡頭用 Veo 3.1 Fast（20 credits/次）
- 分身：<有 host_avatar，Shot 1 啟用 / 無，Shot 1 改成品特寫>

---

## Shot 1 — Hook（分身登場）

- **時間**：00:00.00 → 00:01.80（1.80s）
- **內容**：主持人端著成品對鏡頭微笑，蒸氣上升
- **參考圖**：assets/host_avatar.png

**Image Prompt**
```
9:16 vertical aspect ratio, medium shot of a person in a dark grey apron
standing in a warm cozy wooden kitchen, holding a plate of <dish>,
subtle warm smile, gentle natural breathing, warm golden-hour side lighting,
realistic food photography, shallow depth of field, 35mm lens
```

**Motion + ASMR Prompt（Veo 3.1 Lite）**
```
Subtle warm smile, slight nod toward camera,
warm steam gently rising from the dish, natural ambient kitchen light,
soft sizzling sound from the hot dish.
```

**字幕**：`<0～4 個英文單字，全大寫，可留空>`

---

## Shot 2 — <鏡頭標題>

- **時間**：00:01.80 → 00:04.30（2.50s）
- **內容**：<一句話說明畫面>

**Image Prompt**
```
9:16 vertical aspect ratio, extreme close-up macro shot of <主體>,
aged dark walnut wooden countertop, seasoned matte black cast iron skillet,
warm cozy kitchen background softly blurred, warm golden-hour side lighting,
rich appetizing food colors, realistic food photography,
shallow depth of field, 35mm lens
```

**Motion + ASMR Prompt（Veo 3.1 Lite / Fast）**
```
<camera movement + subject action>
<ASMR 音效描述，見 style_guide 第 3 節>
```

**字幕**：`<>`

---

## Shot 3 … Shot 10

（同上結構，逐鏡填寫）

---

## 字幕檔（subtitles.srt）

直接貼進專案根目錄的 `subtitles.srt`。時間必須與上表一致。

```
1
00:00:00,000 --> 00:00:01,800
SEAR

2
00:00:01,800 --> 00:00:04,300
SIZZLE

3
00:00:04,300 --> 00:00:06,800
CRUNCH
```

---

## 上架素材

**標題（3 組）**
1. <>
2. <>
3. <>

**說明欄**
```
<一句話描述> — ASMR cooking, no talking.

#shorts #asmr #cooking #<dish> #<cuisine> #foodasmr
```

**上架前必做**
- [ ] 勾選「經修改或合成的內容（Altered or synthetic content）」
- [ ] 確認字幕在畫面下方、未被 Shorts 介面遮擋
- [ ] 確認總長 20～30 秒
```

---

## 填寫檢查

| 檢查項 | 說明 |
|---|---|
| 每鏡都有 3 個 Prompt 區塊 | Image / Motion+ASMR / 字幕 |
| Image Prompt 含完整 Visual Anchors | 見 `style_guide.md` 第 1 節，缺一項就會跟其他集數不像同一間廚房 |
| 避開高失敗率描述 | 禁「雙手十指緊握」「快速切絲連拍」「血淋淋生肉」 |
| 字幕 0～4 個單字、全大寫、無標點 | 超過 4 個字在 2.5 秒內看不完 |
| SRT 時間是加速後時軸 | 與分鏡表的時間欄位完全一致 |
| 最後一條字幕結束時間 = 總長 | 腳本會檢查，差超過 0.5 秒會警告 |
