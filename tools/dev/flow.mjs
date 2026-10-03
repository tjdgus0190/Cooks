// 개발용: 앱 흐름 스모크 테스트 (스플래시→타이틀→프롤로그→도움말→가게→준비대→영업→주문)
import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';
const srv = await startServer(8488);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.stack || e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const shot = (n) => page.screenshot({ path: `/tmp/claude-0/shots/f-${n}.png` });
const click = (t) => page.locator('button', { hasText: t }).first().click({ timeout: 5000 });
await page.goto('http://localhost:8488/');
await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForTimeout(700); await shot('01-splash');
await page.waitForTimeout(2300); await shot('02-title');
await page.locator('#start-btn').click({ force: true }); await page.waitForTimeout(500); await shot('03-prologue');
for (let i = 0; i < 4; i++) { await click('다음'); await page.waitForTimeout(250); }
await shot('04-prologue-last');
await click('다음'); await page.waitForTimeout(400); await shot('05-help');
await click('건너뛰기'); await page.waitForTimeout(500); await shot('06-shop');
await click('준비대'); await page.waitForTimeout(300); await shot('07-prep-menu');
await page.locator('[data-act=p_garlic]').click(); await page.waitForTimeout(400); await shot('08-prep-garlic-intro');
await click('손질 시작'); await page.waitForTimeout(300);
for (let i = 0; i < 26; i++) { const x = 90 + i * 8.5; await page.mouse.move(x, 380); await page.mouse.down(); for (let k = 0; k <= 10; k++) { await page.mouse.move(x + 2, 380 + k * 32); } await page.mouse.up(); }
await page.waitForTimeout(300); await shot('09-prep-garlic-cut');
await click('손질 완료'); await page.waitForTimeout(1500); await shot('10-after-prep');
console.log('inv', JSON.stringify(await page.evaluate(() => window.__game.save.biz.inventory)));
await page.evaluate(() => { const g = window.__game; g.commitInv({ ...g.getInv(), parsley: 5, baguette: 6, slaw: 3, tomato: 6 }); });
await click('닫기').catch(() => {});
await click('영업 시작'); await page.waitForTimeout(800); await shot('11-hall-intro');
await click('알겠어요'); await page.waitForTimeout(9000); await shot('12-hall');
const tk = page.locator('.tk-btn').first();
if (await tk.count()) { await tk.click(); await page.waitForTimeout(800); await shot('13-order'); }
console.log('scene', await page.evaluate(() => window.__game.scene?.constructor.name), 'dish', await page.evaluate(() => window.__game.state?.dish?.key));
console.log(errs.join('\n') || 'no errors');
await browser.close(); srv.close();
