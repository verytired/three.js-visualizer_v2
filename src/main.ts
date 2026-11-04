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
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // passthrough, same as r74
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
for (const f of filters) composer.addPass(passes[f.name] as any); // order follows the JSON
// white flash on drops, drawn in the canvas so it shows up in recordings
const flash = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, amount: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader:
    'uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv; void main() { gl_FragColor = mix(texture2D(tDiffuse, vUv), vec4(1.0), amount); }',
});
composer.addPass(flash);

// EffectComposer skips disabled passes; the last enabled one renders to screen
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
const mf = gui.addFolder('Media');
// don't leave buttons/checkboxes focused, or Space would press them instead of randomizing
gui.domElement.addEventListener('click', () => {
  const el = document.activeElement as HTMLInputElement | null;
  if (el?.tagName === 'BUTTON' || el?.type === 'checkbox') el.blur();
});
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
analyser.smoothingTimeConstant = 0; // built-in smoothing depends on frame rate; we smooth by time instead
analyser.fftSize = 1024;
const freq = new Uint8Array(analyser.frequencyBinCount); // 512
const BIN_HZ = audioCtx.sampleRate / analyser.fftSize;
const BASS_BINS = Math.max(1, Math.round(150 / BIN_HZ)); // up to 150 Hz: kick
const LEVEL_BINS = Math.round(6000 / BIN_HZ); // up to 6 kHz: keep empty highs from diluting the average
const BEAT_HOLD_MS = 300;
const RISE = 0.08; // a jump this large above the recent bass average counts as a kick
let bassSlow = 0;
let lastBeat = 0;
let pulse = 0; // 1 on a kick, then decays
let audioSource: AudioNode | null = null;
const recAudio = audioCtx.createMediaStreamDestination(); // whatever is analysed also goes into recordings

function setAudioSource(node: AudioNode, audible: boolean) {
  audioSource?.disconnect();
  audioSource = node;
  node.connect(analyser);
  node.connect(recAudio);
  if (audible) node.connect(audioCtx.destination); // never route the mic to the output (feedback)
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
  // byte data is in dB, so kick tails stay high; detect the rise, not the level
  const rise = audio.bass - bassSlow;
  bassSlow += rise * ease(0.1);
  pulse *= Math.exp(-dt * 6);
  advanceClock(dt, now);

  if (now - lastBeat < BEAT_HOLD_MS) return; // avoid double triggers (max 200 BPM)
  if (rise > RISE && audio.bass > audio.threshold) {
    pulse = 1;
    lastBeat = now;
    onKick(now);
  }
}

// ---- tempo / bar counter / break ----
// the beat clock keeps running at the BPM without kicks and is nudged toward each kick
let period = 0.5; // seconds per beat
let beatPos = 0; // position in beats (0 = bar 1, beat 1)
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

// break: after N bars without a kick, turn all filters off
function enterBreak() {
  inBreak = true;
  audio.state = 'BREAK';
  for (const f of filters) {
    f.on = false;
    f.folder!.close();
  }
  apply();
}

// drop: the first kick after a break becomes the downbeat of bar 1
function drop() {
  inBreak = false;
  audio.state = 'PLAY';
  resetBar();
  pulse = 1;
  flash.uniforms.amount.value = 1;
  randomizeFilters();
}

// [level gain, beat gain] added on top of GUI values (GUI values stay untouched)
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

// autoplay policy: resume the AudioContext on the first gesture; show a prompt until then
const startEl = document.getElementById('start')!;
const showStart = () => (startEl.style.display = audioCtx.state === 'running' ? 'none' : '');
audioCtx.onstatechange = showStart;
showStart();
const resume = () => audioCtx.resume();
addEventListener('click', resume);
addEventListener('keydown', resume);

// ---- inputs ----
// disable browser voice processing; it flattens music dynamics and hides beats
const rawAudio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
navigator.mediaDevices
  .getUserMedia({ video: { width: WIDTH, height: HEIGHT }, audio: rawAudio })
  .then((stream) => {
    video.srcObject = stream;
    ui.video = 'webcam';
    video.play();
    if (!stream.getAudioTracks().length) return;
    setAudioSource(audioCtx.createMediaStreamSource(stream), false);
    ui.audio = 'mic';
  })
  .catch((e) => console.warn('webcam unavailable — pick a video file instead', e));

const pickFile = (accept: string, onFile: (file: File) => void) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = () => input.files?.[0] && onFile(input.files[0]);
  input.hidden = true;
  document.body.append(input);
  return () => input.click();
};

const audioEl = new Audio();
audioEl.loop = true;
let audioElSource: MediaElementAudioSourceNode | null = null;

// play / pause / restart the chosen video and audio files together (the webcam is left alone)
const media = () => [audioEl, video].filter((m) => m.src && !m.srcObject);
const isPlaying = () => media().some((m) => !m.paused);

const ui = {
  loadVideo: pickFile('video/*', (file) => {
    video.srcObject = null;
    video.src = URL.createObjectURL(file); // loaded paused; start with play
    ui.video = file.name;
  }),
  loadAudio: pickFile('audio/*', (file) => {
    audioEl.src = URL.createObjectURL(file);
    audioElSource ??= audioCtx.createMediaElementSource(audioEl); // can only be created once per element
    setAudioSource(audioElSource, true);
    ui.audio = file.name;
  }),
  video: '-',
  audio: '-',
  play() {
    if (!isPlaying()) return playAll(false);
    media().forEach((m) => m.pause());
    if (ui.recWithPlay && recorder) toggleRecording();
  },
  restart: () => playAll(true),
  rec: () => toggleRecording(),
  recWithPlay: false,
};
mf.add(ui, 'loadVideo').name('load video');
mf.add(ui, 'video').listen().disable();
mf.add(ui, 'loadAudio').name('load audio');
mf.add(ui, 'audio').listen().disable();
const playCtrl = mf.add(ui, 'play');
mf.add(ui, 'restart');
const recCtrl = mf.add(ui, 'rec');
mf.add(ui, 'recWithPlay').name('rec with play');

function playAll(fromStart: boolean) {
  audioCtx.resume();
  if (ui.recWithPlay && !recorder) toggleRecording(); // start before play() so the first frame is captured
  for (const m of media()) {
    if (fromStart) m.currentTime = 0;
    m.play();
  }
  if (fromStart) resetBar();
}
for (const m of [audioEl, video]) for (const ev of ['play', 'pause']) m.addEventListener(ev, () => playCtrl.name(isPlaying() ? 'pause' : 'play'));

// ---- recording (canvas + current audio source) ----
const recType = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm'].find((t) =>
  MediaRecorder.isTypeSupported(t),
);
let recorder: MediaRecorder | null = null;

function toggleRecording() {
  if (recorder) return recorder.stop();
  const stream = new MediaStream([
    ...renderer.domElement.captureStream(60).getVideoTracks(),
    ...recAudio.stream.getAudioTracks(),
  ]);
  const chunks: Blob[] = [];
  recorder = new MediaRecorder(stream, { mimeType: recType, videoBitsPerSecond: 12_000_000 });
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.onstop = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(chunks, { type: recorder!.mimeType }));
    a.download = `${new Date().toISOString()}.${recorder!.mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'}`;
    a.click();
    recorder = null;
    recCtrl.name('rec');
  };
  recorder.start(1000);
  recCtrl.name('■ stop rec');
}

// ---- keys ----
addEventListener('keyup', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  if (e.code === 'Space') randomizeFilters();
  if (e.code === 'Digit1') resetBar(); // press on the downbeat to realign the bar counter
  if (e.code === 'KeyR') toggleRecording();
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
  flash.uniforms.amount.value = Math.max(0, flash.uniforms.amount.value - dt * 2); // fades over 0.5 s
  composer.render(dt);
});
