// 개발용: 타이틀 + 손질 화면 캡처
import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';
const srv = await startServer(8513);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://localhost:8513/'); await page.waitForTimeout(3600);
await page.screenshot({ path: '/tmp/claude-0/shots/s2-title.png', clip: { x: 0, y: 200, width: 390, height: 420 } });
await page.evaluate(async () => {
  const E = await import('./js/economy.js'); const R = await import('./js/recipes.js');
  const g = window.__game; g.startOrder({ mode: 'contest', dishKey: 'ribeye', customer: E.makeCustomer({ level: 3 }, Math.random, { dish: R.recipeByKey('ribeye') }) });
  document.querySelector('[data-act=go]')?.click();
});
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/claude-0/shots/s2-trim.png', clip: { x: 0, y: 260, width: 390, height: 400 } });
console.log(errs.join('\n') || 'ok');
await browser.close(); srv.close();
