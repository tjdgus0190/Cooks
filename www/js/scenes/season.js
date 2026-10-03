// 3단계: 시즈닝 — 휴대폰을 흔들어 소금·후추, 흔들거나 휘휘 돌려 올리브오일
import { drawCounter, drawBoard, drawShaker } from '../art.js';
import { drawSteakTop, drawSteakShadow, insideSteak, SHAPE, drawGrains } from '../meat.js';
import { seasonTarget } from '../subjects.js';
import { sfx, haptic } from '../audio.js';
import { onMotion, motion, feedShake } from '../motion.js';
import { clamp, TAU, polyBounds, pointInPoly } from '../geom.js';

import { SEASON_TARGET } from '../score.js';
const GRAIN_G = { salt: 0.006, pepper: 0.004 };
const DROP_ML = 0.25;
const TOOLS = [
  { key: 'salt', label: '🧂 소금', unit: 'g' },
  { key: 'pepper', label: '⚫ 후추', unit: 'g' },
  { key: 'oil', label: '🫒 오일', unit: 'ml' },
];

export class SeasonScene {
  constructor(game) {
    this.game = game;
    this.tool = 'salt';
    this.amount = { salt: 0, pepper: 0, oil: 0 };
    this.grains = [];
    this.boardGrains = [];
    this.oilDrops = [];
    this.falling = [];
    this.aimX = 0;           // 로컬 mm
    this.active = false;
    this.done = false;
    this.wiggle = 0;
    this.sndT = 0;
    this.lastPtr = null;
    this.noMotionTime = 0;
    const trim = game.state.trim || {};
    this.mems = trim.mems; this.scars = trim.scars;
    const step = game.state.stepCfg || {};
    this.kind = step.subject || 'steak';
    this.TOOLS = TOOLS.filter((t) => (step.tools || ['salt', 'pepper', 'oil']).includes(t.key));
    this.alt = seasonTarget(this.kind);       // 새우/랍스터
    this.saltScale = { shrimp: 0.5, lobster: 0.8 }[this.kind] || 1;
  }

  enter() {
    const { ui } = this.game;
    this.game.instruct({
      icon: '🧂',
      title: this.game.state.stepCfg?.name || '시즈닝',
      lines: [
        '휴대폰을 <b>흔들면</b> 소금·후추가 뿌려져요. <b>세게·빠르게</b> 흔들수록 많이 나와요!',
        '올리브오일은 흔들거나 휴대폰을 <b>휘휘 돌려서</b> 뿌려요.',
        '화면을 좌우로 끌면 양념통이 움직여요. <b>고르게</b> 뿌려야 맛있어요.',
        '센서가 없으면 화면을 빠르게 좌우로 문질러도 돼요.',
      ],
    }).then(() => { this.active = true; });
    this.seg = ui.addSegment(this.TOOLS.map((t) => ({ key: t.key, label: t.label })), this.tool, (k) => this.setTool(k));
    ui.addButton('시즈닝 완료 ✓', () => this.finish());
    const hints = this.game.state.customer.hints;
    this.meters = {};
    for (const t of this.TOOLS) {
      const tgt = SEASON_TARGET[t.key] * (t.key === 'salt' ? this.saltTarget() / SEASON_TARGET.salt : 1);
      const zone = hints ? [(tgt * 0.8) / (tgt * 2), (tgt * 1.2) / (tgt * 2)] : null;
      this.meters[t.key] = { m: ui.addMeter(t.label, { zone }), max: tgt * 2 };
    }
    this.off = onMotion((ev) => this.onMotion(ev));
    this.setTool('salt');
  }

  exit() { this.off?.(); }

  saltTarget() { const st = this.game.state; return SEASON_TARGET.salt * st.customer.saltPref * (st.dish?.saltMul || 1) * (this.saltScale || 1); }

  unitCoverage() {
    // 새우 5마리 각각에 소금이 고루 닿았는지
    const pos = [[-70, -40], [5, -45], [78, -38], [-40, 40], [45, 42]];
    const hit = pos.filter(([x, y]) => this.grains.filter((g) => g.type === 'salt' && Math.hypot(g.x - x, g.y - y) < 32).length >= 3).length;
    return hit / pos.length;
  }

  setTool(k) {
    this.tool = k; this.seg?.select(k); sfx.pop();
    for (const t of this.TOOLS) this.meters[t.key].m.show(t.key === k);
    this.game.ui.setHint(k === 'oil' ? '휴대폰을 흔들거나 휘휘 돌려서 오일을 둘러요' : '휴대폰을 흔들어서 뿌려요! 세게 흔들수록 많이');
  }

  layout() {
    const { W, H, S } = this.game;
    return { cx: W / 2, cy: H * 0.57, k: S * 1.12, shakerY: H * 0.31 };
  }

  onMotion(ev) {
    if (!this.active || this.done) return;
    if (ev.type === 'shake') this.emit(ev.power);
    if (ev.type === 'swirl' && this.tool === 'oil') this.emit(ev.power * 0.8);
  }

  emit(power) {
    this.wiggle = Math.min(1.5, this.wiggle + power * 0.05);
    const now = performance.now();
    const { k } = this.layout();
    if (this.tool === 'oil') {
      this.oilAcc = (this.oilAcc || 0) + power * 0.05;
      while (this.oilAcc >= 1) {
        this.oilAcc -= 1;
        this.spawn('oil', power);
      }
      if (now - this.sndT > 180) { sfx.pour(); this.sndT = now; }
    } else {
      this.acc = (this.acc || 0) + power * 0.25;
      while (this.acc >= 1) { this.acc -= 1; this.spawn(this.tool, power); }
      if (now - this.sndT > 60) { sfx.shaker(power / 4); this.sndT = now; }
    }
    if (power > 12) haptic('light');
  }

  spawn(type, power) {
    const { cy, shakerY, k } = this.layout();
    const spread = 22 + Math.min(power, 25) * 1.6;
    const tx = this.aimX + (Math.random() - 0.5) * 2 * spread * (type === 'oil' ? 0.8 : 1);
    const ty = (Math.random() - 0.5) * 2 * (70 + Math.min(power, 25) * 1.2);
    const startY = (shakerY - cy) / k + (type === 'oil' ? 10 : 30);
    this.falling.push({ type, x: this.aimX + (Math.random() - 0.5) * 10, y: startY, tx, ty, t: 0, dur: 0.28 + Math.random() * 0.2, r: Math.random() * TAU, s: type === 'salt' ? 0.9 + Math.random() * 0.9 : 0.6 + Math.random() * 0.7 });
  }

  land(p) {
    const on = this.alt ? this.alt.inside(p.tx, p.ty) : insideSteak(p.tx, p.ty);
    if (p.type === 'oil') {
      if (on) { this.amount.oil += DROP_ML; if (this.oilDrops.length < 160) this.oilDrops.push({ x: p.tx, y: p.ty, r: 5 + Math.random() * 9, a: Math.random() * 3 }); }
      else if (this.boardGrains.length < 900) this.boardGrains.push({ type: 'oil', x: p.tx, y: p.ty, r: 4 + Math.random() * 6 });
      return;
    }
    const gr = { type: p.type, x: p.tx, y: p.ty, r: p.r, s: p.s };
    if (on) {
      this.amount[p.type] += GRAIN_G[p.type];
      if (this.grains.length < 2400) this.grains.push(gr);
    } else if (this.boardGrains.length < 900) this.boardGrains.push(gr);
  }

  down(p) { this.lastPtr = { x: p.x, y: p.y, vx: 0, t: p.t }; this.aimTo(p.x); }
  move(p) {
    this.aimTo(p.x);
    // 터치 문지르기 → 흔들기 대체 입력
    const lp = this.lastPtr;
    if (lp) {
      const dt = Math.max(1, p.t - lp.t) / 1000;
      const vx = (p.x - lp.x) / dt;
      if (Math.sign(vx) !== Math.sign(lp.vx) && Math.abs(lp.vx) > 500) feedShake(5 + Math.min(22, Math.abs(lp.vx) / 140));
      this.lastPtr = { x: p.x, y: p.y, vx: Math.abs(vx) > 40 ? vx : lp.vx, t: p.t };
    }
  }
  up() { this.lastPtr = null; }

  aimTo(x) {
    const { cx, k } = this.layout();
    this.aimX = clamp((x - cx) / k, -125, 125);
  }

  coverage() {
    if (this.kind === 'shrimp') return this.unitCoverage();
    if (this.kind === 'lobster') return Math.min(1, this.grains.filter((g) => g.type === 'salt').length / 60);
    // 고기 표면을 격자로 나눠 양념이 닿은 칸의 비율
    const b = polyBounds(SHAPE);
    const nx = 8, ny = 5;
    let cells = 0, hit = 0;
    const counts = new Map();
    for (const g of this.grains) {
      if (g.type !== 'salt') continue;
      const ix = Math.floor(((g.x - b.x0) / b.w) * nx), iy = Math.floor(((g.y - b.y0) / b.h) * ny);
      counts.set(ix + iy * nx, (counts.get(ix + iy * nx) || 0) + 1);
    }
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
      const x = b.x0 + ((ix + 0.5) / nx) * b.w, y = b.y0 + ((iy + 0.5) / ny) * b.h;
      if (!pointInPoly(x, y, SHAPE)) continue;
      cells++;
      if ((counts.get(ix + iy * nx) || 0) >= 3) hit++;
    }
    return cells ? hit / cells : 0;
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.off?.();
    const s = this.amount;
    this.game.state.season = { salt: s.salt, pepper: s.pepper, oil: s.oil, coverage: this.coverage(), grains: this.grains, oilDrops: this.oilDrops, tools: this.TOOLS.map((t) => t.key), saltScale: this.saltScale };
    const tgt = this.saltTarget();
    const r = s.salt / tgt;
    this.game.ui.toast(r < 0.5 ? '간이 너무 약해요…' : r > 1.7 ? '소금 폭탄!' : '좋은 간이에요', { bad: r < 0.5 || r > 1.7 });
    setTimeout(() => this.game.nextStage(), 900);
  }

  update(dt) {
    this.wiggle *= Math.exp(-dt * 5);
    for (const p of this.falling) p.t += dt;
    const landed = this.falling.filter((p) => p.t >= p.dur);
    for (const p of landed) this.land(p);
    if (landed.length) this.falling = this.falling.filter((p) => p.t < p.dur);
    for (const t of this.TOOLS) {
      const v = this.amount[t.key], M = this.meters[t.key];
      M.m.set(v / M.max, `${v.toFixed(1)}${t.unit}`);
    }
    if (this.active && !motion.available) {
      this.noMotionTime += dt;
      if (this.noMotionTime > 4 && this.amount[this.tool] === 0) this.game.ui.setHint('센서가 없나요? 화면을 좌우로 빠르게 문질러 흔들어요');
    }
  }

  draw(g) {
    const { W, H, S, dpr, tex, time } = this.game;
    drawCounter(g, W, H, dpr);
    const { cx, cy, k, shakerY } = this.layout();
    drawBoard(g, cx, cy, Math.min(W * 0.98, 380 * S), 360 * S, dpr);
    g.save();
    g.translate(cx, cy); g.scale(k, k);
    // 도마 위 흘린 양념
    for (const b of this.boardGrains) {
      if (b.type === 'oil') {
        g.fillStyle = 'rgba(210,180,60,0.18)'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill();
      } else {
        g.fillStyle = b.type === 'salt' ? 'rgba(255,255,255,0.85)' : 'rgba(30,22,16,0.9)';
        g.fillRect(b.x, b.y, b.s, b.s);
      }
    }
    if (this.alt) { this.alt.draw(g, {}); drawGrains(g, this.grains, 0); }
    else {
      drawSteakShadow(g, tex, 4, 10, 0.7);
      drawSteakTop(g, tex, { brown: 0, mems: this.mems, scars: this.scars, grains: this.grains, oilDrops: this.oilDrops, oil: this.amount.oil, sideThick: 8 });
    }
    // 떨어지는 알갱이
    for (const p of this.falling) {
      const u = p.t / p.dur;
      const x = p.x + (p.tx - p.x) * u, y = p.y + (p.ty - p.y) * u * u;
      if (p.type === 'oil') {
        g.fillStyle = 'rgba(220,190,70,0.85)';
        g.beginPath(); g.ellipse(x, y, 2.2, 4, 0, 0, TAU); g.fill();
      } else {
        g.fillStyle = p.type === 'salt' ? '#fff' : '#1c1410';
        g.fillRect(x, y, p.s, p.s);
      }
    }
    g.restore();
    // 양념통
    const sx = cx + this.aimX * k;
    const wig = Math.sin(time * 40) * this.wiggle;
    if (this.tool === 'oil') drawShaker(g, 'oil', sx + 57 * S, shakerY - 70 * S + wig * 6 * S, S * 0.85, -2.4 + wig * 0.2);
    else drawShaker(g, this.tool, sx, shakerY - 20 * S + wig * 10 * S, S * 0.85, wig * 0.25);
  }
}
