// 새 메뉴용 절차적 그래픽: 새우, 랍스터, 파스타, 감바스, 추가 가니쉬
import { TAU, rng, clamp, lerp } from './geom.js';

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// ---------------- 새우 ----------------
/** 새우 몸통 중심선 (C자 곡선, 길이 ~70mm). 머리 쪽이 t=0 */
export function shrimpSpine(n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = -0.3 + t * 3.4;
    const r = 26 - t * 6;
    pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.85]);
  }
  return pts;
}
/** 새우 등 쪽 내장 선 (손질 대상) */
export function shrimpVein(n = 24) {
  const pts = [];
  for (let i = 2; i <= n - 3; i++) {
    const t = i / n;
    const a = -0.3 + t * 3.4;
    const r = 26 - t * 6 + 5.5 - t * 2.5;
    pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.85]);
  }
  return pts;
}

/** cook: 0(회색 생새우) ~ 1(주황빛 완숙) ~ 1.6(질김/갈변) */
export function drawShrimp(g, { cook = 0, vein = null, veinCut = null, tail = true, gloss = 0.6 } = {}) {
  const sp = shrimpSpine();
  const raw = [168, 176, 182], done = [244, 132, 86], over = [214, 110, 64];
  const body = cook <= 1 ? mix(raw, done, clamp(cook, 0, 1)) : mix(done, over, clamp(cook - 1, 0, 1));
  const n = sp.length;
  // 꼬리
  if (tail) {
    const [x, y] = sp[n - 1];
    g.save(); g.translate(x, y); g.rotate(2.9);
    g.fillStyle = rgb(cook > 0.5 ? [232, 80, 50] : [120, 120, 130], 0.95);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-12, -9); g.quadraticCurveTo(-10, 0, -12, 9); g.closePath(); g.fill();
    g.restore();
  }
  // 몸통 마디
  for (let i = n - 1; i >= 0; i--) {
    const t = i / (n - 1);
    const [x, y] = sp[i];
    const w = 9.5 - t * 6;
    const grd = g.createRadialGradient(x - w * 0.3, y - w * 0.3, 0, x, y, w);
    grd.addColorStop(0, rgb(mix(body, [255, 240, 230], 0.45)));
    grd.addColorStop(0.7, rgb(body));
    grd.addColorStop(1, rgb(mix(body, [90, 40, 30], 0.35)));
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, w, 0, TAU); g.fill();
    if (i % 3 === 0) { g.strokeStyle = rgb(mix(body, [255, 255, 255], 0.5), 0.6); g.lineWidth = 0.8; g.beginPath(); g.arc(x, y, w * 0.95, -1.2, 1.2); g.stroke(); }
  }
  // 다리 (안쪽 곡선)
  g.strokeStyle = rgb(mix(body, [255, 220, 200], 0.2), 0.8); g.lineWidth = 0.9;
  for (let i = 2; i < n - 6; i += 2) {
    const [x, y] = sp[i], [x2, y2] = sp[i + 1];
    const nx = -(y2 - y), ny = x2 - x, L = Math.hypot(nx, ny) || 1;
    const w = 9.5 - (i / (n - 1)) * 6;
    g.beginPath(); g.moveTo(x - (nx / L) * w * 0.8, y - (ny / L) * w * 0.8); g.lineTo(x - (nx / L) * (w + 4), y - (ny / L) * (w + 4)); g.stroke();
  }
  // 마디 줄
  g.strokeStyle = rgb(mix(body, [60, 40, 40], 0.3), 0.5); g.lineWidth = 0.7;
  for (let i = 3; i < n - 2; i += 3) {
    const [x, y] = sp[i], [x2, y2] = sp[i + 1];
    const nx = -(y2 - y), ny = x2 - x, L = Math.hypot(nx, ny) || 1, w = 9.5 - (i / (n - 1)) * 6;
    g.beginPath(); g.moveTo(x + (nx / L) * w, y + (ny / L) * w); g.lineTo(x - (nx / L) * w, y - (ny / L) * w); g.stroke();
  }
  // 줄무늬 (익으면 흰 줄)
  if (cook > 0.4) {
    g.strokeStyle = `rgba(255,245,235,${0.5 * clamp(cook, 0, 1)})`; g.lineWidth = 1.2;
    for (let i = 3; i < n - 3; i += 3) { const [x, y] = sp[i]; g.beginPath(); g.arc(x, y, 8 - i * 0.2, 2.2, 4.0); g.stroke(); }
  }
  // 내장
  if (vein) {
    g.lineCap = 'round';
    let run = [];
    const flush = () => {
      if (run.length > 1) {
        g.beginPath(); run.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.strokeStyle = 'rgba(40,30,25,0.85)'; g.lineWidth = 2.2; g.stroke();
      }
      run = [];
    };
    vein.forEach((p, i) => { if (veinCut && veinCut[i]) flush(); else run.push(p); });
    flush();
    // 칼집 (손질된 부분)
    if (veinCut) {
      g.strokeStyle = 'rgba(255,230,220,0.8)'; g.lineWidth = 1;
      vein.forEach((p, i) => { if (veinCut[i] && i > 0 && veinCut[i - 1]) { g.beginPath(); g.moveTo(vein[i - 1][0], vein[i - 1][1]); g.lineTo(p[0], p[1]); g.stroke(); } });
    }
  }
  // 윤기
  g.fillStyle = `rgba(255,255,255,${0.35 * gloss})`;
  for (let i = 2; i < n - 4; i += 4) { const [x, y] = sp[i]; g.beginPath(); g.ellipse(x - 3, y - 4, 2.5, 1.2, -0.5, 0, TAU); g.fill(); }
}

// ---------------- 랍스터 꼬리 ----------------
/** 랍스터 꼬리 중심선(가르는 선): 위→아래 */
export function lobsterLine() { return Array.from({ length: 30 }, (_, i) => [0, -70 + i * 4.6]); }

/** split: 0~1 갈라진 정도, cook: 0~1.6, glaze: 버터 윤기, cheese: 테르미도르 치즈 갈변(null이면 없음) */
export function drawLobster(g, { cook = 0, split = 0, cut = null, glaze = 0, cheese = null, sauce = false } = {}) {
  const shellRaw = [52, 70, 82], shellDone = [214, 58, 34];
  const shell = mix(shellRaw, shellDone, clamp(cook * 1.4, 0, 1));
  const meatRaw = [236, 226, 222], meatDone = [252, 244, 236];
  const gap = split * 9;
  for (const side of [-1, 1]) {
    g.save();
    g.translate(side * gap, 0);
    // 껍질 마디 6개
    for (let i = 0; i < 6; i++) {
      const y = -66 + i * 21, w = 30 - i * 2.2;
      const grd = g.createLinearGradient(0, y, side * w, y + 18);
      grd.addColorStop(0, rgb(mix(shell, [255, 200, 170], 0.25)));
      grd.addColorStop(1, rgb(mix(shell, [20, 10, 5], 0.35)));
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(0, y); g.quadraticCurveTo(side * (w + 4), y + 2, side * w, y + 20); g.lineTo(0, y + 22); g.closePath(); g.fill();
      g.strokeStyle = rgb(mix(shell, [0, 0, 0], 0.5), 0.6); g.lineWidth = 0.8; g.stroke();
    }
    // 꼬리 지느러미
    g.fillStyle = rgb(mix(shell, [255, 220, 200], 0.15));
    g.beginPath(); g.moveTo(0, 60); g.lineTo(side * 26, 82); g.quadraticCurveTo(side * 14, 92, 0, 88); g.closePath(); g.fill();
    // 속살 (갈라졌을 때 보임)
    if (split > 0.05) {
      g.save();
      g.globalAlpha = clamp(split * 1.5, 0, 1);
      const m = mix(meatRaw, meatDone, clamp(cook, 0, 1));
      const mg = g.createLinearGradient(0, -60, side * 18, 60);
      mg.addColorStop(0, rgb(m)); mg.addColorStop(1, rgb(mix(m, [250, 170, 140], 0.35 + cook * 0.2)));
      g.fillStyle = mg;
      g.beginPath(); g.moveTo(0, -62); g.quadraticCurveTo(side * 22, -40, side * 18, 20); g.quadraticCurveTo(side * 12, 56, 0, 58); g.closePath(); g.fill();
      // 붉은 결
      g.strokeStyle = `rgba(240,110,80,${0.25 + cook * 0.35})`; g.lineWidth = 1.2;
      for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(side * 3, -50 + k * 22); g.quadraticCurveTo(side * 14, -42 + k * 22, side * 16, -30 + k * 22); g.stroke(); }
      g.restore();
    }
    g.restore();
  }
  if (cut) {
    // 손질선 (칼이 지나간 곳 표시)
    const ln = lobsterLine();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.2; g.setLineDash([3, 3]);
    g.beginPath(); ln.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(30,10,5,0.9)'; g.lineWidth = 2.2;
    ln.forEach((p, i) => { if (cut[i] && i > 0 && cut[i - 1]) { g.beginPath(); g.moveTo(ln[i - 1][0], ln[i - 1][1]); g.lineTo(p[0], p[1]); g.stroke(); } });
  }
  if (sauce) {
    // 테르미도르: 크림소스에 버무린 살
    g.fillStyle = 'rgba(248,232,200,0.95)';
    g.beginPath(); g.ellipse(0, -2, 26, 58, 0, 0, TAU); g.fill();
    const R = rng(11);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(250,${150 + R() * 40},${120 + R() * 30},0.8)`; g.beginPath(); g.ellipse((R() - 0.5) * 36, (R() - 0.5) * 100, 4 + R() * 4, 3, R() * 3, 0, TAU); g.fill(); }
  }
  if (cheese != null) {
    const R = rng(12);
    const cc = mix([250, 236, 180], [196, 120, 40], clamp(cheese, 0, 1));
    const burnt = clamp(cheese - 1.2, 0, 1);
    for (let i = 0; i < 70; i++) {
      const x = (R() - 0.5) * 44, y = (R() - 0.5) * 110;
      if ((x * x) / 600 + (y * y) / 3300 > 1) continue;
      g.fillStyle = rgb(mix(cc, [40, 20, 10], burnt * R()), 0.85);
      g.beginPath(); g.arc(x, y, 3 + R() * 5, 0, TAU); g.fill();
    }
  }
  if (glaze > 0) {
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = `rgba(255,220,140,${0.18 * glaze})`;
    g.beginPath(); g.ellipse(-6, -20, 10, 40, 0.1, 0, TAU); g.fill();
    g.restore();
  }
}

// ---------------- 파스타 ----------------
/**
 * 접시 위 파스타 둥지. sauce: 'aglio'|'carbonara'|'tomato', twirl: 0~1 정돈도
 * toppings: { garlic: 갈변도, chili, parsley, shrimp: 개수, shrimpCook, tomato: 개수, guanciale: 갈변도, pepper }
 */
export function drawPastaNest(g, { sauce = 'aglio', twirl = 1, doneness = 1, emulsion = 1, toppings = {}, seed = 7 } = {}) {
  const R = rng(seed);
  const base = sauce === 'carbonara' ? [244, 206, 100] : sauce === 'tomato' ? [232, 132, 76] : [240, 206, 128];
  const r0 = 46;
  // 소스 웅덩이
  if (sauce === 'tomato') { g.fillStyle = 'rgba(200,60,30,0.35)'; g.beginPath(); g.ellipse(2, 4, r0 + 8, r0 * 0.9 + 6, 0, 0, TAU); g.fill(); }
  else if (emulsion < 0.5) { g.fillStyle = 'rgba(220,190,80,0.25)'; g.beginPath(); g.ellipse(3, 5, r0 + 10, r0 * 0.9 + 8, 0, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(3, 6, r0, r0 * 0.88, 0, 0, TAU); g.fill();
  // 면: 소용돌이 (twirl 낮으면 흐트러짐)
  g.lineCap = 'round';
  const strands = 110;
  for (let i = 0; i < strands; i++) {
    const rr = (1 - Math.pow(R(), 1.3)) * r0;
    const a0 = R() * TAU;
    const len = 1.2 + R() * 2.2;
    const mess = (1 - twirl) * 14;
    const col = mix(base, i % 3 ? [255, 246, 214] : [210, 160, 80], 0.25 + R() * 0.25);
    g.strokeStyle = rgb(col);
    g.lineWidth = 2.1;
    g.beginPath();
    for (let k = 0; k <= 12; k++) {
      const a = a0 + (k / 12) * len;
      const r = rr * (1 - (k / 12) * 0.1) + Math.sin(k + i) * mess * 0.3;
      const x = Math.cos(a) * r + (R() - 0.5) * mess, y = Math.sin(a) * r * 0.88 + (R() - 0.5) * mess;
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    if (i % 4 === 0) { g.strokeStyle = 'rgba(255,255,240,0.5)'; g.lineWidth = 0.6; g.stroke(); }
  }
  // 토핑
  const sprinkle = (n, fn) => { for (let i = 0; i < n; i++) { const a = R() * TAU, d = Math.sqrt(R()) * r0 * 0.85; fn(Math.cos(a) * d, Math.sin(a) * d * 0.88, i); } };
  if (toppings.guanciale != null) sprinkle(14, (x, y) => drawGuancialeBit(g, x, y, toppings.guanciale, R()));
  if (toppings.shrimp) sprinkle(toppings.shrimp, (x, y, i) => { g.save(); g.translate(x * 0.8, y * 0.8); g.rotate(R() * TAU); g.scale(0.42, 0.42); drawShrimp(g, { cook: toppings.shrimpCook ?? 1 }); g.restore(); });
  if (toppings.tomato) sprinkle(toppings.tomato, (x, y) => { g.save(); g.translate(x, y); g.scale(0.7, 0.7); drawTomatoHalfSmall(g); g.restore(); });
  if (toppings.garlic != null) sprinkle(16, (x, y) => drawGarlicSlice(g, x, y, toppings.garlic, R() * 3, 2.6));
  if (toppings.chili) sprinkle(18, (x, y) => { g.fillStyle = '#c0261a'; g.fillRect(x, y, 1.6, 1.1); });
  if (toppings.cheese) sprinkle(40, (x, y) => { g.fillStyle = 'rgba(255,250,230,0.9)'; g.fillRect(x, y, 1.4, 1.4); });
  if (toppings.pepper) sprinkle(Math.round(30 * toppings.pepper), (x, y) => { g.fillStyle = '#1b1410'; g.beginPath(); g.arc(x, y, 0.8, 0, TAU); g.fill(); });
  if (toppings.parsley) sprinkle(26, (x, y) => drawParsleyBit(g, x, y, R()));
  // 윤기
  g.save(); g.globalCompositeOperation = 'lighter';
  const gl = g.createRadialGradient(-14, -16, 2, -10, -10, r0);
  gl.addColorStop(0, `rgba(255,250,220,${0.25 * clamp(emulsion, 0.3, 1)})`); gl.addColorStop(1, 'rgba(255,250,220,0)');
  g.fillStyle = gl; g.beginPath(); g.ellipse(0, 0, r0, r0 * 0.88, 0, 0, TAU); g.fill();
  g.restore();
}

export function drawGarlicSlice(g, x, y, brown = 0, rot = 0, size = 4) {
  const c = brown <= 1 ? mix([250, 246, 228], [222, 170, 80], clamp(brown, 0, 1)) : mix([222, 170, 80], [70, 40, 20], clamp(brown - 1, 0, 1));
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = rgb(c);
  g.beginPath(); g.ellipse(0, 0, size, size * 0.7, 0, 0, TAU); g.fill();
  g.strokeStyle = rgb(mix(c, [120, 80, 40], 0.4), 0.7); g.lineWidth = 0.5; g.stroke();
  g.fillStyle = rgb(mix(c, [255, 255, 255], 0.3), 0.6);
  g.beginPath(); g.ellipse(-size * 0.2, -size * 0.1, size * 0.35, size * 0.2, 0, 0, TAU); g.fill();
  g.restore();
}

export function drawParsleyBit(g, x, y, r = 0.5) {
  g.fillStyle = r < 0.5 ? '#2f7a2a' : '#4c9a3a';
  g.beginPath(); g.ellipse(x, y, 1.6, 1.0, r * 6, 0, TAU); g.fill();
}

export function drawGuancialeBit(g, x, y, brown = 0.8, r = 0.5) {
  const lean = mix([214, 110, 110], [168, 70, 40], clamp(brown, 0, 1));
  const fat = mix([248, 232, 220], [236, 180, 100], clamp(brown, 0, 1));
  g.save(); g.translate(x, y); g.rotate(r * 6);
  g.fillStyle = rgb(fat); g.fillRect(-3.5, -1.8, 7, 3.6);
  g.fillStyle = rgb(lean); g.fillRect(-3.5, -1.8, 7, 1.6);
  g.restore();
}

function drawTomatoHalfSmall(g) {
  g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fillStyle = '#d8281c'; g.fill();
  g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fillStyle = '#ff7055'; g.fill();
  g.fillStyle = 'rgba(255,220,140,0.8)';
  for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; g.beginPath(); g.ellipse(Math.cos(a) * 3.5, Math.sin(a) * 3.5, 2.3, 1.5, a, 0, TAU); g.fill(); }
}

// ---------------- 감바스 (카수엘라 토기) ----------------
export function drawCazuela(g, { garlic = 0.8, shrimpCook = 1, shrimp = 6, oil = 1, parsley = true, chili = true, seed = 3 } = {}) {
  const R = rng(seed);
  // 토기
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(4, 8, 78, 74, 0, 0, TAU); g.fill();
  const out = g.createRadialGradient(-20, -20, 10, 0, 0, 80);
  out.addColorStop(0, '#c8703c'); out.addColorStop(1, '#7a3a1a');
  g.fillStyle = out; g.beginPath(); g.arc(0, 0, 76, 0, TAU); g.fill();
  // 오일
  const oc = g.createRadialGradient(-10, -10, 5, 0, 0, 64);
  oc.addColorStop(0, `rgba(255,${200 - garlic * 30},90,${0.75 * oil + 0.2})`); oc.addColorStop(1, `rgba(200,${110 - garlic * 20},30,${0.9 * oil + 0.1})`);
  g.fillStyle = oc; g.beginPath(); g.arc(0, 0, 64, 0, TAU); g.fill();
  for (let i = 0; i < shrimp; i++) {
    const a = (i / shrimp) * TAU + R() * 0.3, d = 34;
    g.save(); g.translate(Math.cos(a) * d, Math.sin(a) * d); g.rotate(a + 1.8); g.scale(0.5, 0.5); drawShrimp(g, { cook: shrimpCook, gloss: 1 }); g.restore();
  }
  for (let i = 0; i < 22; i++) { const a = R() * TAU, d = Math.sqrt(R()) * 56; drawGarlicSlice(g, Math.cos(a) * d, Math.sin(a) * d, garlic, R() * 3, 3.2); }
  if (chili) for (let i = 0; i < 6; i++) { const a = R() * TAU, d = R() * 50; g.save(); g.translate(Math.cos(a) * d, Math.sin(a) * d); g.rotate(R() * 3); g.fillStyle = '#b81e10'; g.beginPath(); g.ellipse(0, 0, 6, 1.8, 0, 0, TAU); g.fill(); g.restore(); }
  if (parsley) for (let i = 0; i < 40; i++) { const a = R() * TAU, d = Math.sqrt(R()) * 58; drawParsleyBit(g, Math.cos(a) * d, Math.sin(a) * d, R()); }
  // 기름 반짝임 + 지글지글 기포
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 30; i++) { const a = R() * TAU, d = R() * 60; g.fillStyle = 'rgba(255,240,180,0.35)'; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 0.8 + R() * 1.6, 0, TAU); g.fill(); }
  g.restore();
  g.strokeStyle = 'rgba(255,190,140,0.35)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 74, -2.6, -1.2); g.stroke();
}

// ---------------- 추가 가니쉬 ----------------
export function drawBaguette(g) {
  g.fillStyle = 'rgba(40,20,10,0.15)'; g.beginPath(); g.ellipse(1.5, 2.5, 19, 11, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(0, 0, 18, 10, 0, 0, TAU); g.fillStyle = '#b8742e'; g.fill();
  g.beginPath(); g.ellipse(0, 0, 15.5, 8, 0, 0, TAU);
  const c = g.createRadialGradient(-3, -2, 1, 0, 0, 16); c.addColorStop(0, '#fbecc8'); c.addColorStop(1, '#e8c78a');
  g.fillStyle = c; g.fill();
  const R = rng(4);
  for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(190,150,90,0.6)'; g.beginPath(); g.ellipse((R() - 0.5) * 24, (R() - 0.5) * 11, 0.8 + R() * 1.4, 0.6 + R(), 0, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(255,220,160,0.6)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(0, 0, 17, 9.2, 0, -2.6, -1.2); g.stroke();
}

export function drawLemonWedge(g) {
  g.fillStyle = 'rgba(40,30,0,0.15)'; g.beginPath(); g.ellipse(1.5, 2.5, 16, 9, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(-16, 0); g.quadraticCurveTo(0, -18, 16, 0); g.closePath();
  g.fillStyle = '#f2c81c'; g.fill();
  g.beginPath(); g.moveTo(-13.5, -0.5); g.quadraticCurveTo(0, -14.5, 13.5, -0.5); g.closePath();
  g.fillStyle = '#fff3a0'; g.fill();
  g.strokeStyle = 'rgba(255,255,230,0.9)'; g.lineWidth = 0.8;
  for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(0, -1); g.lineTo(-13 + k * 5.2, -10 + Math.abs(k - 2.5) * 3); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(-4, -7, 3, 1.2, -0.3, 0, TAU); g.fill();
}

export function drawParsleyPinch(g, seed = 2) {
  const R = rng(seed);
  for (let i = 0; i < 30; i++) drawParsleyBit(g, (R() - 0.5) * 18, (R() - 0.5) * 14, R());
}
