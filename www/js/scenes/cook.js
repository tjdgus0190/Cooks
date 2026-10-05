// 4단계: 굽기 — 불 조절, 휴대폰을 위로 튕겨 뒤집기, 중심 온도 관리
import { drawCounter, drawStoveAndPan, drawSteam } from '../art.js';
import { drawSteakTop, drawSteakShadow, SHAPE_PATH, STEAK_BOUNDS } from '../meat.js';
import { sfx, haptic, setSizzle } from '../audio.js';
import { onMotion, emitSwipeFlick, motion } from '../motion.js';
import { createSteak, stepSteak, flipSteak, stepPan, coreTemp, cloneSteak, restSteak, coreMax, donenessOf, HEAT_LEVELS, TIME_SCALE, crustColor, TARGETS } from '../sim.js';
import { diff } from '../difficulty.js';
import { clamp, TAU, lerp } from '../geom.js';

// 뒤집기 세기 허용 범위 (난이도에 따라 달라짐)
export const FLIP = {
  get min() { return diff.flip.min; }, get perfectLo() { return diff.flip.perfectLo; },
  get perfectHi() { return diff.flip.perfectHi; }, get max() { return diff.flip.max; },
};
const HEATS = [{ key: 'low', label: '약불' }, { key: 'mid', label: '중불' }, { key: 'high', label: '강불' }];

export class CookScene {
  constructor(game) {
    this.game = game;
    this.thick = game.state.dish?.thick || 28;
    this.sim = createSteak({ thicknessMm: this.thick, startTemp: 16 });
    this.pan = { temp: 222 };
    this.heat = 'high';
    this.active = false;
    this.placed = 0;        // 고기 내려놓는 애니메이션 0~1
    this.air = null;        // 뒤집기 공중 애니메이션
    this.folded = false;
    this.foldTime = 0;
    this.flips = 0; this.goodFlips = 0; this.perfectFlips = 0; this.folds = 0;
    this.probes = diff.guide ? 99 : 3; this.probeShow = 0; this.probeVal = 0;
    this.steam = []; this.splat = []; this.smoke = [];
    this.gauge = null;
    this.done = false;
    this.jitter = 0;
    this.pos = { x: 0, y: 0, r: -0.08 };
    this.swipe = null;
    const st = game.state;
    this.season = st.season || { grains: [], oilDrops: [], oil: 0 };
    this.trim = st.trim || {};
  }

  enter() {
    const { ui } = this.game;
    const hints = this.game.state.customer.hints;
    this.game.instruct({
      icon: '🍳',
      title: '굽기',
      lines: [
        '팬을 튕기듯 휴대폰을 <b>위로 휙!</b> 올리면 고기가 뒤집혀요. (화면을 위로 빠르게 쓸어올려도 돼요)',
        '<b>너무 약하거나 너무 세면</b> 고기가 접혀요. 접히면 고기를 탭해서 펴세요.',
        '겉은 <b>노릇한 갈색</b>이 될 때까지, 속은 주문한 굽기까지! 옆면 색이 익어 올라오는 걸 보세요.',
        diff.guide ? '🌡️ 아래 <b>속 온도</b> 게이지를 보고, 목표 구간에 들어오면 <b>꺼내기</b>! (꺼낸 뒤에도 잔열로 5~8℃ 더 익어요)' : `🌡️ 온도계는 ${this.probes}번 쓸 수 있어요. 꺼낸 뒤에도 <b>잔열로 5~8℃</b> 더 익어요.`,
      ],
    }).then(() => { this.active = true; });
    this.heatSeg = ui.addSegment(HEATS, this.heat, (k) => { this.heat = k; sfx.pop(); });
    this.probeBtn = ui.addButton(diff.guide ? '🌡️' : `🌡️ ${this.probes}`, () => this.probe(), 'secondary small');
    ui.addButton('꺼내기 🍽️', () => this.finish());
    this.panMeter = ui.addMeter('팬 온도');
    if (hints) { this.downMeter = ui.addMeter('아랫면 색', { zone: [0.85 / 2, 1.35 / 2] }); }
    if (diff.guide) {
      // 속 온도 게이지: 잔열을 감안해 목표보다 약 6℃ 낮을 때 꺼내는 구간
      const tgt = TARGETS[this.game.state.customer.order] || TARGETS['medium-rare'];
      this.pullAt = tgt.ideal - 6;
      this.coreMeter = ui.addMeter(`속 온도 (${tgt.name})`, { zone: [(this.pullAt - 2 - 20) / 60, (this.pullAt + 2 - 20) / 60] });
    }
    this.off = onMotion((ev) => { if (ev.type === 'flick') this.flick(ev.power, ev.source); });
  }

  exit() { this.off?.(); setSizzle(0); }

  layout() {
    const { W, H, S } = this.game;
    const r = Math.min(W * 0.44, H * 0.25);
    return { cx: W / 2, cy: H * 0.55, r, k: (r * 1.5) / 250 };
  }

  flick(power, source) {
    if (!this.active || this.done || this.air || this.placed < 1) return;
    if (this.folded) { this.game.ui.toast('먼저 고기를 펴세요!', { bad: true, sub: '고기를 탭' }); return; }
    let outcome;
    if (power < FLIP.min) outcome = 'weak';
    else if (power > FLIP.max) outcome = 'strong';
    else outcome = power >= FLIP.perfectLo && power <= FLIP.perfectHi ? 'perfect' : 'good';
    const dur = outcome === 'weak' ? 0.42 : outcome === 'strong' ? 0.85 : 0.62;
    const turns = outcome === 'weak' ? 0 : outcome === 'strong' ? 3 : 1; // 반 바퀴 단위
    const height = outcome === 'weak' ? 0.35 : outcome === 'strong' ? 1.6 : 1;
    this.air = { t: 0, dur, turns, height, outcome, power };
    this.gauge = { power, t: 0, outcome };
    this.flips++;
    sfx.whoosh(); haptic('medium');
  }

  land() {
    const a = this.air;
    this.air = null;
    if (a.outcome === 'weak') {
      this.folded = true; this.folds++;
      this.game.ui.toast('너무 약해요!', { bad: true, sub: '뒤집히다 접혔어요 — 탭해서 펴기' });
    } else if (a.outcome === 'strong') {
      flipSteak(this.sim);
      this.folded = true; this.folds++;
      this.pos.x = (Math.random() - 0.5) * 30; this.pos.y = (Math.random() - 0.5) * 20;
      this.game.ui.toast('너무 세요!', { bad: true, sub: '고기가 접혀 떨어졌어요 — 탭해서 펴기' });
      for (let i = 0; i < 40; i++) this.addSplat(2.2);
    } else {
      flipSteak(this.sim);
      this.goodFlips++;
      if (a.outcome === 'perfect') { this.perfectFlips++; this.game.ui.toast('완벽한 플립!'); }
      else this.game.ui.toast('뒤집기 성공');
    }
    this.pos.r += (Math.random() - 0.5) * 0.25;
    sfx.splat(); haptic('heavy');
    for (let i = 0; i < 18; i++) this.addSplat(1);
    for (let i = 0; i < 10; i++) this.addSteam(1.6);
  }

  probe() {
    if (this.probes <= 0 || this.done || !this.active) return;
    this.probes--;
    this.probeVal = coreTemp(this.sim);
    this.probeShow = 2.6;
    if (!diff.guide) this.probeBtn.innerHTML = `🌡️ ${this.probes}`;
    if (this.probes === 0) this.probeBtn.disabled = true;
    sfx.pop();
  }

  down(p) {
    if (!this.active || this.done) return;
    const { cx, cy, k } = this.layout();
    if (this.folded) {
      const d = Math.hypot(p.x - (cx + this.pos.x * k), p.y - (cy + this.pos.y * k));
      if (d < 140 * k) { this.folded = false; sfx.place(); haptic('light'); this.game.ui.toast('펴기 완료'); return; }
    }
    this.swipe = { x: p.x, y: p.y, t: p.t, maxV: 0, lx: p.x, ly: p.y, lt: p.t };
  }
  move(p) {
    const s = this.swipe;
    if (!s) return;
    const dt = Math.max(1, p.t - s.lt) / 1000;
    const vy = -(p.y - s.ly) / dt;
    if (vy > s.maxV) s.maxV = vy;
    s.lx = p.x; s.ly = p.y; s.lt = p.t;
  }
  up(p) {
    const s = this.swipe;
    this.swipe = null;
    if (!s) return;
    const dy = s.y - p.y, dur = Math.max(1, p.t - s.t);
    if (dy > 50 * this.game.S && dur < 450) {
      const avg = dy / (dur / 1000);
      emitSwipeFlick(Math.max(avg, s.maxV * 0.7), this.game.S);
    }
  }
  cancelPointer() { this.swipe = null; }

  addSteam(m = 1) {
    this.steam.push({ x: (Math.random() - 0.5) * 200, y: (Math.random() - 0.5) * 120, r: 18 + Math.random() * 25, vy: -(30 + Math.random() * 40) * m, vx: (Math.random() - 0.5) * 10, life: 1, alpha: 0.14 + Math.random() * 0.1 });
  }
  addSplat(m = 1) {
    const a = Math.random() * TAU, d = 110 + Math.random() * 40;
    this.splat.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.75, vx: Math.cos(a) * (60 + Math.random() * 120) * m, vy: Math.sin(a) * (60 + Math.random() * 120) * m - 50, life: 0.5 + Math.random() * 0.4 });
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.off?.();
    setSizzle(0);
    const s = this.sim;
    const rested = cloneSteak(s);
    restSteak(rested, 90);
    const up = 1 - s.down; // 팬에서 꺼낼 때 위를 향한 면
    // 플레이팅 시에는 더 예쁘게 구워진 면을 위로
    const pretty = Math.abs(s.brown[0] - 1.1) < Math.abs(s.brown[1] - 1.1) ? 0 : 1;
    // Tmax 배열은 현재 '아래=0' 기준. 보여줄 면이 아래면 뒤집어 준다
    let Tmax = Array.from(rested.Tmax);
    if (pretty === s.down) Tmax = Tmax.reverse();
    // 내부 배열 기준: index 0 = 아랫면, 마지막 = 윗면(보여주는 면)
    this.game.state.cook = {
      thick: this.thick,
      Tmax: Float64Array.from(Tmax),
      core: coreMax(rested),
      coreAtRemoval: coreTemp(s),
      brown: s.brown.slice(),
      up: pretty,
      flips: this.flips, goodFlips: this.goodFlips, perfectFlips: this.perfectFlips, folds: this.folds,
      foldTime: this.foldTime,
      sideTime: s.sideTime.slice(),
      simTime: s.simTime,
      // 시즈닝/손질 흔적은 처음 위를 향했던 면(1)에 남는다
      grains: this.season.grains, oilDrops: this.season.oilDrops,
      pepperOnly: this.season.grains.filter((g) => g.type === 'pepper').slice(0, 60),
      mems: this.trim.mems, scars: this.trim.scars,
    };
    this.game.ui.toast('레스팅 중…', { sub: '육즙이 고루 퍼지는 중' });
    setTimeout(() => this.game.nextStage(), 1100);
  }

  update(dt) {
    const s = this.sim;
    if (this.placed < 1 && this.active) {
      this.placed = Math.min(1, this.placed + dt * 2.5);
      if (this.placed >= 1) { sfx.splat(); haptic('medium'); for (let i = 0; i < 14; i++) this.addSplat(1); }
    }
    const inPan = this.placed >= 1 && !this.air && !this.done;
    const simDt = this.active && !this.done && !this.game.timer.paused ? dt * TIME_SCALE * (this.game.state.quick ? 1.6 : 1) : 0;
    if (simDt > 0) {
      stepPan(this.pan, simDt, HEAT_LEVELS[this.heat], inPan);
      if (inPan) {
        const contact = this.folded ? 0.5 : 1;
        stepSteak(s, simDt, this.pan.temp, contact);
        if (this.folded) this.foldTime += dt;
      } else if (this.air) {
        stepSteak(s, simDt, this.pan.temp, 0);
      }
    }
    if (this.air) {
      this.air.t += dt;
      if (this.air.t >= this.air.dur) this.land();
    }
    if (this.gauge) { this.gauge.t += dt; if (this.gauge.t > 1.6) this.gauge = null; }
    this.probeShow = Math.max(0, this.probeShow - dt);
    // 효과
    const heatLvl = clamp((this.pan.temp - 120) / 130, 0, 1);
    const sizzle = inPan ? heatLvl * (this.folded ? 0.7 : 1) : this.air ? 0.15 : 0;
    if (!this.done) setSizzle(this.game.timer.paused ? 0 : sizzle);
    if (inPan && Math.random() < dt * (4 + heatLvl * 14)) this.addSteam(1);
    if (inPan && Math.random() < dt * heatLvl * heatLvl * 30) this.addSplat(1);
    const burning = s.brown[s.down] > 1.45 && this.pan.temp > 200;
    if (inPan && burning && Math.random() < dt * 12) this.smoke.push({ x: (Math.random() - 0.5) * 160, y: (Math.random() - 0.5) * 80, r: 25, vy: -50, vx: 0, life: 1, alpha: 0.25 });
    for (const p of this.steam) { p.y += p.vy * dt; p.x += p.vx * dt; p.r += dt * 18; p.life -= dt * 0.7; }
    for (const p of this.smoke) { p.y += p.vy * dt; p.r += dt * 30; p.life -= dt * 0.45; }
    for (const p of this.splat) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.life -= dt; }
    this.steam = this.steam.filter((p) => p.life > 0).slice(-80);
    this.smoke = this.smoke.filter((p) => p.life > 0).slice(-50);
    this.splat = this.splat.filter((p) => p.life > 0).slice(-120);
    // HUD
    this.panMeter.set(this.pan.temp / 280, `${Math.round(this.pan.temp)}℃`);
    const downB = s.brown[s.down];
    if (this.coreMeter) { const ct = coreTemp(s); this.coreMeter.set(clamp((ct - 20) / 60, 0, 1), `${Math.round(ct)}℃`); }
    if (this.downMeter) this.downMeter.set(downB / 2, downB < 0.3 ? '날것' : downB < 0.85 ? '연갈색' : downB < 1.35 ? '노릇노릇' : downB < 1.7 ? '진함' : '탐!');
    if (this.active && !this.done) {
      const hints = this.game.state.customer.hints;
      let hint = '';
      if (this.folded) hint = '고기가 접혔어요! 고기를 탭해서 펴세요';
      else if (burning) hint = '타는 냄새가 나요! 뒤집거나 불을 줄이세요';
      else if (this.pullAt && coreTemp(s) >= this.pullAt - 2) hint = coreTemp(s) > this.pullAt + 3 ? '너무 익고 있어요! 지금 바로 꺼내기 🍽️' : '속 온도 딱 좋아요 — 꺼내기 🍽️ 를 누르세요!';
      else if (hints && downB > 0.9 && downB < 1.4) hint = '아랫면이 노릇해졌어요 — 휴대폰을 위로 휙! 뒤집기';
      else if (hints) hint = '옆면이 익어 올라오는 색을 보며 뒤집어요';
      else hint = '휴대폰을 위로 휙! 올려 뒤집기';
      this.game.ui.setHint(hint);
    }
  }

  draw(g) {
    const { W, H, S, dpr, tex, time } = this.game;
    drawCounter(g, W, H, dpr);
    const { cx, cy, r, k } = this.layout();
    const heatK = { low: 0.35, mid: 0.65, high: 1 }[this.heat];
    drawStoveAndPan(g, cx, cy, r, this.done ? 0 : heatK, time, dpr, this.pan.temp);
    const s = this.sim;
    // 고기
    g.save();
    let lift = 0, angle = 0, scale = 1;
    if (this.placed < 1) { lift = (1 - this.placed) * 120; scale = 1 + (1 - this.placed) * 0.25; }
    if (this.air) {
      const u = this.air.t / this.air.dur;
      lift = Math.sin(u * Math.PI) * 140 * this.air.height;
      angle = this.air.outcome === 'weak' ? Math.sin(u * Math.PI) * Math.PI * 0.45 : u * Math.PI * this.air.turns;
      scale = 1 + Math.sin(u * Math.PI) * 0.18 * this.air.height;
    }
    const jit = Math.sin(time * 60) * 0.4 * (this.pan.temp > 180 ? 1 : 0);
    // 그림자
    g.save();
    g.translate(cx + this.pos.x * k, cy + this.pos.y * k + 6);
    g.rotate(this.pos.r);
    g.scale(k * (1 - lift / 600), k * (1 - lift / 600) * 0.95);
    drawSteakShadow(g, tex, 2, 6, Math.max(0.15, 0.8 - lift / 300));
    g.restore();
    g.translate(cx + this.pos.x * k, cy + this.pos.y * k - lift * S + jit * (lift ? 0 : 1));
    g.rotate(this.pos.r);
    g.scale(k * scale, k * scale);
    // 뒤집히는 중: 세로 압축 + 보이는 면 전환
    const cosA = Math.cos(angle);
    const showDown = cosA < 0;
    g.scale(1, Math.max(0.04, Math.abs(cosA)));
    const upFace = showDown ? s.down : 1 - s.down;
    const downFace = showDown ? 1 - s.down : s.down;
    const opts = this.faceOpts(upFace);
    opts.side = { Tmax: showDown ? Float64Array.from(s.Tmax).reverse() : s.Tmax, brownDown: s.brown[downFace], thickPx: this.air ? 4 : 9 };
    if (this.folded) this.drawFolded(g, opts, downFace);
    else drawSteakTop(g, tex, opts);
    // 육즙 방울 (중심 온도가 오르면 윗면에 맺힘)
    if (!this.air && !this.folded) this.drawJuice(g, coreTemp(s));
    g.restore();
    // 파티클
    g.save(); g.translate(cx, cy); g.scale(k, k);
    for (const p of this.splat) {
      g.fillStyle = `rgba(255,236,170,${clamp(p.life * 2, 0, 1)})`;
      g.beginPath(); g.arc(p.x, p.y, 1.6, 0, TAU); g.fill();
    }
    drawSteam(g, this.steam);
    for (const p of this.smoke) {
      const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      gr.addColorStop(0, `rgba(70,64,60,${p.life * p.alpha})`); gr.addColorStop(1, 'rgba(70,64,60,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
    }
    g.restore();
    if (this.probeShow > 0) this.drawProbe(g);
    if (this.gauge) this.drawGauge(g);
  }

  faceOpts(face) {
    const s = this.sim;
    const isTop = face === 1; // 시즈닝·손질한 면
    return {
      brown: s.brown[face],
      grains: isTop ? this.season.grains : null,
      oilDrops: isTop && s.brown[face] < 0.2 ? this.season.oilDrops : null,
      mems: isTop ? this.trim.mems : null,
      scars: isTop ? this.trim.scars : null,
      oil: this.season.oil + 4,
      glossMul: 1.1,
    };
  }

  drawFolded(g, opts, downFace) {
    const { tex } = this.game;
    // 왼쪽 절반은 그대로, 오른쪽 절반은 접혀서 뒷면이 보임
    g.save();
    g.beginPath(); g.rect(STEAK_BOUNDS.x0, STEAK_BOUNDS.y0, -STEAK_BOUNDS.x0 + 10, STEAK_BOUNDS.h); g.clip();
    drawSteakTop(g, tex, opts);
    g.restore();
    g.save();
    g.translate(10, 0);
    g.scale(-0.92, 1);
    g.translate(-10, -6);
    g.beginPath(); g.rect(10, STEAK_BOUNDS.y0, 140, STEAK_BOUNDS.h); g.clip();
    drawSteakShadow(g, tex, 0, 4, 0.8);
    drawSteakTop(g, tex, { ...this.faceOpts(downFace), side: null, sideThick: 10 });
    g.restore();
    g.fillStyle = 'rgba(30,8,0,0.35)';
    g.fillRect(4, STEAK_BOUNDS.y0 + 20, 8, STEAK_BOUNDS.h - 40);
  }

  drawJuice(g, core) {
    const n = Math.floor(clamp((core - 44) / 2, 0, 18));
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996, d = 20 + ((i * 37) % 70);
      const x = Math.cos(a) * d * 1.3, y = Math.sin(a) * d * 0.8;
      const r = 1.6 + (i % 3) * 0.7;
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,230,210,0.95)'); gr.addColorStop(0.4, 'rgba(190,60,50,0.7)'); gr.addColorStop(1, 'rgba(120,20,20,0.2)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  }

  drawProbe(g) {
    const { W, H, S } = this.game;
    const v = this.probeVal;
    const d = donenessOf(v);
    const x = W / 2, y = H * 0.27;
    g.save();
    g.globalAlpha = clamp(this.probeShow * 2, 0, 1);
    g.fillStyle = 'rgba(20,10,5,0.85)';
    const w = 200 * S, h = 64 * S;
    g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - h / 2, w, h, 16 * S) : g.rect(x - w / 2, y - h / 2, w, h); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = `800 ${26 * S}px sans-serif`;
    g.fillText(`🌡️ ${v.toFixed(1)}℃`, x, y + 2 * S);
    g.font = `700 ${13 * S}px sans-serif`; g.fillStyle = '#ffc35a';
    g.fillText(`지금 중심: ${d.name}`, x, y + 22 * S);
    g.restore();
  }

  drawGauge(g) {
    const { W, H, S } = this.game;
    const gg = this.gauge;
    const x0 = W * 0.12, x1 = W * 0.88, y = H * 0.83;
    const maxP = 36;
    const px = (p) => x0 + (x1 - x0) * clamp(p / maxP, 0, 1);
    g.save();
    g.globalAlpha = clamp((1.6 - gg.t) * 2, 0, 1);
    g.fillStyle = 'rgba(20,10,5,0.8)';
    g.fillRect(x0 - 8, y - 22 * S, x1 - x0 + 16, 44 * S);
    g.fillStyle = '#c0392b'; g.fillRect(x0, y - 6 * S, px(FLIP.min) - x0, 12 * S);
    g.fillStyle = '#7ed67a'; g.fillRect(px(FLIP.min), y - 6 * S, px(FLIP.max) - px(FLIP.min), 12 * S);
    g.fillStyle = '#ffd25a'; g.fillRect(px(FLIP.perfectLo), y - 6 * S, px(FLIP.perfectHi) - px(FLIP.perfectLo), 12 * S);
    g.fillStyle = '#c0392b'; g.fillRect(px(FLIP.max), y - 6 * S, x1 - px(FLIP.max), 12 * S);
    const mx = px(gg.power);
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(mx, y - 8 * S); g.lineTo(mx - 7 * S, y - 18 * S); g.lineTo(mx + 7 * S, y - 18 * S); g.fill();
    g.font = `700 ${11 * S}px sans-serif`; g.textAlign = 'center'; g.fillStyle = '#fff';
    g.fillText('약함', (x0 + px(FLIP.min)) / 2, y + 18 * S);
    g.fillText('딱 좋음', (px(FLIP.min) + px(FLIP.max)) / 2, y + 18 * S);
    g.fillText('셈', (px(FLIP.max) + x1) / 2, y + 18 * S);
    g.restore();
  }
}
