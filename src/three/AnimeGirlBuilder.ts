import * as THREE from 'three';
import { SKIN_PALETTES } from '../data/presets';
import { AppearanceConfig, Mood } from '../types/companion';
import { AnimeFaceRig } from './AnimeFaceRenderer';
import { addOutlinedMesh, createAnimeToonMaterial } from './AnimeMaterials';

/**
 * Generates a sleek tapered anime hair lock geometry along a 3D curve
 * with verified outward triangle winding and normals.
 */
function createTaperedStrandGeometry(
  points: THREE.Vector3[],
  widthStart: number,
  thicknessRatio = 0.48,
  tubularSegments = 20,
  radialSegments = 10,
  rootPinch = 0.78
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(tubularSegments, false);

  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const pos = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];

    const rootFactor = THREE.MathUtils.lerp(rootPinch, 1.0, Math.min(1, t * 4));
    const tipFactor = Math.pow(Math.max(0.02, 1 - t), 0.62);
    const w = widthStart * rootFactor * tipFactor;
    const h = w * thicknessRatio;

    for (let j = 0; j <= radialSegments; j++) {
      const u = (j / radialSegments) * Math.PI * 2;
      const cos = Math.cos(u);
      const sin = Math.sin(u);

      const vx = pos.x + w * cos * N.x + h * sin * B.x;
      const vy = pos.y + w * cos * N.y + h * sin * B.y;
      const vz = pos.z + w * cos * N.z + h * sin * B.z;

      vertices.push(vx, vy, vz);
      uvs.push(j / radialSegments, t);
    }
  }

  // Test winding on a mid-ring triangle against outward radial vector
  const midI = Math.floor(tubularSegments / 2);
  const midCenter = curve.getPointAt(midI / tubularSegments);
  const ringStride = radialSegments + 1;
  const ia = midI * ringStride;
  const ib = (midI + 1) * ringStride;
  const id = midI * ringStride + 1;

  const pA = new THREE.Vector3(
    vertices[ia * 3],
    vertices[ia * 3 + 1],
    vertices[ia * 3 + 2]
  );
  const pB = new THREE.Vector3(
    vertices[ib * 3],
    vertices[ib * 3 + 1],
    vertices[ib * 3 + 2]
  );
  const pD = new THREE.Vector3(
    vertices[id * 3],
    vertices[id * 3 + 1],
    vertices[id * 3 + 2]
  );
  const triNormal = new THREE.Vector3()
    .subVectors(pB, pA)
    .cross(new THREE.Vector3().subVectors(pD, pA));
  const radialOut = new THREE.Vector3().subVectors(pA, midCenter);
  const flipWinding = triNormal.dot(radialOut) < 0;

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);
      if (flipWinding) {
        indices.push(a, d, b);
        indices.push(b, d, c);
      } else {
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates an accordion-pleated anime skirt geometry with a smooth waistband.
 */
function createPleatedSkirtGeometry(
  topRadius: number,
  bottomRadius: number,
  height: number,
  pleatCount = 24,
  pleatDepth = 0.015
): THREE.BufferGeometry {
  const radialSegs = pleatCount * 4;
  const heightSegs = 8;
  const geo = new THREE.CylinderGeometry(
    topRadius,
    bottomRadius,
    height,
    radialSegs,
    heightSegs,
    false
  );

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const angle = Math.atan2(z, x);
    const t = THREE.MathUtils.clamp((height * 0.5 - y) / height, 0, 1);
    const pleat = Math.sin(angle * pleatCount) * pleatDepth * (0.1 + 0.95 * t);
    const r = Math.sqrt(x * x + z * z);
    if (r > 0.01) {
      const scale = (r + pleat) / r;
      pos.setX(i, x * scale);
      pos.setZ(i, z * scale);
    }
  }
  geo.scale(1.06, 1.0, 0.84);
  geo.computeVertexNormals();
  return geo;
}

interface SpringNode {
  pivot: THREE.Object3D;
  baseRot: THREE.Euler;
  velX: number;
  velZ: number;
  curX: number;
  curZ: number;
  stiffness: number;
  damping: number;
  influence: number;
}

export class AnimeGirlRig {
  public readonly root = new THREE.Group();
  public readonly headHitbox: THREE.Mesh;
  public readonly bodyHitbox: THREE.Mesh;
  public readonly faceRig: AnimeFaceRig;

  private hips = new THREE.Group();
  private spine = new THREE.Group();
  private chest = new THREE.Group();
  private neck = new THREE.Group();
  private head = new THREE.Group();

  private leftShoulder = new THREE.Group();
  private leftElbow = new THREE.Group();
  private rightShoulder = new THREE.Group();
  private rightElbow = new THREE.Group();
  private leftSleeveGroup = new THREE.Group();
  private rightSleeveGroup = new THREE.Group();
  private leftLeg = new THREE.Group();
  private rightLeg = new THREE.Group();

  private hairGroup = new THREE.Group();
  private outfitGroup = new THREE.Group();
  private accessoryGroup = new THREE.Group();
  private haloMesh: THREE.Object3D | null = null;
  private catEarMeshes: THREE.Object3D[] = [];
  private wingPivots: THREE.Object3D[] = [];

  private springNodes: SpringNode[] = [];
  private appearance: AppearanceConfig;

  private mood: Mood = 'neutral';
  private isThinking = false;
  private isSpeaking = false;
  private speechEnergy = 0;
  private headpatBounce = 0;
  private pokeFluster = 0;
  private lookTarget = new THREE.Vector2(0, 0);
  private smoothLook = new THREE.Vector2(0, 0);
  private prevHeadWorldPos = new THREE.Vector3();

  constructor(initialAppearance: AppearanceConfig) {
    this.appearance = { ...initialAppearance };
    const skin = SKIN_PALETTES[this.appearance.skinTone];

    // Balanced cute anime proportions (~1.58 units tall)
    this.hips.position.set(0, 0.83, 0);
    this.spine.position.set(0, 0.04, 0);
    this.chest.position.set(0, 0.16, 0);
    this.neck.position.set(0, 0.165, 0);
    this.head.position.set(0, 0.075, 0);

    this.root.add(this.hips);
    this.hips.add(this.spine);
    this.spine.add(this.chest);
    this.chest.add(this.neck);
    this.neck.add(this.head);

    this.faceRig = new AnimeFaceRig(
      skin.base,
      skin.outline,
      skin.blush,
      skin.lip,
      this.appearance.eyeStyle,
      this.appearance.eyeColor,
      this.appearance.eyeScale,
      this.appearance.blushIntensity,
      this.appearance.hairColor
    );
    this.faceRig.group.position.set(0, 0.155, 0);
    this.head.add(this.faceRig.group);

    this.hairGroup.position.set(0, 0.155, 0);
    this.accessoryGroup.position.set(0, 0.155, 0);
    this.head.add(this.hairGroup, this.accessoryGroup);

    const headHitGeo = new THREE.SphereGeometry(0.24, 12, 12);
    const invisibleMat = new THREE.MeshBasicMaterial({ visible: false });
    this.headHitbox = new THREE.Mesh(headHitGeo, invisibleMat);
    this.headHitbox.position.set(0, 0.17, 0);
    this.headHitbox.name = 'head_hitbox';
    this.head.add(this.headHitbox);

    const bodyHitGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.58, 10);
    this.bodyHitbox = new THREE.Mesh(bodyHitGeo, invisibleMat);
    this.bodyHitbox.position.set(0, 0.02, 0);
    this.bodyHitbox.name = 'body_hitbox';
    this.chest.add(this.bodyHitbox);

    this.buildBaseBody();
    this.rebuildHair();
    this.rebuildOutfit();
    this.rebuildAccessory();

    this.head.getWorldPosition(this.prevHeadWorldPos);
  }

  private getSkinMat() {
    const skin = SKIN_PALETTES[this.appearance.skinTone];
    return {
      skin,
      mat: createAnimeToonMaterial({
        color: skin.base,
        emissive: skin.base,
        emissiveIntensity: 0.14,
        rimColor: '#ffe7f0',
        rimStrength: 0.18,
      }),
    };
  }

  private buildBaseBody() {
    const { skin, mat: skinMat } = this.getSkinMat();

    // Graceful anime neck & collarbone base
    const neckGeo = new THREE.CylinderGeometry(0.041, 0.048, 0.11, 18);
    const neckMesh = addOutlinedMesh(
      this.neck,
      neckGeo,
      skinMat,
      skin.outline,
      0.0024
    );
    neckMesh.position.y = 0.032;

    // Upper chest / shoulder yoke
    const yokeGeo = new THREE.SphereGeometry(0.115, 22, 16);
    yokeGeo.scale(1.14, 0.56, 0.72);
    const yoke = addOutlinedMesh(
      this.chest,
      yokeGeo,
      skinMat,
      skin.outline,
      0.0024
    );
    yoke.position.set(0, 0.125, 0);

    this.spine.add(this.outfitGroup);

    // Articulated Arms with rounded shoulders, elbows & sculpted anime hands
    this.leftShoulder.position.set(-0.132, 0.132, 0);
    this.rightShoulder.position.set(0.132, 0.132, 0);
    this.chest.add(this.leftShoulder, this.rightShoulder);

    [-1, 1].forEach((side) => {
      const shoulder = side === -1 ? this.leftShoulder : this.rightShoulder;
      const elbow = side === -1 ? this.leftElbow : this.rightElbow;
      const sleeveGrp =
        side === -1 ? this.leftSleeveGroup : this.rightSleeveGroup;
      shoulder.add(sleeveGrp);

      // Rounded shoulder cap
      const shoulderCap = addOutlinedMesh(
        shoulder,
        new THREE.SphereGeometry(0.036, 16, 12),
        skinMat,
        skin.outline,
        0.0024
      );
      shoulderCap.position.set(0, -0.005, 0);

      // Upper arm
      const upperArmGeo = new THREE.CylinderGeometry(0.032, 0.027, 0.21, 16);
      const upperArm = addOutlinedMesh(
        shoulder,
        upperArmGeo,
        skinMat,
        skin.outline,
        0.0024
      );
      upperArm.position.y = -0.105;

      // Elbow joint
      elbow.position.set(0, -0.21, 0);
      shoulder.add(elbow);
      addOutlinedMesh(
        elbow,
        new THREE.SphereGeometry(0.026, 14, 10),
        skinMat,
        skin.outline,
        0.002
      );

      // Tapered forearm
      const forearmGeo = new THREE.CylinderGeometry(0.026, 0.02, 0.2, 16);
      const forearm = addOutlinedMesh(
        elbow,
        forearmGeo,
        skinMat,
        skin.outline,
        0.0022
      );
      forearm.position.y = -0.1;

      // Sculpted cute anime hand (palm + fingers silhouette + thumb)
      const handGroup = new THREE.Group();
      handGroup.position.set(0, -0.212, 0.004);

      const palmGeo = new THREE.SphereGeometry(0.023, 14, 12);
      palmGeo.scale(0.86, 1.1, 0.58);
      addOutlinedMesh(handGroup, palmGeo, skinMat, skin.outline, 0.002);

      const fingersGeo = new THREE.CapsuleGeometry(0.015, 0.022, 6, 10);
      fingersGeo.scale(0.95, 1.0, 0.55);
      const fingers = addOutlinedMesh(
        handGroup,
        fingersGeo,
        skinMat,
        skin.outline,
        0.0018
      );
      fingers.position.set(0, -0.022, 0.002);

      const thumbGeo = new THREE.CapsuleGeometry(0.007, 0.014, 6, 8);
      const thumb = addOutlinedMesh(
        handGroup,
        thumbGeo,
        skinMat,
        skin.outline,
        0.0016
      );
      thumb.position.set(side * -0.018, -0.008, 0.01);
      thumb.rotation.z = side * 0.45;
      thumb.rotation.x = 0.25;

      elbow.add(handGroup);
    });

    // Legs attached cleanly at hips
    this.leftLeg.position.set(-0.068, -0.02, 0);
    this.rightLeg.position.set(0.068, -0.02, 0);
    this.hips.add(this.leftLeg, this.rightLeg);

    this.buildLegs(skinMat, skin.outline);
  }

  private buildLegs(skinMat: THREE.Material, skinOutline: string) {
    const sockMat = createAnimeToonMaterial({
      color: this.appearance.outfitPrimaryColor,
      rimColor: '#e2d9ff',
      rimStrength: 0.22,
    });
    const sockStripeMat = createAnimeToonMaterial({
      color: this.appearance.outfitAccentColor,
    });
    const shoeMat = createAnimeToonMaterial({
      color: '#251e34',
      rimColor: '#b9a6e8',
      rimStrength: 0.22,
    });

    // Anatomically sculpted anime leg lathe profile (y=0 hip down to y=-0.76 ankle)
    const thighPts = [
      new THREE.Vector2(0.062, 0.0),
      new THREE.Vector2(0.058, -0.1),
      new THREE.Vector2(0.049, -0.22),
      new THREE.Vector2(0.042, -0.32),
    ];
    const thighGeo = new THREE.LatheGeometry(thighPts, 20);

    const sockPts = [
      new THREE.Vector2(0.043, -0.31),
      new THREE.Vector2(0.04, -0.39),
      new THREE.Vector2(0.044, -0.5),
      new THREE.Vector2(0.036, -0.62),
      new THREE.Vector2(0.028, -0.74),
    ];
    const sockGeo = new THREE.LatheGeometry(sockPts, 20);

    [this.leftLeg, this.rightLeg].forEach((leg, idx) => {
      while (leg.children.length > 0) leg.remove(leg.children[0]);

      addOutlinedMesh(leg, thighGeo, skinMat, skinOutline, 0.0024);

      const band = addOutlinedMesh(
        leg,
        new THREE.TorusGeometry(0.042, 0.007, 8, 20),
        sockStripeMat,
        '#241a33',
        0.002
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = -0.315;

      addOutlinedMesh(leg, sockGeo, sockMat, '#20182b', 0.0024);

      // Cute sculpted anime Mary-Jane shoe with sole & toe
      const shoeGroup = new THREE.Group();
      shoeGroup.position.set(0, -0.765, 0.025);

      const shoeBodyGeo = new THREE.CapsuleGeometry(0.032, 0.068, 8, 14);
      shoeBodyGeo.rotateX(Math.PI / 2);
      shoeBodyGeo.scale(0.95, 0.68, 1.0);
      addOutlinedMesh(shoeGroup, shoeBodyGeo, shoeMat, '#161122', 0.0024);

      const strap = addOutlinedMesh(
        shoeGroup,
        new THREE.TorusGeometry(0.028, 0.005, 8, 16),
        sockStripeMat,
        '#161122',
        0.0018
      );
      strap.position.set(0, 0.015, -0.01);

      leg.add(shoeGroup);
      leg.rotation.z = idx === 0 ? -0.02 : 0.02;
    });
  }

  private clearGroup(g: THREE.Group) {
    while (g.children.length > 0) {
      g.remove(g.children[0]);
    }
  }

  private addSpringNode(
    pivot: THREE.Object3D,
    stiffness = 38,
    damping = 5.5,
    influence = 1.0
  ) {
    this.springNodes.push({
      pivot,
      baseRot: pivot.rotation.clone(),
      velX: 0,
      velZ: 0,
      curX: 0,
      curZ: 0,
      stiffness,
      damping,
      influence,
    });
  }

  public rebuildHair() {
    this.clearGroup(this.hairGroup);
    this.springNodes = [];

    const hairMat = createAnimeToonMaterial({
      color: this.appearance.hairColor,
      hairHighlightColor: this.appearance.hairHighlightColor,
      hairShine: 0.72,
      rimColor: this.appearance.hairHighlightColor,
      rimStrength: 0.3,
      side: THREE.DoubleSide,
    });

    const hairOutline = new THREE.Color(this.appearance.hairColor)
      .multiplyScalar(0.32)
      .getStyle();

    // 1. Crown Hair Cap — stops HIGH above the forehead (thetaLength = 0.42π) so eyes are 100% open!
    const capGeo = new THREE.SphereGeometry(
      0.223,
      36,
      24,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.42
    );
    capGeo.scale(1.01, 1.03, 1.03);
    const cap = addOutlinedMesh(
      this.hairGroup,
      capGeo,
      hairMat,
      hairOutline,
      0.003
    );
    cap.position.set(0, 0.015, -0.01);
    cap.rotation.x = -0.22; // lifts front hairline UP above brows, lowers back down nape

    // 2. Back-of-head skull hair shell (strictly z <= 0 using phi in [1.05π, 1.95π])
    const backShellGeo = new THREE.SphereGeometry(
      0.22,
      32,
      24,
      Math.PI * 1.05,
      Math.PI * 0.9,
      Math.PI * 0.22,
      Math.PI * 0.62
    );
    const backShell = addOutlinedMesh(
      this.hairGroup,
      backShellGeo,
      hairMat,
      hairOutline,
      0.003
    );
    backShell.position.set(0, 0.005, -0.01);

    // 3. Sculpted Wispy Anime Front Bangs (fuller, overlapping strands down to brow line)
    const bangSpecs = [
      {
        pts: [
          new THREE.Vector3(-0.132, 0.172, 0.1),
          new THREE.Vector3(-0.13, 0.1, 0.165),
          new THREE.Vector3(-0.122, 0.025, 0.176),
        ],
        w: 0.038,
      },
      {
        pts: [
          new THREE.Vector3(-0.082, 0.192, 0.122),
          new THREE.Vector3(-0.078, 0.118, 0.188),
          new THREE.Vector3(-0.068, 0.035, 0.198),
        ],
        w: 0.044,
      },
      {
        pts: [
          new THREE.Vector3(-0.03, 0.2, 0.13),
          new THREE.Vector3(-0.024, 0.125, 0.198),
          new THREE.Vector3(-0.014, 0.032, 0.206),
        ],
        w: 0.046,
      },
      {
        pts: [
          new THREE.Vector3(0.022, 0.2, 0.13),
          new THREE.Vector3(0.026, 0.124, 0.198),
          new THREE.Vector3(0.032, 0.03, 0.205),
        ],
        w: 0.044,
      },
      {
        pts: [
          new THREE.Vector3(0.074, 0.194, 0.124),
          new THREE.Vector3(0.078, 0.12, 0.188),
          new THREE.Vector3(0.082, 0.038, 0.196),
        ],
        w: 0.042,
      },
      {
        pts: [
          new THREE.Vector3(0.124, 0.174, 0.104),
          new THREE.Vector3(0.128, 0.1, 0.168),
          new THREE.Vector3(0.122, 0.025, 0.176),
        ],
        w: 0.038,
      },
    ];

    bangSpecs.forEach((b) => {
      const geo = createTaperedStrandGeometry(b.pts, b.w, 0.42, 16, 10);
      addOutlinedMesh(this.hairGroup, geo, hairMat, hairOutline, 0.0024);
    });

    // 4. Cheek-framing Side Locks (kept cleanly outside shoulders so they never clip!)
    [-1, 1].forEach((side) => {
      const sidePivot = new THREE.Group();
      sidePivot.position.set(side * 0.185, 0.075, 0.055);
      this.hairGroup.add(sidePivot);

      const lockGeo = createTaperedStrandGeometry(
        [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(side * 0.022, -0.1, 0.042),
          new THREE.Vector3(side * 0.03, -0.22, 0.055),
          new THREE.Vector3(side * 0.012, -0.33, 0.045),
        ],
        0.04,
        0.48,
        18,
        10
      );
      addOutlinedMesh(sidePivot, lockGeo, hairMat, hairOutline, 0.0025);
      this.addSpringNode(sidePivot, 46, 5.2, 0.85);
    });

    // 5. Bouncy Ahoge on Crown
    const ahogePivot = new THREE.Group();
    ahogePivot.position.set(0.015, 0.225, 0.01);
    this.hairGroup.add(ahogePivot);
    const ahogeGeo = createTaperedStrandGeometry(
      [
        new THREE.Vector3(0, -0.01, 0),
        new THREE.Vector3(0.022, 0.065, 0.01),
        new THREE.Vector3(0.072, 0.088, -0.01),
        new THREE.Vector3(0.105, 0.048, -0.02),
      ],
      0.016,
      0.65,
      14,
      8
    );
    addOutlinedMesh(ahogePivot, ahogeGeo, hairMat, hairOutline, 0.002);
    this.addSpringNode(ahogePivot, 58, 4.2, 1.5);

    // 6. Hairstyle-specific Back Hair / Tails
    const style = this.appearance.hairStyle;

    if (style === 'twintails') {
      const tieMat = createAnimeToonMaterial({
        color: this.appearance.outfitAccentColor,
      });
      [-1, 1].forEach((side) => {
        const tie = addOutlinedMesh(
          this.hairGroup,
          new THREE.TorusGeometry(0.028, 0.011, 8, 16),
          tieMat,
          '#271a30',
          0.0022
        );
        tie.position.set(side * 0.21, 0.1, -0.045);
        tie.rotation.y = side * 0.8;

        const tailPivot = new THREE.Group();
        tailPivot.position.set(side * 0.215, 0.1, -0.05);
        this.hairGroup.add(tailPivot);

        const mainTail = createTaperedStrandGeometry(
          [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(side * 0.11, -0.1, -0.04),
            new THREE.Vector3(side * 0.17, -0.34, -0.07),
            new THREE.Vector3(side * 0.14, -0.62, -0.04),
            new THREE.Vector3(side * 0.18, -0.82, 0.01),
          ],
          0.068,
          0.58,
          24,
          12
        );
        addOutlinedMesh(tailPivot, mainTail, hairMat, hairOutline, 0.003);

        const innerTail = createTaperedStrandGeometry(
          [
            new THREE.Vector3(0, -0.01, 0.01),
            new THREE.Vector3(side * 0.075, -0.14, -0.02),
            new THREE.Vector3(side * 0.11, -0.38, -0.03),
            new THREE.Vector3(side * 0.085, -0.62, 0.01),
          ],
          0.046,
          0.52,
          18,
          10
        );
        addOutlinedMesh(tailPivot, innerTail, hairMat, hairOutline, 0.0025);

        this.addSpringNode(tailPivot, 30, 4.4, 1.35);
      });
    } else if (style === 'long_hime') {
      const backPivot = new THREE.Group();
      backPivot.position.set(0, 0.04, -0.13);
      this.hairGroup.add(backPivot);

      [-0.12, -0.06, 0, 0.06, 0.12].forEach((offsetX, idx) => {
        const strand = createTaperedStrandGeometry(
          [
            new THREE.Vector3(offsetX * 0.7, 0.05, 0.01),
            new THREE.Vector3(offsetX * 1.15, -0.18, -0.07),
            new THREE.Vector3(offsetX * 1.25, -0.45, -0.1),
            new THREE.Vector3(offsetX * 1.05, -0.72, -0.07),
          ],
          idx === 2 ? 0.078 : 0.066,
          0.45,
          22,
          10
        );
        addOutlinedMesh(backPivot, strand, hairMat, hairOutline, 0.0028);
      });
      this.addSpringNode(backPivot, 32, 5.2, 1.1);
    } else if (style === 'ponytail') {
      const tieMat = createAnimeToonMaterial({
        color: this.appearance.outfitAccentColor,
      });
      const tie = addOutlinedMesh(
        this.hairGroup,
        new THREE.TorusGeometry(0.034, 0.013, 8, 16),
        tieMat,
        '#271a30',
        0.0022
      );
      tie.position.set(0, 0.15, -0.185);
      tie.rotation.x = 0.65;

      const ponyPivot = new THREE.Group();
      ponyPivot.position.set(0, 0.15, -0.19);
      this.hairGroup.add(ponyPivot);

      const mainPony = createTaperedStrandGeometry(
        [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0.03, -0.11),
          new THREE.Vector3(0.02, -0.18, -0.2),
          new THREE.Vector3(0.04, -0.48, -0.18),
          new THREE.Vector3(0.01, -0.72, -0.12),
        ],
        0.08,
        0.55,
        24,
        12
      );
      addOutlinedMesh(ponyPivot, mainPony, hairMat, hairOutline, 0.003);
      this.addSpringNode(ponyPivot, 32, 4.3, 1.35);
    } else if (style === 'bob_ahoge') {
      const bobPivot = new THREE.Group();
      bobPivot.position.set(0, 0.02, -0.06);
      this.hairGroup.add(bobPivot);

      for (let i = -3; i <= 3; i++) {
        const angle = (i / 3) * 1.05;
        const rx = Math.sin(angle) * 0.195;
        const rz = -Math.cos(angle) * 0.16;
        const strand = createTaperedStrandGeometry(
          [
            new THREE.Vector3(rx * 0.85, 0.06, rz * 0.85),
            new THREE.Vector3(rx * 1.1, -0.07, rz * 1.05),
            new THREE.Vector3(rx * 0.94, -0.2, rz * 0.92),
          ],
          0.062,
          0.46,
          14,
          10
        );
        addOutlinedMesh(bobPivot, strand, hairMat, hairOutline, 0.0026);
      }
      this.addSpringNode(bobPivot, 48, 6.0, 0.75);
    } else if (style === 'half_buns') {
      const tieMat = createAnimeToonMaterial({
        color: this.appearance.outfitAccentColor,
      });
      [-1, 1].forEach((side) => {
        const bun = addOutlinedMesh(
          this.hairGroup,
          new THREE.SphereGeometry(0.072, 18, 16),
          hairMat,
          hairOutline,
          0.0028
        );
        bun.position.set(side * 0.165, 0.19, -0.05);

        const ring = addOutlinedMesh(
          this.hairGroup,
          new THREE.TorusGeometry(0.052, 0.011, 8, 16),
          tieMat,
          '#271a30',
          0.002
        );
        ring.position.set(side * 0.145, 0.165, -0.045);
        ring.rotation.y = side * 0.9;
        ring.rotation.x = 0.6;
      });

      const backPivot = new THREE.Group();
      backPivot.position.set(0, 0.03, -0.12);
      this.hairGroup.add(backPivot);
      [-0.09, 0, 0.09].forEach((ox) => {
        const strand = createTaperedStrandGeometry(
          [
            new THREE.Vector3(ox * 0.8, 0.04, 0.01),
            new THREE.Vector3(ox * 1.12, -0.18, -0.06),
            new THREE.Vector3(ox, -0.44, -0.05),
          ],
          0.07,
          0.46,
          18,
          10
        );
        addOutlinedMesh(backPivot, strand, hairMat, hairOutline, 0.0028);
      });
      this.addSpringNode(backPivot, 36, 5.0, 1.0);
    }
  }

  public rebuildOutfit() {
    this.clearGroup(this.outfitGroup);
    this.clearGroup(this.leftSleeveGroup);
    this.clearGroup(this.rightSleeveGroup);
    this.wingPivots = [];

    const primaryMat = createAnimeToonMaterial({
      color: this.appearance.outfitPrimaryColor,
      rimColor: '#e9ddff',
      rimStrength: 0.25,
    });
    const secondaryMat = createAnimeToonMaterial({
      color: this.appearance.outfitSecondaryColor,
      rimColor: '#ffffff',
      rimStrength: 0.22,
    });
    const accentMat = createAnimeToonMaterial({
      color: this.appearance.outfitAccentColor,
      rimColor: '#fff0fa',
      rimStrength: 0.3,
    });
    const glowAccentMat = createAnimeToonMaterial({
      color: this.appearance.outfitAccentColor,
      emissive: this.appearance.outfitAccentColor,
      emissiveIntensity: 0.45,
    });
    const darkOutline = '#241a33';
    const style = this.appearance.outfitStyle;

    // Seamless full bodice extending right into skirt waistband (zero bare gap!)
    const topPts = [
      new THREE.Vector2(0.096, -0.045),
      new THREE.Vector2(0.092, 0.05),
      new THREE.Vector2(0.104, 0.15),
      new THREE.Vector2(0.124, 0.23),
      new THREE.Vector2(0.118, 0.285),
      new THREE.Vector2(0.064, 0.305),
    ];
    const topGeo = new THREE.LatheGeometry(topPts, 24);
    topGeo.scale(1.04, 1.0, 0.74);

    // Reusable cute 3D ribbon bow helper
    const addBow = (
      pos: THREE.Vector3,
      mat: THREE.Material,
      scale = 1,
      rotY = 0
    ) => {
      const bow = new THREE.Group();
      bow.position.copy(pos);
      bow.rotation.y = rotY;
      bow.scale.setScalar(scale);

      addOutlinedMesh(
        bow,
        new THREE.SphereGeometry(0.02, 12, 10),
        mat,
        darkOutline,
        0.002
      );
      [-1, 1].forEach((s) => {
        const wingGeo = new THREE.ConeGeometry(0.024, 0.05, 10);
        wingGeo.rotateZ(s * 1.15);
        const wing = addOutlinedMesh(bow, wingGeo, mat, darkOutline, 0.002);
        wing.position.set(s * 0.03, 0, 0);

        const tail = addOutlinedMesh(
          bow,
          new THREE.BoxGeometry(0.016, 0.062, 0.008),
          mat,
          darkOutline,
          0.0018
        );
        tail.position.set(s * 0.015, -0.037, -0.002);
        tail.rotation.z = s * -0.2;
      });
      this.outfitGroup.add(bow);
    };

    // Helper for rounded sleeves (including wide draped furisode kimono sleeves!)
    const addSleeves = (
      mat: THREE.Material,
      length: number,
      puff = false,
      cuffMat?: THREE.Material,
      kimonoDrapeMat?: THREE.Material
    ) => {
      [this.leftSleeveGroup, this.rightSleeveGroup].forEach((grp) => {
        const cap = addOutlinedMesh(
          grp,
          new THREE.SphereGeometry(puff ? 0.052 : 0.044, 16, 12),
          mat,
          darkOutline,
          0.0024
        );
        cap.position.y = -0.01;

        const sleeveGeo = new THREE.CylinderGeometry(
          puff ? 0.046 : 0.04,
          puff ? 0.048 : 0.036,
          length,
          16
        );
        const sleeve = addOutlinedMesh(
          grp,
          sleeveGeo,
          mat,
          darkOutline,
          0.0024
        );
        sleeve.position.y = -length * 0.5 - 0.005;

        if (cuffMat) {
          const cuff = addOutlinedMesh(
            grp,
            new THREE.CylinderGeometry(0.04, 0.041, 0.025, 16),
            cuffMat,
            darkOutline,
            0.002
          );
          cuff.position.y = -length - 0.002;
        }

        if (kimonoDrapeMat) {
          const drapeGeo = new THREE.BoxGeometry(0.036, 0.22, 0.14);
          const drape = addOutlinedMesh(
            grp,
            drapeGeo,
            kimonoDrapeMat,
            darkOutline,
            0.0024
          );
          drape.position.set(0, -0.15, -0.04);
        }
      });
    };

    if (style === 'sailor_uniform') {
      addOutlinedMesh(this.outfitGroup, topGeo, secondaryMat, darkOutline, 0.0026);
      addSleeves(secondaryMat, 0.14, false, primaryMat);

      const collarGeo = new THREE.CylinderGeometry(0.075, 0.132, 0.075, 24);
      collarGeo.scale(1.06, 1, 0.78);
      const collar = addOutlinedMesh(
        this.outfitGroup,
        collarGeo,
        primaryMat,
        darkOutline,
        0.0025
      );
      collar.position.set(0, 0.272, 0.002);

      addBow(new THREE.Vector3(0, 0.215, 0.095), accentMat, 1.0);

      const skirt = addOutlinedMesh(
        this.outfitGroup,
        createPleatedSkirtGeometry(0.096, 0.23, 0.27, 24, 0.015),
        primaryMat,
        darkOutline,
        0.0028
      );
      skirt.position.y = -0.125;
    } else if (style === 'cozy_hoodie') {
      const hoodieGeo = topGeo.clone();
      hoodieGeo.scale(1.12, 1.04, 1.14);
      addOutlinedMesh(this.outfitGroup, hoodieGeo, primaryMat, darkOutline, 0.0028);
      addSleeves(primaryMat, 0.2, false, secondaryMat);

      const hoodRing = addOutlinedMesh(
        this.outfitGroup,
        new THREE.TorusGeometry(0.082, 0.03, 12, 24),
        primaryMat,
        darkOutline,
        0.0026
      );
      hoodRing.position.set(0, 0.285, -0.015);
      hoodRing.rotation.x = 1.25;

      [-1, 1].forEach((s) => {
        const cord = addOutlinedMesh(
          this.outfitGroup,
          new THREE.CylinderGeometry(0.004, 0.004, 0.1, 8),
          secondaryMat,
          darkOutline,
          0.0015
        );
        cord.position.set(s * 0.028, 0.205, 0.105);
        cord.rotation.z = s * 0.08;
      });

      const skirt = addOutlinedMesh(
        this.outfitGroup,
        createPleatedSkirtGeometry(0.105, 0.22, 0.22, 20, 0.014),
        secondaryMat,
        darkOutline,
        0.0026
      );
      skirt.position.y = -0.13;
    } else if (style === 'maid_frill') {
      addOutlinedMesh(this.outfitGroup, topGeo, primaryMat, darkOutline, 0.0026);
      addSleeves(primaryMat, 0.12, true, secondaryMat);

      const bib = addOutlinedMesh(
        this.outfitGroup,
        new THREE.BoxGeometry(0.105, 0.14, 0.022),
        secondaryMat,
        darkOutline,
        0.0022
      );
      bib.position.set(0, 0.18, 0.082);

      const sash = addOutlinedMesh(
        this.outfitGroup,
        new THREE.CylinderGeometry(0.098, 0.1, 0.045, 20),
        accentMat,
        darkOutline,
        0.0022
      );
      sash.scale.set(1.04, 1, 0.76);
      sash.position.y = 0.005;

      const skirt = addOutlinedMesh(
        this.outfitGroup,
        createPleatedSkirtGeometry(0.1, 0.26, 0.29, 26, 0.018),
        primaryMat,
        darkOutline,
        0.0028
      );
      skirt.position.y = -0.13;
    } else if (style === 'cyber_jacket') {
      addOutlinedMesh(this.outfitGroup, topGeo, secondaryMat, darkOutline, 0.0025);

      const jacketGeo = topGeo.clone();
      jacketGeo.scale(1.08, 0.96, 1.1);
      const jacket = addOutlinedMesh(
        this.outfitGroup,
        jacketGeo,
        primaryMat,
        darkOutline,
        0.0028
      );
      jacket.position.y = 0.005;

      addSleeves(primaryMat, 0.19, false, glowAccentMat);

      const collar = addOutlinedMesh(
        this.outfitGroup,
        new THREE.CylinderGeometry(0.072, 0.09, 0.052, 20),
        glowAccentMat,
        darkOutline,
        0.0022
      );
      collar.scale.set(1.02, 1, 0.78);
      collar.position.y = 0.295;

      const belt = addOutlinedMesh(
        this.outfitGroup,
        new THREE.TorusGeometry(0.11, 0.011, 8, 24),
        glowAccentMat,
        darkOutline,
        0.002
      );
      belt.scale.set(1.06, 0.85, 1);
      belt.rotation.x = Math.PI / 2;
      belt.position.y = -0.005;

      const skirt = addOutlinedMesh(
        this.outfitGroup,
        createPleatedSkirtGeometry(0.098, 0.22, 0.24, 18, 0.014),
        primaryMat,
        darkOutline,
        0.0028
      );
      skirt.position.y = -0.12;
    } else if (style === 'idol_dress') {
      addOutlinedMesh(this.outfitGroup, topGeo, primaryMat, darkOutline, 0.0026);
      addSleeves(secondaryMat, 0.11, true, accentMat);

      const starGem = addOutlinedMesh(
        this.outfitGroup,
        new THREE.OctahedronGeometry(0.024, 0),
        accentMat,
        darkOutline,
        0.0018
      );
      starGem.position.set(0, 0.21, 0.095);

      const upperSkirt = addOutlinedMesh(
        this.outfitGroup,
        createPleatedSkirtGeometry(0.096, 0.21, 0.16, 24, 0.016),
        secondaryMat,
        darkOutline,
        0.0024
      );
      upperSkirt.position.y = -0.08;

      const lowerSkirt = addOutlinedMesh(
        this.outfitGroup,
        createPleatedSkirtGeometry(0.135, 0.27, 0.2, 28, 0.018),
        primaryMat,
        darkOutline,
        0.0028
      );
      lowerSkirt.position.y = -0.165;
    } else if (style === 'magical_girl') {
      // Magical Girl: sweetheart bodice + glowing winged star brooch + double petal skirt + back bow
      addOutlinedMesh(this.outfitGroup, topGeo, primaryMat, darkOutline, 0.0026);
      addSleeves(secondaryMat, 0.11, true, accentMat);

      // Scalloped shoulder capelet collar
      const capeCollar = addOutlinedMesh(
        this.outfitGroup,
        new THREE.CylinderGeometry(0.072, 0.145, 0.068, 16),
        secondaryMat,
        darkOutline,
        0.0024
      );
      capeCollar.scale.set(1.08, 1, 0.8);
      capeCollar.position.set(0, 0.275, 0);

      // Glowing winged heart/star brooch
      const brooch = addOutlinedMesh(
        this.outfitGroup,
        new THREE.OctahedronGeometry(0.026, 0),
        glowAccentMat,
        darkOutline,
        0.002
      );
      brooch.position.set(0, 0.21, 0.098);
      [-1, 1].forEach((s) => {
        const miniWing = addOutlinedMesh(
          this.outfitGroup,
          new THREE.ConeGeometry(0.016, 0.048, 8),
          secondaryMat,
          darkOutline,
          0.0018
        );
        miniWing.rotation.z = s * -1.15;
        miniWing.position.set(s * 0.036, 0.22, 0.092);
      });

      // Waist ribbon sash + front & back bows
      const sash = addOutlinedMesh(
        this.outfitGroup,
        new THREE.TorusGeometry(0.104, 0.014, 10, 24),
        accentMat,
        darkOutline,
        0.002
      );
      sash.scale.set(1.06, 0.82, 1);
      sash.rotation.x = Math.PI / 2;
      sash.position.y = 0.005;
      addBow(new THREE.Vector3(0, 0.01, 0.095), accentMat, 0.9);
      addBow(new THREE.Vector3(0, 0.01, -0.095), accentMat, 1.35, Math.PI);

      // Layered overskirt + main skirt
      const overSkirt = addOutlinedMesh(
        this.outfitGroup,
        createPleatedSkirtGeometry(0.098, 0.22, 0.15, 16, 0.022),
        secondaryMat,
        darkOutline,
        0.0024
      );
      overSkirt.position.y = -0.075;

      const mainSkirt = addOutlinedMesh(
        this.outfitGroup,
        createPleatedSkirtGeometry(0.125, 0.285, 0.22, 26, 0.018),
        primaryMat,
        darkOutline,
        0.0028
      );
      mainSkirt.position.y = -0.155;
    } else if (style === 'gothic_lolita') {
      // Gothic Lolita: high lace collar, corset bodice, crisscross lacing, bell skirt & big back bow
      addOutlinedMesh(this.outfitGroup, topGeo, primaryMat, darkOutline, 0.0026);
      addSleeves(primaryMat, 0.16, true, secondaryMat);

      // High ruffled Victorian collar
      const laceCollar = addOutlinedMesh(
        this.outfitGroup,
        new THREE.CylinderGeometry(0.056, 0.076, 0.05, 20),
        secondaryMat,
        darkOutline,
        0.0022
      );
      laceCollar.position.set(0, 0.305, 0);

      // Front lace panel + ribbon corset bars
      const panel = addOutlinedMesh(
        this.outfitGroup,
        new THREE.BoxGeometry(0.068, 0.19, 0.02),
        secondaryMat,
        darkOutline,
        0.002
      );
      panel.position.set(0, 0.135, 0.08);
      for (let r = 0; r < 4; r++) {
        const bar = addOutlinedMesh(
          this.outfitGroup,
          new THREE.BoxGeometry(0.054, 0.008, 0.008),
          accentMat,
          darkOutline,
          0.0014
        );
        bar.position.set(0, 0.07 + r * 0.038, 0.093);
      }

      // Bell-shaped poofy Lolita skirt + white petticoat hem
      const bellSkirt = addOutlinedMesh(
        this.outfitGroup,
        createPleatedSkirtGeometry(0.098, 0.31, 0.27, 28, 0.022),
        primaryMat,
        darkOutline,
        0.0028
      );
      bellSkirt.position.y = -0.13;

      const petticoat = addOutlinedMesh(
        this.outfitGroup,
        createPleatedSkirtGeometry(0.24, 0.325, 0.07, 32, 0.015),
        secondaryMat,
        darkOutline,
        0.0022
      );
      petticoat.position.y = -0.25;

      addBow(new THREE.Vector3(0, 0.02, -0.098), accentMat, 1.4, Math.PI);
    } else if (style === 'kimono_modern') {
      // Neo Idol Kimono: crossed V-collar wrap, draped furisode sleeves, wide Obi sash + back Obi bow
      addOutlinedMesh(this.outfitGroup, topGeo, primaryMat, darkOutline, 0.0026);
      addSleeves(primaryMat, 0.18, false, accentMat, primaryMat);

      // Crossed kimono V-lapels
      [-1, 1].forEach((s) => {
        const lapel = addOutlinedMesh(
          this.outfitGroup,
          new THREE.BoxGeometry(0.032, 0.17, 0.018),
          secondaryMat,
          darkOutline,
          0.002
        );
        lapel.position.set(s * 0.022, 0.21, 0.088);
        lapel.rotation.z = s * -0.32;
      });

      // Wide Obi Sash + Obijime cord
      const obi = addOutlinedMesh(
        this.outfitGroup,
        new THREE.CylinderGeometry(0.104, 0.108, 0.115, 24),
        accentMat,
        darkOutline,
        0.0024
      );
      obi.scale.set(1.06, 1, 0.8);
      obi.position.y = 0.035;

      const obijime = addOutlinedMesh(
        this.outfitGroup,
        new THREE.TorusGeometry(0.112, 0.008, 8, 24),
        secondaryMat,
        darkOutline,
        0.0018
      );
      obijime.scale.set(1.06, 0.82, 1);
      obijime.rotation.x = Math.PI / 2;
      obijime.position.y = 0.035;

      // Large ornamental Obi drum bow at back
      const obiDrum = addOutlinedMesh(
        this.outfitGroup,
        new THREE.BoxGeometry(0.15, 0.11, 0.045),
        accentMat,
        darkOutline,
        0.0024
      );
      obiDrum.position.set(0, 0.045, -0.105);

      const skirt = addOutlinedMesh(
        this.outfitGroup,
        createPleatedSkirtGeometry(0.102, 0.24, 0.28, 22, 0.015),
        primaryMat,
        darkOutline,
        0.0028
      );
      skirt.position.y = -0.13;
    } else if (style === 'shrine_miko') {
      // Shrine Maiden (Miko): crisp white haori top + wide draped sleeves + scarlet/primary Hakama skirt
      addOutlinedMesh(this.outfitGroup, topGeo, secondaryMat, darkOutline, 0.0026);
      addSleeves(secondaryMat, 0.18, false, accentMat, secondaryMat);

      [-1, 1].forEach((s) => {
        const lapel = addOutlinedMesh(
          this.outfitGroup,
          new THREE.BoxGeometry(0.028, 0.16, 0.018),
          primaryMat,
          darkOutline,
          0.002
        );
        lapel.position.set(s * 0.02, 0.215, 0.088);
        lapel.rotation.z = s * -0.3;
      });

      // High-waisted Hakama sash + braided cord bow
      const hakamaBand = addOutlinedMesh(
        this.outfitGroup,
        new THREE.CylinderGeometry(0.102, 0.106, 0.085, 24),
        primaryMat,
        darkOutline,
        0.0024
      );
      hakamaBand.scale.set(1.06, 1, 0.8);
      hakamaBand.position.y = 0.025;

      addBow(new THREE.Vector3(0, 0.03, 0.098), accentMat, 0.95);

      // Long flowing pleated Hakama skirt
      const hakama = addOutlinedMesh(
        this.outfitGroup,
        createPleatedSkirtGeometry(0.102, 0.26, 0.36, 18, 0.018),
        primaryMat,
        darkOutline,
        0.0028
      );
      hakama.position.y = -0.165;
    } else if (style === 'angel_valkyrie') {
      // Sky Valkyrie: sculpted armor bodice, shoulder pauldrons, glowing core, split battle skirt + animated 3D wings!
      addOutlinedMesh(this.outfitGroup, topGeo, primaryMat, darkOutline, 0.0026);
      addSleeves(secondaryMat, 0.16, false, accentMat);

      // Shoulder armor pauldrons
      [this.leftSleeveGroup, this.rightSleeveGroup].forEach((grp, idx) => {
        const side = idx === 0 ? -1 : 1;
        const pauldron = addOutlinedMesh(
          grp,
          new THREE.SphereGeometry(0.062, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
          accentMat,
          darkOutline,
          0.0024
        );
        pauldron.position.set(side * 0.01, 0.015, 0);
        pauldron.rotation.z = side * -0.45;
      });

      // Glowing chest core gem + golden breastplate trim
      const core = addOutlinedMesh(
        this.outfitGroup,
        new THREE.OctahedronGeometry(0.028, 0),
        glowAccentMat,
        darkOutline,
        0.002
      );
      core.position.set(0, 0.205, 0.098);

      const belt = addOutlinedMesh(
        this.outfitGroup,
        new THREE.TorusGeometry(0.105, 0.012, 8, 24),
        accentMat,
        darkOutline,
        0.0022
      );
      belt.scale.set(1.06, 0.84, 1);
      belt.rotation.x = Math.PI / 2;
      belt.position.y = 0.005;

      const battleSkirt = addOutlinedMesh(
        this.outfitGroup,
        createPleatedSkirtGeometry(0.1, 0.25, 0.25, 14, 0.02),
        secondaryMat,
        darkOutline,
        0.0028
      );
      battleSkirt.position.y = -0.12;

      // Sculpted feathered Angel/Valkyrie Wings on back!
      [-1, 1].forEach((side) => {
        const wingPivot = new THREE.Group();
        wingPivot.position.set(side * 0.065, 0.21, -0.09);
        wingPivot.rotation.y = side * -0.35;

        for (let f = 0; f < 5; f++) {
          const featherLen = 0.34 - f * 0.042;
          const feather = addOutlinedMesh(
            wingPivot,
            new THREE.CapsuleGeometry(0.022 - f * 0.002, featherLen, 6, 10),
            f === 0 ? accentMat : primaryMat,
            darkOutline,
            0.0022
          );
          feather.scale.set(1.1, 1.0, 0.32);
          feather.rotation.z = side * -(0.85 + f * 0.22);
          feather.position.set(
            side * (0.14 + f * 0.015),
            0.08 - f * 0.055,
            -0.02 - f * 0.006
          );
        }
        this.outfitGroup.add(wingPivot);
        this.wingPivots.push(wingPivot);
      });
    } else {
      // Bunny Stage: sleek tuxedo-corset bodice, crisp collar + bowtie, back tailcoat flaps & fluffy bunny tail
      addOutlinedMesh(this.outfitGroup, topGeo, primaryMat, darkOutline, 0.0026);
      addSleeves(primaryMat, 0.11, false, secondaryMat);

      const collar = addOutlinedMesh(
        this.outfitGroup,
        new THREE.CylinderGeometry(0.052, 0.068, 0.036, 20),
        secondaryMat,
        darkOutline,
        0.0022
      );
      collar.position.set(0, 0.305, 0.002);

      addBow(new THREE.Vector3(0, 0.278, 0.068), accentMat, 0.85);

      // Tailcoat lapels at back
      [-1, 1].forEach((s) => {
        const tailFlap = addOutlinedMesh(
          this.outfitGroup,
          new THREE.BoxGeometry(0.065, 0.24, 0.016),
          primaryMat,
          darkOutline,
          0.0024
        );
        tailFlap.position.set(s * 0.052, -0.1, -0.095);
        tailFlap.rotation.z = s * 0.14;
        tailFlap.rotation.x = 0.16;
      });

      // Fluffy pom-pom tail
      const tailPom = addOutlinedMesh(
        this.outfitGroup,
        new THREE.SphereGeometry(0.044, 16, 14),
        secondaryMat,
        darkOutline,
        0.0022
      );
      tailPom.position.set(0, -0.035, -0.115);

      const stageSkirt = addOutlinedMesh(
        this.outfitGroup,
        createPleatedSkirtGeometry(0.098, 0.22, 0.2, 22, 0.014),
        primaryMat,
        darkOutline,
        0.0026
      );
      stageSkirt.position.y = -0.11;
    }

    const { skin, mat: skinMat } = this.getSkinMat();
    this.buildLegs(skinMat, skin.outline);
  }

  public rebuildAccessory() {
    this.clearGroup(this.accessoryGroup);
    this.haloMesh = null;
    this.catEarMeshes = [];

    const acc = this.appearance.accessory;
    const accentMat = createAnimeToonMaterial({
      color: this.appearance.outfitAccentColor,
      rimColor: '#ffffff',
      rimStrength: 0.35,
    });
    const darkOutline = '#241a33';

    if (acc === 'cat_ears') {
      const earOuterMat = createAnimeToonMaterial({
        color: this.appearance.hairColor,
        hairHighlightColor: this.appearance.hairHighlightColor,
        hairShine: 0.5,
      });
      const earInnerMat = createAnimeToonMaterial({
        color: '#ffb0c9',
      });
      [-1, 1].forEach((side) => {
        const earPivot = new THREE.Group();
        earPivot.position.set(side * 0.135, 0.19, 0.015);
        earPivot.rotation.z = side * -0.38;
        earPivot.rotation.x = 0.12;

        const outerGeo = new THREE.ConeGeometry(0.054, 0.11, 16);
        outerGeo.scale(1.0, 1.0, 0.55);
        addOutlinedMesh(earPivot, outerGeo, earOuterMat, darkOutline, 0.0024);

        const innerGeo = new THREE.ConeGeometry(0.032, 0.075, 12);
        innerGeo.scale(1.0, 1.0, 0.4);
        const inner = new THREE.Mesh(innerGeo, earInnerMat);
        inner.position.set(0, -0.008, 0.015);
        earPivot.add(inner);

        this.accessoryGroup.add(earPivot);
        this.catEarMeshes.push(earPivot);
      });
    } else if (acc === 'ribbons') {
      [-1, 1].forEach((side) => {
        const ribbonGroup = new THREE.Group();
        ribbonGroup.position.set(side * 0.185, 0.15, -0.02);
        ribbonGroup.rotation.z = side * -0.4;
        ribbonGroup.rotation.y = side * 0.45;

        addOutlinedMesh(
          ribbonGroup,
          new THREE.SphereGeometry(0.022, 12, 10),
          accentMat,
          darkOutline,
          0.002
        );
        [-1, 1].forEach((ws) => {
          const wingGeo = new THREE.ConeGeometry(0.03, 0.064, 10);
          wingGeo.rotateZ(ws * 1.25);
          const wing = addOutlinedMesh(
            ribbonGroup,
            wingGeo,
            accentMat,
            darkOutline,
            0.002
          );
          wing.position.set(ws * 0.038, 0, 0);
        });
        this.accessoryGroup.add(ribbonGroup);
      });
    } else if (acc === 'halo') {
      const haloMat = new THREE.MeshBasicMaterial({
        color: this.appearance.outfitAccentColor,
      });
      const haloGroup = new THREE.Group();
      haloGroup.position.set(0, 0.33, -0.02);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.11, 0.008, 12, 48),
        haloMat
      );
      ring.rotation.x = Math.PI / 2 - 0.15;
      haloGroup.add(ring);
      this.accessoryGroup.add(haloGroup);
      this.haloMesh = haloGroup;
    } else if (acc === 'glasses') {
      const frameMat = new THREE.MeshBasicMaterial({ color: '#2b2438' });
      const lensMat = new THREE.MeshBasicMaterial({
        color: '#dff6ff',
        transparent: true,
        opacity: 0.18,
      });
      const glasses = new THREE.Group();
      glasses.position.set(0, -0.022, 0.212);

      [-1, 1].forEach((side) => {
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(0.044, 0.0032, 8, 28),
          frameMat
        );
        rim.scale.set(1.12, 0.86, 1);
        rim.position.set(side * 0.07, 0, 0);
        rim.rotation.y = side * 0.18;

        const lens = new THREE.Mesh(
          new THREE.CircleGeometry(0.042, 24),
          lensMat
        );
        lens.scale.set(1.12, 0.86, 1);
        lens.position.copy(rim.position);
        lens.rotation.copy(rim.rotation);
        glasses.add(rim, lens);
      });

      const bridge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0025, 0.0025, 0.036, 8),
        frameMat
      );
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, 0.008, 0.004);
      glasses.add(bridge);

      this.accessoryGroup.add(glasses);
    } else if (acc === 'headphones') {
      const bandMat = createAnimeToonMaterial({
        color: this.appearance.outfitPrimaryColor,
      });
      const glowMat = new THREE.MeshBasicMaterial({
        color: this.appearance.outfitAccentColor,
      });

      const band = addOutlinedMesh(
        this.accessoryGroup,
        new THREE.TorusGeometry(0.228, 0.015, 10, 32, Math.PI * 1.05),
        bandMat,
        darkOutline,
        0.0024
      );
      band.position.set(0, 0.022, -0.005);
      band.rotation.z = -0.08;

      [-1, 1].forEach((side) => {
        const cup = addOutlinedMesh(
          this.accessoryGroup,
          new THREE.CylinderGeometry(0.052, 0.052, 0.034, 20),
          bandMat,
          darkOutline,
          0.0024
        );
        cup.rotation.z = Math.PI / 2;
        cup.position.set(side * 0.225, -0.01, -0.005);

        const glowRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.038, 0.005, 8, 24),
          glowMat
        );
        glowRing.rotation.y = side * (Math.PI / 2);
        glowRing.position.set(side * 0.244, -0.01, -0.005);
        this.accessoryGroup.add(glowRing);
      });
    }
  }

  public applyAppearance(next: AppearanceConfig) {
    const hairChanged =
      next.hairStyle !== this.appearance.hairStyle ||
      next.hairColor !== this.appearance.hairColor ||
      next.hairHighlightColor !== this.appearance.hairHighlightColor ||
      next.outfitAccentColor !== this.appearance.outfitAccentColor;

    const outfitChanged =
      next.outfitStyle !== this.appearance.outfitStyle ||
      next.outfitPrimaryColor !== this.appearance.outfitPrimaryColor ||
      next.outfitSecondaryColor !== this.appearance.outfitSecondaryColor ||
      next.outfitAccentColor !== this.appearance.outfitAccentColor ||
      next.skinTone !== this.appearance.skinTone;

    const accChanged =
      next.accessory !== this.appearance.accessory ||
      next.outfitAccentColor !== this.appearance.outfitAccentColor ||
      next.outfitPrimaryColor !== this.appearance.outfitPrimaryColor ||
      next.hairColor !== this.appearance.hairColor;

    this.appearance = { ...next };

    const skin = SKIN_PALETTES[next.skinTone];
    this.faceRig.updateAppearance(
      skin.base,
      skin.blush,
      next.eyeStyle,
      next.eyeColor,
      next.eyeScale,
      next.blushIntensity,
      next.hairColor
    );

    if (hairChanged) this.rebuildHair();
    if (outfitChanged) this.rebuildOutfit();
    if (accChanged) this.rebuildAccessory();
  }

  public setMood(mood: Mood) {
    this.mood = mood;
    this.faceRig.setMood(mood);
  }

  public setThinking(thinking: boolean) {
    this.isThinking = thinking;
  }

  public setSpeaking(speaking: boolean, energy = 0) {
    this.isSpeaking = speaking;
    this.speechEnergy = energy;
    this.faceRig.setMouthActivity(
      speaking ? energy : 0,
      0.85 + Math.sin(performance.now() * 0.015) * 0.22
    );
  }

  public setLookTarget(nx: number, ny: number) {
    this.lookTarget.set(nx, ny);
    this.faceRig.setGazeTarget(nx, ny);
  }

  public triggerHeadpat() {
    this.headpatBounce = 1.0;
    this.faceRig.triggerHeadpatHappy(2.2);
  }

  public triggerPoke() {
    this.pokeFluster = 1.0;
    this.faceRig.triggerHeadpatHappy(0.35);
  }

  public update(dt: number, elapsed: number) {
    const safeDt = Math.min(dt, 0.05);

    const breath = Math.sin(elapsed * 2.1);
    const fastWave = Math.sin(elapsed * 4.2);

    let bounceY = breath * 0.007;
    if (this.mood === 'excited') {
      bounceY += Math.abs(Math.sin(elapsed * 5.2)) * 0.015;
    }
    if (this.headpatBounce > 0) {
      this.headpatBounce = Math.max(0, this.headpatBounce - safeDt * 2.4);
      bounceY -= Math.sin(this.headpatBounce * Math.PI) * 0.028;
    }
    if (this.pokeFluster > 0) {
      this.pokeFluster = Math.max(0, this.pokeFluster - safeDt * 2.8);
    }

    this.hips.position.y = 0.83 + bounceY;
    this.chest.rotation.x = breath * 0.016;

    this.smoothLook.lerp(this.lookTarget, Math.min(1, safeDt * 6));

    let targetHeadX = -this.smoothLook.y * 0.14;
    let targetHeadY = this.smoothLook.x * 0.24;
    let targetHeadZ = Math.sin(elapsed * 1.1) * 0.032;

    if (this.isThinking) {
      targetHeadZ = 0.15;
      targetHeadX -= 0.06;
    } else if (this.mood === 'tsundere') {
      targetHeadY -= 0.16;
      targetHeadZ = -0.07;
    } else if (this.mood === 'shy') {
      targetHeadX += 0.09;
      targetHeadZ = 0.08;
    } else if (this.isSpeaking) {
      targetHeadX += Math.sin(elapsed * 6.5) * 0.03 * this.speechEnergy;
      targetHeadZ += Math.sin(elapsed * 2.7) * 0.04;
    }

    if (this.pokeFluster > 0) {
      targetHeadZ += Math.sin(this.pokeFluster * Math.PI * 3) * 0.11;
    }

    this.head.rotation.x = THREE.MathUtils.lerp(
      this.head.rotation.x,
      targetHeadX,
      safeDt * 8
    );
    this.head.rotation.y = THREE.MathUtils.lerp(
      this.head.rotation.y,
      targetHeadY,
      safeDt * 8
    );
    this.head.rotation.z = THREE.MathUtils.lerp(
      this.head.rotation.z,
      targetHeadZ,
      safeDt * 8
    );

    this.spine.rotation.y = THREE.MathUtils.lerp(
      this.spine.rotation.y,
      this.smoothLook.x * 0.07,
      safeDt * 5
    );

    // Expressive Arm Poses
    let lShoulderZ = -0.16 + breath * 0.02;
    let rShoulderZ = 0.16 - breath * 0.02;
    let lShoulderX = 0.05;
    let rShoulderX = 0.05;
    let lElbowX = -0.26;
    let rElbowX = -0.26;

    if (this.isThinking) {
      rShoulderX = -0.68;
      rShoulderZ = 0.12;
      rElbowX = -1.42;
    } else if (this.mood === 'excited' || this.headpatBounce > 0.15) {
      lShoulderZ = -0.34 + fastWave * 0.07;
      rShoulderZ = 0.34 - fastWave * 0.07;
      lElbowX = -0.62;
      rElbowX = -0.62;
    } else if (this.mood === 'shy') {
      lShoulderX = -0.25;
      rShoulderX = -0.25;
      lShoulderZ = -0.04;
      rShoulderZ = 0.04;
      lElbowX = -0.92;
      rElbowX = -0.92;
    } else if (this.isSpeaking) {
      rShoulderX = -0.26 + Math.sin(elapsed * 4.5) * 0.07;
      rElbowX = -0.72 + Math.cos(elapsed * 5.1) * 0.12;
      lShoulderX = -0.1 + Math.cos(elapsed * 3.2) * 0.05;
      lElbowX = -0.42;
    }

    const armLerp = Math.min(1, safeDt * 7);
    this.leftShoulder.rotation.z = THREE.MathUtils.lerp(
      this.leftShoulder.rotation.z,
      lShoulderZ,
      armLerp
    );
    this.rightShoulder.rotation.z = THREE.MathUtils.lerp(
      this.rightShoulder.rotation.z,
      rShoulderZ,
      armLerp
    );
    this.leftShoulder.rotation.x = THREE.MathUtils.lerp(
      this.leftShoulder.rotation.x,
      lShoulderX,
      armLerp
    );
    this.rightShoulder.rotation.x = THREE.MathUtils.lerp(
      this.rightShoulder.rotation.x,
      rShoulderX,
      armLerp
    );
    this.leftElbow.rotation.x = THREE.MathUtils.lerp(
      this.leftElbow.rotation.x,
      lElbowX,
      armLerp
    );
    this.rightElbow.rotation.x = THREE.MathUtils.lerp(
      this.rightElbow.rotation.x,
      rElbowX,
      armLerp
    );

    if (this.haloMesh) {
      this.haloMesh.position.y = 0.33 + Math.sin(elapsed * 2.4) * 0.012;
      this.haloMesh.rotation.y = elapsed * 0.65;
    }
    if (this.catEarMeshes.length === 2) {
      const twitch = Math.pow(Math.max(0, Math.sin(elapsed * 1.9)), 16) * 0.22;
      this.catEarMeshes[0].rotation.z = 0.38 + twitch;
      this.catEarMeshes[1].rotation.z = -0.38 - twitch * 0.4;
    }
    if (this.wingPivots.length === 2) {
      const flutter = Math.sin(elapsed * 2.6) * 0.08;
      this.wingPivots[0].rotation.y = 0.35 + flutter;
      this.wingPivots[1].rotation.y = -0.35 - flutter;
    }

    // Hair Spring-Damper Physics
    const curHeadPos = new THREE.Vector3();
    this.head.getWorldPosition(curHeadPos);
    const headVel = curHeadPos
      .clone()
      .sub(this.prevHeadWorldPos)
      .divideScalar(Math.max(0.008, safeDt));
    this.prevHeadWorldPos.copy(curHeadPos);

    const windX = Math.sin(elapsed * 1.6) * 0.035;
    const windZ = Math.cos(elapsed * 1.2) * 0.025;

    for (const s of this.springNodes) {
      const targetX =
        -headVel.z * 0.12 * s.influence +
        windX * s.influence -
        this.head.rotation.x * 0.3;
      const targetZ =
        headVel.x * 0.12 * s.influence +
        windZ * s.influence -
        this.head.rotation.z * 0.4;

      const forceX = (targetX - s.curX) * s.stiffness - s.velX * s.damping;
      const forceZ = (targetZ - s.curZ) * s.stiffness - s.velZ * s.damping;

      s.velX += forceX * safeDt;
      s.velZ += forceZ * safeDt;
      s.curX = THREE.MathUtils.clamp(s.curX + s.velX * safeDt, -0.4, 0.4);
      s.curZ = THREE.MathUtils.clamp(s.curZ + s.velZ * safeDt, -0.4, 0.4);

      s.pivot.rotation.x = s.baseRot.x + s.curX;
      s.pivot.rotation.z = s.baseRot.z + s.curZ;
    }

    this.faceRig.update(safeDt, elapsed);
  }
}
