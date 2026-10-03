// 개발용: 모든 레시피를 단계별로 자동 진행하며 스크린샷 + 에러 확인
import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';
const only = process.argv[2];
const srv = await startServer(8499);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.stack || e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto('http://localhost:8499/');
await page.waitForTimeout(600);
const keys = await page.evaluate(async () => (await import('./js/recipes.js')).RECIPES.map((r) => r.key));
const W = (ms) => page.waitForTimeout(ms);
const scene = () => page.evaluate(() => window.__game.scene?.constructor.name);
const results = [];
for (const key of keys) {
  if (only && key !== only) continue;
  await page.evaluate(async (key) => {
    const g = window.__game;
    g.saveBiz({ ...g.save.biz, inventory: { garlic: 9, parsley: 9, baguette: 9, tomato: 20, lemon: 9, guanciale: 9, shallot: 9, slaw: 9, asparagus: 9, rosemary: 9, mushroom: 9 } });
    g.day = null;
    const E = await import('./js/economy.js');
    g.startOrder({ mode: 'contest', dishKey: key, customer: E.makeCustomer({ level: 2 }, Math.random, { dish: (await import('./js/recipes.js')).recipeByKey(key) }), contest: null });
  }, key);
  let guard = 0;
  while (guard++ < 12) {
    await W(400);
    const sc = await scene();
    if (sc === 'ResultScene') break;
    const go = page.locator('[data-act=go]');
    if (await go.count()) { await go.first().click({ timeout: 2000 }).catch(() => {}); await W(250); }
    await page.screenshot({ path: `/tmp/claude-0/shots/r-${key}-${guard}-${sc}.png` });
    await page.evaluate(async (sc) => {
      const g = window.__game, s = g.scene;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      if (sc === 'TrimScene') { s.mems.forEach((m) => m.cut.fill(1)); s.finish(); }
      else if (sc === 'CabbageScene') s.finish();
      else if (sc === 'SeasonScene') { for (let i = 0; i < 60; i++) s.emit(12); for (const t of s.TOOLS) { s.setTool(t.key); for (let i = 0; i < 30; i++) s.emit(10); } await wait(700); s.finish(); }
      else if (sc === 'CookScene') { await wait(1500); s.finish(); }
      else if (sc === 'BoilScene') { s.next(); s.minutes = s.pasta ? s.pkgMin - 1 : s.pkgMin; s.reserve?.(); await wait(300); s.next(); }
      else if (sc === 'WhiskScene') { s.cheese = 30; s.pepper = 1.6; s.mix = 1; s.finish(); }
      else if (sc === 'OvenScene') { s.brown = 0.95; s.finish(); }
      else if (sc === 'SauteScene') {
        s.heat = 'low';
        while (s.cur) {
          const c = s.cur;
          if (c.act === 'pour') { s.oil = c.target; s.advance(); }
          else if (c.act === 'toss') { for (let i = 0; i < c.count; i++) { s.toss(18); await wait(650); } }
          else if (c.act === 'baste') { for (let i = 0; i < c.count; i++) s.baste(); }
          else s.act();
          await wait(900);
        }
        s.heat = 'mid'; await wait(1500); s.finish();
      }
      else if (sc === 'PlateScene') { s.twirl = 1; s.mode = 'move'; s.autoPlate(); await wait(300); s.finish(); }
    }, sc);
    await W(1200);
  }
  await page.waitForSelector('.stars', { timeout: 20000 }).catch(() => {});
  await W(600);
  await page.screenshot({ path: `/tmp/claude-0/shots/r-${key}-result.png` });
  const r = await page.evaluate(() => { const s = window.__game.scene; return s.res ? { total: s.res.total, c: s.res.comments.slice(0, 3) } : null; });
  results.push([key, r]);
}
for (const r of results) console.log(JSON.stringify(r));
console.log(errs.join('\n') || 'no errors');
await browser.close(); srv.close();
