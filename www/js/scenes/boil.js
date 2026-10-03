// 면 삶기 / 랍스터 데치기 + 오븐(브로일) — 실제 조리 순서: 물 끓이기 → 소금 → 넣기 → 시간 맞춰 건지기
import { drawCounter, drawShaker, rr } from '../art.js';
import { drawLobster } from '../food.js';
import { sfx, haptic, setSizzle } from '../audio.js';
import { onMotion, feedShake, motion } from '../motion.js';
import { clamp, TAU, rng } from '../geom.js';

const SALT_PER_SHAKE = 0.06; // g

export class BoilScene {
  constructor(game) {
    this.game = game;
    const step = game.state.stepCfg || { item: 'spaghetti', pkgMin: 9 };
    this.item = step.item;
    this.pkgMin = step.pkgMin;
    this.pasta = this.item === 'spaghetti';
    this.saltTarget = this.pasta ? 20 : 30;  // 물 2L 기준 1% / 랍스터 1.5%
    this.salt = 0;
    this.phase = 'salt';
    this.minutes = 0;
    this.speed = game.state.quick ? 24 : 14; // 게임 1초 = n초(실제 조리)
    this.reserved = false;
    this.bubbles = [];
    this.grains = [];
    this.t = 0;
    this.done = false;
    this.lastPtr = null;
  }

  enter() {
    const ui = this.game.ui;
    this.game.instruct(this.pasta ? {
      icon: '🍝', title: '면 삶기',
      lines: ['끓는 물에 <b>소금</b>부터! 휴대폰을 흔들어 넣어요 (물 2L에 약 20g, 바닷물보다 조금 덜 짜게).', '면을 넣으면 타이머가 돌아요. 팬에서 마저 익히니까 <b>포장지 시간보다 1분 일찍</b> 건지는 게 알 덴테.', '건지기 전에 <b>면수 한 국자</b>를 꼭 떠두세요. 소스를 유화시키는 비밀 재료예요.'],
    } : {
      icon: '🦞', title: '랍스터 데치기',
      lines: ['소금을 넉넉히 넣은 끓는 물에 랍스터를 넣어요.', '테르미도르는 오븐에서 한 번 더 익히니까 <b>4분</b> 정도만 데쳐요.'],
    }).then(() => { this.active = true; });
    this.btn = ui.addButton('다음: 넣기 ▶', () => this.next());
    if (this.pasta) this.waterBtn = ui.addButton('🥄 면수 떠두기', () => this.reserve(), 'secondary small');
    if (this.waterBtn) this.waterBtn.disabled = true;
    this.saltMeter = ui.addMeter('🧂 소금', { zone: this.game.state.customer.hints ? [0.4, 0.6] : null });
    ui.setHint('휴대폰을 흔들어 소금을 넣어요');
    this.off = onMotion((ev) => { if (ev.type === 'shake' && this.phase === 'salt' && this.active) this.addSalt(ev.power); });
  }
  exit() { this.off?.(); setSizzle(0); }

  addSalt(p) {
    const n = Math.min(6, p * 0.3);
    this.salt += n * SALT_PER_SHAKE * 3;
    for (let i = 0; i < n; i++) this.grains.push({ x: (Math.random() - 0.5) * 60, y: -140, vy: 200 + Math.random() * 80, life: 1 });
    if (Math.random() < 0.3) sfx.shaker(p / 4);
  }

  down(p) { this.lastPtr = { x: p.x, vx: 0, t: p.t }; }
  move(p) {
    const lp = this.lastPtr; if (!lp) return;
    const vx = (p.x - lp.x) / Math.max(0.001, (p.t - lp.t) / 1000);
    if (Math.sign(vx) !== Math.sign(lp.vx) && Math.abs(lp.vx) > 500) feedShake(5 + Math.min(22, Math.abs(lp.vx) / 140));
    this.lastPtr = { x: p.x, vx: Math.abs(vx) > 40 ? vx : lp.vx, t: p.t };
  }
  up() { this.lastPtr = null; }

  next() {
    if (!this.active || this.done) return;
    if (this.phase === 'salt') {
      this.phase = 'cooking'; sfx.splat(); haptic('medium');
      this.btn.innerHTML = '건지기 ⏏';
      if (this.waterBtn) this.waterBtn.disabled = false;
      this.game.ui.setHint(this.pasta ? `포장지 조리시간 ${this.pkgMin}분 — 알 덴테는 1분 일찍!` : `${this.pkgMin}분 정도 데쳐요`);
    } else if (this.phase === 'cooking') this.finish();
  }

  reserve() {
    if (!this.pasta || this.reserved || this.phase !== 'cooking') return;
    this.reserved = true; sfx.pour();
    this.waterBtn.innerHTML = '🥄 면수 ✓'; this.waterBtn.disabled = true;
    this.game.ui.toast('면수 확보!', { ms: 700 });
  }

  finish() {
    this.done = true;
    this.game.state.boil = { item: this.item, salt: this.salt, saltTarget: this.saltTarget, minutes: this.minutes, pkgMin: this.pkgMin, reserved: this.reserved };
    const ideal = this.pasta ? this.pkgMin - 1 : this.pkgMin;
    const d = this.minutes - ideal;
    this.game.ui.toast(Math.abs(d) < 0.8 ? (this.pasta ? '완벽한 알 덴테!' : '딱 좋게 데쳤어요') : d < 0 ? '좀 덜 익었어요' : '좀 퍼졌어요', { bad: Math.abs(d) > 1.5 });
    sfx.pour();
    setTimeout(() => this.game.nextStage(), 800);
  }

  update(dt) {
    this.t += dt;
    if (this.active && this.phase === 'cooking' && !this.done) {
      this.minutes += (dt * this.speed) / 60;
      setSizzle(0.12);
    }
    const boil = this.phase === 'cooking' ? 1 : 0.7;
    if (Math.random() < dt * 40 * boil) this.bubbles.push({ x: (Math.random() - 0.5) * 200, y: (Math.random() - 0.5) * 200, r: 0, max: 3 + Math.random() * 8, life: 1 });
    for (const b of this.bubbles) { b.r += dt * 20; b.life -= dt * 2; }
    this.bubbles = this.bubbles.filter((b) => b.life > 0 && b.r < b.max);
    for (const gr of this.grains) { gr.y += gr.vy * dt; if (gr.y > 0) gr.life = 0; }
    this.grains = this.grains.filter((g) => g.life > 0);
    this.saltMeter.set(this.salt / (this.saltTarget * 2), `${this.salt.toFixed(0)}g`);
  }

  draw(g) {
    const { W, H, S, dpr } = this.game;
    drawCounter(g, W, H, dpr);
    const cx = W / 2, cy = H * 0.5, k = S * 1.25;
    g.save(); g.translate(cx, cy); g.scale(k, k);
    // 화구 불빛
    const fl = g.createRadialGradient(0, 0, 120, 0, 0, 160);
    fl.addColorStop(0, 'rgba(90,150,255,0.35)'); fl.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = fl; g.beginPath(); g.arc(0, 0, 165, 0, TAU); g.fill();
    // 냄비
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(6, 12, 142, 0, TAU); g.fill();
    const rim = g.createLinearGradient(-140, -140, 140, 140);
    rim.addColorStop(0, '#e8ecf0'); rim.addColorStop(0.5, '#8a9098'); rim.addColorStop(1, '#5a6068');
    g.fillStyle = rim; g.beginPath(); g.arc(0, 0, 140, 0, TAU); g.fill();
    // 물
    const water = g.createRadialGradient(-30, -30, 10, 0, 0, 128);
    const starch = this.pasta ? clamp(this.minutes / 10, 0, 1) : 0;
    water.addColorStop(0, `rgba(${200 + starch * 30},${225 + starch * 10},${240 - starch * 20},1)`);
    water.addColorStop(1, `rgba(${120 + starch * 60},${160 + starch * 40},${190 - starch * 10},1)`);
    g.fillStyle = water; g.beginPath(); g.arc(0, 0, 128, 0, TAU); g.fill();
    // 내용물
    if (this.phase === 'cooking') {
      if (this.pasta) {
        const soft = clamp(this.minutes / this.pkgMin, 0, 1.3);
        const R = rng(5);
        g.lineCap = 'round';
        for (let i = 0; i < 70; i++) {
          const a = R() * TAU, len = 60 + R() * 60;
          const curl = 0.2 + soft * 1.2;
          g.strokeStyle = `rgba(${240 - soft * 10},${210 + soft * 20},${130 + soft * 50},0.9)`;
          g.lineWidth = 2;
          g.beginPath();
          for (let s = 0; s <= 10; s++) {
            const t = s / 10;
            const x = Math.cos(a) * (t - 0.5) * len + Math.sin(t * 6 + i + this.t) * curl * 10;
            const y = Math.sin(a) * (t - 0.5) * len + Math.cos(t * 5 + i) * curl * 10;
            s ? g.lineTo(x, y) : g.moveTo(x, y);
          }
          g.stroke();
        }
      } else {
        g.save(); g.rotate(0.5 + Math.sin(this.t) * 0.05); g.scale(0.9, 0.9);
        drawLobster(g, { cook: clamp(this.minutes / 6, 0, 1.2) });
        g.restore();
      }
    } else if (this.pasta) {
      // 넣기 전: 냄비 옆 면 묶음
      g.save(); g.translate(150, 120); g.rotate(-0.6);
      g.fillStyle = '#efd28a'; rr(g, -60, -6, 120, 12, 3); g.fill();
      g.strokeStyle = 'rgba(180,140,60,0.5)'; for (let i = -5; i <= 5; i++) { g.beginPath(); g.moveTo(-60, i); g.lineTo(60, i); g.stroke(); }
      g.restore();
    }
    // 기포
    for (const b of this.bubbles) {
      g.strokeStyle = `rgba(255,255,255,${0.6 * b.life})`; g.lineWidth = 1.2;
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.stroke();
    }
    for (const gr of this.grains) { g.fillStyle = '#fff'; g.fillRect(gr.x, gr.y, 2, 2); }
    // 김
    for (let i = 0; i < 6; i++) {
      const x = Math.sin(this.t * 0.7 + i) * 60, y = -60 - ((this.t * 30 + i * 40) % 140);
      const sg = g.createRadialGradient(x, y, 0, x, y, 40);
      sg.addColorStop(0, 'rgba(255,255,255,0.12)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sg; g.beginPath(); g.arc(x, y, 40, 0, TAU); g.fill();
    }
    g.restore();
    if (this.phase === 'salt') drawShaker(g, 'salt', cx, cy - 175 * S + Math.sin(this.t * 30) * motion.shakePower * 0.6, S * 0.85, 0);
    // 키친 타이머
    if (this.phase === 'cooking') {
      const m = Math.floor(this.minutes), s = Math.floor((this.minutes - m) * 60);
      g.save();
      g.translate(W - 70 * S, H * 0.27);
      g.fillStyle = 'rgba(20,10,5,0.85)'; rr(g, -56 * S, -30 * S, 112 * S, 60 * S, 14 * S); g.fill();
      g.fillStyle = '#ffd25a'; g.font = `900 ${26 * S}px ui-monospace, monospace`; g.textAlign = 'center';
      g.fillText(`${m}:${String(s).padStart(2, '0')}`, 0, 6 * S);
      g.font = `700 ${11 * S}px sans-serif`; g.fillStyle = '#d9c2a5';
      g.fillText(this.pasta ? `포장지 ${this.pkgMin}분` : `목표 ${this.pkgMin}분`, 0, 22 * S);
      g.restore();
    }
  }
}

/** 오븐 브로일: 치즈가 노릇해지면 꺼내기 */
export class OvenScene {
  constructor(game) { this.game = game; this.brown = 0; this.t = 0; this.done = false; }
  enter() {
    this.game.instruct({ icon: '🔥', title: '치즈 올려 굽기', lines: ['그뤼에르 치즈를 올린 랍스터를 브로일러에 넣었어요.', '치즈가 <b>노릇노릇한 황금색</b>이 되면 꺼내요. 순식간에 타니 눈을 떼지 마세요!'] })
      .then(() => { this.active = true; });
    this.game.ui.addButton('꺼내기 🧤', () => this.finish());
    this.game.ui.setHint('치즈 색을 보고 꺼내요');
  }
  finish() {
    if (this.done || !this.active) return;
    this.done = true;
    this.game.state.oven = { brown: this.brown };
    this.game.ui.toast(this.brown > 1.5 ? '탔어요…' : this.brown < 0.5 ? '덜 구워졌어요' : '노릇노릇!', { bad: this.brown > 1.5 || this.brown < 0.5 });
    sfx.ding();
    setTimeout(() => this.game.nextStage(), 800);
  }
  update(dt) {
    this.t += dt;
    if (this.active && !this.done) this.brown += dt * (this.game.state.quick ? 0.11 : 0.08) * (0.6 + this.brown * 0.6);
    setSizzle(this.active && !this.done ? 0.15 : 0);
  }
  draw(g) {
    const { W, H, S, dpr } = this.game;
    drawCounter(g, W, H, dpr);
    const cx = W / 2, cy = H * 0.5, w = Math.min(W * 0.9, 360 * S), h = 300 * S;
    g.fillStyle = '#2a2624'; rr(g, cx - w / 2 - 14, cy - h / 2 - 14, w + 28, h + 28, 20); g.fill();
    const glow = g.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    glow.addColorStop(0, `rgba(255,${120 + Math.sin(this.t * 6) * 10},40,0.9)`); glow.addColorStop(1, 'rgba(60,20,10,1)');
    g.fillStyle = glow; rr(g, cx - w / 2, cy - h / 2, w, h, 12); g.fill();
    g.strokeStyle = 'rgba(255,200,120,0.9)'; g.lineWidth = 4;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx - w / 2 + 20, cy - h / 2 + 18 + i * 10); g.lineTo(cx + w / 2 - 20, cy - h / 2 + 18 + i * 10); g.stroke(); }
    g.save(); g.translate(cx, cy + 20 * S); g.rotate(Math.PI / 2); g.scale(S * 1.2, S * 1.2);
    drawLobster(g, { cook: 1, split: 1, sauce: true, cheese: this.brown });
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.06)'; rr(g, cx - w / 2, cy - h / 2, w * 0.4, h, 12); g.fill();
  }
}
