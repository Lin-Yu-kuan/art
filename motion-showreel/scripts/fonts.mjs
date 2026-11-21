#!/usr/bin/env node
// Fetch self-hosted woff2 fonts from Google Fonts CSS2 API (subsetted when --text or --from is supplied).
//   node fonts.mjs list
//   node fonts.mjs fetch <project> [--family "Noto Sans TC"] [--weights 400,700,900] [--text "文案" | --from brief.md]
import fs from 'node:fs';
import path from 'node:path';
import { args, die } from './lib/browser.mjs';

const PRESETS = [
  { family: 'Noto Sans TC', weights: '400,700,900', note: '思源黑體（台灣繁中無襯線主力）' },
  { family: 'Noto Serif TC', weights: '400,700,900', note: '思源宋體（台灣繁中編輯 / 文化風格）' },
  { family: 'Zen Maru Gothic', weights: '400,700,900', note: '圓體（柔和 / 科普 / 親子風格）' },
  { family: 'LXGW WenKai TC', weights: '400,700', note: '霞鶩文楷繁體（手寫 / 書卷風格）' },
  { family: 'Archivo Black', weights: '400', note: '極粗幾何英文標題' },
  { family: 'JetBrains Mono', weights: '400,700', note: '等寬數字與技術標註' },
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DEFAULT_KEEP = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,!?:;-%+/()[]"\'，。！？、；：「」『』（）、—…';

function dedupeChars(text) {
  return [...new Set([...String(text), ...DEFAULT_KEEP])].filter(c => c !== '\r' && c !== '\n').join('');
}

function parseWeights(raw) {
  const list = String(raw || '400,700').split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n >= 100 && n <= 900);
  if (!list.length) die(`bad --weights ${raw}`);
  return [...new Set(list)].sort((a, b) => a - b);
}

export async function fetchGoogleFont({ root, family = 'Noto Sans TC', weights = '400,700,900', text = '', fetchImpl = globalThis.fetch } = {}) {
  if (!root) die('usage: node fonts.mjs fetch <project> [--family "Noto Sans TC"] [--weights 400,700,900] [--text "..." | --from file]');
  const fontDir = path.join(path.resolve(root), 'fonts');
  fs.mkdirSync(fontDir, { recursive: true });
  const wList = parseWeights(weights);
  const famParam = `${family.trim().replace(/\s+/g, '+')}:wght@${wList.join(';')}`;
  let url = `https://fonts.googleapis.com/css2?family=${famParam}&display=swap`;
  if (text && text.trim()) url += `&text=${encodeURIComponent(dedupeChars(text))}`;

  const cssRes = await fetchImpl(url, { headers: { 'User-Agent': UA } });
  if (!cssRes.ok) throw new Error(`Google Fonts CSS HTTP ${cssRes.status} for ${family}`);
  const css = await cssRes.text();

  const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const blocks = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)];
  if (!blocks.length) throw new Error(`No @font-face rules returned for ${family}`);

  const rules = [];
  const loadSpecs = new Set();
  let idx = 0;
  for (const [, body] of blocks) {
    const srcMatch = /url\((https:\/\/[^)]+\.woff2)\)/.exec(body);
    if (!srcMatch) continue;
    const weight = (/font-weight:\s*(\d+)/.exec(body) || [])[1] || '400';
    const style = (/font-style:\s*([^;]+)/.exec(body) || [])[1]?.trim() || 'normal';
    const range = (/unicode-range:\s*([^;]+)/.exec(body) || [])[1]?.trim();
    const fileName = `${slug}-${weight}-${++idx}.woff2`;
    const fontRes = await fetchImpl(srcMatch[1], { headers: { 'User-Agent': UA } });
    if (!fontRes.ok) throw new Error(`Font download HTTP ${fontRes.status}: ${srcMatch[1]}`);
    const bytes = Buffer.from(await fontRes.arrayBuffer());
    fs.writeFileSync(path.join(fontDir, fileName), bytes);
    loadSpecs.add(`${weight} 48px "${family}"`);
    rules.push([
      '@font-face {',
      `  font-family: "${family}";`,
      `  font-style: ${style};`,
      `  font-weight: ${weight};`,
      '  font-display: swap;',
      `  src: url("./${fileName}") format("woff2");`,
      ...(range ? [`  unicode-range: ${range};`] : []),
      '}',
    ].join('\n'));
  }
  if (!rules.length) throw new Error(`No woff2 font files found in CSS for ${family}`);

  const cssPath = path.join(fontDir, 'fonts.css');
  const marker = `/* === ${family} === */`;
  const block = `${marker}\n${rules.join('\n')}\n`;
  let existing = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
  const rx = new RegExp(`\\/\\* === ${family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} === \\*\\/[\\s\\S]*?(?=\\/\\* === |$)`);
  existing = rx.test(existing) ? existing.replace(rx, block) : (existing ? existing.trimEnd() + '\n\n' + block : block);
  fs.writeFileSync(cssPath, existing);

  return { cssPath, files: idx, specs: [...loadSpecs] };
}

if (import.meta.url === new URL(process.argv[1], 'file://').href || process.argv[1]?.endsWith('fonts.mjs')) {
  const { pos, opt } = args(process.argv.slice(2));
  const cmd = pos[0];
  if (opt.help || !cmd || cmd === 'help') {
    console.log('Fonts: download self-hosted woff2 fonts into <project>/fonts/\n  node fonts.mjs list\n  node fonts.mjs fetch <project> [--family "Noto Sans TC"] [--weights 400,700,900] [--text "..." | --from brief.md]');
  } else if (cmd === 'list') {
    for (const p of PRESETS) console.log(`  ${p.family.padEnd(18)} weights: ${p.weights.padEnd(12)} ${p.note}`);
  } else if (cmd === 'fetch') {
    const projectDir = pos[1];
    if (!projectDir) die('usage: node fonts.mjs fetch <project> [--family "Noto Sans TC"] [--weights 400,700,900] [--text "..." | --from file]');
    let text = typeof opt.text === 'string' ? opt.text : '';
    if (typeof opt.from === 'string') {
      const src = path.resolve(opt.from);
      if (!fs.existsSync(src)) die(`--from file not found: ${src}`);
      text += '\n' + fs.readFileSync(src, 'utf8');
    }
    const res = await fetchGoogleFont({
      root: projectDir,
      family: typeof opt.family === 'string' ? opt.family : 'Noto Sans TC',
      weights: typeof opt.weights === 'string' ? opt.weights : '400,700,900',
      text,
    });
    console.log(`✓ downloaded ${res.files} woff2 file(s) → ${res.cssPath}`);
    console.log(`  HTML: <link rel="stylesheet" href="./fonts/fonts.css">`);
    console.log(`  JS:   await loadFonts(${JSON.stringify(res.specs)});`);
  } else {
    die(`unknown command ${cmd}; use list or fetch`);
  }
}
