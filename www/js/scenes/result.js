// 결과: 손님이 자르고, 맛보고, 평가한다
import { drawTable, drawPlate, drawCustomer } from '../art.js';
import { drawBigCrossSection } from '../dish.js';
import { drawDish, PLATE_R } from './plate.js';
import { computeScore } from '../score.js';
import { sfx, haptic } from '../audio.js';
import { clamp } from '../geom.js';
import { CUSTOMERS } from '../data.js';

export class ResultScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.res = computeScore(game.state);
    this.shown = false;
    this.chewSnd = 0;
    const st = game.state;
    this.hasDish = !!(st.cook);
    this.plate = st.plate || (st.cook ? { items: [], sauce: [], steak: { x: 0, y: 0, rot: 0 }, sliced: false } : null);
  }

  enter() {
    const st = this.game.state;
    this.game.saveBest(st.customer.id, this.res.total);
    if (!this.hasDish) { this.t = 5.5; }
  }

  phase() {
    if (!this.hasDish) return 'react';
    if (this.t < 1.0) return 'serve';
    if (this.t < 3.4) return 'cut';
    if (this.t < 5.2) return 'chew';
    return 'react';
  }

  update(dt) {
    this.t += dt;
    const ph = this.phase();
    if (ph === 'chew' && this.t - this.chewSnd > 0.32) { this.chewSnd = this.t; sfx.chew(); }
    if (ph === 'react' && !this.shown) {
      this.shown = true;
      if (this.res.total >= 75) { sfx.fanfare(); haptic('heavy'); } else if (this.res.total < 40) sfx.fail(); else sfx.ding();
      setTimeout(() => this.showCard(), 700);
    }
  }

  showCard() {
    const r = this.res, st = this.game.state, c = st.customer;
    const idx = CUSTOMERS.indexOf(c);
    const next = CUSTOMERS[idx + 1];
    const unlockedNext = next && r.total >= 60;
    const rows = r.parts.map((p) => `<div class="score-row"><span>${p.label}</span><span class="bar"><span class="fill" data-w="${(p.score / p.max) * 100}"></span></span><span class="num">${Math.round(p.score)}/${p.max}</span></div>`).join('');
    const notes = this.buildNotes();
    const card = this.game.ui.showCard(`
      <div class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
      <div class="total">${r.total}<span style="font-size:18px;color:var(--muted)"> 점</span></div>
      <div class="bubble">${c.face} “${r.comments[0]}”${r.comments.slice(1).map((x) => `<br>· ${x}`).join('')}</div>
      ${unlockedNext ? `<p class="tagline">🔓 새 손님 '${next.name}'이(가) 찾아왔어요!</p>` : ''}
      <div class="row">
        <button class="btn secondary" data-act="menu">손님 목록</button>
        <button class="btn" data-act="retry">다시 도전</button>
        ${unlockedNext ? '<button class="btn" data-act="next">다음 손님 ▶</button>' : ''}
      </div>
      <div class="score-rows">${rows}</div>
      <div class="notes">${notes}</div>`, {
      menu: () => this.game.toTitle(),
      retry: () => { this.game.ui.hideOverlay(); this.game.newRun(c.id); },
      next: () => { this.game.ui.hideOverlay(); this.game.newRun(next.id); },
    }, { bottom: true });
    requestAnimationFrame(() => card.querySelectorAll('.fill').forEach((f) => { f.style.width = `${f.dataset.w}%`; }));
  }

  buildNotes() {
    const st = this.game.state;
    const out = [];
    if (st.trim) out.push(`근막 제거 ${Math.round(st.trim.removed * 100)}% · 살코기 손상 ${Math.round(st.trim.damage)}mm`);
    if (st.cabbage) out.push(`양배추 ${st.cabbage.pieces}조각 · 가늘기 ${Math.round(st.cabbage.fineness * 100)}%`);
    if (st.season) out.push(`소금 ${st.season.salt.toFixed(1)}g · 후추 ${st.season.pepper.toFixed(1)}g · 오일 ${st.season.oil.toFixed(1)}ml · 고르기 ${Math.round(st.season.coverage * 100)}%`);
    if (st.cook) out.push(`중심 온도 ${st.cook.core.toFixed(1)}℃ (${this.res.doneness.name}) · 크러스트 ${st.cook.brown.map((b) => b.toFixed(2)).join(' / ')} · 뒤집기 ${st.cook.goodFlips}/${st.cook.flips}회, 접힘 ${st.cook.folds}회`);
    out.push(`남은 시간 ${Math.max(0, Math.ceil(st.timeLeft))}초`);
    return out.map((x) => `<div>${x}</div>`).join('');
  }

  draw(g) {
    const { W, H, S, dpr, tex, time } = this.game;
    drawTable(g, W, H, dpr);
    const st = this.game.state, c = st.customer;
    const ph = this.phase();
    const mood = ph === 'react' ? this.res.mood : ph === 'chew' ? 'neutral' : 'neutral';
    const chew = ph === 'chew' ? this.t : 0;
    const enter = clamp(this.t / 0.8, 0, 1);
    drawCustomer(g, c, W / 2, H * 0.14 - (1 - enter) * 40, S * 0.85, mood, chew, time);
    if (this.plate && this.hasDish) {
      const pr = Math.min(W * 0.4, H * 0.2);
      const cy = H * 0.44 + (1 - enter) * 120;
      drawPlate(g, W / 2, cy, pr, dpr);
      const k = pr / PLATE_R;
      g.save(); g.translate(W / 2, cy); g.scale(k, k);
      drawDish(g, tex, st.cook, { ...this.plate, cabbage: st.cabbage, selected: null, steakScale: this.plate.steakScale || 0.52 });
      g.restore();
      if (ph === 'cut' || ph === 'chew') this.drawCutPanel(g, ph === 'cut' ? clamp((this.t - 1.0) / 0.5, 0, 1) : clamp(1 - (this.t - 3.4) / 0.4, 0, 1));
    }
    if (ph === 'react') {
      const em = { love: '😍', happy: '😋', neutral: '🙂', meh: '😕', bad: '🤢', angry: '😠' }[this.res.mood];
      g.font = `${44 * S}px sans-serif`; g.textAlign = 'center';
      g.fillText(em, W / 2 + 70 * S, H * 0.1 + Math.sin(time * 4) * 4);
    }
  }

  drawCutPanel(g, a) {
    if (a <= 0) return;
    const { W, H, S } = this.game;
    const ck = this.game.state.cook;
    const L = W * 0.8, T = 70 * S;
    const x = (W - L) / 2, y = H * 0.66;
    g.save();
    g.globalAlpha = a;
    g.fillStyle = 'rgba(15,8,4,0.85)';
    g.beginPath(); g.roundRect ? g.roundRect(x - 14, y - 44 * S, L + 28, T + 74 * S, 18) : g.rect(x - 14, y - 44 * S, L + 28, T + 74 * S); g.fill();
    g.fillStyle = '#ffc35a'; g.font = `800 ${15 * S}px sans-serif`; g.textAlign = 'center';
    g.fillText('🔪 썰어보니…', W / 2, y - 20 * S);
    g.save(); g.translate(x, y);
    const reveal = clamp((this.t - 1.3) / 0.8, 0, 1);
    g.beginPath(); g.rect(0, -2, L * reveal, T + 4); g.clip();
    drawBigCrossSection(g, ck, L, T);
    g.restore();
    g.fillStyle = '#fff'; g.font = `800 ${16 * S}px sans-serif`;
    if (reveal >= 1) g.fillText(`${this.res.doneness.name} · ${ck.core.toFixed(1)}℃`, W / 2, y + T + 22 * S);
    g.restore();
  }
}
