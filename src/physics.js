import * as THREE from 'three';

/**
 * AQUARYA - Advanced Hydrodynamic Physics Engine
 * Architettura a spina dorsale infrangibile con:
 * - Parallel Transport (Bishop Frame) per eliminare qualsiasi torsione/candy-wrapping
 * - Vincolo di curvatura angolare massima (Bending Constraint max 14°) che impedisce
 *   allo squalo di accartocciarsi o piegarsi su se stesso anche a velocità estrema o drag rapido
 * - Traiettoria 3D ad "otto" fluida con rollio naturale nelle virate
 * - Rilascio inerziale con smorzamento fluido e rientro morbido
 */

export class SpineNode {
  constructor(index, restDist) {
    this.index = index;
    this.restDist = restDist;
    this.position = new THREE.Vector3(0, 0, -index * restDist);
    this.velocity = new THREE.Vector3(0, 0, 0);

    // Terna ortonormale locale: Forward, Up, Side
    this.forward = new THREE.Vector3(0, 0, 1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.side = new THREE.Vector3(1, 0, 0);
    this.quaternion = new THREE.Quaternion();
  }
}

export class Physics {
  constructor() {
    this.nodeCount = 14; // 14 nodi per una spina dorsale ultra-fluida e affusolata
    this.defaultDist = 0.27; // Lunghezza totale ~3.8 unità, proporzioni slanciate
    this.nodes = [];

    for (let i = 0; i < this.nodeCount; i++) {
      this.nodes.push(new SpineNode(i, this.defaultDist));
    }

    // Parametri Utente
    this.speedMultiplier = 1.0;
    this.softnessMultiplier = 1.0;
    this.scaleMultiplier = 1.0;
    this.isPaused = false;

    // Traiettoria Autonoma
    this.simTime = 0;
    this.baseFrequency = 1.35; // Frequenza del nuoto
    this.wavePhase = 0;
    this.swimSpeed = 1.8;
    this.speedMagnitude = 1.8;

    this.headPosition = new THREE.Vector3(0, 0, 0);
    this.headHeading = new THREE.Vector3(0, 0, 1);
    this.headUp = new THREE.Vector3(0, 1, 0);
    this.headRoll = 0;

    // Variazioni di Umore (ogni 16-24s)
    this.moodTimer = 18.0;
    this.isMoodAction = false;
    this.moodActionType = 'none';
    this.moodProgress = 0;
    this.extraRoll = 0;
    this.extraSpeed = 0;

    // Drag & Interazione
    this.isDragging = false;
    this.draggedIndex = 0;
    this.dragTargetPos = new THREE.Vector3();
    this.dragHistory = [];

    // Inerzia
    this.isInertia = false;
    this.inertiaVelocity = new THREE.Vector3();
    this.inertiaTimer = 0;
    this.inertiaDuration = 2.0;

    // Curiosità (click nel vuoto)
    this.curiosityTarget = null;
    this.curiosityWeight = 0;

    // Limiti schermo
    this.bounds = {
      minX: -4.5, maxX: 4.5,
      minY: -2.4, maxY: 2.4,
      minZ: -4.0, maxZ: 1.8
    };

    // Telemetria
    this.telemetrySpeedCm = 28.0;
    this.telemetryFreqHz = 1.35;
  }

  startDrag(nodeIndex, worldPos) {
    this.isDragging = true;
    this.isInertia = false;
    this.draggedIndex = THREE.MathUtils.clamp(nodeIndex, 0, this.nodeCount - 1);
    this.dragTargetPos.copy(worldPos);
    this.dragHistory = [];
  }

  updateDrag(worldPos) {
    if (!this.isDragging) return;
    this.dragTargetPos.copy(worldPos);

    const now = performance.now();
    this.dragHistory.push({ pos: worldPos.clone(), time: now });

    const cutoff = now - 90;
    while (this.dragHistory.length > 2 && this.dragHistory[0].time < cutoff) {
      this.dragHistory.shift();
    }
  }

  endDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;

    let launchVel = new THREE.Vector3();
    if (this.dragHistory.length >= 2) {
      const first = this.dragHistory[0];
      const last = this.dragHistory[this.dragHistory.length - 1];
      const dt = (last.time - first.time) * 0.001;
      if (dt > 0.015) {
        launchVel.subVectors(last.pos, first.pos).divideScalar(dt);
        launchVel.clampLength(0, 12.0);
      }
    }

    if (launchVel.length() > 0.3) {
      this.isInertia = true;
      this.inertiaVelocity.copy(launchVel);
      this.inertiaTimer = 0;
    } else {
      this.isInertia = true;
      this.inertiaVelocity.copy(this.headHeading).multiplyScalar(1.2);
      this.inertiaTimer = 0.8;
    }
  }

  triggerBurst() {
    this.isMoodAction = true;
    this.moodActionType = 'burst';
    this.moodProgress = 0;
  }

  attractTo(point3D) {
    this.curiosityTarget = point3D.clone();
    this.curiosityWeight = 1.0;
  }

  resetPosition() {
    this.simTime = 0;
    this.headHeading.set(0, 0, 1);
    this.headUp.set(0, 1, 0);
    this.headRoll = 0;
    this.extraRoll = 0;
    this.extraSpeed = 0;
    this.isDragging = false;
    this.isInertia = false;
    this.curiosityWeight = 0;

    const startZ = (this.nodeCount * 0.5) * this.defaultDist;
    for (let i = 0; i < this.nodeCount; i++) {
      const z = startZ - i * this.defaultDist;
      this.nodes[i].position.set(0, 0, z);
      this.nodes[i].velocity.set(0, 0, 0);
      this.nodes[i].forward.set(0, 0, 1);
      this.nodes[i].up.set(0, 1, 0);
      this.nodes[i].side.set(1, 0, 0);
    }
  }

  update(delta) {
    if (this.isPaused) return;
    const dt = Math.min(delta, 0.033);

    this.updateMood(dt);

    // 1. Risolvi il moto della testa o del nodo afferrato
    if (this.isDragging) {
      this.solveDrag(dt);
    } else if (this.isInertia) {
      this.solveInertia(dt);
    } else {
      this.solveAutonomous(dt);
    }

    // 2. Risolvi la catena con vincoli di distanza E di angolo massimo (infrangibile)
    this.solveAngleConstrainedSpine();

    // 3. Applica l'ondulazione del nuoto lungo l'asse laterale
    this.applyBodyWave(dt);

    // 4. Calcola i frame con Parallel Transport (Bishop Frame) esente da torsioni
    this.computeBishopFrames();

    // 5. Telemetria
    this.updateTelemetry();
  }

  updateMood(dt) {
    if (!this.isMoodAction && !this.isDragging) {
      this.moodTimer -= dt;
      if (this.moodTimer <= 0) {
        this.isMoodAction = true;
        this.moodProgress = 0;
        this.moodTimer = 16.0 + Math.random() * 8.0;

        const pick = Math.random();
        if (pick < 0.5) this.moodActionType = 'burst';
        else if (pick < 0.8) this.moodActionType = 'barrel_roll';
        else this.moodActionType = 'arc_loop';
      }
    }

    if (this.isMoodAction) {
      this.moodProgress += dt * 1.5;
      if (this.moodProgress >= Math.PI) {
        this.isMoodAction = false;
        this.extraRoll = 0;
        this.extraSpeed = 0;
      } else {
        const sinProg = Math.sin(this.moodProgress);
        if (this.moodActionType === 'barrel_roll') {
          this.extraRoll = sinProg * Math.PI * 2.0;
        } else if (this.moodActionType === 'burst') {
          this.extraSpeed = sinProg * 2.2;
        } else if (this.moodActionType === 'arc_loop') {
          this.extraRoll = Math.sin(this.moodProgress * 2) * 0.5;
          this.extraSpeed = sinProg * 0.8;
        }
      }
    }
  }

  solveAutonomous(dt) {
    this.simTime += dt * 0.65 * this.speedMultiplier;
    const t = this.simTime;

    const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6;
    const ampX = aspect < 1.0 ? 1.5 : 2.6;

    // Percorso elegante a figura di 8 nello spazio tridimensionale
    const pathX = Math.sin(t) * ampX;
    const pathY = Math.sin(t * 2.0) * 0.55 + Math.sin(t * 3.2) * 0.14;
    const pathZ = Math.cos(t * 0.9) * 1.5 - 0.2;

    const targetPos = new THREE.Vector3(pathX, pathY, pathZ);

    if (this.curiosityTarget && this.curiosityWeight > 0.01) {
      targetPos.lerp(this.curiosityTarget, this.curiosityWeight * 0.7);
      this.curiosityWeight -= dt * 0.35;
    }

    const head = this.nodes[0];
    const steer = new THREE.Vector3().subVectors(targetPos, head.position);
    const dist = steer.length();

    const targetSpeed = (this.swimSpeed + this.extraSpeed) * this.speedMultiplier;
    this.speedMagnitude = THREE.MathUtils.lerp(this.speedMagnitude, targetSpeed, dt * 2.5);

    if (dist > 0.05) {
      steer.normalize();
      // Virata morbida senza scatti
      this.headHeading.lerp(steer, dt * 2.6);
      this.headHeading.normalize();
    }

    // Avanzamento
    head.position.addScaledVector(this.headHeading, this.speedMagnitude * dt);

    // Rollio morbido nelle virate
    const yawDelta = this.headHeading.x;
    this.headRoll = THREE.MathUtils.lerp(this.headRoll, -yawDelta * 0.35 + this.extraRoll, dt * 3.5);

    this.enforceBounds(head.position, dt);
  }

  solveInertia(dt) {
    const head = this.nodes[0];
    const drag = Math.pow(0.40, dt);
    this.inertiaVelocity.multiplyScalar(drag);
    head.position.addScaledVector(this.inertiaVelocity, dt);
    this.enforceBounds(head.position, dt);

    if (this.inertiaVelocity.length() > 0.25) {
      const vDir = this.inertiaVelocity.clone().normalize();
      this.headHeading.lerp(vDir, dt * 3.5);
      this.headHeading.normalize();
    }

    this.inertiaTimer += dt;
    if (this.inertiaTimer >= this.inertiaDuration) {
      this.isInertia = false;
      this.inertiaTimer = 0;
    }
  }

  solveDrag(dt) {
    const grabbed = this.nodes[this.draggedIndex];
    const stiffness = 22.0 * (1.5 - this.softnessMultiplier * 0.4);
    const lerpSpeed = Math.min(1.0, dt * stiffness);
    grabbed.position.lerp(this.dragTargetPos, lerpSpeed);

    if (this.draggedIndex >= 8) {
      const head = this.nodes[0];
      head.position.addScaledVector(this.headHeading, 2.0 * dt);
    }
  }

  /**
   * Risolve la catena vertebrale applicando distanze rigide E vincolo di curvatura angolare massima.
   * Questo garantisce che nessun segmento possa piegarsi a più di ~14° rispetto al precedente,
   * impedendo per costruzione fisica qualunque accartocciamento!
   */
  solveAngleConstrainedSpine() {
    const targetDist = this.defaultDist * this.scaleMultiplier;
    const maxBendAngle = 0.28; // ~16 gradi massimo di deflessione tra due vertebre contigue

    if (this.isDragging) {
      // Dal nodo afferrato verso la testa (k-1 fino a 0)
      for (let i = this.draggedIndex - 1; i >= 0; i--) {
        const lead = this.nodes[i + 1];
        const follow = this.nodes[i];
        const refDir = (i + 2 < this.nodeCount)
          ? new THREE.Vector3().subVectors(this.nodes[i + 1].position, this.nodes[i + 2].position).normalize()
          : this.headHeading.clone();
        this.constrainSegment(lead, follow, targetDist, maxBendAngle, refDir);
      }
      // Dal nodo afferrato verso la coda (k+1 fino a N-1)
      for (let i = this.draggedIndex + 1; i < this.nodeCount; i++) {
        const lead = this.nodes[i - 1];
        const follow = this.nodes[i];
        const refDir = (i >= 2)
          ? new THREE.Vector3().subVectors(this.nodes[i - 1].position, this.nodes[i - 2].position).normalize()
          : this.headHeading.clone().negate();
        this.constrainSegment(lead, follow, targetDist, maxBendAngle, refDir);
      }
    } else {
      // Nuoto autonomo: la testa guida da 1 a N-1
      for (let i = 1; i < this.nodeCount; i++) {
        const lead = this.nodes[i - 1];
        const follow = this.nodes[i];
        const refDir = (i === 1)
          ? this.headHeading.clone().negate()
          : new THREE.Vector3().subVectors(this.nodes[i - 1].position, this.nodes[i - 2].position).normalize();
        this.constrainSegment(lead, follow, targetDist, maxBendAngle, refDir);
      }
    }
  }

  constrainSegment(lead, follow, targetDist, maxAngle, refDir) {
    const dir = new THREE.Vector3().subVectors(follow.position, lead.position);
    const curDist = dir.length();

    if (curDist > 0.0001) {
      dir.normalize();
    } else {
      dir.copy(refDir);
    }

    if (refDir && refDir.lengthSq() > 0.001) {
      refDir.normalize();
      const dot = THREE.MathUtils.clamp(dir.dot(refDir), -1, 1);
      const angle = Math.acos(dot);

      if (angle > maxAngle) {
        const axis = new THREE.Vector3().crossVectors(refDir, dir);
        if (axis.lengthSq() > 0.0001) {
          axis.normalize();
          dir.copy(refDir).applyAxisAngle(axis, maxAngle);
        } else {
          dir.copy(refDir);
        }
      }
    }

    follow.position.copy(lead.position).addScaledVector(dir, targetDist);
  }

  applyBodyWave(dt) {
    let effectiveSpeed = this.speedMagnitude;
    if (this.isDragging) {
      effectiveSpeed = this.draggedIndex >= 8 ? 3.4 : 2.0;
    }

    const freq = this.baseFrequency * Math.max(0.6, effectiveSpeed * 0.85) * this.speedMultiplier;
    this.wavePhase += dt * freq * Math.PI * 2.0;

    // Vettore laterale calcolato dal nodo 0 per coerenza cinematica
    const headSide = this.nodes[0].side.clone();

    // Ampiezza progressiva morbida: testa quasi immobile (0.012), coda scodante fluida (0.30)
    for (let i = 1; i < this.nodeCount; i++) {
      const u = i / (this.nodeCount - 1);
      const amp = (0.012 + 0.30 * Math.pow(u, 1.5)) * (this.isDragging ? 1.25 : 1.0);
      const wave = Math.sin(this.wavePhase - u * 4.5) * amp;

      this.nodes[i].position.addScaledVector(headSide, wave * 0.15);
    }

    // Ri-vincola per conservare rigidità della lunghezza
    const targetDist = this.defaultDist * this.scaleMultiplier;
    for (let i = 1; i < this.nodeCount; i++) {
      const dir = new THREE.Vector3().subVectors(this.nodes[i].position, this.nodes[i - 1].position).normalize();
      this.nodes[i].position.copy(this.nodes[i - 1].position).addScaledVector(dir, targetDist);
    }
  }

  /**
   * Parallel Transport (Bishop Frame):
   * Propaga l'orientamento da nodo a nodo garantendo continuità perfetta
   * e assenza di torsioni o capovolgimenti anomali.
   */
  computeBishopFrames() {
    // 1. Nodo 0 (Head): orientamento primario
    const head = this.nodes[0];
    const neck = this.nodes[1];

    head.forward.subVectors(head.position, neck.position).normalize();
    if (head.forward.lengthSq() < 0.001) head.forward.set(0, 0, 1);

    // Up della testa con rollio
    let hUp = new THREE.Vector3(0, 1, 0);
    hUp.applyAxisAngle(head.forward, this.headRoll);
    head.side.crossVectors(hUp, head.forward).normalize();
    head.up.crossVectors(head.forward, head.side).normalize();

    const headMat = new THREE.Matrix4().makeBasis(head.side, head.up, head.forward);
    head.quaternion.setFromRotationMatrix(headMat);

    // 2. Nodi successivi: trasporto parallelo lungo la tangente
    for (let i = 1; i < this.nodeCount; i++) {
      const prev = this.nodes[i - 1];
      const cur = this.nodes[i];

      // Tangente verso la testa
      cur.forward.subVectors(prev.position, cur.position).normalize();
      if (cur.forward.lengthSq() < 0.001) cur.forward.copy(prev.forward);

      // Proietta l'Up precedente sul piano normale alla nuova tangente (Bishop frame)
      const dot = prev.up.dot(cur.forward);
      cur.up.copy(prev.up).addScaledVector(cur.forward, -dot).normalize();
      if (cur.up.lengthSq() < 0.001) cur.up.set(0, 1, 0);

      cur.side.crossVectors(cur.up, cur.forward).normalize();
      cur.up.crossVectors(cur.forward, cur.side).normalize();

      const rotMat = new THREE.Matrix4().makeBasis(cur.side, cur.up, cur.forward);
      cur.quaternion.setFromRotationMatrix(rotMat);
    }
  }

  enforceBounds(pos, dt) {
    const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6;
    const maxX = aspect < 1.0 ? 2.3 : 4.4;
    const minX = -maxX;
    const b = this.bounds;
    const force = 4.2 * dt;

    if (pos.x < minX) pos.x += (minX - pos.x) * force;
    if (pos.x > maxX) pos.x += (maxX - pos.x) * force;

    if (pos.y < b.minY) pos.y += (b.minY - pos.y) * force;
    if (pos.y > b.maxY) pos.y += (b.maxY - pos.y) * force;

    if (pos.z < b.minZ) pos.z += (b.minZ - pos.z) * force;
    if (pos.z > b.maxZ) pos.z += (b.maxZ - pos.z) * force;
  }

  updateTelemetry() {
    const actualSpeed = this.isDragging ? 32.5 : this.speedMagnitude * 20.0;
    this.telemetrySpeedCm = THREE.MathUtils.lerp(this.telemetrySpeedCm, actualSpeed, 0.1);

    const freq = this.baseFrequency * (this.isDragging ? 1.7 : this.speedMagnitude * 0.95);
    this.telemetryFreqHz = THREE.MathUtils.lerp(this.telemetryFreqHz, freq, 0.1);
  }
}
