// 개발용: 요리별 손질 화면 스크린샷 (마블링·근막 확인)
import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';
const srv = await startServer(8477);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://localhost:8477/');
await page.waitForTimeout(400);
for (const k of ['tenderloin', 'wagyu']) {
  await page.evaluate(async (k) => {
    const E = await import('./js/economy.js');
    const g = window.__game;
    g.startOrder({ mode: 'service', dishKey: k, customer: E.makeCustomer({ level: 4 }) });
    document.querySelector('[data-act=go]').click();
  }, k);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `/tmp/claude-0/shots/d-${k}.png`, clip: { x: 0, y: 250, width: 390, height: 420 } });
}
console.log(errs); await browser.close(); srv.close();
