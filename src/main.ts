import * as THREE from 'three';
import GUI from 'lil-gui';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { DotScreenPass } from 'three/addons/postprocessing/DotScreenPass.js';
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { MirrorShader } from 'three/addons/shaders/MirrorShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { BleachBypassShader } from 'three/addons/shaders/BleachBypassShader.js';
import { SobelOperatorShader } from 'three/addons/shaders/SobelOperatorShader.js';
import { HueSaturationShader } from 'three/addons/shaders/HueSaturationShader.js';
import { BrightnessContrastShader } from 'three/addons/shaders/BrightnessContrastShader.js';
import { TechnicolorShader } from 'three/addons/shaders/TechnicolorShader.js';
import { DotMatrixShader } from './DotMatrixShader';
import { estimatePeriod } from './tempo';
import setting from './filter_setting.json';

const WIDTH = 1080;
const HEIGHT = 720;

// ---- video ----
const video = document.createElement('video');
video.muted = true;
video.playsInline = true;
video.loop = true;
const videoTexture = new THREE.VideoTexture(video);

// ---- renderer / composer ----
const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // r74 と同じ素通し
document.body.appendChild(renderer.domElement);

type UniformPass = { enabled: boolean; uniforms: Record<string, { value: any }> };
const passes: Record<string, UniformPass> = {
  dotmatrix: new ShaderPass(DotMatrixShader),
  film: new FilmPass(),
  mirror: new ShaderPass(MirrorShader),
  rgb: new ShaderPass(RGBShiftShader),
  dotscreen: new DotScreenPass(new THREE.Vector2(0, 0), 0.5, 0.8),
  glitch: new GlitchPass(),
  tilt: new ShaderPass(VerticalTiltShiftShader),
  bleach: new ShaderPass(BleachBypassShader),
  edges: new ShaderPass(SobelOperatorShader),
  huesat: new ShaderPass(HueSaturationShader),
  brightness: new ShaderPass(BrightnessContrastShader),
  technicolor: new ShaderPass(TechnicolorShader),
} as any;

const composer = new EffectComposer(renderer);
composer.addPass(new TexturePass(videoTexture));
const filters = setting.filters.map((f) => ({ ...f, folder: null as GUI | null }));
for (const f of filters) composer.addPass(passes[f.name] as any); // 順序は JSON 順

// 無効なパスは EffectComposer がスキップし、最後の有効パスが画面に出る
function apply() {
  for (const f of filters) {
    const pass = passes[f.name];
    pass.enabled = f.on;
    for (const p of f.params) if (pass.uniforms[p.name]) pass.uniforms[p.name].value = p.value;
  }
}

function resize() {
  let w = innerWidth;
  let h = innerHeight;
  if (w / h > WIDTH / HEIGHT) w = (h * WIDTH) / HEIGHT;
  else h = (w * HEIGHT) / WIDTH;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  passes.dotmatrix.uniforms.resolution.value.set(w, h);
  passes.edges.uniforms.resolution.value.set(w, h);
}
addEventListener('resize', resize);
resize();

// ---- GUI ----
const gui = new GUI();
const audio = {
  level: 0, bass: 0, sensitivity: 1, threshold: 0.5, react: 0.5,
  bpm: 120, pos: '-', state: '-', useBeatDetect: true, everyBars: 4, breakBars: 2,
};
const af = gui.addFolder('Audio');
af.add(audio, 'level', 0, 1).listen().disable();
af.add(audio, 'bass', 0, 1).listen().disable();
af.add(audio, 'bpm').listen().disable();
af.add(audio, 'pos').name('bar.beat').listen().disable();
af.add(audio, 'state').listen().disable();
af.add(audio, 'sensitivity', 0.1, 5, 0.1);
af.add(audio, 'threshold', 0, 1, 0.01).name('beat threshold');
af.add(audio, 'react', 0, 1, 0.01).name('reactivity');
af.add(audio, 'useBeatDetect').name('randomize on bar');
af.add(audio, 'everyBars', 1, 16, 1).name('every N bars');
af.add(audio, 'breakBars', 1, 8, 1).name('break after N bars');
for (const f of filters) {
  const folder = gui.addFolder(f.displayName).close();
  folder.add(f, 'on').listen().onChange(apply);
  for (const p of f.params) folder.add(p, 'value', p.min, p.max, p.step).name(p.displayName).listen().onChange(apply);
  f.folder = folder;
}
apply();

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function randomizeFilters() {
  for (const f of filters) {
    f.on = false;
    f.folder!.close();
  }
  for (let i = 0; i < 2; i++) {
    const f = filters[Math.floor(Math.random() * filters.length)];
    f.on = true;
    f.folder!.open();
  }
  for (const f of filters) for (const p of f.params) p.value = rand(p.min, p.max);
  apply();
}

// ---- audio / beat detection ----
const audioCtx = new AudioContext();
const analyser = audioCtx.createAnalyser();
analyser.smoothingTimeConstant = 0; // 平滑化はフレームレート依存になるので自前で時間基準にやる
analyser.fftSize = 1024;
const freq = new Uint8Array(analyser.frequencyBinCount); // 512
const BIN_HZ = audioCtx.sampleRate / analyser.fftSize;
const BASS_BINS = Math.max(1, Math.round(150 / BIN_HZ)); // 〜150Hz：キック
const LEVEL_BINS = Math.round(6000 / BIN_HZ); // 〜6kHz：空の高域で平均を薄めない
const BEAT_HOLD_MS = 300;
const RISE = 0.08; // 低域が直前の平均からこれだけ跳ねたらキック
let bassSlow = 0;
let lastBeat = 0;
let pulse = 0; // ビートで 1、以後減衰
let audioSource: AudioNode | null = null;

function setAudioSource(node: AudioNode, audible: boolean) {
  audioSource?.disconnect();
  audioSource = node;
  node.connect(analyser);
  if (audible) node.connect(audioCtx.destination); // マイクは出力しない（ハウリング防止）
}

const avg = (n: number) => {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += freq[i];
  return Math.min(1, (sum / n / 255) * audio.sensitivity);
};

function analyse(dt: number, now: number) {
  if (!audioSource || audioCtx.state !== 'running') {
    audio.level = audio.bass = 0;
    return;
  }
  analyser.getByteFrequencyData(freq);
  const ease = (tau: number) => 1 - Math.exp(-dt / tau);
  audio.level += (avg(LEVEL_BINS) - audio.level) * ease(0.05);
  audio.bass = avg(BASS_BINS);
  // バイト値は dB スケールで余韻も高く残るので、レベルではなく立ち上がり量で検出する
  const rise = audio.bass - bassSlow;
  bassSlow += rise * ease(0.1);
  pulse *= Math.exp(-dt * 6);
  advanceClock(dt, now);

  if (now - lastBeat < BEAT_HOLD_MS) return; // 二重検出防止（上限 200BPM）
  if (rise > RISE && audio.bass > audio.threshold) {
    pulse = 1;
    lastBeat = now;
    onKick(now);
  }
}

// ---- tempo / 小節カウント / ブレイク ----
// キックが来なくても拍の時計は BPM で回り続け、キックが来たら位相を少しずつ寄せる
let period = 0.5; // 1拍の秒数
let beatPos = 0; // 拍単位の位置（0 = 1小節目の1拍目）
let lastTick = 0;
let inBreak = false;
const kicks: number[] = [];
function onKick(now: number) {
  kicks.push(now);
  while (kicks[0] < now - 8000) kicks.shift();
  const p = estimatePeriod(kicks);
  if (p) {
    period = p;
    audio.bpm = Math.round(600 / p) / 10;
  }
  if (inBreak) return drop();
  beatPos -= (beatPos - Math.round(beatPos)) * 0.2;
}

function advanceClock(dt: number, now: number) {
  beatPos += dt / period;
  const b = Math.floor(beatPos);
  if (b > lastTick) {
    lastTick = b;
    onTick(b);
  }
  if (!inBreak && now - lastBeat > audio.breakBars * 4 * period * 1000) enterBreak();
}

function resetBar() {
  beatPos = lastTick = 0;
  audio.pos = '1.1';
}

function onTick(b: number) {
  const bar = Math.floor(b / 4);
  audio.pos = `${bar + 1}.${(b % 4) + 1}`;
  if (!inBreak && b % 4 === 0 && audio.useBeatDetect && bar % audio.everyBars === 0) randomizeFilters();
}

// ブレイク：キックが N 小節途切れたらフィルタを全部切って素の映像に
function enterBreak() {
  inBreak = true;
  audio.state = 'BREAK';
  for (const f of filters) {
    f.on = false;
    f.folder!.close();
  }
  apply();
}

// ドロップ：ブレイク明けの最初のキックを 1小節目の頭とみなして数え直す
function drop() {
  inBreak = false;
  audio.state = 'PLAY';
  resetBar();
  pulse = 1;
  document.getElementById('flash')!.animate([{ opacity: 1 }, { opacity: 0 }], 500);
  randomizeFilters();
}

// GUI の値に [音量ゲイン, ビートゲイン] を足す（GUI の値自体は書き換えない）
const MOD: Record<string, Record<string, [number, number]>> = {
  rgb: { amount: [0.02, 0.03] },
  film: { intensity: [0.5, 0.3] },
  dotmatrix: { size: [8, 16] },
  brightness: { brightness: [0.1, 0.25] },
  huesat: { hue: [0, 0.3] },
  dotscreen: { scale: [0, -0.2] },
};

function modulate() {
  for (const f of filters)
    for (const p of f.params) {
      const g = MOD[f.name]?.[p.name];
      if (g) passes[f.name].uniforms[p.name].value = p.value + audio.react * (audio.level * g[0] + pulse * g[1]);
    }
}

// 自動再生ポリシー対策：最初の操作で AudioContext を再開。止まっている間は案内を出す
const startEl = document.getElementById('start')!;
const showStart = () => (startEl.style.display = audioCtx.state === 'running' ? 'none' : '');
audioCtx.onstatechange = showStart;
showStart();
const resume = () => {
  audioCtx.resume();
  if (audioEl.src && audioEl.paused) audioEl.play(); // ファイル選択時に再生が弾かれた場合の保険
};
addEventListener('click', resume);
addEventListener('keydown', resume);

// ---- inputs ----
// ブラウザの音声処理を切る（オンだと音楽のダイナミクスが潰れてビートが取れない）
const rawAudio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
navigator.mediaDevices
  .getUserMedia({ video: { width: WIDTH, height: HEIGHT }, audio: rawAudio })
  .then((stream) => {
    video.srcObject = stream;
    video.play();
    if (stream.getAudioTracks().length) setAudioSource(audioCtx.createMediaStreamSource(stream), false);
  })
  .catch((e) => console.warn('webcam unavailable — 動画ファイルを選んでください', e));

const fileInput = (id: string) => document.getElementById(id) as HTMLInputElement;

fileInput('video').addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  video.srcObject = null;
  video.src = URL.createObjectURL(file);
  video.play();
});

const audioEl = new Audio();
audioEl.loop = true;
let audioElSource: MediaElementAudioSourceNode | null = null;
fileInput('audio').addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  audioEl.src = URL.createObjectURL(file);
  audioElSource ??= audioCtx.createMediaElementSource(audioEl); // 1要素につき1回しか作れない
  setAudioSource(audioElSource, true);
  audioCtx.resume();
  audioEl.play();
});

// ---- keys ----
addEventListener('keyup', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  if (e.code === 'Space') randomizeFilters();
  if (e.code === 'Digit1') resetBar(); // 1拍目に合わせて押すと小節頭を手動で合わせ直す
  if (e.code === 'KeyP') {
    const a = document.createElement('a');
    a.href = renderer.domElement.toDataURL('image/png');
    a.download = `${new Date().toISOString()}.png`;
    a.click();
  }
});

// ---- loop ----
let prev = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - prev) / 1000, 0.1);
  prev = now;
  analyse(dt, now);
  modulate();
  composer.render(dt);
});
