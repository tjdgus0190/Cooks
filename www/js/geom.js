// 기하 유틸리티 — 다각형 분할(자유 곡선 칼질), 거리, 포함 판정 등
export const TAU = Math.PI * 2;

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(a, b, v) { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
export function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }

export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polyArea(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return a / 2;
}

export function polyCentroid(poly) {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    cx += (poly[j][0] + poly[i][0]) * f;
    cy += (poly[j][1] + poly[i][1]) * f;
    a += f;
  }
  if (Math.abs(a) < 1e-9) {
    let sx = 0, sy = 0;
    for (const p of poly) { sx += p[0]; sy += p[1]; }
    return [sx / poly.length, sy / poly.length];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

export function polyBounds(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

// 선분 교차: 교차 시 {t, u, x, y} (t: 선분 a 위치, u: 선분 b 위치)
export function segIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / den;
  const u = ((cx - ax) * ry - (cy - ay) * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u, x: ax + rx * t, y: ay + ry * t };
}

export function distToSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const l2 = vx * vx + vy * vy;
  let t = l2 ? ((px - ax) * vx + (py - ay) * vy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

/** 경로 길이 */
export function pathLength(path) {
  let L = 0;
  for (let i = 1; i < path.length; i++) L += dist(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
  return L;
}

/**
 * 다각형을 자유 곡선(드래그 경로)으로 자른다.
 * 경로가 다각형 경계를 밖→안→밖으로 완전히 관통한 첫 구간을 사용한다.
 * 반환: [polyA, polyB] 또는 null(관통하지 않음)
 */
export function splitPolyByPath(poly, path) {
  if (poly.length < 3 || path.length < 2) return null;
  const hits = []; // {s: 경로상 누적 인덱스 파라미터, edge, x, y}
  for (let k = 0; k < path.length - 1; k++) {
    const [ax, ay] = path[k], [bx, by] = path[k + 1];
    const segHits = [];
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      const h = segIntersect(ax, ay, bx, by, poly[i][0], poly[i][1], poly[j][0], poly[j][1]);
      if (h) segHits.push({ s: k + h.t, edge: i, eu: h.u, x: h.x, y: h.y });
    }
    segHits.sort((p, q) => p.s - q.s);
    hits.push(...segHits);
  }
  if (hits.length < 2) return null;
  for (let h = 0; h < hits.length - 1; h++) {
    const A = hits[h], B = hits[h + 1];
    if (B.s - A.s < 1e-6) continue;
    // 두 교점 사이 경로의 중간점이 내부인지 확인
    const midS = (A.s + B.s) / 2;
    const mk = Math.floor(midS), mt = midS - mk;
    const p0 = path[mk], p1 = path[Math.min(mk + 1, path.length - 1)];
    const mx = p0[0] + (p1[0] - p0[0]) * mt, my = p0[1] + (p1[1] - p0[1]) * mt;
    if (!pointInPoly(mx, my, poly)) continue;
    if (A.edge === B.edge && Math.abs(A.eu - B.eu) < 1e-9) continue;
    // 내부 경로 점들
    const inner = [];
    for (let k = Math.floor(A.s) + 1; k <= Math.floor(B.s) && k < path.length; k++) {
      if (k > A.s && k < B.s) inner.push([path[k][0], path[k][1]]);
    }
    const n = poly.length;
    const ptA = [A.x, A.y], ptB = [B.x, B.y];
    // 조각 1: A → inner → B → (B.edge+1 ... A.edge) 다각형 정점
    const p1s = [ptA, ...inner, ptB];
    const p2s = [ptB, ...inner.slice().reverse(), ptA];
    if (A.edge === B.edge) {
      // 같은 변으로 들어갔다 나온 경우: 한 조각은 경로+변 구간, 나머지는 바깥쪽
      const forward = A.eu < B.eu; // 변 방향으로 A가 먼저
      // 작은 조각: A..B 경로 + 변으로 닫힘
      const small = p1s.slice();
      // 큰 조각: 다각형 전체에 경로를 끼워 넣음
      const big = [];
      for (let i = 0; i < n; i++) {
        big.push(poly[i]);
        if (i === A.edge) {
          if (forward) big.push(...p1s); else big.push(...p2s);
        }
      }
      return finalize(small, big);
    }
    let i = (B.edge + 1) % n;
    let guard = 0;
    while (guard++ <= n) {
      p1s.push(poly[i]);
      if (i === A.edge) break;
      i = (i + 1) % n;
    }
    i = (A.edge + 1) % n; guard = 0;
    while (guard++ <= n) {
      p2s.push(poly[i]);
      if (i === B.edge) break;
      i = (i + 1) % n;
    }
    return finalize(p1s, p2s);
  }
  return null;
}

function finalize(a, b) {
  const ca = cleanPoly(a), cb = cleanPoly(b);
  if (ca.length < 3 || cb.length < 3) return null;
  if (Math.abs(polyArea(ca)) < 0.5 || Math.abs(polyArea(cb)) < 0.5) return null;
  return [ca, cb];
}

function cleanPoly(p) {
  const out = [];
  for (const q of p) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - q[0]) > 1e-6 || Math.abs(last[1] - q[1]) > 1e-6) out.push([q[0], q[1]]);
  }
  if (out.length > 1) {
    const f = out[0], l = out[out.length - 1];
    if (Math.abs(f[0] - l[0]) < 1e-6 && Math.abs(f[1] - l[1]) < 1e-6) out.pop();
  }
  return out;
}

/** 다각형의 대략적인 "두께"(최소 폭): 회전 캘리퍼 근사 */
export function polyMinWidth(poly) {
  let best = Infinity;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ex = poly[j][0] - poly[i][0], ey = poly[j][1] - poly[i][1];
    const L = Math.hypot(ex, ey);
    if (L < 1e-6) continue;
    const nx = -ey / L, ny = ex / L;
    let lo = Infinity, hi = -Infinity;
    for (const p of poly) { const d = p[0] * nx + p[1] * ny; if (d < lo) lo = d; if (d > hi) hi = d; }
    if (hi - lo < best) best = hi - lo;
  }
  return best;
}

/** 경로를 일정 간격으로 재샘플링 */
export function resample(path, step) {
  if (path.length < 2) return path.slice();
  const out = [path[0].slice()];
  let carry = 0;
  for (let i = 1; i < path.length; i++) {
    let [ax, ay] = path[i - 1];
    const [bx, by] = path[i];
    let seg = dist(ax, ay, bx, by);
    let d = step - carry;
    while (d <= seg) {
      const t = d / seg;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      d += step;
    }
    carry = seg - (d - step);
  }
  return out;
}

/** 결정적 난수 (시드 고정 — 텍스처를 매번 같게) */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
