import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { wrapText, maskReveal, grainCanvas } from '../../assets/starter/motion.js';
import { narrationClock } from '../../assets/starter/narration.js';
import { createProvider } from '../lib/narration-providers.mjs';
import { synthesizeNarration } from '../lib/narration.mjs';
import { fetchGoogleFont } from '../fonts.mjs';

const scripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'showreel-upgrades-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('wrapText honours Traditional Chinese kinsoku punctuation rules', () => {
  // Mock canvas measureText: 10px per char
  const ctx = { measureText: s => ({ width: [...s].length * 10 }) };
  const lines = wrapText(ctx, '台灣繁體中文，測試！', 60);
  assert.ok(lines.length >= 2);
  for (const line of lines) {
    assert.ok(!/^[，。！？、；：」』）】]/.test(line), `punctuation must not start a line: ${line}`);
  }
});

test('maskReveal and grainCanvas work deterministically without DOM', () => {
  const ops = [];
  const ctx = {
    save: () => ops.push('save'),
    beginPath: () => ops.push('beginPath'),
    rect: (...a) => ops.push(['rect', ...a]),
    clip: () => ops.push('clip'),
    translate: (x, y) => ops.push(['translate', x, y]),
    restore: () => ops.push('restore'),
  };
  maskReveal(ctx, [10, 20, 100, 50], 0.5, 'up', () => ops.push('draw'));
  assert.deepEqual(ops, ['save', 'beginPath', ['rect', 10, 20, 100, 50], 'clip', ['translate', 0, 25], 'draw', 'restore']);

  // Stub document.createElement for grainCanvas
  const prevDoc = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: (img) => { globalThis.__lastGrain = img.data; },
      }),
    }),
  };
  try {
    grainCanvas(16, 42, 20);
    const a = new Uint8ClampedArray(globalThis.__lastGrain);
    grainCanvas(16, 42, 20);
    const b = new Uint8ClampedArray(globalThis.__lastGrain);
    assert.deepEqual(a, b);
    assert.equal(a[3], 20);
  } finally {
    delete globalThis.__lastGrain;
    globalThis.document = prevDoc;
  }
});

test('narrationClock accepts tts-word-boundary and serves word queries', () => {
  const clock = narrationClock({
    duration: 3.0,
    segments: [{
      id: 'n0001',
      text: '歡迎使用動態圖形',
      start: 0,
      end: 2.4,
      wordTimingSource: 'tts-word-boundary',
      words: [
        { text: '歡迎', start: 0.1, end: 0.6 },
        { text: '使用', start: 0.6, end: 1.2 },
        { text: '動態', start: 1.2, end: 1.8 },
        { text: '圖形', start: 1.8, end: 2.3 },
      ],
    }],
  });
  const hit = clock.range('n0001', '動態');
  assert.equal(hit.start, 1.2);
  assert.equal(hit.end, 1.8);
  assert.equal(hit.source, 'tts-words');
});

test('openai and edge providers work with mocks and edge populates words in narration.json', async () => {
  // Mock OpenAI TTS
  let gotAuth = '';
  const openai = await createProvider({
    name: 'openai',
    env: { OPENAI_API_KEY: 'sk-test' },
    fetchImpl: async (_url, opts) => {
      gotAuth = opts.headers.Authorization;
      return new Response(Buffer.from('RIFFfakewav'), { status: 200 });
    },
  });
  const oaOut = path.join(tmp, 'openai.wav');
  await openai.synthesize({ text: 'hello', outFile: oaOut });
  assert.equal(gotAuth, 'Bearer sk-test');
  assert.equal(fs.readFileSync(oaOut, 'utf8'), 'RIFFfakewav');

  // Mock Edge TTS via EDGE_TTS_RUNNER
  const runner = path.join(tmp, 'mock-edge.mjs');
  fs.writeFileSync(runner, `
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const [text, , , outFile, wordsFile] = process.argv.slice(2);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.2', '-ar', '24000', '-f', 'wav', outFile]);
fs.writeFileSync(wordsFile, JSON.stringify([
  { text: '你好', start: 0.1, end: 0.5 },
  { text: '世界', start: 0.5, end: 1.0 }
]));
`);
  const proj = path.join(tmp, 'edge-proj');
  fs.mkdirSync(proj, { recursive: true });
  const scriptPath = path.join(proj, 'script.txt');
  fs.writeFileSync(scriptPath, '你好世界。');
  const data = await synthesizeNarration({
    root: proj,
    script: scriptPath,
    source: 'user',
    provider: 'edge',
    env: { ...process.env, EDGE_TTS_RUNNER: runner },
    log: () => {},
  });
  assert.equal(data.provider.id, 'edge');
  assert.equal(data.segments[0].wordTimingSource, 'tts-word-boundary');
  assert.equal(data.segments[0].words.length, 2);
});

test('fonts.mjs downloads woff2 and writes fonts.css from CSS2 API', async () => {
  const proj = path.join(tmp, 'font-proj');
  const fakeFont = Buffer.from('wOF2-mock-bytes');
  const fakeCss = `@font-face { font-family: 'Noto Sans TC'; font-style: normal; font-weight: 700; src: url(https://fonts.gstatic.com/mock.woff2) format('woff2'); }`;
  const res = await fetchGoogleFont({
    root: proj,
    family: 'Noto Sans TC',
    weights: '700',
    text: '繁中測試',
    fetchImpl: async url => url.includes('fonts.googleapis.com')
      ? new Response(fakeCss, { status: 200 })
      : new Response(fakeFont, { status: 200 }),
  });
  assert.equal(res.files, 1);
  assert.ok(fs.existsSync(res.cssPath));
  assert.match(fs.readFileSync(res.cssPath, 'utf8'), /url\("\.\/noto-sans-tc-700-1\.woff2"\)/);
});

test('render.mjs supports --alpha webm, --gif, and --webp outputs', () => {
  const proj = path.join(tmp, 'render-proj');
  execFileSync(process.execPath, [path.join(scripts, 'scaffold.mjs'), proj, '--audio', 'none']);
  fs.writeFileSync(path.join(proj, 'timeline.js'), 'export const DUR = 0.5;\nexport const CUES = [];\nexport const SHOTS = [{id:"a",t0:0,t1:0.5}];\nexport const HOLDS = [];\nexport const DROPS = [];\nexport const b = n => n * 0.5;\n');
  fs.writeFileSync(path.join(proj, 'index.html'), `<!doctype html><html><body style="margin:0;background:transparent"><canvas id="c"></canvas><script type="module">
    import { DUR } from './timeline.js';
    import { stageSize, setupCanvas } from './motion.js';
    const { W, H } = stageSize(); const ctx = setupCanvas(document.getElementById('c'), W, H);
    window.DUR = DUR;
    window.render = t => { ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#ff4a1c'; ctx.fillRect(20 + t * 40, 20, 40, 40); };
    window.render(0); window.READY = true;
  </script></body></html>`);

  const webm = path.join(proj, 'out', 'alpha.webm');
  execFileSync(process.execPath, [path.join(scripts, 'render.mjs'), proj, '--alpha', '--size', '160x90', '--fps', '10', '--workers', '1', '--out', webm]);
  const rgba = execFileSync('ffmpeg', ['-v', 'error', '-c:v', 'libvpx-vp9', '-i', webm, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
  assert.equal(rgba[3], 0, 'background pixel (0,0) should be transparent (alpha=0)');
  assert.equal(rgba[(40 * 160 + 40) * 4 + 3], 255, 'drawn rect pixel (40,40) should be opaque (alpha=255)');

  const gif = path.join(proj, 'out', 'anim.gif');
  execFileSync(process.execPath, [path.join(scripts, 'render.mjs'), proj, '--gif', '--size', '160x90', '--fps', '10', '--workers', '1', '--out', gif]);
  assert.ok(fs.statSync(gif).size > 100);

  const webp = path.join(proj, 'out', 'anim.webp');
  execFileSync(process.execPath, [path.join(scripts, 'render.mjs'), proj, '--webp', '--alpha', '--size', '160x90', '--fps', '10', '--workers', '1', '--out', webp]);
  assert.ok(fs.statSync(webp).size > 100);
});
