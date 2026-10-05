// 실시간 영업 시뮬레이션 (타이쿤): 손님 도착 → 착석·주문 → 대기(인내심) → 조리(사장/직원) → 식사·결제 → 퇴장
// 화면과 분리된 순수 로직 — 요리 미니게임 중에도 계속 돌아간다 (단위 테스트 대상)
import * as E from './economy.js';
import { missingFor, consume } from './recipes.js';
import { diff } from './difficulty.js';

export const DAY_LENGTH = 300;      // 영업 시간(초) — 이후 새 손님 없음
export const ORDER_DELAY = 4;       // 착석 후 주문까지
export const EAT_TIME = 9;
const DOOR_QUEUE = 2;

let uid = 1;

export function createDay(biz, { rand = Math.random, length = DAY_LENGTH, slaw = 0.5, inv = null } = {}) {
  const dishes = E.unlockedDishes(biz);
  // 요리별 기대 손님 수 (가격 탄력성 반영) → 총 손님 수와 요리 선택 확률
  const weights = dishes.map((d) => {
    const price = biz.prices[d.key] ?? d.base;
    return { d, price, fair: E.fairPrice(biz, d), w: E.visitors(biz, price, E.fairPrice(biz, d)) };
  });
  const total = Math.max(1, Math.round(weights.reduce((a, x) => a + x.w, 0) / weights.length * diff.arrivals));
  const sumW = weights.reduce((a, x) => a + x.w, 0);
  // 첫 손님은 바로, 이후 점심·저녁 피크가 생기도록 분포
  const arrivals = Array.from({ length: total }, (_, i) => {
    if (i === 0) return 3;
    const u = rand();
    const peak = rand() < 0.5 ? 0.3 : 0.75;
    return Math.min(length - 40, Math.max(5, (peak + (u - 0.5) * 0.5) * (length - 40)));
  }).sort((a, b) => a - b);
  const vipRate = 0.1 + (biz.level - 1) * 0.04;
  const shop = E.shopInfo(biz);
  return {
    t: 0, length, open: true, done: false,
    slaw,
    inv: { ...(inv || biz.inventory || {}) },   // 오늘 쓸 손질 재료 (준비대에서 추가)
    arrivals, weights, sumW, vipRate,
    seats: shop.seats,
    customers: [],
    door: [],
    staff: biz.staff.map((s) => ({ ...s, ...E.staffTier(s.tier), job: null, jt: 0 })),
    playerJob: null,
    autoAssign: true,
    stats: { served: 0, lost: 0, balked: 0, revenue: 0, cost: 0, tips: 0, sats: [], byPlayer: 0, byStaff: 0 },
    events: [],
    rand,
    level: biz.level,
  };
}

function pickDish(day) {
  let r = day.rand() * day.sumW;
  for (const x of day.weights) { r -= x.w; if (r <= 0) return x; }
  return day.weights[day.weights.length - 1];
}

function spawn(day, biz) {
  const x = pickDish(day);
  const vip = day.rand() < day.vipRate;
  const guest = E.makeCustomer(biz, day.rand, { dish: x.d });
  const patience = ((vip ? 210 : 150 + day.rand() * 30) - (day.level - 1) * 8) * diff.patience;
  return {
    ...guest,
    uid: uid++,
    vip,
    strict: guest.strict + (vip ? 0.25 : 0),
    dish: x.d, price: x.price * (vip ? 1.8 : 1), fair: x.fair * (vip ? 1.8 : 1),
    state: 'walking', st: 0,
    patience, patienceMax: patience,
    assigned: null,         // 'player' | staff id
    seat: -1,
    sat: null,
    look: { x: day.rand() },
  };
}

function freeSeat(day) {
  const used = new Set(day.customers.filter((c) => c.seat >= 0 && c.state !== 'gone').map((c) => c.seat));
  for (let i = 0; i < day.seats; i++) if (!used.has(i)) return i;
  return -1;
}

function emit(day, type, c, extra = {}) { day.events.push({ type, uid: c?.uid, name: c?.name, t: day.t, ...extra }); }

export function waitingOrders(day) {
  return day.customers.filter((c) => c.state === 'waiting').sort((a, b) => a.patience - b.patience);
}

/** 주문 완료(사장 또는 직원) → 식사 시작, 결제 계산 */
export function serve(day, c, score, by) {
  if (c.state !== 'waiting') return null;
  const waitFrac = 1 - c.patience / c.patienceMax;
  const sat = E.orderSatisfaction(score, c.price, c.fair, waitFrac);
  const tipRate = sat >= 90 ? 0.1 : sat >= 80 ? 0.05 : 0;
  const pay = c.price * (1 + tipRate);
  c.state = 'eating'; c.st = 0; c.sat = sat; c.score = score; c.pay = pay; c.by = by;
  day.stats.served++;
  day.stats.revenue += pay;
  day.stats.tips += c.price * tipRate;
  day.stats.cost += c.dish.base * 0.35;
  day.stats.sats.push({ sat, w: c.vip ? 2 : 1 });
  if (by === 'player') day.stats.byPlayer++; else day.stats.byStaff++;
  emit(day, 'served', c, { sat, pay, by, score, vip: c.vip });
  return { sat, pay, tipRate };
}

function lose(day, c) {
  c.state = 'leaving'; c.st = 0; c.sat = 0;
  day.stats.lost++;
  day.stats.sats.push({ sat: 0, w: c.vip ? 2 : 1 });
  if (day.playerJob === c.uid) day.playerJob = null;
  for (const s of day.staff) if (s.job === c.uid) { s.job = null; s.jt = 0; }
  emit(day, 'lost', c);
}

/** 사장이 직접 조리 시작 */
export function canCook(day, c) { return missingFor(c.dish, day.inv); }

export function playerTake(day, uidv) {
  const c = day.customers.find((x) => x.uid === uidv);
  if (!c || c.state !== 'waiting' || day.playerJob) return false;
  const staffHad = c.assigned && c.assigned !== 'player';
  if (!staffHad) { if (missingFor(c.dish, day.inv).length) return false; consume(c.dish, day.inv); }
  if (c.assigned && c.assigned !== 'player') {
    const s = day.staff.find((x) => x.id === c.assigned);
    if (s) { s.job = null; s.jt = 0; } // 직원에게서 가져옴
  }
  c.assigned = 'player';
  day.playerJob = c.uid;
  return true;
}
export function playerFinish(day, uidv, score) {
  const c = day.customers.find((x) => x.uid === uidv);
  day.playerJob = null;
  if (!c) return null;
  return serve(day, c, score, 'player');
}
export function playerCancel(day, uidv) {
  const c = day.customers.find((x) => x.uid === uidv);
  if (c && c.assigned === 'player') c.assigned = null;
  day.playerJob = null;
}

export function stepDay(day, dt, biz) {
  if (day.done) return;
  day.t += dt;
  day.open = day.t < day.length;
  // 도착
  while (day.arrivals.length && day.arrivals[0] <= day.t && day.open) {
    day.arrivals.shift();
    const c = spawn(day, biz);
    const seat = freeSeat(day);
    if (seat >= 0) { c.seat = seat; day.customers.push(c); emit(day, 'arrive', c); }
    else if (day.door.length < DOOR_QUEUE) { day.door.push(c); emit(day, 'queue', c); }
    else { day.stats.balked++; emit(day, 'balk', c); }
  }
  // 문 앞 대기 → 빈자리
  while (day.door.length && freeSeat(day) >= 0) {
    const c = day.door.shift();
    c.seat = freeSeat(day);
    c.patience -= 10; // 기다렸던 만큼
    day.customers.push(c);
    emit(day, 'arrive', c);
  }
  for (const c of day.customers) {
    c.st += dt;
    if (c.state === 'walking' && c.st > 1.5) { c.state = 'ordering'; c.st = 0; }
    else if (c.state === 'ordering' && c.st > ORDER_DELAY) { c.state = 'waiting'; c.st = 0; emit(day, 'order', c); }
    else if (c.state === 'waiting') {
      // 사장이 조리 중인 주문은 손님이 조리 과정을 보며 덜 지루해함
      c.patience -= dt * (c.assigned === 'player' ? 0.6 : c.assigned ? 0.8 : 1);
      if (c.patience <= 0) lose(day, c);
    } else if (c.state === 'eating' && c.st > EAT_TIME) { c.state = 'leaving'; c.st = 0; emit(day, 'paid', c, { pay: c.pay }); }
    else if (c.state === 'leaving' && c.st > 1.5) { c.state = 'gone'; }
  }
  day.customers = day.customers.filter((c) => c.state !== 'gone');
  // 직원: 놀고 있으면 사장이 안 맡은 일반 주문을 자동으로 맡는다
  for (const s of day.staff) {
    if (s.job) {
      const c = day.customers.find((x) => x.uid === s.job);
      if (!c || c.state !== 'waiting' || c.assigned !== s.id) { s.job = null; s.jt = 0; continue; }
      s.jt += dt;
      if (s.jt >= s.time) {
        const diff = (c.dish.level - 1) * 2 + (c.strict - 1) * 6;
        const q = Math.max(30, Math.min(95, s.skill - diff - (c.garnished === false ? 6 : 0) + (day.rand() - 0.5) * 12));
        serve(day, c, Math.round(q), 'staff');
        s.job = null; s.jt = 0;
      }
    } else if (day.autoAssign) {
      const c = waitingOrders(day).find((x) => !x.assigned && !x.vip && !missingFor(x.dish, day.inv).length);
      if (c) {
        consume(c.dish, day.inv);
        // 권장 가니쉬까지 있으면 제대로 담고, 없으면 품질 감점
        c.garnished = (c.dish.wantGarnish || []).every((k) => (day.inv[k] || 0) > 0);
        for (const k of c.dish.wantGarnish || []) if (day.inv[k] > 0) day.inv[k]--;
        c.assigned = s.id; s.job = c.uid; s.jt = 0; emit(day, 'staffTake', c, { staff: s.name });
      }
    }
  }
  // 마감: 영업 종료 후 남은 손님 처리
  if (!day.open && !day.arrivals.length) {
    day.arrivals = [];
    const active = day.customers.filter((c) => c.state !== 'leaving');
    if (!active.length && !day.door.length) day.done = true;
    if (day.t > day.length + 120) { for (const c of active) if (c.state === 'waiting') lose(day, c); day.door = []; day.done = true; }
  }
}

/** 시계 표시: 11:00 ~ 21:00 */
export function clockText(day) {
  const f = Math.min(1, day.t / day.length);
  const mins = 11 * 60 + Math.floor(f * 600);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
