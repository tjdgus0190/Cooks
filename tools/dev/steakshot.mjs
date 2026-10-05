// 개발용: 스테이크 실사 텍스처 확인 (생/중간/완벽/탐 + 슬라이스)
import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';
const srv = await startServer(8511);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.stack || e)));
await page.goto('http://localhost:8511/icon.html');
await page.waitForFunction(() => window.ready);
const t0 = Date.now();
const url = await page.evaluate(async () => {
  const { buildSteakTextures, drawSteakTop } = await import('./js/meat.js');
  const { drawSlicedSteak, idealCook } = await import('./js/dish.js');
  await (await import('./js/photos.js')).loadPhotos();
  const t = performance.now();
  const tex = buildSteakTextures(2.6, 1);
  const ms = performance.now() - t;
  const c = document.createElement('canvas'); c.width = 1200; c.height = 1000;
  const g = c.getContext('2d');
  g.fillStyle = '#2a1d16'; g.fillRect(0, 0, 1200, 1000);
  [[0, 300, 230], [0.5, 900, 230], [1.1, 300, 600], [1.9, 900, 600]].forEach(([b, x, y]) => {
    g.save(); g.translate(x, y); g.scale(2, 2); drawSteakTop(g, tex, { brown: b, sideThick: 8, oil: 4 }); g.restore();
  });
  g.save(); g.translate(600, 880); g.scale(1.1, 1.1); drawSlicedSteak(g, tex, idealCook(), { slices: 7 }); g.restore();
  window.__ms = ms;
  return c.toDataURL('image/jpeg', 0.9);
});
console.log('tex ms', await page.evaluate(() => window.__ms));
const fs = await import('node:fs');
fs.writeFileSync('/tmp/claude-0/shots/steak-real.jpg', Buffer.from(url.split(',')[1], 'base64'));
console.log(errs.join('\n') || 'ok');
await browser.close(); srv.close();
