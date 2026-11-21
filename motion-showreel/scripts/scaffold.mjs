#!/usr/bin/env node
// Cross-platform project scaffolding (equivalent to scaffold.sh).
//   node scaffold.mjs <project-dir> [--audio synth|tone|layer|file|none]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawArgs = process.argv.slice(2);
const destArg = rawArgs[0];
if (!destArg || destArg.startsWith('-')) {
  console.error('usage: node scaffold.mjs <project-dir> [--audio synth|tone|layer|file|none]');
  process.exit(1);
}

let audio = 'synth';
if (rawArgs[1] === '--audio') {
  if (!rawArgs[2]) { console.error('✗ --audio needs synth|tone|layer|file|none'); process.exit(1); }
  audio = rawArgs[2];
} else if (rawArgs[1]?.startsWith('--audio=')) {
  audio = rawArgs[1].slice('--audio='.length);
} else if (rawArgs[1]) {
  console.error(`✗ unknown option ${rawArgs[1]} (usage: node scaffold.mjs <project-dir> [--audio synth|tone|layer|file|none])`);
  process.exit(1);
}
if (!['synth', 'tone', 'layer', 'file', 'none'].includes(audio)) {
  console.error(`✗ --audio must be synth | tone | layer | file | none (got '${audio}')`);
  process.exit(1);
}

const DEST = path.resolve(destArg);
if (fs.existsSync(path.join(DEST, 'index.html'))) {
  console.error(`✗ ${DEST}/index.html already exists; not overwriting`);
  process.exit(1);
}

fs.mkdirSync(DEST, { recursive: true });
const ST = path.join(SKILL, 'assets', 'starter');
for (const file of ['index.html', 'motion.js', 'timeline.js', 'narration.js', 'preview.js', 'package.json']) {
  fs.copyFileSync(path.join(ST, file), path.join(DEST, file));
}
if (audio === 'synth') fs.copyFileSync(path.join(ST, 'score.mjs'), path.join(DEST, 'score.mjs'));
else if (audio === 'tone') fs.copyFileSync(path.join(ST, 'score.tone.js'), path.join(DEST, 'score.tone.js'));
else if (audio === 'layer') {
  fs.copyFileSync(path.join(ST, 'score.tone.js'), path.join(DEST, 'score.tone.js'));
  fs.copyFileSync(path.join(ST, 'score.layer.mjs'), path.join(DEST, 'score.mjs'));
}

const skillPosix = SKILL.split(path.sep).join('/');
for (const tmpl of ['build.sh', 'build.mjs']) {
  const out = fs.readFileSync(path.join(ST, tmpl), 'utf8')
    .replaceAll('__SKILL_DIR__', skillPosix)
    .replaceAll('__AUDIO__', audio);
  const dst = path.join(DEST, tmpl);
  fs.writeFileSync(dst, out);
  if (process.platform !== 'win32') fs.chmodSync(dst, 0o755);
}
for (const dir of ['fonts', 'assets', 'audio', 'qa', 'out']) {
  fs.mkdirSync(path.join(DEST, dir), { recursive: true });
}

console.log(`✓ project at ${DEST}  (audio: ${audio})`);
console.log(`  stills:  node ${path.join(SKILL, 'scripts', 'render.mjs')} "${DEST}" --still 1,3,6 --sheet`);
if (audio === 'synth') console.log(`  music:   node ${path.join(SKILL, 'scripts', 'audio.mjs')} build "${path.join(DEST, 'score.mjs')}"`);
else if (audio === 'tone') console.log(`  music:   node ${path.join(SKILL, 'scripts', 'audio.mjs')} build "${path.join(DEST, 'score.tone.js')}"   (samples first: audio.mjs samples salamander)`);
else if (audio === 'layer') console.log(`  music:   score.tone.js is built raw to audio/tone.wav, then score.mjs loads it with S.load('audio/tone.wav')`);
else if (audio === 'none') console.log('  music:   none (silent piece; qa will expect no audio track)');
else if (audio === 'file') console.log('  audio:   prepare audio/final.wav, or set AUDIO_FILE to your final mix');
console.log(`  preview: node ${path.join(SKILL, 'scripts', 'editor.mjs')} "${DEST}" --size 1920x1080 --fps 30`);
console.log(`  rebuild: node "${path.join(DEST, 'build.mjs')}"   (after approval, without workspace audio edits)`);
