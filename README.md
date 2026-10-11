# AQUARYA 🦈

> *Uno squaletto che nuota nell'aria.*  
> *Prendilo, lascialo andare, guardalo tornare.*

AQUARYA è una single-page web experience 3D di qualità da portfolio premiato (stile Awwwards), costruita con **Three.js** e architettura moderna compatibile sia con **WebGPURenderer** che con **WebGLRenderer**.

L'intera esperienza è realizzata con **ZERO asset esterni**: nessuna mesh 3D pre-modellata (.glb/.gltf) e nessuna texture scaricata. Lo squalo, l'ambiente, i riflessi cel-shading, l'outline cartoon e la fisica a spina dorsale sono al **100% generati proceduralmente via codice**.

---

## ✨ Caratteristiche Chiave

- **Squaletto Cartoon Giocoso (Chibi Pixar/Nintendo)**:
  - Corpo a siluro paffuto, testa arrotondata e muso dolce.
  - Countershading con gradiente morbido cel-shading a 4 bande: dorso azzurro/ardesia e pancia bianco-crema.
  - Occhi grandi e lucidi con pupille 3D, riflesso solare brillante, bagliore secondario e ammiccamento naturale spontaneo (ogni 3-6s).
  - Bocca sorridente con dentini bianchi carini, che si apre in un'adorabile espressione di sorpresa a "O" quando viene afferrato o trascinato.
  - Guance con macchie soft-pink blush.
  - Inverted hull outline sottile blu notte per un look illustrato definito a spessore uniforme.
  - Pinne modellate proceduralmente: dorsale arrotondata, pettorali alari con flutter idrodinamico, caudale a mezzaluna con battito dinamico.

- **Animazione & Fisica Procedurale Continua**:
  - Catena vertebrale a 12 nodi con vincoli di distanza e cinematica diretta/inversa.
  - Onda sinusoidale viaggiante (1.25 Hz) dalla testa alla coda (ampiezza minima sulla testa, massima sulla coda).
  - Percorso autonomo ad "otto" tridimensionale (curve Lissajous) con variazioni di quota (bobbing verticale), rollio di virata (banking) e variazioni di umore periodiche (barrel roll a 360°, dash improvviso, virate ad arco).
  - Battito della coda sincronizzato con la velocità reale.

- **Interazione Unificata (Mouse & Touch)**:
  - Pointer Events con parità assoluta desktop/mobile e `touch-action: none`.
  - Presa diretta su qualsiasi segmento dello squalo (muso, dorso, pinna caudale).
  - Fisica a molla-smorzatore (spring-damper) in tempo reale sul piano proiettato in 3D.
  - Rilascio con tracciamento della velocità negli ultimi 80ms: lanciato con inerzia naturale, attrito dell'aria e rientro morbido senza salti verso il percorso autonomo.
  - Click su spazio vuoto: genera un anello d'aria ad espansione soffusa e attira lo squalo con curiosità verso il punto cliccato.

- **Ambiente "Acquario d'Aria"**:
  - Gradiente pastello luminoso cielo/pesca senza neri.
  - 450 particelle/bolle d'aria fluttuanti con campo di deviazione reattivo (wake) che si scostano al passaggio dello squalo.
  - Raggi di luce volumetrici diagonali soffusi con pulsazione di opacità.
  - Blob shadow dinamica sul pavimento immaginario che varia raggio, forma e opacità con l'altitudine.
  - Parallasse della camera su coordinate puntatore.

- **Design Editoriale & Accessibilità**:
  - Tipografia serif corsiva elegante (*Fraunces*) e telemetry mono (*JetBrains Mono*).
  - Pannello controlli collassabile (su mobile si trasforma in pill button e bottom sheet).
  - Supporto nativo per `prefers-reduced-motion`.
  - Pausa automatica del render quando la scheda è nascosta (`visibilitychange`).
  - Cap del devicePixelRatio (max 2.0 desktop, 1.5 mobile) per 60 FPS garantiti.

---

## 🗂️ Architettura Modulare

```
aquarya/
├── index.html              # Markup semantico, typography Google Fonts, canvas accessibile
├── package.json            # Vite + Three.js ultima versione stabile
├── vite.config.js          # Configurazione server & build
├── styles.css              # Styling editoriale, typography Fraunces, pannelli frosted glass
├── src/
│   ├── main.js             # Bootstrap app, WebGPU/WebGL selection, loop 60fps, resize
│   ├── shark.js            # Modello procedurale squaletto, toon shading, occhi, espressioni
│   ├── physics.js          # Spina a 12 nodi, Lissajous 3D, spring-damper drag, inerzia
│   ├── environment.js      # Acquario d'aria: gradiente, motes con wake, raggi di luce, ombra
│   ├── interaction.js      # Pointer events unificati, raycast, drag plane 3D, ripple vuoto
│   └── ui.js               # Controlli studio, palette switcher, sliders, telemetria
└── README.md               # Documentazione e guida al deploy
```

---

## 🚀 Avvio Locale

Prerequisiti: [Node.js](https://nodejs.org/) (v18 o superiore consigliata).

```bash
# 1. Installa le dipendenze
npm install

# 2. Avvia il server di sviluppo
npm run dev

# 3. Compila per produzione
npm run build

# 4. Anteprima locale della build
npm run preview
```

---

## 🎨 Parametri Chiave & Personalizzazione

Tutti i parametri principali sono esposti sia via UI sia via codice modulare:

1. **Palette Colori** (`src/shark.js` -> `PALETTES`):
   - `ocean`: Dorso azzurro `#5B8DEF`, Pancia crema `#FFF9EE`, Blush `#FFA0B4`, Outline `#1B263B`.
   - `coral`: Dorso corallo `#F48B8B`, Pancia `#FFFAF2`, Blush `#FF6B8B`.
   - `mint`: Dorso menta `#56C596`, Pancia `#F7FFF8`, Blush `#FFA6BE`.
   Puoi aggiungere qualsiasi palette definendo un nuovo oggetto in `PALETTES`.

2. **Velocità & Frequenza di Nuoto** (`src/physics.js`):
   - `this.swimSpeed = 1.6` (velocità di crociera).
   - `this.baseFrequency = 1.25` (frequenza base battito coda in Hz).
   - Modificabile dinamicamente tramite lo slider **Velocità** (0.3× – 2.2×).

3. **Rigidezza Molla & Morbidezza** (`src/physics.js`):
   - `this.softnessMultiplier`: influenza la stiffness del trascinamento.
   - Modificabile via slider **Morbidezza** ("Rigido", "Normal", "Morbido").

4. **Dimensioni Squaletto** (`src/shark.js`):
   - `this.baseScale = 0.85`: scala geometrica base per bilanciare le proporzioni viewport.
   - Modificabile via slider **Dimensione** (0.7× – 1.5×).

---

## 🌐 Deploy su Vercel

Il progetto è pronto per il deploy istantaneo su **Vercel** come sito statico.

### Metodo 1: Tramite Vercel Dashboard (Consigliato)
1. Fai il push della repository su GitHub:
   ```bash
   git push -u origin main
   ```
2. Accedi alla dashboard di [Vercel](https://vercel.com/) e clicca su **"Add New..." -> "Project"**.
3. Importa la repository `aquarya`.
4. Vercel rileverà automaticamente Vite:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Clicca su **Deploy**. Il sito sarà live in pochi secondi con HTTPS globale.

### Metodo 2: Tramite Vercel CLI
```bash
# Installa o esegui la CLI di Vercel
npx vercel

# Segui i prompt:
# - Set up and deploy? Yes
# - Link to existing project? No
# - Project name? aquarya
# - Directory? ./
# - Override settings? No
```

Per il deploy in produzione finale:
```bash
npx vercel --prod
```

---

## 📜 Licenza
MIT © 2026 AQUARYA Studio. Realizzato con passione per l'arte computazionale e l'animazione interattiva.
