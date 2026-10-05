// 쿠킹 시뮬레이터 — 메인 루프, 씬 관리, 실시간 영업(타이쿤), 타이머, HUD, 일시정지
import { initAudio, sfx, setSizzle, setSoundOn } from './audio.js';
import { startMotion, requestMotionPermission, decayMotion, motion } from './motion.js';
import { buildSteakTextures } from './meat.js';
import { loadPhotos } from './photos.js';
import { loadSave, saveBest, writeSave } from './data.js';
import { dishByKey } from './economy.js';
import * as F from './floor.js';
import * as ui from './ui.js';
import { prefs, onBackButton, onAppPause } from './native.js';
import { SplashScene } from './scenes/splash.js';
import { TitleScene } from './scenes/title.js';
import { StoryScene } from './scenes/story.js';
import { ShopScene } from './scenes/shop.js';
import { HallScene } from './scenes/hall.js';
import { TrimScene } from './scenes/trim.js';
import { CabbageScene } from './scenes/cabbage.js';
import { SeasonScene } from './scenes/season.js';
import { CookScene } from './scenes/cook.js';
import { PlateScene } from './scenes/plate.js';
import { ResultScene } from './scenes/result.js';
import { BoilScene, OvenScene } from './scenes/boil.js';
import { SauteScene } from './scenes/saute.js';
import { WhiskScene } from './scenes/whisk.js';
import { SliceScene } from './scenes/slice.js';
import { recipeByKey, consume, orderName } from './recipes.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// 레시피 단계 타입 → 씬
const SCENE_FOR = { trim: TrimScene, cabbage: CabbageScene, season: SeasonScene, sear: CookScene, boil: BoilScene, saute: SauteScene, whisk: WhiskScene, oven: OvenScene, plate: PlateScene };
/** 레시피 → 단계 목록. 대회 스테이크는 양배추 채썰기를 현장에서 한다 */
function buildStages(recipe, mode) {
  const steps = recipe.steps.map((s) => ({ ...s, key: s.type, scene: SCENE_FOR[s.type] }));
  if (mode === 'contest' && recipe.cat === 'steak') steps.splice(1, 0, { type: 'cabbage', key: 'cabbage', name: '양배추 채썰기', scene: CabbageScene });
  return steps;
}

const game = {
  canvas, ctx, W: 0, H: 0, S: 1, dpr: 1,
  scene: null, state: null, tex: null,
  day: null,               // 진행 중인 실시간 영업 (floor.js)
  paused: false,
  timer: { running: false, paused: false, warned: false },
  time: 0,
  ui, sfx, motion,
  save: loadSave(),
};
window.__game = game; // QA 자동화용
Object.assign(prefs, game.save.prefs);
setSoundOn(prefs.sound);

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const W = window.innerWidth, H = window.innerHeight;
  game.W = W; game.H = H; game.dpr = dpr;
  game.S = Math.min(W / 400, H / 780);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  game.useTex(game.tex?.marbling ?? 1);
  game.scene?.resize?.();
}
window.addEventListener('resize', resize);

/** 요리별 마블링 텍스처 (해상도·마블링이 바뀔 때만 다시 생성) */
const texCache = new Map();
game.useTex = function (marbling = 1) {
  const want = game.S * game.dpr * 1.6;
  const key = `${marbling}|${Math.round(want * 4)}`;
  if (!texCache.has(key)) { if (texCache.size > 4) texCache.clear(); texCache.set(key, buildSteakTextures(want, marbling)); }
  game.tex = texCache.get(key);
};

game.setScene = function (SceneClass, ...args) {
  game.scene?.exit?.();
  ui.clearControls(); ui.setHint(''); ui.clearMeters();
  setSizzle(0);
  game.scene = new SceneClass(game, ...args);
  game.scene.enter?.();
};

// ---------------- 저장 ----------------
game.saveBiz = (biz) => { game.save = writeSave({ ...game.save, biz }); };
game.setFlag = (k, v = true) => { game.save = writeSave({ ...game.save, flags: { ...game.save.flags, [k]: v } }); };
game.setPref = (k, v) => {
  prefs[k] = v;
  if (k === 'sound') setSoundOn(v);
  game.save = writeSave({ ...game.save, prefs: { ...prefs } });
};
game.saveBest = (id, score) => { game.save = saveBest(game.save, id, score); };

// ---------------- 손질 재료(인벤토리) ----------------
// 영업 중에는 오늘의 재고(day.inv)가 기준, 영업 밖에서는 저장된 가게 재고
game.getInv = () => ({ ...(game.day ? game.day.inv : game.save.biz.inventory || {}) });
game.commitInv = (inv) => {
  if (game.day) game.day.inv = { ...inv };
  else game.saveBiz({ ...game.save.biz, inventory: { ...inv } });
};
/** 준비대 손질 → 끝나면 back() */
game.prep = function (prepKey, back) {
  ui.hideOverlay();
  game.setScene(SliceScene, { prepKey, onDone: back });
};

// ---------------- 영업(타이쿤) ----------------
game.openDay = function () {
  game.day = F.createDay(game.save.biz, {});
  game.toHall();
};
game.toHall = function () {
  game.timer.running = false;
  ui.showHud(false);
  ui.hideOverlay();
  game.state = null;
  game.setScene(HallScene);
};

/** 주문 시작: mode = 'order'(영업 손님) | 'contest'(대회) */
game.startOrder = function ({ mode = 'order', dishKey = 'strip', customer, contest = null }) {
  const c = customer;
  const dish = recipeByKey(dishKey);
  game.useTex(dish.marbling || 1);
  const quick = mode === 'order';
  // 대회: 손질 재료를 가게 재고에서 가져간다 (영업 주문은 floor.playerTake에서 이미 소모)
  if (mode === 'contest') { const inv = game.getInv(); consume(dish, inv); game.commitInv(inv); }
  const stages = buildStages(dish, mode);
  game.state = {
    mode, dish, contest, quick,
    customer: c,
    stages, steps: stages.map((x) => x.type),
    timeLeft: quick ? c.patience : c.time, timeTotal: quick ? c.patienceMax : c.time,
    stageIdx: 0,
    trim: null, cabbage: quick ? { fineness: 0.7, pieces: 30, prepped: true } : null,
    season: null, cook: null, plate: null,
    timedOut: false,
  };
  game.timer.warned = false;
  ui.showHud(true);
  ui.setOrder(`${mode === 'contest' ? '🏆' : c.vip ? '⭐VIP' : c.face} ${dish.name}${c.order ? ` · ${orderName(c.order)}` : ''}`);
  game.goStage(0);
};



game.goStage = function (idx) {
  const st = game.state;
  st.stageIdx = idx;
  if (idx >= st.stages.length) { game.finish(); return; }
  const stage = st.stages[idx];
  st.stepCfg = stage;
  ui.setStage(idx + 1, st.stages.length, stage.name);
  game.timer.running = true;
  game.setScene(stage.scene);
};

game.nextStage = function () {
  // 시간 초과로 이미 결과 화면에 간 뒤, 이전 단계의 지연 전환이 늦게 도착하는 경우 무시
  if (!game.state || game.state.timedOut || game.state.aborted || game.scene instanceof ResultScene) return;
  sfx.ding(); game.goStage(game.state.stageIdx + 1);
};

game.finish = function () {
  game.timer.running = false;
  ui.showHud(false);
  game.setScene(ResultScene);
};

/** 요리 중 손님이 떠남 → 주문 취소 */
function abortOrder() {
  const st = game.state;
  if (!st || st.aborted) return;
  st.aborted = true;
  game.timer.running = false;
  sfx.fail();
  ui.toast('손님이 기다리다 나갔어요…', { bad: true, sub: '😠 평판 하락', ms: 1600 });
  setTimeout(() => game.toHall(), 1500);
}

game.toShop = function () {
  game.state = null;
  game.timer.running = false;
  ui.showHud(false);
  ui.hideOverlay();
  game.day = null;
  game.setScene(ShopScene);
};

game.toTitle = function () {
  game.state = null;
  game.timer.running = false;
  ui.showHud(false);
  ui.hideOverlay();
  game.day = null;
  game.setScene(TitleScene);
};

game.toStory = function (kind, next) { ui.showHud(false); ui.hideOverlay(); game.setScene(StoryScene, kind, next); };

/** 단계 안내 카드: 읽는 동안 타이머 정지. 영업 중에는 처음 한 번만 보여준다 */
game.instruct = function ({ icon, title, lines, button = '시작!' }) {
  const st = game.state;
  const key = st?.stages?.[st.stageIdx]?.key || 'prep';
  const seen = game.save.flags[`tut_${key}`];
  if (st?.quick && seen) return Promise.resolve();
  return new Promise((res) => {
    game.timer.paused = true;
    ui.showCard(`
      <div class="icon">${icon}</div>
      <h2>${title}</h2>
      <ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
      <div class="row"><button class="btn" data-act="go">${button}</button></div>`, {
      go: () => { ui.hideOverlay(); game.timer.paused = false; game.setFlag(`tut_${key}`); initAudio(); res(); },
    });
  });
};

// ---------------- 일시정지 / 뒤로가기 ----------------
const canPause = () => !!game.scene && (game.scene.pausable ?? !!game.state);
game.pause = function () {
  if (game.paused || !canPause()) return;
  game.paused = true;
  setSizzle(0);
  game._pauseCard = true;
  const inOrder = !!game.state;
  ui.showCard(`
    <div class="icon">⏸</div><h2>일시정지</h2>
    <div class="col">
      <button class="btn" data-act="resume">계속하기</button>
      <button class="btn secondary" data-act="help">도움말</button>
      <button class="btn secondary" data-act="settings">설정</button>
      ${inOrder && game.state.mode === 'order' ? '<button class="btn secondary" data-act="giveup">이 주문 포기하기</button>' : ''}
      <button class="btn secondary" data-act="quit">${game.day ? '영업 중단하고 나가기' : '나가기'}</button>
    </div>`, {
    resume: () => game.resume(),
    help: () => { game.showHelpCard(() => { game.paused = false; game._pauseCard = false; game.pause(); }); },
    settings: () => game.showSettings(() => { game.paused = false; game._pauseCard = false; game.pause(); }),
    giveup: () => {
      game.resume();
      if (game.day && game.state) F.playerCancel(game.day, game.state.customer.uid);
      game.toHall();
    },
    quit: () => {
      game.paused = false; game._pauseCard = false;
      if (game.day) { game.scene = null; game.endDayNow(); } else game.toShop();
    },
  });
};
game.resume = function () {
  game.paused = false; game._pauseCard = false;
  ui.hideOverlay();
};
/** 영업 강제 종료: 남은 대기 손님은 놓친 것으로 처리 */
game.endDayNow = function () {
  const d = game.day;
  if (!d) return game.toShop();
  for (const c of d.customers) if (c.state === 'waiting' || c.state === 'ordering' || c.state === 'walking') { c.state = 'waiting'; c.patience = 0; }
  d.arrivals = []; d.length = Math.min(d.length, d.t);
  F.stepDay(d, 0.01, game.save.biz);
  d.done = true;
  game.toHall();
};

game.showSettings = function (back) {
  const on = (v) => (v ? 'on' : '');
  ui.showCard(`
    <div class="icon">⚙️</div><h2>설정</h2>
    <div class="col">
      <button class="btn secondary toggle ${on(prefs.sound)}" data-act="sound">🔊 사운드 <b>${prefs.sound ? '켜짐' : '꺼짐'}</b></button>
      <button class="btn secondary toggle ${on(prefs.haptics)}" data-act="haptics">📳 진동 <b>${prefs.haptics ? '켜짐' : '꺼짐'}</b></button>
      <button class="btn secondary" data-act="help">❓ 도움말 다시 보기</button>
      <button class="btn secondary" data-act="prologue">📖 프롤로그 다시 보기</button>
      <button class="btn secondary" data-act="credits">📷 음식 사진 출처</button>
      <button class="btn secondary" data-act="reset">🗑️ 데이터 초기화</button>
    </div>
    <p class="ver">쿠킹 시뮬레이터 v2.0 · Made with ❤️ & 🥩</p>
    <div class="row"><button class="btn" data-act="back">닫기</button></div>`, {
    sound: () => { game.setPref('sound', !prefs.sound); game.showSettings(back); },
    haptics: () => { game.setPref('haptics', !prefs.haptics); game.showSettings(back); },
    help: () => game.showHelpCard(() => game.showSettings(back)),
    credits: () => game.showCredits(() => game.showSettings(back)),
    prologue: () => { game.paused = false; game._pauseCard = false; game.day = null; game.toStory('prologue', () => game.toTitle()); },
    reset: () => ui.showCard(`<div class="icon">⚠️</div><h2>정말 초기화할까요?</h2><p>가게·자금·직원·메달·튜토리얼 기록이 모두 사라져요.</p>
      <div class="row"><button class="btn secondary" data-act="no">취소</button><button class="btn" data-act="yes">초기화</button></div>`, {
      no: () => game.showSettings(back),
      yes: () => { try { localStorage.clear(); } catch (e) { /* 무시 */ } game.save = loadSave(); game.paused = false; game._pauseCard = false; game.day = null; game.setScene(SplashScene); },
    }),
    back: () => (back ? back() : ui.hideOverlay()),
  });
};

/** 음식 사진 출처 (CC 라이선스 표기) */
game.showCredits = async function (back) {
  let list = [];
  try { list = await (await fetch('assets/CREDITS.json')).json(); } catch (e) { /* 오프라인 등 */ }
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  ui.showCard(`
    <div class="icon">📷</div><h2>음식 사진 출처</h2>
    <p>음식 그래픽은 아래 사진을 잘라내고 색을 보정해 만들었어요. 원작자분들께 감사드립니다.</p>
    <ul class="credits">${list.map((c) => `<li><b>${esc(c.use)}</b> — “${esc(c.title)}” · ${esc(c.author)} · ${esc(c.license)}<br><small>${esc(c.source)}</small></li>`).join('') || '<li>목록을 불러오지 못했어요</li>'}</ul>
    <div class="row"><button class="btn" data-act="back">닫기</button></div>`, { back: () => (back ? back() : ui.hideOverlay()) });
};

/** 짧은 도움말 카드 (일시정지/설정에서) */
game.showHelpCard = function (back) {
  ui.showCard(`
    <div class="icon">❓</div><h2>도움말</h2>
    <ul>
      <li><b>영업</b> — 손님이 앉으면 아래 주문표가 생겨요. <b>🔪 직접 조리</b>를 누르면 요리 시작! 그동안에도 가게 시간은 흘러요.</li>
      <li><b>직원</b> — 고용한 직원은 일반 주문을 자동으로 조리해요. 품질은 사장님보다 낮고, <b>VIP는 사장님만</b> 상대해요.</li>
      <li><b>손질</b> — 칼은 가로로만. 두 손가락/⟲⟳로 고기를 돌려 근막만 잘라요.</li>
      <li><b>시즈닝</b> — 휴대폰을 흔들어 소금·후추, 휘휘 돌려 오일.</li>
      <li><b>굽기</b> — 휴대폰을 위로 휙! 너무 약하거나 세면 접혀요.</li>
      <li><b>가격</b> — 평판이 오를수록 단가를 올릴 수 있지만, 비싸면 만족도가 떨어져요.</li>
    </ul>
    <div class="row"><button class="btn" data-act="back">확인</button></div>`, { back: () => (back ? back() : ui.hideOverlay()) });
};

onBackButton(() => {
  if (game._pauseCard) return game.resume();
  if (document.getElementById('overlay').classList.contains('show') && game.scene?.onBack?.()) return;
  if (canPause()) return game.pause();
  game.scene?.onBack?.();
});
onAppPause(() => { setSizzle(0); if (canPause() && !game.paused) game.pause(); });
document.getElementById('pause-btn').addEventListener('click', (e) => { e.stopPropagation(); game.pause(); });

// ---------------- 입력 ----------------
const pointers = new Map();
let twist = null;
function toLocal(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId, t: performance.now() }; }

canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  if (game.paused) return;
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
  if (game.paused) return;
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
  if (game.paused) dt = 0;
  game.time += dt;
  decayMotion(dt);
  const st = game.state;
  // 실시간 영업: 어떤 화면에 있든(요리 중에도) 가게는 계속 돌아간다. 안내 카드를 읽을 때는 멈춤
  if (game.day && !game.day.done && dt > 0 && !game.timer.paused) {
    F.stepDay(game.day, dt, game.save.biz);
    if (!(game.scene instanceof HallScene)) relayEvents();
  }
  if (st && game.timer.running && !game.timer.paused && dt > 0) {
    if (st.mode === 'order') {
      // 주문 타이머 = 손님 인내심
      const c = st.customer;
      st.timeLeft = Math.max(0, c.patience);
      if (c.state !== 'waiting') abortOrder();
    } else {
      st.timeLeft -= dt;
      if (st.timeLeft <= 30 && !game.timer.warned) { game.timer.warned = true; ui.toast('30초 남았어요!', { bad: true }); }
    }
    if (st.timeLeft <= 10 && st.timeLeft > 0) { tickAcc += dt; if (tickAcc > 1) { tickAcc = 0; sfx.tick(); } }
    if (st.mode !== 'order' && st.timeLeft <= 0) {
      st.timeLeft = 0;
      game.timer.running = false;
      game.scene?.onTimeout ? game.scene.onTimeout() : onTimeout();
    }
    ui.setTimer(st.timeLeft, st.timeTotal);
    if (st.mode === 'order' && game.day) ui.setOrderBadge(F.waitingOrders(game.day).filter((c) => !c.assigned).length);
  }
  try {
    if (dt > 0 || !game.paused) game.scene?.update?.(dt);
    ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
    game.scene?.draw?.(ctx);
  } catch (err) {
    console.error(err);
  }
  requestAnimationFrame(frame);
}

/** 요리 중에 가게에서 일어난 일 알림 (VIP 주문, 손님 이탈) */
function relayEvents() {
  const evs = game.day.events.splice(0);
  for (const e of evs) {
    if (e.type === 'lost' && e.uid !== game.state?.customer?.uid) ui.notify(`😠 ${e.name}님이 기다리다 나갔어요`, 'bad');
    else if (e.type === 'order') {
      const c = game.day.customers.find((x) => x.uid === e.uid);
      if (c?.vip) ui.notify(`⭐ VIP ${c.name}님 주문 도착!`, 'vip');
    } else if (e.type === 'served' && e.by === 'staff') ui.notify(`👨‍🍳 직원이 ${e.name}님 요리 완성 (${e.score}점)`);
  }
}

function onTimeout() {
  const st = game.state;
  st.timedOut = true;
  sfx.fail();
  ui.toast('시간 초과!', { bad: true, sub: '지금 상태로 심사받아요' });
  setTimeout(() => game.finish(), 1400);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) setSizzle(0); });

resize();
// 실사 음식 사진을 불러오면 텍스처를 다시 만든다 (실패 시 절차적 텍스처 유지)
loadPhotos().then(() => { texCache.clear(); game.useTex(game.tex?.marbling ?? 1); });
game.setScene(SplashScene);
requestAnimationFrame(frame);
