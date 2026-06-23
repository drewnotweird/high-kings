import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

// Simplified: 4 octaves, single domain warp (was 6 octaves + double warp)
const fragmentShader = `
precision mediump float;
uniform float uTime;
varying vec2 vUv;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
}

float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i),           f),           dot(hash2(i + vec2(1,0)), f - vec2(1,0)), u.x),
    mix(dot(hash2(i + vec2(0,1)), f - vec2(0,1)), dot(hash2(i + vec2(1,1)), f - vec2(1,1)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * gnoise(p);
    p = rot * p * 2.1 + vec2(31.41, 59.26);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.35;

  // Single domain warp (was double — halves FBM call count)
  vec2 q = vec2(
    fbm(uv * 2.5 + vec2(0.0,  -t * 1.2)),
    fbm(uv * 2.5 + vec2(5.2,  1.3 - t))
  );
  float f = fbm(uv * 2.5 + 2.5 * q - t * 0.1);

  f = f * 0.5 + 0.5;

  // Shape: full at bottom of canvas, fades to zero at top
  float vMask = pow(clamp(1.0 - uv.y, 0.0, 1.0), 0.55);
  float hMask = 1.0 - pow(clamp(abs(uv.x - 0.5) * 2.0, 0.0, 1.0), 1.4);

  float fire = clamp(f * vMask * hMask * 2.3, 0.0, 1.0);

  // Toon posterization — CSS blur will soften the hard edges
  const float N = 5.0;
  float band = floor(fire * N) / N;

  vec3 col;
  float alpha;
  if      (band < 1.0/N) { discard; }
  else if (band < 2.0/N) { col = vec3(0.40, 0.02, 0.00); alpha = 0.85; }
  else if (band < 3.0/N) { col = vec3(0.82, 0.14, 0.00); alpha = 0.90; }
  else if (band < 4.0/N) { col = vec3(1.00, 0.48, 0.02); alpha = 0.95; }
  else                    { col = vec3(1.00, 0.88, 0.30); alpha = 1.00; }

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
    // Bottom half only; CSS blur softens the toon bands into realistic-looking fire
    <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      height: '50%',
      filter: 'blur(6px)',
      pointerEvents: 'none',
    }}>
      <Canvas
        style={{ width: '100%', height: '100%' }}
        gl={{ alpha: true, antialias: false }}
        dpr={Math.min(window.devicePixelRatio, 1.5)}
        frameloop="always"
      >
        <FirePlane />
      </Canvas>
    </div>
  )
}
