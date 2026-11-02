// キックの検出時刻（ms）から 1 拍の長さ（秒）を推定する。
// 間隔を 80〜160BPM に折りたたみ（裏打ち・ハーフタイムも同じ拍に寄せる）、中央値を取る。
export function estimatePeriod(onsets: number[]): number | null {
  const iv: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    let d = (onsets[i] - onsets[i - 1]) / 1000;
    if (d > 2) continue; // 途切れは無視
    while (d < 60 / 160) d *= 2;
    while (d > 60 / 80) d /= 2;
    iv.push(d);
  }
  if (iv.length < 4) return null;
  iv.sort((a, b) => a - b);
  // 中央値で外れ値を捨て、近いものを平均（検出がフレーム単位で丸められる分をならす）
  const med = iv[iv.length >> 1];
  const near = iv.filter((d) => Math.abs(d - med) < med * 0.1);
  return near.reduce((a, b) => a + b) / near.length;
}
