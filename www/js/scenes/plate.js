// 플레이팅 — 내가 손질해 둔 재료(인벤토리)만 쟁반에 나온다. 요리 종류별 메인 + 드래그 앤 드롭 가니쉬
import { drawTable, drawPlate, drawGarnish, drawSauce, GARNISH_R, rr } from '../art.js';
import { drawWholeSteak, drawSlicedSteak, idealCook } from '../dish.js';
import { drawPastaNest, drawCazuela, drawLobster } from '../food.js';
import { SHAPE } from '../meat.js';
import { PREP, PLATE_GARNISH } from '../recipes.js';
import { sfx, haptic } from '../audio.js';
import { clamp, TAU, pointInPoly, dist, pathLength } from '../geom.js';
import { diff } from '../difficulty.js';

export const PLATE_R = 150;
export const STEAK_SCALE = 0.52;
const SAUCE_MAX = 700;
const MAIN_R = { steak: 70, pasta: 64, gambas: 78, lobster: 55 };

export class PlateScene {
  constructor(game) {
    this.game = game;
    const st = game.state;
    this.cat = st.dish?.cat || 'steak';
    this.cook = st.cook || idealCook();
    this.cabbage = st.cabbage || { fineness: 0.5, pieces: 10 };
    this.main = { key: 'main', x: this.cat === 'steak' ? -18 : 0, y: this.cat === 'steak' ? -14 : -8, rot: this.cat === 'steak' ? -0.12 : 0 };
    this.items = [];
    this.sauce = [];
    this.curSauce = null;
    this.sliced = true;
    this.mode = this.cat === 'pasta' && st.stepCfg?.twirl ? 'twirl' : 'move';
    this.twirl = this.mode === 'twirl' ? 0 : null;
    this.twirlAng = null;
    this.drag = null; this.selected = null; this.tossed = [];
    this.active = false; this.done = false; this.seedN = 1;
    this.inv = game.getInv();
    // 대회 단계에서 막 썬 양배추는 그대로 쓸 수 있다
    this.extra = {};
    if (st.mode === 'contest' && st.cabbage && !st.cabbage.prepped) this.extra.slaw = 2;
    const keys = PLATE_GARNISH[this.cat] || [];
    this.tray = keys.map((k) => ({ key: k, name: PREP[k].name, icon: PREP[k].icon }));
    if (this.cat === 'steak') this.tray.push({ key: 'sauce', name: '소스 붓', icon: '🖌️' });
  }

  left(key) { return (this.inv[key] || 0) + (this.extra[key] || 0); }
  take(key) { if (this.extra[key] > 0) this.extra[key]--; else this.inv[key] = Math.max(0, (this.inv[key] || 0) - 1); }
  giveBack(key) { this.inv[key] = (this.inv[key] || 0) + 1; }
  saveInv() { this.game.commitInv(this.inv); }

  enter() {
    const { ui } = this.game;
    this.game.instruct({
      icon: '🍽️', title: '플레이팅',
      lines: [
        this.mode === 'twirl' ? '먼저 접시 위에 <b>원을 그리며</b> 포크로 면을 돌돌 말아 담아요.' : '메인 요리가 접시에 올라왔어요.',
        '아래 쟁반에는 <b>준비대에서 손질해 둔 재료만</b> 나와요. 끌어다 놓으면 재료가 소모돼요.',
        '놓은 재료는 다시 끌어 옮기고, 두 손가락으로 돌릴 수 있어요. 접시 밖으로 빼면 쟁반으로 돌아가요.',
      ],
      button: '담기 시작',
    }).then(() => { this.active = true; });
    if (this.cat === 'steak') this.segSlice = ui.addSegment([{ key: 'sliced', label: '썰어서' }, { key: 'whole', label: '통째로' }], 'sliced', (k) => { this.sliced = k === 'sliced'; sfx.pop(); });
    if (this.game.state.quick || diff.autoPlate) ui.addButton('⚡ 자동', () => this.autoPlate(), 'secondary small');
    ui.addButton('⟳', () => this.rotateSel(), 'secondary small');
    ui.addButton('서빙 🛎️', () => this.finish());
    ui.hintAtTop(true);
    ui.setHint(this.mode === 'twirl' ? '접시 위에 원을 그려 면을 돌돌 말아요' : '손질해 둔 가니쉬를 끌어다 꾸며요');
  }

  /** 빠른 플레이팅: 레시피 권장 가니쉬 + 가진 재료로 보기 좋게 */
  autoPlate() {
    if (!this.active) return;
    if (this.twirl != null && this.twirl < 1) this.twirl = 0.85;
    this.mode = 'move';
    const want = this.game.state.dish?.wantGarnish || [];
    const spots = [[80, 60], [-82, 58], [90, -10], [-90, 0], [60, 90], [-60, 92]];
    let si = 0;
    const place = (key) => { if (this.left(key) <= 0 || si >= spots.length) return; this.take(key); const [x, y] = spots[si++]; this.items.push({ key, x, y, rot: (Math.random() - 0.5), seed: this.seedN++ }); };
    for (const k of want) place(k);
    for (const k of this.tray.map((t) => t.key)) if (k !== 'sauce' && this.items.length < 3) place(k);
    sfx.pop();
    this.saveInv();
  }

  layout() {
    const { W, H, S } = this.game;
    const trayH = 64 * S;
    const ctl = document.getElementById('controls');
    let ctlTop = H - 76;
    for (const el of ctl.children) ctlTop = Math.min(ctlTop, el.getBoundingClientRect().top);
    const rows = Math.ceil(this.tray.length / 5) || 1;
    const trayY = ctlTop - 10 - rows * trayH;
    const pr = Math.min(W * 0.46, H * 0.25, (trayY - 120 * S) / 2);
    return { cx: W / 2, cy: Math.min(H * 0.41, trayY - pr - 12 * S), pr, k: pr / PLATE_R, trayY, trayH, rows };
  }
  toLocal(x, y) { const { cx, cy, k } = this.layout(); return [(x - cx) / k, (y - cy) / k]; }

  trayHit(x, y) {
    const { W } = this.game;
    const { trayY, trayH, rows } = this.layout();
    if (y < trayY || y > trayY + trayH * rows) return null;
    const row = Math.floor((y - trayY) / trayH), col = Math.floor(x / (W / 5));
    return this.tray[row * 5 + col] || null;
  }

  hitItem(lx, ly) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (dist(lx, ly, it.x, it.y) < GARNISH_R[it.key] * 0.9 + 6) return it;
    }
    const m = this.main;
    if (this.cat === 'steak') {
      const c = Math.cos(-m.rot), sn = Math.sin(-m.rot);
      const dx = (lx - m.x) / STEAK_SCALE, dy = (ly - m.y) / STEAK_SCALE;
      if (pointInPoly(dx * c - dy * sn, dx * sn + dy * c, SHAPE)) return m;
    } else if (dist(lx, ly, m.x, m.y) < MAIN_R[this.cat]) return m;
    return null;
  }

  down(p) {
    if (!this.active || this.done) return;
    const [lx, ly] = this.toLocal(p.x, p.y);
    if (this.mode === 'twirl') { this.twirlAng = Math.atan2(ly - this.main.y, lx - this.main.x); return; }
    const t = this.trayHit(p.x, p.y);
    if (t) {
      if (t.key === 'sauce') { this.mode = this.mode === 'sauce' ? 'move' : 'sauce'; sfx.pop(); this.game.ui.setHint(this.mode === 'sauce' ? '접시 위에 손가락으로 소스를 그려요 (다시 누르면 종료)' : '손질해 둔 가니쉬를 끌어다 꾸며요'); return; }
      if (this.left(t.key) <= 0) { this.game.ui.toast('손질해 둔 재료가 없어요', { bad: true, sub: '준비대에서 손질하세요' }); return; }
      this.take(t.key);
      const it = { key: t.key, x: lx, y: ly - 20, rot: (Math.random() - 0.5) * 1.2, seed: this.seedN++, fresh: true };
      this.items.push(it);
      this.drag = { it, ox: 0, oy: -20 };
      this.selected = it;
      sfx.pop();
      return;
    }
    if (this.mode === 'sauce') {
      if (dist(lx, ly, 0, 0) < PLATE_R * 0.95 && this.sauceLen() < SAUCE_MAX) { this.curSauce = [[lx, ly]]; this.sauce.push(this.curSauce); }
      return;
    }
    const hit = this.hitItem(lx, ly);
    if (hit) {
      this.drag = { it: hit, ox: hit.x - lx, oy: hit.y - ly };
      this.selected = hit;
      if (hit !== this.main) { this.items.splice(this.items.indexOf(hit), 1); this.items.push(hit); }
      haptic('light');
    }
  }

  sauceLen() { return this.sauce.reduce((a, s) => a + pathLength(s), 0); }

  move(p) {
    const [lx, ly] = this.toLocal(p.x, p.y);
    if (this.mode === 'twirl' && this.twirlAng != null) {
      const a = Math.atan2(ly - this.main.y, lx - this.main.x);
      let d = a - this.twirlAng; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
      this.twirlAng = a;
      this.twirl = clamp(this.twirl + Math.abs(d) / (TAU * 3), 0, 1);
      if (this.twirl >= 1) { this.mode = 'move'; sfx.ding(); this.game.ui.toast('예쁘게 말았어요!', { ms: 800 }); this.game.ui.setHint('손질해 둔 가니쉬를 끌어다 꾸며요'); }
      return;
    }
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
    this.twirlAng = null;
    if (this.mode === 'twirl' && this.twirl > 0.3) { /* 계속 말 수 있음 */ }
    if (this.curSauce) { if (this.curSauce.length < 3) this.sauce.pop(); this.curSauce = null; return; }
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const it = d.it;
    it.fresh = false;
    const off = dist(it.x, it.y, 0, 0) > PLATE_R * 1.02;
    if (off && it !== this.main) {
      this.items.splice(this.items.indexOf(it), 1);
      this.giveBack(it.key);
      this.tossed.push({ ...it, life: 0.4 });
      if (this.selected === it) this.selected = null;
      sfx.whoosh();
    } else if (off && it === this.main) {
      it.x = clamp(it.x, -60, 60); it.y = clamp(it.y, -60, 60);
      sfx.place();
    } else sfx.place();
    this.saveInv();
  }

  cancelPointer() { this.drag = null; this.curSauce = null; }
  twist(da) { const it = this.selected || this.main; it.rot += da; }
  rotateSel() { const it = this.selected || this.main; it.rot += Math.PI / 6; sfx.pop(); }

  finish() {
    if (this.done) return;
    this.done = true;
    this.saveInv();
    this.game.state.plate = {
      items: this.items.map(({ key, x, y, rot, seed }) => ({ key, x, y, rot, seed })),
      sauce: this.sauce.map((s) => s.slice()),
      main: { ...this.main }, steak: { ...this.main },
      sliced: this.sliced, twirl: this.twirl,
      plateR: PLATE_R, steakScale: STEAK_SCALE, cat: this.cat,
    };
    sfx.ding();
    this.game.ui.toast('서빙!', { sub: '손님에게 가져가는 중…' });
    setTimeout(() => this.game.nextStage(), 800);
  }

  onTimeout() { this.game.ui.toast('시간 종료!', { bad: true, sub: '지금 상태로 서빙해요' }); this.finish(); }

  update(dt) {
    for (const t of this.tossed) { t.life -= dt; t.y += 400 * dt; }
    this.tossed = this.tossed.filter((t) => t.life > 0);
  }

  draw(g) {
    const { W, H, S, dpr, tex } = this.game;
    drawTable(g, W, H, dpr);
    const { cx, cy, pr, k, trayY, trayH, rows } = this.layout();
    drawPlate(g, cx, cy, pr, dpr);
    g.save();
    g.translate(cx, cy); g.scale(k, k);
    drawDish(g, tex, this.game.state, { main: this.main, sliced: this.sliced, items: this.items, sauce: this.sauce, twirl: this.twirl, selected: this.selected });
    if (this.mode === 'twirl') {
      g.strokeStyle = 'rgba(255,195,90,0.8)'; g.lineWidth = 2; g.setLineDash([6, 6]);
      g.beginPath(); g.arc(this.main.x, this.main.y, 60, 0, TAU * this.twirl + 0.01); g.stroke(); g.setLineDash([]);
    }
    for (const t of this.tossed) { g.save(); g.globalAlpha = clamp(t.life * 2.5, 0, 1); g.translate(t.x, t.y); g.rotate(t.rot); drawGarnish(g, t.key, { seed: t.seed, amount: this.cabbage.fineness }); g.restore(); }
    g.restore();
    // 쟁반 (손질해 둔 수량 표시)
    g.save();
    rr(g, 6, trayY - 6, W - 12, trayH * rows + 12, 18 * S);
    g.fillStyle = 'rgba(30,16,8,0.88)'; g.fill();
    const cw = W / 5;
    this.tray.forEach((t, i) => {
      const col = i % 5, row = Math.floor(i / 5);
      const x = col * cw + cw / 2, y = trayY + row * trayH + trayH * 0.42;
      const left = t.key === 'sauce' ? null : this.left(t.key);
      if (t.key === 'sauce' && this.mode === 'sauce') { rr(g, col * cw + 6, trayY + row * trayH + 2, cw - 12, trayH - 4, 12 * S); g.fillStyle = 'rgba(255,195,90,0.35)'; g.fill(); }
      g.save(); g.globalAlpha = left === 0 ? 0.28 : 1; g.translate(x, y);
      const sc = S * 0.95; g.scale(sc, sc);
      if (t.key === 'sauce') drawSauce(g, Array.from({ length: 12 }, (_, j) => [-20 + j * 3.6, Math.sin(j / 2) * 5]));
      else { const z = Math.min(1, 20 / GARNISH_R[t.key]); g.scale(z, z); drawGarnish(g, t.key, { seed: 3, amount: this.cabbage.fineness }); }
      g.restore();
      g.fillStyle = left === 0 ? '#8a7560' : '#f3e3cc'; g.font = `700 ${10 * S}px sans-serif`; g.textAlign = 'center';
      g.fillText(left == null ? t.name : `${t.name} ${left}`, x, trayY + row * trayH + trayH - 6 * S);
    });
    if (!this.tray.length) { g.fillStyle = '#d9c2a5'; g.font = `700 ${12 * S}px sans-serif`; g.textAlign = 'center'; g.fillText('준비해 둔 가니쉬가 없어요', W / 2, trayY + trayH / 2); }
    g.restore();
  }
}

/** 접시 위 요리 전체 그리기 (결과 화면에서도 사용). st = game.state */
export function drawDish(g, tex, st, { main, sliced, items, sauce, twirl, selected, steakScale = STEAK_SCALE }) {
  const cat = st.dish?.cat || 'steak';
  const cabbage = st.cabbage;
  for (const s of sauce || []) drawSauce(g, s);
  const under = items.filter((i) => i.key === 'slaw' || i.key === 'asparagus');
  const over = items.filter((i) => !(i.key === 'slaw' || i.key === 'asparagus'));
  for (const it of under) drawItem(g, it, cabbage, selected);
  g.save();
  g.translate(main.x, main.y); g.rotate(main.rot);
  if (cat === 'steak') {
    g.scale(steakScale, steakScale);
    const cook = st.cook || idealCook();
    if (sliced) drawSlicedSteak(g, tex, cook, { slices: 7 }); else drawWholeSteak(g, tex, cook);
  } else if (cat === 'pasta') {
    g.scale(1.3, 1.3);
    const sa = st.saute || { items: {}, emulsion: 0.6 };
    const key = st.dish.key;
    drawPastaNest(g, {
      sauce: key === 'carbonara' ? 'carbonara' : key === 'shrimppasta' ? 'tomato' : 'aglio',
      twirl: twirl ?? 0.8, emulsion: sa.emulsion ?? 0.6,
      toppings: {
        garlic: sa.items.garlic, chili: sa.hasChili, parsley: sa.hasParsley,
        shrimp: sa.items.shrimp != null ? 4 : 0, shrimpCook: sa.items.shrimp,
        tomato: sa.items.tomato != null ? 4 : 0,
        guanciale: sa.items.guanciale, pepper: st.whisk ? clamp(st.whisk.pepper / 1.5, 0.3, 1.5) : 0,
        cheese: !!st.whisk,
      },
      seed: 7,
    });
  } else if (cat === 'gambas') {
    const sa = st.saute || { items: {} };
    g.scale(0.85, 0.85);
    drawCazuela(g, { garlic: sa.items.garlic ?? 0.8, shrimpCook: sa.items.shrimp ?? 1, oil: clamp((sa.oil || 100) / 120, 0.3, 1.3), parsley: sa.hasParsley, chili: sa.hasChili });
  } else if (cat === 'lobster') {
    const sa = st.saute || { items: {} };
    g.rotate(-0.5); g.scale(0.78, 0.78);
    if (st.dish.key === 'thermidor') drawLobster(g, { cook: 1, split: 1, sauce: true, cheese: st.oven?.brown ?? 0.9 });
    else drawLobster(g, { cook: sa.items.lobster ?? 1, split: 1, glaze: 1.4 * (sa.baste ?? 0.5) });
  }
  g.restore();
  if (selected === main) {
    g.save(); g.strokeStyle = 'rgba(255,195,90,0.7)'; g.setLineDash([6, 5]); g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(main.x, main.y, cat === 'steak' ? 90 : MAIN_R[cat], cat === 'steak' ? 62 : MAIN_R[cat], main.rot, 0, TAU); g.stroke(); g.restore();
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
