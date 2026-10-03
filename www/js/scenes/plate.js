// 5단계: 플레이팅 — 드래그 앤 드롭으로 나만의 한 접시
import { drawTable, drawPlate, drawGarnish, drawSauce, GARNISHES, GARNISH_R, rr } from '../art.js';
import { drawWholeSteak, drawSlicedSteak } from '../dish.js';
import { SHAPE } from '../meat.js';
import { sfx, haptic } from '../audio.js';
import { clamp, TAU, pointInPoly, dist, pathLength } from '../geom.js';
import { idealCook } from '../dish.js';

export const PLATE_R = 150;
export const STEAK_SCALE = 0.62;
const LIMITS = { slaw: 2, tomato: 5, asparagus: 5, rosemary: 3, garlic: 5, mushroom: 4, butter: 1, micro: 4, flake: 3 };
const SAUCE_MAX = 700;

export class PlateScene {
  constructor(game) {
    this.game = game;
    this.cook = game.state.cook || idealCook();
    this.cabbage = game.state.cabbage || { fineness: 0.5, pieces: 10 };
    this.steak = { key: 'steak', x: -18, y: -14, rot: -0.12 };
    this.items = [];
    this.sauce = [];
    this.curSauce = null;
    this.sliced = true;
    this.mode = 'move';
    this.drag = null;
    this.selected = null;
    this.tossed = [];
    this.active = false;
    this.done = false;
    this.seedN = 1;
    this.tray = [...GARNISHES.map((g) => ({ ...g })), { key: 'sauce', name: '소스 붓', icon: '🖌️' }];
    this.limits = { ...LIMITS };
    if (this.cabbage.pieces < 3) this.limits.slaw = 0;
  }

  enter() {
    const { ui } = this.game;
    this.game.instruct({
      icon: '🍽️',
      title: '5. 플레이팅',
      lines: [
        '아래 쟁반의 가니쉬를 <b>끌어다 접시에 놓으세요</b>.',
        '놓은 재료는 다시 끌어 옮기고, <b>두 손가락으로 돌릴</b> 수 있어요. 접시 밖으로 버리면 삭제!',
        '🖌️ 소스 붓을 고르면 접시에 소스를 그릴 수 있어요.',
        '균형·색감·여백이 좋을수록 손님 만족도가 올라가요.',
      ],
      button: '꾸미기 시작',
    }).then(() => { this.active = true; });
    this.segSlice = ui.addSegment([{ key: 'sliced', label: '🔪 슬라이스' }, { key: 'whole', label: '🥩 통째로' }], 'sliced', (k) => { this.sliced = k === 'sliced'; sfx.pop(); });
    ui.addButton('↻', () => this.rotateSel(), 'secondary small');
    ui.addButton('서빙 🛎️', () => this.finish());
    ui.setHint('가니쉬를 끌어다 접시를 꾸며보세요');
  }

  layout() {
    const { W, H, S } = this.game;
    const pr = Math.min(W * 0.46, H * 0.25);
    const trayH = 64 * S;
    const trayY = H - 82 * S - 2 * trayH;
    return { cx: W / 2, cy: Math.min(H * 0.41, trayY - pr - 12 * S + 0), pr, k: pr / PLATE_R, trayY, trayH };
  }

  toLocal(x, y) { const { cx, cy, k } = this.layout(); return [(x - cx) / k, (y - cy) / k]; }

  trayHit(x, y) {
    const { W } = this.game;
    const { trayY, trayH } = this.layout();
    if (y < trayY || y > trayY + trayH * 2) return null;
    const row = Math.floor((y - trayY) / trayH), col = Math.floor(x / (W / 5));
    return this.tray[row * 5 + col] || null;
  }

  used(key) { return this.items.filter((i) => i.key === key).length; }

  hitItem(lx, ly) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (dist(lx, ly, it.x, it.y) < GARNISH_R[it.key] * 0.9 + 6) return it;
    }
    // 스테이크
    const s = this.steak;
    const c = Math.cos(-s.rot), sn = Math.sin(-s.rot);
    const dx = (lx - s.x) / STEAK_SCALE, dy = (ly - s.y) / STEAK_SCALE;
    if (pointInPoly(dx * c - dy * sn, dx * sn + dy * c, SHAPE)) return s;
    return null;
  }

  down(p) {
    if (!this.active || this.done) return;
    const t = this.trayHit(p.x, p.y);
    if (t) {
      if (t.key === 'sauce') { this.mode = this.mode === 'sauce' ? 'move' : 'sauce'; sfx.pop(); this.game.ui.setHint(this.mode === 'sauce' ? '접시 위에 손가락으로 소스를 그려요 (다시 누르면 종료)' : '가니쉬를 끌어다 접시를 꾸며보세요'); return; }
      if (this.used(t.key) >= this.limits[t.key]) { this.game.ui.toast('더 없어요', { bad: true }); return; }
      const [lx, ly] = this.toLocal(p.x, p.y);
      const it = { key: t.key, x: lx, y: ly - 20, rot: (Math.random() - 0.5) * 1.2, seed: this.seedN++, fresh: true };
      this.items.push(it);
      this.drag = { it, ox: 0, oy: -20 };
      this.selected = it;
      sfx.pop();
      return;
    }
    const [lx, ly] = this.toLocal(p.x, p.y);
    if (this.mode === 'sauce') {
      if (dist(lx, ly, 0, 0) < PLATE_R * 0.95 && this.sauceLen() < SAUCE_MAX) { this.curSauce = [[lx, ly]]; this.sauce.push(this.curSauce); }
      return;
    }
    const hit = this.hitItem(lx, ly);
    if (hit) {
      this.drag = { it: hit, ox: hit.x - lx, oy: hit.y - ly };
      this.selected = hit;
      if (hit !== this.steak) { this.items.splice(this.items.indexOf(hit), 1); this.items.push(hit); }
      haptic('light');
    }
  }

  sauceLen() { return this.sauce.reduce((a, s) => a + pathLength(s), 0); }

  move(p) {
    const [lx, ly] = this.toLocal(p.x, p.y);
    if (this.curSauce) {
      const last = this.curSauce[this.curSauce.length - 1];
      if (dist(lx, ly, last[0], last[1]) > 2.5 && this.sauceLen() < SAUCE_MAX && dist(lx, ly, 0, 0) < PLATE_R * 0.97) this.curSauce.push([lx, ly]);
      return;
    }
    if (!this.drag) return;
    this.drag.it.x = lx + this.drag.ox;
    this.drag.it.y = ly + this.drag.oy;
  }

  up() {
    if (this.curSauce) { if (this.curSauce.length < 3) this.sauce.pop(); this.curSauce = null; return; }
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const it = d.it;
    it.fresh = false;
    const off = dist(it.x, it.y, 0, 0) > PLATE_R * 1.02;
    if (off && it !== this.steak) {
      this.items.splice(this.items.indexOf(it), 1);
      this.tossed.push({ ...it, life: 0.4 });
      if (this.selected === it) this.selected = null;
      sfx.whoosh();
    } else if (off && it === this.steak) {
      it.x = clamp(it.x, -60, 60); it.y = clamp(it.y, -60, 60);
      sfx.place();
    } else sfx.place();
  }

  cancelPointer() { this.drag = null; this.curSauce = null; }

  twist(da) {
    const it = this.selected || this.steak;
    it.rot += da;
  }

  rotateSel() { const it = this.selected || this.steak; it.rot += Math.PI / 6; sfx.pop(); }

  finish() {
    if (this.done) return;
    this.done = true;
    this.game.state.plate = {
      items: this.items.map(({ key, x, y, rot, seed }) => ({ key, x, y, rot, seed })),
      sauce: this.sauce.map((s) => s.slice()),
      steak: { ...this.steak },
      sliced: this.sliced,
      plateR: PLATE_R,
      steakScale: STEAK_SCALE,
    };
    sfx.ding();
    this.game.ui.toast('서빙!', { sub: '손님에게 가져가는 중…' });
    setTimeout(() => this.game.nextStage(), 900);
  }

  onTimeout() {
    this.game.ui.toast('시간 종료!', { bad: true, sub: '지금 상태로 서빙해요' });
    this.finish();
  }

  update(dt) {
    for (const t of this.tossed) { t.life -= dt; t.y += 400 * dt; }
    this.tossed = this.tossed.filter((t) => t.life > 0);
  }

  draw(g) {
    const { W, H, S, dpr, tex } = this.game;
    drawTable(g, W, H, dpr);
    const { cx, cy, pr, k, trayY, trayH } = this.layout();
    drawPlate(g, cx, cy, pr, dpr);
    g.save();
    g.translate(cx, cy); g.scale(k, k);
    drawDish(g, tex, this.cook, {
      steak: this.steak, sliced: this.sliced, items: this.items, sauce: this.sauce, cabbage: this.cabbage,
      selected: this.selected, steakScale: STEAK_SCALE,
    });
    for (const t of this.tossed) {
      g.save(); g.globalAlpha = clamp(t.life * 2.5, 0, 1); g.translate(t.x, t.y); g.rotate(t.rot);
      drawGarnish(g, t.key, { seed: t.seed, amount: this.cabbage.fineness }); g.restore();
    }
    g.restore();
    // 쟁반
    g.save();
    rr(g, 6, trayY - 6, W - 12, trayH * 2 + 12, 18 * S);
    g.fillStyle = 'rgba(30,16,8,0.88)'; g.fill();
    g.strokeStyle = 'rgba(255,214,160,0.18)'; g.lineWidth = 1; g.stroke();
    const cw = W / 5;
    this.tray.forEach((t, i) => {
      const col = i % 5, row = Math.floor(i / 5);
      const x = col * cw + cw / 2, y = trayY + row * trayH + trayH * 0.42;
      const left = t.key === 'sauce' ? null : this.limits[t.key] - this.used(t.key);
      const on = t.key === 'sauce' && this.mode === 'sauce';
      if (on) { rr(g, col * cw + 6, trayY + row * trayH + 2, cw - 12, trayH - 4, 12 * S); g.fillStyle = 'rgba(255,195,90,0.35)'; g.fill(); }
      g.save();
      g.globalAlpha = left === 0 ? 0.3 : 1;
      g.translate(x, y);
      const sc = S * 0.95;
      g.scale(sc, sc);
      if (t.key === 'sauce') {
        drawSauce(g, Array.from({ length: 12 }, (_, j) => [-20 + j * 3.6, Math.sin(j / 2) * 5]));
      } else {
        const gr = GARNISH_R[t.key];
        const z = Math.min(1, 20 / gr);
        g.scale(z, z);
        drawGarnish(g, t.key, { seed: 3, amount: this.cabbage.fineness });
      }
      g.restore();
      g.fillStyle = '#f3e3cc'; g.font = `700 ${10 * S}px sans-serif`; g.textAlign = 'center';
      g.fillText(left == null ? t.name : `${t.name} ${left}`, x, trayY + row * trayH + trayH - 6 * S);
    });
    g.restore();
  }
}

/** 접시 위 요리 전체 그리기 (결과 화면에서도 사용) */
export function drawDish(g, tex, cook, { steak, sliced, items, sauce, cabbage, selected, steakScale = STEAK_SCALE }) {
  for (const s of sauce) drawSauce(g, s);
  // 스테이크 아래에 깔리는 재료(샐러드, 아스파라거스) 먼저
  const under = items.filter((i) => i.key === 'slaw' || i.key === 'asparagus');
  const over = items.filter((i) => !(i.key === 'slaw' || i.key === 'asparagus'));
  for (const it of under) drawItem(g, it, cabbage, selected);
  g.save();
  g.translate(steak.x, steak.y); g.rotate(steak.rot); g.scale(steakScale, steakScale);
  if (sliced) drawSlicedSteak(g, tex, cook, { slices: 7 });
  else drawWholeSteak(g, tex, cook);
  g.restore();
  if (selected === steak) {
    g.save(); g.strokeStyle = 'rgba(255,195,90,0.7)'; g.setLineDash([6, 5]); g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(steak.x, steak.y, 90, 62, steak.rot, 0, TAU); g.stroke(); g.restore();
  }
  for (const it of over) drawItem(g, it, cabbage, selected);
}

function drawItem(g, it, cabbage, selected) {
  g.save();
  g.translate(it.x, it.y); g.rotate(it.rot);
  if (it.fresh) g.scale(1.12, 1.12);
  drawGarnish(g, it.key, { seed: it.seed, amount: cabbage ? cabbage.fineness : 0.6 });
  g.restore();
  if (selected === it) {
    g.save(); g.strokeStyle = 'rgba(255,195,90,0.7)'; g.setLineDash([4, 4]); g.lineWidth = 1.2;
    g.beginPath(); g.arc(it.x, it.y, GARNISH_R[it.key] + 4, 0, TAU); g.stroke(); g.restore();
  }
}
