// Estimate the beat length (sec) from kick times (ms).
// Intervals are folded into 80–160 BPM so half-time and double-time land on the same beat.
export function estimatePeriod(onsets: number[]): number | null {
  const iv: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    let d = (onsets[i] - onsets[i - 1]) / 1000;
    if (d > 2) continue; // ignore gaps
    while (d < 60 / 160) d *= 2;
    while (d > 60 / 80) d /= 2;
    iv.push(d);
  }
  if (iv.length < 4) return null;
  iv.sort((a, b) => a - b);
  // drop outliers around the median, then average (smooths out per-frame quantization)
  const med = iv[iv.length >> 1];
  const near = iv.filter((d) => Math.abs(d - med) < med * 0.1);
  return near.reduce((a, b) => a + b) / near.length;
}
