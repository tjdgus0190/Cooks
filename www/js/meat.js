// 스테이크 그래픽: 형태, 마블링 텍스처, 근막, 크러스트, 단면
import { TAU, rng, clamp, resample, pointInPoly, lerp } from './geom.js';
import { meatColorAt, crustColor } from './sim.js';

// 단위: mm. 채끝(스트립로인) 형태 — 위쪽 가장자리에 지방층
export const STEAK = { w: 250, h: 170, thick: 28 };
const FAT_W = 15;

export function steakShape() {
  const pts = [];
  const N = 120;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * TAU;
    const c = Math.cos(t), s = Math.sin(t);
    // 둥근 사각형 + 비대칭(한쪽 끝이 좁은 채끝 모양)
    const sq = 3.2;
    const rx = Math.sign(c) * Math.pow(Math.abs(c), 2 / sq);
    const ry = Math.sign(s) * Math.pow(Math.abs(s), 2 / sq);
    let x = rx * 122 * (1 + 0.05 * Math.sin(t * 2 + 0.6));
    let y = ry * 80 * (1 + 0.07 * Math.cos(t + 0.3)) ;
    y *= 1 - 0.13 * (x / 122); // 오른쪽이 좁아짐
    if (y < 0) y *= 1 + 0.04 * Math.sin(x / 30);
    pts.push([x, y + 4]);
  }
  return pts;
}

export const SHAPE = steakShape();
export const SHAPE_PATH = (() => {
  if (typeof Path2D === 'undefined') return null;
  const p = new Path2D();
  SHAPE.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
})();

function edgeAt(a) {
  // 각도 a(라디안)에 해당하는 외곽점 (가장 가까운 각도)
  let best = SHAPE[0], bd = Infinity;
  for (const p of SHAPE) {
    let d = Math.abs(Math.atan2(p[1] - 4, p[0]) - a);
    d = Math.min(d, TAU - d);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function insetPoint(p, inset) {
  const cx = 0, cy = 4;
  const dx = p[0] - cx, dy = p[1] - cy, L = Math.hypot(dx, dy);
  return [p[0] - (dx / L) * inset, p[1] - (dy / L) * inset];
}

// 지방층: 윗변 (화면 좌표 y- 방향 = 각도 -π..0)
export const FAT_RANGE = [-2.55, -0.45];
function fatEdgePolyline() {
  const out = [];
  for (let a = FAT_RANGE[0]; a <= FAT_RANGE[1]; a += 0.02) out.push(edgeAt(a));
  return out;
}
export const FAT_LINE = fatEdgePolyline();

export function inFat(x, y) {
  // 지방 띠 내부인지
  for (let i = 1; i < FAT_LINE.length; i++) {
    const a = FAT_LINE[i - 1];
    if (Math.hypot(x - a[0], y - a[1]) < FAT_W + 2) return true;
  }
  return false;
}

// 근막(실버스킨): 각기 다른 방향의 띠 3개 → 고기를 돌려가며 잘라야 함
export function createMembranes() {
  const defs = [
    { from: 0.35, to: 2.55, inset: 15, width: 13 },      // 아랫변 (가로)
    { from: 2.75, to: 3.6, inset: 13, width: 12 },       // 왼쪽 끝 (세로)
    { from: -0.32, to: 0.32, inset: 26, width: 11, wobble: 6 }, // 오른쪽 안쪽 (세로, 곡선)
  ];
  return defs.map((d, k) => {
    const raw = [];
    for (let a = d.from; a <= d.to + 1e-6; a += 0.04) {
      const e = edgeAt(a);
      const w = d.wobble ? Math.sin((a - d.from) / (d.to - d.from) * Math.PI * 2) * d.wobble : 0;
      raw.push(insetPoint(e, d.inset + w));
    }
    const pts = resample(raw, 3);
    return { id: k, width: d.width, pts, cut: new Uint8Array(pts.length) };
  });
}

export function membraneRemaining(mems) {
  let total = 0, left = 0;
  for (const m of mems) { total += m.pts.length; for (const c of m.cut) if (!c) left++; }
  return total ? left / total : 0;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}

const PAD = 20;
const BX0 = -135 - PAD, BY0 = -95 - PAD, BW = 270 + PAD * 2, BH = 200 + PAD * 2;

/** 고해상도 텍스처 세트 생성 (scale: mm → px) */
export function buildSteakTextures(scale) {
  const tex = { scale };
  tex.raw = drawRawTexture(scale);
  tex.crust = drawCrustTexture(scale);
  tex.gloss = drawGlossTexture(scale);
  tex.shadow = drawShadowTexture(scale);
  return tex;
}

function withLocal(c, scale, fn) {
  const g = c.getContext('2d');
  g.setTransform(scale, 0, 0, scale, -BX0 * scale, -BY0 * scale);
  fn(g);
  return g;
}

function drawRawTexture(scale) {
  const c = makeCanvas(BW * scale, BH * scale);
  const R = rng(1337);
  withLocal(c, scale, (g) => {
    g.save();
    g.clip(SHAPE_PATH);
    // 기본 살코기 색
    const base = g.createRadialGradient(-20, 10, 10, 0, 0, 160);
    base.addColorStop(0, '#c0252f');
    base.addColorStop(0.6, '#a81c27');
    base.addColorStop(1, '#7d1219');
    g.fillStyle = base;
    g.fillRect(-150, -110, 300, 230);
    // 저주파 색 변화
    for (let i = 0; i < 70; i++) {
      const x = -130 + R() * 260, y = -90 + R() * 190, r = 12 + R() * 40;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const pick = R();
      const col = pick < 0.4 ? '210,52,60' : pick < 0.75 ? '140,18,30' : '185,40,52';
      gr.addColorStop(0, `rgba(${col},${0.16 + R() * 0.16})`);
      gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    // 근섬유 결 (대각선 미세 줄)
    g.lineCap = 'round';
    for (let i = 0; i < 520; i++) {
      const x = -140 + R() * 280, y = -100 + R() * 210;
      const L = 4 + R() * 14, ang = 0.5 + (R() - 0.5) * 0.25;
      g.strokeStyle = R() < 0.5 ? `rgba(90,8,16,${0.10 + R() * 0.12})` : `rgba(230,90,96,${0.06 + R() * 0.08})`;
      g.lineWidth = 0.35 + R() * 0.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L); g.stroke();
    }
    // 마블링: 가늘고 불규칙한 그물 모양 지방 (굵은 줄기 → 잔가지)
    const vein = (x, y, ang, len, w, depth) => {
      g.beginPath(); g.moveTo(x, y);
      const pts = [[x, y]];
      for (let k = 0; k < len; k++) {
        ang += (R() - 0.5) * 0.9;
        x += Math.cos(ang) * 1.6; y += Math.sin(ang) * 1.6;
        g.lineTo(x, y); pts.push([x, y]);
      }
      g.strokeStyle = `rgba(248,206,200,${0.18 + R() * 0.2})`; g.lineWidth = w * 2.2; g.stroke();
      g.strokeStyle = `rgba(255,236,230,${0.45 + R() * 0.35})`; g.lineWidth = w; g.stroke();
      if (depth > 0) {
        const nb = 1 + Math.floor(R() * 3);
        for (let b = 0; b < nb; b++) {
          const p = pts[Math.floor(R() * pts.length)];
          vein(p[0], p[1], ang + (R() < 0.5 ? 1 : -1) * (0.6 + R() * 0.9), 3 + Math.floor(R() * len * 0.6), w * 0.6, depth - 1);
        }
      }
    };
    for (let i = 0; i < 34; i++) vein(-120 + R() * 240, -75 + R() * 160, R() * TAU, 6 + Math.floor(R() * 14), 0.35 + Math.pow(R(), 2) * 0.9, 2);
    // 지방 덩어리(부드러운 얼룩)
    for (let i = 0; i < 26; i++) {
      const x = -115 + R() * 230, y = -70 + R() * 150, r = 1.5 + R() * 4;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,238,232,${0.55 + R() * 0.3})`); gr.addColorStop(0.6, 'rgba(250,210,205,0.25)'); gr.addColorStop(1, 'rgba(250,210,205,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * (1 + R()), r, R() * 3, 0, TAU); g.fill();
    }
    // 작은 지방 점
    for (let i = 0; i < 380; i++) {
      const x = -130 + R() * 260, y = -90 + R() * 190;
      g.fillStyle = `rgba(255,228,222,${0.15 + R() * 0.45})`;
      g.beginPath(); g.ellipse(x, y, 0.25 + R() * 0.9, 0.2 + R() * 0.5, R() * 3, 0, TAU); g.fill();
    }
    // 지방층 (윗변)
    g.lineJoin = 'round';
    strokeLine(g, FAT_LINE, FAT_W * 2 + 6, 'rgba(236,190,176,0.9)');
    strokeLine(g, FAT_LINE, FAT_W * 2, '#efdcc4');
    strokeLine(g, FAT_LINE, FAT_W * 2 - 8, '#f6e9d6');
    for (let i = 0; i < 160; i++) {
      const p = FAT_LINE[Math.floor(R() * FAT_LINE.length)];
      g.fillStyle = `rgba(${R() < 0.5 ? '226,196,160' : '255,250,240'},${0.25 + R() * 0.35})`;
      g.beginPath(); g.ellipse(p[0] + (R() - 0.5) * 24, p[1] + (R() - 0.5) * 24, 1 + R() * 3, 0.6 + R() * 1.5, R() * 3, 0, TAU); g.fill();
    }
    // 가장자리 음영 (입체감)
    g.lineWidth = 10;
    g.strokeStyle = 'rgba(60,0,8,0.28)';
    g.stroke(SHAPE_PATH);
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(40,0,6,0.3)';
    g.stroke(SHAPE_PATH);
    g.restore();
  });
  return c;
}

function drawShadowTexture(scale) {
  // 블러 필터 없이 여러 겹 외곽선으로 만든 부드러운 그림자 (모바일 성능)
  const c = makeCanvas(BW * scale, BH * scale);
  withLocal(c, scale, (g) => {
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fill(SHAPE_PATH);
    g.lineJoin = 'round';
    for (let r = 1; r <= 12; r++) {
      g.lineWidth = r * 2;
      g.strokeStyle = 'rgba(0,0,0,0.045)';
      g.stroke(SHAPE_PATH);
    }
  });
  return c;
}

/** 스테이크 그림자 (로컬 좌표) */
export function drawSteakShadow(g, tex, ox = 4, oy = 10, alpha = 0.6) {
  g.save();
  g.globalAlpha *= alpha;
  g.drawImage(tex.shadow, BX0 + ox, BY0 + oy, BW, BH);
  g.restore();
}

function strokeLine(g, pts, w, color) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.lineWidth = w; g.strokeStyle = color; g.stroke();
}

function drawCrustTexture(scale) {
  // 마이야르 크러스트: 저주파 색 얼룩(황금/진갈색) + 미세 알갱이 + 갈라진 결
  const c = makeCanvas(BW * scale, BH * scale);
  const R = rng(4242);
  withLocal(c, scale, (g) => {
    g.save(); g.clip(SHAPE_PATH);
    // 큰 얼룩: 볼록한 부분은 황금빛, 오목한 부분은 진하게
    for (let i = 0; i < 160; i++) {
      const x = -135 + R() * 270, y = -95 + R() * 200, r = 8 + R() * 26;
      const dark = R() < 0.5;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const col = dark ? '45,16,4' : '214,140,64';
      gr.addColorStop(0, `rgba(${col},${dark ? 0.22 + R() * 0.2 : 0.16 + R() * 0.18})`);
      gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    // 미세 알갱이 (구운 표면의 오돌토돌함)
    for (let i = 0; i < 3600; i++) {
      const x = -135 + R() * 270, y = -95 + R() * 200;
      const v = R();
      g.fillStyle = v < 0.5 ? `rgba(40,12,2,${0.15 + R() * 0.3})` : v < 0.95 ? `rgba(130,50,14,${0.2 + R() * 0.3})` : `rgba(240,170,90,${0.15 + R() * 0.2})`;
      const r = 0.25 + Math.pow(R(), 3) * 1.6;
      g.beginPath(); g.ellipse(x, y, r * (1 + R()), r, R() * 3, 0, TAU); g.fill();
    }
    // 근섬유 결을 따라 갈라진 틈
    for (let i = 0; i < 260; i++) {
      let x = -135 + R() * 270, y = -95 + R() * 200;
      g.strokeStyle = `rgba(24,8,2,${0.2 + R() * 0.35})`;
      g.lineWidth = 0.35 + R() * 0.8;
      g.beginPath(); g.moveTo(x, y);
      const a = 0.5 + (R() - 0.5) * 0.7;
      for (let k = 0; k < 3; k++) { x += Math.cos(a + (R() - 0.5)) * (2 + R() * 4); y += Math.sin(a + (R() - 0.5)) * (2 + R() * 4); g.lineTo(x, y); }
      g.stroke();
    }
    // 가장자리는 더 진하고 바삭하게
    g.lineWidth = 16; g.strokeStyle = 'rgba(30,10,2,0.28)'; g.stroke(SHAPE_PATH);
    g.lineWidth = 5; g.strokeStyle = 'rgba(20,6,0,0.35)'; g.stroke(SHAPE_PATH);
    g.restore();
  });
  return c;
}

function drawGlossTexture(scale) {
  // 기름/육즙 윤기: 넓고 은은한 하이라이트 + 작은 반짝임
  const c = makeCanvas(BW * scale, BH * scale);
  const R = rng(99);
  withLocal(c, scale, (g) => {
    g.save(); g.clip(SHAPE_PATH);
    const broad = g.createLinearGradient(-120, -90, 60, 60);
    broad.addColorStop(0, 'rgba(255,240,220,0.10)'); broad.addColorStop(0.45, 'rgba(255,240,220,0.02)'); broad.addColorStop(1, 'rgba(255,240,220,0)');
    g.fillStyle = broad; g.fillRect(-140, -100, 280, 210);
    for (let i = 0; i < 14; i++) {
      const x = -110 + R() * 200, y = -70 + R() * 130;
      g.save();
      g.translate(x, y); g.rotate(-0.6 + (R() - 0.5) * 0.5);
      const w = 10 + R() * 22;
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, w);
      gr.addColorStop(0, 'rgba(255,250,235,0.22)');
      gr.addColorStop(1, 'rgba(255,250,235,0)');
      g.scale(1, 0.35);
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, w, 0, TAU); g.fill();
      g.restore();
    }
    for (let i = 0; i < 180; i++) {
      const x = -125 + R() * 250, y = -85 + R() * 180;
      // 왼쪽 위(조명 방향)일수록 더 많이 반짝임
      const bias = 1 - (x + y + 200) / 420;
      if (R() > 0.35 + bias * 0.6) continue;
      g.fillStyle = `rgba(255,252,240,${0.35 + R() * 0.55})`;
      g.beginPath(); g.arc(x, y, 0.25 + Math.pow(R(), 2) * 0.9, 0, TAU); g.fill();
    }
    g.restore();
  });
  return c;
}

/**
 * 스테이크 윗면 그리기 (ctx는 이미 로컬 mm 좌표계로 변환된 상태)
 * opts: { brown, oil, grains, mems, scars, faceIsTrimmed, side: {Tmax, brownDown, thickPx} }
 */
export function drawSteakTop(g, tex, opts = {}) {
  const brown = opts.brown || 0;
  // 측면(두께)
  if (opts.side) drawSide(g, opts.side);
  else drawRawSide(g, opts.sideThick ?? 7);
  g.drawImage(tex.raw, BX0, BY0, BW, BH);
  if (opts.scars && opts.scars.length) drawScars(g, opts.scars);
  if (brown > 0.01) {
    const cc = crustColor(brown);
    g.save();
    g.clip(SHAPE_PATH);
    g.globalAlpha = cc.a;
    g.fillStyle = `rgb(${cc.rgb.join(',')})`;
    g.fillRect(BX0, BY0, BW, BH);
    // 지방층은 황금빛으로 투명하게
    g.globalAlpha = Math.min(1, cc.a) * 0.85;
    const fat = crustColor(brown * 0.7).rgb.map((v, i) => Math.min(255, v + [70, 60, 30][i]));
    strokeLine(g, FAT_LINE, FAT_W * 2, `rgb(${fat.join(',')})`);
    g.globalAlpha = clamp(brown * 1.1, 0, 1) * 0.9;
    g.drawImage(tex.crust, BX0, BY0, BW, BH);
    // 구운 면의 따뜻한 볼륨감 (가운데가 볼록하게 빛남)
    g.globalAlpha = clamp(brown, 0, 1) * 0.28;
    const vol = g.createRadialGradient(-30, -25, 5, 0, 0, 140);
    vol.addColorStop(0, 'rgba(255,150,70,0.55)'); vol.addColorStop(0.5, 'rgba(120,40,10,0.15)'); vol.addColorStop(1, 'rgba(20,5,0,0.9)');
    g.fillStyle = vol; g.fillRect(BX0, BY0, BW, BH);
    if (brown > 1.4) {
      // 탄 부분
      g.globalAlpha = clamp((brown - 1.4) * 0.8, 0, 0.9);
      g.drawImage(tex.crust, BX0, BY0, BW, BH);
    }
    g.restore();
  }
  if (opts.mems) drawMembranes(g, opts.mems, brown);
  if (opts.grains && opts.grains.length) drawGrains(g, opts.grains, brown);
  // 윤기 (기름/육즙)
  const gloss = clamp(0.35 + (opts.oil || 0) * 0.06, 0.35, 1) * (brown > 0.05 ? 0.9 : 0.7);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = gloss * (opts.glossMul ?? 1);
  g.drawImage(tex.gloss, BX0, BY0, BW, BH);
  g.restore();
  if (opts.oilDrops && opts.oilDrops.length) drawOilDrops(g, opts.oilDrops, brown);
}

function drawRawSide(g, t) {
  g.save();
  g.translate(0, t);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.filter = 'none';
  g.translate(0, 3);
  g.fill(SHAPE_PATH);
  g.translate(0, -3);
  const gr = g.createLinearGradient(0, -90, 0, 100);
  gr.addColorStop(0, '#6e0f16'); gr.addColorStop(1, '#4a080d');
  g.fillStyle = gr;
  g.fill(SHAPE_PATH);
  g.restore();
}

/** 팬 위 측면: 아래에서부터 익어 올라오는 색 띠 */
function drawSide(g, side) {
  const { Tmax, brownDown, thickPx } = side;
  const n = Tmax.length;
  const layers = 14;
  for (let k = layers; k >= 1; k--) {
    const frac = k / layers;             // 1 = 맨 아래(팬 쪽)
    const idx = Math.round((1 - frac) * (n - 1));
    let rgb = meatColorAt(Tmax[idx] ?? 20);
    // 측면은 겉면이 공기에 닿아 더 진하게 익는다
    rgb = rgb.map((v) => v * 0.78);
    if (k === layers) {
      const cc = crustColor(brownDown);
      rgb = rgb.map((v, i) => lerp(v, cc.rgb[i], cc.a));
    }
    g.save();
    g.translate(0, frac * thickPx);
    g.fillStyle = `rgb(${rgb.map((v) => v | 0).join(',')})`;
    g.fill(SHAPE_PATH);
    g.restore();
  }
}

export function drawMembranes(g, mems, brown = 0) {
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  const cooked = clamp(brown, 0, 1);
  for (const m of mems) {
    let run = [];
    const flush = () => {
      if (run.length >= 2) {
        // 얇고 반투명한 은빛 막 + 결 방향 섬유
        strokeLine(g, run, m.width + 3, `rgba(${lerp(120, 90, cooked)},${lerp(130, 70, cooked)},${lerp(160, 50, cooked)},0.22)`);
        strokeLine(g, run, m.width, `rgba(${lerp(214, 196, cooked)},${lerp(222, 176, cooked)},${lerp(238, 146, cooked)},${lerp(0.62, 0.5, cooked)})`);
        for (let f = -2; f <= 2; f++) {
          const off = f * m.width * 0.18;
          const fib = run.map((p, i) => {
            const q = run[Math.min(run.length - 1, i + 1)], o = run[Math.max(0, i - 1)];
            let nx = -(q[1] - o[1]), ny = q[0] - o[0];
            const L = Math.hypot(nx, ny) || 1;
            return [p[0] + (nx / L) * off, p[1] + (ny / L) * off];
          });
          strokeLine(g, fib, 0.45, `rgba(255,255,255,${0.35 + (2 - Math.abs(f)) * 0.12})`);
        }
        strokeLine(g, run.map(([x, y]) => [x - 0.8, y - 1.2]), 1.1, 'rgba(255,255,255,0.55)');
      }
      run = [];
    };
    for (let i = 0; i < m.pts.length; i++) {
      if (!m.cut[i]) run.push(m.pts[i]); else flush();
    }
    flush();
  }
  g.restore();
}

export function drawScars(g, scars) {
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.clip(SHAPE_PATH);
  for (const s of scars) {
    if (s.length < 2) continue;
    strokeLine(g, s, 4.2, 'rgba(70,0,8,0.55)');
    strokeLine(g, s, 1.8, 'rgba(45,0,4,0.9)');
    strokeLine(g, s.map(([x, y]) => [x + 1.4, y + 1.4]), 1, 'rgba(240,120,120,0.5)');
  }
  g.restore();
}

export function drawGrains(g, grains, brown = 0) {
  for (const gr of grains) {
    if (gr.type === 'salt') {
      const a = brown > 0.2 ? 0.14 : 0.95; // 굽고 나면 녹아서 거의 안 보임
      g.fillStyle = `rgba(255,255,255,${a})`;
      g.save(); g.translate(gr.x, gr.y); g.rotate(gr.r || 0);
      g.fillRect(-gr.s / 2, -gr.s / 2, gr.s, gr.s);
      g.fillStyle = `rgba(200,210,230,${a * 0.6})`;
      g.fillRect(-gr.s / 2, 0, gr.s, gr.s / 2);
      g.restore();
    } else {
      g.fillStyle = brown > 0.2 ? 'rgba(20,14,10,0.95)' : 'rgba(26,20,16,0.95)';
      g.beginPath();
      g.ellipse(gr.x, gr.y, gr.s, gr.s * 0.75, gr.r || 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(120,100,80,0.6)';
      g.beginPath(); g.arc(gr.x - gr.s * 0.3, gr.y - gr.s * 0.3, gr.s * 0.3, 0, TAU); g.fill();
    }
  }
}

function drawOilDrops(g, drops, brown) {
  g.save();
  g.clip(SHAPE_PATH);
  for (const d of drops) {
    const gr = g.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, 0, d.x, d.y, d.r);
    gr.addColorStop(0, 'rgba(255,250,200,0.75)');
    gr.addColorStop(0.35, brown > 0.1 ? 'rgba(255,200,110,0.3)' : 'rgba(230,200,90,0.32)');
    gr.addColorStop(1, 'rgba(200,170,60,0)');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(d.x, d.y, d.r * 1.3, d.r, d.a || 0, 0, TAU); g.fill();
  }
  g.restore();
}

export function insideSteak(x, y) { return pointInPoly(x, y, SHAPE); }

/** 단면 띠(슬라이스 한 조각의 잘린 면) 그리기 — 길이 L, 두께 T (로컬 원점: 왼쪽 위) */
export function drawCrossSection(g, L, T, Tmax, brownTop, brownBottom, opts = {}) {
  const n = Tmax.length;
  const r = Math.min(T * 0.45, 10);
  const path = new Path2D();
  path.moveTo(r, 0); path.lineTo(L - r * 0.6, 0);
  path.quadraticCurveTo(L, 0, L, r);
  path.lineTo(L, T - r); path.quadraticCurveTo(L, T, L - r * 0.6, T);
  path.lineTo(r, T); path.quadraticCurveTo(0, T, 0, T - r); path.lineTo(0, r); path.quadraticCurveTo(0, 0, r, 0);
  g.save();
  g.clip(path);
  // 세로 방향 온도 분포 → 그라데이션 (0=위)
  const gr = g.createLinearGradient(0, 0, 0, T);
  for (let i = 0; i < n; i++) {
    const rgb = meatColorAt(Tmax[n - 1 - i]);
    gr.addColorStop(i / (n - 1), `rgb(${rgb.join(',')})`);
  }
  g.fillStyle = gr; g.fillRect(0, 0, L, T);
  // 가로 결/육즙 광택
  const R = rng(opts.seed || 7);
  for (let i = 0; i < L / 2.2; i++) {
    const x = R() * L, y = T * 0.15 + R() * T * 0.7;
    g.strokeStyle = R() < 0.5 ? 'rgba(120,10,20,0.18)' : 'rgba(255,190,190,0.14)';
    g.lineWidth = 0.4 + R() * 0.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3 + R() * 6, y + (R() - 0.5)); g.stroke();
  }
  // 마블링 점
  for (let i = 0; i < L / 6; i++) {
    g.fillStyle = `rgba(255,236,226,${0.25 + R() * 0.4})`;
    g.beginPath(); g.ellipse(R() * L, T * 0.2 + R() * T * 0.6, 0.5 + R() * 1.6, 0.3 + R() * 0.6, 0, 0, TAU); g.fill();
  }
  // 위/아래 크러스트
  const ct = crustColor(brownTop), cb = crustColor(brownBottom);
  const tt = 1.2 + clamp(brownTop, 0, 2) * 1.6, tb = 1.2 + clamp(brownBottom, 0, 2) * 1.6;
  let cg = g.createLinearGradient(0, 0, 0, tt + 2);
  cg.addColorStop(0, `rgba(${ct.rgb.join(',')},1)`); cg.addColorStop(1, `rgba(${ct.rgb.join(',')},0)`);
  g.fillStyle = cg; g.fillRect(0, 0, L, tt + 2);
  cg = g.createLinearGradient(0, T, 0, T - tb - 2);
  cg.addColorStop(0, `rgba(${cb.rgb.join(',')},1)`); cg.addColorStop(1, `rgba(${cb.rgb.join(',')},0)`);
  g.fillStyle = cg; g.fillRect(0, T - tb - 2, L, tb + 2);
  // 지방 끝부분
  if (opts.fatEnd) {
    const fg = g.createLinearGradient(0, 0, 13, 0);
    fg.addColorStop(0, '#d9a868'); fg.addColorStop(0.25, '#f2dcb8'); fg.addColorStop(1, 'rgba(242,220,184,0)');
    g.fillStyle = fg; g.fillRect(0, 0, 14, T);
  }
  // 육즙 하이라이트
  const hl = g.createLinearGradient(0, 0, 0, T);
  hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.3, 'rgba(255,255,255,0.16)'); hl.addColorStop(0.45, 'rgba(255,255,255,0)');
  g.fillStyle = hl; g.fillRect(0, 0, L, T);
  g.restore();
  g.save();
  g.strokeStyle = 'rgba(40,12,4,0.5)'; g.lineWidth = 0.8; g.stroke(path);
  g.restore();
}

/** 스테이크 x 위치에서의 세로 폭 (슬라이스 길이 계산용) */
export function steakSpanAt(x) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < SHAPE.length; i++) {
    const a = SHAPE[i], b = SHAPE[(i + 1) % SHAPE.length];
    if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) {
      const t = (x - a[0]) / (b[0] - a[0]);
      const y = a[1] + (b[1] - a[1]) * t;
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
  }
  return hi > lo ? [lo, hi] : null;
}

export const STEAK_BOUNDS = { x0: BX0, y0: BY0, w: BW, h: BH };
