// 1단계: 고기 손질 — 근막(실버스킨)만 조심스럽게 잘라내기
import { drawCounter, drawBoard, drawKnife } from '../art.js';
import { membraneRemaining } from '../meat.js';
import { makeSubject } from '../subjects.js';
import { sfx, haptic } from '../audio.js';
import { clamp, TAU } from '../geom.js';

const MAX_SLOPE = Math.tan((58 * Math.PI) / 180); // 칼이 들어가는 최대 각도(가로 기준)

export class TrimScene {
  constructor(game) {
    this.game = game;
    const step = game.state.stepCfg || {};
    this.subj = makeSubject(step.subject || 'steak', { dish: game.state.dish });
    this.mems = this.subj.mems;
    this.scars = [];
    this.curScar = null;
    this.damage = 0;      // 살코기를 벤 길이(mm)
    this.fatCut = 0;
    this.rot = this.subj.baseRot ?? 0.18; this.rotTarget = this.rot;
    this.active = false;
    this.drag = null;
    this.parts = [];
    this.slipWarn = 0;
    this.sndT = 0;
    this.done = false;
  }

  enter() {
    const { ui } = this.game;
    const it = this.subj.intro;
    this.game.instruct({ icon: it.icon, title: it.title, lines: it.lines,
    }).then(() => { this.active = true; });
    ui.addButton('⟲', () => this.rotateBy(-Math.PI / 8), 'secondary');
    ui.addButton('⟳', () => this.rotateBy(Math.PI / 8), 'secondary');
    this.doneBtn = ui.addButton('손질 완료 ✓', () => this.finish());
    this.meter = ui.addMeter(`${this.subj.what} 제거`);
    this.dmgMeter = ui.addMeter('고기 손상');
    ui.setHint(this.subj.hint);
  }

  rotateBy(a) { this.rotTarget += a; sfx.place(); }

  layout() {
    const { W, H, S } = this.game;
    return { cx: W / 2, cy: H * 0.54, k: S * (this.subj?.scale || 1.18) };
  }

  toLocal(x, y) {
    const { cx, cy, k } = this.layout();
    const dx = (x - cx) / k, dy = (y - cy) / k;
    const c = Math.cos(-this.rot), s = Math.sin(-this.rot);
    return [dx * c - dy * s, dx * s + dy * c];
  }
  toScreen(lx, ly) {
    const { cx, cy, k } = this.layout();
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    return [cx + (lx * c - ly * s) * k, cy + (lx * s + ly * c) * k];
  }

  down(p) {
    if (!this.active || this.done) return;
    this.drag = { x: p.x, y: p.y, dirx: 0, diry: 0, ok: true };
    this.curScar = null;
  }

  move(p) {
    if (!this.drag || !this.active) return;
    const d = this.drag;
    const sx = p.x - d.x, sy = p.y - d.y;
    const len = Math.hypot(sx, sy);
    if (len < 2) return;
    // 방향 평활화
    d.dirx = d.dirx * 0.6 + (Math.abs(sx) / len) * 0.4;
    d.diry = d.diry * 0.6 + (Math.abs(sy) / len) * 0.4;
    d.ok = !this.subj.angleLimit || d.diry <= d.dirx * MAX_SLOPE;
    if (d.ok) this.cutSegment(d.x, d.y, p.x, p.y);
    else { this.slipWarn = 1.2; this.curScar = null; }
    d.x = p.x; d.y = p.y;
  }

  up() { this.drag = null; this.curScar = null; }
  cancelPointer() { this.drag = null; this.curScar = null; }

  twist(da) { if (this.active) { this.rot += da; this.rotTarget = this.rot; } }

  cutSegment(x0, y0, x1, y1) {
    const [ax, ay] = this.toLocal(x0, y0);
    const [bx, by] = this.toLocal(x1, y1);
    const L = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(L / 1.5));
    let cutAny = false, hurt = false;
    for (let i = 1; i <= steps; i++) {
      const qx = ax + ((bx - ax) * i) / steps, qy = ay + ((by - ay) * i) / steps;
      const stepLen = L / steps;
      let best = Infinity, bm = null, bi = -1;
      for (const m of this.mems) {
        for (let j = 0; j < m.pts.length; j++) {
          const dd = Math.hypot(m.pts[j][0] - qx, m.pts[j][1] - qy);
          if (dd < best) { best = dd; bm = m; bi = j; }
        }
      }
      if (bm && best <= bm.width * 0.62) {
        for (let j = Math.max(0, bi - 1); j <= Math.min(bm.pts.length - 1, bi + 1); j++) {
          if (!bm.cut[j]) { bm.cut[j] = 1; cutAny = true; if (Math.random() < 0.35) this.spawnStrip(bm.pts[j], bm.width); }
        }
        this.curScar = null;
      } else if (this.subj.inside(qx, qy)) {
        if (this.subj.inFat(qx, qy)) { this.fatCut += stepLen; this.curScar = null; continue; }
        const near = bm && best <= bm.width * 1.25;
        this.damage += stepLen * (near ? 0.4 : 1);
        hurt = true;
        if (!this.curScar) { this.curScar = []; this.scars.push(this.curScar); }
        this.curScar.push([qx, qy]);
      } else {
        this.curScar = null;
      }
    }
    const now = performance.now();
    if (cutAny && now - this.sndT > 70) { sfx.membrane(); this.sndT = now; }
    if (hurt && now - this.sndT > 120) { sfx.nick(); haptic('light'); this.sndT = now; }
  }

  drawScars(g) {
    g.save(); g.strokeStyle = 'rgba(120,20,20,0.6)'; g.lineWidth = 1.6; g.lineCap = 'round';
    for (const sc of this.scars) { if (sc.length < 2) continue; g.beginPath(); sc.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
    g.restore();
  }

  spawnStrip(pt, w) {
    const [sx, sy] = this.toScreen(pt[0], pt[1]);
    this.parts.push({ x: sx, y: sy, vx: (Math.random() - 0.5) * 120, vy: -120 - Math.random() * 100, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10, life: 1, w: w * this.layout().k * 0.5 });
  }

  finish() {
    if (this.done) return;
    this.done = true;
    const remain = membraneRemaining(this.mems);
    this.game.state.trim = {
      removed: 1 - remain,
      damage: this.damage,
      mems: this.mems,
      subject: this.subj.kind,
      scars: this.scars.filter((s) => s.length > 1),
    };
    const pct = Math.round((1 - remain) * 100);
    this.game.ui.toast(pct >= 95 && this.damage < 15 ? '깔끔한 손질!' : `${this.subj.what} ${pct}% 제거`, { sub: this.damage > 40 ? '고기가 꽤 상했어요' : '' });
    setTimeout(() => this.game.nextStage(), 900);
  }

  update(dt) {
    this.rot += (this.rotTarget - this.rot) * Math.min(1, dt * 12);
    this.slipWarn = Math.max(0, this.slipWarn - dt);
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.rot += p.vr * dt; p.life -= dt * 1.2; }
    this.parts = this.parts.filter((p) => p.life > 0);
    const removed = 1 - membraneRemaining(this.mems);
    this.meter.set(removed, `${Math.round(removed * 100)}%`);
    const dmg = clamp(this.damage / 80, 0, 1);
    this.dmgMeter.set(dmg, dmg < 0.15 ? '적음' : dmg < 0.5 ? '보통' : '심함');
    if (this.active && !this.done) {
      if (this.slipWarn > 0) this.game.ui.setHint('칼 각도가 안 맞아요! 고기를 돌려서 근막을 가로로 놓으세요');
      else if (removed > (this.game.state.quick ? 0.9 : 0.97)) { this.game.ui.setHint('완벽해요!'); this.finish(); }
      else this.game.ui.setHint(removed > 0.6 ? `조금만 더! 남은 ${this.subj.what}을 찾아보세요` : this.subj.hint);
    }
  }

  draw(g) {
    const { W, H, S, dpr, tex } = this.game;
    drawCounter(g, W, H, dpr);
    const { cx, cy, k } = this.layout();
    drawBoard(g, cx, cy, Math.min(W * 0.98, 380 * S), 420 * S, dpr);
    g.save();
    g.translate(cx, cy); g.rotate(this.rot); g.scale(k, k);
    // 그림자
    this.subj.draw(g, { tex, scars: this.scars });
    if (this.subj.kind !== 'steak') this.drawScars(g);
    g.restore();
    // 근막 조각 파티클
    for (const p of this.parts) {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = clamp(p.life, 0, 1);
      g.strokeStyle = 'rgba(235,240,250,0.95)'; g.lineWidth = p.w; g.lineCap = 'round';
      g.beginPath(); g.arc(0, 0, p.w * 1.2, 0, 2.2); g.stroke();
      g.restore();
    }
    // 칼
    if (this.drag) {
      const bad = !this.drag.ok;
      g.save();
      if (bad) { g.globalAlpha = 0.7; }
      drawKnife(g, this.drag.x, this.drag.y, bad ? 0.5 : 0, S * 0.9, !bad);
      g.restore();
      if (bad) {
        g.fillStyle = 'rgba(255,80,60,0.9)'; g.font = `bold ${16 * S}px sans-serif`; g.textAlign = 'center';
        g.fillText('✕', this.drag.x, this.drag.y - 20 * S);
      }
    }
  }
}
