import * as THREE from 'three';

/**
 * AQUARYA - Procedural 3D Cartoon Shark
 * Modello 100% procedurale di qualità da portfolio / Pixar toy-like:
 * - Corpo a siluro paffuto deformato lungo la spina dorsale a 12 nodi
 * - Shading toon con countershading (dorso cel-shading azzurro/pastello, pancia crema caldo)
 * - Inverted hull outline pulito blu notte (#182333)
 * - Occhi grandi, lucidi ed espressivi con pupilla 3D, riflesso, bagliore e battito palpebre
 * - Bocca con sorriso largo e dolce, dentini bianchi carini ed espressione dinamica al drag
 * - Guance con blush rosa soft
 * - Pinne beveled perfettamente orientate (dorsale verticale, pettorali ad ala rivolte all'indietro con flutter, caudale a mezzaluna)
 */

export const PALETTES = {
  ocean: {
    name: 'Oceano Blu',
    primary: new THREE.Color(0x5B8DEF),
    accent: new THREE.Color(0x3B6DCD),
    belly: new THREE.Color(0xFFF9EE),
    blush: new THREE.Color(0xFFA0B4),
    outline: new THREE.Color(0x1B263B)
  },
  coral: {
    name: 'Corallo Rosa',
    primary: new THREE.Color(0xF48B8B),
    accent: new THREE.Color(0xE06363),
    belly: new THREE.Color(0xFFFAF2),
    blush: new THREE.Color(0xFF6B8B),
    outline: new THREE.Color(0x381922)
  },
  mint: {
    name: 'Menta Verde',
    primary: new THREE.Color(0x56C596),
    accent: new THREE.Color(0x3AA377),
    belly: new THREE.Color(0xF7FFF8),
    blush: new THREE.Color(0xFFA6BE),
    outline: new THREE.Color(0x143324)
  }
};

function createToonGradientMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  const colors = ['#667788', '#99AABB', '#DDEEFF', '#FFFFFF'];
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i, 0, 1, 1);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

export class Shark {
  constructor(paletteKey = 'ocean') {
    this.group = new THREE.Group();
    this.group.name = 'SharkRoot';

    this.currentPaletteKey = paletteKey;
    this.palette = { ...PALETTES[paletteKey] };
    this.targetPalette = { ...PALETTES[paletteKey] };
    this.paletteLerp = 1.0;

    this.toonGradientMap = createToonGradientMap();

    // Espressione & Blink
    this.expression = 0; // 0 = calmo, 1 = sorpreso/trascinato
    this.targetExpression = 0;
    this.blinkTimer = 2.5;
    this.isBlinking = false;
    this.blinkProgress = 0;

    // Puntamento sguardo
    this.eyeTarget = new THREE.Vector3(0, 0, 10);
    this.currentEyeLook = new THREE.Vector2(0, 0);

    // Scala bilanciata (1/3 viewport desktop)
    this.baseScale = 0.85;
    this.group.scale.setScalar(this.baseScale);

    // Costruzione corpo e mesh
    this.slices = 24;
    this.radial = 28;
    this.buildBodyMesh();
    this.buildFins();
    this.buildFace();
    this.buildSkeletonDebug();
  }

  getBodyProfile(u) {
    let rx, ry, cy;
    if (u < 0.22) {
      // Muso paffuto e morbido
      const t = u / 0.22;
      const s = Math.sin((t * Math.PI) / 2);
      rx = 0.94 * Math.pow(s, 0.45);
      ry = 0.80 * Math.pow(s, 0.45);
      cy = 0.05 * (1 - t);
    } else if (u < 0.55) {
      // Torace e pancia morbida
      const t = (u - 0.22) / 0.33;
      rx = THREE.MathUtils.lerp(0.94, 0.74, t);
      ry = THREE.MathUtils.lerp(0.80, 0.65, t);
      cy = -0.04 * Math.sin(t * Math.PI);
    } else {
      // Coda affusolata
      const t = (u - 0.55) / 0.45;
      rx = THREE.MathUtils.lerp(0.74, 0.10, Math.pow(t, 0.75));
      ry = THREE.MathUtils.lerp(0.65, 0.12, Math.pow(t, 0.75));
      cy = 0.04 * t;
    }
    return { rx, ry, cy };
  }

  buildBodyMesh() {
    const totalVerts = (this.slices + 1) * (this.radial + 1);
    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);
    const colors = new Float32Array(totalVerts * 3);
    const indices = [];

    let idx = 0;
    for (let i = 0; i <= this.slices; i++) {
      const u = i / this.slices;
      for (let j = 0; j <= this.radial; j++) {
        const v = j / this.radial;
        const theta = v * Math.PI * 2;
        const sinT = Math.sin(theta);

        uvs[idx * 2 + 0] = v;
        uvs[idx * 2 + 1] = u;

        // Countershading: Dorso blu/colorato, pancia crema caldo
        const dorsalFactor = THREE.MathUtils.smoothstep(sinT, -0.22, 0.20);
        const col = new THREE.Color().lerpColors(this.palette.belly, this.palette.primary, dorsalFactor);
        colors[idx * 3 + 0] = col.r;
        colors[idx * 3 + 1] = col.g;
        colors[idx * 3 + 2] = col.b;

        idx++;
      }
    }

    for (let i = 0; i < this.slices; i++) {
      for (let j = 0; j < this.radial; j++) {
        const row1 = i * (this.radial + 1);
        const row2 = (i + 1) * (this.radial + 1);
        const a = row1 + j;
        const b = row1 + j + 1;
        const c = row2 + j + 1;
        const d = row2 + j;
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    this.bodyGeo = new THREE.BufferGeometry();
    this.bodyGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.bodyGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    this.bodyGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.bodyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.bodyGeo.setIndex(indices);

    this.bodyMaterial = new THREE.MeshToonMaterial({
      vertexColors: true,
      gradientMap: this.toonGradientMap
    });

    this.bodyMesh = new THREE.Mesh(this.bodyGeo, this.bodyMaterial);
    this.bodyMesh.castShadow = true;
    this.group.add(this.bodyMesh);

    // Inverted hull outline
    const outlinePositions = new Float32Array(totalVerts * 3);
    const outlineUVs = new Float32Array(totalVerts * 2);
    outlineUVs.set(uvs);

    this.outlineGeo = new THREE.BufferGeometry();
    this.outlineGeo.setAttribute('position', new THREE.BufferAttribute(outlinePositions, 3));
    this.outlineGeo.setAttribute('uv', new THREE.BufferAttribute(outlineUVs, 2));
    this.outlineGeo.setIndex(indices);

    this.outlineMaterial = new THREE.MeshBasicMaterial({
      color: this.palette.outline,
      side: THREE.BackSide
    });

    this.bodyOutlineMesh = new THREE.Mesh(this.outlineGeo, this.outlineMaterial);
    this.group.add(this.bodyOutlineMesh);
  }

  buildFins() {
    this.dorsalMat = new THREE.MeshToonMaterial({
      color: this.palette.primary,
      gradientMap: this.toonGradientMap
    });

    this.finOutlineMat = new THREE.MeshBasicMaterial({
      color: this.palette.outline,
      side: THREE.BackSide
    });

    // 1. PINNA DORSALE (disegnata nel piano Z-Y)
    const dShape = new THREE.Shape();
    dShape.moveTo(0.35, 0.0);
    dShape.quadraticCurveTo(0.16, 0.52, -0.05, 0.90);
    dShape.quadraticCurveTo(-0.14, 0.98, -0.22, 0.88);
    dShape.quadraticCurveTo(-0.16, 0.42, -0.40, 0.0);
    dShape.lineTo(0.35, 0.0);

    const dGeo = new THREE.ExtrudeGeometry(dShape, {
      steps: 1, depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3
    });
    dGeo.center();
    dGeo.rotateY(Math.PI / 2); // lunghezza lungo Z, spessore lungo X

    this.dorsalFin = new THREE.Mesh(dGeo, this.dorsalMat);
    const dOutline = new THREE.Mesh(dGeo, this.finOutlineMat);
    dOutline.scale.set(1.06, 1.06, 1.06);
    this.dorsalFin.add(dOutline);
    this.group.add(this.dorsalFin);

    // 2. PINNA CAUDALE (CODA a mezzaluna arrotondata Pixar)
    const tShape = new THREE.Shape();
    tShape.moveTo(0.0, 0.0);
    tShape.quadraticCurveTo(-0.25, 0.38, -0.55, 0.78);
    tShape.quadraticCurveTo(-0.62, 0.85, -0.58, 0.75);
    tShape.quadraticCurveTo(-0.38, 0.32, -0.16, 0.04);
    tShape.quadraticCurveTo(-0.32, -0.26, -0.46, -0.55);
    tShape.quadraticCurveTo(-0.52, -0.62, -0.42, -0.56);
    tShape.quadraticCurveTo(-0.12, -0.22, 0.0, 0.0);

    const tGeo = new THREE.ExtrudeGeometry(tShape, {
      steps: 1, depth: 0.07, bevelEnabled: true, bevelThickness: 0.028, bevelSize: 0.028, bevelSegments: 3
    });
    tGeo.center();
    tGeo.rotateY(Math.PI / 2);

    this.caudalFin = new THREE.Mesh(tGeo, this.dorsalMat);
    this.caudalFin.scale.set(1.12, 1.12, 1.12);
    const tOutline = new THREE.Mesh(tGeo, this.finOutlineMat);
    tOutline.scale.set(1.06, 1.06, 1.06);
    this.caudalFin.add(tOutline);
    this.group.add(this.caudalFin);

    // 3. PINNE PETTORALI (ad ala morbida, curvate all'indietro lungo -Z)
    const pShape = new THREE.Shape();
    pShape.moveTo(0.0, 0.12);
    pShape.quadraticCurveTo(0.42, 0.15, 1.05, 0.38);  // punta allungata
    pShape.quadraticCurveTo(1.16, 0.46, 1.08, 0.55);  // punta morbida
    pShape.quadraticCurveTo(0.55, 0.40, 0.0, 0.28);   // bordo posteriore
    pShape.lineTo(0.0, 0.12);

    const pGeo = new THREE.ExtrudeGeometry(pShape, {
      steps: 1, depth: 0.06, bevelEnabled: true, bevelThickness: 0.024, bevelSize: 0.024, bevelSegments: 3
    });
    // Ruota attorno a X di -90 gradi: proietta il sweep lungo -Z (indietro verso la coda!)
    pGeo.rotateX(-Math.PI / 2);
    pGeo.rotateZ(-0.15); // leggera inclinazione verso il basso

    // Pinna Sinistra (lato +Side)
    this.leftPectGroup = new THREE.Group();
    const lMesh = new THREE.Mesh(pGeo, this.dorsalMat);
    const lOut = new THREE.Mesh(pGeo, this.finOutlineMat);
    lOut.scale.set(1.06, 1.06, 1.06);
    lMesh.add(lOut);
    this.leftPectGroup.add(lMesh);
    this.group.add(this.leftPectGroup);

    // Pinna Destra (specchiata su X)
    this.rightPectGroup = new THREE.Group();
    const rMesh = new THREE.Mesh(pGeo, this.dorsalMat);
    rMesh.scale.set(-1, 1, 1);
    const rOut = new THREE.Mesh(pGeo, this.finOutlineMat);
    rOut.scale.set(1.06, 1.06, 1.06);
    rMesh.add(rOut);
    this.rightPectGroup.add(rMesh);
    this.group.add(this.rightPectGroup);
  }

  buildFace() {
    this.faceGroup = new THREE.Group();
    this.group.add(this.faceGroup);

    const eyeWhiteMat = new THREE.MeshToonMaterial({
      color: 0xFFFFFF,
      gradientMap: this.toonGradientMap
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x141824 });
    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

    const eyeRadius = 0.22;
    const eyeGeo = new THREE.SphereGeometry(eyeRadius, 24, 24);

    const createEye = (isLeft) => {
      const eyeRoot = new THREE.Group();
      
      const sclera = new THREE.Mesh(eyeGeo, eyeWhiteMat);
      eyeRoot.add(sclera);

      const irisGroup = new THREE.Group();
      
      // Pupilla nera 3D bombata e frontale
      const pupilGeo = new THREE.SphereGeometry(0.13, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(0, 0, eyeRadius * 0.88);
      pupil.rotation.x = Math.PI / 2;
      irisGroup.add(pupil);

      // Riflesso principale bianco brillante
      const hi1Geo = new THREE.SphereGeometry(0.048, 12, 12);
      const hi1 = new THREE.Mesh(hi1Geo, highlightMat);
      hi1.position.set(0.048, 0.052, eyeRadius * 0.96);
      irisGroup.add(hi1);

      // Bagliore secondario
      const hi2Geo = new THREE.SphereGeometry(0.024, 10, 10);
      const hi2 = new THREE.Mesh(hi2Geo, highlightMat);
      hi2.position.set(-0.042, -0.042, eyeRadius * 0.96);
      irisGroup.add(hi2);

      eyeRoot.add(irisGroup);

      // Palpebra per il battito
      const lidGeo = new THREE.SphereGeometry(eyeRadius * 1.06, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      this.lidMat = new THREE.MeshToonMaterial({
        color: this.palette.primary,
        gradientMap: this.toonGradientMap
      });
      const eyelid = new THREE.Mesh(lidGeo, this.lidMat);
      eyelid.rotation.x = -Math.PI / 2;
      eyeRoot.add(eyelid);

      const eOutline = new THREE.Mesh(eyeGeo, this.finOutlineMat);
      eOutline.scale.set(1.06, 1.06, 1.06);
      eyeRoot.add(eOutline);

      return { eyeRoot, irisGroup, eyelid };
    };

    this.leftEye = createEye(true);
    this.faceGroup.add(this.leftEye.eyeRoot);

    this.rightEye = createEye(false);
    this.faceGroup.add(this.rightEye.eyeRoot);

    // Guance blush rosa soft
    const blushGeo = new THREE.CircleGeometry(0.16, 20);
    this.blushMat = new THREE.MeshBasicMaterial({
      color: this.palette.blush,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });

    this.leftBlush = new THREE.Mesh(blushGeo, this.blushMat);
    this.faceGroup.add(this.leftBlush);

    this.rightBlush = new THREE.Mesh(blushGeo, this.blushMat);
    this.faceGroup.add(this.rightBlush);

    // Bocca: Sorriso largo e dolce con 2 dentini bianchi
    this.mouthGroup = new THREE.Group();
    const smileCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.35, 0.05, 0.0),
      new THREE.Vector3(-0.16, -0.05, 0.08),
      new THREE.Vector3(0.0, -0.07, 0.10),
      new THREE.Vector3(0.16, -0.05, 0.08),
      new THREE.Vector3(0.35, 0.05, 0.0)
    ]);
    const smileGeo = new THREE.TubeGeometry(smileCurve, 20, 0.035, 8, false);
    const smileMat = new THREE.MeshBasicMaterial({ color: 0x1A2536 });
    this.smileMesh = new THREE.Mesh(smileGeo, smileMat);
    this.mouthGroup.add(this.smileMesh);

    // Dentini carini
    const toothGeo = new THREE.ConeGeometry(0.042, 0.07, 12);
    toothGeo.rotateX(Math.PI);
    const toothMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

    const tooth1 = new THREE.Mesh(toothGeo, toothMat);
    tooth1.position.set(-0.11, -0.01, 0.08);
    this.mouthGroup.add(tooth1);

    const tooth2 = new THREE.Mesh(toothGeo, toothMat);
    tooth2.position.set(0.11, -0.01, 0.08);
    this.mouthGroup.add(tooth2);

    this.faceGroup.add(this.mouthGroup);
  }

  buildSkeletonDebug() {
    this.debugGroup = new THREE.Group();
    this.debugGroup.name = 'SkeletonDebug';
    this.debugGroup.visible = false;

    this.debugSpheres = [];
    const sphereGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xFF3366, wireframe: true });

    for (let i = 0; i < 12; i++) {
      const sp = new THREE.Mesh(sphereGeo, sphereMat);
      this.debugSpheres.push(sp);
      this.debugGroup.add(sp);
    }
    this.group.add(this.debugGroup);
    this.skeletonHelper = this.debugGroup;
  }

  setPalette(paletteKey) {
    if (!PALETTES[paletteKey]) return;
    this.currentPaletteKey = paletteKey;
    this.targetPalette = { ...PALETTES[paletteKey] };
    this.paletteLerp = 0.0;
  }

  setExpression(targetVal) {
    this.targetExpression = THREE.MathUtils.clamp(targetVal, 0, 1);
  }

  lookAtPointer(targetWorldVec) {
    this.eyeTarget.copy(targetWorldVec);
  }

  update(delta, currentSpeed = 1.6, spineNodes = []) {
    // 1. Transizione fluida colori palette
    if (this.paletteLerp < 1.0) {
      this.paletteLerp = Math.min(1.0, this.paletteLerp + delta * 3.0);
      this.palette.primary.lerp(this.targetPalette.primary, 0.15);
      this.palette.belly.lerp(this.targetPalette.belly, 0.15);
      this.palette.blush.lerp(this.targetPalette.blush, 0.15);
      this.palette.outline.lerp(this.targetPalette.outline, 0.15);

      this.dorsalMat.color.copy(this.palette.primary);
      this.outlineMaterial.color.copy(this.palette.outline);
      this.finOutlineMat.color.copy(this.palette.outline);
      this.blushMat.color.copy(this.palette.blush);
      if (this.lidMat) this.lidMat.color.copy(this.palette.primary);

      const cols = this.bodyGeo.attributes.color.array;
      let idx = 0;
      for (let i = 0; i <= this.slices; i++) {
        for (let j = 0; j <= this.radial; j++) {
          const theta = (j / this.radial) * Math.PI * 2;
          const sinT = Math.sin(theta);
          const dorsalFactor = THREE.MathUtils.smoothstep(sinT, -0.22, 0.20);
          const col = new THREE.Color().lerpColors(this.palette.belly, this.palette.primary, dorsalFactor);
          cols[idx * 3 + 0] = col.r;
          cols[idx * 3 + 1] = col.g;
          cols[idx * 3 + 2] = col.b;
          idx++;
        }
      }
      this.bodyGeo.attributes.color.needsUpdate = true;
    }

    // 2. Transizione espressione (sorriso vs sorpresa)
    this.expression = THREE.MathUtils.lerp(this.expression, this.targetExpression, delta * 8.0);
    if (this.mouthGroup) {
      this.mouthGroup.scale.set(
        1.0 - this.expression * 0.15,
        1.0 + this.expression * 0.9,
        1.0
      );
    }

    // 3. Battito palpebre
    this.blinkTimer -= delta;
    if (this.blinkTimer <= 0) {
      this.isBlinking = true;
      this.blinkProgress = 0;
      this.blinkTimer = 3.0 + Math.random() * 3.0;
    }

    if (this.isBlinking) {
      this.blinkProgress += delta * 7.5;
      if (this.blinkProgress >= Math.PI) {
        this.isBlinking = false;
        this.blinkProgress = 0;
      }
      const lidAngle = -Math.PI / 2 + Math.sin(this.blinkProgress) * (Math.PI / 2);
      if (this.leftEye) this.leftEye.eyelid.rotation.x = lidAngle;
      if (this.rightEye) this.rightEye.eyelid.rotation.x = lidAngle;
    }

    // 4. Flutter pinne pettorali
    if (this.leftPectGroup && this.rightPectGroup) {
      const flutterFreq = 2.6 * Math.max(0.6, currentSpeed * 0.7);
      const flutterAngle = Math.sin(Date.now() * 0.001 * flutterFreq) * 0.14;
      this.leftPectGroup.rotation.z = flutterAngle;
      this.rightPectGroup.rotation.z = -flutterAngle;
    }

    // 5. Deformazione procedurale del corpo lungo la spina
    if (spineNodes && spineNodes.length >= 12) {
      this.deformBodyToSpine(spineNodes);
      this.alignFinsAndFaceToSpine(spineNodes);

      if (this.debugGroup.visible) {
        for (let i = 0; i < 12; i++) {
          this.debugSpheres[i].position.copy(spineNodes[i].position);
        }
      }
    }
  }

  evalSpine(spineNodes, u) {
    const total = spineNodes.length - 1;
    const exact = u * total;
    const i0 = Math.min(Math.floor(exact), total - 1);
    const i1 = i0 + 1;
    const t = exact - i0;

    const n0 = spineNodes[i0];
    const n1 = spineNodes[i1];

    const pos = new THREE.Vector3().lerpVectors(n0.position, n1.position, t);
    const fwd = new THREE.Vector3().lerpVectors(n0.forward, n1.forward, t).normalize();
    const up = new THREE.Vector3().lerpVectors(n0.up, n1.up, t).normalize();
    const side = new THREE.Vector3().lerpVectors(n0.side, n1.side, t).normalize();

    return { pos, fwd, up, side };
  }

  deformBodyToSpine(spineNodes) {
    const posArr = this.bodyGeo.attributes.position.array;
    const outArr = this.outlineGeo.attributes.position.array;

    let idx = 0;
    const outlineOffset = 0.038;

    for (let i = 0; i <= this.slices; i++) {
      const u = i / this.slices;
      const { pos, fwd, up, side } = this.evalSpine(spineNodes, u);
      const { rx, ry, cy } = this.getBodyProfile(u);

      for (let j = 0; j <= this.radial; j++) {
        const theta = (j / this.radial) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const yMul = sinT < 0 ? 0.92 : 1.05;

        const vx = cosT * rx;
        const vy = (sinT * ry + cy) * yMul;

        const px = pos.x + side.x * vx + up.x * vy;
        const py = pos.y + side.y * vx + up.y * vy;
        const pz = pos.z + side.z * vx + up.z * vy;

        posArr[idx * 3 + 0] = px;
        posArr[idx * 3 + 1] = py;
        posArr[idx * 3 + 2] = pz;

        const nx = side.x * cosT + up.x * sinT;
        const ny = side.y * cosT + up.y * sinT;
        const nz = side.z * cosT + up.z * sinT;

        outArr[idx * 3 + 0] = px + nx * outlineOffset;
        outArr[idx * 3 + 1] = py + ny * outlineOffset;
        outArr[idx * 3 + 2] = pz + nz * outlineOffset;

        idx++;
      }
    }

    this.bodyGeo.computeVertexNormals();
    this.bodyGeo.computeBoundingSphere();
    this.bodyGeo.attributes.position.needsUpdate = true;
    this.outlineGeo.attributes.position.needsUpdate = true;
  }

  alignFinsAndFaceToSpine(spineNodes) {
    // 1. PINNA DORSALE (sul nodo 4 - dorso medio)
    const nDorsal = spineNodes[4];
    this.dorsalFin.position.copy(nDorsal.position).addScaledVector(nDorsal.up, 0.70);
    this.dorsalFin.quaternion.copy(nDorsal.quaternion);

    // 2. PINNE PETTORALI (sul nodo 2 - torace)
    const nPect = spineNodes[2];
    this.leftPectGroup.position.copy(nPect.position)
      .addScaledVector(nPect.side, 0.76)
      .addScaledVector(nPect.up, -0.16);
    this.leftPectGroup.quaternion.copy(nPect.quaternion);

    this.rightPectGroup.position.copy(nPect.position)
      .addScaledVector(nPect.side, -0.76)
      .addScaledVector(nPect.up, -0.16);
    this.rightPectGroup.quaternion.copy(nPect.quaternion);

    // 3. PINNA CAUDALE (sull'ultimo nodo 11 - punta coda)
    const nTail = spineNodes[11];
    this.caudalFin.position.copy(nTail.position);
    this.caudalFin.quaternion.copy(nTail.quaternion);

    // 4. VISO, OCCHI, BLUSH, BOCCA (sul nodo 0 e 1 - testa)
    const nHead = spineNodes[0];
    const nEye = spineNodes[1];

    const eyeDistX = 0.65;
    const eyeDistY = 0.28;
    const eyeDistZ = 0.12;

    this.leftEye.eyeRoot.position.copy(nEye.position)
      .addScaledVector(nEye.side, eyeDistX)
      .addScaledVector(nEye.up, eyeDistY)
      .addScaledVector(nEye.forward, eyeDistZ);
    this.leftEye.eyeRoot.quaternion.copy(nEye.quaternion);
    this.leftEye.eyeRoot.rotateY(0.42);

    this.rightEye.eyeRoot.position.copy(nEye.position)
      .addScaledVector(nEye.side, -eyeDistX)
      .addScaledVector(nEye.up, eyeDistY)
      .addScaledVector(nEye.forward, eyeDistZ);
    this.rightEye.eyeRoot.quaternion.copy(nEye.quaternion);
    this.rightEye.eyeRoot.rotateY(-0.42);

    // Orientamento pupille verso il puntatore
    const toTarget = new THREE.Vector3().subVectors(this.eyeTarget, nHead.position).normalize();
    const lookX = THREE.MathUtils.clamp(toTarget.x * 0.55, -0.30, 0.30);
    const lookY = THREE.MathUtils.clamp(toTarget.y * 0.55, -0.25, 0.25);
    this.currentEyeLook.x = THREE.MathUtils.lerp(this.currentEyeLook.x, lookX, 0.15);
    this.currentEyeLook.y = THREE.MathUtils.lerp(this.currentEyeLook.y, lookY, 0.15);

    this.leftEye.irisGroup.rotation.y = this.currentEyeLook.x;
    this.leftEye.irisGroup.rotation.x = -this.currentEyeLook.y;
    this.rightEye.irisGroup.rotation.y = this.currentEyeLook.x;
    this.rightEye.irisGroup.rotation.x = -this.currentEyeLook.y;

    // Blush
    this.leftBlush.position.copy(nEye.position)
      .addScaledVector(nEye.side, 0.70)
      .addScaledVector(nEye.up, 0.04);
    this.leftBlush.quaternion.copy(nEye.quaternion);
    this.leftBlush.rotateY(Math.PI / 2 - 0.22);

    this.rightBlush.position.copy(nEye.position)
      .addScaledVector(nEye.side, -0.70)
      .addScaledVector(nEye.up, 0.04);
    this.rightBlush.quaternion.copy(nEye.quaternion);
    this.rightBlush.rotateY(-Math.PI / 2 + 0.22);

    // Bocca
    this.mouthGroup.position.copy(nHead.position)
      .addScaledVector(nHead.up, -0.16 - this.expression * 0.08)
      .addScaledVector(nHead.forward, 0.18);
    this.mouthGroup.quaternion.copy(nHead.quaternion);
    this.mouthGroup.rotateX(0.25);
  }
}
