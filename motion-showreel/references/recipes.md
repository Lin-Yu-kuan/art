# 現成寫法

全部是**只依賴 t 的純函式寫法**，可以直接搬進 `render(t)`。示例預設已經從 `motion.js` 引入了需要的函式，`ctx` 是 `setupCanvas` 返回的 2D 上下文，`U = Math.min(W, H) / 1080`。這些是手法的骨架，配色、尺寸和節奏要按 brief 重新設計。

目錄：1 遮罩逐字 · 2 前後沿拉伸 · 3 形狀變形鏈 · 4 遊標驅動 · 5 穿越轉場 · 6 遮罩擦除 · 7 粒子組字 · 8 無狀態發射器 · 9 計數器 · 10 SVG 描邊 · 11 無縫循環 · 12 WebGL 後期 · 13 拖影 · 14 節拍驅動 · 15 Canvas 偽 3D 體塊

---

## 1. 遮罩逐字（字從基線下面彈上來）

```js
function maskedWord(word, x, baseY, size, tIn, { gap = 0.045, tOut = null, color = '#111' } = {}) {   // tOut = null: never leaves
  ctx.font = `800 ${size}px Display`;
  const glyphs = [...word], w = glyphs.map(g => ctx.measureText(g).width);
  let cx = x;
  glyphs.forEach((g, i) => {
    const kIn = spring(t - tIn - i * gap, { freq: 2.6, damp: 0.72 });
    const kOut = tOut == null ? 0 : ease.inCubic(seg(t, tOut + i * gap * 0.6, tOut + i * gap * 0.6 + 0.25));
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - 2, baseY - size * 0.9, w[i] + 4, size * 1.02); ctx.clip();   // 視窗：大寫字母高度 + 一點餘量
    ctx.fillStyle = color;
    ctx.fillText(g, cx, baseY + (1 - kIn) * size * 1.05 - kOut * size * 1.05);
    ctx.restore();
    cx += w[i];
  });
  return cx - x;   // 整詞寬度，方便排後面的元素
}
```
中文按字拆就行；片語整體進場時把 `glyphs` 換成詞陣列。視窗的上下邊界要按字型實際的字高調整，先渲一幀看有沒有被裁掉。

## 2. 前後沿拉伸（指示條、進度條、點變線）

```js
// 指示條從 a 移到 b：前沿快、後沿慢，移動中被拉長，落定時恢復
const moves = [[0, 100], [2.0, 620], [3.0, 300]];             // [時間, 目標 x]
const fast = { freq: 3.6, damp: 0.8 }, slow = { freq: 2.2, damp: 0.85 };
const towardRight = (i) => i === 0 || moves[i][1] >= moves[i - 1][1];
// 向右移時右邊是前沿；向左移時左邊是前沿
const right = springTo(t, moves.map(([tt, x], i) => [tt, x + 80, towardRight(i) ? fast : slow]));
const left  = springTo(t, moves.map(([tt, x], i) => [tt, x,      towardRight(i) ? slow : fast]));
ctx.fillRect(left, y, right - left, 6 * U);
```

## 3. 形狀變形鏈（一個元素變成一串介面狀態）

```js
// 每個狀態：[x, y, w, h, radius]，顏色單獨插值
const S = [
  [W/2 - 160, H/2 - 40, 320, 80, 40],     // 按鈕
  [W/2 - 40,  H/2 - 40, 80,  80, 40],     // 載入圈
  [W/2 - 300, H/2 - 60, 600, 120, 60],    // 靈動島
  [W/2 - 360, H/2 - 220, 720, 440, 36],   // 卡片
];
const T = [0, b(2), b(4), b(6)];
const box = springTo(t, S.map((s, i) => [T[i], s]), { freq: 2.4, damp: 0.78 });
const k = T.findLastIndex(x => t >= x);                     // 當前狀態序號
const col = mix(COLORS[Math.max(0, k - 1)], COLORS[k], spring(t - T[k]));
ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(...box.slice(0, 4), box[4]); ctx.fill();
// 容器裡的內容：每個狀態自己的進場（T[k] + 0.12s 之後淡入並上移）和出場（下一個 T 之前 0.1s 模糊淡出）
```
內容切換時在舊內容上加 `ctx.filter = 'blur(6px)'` 並淡出 0.1 秒，新內容延後 0.08 秒進場，這樣新舊文字不會疊在一起。

## 4. 遊標驅動

```js
// 遊標路徑：關鍵幀 + 每段的緩動；按下狀態由區間決定
const cur = tween(t, [[0, [W*0.7, H*0.8]], [b(1.5), [W/2, H/2], glide], [b(3.5), [W/2 + 240, H/2], ease.inOutCubic]]);
const down = (t > b(1.8) && t < b(2.0)) || (t > b(2.5) && t < b(3.6));     // 點選 + 拖拽
const press = down ? 0.88 : 1;                                             // 按下時遊標縮小
// 拖拽：拖動期間數值由遊標位置算出來，鬆手後用彈簧回到吸附值
const raw = clamp((cur[0] - trackX) / trackW);
const value = t < b(3.6) ? raw : springTo(t, [[b(3.6), raw], [b(3.6) + 0.001, Math.round(raw * 4) / 4]]);
```
點選的那一幀放一個 `click` 音效（寫進 timeline 的 CUES）。遊標本身用簡單的向量箭頭，按下時加一個擴散的圓環。

## 5. 穿越轉場（鏡頭衝進一個點，裡面是下一鏡）

```js
// p: 0→1 的轉場進度；target: 場景 A 裡要衝進去的點（比如字母 O 的中心）；Z: 衝進去時的總放大倍數
function zoomThrough(p, target, drawA, drawB, Z = 60) {
  const e = ease.inOutExpo(p);
  if (e < 0.5) {                                   // 前半段：A 繞 target 指數放大
    const z = Math.pow(Z, e * 2);
    ctx.save(); camera(ctx, W, H, { x: target[0], y: target[1], zoom: z }); drawA(); ctx.restore();
  } else {                                         // 後半段：B 從很小放大到 1，B 的中心就是那個點
    const z = Math.pow(Z, (e - 0.5) * 2) / Z;
    ctx.save(); camera(ctx, W, H, { x: W / 2, y: H / 2, zoom: z }); drawB(); ctx.restore();
  }
}
```
要點：A 的「孔」裡填上 B 的主色，這樣中點交接時顏色是連續的；在 p ≈ 0.5 那一幀放一個 whoosh 的峰值，加 `--subframes 4` 效果會好很多。

## 6. 遮罩擦除（用場景裡的形狀露出下一鏡）

```js
const p = snap(seg(t, t0, t0 + 0.6));
drawA();
ctx.save();
ctx.beginPath();
// 斜切擦除：一條平行四邊形從左掃到右
const x = lerp(-W * 0.4, W * 1.2, p), slant = H * 0.35;
ctx.moveTo(-W, 0); ctx.lineTo(x + slant, 0); ctx.lineTo(x, H); ctx.lineTo(-W, H); ctx.closePath();
ctx.clip(); drawB(); ctx.restore();
```
把路徑換成一個巨大的字（`ctx.font` + `ctx.fillText` 配合 `globalCompositeOperation = 'destination-in'`），就是「文字即視窗」。

## 7. 粒子組字（無狀態寫法）

```js
// 初始化（READY 之前，只做一次，結果固定）：在離屏畫布上寫字，按網格取樣得到目標點
function sampleText(text, font, w, h, step) {
  const c = new OffscreenCanvas(w, h), g = c.getContext('2d');
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2);
  const d = g.getImageData(0, 0, w, h).data, pts = [];
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (d[(y * w + x) * 4 + 3] > 128) pts.push([x, y]);
  return pts;
}
const TARGETS = sampleText('MOTION', `900 ${300 * U}px Display`, W, H, Math.round(6 * U));   // 字型載入完以後再呼叫

// render(t) 裡：每個粒子 i 的位置只由 i 和 t 決定
TARGETS.forEach(([tx, ty], i) => {
  const r = rng(i + 1), sx = r() * W, sy = r() * H, delay = r() * 0.6;   // 起點和延遲由序號決定
  const k = spring(t - tForm - delay, { freq: 1.8, damp: 0.8 });        // 聚合
  const boom = ease.outExpo(seg(t, tBurst, tBurst + 0.8));              // 炸開
  const ang = r() * TAU, dist = (200 + r() * 600) * U;
  const drift = (noise1(t * 0.7 + i * 0.13) - 0.5) * 30 * U * (1 - k);  // 聚合前的漂浮
  const x = lerp(sx, tx, k) + drift + Math.cos(ang) * dist * boom;
  const y = lerp(sy, ty, k) + drift + Math.sin(ang) * dist * boom;
  ctx.fillRect(x, y, 3 * U, 3 * U);
});
```
幾千個粒子 Canvas 能撐住；上萬個時改用 WebGL 的點精靈，或者 Three.js 的 `InstancedMesh`（同樣把公式寫在頂點著色器裡，uniform 傳 t）。

## 8. 無狀態發射器（火花、尾跡、彩紙）

```js
// 粒子 i 在 born = i / rate 出生，壽命 life；位置是解析式，不需要上一幀
function emitter(t, { rate = 120, life = 1.2, origin, speed = 600, gravity = 900, seed = 3, tStart = 0, tEnd = Infinity }) {
  const first = Math.max(0, Math.floor((t - life - tStart) * rate)), last = Math.floor((Math.min(t, tEnd) - tStart) * rate);
  for (let i = first; i <= last; i++) {
    const born = tStart + i / rate, age = t - born; if (age < 0 || age > life) continue;
    const a = -Math.PI / 2 + (hash(i, seed) - 0.5) * 1.2, v = speed * (0.5 + hash(i, seed + 1));
    const x = origin[0] + Math.cos(a) * v * age, y = origin[1] + Math.sin(a) * v * age + 0.5 * gravity * age * age;
    ctx.globalAlpha = 1 - age / life; ctx.fillRect(x, y, 4 * U, 4 * U);
  }
  ctx.globalAlpha = 1;
}
```

## 9. 計數器

```js
const v = Math.round(lerp(0, 12800, ease.outExpo(seg(t, t0, t0 + 2.0))));
const land = pulse(t, t0 + 2.0, 0.15);                         // 落定時砸一下
ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + land * 0.08, 1 + land * 0.08);
ctx.font = `800 ${220 * U}px Display`; ctx.textAlign = 'center';
ctx.fillText(v.toLocaleString('en-US'), 0, 0); ctx.restore();
// 聲音：滾動期間按數值變化放 tick（越來越稀），落定放 impact
```

## 10. SVG 描邊（logo、手寫標註）

```html
<svg viewBox="0 0 400 200"><path id="p" pathLength="1" d="..." fill="none" stroke="#111" stroke-width="6" stroke-dasharray="1"/></svg>
```
```js
const k = ease.inOutCubic(seg(t, t0, t0 + 1.2));
document.getElementById('p').style.strokeDashoffset = 1 - k;
```
多條路徑錯峰：每條路徑的起點 `t0 + i * 0.08`。描完以後再用彈簧把填充色鋪上去。

## 11. 無縫循環

```js
const th = TAU * (t % DUR) / DUR;                          // 所有運動都寫成 th 的函式
const x = Math.cos(th * 2 + i * 0.3) * R;                  // 整數倍頻率 → 首尾天然銜接
const n = noise2(Math.cos(th) * 1.5 + 10, Math.sin(th) * 1.5 + 10, i);   // 在圓上取樣噪聲 = 週期噪聲
```
用 `inspect.mjs loop out/final.mp4` 看接縫：它比較「最後一幀 → 第一幀」這一步和兩側普通幀間步的相似度（不是要求首尾幀完全一樣：`render(DUR) = render(0)`，最後一幀比第一幀早一幀）。再連播兩遍看接縫。

## 12. WebGL 後期（CRT / 色差 / 暗角 / 半調都在這一層）

```html
<canvas id="src" style="display:none"></canvas><canvas id="out"></canvas>
```
```js
const src = document.getElementById('src'), out = document.getElementById('out');
const ctx = setupCanvas(src, W, H);                                  // 內容照常畫在 src 上
out.width = src.width; out.height = src.height; out.style.width = W + 'px'; out.style.height = H + 'px';
const gl = out.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
const vs = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0, 1); }`;
const fs = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D tex; uniform float t, hit; uniform vec2 res;
vec2 curve(vec2 u){ u = u * 2.0 - 1.0; u *= 1.0 + 0.06 * dot(u.yx, u.yx); return u * 0.5 + 0.5; }   // 映象管弧面
void main(){
  vec2 u = curve(uv);
  if (u.x < 0.0 || u.x > 1.0 || u.y < 0.0 || u.y > 1.0) { o = vec4(0, 0, 0, 1); return; }
  float ca = 0.0015 + hit * 0.008;                                   // 色差：撞擊時加強
  vec3 c = vec3(texture(tex, u + vec2(ca, 0)).r, texture(tex, u).g, texture(tex, u - vec2(ca, 0)).b);
  c *= 0.82 + 0.18 * sin(u.y * res.y * 3.14159);                     // 掃描線
  c *= 1.0 - 0.35 * pow(length(uv - 0.5) * 1.3, 2.0);                // 暗角
  o = vec4(c, 1);
}`;
const prog = gl.createProgram();
for (const [type, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
  const sh = gl.createShader(type); gl.shaderSource(sh, s); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));   // 編譯失敗要大聲報錯
  gl.attachShader(prog, sh);
}
gl.linkProgram(prog); gl.useProgram(prog);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

function post(t, hit = 0) {                                          // 在 render(t) 末尾呼叫
  gl.viewport(0, 0, out.width, out.height);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.uniform1f(gl.getUniformLocation(prog, 't'), t);
  gl.uniform1f(gl.getUniformLocation(prog, 'hit'), hit);
  gl.uniform2f(gl.getUniformLocation(prog, 'res'), H, H);            // 掃描線密度按畫面高度
  gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish();
}
```
像素風：`src` 用低解析度的邏輯畫布，紋理過濾改成 `gl.NEAREST`。半調：在片元著色器裡按亮度畫網格圓點。顆粒不要在這裡加，用 `--grain`。

## 13. 拖影（不開運動模糊時的快速運動）

```js
// 沿時間往回取樣幾次，透明度遞減：得到方向正確的拖影
for (let k = 4; k >= 0; k--) {
  const tt = t - k * 0.012;                 // 往回 12ms 一份
  ctx.globalAlpha = k === 0 ? 1 : 0.18 * (1 - k / 5);
  drawMover(tt);                            // 只畫快速運動的那個元素
}
ctx.globalAlpha = 1;
```

## 14. 節拍驅動

```js
import { b, CUES, BEAT } from './timeline.js';
const hits = CUES.filter(c => c.sfx === 'kick').map(c => c.t);
const kick = pulse(t, hits, 0.14);                // 每個重拍：縮放 / 亮度脈衝
const beatIndex = Math.floor(t / BEAT);           // 當前第幾拍，可以用來輪換顏色、版式
const onBeat = (t % BEAT) / BEAT;                 // 拍內進度 0→1，可以驅動拍內的小動作
```
使用者給了曲子：把 `beats.json` 的 `beats` / `downbeats` / `drops` 複製進 `timeline.js`（作為陣列匯出），畫面和 `score.mjs` 都從這裡讀。

**轉場的揭開點對拍**：先量出新畫面在轉場進行到多少時第一次露出來（`reveal`，0–1），再倒推起點，拍點那一幀就是新畫面露臉的那一幀。拍點上的衝擊加在整個舞臺上，新舊兩層一起放大再彈回：

```js
import { b, revealOn } from './timeline.js';
const HIT = b(16), TD = 0.5;                       // 第 16 拍要換鏡；這個光圈轉場 0.5 秒，進行到 30% 時新畫面開始露出
const T0 = revealOn(HIT, TD, 0.3);                 // = HIT − 0.15 s
const p = seg(t, T0, T0 + TD);                     // 轉場進度 0→1
const punch = 1 + 0.03 * pulse(t, [HIT], 0.2);     // 拍點那一幀放大 3%，約 0.3 秒回到 1
ctx.save(); camera(ctx, W, H, { zoom: punch });    // 衝擊作用在兩層上，不只是新層
drawOld(t); drawIris(p, () => drawNew(t));
ctx.restore();
```
渲完用 `inspect.mjs strip --at <HIT>` 看連續幀：拍點那一幀應該已經看得到新畫面，而且整屏有明顯變化。

## 15. Canvas 偽 3D 體塊（平面網格立成空間，不用 Three.js）

規則網格上的方塊、柱子、樓群、柱狀圖，用 `motion.js` 的 `camera3d` + `drawBoxes` 就夠了：透視投影 + 畫家演算法，幾百個體塊一幀幾毫秒，和 2D 畫面共用同一張畫布，所以「平面 → 立體」可以是連續的一個鏡頭。

```js
import { camera3d, drawBoxes, glide, seg, spring, lerp, mix, TAU } from './motion.js';
import { BAR } from './timeline.js';
const S = 96 * U, F = 1400 * U;                                     // 網格間距；焦距固定，推近靠縮短 dist
const INK = { top: '#F8F7F3', px: '#8E8B85', nx: '#D2CFC8', pz: '#111', nz: '#3A3936' };   // 每個朝向一個顏色 = 光照
const tilt = glide(seg(t, t0, t0 + 1.6));
const cam = camera3d({ W, H, focal: F, dist: F * lerp(1, 0.92, tilt),
  pitch: lerp(Math.PI / 2, 35 * Math.PI / 180, tilt),               // π/2 = 正俯視：和 2D 版式完全重合
  yaw: lerp(0, 0.5, tilt), cx: W / 2 + W * 0.16 * tilt, cy: H / 2 + H * 0.2 * tilt });   // 主體讓出位置給大字
const boxes = [];
for (let i = -7; i <= 7; i++) for (let j = -7; j <= 7; j++) {
  const d = Math.hypot(i, j); if (d > 6.5) continue;                // 圓形島：輪廓乾淨，留出天空放字
  const h = S * spring(t - t0, { freq: 1, damp: 0.95 }) * (0.4 + 2.4 * (0.5 + 0.5 * Math.cos(0.6 * d - TAU * (t - t0) / BAR)));
  const top = mix('#111', INK.top, Math.min(1, h / (S * 0.4)));    // 高度 0 時頂面是墨色方塊，長高後變亮：沒有顏色跳變
  boxes.push({ x: i * S, z: j * S, w: S * 0.5, h, color: { ...INK, top } });
}
drawBoxes(ctx, cam, boxes);
```

要點：
- **正俯視 = 平面**：`pitch = π/2`、高度為 0 時，體塊就是 2D 網格上的方塊（`focal = dist` 時比例 1:1）。從 2D 段切進來時，讓 2D 的最後一幀和這一幀對齊，再開始俯仰，觀眾看到的是「平面立起來」，不是切鏡頭。
- 相機基向量直接由 pitch / yaw 構造，正俯視不會像 `lookAt(cross(forward, worldUp))` 那樣退化。
- 畫家演算法按到相機的水平距離從遠到近排序，適合互相分開的體塊；體塊互相穿插或者要真實光影、陰影時，換 Three.js。
- 世界座標裡 y 朝上、地面 y = 0；yaw = 0 時相機在 +z 一側，`pz` 是正面。
- 大字和體塊同屏時先定「文字禁入區」（stack.md 第 4 節），用 `cx / cy` 和島的半徑把體塊擋在外面，渲幾張靜幀確認。

---

## 16. 繁體中文動態字幕（`drawSubtitle` 搭配 `narration.json`）

口播驅動影片可直接引用 `motion.js` 內建的 `drawSubtitle`，自動套用繁中標點避頭尾規則、豎屏安全區（底部預留 14%），並在有詞級時間戳時自動高亮正在念到的字詞：

```js
import { drawSubtitle } from './motion.js';
const narration = await fetch('./audio/narration.json').then(r => r.json());

// 在 render(t) 最後一層呼叫，確保不被其他圖層遮擋
drawSubtitle(ctx, {
  W, H, t, narration,
  style: {
    fontFamily: '"Noto Sans TC", "PingFang TC", sans-serif',
    activeColor: '#FFE14D',
    bgColor: 'rgba(14, 14, 18, 0.78)',
  },
});
```

---

## 17. 混合視覺工作流：AI 生圖插畫／背景 ＋ 程式碼視差動效

當主題需要具象插畫、產品氛圍或藝術肌理（純幾何向量容易顯得單薄）時，先用 `image-generator` 生成 **1～3 張高解析風格底圖／去背主體**放進 `<project>/assets/`，再用程式碼做多層視差（Parallax）、光影呼吸與動態排版：

```js
import { loadImage, camera, grainCanvas, maskReveal, glide, seg } from './motion.js';

const bgImg = await loadImage('./assets/scene-bg.png');
const heroImg = await loadImage('./assets/hero-cutout.png');
const grain = grainCanvas(256, 7, 16);

window.render = t => {
  ctx.clearRect(0, 0, W, H);
  // 遠景底圖：緩慢推進（zoom 1.0 → 1.08）製造電影鏡頭呼吸感
  ctx.save();
  camera(ctx, W, H, { zoom: 1 + 0.08 * glide(seg(t, 0, 8)) });
  ctx.drawImage(bgImg, 0, 0, W, H);
  ctx.restore();

  // 主體層：視差放大倍率更高，製造前後景深分離
  ctx.save();
  camera(ctx, W, H, { zoom: 1 + 0.16 * glide(seg(t, 0, 8)) });
  ctx.drawImage(heroImg, W * 0.25, H * 0.15, W * 0.5, H * 0.7);
  ctx.restore();

  // 前景遮罩大字與確定性底片顆粒
  maskReveal(ctx, [W * 0.08, H * 0.72, W * 0.84, 140 * U], glide(seg(t, 0.5, 1.4)), 'up', () => {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 ${96 * U}px "Noto Sans TC", sans-serif`;
    ctx.fillText('質感升級', W * 0.08, H * 0.8);
  });
  const ox = -((Math.floor(t * 24) * 53) % 256), oy = -((Math.floor(t * 24) * 97) % 256);
  ctx.drawImage(grain, ox, oy, W + 256, H + 256);
};
```
