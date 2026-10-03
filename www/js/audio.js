// 절차적 사운드 (외부 파일 없이 WebAudio로 합성)
let ctx = null, master = null, noiseBuf = null;
let sizzle = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function noise(dur, { type = 'bandpass', freq = 2000, q = 1, gain = 0.3, attack = 0.002, decay } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (decay || dur));
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}

function tone(freq, dur, { type = 'sine', gain = 0.2, slide = 0, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  slice() { noise(0.12, { type: 'highpass', freq: 3500, gain: 0.12, decay: 0.1 }); },
  membrane() { noise(0.18, { type: 'bandpass', freq: 5200, q: 3, gain: 0.1, decay: 0.16 }); },
  nick() { noise(0.15, { type: 'lowpass', freq: 600, gain: 0.25 }); tone(140, 0.12, { gain: 0.08 }); },
  crunch() {
    for (let i = 0; i < 4; i++) setTimeout(() => noise(0.05, { type: 'bandpass', freq: 1800 + Math.random() * 2500, q: 2, gain: 0.25, decay: 0.04 }), i * 18);
  },
  shaker(p = 1) { noise(0.06, { type: 'highpass', freq: 6000, gain: Math.min(0.2, 0.05 * p), decay: 0.05 }); },
  pour() { noise(0.25, { type: 'lowpass', freq: 500, gain: 0.12, decay: 0.22 }); tone(300 + Math.random() * 120, 0.08, { gain: 0.04, slide: 200 }); },
  whoosh() { noise(0.35, { type: 'bandpass', freq: 900, q: 0.7, gain: 0.25, attack: 0.08, decay: 0.33 }); },
  splat() { noise(0.25, { type: 'lowpass', freq: 900, gain: 0.45, decay: 0.2 }); noise(0.6, { type: 'highpass', freq: 4000, gain: 0.25, decay: 0.55 }); },
  pop() { tone(660, 0.08, { type: 'triangle', gain: 0.12, slide: 300 }); },
  place() { tone(420, 0.07, { type: 'sine', gain: 0.12, slide: -120 }); },
  ding() { tone(1046, 0.6, { gain: 0.15 }); tone(1568, 0.6, { gain: 0.08, delay: 0.08 }); },
  fail() { tone(220, 0.3, { type: 'sawtooth', gain: 0.06, slide: -80 }); },
  tick() { tone(1800, 0.03, { type: 'square', gain: 0.03 }); },
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, { type: 'triangle', gain: 0.12, delay: i * 0.11 })); },
  chew() { noise(0.12, { type: 'lowpass', freq: 400, gain: 0.15 }); },
};

/** 지글지글 루프: level 0~1 */
export function setSizzle(level) {
  if (!ctx) return;
  if (!sizzle) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 6000; pk.gain.value = 6;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(hp); hp.connect(pk); pk.connect(g); g.connect(master);
    src.start();
    sizzle = { g, level: 0 };
  }
  sizzle.level = level;
  const jitter = level > 0.02 ? (0.75 + Math.random() * 0.5) : 1;
  sizzle.g.gain.setTargetAtTime(level * 0.22 * jitter, ctx.currentTime, 0.05);
  // 기름 튀는 소리
  if (level > 0.1 && Math.random() < level * 0.25) noise(0.03, { type: 'highpass', freq: 3000 + Math.random() * 4000, gain: 0.15 * level, decay: 0.025 });
}

export function haptic(kind = 'light') {
  try {
    const C = window.Capacitor;
    if (C && C.nativePromise && (C.PluginHeaders || []).some((h) => h.name === 'Haptics')) {
      C.nativePromise('Haptics', 'impact', { style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' }).catch(() => {});
      return;
    }
  } catch (e) { /* 무시 */ }
  if (navigator.vibrate) navigator.vibrate(kind === 'heavy' ? 40 : kind === 'medium' ? 20 : 8);
}
