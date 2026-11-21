#!/usr/bin/env node
// Cross-platform one-command rebuild + technical acceptance (equivalent to build.sh).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
process.chdir(HERE);

const env = process.env;
const SKILL = env.SKILL || '__SKILL_DIR__';
const FPS = env.FPS || '30';
const SIZE = env.SIZE || '1920x1080';
const AUDIO = env.AUDIO || '__AUDIO__';
const AUDIO_FILE = env.AUDIO_FILE || 'audio/final.wav';
const LOOP = env.LOOP || '0';
const DETERMINISM = env.DETERMINISM ?? '1';
const TEXTCHECK = env.TEXTCHECK ?? '1';
const extraArgs = process.argv.slice(2);

for (const a of extraArgs) {
  if (/^--(fps|size|out|audio|start|duration)/.test(a)) {
    console.error(`✗ build.mjs ${a}: FPS / SIZE are env vars here (they also drive the checks)`);
    console.error('  for a segment or a one-off output, call render.mjs directly');
    process.exit(1);
  }
}

const tl = await import(pathToFileURL(path.join(HERE, 'timeline.js')).href);
const dur = Number(tl.DUR ?? '');
if (!Number.isFinite(dur) || dur <= 0 || dur > 1200) {
  console.error('✗ timeline DUR must be positive and at most 1200 seconds; confirm a duration conflict with the user');
  process.exit(1);
}
if (AUDIO === 'file') {
  if (!fs.existsSync(AUDIO_FILE)) {
    console.error(`✗ AUDIO=file needs ${AUDIO_FILE}`);
    process.exit(1);
  }
  const n = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', AUDIO_FILE], { encoding: 'utf8' }).trim());
  if (!Number.isFinite(n) || Math.abs(n - dur) > 1.5 / Number(FPS)) {
    console.error('✗ prepared audio duration conflicts with timeline; confirm the duration before building (no automatic trimming or speed change)');
    process.exit(1);
  }
}

const runNode = (script, argv, { allowFail = false } = {}) => {
  const r = spawnSync(process.execPath, [path.join(SKILL, 'scripts', script), ...argv], { stdio: 'inherit' });
  if (r.status !== 0 && !allowFail) process.exit(r.status || 1);
  return r.status === 0;
};
const need = f => { if (!fs.existsSync(f)) { console.error(`✗ AUDIO=${AUDIO} needs ${f}`); process.exit(1); } };
const ignored = f => { if (fs.existsSync(f)) console.log(`! ${f} is ignored (AUDIO=${AUDIO}). Delete it, or set AUDIO=layer to use both.`); };

if (AUDIO === 'synth') { need('score.mjs'); ignored('score.tone.js'); runNode('audio.mjs', ['build', 'score.mjs', '--out', 'audio/music.wav']); }
else if (AUDIO === 'tone') { need('score.tone.js'); ignored('score.mjs'); runNode('audio.mjs', ['build', 'score.tone.js', '--out', 'audio/music.wav']); }
else if (AUDIO === 'layer') {
  need('score.tone.js'); need('score.mjs');
  if (!/tone\.wav/.test(fs.readFileSync('score.mjs', 'utf8'))) {
    console.error('✗ AUDIO=layer but score.mjs never loads audio/tone.wav: the Tone layer would be built and then dropped');
    process.exit(1);
  }
  runNode('audio.mjs', ['build', 'score.tone.js', '--raw', '--out', 'audio/tone.wav']);
  runNode('audio.mjs', ['build', 'score.mjs', '--out', 'audio/music.wav']);
}
else if (AUDIO === 'none') { ignored('score.mjs'); ignored('score.tone.js'); }
else if (AUDIO !== 'file') { console.error(`✗ AUDIO must be synth | tone | layer | file | none (got '${AUDIO}')`); process.exit(1); }

if (AUDIO === 'file' && fs.existsSync('audio/narration.json')) {
  runNode('narration.mjs', ['check', '.', '--duration', String(dur), '--audio', AUDIO_FILE]);
}

const finalAudio = AUDIO === 'file' ? AUDIO_FILE : 'audio/music.wav';
const expectAudio = AUDIO === 'none' ? 'none' : 'required';

if (DETERMINISM === '1') runNode('render.mjs', ['.', '--fps', FPS, '--size', SIZE, '--determinism']);
else console.log('! DETERMINISM=0: determinism not checked (fine for drafts, not for delivery)');

const renderArgs = ['.', '--fps', FPS, '--size', SIZE, '--out', 'out/final.mp4'];
if (AUDIO !== 'none') renderArgs.push('--audio', finalAudio);
runNode('render.mjs', [...renderArgs, ...extraArgs]);

if (TEXTCHECK === '1') {
  if (!runNode('render.mjs', ['.', '--size', SIZE, '--text-check', '--out', 'qa/text'], { allowFail: true })) {
    console.log('! text check could not run (review material only; the build goes on)');
  }
}

const qaArgs = ['qa', 'out/final.mp4', '--out', 'qa/final', '--expect-size', SIZE, '--expect-fps', FPS, '--audio', expectAudio, '--expect-duration', String(dur)];
if (LOOP === '1') qaArgs.push('--loop');
runNode('inspect.mjs', qaArgs);
