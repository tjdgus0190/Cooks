// 칼질(손질)·시즈닝 대상: 스테이크 / 새우 / 랍스터 — 공통 인터페이스
import { drawSteakTop, drawSteakShadow, createMembranes, insideSteak, inFat, SHAPE } from './meat.js';
import { drawShrimp, shrimpSpine, shrimpVein, drawLobster, lobsterLine } from './food.js';
import { resample, distToSeg, pointInPoly } from './geom.js';

const xf = (pts, t) => pts.map(([x, y]) => {
  const c = Math.cos(t.r), s = Math.sin(t.r);
  return [t.x + (x * c - y * s) * t.s, t.y + (x * s + y * c) * t.s];
});

const SHRIMP_POS = [
  { x: -70, y: -40, r: 0.2, s: 1 }, { x: 5, y: -45, r: -0.1, s: 1 }, { x: 78, y: -38, r: 0.3, s: 1 },
  { x: -40, y: 40, r: -0.2, s: 1 }, { x: 45, y: 42, r: 0.1, s: 1 },
];

export function makeSubject(kind, { dish } = {}) {
  if (kind === 'shrimp') {
    const mems = SHRIMP_POS.map((t, i) => {
      const pts = resample(xf(shrimpVein(), t), 2.5);
      return { id: i, width: 6, pts, cut: new Uint8Array(pts.length), t };
    });
    const spines = SHRIMP_POS.map((t) => xf(shrimpSpine(), t));
    return {
      kind, mems, angleLimit: false, scale: 1.05, baseRot: 0,
      intro: { icon: '🦐', title: '새우 내장 제거', lines: ['새우 등을 따라 있는 <b>검은 내장 선</b>을 칼로 따라 그어 빼내요.', '곡선을 따라 정확히! 벗어나면 살이 상해요.', '두 손가락이나 ⟲⟳로 도마를 돌릴 수 있어요.'] },
      hint: '검은 내장 선을 따라 슥- 그어요', what: '내장',
      inside: (x, y) => spines.some((sp) => sp.some((p, i) => i && distToSeg(x, y, sp[i - 1][0], sp[i - 1][1], p[0], p[1]) < 10)),
      inFat: () => false,
      draw(g, { cook = 0, salt } = {}) {
        SHRIMP_POS.forEach((t, i) => {
          g.save(); g.translate(t.x, t.y); g.rotate(t.r);
          // 내장 컷 배열을 로컬 내장 점에 매핑
          const vein = shrimpVein();
          const m = mems[i];
          const cutLocal = vein.map((_, k) => m.cut[Math.min(m.cut.length - 1, Math.round((k / (vein.length - 1)) * (m.cut.length - 1)))]);
          drawShrimp(g, { cook, vein, veinCut: cutLocal });
          g.restore();
        });
      },
      bounds: { w: 260, h: 180 },
    };
  }
  if (kind === 'lobster') {
    const pts = resample(lobsterLine(), 2.5);
    const mems = [{ id: 0, width: 7, pts, cut: new Uint8Array(pts.length) }];
    return {
      kind, mems, angleLimit: false, scale: 1.3, baseRot: 0,
      intro: { icon: '🦞', title: '랍스터 반 가르기', lines: ['꼬리 <b>정중앙 선</b>을 따라 칼을 그어 반으로 갈라요.', '중심에서 벗어나면 살이 찢어져요.'] },
      hint: '정중앙 점선을 따라 끝까지 그어요', what: '절개', meterLabel: '절개 진행',
      inside: (x, y) => Math.abs(x) < 30 && y > -70 && y < 90,
      inFat: () => false,
      draw(g, { cook = 0 } = {}) {
        const done = mems[0].cut.reduce((a, c) => a + c, 0) / mems[0].cut.length;
        drawLobster(g, { cook, split: done > 0.9 ? 1 : done * 0.3, cut: mems[0].cut.length ? lobsterLine().map((_, i) => mems[0].cut[Math.min(mems[0].cut.length - 1, Math.round(i / 29 * (mems[0].cut.length - 1)))]) : null });
      },
      bounds: { w: 80, h: 180 },
    };
  }
  // 스테이크
  const mems = createMembranes(!!dish?.extraMembrane);
  return {
    kind: 'steak', mems, angleLimit: true, scale: 1.18,
    intro: {
      icon: '🔪', title: '근막 손질',
      lines: [
        '고기 위의 <b>하얗고 반짝이는 막(근막)</b>을 따라 손가락으로 드래그하면 칼이 지나가요.',
        '칼은 <b>가로 방향</b>으로만 잘 들어가요. 세로로 놓인 근막은 <b>고기를 돌려서</b> 자르세요.',
        '두 손가락으로 비틀거나 ⟲ ⟳ 버튼으로 돌릴 수 있어요.',
        '근막을 벗어나 살코기를 베면 <b>고기가 상해요</b>.',
      ],
    },
    hint: '반짝이는 근막을 따라 가로로 슥- 그어보세요', what: '근막',
    inside: insideSteak, inFat,
    draw(g, { tex, scars, grains, oilDrops, oil } = {}) {
      drawSteakShadow(g, tex, 4, 10, 0.7);
      drawSteakTop(g, tex, { brown: 0, mems, scars, grains, oilDrops, oil, sideThick: 8 });
    },
    bounds: { w: 260, h: 180 },
    shape: SHAPE,
  };
}

/** 시즈닝 대상: 떨어진 알갱이가 재료 위인지 */
export function seasonTarget(kind) {
  if (kind === 'shrimp') {
    const s = makeSubject('shrimp');
    return { inside: s.inside, draw: s.draw, area: SHRIMP_POS.length };
  }
  if (kind === 'lobster') {
    const s = makeSubject('lobster');
    s.mems[0].cut.fill(1);
    return { inside: (x, y) => Math.abs(x) < 26 && y > -64 && y < 60, draw: (g) => drawLobster(g, { split: 1 }) };
  }
  return null;
}
export { pointInPoly };
