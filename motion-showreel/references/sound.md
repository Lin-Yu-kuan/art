# 聲音：配樂、音效、混音

聲音是影片的另一半。同樣的畫面，有沒有卡點的音效，觀感能差一個檔次。配樂和音效都用程式碼寫，時間點從 `timeline.js` 讀取，所以和畫面是同一張時間表。

先分別確認 BGM、音效的來源（AI 合成 / 使用者提供 / 關閉），再選引擎；可以混合來源。下文保留原有無口播的合成、卡點和混音方法。有口播時先讀 `narration.md`：使用者提供原稿或錄音，先取得真實句段時間軸，人聲優先，BGM 與音效收斂；最終三軌混音後統一響度。超過 2 分鐘再讀 `long-form.md`，音訊按章構建，避免整片離線陣列佔用過大記憶體。

這份檔案裡的配方、曲線和詞彙表是**起點和詞彙，不是規定**。所選風格和對標優先，你也可以完全不用這裡的寫法。

目錄：1 選哪一檔 · 2 先定聲音方向 · 3 第 1 檔：內建合成（session API） · 4 第 2 檔：Tone.js · 5 結構與戲劇曲線 · 6 詞彙：律動、和聲、配器、空間 · 7 音效對照表 · 8 時間規則 · 9 混音 · 10 檢查（你聽不到） · 11 使用者給的曲子 · 12 聲音的預設味

---

## 1. 選哪一檔

| 檔 | 檔案 | 引擎 | 強項 | 弱項 |
|---|---|---|---|---|
| 第 1 檔 · 內建合成（預設） | `score.mjs` | Node 裡的合成器，零依賴、完全確定 | 電子鼓、手鼓、合成貝斯、鋪底、撥絃、馬林巴 / 鋼片 / 卡林巴、風琴、人聲鋪底、FM 鐘聲、晶片音樂、環境底噪、lo-fi 處理、UI 音效、側鏈 | 真實鋼琴、絃樂、真鼓不像 |
| 第 2 檔 · Tone.js | `score.tone.js` | 在無頭瀏覽器裡用 Tone.js 離線渲染（OfflineAudioContext） | 取樣樂器、卷積混響、合唱 / 相位 / 失真等效果、更豐富的合成器 | 需要先下載取樣；噪聲類音色每次渲染略有不同 |
| 外部曲子 | 使用者的音訊檔案 | `S.load()` | 真實製作的音樂（使用者自己的、授權的、AI 音樂服務生成的） | 授權要使用者負責；只能卡它的拍 |
| 無聲 | — | — | 循環動圖、要放進別的片子裡的素材 | — |

兩檔可以疊：先 `audio.mjs build score.tone.js --raw --out audio/tone.wav` 得到一層沒做母帶的音樂，再在 `score.mjs` 裡 `S.load('audio/tone.wav')` 放進一條 bus，疊上第 1 檔的音效，最後統一做母帶。`scaffold.sh --audio layer` 會給出這樣一份 `score.mjs`（第一行就載入 `audio/tone.wav`，後面只寫音效），`build.sh` 的 `AUDIO=layer` 按這個順序自動構建；`score.mjs` 裡沒有引用 `tone.wav` 時 build 會報錯，免得 Tone 層渲出來卻沒混進去。

`build.sh` 只構建 `AUDIO=` 指定的那份 score（synth / tone / layer / none），另一份檔案存在時會提示它被忽略，不會悄悄換成別的配樂。新增 `AUDIO=file AUDIO_FILE=audio/final.wav` 使用獨立軌混好的最終音訊，不重複合成；檔案時長必須與 `timeline.js` 匹配，衝突先確認，不能自動截斷口播。

**怎麼選**：看所選風格檔案裡的「聲音調色盤」。電子、介面、復古、抽象、大多數手作和玩具風格用第 1 檔就夠了；需要真實鋼琴、絃樂和大空間的電影感、高階產品，用第 2 檔或兩檔疊用。

## 2. 先定聲音方向

聲音和畫面一樣會落進預設值。沒有方向時，合成配樂會收斂成同一首歌：A 小調、120 BPM 四踩、每個重拍 impact + crash、落版一個鐘聲（見第 12 節）。所以寫 brief 時，把聲音當作和畫面同等的一條軸，**先找聲音的對標**：一種曲風、一位作曲家、一部片子的配樂、一個樂隊、一種民間音樂。寫下學什麼（律動、和聲色彩、配器、結構、空間）和不學什麼（旋律、取樣、歌詞）。

brief 裡 `sound:` 可以展開成下面幾項。能從風格和對標裡推出來的寫一個詞就夠，不必每項都填：

```yaml
sound:
  benchmark: [聲音對標 · 學什麼 · 不學什麼]
  role: [音樂在這支片子裡的角色：推動 / 托底 / 搶戲 / 幾乎不出現，讓擬音說話]
  groove: [拍號 · BPM · 直拍 / swing / half-time / 無拍]
  harmony: [調和調式 · 進行或持續音 · 色彩]
  palette: [主奏 / 節奏 / 低音 / 紋理分別用什麼]
  arc: [戲劇曲線，見第 5 節]
  motif: [可選：一個 2–4 音的動機，以及它怎麼變奏]
  mix: [空間大小、寬度、側鏈與否、是否 lo-fi]
```

- **候選也想兩三個**：和畫面結構一樣，第一個冒出來的聲音方向往往是這個風格的陳詞濫調。用一行各寫兩三個，選一個。
- **和自己拉開**：工作目錄裡有你之前做的專案時，看一眼它們 brief 裡的 `sound`。除非使用者要求系列統一，這一支至少在調式、律動、配器、曲線裡換掉兩項。
- **小樣（可選）**：聲音是片子的主角之一時（音樂向、卡點、沒有文字的情緒片），可以在第 3 步風格幀時順手給 2–3 段 6–8 秒的聲音小樣一起發給使用者，比如 `audio.mjs build score.a.mjs --dur 8 --out audio/sketch-a.wav`。渲染只要幾秒，你聽不到，使用者可以。不需要就跳過，不增加停頓點。

## 3. 第 1 檔：內建合成（session API）

`score.mjs` 匯出 `DUR`，以及一個接收 session `S` 的預設函式：

```js
import { DUR, BPM, CUES } from './timeline.js';
export { DUR };
export default function score(S) {
  S.tempo(BPM);                                         // S.beat(n)、S.bar(n) → 秒
  const drums = S.bus('drums', { gain: 0.9 });
  const music = S.bus('music', { gain: 0.5, reverb: 0.3, duck: 0.6, highpass: 160 });
  drums.add(S.kick(), S.beat(0)); S.duck(S.beat(0));    // 側鏈：music 在每個 duck 點被壓低
  music.add(S.pad(S.chord('A3', 'min7'), S.bar(2)), S.bar(0));
}
```

**bus 選項**：`gain`、`pan`（−1…1）、`reverb`（傳送量 0–1）、`delay`（傳送量）、`delayTime`（秒，預設 3/4 拍）、`duck`（側鏈深度 0–1）、`duckRelease`（秒）、`highpass` / `lowpass`（Hz）、`drive`（0–1）、`crush`（位深，比如 6–12；0 = 關）、`crushRate`（降取樣到多少 Hz）、`wow`（0–1，磁帶的抖動和走帶不穩）、`width`（0 = 單聲道）。
**`bus.add(sound, t, { gain, pan })`**：t 可以為負（聲音從片頭之前開始，會被截掉一部分）。
**`S.duck(t, depth)`**：登記一個側鏈觸發點（一般跟著 kick，或者放在撞擊上）。
**`S.space({ room, damp, width })`**：全片共用的混響長什麼樣。room 0.3（小房間）… 0.95（大廳），damp 0（亮）… 0.9（暗）。預設 `{ room: 0.84, damp: 0.3 }`。
**節奏**：`S.tempo(bpm, { beatsPerBar })`（3/4、6/8、5/4 都行）；`S.steps('x..x..x.', step = 0.25)` 把步進字串變成拍位置（`x` 是擊打，其他字元是休止，空格和 `|` 忽略）；`S.swing(n, amount = 1/3, grid = 0.5)` 把拍位置變成帶 swing 的秒數（⅓ ≈ 三連音感覺，grid 0.25 是十六分 swing）；`S.humanize(t, ms = 8)` 給一個固定種子的微小時間偏移。
**和聲**：`S.midi('C#4')`、`S.hz('A4')`、`S.chord(root, quality, inversion)`（maj、min、sus2、sus4、dim、aug、5、6、m6、7、9、7b9、7sus4、maj7、min7、m7b5、dim7、maj7#11、m9、maj9、add9、madd9、min11、quartal、quartal4、cluster）、`S.scale(root, name)(degree)`（major、minor、dorian、phrygian、lydian、mixolydian、locrian、harmonic、melodic、hijaz、wholetone、blues、penta、minpenta、hirajoshi、insen、gong、shang、jue、zhi、yu）。音符可以寫成名字，也可以寫成 MIDI 數字。

**樂器**（返回單聲道 Float32Array；pad、organ、vox、whoosh、ambience 返回立體聲 `{L, R}`）：

| 類別 | 函式 | 常用引數 |
|---|---|---|
| 鼓 | `kick()` | tone 48、start 165、decay 0.42、click 0.5、drive 0.35 |
| | `snare()` `clap()` | tone、decay、snappy |
| | `hat({ open })` `crash()` `tom(note)` | decay、tone |
| 手鼓 | `shaker()` `rim()` `cowbell()` | decay、tone（shaker 起音是軟的，rim 是木頭敲擊） |
| 低音 | `bass(note, dur)` | wave 'saw'/'square'、cutoff 600、envAmt 3、sub 0.6、glideFrom、drive |
| | `sub(note, dur)` | harm 0.15（加泛音，小喇叭上也聽得見） |
| 和聲 | `pad(notes, dur)` | voices 5、cents 14、cutoff 1800、attack 0.5、release 1.2、wave |
| | `keys(notes, dur)` | FM 電鋼琴：decay、index |
| | `organ(notes, dur)` | drawbars '888000000'（9 位拉桿，'808000004' 爵士，'888888888' 滿）、click、leslie 0.4、rate |
| | `vox(notes, dur)` | vowel 'a'/'e'/'i'/'o'/'u'、voices 3、vibrato、breath（人聲鋪底 / 合唱感） |
| 旋律 | `pluck(note, dur)` | bright 0.55、damp（Karplus-Strong 撥絃，bright 低 + damp 高接近古琴、尼龍弦） |
| | `mallet(note, dur)` | material 'marimba'/'xylo'/'vibes'/'glock'/'kalimba'/'steel'/'wood'、bright、decay |
| | `lead(note, dur)` | wave、cutoff、vibrato、glideFrom、detune |
| | `bell(note, dur)` | ratio 3.5、index 4（FM 鐘聲 / 玻璃） |
| 音效 | `riser(dur)` `downlifter(dur)` | from、to、noise |
| | `whoosh(dur)` | peak 0.7：**最響的點在 peak × dur 處**，所以放在 `切點 − peak × dur` |
| | `impact()` `boom()` `reverseCymbal(dur)` | size |
| | `click()` `tick()` `pop(note)` `blip(note)` `swipe(dur)` | tone |
| | `glitch(dur)` `shimmer(dur)` | seed、bits / root |
| 環境 | `ambience(dur, { kind })` | kind 'tape'/'vinyl'/'wind'/'rain'/'room'、amount（磁帶底噪、黑膠噼啪、風、雨、房間底噪） |

**底層工具**（自己做音色時用）：`osc(len, freqOrFn, wave)`、`noise(sec, seed)`、`adsr`、`expEnv`、`biquad(buf, type, cutoffOrFn, q)`、`lowpass`、`highpass`、`bandpass`、`drive`、`crush(buf, bits, rate)`、`reverse`、`fade`、`mul`、`S.SR`（48000）。`S.load(file)` 用 ffmpeg 把任何音訊解碼成 `{L, R}`。內建音色是素材，不是成品：改引數、換種子、疊兩層、用底層工具做一個這支片子獨有的聲音（比如 braam、卡通哨音、筆尖刮擦），往往比直接用預設值更像「這支片子的聲音」。

構建：`node <skill>/scripts/audio.mjs build <slug>/score.mjs [--out audio/music.wav] [--stems]`。母帶會自動處理到 −14 LUFS，並用峰值限制器壓到 −1.5 dBFS。`--stems` 會把每條 bus 單獨匯出到 `audio/stems/`，方便排查是哪一軌出了問題。

## 4. 第 2 檔：Tone.js

`score.tone.js` 是一個**瀏覽器 ES 模組**，和 `timeline.js` 放在一起：

```js
import { DUR, BPM, CUES, b } from './timeline.js';
export { DUR };
export default async function score(Tone, kit) {
  kit.transport.bpm.value = BPM;
  const verb = new Tone.Reverb({ decay: 2.8, wet: 0.25 }).toDestination();
  const piano = new Tone.Sampler({ urls: kit.salamander(), baseUrl: kit.baseUrl('salamander'), release: 1.2 }).connect(verb);
  await kit.loaded();                                        // 取樣解碼完再排音符
  piano.triggerAttackRelease(['A3', 'C4', 'E4'], b(4), 0);   // 時間用秒（從 timeline 來）
}
```

- **構建**：`node <skill>/scripts/audio.mjs build <slug>/score.tone.js`，輸出 −14 LUFS 的 WAV（`--raw` 跳過母帶）。`scaffold.sh <slug> --audio tone` 會複製一份完整示例 `score.tone.js`，並把 `build.sh` 設成 `AUDIO=tone`；兩檔疊用時選 `--audio layer`。
- **kit**：`DUR`、`transport`、`loaded()`、`baseUrl(pack)`、`sample(pack, file)`、`salamander()`（Salamander 鋼琴的 `Sampler` urls 表）。
- **取樣**：`node <skill>/scripts/audio.mjs samples` 列出可下載的包；`samples salamander` 下載 Salamander Grand Piano（CC BY 3.0，交付時要署名）。其他 CC0 / 有授權的取樣可以放進 `<slug>/samples/<名字>/`，在頁面裡用 `/samples/<名字>/檔案` 引用。不要使用來源和授權不明的取樣。
- **常用部件**：`Sampler`（取樣樂器）、`PolySynth(FMSynth | AMSynth | Synth)`、`MonoSynth`（貝斯）、`MembraneSynth`（底鼓）、`MetalSynth`（鑔）、`NoiseSynth`；效果 `Reverb`（卷積）、`FeedbackDelay`、`PingPongDelay`、`Chorus`、`Phaser`、`Distortion`、`BitCrusher`、`Filter`、`AutoFilter`、`Compressor`、`Limiter`。
- **注意**：所有聲音都要接到 `.toDestination()`（直接或經過效果鏈），否則渲出來是靜音；時間用絕對秒數（從 `timeline.js` 來），不要依賴 `Tone.now()`；取樣一定要 `await kit.loaded()` 之後再排音符。
- 鋼琴不是第 2 檔的唯一用法：Salamander 鋼琴可以只當一層（低音區單音、高音區點綴），主體交給 FM、合唱、卷積空間這類第 1 檔做不到的東西。

## 5. 結構與戲劇曲線

**結構跟用途走，配器跟風格走，曲線跟這支片子的想法走**。配器看所選風格檔案裡的「聲音調色盤」（`styles/<slug>.md`）。

下面這張表是各用途**最常見的一種做法**，基本都是「吸氣 → 爆發」曲線。它可靠，但也正因為常見，換一條曲線往往更有記憶點：

| 用途 | 常用 BPM | 常見做法 |
|---|---|---|
| A 動效作品集 | 120–128 | 前 2 小節只有鋪底和鑔 → 進鼓 → drop 前一小節 riser，最後一拍靜音 → drop 時 impact + crash |
| B 產品宣傳短片 | 100–124 | 賣點切換處放 whoosh；高潮時全部樂器進來；落版用一個鐘聲加長尾音 |
| C UI 動效演示 | 110–120 | 音樂退後（gain 0.3–0.4），介面音效在前 |
| D 排版卡點 | 按曲子 / 90–140 | 重點詞的前一拍靜音 |
| E Logo / 片頭 | — | riser → impact → 一個持續和絃或鐘聲，4–8 秒內完成一次起伏 |
| F 循環動圖 | 60–90 或無聲 | 聲音也要能循環：首尾的音量和和聲要一致 |
| G 資料爆點 | 120 | 滾動期間 tick 越來越密 → 落定前半拍靜音 → impact |
| I 年代回顧 | 全片固定或緩慢上升 | 一首曲子貫穿全片，配器逐段升級（晶片 → 合成器 → 取樣 + 大混響），高潮時全部合在一起 |

**戲劇曲線選單**（可以整片一條，也可以每段一條，也可以自己發明）：

| 曲線 | 形狀 | 適合 | 要點 |
|---|---|---|---|
| 吸氣 → 爆發 | 鋪墊 → riser → 靜音 → 撞擊 | 作品集、宣傳、Logo | 上表那種；`DROPS` 檢查專門量它 |
| 累加 | 一層一層疊，從不停 | 生長、從零到一、生成藝術、系統 | 每 2–4 小節進一個聲部；高潮是「全部都在」，不是一下撞擊（Reich、Bolero） |
| 抽空 | 滿編 → 突然只剩一件樂器或一個音 | 反差、「只需要這一個」、產品亮相 | 抽空的那一刻就是記憶點，比 drop 更剋制 |
| 波浪 | 起伏几次，沒有單一高潮 | 循環、氛圍、品牌情緒 | 濾波、音量、密度一起起伏 |
| 一問一答 | 畫面問、聲音答，或者兩件樂器對話 | UI、角色、俏皮 | 動機短，回答時換配器或換音區 |
| 音畫同形（mickey-mousing） | 音樂本身就是動作的聲音 | 卡通、玩具、手作、定格 | 每個動作一個樂音，音高跟著運動方向走（上升的物體音高也上升） |
| 單線條 | 一件樂器從頭到尾 | 極簡、東方、高階、詩意 | 留白比音符多，空間感決定質感 |
| 擬音主導 | 幾乎沒有音樂 | 材質、產品、手作、ASMR | 聲音的材質必須對得上畫面的材質 |
| 倒放 | 一開場最滿，然後越來越少 | 結尾落在一句話、一個字 | 最後一個聲音要最乾淨 |

## 6. 詞彙：律動、和聲、配器、空間

這些是可以隨手組合的詞彙，不是清單。

**律動**

| 律動 | 感覺 | 第 1 檔寫法 |
|---|---|---|
| 四踩（four-on-the-floor） | 推進、俱樂部 | 每拍 kick，反拍 hat |
| half-time | 沉、寬、電影感 | 軍鼓只在第 3 拍，kick 稀疏 |
| breakbeat | 碎、街頭、能量 | kick `S.steps('x.........x.....')`，軍鼓 2、4 拍加輕的 ghost note |
| shuffle / swing | 鬆弛、爵士、lo-fi、俏皮 | 位置用 `S.swing(n, 0.25–0.4)`；十六分 swing 用 `grid 0.25` |
| trap | 現代、緊張 | half-time 軍鼓 + hat 三連音、32 分音符滾奏 |
| tresillo / clave | 熱帶、拉丁、舞動 | `S.steps('x..x..x.')`；3-2 son clave `S.steps('x..x..x...x.x...')` |
| 6/8 · 12/8 | 搖盪、民謠、敘事 | `S.tempo(bpm, { beatsPerBar: 6 })`，以八分音符為拍 |
| 5/4 · 7/8 | 不穩、聰明、科技 | `beatsPerBar: 5`；7/8 用 2 + 2 + 3 分組 |
| 復節奏 3 : 4 | 機械、迷幻 | 三連音琶音壓在四拍上：`S.steps('xxx', 1/3)` |
| 無拍 / 自由時間 | 漂浮、東方、氛圍 | 音符按畫面事件放，不按網格；BPM 只給畫面切點用 |

swing 和 humanize 只改聲音。畫面要跟著的點仍然寫在 `timeline.js` 裡；如果整片都 swing，就把 swing 後的時間也寫進 timeline，讓畫面讀同一個數字。

**和聲**

| 色彩 | 寫法 | 感覺 |
|---|---|---|
| Lydian（升 4 級） | `scale(r, 'lydian')`、`maj7#11` | 明亮、驚奇、科技（產品亮相） |
| Dorian | 小調裡的大六度 | 冷靜、有律動、不悲傷 |
| Mixolydian / ♭VII | I – ♭VII – IV | 開闊、樂觀 |
| Phrygian / hijaz | 降 2 級 | 暗、緊張、異域 |
| 和聲小調 | 升 7 級導音 | 戲劇、懸疑、古典 |
| 五聲調式（宮商角徵羽）、hirajoshi、insen | `scale(r, 'shang')` 等 | 東方；用調式本身，不用陳詞濫調的旋律 |
| 全音階 | `wholetone` | 夢、失重、魔法 |
| 持續低音（pedal） | 低音不動，上面換和絃 | 張力、時間停住 |
| 四度疊置 | `chord(r, 'quartal4')` | 現代、開放、懸而未決 |
| 三度關係的大三和絃 | C → E → A♭ | 電影感、宏大揭示 |
| ♭VI – ♭VII – I | 勝利終止 | 通關、凱旋、落版 |
| 只有一個和絃 | 全片一個和絃，靠音色和密度變化 | 極簡、技術感 |
| 音簇 | `chord(r, 'cluster')` | 不安、實驗 |

調性從主題、品牌和情緒來，不要預設 A 小調。和絃進行也可以不循環：4 小節一句、第二句換掉最後一個和絃，就已經比一直循環有方向感。

**配器家族**

| 家族 | 第 1 檔 | 第 2 檔 |
|---|---|---|
| 敲擊樂（馬林巴、木琴、顫音琴、鋼片琴、卡林巴、鋼鼓、木魚） | `mallet({ material })` | Sampler + CC0 取樣 |
| 風琴 | `organ({ drawbars, leslie })` | — |
| 人聲鋪底 | `vox({ vowel })` | — |
| 電鋼琴 / FM | `keys`、`bell` | `FMSynth`、`PolySynth` |
| 撥絃（吉他、豎琴、古琴感） | `pluck({ bright, damp })` | — |
| 鋼琴 | — | Salamander |
| 手鼓 | `shaker`、`rim`、`cowbell`、高音 `tom` | `MembraneSynth`、`MetalSynth` |
| 銅管感 braam | 多個低八度鋸齒疊加 + 強濾波開合 + `drive`（用底層工具） | `Distortion` + `Filter` |
| 環境、媒介 | `ambience({ kind })` | — |

**空間**：`S.space` 決定這支片子在什麼地方發聲（小房間、木屋、大廳）；`crush` 和 `wow` 決定它通過什麼媒介傳過來（遊戲機、磁帶、舊收音機）。同一首曲子換一個空間和媒介，氣質就完全不同。

## 7. 音效對照表

音效的密度由風格決定：極簡介面幾乎每個動作都有聲音，生成抽象可能一個都沒有。需要音效時，材質要對得上：

| 畫面動作 | 音效 |
|---|---|
| 元素彈出 / 出現 | `pop`（音高隨元素大小變化：大元素低，小元素高）；手作、玩具風格可以用 `mallet` |
| 點選、開關、吸附 | `click`、`tick`、`rim` |
| 滑動、拖拽、卡片劃過 | `swipe` |
| 轉場、甩鏡、穿越 | `whoosh`（峰值對準切點） |
| 重拍上的大變化、反色、落版 | `impact` + `crash`，並登記 `S.duck`；也可以是這支片子材質的「重」聲音（一個低音和絃、一記木頭、一團人聲） |
| 吸氣、蓄力 | `riser`（長度 = 一小節），以 drop 時刻結束 |
| 消散、退場 | `downlifter`、`reverseCymbal` 的反向 |
| 粒子聚合、閃光、成功 | `shimmer`、`bell`、高音區 `mallet({ material: 'glock' })` |
| 數字跳動 | `tick`（每變一次一個，太密就隔幾次一個） |
| 故障、像素化、切片 | `glitch` |
| 落在某個場所（雨夜、錄音棚、舊電視） | `ambience` 鋪在底下 |

## 8. 時間規則

- 音效的觸發時間**直接用 timeline.js 裡的同一個數字**，不要另外手寫。
- whoosh 的峰值對準切點（`t − peak × dur`）；impact 正好落在動作那一幀。
- **用「吸氣 → 爆發」曲線時**，drop 前留一拍（至少半拍）靜音：鼓和鋪底都停，只剩 riser 的尾巴或者什麼都沒有。靜音之後的第一個聲音必須是全片最重要的聲音之一。其他曲線有自己的重點：累加看聲部進場的時機，抽空看抽掉的那一刻是否乾淨。
- 聲音可以當轉場：下一鏡的聲音提前 2–4 幀進來（J-cut），或者上一鏡的尾音延續過切點（L-cut）。
- 循環片：最後一小節的混響尾巴會在片頭突然斷掉，最後一拍要收乾淨，或者把尾巴疊回片頭。
- **畫面先定、音樂後配的長片**（年代回顧、一路走過幾個世界的長鏡頭）：段落邊界由畫面決定，套一個統一的 BPM 很難讓每條邊界都落在重拍上。可以讓每段自己定速度：每段放整數個小節，拍長 = 段長 ÷ 拍數，相鄰段的速度差控制在 ±8% 以內，耳朵聽不出來，換配器卻每次都踩在小節第一拍上。這時音符時間按「段起點 + 段內第幾拍 × 本段拍長」來寫，不用全域的 `S.beat`。段與段之間硬起音，不用交叉淡化。

## 9. 混音

- **分 bus**：drums、bass、music、sfx 至少四條，方便調整平衡。
- **側鏈**：bass 和 music 的 `duck` 設 0.5–0.7，每個底鼓和撞擊都 `S.duck(t)`，律動感立刻就出來了。但側鏈的泵感是電子舞曲的簽名，**是一種風格，不是預設值**。
- **低頻控制**：合成音樂的低頻很容易太重。pad 和 music 加 `highpass: 150–250`；kick 的 decay 不要超過 0.45；bass 的 `sub` 控制在 0.3–0.6；低於 MIDI 48 的鋪底音符不要用。
- **小喇叭**：手機外放聽不到 60Hz 以下。貝斯要有 2、3 次諧波（`sub({ harm })`、`bass` 的鋸齒波本來就有）。
- **空間**：混響只傳送給 music 和 sfx（0.15–0.35），鼓和貝斯保持幹聲。
- **響度**：母帶自動處理到 −14 LUFS（各大平台的標準）、真峰值 ≤ −1 dBTP。

**混音哲學跟風格走**（下面是幾種方向，不是全部）：

| 方向 | 做法 |
|---|---|
| 俱樂部 / 電子舞曲 | 側鏈泵感、低頻飽滿、寬 |
| 電影 | 寬、大空間（`S.space({ room: 0.9 })`）、不側鏈；動態要大，安靜段真的安靜 |
| 原聲 / 手作 | 不側鏈、小房間（`room: 0.5`）、近距離、保留瞬態 |
| lo-fi | 鼓 bus `crush: 10–12` + `lowpass: 6000–9000`；music `wow: 0.3–0.6`；底下鋪 `ambience` tape 或 vinyl；`width` 可以收到 0.6 |
| 晶片 / 像素 | 幹聲、單聲道或硬聲像，`crush: 4–6`、`crushRate: 11000–22000` |
| 極簡 / 科技 | 幹、精確、留大量靜音；混響短而亮（`room: 0.5, damp: 0.1`） |
| 東方 / 寫意 | 大混響（傳送 0.4–0.5）、少聲部、長留白，不側鏈 |

## 10. 檢查（你聽不到）

每次 build 之後都要跑：

```bash
node <skill>/scripts/audio.mjs check <slug>/audio/music.wav --out <slug>/qa/music
```

它會列印：整體響度（目標 −14 ± 1 LUFS）、真峰值（< −1 dBTP）、按倍頻程的能量（相對 1 kHz，粉紅噪聲全部為 0；一般的混音在 63–125 Hz 是 +4…+12，4–8 kHz 是 −6…−18）、意外的靜音段，並給出 WARN。頻段的典型值以電子混音為參照：原聲、單線條、東方這類刻意輕盈的片子低頻偏少是正常的，看到「thin」時確認是不是有意為之就行。

**drop 前的呼吸**：在 `timeline.js` 裡匯出 `DROPS = [T.drop, …]`（或者臨時傳 `--drops 12,24.5`），check 會量出每個重拍前最後半拍比前一小節低多少 dB、重拍比前一小節高多少 dB。凹陷不到 4 dB 就 WARN「沒有呼吸」，說明鼓或鋪底沒停，或者 riser 太響；重拍不比前一小節響也會 WARN。這是你「聽」drop 的唯一辦法。不用「吸氣 → 爆發」曲線的片子不必寫 `DROPS`。然後**看** `-wave.png`（有沒有削頂、音量起伏是否和畫面結構、所選曲線一致：drop 曲線在 drop 處最滿、累加曲線一路變厚、抽空曲線在抽空處斷崖）和 `-spectrum.png`（低頻是否一直轟著、高頻是否完全沒有）。

成片之後，`inspect.mjs qa` 會對混好的 MP4 再檢查一次。

## 11. 使用者給的曲子

1. 確認授權（能不能商用，是不是使用者自己的），寫進交付說明。
2. `node <skill>/scripts/audio.mjs beats track.mp3 --out <slug>/audio/beats.json`（裝了 librosa 時自動用 librosa 定節拍網格，更穩；`--engine js` 強制用內建演算法）：得到 BPM、beats、downbeats、onset hits、每小節能量、drops（能量突增的小節）、breaks（能量突降的小節）。
3. **核對網格**：節拍檢測可能鎖到半速或倍速，或者落在反拍上。已知 BPM 不一致就加 `--bpm`；拍點在反拍上就加 `--shift 0.5`。開啟 `-wave` 圖看 drop 的位置是否和 `drops` 一致。
4. 選一段：短片一般擷取一個完整的樂句（4 或 8 小節），最好包含一個 drop。在 `score.mjs` 裡：
   ```js
   const song = S.load('audio/track.mp3'), a = Math.round(START * S.SR), n = Math.round(DUR * S.SR);
   const cut = { L: S.fade(song.L.slice(a, a + n), 0.01, 0.4), R: S.fade(song.R.slice(a, a + n), 0.01, 0.4) };
   S.bus('song', { gain: 1 }).add(cut, 0);
   ```
   然後把 sfx 疊在上面（`S.load` 的路徑相對於執行命令時的當前目錄，建議在專案目錄裡執行 build）。
5. 把擷取後的節拍時間（減去起點）寫進 `timeline.js`：`export const BEATS = [...]`、`export const DROP = ...`，畫面全部從這裡讀。
6. 曲子本身已經做過母帶：bus 的 gain 設 1，別再加 drive；母帶處理會把整體拉回 −14 LUFS。

## 12. 聲音的預設味

和 craft.md 第 11 節畫面的禁止清單一樣，這些是沒有方向時最容易出來的聲音。不是不能用，是不要**不假思索地**用：

| 預設味 | 為什麼同質 | 換成 |
|---|---|---|
| A 小調 i – VI – III – VII（Am – F – C – G） | starter 和訓練資料裡最常見的進行 | 按主題選調和調式（第 6 節）；持續低音、四度疊置、三度關係 |
| 每支片都是 100–128 BPM 四踩 + 反拍 hat + 2、4 拍拍手 | 電子舞曲的預設骨架 | half-time、breakbeat、swing、6/8、5/4、無拍 |
| 每個重拍都 impact + boom + crash | 衝擊貶值，所有片子是同一個「砰」 | 只給最重要的 1–2 個；其餘用這支片子材質的聲音（木頭、紙、玻璃、人聲、一個和絃） |
| 「riser → 靜音 → drop」是唯一的曲線 | 每支片子的情緒形狀一樣 | 第 5 節的其他曲線 |
| 落版 = 鐘聲 + shimmer 長尾 | 所有結尾聽起來一樣 | 動機的最後一個音、一個幹聲、一下環境聲，或者直接切黑 |
| 鋸齒 pad 當萬能鋪底 | 合成器的「出廠音色」 | `vox`、`organ`、`mallet` 滾奏、`ambience`、持續低音 |
| 所有 bus 都側鏈、music 都 highpass 180、同一個混響 | 同一種泵感，同一個房間 | 第 9 節的混音哲學；`S.space` |
| 內建音效原樣直接用 | 和別的片子同一套 whoosh、impact | 改 from / to / peak / seed、疊層、用底層工具按畫面材質自制 |
| 沒有動機 | 聽完記不住 | 一個 2–4 音的動機，貫穿全片變奏（換配器、換節奏、倒影） |

**例外**：風格或對標本身就是這樣（synthwave 就是四踩 + 門控軍鼓 + 鋸齒鋪底，預告片就是 riser + braam），或者使用者明確要求。這時它是風格的簽名，不是預設味。
