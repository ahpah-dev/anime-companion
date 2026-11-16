import * as THREE from 'three';
import { EyeStyle, Mood } from '../types/companion';
import { addOutlinedMesh, createAnimeToonMaterial } from './AnimeMaterials';

/**
 * Evaluates the sculpted anime head proportions:
 * Full cranium, cute soft anime cheeks, gentle tapered jawline, and rounded chin.
 */
export function deformAnimeHeadPoint(v: THREE.Vector3): THREE.Vector3 {
  const p = v.clone();

  p.x *= 0.212;
  p.y *= 0.216;
  p.z *= 0.202;

  // Softly taper jaw while keeping cute rounded anime cheeks & chin
  if (p.y < -0.015) {
    const t = Math.min(1, (-0.015 - p.y) / 0.2);
    const smoothT = t * t * (3 - 2 * t);
    p.x *= 1 - smoothT * 0.26;
    if (p.z > 0) {
      p.z *= 1 - smoothT * 0.14;
    } else {
      p.z *= 1 - smoothT * 0.28;
    }
    // Gentle chin rounding forward
    if (p.z > 0 && Math.abs(p.x) < 0.085) {
      p.z += (1 - Math.abs(p.x) / 0.085) * smoothT * 0.008;
    }
  }

  // Gently soften the front eye plane for clean 2D-like anime eye framing
  if (p.z > 0.09 && p.y > -0.1 && p.y < 0.09) {
    const fy = 1 - Math.abs(p.y) / 0.1;
    const fx = Math.max(0, 1 - Math.abs(p.x) / 0.16);
    p.z -= fy * fx * 0.014;
  }

  // Soft cute cheek fullness
  if (p.z > 0.05 && p.y < -0.02 && p.y > -0.12) {
    const cheekX = Math.exp(-Math.pow((Math.abs(p.x) - 0.092) / 0.048, 2));
    const cheekY = Math.exp(-Math.pow((p.y + 0.068) / 0.038, 2));
    p.z += cheekX * cheekY * 0.012;
  }

  // Delicate small anime nose tip
  if (p.z > 0.12 && Math.abs(p.x) < 0.022 && p.y > -0.085 && p.y < -0.02) {
    const nx = Math.exp(-Math.pow(p.x / 0.01, 2));
    const ny = Math.exp(-Math.pow((p.y + 0.058) / 0.014, 2));
    p.z += nx * ny * 0.011;
  }

  return p;
}

export function createAnimeHeadGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 64, 48);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const deformed = deformAnimeHeadPoint(v);
    pos.setXYZ(i, deformed.x, deformed.y, deformed.z);
  }

  geo.computeVertexNormals();
  return geo;
}

export function createIrisTexture(
  style: EyeStyle,
  eyeColorHex: string
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const rx = size * 0.42;
  const ry = size * 0.46;

  const baseColor = new THREE.Color(eyeColorHex);
  const darkColor = baseColor.clone().multiplyScalar(0.32);
  const midColor = baseColor.clone();
  const brightColor = baseColor.clone().lerp(new THREE.Color('#ffffff'), 0.58);
  const rimGlow = baseColor.clone().lerp(new THREE.Color('#fff5ff'), 0.8);

  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();

  const bgGrad = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
  bgGrad.addColorStop(0.0, `#${darkColor.getHexString()}`);
  bgGrad.addColorStop(0.34, `#${midColor.getHexString()}`);
  bgGrad.addColorStop(0.74, `#${brightColor.getHexString()}`);
  bgGrad.addColorStop(1.0, `#${rimGlow.getHexString()}`);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // Radial anime iris facets
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 32; i++) {
    ctx.rotate((Math.PI * 2) / 32);
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(20,10,35,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-9, ry * 0.92);
    ctx.lineTo(9, ry * 0.92);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Outer dark iris border
  ctx.strokeStyle = `#${darkColor.clone().multiplyScalar(0.6).getHexString()}`;
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 4, ry - 4, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Luminous lower crescent bounce
  const bounceGrad = ctx.createRadialGradient(
    cx,
    cy + ry * 0.45,
    10,
    cx,
    cy + ry * 0.45,
    rx * 0.78
  );
  bounceGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  bounceGrad.addColorStop(0.55, 'rgba(255, 245, 255, 0.35)');
  bounceGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = bounceGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 0.38, rx * 0.72, ry * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Upper eyelid shadow gradient inside iris
  const shadowGrad = ctx.createLinearGradient(0, cy - ry, 0, cy - ry * 0.05);
  shadowGrad.addColorStop(0, 'rgba(18, 12, 34, 0.68)');
  shadowGrad.addColorStop(0.6, 'rgba(18, 12, 34, 0.25)');
  shadowGrad.addColorStop(1, 'rgba(18, 12, 34, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.fillRect(0, 0, size, size);

  // Pupil
  ctx.fillStyle = `#${darkColor.clone().multiplyScalar(0.45).getHexString()}`;
  if (style === 'cat_iris') {
    ctx.beginPath();
    ctx.ellipse(cx, cy - 8, rx * 0.2, ry * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 'sharp_tsun') {
    ctx.beginPath();
    ctx.ellipse(cx, cy - 10, rx * 0.3, ry * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(cx, cy - 8, rx * 0.36, ry * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = `#${brightColor.getHexString()}`;
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 8, rx * 0.41, ry * 0.41, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (style === 'starry') {
    drawFourPointStar(ctx, cx, cy + 8, 24, '#ffffff', 0.95);
  }

  // Crisp anime catchlights
  ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
  ctx.beginPath();
  ctx.ellipse(
    cx - rx * 0.42,
    cy - ry * 0.38,
    rx * 0.24,
    ry * 0.21,
    -0.35,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.beginPath();
  ctx.arc(cx + rx * 0.38, cy + ry * 0.34, rx * 0.11, 0, Math.PI * 2);
  ctx.fill();

  if (style === 'sparkle' || style === 'starry') {
    ctx.beginPath();
    ctx.arc(cx - rx * 0.14, cy - ry * 0.58, rx * 0.065, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r : r * 0.28;
    const a = (i * Math.PI) / 4;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function createBlushTexture(blushColorHex: string): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const c = new THREE.Color(blushColorHex);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);

  const grad = ctx.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w * 0.45);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.72)`);
  grad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.34)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = `rgba(${r}, ${Math.max(0, g - 35)}, ${Math.max(0, b - 20)}, 0.55)`;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    const bx = w / 2 + i * 24;
    ctx.beginPath();
    ctx.moveTo(bx - 8, h * 0.65);
    ctx.lineTo(bx + 10, h * 0.35);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface EyeNodes {
  root: THREE.Group;
  sclera: THREE.Mesh;
  iris: THREE.Mesh;
  upperLash: THREE.Mesh;
  lowerLash: THREE.Mesh;
  happyArc: THREE.Mesh;
  brow: THREE.Mesh;
  side: -1 | 1;
}

export class AnimeFaceRig {
  public readonly group = new THREE.Group();
  private headMesh: THREE.Mesh;
  private leftEye: EyeNodes;
  private rightEye: EyeNodes;
  private leftBlush: THREE.Mesh;
  private rightBlush: THREE.Mesh;
  private mouthGroup = new THREE.Group();
  private mouthLineMesh: THREE.Mesh;
  private mouthInnerMesh: THREE.Mesh;
  private mouthTongueMesh: THREE.Mesh;
  private catMouthGroup = new THREE.Group();

  private irisMat: THREE.MeshBasicMaterial;
  private blushMat: THREE.MeshBasicMaterial;
  private skinColor = new THREE.Color('#fff0ea');
  private lashColor = new THREE.Color('#23162b');

  private blinkTimer = 2.5;
  private blinkAmount = 0;
  private currentGaze = new THREE.Vector2(0, 0);
  private targetGaze = new THREE.Vector2(0, 0);
  private currentMood: Mood = 'neutral';
  private baseBlush = 0.6;
  private bonusBlush = 0;
  private mouthOpen = 0;
  private mouthWidth = 1;
  private headpatHappyTimer = 0;
  private eyeScale = 1.0;

  constructor(
    skinBase: string,
    skinOutline: string,
    blushColor: string,
    lipColor: string,
    eyeStyle: EyeStyle,
    eyeColor: string,
    eyeScale: number,
    blushIntensity: number,
    hairColor: string
  ) {
    this.skinColor.set(skinBase);
    this.baseBlush = blushIntensity;
    this.eyeScale = eyeScale;

    // 1. Sculpted Anime Head with warm subtle emissive bounce
    const headGeo = createAnimeHeadGeometry();
    const headMat = createAnimeToonMaterial({
      color: skinBase,
      emissive: skinBase,
      emissiveIntensity: 0.14,
      rimColor: '#ffe7f0',
      rimStrength: 0.18,
    });
    this.headMesh = addOutlinedMesh(
      this.group,
      headGeo,
      headMat,
      skinOutline,
      0.0028
    );

    // Helper: sample exact Z on front of sculpted head surface
    const ray = new THREE.Raycaster();
    const sampleFaceZ = (x: number, y: number, fallbackZ = 0.18) => {
      ray.set(new THREE.Vector3(x, y, 0.5), new THREE.Vector3(0, 0, -1));
      const hits = ray.intersectObject(this.headMesh, false);
      return hits.length > 0 ? hits[0].point.z : fallbackZ;
    };

    // Delicate ears
    const earGeo = new THREE.SphereGeometry(0.032, 16, 12);
    earGeo.scale(0.45, 1.0, 0.68);
    [-1, 1].forEach((side) => {
      const ear = addOutlinedMesh(
        this.group,
        earGeo,
        headMat,
        skinOutline,
        0.0024
      );
      ear.position.set(side * 0.2, -0.02, -0.01);
      ear.rotation.z = side * -0.16;
      ear.rotation.y = side * 0.22;
    });

    // 2. Eyes (projected directly onto exact front surface of head!)
    const irisTex = createIrisTexture(eyeStyle, eyeColor);
    this.irisMat = new THREE.MeshBasicMaterial({
      map: irisTex,
      transparent: true,
    });

    const browColor = new THREE.Color(hairColor).multiplyScalar(0.5);
    const eyeY = -0.022;
    const eyeZ = sampleFaceZ(0.07, eyeY, 0.175) + 0.005;
    this.leftEye = this.createEye(-1, eyeY, eyeZ, browColor);
    this.rightEye = this.createEye(1, eyeY, eyeZ, browColor);
    this.group.add(this.leftEye.root, this.rightEye.root);

    // 3. Soft Anime Blush Cheeks
    const blushTex = createBlushTexture(blushColor);
    this.blushMat = new THREE.MeshBasicMaterial({
      map: blushTex,
      transparent: true,
      opacity: this.baseBlush * 0.68,
      depthWrite: false,
    });

    const blushY = -0.068;
    const blushZ = sampleFaceZ(0.095, blushY, 0.17) + 0.004;
    const blushGeo = new THREE.PlaneGeometry(0.072, 0.036);
    this.leftBlush = new THREE.Mesh(blushGeo, this.blushMat);
    this.leftBlush.position.set(-0.095, blushY, blushZ);
    this.leftBlush.rotation.y = -0.36;
    this.leftBlush.rotation.x = 0.08;

    this.rightBlush = new THREE.Mesh(blushGeo, this.blushMat);
    this.rightBlush.position.set(0.095, blushY, blushZ);
    this.rightBlush.rotation.y = 0.36;
    this.rightBlush.rotation.x = 0.08;
    this.group.add(this.leftBlush, this.rightBlush);

    // Subtle delicate anime nose accent shadow
    const noseZ = sampleFaceZ(0, -0.062, 0.185) + 0.003;
    const noseDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.0032, 10),
      new THREE.MeshBasicMaterial({
        color: skinOutline,
        transparent: true,
        opacity: 0.38,
      })
    );
    noseDot.position.set(0, -0.064, noseZ);
    this.group.add(noseDot);

    // 4. Expressive Anime Mouth
    const mouthY = -0.105;
    const mouthZ = sampleFaceZ(0, mouthY, 0.172) + 0.005;
    this.mouthGroup.position.set(0, mouthY, mouthZ);

    const mouthCavityMat = new THREE.MeshBasicMaterial({
      color: '#7a2542',
      side: THREE.DoubleSide,
    });
    const tongueMat = new THREE.MeshBasicMaterial({
      color: '#ff96aa',
      side: THREE.DoubleSide,
    });
    const lipLineMat = new THREE.MeshBasicMaterial({
      color: lipColor,
    });

    const lineCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.021, 0.004, 0),
      new THREE.Vector3(0, -0.004, 0.003),
      new THREE.Vector3(0.021, 0.004, 0)
    );
    const lineGeo = new THREE.TubeGeometry(lineCurve, 16, 0.0022, 8, false);
    this.mouthLineMesh = new THREE.Mesh(lineGeo, lipLineMat);

    const cavityGeo = new THREE.CircleGeometry(0.017, 20);
    cavityGeo.scale(1.15, 0.85, 1);
    this.mouthInnerMesh = new THREE.Mesh(cavityGeo, mouthCavityMat);
    this.mouthInnerMesh.position.set(0, -0.002, -0.001);
    this.mouthInnerMesh.visible = false;

    const tongueGeo = new THREE.CircleGeometry(0.011, 16);
    tongueGeo.scale(1.1, 0.65, 1);
    this.mouthTongueMesh = new THREE.Mesh(tongueGeo, tongueMat);
    this.mouthTongueMesh.position.set(0, -0.007, 0.0005);
    this.mouthTongueMesh.visible = false;

    [-1, 1].forEach((s) => {
      const catCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 0.002, 0.001),
        new THREE.Vector3(s * 0.011, -0.006, 0.002),
        new THREE.Vector3(s * 0.022, 0.004, -0.001)
      );
      const catGeo = new THREE.TubeGeometry(catCurve, 12, 0.002, 8, false);
      this.catMouthGroup.add(new THREE.Mesh(catGeo, lipLineMat));
    });
    this.catMouthGroup.visible = false;

    this.mouthGroup.add(
      this.mouthLineMesh,
      this.mouthInnerMesh,
      this.mouthTongueMesh,
      this.catMouthGroup
    );
    this.group.add(this.mouthGroup);
  }

  private createEye(
    side: -1 | 1,
    eyeY: number,
    eyeZ: number,
    browColor: THREE.Color
  ): EyeNodes {
    const root = new THREE.Group();
    root.position.set(side * 0.072, eyeY, eyeZ);
    root.rotation.y = side * 0.25;
    root.rotation.x = -0.02;
    root.scale.setScalar(this.eyeScale);

    // Sclera (bright clean anime white)
    const scleraGeo = new THREE.CircleGeometry(0.043, 28);
    scleraGeo.scale(0.98, 1.08, 1);
    const scleraMat = new THREE.MeshBasicMaterial({
      color: '#fffafe',
    });
    const sclera = new THREE.Mesh(scleraGeo, scleraMat);

    // Iris disc
    const irisGeo = new THREE.PlaneGeometry(0.06, 0.068);
    const iris = new THREE.Mesh(irisGeo, this.irisMat);
    iris.position.set(0, -0.001, 0.003);

    // Thick stylized curved upper eyelash with cute outer flick
    const lashCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * -0.039, -0.002, 0.006),
      new THREE.Vector3(side * -0.018, 0.036, 0.007),
      new THREE.Vector3(side * 0.015, 0.039, 0.007),
      new THREE.Vector3(side * 0.041, 0.015, 0.006),
      new THREE.Vector3(side * 0.052, 0.025, 0.005),
    ]);
    const lashGeo = new THREE.TubeGeometry(lashCurve, 24, 0.0042, 8, false);
    const lashMat = new THREE.MeshBasicMaterial({ color: this.lashColor });
    const upperLash = new THREE.Mesh(lashGeo, lashMat);

    // Delicate lower lash accent
    const lowerCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(side * -0.024, -0.04, 0.006),
      new THREE.Vector3(0, -0.045, 0.0065),
      new THREE.Vector3(side * 0.03, -0.035, 0.006)
    );
    const lowerGeo = new THREE.TubeGeometry(lowerCurve, 14, 0.0016, 6, false);
    const lowerLash = new THREE.Mesh(lowerGeo, lashMat);

    // Happy curved ^ ^ eye arc
    const happyCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.036, -0.004, 0.008),
      new THREE.Vector3(0, 0.026, 0.009),
      new THREE.Vector3(0.036, -0.004, 0.008)
    );
    const happyGeo = new THREE.TubeGeometry(happyCurve, 18, 0.0042, 8, false);
    const happyArc = new THREE.Mesh(happyGeo, lashMat);
    happyArc.visible = false;

    // Anime eyebrow
    const browCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(side * -0.032, 0.058, 0.008),
      new THREE.Vector3(0, 0.068, 0.009),
      new THREE.Vector3(side * 0.035, 0.056, 0.008)
    );
    const browGeo = new THREE.TubeGeometry(browCurve, 16, 0.0024, 6, false);
    const browMat = new THREE.MeshBasicMaterial({ color: browColor });
    const brow = new THREE.Mesh(browGeo, browMat);

    root.add(sclera, iris, upperLash, lowerLash, happyArc, brow);

    return {
      root,
      sclera,
      iris,
      upperLash,
      lowerLash,
      happyArc,
      brow,
      side,
    };
  }

  public setGazeTarget(nx: number, ny: number) {
    this.targetGaze.set(
      THREE.MathUtils.clamp(nx, -1, 1),
      THREE.MathUtils.clamp(ny, -1, 1)
    );
  }

  public setMood(mood: Mood) {
    this.currentMood = mood;
  }

  public triggerHeadpatHappy(duration = 2.0) {
    this.headpatHappyTimer = duration;
    this.bonusBlush = 0.55;
  }

  public setMouthActivity(openAmount: number, widthFactor = 1.0) {
    this.mouthOpen = THREE.MathUtils.clamp(openAmount, 0, 1);
    this.mouthWidth = THREE.MathUtils.clamp(widthFactor, 0.65, 1.3);
  }

  public updateAppearance(
    skinBase: string,
    blushColor: string,
    eyeStyle: EyeStyle,
    eyeColor: string,
    eyeScale: number,
    blushIntensity: number,
    hairColor: string
  ) {
    this.skinColor.set(skinBase);
    this.baseBlush = blushIntensity;
    this.eyeScale = eyeScale;

    const headMat = this.headMesh.material as THREE.MeshToonMaterial;
    headMat.color.set(skinBase);
    headMat.emissive.set(skinBase);

    const newIrisTex = createIrisTexture(eyeStyle, eyeColor);
    this.irisMat.map?.dispose();
    this.irisMat.map = newIrisTex;
    this.irisMat.needsUpdate = true;

    const newBlushTex = createBlushTexture(blushColor);
    this.blushMat.map?.dispose();
    this.blushMat.map = newBlushTex;
    this.blushMat.needsUpdate = true;

    const browColor = new THREE.Color(hairColor).multiplyScalar(0.5);
    [this.leftEye, this.rightEye].forEach((eye) => {
      eye.root.scale.setScalar(eyeScale);
      (eye.brow.material as THREE.MeshBasicMaterial).color.copy(browColor);
    });
  }

  public update(dt: number, elapsed: number) {
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkAmount = 1;
      this.blinkTimer = 2.6 + Math.random() * 3.4;
    }
    if (this.blinkAmount > 0) {
      this.blinkAmount = Math.max(0, this.blinkAmount - dt * 7.5);
    }
    const blinkCurve = Math.sin(this.blinkAmount * Math.PI);

    this.currentGaze.lerp(this.targetGaze, Math.min(1, dt * 10));

    if (this.headpatHappyTimer > 0) {
      this.headpatHappyTimer = Math.max(0, this.headpatHappyTimer - dt);
    }
    this.bonusBlush = Math.max(0, this.bonusBlush - dt * 0.25);

    const isHappyArc =
      this.headpatHappyTimer > 0.2 ||
      (this.currentMood === 'excited' && Math.sin(elapsed * 2.5) > 0.72);

    let moodLidOffset = 0;
    let browY = 0;
    let browTilt = 0;

    switch (this.currentMood) {
      case 'happy':
        browY = 0.005;
        browTilt = 0.06;
        break;
      case 'excited':
        browY = 0.009;
        browTilt = 0.1;
        break;
      case 'shy':
        moodLidOffset = 0.15;
        browY = 0.004;
        browTilt = 0.22;
        break;
      case 'tsundere':
        moodLidOffset = 0.2;
        browY = -0.002;
        browTilt = -0.24;
        break;
      case 'thoughtful':
        moodLidOffset = 0.18;
        browY = 0.002;
        browTilt = 0.08;
        break;
      case 'surprised':
        moodLidOffset = -0.1;
        browY = 0.013;
        browTilt = 0.08;
        break;
      case 'sleepy':
        moodLidOffset = 0.45;
        browY = -0.003;
        browTilt = 0.12;
        break;
      default:
        break;
    }

    const totalLidClose = THREE.MathUtils.clamp(
      Math.max(blinkCurve, moodLidOffset),
      0,
      1
    );

    [this.leftEye, this.rightEye].forEach((eye) => {
      eye.iris.position.x = this.currentGaze.x * 0.0085;
      eye.iris.position.y = -0.001 + this.currentGaze.y * 0.0065;

      if (isHappyArc) {
        eye.sclera.visible = false;
        eye.iris.visible = false;
        eye.upperLash.visible = false;
        eye.lowerLash.visible = false;
        eye.happyArc.visible = true;
      } else {
        const eyeOpen = Math.max(0.04, 1 - totalLidClose);
        eye.sclera.visible = eyeOpen > 0.08;
        eye.iris.visible = eyeOpen > 0.1;
        eye.upperLash.visible = true;
        eye.lowerLash.visible = eyeOpen > 0.25;
        eye.happyArc.visible = false;

        eye.sclera.scale.y = eyeOpen;
        eye.iris.scale.y = eyeOpen;
        eye.sclera.position.y = -totalLidClose * 0.012;
        eye.iris.position.y =
          -0.001 - totalLidClose * 0.012 + this.currentGaze.y * 0.0065 * eyeOpen;
        eye.upperLash.position.y = THREE.MathUtils.lerp(0, -0.028, totalLidClose);
        eye.upperLash.scale.y = THREE.MathUtils.lerp(1, 0.35, totalLidClose);
      }

      eye.brow.position.y = browY;
      eye.brow.rotation.z = eye.side * -browTilt;
    });

    let moodBlush = 0;
    if (this.currentMood === 'shy') moodBlush = 0.45;
    else if (this.currentMood === 'tsundere') moodBlush = 0.35;
    else if (this.currentMood === 'happy' || this.currentMood === 'excited')
      moodBlush = 0.22;

    this.blushMat.opacity = THREE.MathUtils.clamp(
      this.baseBlush * 0.65 + moodBlush + this.bonusBlush,
      0,
      0.95
    );

    const showCatMouth =
      this.mouthOpen < 0.12 &&
      (this.currentMood === 'happy' || this.currentMood === 'excited') &&
      this.headpatHappyTimer > 0;

    if (showCatMouth) {
      this.catMouthGroup.visible = true;
      this.mouthLineMesh.visible = false;
      this.mouthInnerMesh.visible = false;
      this.mouthTongueMesh.visible = false;
    } else if (this.mouthOpen > 0.08 || this.currentMood === 'surprised') {
      const openVal =
        this.currentMood === 'surprised' && this.mouthOpen < 0.2
          ? 0.55
          : this.mouthOpen;
      this.catMouthGroup.visible = false;
      this.mouthLineMesh.visible = false;
      this.mouthInnerMesh.visible = true;
      this.mouthTongueMesh.visible = openVal > 0.25;
      this.mouthInnerMesh.scale.set(
        this.mouthWidth * (0.7 + openVal * 0.35),
        0.25 + openVal * 1.15,
        1
      );
      this.mouthTongueMesh.scale.set(
        this.mouthWidth * 0.85,
        0.3 + openVal * 0.8,
        1
      );
    } else {
      this.catMouthGroup.visible = false;
      this.mouthLineMesh.visible = true;
      this.mouthInnerMesh.visible = false;
      this.mouthTongueMesh.visible = false;

      if (this.currentMood === 'tsundere') {
        this.mouthLineMesh.scale.set(0.85, -0.9, 1);
      } else if (this.currentMood === 'happy' || this.currentMood === 'excited') {
        this.mouthLineMesh.scale.set(1.18, 1.35, 1);
      } else {
        this.mouthLineMesh.scale.set(1.0, 0.9, 1);
      }
    }
  }
}
