import * as THREE from 'three';

/**
 * AQUARYA - Stylized 3D Aerodynamic Shark
 * Design maturo, elegante e sofisticato (qualità da portfolio Awwwards / Pixar studio):
 * - Sagoma a siluro idrodinamica slanciata (lunghezza 3.8, sezione 0.50, rapporto ~4.8:1)
 * - Muso scolpito affusolato, fessure branchiali stilizzate, cresta dorsale sottile
 * - Pinne ad ala swept-back da predatore (pettorali affilate a hydrofoil, dorsale raked, coda eterocerca)
 * - Occhi a mandorla perfettamente incassati nella testa (non sporgenti), sguardo intelligente e attento
 * - Mascella stilizzata con dentellatura sottile pulita a filo della pancia
 * - Countershading oceanico con transizione morbida sulla linea laterale
 * - Outline sottilissimo blu notte per risaltare la silhouette
 */

export const PALETTES = {
  ocean: {
    name: 'Oceano Celeste',
    primary: new THREE.Color(0x568DEF),   // Dorso blu-ardesia/azzurro vivo (#5B8DEF)
    accent: new THREE.Color(0x3B6EC2),    // Finitura pinne
    belly: new THREE.Color(0xFFFEF8),     // Pancia bianco-crema calda
    outline: new THREE.Color(0x1B3456)    // Contorno notte elegante
  },
  coral: {
    name: 'Corallo Solare',
    primary: new THREE.Color(0xEE6E65),   // Corallo pastello luminoso
    accent: new THREE.Color(0xBF4B43),
    belly: new THREE.Color(0xFFF9F4),
    outline: new THREE.Color(0x421917)
  },
  mint: {
    name: 'Menta Giada',
    primary: new THREE.Color(0x43B692),   // Smeraldo / menta salvia fresco
    accent: new THREE.Color(0x288768),
    belly: new THREE.Color(0xF2FAF6),
    outline: new THREE.Color(0x123628)
  }
};

function createToonGradientMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  // Gradient steps neutri luminosi per cel-shading morbido (stile Pixar/Nintendo)
  const steps = [140, 185, 230, 255];
  steps.forEach((val, i) => {
    ctx.fillStyle = `rgb(${val}, ${val}, ${val})`;
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
    this.expression = 0;
    this.targetExpression = 0;
    this.blinkTimer = 3.5;
    this.isBlinking = false;
    this.blinkProgress = 0;

    // Sguardo
    this.eyeTarget = new THREE.Vector3(0, 0, 10);
    this.currentEyeLook = new THREE.Vector2(0, 0);

    // Scala complessiva per proporzioni da portfolio (1/3 larghezza desktop)
    this.baseScale = 0.92;
    this.group.scale.setScalar(this.baseScale);

    this.slices = 28;
    this.radial = 32;

    this.buildBodyMesh();
    this.buildFins();
    this.buildFace();
    this.buildSkeletonDebug();
  }

  /**
   * Profilo idrodinamico slanciato e potente (u da 0 a 1)
   */
  getBodyProfile(u) {
    let rx, ry, cy;

    if (u < 0.22) {
      // Muso affusolato aerodinamico
      const t = u / 0.22;
      const s = Math.sin((t * Math.PI) / 2);
      rx = 0.50 * Math.pow(s, 0.72);
      ry = 0.38 * Math.pow(s, 0.72);
      cy = 0.03 * (1 - t);
    } else if (u < 0.55) {
      // Torace possente idrodinamico
      const t = (u - 0.22) / 0.33;
      rx = THREE.MathUtils.lerp(0.50, 0.44, t);
      ry = THREE.MathUtils.lerp(0.38, 0.42, t);
      cy = 0.01 * (1 - t);
    } else if (u < 0.85) {
      // Addome e peduncolo caudale
      const t = (u - 0.55) / 0.30;
      rx = THREE.MathUtils.lerp(0.44, 0.16, Math.pow(t, 0.85));
      ry = THREE.MathUtils.lerp(0.42, 0.20, Math.pow(t, 0.85));
      cy = 0.0;
    } else {
      // Attacco coda sottile
      const t = (u - 0.85) / 0.15;
      rx = THREE.MathUtils.lerp(0.16, 0.05, Math.pow(t, 0.9));
      ry = THREE.MathUtils.lerp(0.20, 0.08, Math.pow(t, 0.9));
      cy = 0.0;
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

        // Countershading naturale: dorso scuro, pancia chiara
        const dorsalFactor = THREE.MathUtils.smoothstep(sinT, -0.15, 0.15);
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
        // Winding orario per normali orientate correttamente all'esterno
        indices.push(a, d, b);
        indices.push(b, d, c);
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

    // Outline inverted hull ultra-sottile e preciso
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

    // 1. PINNA DORSALE: Sagoma fiera e slanciata con bordo raked elegante
    // Shape definita su piano XY: +X = verso muso (+Z 3D), -X = verso coda (-Z 3D), +Y = altezza (+Y 3D)
    const dShape = new THREE.Shape();
    dShape.moveTo(0.24, 0.0);
    dShape.quadraticCurveTo(0.12, 0.35, -0.06, 0.65); // leading edge swept back
    dShape.quadraticCurveTo(-0.10, 0.69, -0.14, 0.63); // apice morbido
    dShape.quadraticCurveTo(-0.11, 0.28, -0.22, 0.0); // trailing notch
    dShape.lineTo(0.24, 0.0);

    const dGeo = new THREE.ExtrudeGeometry(dShape, {
      steps: 1, depth: 0.038, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 3
    });
    dGeo.translate(0, 0, -0.019); // centra lo spessore
    dGeo.rotateY(-Math.PI / 2);    // allinea +X a +Z (avanti), -X a -Z (dietro), +Y a +Y (alto)
    dGeo.computeVertexNormals();

    this.dorsalFin = new THREE.Mesh(dGeo, this.dorsalMat);
    const dOutline = new THREE.Mesh(dGeo, this.finOutlineMat);
    dOutline.scale.set(1.04, 1.04, 1.04);
    this.dorsalFin.add(dOutline);
    this.group.add(this.dorsalFin);

    // 2. PINNA CAUDALE (CODA a mezzaluna eterocerca aerodinamica)
    const tShape = new THREE.Shape();
    tShape.moveTo(0.12, 0.0);
    tShape.quadraticCurveTo(0.02, 0.30, -0.36, 0.72); // lobo superiore dominante
    tShape.quadraticCurveTo(-0.43, 0.77, -0.40, 0.68);
    tShape.quadraticCurveTo(-0.25, 0.30, -0.10, 0.04); // incisura caudale
    tShape.quadraticCurveTo(-0.22, -0.20, -0.32, -0.42); // lobo inferiore
    tShape.quadraticCurveTo(-0.36, -0.47, -0.30, -0.42);
    tShape.quadraticCurveTo(-0.10, -0.14, 0.12, 0.0);

    const tGeo = new THREE.ExtrudeGeometry(tShape, {
      steps: 1, depth: 0.036, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 3
    });
    tGeo.translate(0, 0, -0.018);
    tGeo.rotateY(-Math.PI / 2);
    tGeo.computeVertexNormals();

    this.caudalFin = new THREE.Mesh(tGeo, this.dorsalMat);
    const tOutline = new THREE.Mesh(tGeo, this.finOutlineMat);
    tOutline.scale.set(1.04, 1.04, 1.04);
    this.caudalFin.add(tOutline);
    this.group.add(this.caudalFin);

    // 3. PINNE PETTORALI (Ali hydrofoil swept-back da predatore)
    // Geometria ala Destra (+Side):
    const pShapeRight = new THREE.Shape();
    pShapeRight.moveTo(0.0, 0.06);
    pShapeRight.quadraticCurveTo(0.28, 0.02, 0.68, -0.24); // leading edge swept-back
    pShapeRight.quadraticCurveTo(0.74, -0.29, 0.68, -0.34); // punta affilata
    pShapeRight.quadraticCurveTo(0.32, -0.24, 0.0, -0.14); // trailing edge
    pShapeRight.lineTo(0.0, 0.06);

    const extrudeOpts = {
      steps: 1, depth: 0.032, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3
    };

    const pGeoRight = new THREE.ExtrudeGeometry(pShapeRight, extrudeOpts);
    pGeoRight.translate(0, 0, -0.016);
    pGeoRight.rotateX(-Math.PI / 2);
    pGeoRight.rotateZ(-0.14); // inclinazione diedro verso il basso
    pGeoRight.computeVertexNormals();

    // Pinna Sinistra (-Side): forma simmetrica nativa verso sinistra
    const pShapeLeft = new THREE.Shape();
    pShapeLeft.moveTo(0.0, 0.06);
    pShapeLeft.quadraticCurveTo(-0.28, 0.02, -0.68, -0.24); // leading edge verso -X e -Z
    pShapeLeft.quadraticCurveTo(-0.74, -0.29, -0.68, -0.34);
    pShapeLeft.quadraticCurveTo(-0.32, -0.24, 0.0, -0.14);
    pShapeLeft.lineTo(0.0, 0.06);

    const pGeoLeft = new THREE.ExtrudeGeometry(pShapeLeft, extrudeOpts);
    pGeoLeft.translate(0, 0, -0.016);
    pGeoLeft.rotateX(-Math.PI / 2);
    pGeoLeft.rotateZ(0.14); // simmetrico diedro verso il basso
    pGeoLeft.computeVertexNormals();

    // Pinna Destra (+Side)
    this.rightPectGroup = new THREE.Group();
    const rMesh = new THREE.Mesh(pGeoRight, this.dorsalMat);
    const rOut = new THREE.Mesh(pGeoRight, this.finOutlineMat);
    rOut.scale.set(1.04, 1.04, 1.04);
    rMesh.add(rOut);
    this.rightPectGroup.add(rMesh);
    this.group.add(this.rightPectGroup);

    // Pinna Sinistra (-Side)
    this.leftPectGroup = new THREE.Group();
    const lMesh = new THREE.Mesh(pGeoLeft, this.dorsalMat);
    const lOut = new THREE.Mesh(pGeoLeft, this.finOutlineMat);
    lOut.scale.set(1.04, 1.04, 1.04);
    lMesh.add(lOut);
    this.leftPectGroup.add(lMesh);
    this.group.add(this.leftPectGroup);

    // 4. PINNA DORSALE SECONDARIA / ADIPOSA (sul nodo 10)
    const miniDShape = new THREE.Shape();
    miniDShape.moveTo(0.08, 0.0);
    miniDShape.quadraticCurveTo(0.03, 0.12, -0.04, 0.18);
    miniDShape.quadraticCurveTo(-0.06, 0.20, -0.08, 0.16);
    miniDShape.quadraticCurveTo(-0.05, 0.06, -0.08, 0.0);
    miniDShape.lineTo(0.08, 0.0);

    const miniDGeo = new THREE.ExtrudeGeometry(miniDShape, {
      steps: 1, depth: 0.024, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2
    });
    miniDGeo.translate(0, 0, -0.012);
    miniDGeo.rotateY(-Math.PI / 2);
    miniDGeo.computeVertexNormals();

    this.miniDorsal = new THREE.Mesh(miniDGeo, this.dorsalMat);
    this.group.add(this.miniDorsal);
  }

  buildFace() {
    this.faceGroup = new THREE.Group();
    this.group.add(this.faceGroup);

    const eyeBaseMat = new THREE.MeshBasicMaterial({ color: 0x111620 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x060910 });
    const irisGlintMat = new THREE.MeshBasicMaterial({ color: 0xEDF6FF });
    const toothMat = new THREE.MeshBasicMaterial({ color: 0xFCFEFF });
    const jawMat = new THREE.MeshBasicMaterial({ color: 0x1A2535 });

    // 1. OCCHI A MANDORLA INCASSATI NELLA TESTA (Design elegante e vivo)
    const eyeRadius = 0.092;
    const eyeGeo = new THREE.SphereGeometry(eyeRadius, 18, 18);
    eyeGeo.scale(1.20, 0.85, 0.90);

    const createEye = () => {
      const eyeRoot = new THREE.Group();

      const eyeBase = new THREE.Mesh(eyeGeo, eyeBaseMat);
      eyeRoot.add(eyeBase);

      const irisGroup = new THREE.Group();
      irisGroup.position.set(0, 0, eyeRadius * 0.70);

      // Pupilla a fessura/ovale elegante
      const pupilGeo = new THREE.SphereGeometry(0.062, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.45);
      pupilGeo.scale(0.85, 1.20, 1.0);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.rotation.x = Math.PI / 2;
      irisGroup.add(pupil);

      // Riflesso di luce
      const glintGeo = new THREE.SphereGeometry(0.022, 8, 8);
      const glint = new THREE.Mesh(glintGeo, irisGlintMat);
      glint.position.set(0.026, 0.026, 0.04);
      irisGroup.add(glint);

      eyeRoot.add(irisGroup);

      // Palpebra superiore
      const lidGeo = new THREE.SphereGeometry(eyeRadius * 1.04, 16, 14, 0, Math.PI * 2, 0, Math.PI / 2);
      lidGeo.scale(1.22, 0.87, 0.92);
      this.lidMat = new THREE.MeshToonMaterial({
        color: this.palette.primary,
        gradientMap: this.toonGradientMap
      });
      const eyelid = new THREE.Mesh(lidGeo, this.lidMat);
      eyelid.rotation.x = -Math.PI / 2;
      eyeRoot.add(eyelid);

      const eOutline = new THREE.Mesh(eyeGeo, this.finOutlineMat);
      eOutline.scale.set(1.04, 1.04, 1.04);
      eyeRoot.add(eOutline);

      return { eyeRoot, irisGroup, eyelid };
    };

    this.rightEye = createEye();
    this.faceGroup.add(this.rightEye.eyeRoot);

    this.leftEye = createEye();
    this.faceGroup.add(this.leftEye.eyeRoot);

    // 2. GUANCE ROSA SOFT (Blush delicato per dare calore e tenerezza)
    const blushGeo = new THREE.CircleGeometry(0.065, 16);
    const blushMat = new THREE.MeshBasicMaterial({
      color: 0xFFA090,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    this.rightCheek = new THREE.Mesh(blushGeo, blushMat);
    this.leftCheek = new THREE.Mesh(blushGeo, blushMat);
    this.faceGroup.add(this.rightCheek);
    this.faceGroup.add(this.leftCheek);

    // 3. MASCELLA VENTRALE A FILO CON DENTELLATURA SOTTILE
    this.mouthGroup = new THREE.Group();

    const jawCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.14, 0.01, -0.04),
      new THREE.Vector3(-0.08, -0.01, 0.04),
      new THREE.Vector3(0.0, -0.018, 0.06),
      new THREE.Vector3(0.08, -0.01, 0.04),
      new THREE.Vector3(0.14, 0.01, -0.04)
    ]);
    const jawGeo = new THREE.TubeGeometry(jawCurve, 16, 0.014, 6, false);
    this.jawMesh = new THREE.Mesh(jawGeo, jawMat);
    this.mouthGroup.add(this.jawMesh);

    // 2 piccoli dentini triangolari puliti
    const toothGeo = new THREE.ConeGeometry(0.018, 0.035, 6);
    toothGeo.rotateX(Math.PI);

    const t1 = new THREE.Mesh(toothGeo, toothMat);
    t1.position.set(-0.04, -0.012, 0.045);
    this.mouthGroup.add(t1);

    const t2 = new THREE.Mesh(toothGeo, toothMat);
    t2.position.set(0.04, -0.012, 0.045);
    this.mouthGroup.add(t2);

    this.faceGroup.add(this.mouthGroup);
  }

  buildSkeletonDebug() {
    this.debugGroup = new THREE.Group();
    this.debugGroup.name = 'SkeletonDebug';
    this.debugGroup.visible = false;

    this.debugSpheres = [];
    const sphereGeo = new THREE.SphereGeometry(0.05, 10, 10);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x3388FF, wireframe: true });

    for (let i = 0; i < 14; i++) {
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

  update(delta, currentSpeed = 1.8, spineNodes = []) {
    // 1. Transizione colori palette
    if (this.paletteLerp < 1.0) {
      this.paletteLerp = Math.min(1.0, this.paletteLerp + delta * 3.0);
      this.palette.primary.lerp(this.targetPalette.primary, 0.15);
      this.palette.belly.lerp(this.targetPalette.belly, 0.15);
      this.palette.outline.lerp(this.targetPalette.outline, 0.15);

      this.dorsalMat.color.copy(this.palette.primary);
      this.outlineMaterial.color.copy(this.palette.outline);
      this.finOutlineMat.color.copy(this.palette.outline);
      if (this.lidMat) this.lidMat.color.copy(this.palette.primary);

      const cols = this.bodyGeo.attributes.color.array;
      let idx = 0;
      for (let i = 0; i <= this.slices; i++) {
        for (let j = 0; j <= this.radial; j++) {
          const theta = (j / this.radial) * Math.PI * 2;
          const sinT = Math.sin(theta);
          const dorsalFactor = THREE.MathUtils.smoothstep(sinT, -0.15, 0.15);
          const col = new THREE.Color().lerpColors(this.palette.belly, this.palette.primary, dorsalFactor);
          cols[idx * 3 + 0] = col.r;
          cols[idx * 3 + 1] = col.g;
          cols[idx * 3 + 2] = col.b;
          idx++;
        }
      }
      this.bodyGeo.attributes.color.needsUpdate = true;
    }

    // 2. Transizione espressione
    this.expression = THREE.MathUtils.lerp(this.expression, this.targetExpression, delta * 8.0);
    if (this.mouthGroup) {
      this.mouthGroup.scale.set(
        1.0 + this.expression * 0.15,
        1.0 + this.expression * 0.5,
        1.0
      );
    }

    // 3. Battito palpebre
    this.blinkTimer -= delta;
    if (this.blinkTimer <= 0) {
      this.isBlinking = true;
      this.blinkProgress = 0;
      this.blinkTimer = 3.5 + Math.random() * 3.0;
    }

    if (this.isBlinking) {
      this.blinkProgress += delta * 8.0;
      if (this.blinkProgress >= Math.PI) {
        this.isBlinking = false;
        this.blinkProgress = 0;
      }
      const lidAngle = -Math.PI / 2 + Math.sin(this.blinkProgress) * (Math.PI / 2);
      if (this.leftEye) this.leftEye.eyelid.rotation.x = lidAngle;
      if (this.rightEye) this.rightEye.eyelid.rotation.x = lidAngle;
    }

    // 4. Deformazione procedurale continua lungo la spina dorsale
    if (spineNodes && spineNodes.length >= 14) {
      this.deformBodyToSpine(spineNodes);
      this.alignFinsAndFaceToSpine(spineNodes);

      // Flutter idrodinamico delle pinne pettorali
      if (this.leftPectGroup && this.rightPectGroup) {
        const flutterFreq = 2.4 * Math.max(0.6, currentSpeed * 0.65);
        const flutterAngle = Math.sin(Date.now() * 0.001 * flutterFreq) * 0.08;
        this.rightPectGroup.rotateZ(flutterAngle);
        this.leftPectGroup.rotateZ(-flutterAngle);
      }

      if (this.debugGroup.visible) {
        for (let i = 0; i < 14; i++) {
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
    const outlineOffset = 0.020; // Outline ultra-sottile e preciso

    for (let i = 0; i <= this.slices; i++) {
      const u = i / this.slices;
      const { pos, fwd, up, side } = this.evalSpine(spineNodes, u);
      const { rx, ry, cy } = this.getBodyProfile(u);

      for (let j = 0; j <= this.radial; j++) {
        const theta = (j / this.radial) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        // Sezione idrodinamica: leggermente affilata sulla cresta dorsale
        const crestFactor = sinT > 0 ? (1.0 + Math.pow(sinT, 2.0) * 0.06) : 0.95;

        const vx = cosT * rx;
        const vy = (sinT * ry + cy) * crestFactor;

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
    // 1. PINNA DORSALE (sul nodo 5 - terzo anteriore del dorso)
    const nDorsal = spineNodes[5];
    this.dorsalFin.position.copy(nDorsal.position).addScaledVector(nDorsal.up, 0.38);
    this.dorsalFin.quaternion.copy(nDorsal.quaternion);

    // 2. PINNE PETTORALI (sul nodo 3 - torace, montate simmetriche a filo pelle)
    const nPect = spineNodes[3];
    // Ala Destra (+Side)
    this.rightPectGroup.position.copy(nPect.position)
      .addScaledVector(nPect.side, 0.44)
      .addScaledVector(nPect.up, -0.08);
    this.rightPectGroup.quaternion.copy(nPect.quaternion);

    // Ala Sinistra (-Side)
    this.leftPectGroup.position.copy(nPect.position)
      .addScaledVector(nPect.side, -0.44)
      .addScaledVector(nPect.up, -0.08);
    this.leftPectGroup.quaternion.copy(nPect.quaternion);

    // 3. PINNA ADIPOSA / DORSALE SECONDARIA (sul nodo 10)
    const nMiniD = spineNodes[10];
    this.miniDorsal.position.copy(nMiniD.position).addScaledVector(nMiniD.up, 0.16);
    this.miniDorsal.quaternion.copy(nMiniD.quaternion);

    // 4. PINNA CAUDALE (sull'ultimo nodo 13 - punta coda)
    const nTail = spineNodes[13];
    this.caudalFin.position.copy(nTail.position);
    this.caudalFin.quaternion.copy(nTail.quaternion);

    // 5. OCCHI INCASSATI NELLA TESTA (sul nodo 2, profilo laterale del cranio)
    const nHead = spineNodes[2];

    const eyeDistX = 0.42; // a filo della superficie laterale del cranio
    const eyeDistY = 0.06;
    const eyeDistZ = 0.10;

    // Occhio Destro (+Side)
    this.rightEye.eyeRoot.position.copy(nHead.position)
      .addScaledVector(nHead.side, eyeDistX)
      .addScaledVector(nHead.up, eyeDistY)
      .addScaledVector(nHead.forward, eyeDistZ);
    this.rightEye.eyeRoot.quaternion.copy(nHead.quaternion);
    this.rightEye.eyeRoot.rotateY(0.32);

    // Occhio Sinistro (-Side)
    this.leftEye.eyeRoot.position.copy(nHead.position)
      .addScaledVector(nHead.side, -eyeDistX)
      .addScaledVector(nHead.up, eyeDistY)
      .addScaledVector(nHead.forward, eyeDistZ);
    this.leftEye.eyeRoot.quaternion.copy(nHead.quaternion);
    this.leftEye.eyeRoot.rotateY(-0.32);

    // Sguardo orientato con precisione
    const toTarget = new THREE.Vector3().subVectors(this.eyeTarget, nHead.position).normalize();
    const lookX = THREE.MathUtils.clamp(toTarget.x * 0.35, -0.18, 0.18);
    const lookY = THREE.MathUtils.clamp(toTarget.y * 0.35, -0.14, 0.14);
    this.currentEyeLook.x = THREE.MathUtils.lerp(this.currentEyeLook.x, lookX, 0.15);
    this.currentEyeLook.y = THREE.MathUtils.lerp(this.currentEyeLook.y, lookY, 0.15);

    this.leftEye.irisGroup.rotation.y = this.currentEyeLook.x;
    this.leftEye.irisGroup.rotation.x = -this.currentEyeLook.y;
    this.rightEye.irisGroup.rotation.y = this.currentEyeLook.x;
    this.rightEye.irisGroup.rotation.x = -this.currentEyeLook.y;

    // Guance soft (blush delicato)
    if (this.rightCheek && this.leftCheek) {
      this.rightCheek.position.copy(nHead.position)
        .addScaledVector(nHead.side, eyeDistX + 0.02)
        .addScaledVector(nHead.up, -0.04)
        .addScaledVector(nHead.forward, 0.06);
      this.rightCheek.quaternion.copy(nHead.quaternion);
      this.rightCheek.rotateY(0.40);

      this.leftCheek.position.copy(nHead.position)
        .addScaledVector(nHead.side, -eyeDistX - 0.02)
        .addScaledVector(nHead.up, -0.04)
        .addScaledVector(nHead.forward, 0.06);
      this.leftCheek.quaternion.copy(nHead.quaternion);
      this.leftCheek.rotateY(-0.40);
    }

    // Mascella ventrale a filo con il muso (sul nodo 1)
    const nJaw = spineNodes[1];
    this.mouthGroup.position.copy(nJaw.position)
      .addScaledVector(nJaw.up, -0.13)
      .addScaledVector(nJaw.forward, 0.03);
    this.mouthGroup.quaternion.copy(nJaw.quaternion);
    this.mouthGroup.rotateX(0.10);
  }
}
