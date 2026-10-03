// 완성된 스테이크 그리기 (통째로 / 슬라이스)
import { drawSteakTop, drawCrossSection, steakSpanAt, SHAPE_PATH, STEAK, STEAK_BOUNDS } from './meat.js';
import { crustColor } from './sim.js';

/** 이상적으로 구운 스테이크 데이터 (타이틀 화면용) */
export function idealCook() {
  const n = 15;
  const Tmax = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const d = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
    Tmax[i] = 55 + Math.pow(d, 3) * 60;
  }
  return { Tmax, brown: [1.08, 1.0], up: 0, grains: [], oilDrops: [], mems: null, scars: [] };
}

function topBrown(cook) { return cook.brown[cook.up]; }
function bottomBrown(cook) { return cook.brown[1 - cook.up]; }

/** 통 스테이크 (로컬 mm 좌표, 중심 0,0) */
export function drawWholeSteak(g, tex, cook) {
  drawSteakTop(g, tex, {
    brown: topBrown(cook),
    grains: cook.up === 1 ? cook.grains : cook.pepperOnly,
    oilDrops: null,
    mems: cook.up === 1 ? cook.mems : null,
    scars: cook.up === 1 ? cook.scars : null,
    side: { Tmax: cook.Tmax, brownDown: bottomBrown(cook), thickPx: 9 },
    oil: 6, glossMul: 1.15,
  });
}

/** 슬라이스해서 부채꼴로 펼친 스테이크 */
export function drawSlicedSteak(g, tex, cook, { slices = 7 } = {}) {
  const x0 = -118, x1 = 118;
  const w = (x1 - x0) / slices;
  const T = STEAK.thick * 1.25;
  const tb = topBrown(cook), bb = bottomBrown(cook);
  // 그림자
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.translate(slices * T * 0.3 + 4, 10);
  g.fill(SHAPE_PATH);
  g.restore();
  for (let i = 0; i < slices; i++) {
    const a = x0 + i * w, b = a + w;
    const shift = i * T * 0.6;
    const rot = (i - (slices - 1) / 2) * 0.025;
    const span = steakSpanAt(a + 0.5) || steakSpanAt(a + w / 2);
    g.save();
    g.translate(shift, Math.abs(i - (slices - 1) / 2) * 1.5);
    g.rotate(rot);
    // 윗면 크러스트 조각
    g.save();
    g.beginPath(); g.rect(a, STEAK_BOUNDS.y0, w, STEAK_BOUNDS.h); g.clip();
    drawSteakTop(g, tex, {
      brown: tb, grains: cook.up === 1 ? cook.grains : cook.pepperOnly, mems: cook.up === 1 ? cook.mems : null,
      scars: cook.up === 1 ? cook.scars : null, oil: 6, glossMul: 1.1,
      side: { Tmax: cook.Tmax, brownDown: bb, thickPx: 6 },
    });
    g.restore();
    // 잘린 단면 (왼쪽에 기울어 보이는 면)
    if (i > 0 && span) {
      const [lo, hi] = span;
      g.save();
      g.translate(a, lo);
      g.rotate(Math.PI / 2);
      drawCrossSection(g, hi - lo, T, cook.Tmax, tb, bb, { seed: 10 + i, fatEnd: true });
      g.restore();
      // 슬라이스 사이 그림자
      const sh = g.createLinearGradient(a - T - 6, 0, a - T, 0);
      sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(30,8,0,0.35)');
      g.fillStyle = sh; g.fillRect(a - T - 6, lo + 4, 6, hi - lo - 6);
      // 단면 위 육즙 반짝임
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(a - T * 0.55, lo + 6, 1.4, (hi - lo) * 0.6);
    }
    g.restore();
  }
}

/** 단면 확대 (결과 화면의 '자르는 순간') */
export function drawBigCrossSection(g, cook, L, T) {
  drawCrossSection(g, L, T, cook.Tmax, topBrown(cook), bottomBrown(cook), { seed: 3, fatEnd: true });
}

export function crustCss(b) { return `rgb(${crustColor(b).rgb.join(',')})`; }
