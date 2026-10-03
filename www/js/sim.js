// 스테이크 열전달 시뮬레이션 (1차원 유한차분) + 마이야르(겉면 갈변) 모델
// 실제 물성치를 쓰되 게임 시간은 TIME_SCALE 배속으로 진행한다.
export const TIME_SCALE = 9; // 게임 1초 = 실제 조리 9초

const K = 0.46;          // 열전도율 W/mK
const RHO_C = 3.6e6;     // 체적 열용량 J/m³K
const H_PAN = 520;       // 팬 접촉 열전달계수 W/m²K
const H_AIR = 14;        // 공기 대류(윗면)
const T_AIR = 26;

export const HEAT_LEVELS = { low: 150, mid: 205, high: 255 };

export const DONENESS = [
  { key: 'blue', name: '블루', min: 0, max: 46 },
  { key: 'rare', name: '레어', min: 46, max: 53 },
  { key: 'medium-rare', name: '미디엄 레어', min: 53, max: 58 },
  { key: 'medium', name: '미디엄', min: 58, max: 64 },
  { key: 'medium-well', name: '미디엄 웰', min: 64, max: 69 },
  { key: 'well-done', name: '웰던', min: 69, max: 200 },
];

export const TARGETS = {
  'rare': { ideal: 50, name: '레어' },
  'medium-rare': { ideal: 55.5, name: '미디엄 레어' },
  'medium': { ideal: 61, name: '미디엄' },
  'medium-well': { ideal: 66.5, name: '미디엄 웰' },
  'well-done': { ideal: 72, name: '웰던' },
};

export function donenessOf(t) {
  for (const d of DONENESS) if (t >= d.min && t < d.max) return d;
  return DONENESS[DONENESS.length - 1];
}

export function createSteak({ thicknessMm = 28, startTemp = 16, nodes = 15 } = {}) {
  return {
    n: nodes,
    dx: thicknessMm / 1000 / (nodes - 1),
    T: new Float64Array(nodes).fill(startTemp),   // 0 = 팬에 닿은 면(아래)
    Tmax: new Float64Array(nodes).fill(startTemp),
    // face[0]: 처음 아래로 놓인 면 A, face[1]: 면 B
    brown: [0, 0],
    down: 0,          // 현재 팬에 닿아 있는 면 인덱스
    sideTime: [0, 0], // 각 면이 팬에 닿은 누적 시간(실제 초)
    simTime: 0,
  };
}

/** 실제(시뮬레이션) 시간 dtSim초만큼 진행. contact: 0~1 팬 접촉 비율(접혔을 때 감소) */
export function stepSteak(s, dtSim, panTemp, contact = 1) {
  const maxDt = 0.45 * (s.dx * s.dx) * RHO_C / K; // 안정 조건
  let remain = dtSim;
  const T = s.T, n = s.n, dx = s.dx;
  const next = new Float64Array(n);
  while (remain > 1e-9) {
    const dt = Math.min(remain, maxDt);
    remain -= dt;
    for (let i = 1; i < n - 1; i++) {
      next[i] = T[i] + dt * K * (T[i - 1] - 2 * T[i] + T[i + 1]) / (dx * dx * RHO_C);
    }
    // 아래면: 팬 전도 (수분 증발로 표면 온도 상승 억제 → 갈변 전까지 100℃ 부근 정체 근사)
    const hEff = H_PAN * contact + H_AIR * (1 - contact);
    const tEnv0 = panTemp * contact + T_AIR * (1 - contact);
    const evap0 = T[0] > 100 ? (T[0] - 100) * 2400 * Math.max(0.25, 1 - s.brown[s.down] * 0.5) : 0;
    next[0] = T[0] + dt * (K * (T[1] - T[0]) / dx + hEff * (tEnv0 - T[0]) - evap0) / (RHO_C * dx / 2);
    // 윗면: 공기 + 증발 냉각
    const evapN = T[n - 1] > 45 ? (T[n - 1] - 45) * 70 : 0;
    next[n - 1] = T[n - 1] + dt * (K * (T[n - 2] - T[n - 1]) / dx + H_AIR * (T_AIR - T[n - 1]) - evapN) / (RHO_C * dx / 2);
    for (let i = 0; i < n; i++) { T[i] = next[i]; if (T[i] > s.Tmax[i]) s.Tmax[i] = T[i]; }

    // 마이야르 갈변: 팬 온도 기반 (140℃ 이상에서 활발, 고온일수록 급격)
    const over = Math.max(0, panTemp - 135);
    const rate = 0.0000105 * Math.pow(over, 1.55) * contact; // 1/s
    s.brown[s.down] += rate * dt;
  }
  s.sideTime[s.down] += dtSim * contact;
  s.simTime += dtSim;
}

export function flipSteak(s) {
  s.T.reverse();
  s.Tmax.reverse();
  s.down = 1 - s.down;
}

/** 레스팅(잔열 조리): 양면 공기 노출 */
export function restSteak(s, seconds) {
  const T = s.T, n = s.n, dx = s.dx;
  const next = new Float64Array(n);
  const maxDt = 0.45 * (dx * dx) * RHO_C / K;
  let remain = seconds;
  while (remain > 1e-9) {
    const dt = Math.min(remain, maxDt);
    remain -= dt;
    for (let i = 1; i < n - 1; i++) next[i] = T[i] + dt * K * (T[i - 1] - 2 * T[i] + T[i + 1]) / (dx * dx * RHO_C);
    const e0 = T[0] > 45 ? (T[0] - 45) * 70 : 0, eN = T[n - 1] > 45 ? (T[n - 1] - 45) * 70 : 0;
    next[0] = T[0] + dt * (K * (T[1] - T[0]) / dx + H_AIR * (T_AIR - T[0]) - e0) / (RHO_C * dx / 2);
    next[n - 1] = T[n - 1] + dt * (K * (T[n - 2] - T[n - 1]) / dx + H_AIR * (T_AIR - T[n - 1]) - eN) / (RHO_C * dx / 2);
    for (let i = 0; i < n; i++) { T[i] = next[i]; if (T[i] > s.Tmax[i]) s.Tmax[i] = T[i]; }
  }
}

export function coreTemp(s) {
  // 가장 차가운 지점 = 중심부
  let m = Infinity;
  for (let i = 0; i < s.n; i++) if (s.T[i] < m) m = s.T[i];
  return m;
}

export function coreMax(s) {
  let m = Infinity;
  for (let i = 0; i < s.n; i++) if (s.Tmax[i] < m) m = s.Tmax[i];
  return m;
}

export function cloneSteak(s) {
  return { ...s, T: new Float64Array(s.T), Tmax: new Float64Array(s.Tmax), brown: s.brown.slice(), sideTime: s.sideTime.slice() };
}

/** 팬 온도 동역학: 목표 온도로 수렴, 고기 올렸을 때 열 손실 */
export function stepPan(pan, dtSim, targetTemp, steakOn) {
  const tau = 38; // s
  pan.temp += (targetTemp - pan.temp) * (1 - Math.exp(-dtSim / tau));
  if (steakOn) pan.temp -= (pan.temp - 60) * 0.0032 * dtSim;
  return pan.temp;
}

/** 내부 온도 → 단면 색 (RGB) */
export function meatColorAt(t) {
  // 날것(진홍) → 레어(선홍) → 미디엄레어(분홍) → 미디엄(연분홍) → 웰던(회갈색)
  const stops = [
    [20, [150, 22, 34]],
    [46, [176, 30, 44]],
    [52, [205, 58, 66]],
    [57, [222, 104, 102]],
    [62, [214, 138, 124]],
    [67, [176, 126, 108]],
    [74, [146, 108, 88]],
    [90, [128, 94, 74]],
  ];
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i];
      const k = (t - a[0]) / (b[0] - a[0]);
      return [0, 1, 2].map((c) => Math.round(a[1][c] + (b[1][c] - a[1][c]) * k));
    }
  }
  return stops[stops.length - 1][1];
}

/** 갈변도 → 크러스트 색 (RGB) 및 불투명도 */
export function crustColor(b) {
  const stops = [
    [0.0, [150, 40, 46], 0],
    [0.15, [150, 98, 86], 0.55],
    [0.4, [168, 104, 58], 0.85],
    [0.75, [126, 60, 24], 0.95],
    [1.0, [98, 43, 15], 1],
    [1.35, [72, 32, 14], 1],
    [1.8, [34, 18, 10], 1],
    [3.0, [16, 10, 8], 1],
  ];
  if (b <= 0) return { rgb: stops[0][1], a: 0 };
  for (let i = 1; i < stops.length; i++) {
    if (b <= stops[i][0]) {
      const A = stops[i - 1], B = stops[i];
      const k = (b - A[0]) / (B[0] - A[0]);
      return { rgb: [0, 1, 2].map((c) => Math.round(A[1][c] + (B[1][c] - A[1][c]) * k)), a: A[2] + (B[2] - A[2]) * k };
    }
  }
  return { rgb: stops[stops.length - 1][1], a: 1 };
}
