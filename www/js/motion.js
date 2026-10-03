// 휴대폰 흔들기/뒤집기(플릭) 감지. DeviceMotion이 없으면 터치 스와이프로 대체.
const listeners = new Set();
export const motion = {
  available: false,     // 실제 모션 이벤트를 받은 적 있는가
  permission: 'unknown',
  linear: { x: 0, y: 0, z: 0 },
  mag: 0,               // 중력 제외 가속도 크기 (m/s²)
  rot: 0,               // 회전 속도 크기 (deg/s)
  shakePower: 0,        // 최근 흔들기 세기(감쇠)
  swirlPower: 0,        // 최근 휘휘 돌리기 세기
  lastEventAt: 0,
};

let grav = { x: 0, y: 0, z: 0 };
let flick = null; // 진행 중인 플릭 측정 {peak, t0, up}
let flickCooldown = 0;

export function onMotion(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(ev) { for (const fn of listeners) fn(ev); }

export async function requestMotionPermission() {
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const r = await DeviceMotionEvent.requestPermission();
      motion.permission = r;
    } else {
      motion.permission = 'granted';
    }
  } catch (e) {
    motion.permission = 'denied';
  }
  return motion.permission;
}

function handle(e) {
  const now = performance.now();
  let lx, ly, lz;
  const a = e.acceleration;
  const ag = e.accelerationIncludingGravity;
  if (a && a.x != null && (a.x !== 0 || a.y !== 0 || a.z !== 0)) {
    lx = a.x; ly = a.y; lz = a.z || 0;
  } else if (ag && ag.x != null) {
    // 저역통과로 중력 추정 후 제거
    const k = 0.9;
    grav.x = grav.x * k + ag.x * (1 - k);
    grav.y = grav.y * k + ag.y * (1 - k);
    grav.z = grav.z * k + (ag.z || 0) * (1 - k);
    lx = ag.x - grav.x; ly = ag.y - grav.y; lz = (ag.z || 0) - grav.z;
  } else return;
  if (!isFinite(lx) || !isFinite(ly) || !isFinite(lz)) return;
  motion.available = true;
  motion.lastEventAt = now;
  motion.linear.x = lx; motion.linear.y = ly; motion.linear.z = lz;
  const mag = Math.hypot(lx, ly, lz);
  motion.mag = mag;
  const rr = e.rotationRate;
  motion.rot = rr ? Math.hypot(rr.alpha || 0, rr.beta || 0, rr.gamma || 0) : 0;
  feedShake(mag, now);
  feedSwirl(motion.rot);
  feedFlick(mag, ly, lz, now);
}

/** 흔들기: 임계값을 넘는 가속도만큼 세기로 누적 */
export function feedShake(mag, now = performance.now()) {
  const over = Math.max(0, mag - 5);
  if (over > 0) {
    motion.shakePower = Math.max(motion.shakePower, over);
    emit({ type: 'shake', power: over, t: now });
  }
}

export function feedSwirl(rot) {
  const over = Math.max(0, rot - 120);
  if (over > 0) {
    motion.swirlPower = Math.max(motion.swirlPower, over / 40);
    emit({ type: 'swirl', power: over / 40 });
  }
}

/** 플릭(팬 뒤집기): 순간 가속도 피크를 측정해 한 번의 동작으로 보고 */
function feedFlick(mag, ly, lz, now) {
  if (now < flickCooldown) return;
  if (!flick) {
    if (mag > 9) flick = { peak: mag, t0: now, up: Math.max(ly, 0) + Math.abs(lz) * 0.6 };
    return;
  }
  if (mag > flick.peak) flick.peak = mag;
  if (now - flick.t0 > 260) {
    emit({ type: 'flick', power: flick.peak, source: 'motion' });
    flick = null;
    flickCooldown = now + 650;
  }
}

/** 터치 스와이프로 플릭 흉내: 속도(px/s)를 가속도 스케일로 변환 */
export function emitSwipeFlick(speedPxPerSec, scale = 1) {
  const power = speedPxPerSec / (95 * scale);
  emit({ type: 'flick', power, source: 'touch' });
}

export function decayMotion(dt) {
  motion.shakePower *= Math.exp(-dt * 6);
  motion.swirlPower *= Math.exp(-dt * 5);
}

export function startMotion() {
  if (typeof window === 'undefined') return;
  window.addEventListener('devicemotion', handle, { passive: true });
}
