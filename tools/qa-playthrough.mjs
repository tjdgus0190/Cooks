// QA 자동 플레이: 실제 브라우저(Chromium, 모바일 뷰포트)에서 전체 게임을 처음부터 끝까지 진행
// - 터치 드래그(칼질), DeviceMotion 이벤트(흔들기/플릭)를 실제와 같은 경로로 주입
// - 단계별 스크린샷을 qa-output/ 에 저장, 콘솔 에러가 있으면 실패
// 사용: node tools/qa-playthrough.mjs [--customer=minjun] [--style=good|sloppy]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const style = args.style || 'good';
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'qa-output', style);
fs.mkdirSync(outDir, { recursive: true });
const port = 8200 + Math.floor(Math.random() * 500);
const srv = await startServer(port);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e.stack || e)));

const sleep = (ms) => page.waitForTimeout(ms);
let shotN = 0;
async function shot(name) { console.log('  📸', name); await page.screenshot({ path: path.join(outDir, `${String(++shotN).padStart(2, '0')}-${name}.png`) }); }
async function clickText(text) { await page.locator('button', { hasText: text }).first().click({ timeout: 5000 }); }
const stageIdx = () => page.evaluate(() => window.__game.state?.stageIdx);
async function drag(points, stepMs = 8) {
  await page.mouse.move(points[0][0], points[0][1]);
  await page.mouse.down();
  for (const [x, y] of points.slice(1)) { await page.mouse.move(x, y); await sleep(stepMs); }
  await page.mouse.up();
}
const line = (x0, y0, x1, y1, n = 24) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
async function motion(ax, ay, az, rot = 0) {
  await page.evaluate(([ax, ay, az, rot]) => {
    window.dispatchEvent(new DeviceMotionEvent('devicemotion', { acceleration: { x: ax, y: ay, z: az }, accelerationIncludingGravity: { x: ax, y: ay + 9.8, z: az }, rotationRate: { alpha: rot, beta: 0, gamma: 0 }, interval: 16 }));
  }, [ax, ay, az, rot]);
}
async function shake(power, ms) {
  const n = Math.round(ms / 16);
  for (let i = 0; i < n; i++) { await motion((i % 2 ? 1 : -1) * power, 0, 0); await sleep(16); }
}
async function flick(peak) {
  // 0.3초짜리 위로 튕기는 동작
  const seq = [4, 10, peak * 0.7, peak, peak * 0.6, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const v of seq) { await motion(0, v, 0); await sleep(16); }
}
const G = (expr) => page.evaluate(expr);

await page.goto(`http://localhost:${port}/`);
await sleep(800);
await shot('title');
await clickText(args.customer === 'seoyeon' ? '이서연' : '김민준');
await sleep(300);
await shot('order');
await clickText('주문 받기');
await sleep(400);

// ---------- 1. 손질 ----------
await shot('trim-intro');
await clickText('시작!');
await sleep(300);
async function trimMembrane(idx) {
  // 근막 점들을 화면 좌표로 변환해 짧은 구간씩 그어 나간다 (가로 각도일 때만)
  const pts = await G(`(() => { const s = window.__game.scene; const m = s.mems[${idx}]; return m.pts.map(p => s.toScreen(p[0], p[1])); })()`);
  const wobble = style === 'sloppy' ? 9 : 0;
  for (let i = 0; i + 1 < pts.length; i += 6) {
    const seg = pts.slice(i, i + 8).map(([x, y]) => [x + (Math.random() - 0.5) * wobble, y + (Math.random() - 0.5) * wobble]);
    const dx = Math.abs(seg[seg.length - 1][0] - seg[0][0]), dy = Math.abs(seg[seg.length - 1][1] - seg[0][1]);
    if (dy > dx * 1.4) continue; // 너무 세로인 구간은 회전 후 처리
    await drag(seg, 6);
  }
}
await trimMembrane(0);
await shot('trim-progress');
// 일부러 세로로 그어서 미끄러짐 경고 확인
await drag(line(195, 480, 200, 640, 16));
await shot('trim-slip');
// 세로 근막: 고기를 90도 돌려서
for (let i = 0; i < 4; i++) { await clickText('⟳'); await sleep(60); }
await sleep(400);
await trimMembrane(1); await trimMembrane(2);
await shot('trim-rotated');
if (await stageIdx() === 0 && !(await G('window.__game.scene.done'))) {
  for (let i = 0; i < 4; i++) { await clickText('⟲'); await sleep(60); }
  await sleep(400);
  await trimMembrane(0);
}
const trimInfo = await G(`(() => { const s = window.__game.scene; return { stage: window.__game.state.stageIdx, damage: s.damage }; })()`);
if (trimInfo.stage === 0 && !(await G('window.__game.scene.done'))) await clickText('손질 완료');
await sleep(1300);

// ---------- 2. 양배추 ----------
await clickText('시작!');
await sleep(300);
const cuts = style === 'sloppy' ? 6 : 16;
for (let i = 0; i < cuts; i++) {
  const y = 330 + (i * 300) / cuts + (style === 'sloppy' ? Math.random() * 20 : 0);
  const pts = line(30, y, 360, y + 14, 30).map(([x, yy], j) => [x, yy + Math.sin(j / 4) * 3]);
  await drag(pts, 4);
}
await shot('cabbage-cut');
// 세로로도 몇 번
for (let i = 0; i < (style === 'sloppy' ? 1 : 5); i++) await drag(line(120 + i * 35, 290, 125 + i * 35, 640, 30), 4);
await sleep(300);
await shot('cabbage-done');
await clickText('채썰기 완료');
await sleep(1300);

// ---------- 3. 시즈닝 ----------
await clickText('시작!');
await sleep(300);
const saltMs = style === 'sloppy' ? 4000 : 1500;
for (const x of [120, 195, 270]) { await drag(line(x - 5, 600, x, 600, 3)); await shake(18, saltMs / 3); }
await sleep(600);
await shot('season-salt');
await page.locator('.seg button', { hasText: '후추' }).click();
for (const x of [130, 260]) { await drag(line(x - 5, 600, x, 600, 3)); await shake(14, style === 'sloppy' ? 100 : 700); }
await page.locator('.seg button', { hasText: '오일' }).click();
await drag(line(190, 600, 195, 600, 3));
for (let i = 0; i < 60; i++) { await motion(2, 2, 0, 400); await sleep(16); }
await sleep(600);
await shot('season-done');
const season = await G(`({...window.__game.scene.amount})`);
await clickText('시즈닝 완료');
await sleep(1300);

// ---------- 4. 굽기 ----------
await shot('cook-intro');
await clickText('시작!');
await sleep(1200);
const target = { minjun: 55.5, seoyeon: 61, critic: 50 }[args.customer || 'minjun'];
let lastFlip = Date.now();
let flips = 0;
const t0 = Date.now();
let shotCook = false;
while (Date.now() - t0 < 120000) {
  const s = await G(`(() => { const sc = window.__game.scene; const c = sc.sim; const T = Array.from(c.T); return { core: Math.min(...T), down: c.brown[c.down], folded: sc.folded, air: !!sc.air, pan: sc.pan.temp, stage: window.__game.state.stageIdx }; })()`);
  if (s.stage !== 3) break;
  if (s.folded) { const p = await G(`(() => { const sc = window.__game.scene; const L = sc.layout(); return [L.cx + sc.pos.x * L.k, L.cy + sc.pos.y * L.k]; })()`); await page.mouse.click(p[0], p[1]); await sleep(200); continue; }
  // 이월 상승(잔열) 고려해 목표보다 7℃ 낮을 때 꺼냄
  if (s.core >= target - 7.5) break;
  if (!shotCook && Date.now() - t0 > 5000) { await shot('cook-sear'); shotCook = true; }
  if (style === 'good' && s.down > 0.55 && !s.air && Date.now() - lastFlip > 1500) {
    flips++;
    // 처음 한 번은 일부러 너무 약하게 → 접힘 처리 확인
    await flick(flips === 1 ? 11 : 19);
    lastFlip = Date.now();
    await sleep(900);
    if (flips === 3) await shot('cook-flip');
    continue;
  }
  if (style === 'sloppy' && Date.now() - lastFlip > 9000) { flips++; await flick(32); lastFlip = Date.now(); await sleep(1200); continue; }
  if (s.pan > 230 && style === 'good') await page.locator('.seg button', { hasText: '중불' }).click();
  await sleep(250);
}
await clickText('🌡️');
await sleep(300);
await shot('cook-probe');
await clickText('꺼내기');
await sleep(1500);

// ---------- 5. 플레이팅 ----------
await clickText('꾸미기 시작');
await sleep(300);
async function trayDrag(idx, tx, ty) {
  const p = await G(`(() => { const sc = window.__game.scene; const L = sc.layout(); const W = window.__game.W; const col = ${idx} % 5, row = Math.floor(${idx} / 5); return [col * W / 5 + W / 10, L.trayY + row * L.trayH + L.trayH * 0.4, L.cx, L.cy, L.k]; })()`);
  await drag(line(p[0], p[1], p[2] + tx * p[4], p[3] + ty * p[4], 12), 6);
}
if (style === 'good') {
  await trayDrag(0, 70, 55);                               // 샐러드
  for (const [x, y] of [[95, 10], [80, 85], [105, 60]]) await trayDrag(1, x, y); // 토마토 3
  for (const [x, y] of [[-80, 60], [-70, 72], [-90, 50]]) await trayDrag(2, x, y); // 아스파라거스 3
  await trayDrag(3, 20, -75);                              // 로즈마리
  await trayDrag(4, 5, 70);                                // 마늘
  // 소스
  await trayDrag(9, 0, 0);
  const p = await G(`(() => { const L = window.__game.scene.layout(); return [L.cx, L.cy, L.k]; })()`);
  await drag(Array.from({ length: 26 }, (_, i) => [p[0] + (-95 + i * 7) * p[2], p[1] + (95 + Math.sin(i / 4) * 8) * p[2]]), 6);
  await trayDrag(9, 0, 0);
  // 접시 밖으로 버리기 테스트
  await trayDrag(5, 0, 400);
}
await sleep(300);
await shot('plate-done');
await clickText('서빙');
await sleep(1200);
await shot('result-cut');
await sleep(3600);
await sleep(900);
await shot('result-card');
const result = await G(`(() => { const s = window.__game.scene; return { total: s.res.total, stars: s.res.stars, parts: s.res.parts.map(p => [p.label, +p.score.toFixed(1), p.max]), comments: s.res.comments, cook: { core: window.__game.state.cook?.core, brown: window.__game.state.cook?.brown, flips: window.__game.state.cook?.flips, folds: window.__game.state.cook?.folds }, timeLeft: window.__game.state.timeLeft }; })()`);
console.log(JSON.stringify({ style, season, trimInfo, result }, null, 1));
await browser.close();
srv.close();
if (errors.length) { console.error('콘솔 에러:\n' + errors.join('\n')); process.exit(1); }
console.log(`QA 통과 — 스크린샷: ${outDir}`);
