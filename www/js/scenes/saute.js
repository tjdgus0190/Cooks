// 팬 요리(소테): 레시피 스크립트를 순서대로 — 오일 붓기, 재료 넣기, 불 조절, 팬 토스(유화), 버터 베이스팅, 불 끄기
import { drawCounter, drawStoveAndPan, drawSteam } from '../art.js';
import { drawShrimp, drawGarlicSlice, drawGuancialeBit, drawParsleyBit, drawLobster } from '../food.js';
import { sfx, haptic, setSizzle } from '../audio.js';
import { onMotion, emitSwipeFlick, feedShake } from '../motion.js';
import { FLIP } from './cook.js';
import { clamp, TAU, rng } from '../geom.js';

const HEAT = { off: 25, low: 135, mid: 175, high: 220 };
// 재료별 익는 속도(게임 1초당, 기준 온도 160℃) — 마늘은 약불에서 천천히가 정석
const RATE = { garlic: 0.075, shrimp: 0.09, guanciale: 0.07, lobster: 0.06, shallot: 0.06, sauce: 0.05, tomato: 0.05 };
const TMIN = { garlic: 105, shrimp: 70, guanciale: 90, lobster: 70, shallot: 95, sauce: 80, tomato: 80 };
const LABEL = {
  oil: '🫒 오일', garlic: '🧄 마늘', chili: '🌶️ 페페론치노', pasta: '🍝 면', water: '🥄 면수', parsley: '🌿 파슬리', shrimp: '🦐 새우',
  guanciale: '🥓 관찰레', egg: '🥚 노른자 소스', tomato: '🍅 토마토', lobster: '🦞 랍스터', butter: '🧈 버터', shallot: '🧅 샬롯',
  wine: '🍷 화이트와인', cream: '🥛 생크림', mustard: '🟡 머스터드', meat: '🦞 랍스터 살',
};

export class SauteScene {
  constructor(game) {
    this.game = game;
    const step = game.state.stepCfg;
    this.script = step.script;
    this.idx = 0;
    this.heat = 'mid';
    this.pan = { temp: 150 };
    this.items = {};       // key → { cook }
    this.oil = 0; this.oilTarget = null;
    this.tossCount = 0; this.tossTarget = null; this.emulsion = 0; this.spill = 0;
    this.basteCount = 0; this.basteTarget = null;
    this.scrambled = false;
    this.pouring = false;
    this.air = null; this.gauge = null;
    this.steam = []; this.t = 0;
    this.R = rng(9);
    this.pos = {};
    this.done = false;
    this.boil = game.state.boil;
    this.whisk = game.state.whisk;
    for (const s of this.script) { if (s.act === 'pour') this.oilTarget = s.target; if (s.act === 'toss' && (s.k === 'toss')) this.tossTarget = s.count; if (s.act === 'baste') this.basteTarget = s.count; }
  }

  get cur() { return this.script[this.idx]; }

  enter() {
    const ui = this.game.ui;
    this.game.instruct({
      icon: '🍳', title: this.game.state.stepCfg.name,
      lines: [
        '아래 <b>순서대로</b> 재료를 넣어요. 다음 재료를 넣는 <b>타이밍</b>은 내가 정해요.',
        '마늘은 <b>약불</b>에서 천천히 노릇하게. 센 불이면 순식간에 타서 써져요.',
        '면수를 넣고 휴대폰을 <b>위로 튕겨</b>(또는 위로 쓸어올려) 팬을 흔들면 소스가 유화돼요.',
        '불 조절은 언제든 아래 버튼으로.',
      ],
    }).then(() => { this.active = true; });
    this.heatSeg = ui.addSegment([{ key: 'off', label: '끔' }, { key: 'low', label: '약' }, { key: 'mid', label: '중' }, { key: 'high', label: '강' }], this.heat, (k) => { this.setHeat(k); });
    this.actBtn = ui.addButton('', () => this.act());
    this.actBtn.addEventListener('pointerdown', () => { if (this.cur?.act === 'pour') this.pouring = true; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => this.actBtn.addEventListener(e, () => { this.pouring = false; }));
    this.tempMeter = ui.addMeter('팬 온도');
    this.progMeter = ui.addMeter('진행');
    this.off = onMotion((ev) => {
      if (!this.active || this.done) return;
      if (ev.type === 'flick') this.toss(ev.power);
      if (ev.type === 'shake' && this.cur?.act === 'pour') this.oil += ev.power * 0.25;
    });
    this.refresh();
  }
  exit() { this.off?.(); setSizzle(0); }

  setHeat(k) {
    this.heat = k; sfx.pop();
    if (k !== 'off' && this.items.egg) this.scramble();
  }

  refresh() {
    const c = this.cur;
    if (!c) { this.actBtn.innerHTML = '완성 ✓'; this.game.ui.setHint('다 됐으면 완성!'); return; }
    const lbl = { pour: '꾹 눌러 따르기', add: '넣기', toss: '팬 흔들기', baste: '끼얹기', off: '불 끄기' }[c.act];
    this.actBtn.innerHTML = c.act === 'pour' ? `${LABEL.oil} ${lbl} (${Math.round(this.oil)}ml)` : c.act === 'off' ? '🔥 불 끄기' : c.act === 'toss' ? `🍳 흔들기 ${this.tossCount}/${c.count}` : c.act === 'baste' ? `🥄 끼얹기 ${this.basteCount}/${c.count}` : `${LABEL[c.k] || c.k} ${lbl}`;
    this.game.ui.setHint(`${this.idx + 1}/${this.script.length} · ${c.label}`);
  }

  act() {
    if (!this.active || this.done || this.air) return;
    const c = this.cur;
    if (!c) return this.finish();
    if (c.act === 'pour') { if (this.oil < 5) this.oil += 10; return this.advance(); }
    if (c.act === 'off') { this.heatSeg.select('off'); this.heat = 'off'; sfx.pop(); return this.advance(); }
    if (c.act === 'toss') { this.game.ui.toast('휴대폰을 위로 휙! (또는 화면을 위로 쓸어올리기)', { ms: 1200 }); return; }
    if (c.act === 'baste') { this.baste(); return; }
    // add
    this.add(c.k);
    this.advance();
  }

  add(k) {
    sfx.splat(); haptic('light');
    if (['garlic', 'shrimp', 'guanciale', 'lobster', 'shallot', 'tomato'].includes(k)) this.items[k] = { cook: 0 };
    if (k === 'pasta') { this.items.pasta = { cook: 0 }; this.pan.temp -= 35; }
    if (k === 'water') { this.items.water = { cook: 0 }; this.pan.temp -= 25; if (!this.boil?.reserved) this.game.ui.toast('면수를 안 떠놔서 맹물을 넣었어요', { bad: true }); }
    if (k === 'cream' || k === 'wine') { this.items.sauce = this.items.sauce || { cook: 0 }; this.pan.temp -= 20; }
    if (k === 'egg') {
      this.items.egg = { cook: 0 };
      if (this.pan.temp > 75) this.scramble();
    }
    if (k === 'meat') this.items.lobster = { cook: 0.9 };
    if (k === 'butter') this.items.butter = { cook: 0 };
    if (k === 'chili' || k === 'parsley' || k === 'mustard') this.items[k] = { cook: 0 };
    if (k === 'shrimp' || k === 'lobster') this.pan.temp -= 15;
  }

  scramble() { if (!this.scrambled) { this.scrambled = true; sfx.fail(); this.game.ui.toast('앗, 계란이 익어버렸어요!', { bad: true, sub: '팬이 너무 뜨거워요' }); } }

  advance() { this.idx++; this.refresh(); this.progMeter.set(this.idx / this.script.length, `${this.idx}/${this.script.length}`); }

  toss(power) {
    const c = this.cur;
    if (!c || c.act !== 'toss' || this.air) return;
    let outcome = power < FLIP.min ? 'weak' : power > FLIP.max ? 'strong' : 'good';
    this.air = { t: 0, dur: 0.5, outcome };
    this.gauge = { power, t: 0 };
    sfx.whoosh(); haptic('medium');
  }

  landToss() {
    const a = this.air; this.air = null;
    sfx.splat(); haptic('heavy');
    if (a.outcome === 'weak') { this.game.ui.toast('조금 더 세게!', { bad: true, ms: 700 }); return; }
    if (a.outcome === 'strong') { this.spill += 0.08; this.game.ui.toast('너무 세서 흘렀어요!', { bad: true, ms: 800 }); }
    this.tossCount++;
    if (this.items.water || this.items.egg) this.emulsion = clamp(this.emulsion + (a.outcome === 'good' ? 0.27 : 0.12), 0, 1);
    if (this.items.shrimp && this.cur.k === 'flip') this.items.shrimp.flipped = (this.items.shrimp.flipped || 0) + 1;
    if (this.items.egg && this.pan.temp > 75) this.scramble();
    if (this.tossCount >= this.cur.count) { this.tossCount = 0; this.advance(); } else this.refresh();
  }

  baste() {
    this.basteCount++;
    sfx.pour(); haptic('light');
    if (this.items.lobster) this.items.lobster.cook += 0.04;
    for (let i = 0; i < 4; i++) this.steam.push({ x: (Math.random() - 0.5) * 60, y: (Math.random() - 0.5) * 60, r: 12, vy: -30, vx: 0, life: 0.6, alpha: 0.2 });
    if (this.basteCount >= this.cur.count) { this.basteCount = 0; this.basteDone = this.cur.count; this.advance(); } else this.refresh();
  }

  down(p) {
    this.swipe = { y: p.y, t: p.t, maxV: 0, ly: p.y, lt: p.t };
    if (this.cur?.act === 'baste' && this.active) this.baste();
  }
  move(p) {
    const s = this.swipe; if (!s) return;
    const v = -(p.y - s.ly) / Math.max(0.001, (p.t - s.lt) / 1000);
    if (v > s.maxV) s.maxV = v;
    s.ly = p.y; s.lt = p.t;
  }
  up(p) {
    const s = this.swipe; this.swipe = null; if (!s) return;
    const dy = s.y - p.y, dur = Math.max(1, p.t - s.t);
    if (dy > 50 * this.game.S && dur < 450) emitSwipeFlick(Math.max(dy / (dur / 1000), s.maxV * 0.7), this.game.S);
  }

  finish() {
    if (this.done) return;
    this.done = true;
    const cooks = {};
    for (const k of Object.keys(RATE)) if (this.items[k]) cooks[k] = this.items[k].cook;
    this.game.state.saute = {
      items: cooks, oil: this.oil, oilTarget: this.oilTarget,
      emulsion: this.emulsion, tossTarget: this.tossTarget, spill: this.spill,
      baste: this.basteTarget ? (this.basteDone || 0) / this.basteTarget : null,
      scrambled: this.scrambled,
      hasParsley: !!this.items.parsley, hasChili: !!this.items.chili,
    };
    setSizzle(0); sfx.ding();
    this.game.ui.toast('완성!', { ms: 700 });
    setTimeout(() => this.game.nextStage(), 700);
  }

  update(dt) {
    this.t += dt;
    if (!this.active || this.done) { setSizzle(0); return; }
    const target = HEAT[this.heat];
    this.pan.temp += (target - this.pan.temp) * (1 - Math.exp(-dt / (this.heat === 'off' ? 3 : 2.5)));
    if (this.pouring) { this.oil += dt * 35; this.refresh(); }
    const speed = this.game.state.quick ? 1.15 : 1;
    for (const [k, it] of Object.entries(this.items)) {
      if (!RATE[k]) continue;
      const f = clamp((this.pan.temp - TMIN[k]) / (160 - TMIN[k]), 0, 3);
      // 오일이 적으면 마늘이 더 빨리 탄다
      const oilF = k === 'garlic' && this.oilTarget ? clamp(1.4 - this.oil / this.oilTarget * 0.4, 0.9, 1.4) : 1;
      it.cook += RATE[k] * f * dt * speed * oilF;
    }
    if (this.items.egg && this.pan.temp > 82) this.scramble();
    if (this.air) { this.air.t += dt; if (this.air.t >= this.air.dur) this.landToss(); }
    if (this.gauge) { this.gauge.t += dt; if (this.gauge.t > 1.3) this.gauge = null; }
    const anything = Object.keys(this.items).length > 0 || this.oil > 0;
    const lvl = anything ? clamp((this.pan.temp - 90) / 130, 0, 1) : 0;
    setSizzle(lvl);
    if (Math.random() < dt * lvl * 10) this.steam.push({ x: (Math.random() - 0.5) * 160, y: (Math.random() - 0.5) * 120, r: 18, vy: -40, vx: 0, life: 1, alpha: 0.12 });
    for (const p of this.steam) { p.y += p.vy * dt; p.r += dt * 16; p.life -= dt * 0.8; }
    this.steam = this.steam.filter((p) => p.life > 0).slice(-60);
    this.tempMeter.set(this.pan.temp / 240, `${Math.round(this.pan.temp)}℃`);
    if (this.cur?.act === 'pour') this.refresh();
  }

  p(k, i) {
    const key = `${k}${i}`;
    if (!this.pos[key]) { const a = this.R() * TAU, d = Math.sqrt(this.R()) * 95; this.pos[key] = [Math.cos(a) * d, Math.sin(a) * d * 0.9, this.R() * TAU]; }
    return this.pos[key];
  }

  draw(g) {
    const { W, H, S, dpr, time } = this.game;
    drawCounter(g, W, H, dpr);
    const cx = W / 2, cy = H * 0.52, r = Math.min(W * 0.44, H * 0.25), k = (r * 1.5) / 250;
    drawStoveAndPan(g, cx, cy, r, { off: 0, low: 0.35, mid: 0.65, high: 1 }[this.heat], time, dpr, this.pan.temp);
    g.save();
    let lift = 0;
    if (this.air) lift = Math.sin((this.air.t / this.air.dur) * Math.PI) * 50 * (this.air.outcome === 'strong' ? 1.6 : this.air.outcome === 'weak' ? 0.4 : 1);
    g.translate(cx, cy - lift * S); g.scale(k, k);
    // 오일
    if (this.oil > 0) {
      const og = g.createRadialGradient(-20, -20, 5, 0, 0, 120);
      og.addColorStop(0, `rgba(255,220,110,${clamp(this.oil / 80, 0.15, 0.55)})`); og.addColorStop(1, 'rgba(200,150,40,0.05)');
      g.fillStyle = og; g.beginPath(); g.arc(0, 0, Math.min(125, 60 + this.oil), 0, TAU); g.fill();
    }
    if (this.items.butter) { g.fillStyle = 'rgba(255,230,150,0.45)'; g.beginPath(); g.arc(10, 10, 80, 0, TAU); g.fill(); for (let i = 0; i < 20; i++) { const [x, y] = this.p('bf', i); g.fillStyle = 'rgba(255,250,220,0.6)'; g.beginPath(); g.arc(x * 0.8, y * 0.8, 2 + Math.sin(time * 8 + i) * 1, 0, TAU); g.fill(); } }
    if (this.items.sauce) { const c = this.items.sauce.cook; g.fillStyle = `rgba(${248 - c * 20},${232 - c * 30},${190 - c * 50},0.9)`; g.beginPath(); g.arc(0, 0, 110, 0, TAU); g.fill(); }
    if (this.items.shallot) for (let i = 0; i < 30; i++) { const [x, y] = this.p('sh', i); const c = this.items.shallot.cook; g.fillStyle = `rgb(${236 - c * 30},${200 - c * 50},${210 - c * 90})`; g.fillRect(x, y, 3, 3); }
    if (this.items.pasta) this.drawPastaInPan(g);
    if (this.items.guanciale) for (let i = 0; i < 22; i++) { const [x, y, a] = this.p('gu', i); drawGuancialeBit(g, x, y, this.items.guanciale.cook, a); }
    if (this.items.garlic) for (let i = 0; i < 26; i++) { const [x, y, a] = this.p('ga', i); drawGarlicSlice(g, x, y, this.items.garlic.cook, a, 4.2); }
    if (this.items.tomato) for (let i = 0; i < 8; i++) { const [x, y] = this.p('to', i); const c = clamp(this.items.tomato.cook, 0, 1.2); g.fillStyle = `rgb(${226 - c * 30},${50 + c * 10},${30})`; g.beginPath(); g.arc(x, y, 9 - c * 2, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,140,110,0.8)'; g.beginPath(); g.arc(x, y, 6 - c * 2, 0, TAU); g.fill(); }
    if (this.items.shrimp) for (let i = 0; i < 6; i++) { const [x, y, a] = this.p('sp', i); g.save(); g.translate(x * 0.8, y * 0.8); g.rotate(a); g.scale(0.55, 0.55); drawShrimp(g, { cook: this.items.shrimp.cook, gloss: 1 }); g.restore(); }
    if (this.items.lobster && !this.items.sauce) { g.save(); g.rotate(0.4); g.scale(0.85, 0.85); drawLobster(g, { cook: this.items.lobster.cook, split: 1, glaze: this.basteCount / 8 + (this.basteDone ? 1 : 0) }); g.restore(); }
    if (this.items.lobster && this.items.sauce) for (let i = 0; i < 14; i++) { const [x, y, a] = this.p('lm', i); g.fillStyle = 'rgba(252,200,170,0.95)'; g.beginPath(); g.ellipse(x * 0.8, y * 0.8, 8, 5, a, 0, TAU); g.fill(); }
    if (this.items.mustard) { g.fillStyle = 'rgba(220,180,40,0.5)'; g.beginPath(); g.arc(20, -10, 14, 0, TAU); g.fill(); }
    if (this.items.chili) for (let i = 0; i < 10; i++) { const [x, y, a] = this.p('ch', i); g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#b81e10'; g.beginPath(); g.ellipse(0, 0, 6, 1.8, 0, 0, TAU); g.fill(); g.restore(); }
    if (this.items.egg) {
      for (let i = 0; i < 30; i++) {
        const [x, y] = this.p('eg', i);
        g.fillStyle = this.scrambled ? 'rgba(255,236,150,0.95)' : 'rgba(255,214,90,0.55)';
        g.beginPath(); g.arc(x * 0.7, y * 0.7, this.scrambled ? 4 + (i % 3) : 10, 0, TAU); g.fill();
      }
    }
    if (this.items.parsley) for (let i = 0; i < 40; i++) { const [x, y] = this.p('pa', i); drawParsleyBit(g, x, y, (i % 7) / 7); }
    drawSteam(g, this.steam);
    g.restore();
    if (this.gauge) this.drawGauge(g);
  }

  drawPastaInPan(g) {
    const R = rng(3);
    const sauceCol = this.items.egg ? [250, 214, 110] : this.items.tomato ? [236, 140, 90] : [246, 224, 160];
    g.lineCap = 'round';
    for (let i = 0; i < 80; i++) {
      const a = R() * TAU, d = R() * 90, len = 30 + R() * 50, b = R() * TAU;
      g.strokeStyle = `rgb(${sauceCol[0] - R() * 20},${sauceCol[1] - R() * 20},${sauceCol[2] - R() * 30})`;
      g.lineWidth = 2.2;
      g.beginPath();
      for (let s = 0; s <= 8; s++) { const t = s / 8; const x = Math.cos(a) * d + Math.cos(b + t * 2) * len * (t - 0.5); const y = Math.sin(a) * d * 0.9 + Math.sin(b + t * 2) * len * (t - 0.5); s ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    if (this.emulsion > 0.2) { g.fillStyle = `rgba(255,245,210,${this.emulsion * 0.25})`; g.beginPath(); g.arc(0, 0, 100, 0, TAU); g.fill(); }
  }

  drawGauge(g) {
    const { W, H, S } = this.game;
    const x0 = W * 0.12, x1 = W * 0.88, y = H * 0.8, maxP = 36;
    const px = (p) => x0 + (x1 - x0) * clamp(p / maxP, 0, 1);
    g.save(); g.globalAlpha = clamp((1.3 - this.gauge.t) * 2, 0, 1);
    g.fillStyle = '#c0392b'; g.fillRect(x0, y - 5 * S, x1 - x0, 10 * S);
    g.fillStyle = '#7ed67a'; g.fillRect(px(FLIP.min), y - 5 * S, px(FLIP.max) - px(FLIP.min), 10 * S);
    const mx = px(this.gauge.power);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(mx, y - 7 * S); g.lineTo(mx - 6 * S, y - 16 * S); g.lineTo(mx + 6 * S, y - 16 * S); g.fill();
    g.restore();
  }
}
