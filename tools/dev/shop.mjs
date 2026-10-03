// 개발용: 가게 허브 화면 단계별 스크린샷
import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';
const srv = await startServer(8466);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto('http://localhost:8466/');
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/claude-0/shots/s-title.png' });
for (const lv of [1, 3]) {
  await page.evaluate((lv) => {
    const g = window.__game;
    g.saveBiz({ ...g.save.biz, level: lv, day: 12, money: lv === 1 ? 2600000 : 12500000, rep: lv === 1 ? 68 : 81, prices: { strip: 21000, tenderloin: 36000, ribeye: 58000 },
      fame: { mult: 1.5, days: 3 }, medals: lv === 3 ? [{ contest: 'local', place: 1, day: 4 }, { contest: 'city', place: 2, day: 8 }] : [],
      history: [{ day: 10, dish: 'strip', score: 84, sat: 80, vis: 52, price: 21000, profit: 780000 }, { day: 11, dish: 'strip', score: 90, sat: 88, vis: 60, price: 21000, profit: 930000 }], totalServed: 640 });
    g.toShop();
  }, lv);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `/tmp/claude-0/shots/s-shop${lv}.png` });
}
await page.locator('button', { hasText: '메뉴판' }).click(); await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/claude-0/shots/s-menu.png' });
await page.locator('button', { hasText: '완료' }).click();
await page.locator('button', { hasText: '요리대회' }).click(); await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/claude-0/shots/s-contest.png' });
await page.locator('button', { hasText: '뒤로' }).click();
await page.locator('button', { hasText: '가게 확장' }).click(); await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/claude-0/shots/s-upgrade.png' });
console.log(errs);
await browser.close(); srv.close();
