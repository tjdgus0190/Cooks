// 손질 미니게임(공통): 드래그 궤적대로 자르기 → 결과물 수량(인분)이 인벤토리가 된다
// 대상: 양배추·마늘·방울토마토·파슬리·바게트·레몬·아스파라거스·양송이·샬롯·관찰레·로즈마리
import { drawCounter, drawBoard, drawKnife } from '../art.js';
import { sfx, haptic } from '../audio.js';
import { TAU, rng, splitPolyByPath, polyArea, polyCentroid, polyMinWidth, polyBounds, clamp } from '../geom.js';
import { PREP } from '../recipes.js';
import * as F from '../floor.js';
import { PHOTOS } from '../photos.js';

/** 다각형 영역에 사진을 경계 상자(+여유)에 맞춰 입힘 — 사진이 없으면 false */
function photoPoly(g, p, key, { pad = 1.06, rot = 0 } = {}) {
  const im = PHOTOS[key];
  if (!im) return false;
  const b = polyBounds(p), cx = b.x0 + b.w / 2, cy = b.y0 + b.h / 2;
  g.save(); g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
  g.translate(cx, cy); g.rotate(rot);
  const w = (rot ? b.h : b.w) * pad, h = (rot ? b.w : b.h) * pad;
  g.drawImage(im, -w / 2, -h / 2, w, h);
  g.restore();
  return true;
}

const ellipse = (cx, cy, rx, ry, n = 28, wob = 0, seed = 1) => {
  const R = rng(seed);
  return Array.from({ length: n }, (_, i) => { const t = (i / n) * TAU; const w = 1 + (R() - 0.5) * wob; return [cx + Math.cos(t) * rx * w, cy + Math.sin(t) * ry * w]; });
};
const rect = (cx, cy, w, h, rot = 0) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
const teardrop = (cx, cy, s, rot) => Array.from({ length: 24 }, (_, i) => {
  const t = (i / 24) * TAU; const x = Math.sin(t) * s * 0.55 * (1 - Math.cos(t) * 0.25), y = -Math.cos(t) * s;
  return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
});

function cabbageShape() {
  const pts = []; const R = rng(31);
  for (let i = 0; i < 90; i++) {
    const t = (i / 90) * TAU;
    const r = 92 * (1 + 0.035 * Math.sin(t * 5 + 1) + 0.02 * Math.sin(t * 11)) * (1 + (R() - 0.5) * 0.01);
    let y = Math.sin(t) * r * 0.9; if (y > 72) y = 72 + (y - 72) * 0.3;
    pts.push([Math.cos(t) * r, y]);
  }
  return pts;
}

/**
 * 손질 대상 정의: items(다각형 목록), paint(g) 텍스처, yieldOf(pieces) → 인분
 * piece: { poly, src, area, srcArea }
 */
export const SUBJECTS = {
  cabbage: {
    scale: 1.5, items: () => [cabbageShape()],
    paint: paintCabbage,
    yieldOf: (ps) => Math.floor(fineness(ps, 7, 28) * 6),
    hint: '양배추를 가로질러 슥슥 — 가늘게 썰수록 많이, 맛있게',
    meter: (ps) => fineness(ps, 7, 28),
  },
  garlic: {
    scale: 2.4, items: () => [[-40, -20, 0.3], [0, -24, -0.2], [40, -18, 0.15], [-30, 24, -0.4], [12, 26, 0.5], [46, 28, -0.1]].map(([x, y, r]) => teardrop(x, y, 17, r)),
    paint(g, items) {
      if (PHOTOS.garlicClove) {
        items.forEach((p, i) => { const [cx, cy] = polyCentroid(p); const rot = [0.3, -0.2, 0.15, -0.4, 0.5, -0.1][i] || 0; photoPoly(g, p, 'garlicClove', { pad: 1.5, rot: rot + Math.PI / 2 }); strokePoly(g, p, 'rgba(170,130,90,0.35)', 0.6); });
        return;
      }
      items.forEach((p, i) => {
        const [cx, cy] = polyCentroid(p);
        g.save(); fillPoly(g, p, '#f6f0dc');
        const gr = g.createRadialGradient(cx - 4, cy - 6, 1, cx, cy, 18); gr.addColorStop(0, 'rgba(255,255,250,0.9)'); gr.addColorStop(1, 'rgba(220,200,150,0.6)');
        fillPoly(g, p, gr);
        g.strokeStyle = 'rgba(200,170,120,0.6)'; g.lineWidth = 0.6;
        for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(cx, cy, 2 + k * 2.2, 3 + k * 3.5, 0, 0, TAU); g.stroke(); }
        strokePoly(g, p, 'rgba(170,130,90,0.8)', 1);
        g.restore();
      });
    },
    // 얇은(3.5mm 이하) 슬라이스 6장 = 1인분
    yieldOf: (ps) => Math.floor(ps.filter((p) => p.width <= 3.5 && p.area > 6).length / 6),
    hint: '마늘을 얇게 여러 번 썰어요 (얇은 슬라이스 6장 = 1인분)',
    meter: (ps) => clamp(ps.filter((p) => p.width <= 3.5 && p.area > 6).length / 36, 0, 1),
  },
  tomato: {
    scale: 2.2, items: () => [[-50, -26], [-17, -30], [17, -26], [50, -30], [-50, 24], [-17, 28], [17, 24], [50, 28]].map(([x, y], i) => ellipse(x, y, 13, 13, 26, 0.04, i + 3)),
    paint(g, items) {
      if (PHOTOS.tomatoWhole) { items.forEach((p) => photoPoly(g, p, 'tomatoWhole', { pad: 1.08 })); return; }
      items.forEach((p) => {
        const [cx, cy] = polyCentroid(p);
        const gr = g.createRadialGradient(cx - 4, cy - 4, 1, cx, cy, 14); gr.addColorStop(0, '#ff7a5c'); gr.addColorStop(0.7, '#e0261a'); gr.addColorStop(1, '#a5120c');
        fillPoly(g, p, gr);
        g.fillStyle = '#ffd0b0'; for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; g.beginPath(); g.ellipse(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, 3, 2, a, 0, TAU); g.fill(); }
        g.fillStyle = '#3f7a2a'; g.beginPath(); g.arc(cx, cy, 2.2, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(cx - 5, cy - 6, 3, 1.4, -0.6, 0, TAU); g.fill();
      });
    },
    // 반쪽 = 원래 면적의 35~65%
    yieldOf: (ps) => ps.filter((p) => p.area / p.srcArea > 0.35 && p.area / p.srcArea < 0.65).length,
    hint: '방울토마토를 정확히 반으로! 한 번에 여러 개를 가로질러도 돼요',
    meter: (ps) => clamp(ps.filter((p) => p.area / p.srcArea > 0.35 && p.area / p.srcArea < 0.65).length / 16, 0, 1),
  },
  parsley: {
    scale: 2.0, items: () => [ellipse(0, 0, 60, 34, 30, 0.25, 9)],
    paint(g, items) {
      const R = rng(4);
      fillPoly(g, items[0], '#2f6e2a');
      if (PHOTOS.parsleySprig) {
        // 파슬리 잎을 겹겹이 쌓은 한 줌
        const im = PHOTOS.parsleySprig;
        g.save(); g.beginPath(); items[0].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
        for (let i = 0; i < 14; i++) { g.save(); g.translate((R() - 0.5) * 110, (R() - 0.5) * 56); g.rotate(R() * TAU); g.drawImage(im, -24, -23, 48, 47); g.restore(); }
        g.restore();
        return;
      }
      for (let i = 0; i < 160; i++) { const x = (R() - 0.5) * 120, y = (R() - 0.5) * 66; g.fillStyle = R() < 0.5 ? '#3e8a34' : '#5aa848'; g.beginPath(); g.ellipse(x, y, 3 + R() * 4, 2 + R() * 3, R() * 3, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(180,220,150,0.5)'; g.lineWidth = 0.6;
      for (let i = 0; i < 40; i++) { const x = (R() - 0.5) * 110, y = (R() - 0.5) * 60; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y + 4); g.stroke(); }
    },
    yieldOf: (ps) => Math.floor(fineness(ps, 4, 18) * 8),
    hint: '파슬리를 이리저리 잘게 다져요 (가로·세로로)',
    meter: (ps) => fineness(ps, 4, 18),
  },
  baguette: {
    scale: 1.6, items: () => [rect(0, 0, 210, 46, 0)],
    paint(g, items) {
      const p = items[0];
      if (photoPoly(g, p, 'baguetteLoaf', { pad: 1.04 })) return;
      const gr = g.createLinearGradient(0, -23, 0, 23); gr.addColorStop(0, '#d89a4a'); gr.addColorStop(0.5, '#c07a30'); gr.addColorStop(1, '#8a5020');
      fillPoly(g, p, gr);
      g.strokeStyle = 'rgba(250,220,160,0.8)'; g.lineWidth = 2;
      for (let k = -80; k <= 80; k += 40) { g.beginPath(); g.moveTo(k - 12, -8); g.quadraticCurveTo(k, -14, k + 12, -6); g.stroke(); }
    },
    yieldOf: (ps) => ps.filter((p) => p.width >= 7 && p.width <= 22 && p.area / p.srcArea < 0.2).length,
    hint: '바게트를 1~2cm 두께로 썰어요 (세로로 그어요)',
    meter: (ps) => clamp(ps.filter((p) => p.width >= 7 && p.width <= 22 && p.area / p.srcArea < 0.2).length / 10, 0, 1),
  },
  lemon: {
    scale: 2.0, items: () => [ellipse(-40, 0, 32, 24, 30, 0.03, 2), ellipse(40, 0, 32, 24, 30, 0.03, 5)],
    paint(g, items) {
      if (PHOTOS.lemonHalf) { items.forEach((p) => photoPoly(g, p, 'lemonHalf', { pad: 1.03 })); return; }
      items.forEach((p) => {
        const [cx, cy] = polyCentroid(p);
        fillPoly(g, p, '#f2c81c');
        g.fillStyle = '#fff3a0'; g.beginPath(); g.ellipse(cx, cy, 27, 19, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,230,0.9)'; g.lineWidth = 1;
        for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 18); g.stroke(); }
      });
    },
    // 웨지 = 레몬 1개의 12~30%
    yieldOf: (ps) => ps.filter((p) => p.area / p.srcArea > 0.12 && p.area / p.srcArea < 0.3).length,
    hint: '레몬을 중심을 지나게 잘라 웨지로 만들어요',
    meter: (ps) => clamp(ps.filter((p) => p.area / p.srcArea > 0.12 && p.area / p.srcArea < 0.3).length / 8, 0, 1),
  },
  asparagus: {
    scale: 1.7, items: () => [-36, -20, -4, 12, 28, 44].map((y) => rect(0, y, 190, 9, 0)),
    paint(g, items) {
      if (PHOTOS.asparagus) {
        items.forEach((p) => {
          photoPoly(g, p, 'asparagus', { pad: 1.0 });
          // 질긴 밑동은 하얗게 마른 색
          const [cx, cy] = polyCentroid(p);
          const gr = g.createLinearGradient(cx - 95, 0, cx - 50, 0); gr.addColorStop(0, 'rgba(225,215,170,0.85)'); gr.addColorStop(1, 'rgba(225,215,170,0)');
          g.save(); g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip(); g.fillStyle = gr; g.fillRect(cx - 96, cy - 6, 50, 12); g.restore();
        });
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(-52, -48); g.lineTo(-52, 56); g.stroke(); g.setLineDash([]);
        return;
      }
      items.forEach((p) => {
        const [cx, cy] = polyCentroid(p);
        const gr = g.createLinearGradient(-95, 0, 95, 0); gr.addColorStop(0, '#d8d0a0'); gr.addColorStop(0.22, '#9cc060'); gr.addColorStop(1, '#4f8a28');
        fillPoly(g, p, gr);
        g.fillStyle = '#3e7020'; g.beginPath(); g.ellipse(cx + 92, cy, 9, 5.5, 0, 0, TAU); g.fill();
      });
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(-52, -48); g.lineTo(-52, 56); g.stroke(); g.setLineDash([]);
    },
    // 질긴 밑동(약 20%)만 잘라낸 대 = 큰 조각이 원래의 70~88%
    yieldOf: (ps) => ps.filter((p) => p.area / p.srcArea > 0.7 && p.area / p.srcArea < 0.88).length,
    hint: '질긴 밑동만 잘라내요 (점선 근처를 세로로)',
    meter: (ps) => clamp(ps.filter((p) => p.area / p.srcArea > 0.7 && p.area / p.srcArea < 0.88).length / 6, 0, 1),
  },
  mushroom: {
    scale: 2.0, items: () => [[-45, -18], [0, -22], [45, -18], [-22, 28], [24, 28]].map(([x, y], i) => ellipse(x, y, 18, 15, 24, 0.05, i + 11)),
    paint(g, items) {
      items.forEach((p) => {
        const [cx, cy] = polyCentroid(p);
        const gr = g.createRadialGradient(cx - 5, cy - 5, 1, cx, cy, 19); gr.addColorStop(0, '#f2e6d2'); gr.addColorStop(1, '#b89070');
        fillPoly(g, p, gr);
        if (PHOTOS.mushroomSkin) {
          // 실제 갓 표면 질감 + 둥근 음영
          g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; photoPoly(g, p, 'mushroomSkin', { pad: 1.1 }); g.restore();
          return;
        }
        g.fillStyle = 'rgba(120,90,60,0.4)'; g.beginPath(); g.arc(cx, cy, 4, 0, TAU); g.fill();
      });
    },
    yieldOf: (ps) => Math.floor(ps.filter((p) => p.width <= 6 && p.area > 20).length / 2),
    hint: '양송이를 5mm 두께로 썰어요',
    meter: (ps) => clamp(ps.filter((p) => p.width <= 6 && p.area > 20).length / 20, 0, 1),
  },
  shallot: {
    scale: 2.2, items: () => [teardrop(-24, 0, 26, 0.1), teardrop(26, 2, 24, -0.15)],
    paint(g, items) {
      if (PHOTOS.shallot) { items.forEach((p, i) => photoPoly(g, p, 'shallot', { pad: 1.12, rot: i ? -0.15 : 0.1 })); return; }
      items.forEach((p) => {
        const [cx, cy] = polyCentroid(p);
        fillPoly(g, p, '#d8a0b0');
        g.strokeStyle = 'rgba(255,240,245,0.8)'; g.lineWidth = 0.8;
        for (let k = 1; k < 5; k++) { g.beginPath(); g.ellipse(cx, cy, k * 3, k * 5, 0, 0, TAU); g.stroke(); }
      });
    },
    yieldOf: (ps) => Math.floor(fineness(ps, 4, 16) * 5),
    hint: '샬롯을 가로·세로로 잘게 다져요',
    meter: (ps) => fineness(ps, 4, 16),
  },
  guanciale: {
    scale: 1.8, items: () => [rect(0, 0, 150, 56, 0)],
    paint(g, items) {
      const p = items[0];
      if (photoPoly(g, p, 'guanciale', { pad: 1.0 })) return;
      fillPoly(g, p, '#f3e2d4');
      g.fillStyle = '#c8686a';
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.rect(-75, k * 16 - 4, 150, 7); g.fill(); }
      g.fillStyle = '#7a3a20'; g.fillRect(-75, -28, 150, 4);
    },
    yieldOf: (ps) => Math.floor(ps.filter((p) => p.width >= 4 && p.width <= 12 && p.area / p.srcArea < 0.15).length / 3),
    hint: '관찰레를 1cm 폭의 스트립으로 썰어요',
    meter: (ps) => clamp(ps.filter((p) => p.width >= 4 && p.width <= 12 && p.area / p.srcArea < 0.15).length / 12, 0, 1),
  },
  rosemary: {
    scale: 1.7, items: () => [rect(0, -16, 200, 22, 0.04), rect(0, 22, 200, 22, -0.03)],
    paint(g, items) {
      const R = rng(8);
      if (PHOTOS.rosemary) {
        // 실제 로즈마리 줄기 사진 (다각형보다 잎이 넓게 퍼지므로 클립 없이 그 위치에)
        items.forEach((p, i) => { const [cx, cy] = polyCentroid(p); g.save(); g.translate(cx, cy); g.rotate(i ? -0.03 : 0.04); g.drawImage(PHOTOS.rosemary, -104, -24, 208, 48); g.restore(); });
        return;
      }
      items.forEach((p) => {
        const [cx, cy] = polyCentroid(p);
        g.strokeStyle = '#5b4a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 100, cy); g.lineTo(cx + 100, cy); g.stroke();
        for (let x = -98; x < 98; x += 3) for (const s of [-1, 1]) { g.strokeStyle = R() < 0.5 ? '#3f6b3a' : '#557f4b'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx + x, cy); g.lineTo(cx + x + 2, cy + s * (6 + R() * 2)); g.stroke(); }
      });
    },
    yieldOf: (ps) => ps.filter((p) => { const b = polyBounds(p.poly); return Math.max(b.w, b.h) >= 30 && Math.max(b.w, b.h) <= 65; }).length,
    hint: '로즈마리를 4~5cm 길이의 줄기로 잘라요',
    meter: (ps) => clamp(ps.filter((p) => { const b = polyBounds(p.poly); return Math.max(b.w, b.h) >= 30 && Math.max(b.w, b.h) <= 65; }).length / 8, 0, 1),
  },
};

function fineness(ps, good, bad) {
  const tot = ps.reduce((a, p) => a + p.area, 0) || 1;
  return ps.reduce((a, p) => a + p.area * clamp((bad - p.width) / (bad - good), 0, 1), 0) / tot;
}
function fillPoly(g, p, style) { g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = style; g.fill(); }
function strokePoly(g, p, style, w) { g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.strokeStyle = style; g.lineWidth = w; g.stroke(); }

function paintCabbage(g, items) {
  const shape = items[0];
  if (PHOTOS.cabbageHalf) {
    // 실제 양배추 세로 단면 사진 + 겉잎 테두리
    photoPoly(g, shape, 'cabbageHalf', { pad: 1.12 });
    const path = new Path2D(); shape.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y))); path.closePath();
    g.save(); g.clip(path);
    g.lineWidth = 8; g.strokeStyle = 'rgba(120,170,70,0.85)'; g.stroke(path);
    g.lineWidth = 3; g.strokeStyle = 'rgba(70,120,40,0.9)'; g.stroke(path);
    g.restore();
    return;
  }
  const CORE = [0, 78];
  const path = new Path2D(); shape.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y))); path.closePath();
  g.save(); g.clip(path);
  const base = g.createRadialGradient(CORE[0], CORE[1], 5, 0, 20, 110);
  base.addColorStop(0, '#fbfbe8'); base.addColorStop(0.5, '#eef3c8'); base.addColorStop(0.85, '#cfe397'); base.addColorStop(1, '#8fbd52');
  g.fillStyle = base; g.fillRect(-200, -200, 400, 400);
  const R = rng(8);
  for (let layer = 0; layer < 34; layer++) {
    const rad = 14 + layer * 5.2 + R() * 2, wob = 1.5 + layer * 0.12;
    g.beginPath();
    for (let a = Math.PI * 1.02; a <= Math.PI * 1.98 + 0.001; a += 0.03) {
      const rr = rad + Math.sin(a * (7 + (layer % 4)) + layer) * wob + Math.sin(a * 23 + layer * 3) * 0.6;
      const x = CORE[0] + Math.cos(a) * rr * 1.08, y = CORE[1] + Math.sin(a) * rr;
      a === Math.PI * 1.02 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    const t = layer / 34;
    g.strokeStyle = `rgba(${Math.round(200 - t * 60)},${Math.round(225 - t * 20)},${Math.round(160 - t * 90)},${0.45 + R() * 0.3})`;
    g.lineWidth = 0.8 + R() * 1.4; g.stroke();
    g.strokeStyle = 'rgba(255,255,245,0.55)'; g.lineWidth = 0.5; g.stroke();
  }
  g.beginPath(); g.moveTo(-20, 80); g.quadraticCurveTo(-6, 30, 0, 18); g.quadraticCurveTo(6, 30, 20, 80); g.closePath();
  g.fillStyle = '#f2f2d6'; g.fill();
  g.lineWidth = 9; g.strokeStyle = '#5f9a3a'; g.stroke(path);
  g.lineWidth = 4; g.strokeStyle = '#3f7426'; g.stroke(path);
  g.restore();
}

/**
 * 손질 씬. opts.prepKey: 인벤토리 손질(준비대) / 없으면 대회의 양배추 단계(state.cabbage)
 */
export class SliceScene {
  constructor(game, opts = {}) {
    this.game = game;
    this.prepKey = opts.prepKey || null;
    this.onDone = opts.onDone || null;
    this.kind = this.prepKey ? PREP[this.prepKey].subject : 'cabbage';
    this.subj = SUBJECTS[this.kind];
    this.srcItems = this.subj.items();
    this.pieces = this.srcItems.map((poly, i) => ({ poly, src: i, ox: 0, oy: 0, vx: 0, vy: 0 }));
    this.srcArea = this.srcItems.map((p) => Math.abs(polyArea(p)));
    this.tex = null; this.active = false; this.stroke = null; this.trail = []; this.bits = []; this.done = false; this.cuts = 0;
  }

  get pausable() { return !this.prepKey || !!this.game.day; }

  enter() {
    const { ui } = this.game;
    const name = this.prepKey ? PREP[this.prepKey].task : '양배추 채썰기';
    const intro = this.prepKey
      ? { icon: PREP[this.prepKey].icon, title: name, lines: [this.subj.hint, '손가락으로 그은 <b>궤적 그대로</b> 잘려요. 재료를 끝까지 가로질러야 잘려요.', '잘 손질한 만큼 <b>인분</b>이 쌓이고, 요리와 플레이팅에 쓰여요.'] }
      : { icon: '🥬', title: '양배추 채썰기', lines: ['손가락으로 그은 <b>궤적 그대로</b> 양배추가 잘려요. 곡선도 OK!', '<b>가늘게</b> 썰수록 아삭하고 맛있는 샐러드가 돼요.', '양배추를 끝까지 <b>완전히 가로질러야</b> 잘려요.'] };
    const showIntro = !this.prepKey || !this.game.save.flags[`tut_prep_${this.kind}`];
    const go = () => { this.active = true; if (this.prepKey) this.game.setFlag(`tut_prep_${this.kind}`); };
    if (showIntro) this.game.instruct({ ...intro, button: '손질 시작' }).then(go); else go();
    ui.addButton(this.prepKey ? '손질 완료 ✓' : '채썰기 완료 ✓', () => this.finish());
    this.meter = ui.addMeter(this.prepKey ? `${PREP[this.prepKey].icon} 손질` : '채 굵기');
    ui.setHint(this.subj.hint);
  }

  layout() { const { W, H, S } = this.game; return { cx: W / 2, cy: H * 0.54, k: S * this.subj.scale }; }

  buildTex() {
    const { k } = this.layout();
    const sc = k * this.game.dpr;
    if (this.tex && Math.abs(this.tex.sc - sc) < 0.01) return;
    const w = 240, h = 210;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * sc); c.height = Math.ceil(h * sc);
    const g = c.getContext('2d');
    g.setTransform(sc, 0, 0, sc, (w / 2) * sc, (h / 2) * sc);
    this.subj.paint(g, this.srcItems);
    this.tex = { c, sc, w, h };
  }

  toLocal(x, y) { const { cx, cy, k } = this.layout(); return [(x - cx) / k, (y - cy) / k]; }

  down(p) {
    if (!this.active || this.done) return;
    this.stroke = { path: [this.toLocal(p.x, p.y)], cutIds: new Set() };
    this.trail = [{ x: p.x, y: p.y, t: 0 }];
    this.knife = { x: p.x, y: p.y, a: 0 };
  }
  move(p) {
    if (!this.stroke) return;
    const lp = this.toLocal(p.x, p.y);
    const last = this.stroke.path[this.stroke.path.length - 1];
    if (Math.hypot(lp[0] - last[0], lp[1] - last[1]) < 1.2 / (this.subj.scale / 1.5)) return;
    this.stroke.path.push(lp);
    this.trail.push({ x: p.x, y: p.y, t: 0 });
    const dx = p.x - this.knife.x, dy = p.y - this.knife.y;
    if (Math.hypot(dx, dy) > 2) this.knife.a = Math.atan2(dy, dx) + Math.PI;
    this.knife.x = p.x; this.knife.y = p.y;
    this.tryCut();
  }
  up() { this.stroke = null; this.knife = null; }
  cancelPointer() { this.up(); }

  tryCut() {
    const path = this.stroke.path;
    if (path.length < 2) return;
    const pb = polyBounds(path);
    const next = [];
    let cutCount = 0;
    for (const pc of this.pieces) {
      if (this.stroke.cutIds.has(pc)) { next.push(pc); continue; }
      const b = polyBounds(pc.poly);
      if (b.x1 + pc.ox < pb.x0 || b.x0 + pc.ox > pb.x1 || b.y1 + pc.oy < pb.y0 || b.y0 + pc.oy > pb.y1) { next.push(pc); continue; }
      const local = path.map(([x, y]) => [x - pc.ox, y - pc.oy]);
      const res = splitPolyByPath(pc.poly, local);
      if (!res) { next.push(pc); continue; }
      const a = local[0], z = local[local.length - 1];
      let nx = -(z[1] - a[1]), ny = z[0] - a[0];
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const push = 14 / this.subj.scale;
      for (const poly of res) {
        const [cx, cy] = polyCentroid(poly);
        const side = (cx - a[0]) * nx + (cy - a[1]) * ny > 0 ? 1 : -1;
        const ch = { poly, src: pc.src, ox: pc.ox, oy: pc.oy, vx: nx * side * push * 1.5, vy: ny * side * push * 1.5 };
        this.stroke.cutIds.add(ch);
        next.push(ch);
      }
      cutCount++;
      const [cx, cy] = polyCentroid(res[0]);
      for (let i = 0; i < 3; i++) this.bits.push({ x: cx + pc.ox, y: cy + pc.oy, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 60, life: 1, s: 1 + Math.random() * 1.5 });
    }
    if (cutCount) { this.pieces = next; this.cuts += cutCount; sfx.crunch(); haptic('light'); }
  }

  stats() {
    return this.pieces.map((p) => ({ poly: p.poly, src: p.src, area: Math.abs(polyArea(p.poly)), srcArea: this.srcArea[p.src], width: polyMinWidth(p.poly) }));
  }

  finish() {
    if (this.done) return;
    this.done = true;
    const ps = this.stats();
    if (this.prepKey) {
      const n = this.subj.yieldOf(ps);
      const inv = this.game.getInv();
      inv[this.prepKey] = (inv[this.prepKey] || 0) + n;
      this.game.commitInv(inv);
      this.game.ui.toast(n > 0 ? `${PREP[this.prepKey].name} +${n}` : '쓸 만한 게 없어요…', { bad: n === 0, sub: n > 0 ? `보유 ${inv[this.prepKey]}${PREP[this.prepKey].unit}` : '조금 더 정성껏!' });
      sfx[n > 0 ? 'ding' : 'fail']();
      setTimeout(() => this.onDone?.(n), 900);
    } else {
      const f = fineness(ps, 7, 28);
      this.game.state.cabbage = { fineness: f, pieces: this.pieces.length, cuts: this.cuts };
      this.game.ui.toast(f > 0.75 ? '아삭아삭 완벽한 채!' : f > 0.4 ? '먹을 만한 채' : '너무 굵어요…', { bad: f <= 0.4 });
      setTimeout(() => this.game.nextStage(), 900);
    }
  }

  update(dt) {
    if (this.prepKey && this.game.day) {
      // 영업 중 손질: 가게 시계와 밀린 주문 표시
      const d = this.game.day, ui = this.game.ui;
      ui.showHud(true);
      ui.setStage('🕐', '', F.clockText(d));
      ui.setOrder(`대기 주문 ${F.waitingOrders(d).filter((c) => !c.assigned).length}건`);
      ui.setTimer(Math.max(0, d.length - d.t), d.length);
    }
    for (const pc of this.pieces) { pc.ox += pc.vx * dt; pc.oy += pc.vy * dt; pc.vx *= Math.exp(-dt * 8); pc.vy *= Math.exp(-dt * 8); }
    for (const t of this.trail) t.t += dt;
    this.trail = this.trail.filter((t) => t.t < 0.25);
    for (const b of this.bits) { b.x += b.vx * dt * 0.1; b.y += b.vy * dt * 0.1; b.vy += 300 * dt; b.life -= dt * 1.5; }
    this.bits = this.bits.filter((b) => b.life > 0);
    if (!this._t || (this._t += dt) > 0.25) {
      this._t = 0.0001;
      const ps = this.stats();
      const m = this.subj.meter(ps);
      const label = this.prepKey ? `${this.subj.yieldOf(ps)}${PREP[this.prepKey].unit}` : (m > 0.75 ? '가늘다' : m > 0.4 ? '보통' : '굵다');
      this.meter.set(m, label);
    }
  }

  draw(g) {
    const { W, H, S, dpr } = this.game;
    drawCounter(g, W, H, dpr);
    const { cx, cy, k } = this.layout();
    drawBoard(g, cx, cy, Math.min(W * 0.98, 380 * S), 420 * S, dpr);
    this.buildTex();
    const t = this.tex;
    g.save(); g.translate(cx, cy); g.scale(k, k);
    g.save(); g.globalAlpha = 0.22; g.fillStyle = '#000';
    for (const pc of this.pieces) { g.save(); g.translate(pc.ox + 2, pc.oy + 4); g.beginPath(); pc.poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); g.restore(); }
    g.restore();
    for (const pc of this.pieces) {
      g.save(); g.translate(pc.ox, pc.oy);
      g.beginPath(); pc.poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
      g.save(); g.clip(); g.drawImage(t.c, -t.w / 2, -t.h / 2, t.w, t.h); g.restore();
      if (this.cuts) { g.strokeStyle = 'rgba(255,255,240,0.6)'; g.lineWidth = 0.6 / (this.subj.scale / 1.5); g.stroke(); }
      g.restore();
    }
    for (const b of this.bits) { g.fillStyle = `rgba(230,230,200,${b.life})`; g.fillRect(b.x, b.y, b.s, b.s); }
    g.restore();
    if (this.trail.length > 1) {
      g.save(); g.lineCap = 'round';
      for (let i = 1; i < this.trail.length; i++) { const a = this.trail[i - 1], b = this.trail[i]; g.strokeStyle = `rgba(255,255,255,${0.7 * (1 - b.t / 0.25)})`; g.lineWidth = 3 * S; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
      g.restore();
    }
    if (this.knife) drawKnife(g, this.knife.x, this.knife.y, this.knife.a, S * 0.8, true);
  }
}
