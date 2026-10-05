import test from 'node:test';
import assert from 'node:assert/strict';
import { setDifficulty } from '../www/js/difficulty.js';
setDifficulty('hard'); // 기존 밸런스(원래 손맛) 기준 테스트
import { createSteak, stepSteak, flipSteak, stepPan, coreTemp, coreMax, restSteak, cloneSteak, HEAT_LEVELS, TIME_SCALE, donenessOf, meatColorAt, crustColor } from '../www/js/sim.js';

function cook(level, flipEvery, targetCore) {
  const s = createSteak(); const pan = { temp: 222 };
  let t = 0, last = 0;
  while (t < 1200) {
    stepPan(pan, 0.5, HEAT_LEVELS[level], true); stepSteak(s, 0.5, pan.temp); t += 0.5;
    if (t - last >= flipEvery) { flipSteak(s); last = t; }
    const r = cloneSteak(s); restSteak(r, 90);
    if (coreMax(r) >= targetCore) return { s, t, rested: r };
  }
  return null;
}

test('중불로 자주 뒤집으면 미디엄 레어를 1분 내외(게임시간)에 만들 수 있다', () => {
  const r = cook('mid', 30, 55.5);
  assert.ok(r);
  const gameSec = r.t / TIME_SCALE;
  assert.ok(gameSec > 25 && gameSec < 80, `game sec ${gameSec}`);
  // 크러스트는 노릇노릇 범위
  for (const b of r.s.brown) assert.ok(b > 0.8 && b < 1.6, `brown ${b}`);
});

test('강불로만 구우면 겉이 탄다, 약불이면 허옇다', () => {
  const hi = cook('high', 30, 55.5);
  assert.ok(Math.max(...hi.s.brown) > 1.75);
  const lo = cook('low', 30, 55.5);
  assert.ok(Math.max(...lo.s.brown) < 0.5);
});

test('잔열 조리: 레스팅하면 중심 온도가 올라간다', () => {
  const r = cook('mid', 30, 55.5);
  assert.ok(coreMax(r.rested) > coreTemp(r.s) + 3);
});

test('뒤집기는 온도 분포를 뒤집고 아랫면을 바꾼다', () => {
  const s = createSteak();
  stepSteak(s, 60, 200);
  const bottom = s.T[0], down = s.down;
  flipSteak(s);
  assert.equal(s.T[s.n - 1], bottom);
  assert.equal(s.down, 1 - down);
});

test('수치 안정성: 긴 시간 시뮬레이션에도 NaN/폭주 없음', () => {
  const s = createSteak();
  for (let i = 0; i < 4000; i++) stepSteak(s, 0.5, 260, i % 3 === 0 ? 0.5 : 1);
  for (const v of s.T) { assert.ok(Number.isFinite(v)); assert.ok(v < 300 && v > 0); }
});

test('굽기 단계 이름과 색상 테이블', () => {
  assert.equal(donenessOf(55).key, 'medium-rare');
  assert.equal(donenessOf(75).key, 'well-done');
  assert.equal(meatColorAt(10).length, 3);
  assert.equal(crustColor(0).a, 0);
  assert.equal(crustColor(1.1).a, 1);
});
