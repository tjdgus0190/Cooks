// 실사풍 텍스처 엔진: 픽셀 단위 노이즈(fBm·도메인 워핑) + 높이맵 기반 조명(디퓨즈·스페큘러·AO)
// 결과는 캔버스로 캐시되어 기존 렌더러가 drawImage로 사용한다.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

/** 시드 고정 2D 그라디언트 노이즈 (Perlin 계열) */
export function makeNoise(seed = 1) {
  const p = new Uint8Array(512);
  let s = seed * 2654435761 >>> 0;
  const rnd = () => ((s = (s ^ (s << 13)) >>> 0, s ^= s >>> 17, s = (s ^ (s << 5)) >>> 0) / 4294967296);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const grad = (h, x, y) => { switch (h & 7) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function n2(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = p[X] + Y, b = p[X + 1] + Y;
    return mix(mix(grad(p[a], x, y), grad(p[b], x - 1, y), u), mix(grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1), u), v) * 0.7071;
  }
  function fbm(x, y, oct = 5, lac = 2.03, gain = 0.5) {
    let a = 0.5, f = 1, sum = 0;
    for (let i = 0; i < oct; i++) { sum += a * n2(x * f, y * f); f *= lac; a *= gain; }
    return sum;
  }
  function ridged(x, y, oct = 4) {
    let a = 0.5, f = 1, sum = 0;
    for (let i = 0; i < oct; i++) { sum += a * (1 - Math.abs(n2(x * f, y * f))); f *= 2.1; a *= 0.5; }
    return sum;
  }
  return { n2, fbm, ridged };
}

/**
 * 높이맵 + 알베도 → 조명된 RGBA 이미지
 * fields(x,y) → { h, r,g,b, a, spec, gloss } (0..1, rgb 0..255)
 * light: 좌상단에서 오는 따뜻한 키라이트
 */
export function shade(w, h, fields, { bump = 2.2, light = [-0.55, -0.65, 0.52], specColor = [255, 246, 230], ambient = 0.42 } = {}) {
  const H = new Float32Array(w * h);
  const A = new Float32Array(w * h * 7); // r g b a spec gloss sss
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const f = fields(x / w, y / h, x, y);
    const i = y * w + x;
    H[i] = f.h;
    const k = i * 7;
    A[k] = f.r; A[k + 1] = f.g; A[k + 2] = f.b; A[k + 3] = f.a ?? 1; A[k + 4] = f.spec ?? 0.3; A[k + 5] = f.gloss ?? 30; A[k + 6] = f.sss ?? 0;
  }
  const L = Math.hypot(...light);
  const lx = light[0] / L, ly = light[1] / L, lz = light[2] / L;
  // 하프 벡터 (시선은 정면)
  let hx = lx, hy = ly, hz = lz + 1; const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
  const img = new ImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, k = i * 7;
    const xl = x > 0 ? H[i - 1] : H[i], xr = x < w - 1 ? H[i + 1] : H[i];
    const yu = y > 0 ? H[i - w] : H[i], yd = y < h - 1 ? H[i + w] : H[i];
    let nx = (xl - xr) * bump, ny = (yu - yd) * bump, nz = 1;
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
    const sp = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), A[k + 5]) * A[k + 4];
    // 간이 AO: 주변보다 낮으면 어둡게
    let avg = 0, c = 0;
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [2, -2], [-2, 2]]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) { avg += H[yy * w + xx]; c++; }
    }
    const ao = clamp(1 - Math.max(0, avg / c - H[i]) * 4.5, 0.45, 1);
    const sss = A[k + 6];
    const lit = (ambient + (1 - ambient) * diff) * ao;
    const o = i * 4;
    // 서브서피스: 그림자 부분도 붉게 비치는 고기 느낌
    d[o] = clamp(A[k] * (lit + sss * 0.25) + specColor[0] * sp, 0, 255);
    d[o + 1] = clamp(A[k + 1] * (lit + sss * 0.06) + specColor[1] * sp, 0, 255);
    d[o + 2] = clamp(A[k + 2] * (lit + sss * 0.04) + specColor[2] * sp, 0, 255);
    d[o + 3] = clamp(A[k + 3] * 255, 0, 255);
  }
  return img;
}

export function toCanvas(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

export { clamp, smooth, mix };
