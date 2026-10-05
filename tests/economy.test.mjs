import test from 'node:test';
import assert from 'node:assert/strict';
import { setDifficulty } from '../www/js/difficulty.js';
setDifficulty('hard'); // 기존 밸런스(원래 손맛) 기준 테스트
import * as E from '../www/js/economy.js';

const withRep = (rep) => ({ ...E.newBusiness(), rep });

test('평판이 오르면 적정가(올릴 수 있는 단가)도 오른다', () => {
  const d = E.DISHES[0];
  assert.ok(E.fairPrice(withRep(90), d) > E.fairPrice(withRep(50), d) * 1.2);
});

test('단가가 너무 높으면 만족도가 떨어진다, 싸면 약간 오른다', () => {
  const f = 20000;
  assert.ok(E.orderSatisfaction(85, f * 1.5, f) < E.orderSatisfaction(85, f, f) - 40);
  assert.ok(E.orderSatisfaction(85, f * 0.8, f) > E.orderSatisfaction(85, f, f));
});

test('오래 기다리게 하면 만족도 감소', () => {
  assert.ok(E.orderSatisfaction(85, 1, 1, 0.9) < E.orderSatisfaction(85, 1, 1, 0.1) - 10);
});

test('비싸면 손님(주문) 수가 급감, 싸면 완만하게 증가', () => {
  const b = withRep(70); const f = E.fairPrice(b, E.DISHES[0]);
  const v = (m) => E.visitors(b, f * m, f);
  assert.ok(v(1.4) < v(1) * 0.5);
  assert.ok(v(0.7) <= v(1) * 1.3);
});

test('마감 정산: 매출 − 재료비 − 인건비, 평판은 평균 만족도 쪽으로', () => {
  const b = { ...withRep(50), staff: [{ id: 'a', tier: 'junior' }] };
  const stats = { served: 5, lost: 1, revenue: 100000, cost: 30000, sats: [{ sat: 90, w: 1 }, { sat: 90, w: 1 }, { sat: 0, w: 1 }] };
  const { biz, report } = E.endOfDay(b, stats);
  assert.equal(report.profit, 100000 - 30000 - E.staffTier('junior').wage);
  assert.equal(report.avgSat, 60);
  assert.ok(biz.rep > 50 && biz.rep < 60);
  assert.equal(biz.day, 2);
});

test('직원 고용: 자리·자금·가게 단계 제한', () => {
  let b = { ...E.newBusiness(), money: 1e6 };
  assert.ok(E.canHire(b, 'junior').ok);
  assert.ok(!E.canHire(b, 'cook').ok, '숙련 요리사는 2단계부터');
  b = E.hire(b, 'junior');
  assert.equal(b.staff.length, 1);
  assert.ok(!E.canHire(b, 'junior').ok, '1단계 자리 1개');
  b = E.fire(b, b.staff[0].id);
  assert.equal(b.staff.length, 0);
});

test('확장 조건: 자금·평판·대회 입상', () => {
  let b = { ...E.newBusiness(), money: 1e6, rep: 70 };
  assert.ok(E.upgradeStatus(b).ok);
  b = E.upgrade(b);
  assert.equal(b.level, 2);
  assert.ok(b.prices.tenderloin > 0 && b.prices.carbonara > 0, '새 요리 해금');
  b = { ...b, money: 2e7, rep: 80 };
  assert.ok(!E.upgradeStatus(b).ok, '시 대회 입상 전에는 3단계 불가');
  b = { ...b, medals: [{ contest: 'city', place: 2, day: 3 }] };
  assert.ok(E.upgradeStatus(b).ok);
});

test('대회 입상 시 상금·명성(손님 증가), 쿨다운', () => {
  const b = { ...E.newBusiness(), money: 1e6 };
  const c = E.CONTESTS[0];
  assert.ok(E.contestStatus(b, c).ok);
  const { biz, report } = E.settleContest(b, c, 95, [80, 70, 60, 50, 40]);
  assert.equal(report.place, 1);
  assert.equal(biz.money, 1e6 - c.fee + c.prizes[0]);
  const price = 18000, fair = E.fairPrice(biz, E.DISHES[0]);
  assert.ok(E.visitors(biz, price, fair) > E.visitors({ ...biz, fame: { mult: 1, days: 0 } }, price, fair) * 1.4);
  assert.ok(!E.contestStatus(biz, c).ok, '쿨다운');
  const lose = E.settleContest(b, c, 30, [80, 70, 60, 50, 40]);
  assert.equal(lose.report.medal, false);
  assert.equal(lose.biz.money, 1e6 - c.fee);
});

test('명성 효과는 며칠 뒤 사라진다', () => {
  const st = { served: 1, lost: 0, revenue: 1, cost: 0, sats: [{ sat: 80, w: 1 }] };
  let b = { ...E.newBusiness(), fame: { mult: 1.5, days: 2 } };
  b = E.endOfDay(b, st).biz; assert.equal(b.fame.mult, 1.5);
  b = E.endOfDay(b, st).biz; assert.equal(b.fame.mult, 1);
});

test('가게 단계가 오를수록 요리와 단가가 늘어난다', () => {
  const counts = [1, 2, 3, 4].map((lv) => E.unlockedDishes({ level: lv }).length);
  assert.deepEqual(counts, [...counts].sort((a, b) => a - b));
  assert.ok(counts[3] >= 10, '양식 메뉴 10종 이상');
  const top = [1, 2, 3, 4].map((lv) => Math.max(...E.DISHES.filter((d) => d.level === lv).map((d) => d.base)));
  assert.deepEqual(top, [...top].sort((a, b) => a - b), '단계별 최고 단가 증가');
});

test('손님 생성: 필수 필드와 까다로움 증가', () => {
  const c1 = E.makeCustomer({ level: 1 }, () => 0.3), c4 = E.makeCustomer({ level: 4 }, () => 0.3);
  for (const k of ['order', 'saltPref', 'time', 'strict', 'name']) assert.ok(c1[k] != null);
  assert.ok(c4.strict > c1.strict);
});
