// 개발용: 완벽하게 구운 스테이크를 접시 크기로 확대 렌더 (슬라이스/통째)
import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';
const srv = await startServer(8513);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.stack || e)));
await page.goto('http://localhost:8513/icon.html'); await page.waitForFunction(() => window.ready);
const url = await page.evaluate(async () => {
  await (await import('./js/photos.js')).loadPhotos();
  const { buildSteakTextures } = await import('./js/meat.js');
  const { drawSlicedSteak, drawWholeSteak, idealCook } = await import('./js/dish.js');
  const tex = buildSteakTextures(3, 1);
  const c = document.createElement('canvas'); c.width = 1100; c.height = 1000; const g = c.getContext('2d');
  g.fillStyle = '#f2efe9'; g.fillRect(0, 0, 1100, 1000);
  g.save(); g.translate(520, 280); g.scale(3, 3); drawWholeSteak(g, tex, idealCook()); g.restore();
  g.save(); g.translate(480, 760); g.scale(3, 3); drawSlicedSteak(g, tex, idealCook(), { slices: 6 }); g.restore();
  return c.toDataURL('image/jpeg', 0.9);
});
(await import('node:fs')).writeFileSync('/tmp/claude-0/shots/plated.jpg', Buffer.from(url.split(',')[1], 'base64'));
console.log(errs.join('\n') || 'ok');
await browser.close(); srv.close();
