import test from 'node:test';
import assert from 'node:assert/strict';
import { splitPolyByPath, polyArea, pointInPoly, polyMinWidth, resample } from '../www/js/geom.js';

const square = [[0, 0], [100, 0], [100, 100], [0, 100]];

test('직선 칼질은 다각형을 면적 보존하며 둘로 나눈다', () => {
  const r = splitPolyByPath(square, [[-10, 50], [110, 50]]);
  assert.ok(r);
  const a = Math.abs(polyArea(r[0])), b = Math.abs(polyArea(r[1]));
  assert.ok(Math.abs(a + b - 10000) < 1e-6);
  assert.ok(Math.abs(a - 5000) < 1e-6);
});

test('곡선(자유) 칼질도 궤적대로 자른다', () => {
  const path = [[-10, 30], [30, 30], [50, 70], [70, 30], [110, 30]];
  const r = splitPolyByPath(square, path);
  assert.ok(r);
  const sum = Math.abs(polyArea(r[0])) + Math.abs(polyArea(r[1]));
  assert.ok(Math.abs(sum - 10000) < 1e-6);
  // 궤적 꺾임점이 조각의 꼭짓점으로 포함되어야 한다
  assert.ok(r.some((p) => p.some(([x, y]) => x === 50 && y === 70)));
});

test('끝까지 관통하지 않은 칼질은 자르지 않는다', () => {
  assert.equal(splitPolyByPath(square, [[-10, 50], [60, 50]]), null);
  assert.equal(splitPolyByPath(square, [[20, 20], [80, 80]]), null);
});

test('안에서 시작해도 밖→안→밖 구간이 있으면 자른다', () => {
  const r = splitPolyByPath(square, [[50, 50], [150, 50], [150, 20], [-20, 20]]);
  assert.ok(r);
});

test('반복 채썰기: 조각 수 증가 및 총 면적 보존', () => {
  let pieces = [square];
  for (let i = 1; i < 10; i++) {
    const y = i * 10;
    const next = [];
    for (const p of pieces) { const r = splitPolyByPath(p, [[-5, y], [105, y + 0.5]]); r ? next.push(...r) : next.push(p); }
    pieces = next;
  }
  assert.equal(pieces.length, 10);
  const total = pieces.reduce((a, p) => a + Math.abs(polyArea(p)), 0);
  assert.ok(Math.abs(total - 10000) < 1e-3);
  assert.ok(pieces.every((p) => polyMinWidth(p) < 11));
});

test('pointInPoly / resample', () => {
  assert.ok(pointInPoly(50, 50, square));
  assert.ok(!pointInPoly(150, 50, square));
  const r = resample([[0, 0], [10, 0]], 2);
  assert.equal(r.length, 6);
});
