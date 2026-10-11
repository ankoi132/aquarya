import * as THREE from 'three';

/**
 * AQUARYA - Interaction Handler
 * Gestisce Pointer Events unificati (mouse + touch, parità assoluta),
 * Raycasting sul corpo dello squalo, proiezione su piano 3D a profondità dinamica,
 * rilevamento hover/prossimità, cambio cursori (grab/grabbing),
 * click nel vuoto con pulsazione d'aria (anello + particelle) e attrazione con curiosità.
 */

export class Interaction {
  constructor(canvas, camera, scene, shark, physics, environment) {
    this.canvas = canvas;
    this.camera = camera;
    this.scene = scene;
    this.shark = shark;
    this.physics = physics;
    this.environment = environment;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);
    this.normalizedPointer = new THREE.Vector2(0, 0);

    this.activePointerId = null;
    this.isDragging = false;
    this.dragPlane = new THREE.Plane();
    this.dragPlaneIntersect = new THREE.Vector3();
    this.hasInteracted = false;

    // Riferimento all'hint UI per farlo sparire al primo tocco
    this.hintEl = document.getElementById('interaction-hint');

    // Effetti grafici: Onda d'aria / ripple al click nel vuoto
    this.ripples = [];
    this.initRipplePool();

    this.bindEvents();
  }

  initRipplePool() {
    this.rippleGroup = new THREE.Group();
    this.rippleGroup.name = 'RipplesGroup';
    this.scene.add(this.rippleGroup);

    // Geometria anello d'aria sottile
    const ringGeo = new THREE.RingGeometry(0.08, 0.12, 32);
    for (let i = 0; i < 6; i++) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xE8F4FD,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.visible = false;
      this.rippleGroup.add(ringMesh);
      this.ripples.push({ mesh: ringMesh, active: false, time: 0, life: 0.8, maxScale: 2.2 });
    }
  }

  spawnRipple(worldPos) {
    const r = this.ripples.find(item => !item.active);
    if (!r) return;

    r.active = true;
    r.time = 0;
    r.mesh.position.copy(worldPos);
    r.mesh.quaternion.copy(this.camera.quaternion); // guarda la camera
    r.mesh.scale.set(0.1, 0.1, 0.1);
    r.mesh.visible = true;
    r.mesh.material.opacity = 0.85;
  }

  bindEvents() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this), { passive: false });
    window.addEventListener('pointermove', this.onPointerMove.bind(this), { passive: false });
    window.addEventListener('pointerup', this.onPointerUp.bind(this), { passive: false });
    window.addEventListener('pointercancel', this.onPointerUp.bind(this), { passive: false });

    // Prevenzione menu contestuale per touch prolungato
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  updatePointerCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.mouse.x = (x / rect.width) * 2 - 1;
    this.mouse.y = -(y / rect.height) * 2 + 1;

    this.normalizedPointer.x = this.mouse.x;
    this.normalizedPointer.y = this.mouse.y;

    if (this.environment) {
      this.environment.setPointerParallax(this.mouse.x, this.mouse.y);
    }
  }

  onPointerDown(e) {
    // Gestione single-touch: ignora tocchi multipli secondari
    if (this.activePointerId !== null && this.activePointerId !== e.pointerId) return;

    this.activePointerId = e.pointerId;
    this.updatePointerCoords(e);

    // Nascondi permanentemente l'hint al primo tocco
    if (!this.hasInteracted) {
      this.hasInteracted = true;
      if (this.hintEl) {
        this.hintEl.classList.add('hidden');
      }
    }

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Raycast contro il corpo dello squalo
    const intersects = this.raycaster.intersectObject(this.shark.bodyMesh, false);

    if (intersects.length > 0) {
      e.preventDefault();
      const hit = intersects[0];
      const hitPoint = hit.point;

      // Trova il segmento della spina dorsale più vicino al punto cliccato
      let nearestNodeIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < this.physics.nodes.length; i++) {
        const d = hitPoint.distanceTo(this.physics.nodes[i].position);
        if (d < minDist) {
          minDist = d;
          nearestNodeIdx = i;
        }
      }

      // Crea un piano di drag parallelo alla camera passante per il punto di presa
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      this.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), hitPoint);

      this.isDragging = true;
      this.canvas.classList.remove('can-grab');
      this.canvas.classList.add('is-grabbing');

      this.physics.startDrag(nearestNodeIdx, hitPoint);
    } else {
      // Click nell'area vuota: proietta sul piano a Z = 0
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const ripplePos = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(plane, ripplePos);

      if (ripplePos) {
        this.spawnRipple(ripplePos);
        this.physics.attractTo(ripplePos);
        this.shark.lookAtPointer(ripplePos);
      }
    }
  }

  onPointerMove(e) {
    if (this.activePointerId !== null && this.activePointerId !== e.pointerId) return;

    this.updatePointerCoords(e);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (this.isDragging) {
      e.preventDefault();
      // Calcola intersezione con il piano di trascinamento 3D
      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPlaneIntersect)) {
        this.physics.updateDrag(this.dragPlaneIntersect);
        this.shark.lookAtPointer(this.dragPlaneIntersect);
      }
    } else {
      // Modalità hover / prossimità
      const intersects = this.raycaster.intersectObject(this.shark.bodyMesh, false);
      const isNear = intersects.length > 0;

      if (isNear) {
        this.canvas.classList.add('can-grab');
      } else {
        this.canvas.classList.remove('can-grab');
      }

      // Proietta punto 3D per lo sguardo curioso degli occhi
      const gazePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.physics.nodes[0].position.z);
      const gazeTarget = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(gazePlane, gazeTarget);
      if (gazeTarget) {
        this.shark.lookAtPointer(gazeTarget);
      }
    }
  }

  onPointerUp(e) {
    if (this.activePointerId !== null && this.activePointerId !== e.pointerId) return;

    this.activePointerId = null;
    this.canvas.classList.remove('is-grabbing');

    if (this.isDragging) {
      this.isDragging = false;
      this.physics.endDrag();
    }
  }

  update(delta) {
    // Aggiornamento animazione ripple d'aria
    for (const r of this.ripples) {
      if (r.active) {
        r.time += delta;
        const progress = r.time / r.life;
        if (progress >= 1.0) {
          r.active = false;
          r.mesh.visible = false;
        } else {
          const s = THREE.MathUtils.lerp(0.2, r.maxScale, Math.pow(progress, 0.6));
          r.mesh.scale.set(s, s, s);
          r.mesh.material.opacity = (1.0 - progress) * 0.75;
        }
      }
    }
  }
}
