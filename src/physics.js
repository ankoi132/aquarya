import * as THREE from 'three';

/**
 * AQUARYA - Physics Engine
 * Gestisce la spina dorsale a 12 nodi, la traiettoria autonoma tridimensionale,
 * l'ondulazione sinusoidale viaggiante, la cinematica inversa/diretta durante il drag
 * e il rilascio con inerzia naturale.
 */

export class SpineNode {
  constructor(index, restDist) {
    this.index = index;
    this.restDist = restDist;
    this.position = new THREE.Vector3(0, 0, -index * restDist);
    this.prevPosition = new THREE.Vector3(0, 0, -index * restDist);
    this.velocity = new THREE.Vector3(0, 0, 0);
    
    // Terna ortonormale locale: Forward (verso la testa), Up (dorso), Side (fianco destro)
    this.forward = new THREE.Vector3(0, 0, 1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.side = new THREE.Vector3(1, 0, 0);
    this.quaternion = new THREE.Quaternion();
  }
}

export class Physics {
  constructor() {
    this.nodeCount = 12;
    this.nodes = [];
    
    // Distanza a riposo tra i segmenti (lunghezza totale ~3.6 unità)
    this.defaultDist = 0.32;
    for (let i = 0; i < this.nodeCount; i++) {
      this.nodes.push(new SpineNode(i, this.defaultDist));
    }

    // Parametri Utente
    this.speedMultiplier = 1.0;
    this.softnessMultiplier = 1.0;
    this.scaleMultiplier = 1.0;
    this.isPaused = false;

    // Traiettoria Autonoma 3D (Lissajous / figure-8)
    this.simTime = 0;
    this.baseFrequency = 1.25; // Hz base per scodate
    this.wavePhase = 0;
    this.swimSpeed = 1.6;
    this.speedMagnitude = 1.6;
    
    this.headHeading = new THREE.Vector3(0, 0, 1);
    this.headUp = new THREE.Vector3(0, 1, 0);
    this.headRoll = 0;

    // Variazioni di Umore Spontanee (ogni 15-25s)
    this.moodTimer = 16.0;
    this.isMoodAction = false;
    this.moodActionType = 'none'; // 'burst', 'barrel_roll', 'arc_loop'
    this.moodProgress = 0;
    this.extraRoll = 0;
    this.extraSpeed = 0;

    // Interazione Drag
    this.isDragging = false;
    this.draggedIndex = 0;
    this.dragTargetPos = new THREE.Vector3();
    this.dragHistory = [];

    // Rilascio & Inerzia
    this.isInertia = false;
    this.inertiaVelocity = new THREE.Vector3();
    this.inertiaTimer = 0;
    this.inertiaDuration = 2.2;

    // Curiosità (click nel vuoto)
    this.curiosityTarget = null;
    this.curiosityWeight = 0;

    // Limiti schermo
    this.bounds = {
      minX: -4.8, maxX: 4.8,
      minY: -2.6, maxY: 2.6,
      minZ: -4.2, maxZ: 2.0
    };

    // Telemetria scientifica
    this.telemetrySpeedCm = 24.0;
    this.telemetryFreqHz = 1.25;
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

    // Mantieni ultimi ~90ms
    const cutoff = now - 90;
    while (this.dragHistory.length > 2 && this.dragHistory[0].time < cutoff) {
      this.dragHistory.shift();
    }
  }

  endDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;

    // Calcola velocità di lancio media
    let launchVel = new THREE.Vector3();
    if (this.dragHistory.length >= 2) {
      const first = this.dragHistory[0];
      const last = this.dragHistory[this.dragHistory.length - 1];
      const dt = (last.time - first.time) * 0.001;
      if (dt > 0.015) {
        launchVel.subVectors(last.pos, first.pos).divideScalar(dt);
        launchVel.clampLength(0, 14.0);
      }
    }

    if (launchVel.length() > 0.3) {
      this.isInertia = true;
      this.inertiaVelocity.copy(launchVel);
      this.inertiaTimer = 0;
    } else {
      this.isInertia = true;
      this.inertiaVelocity.copy(this.headHeading).multiplyScalar(1.2);
      this.inertiaTimer = 1.0;
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

    for (let i = 0; i < this.nodeCount; i++) {
      const z = (this.nodeCount * 0.5 - i) * this.defaultDist;
      this.nodes[i].position.set(0, 0, z);
      this.nodes[i].prevPosition.set(0, 0, z);
      this.nodes[i].velocity.set(0, 0, 0);
      this.nodes[i].forward.set(0, 0, 1);
      this.nodes[i].up.set(0, 1, 0);
      this.nodes[i].side.set(1, 0, 0);
    }
  }

  update(delta) {
    if (this.isPaused) return;
    const dt = Math.min(delta, 0.033);

    // Aggiornamento azioni di umore
    this.updateMood(dt);

    // 1. Risolvi il moto trainante (testa o punto afferrato)
    if (this.isDragging) {
      this.solveDrag(dt);
    } else if (this.isInertia) {
      this.solveInertia(dt);
    } else {
      this.solveAutonomous(dt);
    }

    // 2. Risolvi i vincoli di distanza rigidi della catena (Verlet relaxation)
    this.solveChainConstraints();

    // 3. Applica l'ondulazione sinusoidale (body wave)
    this.applyBodyWave(dt);

    // 4. Calcola la terna ortonormale di ogni segmento per l'allineamento della mesh
    this.computeFrames();

    // 5. Aggiorna telemetria
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
        if (pick < 0.45) this.moodActionType = 'burst';
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
          this.extraSpeed = sinProg * 2.4;
        } else if (this.moodActionType === 'arc_loop') {
          this.extraRoll = Math.sin(this.moodProgress * 2) * 0.7;
          this.extraSpeed = sinProg * 0.9;
        }
      }
    }
  }

  solveAutonomous(dt) {
    this.simTime += dt * 0.65 * this.speedMultiplier;
    const t = this.simTime;

    // Adatta l'ampiezza orizzontale in base alla proporzione dello schermo (desktop vs mobile)
    const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6;
    const ampX = aspect < 1.0 ? 1.5 : 2.7;

    // Traiettoria 3D ad "otto" / Lissajous con profondità e bobbing verticale
    const pathX = Math.sin(t) * ampX;
    const pathY = Math.sin(t * 2.0) * 0.60 + Math.sin(t * 3.4) * 0.16;
    const pathZ = Math.cos(t * 0.9) * 1.5 - 0.2;

    const targetPos = new THREE.Vector3(pathX, pathY, pathZ);

    // Deviazione con curiosità verso click nel vuoto
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
      // Virata morbida verso il target
      this.headHeading.lerp(steer, dt * 2.5);
      this.headHeading.normalize();
    }

    // Avanzamento testa
    head.position.addScaledVector(this.headHeading, this.speedMagnitude * dt);

    // Banking roll nelle virate
    const currentHeading = this.headHeading.clone();
    const yawDelta = currentHeading.x;
    this.headRoll = THREE.MathUtils.lerp(this.headRoll, -yawDelta * 0.45 + this.extraRoll, dt * 3.5);

    this.enforceBounds(head.position, dt);
  }

  solveInertia(dt) {
    const head = this.nodes[0];
    
    // Decelerazione aria
    const drag = Math.pow(0.42, dt);
    this.inertiaVelocity.multiplyScalar(drag);
    head.position.addScaledVector(this.inertiaVelocity, dt);
    this.enforceBounds(head.position, dt);

    if (this.inertiaVelocity.length() > 0.25) {
      const vDir = this.inertiaVelocity.clone().normalize();
      this.headHeading.lerp(vDir, dt * 4.0);
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
    // Molla-smorzatore con stiffness configurabile da UI
    const stiffness = 24.0 * (1.5 - this.softnessMultiplier * 0.4);
    const lerpSpeed = Math.min(1.0, dt * stiffness);
    grabbed.position.lerp(this.dragTargetPos, lerpSpeed);

    // Se afferrato per la coda, la testa spinge comunque in avanti dimenandosi
    if (this.draggedIndex >= 7) {
      const head = this.nodes[0];
      head.position.addScaledVector(this.headHeading, 2.2 * dt);
    }
  }

  solveChainConstraints() {
    // Risoluzione vincoli di distanza tra segmenti
    const iterations = 5;
    const targetDist = this.defaultDist * this.scaleMultiplier;

    for (let iter = 0; iter < iterations; iter++) {
      if (this.isDragging) {
        // Se un nodo specifico k è trascinato:
        // Vincola all'indietro verso la testa (k-1 fino a 0)
        for (let i = this.draggedIndex - 1; i >= 0; i--) {
          this.constrainPair(this.nodes[i + 1], this.nodes[i], targetDist);
        }
        // Vincola in avanti verso la coda (k+1 fino a N-1)
        for (let i = this.draggedIndex + 1; i < this.nodeCount; i++) {
          this.constrainPair(this.nodes[i - 1], this.nodes[i], targetDist);
        }
      } else {
        // Modalità normale (la testa guida, il corpo segue)
        for (let i = 1; i < this.nodeCount; i++) {
          this.constrainPair(this.nodes[i - 1], this.nodes[i], targetDist);
        }
      }
    }
  }

  constrainPair(lead, follow, targetDist) {
    const diff = new THREE.Vector3().subVectors(follow.position, lead.position);
    const currentDist = diff.length();
    if (currentDist > 0.0001) {
      diff.normalize();
      follow.position.copy(lead.position).addScaledVector(diff, targetDist);
    }
  }

  applyBodyWave(dt) {
    let effectiveSpeed = this.speedMagnitude;
    if (this.isDragging) {
      effectiveSpeed = this.draggedIndex >= 7 ? 3.6 : 2.0;
    }

    const freq = this.baseFrequency * Math.max(0.6, effectiveSpeed * 0.85) * this.speedMultiplier;
    this.wavePhase += dt * freq * Math.PI * 2.0;

    // Vettore laterale (Side)
    const sideVec = new THREE.Vector3().crossVectors(this.headHeading, new THREE.Vector3(0, 1, 0)).normalize();

    // Applica onda laterale: testa oscilla poco, coda oscilla molto
    for (let i = 1; i < this.nodeCount; i++) {
      const u = i / (this.nodeCount - 1);
      const amp = (0.02 + 0.55 * Math.pow(u, 1.5)) * (this.isDragging ? 1.4 : 1.0);
      const wave = Math.sin(this.wavePhase - u * 4.5) * amp;

      this.nodes[i].position.addScaledVector(sideVec, wave * 0.18);
    }

    // Ri-applica vincoli per garantire distanze costanti esatte
    const targetDist = this.defaultDist * this.scaleMultiplier;
    for (let i = 1; i < this.nodeCount; i++) {
      this.constrainPair(this.nodes[i - 1], this.nodes[i], targetDist);
    }
  }

  computeFrames() {
    // Calcola Forward, Up, Side e Quaternion per ogni nodo
    for (let i = 0; i < this.nodeCount; i++) {
      const node = this.nodes[i];
      let fwd;

      if (i === 0) {
        // Testa: guarda in direzione opposta al nodo 1
        fwd = new THREE.Vector3().subVectors(this.nodes[0].position, this.nodes[1].position).normalize();
      } else if (i === this.nodeCount - 1) {
        // Coda: punta nella direzione che allontana dal nodo precedente
        fwd = new THREE.Vector3().subVectors(this.nodes[i - 1].position, this.nodes[i].position).normalize();
      } else {
        // Segmenti intermedi: media tangente tra nodo precedente e successivo
        fwd = new THREE.Vector3().subVectors(this.nodes[i - 1].position, this.nodes[i + 1].position).normalize();
      }

      if (fwd.lengthSq() < 0.001) fwd.set(0, 0, 1);
      node.forward.copy(fwd);

      // Calcola Up con banking roll
      let baseUp = new THREE.Vector3(0, 1, 0);
      if (i === 0) {
        baseUp.applyAxisAngle(fwd, this.headRoll);
      } else {
        // Propaga roll lungo il corpo con smorzamento
        const damp = 1.0 - (i / this.nodeCount) * 0.3;
        baseUp.applyAxisAngle(fwd, this.headRoll * damp);
      }

      // Side = Forward x Up
      node.side.crossVectors(fwd, baseUp).normalize();
      // Up ortogonale esatto = Side x Forward
      node.up.crossVectors(node.side, fwd).normalize();

      // Crea matrice di rotazione locale
      const rotMatrix = new THREE.Matrix4();
      rotMatrix.makeBasis(node.side, node.up, fwd);
      node.quaternion.setFromRotationMatrix(rotMatrix);
    }
  }

  enforceBounds(pos, dt) {
    const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6;
    const maxX = aspect < 1.0 ? 2.3 : 4.6;
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
