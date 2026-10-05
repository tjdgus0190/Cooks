// 스테이크 실사풍 텍스처: 생고기(마블링·근섬유·촉촉한 윤기)와 시어링 크러스트(요철·캐러멜·기름 광택)
import { makeNoise, shade, toCanvas, clamp, smooth, mix } from './realtex.js';

const MAX_W = 620; // 모바일 성능을 위한 텍스처 최대 폭(px)

function maskAndEdge(shapePath, fatLine, fatW, bx0, by0, bw, bh, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const sx = w / bw;
  g.setTransform(sx, 0, 0, sx, -bx0 * sx, -by0 * sx);
  // R: 내부 마스크, G: 가장자리 근접도, B: 지방층 근접도
  g.fillStyle = 'rgb(255,0,0)'; g.fill(shapePath);
  g.globalCompositeOperation = 'lighter';
  g.save(); g.clip(shapePath);
  for (let k = 1; k <= 10; k++) { g.lineWidth = k * 2.2; g.strokeStyle = 'rgba(0,26,0,1)'; g.stroke(shapePath); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (let k = 1; k <= 10; k++) {
    g.beginPath(); fatLine.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.lineWidth = (fatW * 2 + 6) * (k / 10); g.strokeStyle = 'rgba(0,0,26,1)'; g.stroke();
  }
  g.restore();
  return g.getImageData(0, 0, w, h).data;
}

/** 생 스테이크 윗면 */
export function realRaw(env, marbling = 1, seed = 7) {
  const { shapePath, fatLine, fatW, bx0, by0, bw, bh, scale } = env;
  const w = Math.min(MAX_W, Math.round(bw * scale)), h = Math.round(w * bh / bw);
  const M = maskAndEdge(shapePath, fatLine, fatW, bx0, by0, bw, bh, w, h);
  const N = makeNoise(seed), N2 = makeNoise(seed + 11);
  const ang = 0.5, ca = Math.cos(ang), sa = Math.sin(ang);
  const thr = 0.86 - Math.min(0.035, (marbling - 1) * 0.015);
  const img = shade(w, h, (u, v, x, y) => {
    const o = (y * w + x) * 4;
    const inside = M[o] > 127;
    const edge = M[o + 1] / 255, fatNear = M[o + 2] / 255;
    if (!inside) return { h: 0.3, r: 0, g: 0, b: 0, a: 0 };
    const X = u * bw / 40, Y = v * bh / 40; // 40mm 단위 좌표
    const c1 = N.fbm(X * 1.2, Y * 1.2, 4);
    const fu = X * ca + Y * sa, fv = -X * sa + Y * ca;
    const fiber = N2.n2(fu * 2.2, fv * 26) * 0.5 + N2.n2(fu * 5, fv * 60) * 0.25;
    // 마블링: 도메인 워핑한 능선 노이즈 → 그물 모양 지방 + 잔점
    const wx = X + 0.35 * N.fbm(X * 0.8 + 3.1, Y * 0.8, 3), wy = Y + 0.35 * N.fbm(X * 0.8, Y * 0.8 + 7.7, 3);
    const veins = N2.ridged(wx * 2.3, wy * 3.2, 4);
    let fat = smooth(thr, thr + 0.035, veins) * smooth(-0.2, 0.2, N.fbm(X * 0.6 + 9, Y * 0.6, 2) + (marbling - 1) * 0.15) * 0.95;
    const fleck = N.fbm(X * 14, Y * 14, 3);
    fat = Math.max(fat, smooth(0.42 - Math.min(marbling, 3) * 0.015, 0.48, fleck) * 0.85);
    // 지방층(윗변)
    const cap = smooth(0.62, 0.86, fatNear);
    const cc = c1 * 0.5 + 0.5;
    let r = mix(98, 138, cc) + fiber * 9, g = mix(16, 30, cc) + fiber * 3, b = mix(26, 38, cc) + fiber * 3;
    // 공기에 닿아 살짝 밝은 선홍색 (산소화)
    r += 8 * (1 - edge); g += 2 * (1 - edge);
    const fr = mix(232, 246, fleck), fg = mix(212, 228, fleck), fb = mix(196, 210, fleck);
    r = mix(r, fr, fat); g = mix(g, fg, fat); b = mix(b, fb, fat);
    // 지방 경계는 분홍빛
    const capEdge = smooth(0.45, 0.62, fatNear) * (1 - cap);
    r = mix(r, 226, capEdge * 0.6); g = mix(g, 150, capEdge * 0.6); b = mix(b, 140, capEdge * 0.6);
    const cn = N.fbm(X * 4, Y * 4, 3);
    r = mix(r, 236 + cn * 10, cap); g = mix(g, 220 + cn * 10, cap); b = mix(b, 190 + cn * 12, cap);
    // 가장자리 음영 (지방층 제외)
    const ed = 1 - edge * 0.3 * (1 - cap);
    return {
      h: 0.5 + fiber * 0.025 + c1 * 0.04 + fat * 0.035 + cap * 0.05 + N.fbm(X * 14, Y * 14, 2) * 0.012 + (1 - edge) * 0.18,
      r: r * ed, g: g * ed, b: b * ed,
      spec: mix(0.2, 0.16, fat) + cap * 0.04, gloss: mix(55, 25, Math.max(fat, cap)),
      sss: (1 - fat) * (1 - cap),
    };
  }, { bump: 5, ambient: 0.62 });
  return toCanvas(img);
}

/** 시어링 크러스트 (갈변도 약 1.1 기준의 색·요철) */
export function realCrust(env, seed = 21) {
  const { shapePath, fatLine, fatW, bx0, by0, bw, bh, scale } = env;
  const w = Math.min(MAX_W, Math.round(bw * scale)), h = Math.round(w * bh / bw);
  const M = maskAndEdge(shapePath, fatLine, fatW, bx0, by0, bw, bh, w, h);
  const N = makeNoise(seed), N2 = makeNoise(seed + 5);
  const ang = 0.5, ca = Math.cos(ang), sa = Math.sin(ang);
  const img = shade(w, h, (u, v, x, y) => {
    const o = (y * w + x) * 4;
    if (M[o] < 128) return { h: 0.3, r: 0, g: 0, b: 0, a: 0 };
    const edge = M[o + 1] / 255, cap = smooth(0.62, 0.86, M[o + 2] / 255);
    const X = u * bw / 40, Y = v * bh / 40;
    const fu = X * ca + Y * sa, fv = -X * sa + Y * ca;
    const big = N.fbm(X * 1.1, Y * 1.1, 3);
    const mid = N.fbm(X * 3.2, Y * 3.2, 4);
    const fine = N.fbm(X * 8, Y * 8, 3);
    const fib = N2.n2(fu * 2.5, fv * 30) * 0.5 + N2.n2(fu * 6, fv * 70) * 0.2;
    const grit = N2.fbm(X * 20, Y * 20, 2);
    let hgt = 0.5 + mid * 0.16 + fine * 0.11 + fib * 0.05 + grit * 0.05 + big * 0.08 + (1 - edge) * 0.2;
    // 색: 진한 마호가니 바탕 + 볼록한 곳은 황금빛 캐러멜, 군데군데 짙게 지져진 얼룩
    const t = clamp(0.5 + mid * 0.8 + fine * 0.7 + big * 0.5 + fib * 0.2 + grit * 0.3, 0, 1);
    let r = mix(66, 182, Math.pow(t, 1.25)), g = mix(28, 100, Math.pow(t, 1.4)), b = mix(12, 46, Math.pow(t, 1.6));
    const spot = smooth(0.12, 0.34, N.fbm(X * 2.2 + 5, Y * 2.2, 3));
    r = mix(r, r * 0.55, spot); g = mix(g, g * 0.5, spot); b = mix(b, b * 0.5, spot);
    hgt -= spot * 0.05;
    // 가장자리는 더 바삭하고 진하게
    r *= 1 - edge * 0.3; g *= 1 - edge * 0.35; b *= 1 - edge * 0.35;
    // 지방층: 노릇하게 녹아 반투명한 황금색
    const cn = N.fbm(X * 6, Y * 6, 3);
    r = mix(r, 232 + cn * 18, cap); g = mix(g, 168 + cn * 26, cap); b = mix(b, 84 + cn * 20, cap);
    hgt = mix(hgt, 0.55 + cn * 0.15, cap);
    const glint = smooth(0.25, 0.4, grit) * 0.6;
    return { h: hgt, r, g, b, spec: 0.28 + t * 0.25 + cap * 0.1 + glint, gloss: 24 + t * 20 + glint * 30, sss: 0.1 };
  }, { bump: 6, ambient: 0.52, specColor: [255, 232, 196] });
  return toCanvas(img);
}

/** 단면(슬라이스 잘린 면) 텍스처: 온도 분포 그라디언트 + 결 + 마블링 + 육즙 광택 */
export function realCrossSection(L, T, colorAt, crustTop, crustBottom, { marbling = 1, seed = 3, px = 4, photo = false } = {}) {
  const fk = photo ? 0.3 : 1; // 사진 결 디테일을 입힐 땐 절차적 결은 약하게
  const w = Math.max(8, Math.round(L * px)), h = Math.max(4, Math.round(T * px));
  const N = makeNoise(seed), N2 = makeNoise(seed + 9);
  const img = shade(w, h, (u, v) => {
    const X = u * L / 12, Y = v * T / 12; // 12mm 단위
    let [r, g, b] = colorAt(clamp(v + N.fbm(X * 0.8, Y * 0.8, 2) * 0.04, 0, 1));
    // 근섬유 결: 가로로 긴 줄무늬 + 짙은 붉은 결
    const fib = N.n2(X * 0.6, Y * 9) * 0.6 + N.n2(X * 1.8, Y * 22) * 0.3 + N.n2(X * 4, Y * 40) * 0.15;
    const streak = smooth(0.25, 0.5, N2.n2(X * 0.4, Y * 6));
    r += (fib * 16 - streak * 22) * fk; g += (fib * 6 - streak * 10) * fk; b += (fib * 6 - streak * 8) * fk;
    // 마블링: 결을 따라 길쭉한 흰 지방
    const fat = smooth(0.34 - marbling * 0.03, 0.42, N2.fbm(X * 0.9, Y * 4.5, 3)) * 0.85;
    r = mix(r, 236, fat); g = mix(g, 214, fat); b = mix(b, 200, fat);
    // 크러스트(겉면) 띠
    const yt = v * T;
    const inTop = yt < crustTop.th, inBot = yt > T - crustBottom.th;
    let crust = 0;
    if (inTop || inBot) {
      const c = inTop ? crustTop.rgb : crustBottom.rgb;
      const n = N.fbm(X * 3, Y * 3, 3);
      r = c[0] * (0.8 + n * 0.5); g = c[1] * (0.8 + n * 0.5); b = c[2] * (0.8 + n * 0.5);
      crust = 1;
    }
    return { h: 0.5 + fib * 0.04 + crust * N.fbm(X * 4, Y * 4, 2) * 0.15, r, g, b, spec: crust ? 0.2 : 0.38, gloss: crust ? 16 : 60, sss: crust ? 0 : 0.8 };
  }, { bump: 6, ambient: 0.66 });
  return toCanvas(img);
}

// ── 실사 사진 기반 텍스처 ────────────────────────────────
function photoPixels(img, w, h, env) {
  // 사진을 고기 윤곽의 경계 상자에 맞춰 늘려 그린 픽셀
  const { bx0, by0, bw, sbox } = env;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const sx = w / bw;
  g.setTransform(sx, 0, 0, sx, -bx0 * sx, -by0 * sx);
  const [x0, y0, x1, y1] = sbox || [bx0, by0, bx0 + bw, by0 + env.bh];
  g.drawImage(img, x0, y0, x1 - x0, y1 - y0);
  return g.getImageData(0, 0, w, h);
}

/** 생 스테이크 윗면 — 실제 립아이 사진 + 지방층(윗변) + 가장자리 음영 */
export function photoRaw(env, img, marbling = 1, seed = 7) {
  const { shapePath, fatLine, fatW, bx0, by0, bw, bh, scale } = env;
  const w = Math.min(MAX_W, Math.round(bw * scale)), h = Math.round(w * bh / bw);
  const M = maskAndEdge(shapePath, fatLine, fatW, bx0, by0, bw, bh, w, h);
  const P = photoPixels(img, w, h, env), d = P.data;
  const N = makeNoise(seed);
  const extra = clamp((marbling - 1) * 0.45, 0, 0.9); // 와규: 잔 마블링 추가
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    if (M[o] < 128) { d[o + 3] = 0; continue; }
    const edge = M[o + 1] / 255, fatNear = M[o + 2] / 255;
    const X = (x / w) * bw / 40, Y = (y / h) * bh / 40;
    let r = d[o], g = d[o + 1], b = d[o + 2];
    if (extra > 0) {
      const f = smooth(0.36, 0.46, N.fbm(X * 12, Y * 12, 3)) * extra * smooth(20, 60, r - g);
      r = mix(r, 240, f); g = mix(g, 222, f); b = mix(b, 208, f);
    }
    const cap = smooth(0.62, 0.86, fatNear), capEdge = smooth(0.45, 0.62, fatNear) * (1 - cap);
    r = mix(r, 226, capEdge * 0.5); g = mix(g, 160, capEdge * 0.5); b = mix(b, 146, capEdge * 0.5);
    const cn = N.fbm(X * 4, Y * 4, 3), fl = N.fbm(X * 16, Y * 16, 2);
    r = mix(r, 236 + cn * 10 + fl * 8, cap); g = mix(g, 220 + cn * 10 + fl * 8, cap); b = mix(b, 192 + cn * 12 + fl * 8, cap);
    const ed = 1 - edge * 0.32 * (1 - cap);
    d[o] = r * ed; d[o + 1] = g * ed; d[o + 2] = b * ed; d[o + 3] = 255;
  }
  return toCanvas(P);
}

/** 시어링 크러스트 — 무쇠팬에 구운 실제 스테이크 표면 질감 + 노릇한 지방층 */
export function photoCrust(env, img, seed = 21) {
  const { shapePath, fatLine, fatW, bx0, by0, bw, bh, scale } = env;
  const w = Math.min(MAX_W, Math.round(bw * scale)), h = Math.round(w * bh / bw);
  const M = maskAndEdge(shapePath, fatLine, fatW, bx0, by0, bw, bh, w, h);
  const d = photoPixels(img, w, h, { ...env, sbox: null }).data;
  const N = makeNoise(seed);
  // 사진 밝기를 높이로 삼아 요철에 다시 빛을 줌 (볼록한 캐러멜 부분이 반짝임)
  const Lm = boxBlur(lumOf(d, w, h), w, h, 2);
  const img2 = shade(w, h, (u, v, x, y) => {
    const i = y * w + x, o = i * 4;
    if (M[o] < 128) return { h: 0.3, r: 0, g: 0, b: 0, a: 0 };
    const edge = M[o + 1] / 255, cap = smooth(0.62, 0.86, M[o + 2] / 255);
    const X = u * bw / 40, Y = v * bh / 40;
    let r = d[o], g = d[o + 1], b = d[o + 2];
    // 큰 얼룩(팬에 닿은 정도 차이)과 볼록한 윗면 하이라이트로 반복감·평면감 제거
    const big = N.fbm(X * 0.9 + 4, Y * 0.9, 3), dome = 1 - edge;
    const k = 0.9 + big * 0.3 - smooth(0.15, 0.4, N.fbm(X * 2.4, Y * 2.4 + 9, 3)) * 0.16;
    r *= k; g *= k * (0.98 + big * 0.06); b *= k;
    // 가장자리는 더 바삭하고 진하게
    r *= 1 - edge * 0.25; g *= 1 - edge * 0.3; b *= 1 - edge * 0.3;
    const cn = N.fbm(X * 6, Y * 6, 3), lum = Lm[i];
    r = mix(r, (226 + cn * 18) * (0.8 + lum * 0.4), cap); g = mix(g, (160 + cn * 24) * (0.8 + lum * 0.4), cap); b = mix(b, (80 + cn * 18) * (0.8 + lum * 0.4), cap);
    return { h: lum * 0.35 + dome * 0.25 + big * 0.05, r: r * 1.12, g: g * 1.12, b: b * 1.12, spec: 0.14 + lum * 0.35, gloss: 30 + lum * 40, sss: 0 };
  }, { bump: 9, ambient: 0.72, specColor: [255, 228, 190] });
  return toCanvas(img2);
}

function lumOf(d, w, h) {
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (d[i * 4] * 0.4 + d[i * 4 + 1] * 0.45 + d[i * 4 + 2] * 0.15) / 255;
  return L;
}
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, c = 0;
    for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) { s += src[y * w + xx]; c++; } }
    tmp[y * w + x] = s / c;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, c = 0;
    for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; c++; } }
    out[y * w + x] = s / c;
  }
  return out;
}
