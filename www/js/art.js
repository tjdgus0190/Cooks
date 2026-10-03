// 공용 그래픽: 배경, 도마, 팬, 접시, 칼, 양념통, 가니쉬, 손님
import { TAU, rng, clamp, lerp } from './geom.js';
import { drawBaguette, drawLemonWedge, drawParsleyPinch } from './food.js';

const cache = new Map();
function cached(key, w, h, dpr, painter) {
  const k = `${key}|${w}|${h}|${dpr}`;
  let c = cache.get(k);
  if (!c) {
    c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    painter(g, w, h);
    if (cache.size > 40) cache.clear();
    cache.set(k, c);
  }
  return c;
}

export function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** 주방 조리대 배경 (어두운 대리석 + 따뜻한 조명) */
export function drawCounter(g, W, H, dpr) {
  const c = cached('counter', W, H, dpr, (q) => {
    const bg = q.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2b211c'); bg.addColorStop(1, '#171210');
    q.fillStyle = bg; q.fillRect(0, 0, W, H);
    const R = rng(5);
    // 대리석 결
    for (let i = 0; i < 14; i++) {
      q.beginPath();
      let x = R() * W, y = R() * H, a = R() * 6.28;
      q.moveTo(x, y);
      for (let k = 0; k < 30; k++) { a += (R() - 0.5) * 0.5; x += Math.cos(a) * 18; y += Math.sin(a) * 18; q.lineTo(x, y); }
      q.strokeStyle = `rgba(255,240,225,${0.015 + R() * 0.03})`;
      q.lineWidth = 0.6 + R() * 1.8; q.stroke();
    }
    for (let i = 0; i < 1600; i++) {
      q.fillStyle = `rgba(255,255,255,${R() * 0.035})`;
      q.fillRect(R() * W, R() * H, 1, 1);
    }
    // 위쪽 따뜻한 조명
    const light = q.createRadialGradient(W * 0.5, H * 0.38, 10, W * 0.5, H * 0.45, Math.max(W, H) * 0.75);
    light.addColorStop(0, 'rgba(255,190,120,0.22)');
    light.addColorStop(0.5, 'rgba(255,150,80,0.07)');
    light.addColorStop(1, 'rgba(0,0,0,0.45)');
    q.fillStyle = light; q.fillRect(0, 0, W, H);
  });
  g.drawImage(c, 0, 0, W, H);
}

/** 원목 식탁 배경 */
export function drawTable(g, W, H, dpr) {
  const c = cached('table', W, H, dpr, (q) => {
    q.fillStyle = '#3b2216'; q.fillRect(0, 0, W, H);
    const R = rng(11);
    const plank = Math.max(70, W / 4.5);
    for (let x = 0; x < W + plank; x += plank) {
      const tone = 0.85 + R() * 0.3;
      q.fillStyle = `rgb(${92 * tone | 0},${54 * tone | 0},${32 * tone | 0})`;
      q.fillRect(x, 0, plank - 2, H);
      for (let i = 0; i < 40; i++) {
        const gx = x + R() * plank;
        q.beginPath(); q.moveTo(gx, 0);
        for (let y = 0; y <= H; y += 40) q.lineTo(gx + Math.sin(y * 0.01 + i) * (3 + R() * 6), y);
        q.strokeStyle = `rgba(${R() < 0.5 ? '30,14,6' : '160,100,60'},${0.08 + R() * 0.12})`;
        q.lineWidth = 0.6 + R() * 1.6; q.stroke();
      }
      q.fillStyle = 'rgba(0,0,0,0.5)'; q.fillRect(x + plank - 2, 0, 2, H);
    }
    const light = q.createRadialGradient(W * 0.5, H * 0.45, 20, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
    light.addColorStop(0, 'rgba(255,200,140,0.18)'); light.addColorStop(1, 'rgba(0,0,0,0.6)');
    q.fillStyle = light; q.fillRect(0, 0, W, H);
  });
  g.drawImage(c, 0, 0, W, H);
}

/** 원목 도마 */
export function drawBoard(g, cx, cy, w, h, dpr) {
  const c = cached('board', Math.round(w), Math.round(h), dpr, (q, W, H) => {
    const pad = 14;
    q.save();
    q.shadowColor = 'rgba(0,0,0,0.55)'; q.shadowBlur = 24; q.shadowOffsetY = 12;
    rr(q, pad, pad, W - pad * 2, H - pad * 2, 26);
    q.fillStyle = '#c99257'; q.fill();
    q.restore();
    q.save();
    rr(q, pad, pad, W - pad * 2, H - pad * 2, 26); q.clip();
    const R = rng(21);
    const base = q.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, '#e2b277'); base.addColorStop(0.5, '#d29c5e'); base.addColorStop(1, '#bd8448');
    q.fillStyle = base; q.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      const y0 = R() * H;
      q.beginPath(); q.moveTo(0, y0);
      for (let x = 0; x <= W; x += 20) q.lineTo(x, y0 + Math.sin(x * 0.012 + i) * (2 + R() * 7) + Math.sin(x * 0.05 + i * 2) * 1.2);
      q.strokeStyle = `rgba(${R() < 0.6 ? '140,82,36' : '250,215,160'},${0.08 + R() * 0.16})`;
      q.lineWidth = 0.5 + R() * 2; q.stroke();
    }
    // 홈(주스 그루브)
    rr(q, pad + 16, pad + 16, W - pad * 2 - 32, H - pad * 2 - 32, 16);
    q.strokeStyle = 'rgba(110,60,24,0.35)'; q.lineWidth = 5; q.stroke();
    rr(q, pad + 17.5, pad + 18, W - pad * 2 - 32, H - pad * 2 - 32, 16);
    q.strokeStyle = 'rgba(255,225,180,0.25)'; q.lineWidth = 1.5; q.stroke();
    // 칼자국
    for (let i = 0; i < 40; i++) {
      const x = pad + 30 + R() * (W - 60 - pad * 2), y = pad + 30 + R() * (H - 60 - pad * 2), a = R() * TAU, L = 6 + R() * 18;
      q.beginPath(); q.moveTo(x, y); q.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
      q.strokeStyle = 'rgba(120,70,30,0.18)'; q.lineWidth = 0.8; q.stroke();
    }
    const hl = q.createLinearGradient(0, 0, 0, H);
    hl.addColorStop(0, 'rgba(255,240,210,0.25)'); hl.addColorStop(0.3, 'rgba(255,240,210,0)'); hl.addColorStop(1, 'rgba(60,20,0,0.18)');
    q.fillStyle = hl; q.fillRect(0, 0, W, H);
    q.restore();
    rr(q, pad, pad, W - pad * 2, H - pad * 2, 26);
    q.strokeStyle = 'rgba(90,50,20,0.6)'; q.lineWidth = 2; q.stroke();
  });
  g.drawImage(c, cx - w / 2, cy - h / 2, w, h);
}

/** 가스레인지 + 무쇠팬 (heat 0~1: 불꽃 세기, panTemp 표시용) */
export function drawStoveAndPan(g, cx, cy, r, heat, time, dpr, panTemp = 200) {
  // 화구 불빛
  if (heat > 0) {
    const glow = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * (1.25 + heat * 0.25));
    glow.addColorStop(0, `rgba(80,140,255,${0.25 + heat * 0.25})`);
    glow.addColorStop(0.35, `rgba(255,140,40,${0.12 + heat * 0.2})`);
    glow.addColorStop(1, 'rgba(255,100,20,0)');
    g.fillStyle = glow;
    g.beginPath(); g.arc(cx, cy, r * 1.6, 0, TAU); g.fill();
    // 불꽃 혀
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + time * 0.3;
      const flick = 0.75 + 0.25 * Math.sin(time * 18 + i * 3.1);
      const L = r * (0.08 + heat * 0.14) * flick;
      const x = cx + Math.cos(a) * r * 1.0, y = cy + Math.sin(a) * r * 1.0;
      const fg = g.createLinearGradient(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L);
      fg.addColorStop(0, 'rgba(90,150,255,0.9)'); fg.addColorStop(0.6, 'rgba(140,190,255,0.5)'); fg.addColorStop(1, 'rgba(255,160,80,0)');
      g.strokeStyle = fg; g.lineWidth = r * 0.05; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    }
  }
  // 손잡이
  const pan = cached('pan', Math.round(r * 2.9), Math.round(r * 2.9), dpr, (q, W) => {
    const c0 = W / 2, R0 = r;
    q.save();
    q.translate(c0, c0);
    // 손잡이 (오른쪽 아래)
    q.save();
    q.rotate(0.7);
    q.shadowColor = 'rgba(0,0,0,0.6)'; q.shadowBlur = 16; q.shadowOffsetY = 8;
    rr(q, R0 * 0.9, -R0 * 0.1, R0 * 0.52, R0 * 0.2, R0 * 0.08);
    const hg = q.createLinearGradient(0, -R0 * 0.1, 0, R0 * 0.1);
    hg.addColorStop(0, '#3a3634'); hg.addColorStop(0.5, '#1c1a19'); hg.addColorStop(1, '#0c0b0a');
    q.fillStyle = hg; q.fill();
    q.restore();
    q.shadowColor = 'rgba(0,0,0,0.7)'; q.shadowBlur = 30; q.shadowOffsetY = 14;
    q.beginPath(); q.arc(0, 0, R0, 0, TAU);
    q.fillStyle = '#141211'; q.fill();
    q.shadowColor = 'transparent';
    // 테두리
    const rim = q.createLinearGradient(-R0, -R0, R0, R0);
    rim.addColorStop(0, '#5b5653'); rim.addColorStop(0.5, '#262322'); rim.addColorStop(1, '#0d0c0b');
    q.beginPath(); q.arc(0, 0, R0, 0, TAU); q.arc(0, 0, R0 * 0.88, 0, TAU, true);
    q.fillStyle = rim; q.fill();
    // 바닥면
    const fl = q.createRadialGradient(-R0 * 0.25, -R0 * 0.3, R0 * 0.05, 0, 0, R0 * 0.88);
    fl.addColorStop(0, '#34302d'); fl.addColorStop(0.6, '#1d1a18'); fl.addColorStop(1, '#0f0d0c');
    q.beginPath(); q.arc(0, 0, R0 * 0.88, 0, TAU); q.fillStyle = fl; q.fill();
    const R = rng(77);
    for (let i = 0; i < 900; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * R0 * 0.87;
      q.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},${R() * 0.06})`;
      q.fillRect(Math.cos(a) * d, Math.sin(a) * d, 1.2, 1.2);
    }
    // 테두리 하이라이트
    q.beginPath(); q.arc(0, 0, R0 * 0.985, -2.6, -1.0);
    q.strokeStyle = 'rgba(255,255,255,0.22)'; q.lineWidth = 2; q.stroke();
    q.beginPath(); q.arc(0, 0, R0 * 0.89, 0.4, 2.0);
    q.strokeStyle = 'rgba(255,255,255,0.08)'; q.lineWidth = 2; q.stroke();
    q.restore();
  });
  g.drawImage(pan, cx - pan.width / dpr / 2, cy - pan.height / dpr / 2, pan.width / dpr, pan.height / dpr);
  // 기름 윤기 (뜨거울수록 일렁임)
  const shimmer = clamp((panTemp - 100) / 150, 0, 1);
  if (shimmer > 0) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const sx = cx - r * 0.3 + Math.sin(time * 1.3) * r * 0.05, sy = cy - r * 0.35;
    const og = g.createRadialGradient(sx, sy, 0, sx, sy, r * 0.6);
    og.addColorStop(0, `rgba(255,200,120,${0.12 * shimmer})`); og.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = og; g.beginPath(); g.arc(cx, cy, r * 0.86, 0, TAU); g.fill();
    g.restore();
  }
}

/** 하얀 도자기 접시 */
export function drawPlate(g, cx, cy, r, dpr) {
  const c = cached('plate', Math.round(r * 2.4), Math.round(r * 2.4), dpr, (q, W) => {
    const c0 = W / 2;
    q.translate(c0, c0);
    q.shadowColor = 'rgba(0,0,0,0.55)'; q.shadowBlur = 28; q.shadowOffsetY = 14;
    q.beginPath(); q.arc(0, 0, r, 0, TAU);
    q.fillStyle = '#f4f1ec'; q.fill();
    q.shadowColor = 'transparent';
    const rim = q.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.2, 0, 0, r);
    rim.addColorStop(0, '#ffffff'); rim.addColorStop(0.75, '#f1ede6'); rim.addColorStop(1, '#d9d3c9');
    q.beginPath(); q.arc(0, 0, r, 0, TAU); q.fillStyle = rim; q.fill();
    // 안쪽 우물
    const wellR = r * 0.72;
    const well = q.createRadialGradient(r * 0.1, r * 0.15, wellR * 0.2, 0, 0, wellR);
    well.addColorStop(0, '#fbfaf7'); well.addColorStop(0.85, '#f2efe9'); well.addColorStop(1, '#e2ddd3');
    q.beginPath(); q.arc(0, 0, wellR, 0, TAU); q.fillStyle = well; q.fill();
    q.beginPath(); q.arc(0, 0, wellR, 0, TAU);
    q.strokeStyle = 'rgba(160,150,135,0.35)'; q.lineWidth = 1.5; q.stroke();
    q.beginPath(); q.arc(0, 0, wellR + 2, -2.4, -0.6);
    q.strokeStyle = 'rgba(255,255,255,0.9)'; q.lineWidth = 2; q.stroke();
    // 림 하이라이트
    q.beginPath(); q.arc(0, 0, r * 0.93, -2.7, -1.6);
    q.strokeStyle = 'rgba(255,255,255,0.95)'; q.lineWidth = r * 0.05; q.lineCap = 'round'; q.stroke();
    // 얇은 테두리 장식선
    q.beginPath(); q.arc(0, 0, r * 0.965, 0, TAU);
    q.strokeStyle = 'rgba(150,120,70,0.35)'; q.lineWidth = 1; q.stroke();
  });
  g.drawImage(c, cx - c.width / dpr / 2, cy - c.height / dpr / 2, c.width / dpr, c.height / dpr);
}

/** 셰프 나이프 — (x,y)가 칼끝, angle은 칼날 방향 */
export function drawKnife(g, x, y, angle, s, active) {
  g.save();
  g.translate(x, y); g.rotate(angle);
  g.scale(s, s);
  g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 10; g.shadowOffsetY = 8;
  // 칼날 (칼끝이 원점, +x 방향으로 손잡이)
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(40, -3, 110, -4);
  g.lineTo(112, -26);
  g.quadraticCurveTo(50, -24, 0, 0);
  const bl = g.createLinearGradient(0, -26, 0, 0);
  bl.addColorStop(0, '#9aa3ad'); bl.addColorStop(0.45, '#eef2f6'); bl.addColorStop(0.75, '#c5ccd4'); bl.addColorStop(1, '#ffffff');
  g.fillStyle = bl; g.fill();
  g.shadowColor = 'transparent';
  g.strokeStyle = 'rgba(60,70,80,0.6)'; g.lineWidth = 0.8; g.stroke();
  // 날 하이라이트
  g.beginPath(); g.moveTo(4, -1); g.quadraticCurveTo(40, -3.5, 108, -4.6);
  g.strokeStyle = active ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.7)'; g.lineWidth = 1.2; g.stroke();
  // 볼스터
  rr(g, 110, -27, 8, 24, 2);
  g.fillStyle = '#8c939b'; g.fill();
  // 손잡이
  rr(g, 117, -24, 70, 18, 8);
  const hd = g.createLinearGradient(0, -24, 0, -6);
  hd.addColorStop(0, '#5a3420'); hd.addColorStop(0.5, '#3a1f12'); hd.addColorStop(1, '#22120a');
  g.fillStyle = hd; g.fill();
  for (const rx of [132, 152, 172]) { g.beginPath(); g.arc(rx, -15, 2.3, 0, TAU); g.fillStyle = '#d6dbe0'; g.fill(); }
  g.restore();
}

/** 소금통 / 후추 그라인더 / 올리브오일 병 */
export function drawShaker(g, kind, x, y, s, tilt = 0) {
  g.save();
  g.translate(x, y); g.rotate(tilt); g.scale(s, s);
  g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 16; g.shadowOffsetY = 10;
  if (kind === 'salt') {
    // 유리 몸통 (거꾸로 들고 있음: 뚜껑이 아래)
    rr(g, -22, -60, 44, 66, 12);
    const gl = g.createLinearGradient(-22, 0, 22, 0);
    gl.addColorStop(0, 'rgba(220,235,245,0.55)'); gl.addColorStop(0.3, 'rgba(255,255,255,0.85)'); gl.addColorStop(1, 'rgba(190,210,225,0.5)');
    g.fillStyle = gl; g.fill();
    g.shadowColor = 'transparent';
    rr(g, -18, -50, 36, 34, 8); g.fillStyle = 'rgba(255,255,255,0.95)'; g.fill(); // 소금
    g.fillStyle = 'rgba(220,225,235,0.8)';
    for (let i = 0; i < 20; i++) g.fillRect(-16 + ((i * 7) % 32), -48 + ((i * 13) % 30), 2, 2);
    // 금속 뚜껑
    rr(g, -24, 4, 48, 20, 6);
    const mt = g.createLinearGradient(-24, 0, 24, 0);
    mt.addColorStop(0, '#8a9097'); mt.addColorStop(0.4, '#f4f6f8'); mt.addColorStop(1, '#6e747b');
    g.fillStyle = mt; g.fill();
    g.fillStyle = '#333';
    for (const hx of [-10, 0, 10]) { g.beginPath(); g.arc(hx, 20, 1.6, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-14, -56, 5, 56);
  } else if (kind === 'pepper') {
    // 원목 그라인더
    const wd = g.createLinearGradient(-20, 0, 20, 0);
    wd.addColorStop(0, '#3c2112'); wd.addColorStop(0.35, '#8b5530'); wd.addColorStop(1, '#2b170c');
    g.beginPath();
    g.moveTo(-14, -78); g.quadraticCurveTo(-24, -60, -16, -40); g.quadraticCurveTo(-26, -10, -18, 14);
    g.lineTo(18, 14); g.quadraticCurveTo(26, -10, 16, -40); g.quadraticCurveTo(24, -60, 14, -78); g.closePath();
    g.fillStyle = wd; g.fill();
    g.shadowColor = 'transparent';
    g.beginPath(); g.ellipse(0, -80, 8, 5, 0, 0, TAU); g.fillStyle = '#c9ced3'; g.fill();
    rr(g, -16, 12, 32, 10, 4); g.fillStyle = '#9aa0a6'; g.fill();
    g.fillStyle = 'rgba(255,220,180,0.25)'; g.fillRect(-9, -72, 4, 80);
  } else {
    // 올리브오일 병
    g.beginPath();
    g.moveTo(-6, -95); g.lineTo(6, -95); g.lineTo(7, -60); g.quadraticCurveTo(24, -50, 24, -30);
    g.lineTo(24, 20); g.quadraticCurveTo(24, 28, 16, 28); g.lineTo(-16, 28); g.quadraticCurveTo(-24, 28, -24, 20);
    g.lineTo(-24, -30); g.quadraticCurveTo(-24, -50, -7, -60); g.closePath();
    const bt = g.createLinearGradient(-24, 0, 24, 0);
    bt.addColorStop(0, 'rgba(40,80,20,0.9)'); bt.addColorStop(0.35, 'rgba(120,160,50,0.85)'); bt.addColorStop(1, 'rgba(30,60,15,0.9)');
    g.fillStyle = bt; g.fill();
    g.shadowColor = 'transparent';
    // 라벨
    rr(g, -20, -22, 40, 30, 4); g.fillStyle = '#f3e7c8'; g.fill();
    g.fillStyle = '#5a7a24'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText('EXTRA', 0, -10); g.fillText('VIRGIN', 0, 1);
    rr(g, -7, -104, 14, 12, 3); g.fillStyle = '#b8903c'; g.fill();
    g.fillStyle = 'rgba(255,255,220,0.35)'; g.fillRect(-16, -40, 4, 60);
  }
  g.restore();
}

// ---------------- 가니쉬 ----------------
export const GARNISHES = [
  { key: 'slaw', name: '양배추 샐러드', icon: '🥬' },
  { key: 'tomato', name: '방울토마토', icon: '🍅' },
  { key: 'asparagus', name: '아스파라거스', icon: '🌱' },
  { key: 'rosemary', name: '로즈마리', icon: '🌿' },
  { key: 'garlic', name: '구운 마늘', icon: '🧄' },
  { key: 'mushroom', name: '양송이', icon: '🍄' },
  { key: 'butter', name: '허브 버터', icon: '🧈' },
  { key: 'micro', name: '새싹 채소', icon: '🌱' },
  { key: 'flake', name: '플레이크 소금', icon: '🧂' },
];

/** 가니쉬 크기(반경, mm 단위) — 겹침 판정/선택에 사용 */
export const GARNISH_R = { slaw: 32, tomato: 11, asparagus: 30, rosemary: 30, garlic: 10, mushroom: 13, butter: 11, micro: 14, flake: 9, baguette: 18, lemon: 16, parsley: 11 };

const CONTACT = { tomato: [12, 11], asparagus: [30, 5], garlic: [9, 8], mushroom: [13, 11], butter: [11, 9] };

export function drawGarnish(g, key, opts = {}) {
  const R = rng(opts.seed || 3);
  const cs = CONTACT[key];
  if (cs) {
    // 블러 없는 접촉 그림자
    g.fillStyle = 'rgba(40,20,10,0.16)';
    g.beginPath(); g.ellipse(1.5, 2.5, cs[0] + 2, cs[1] + 2, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(40,20,10,0.16)';
    g.beginPath(); g.ellipse(1, 1.8, cs[0], cs[1], 0, 0, TAU); g.fill();
  }
  switch (key) {
    case 'tomato': {
      g.save();
      g.beginPath(); g.arc(0, 0, 11, 0, TAU);
      const sk = g.createRadialGradient(-3, -3, 1, 0, 0, 11);
      sk.addColorStop(0, '#ff6a4d'); sk.addColorStop(0.7, '#e0221a'); sk.addColorStop(1, '#a5120c');
      g.fillStyle = sk; g.fill();
      // 단면 (반으로 자른 면)
      g.beginPath(); g.arc(0, 0, 8.6, 0, TAU);
      const fl = g.createRadialGradient(0, 0, 1, 0, 0, 8.6);
      fl.addColorStop(0, '#ffb3a0'); fl.addColorStop(0.5, '#ff6b52'); fl.addColorStop(1, '#e8382a');
      g.fillStyle = fl; g.fill();
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU + 0.4;
        g.beginPath(); g.ellipse(Math.cos(a) * 4.3, Math.sin(a) * 4.3, 3.2, 2.2, a, 0, TAU);
        g.fillStyle = 'rgba(255,200,120,0.75)'; g.fill();
        for (let s = 0; s < 3; s++) {
          g.beginPath(); g.ellipse(Math.cos(a) * 4.3 + (s - 1) * 1.2 * Math.cos(a + 1.57), Math.sin(a) * 4.3 + (s - 1) * 1.2 * Math.sin(a + 1.57), 0.8, 0.5, a, 0, TAU);
          g.fillStyle = '#f7e6a0'; g.fill();
        }
      }
      g.beginPath(); g.arc(0, 0, 1.6, 0, TAU); g.fillStyle = '#ffd0c0'; g.fill();
      g.beginPath(); g.ellipse(-4, -5, 3, 1.4, -0.6, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill();
      g.restore();
      break;
    }
    case 'asparagus': {
      g.save();
      g.lineCap = 'round';
      const sg = g.createLinearGradient(0, -3, 0, 3);
      sg.addColorStop(0, '#9ccc55'); sg.addColorStop(0.5, '#6a9d2e'); sg.addColorStop(1, '#41701b');
      g.strokeStyle = sg; g.lineWidth = 6;
      g.beginPath(); g.moveTo(-30, 1); g.quadraticCurveTo(0, -1.5, 24, 0); g.stroke();
      // 그릴 자국
      for (let k = -20; k < 20; k += 9) { g.strokeStyle = 'rgba(40,25,10,0.6)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(k, -3); g.lineTo(k + 3, 3); g.stroke(); }
      // 끝 비늘
      g.fillStyle = '#5f8f28';
      g.beginPath(); g.ellipse(27, 0, 6, 4, 0, 0, TAU); g.fill();
      for (let k = 0; k < 5; k++) {
        g.beginPath(); g.ellipse(18 + k * 2.4, (k % 2 ? 1 : -1) * 2.2, 2.8, 1.4, (k % 2 ? 0.5 : -0.5), 0, TAU);
        g.fillStyle = k % 2 ? '#7aa83a' : '#4f7d1e'; g.fill();
      }
      g.strokeStyle = 'rgba(255,255,220,0.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-26, -1.5); g.quadraticCurveTo(0, -3.5, 20, -2.2); g.stroke();
      g.restore();
      break;
    }
    case 'rosemary': {
      g.save();
      g.lineCap = 'round';
      g.strokeStyle = '#5b4a2a'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-30, 4); g.quadraticCurveTo(0, -4, 30, -2); g.stroke();
      for (let k = 0; k < 26; k++) {
        const t = k / 26, x = -28 + t * 56, y = 4 - t * 6 + Math.sin(t * 3) * 1.5;
        for (const side of [-1, 1]) {
          const a = -0.4 + side * (0.9 + R() * 0.3);
          const L = 8 - t * 3 + R() * 2;
          g.strokeStyle = R() < 0.5 ? '#3f6b3a' : '#557f4b';
          g.lineWidth = 2;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
          g.strokeStyle = 'rgba(200,230,190,0.35)'; g.lineWidth = 0.6;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L * 0.9, y + Math.sin(a) * L * 0.9); g.stroke();
        }
      }
      g.restore();
      break;
    }
    case 'garlic': {
      g.save();
      g.beginPath();
      g.moveTo(-8, 4); g.quadraticCurveTo(-9, -8, 0, -11); g.quadraticCurveTo(9, -8, 8, 4); g.quadraticCurveTo(0, 9, -8, 4);
      const gg = g.createRadialGradient(-2, -3, 1, 0, 0, 11);
      gg.addColorStop(0, '#fbe3a6'); gg.addColorStop(0.6, '#e2a948'); gg.addColorStop(1, '#a5651e');
      g.fillStyle = gg; g.fill();
      g.strokeStyle = 'rgba(120,70,20,0.5)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(0, -10); g.quadraticCurveTo(-2, 0, 0, 6); g.stroke();
      g.beginPath(); g.ellipse(-3, -4, 2, 1, -0.6, 0, TAU); g.fillStyle = 'rgba(255,255,230,0.7)'; g.fill();
      g.restore();
      break;
    }
    case 'mushroom': {
      g.save();
      // 반으로 자른 양송이 단면
      g.beginPath();
      g.moveTo(-13, 0); g.quadraticCurveTo(-13, -12, 0, -12); g.quadraticCurveTo(13, -12, 13, 0);
      g.lineTo(5, 1); g.lineTo(4, 11); g.quadraticCurveTo(0, 13, -4, 11); g.lineTo(-5, 1); g.closePath();
      const mg = g.createLinearGradient(0, -12, 0, 12);
      mg.addColorStop(0, '#c08a52'); mg.addColorStop(0.3, '#e8d2b0'); mg.addColorStop(1, '#d9bf98');
      g.fillStyle = mg; g.fill();
      g.beginPath(); g.moveTo(-13, 0); g.quadraticCurveTo(-13, -12, 0, -12); g.quadraticCurveTo(13, -12, 13, 0);
      g.strokeStyle = '#8a5a2c'; g.lineWidth = 2.2; g.stroke();
      g.strokeStyle = 'rgba(140,100,60,0.4)'; g.lineWidth = 0.7;
      for (let k = -9; k <= 9; k += 3) { g.beginPath(); g.moveTo(k, -1); g.lineTo(k * 0.7, -7); g.stroke(); }
      g.restore();
      break;
    }
    case 'butter': {
      g.save();
      g.beginPath();
      g.moveTo(-10, -8); g.lineTo(9, -9); g.quadraticCurveTo(12, 0, 10, 9); g.quadraticCurveTo(0, 12, -10, 8); g.quadraticCurveTo(-12, 0, -10, -8);
      const bg = g.createLinearGradient(-10, -10, 10, 10);
      bg.addColorStop(0, '#fff3b8'); bg.addColorStop(1, '#f2cf6b');
      g.fillStyle = bg; g.fill();
      for (let k = 0; k < 14; k++) {
        g.fillStyle = R() < 0.5 ? '#3f7a32' : '#6aa04a';
        g.beginPath(); g.ellipse(-7 + R() * 14, -6 + R() * 12, 1.4, 0.6, R() * 3, 0, TAU); g.fill();
      }
      g.beginPath(); g.ellipse(-4, -5, 4, 1.4, -0.2, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.65)'; g.fill();
      g.restore();
      break;
    }
    case 'micro': {
      g.save();
      for (let k = 0; k < 9; k++) {
        const a = R() * TAU, d = R() * 7;
        const x = Math.cos(a) * d, y = Math.sin(a) * d;
        g.strokeStyle = '#d7e8b8'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x, y); g.stroke();
        for (const s of [-1, 1]) {
          g.beginPath(); g.ellipse(x + s * 2.6, y - 0.5, 3, 1.7, s * 0.4, 0, TAU);
          g.fillStyle = R() < 0.3 ? '#8c2f5a' : R() < 0.6 ? '#6fb34a' : '#9bd16a'; g.fill();
        }
      }
      g.restore();
      break;
    }
    case 'flake': {
      g.save();
      for (let k = 0; k < 16; k++) {
        const x = (R() - 0.5) * 16, y = (R() - 0.5) * 16, s = 1 + R() * 2.2;
        g.save(); g.translate(x, y); g.rotate(R() * 3);
        g.beginPath(); g.moveTo(-s, -s * 0.4); g.lineTo(s * 0.6, -s); g.lineTo(s, s * 0.5); g.lineTo(-s * 0.4, s); g.closePath();
        g.fillStyle = 'rgba(255,255,255,0.95)'; g.fill();
        g.strokeStyle = 'rgba(180,190,210,0.6)'; g.lineWidth = 0.4; g.stroke();
        g.restore();
      }
      g.restore();
      break;
    }
    case 'slaw': {
      drawSlaw(g, opts.amount ?? 1, opts.seed || 5);
      break;
    }
    case 'baguette': drawBaguette(g); break;
    case 'lemon': drawLemonWedge(g); break;
    case 'parsley': drawParsleyPinch(g, opts.seed || 2); break;
  }
}

/** 채 썬 양배추 더미: amount 0~1 (얼마나 잘게 썰었는지) */
export function drawSlaw(g, fineness = 1, seed = 5) {
  const R = rng(seed);
  g.save();
  g.beginPath(); g.ellipse(0, 2, 30, 20, 0, 0, TAU); g.fillStyle = 'rgba(205,225,160,0.6)'; g.fill();
  g.lineCap = 'round';
  const n = 70;
  const w = lerp(5, 1.6, clamp(fineness, 0, 1));
  for (let k = 0; k < n; k++) {
    const a = R() * TAU, d = Math.sqrt(R()) * 22;
    const x = Math.cos(a) * d * 1.25, y = Math.sin(a) * d * 0.85;
    const ang = R() * TAU, L = 10 + R() * 14;
    const col = R();
    g.strokeStyle = col < 0.25 ? '#a9cf6c' : col < 0.6 ? '#dcecb4' : col < 0.85 ? '#f2f7de' : '#c4de8a';
    g.lineWidth = w * (0.7 + R() * 0.6);
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(ang + 0.6) * L * 0.6, y + Math.sin(ang + 0.6) * L * 0.6, x + Math.cos(ang) * L, y + Math.sin(ang) * L);
    g.stroke();
  }
  // 보라색 양배추 약간 + 당근채로 색감
  for (let k = 0; k < 12; k++) {
    const a = R() * TAU, d = Math.sqrt(R()) * 18;
    const x = Math.cos(a) * d * 1.25, y = Math.sin(a) * d * 0.85, ang = R() * TAU, L = 8 + R() * 8;
    g.strokeStyle = k < 6 ? '#8d3a78' : '#f08a2c'; g.lineWidth = w * 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L); g.stroke();
  }
  g.restore();
}

/** 소스 붓 자국 */
export function drawSauce(g, stroke) {
  if (stroke.length < 2) return;
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  const n = stroke.length;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const w = Math.sin(Math.min(1, t * 1.15) * Math.PI) * 13 + 1.5;
      g.beginPath(); g.moveTo(stroke[i - 1][0], stroke[i - 1][1]); g.lineTo(stroke[i][0], stroke[i][1]);
      if (pass === 0) { g.strokeStyle = 'rgba(40,12,4,0.25)'; g.lineWidth = w + 3; }
      else if (pass === 1) { g.strokeStyle = '#4a1a0b'; g.lineWidth = w; }
      else { g.strokeStyle = 'rgba(255,200,160,0.45)'; g.lineWidth = Math.max(0.8, w * 0.16); g.save(); g.translate(-w * 0.15, -w * 0.18); g.stroke(); g.restore(); continue; }
      g.stroke();
    }
  }
  g.restore();
}

/** 손님 캐릭터 (mood: neutral/happy/love/meh/bad/angry, chew: 0~1) */
export function drawCustomer(g, cust, x, y, s, mood = 'neutral', chew = 0, time = 0) {
  g.save();
  g.translate(x, y); g.scale(s, s);
  // 몸
  g.beginPath(); g.moveTo(-70, 120); g.quadraticCurveTo(-66, 40, 0, 36); g.quadraticCurveTo(66, 40, 70, 120); g.closePath();
  g.fillStyle = cust.shirt; g.fill();
  g.beginPath(); g.moveTo(-14, 38); g.lineTo(0, 58); g.lineTo(14, 38); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
  // 목
  g.fillStyle = shade(cust.skin, -0.12); g.fillRect(-12, 20, 24, 22);
  // 얼굴
  const bob = Math.sin(time * 2) * 1.5;
  g.translate(0, bob);
  g.beginPath(); g.ellipse(0, -10, 40, 44, 0, 0, TAU); g.fillStyle = cust.skin; g.fill();
  // 귀
  g.beginPath(); g.ellipse(-40, -6, 7, 10, 0, 0, TAU); g.ellipse(40, -6, 7, 10, 0, 0, TAU); g.fill();
  // 머리카락
  g.beginPath(); g.ellipse(0, -36, 42, 24, 0, Math.PI, TAU); g.quadraticCurveTo(44, -10, 36, -18); g.quadraticCurveTo(10, -40, -36, -18); g.quadraticCurveTo(-44, -10, -42, -36);
  g.fillStyle = cust.hair; g.fill();
  // 볼터치
  const blush = mood === 'love' || mood === 'happy' ? 0.45 : mood === 'angry' ? 0.6 : 0.18;
  g.fillStyle = mood === 'angry' ? `rgba(230,40,30,${blush})` : `rgba(255,110,110,${blush})`;
  g.beginPath(); g.ellipse(-24, 6, 8, 5, 0, 0, TAU); g.ellipse(24, 6, 8, 5, 0, 0, TAU); g.fill();
  // 눈
  g.strokeStyle = '#2a1a12'; g.fillStyle = '#2a1a12'; g.lineWidth = 3.2; g.lineCap = 'round';
  if (mood === 'love') {
    for (const ex of [-15, 15]) heart(g, ex, -10, 7, '#ff3b5c');
  } else if (mood === 'happy') {
    for (const ex of [-15, 15]) { g.beginPath(); g.arc(ex, -8, 6, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  } else if (mood === 'bad' || mood === 'angry') {
    for (const ex of [-15, 15]) { g.beginPath(); g.arc(ex, -8, 3.5, 0, TAU); g.fill(); }
    g.beginPath(); g.moveTo(-24, -22); g.lineTo(-8, mood === 'angry' ? -16 : -19); g.moveTo(24, -22); g.lineTo(8, mood === 'angry' ? -16 : -19); g.stroke();
  } else {
    for (const ex of [-15, 15]) { g.beginPath(); g.ellipse(ex, -9, 3.6, 4.4, 0, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + 1.2, -10.5, 1.2, 0, TAU); g.fill(); g.fillStyle = '#2a1a12'; }
    if (mood === 'meh') { g.beginPath(); g.moveTo(-22, -20); g.lineTo(-8, -20); g.moveTo(8, -20); g.lineTo(22, -20); g.stroke(); }
  }
  // 입
  const mo = chew > 0 ? Math.abs(Math.sin(chew * 14)) : 0;
  g.lineWidth = 3;
  if (chew > 0) {
    g.beginPath(); g.ellipse(0, 18, 7, 2 + mo * 5, 0, 0, TAU); g.fillStyle = '#7a2a20'; g.fill();
  } else if (mood === 'love' || mood === 'happy') {
    g.beginPath(); g.moveTo(-12, 14); g.quadraticCurveTo(0, 30, 12, 14); g.closePath(); g.fillStyle = '#8a2a22'; g.fill();
    g.beginPath(); g.ellipse(0, 22, 5, 2.5, 0, 0, TAU); g.fillStyle = '#ff8a80'; g.fill();
  } else if (mood === 'bad' || mood === 'angry') {
    g.beginPath(); g.moveTo(-11, 24); g.quadraticCurveTo(0, 13, 11, 24); g.stroke();
  } else if (mood === 'meh') {
    g.beginPath(); g.moveTo(-9, 19); g.lineTo(9, 17); g.stroke();
  } else {
    g.beginPath(); g.moveTo(-8, 17); g.quadraticCurveTo(0, 22, 8, 17); g.stroke();
  }
  if (cust.id === 'critic') {
    // 외알 안경 + 콧수염
    g.strokeStyle = '#c9a54a'; g.lineWidth = 2;
    g.beginPath(); g.arc(15, -9, 10, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(25, -6); g.quadraticCurveTo(32, 14, 26, 34); g.stroke();
    g.fillStyle = cust.hair;
    g.beginPath(); g.moveTo(0, 8); g.quadraticCurveTo(-12, 4, -20, 12); g.quadraticCurveTo(-10, 9, 0, 11); g.quadraticCurveTo(10, 9, 20, 12); g.quadraticCurveTo(12, 4, 0, 8); g.fill();
  }
  if (mood === 'angry') {
    // 김 나는 표시
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2.5;
    for (const sx of [-30, 30]) { g.beginPath(); g.moveTo(sx, -56); g.quadraticCurveTo(sx + 6, -64, sx, -72); g.stroke(); }
  }
  g.restore();
}

function heart(g, x, y, s, col) {
  g.save(); g.translate(x, y); g.fillStyle = col;
  g.beginPath(); g.moveTo(0, s * 0.9); g.bezierCurveTo(-s * 1.4, -s * 0.1, -s * 0.6, -s * 1.1, 0, -s * 0.35); g.bezierCurveTo(s * 0.6, -s * 1.1, s * 1.4, -s * 0.1, 0, s * 0.9); g.fill();
  g.restore();
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => clamp(Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt)), 0, 255);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** 수증기 파티클 */
export function drawSteam(g, parts) {
  for (const p of parts) {
    const a = clamp(p.life, 0, 1) * p.alpha;
    const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
  }
}
