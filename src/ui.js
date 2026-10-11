/**
 * AQUARYA - UI Controller
 * Gestisce l'interfaccia editoriale: selettore palette con transizione animata,
 * slider di controllo fisico (velocità, morbidezza molla, dimensione),
 * pulsanti azione (scodata, pausa, reset), toggle scheletro e telemetria in tempo reale.
 */

export class UI {
  constructor(shark, physics, rendererName = 'WebGL') {
    this.shark = shark;
    this.physics = physics;
    this.rendererName = rendererName;

    this.initElements();
    this.bindEvents();
    this.setRendererBadge(rendererName);
  }

  initElements() {
    this.loader = document.getElementById('loader');
    this.panel = document.getElementById('controls-panel');
    this.panelToggle = document.getElementById('panel-toggle');
    this.swatchBtns = document.querySelectorAll('.swatch-btn');
    
    this.speedSlider = document.getElementById('speed-slider');
    this.speedVal = document.getElementById('speed-val');
    
    this.softnessSlider = document.getElementById('softness-slider');
    this.softnessVal = document.getElementById('softness-val');
    
    this.scaleSlider = document.getElementById('scale-slider');
    this.scaleVal = document.getElementById('scale-val');

    this.btnBurst = document.getElementById('btn-burst');
    this.btnPause = document.getElementById('btn-pause');
    this.btnReset = document.getElementById('btn-reset');
    
    this.skeletonToggle = document.getElementById('skeleton-toggle');

    this.telSpeed = document.getElementById('tel-speed');
    this.telFreq = document.getElementById('tel-freq');
    this.telRenderer = document.getElementById('tel-renderer');

    // Su mobile il pannello si riduce a icona/pillola di default
    if (window.innerWidth <= 768 && this.panel) {
      this.panel.classList.add('collapsed');
      if (this.panelToggle) this.panelToggle.setAttribute('aria-expanded', 'false');
    }
  }

  bindEvents() {
    // 1. Toggle pannello controlli (collassabile su desktop, espandibile su mobile)
    if (this.panelToggle && this.panel) {
      this.panelToggle.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          const isExpanded = this.panel.classList.toggle('expanded');
          this.panelToggle.setAttribute('aria-expanded', isExpanded);
        } else {
          const isCollapsed = this.panel.classList.toggle('collapsed');
          this.panelToggle.setAttribute('aria-expanded', !isCollapsed);
        }
      });
    }

    // 2. Selezione Palette Colori
    this.swatchBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const paletteKey = btn.getAttribute('data-palette');
        this.swatchBtns.forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');

        this.shark.setPalette(paletteKey);
      });
    });

    // 3. Slider Velocità
    if (this.speedSlider) {
      this.speedSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.physics.speedMultiplier = val;
        this.speedVal.textContent = `${val.toFixed(1)}×`;
      });
    }

    // 4. Slider Morbidezza (Stiffness molla)
    if (this.softnessSlider) {
      this.softnessSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.physics.softnessMultiplier = val;
        let label = 'Normal';
        if (val < 0.7) label = 'Rigido';
        else if (val > 1.3) label = 'Morbido';
        this.softnessVal.textContent = label;
      });
    }

    // 5. Slider Dimensione
    if (this.scaleSlider) {
      this.scaleSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.physics.scaleMultiplier = val;
        this.scaleVal.textContent = `${val.toFixed(1)}×`;
      });
    }

    // 6. Pulsante Scodata (Burst)
    if (this.btnBurst) {
      this.btnBurst.addEventListener('click', () => {
        this.physics.triggerBurst();
      });
    }

    // 7. Pulsante Pausa / Riprendi
    if (this.btnPause) {
      this.btnPause.addEventListener('click', () => {
        this.physics.isPaused = !this.physics.isPaused;
        this.btnPause.textContent = this.physics.isPaused ? 'Riprendi' : 'Pausa';
      });
    }

    // 8. Pulsante Reset
    if (this.btnReset) {
      this.btnReset.addEventListener('click', () => {
        this.physics.resetPosition();
      });
    }

    // 9. Toggle Scheletro
    if (this.skeletonToggle) {
      this.skeletonToggle.addEventListener('change', (e) => {
        if (this.shark.skeletonHelper) {
          this.shark.skeletonHelper.visible = e.target.checked;
        }
      });
    }
  }

  setRendererBadge(name) {
    if (this.telRenderer) {
      this.telRenderer.textContent = name;
    }
  }

  hideLoader() {
    if (this.loader) {
      this.loader.classList.add('loaded');
    }
  }

  update() {
    // Aggiornamento telemetria scientifica
    if (this.telSpeed) {
      this.telSpeed.textContent = this.physics.telemetrySpeedCm.toFixed(1);
    }
    if (this.telFreq) {
      this.telFreq.textContent = this.physics.telemetryFreqHz.toFixed(2);
    }
  }
}
