import { Vector2 } from 'three';

// felixturner / airtight.cc — テクスチャを LED のようなドットグリッドで描画
export const DotMatrixShader = {
  uniforms: {
    tDiffuse: { value: null },
    spacing: { value: 10.0 },
    size: { value: 4.0 },
    blur: { value: 4.0 },
    resolution: { value: new Vector2(800, 600) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float spacing, size, blur;
    uniform vec2 resolution;
    varying vec2 vUv;
    void main() {
      vec2 count = resolution / spacing;
      vec4 color = texture2D(tDiffuse, floor(vUv * count) / count);
      vec2 pos = mod(gl_FragCoord.xy, vec2(spacing)) - vec2(spacing / 2.0);
      gl_FragColor = mix(color, vec4(0.0), smoothstep(size, size + blur, dot(pos, pos)));
    }`,
};
