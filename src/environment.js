import * as THREE from 'three';

/**
 * AQUARYA - Environment ("Acquario d'Aria")
 * Atmosfera pastello, luminosa e sognante:
 * - Gradiente di sfondo aria/cielo pastello
 * - 450 particelle/pulviscoli con scia reattiva (wake deflection dal movimento dello squalo)
 * - Raggi di luce volumetrici soffusi e pulsanti
 * - Ombra morbida dinamica (blob shadow) sul pavimento immaginario
 * - Nuvolette/forme morbide di sfondo con parallasse
 * - Parallasse della camera su movimento puntatore
 */

export class Environment {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    
    this.baseCamPos = this.camera.position.clone();
    this.targetCamOffset = new THREE.Vector2(0, 0);
    this.currentCamOffset = new THREE.Vector2(0, 0);

    this.group = new THREE.Group();
    this.group.name = 'EnvironmentGroup';
    this.scene.add(this.group);

    this.initLights();
    this.initBackgroundDome();
    this.initAirMotes();
    this.initLightRays();
    this.initBlobShadow();
    this.initCloudPuffs();
  }

  initLights() {
    // Luce emisferica calda/cielo per un'illuminazione soffusa senza neri
    this.hemiLight = new THREE.HemisphereLight(0xD6ECFA, 0xFFEFE2, 0.95);
    this.scene.add(this.hemiLight);

    // Luce principale diffusa dal cielo (alto-sinistra-fronte)
    this.dirLight = new THREE.DirectionalLight(0xFFFFFF, 1.25);
    this.dirLight.position.set(4, 7, 5);
    this.dirLight.castShadow = true;
    this.scene.add(this.dirLight);

    // Luce di rim / controluce soffice (azzurro-chiaro dal retro per evidenziare i bordi)
    this.rimLight = new THREE.DirectionalLight(0xBEE4F8, 0.75);
    this.rimLight.position.set(-4, -2, -5);
    this.scene.add(this.rimLight);
  }

  initBackgroundDome() {
    // Sfondo gradiente verticale sognante (alto azzurro chiaro, basso crema/pesca pallido)
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#BFE2F7');  // Cielo chiaro superiore
    grad.addColorStop(0.45, '#E2EFF8'); // Fusione morbida
    grad.addColorStop(0.85, '#FFEFE4'); // Pesca/crema caldo
    grad.addColorStop(1.0, '#FFF5EC');  // Base luminosa

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 256);

    const bgTexture = new THREE.CanvasTexture(canvas);
    bgTexture.generateMipmaps = false;
    bgTexture.minFilter = THREE.LinearFilter;

    // Grande piano di sfondo posizionato a Z = -16
    const bgGeo = new THREE.PlaneGeometry(36, 24);
    const bgMat = new THREE.MeshBasicMaterial({
      map: bgTexture,
      depthWrite: false
    });

    this.bgMesh = new THREE.Mesh(bgGeo, bgMat);
    this.bgMesh.position.set(0, 0, -14);
    this.group.add(this.bgMesh);
  }

  initAirMotes() {
    // 450 particelle/pulviscoli d'aria sospesi
    this.moteCount = 450;
    this.motePositions = new Float32Array(this.moteCount * 3);
    this.moteVelocities = [];
    this.moteScales = new Float32Array(this.moteCount);

    // Texture circolare morbida generata proceduralmente
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext('2d');
    const pGrad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
    pGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    pGrad.addColorStop(0.5, 'rgba(210, 235, 255, 0.45)');
    pGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    pCtx.fillStyle = pGrad;
    pCtx.fillRect(0, 0, 32, 32);

    const moteTexture = new THREE.CanvasTexture(pCanvas);

    for (let i = 0; i < this.moteCount; i++) {
      this.motePositions[i * 3 + 0] = (Math.random() - 0.5) * 14.0;
      this.motePositions[i * 3 + 1] = (Math.random() - 0.5) * 9.0;
      this.motePositions[i * 3 + 2] = (Math.random() - 0.5) * 10.0 - 1.0;

      this.moteVelocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.05,
        0.08 + Math.random() * 0.12, // salita lenta naturale
        (Math.random() - 0.5) * 0.05
      ));

      this.moteScales[i] = 0.08 + Math.random() * 0.16;
    }

    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(this.motePositions, 3));
    moteGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.moteCount * 2), 2));

    this.moteMat = new THREE.PointsMaterial({
      size: 0.18,
      map: moteTexture,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.motePoints = new THREE.Points(moteGeo, this.moteMat);
    this.group.add(this.motePoints);
  }

  initLightRays() {
    // 3 fasci volumetrici diagonali soffusi (raggi di sole nell'aria)
    this.lightRays = [];
    const rayGeo = new THREE.PlaneGeometry(1.6, 14.0);

    // Texture gradiente sfumato per i raggi
    const rCanvas = document.createElement('canvas');
    rCanvas.width = 64;
    rCanvas.height = 128;
    const rCtx = rCanvas.getContext('2d');
    const rGrad = rCtx.createRadialGradient(32, 64, 4, 32, 64, 60);
    rGrad.addColorStop(0, 'rgba(255, 252, 235, 0.22)');
    rGrad.addColorStop(0.6, 'rgba(240, 248, 255, 0.08)');
    rGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    rCtx.fillStyle = rGrad;
    rCtx.fillRect(0, 0, 64, 128);

    const rayTexture = new THREE.CanvasTexture(rCanvas);

    const rayAngles = [-0.48, -0.42, -0.52];
    const rayPositions = [
      new THREE.Vector3(-3.2, 2.5, -3.5),
      new THREE.Vector3(0.8, 3.2, -4.5),
      new THREE.Vector3(4.5, 2.8, -5.2)
    ];

    for (let i = 0; i < 3; i++) {
      const rayMat = new THREE.MeshBasicMaterial({
        map: rayTexture,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      const rayMesh = new THREE.Mesh(rayGeo, rayMat);
      rayMesh.position.copy(rayPositions[i]);
      rayMesh.rotation.z = rayAngles[i];
      rayMesh.scale.set(1.4 + i * 0.3, 1.2, 1.0);

      this.group.add(rayMesh);
      this.lightRays.push({ mesh: rayMesh, baseOpacity: 0.35 + i * 0.08, phase: i * 1.5 });
    }
  }

  initBlobShadow() {
    // Ombra morbida e sfocata sul piano immaginario in basso (Y = -3.2)
    const sCanvas = document.createElement('canvas');
    sCanvas.width = 128;
    sCanvas.height = 128;
    const sCtx = sCanvas.getContext('2d');

    const sGrad = sCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
    sGrad.addColorStop(0, 'rgba(42, 64, 96, 0.38)');
    sGrad.addColorStop(0.5, 'rgba(42, 64, 96, 0.16)');
    sGrad.addColorStop(1, 'rgba(42, 64, 96, 0.0)');

    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 128, 128);

    const shadowTexture = new THREE.CanvasTexture(sCanvas);

    const shadowGeo = new THREE.PlaneGeometry(3.2, 1.8);
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });

    this.shadowMesh = new THREE.Mesh(shadowGeo, this.shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.set(0, -3.2, 0);
    this.group.add(this.shadowMesh);
  }

  initCloudPuffs() {
    // 4 forme morbide sognanti sullo sfondo con lenta parallasse
    this.cloudPuffs = [];
    const puffGeo = new THREE.SphereGeometry(1.4, 20, 20);
    const puffMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.18,
      depthWrite: false
    });

    const puffConfigs = [
      { x: -5.5, y: 2.2, z: -10, sx: 2.4, sy: 1.2, sz: 1.0 },
      { x: 4.8, y: 1.5, z: -11, sx: 2.8, sy: 1.4, sz: 1.0 },
      { x: -2.2, y: -2.0, z: -9, sx: 3.2, sy: 1.6, sz: 1.0 },
      { x: 3.2, y: -2.4, z: -8.5, sx: 2.0, sy: 1.1, sz: 1.0 }
    ];

    for (const c of puffConfigs) {
      const puff = new THREE.Mesh(puffGeo, puffMat);
      puff.position.set(c.x, c.y, c.z);
      puff.scale.set(c.sx, c.sy, c.sz);
      this.group.add(puff);
      this.cloudPuffs.push({ mesh: puff, baseX: c.x, baseY: c.y, speed: 0.02 + Math.random() * 0.02 });
    }
  }

  // Riceve coordinate normalizzate del puntatore (-1 a +1) per la parallasse della camera
  setPointerParallax(normX, normY) {
    this.targetCamOffset.x = normX * 0.45;
    this.targetCamOffset.y = normY * 0.35;
  }

  update(time, delta, sharkNodes = []) {
    // 1. Parallasse morbida della camera (+- 2-3 gradi)
    this.currentCamOffset.lerp(this.targetCamOffset, delta * 2.8);
    this.camera.position.x = this.baseCamPos.x + this.currentCamOffset.x;
    this.camera.position.y = this.baseCamPos.y + this.currentCamOffset.y;
    this.camera.lookAt(0, 0, 0);

    // 2. Pulsazione lenta dei raggi di luce
    for (const ray of this.lightRays) {
      const pulse = Math.sin(time * 0.8 + ray.phase) * 0.08;
      ray.mesh.material.opacity = ray.baseOpacity + pulse;
    }

    // 3. Ombra morbida dinamica dello squalo
    if (sharkNodes.length > 0) {
      const head = sharkNodes[0].position;
      const mid = sharkNodes[Math.floor(sharkNodes.length / 2)].position;
      const tail = sharkNodes[sharkNodes.length - 1].position;

      // Posizione media X e Z
      const avgX = (head.x + mid.x + tail.x) / 3;
      const avgZ = (head.z + mid.z + tail.z) / 3;
      const altitude = Math.max(0.5, mid.y - (-3.2));

      this.shadowMesh.position.x = avgX;
      this.shadowMesh.position.z = avgZ;

      // Più è alto, più l'ombra si allarga e si sfuma
      const shadowScale = THREE.MathUtils.clamp(1.0 + altitude * 0.28, 0.8, 2.2);
      this.shadowMesh.scale.set(shadowScale, shadowScale * 0.75, 1.0);
      this.shadowMat.opacity = THREE.MathUtils.clamp(0.48 / (1.0 + altitude * 0.45), 0.1, 0.48);

      // Inclinazione dell'ombra con l'orientamento dello squalo
      const shadowDirX = head.x - tail.x;
      const shadowDirZ = head.z - tail.z;
      this.shadowMesh.rotation.z = Math.atan2(shadowDirX, shadowDirZ);
    }

    // 4. Aggiornamento particelle d'aria con scia reattiva (wake deflection)
    const posAttr = this.motePoints.geometry.attributes.position;
    const array = posAttr.array;

    for (let i = 0; i < this.moteCount; i++) {
      let px = array[i * 3 + 0];
      let py = array[i * 3 + 1];
      let pz = array[i * 3 + 2];

      const vel = this.moteVelocities[i];

      // Fluttuazione naturale con noise
      py += vel.y * delta;
      px += Math.sin(time * 0.5 + py * 0.8) * 0.015 * delta;
      pz += Math.cos(time * 0.4 + px * 0.8) * 0.015 * delta;

      // SCIA REATTIVA: Spostamento se vicini a qualsiasi segmento dello squalo
      for (let s = 0; s < sharkNodes.length; s += 2) {
        const sPos = sharkNodes[s].position;
        const dx = px - sPos.x;
        const dy = py - sPos.y;
        const dz = pz - sPos.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        // Raggio d'influenza scia: 1.1 unità
        if (distSq < 1.21 && distSq > 0.001) {
          const dist = Math.sqrt(distSq);
          const pushForce = (1.1 - dist) * 1.8 * delta;
          px += (dx / dist) * pushForce;
          py += (dy / dist) * pushForce;
          pz += (dz / dist) * pushForce;
        }
      }

      // Ricircolo continuo
      if (py > 5.5) py = -5.0;
      if (px > 8.0) px = -8.0;
      if (px < -8.0) px = 8.0;

      array[i * 3 + 0] = px;
      array[i * 3 + 1] = py;
      array[i * 3 + 2] = pz;
    }
    posAttr.needsUpdate = true;

    // 5. Parallasse nuvole lente sullo sfondo
    for (const cloud of this.cloudPuffs) {
      cloud.mesh.position.x = cloud.baseX + Math.sin(time * cloud.speed) * 0.6;
    }
  }
}
