// 개발용: 플레이팅/결과 화면으로 바로 이동해 스크린샷
import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';
const [w, h] = (process.argv[2] || '390x844').split('x').map(Number);
const srv = await startServer(8455);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true });
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto('http://localhost:8455/');
await page.waitForTimeout(400);
await page.evaluate(async () => {
  const { idealCook } = await import('./js/dish.js');
  const g = window.__game; g.newRun('minjun');
  const c = idealCook();
  Object.assign(g.state, { trim: { removed: 0.9, damage: 10, mems: null, scars: [] }, cabbage: { fineness: 0.8, pieces: 30 }, season: { salt: 2.2, pepper: 0.7, oil: 9, coverage: 0.8, grains: [], oilDrops: [] }, cook: { ...c, core: 56, flips: 6, goodFlips: 6, folds: 0, foldTime: 0, grains: [], pepperOnly: [], scars: [] } });
  g.goStage(4);
  document.querySelector('[data-act=go]').click();
  const sc = g.scene;
  sc.items.push({ key: 'slaw', x: 70, y: 55, rot: 0, seed: 1 }, { key: 'tomato', x: 95, y: 10, rot: 0, seed: 2 }, { key: 'tomato', x: 85, y: 85, rot: 0, seed: 3 }, { key: 'asparagus', x: -80, y: 60, rot: 0.3, seed: 4 }, { key: 'rosemary', x: 20, y: -70, rot: -0.3, seed: 5 }, { key: 'mushroom', x: -40, y: 75, rot: 0, seed: 6 }, { key: 'butter', x: 0, y: -10, rot: 0, seed: 7 });
  sc.sauce.push(Array.from({ length: 30 }, (_, i) => [-95 + i * 6.4, 98 + Math.sin(i / 4) * 8]));
});
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/claude-0/shots/jump-plate.png' });
await page.evaluate(() => window.__game.scene.finish());
await page.waitForSelector('.stars', { timeout: 20000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/claude-0/shots/jump-result.png' });
console.log(errs);
await browser.close(); srv.close();
