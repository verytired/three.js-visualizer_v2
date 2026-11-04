# three.js visualizer v2

An audio-reactive VJ tool that applies post-processing effects to a webcam feed or a video file.
A rebuild of [verytired/three.js-visualizer](https://github.com/verytired/three.js-visualizer) (three.js r74 + gulp + TypeScript 1.x) on a current stack:

- Vite + TypeScript
- three.js (post-processing from `three/addons` via npm)
- lil-gui

## Getting started

```sh
npm install
npm run dev     # dev server
npm run build   # type check + tempo estimator check + build (dist/)
```

1. Allow camera and microphone access in the browser.
2. Click the page once to start audio analysis. Browsers block audio until a user gesture, so a prompt stays at the bottom of the screen until you click.

To skip the webcam, pick your own files with the **video** / **audio** inputs at the top left. Files load paused; **play** starts (or pauses) both together and **restart** plays both from the beginning and resets the bar counter. Audio files play through the speakers; microphone input is not sent to the output, to avoid feedback.

## Recording

**rec** (or the `R` key) records the canvas together with the current audio source (the audio file, or the microphone). Press it again to stop; the file is downloaded as MP4 (H.264 + AAC) where the browser supports it, otherwise WebM.

## Controls

| Key | Action |
|---|---|
| Space | Randomize filters |
| 1 | Press on the downbeat to realign the bar counter |
| R | Start / stop recording |
| P | Save the canvas as PNG |

## Audio reactivity

Tune it in the **Audio** folder of the GUI (top right).

| Item | Description |
|---|---|
| level / bass | Input level meters (overall / below 150 Hz) |
| bpm / bar.beat / state | Estimated BPM, bar.beat position, PLAY or BREAK |
| sensitivity | Input gain. Adjust if the meters clip or barely move |
| beat threshold | Minimum bass level for a kick to count |
| reactivity | How strongly level and beats modulate effect parameters |
| randomize on bar / every N bars | Randomize filters on the downbeat every N bars |
| break after N bars | Treat N bars without a kick as a break |

### How it works

- **Kick detection:** a kick is a sudden rise of the low band (up to 150 Hz) above its recent average. Detection is held off for 300 ms afterwards (max 200 BPM).
- **BPM:** kick intervals from the last 8 seconds are folded into 80–160 BPM, outliers are dropped, and the rest are averaged (`src/tempo.ts`).
- **Bar counter:** a beat clock keeps running at the estimated BPM and is nudged toward each detected kick, so it doesn't stop when kicks drop out.
- **Break / drop:** when kicks stop for N bars, all filters are turned off to show the clean video. The first kick after a break is taken as the downbeat of bar 1: the counter resets, the screen flashes and the filters are randomized.
- **Continuous modulation:** level and beat pulses are added on top of RGB Shift, Film, Dot Matrix, brightness, hue and Dot Screen. The GUI values themselves are left untouched. Gains live in `MOD` in `src/main.ts`.

### Limitations

- BPM is folded into 80–160, so 170 BPM shows as 85.
- Break detection relies on the kick, so it works poorly on music that isn't four-on-the-floor.
- The downbeat is aligned only by a drop or the `1` key; it is not detected automatically.

## Filters

Effects are applied in the order listed in `src/filter_setting.json`, and the GUI sliders are generated from that file.

Dot Matrix / Film / Mirror / RGB Shift / Dot Screen / Glitch / Tilt Shift / Bleach / Edges (Sobel) / Hue & Saturation / Brightness & Contrast / Technicolor

## Files

```
index.html
src/main.ts              app (video input, effects, GUI, audio analysis, bar counter)
src/tempo.ts             BPM estimation from kick intervals
src/tempo.check.ts       check for the BPM estimator (node src/tempo.check.ts)
src/DotMatrixShader.ts   dot-matrix shader (felixturner / airtight.cc)
src/filter_setting.json  filter order and parameter ranges
```
