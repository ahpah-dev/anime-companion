import * as THREE from 'three';

let sharedGradientMap: THREE.DataTexture | null = null;

export function getAnimeGradientMap(): THREE.DataTexture {
  if (sharedGradientMap) return sharedGradientMap;

  // Bright, clean 3-band anime cel ramp (keeps shadows luminous, never muddy grey)
  const width = 64;
  const data = new Uint8Array(width * 4);
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    let shade: number;
    if (t < 0.25) {
      shade = 198;
    } else if (t < 0.32) {
      const f = (t - 0.25) / 0.07;
      shade = Math.round(198 + f * (232 - 198));
    } else if (t < 0.72) {
      shade = 232;
    } else if (t < 0.78) {
      const f = (t - 0.72) / 0.06;
      shade = Math.round(232 + f * (255 - 232));
    } else {
      shade = 255;
    }

    data[i * 4] = shade;
    data[i * 4 + 1] = shade;
    data[i * 4 + 2] = shade;
    data[i * 4 + 3] = 255;
  }

  const tex = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  sharedGradientMap = tex;
  return tex;
}

export interface AnimeToonOptions {
  color: THREE.ColorRepresentation;
  rimColor?: THREE.ColorRepresentation;
  rimStrength?: number;
  hairHighlightColor?: THREE.ColorRepresentation;
  hairShine?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  map?: THREE.Texture | null;
}

export function createAnimeToonMaterial(
  options: AnimeToonOptions
): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({
    color: options.color,
    gradientMap: getAnimeGradientMap(),
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 1,
    side: options.side ?? THREE.FrontSide,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    map: options.map ?? null,
  });

  const rimColor = new THREE.Color(options.rimColor ?? '#ffdff2');
  const rimStrength = options.rimStrength ?? 0.28;
  const hairHighlight = new THREE.Color(options.hairHighlightColor ?? '#ffffff');
  const hairShine = options.hairShine ?? 0.0;

  mat.customProgramCacheKey = () =>
    `anime_toon_${rimStrength.toFixed(2)}_${hairShine.toFixed(2)}`;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: rimColor };
    shader.uniforms.uRimStrength = { value: rimStrength };
    shader.uniforms.uHairHighlight = { value: hairHighlight };
    shader.uniforms.uHairShine = { value: hairShine };

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uRimColor;
        uniform float uRimStrength;
        uniform vec3 uHairHighlight;
        uniform float uHairShine;`
      )
      .replace(
        '#include <opaque_fragment>',
        `
        vec3 viewDir = normalize(vViewPosition);
        float rimDot = 1.0 - max(dot(normal, viewDir), 0.0);
        float rimBand = smoothstep(0.64, 0.80, rimDot);
        outgoingLight += uRimColor * rimBand * uRimStrength;

        if (uHairShine > 0.01) {
          vec3 halfV = normalize(viewDir + vec3(0.08, 0.72, 0.45));
          float ndh = max(dot(normal, halfV), 0.0);
          float haloBand = smoothstep(0.84, 0.90, ndh) * smoothstep(0.98, 0.92, ndh);
          float fresnelFade = 1.0 - smoothstep(0.45, 0.85, rimDot);
          outgoingLight += uHairHighlight * haloBand * uHairShine * fresnelFade;
        }
        #include <opaque_fragment>`
      );
  };

  return mat;
}

export function createOutlineMaterial(
  color: THREE.ColorRepresentation = '#34223a',
  thickness = 0.0032
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uThickness: { value: thickness },
    },
    vertexShader: /* glsl */ `
      uniform float uThickness;
      void main() {
        vec3 displaced = position + normalize(normal) * uThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
      }
    `,
  });
}

export function addOutlinedMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  outlineColor: THREE.ColorRepresentation = '#34223a',
  outlineThickness = 0.003
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  if (outlineThickness > 0) {
    const outlineMat = createOutlineMaterial(outlineColor, outlineThickness);
    const outlineMesh = new THREE.Mesh(geometry, outlineMat);
    outlineMesh.name = '__outline';
    mesh.add(outlineMesh);
  }

  parent.add(mesh);
  return mesh;
}
