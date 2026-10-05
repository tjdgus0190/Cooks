// 개발용: 단면 텍스처 확대 확인
import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';
const srv = await startServer(8512);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
await page.goto('http://localhost:8512/icon.html'); await page.waitForFunction(() => window.ready);
const url = await page.evaluate(async () => {
  const { drawCrossSection } = await import('./js/meat.js');
  const { idealCook } = await import('./js/dish.js');
  await (await import('./js/photos.js')).loadPhotos();
  const c = document.createElement('canvas'); c.width = 1000; c.height = 260; const g = c.getContext('2d');
  g.fillStyle = '#eee'; g.fillRect(0, 0, 1000, 260);
  const ck = idealCook();
  g.save(); g.translate(40, 40); g.scale(5, 5); drawCrossSection(g, 180, 35, ck.Tmax, 1.1, 1.0, { fatEnd: true }); g.restore();
  return c.toDataURL('image/jpeg', 0.92);
});
(await import('node:fs')).writeFileSync('/tmp/claude-0/shots/xs.jpg', Buffer.from(url.split(',')[1], 'base64'));
await browser.close(); srv.close();
