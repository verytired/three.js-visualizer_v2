// node src/tempo.check.ts
import assert from 'node:assert';
import { estimatePeriod } from './tempo.ts';

const kicks = (bpm: number, n: number, every = 1) => Array.from({ length: n }, (_, i) => (i * every * 60000) / bpm);
const bpm = (p: number | null) => Math.round(60 / p!);

assert.equal(bpm(estimatePeriod(kicks(128, 16))), 128); // 4つ打ち
assert.equal(bpm(estimatePeriod(kicks(140, 8, 2))), 140); // ハーフタイム（2拍ごと）
assert.equal(bpm(estimatePeriod(kicks(170, 16, 2))), 85); // 170 は 85 に折りたたまれる
assert.equal(bpm(estimatePeriod([...kicks(124, 10), 4837 + 300])), 124); // 1発だけ誤検出が混じっても中央値で無視
const frame = 1000 / 60; // 60fps で検出時刻が丸められても 128 に戻る
assert.equal(Math.round(60 / estimatePeriod(kicks(128, 16).map((t) => Math.ceil(t / frame) * frame))! * 10) / 10, 128);
assert.equal(estimatePeriod(kicks(120, 3)), null); // サンプル不足
console.log('tempo ok');
