// 2단계: 양배추 채썰기 — 드래그한 궤적 그대로 잘린다
import { drawCounter, drawBoard, drawKnife } from '../art.js';
import { sfx, haptic } from '../audio.js';
import { TAU, rng, splitPolyByPath, polyArea, polyCentroid, polyMinWidth, polyBounds, clamp, pointInPoly } from '../geom.js';

const CORE = [0, 78];

function cabbageShape() {
  const pts = [];
  const N = 90;
  const R = rng(31);
  for (let i = 0; i < N; i++) {
    const t = (i / N) * TAU;
    const r = 92 * (1 + 0.035 * Math.sin(t * 5 + 1) + 0.02 * Math.sin(t * 11)) * (1 + (R() - 0.5) * 0.01);
    let y = Math.sin(t) * r * 0.9;
    if (y > 72) y = 72 + (y - 72) * 0.3; // 아래는 평평하게(밑동)
    pts.push([Math.cos(t) * r, y]);
  }
  return pts;
}

export class CabbageScene {
  constructor(game) {
    this.game = game;
    this.shape = cabbageShape();
    this.pieces = [{ poly: this.shape, ox: 0, oy: 0, vx: 0, vy: 0 }];
    this.totalArea = Math.abs(polyArea(this.shape));
    this.tex = null;
    this.active = false;
    this.stroke = null;
    this.trail = [];
    this.bits = [];
    this.cuts = 0;
    this.done = false;
  }

  enter() {
    const { ui } = this.game;
    this.game.instruct({
      icon: '🥬',
      title: '2. 양배추 채썰기',
      lines: [
        '손가락으로 그은 <b>궤적 그대로</b> 양배추가 잘려요. 곡선도 OK!',
        '<b>가늘게</b> 썰수록 아삭하고 맛있는 샐러드가 돼요.',
        '양배추를 끝까지 <b>완전히 가로질러야</b> 잘려요.',
        '시간이 흐르고 있으니 적당할 때 완료하세요.',
      ],
    }).then(() => { this.active = true; });
    ui.addButton('채썰기 완료 ✓', () => this.finish());
    this.meter = ui.addMeter('채 굵기');
    ui.setHint('양배추를 가로질러 슥슥 그어 채를 썰어요');
  }

  layout() {
    const { W, H, S } = this.game;
    return { cx: W / 2, cy: H * 0.54, k: S * 1.5 };
  }

  buildTex() {
    const { k } = this.layout();
    const sc = k * this.game.dpr;
    if (this.tex && Math.abs(this.tex.sc - sc) < 0.01) return;
    const pad = 10, w = 200, h = 190;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * sc); c.height = Math.ceil(h * sc);
    const g = c.getContext('2d');
    g.setTransform(sc, 0, 0, sc, (w / 2) * sc, (h / 2) * sc);
    const path = new Path2D();
    this.shape.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
    path.closePath();
    g.save(); g.clip(path);
    const base = g.createRadialGradient(CORE[0], CORE[1], 5, 0, 20, 110);
    base.addColorStop(0, '#fbfbe8'); base.addColorStop(0.5, '#eef3c8'); base.addColorStop(0.85, '#cfe397'); base.addColorStop(1, '#8fbd52');
    g.fillStyle = base; g.fillRect(-w, -h, w * 2, h * 2);
    const R = rng(8);
    // 겹겹이 쌓인 잎 결 (밑동을 중심으로 물결치는 곡선)
    for (let layer = 0; layer < 34; layer++) {
      const rad = 14 + layer * 5.2 + R() * 2;
      const wob = 1.5 + layer * 0.12;
      g.beginPath();
      for (let a = Math.PI * 1.02; a <= Math.PI * 1.98 + 0.001; a += 0.03) {
        const rr = rad + Math.sin(a * (7 + (layer % 4)) + layer) * wob + Math.sin(a * 23 + layer * 3) * 0.6;
        const x = CORE[0] + Math.cos(a) * rr * 1.08, y = CORE[1] + Math.sin(a) * rr;
        a === Math.PI * 1.02 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      const t = layer / 34;
      g.strokeStyle = `rgba(${Math.round(200 - t * 60)},${Math.round(225 - t * 20)},${Math.round(160 - t * 90)},${0.45 + R() * 0.3})`;
      g.lineWidth = 0.8 + R() * 1.4; g.stroke();
      g.strokeStyle = 'rgba(255,255,245,0.55)'; g.lineWidth = 0.5; g.stroke();
    }
    // 잎맥
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * (1.08 + R() * 0.84);
      g.beginPath(); g.moveTo(CORE[0], CORE[1]);
      const L = 40 + R() * 110;
      g.quadraticCurveTo(CORE[0] + Math.cos(a + 0.2) * L * 0.5, CORE[1] + Math.sin(a + 0.2) * L * 0.5, CORE[0] + Math.cos(a) * L, CORE[1] + Math.sin(a) * L);
      g.strokeStyle = 'rgba(255,255,240,0.28)'; g.lineWidth = 0.8 + R() * 1.2; g.stroke();
    }
    // 심지
    g.beginPath(); g.moveTo(-20, 80); g.quadraticCurveTo(-6, 30, 0, 18); g.quadraticCurveTo(6, 30, 20, 80); g.closePath();
    const core = g.createLinearGradient(0, 18, 0, 80);
    core.addColorStop(0, '#f6f4dc'); core.addColorStop(1, '#e4e8b8');
    g.fillStyle = core; g.fill();
    // 겉잎
    g.lineWidth = 9; g.strokeStyle = '#5f9a3a'; g.stroke(path);
    g.lineWidth = 4; g.strokeStyle = '#3f7426'; g.stroke(path);
    g.restore();
    this.tex = { c, sc, w, h };
  }

  toLocal(x, y) { const { cx, cy, k } = this.layout(); return [(x - cx) / k, (y - cy) / k]; }

  down(p) {
    if (!this.active || this.done) return;
    this.stroke = { path: [this.toLocal(p.x, p.y)], cutIds: new Set() };
    this.trail = [{ x: p.x, y: p.y, t: 0 }];
    this.knife = { x: p.x, y: p.y, a: 0 };
  }

  move(p) {
    if (!this.stroke) return;
    const lp = this.toLocal(p.x, p.y);
    const last = this.stroke.path[this.stroke.path.length - 1];
    if (Math.hypot(lp[0] - last[0], lp[1] - last[1]) < 1.2) return;
    this.stroke.path.push(lp);
    this.trail.push({ x: p.x, y: p.y, t: 0 });
    const dx = p.x - this.knife.x, dy = p.y - this.knife.y;
    if (Math.hypot(dx, dy) > 2) this.knife.a = Math.atan2(dy, dx) + Math.PI;
    this.knife.x = p.x; this.knife.y = p.y;
    this.tryCut();
  }

  up() { this.stroke = null; this.knife = null; }
  cancelPointer() { this.up(); }

  tryCut() {
    const path = this.stroke.path;
    if (path.length < 2) return;
    const pb = polyBounds(path);
    const next = [];
    let cutCount = 0;
    for (const pc of this.pieces) {
      if (this.stroke.cutIds.has(pc)) { next.push(pc); continue; }
      const b = polyBounds(pc.poly);
      if (b.x1 + pc.ox < pb.x0 || b.x0 + pc.ox > pb.x1 || b.y1 + pc.oy < pb.y0 || b.y0 + pc.oy > pb.y1) { next.push(pc); continue; }
      const local = path.map(([x, y]) => [x - pc.ox, y - pc.oy]);
      const res = splitPolyByPath(pc.poly, local);
      if (!res) { next.push(pc); continue; }
      // 자른 방향의 법선으로 살짝 벌어지게
      const a = local[0], z = local[local.length - 1];
      let nx = -(z[1] - a[1]), ny = z[0] - a[0];
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const children = res.map((poly) => {
        const [cx, cy] = polyCentroid(poly);
        const side = (cx - a[0]) * nx + (cy - a[1]) * ny > 0 ? 1 : -1;
        const ch = { poly, ox: pc.ox, oy: pc.oy, vx: nx * side * 22, vy: ny * side * 22 };
        this.stroke.cutIds.add(ch);
        return ch;
      });
      next.push(...children);
      cutCount++;
      const [cx, cy] = polyCentroid(res[0]);
      this.spawnBits(cx + pc.ox, cy + pc.oy);
    }
    if (cutCount) {
      this.pieces = next;
      this.cuts += cutCount;
      sfx.crunch(); haptic('light');
    }
  }

  spawnBits(x, y) {
    for (let i = 0; i < 4; i++) this.bits.push({ x, y, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 60, life: 1, s: 1 + Math.random() * 2 });
  }

  fineness() {
    let acc = 0;
    for (const pc of this.pieces) {
      const A = Math.abs(polyArea(pc.poly));
      const w = polyMinWidth(pc.poly);
      acc += A * clamp((28 - w) / (28 - 7), 0, 1);
    }
    return acc / this.totalArea;
  }

  finish() {
    if (this.done) return;
    this.done = true;
    const f = this.fineness();
    this.game.state.cabbage = { fineness: f, pieces: this.pieces.length, cuts: this.cuts };
    this.game.ui.toast(f > 0.75 ? '아삭아삭 완벽한 채!' : f > 0.4 ? '먹을 만한 채' : '너무 굵어요…', { bad: f <= 0.4 });
    setTimeout(() => this.game.nextStage(), 900);
  }

  update(dt) {
    for (const pc of this.pieces) {
      pc.ox += pc.vx * dt; pc.oy += pc.vy * dt;
      pc.vx *= Math.exp(-dt * 8); pc.vy *= Math.exp(-dt * 8);
    }
    for (const t of this.trail) t.t += dt;
    this.trail = this.trail.filter((t) => t.t < 0.25);
    for (const b of this.bits) { b.x += b.vx * dt * 0.1; b.y += b.vy * dt * 0.1; b.vy += 300 * dt; b.life -= dt * 1.5; }
    this.bits = this.bits.filter((b) => b.life > 0);
    if (!this._t || (this._t += dt) > 0.25) {
      this._t = 0.0001;
      const f = this.fineness();
      this.meter.set(f, f > 0.75 ? '가늘다' : f > 0.4 ? '보통' : '굵다');
    }
  }

  draw(g) {
    const { W, H, S, dpr } = this.game;
    drawCounter(g, W, H, dpr);
    const { cx, cy, k } = this.layout();
    drawBoard(g, cx, cy, Math.min(W * 0.98, 380 * S), 420 * S, dpr);
    this.buildTex();
    const t = this.tex;
    g.save();
    g.translate(cx, cy); g.scale(k, k);
    // 그림자
    g.save(); g.globalAlpha = 0.22; g.fillStyle = '#000';
    for (const pc of this.pieces) {
      g.save(); g.translate(pc.ox + 3, pc.oy + 6);
      g.beginPath(); pc.poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
      g.restore();
    }
    g.restore();
    for (const pc of this.pieces) {
      g.save();
      g.translate(pc.ox, pc.oy);
      g.beginPath(); pc.poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
      g.save(); g.clip();
      g.drawImage(t.c, -t.w / 2, -t.h / 2, t.w, t.h);
      g.restore();
      if (this.pieces.length > 1) { g.strokeStyle = 'rgba(255,255,240,0.7)'; g.lineWidth = 0.6; g.stroke(); }
      g.restore();
    }
    for (const b of this.bits) {
      g.fillStyle = `rgba(200,225,150,${b.life})`;
      g.fillRect(b.x, b.y, b.s, b.s);
    }
    g.restore();
    // 칼 궤적
    if (this.trail.length > 1) {
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1], b = this.trail[i];
        g.strokeStyle = `rgba(255,255,255,${0.7 * (1 - b.t / 0.25)})`;
        g.lineWidth = 3 * S;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
      g.restore();
    }
    if (this.knife) drawKnife(g, this.knife.x, this.knife.y, this.knife.a, S * 0.8, true);
  }
}
