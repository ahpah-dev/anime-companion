import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  VRM,
  VRMExpressionPresetName,
  VRMHumanBoneName,
  VRMLoaderPlugin,
  VRMUtils,
} from '@pixiv/three-vrm';
import { AppearanceConfig, Mood, SceneTheme } from '../types/companion';
import { AnimeGirlRig } from './AnimeGirlBuilder';

interface HeartBurst {
  mesh: THREE.Sprite;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

const THEME_CONFIGS: Record<
  SceneTheme,
  {
    bgTop: string;
    bgBottom: string;
    fogColor: string;
    ringColor: string;
    particleColor: string;
    keyLight: string;
    fillLight: string;
    rimLight: string;
  }
> = {
  sakura_room: {
    bgTop: '#241432',
    bgBottom: '#431d47',
    fogColor: '#2c1738',
    ringColor: '#ff8ec7',
    particleColor: '#ffb7db',
    keyLight: '#fff3f6',
    fillLight: '#e3b5ff',
    rimLight: '#ff90c6',
  },
  cyber_loft: {
    bgTop: '#0a0f24',
    bgBottom: '#132446',
    fogColor: '#0e1832',
    ringColor: '#22d3ee',
    particleColor: '#67e8f9',
    keyLight: '#eef9ff',
    fillLight: '#6366f1',
    rimLight: '#22d3ee',
  },
  starlight_stage: {
    bgTop: '#0d0d29',
    bgBottom: '#1d1c4d',
    fogColor: '#131338',
    ringColor: '#93c5fd',
    particleColor: '#e0f2fe',
    keyLight: '#f8fafc',
    fillLight: '#818cf8',
    rimLight: '#7dd3fc',
  },
  sunset_rooftop: {
    bgTop: '#2a1635',
    bgBottom: '#6a2c4a',
    fogColor: '#3d1f3e',
    ringColor: '#fbbf24',
    particleColor: '#fde68a',
    keyLight: '#fff4e0',
    fillLight: '#f472b6',
    rimLight: '#fbbf24',
  },
};

function createHeartSpriteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ff6aa8';
  ctx.beginPath();
  ctx.moveTo(32, 54);
  ctx.bezierCurveTo(10, 38, 6, 20, 18, 13);
  ctx.bezierCurveTo(26, 8, 32, 16, 32, 20);
  ctx.bezierCurveTo(32, 16, 38, 8, 46, 13);
  ctx.bezierCurveTo(58, 20, 54, 38, 32, 54);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.65)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class AnimeSceneController {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  private keyLight = new THREE.DirectionalLight(0xfff4f7, 1.45);
  private fillLight = new THREE.HemisphereLight(0xffe6f7, 0x3b2a54, 0.9);
  private rimLight = new THREE.DirectionalLight(0xff8dc7, 0.95);

  private backdropMat: THREE.ShaderMaterial;
  private ringMat: THREE.MeshBasicMaterial;
  private ambientParticles: THREE.Points;
  private ambientPositions: Float32Array;
  private particleMat: THREE.PointsMaterial;

  private girlRig: AnimeGirlRig;
  private customVrm: VRM | null = null;
  private vrmGroup = new THREE.Group();
  private vrmBlinkTimer = 3.0;
  private currentMood: Mood = 'neutral';
  private isSpeaking = false;
  private speechEnergy = 0;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerDownPos = new THREE.Vector2();
  private heartTex = createHeartSpriteTexture();
  private bursts: HeartBurst[] = [];

  private clock = new THREE.Clock();
  private animId = 0;
  private disposed = false;

  public onHeadpat?: () => void;
  public onPoke?: () => void;
  public onVrmLoaded?: (name: string) => void;
  public onVrmError?: (err: string) => void;

  constructor(container: HTMLElement, initialAppearance: AppearanceConfig) {
    this.container = container;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 40);
    this.camera.position.set(0, 1.35, 1.85);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.24, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 0.85;
    this.controls.maxDistance = 4.2;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.minPolarAngle = Math.PI * 0.22;

    // 3-Point Anime Lighting + warm bounce
    this.keyLight.position.set(1.8, 2.8, 2.5);
    this.rimLight.position.set(-2.2, 2.1, -2.0);
    const warmBounce = new THREE.AmbientLight(0xfff1ee, 0.42);
    this.scene.add(this.keyLight, this.fillLight, this.rimLight, warmBounce);

    // Gradient sky dome
    const theme = THEME_CONFIGS[initialAppearance.sceneTheme];
    this.backdropMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(theme.bgTop) },
        uBottom: { value: new THREE.Color(theme.bgBottom) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp((vWorldPos.y + 1.5) / 8.0, 0.0, 1.0);
          gl_FragColor = vec4(mix(uBottom, uTop, h), 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(18, 24, 16),
      this.backdropMat
    );
    this.scene.add(skyDome);

    // Studio floor disc + glowing halo ring
    const floorMat = new THREE.MeshBasicMaterial({
      color: '#110d1e',
      transparent: true,
      opacity: 0.55,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    this.scene.add(floor);

    this.ringMat = new THREE.MeshBasicMaterial({
      color: theme.ringColor,
      transparent: true,
      opacity: 0.72,
    });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 0.71, 64),
      this.ringMat
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    this.scene.add(ring);

    // Ambient floating anime particles
    const count = 90;
    this.ambientPositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.ambientPositions[i * 3] = (Math.random() - 0.5) * 4.8;
      this.ambientPositions[i * 3 + 1] = Math.random() * 3.0;
      this.ambientPositions[i * 3 + 2] = (Math.random() - 0.5) * 4.0 - 0.5;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.ambientPositions, 3)
    );
    this.particleMat = new THREE.PointsMaterial({
      map: createSoftParticleTexture(),
      color: theme.particleColor,
      size: 0.075,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.ambientParticles = new THREE.Points(pGeo, this.particleMat);
    this.scene.add(this.ambientParticles);

    // Built-in procedural cel-shaded anime girl
    this.girlRig = new AnimeGirlRig(initialAppearance);
    this.scene.add(this.girlRig.root);
    this.scene.add(this.vrmGroup);
    this.vrmGroup.visible = false;

    this.applyTheme(initialAppearance.sceneTheme);

    // Event listeners
    window.addEventListener('resize', this.handleResize);
    this.renderer.domElement.addEventListener(
      'pointermove',
      this.handlePointerMove
    );
    this.renderer.domElement.addEventListener(
      'pointerdown',
      this.handlePointerDown
    );
    this.renderer.domElement.addEventListener(
      'pointerup',
      this.handlePointerUp
    );

    this.animate();
  }

  private applyTheme(themeName: SceneTheme) {
    const t = THEME_CONFIGS[themeName];
    this.backdropMat.uniforms.uTop.value.set(t.bgTop);
    this.backdropMat.uniforms.uBottom.value.set(t.bgBottom);
    this.ringMat.color.set(t.ringColor);
    this.particleMat.color.set(t.particleColor);
    this.keyLight.color.set(t.keyLight);
    this.fillLight.color.set(t.fillLight);
    this.rimLight.color.set(t.rimLight);
  }

  public updateAppearance(appearance: AppearanceConfig) {
    this.applyTheme(appearance.sceneTheme);
    this.girlRig.applyAppearance(appearance);
  }

  public setMood(mood: Mood) {
    this.currentMood = mood;
    this.girlRig.setMood(mood);
  }

  public setThinking(thinking: boolean) {
    this.girlRig.setThinking(thinking);
  }

  public setSpeaking(speaking: boolean, energy = 0) {
    this.isSpeaking = speaking;
    this.speechEnergy = energy;
    this.girlRig.setSpeaking(speaking, energy);
  }

  public setCameraPreset(preset: 'portrait' | 'full') {
    if (preset === 'portrait') {
      this.camera.position.set(0, 1.35, 1.85);
      this.controls.target.set(0, 1.24, 0);
    } else {
      this.camera.position.set(0, 1.0, 2.75);
      this.controls.target.set(0, 0.85, 0);
    }
    this.controls.update();
  }

  public triggerHeadpatReaction() {
    this.girlRig.triggerHeadpat();
    const headPos = new THREE.Vector3(0, 1.55, 0.12);
    this.spawnHeartBurst(headPos, 7);
    this.onHeadpat?.();
  }

  public spawnHeartBurst(origin: THREE.Vector3, count = 6) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.heartTex,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.copy(origin);
      sprite.position.x += (Math.random() - 0.5) * 0.22;
      sprite.position.y += Math.random() * 0.1;
      sprite.scale.setScalar(0.06 + Math.random() * 0.04);
      this.scene.add(sprite);
      this.bursts.push({
        mesh: sprite,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.32,
          0.38 + Math.random() * 0.35,
          (Math.random() - 0.5) * 0.2
        ),
        life: 0,
        maxLife: 1.05 + Math.random() * 0.4,
      });
    }
  }

  public async loadVRMFile(file: File) {
    const url = URL.createObjectURL(file);
    try {
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      const gltf = await loader.loadAsync(url);
      const vrm: VRM | undefined = gltf.userData.vrm;
      if (!vrm) {
        throw new Error('Selected file does not contain valid VRM avatar data.');
      }

      this.clearVRM();
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      vrm.scene.rotation.y = Math.PI; // VRM0/1 standard faces +Z or -Z; normalize
      if (vrm.meta?.metaVersion === '1') {
        vrm.scene.rotation.y = 0;
      }

      // Relax T-pose arms slightly if humanoid bones exist
      const leftUpper = vrm.humanoid?.getNormalizedBoneNode(
        VRMHumanBoneName.LeftUpperArm
      );
      const rightUpper = vrm.humanoid?.getNormalizedBoneNode(
        VRMHumanBoneName.RightUpperArm
      );
      if (leftUpper) leftUpper.rotation.z = 1.15;
      if (rightUpper) rightUpper.rotation.z = -1.15;

      this.vrmGroup.add(vrm.scene);
      this.customVrm = vrm;
      this.girlRig.root.visible = false;
      this.vrmGroup.visible = true;
      this.onVrmLoaded?.(file.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load VRM';
      this.onVrmError?.(msg);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  public useBuiltInModel() {
    this.clearVRM();
    this.vrmGroup.visible = false;
    this.girlRig.root.visible = true;
  }

  private clearVRM() {
    if (this.customVrm) {
      VRMUtils.deepDispose(this.customVrm.scene);
      this.vrmGroup.remove(this.customVrm.scene);
      this.customVrm = null;
    }
  }

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handlePointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    this.pointer.set(nx, ny);
    this.girlRig.setLookTarget(nx, ny);
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.pointerDownPos.set(e.clientX, e.clientY);
  };

  private handlePointerUp = (e: PointerEvent) => {
    const dist = Math.hypot(
      e.clientX - this.pointerDownPos.x,
      e.clientY - this.pointerDownPos.y
    );
    if (dist > 6 || !this.girlRig.root.visible) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -(((e.clientY - rect.top) / rect.height) * 2 - 1)
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hits = this.raycaster.intersectObjects(
      [this.girlRig.headHitbox, this.girlRig.bodyHitbox],
      false
    );
    if (hits.length > 0) {
      const hit = hits[0];
      if (hit.object === this.girlRig.headHitbox) {
        this.girlRig.triggerHeadpat();
        this.spawnHeartBurst(hit.point.clone().add(new THREE.Vector3(0, 0.12, 0)));
        this.onHeadpat?.();
      } else {
        this.girlRig.triggerPoke();
        this.onPoke?.();
      }
    }
  };

  private animate = () => {
    if (this.disposed) return;
    this.animId = requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    this.controls.update();

    // Update built-in procedural anime girl or custom VRM
    if (this.girlRig.root.visible) {
      this.girlRig.update(dt, elapsed);
    } else if (this.customVrm) {
      this.updateVrmAnimation(dt, elapsed);
    }

    // Float ambient particles gently upward
    const posAttr = this.ambientParticles.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      let y = posAttr.getY(i) + dt * 0.14;
      let x = posAttr.getX(i) + Math.sin(elapsed * 0.7 + i) * dt * 0.04;
      if (y > 3.0) y = 0.05;
      posAttr.setXY(i, x, y);
    }
    posAttr.needsUpdate = true;

    // Heart burst animation
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life += dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.vel.y -= dt * 0.18;
      const alpha = Math.max(0, 1 - b.life / b.maxLife);
      (b.mesh.material as THREE.SpriteMaterial).opacity = alpha;
      if (b.life >= b.maxLife) {
        this.scene.remove(b.mesh);
        (b.mesh.material as THREE.SpriteMaterial).dispose();
        this.bursts.splice(i, 1);
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  private updateVrmAnimation(dt: number, elapsed: number) {
    if (!this.customVrm) return;
    const expr = this.customVrm.expressionManager;
    if (expr) {
      this.vrmBlinkTimer -= dt;
      if (this.vrmBlinkTimer <= 0) {
        this.vrmBlinkTimer = 2.8 + Math.random() * 3.0;
      }
      const blink = this.vrmBlinkTimer < 0.14 ? Math.sin((this.vrmBlinkTimer / 0.14) * Math.PI) : 0;
      expr.setValue(VRMExpressionPresetName.Blink, blink);

      const mouthVal = this.isSpeaking ? this.speechEnergy : 0;
      expr.setValue(VRMExpressionPresetName.Aa, mouthVal * 0.85);
      expr.setValue(
        VRMExpressionPresetName.Happy,
        this.currentMood === 'happy' || this.currentMood === 'excited' ? 0.65 : 0
      );
      expr.setValue(
        VRMExpressionPresetName.Surprised,
        this.currentMood === 'surprised' ? 0.65 : 0
      );
    }

    const headBone = this.customVrm.humanoid?.getNormalizedBoneNode(
      VRMHumanBoneName.Head
    );
    if (headBone) {
      headBone.rotation.y = this.pointer.x * 0.22;
      headBone.rotation.x = -this.pointer.y * 0.12;
      headBone.rotation.z = Math.sin(elapsed * 1.1) * 0.03;
    }

    this.customVrm.update(dt);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener(
      'pointermove',
      this.handlePointerMove
    );
    this.renderer.domElement.removeEventListener(
      'pointerdown',
      this.handlePointerDown
    );
    this.renderer.domElement.removeEventListener(
      'pointerup',
      this.handlePointerUp
    );
    this.clearVRM();
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
