// 새 메뉴용 절차적 그래픽: 새우, 랍스터, 파스타, 감바스, 추가 가니쉬
import { TAU, rng, clamp, lerp } from './geom.js';
import { PHOTOS, drawPhoto, texFill } from './photos.js';

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// ---------------- 새우 ----------------
// 손질 화면의 생새우 통마리 사진 (폭 SW, 원점 중심) 위 등 내장선·몸통 중심선 (사진 폭 기준 0~1 좌표)
const SW = 74, SH = SW * 0.7533;
const PHOTO_VEIN = [[0.336, 0.092], [0.454, 0.068], [0.585, 0.058], [0.69, 0.056], [0.779, 0.072], [0.849, 0.11], [0.902, 0.165], [0.936, 0.233], [0.949, 0.304], [0.945, 0.377], [0.928, 0.448], [0.907, 0.49]];
const PHOTO_SPINE = [[0.1, 0.24], [0.3, 0.2], [0.5, 0.17], [0.7, 0.18], [0.82, 0.26], [0.875, 0.4], [0.88, 0.56], [0.87, 0.74], [0.86, 0.9]];
const photoPts = (pts, n) => {
  const P = pts.map(([u, v]) => [u * SW - SW / 2, v * SW - SH / 2]);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = (i / n) * (P.length - 1), k = Math.min(P.length - 2, Math.floor(f)), t = f - k;
    out.push([lerp(P[k][0], P[k + 1][0], t), lerp(P[k][1], P[k + 1][1], t)]);
  }
  return out;
};

/** 새우 몸통 중심선. 머리 쪽이 t=0 (사진이 없으면 C자 절차적 곡선, 길이 ~70mm) */
export function shrimpSpine(n = 24) {
  if (PHOTOS.shrimpWhole) return photoPts(PHOTO_SPINE, n);
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
  if (PHOTOS.shrimpWhole) return photoPts(PHOTO_VEIN, n - 5);
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
  if (vein && PHOTOS.shrimpWhole) {
    // 손질 화면: 머리·껍질째인 실제 생새우 사진 위에 등 내장선
    g.fillStyle = 'rgba(30,15,5,0.16)'; g.beginPath(); g.ellipse(10, 2, SW * 0.3, SH * 0.3, 0.4, 0, TAU); g.fill();
    drawPhoto(g, 'shrimpWhole', SW);
    drawVein(g, vein, veinCut);
    return;
  }
  if (PHOTOS.shrimpCooked) {
    // 실사 새우: 생(회청색) → 익음(주홍) 교차, 너무 익으면 마른 갈색. 사진은 ∩ 모양이라 뒤집어 U자 등선에 맞춤
    const c = clamp(cook, 0, 1);
    if (c < 1) drawPhoto(g, 'shrimpRawSprite', 66);
    if (c > 0) drawPhoto(g, 'shrimpCooked', 66, { alpha: c });
    if (cook > 1.15) { g.save(); g.globalCompositeOperation = 'multiply'; drawPhoto(g, 'shrimpCooked', 66, { alpha: clamp((cook - 1.15) * 1.2, 0, 0.8) }); g.restore(); }
    if (!vein) return;
    drawVein(g, vein, veinCut);
    return;
  }
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
  // 실사 질감: 생새우는 반투명 회색 결, 익으면 붉은 줄무늬가 도는 살
  if (PHOTOS.shrimpFlesh) {
    const bodyPath = new Path2D();
    for (let i = 0; i < n; i++) { const [x, y] = sp[i], w = 9.5 - (i / (n - 1)) * 6; bodyPath.moveTo(x + w, y); bodyPath.arc(x, y, w, 0, TAU); }
    g.save(); g.clip(bodyPath);
    const c = clamp(cook, 0, 1);
    texFill(g, 'shrimpRaw', -36, -32, 72, 62, { mode: 'overlay', alpha: (1 - c) * 0.9 });
    texFill(g, 'shrimpFlesh', -36, -32, 72, 62, { mode: 'overlay', alpha: c * 0.95 });
    g.restore();
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
  if (vein) drawVein(g, vein, veinCut);
  // 윤기
  g.fillStyle = `rgba(255,255,255,${0.35 * gloss})`;
  for (let i = 2; i < n - 4; i += 4) { const [x, y] = sp[i]; g.beginPath(); g.ellipse(x - 3, y - 4, 2.5, 1.2, -0.5, 0, TAU); g.fill(); }
}

/** 새우 등 내장선과 칼집 */
function drawVein(g, vein, veinCut) {
  g.lineCap = 'round';
  let run = [];
  const flush = () => {
    if (run.length > 1) {
      g.beginPath(); run.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      // 반투명 껍질 아래 비치는 내장: 밝은 테두리 + 짙은 선
      g.strokeStyle = 'rgba(255,225,200,0.4)'; g.lineWidth = 4; g.stroke();
      g.strokeStyle = 'rgba(30,20,15,0.9)'; g.lineWidth = 2.2; g.stroke();
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

// ---------------- 랍스터 꼬리 ----------------
/** 랍스터 꼬리 중심선(가르는 선): 위→아래 */
export function lobsterLine() { return Array.from({ length: 30 }, (_, i) => [0, -70 + i * 4.6]); }

/** split: 0~1 갈라진 정도, cook: 0~1.6, glaze: 버터 윤기, cheese: 테르미도르 치즈 갈변(null이면 없음) */
export function drawLobster(g, { cook = 0, split = 0, cut = null, glaze = 0, cheese = null, sauce = false } = {}) {
  const shellRaw = [104, 86, 44], shellDone = [206, 84, 40];
  const shell = mix(shellRaw, shellDone, clamp(cook * 1.4, 0, 1));
  const meatRaw = [236, 226, 222], meatDone = [252, 244, 236];
  const gap = split * 9;
  for (const side of [-1, 1]) {
    g.save();
    g.translate(side * gap, 0);
    // 반쪽만 그리도록 클립 (갈라지지 않았으면 두 반쪽이 맞붙어 하나로 보임)
    g.beginPath(); g.rect(side < 0 ? -60 : 0, -90, 60, 200); g.clip();
    // 꼬리 지느러미 (부채 5갈래)
    for (let k = -2; k <= 2; k++) {
      g.save(); g.translate(0, 62); g.rotate(k * 0.42);
      const fg = g.createLinearGradient(0, 0, 0, 30);
      fg.addColorStop(0, rgb(mix(shell, [255, 210, 190], 0.1))); fg.addColorStop(1, rgb(mix(shell, [20, 10, 5], 0.3)));
      g.fillStyle = fg;
      g.beginPath(); g.moveTo(-5, 0); g.quadraticCurveTo(-11, 22, 0, 30); g.quadraticCurveTo(11, 22, 5, 0); g.closePath(); g.fill();
      g.strokeStyle = rgb(mix(shell, [0, 0, 0], 0.4), 0.5); g.lineWidth = 0.6; g.stroke();
      g.restore();
    }
    // 껍질 마디 6개 (아래 마디부터 그려서 위 마디가 겹쳐 보이게)
    const shellPath = new Path2D();
    for (let i = 5; i >= 0; i--) {
      const y = -66 + i * 21, w = 31 - i * 2.4;
      const grd = g.createRadialGradient(-w * 0.3, y + 4, 2, 0, y + 10, w * 1.2);
      grd.addColorStop(0, rgb(mix(shell, [255, 220, 200], 0.35)));
      grd.addColorStop(0.6, rgb(shell));
      grd.addColorStop(1, rgb(mix(shell, [10, 5, 0], 0.45)));
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(-w, y + 22); g.quadraticCurveTo(-w - 3, y + 2, 0, y - 1); g.quadraticCurveTo(w + 3, y + 2, w, y + 22);
      g.quadraticCurveTo(0, y + 27, -w, y + 22); g.closePath(); g.fill();
      shellPath.moveTo(-w, y + 22); shellPath.quadraticCurveTo(-w - 3, y + 2, 0, y - 1); shellPath.quadraticCurveTo(w + 3, y + 2, w, y + 22); shellPath.quadraticCurveTo(0, y + 27, -w, y + 22);
      g.strokeStyle = rgb(mix(shell, [0, 0, 0], 0.55), 0.55); g.lineWidth = 0.8; g.stroke();
      // 반점과 하이라이트
      g.fillStyle = rgb(mix(shell, [0, 0, 0], 0.4), 0.35);
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(-w * 0.6 + k * w * 0.3, y + 10 + (k % 2) * 4, 1.1, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-w * 0.7, y + 5); g.quadraticCurveTo(0, y + 1, w * 0.7, y + 5); g.stroke();
    }
    // 실사 껍질: 실제 생 랍스터 꼬리 사진 (익으면 주홍빛 사진으로 교차)
    if (PHOTOS.lobsterTailRaw) {
      g.save(); g.clip(shellPath);
      const c = clamp(cook * 1.4, 0, 1);
      if (c < 1) g.drawImage(PHOTOS.lobsterTailRaw, -33, -68, 66, 128);
      if (c > 0 && PHOTOS.lobsterTailCooked) { g.globalAlpha *= c; g.drawImage(PHOTOS.lobsterTailCooked, -33, -68, 66, 128); }
      g.restore();
    } else if (PHOTOS.lobsterShell) {
      g.save(); g.clip(shellPath);
      g.translate(0, -8); g.rotate(Math.PI / 2);
      const c = clamp(cook * 1.4, 0, 1);
      texFill(g, 'lobsterShellRaw', -80, -36, 160, 72, { mode: 'overlay', alpha: (1 - c) * 0.85 });
      texFill(g, 'lobsterShell', -80, -36, 160, 72, { mode: 'overlay', alpha: c * 0.85 });
      g.restore();
    }
    // 속살 (갈라졌을 때 보임)
    if (split > 0.05) {
      g.save();
      g.globalAlpha = clamp(split * 1.5, 0, 1);
      const m = mix(meatRaw, meatDone, clamp(cook, 0, 1));
      const mg = g.createLinearGradient(0, -60, side * 18, 60);
      mg.addColorStop(0, rgb(m)); mg.addColorStop(1, rgb(mix(m, [250, 170, 140], 0.35 + cook * 0.2)));
      g.fillStyle = mg;
      g.beginPath(); g.moveTo(0, -62); g.quadraticCurveTo(side * 22, -40, side * 18, 20); g.quadraticCurveTo(side * 12, 56, 0, 58); g.closePath(); g.fill();
      if (PHOTOS.lobsterMeat) {
        // 버터에 구운 실제 랍스터 살 질감 (덜 익으면 반투명하게 흐림)
        g.save(); g.clip();
        g.rotate(Math.PI / 2);
        texFill(g, 'lobsterMeat', -64, -24, 128, 48, { mode: cook > 0.6 ? 'source-over' : 'overlay', alpha: clamp(cook, 0.2, 1) * 0.9 });
        g.restore();
      }
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
  if (cheese != null && PHOTOS.gratin) {
    // 실사 그라탱: 덜 구우면 하얀 치즈, 알맞으면 노릇한 반점, 지나치면 탄 갈색
    g.save();
    g.beginPath(); g.ellipse(0, -2, 24, 57, 0, 0, TAU); g.clip();
    g.drawImage(PHOTOS.gratin, -26, -60, 52, 116);
    const pale = clamp(0.95 - cheese, 0.14, 0.8);
    if (pale > 0) { g.fillStyle = `rgba(250,240,205,${pale})`; g.fillRect(-26, -60, 52, 116); }
    const burnt = clamp(cheese - 1.2, 0, 1);
    if (burnt > 0) { g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgba(90,50,25,${burnt * 0.8})`; g.fillRect(-26, -60, 52, 116); }
    g.restore();
  } else if (cheese != null) {
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
  const photoKey = sauce === 'carbonara' ? 'pastaCarbonara' : sauce === 'tomato' ? 'pastaTomato' : 'pastaAglio';
  if (sauce === 'tomato' && !PHOTOS[photoKey]) { g.fillStyle = 'rgba(200,60,30,0.35)'; g.beginPath(); g.ellipse(2, 4, r0 + 8, r0 * 0.9 + 6, 0, 0, TAU); g.fill(); }
  else if (emulsion < 0.5) { g.fillStyle = 'rgba(220,190,80,0.25)'; g.beginPath(); g.ellipse(3, 5, r0 + 10, r0 * 0.9 + 8, 0, 0, TAU); g.fill(); }
  if (PHOTOS[photoKey]) {
    // 실사 파스타: 정돈이 덜 되면 납작하게 퍼지고 기울어 보임
    g.save();
    g.rotate((1 - twirl) * 0.5 + (seed % 5) * 0.4);
    g.scale(1 + (1 - twirl) * 0.18, 1 - (1 - twirl) * 0.12);
    const im = PHOTOS[photoKey], pw = r0 * 2.25, ph = pw * im.height / im.width;
    g.fillStyle = 'rgba(40,25,10,0.14)'; g.beginPath(); g.ellipse(3, 5, pw * 0.42, ph * 0.42, 0, 0, TAU); g.fill();
    drawPhoto(g, photoKey, pw);
    g.restore();
    // 사진에 이미 있는 재료(마늘·페페론치노 / 관찰레·치즈·후추)는 상태가 다를 때만 덧그림
    const R2 = rng(seed + 1);
    const sprinkle = (n, fn) => { for (let i = 0; i < n; i++) { const a = R2() * TAU, d = Math.sqrt(R2()) * r0 * 0.8; fn(Math.cos(a) * d, Math.sin(a) * d * 0.88, i); } };
    if (toppings.garlic != null && toppings.garlic > 1.25) sprinkle(14, (x, y) => drawGarlicSlice(g, x, y, toppings.garlic, R2() * 3, 2.6));
    if (sauce === 'carbonara' && toppings.guanciale > 1.35) sprinkle(10, (x, y) => drawGuancialeBit(g, x, y, toppings.guanciale, R2()));
    if (sauce === 'carbonara' && toppings.pepper > 1.1) sprinkle(Math.round(20 * (toppings.pepper - 1)), (x, y) => { g.fillStyle = '#1b1410'; g.beginPath(); g.arc(x, y, 0.8, 0, TAU); g.fill(); });
    if (toppings.shrimp) sprinkle(toppings.shrimp, (x, y) => { g.save(); g.translate(x * 0.8, y * 0.8); g.rotate(R2() * TAU); g.scale(0.42, 0.42); drawShrimp(g, { cook: toppings.shrimpCook ?? 1 }); g.restore(); });
    if (toppings.tomato) sprinkle(toppings.tomato, (x, y) => { g.save(); g.translate(x, y); g.scale(0.7, 0.7); drawTomatoHalfSmall(g); g.restore(); });
    if (toppings.parsley) sprinkle(26, (x, y) => drawParsleyBit(g, x, y, R2()));
    if (emulsion < 0.4) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(80,60,10,0.25)'; g.beginPath(); g.ellipse(0, 0, r0, r0 * 0.88, 0, 0, TAU); g.fill(); g.restore(); }
    return;
  }
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
  const im = PHOTOS.parsleyLeaf;
  if (im) {
    // 다진 파슬리: 실제 잎 조각을 작게 돌려 뿌림
    g.save(); g.translate(x, y); g.rotate(r * 6.28);
    const s = 2.4 + r * 1.6;
    g.drawImage(im, -s / 2, -s * 0.37, s, s * 0.74);
    g.restore();
    return;
  }
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
  if (drawPhoto(g, 'tomatoHalf', 20)) return;
  g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fillStyle = '#d8281c'; g.fill();
  g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fillStyle = '#ff7055'; g.fill();
  g.fillStyle = 'rgba(255,220,140,0.8)';
  for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; g.beginPath(); g.ellipse(Math.cos(a) * 3.5, Math.sin(a) * 3.5, 2.3, 1.5, a, 0, TAU); g.fill(); }
}

// ---------------- 감바스 (카수엘라 토기) ----------------
export function drawCazuela(g, { garlic = 0.8, shrimpCook = 1, shrimp = 6, oil = 1, parsley = true, chili = true, seed = 3 } = {}) {
  const R = rng(seed);
  if (PHOTOS.gambas) {
    // 실사 감바스: 무쇠 팬째 지글지글 (파슬리는 준비했을 때만)
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(5, 9, 80, 76, 0, 0, TAU); g.fill();
    drawPhoto(g, parsley ? 'gambas' : 'gambasPlain', 160);
    g.save(); g.beginPath(); g.arc(0, 0, 66, 0, TAU); g.clip();
    // 덜 익은 새우는 회색빛, 너무 익히면 마른 갈색 / 마늘이 타면 쓴 갈색
    if (shrimpCook < 0.7) { g.globalCompositeOperation = 'saturation'; g.fillStyle = `rgba(128,128,128,${(0.7 - shrimpCook) * 1.1})`; g.fillRect(-70, -70, 140, 140); }
    if (garlic > 1.25 || shrimpCook > 1.35) { g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgba(90,50,20,${clamp(Math.max(garlic - 1.25, shrimpCook - 1.35) * 0.9, 0, 0.7)})`; g.fillRect(-70, -70, 140, 140); }
    if (oil < 0.6) { g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgba(60,30,15,${(0.6 - oil) * 0.6})`; g.fillRect(-70, -70, 140, 140); }
    g.restore();
    return;
  }
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
  if (PHOTOS.baguette) {
    // 노릇한 껍질 테두리 + 실제 바게트 속살 사진, 살짝 구운 기운
    const cr = g.createRadialGradient(-4, -3, 4, 0, 0, 19);
    cr.addColorStop(0, '#d89a4a'); cr.addColorStop(1, '#8a4f1c');
    g.fillStyle = cr; g.beginPath(); g.ellipse(0, 0, 18, 10, 0, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.ellipse(0, -0.3, 16, 8.4, 0, 0, TAU); g.clip();
    g.drawImage(PHOTOS.baguette, -16, -8.7, 32, 17.4);
    const toast = g.createRadialGradient(0, 0, 4, 0, 0, 17);
    toast.addColorStop(0, 'rgba(230,160,70,0)'); toast.addColorStop(1, 'rgba(200,120,40,0.45)');
    g.fillStyle = toast; g.fillRect(-17, -9, 34, 18);
    g.restore();
    return;
  }
  g.beginPath(); g.ellipse(0, 0, 15.5, 8, 0, 0, TAU);
  const c = g.createRadialGradient(-3, -2, 1, 0, 0, 16); c.addColorStop(0, '#fbecc8'); c.addColorStop(1, '#e8c78a');
  g.fillStyle = c; g.fill();
  const R = rng(4);
  for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(190,150,90,0.6)'; g.beginPath(); g.ellipse((R() - 0.5) * 24, (R() - 0.5) * 11, 0.8 + R() * 1.4, 0.6 + R(), 0, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(255,220,160,0.6)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(0, 0, 17, 9.2, 0, -2.6, -1.2); g.stroke();
}

export function drawLemonWedge(g) {
  if (drawPhoto(g, 'lemon', 34, { dy: -4 })) return;
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
  if (drawPhoto(g, 'parsleySprig', 24)) return;
  const R = rng(seed);
  for (let i = 0; i < 30; i++) drawParsleyBit(g, (R() - 0.5) * 18, (R() - 0.5) * 14, R());
}
