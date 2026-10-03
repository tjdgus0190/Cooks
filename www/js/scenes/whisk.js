// 까르보나라 노른자 소스: 페코리노 갈아 넣기(흔들기) → 후추(흔들기) → 원 그리며 휘젓기
import { drawCounter } from '../art.js';
import { sfx, haptic } from '../audio.js';
import { onMotion, feedShake, motion } from '../motion.js';
import { clamp, TAU, rng } from '../geom.js';

export class WhiskScene {
  constructor(game) {
    this.game = game;
    this.tool = 'cheese';
    this.cheese = 0; this.pepper = 0; this.mix = 0;
    this.lastAng = null; this.flecks = []; this.t = 0; this.done = false;
    this.R = rng(21);
  }
  enter() {
    const ui = this.game.ui;
    this.game.instruct({ icon: '🥚', title: '노른자 소스 만들기', lines: ['로마식 까르보나라는 <b>크림 없이</b> 노른자와 페코리노 치즈로 소스를 만들어요.', '🧀 치즈·⚫ 후추는 휴대폰을 흔들어 넣고(갈기), 🥄 섞기는 그릇 위에 <b>원을 그리며</b> 저어요.', '후추는 넉넉히! 까르보나라는 "숯쟁이" 파스타예요.'] })
      .then(() => { this.active = true; });
    this.seg = ui.addSegment([{ key: 'cheese', label: '🧀 치즈' }, { key: 'pepper', label: '⚫ 후추' }, { key: 'mix', label: '🥄 섞기' }], 'cheese', (k) => { this.tool = k; sfx.pop(); this.hint(); });
    ui.addButton('완료 ✓', () => this.finish());
    this.mC = ui.addMeter('🧀 페코리노', { zone: this.game.state.customer.hints ? [0.4, 0.6] : null });
    this.mP = ui.addMeter('⚫ 후추');
    this.mM = ui.addMeter('🥄 섞임');
    this.off = onMotion((ev) => {
      if (!this.active || this.done) return;
      if (ev.type === 'shake') this.shake(ev.power);
      if (ev.type === 'swirl' && this.tool === 'mix') this.mix = clamp(this.mix + ev.power * 0.004, 0, 1);
    });
    this.hint();
  }
  exit() { this.off?.(); }
  hint() { this.game.ui.setHint({ cheese: '휴대폰을 흔들어 치즈를 갈아 넣어요', pepper: '휴대폰을 흔들어 후추를 갈아 넣어요', mix: '그릇 위에 원을 그리며 저어요' }[this.tool]); }

  shake(p) {
    if (this.tool === 'mix') { this.mix = clamp(this.mix + p * 0.002, 0, 1); return; }
    const amt = p * 0.25;
    if (this.tool === 'cheese') this.cheese += amt * 0.35; else this.pepper += amt * 0.02;
    for (let i = 0; i < Math.min(6, amt); i++) this.flecks.push({ type: this.tool, x: (this.R() - 0.5) * 120, y: (this.R() - 0.5) * 100, s: 1 + this.R() * 2 });
    if (Math.random() < 0.3) sfx.shaker(p / 4);
  }

  down(p) { this.lastAng = null; this.lastPtr = { x: p.x, vx: 0, t: p.t }; this.move(p); }
  move(p) {
    if (!this.active) return;
    const { W, H } = this.game;
    if (this.tool === 'mix') {
      const a = Math.atan2(p.y - H * 0.52, p.x - W / 2);
      if (this.lastAng != null) {
        let d = a - this.lastAng; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
        this.mix = clamp(this.mix + Math.abs(d) * 0.035, 0, 1);
        if (Math.random() < 0.15) sfx.chew();
      }
      this.lastAng = a;
    } else if (this.lastPtr) {
      const lp = this.lastPtr;
      const vx = (p.x - lp.x) / Math.max(0.001, (p.t - lp.t) / 1000);
      if (Math.sign(vx) !== Math.sign(lp.vx) && Math.abs(lp.vx) > 500) feedShake(5 + Math.min(22, Math.abs(lp.vx) / 140));
      this.lastPtr = { x: p.x, vx: Math.abs(vx) > 40 ? vx : lp.vx, t: p.t };
    }
  }
  up() { this.lastAng = null; this.lastPtr = null; }

  finish() {
    if (this.done || !this.active) return;
    this.done = true;
    this.game.state.whisk = { cheese: this.cheese, cheeseTarget: 30, pepper: this.pepper, pepperTarget: 1.5, mix: this.mix };
    sfx.ding(); haptic('light');
    setTimeout(() => this.game.nextStage(), 600);
  }

  update(dt) {
    this.t += dt;
    this.mC.set(this.cheese / 60, `${this.cheese.toFixed(0)}g`);
    this.mP.set(this.pepper / 3, `${this.pepper.toFixed(1)}g`);
    this.mM.set(this.mix, `${Math.round(this.mix * 100)}%`);
  }

  draw(g) {
    const { W, H, S, dpr } = this.game;
    drawCounter(g, W, H, dpr);
    const cx = W / 2, cy = H * 0.52, k = S * 1.2;
    g.save(); g.translate(cx, cy); g.scale(k, k);
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.arc(6, 10, 128, 0, TAU); g.fill();
    const bowl = g.createRadialGradient(-30, -40, 10, 0, 0, 130);
    bowl.addColorStop(0, '#ffffff'); bowl.addColorStop(1, '#cfd6dc');
    g.fillStyle = bowl; g.beginPath(); g.arc(0, 0, 125, 0, TAU); g.fill();
    // 노른자 → 섞일수록 크림처럼 매끈하게
    const m = this.mix;
    const cheeseT = clamp(this.cheese / 40, 0, 1);
    if (m < 0.95) for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + this.t * m * 2, d = 30 * (1 - m);
      g.fillStyle = `rgba(255,170,30,${1 - m})`; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 22 * (1 - m * 0.6), 0, TAU); g.fill();
    }
    g.fillStyle = `rgba(${255},${190 + cheeseT * 30},${70 + cheeseT * 60},${0.35 + m * 0.6})`;
    g.beginPath(); g.arc(0, 0, 40 + m * 55, 0, TAU); g.fill();
    // 휘저은 자국
    if (m > 0.1) { g.strokeStyle = `rgba(255,240,200,${0.4 * m})`; g.lineWidth = 2; for (let r = 15; r < 40 + m * 50; r += 12) { g.beginPath(); g.arc(0, 0, r, this.t * 2, this.t * 2 + 4); g.stroke(); } }
    for (const f of this.flecks) {
      if (f.type === 'cheese') { g.fillStyle = 'rgba(255,252,235,0.95)'; g.fillRect(f.x * (1 - m * 0.5), f.y * (1 - m * 0.5), f.s * 2, f.s); }
      else { g.fillStyle = '#1b1410'; g.beginPath(); g.arc(f.x, f.y, f.s * 0.6, 0, TAU); g.fill(); }
    }
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-60, -70, 40, 12, -0.6, 0, TAU); g.fill();
    g.restore();
    if (this.tool !== 'mix') {
      g.font = `${54 * S}px sans-serif`; g.textAlign = 'center';
      g.fillText(this.tool === 'cheese' ? '🧀' : '🫙', cx + Math.sin(this.t * 30) * motion.shakePower * 0.8, cy - 170 * S);
    }
  }
}
