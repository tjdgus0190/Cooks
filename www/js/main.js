// 쿠킹 시뮬레이터 — 메인 루프, 씬 관리, 타이머, HUD
import { initAudio, sfx, setSizzle } from './audio.js';
import { startMotion, requestMotionPermission, decayMotion, motion } from './motion.js';
import { buildSteakTextures } from './meat.js';
import { CUSTOMERS, loadSave, saveBest } from './data.js';
import * as ui from './ui.js';
import { TitleScene } from './scenes/title.js';
import { TrimScene } from './scenes/trim.js';
import { CabbageScene } from './scenes/cabbage.js';
import { SeasonScene } from './scenes/season.js';
import { CookScene } from './scenes/cook.js';
import { PlateScene } from './scenes/plate.js';
import { ResultScene } from './scenes/result.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

export const STAGES = [
  { key: 'trim', name: '고기 손질', scene: TrimScene },
  { key: 'cabbage', name: '양배추 채썰기', scene: CabbageScene },
  { key: 'season', name: '시즈닝', scene: SeasonScene },
  { key: 'cook', name: '굽기', scene: CookScene },
  { key: 'plate', name: '플레이팅', scene: PlateScene },
];

const game = {
  canvas, ctx, W: 0, H: 0, S: 1, dpr: 1,
  scene: null, state: null, tex: null,
  timer: { running: false, paused: false, warned: false },
  time: 0,
  ui, sfx, motion,
  save: loadSave(),
};
window.__game = game; // QA 자동화용

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const W = window.innerWidth, H = window.innerHeight;
  game.W = W; game.H = H; game.dpr = dpr;
  game.S = Math.min(W / 400, H / 780);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const want = game.S * dpr * 1.6;
  if (!game.tex || Math.abs(game.tex.scale - want) > 0.3) game.tex = buildSteakTextures(want);
  game.scene?.resize?.();
}
window.addEventListener('resize', resize);

game.setScene = function (SceneClass, ...args) {
  game.scene?.exit?.();
  ui.clearControls(); ui.setHint(''); ui.clearMeters();
  setSizzle(0);
  game.scene = new SceneClass(game, ...args);
  game.scene.enter?.();
};

game.newRun = function (customerId) {
  const c = CUSTOMERS.find((x) => x.id === customerId) || CUSTOMERS[0];
  game.state = {
    customer: c,
    timeLeft: c.time, timeTotal: c.time,
    stageIdx: 0,
    trim: null, cabbage: null, season: null, cook: null, plate: null,
    timedOut: false,
  };
  game.timer.warned = false;
  ui.showHud(true);
  ui.setOrder(`${c.face} ${c.name} · ${orderName(c.order)}`);
  game.goStage(0);
};

export function orderName(key) {
  return { rare: '레어', 'medium-rare': '미디엄 레어', medium: '미디엄', 'medium-well': '미디엄 웰', 'well-done': '웰던' }[key];
}

game.goStage = function (idx) {
  const st = game.state;
  st.stageIdx = idx;
  if (idx >= STAGES.length) { game.finish(); return; }
  const stage = STAGES[idx];
  ui.setStage(idx + 1, STAGES.length, stage.name);
  game.timer.running = true;
  game.setScene(stage.scene);
};

game.nextStage = function () {
  // 시간 초과로 이미 결과 화면에 간 뒤, 이전 단계의 지연 전환이 늦게 도착하는 경우 무시
  if (!game.state || game.state.timedOut || game.scene instanceof ResultScene) return;
  sfx.ding(); game.goStage(game.state.stageIdx + 1);
};

game.finish = function () {
  game.timer.running = false;
  ui.showHud(false);
  game.setScene(ResultScene);
};

game.toTitle = function () {
  game.timer.running = false;
  ui.showHud(false);
  ui.hideOverlay();
  game.setScene(TitleScene);
};

/** 단계 안내 카드: 읽는 동안 타이머 정지 */
game.instruct = function ({ icon, title, lines, button = '시작!' }) {
  return new Promise((res) => {
    game.timer.paused = true;
    ui.showCard(`
      <div class="icon">${icon}</div>
      <h2>${title}</h2>
      <ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
      <div class="row"><button class="btn" data-act="go">${button}</button></div>`, {
      go: () => { ui.hideOverlay(); game.timer.paused = false; initAudio(); res(); },
    });
  });
};

game.saveBest = (id, score) => { game.save = saveBest(game.save, id, score); };

// ---------------- 입력 ----------------
const pointers = new Map();
let twist = null;
function toLocal(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId, t: performance.now() }; }

canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  canvas.setPointerCapture?.(e.pointerId);
  const p = toLocal(e);
  pointers.set(e.pointerId, p);
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    twist = { angle: Math.atan2(b.y - a.y, b.x - a.x) };
    game.scene?.cancelPointer?.();
  } else if (pointers.size === 1) game.scene?.down?.(p);
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) { game.scene?.hover?.(toLocal(e)); return; }
  const p = toLocal(e);
  pointers.set(e.pointerId, p);
  if (pointers.size >= 2 && twist) {
    const [a, b] = [...pointers.values()];
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    let d = ang - twist.angle;
    if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    twist.angle = ang;
    game.scene?.twist?.(d, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  } else if (pointers.size === 1) game.scene?.move?.(p);
});
function up(e) {
  if (!pointers.has(e.pointerId)) return;
  const p = toLocal(e);
  const wasSingle = pointers.size === 1;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) twist = null;
  if (wasSingle) game.scene?.up?.(p);
}
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

// 첫 터치 시 모션 권한 요청 (iOS)
game.enableMotion = async () => { initAudio(); await requestMotionPermission(); startMotion(); };

// ---------------- 루프 ----------------
let last = performance.now();
let tickAcc = 0;
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;
  game.time += dt;
  decayMotion(dt);
  const st = game.state;
  if (st && game.timer.running && !game.timer.paused && !document.hidden) {
    st.timeLeft -= dt;
    if (st.timeLeft <= 30 && !game.timer.warned) { game.timer.warned = true; ui.toast('30초 남았어요!', { bad: true }); }
    if (st.timeLeft <= 10) { tickAcc += dt; if (tickAcc > 1) { tickAcc = 0; sfx.tick(); } }
    if (st.timeLeft <= 0) {
      st.timeLeft = 0;
      game.timer.running = false;
      game.scene?.onTimeout ? game.scene.onTimeout() : onTimeout();
    }
    ui.setTimer(st.timeLeft, st.timeTotal);
  }
  try {
    game.scene?.update?.(dt);
    ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
    game.scene?.draw?.(ctx);
  } catch (err) {
    console.error(err);
  }
  requestAnimationFrame(frame);
}

function onTimeout() {
  const st = game.state;
  st.timedOut = true;
  sfx.fail();
  ui.toast('시간 초과!', { bad: true, sub: '손님이 기다리다 지쳤어요' });
  setTimeout(() => game.finish(), 1400);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) setSizzle(0); });

resize();
game.setScene(TitleScene);
requestAnimationFrame(frame);
