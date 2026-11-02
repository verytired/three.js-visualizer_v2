// node src/tempo.check.ts
import assert from 'node:assert';
import { estimatePeriod } from './tempo.ts';

const kicks = (bpm: number, n: number, every = 1) => Array.from({ length: n }, (_, i) => (i * every * 60000) / bpm);
const bpm = (p: number | null) => Math.round(60 / p!);

assert.equal(bpm(estimatePeriod(kicks(128, 16))), 128); // four-on-the-floor
assert.equal(bpm(estimatePeriod(kicks(140, 8, 2))), 140); // half-time (kick every 2 beats)
assert.equal(bpm(estimatePeriod(kicks(170, 16, 2))), 85); // 170 folds down to 85
assert.equal(bpm(estimatePeriod([...kicks(124, 10), 4837 + 300])), 124); // a single false kick is ignored
const frame = 1000 / 60; // still 128 when kick times are quantized to 60fps frames
assert.equal(Math.round(60 / estimatePeriod(kicks(128, 16).map((t) => Math.ceil(t / frame) * frame))! * 10) / 10, 128);
assert.equal(estimatePeriod(kicks(120, 3)), null); // not enough samples
console.log('tempo ok');
