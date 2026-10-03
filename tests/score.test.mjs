import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, plateScore, crustQuality } from '../www/js/score.js';
import { CUSTOMERS } from '../www/js/data.js';

const base = () => ({
  customer: CUSTOMERS[0], timeLeft: 100, timeTotal: 300, timedOut: false,
  trim: { removed: 1, damage: 0 },
  cabbage: { fineness: 0.9, pieces: 20 },
  season: { salt: 2.4, pepper: 0.8, oil: 10, coverage: 0.9 },
  cook: { core: 55.5, brown: [1.1, 1.05], up: 0, flips: 6, folds: 0, foldTime: 0 },
  plate: {
    plateR: 150, steak: { x: -10, y: -5, rot: 0 }, sliced: true,
    items: [
      { key: 'slaw', x: 70, y: 50 }, { key: 'tomato', x: 90, y: 10 }, { key: 'tomato', x: 80, y: 80 }, { key: 'tomato', x: 100, y: 60 },
      { key: 'asparagus', x: -80, y: 60 }, { key: 'rosemary', x: 20, y: -70 }, { key: 'garlic', x: 5, y: 70 },
    ],
    sauce: [[[-90, 90], [0, 95], [60, 90]]],
  },
});

test('완벽한 요리는 90점 이상, 별 5개', () => {
  const r = computeScore(base());
  assert.ok(r.total >= 90, `total ${r.total}`);
  assert.equal(r.stars, 5);
  assert.equal(r.mood, 'love');
});

test('소금을 너무 많이 치면 감점되고 짜다는 평가', () => {
  const s = base(); s.season.salt = 6;
  const r = computeScore(s);
  assert.ok(r.total < computeScore(base()).total - 8);
  assert.ok(r.comments.some((c) => c.includes('짜')));
});

test('덜 익으면 큰 감점, 굽기 평가 문구', () => {
  const s = base(); s.cook.core = 42;
  const r = computeScore(s);
  assert.ok(r.total < 75);
  assert.ok(r.comments.some((c) => c.includes('날것')));
});

test('탄 크러스트는 감점', () => {
  assert.equal(crustQuality(1.1), 1);
  assert.ok(crustQuality(2.0) < 0.1);
  assert.ok(crustQuality(0.3) < 0.3);
});

test('짠맛 선호 손님은 같은 소금량에서 덜 짜다고 느낀다', () => {
  const s = base(); s.season.salt = 3.3;
  const a = computeScore(s);
  s.customer = CUSTOMERS[1];
  s.cook.core = 61;
  const b = computeScore(s);
  assert.ok(b.parts.find((p) => p.key === 'season').score > a.parts.find((p) => p.key === 'season').score);
});

test('시간 초과(굽기 전)면 손님이 떠나고 10점 이하', () => {
  const s = base(); s.cook = null; s.plate = null; s.timedOut = true; s.timeLeft = 0;
  const r = computeScore(s);
  assert.ok(r.total <= 10);
  assert.equal(r.mood, 'angry');
});

test('빈 접시/한쪽 쏠림 플레이팅은 낮은 점수', () => {
  const p = base().plate;
  const good = plateScore(p).score;
  const empty = plateScore({ ...p, items: [], sauce: [], steak: { x: 110, y: 0, rot: 0 } }).score;
  assert.ok(good > 10, `good ${good}`);
  assert.ok(empty < 3, `empty ${empty}`);
});

test('일부 단계 데이터가 없어도 오류 없이 계산', () => {
  const s = base(); s.trim = null; s.cabbage = null; s.season = null;
  const r = computeScore(s);
  assert.ok(Number.isFinite(r.total));
});
