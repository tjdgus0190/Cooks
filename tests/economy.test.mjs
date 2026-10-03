import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../www/js/economy.js';

const withRep = (rep) => ({ ...E.newBusiness(), rep });

test('평판이 오르면 적정가(올릴 수 있는 단가)도 오른다', () => {
  const d = E.DISHES[0];
  assert.ok(E.fairPrice(withRep(90), d) > E.fairPrice(withRep(50), d) * 1.2);
});

test('하루 이익은 적정가 근처에서 최대 — 너무 비싸도, 너무 싸도 손해', () => {
  const b = withRep(70); const d = E.DISHES[0]; const f = E.fairPrice(b, d);
  const profit = (m) => E.settleDay({ ...b, prices: { strip: f * m } }, 'strip', 85).report.profit;
  assert.ok(profit(1) > profit(0.7));
  assert.ok(profit(1) > profit(1.3));
});

test('단가가 너무 높으면 만족도가 떨어지고 평판이 하락한다', () => {
  const b = withRep(80); const f = E.fairPrice(b, E.DISHES[0]);
  const fair = E.settleDay({ ...b, prices: { strip: f } }, 'strip', 85);
  const gouge = E.settleDay({ ...b, prices: { strip: f * 1.5 } }, 'strip', 85);
  assert.ok(gouge.report.sat < fair.report.sat - 40);
  assert.ok(gouge.biz.rep < b.rep);
  assert.equal(gouge.report.priceVerdict, 'expensive');
});

test('확장 조건: 자금·평판·대회 입상', () => {
  let b = { ...E.newBusiness(), money: 3e6, rep: 70 };
  assert.ok(E.upgradeStatus(b).ok);
  b = E.upgrade(b);
  assert.equal(b.level, 2);
  assert.ok(b.prices.tenderloin > 0, '새 요리 해금');
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
  let b = { ...E.newBusiness(), fame: { mult: 1.5, days: 2 } };
  b = E.settleDay(b, 'strip', 80).biz; assert.equal(b.fame.mult, 1.5);
  b = E.settleDay(b, 'strip', 80).biz; assert.equal(b.fame.mult, 1);
});

test('가게 단계가 오를수록 요리와 단가가 늘어난다', () => {
  assert.equal(E.unlockedDishes({ level: 1 }).length, 1);
  assert.equal(E.unlockedDishes({ level: 4 }).length, 4);
  const bases = E.DISHES.map((d) => d.base);
  assert.deepEqual(bases, [...bases].sort((a, b) => a - b));
});

test('손님 생성: 필수 필드와 까다로움 증가', () => {
  const c1 = E.makeCustomer({ level: 1 }, () => 0.3), c4 = E.makeCustomer({ level: 4 }, () => 0.3);
  for (const k of ['order', 'saltPref', 'time', 'strict', 'name']) assert.ok(c1[k] != null);
  assert.ok(c4.strict > c1.strict);
});
