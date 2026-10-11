import * as THREE from 'three';
import { Shark } from './shark.js';
import { Physics } from './physics.js';
import { Environment } from './environment.js';
import { Interaction } from './interaction.js';
import { UI } from './ui.js';

/**
 * AQUARYA - Application Entry Point
 * Inizializza il renderer (WebGPURenderer con fallback automatico a WebGLRenderer),
 * la camera prospettica con adattamento responsive, il loop di animazione a 60 fps,
 * la gestione della visibilità (pausa automatica in background) e prefers-reduced-motion.
 */

class App {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.noWebGLNotice = document.getElementById('no-webgl');
    
    this.lastTime = performance.now();
    this.elapsedTime = 0;
    this.isTabActive = true;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.init();
  }

  async init() {
    try {
      // 1. Inizializzazione Scena & Camera
      this.scene = new THREE.Scene();
      
      const aspect = window.innerWidth / window.innerHeight;
      this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
      this.camera.position.set(0, 0.2, 7.5);

      // 2. Inizializzazione Renderer (WebGPU con fallback a WebGL)
      await this.initRenderer();

      // 3. Creazione Modello Procedurale dello Squalo
      this.shark = new Shark('ocean');
      this.scene.add(this.shark.group);

      // 4. Inizializzazione Motore Fisico & Nuotata
      this.physics = new Physics();
      this.physics.resetPosition();

      // 5. Inizializzazione Ambiente Sognante (Acquario d'aria)
      this.environment = new Environment(this.scene, this.camera);

      // 6. Inizializzazione Interazione Pointer (mouse/touch)
      this.interaction = new Interaction(
        this.canvas,
        this.camera,
        this.scene,
        this.shark,
        this.physics,
        this.environment
      );

      // 7. Inizializzazione Interfaccia Utente
      this.ui = new UI(this.shark, this.physics, this.rendererName);

      // Gestione ridimensionamento e visibilità finestra
      this.handleResize();
      window.addEventListener('resize', this.handleResize.bind(this));
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

      // Se l'utente ha impostato preferenze di movimento ridotto
      if (this.reducedMotion) {
        this.physics.speedMultiplier = 0.6;
        this.physics.baseFrequency = 0.7;
      }

      // Rimuovi schermata di caricamento con transizione elegante
      setTimeout(() => {
        this.ui.hideLoader();
      }, 400);

      // Avvia loop di rendering
      this.animate = this.animate.bind(this);
      requestAnimationFrame(this.animate);

    } catch (err) {
      console.error('[AQUARYA] Errore critico durante l\'inizializzazione:', err);
      if (this.noWebGLNotice) {
        this.noWebGLNotice.style.display = 'flex';
      }
    }
  }

  async initRenderer() {
    let renderer;
    let rendererName = 'WebGL';

    // Tentativo WebGPURenderer
    if (typeof navigator !== 'undefined' && navigator.gpu) {
      try {
        const { WebGPURenderer } = await import('three/webgpu');
        renderer = new WebGPURenderer({
          canvas: this.canvas,
          antialias: true,
          alpha: true
        });
        await renderer.init();
        rendererName = 'WebGPU';
        console.log('[AQUARYA] Inizializzato con WebGPURenderer');
      } catch (gpuErr) {
        console.warn('[AQUARYA] Fallback a WebGLRenderer:', gpuErr);
        renderer = this.createWebGLRenderer();
        rendererName = 'WebGL';
      }
    } else {
      renderer = this.createWebGLRenderer();
      rendererName = 'WebGL';
    }

    this.renderer = renderer;
    this.rendererName = rendererName;

    // Configurazione pixel ratio e shadow map
    const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
    const maxPixelRatio = isMobile ? 1.5 : 2.0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    if (this.renderer.shadowMap) {
      this.renderer.shadowMap.enabled = true;
    }
  }

  createWebGLRenderer() {
    return new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
  }

  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    this.camera.aspect = aspect;

    if (aspect < 1.0) {
      this.camera.fov = 54;
      this.camera.position.z = 9.2;
    } else {
      this.camera.fov = 42;
      this.camera.position.z = 7.5;
    }
    this.camera.updateProjectionMatrix();

    if (this.renderer) {
      const isMobile = width <= 768 || 'ontouchstart' in window;
      const maxPixelRatio = isMobile ? 1.5 : 2.0;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
      this.renderer.setSize(width, height);
    }
  }

  handleVisibilityChange() {
    this.isTabActive = !document.hidden;
    if (this.isTabActive) {
      this.lastTime = performance.now();
    }
  }

  animate(currentTime) {
    requestAnimationFrame(this.animate);

    if (!this.isTabActive) return;

    const dt = Math.min((currentTime - this.lastTime) * 0.001, 0.05);
    this.lastTime = currentTime;
    this.elapsedTime += dt;

    // 1. Aggiorna la fisica della spina dorsale e la nuotata
    this.physics.update(dt);

    // 2. Aggiorna lo squalo deformando il corpo lungo i nodi della spina
    this.shark.update(dt, this.physics.speedMagnitude, this.physics.nodes);

    // 3. Aggiorna l'ambiente (particelle scia, parallasse, ombra)
    this.environment.update(this.elapsedTime, dt, this.physics.nodes);

    // 4. Aggiorna le onde d'aria/ripple dell'interazione
    this.interaction.update(dt);

    // 5. Aggiorna telemetria UI
    this.ui.update();

    // 6. Render della scena
    this.renderer.render(this.scene, this.camera);
  }
}

// Avvio applicazione al caricamento del DOM
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
