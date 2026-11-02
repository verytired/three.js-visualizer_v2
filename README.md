# three.js visualizer (remake)

Web カメラや動画に、音に反応するポストエフェクトをかける VJ ツールです。
[verytired/three.js-visualizer](https://github.com/verytired/three.js-visualizer)（three.js r74 + gulp + TypeScript 1.x）を、今の構成で作り直しました。

- Vite + TypeScript
- three.js（npm の `three/addons` のポストプロセス）
- lil-gui

## 起動

```sh
npm install
npm run dev     # 開発サーバー
npm run build   # 型チェック + テンポ推定のチェック + ビルド（dist/）
```

1. ブラウザでカメラとマイクの使用を許可します。
2. 画面を一度クリックすると、音声の解析が始まります。ブラウザの自動再生制限のため、クリックするまで画面下に案内が出ます。

カメラを使わない場合は、左上の **video** / **audio** から手持ちのファイルを選べます。音声ファイルは音が出ます。マイク入力はハウリングを防ぐため出力しません。

## 操作

| キー | 動作 |
|---|---|
| Space | フィルタをランダムに切り替え |
| 1 | 1拍目に合わせて押すと、小節の頭を合わせ直す |
| P | 画面を PNG で保存 |

## 音への反応

右上の GUI の **Audio** フォルダで調整します。

| 項目 | 内容 |
|---|---|
| level / bass | 入力レベルのメーター（全体 / 150Hz 以下） |
| bpm / bar.beat / state | 推定 BPM、小節.拍、PLAY か BREAK か |
| sensitivity | 入力感度。メーターが振り切れる・動かないときに調整 |
| beat threshold | キックとみなす最低の低域レベル |
| reactivity | 音量とビートを各パラメータに上乗せする強さ |
| randomize on bar / every N bars | N 小節ごとに、小節の頭でフィルタをランダムに切り替え |
| break after N bars | キックが N 小節途切れたらブレイクとみなす |

### 仕組み

- **キック検出：** 低域（〜150Hz）が直前の平均から急に立ち上がった瞬間をキックとみなします。直後の 300ms は再検出しません（上限 200BPM）。
- **BPM：** 直近 8 秒のキック間隔を 80〜160BPM に折りたたみ、外れ値を除いて平均します（`src/tempo.ts`）。
- **小節カウント：** BPM で拍を数え続け、キックが来るたびにずれを少しずつ補正します。キックが抜けても止まりません。
- **ブレイク / ドロップ：** キックが N 小節途切れたらブレイクとみなし、フィルタを全部切って素の映像にします。ブレイク明けの最初のキックを小節の頭とみなして数え直し、画面をフラッシュさせてフィルタを切り替えます。
- **常時の反応：** 音量とビートの強さを、RGB Shift・Film・Dot Matrix・明るさ・色相・Dot Screen に上乗せします。GUI 上の値は書き換えません。ゲインは `src/main.ts` の `MOD` で調整します。

### 制約

- BPM は 80〜160 に折りたたむので、170BPM は 85 と表示されます。
- ブレイク判定はキックの有無で見ているので、4つ打ち以外の曲では反応が鈍くなります。
- 小節の頭は、ドロップかキー `1` で合わせます。自動では判定しません。

## フィルタ

`src/filter_setting.json` に並べた順にエフェクトがかかります。GUI のスライダーもこのファイルから作られます。

Dot Matrix / Film / Mirror / RGB Shift / Dot Screen / Glitch / Tilt Shift / Bleach / Edges（Sobel） / Hue & Saturation / Brightness & Contrast / Technicolor

## ファイル構成

```
index.html
src/main.ts              本体（映像入力・エフェクト・GUI・音声解析・小節カウント）
src/tempo.ts             キック間隔からの BPM 推定
src/tempo.check.ts       BPM 推定のチェック（node src/tempo.check.ts）
src/DotMatrixShader.ts   ドットマトリクスのシェーダ（felixturner / airtight.cc）
src/filter_setting.json  フィルタの並びとパラメータ範囲
```
