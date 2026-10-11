import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  console.log('Avvio test suite completa con browser Edge...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: [
      '--use-gl=angle',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`Console [${msg.type()}]:`, msg.text());
  });

  page.on('pageerror', err => {
    console.error('Page Error:', err.message);
  });

  // 1. Desktop Test (1440x900)
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2200));

  await page.screenshot({ path: path.join(__dirname, 'desktop_preview.png') });
  console.log('1. Desktop screenshot salvato.');

  // 2. Test condizioni estreme dell'utente (Velocità 2.1x, Dimensione 0.7x, virate rapide)
  console.log('2. Test slider estremi (Velocità 2.1x, Dimensione 0.7x)...');
  await page.evaluate(() => {
    const speedSlider = document.getElementById('speed-slider');
    const scaleSlider = document.getElementById('scale-slider');
    if (speedSlider) {
      speedSlider.value = '2.1';
      speedSlider.dispatchEvent(new Event('input'));
    }
    if (scaleSlider) {
      scaleSlider.value = '0.7';
      scaleSlider.dispatchEvent(new Event('input'));
    }
  });
  await new Promise(r => setTimeout(r, 600));

  // 3. Test Drag
  console.log('3. Test drag dello squalo...');
  const centerX = 720;
  const centerY = 450;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await new Promise(r => setTimeout(r, 100));
  await page.mouse.move(centerX + 220, centerY - 90, { steps: 18 });
  await new Promise(r => setTimeout(r, 150));

  await page.screenshot({ path: path.join(__dirname, 'drag_preview.png') });
  console.log('Screenshot drag salvato.');

  await page.mouse.up();
  await new Promise(r => setTimeout(r, 1000));

  // 4. Test Mobile Viewport (390x844)
  console.log('4. Test mobile viewport (390x844)...');
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 1800));

  await page.screenshot({ path: path.join(__dirname, 'mobile_preview.png') });
  console.log('Screenshot mobile salvato.');

  await browser.close();
  console.log('Tutti i test completati con successo!');
}

run().catch(err => {
  console.error('Errore test:', err);
  process.exit(1);
});
