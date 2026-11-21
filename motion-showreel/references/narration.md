# 口播：使用者稿件、真即時間軸與混音

有口播時，先準備口播音訊和句段時間軸，再製作畫面，最後配 BGM 和音效。畫面按口播的實際節奏展開；音樂拍點只用於合適的停頓和轉場。

口播有三種選擇：無口播、TTS 朗讀使用者稿件、使用者提供錄音。**TTS 的稿件必須由使用者提供；Agent 不代寫、不改寫，也不能把自己生成的文字標成使用者稿件。** `--source user` 是執行者對來源的宣告，工具會記錄檔案和雜湊，但不能代替核實來源。普通視覺文案與旁白稿要分清。

工具要求 Node 18+、ffmpeg、ffprobe。不依賴其他 Skill，不需要新增 npm 包。憑據只通過環境變數讀取，不寫入 brief、時間軸、日誌或交付原始碼。模型和音色由使用者配置，通過 `--model` / `--voice` 或相應環境變數傳入。

## 1. TTS 只朗讀使用者稿件

```sh
node <skill>/scripts/narration.mjs tts <project> \
  --script <user-script.txt> --source user \
  --provider gemini --model <available-tts-model> --voice <voice>
```

TXT 按句末標點、換行和長度拆段，不增刪詞句。使用者需要控制段落時，用 JSON：

```json
{
  "source": "user",
  "segments": [
    {"id": "intro", "text": "使用者提供的第一段原文。"},
    {"id": "detail", "text": "使用者提供的第二段原文。"}
  ]
}
```

預設每段最多 500 字元，可用 `--max-chars 20..3000` 調整。JSON 的長段需先拆分，保留原文。較短分段更易恢復、更易修改，也有助於得到可靠的段落邊界；拆得過碎可能影響朗讀連貫性，需實際試聽。

合成成功後得到：

- `audio/narration.wav`：統一為 48 kHz、雙聲道 PCM。
- `audio/narration.json`：稿件來源、實際音訊時長和句段時間軸。
- `audio/narration-cache/`：分段音訊及校驗雜湊。快取由原文、adapter、model、voice 和影響聲音的配置共同決定；改一段只重做該段，改變音色會重做相關片段。壞快取會重建。

請求序列執行，臨時網路錯誤、429 和服務端錯誤最多重試兩次，可通過 `--retries 0..5` 調整。失敗保留已完成的片段；修復配置後執行原命令即可恢復。合成結果釋出前校驗每段真實時長與拼接後總時長，不按字數猜測時間。建議同時傳入 `--duration <確認的片長秒數>`：每段完成即檢查累計時長，超出目標或 1200 秒上限就停止後續請求、保留快取並要求先解決衝突；已經發出的這一段不能撤銷收費。實際口播短於目標時，先確認是否保留片頭、片尾或停頓，再製作這些畫面，不默默填滿。

```json
{
  "source": {"type": "user-script", "provenance": "user-provided", "file": "user-script.txt", "sha256": "…"},
  "alignment": "tts-segments",
  "duration": 8.126,
  "file": "audio/narration.wav",
  "segments": [
    {"id": "intro", "text": "使用者原文。", "start": 0, "end": 3.418, "file": "audio/narration-cache/….wav"},
    {"id": "detail", "text": "使用者下一段原文。", "start": 3.418, "end": 8.126, "file": "audio/narration-cache/….wav"}
  ],
  "missing": []
}
```

時間戳單位為秒，依據實際合成音訊累加，包含該片段內的呼吸和停頓。`tts-segments` 表示逐段合成邊界，不宣稱字級對齊。句段為同步提供錨點，不要求一句一個鏡頭；動作和鏡頭可跨句連續發展，把真實事件寫進 `timeline.js` 並讓畫面與音效共用。正式 `render(t)` 只讀傳入時間；帶聲音預覽可以用音訊播放時間驅動它，但不能讓即時音訊狀態參與離線渲染。

### 關鍵詞事件：只使用有依據的時間

`scaffold.sh` 會複製純模組 `narration.js`。無詞級時間時，原有句段流程繼續可用。需要關鍵詞同步時，給對應 segment 保留轉錄工具輸出的詞邊界，或人工聽後標註 `anchors`：

```json
{
  "id": "s1", "text": "靠近，然後匯合。", "start": 0, "end": 4,
  "anchors": [{ "text": "匯合", "start": 2.2, "end": 2.7 }]
}
```

上述秒數僅為結構示例，實際必須來自該音訊的人工標註。ASR 詞時間使用 `wordTimingSource: "asr"` 和 `words: [{"text":"…","start":0.2,"end":0.8}]`；詞序列需覆蓋對應原句，工具不補字、不均攤。

```js
import { narrationClock } from './narration.js';
const N = narrationClock(narrationData);
export const MERGE = N.at('s1', '匯合');
// 頁面中的主動作和 score 中的音效都引用 MERGE，不分別手寫秒數。
// N.end(id, keyword) / N.range(id, keyword) 查詢末尾或區間。
// 同一 segment 內重複的關鍵詞必須顯式選 { occurrence: 2 }，從 1 開始。
// 全片第幾次出現需先定位所屬 segment，不能直接當作段內 occurrence。
```

`N.segment(id)` 總能使用有效句段邊界；`at/end/range` 缺詞時間、存在歧義或關鍵詞落在無真實邊界的詞內部時會報錯。此時補人工錨點或改用句級動作，不偽造逐字同步。關鍵詞事件是時間資料，不強制在該詞切鏡；鏡頭可提前建立上下文，事件觸發主體變化。

### Gemini

所需環境變數為 `GEMINI_API_KEY`；可選 `GEMINI_TTS_MODEL`、`GEMINI_TTS_VOICE`、`GEMINI_TTS_BASE_URL`。使用 REST `models/<model>:generateContent`。當前 voice schema 與舊模型的 `prebuiltVoiceConfig` 都已適配；2.5 / 3.1 自動採用舊格式，其他模型採用 `voiceConfig.voice`，可用 `GEMINI_TTS_SCHEMA=legacy|voice` 顯式切換。可處理 WAV 容器和舊模型返回的 24 kHz、16 位單聲道 PCM；PCM 會先封裝為 WAV，再交給 ffmpeg。[Gemini 官方介面](https://ai.google.dev/gemini-api/docs/generate-content/speech-generation)

模型支援隨賬號和服務變化；傳入使用者可用的模型與音色，先做一小段連通性和試聽檢查。工具只把提供的文本發給 TTS，不呼叫語言模型生成或潤色稿件。雲端朗讀是否漏讀、重複或讀錯詞，仍需試聽核對。

### MiniMax

所需環境變數為 `MINIMAX_API_KEY`；可選 `MINIMAX_TTS_MODEL`、`MINIMAX_TTS_VOICE`、`MINIMAX_TTS_SPEED`。預設 endpoint 是 `https://api.minimax.io/v1/t2a_v2`；中國區或相容閘道器用 `MINIMAX_TTS_URL` 指定完整 URL，例如 `https://api.minimaxi.com/v1/t2a_v2`。使用非流式 hex 音訊，不依賴 mmx CLI；會檢查業務狀態再解碼。[MiniMax 官方介面](https://platform.minimax.io/docs/api-reference/speech-t2a-http)

兩個內建 adapter 都支援 `SHOWREEL_TTS_TIMEOUT_MS` 調整單次請求超時，預設 90000 ms。遠端 endpoint 必須 HTTPS；本地 HTTP 僅用於 localhost 測試。

### 自定義 provider

把 `--provider` 指向一個可信本地 `.mjs` 檔案，它需要匯出：

```js
export async function synthesize({ text, outFile, model, voice }) {
  // 讀取自己的環境憑據；將可解碼音訊寫到 outFile。
  // outFile 是臨時 .bin 路徑；輸出 WAV/MP3 時需顯式指定格式。
  // 失敗拋錯；明確不可重試時設定 error.retryable = false。
}
```

不要在 adapter 中列印 key、Authorization 或完整請求。工具不會輸出 adapter 丟擲的原始錯誤。adapter 程式碼、model、voice 都參與快取；其他影響聲音的配置變化時，更新 `SHOWREEL_TTS_CACHE_VERSION` 使快取失效。

## 2. 匯入使用者錄音

已有句段字幕或轉錄時間戳時：

```sh
node <skill>/scripts/narration.mjs import <project> \
  --audio <user-voice.wav> --timestamps <voice.srt>
```

支援 SRT，或 `[{"id":"a","text":"真實錄音中的一句話","start":0.3,"end":2.8}]` 形式的 JSON，也接受 `{ "segments": [...] }`。時間戳必須遞增、不重疊且位於音訊範圍內；JSON 數值單位是秒。`voice.wav` 旁存在 `voice.srt` 或 `voice.segments.json` 時會自動發現。

有可用的 ASR 時，可傳可信本地 adapter：

```sh
node <skill>/scripts/narration.mjs import <project> \
  --audio <user-voice.wav> --transcriber </absolute/asr-adapter.mjs>
```

adapter 契約：

```js
export async function transcribe({ file }) {
  // file 是規範化後的真實錄音；呼叫已獲授權的 ASR 或本地轉錄工具。
  return { segments: [{ id: 'a', text: '實際轉錄結果', start: 0.3, end: 2.8 }] };
}
```

ASR 必須返回真實文本與時間戳。工具會驗證範圍，標為 `asr-timestamps`；轉錄準確性仍需核對。**本 Skill 不內建 ASR 模型或賬號，也不會假稱執行過轉錄。** 如果已有本地 Whisper，可先執行 `whisper <user-voice.wav> --output_format json --output_dir <project>/audio/transcription`，再把生成的 JSON 作為 `--timestamps` 匯入；需確保 Whisper 已安裝且模型可用。

沒有時間戳或可用 ASR 時，仍可匯入音訊：

```sh
node <skill>/scripts/narration.mjs import <project> --audio <user-voice.wav>
```

結果明確記錄 `alignment: "unresolved"`、`missing: ["sentence-timestamps"]`，只保留整段錄音範圍，`text` 為空。此時**不能開始宣稱按句對齊的畫面製作**。下一步是補 SRT/JSON、配置實際可用的 ASR，或由使用者人工標註句段切點；不能用字數估時偽裝成實測時間戳。音訊已匯入和語義時間軸已就緒是兩個不同狀態。

如果錄音長度與使用者要求的時長衝突，向用戶確認修改哪一項，不自動截斷或加速人聲。

## 3. BGM、音效、人聲分別混音

BGM 和音效各自選擇 `ai`、`user` 或 `none`，允許混用。程式碼合成的音樂/音效屬於 `ai`；使用者交付的檔案屬於 `user`。兩者必須分別提供檔案，不能把未分軌的混音稱為可獨立控制的音樂和音效。

```sh
node <skill>/scripts/narration.mjs mix <project> \
  --bgm <project>/audio/music.wav --bgm-source ai \
  --sfx <project>/audio/sfx.wav --sfx-source user \
  --duration <timeline-DUR-seconds>
```

人聲預設讀取 `audio/narration.json` 指定的檔案；`--narration <file>` 可指定其他錄音。關閉任意一軌：

```sh
node <skill>/scripts/narration.mjs mix <project> \
  --bgm <project>/audio/music.wav --bgm-source user \
  --sfx none --sfx-source none --narration none --duration 30
```

完全無聲時，三軌都選 `none` 並傳時長。僅有音效或僅有口播也可以。

工具生成 `audio/final.wav` 和 `audio/mix.json`。音樂預設 gain 0.35，音效預設 0.5；通過 `--bgm-gain` / `--sfx-gain` 調整。在已知口播區間，BGM 和音效額外降低 16 dB（`--duck-db -16` 可調），鏡頭邊界附近保留少量提前與延後空間，鄰接區間合併以避免頻繁抽動。時間戳未就緒時，在整段錄音期間保守降低其他兩軌，不聲稱按句避讓。

除增益外，**編排本身也要收斂**：有口播時減少連續音效、密集鼓點和搶人聲的旋律，把重音效放在停頓或段落交界。工具的音量避讓不能代替這一步。

混音採用流式 ffmpeg，統一取樣率、限制峰值、處理整體響度並校驗時長。輸入音樂與音效不足時補靜音，不暗自循環。片長最多 1200 秒；口播超出目標片長會失敗，要求先解決時長衝突。最終響度、真峰值和人聲清晰度仍需通過音訊檢查與試聽確認。

將 `audio/final.wav` 交給渲染工具的 `--audio` 或新的 build 配置進行封裝。未開啟口播和獨立混音時，舊 `audio.mjs` / score 工作方式不變。

## 4. 驗證

有口播時，在畫面製作前檢查時間軸，混音後再帶最終音訊檢查一次：

```sh
node <skill>/scripts/narration.mjs check <project> --duration <timeline-DUR-seconds>
node <skill>/scripts/narration.mjs check <project> --duration <timeline-DUR-seconds> --audio <project>/audio/final.wav
```

結果寫入 `audio/narration-qa.json`；缺少真實文本時間戳、音訊被替換、口播被目標時長截斷或最終混音長度不符，都會返回失敗退出碼。混音記錄包含各輸入和最終輸出的 SHA-256；即使路徑和時長不變，替換口播後也必須重新混音，舊成片音軌不能通過驗收。句段之間的真實停頓可以保留，不要求每秒都有文本。字詞是否讀對、轉錄是否準確和聲音是否好聽仍需人工審片。

```sh
node --test <skill>/scripts/test/narration.test.mjs
```

測試使用 mock provider / ASR 和真實 ffmpeg，驗證來源限制、Gemini PCM/WAV、MiniMax hex、重試、快取失效、錄音匯入、時間戳驗證、獨立關閉音軌和人聲區間的實際衰減，不呼叫付費 API。真實賬號的連通性、可用模型與音色，需使用使用者提供的 API 配置單獨驗證；不能把 mock 測試稱作線上驗證。
