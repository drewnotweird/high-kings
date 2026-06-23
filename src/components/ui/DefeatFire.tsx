import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  // Direct clip-space — plane fills viewport regardless of camera
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const fragmentShader = `
precision highp float;
uniform float uTime;
varying vec2 vUv;

// Gradient noise
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
}

float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i),           f),           dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Fractal Brownian Motion
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    v += a * gnoise(p);
    p = rot * p * 2.1 + vec2(31.41, 59.26);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.35;

  // Domain warping (Inigo Quilez technique) — creates organic turbulence
  vec2 q = vec2(
    fbm(uv * 2.5 + vec2(0.0,   -t * 1.2)),
    fbm(uv * 2.5 + vec2(5.2,   1.3 - t))
  );
  vec2 r = vec2(
    fbm(uv * 2.5 + 3.0 * q + vec2(1.7,  9.2) - t * 0.3),
    fbm(uv * 2.5 + 3.0 * q + vec2(8.3,  2.8) - t * 0.25)
  );
  float f = fbm(uv * 2.5 + 4.0 * r - t * 0.1);

  // Remap noise [-1..1] → [0..1]
  f = f * 0.5 + 0.5;

  // Shape mask: hottest at bottom, tapers to nothing at top and sides
  float vMask = pow(clamp(1.0 - uv.y * 1.25, 0.0, 1.0), 0.65);
  float hMask = 1.0 - pow(clamp(abs(uv.x - 0.5) * 2.0, 0.0, 1.0), 1.4);

  float fire = f * vMask * hMask;
  fire = clamp(fire * 2.3, 0.0, 1.0);

  // Toon posterization — hard colour bands, no gradients
  const float N = 5.0;
  float band = floor(fire * N) / N;

  vec3 col;
  float alpha;
  if      (band < 1.0 / N) { discard; }
  else if (band < 2.0 / N) { col = vec3(0.40, 0.02, 0.00); alpha = 0.85; }
  else if (band < 3.0 / N) { col = vec3(0.82, 0.14, 0.00); alpha = 0.90; }
  else if (band < 4.0 / N) { col = vec3(1.00, 0.48, 0.02); alpha = 0.95; }
  else                      { col = vec3(1.00, 0.88, 0.30); alpha = 1.00; }

  gl_FragColor = vec4(col, alpha);
}
`

function FirePlane() {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uTime: { value: 0 } }}
        transparent
        depthWrite={false}
      />
    </mesh>
  )
}

export function DefeatFire() {
  return (
    <Canvas
      style={{ position: 'absolute', inset: 0 }}
      gl={{ alpha: true, antialias: false }}
      frameloop="always"
    >
      <FirePlane />
    </Canvas>
  )
}
