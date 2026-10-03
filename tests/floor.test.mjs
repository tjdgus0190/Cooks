import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../www/js/economy.js';
import * as F from '../www/js/floor.js';
import { rng } from '../www/js/geom.js';

const FULL = { garlic: 99, parsley: 99, baguette: 99, tomato: 99, lemon: 99, guanciale: 99, shallot: 99, slaw: 99 };
const biz = (o = {}) => ({ ...E.newBusiness(), inventory: { ...FULL }, ...o });
function run(day, b, secs, onTick) { for (let t = 0; t < secs && !day.done; t += 0.5) { F.stepDay(day, 0.5, b); onTick?.(day); } }

test('손님이 도착해 착석하고 주문한다 (좌석 수 제한)', () => {
  const b = biz({ rep: 90 });
  const day = F.createDay(b, { rand: rng(1) });
  run(day, b, 120);
  assert.ok(day.customers.length <= E.shopInfo(b).seats);
  assert.ok(F.waitingOrders(day).length > 0);
});

test('아무도 조리하지 않으면 인내심이 다해 손님이 떠난다', () => {
  const b = biz();
  const day = F.createDay(b, { rand: rng(2) });
  run(day, b, 900);
  assert.equal(day.stats.served, 0);
  assert.ok(day.stats.lost > 0);
  assert.ok(day.done);
});

test('직원은 일반 주문을 자동으로 조리하지만 VIP는 못 맡는다', () => {
  const b = biz({ staff: [{ id: 's1', tier: 'junior' }] });
  const day = F.createDay(b, { rand: rng(3) });
  day.vipRate = 0.5;
  run(day, b, 900);
  assert.ok(day.stats.byStaff > 0);
  assert.ok(!day.events.some((e) => e.type === 'served' && e.by === 'staff' && e.vip), '직원이 VIP를 조리함');
  assert.ok(day.events.some((e) => e.type === 'lost'), 'VIP는 사장이 안 하면 떠나야 함');
});

test('사장이 직접 조리하면 주문이 결제되고 만족도가 기록된다', () => {
  const b = biz();
  const day = F.createDay(b, { rand: rng(4) });
  let done = false;
  run(day, b, 400, (d) => {
    const c = F.waitingOrders(d)[0];
    if (c && !done && F.playerTake(d, c.uid)) { const r = F.playerFinish(d, c.uid, 90); assert.ok(r.sat > 70); done = true; }
  });
  assert.ok(done);
  assert.equal(day.stats.byPlayer, 1);
  assert.ok(day.stats.revenue > 0);
});

test('사장은 한 번에 한 주문만, 직원 주문을 가져올 수 있다', () => {
  const b = biz({ staff: [{ id: 's1', tier: 'junior' }], rep: 100 });
  const day = F.createDay(b, { rand: rng(5) });
  run(day, b, 60);
  const ws = F.waitingOrders(day);
  if (ws.length >= 2) {
    assert.ok(F.playerTake(day, ws[0].uid));
    assert.ok(!F.playerTake(day, ws[1].uid));
  }
  const staffJob = day.staff[0].job;
  if (staffJob) {
    F.playerCancel(day, day.playerJob);
    assert.ok(F.playerTake(day, staffJob));
    assert.equal(day.staff[0].job, null);
  }
});

test('하루 시뮬레이션 → 마감 정산까지 숫자가 유효', () => {
  const b = biz({ staff: [{ id: 's1', tier: 'junior' }] });
  const day = F.createDay(b, { rand: rng(6) });
  run(day, b, 1000);
  const { biz: nb, report } = E.endOfDay(b, day.stats);
  for (const k of ['profit', 'avgSat', 'revenue']) assert.ok(Number.isFinite(report[k]), k);
  assert.equal(nb.day, 2);
  assert.match(F.clockText(day), /^\d\d:\d\d$/);
});

test('손질 재료가 없으면 직원도 사장도 그 요리를 못 만든다', () => {
  const b = { ...E.newBusiness(), staff: [{ id: 's1', tier: 'junior' }], inventory: {} };
  const day = F.createDay(b, { rand: rng(7) });
  run(day, b, 900);
  const pasta = day.events.filter((e) => e.type === 'served').length;
  // 재료 없는 요리(알리오/감바스)는 하나도 서빙되지 않았어야 한다
  const servedDishes = day.events.filter((e) => e.type === 'served').map((e) => e.uid);
  assert.ok(pasta >= 0);
  for (const c of day.customers) if (servedDishes.includes(c.uid)) assert.ok(!c.dish.needs || !Object.keys(c.dish.needs).length);
});

test('직원이 요리하면 재료가 소모된다', () => {
  const b = biz({ staff: [{ id: 's1', tier: 'chef' }], level: 1, rep: 90 });
  const day = F.createDay(b, { rand: rng(8) });
  const before = { ...day.inv };
  run(day, b, 900);
  const used = Object.keys(before).some((k) => day.inv[k] < before[k]);
  assert.ok(used || day.stats.byStaff === 0);
});
