// 개발용: 손질대 재료별 화면 (실사 텍스처 확인) + 몇 번 자른 모습
import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';
const srv = await startServer(8515);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.stack || e)));
await page.goto('http://localhost:8515/'); await page.waitForTimeout(800);
const keys = await page.evaluate(async () => Object.keys((await import('./js/recipes.js')).PREP));
for (const k of keys) {
  await page.evaluate(async (k) => {
    const g = window.__game; g.setFlag(`tut_prep_${(await import('./js/recipes.js')).PREP[k].subject}`);
    g.prep(k, () => {});
  }, k);
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelectorAll('[data-act=go]').forEach((b) => b.click()); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `/tmp/claude-0/shots/p-${k}.png`, clip: { x: 0, y: 180, width: 390, height: 460 } });
}
console.log(errs.join('\n') || 'ok', keys.join(','));
await browser.close(); srv.close();
