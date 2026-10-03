// 결과: 손님이 자르고, 맛보고, 평가한다
import { drawTable, drawPlate, drawCustomer } from '../art.js';
import { drawBigCrossSection } from '../dish.js';
import { drawDish, PLATE_R } from './plate.js';
import { computeScore } from '../score.js';
import { sfx, haptic } from '../audio.js';
import { clamp } from '../geom.js';
import * as E from '../economy.js';
import * as F from '../floor.js';

export class ResultScene {
  get pausable() { return false; }
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.res = computeScore(game.state);
    this.shown = false;
    this.chewSnd = 0;
    const st = game.state;
    this.hasDish = !!(st.cook || st.saute || st.boil);
    this.steak = st.dish?.cat === 'steak' && !!st.cook;
    this.quick = st.mode === 'order';
    this.plate = st.plate || (this.hasDish ? { items: [], sauce: [], main: { x: 0, y: 0, rot: 0 }, sliced: false } : null);
  }

  enter() {
    const st = this.game.state;
    this.game.saveBest(st.dish?.key || 'strip', this.res.total);
    // 영업/대회 정산 (한 번만, 즉시 저장)
    const biz = this.game.save.biz;
    if (st.mode === 'contest' && st.contest) {
      const rivals = E.rivalScores(st.contest);
      const out = E.settleContest(biz, st.contest, this.res.total, rivals);
      this.econ = { kind: 'contest', rivals, ...out };
      this.game.saveBiz(this.econ.biz);
    } else if (this.game.day) {
      // 영업 주문: 손님에게 서빙 → 만족도·결제 (마감 때 정산)
      const pay = F.playerFinish(this.game.day, st.customer.uid, this.res.total);
      this.econ = { kind: 'order', pay };
    } else this.econ = { kind: 'none' };
    if (!this.hasDish) { this.t = 5.5; }
  }

  phase() {
    if (!this.hasDish) return 'react';
    if (this.quick || !this.steak) {
      // 빠른 결과: 서빙 → (스테이크는 단면) → 시식 → 반응
      if (this.t < 0.5) return 'serve';
      if (this.steak && this.t < 2.0) return 'cut';
      if (this.t < (this.steak ? 2.8 : 1.6)) return 'chew';
      return 'react';
    }
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
      setTimeout(() => this.showCard(), this.quick ? 250 : 700);
    }
  }

  showCard() {
    const r = this.res, st = this.game.state, c = st.customer;
    const rows = r.parts.map((p) => `<div class="score-row"><span>${p.label}</span><span class="bar"><span class="fill" data-w="${(p.score / p.max) * 100}"></span></span><span class="num">${Math.round(p.score)}/${p.max}</span></div>`).join('');
    const notes = this.buildNotes();
    const ec = this.econ;
    let econHtml = '', buttons = '';
    if (ec.kind === 'order') {
      const p = ec.pay;
      econHtml = p ? `<div class="settle">고객 만족도 <b>${p.sat}</b>${p.sat < this.res.total - 3 ? ' <span class="down">(오래 기다렸거나 가격이 비싸다고 느낌)</span>' : ''}<br>결제 <b class="up">${E.won(p.pay)}</b>${p.tipRate ? ` <span class="up">(팁 +${Math.round(p.tipRate * 100)}%)</span>` : ''}</div>`
        : '<div class="settle"><span class="down">손님이 이미 떠났어요…</span></div>';
      buttons = '<button class="btn" data-act="hall">홀로 돌아가기 ▶</button>';
    } else if (ec.kind === 'none') {
      buttons = '<button class="btn" data-act="shop">가게로</button>';
    } else if (ec.kind === 'service') {
      const rp = ec.report;
      const pe = Math.round(E.priceEffect(rp.price, rp.fair));
      const verdict = { expensive: '😟 “맛은 있는데 가격이 좀…” 손님들이 비싸다고 느꼈어요. 단가를 내리거나 평판을 더 쌓아보세요.', cheap: '🤑 “이 가격에 이 맛이?!” 너무 싸게 팔고 있어요. 단가를 올려도 괜찮아요.', fair: '🙂 가격이 적당하다는 반응이에요.' }[rp.priceVerdict];
      econHtml = `<div class="settle">
        <b>오늘의 정산</b> · ${this.game.save.biz.day - 1}일차<br>
        고객 만족도 <b>${rp.sat}</b> <span style="color:var(--muted)">(요리 ${r.total} ${pe >= 0 ? '+' : '−'} 가격 ${Math.abs(pe)})</span><br>
        방문 손님 <b>${rp.vis}명</b>${rp.fameMult > 1 ? ` <span class="up">🔥 대회 효과 ×${rp.fameMult.toFixed(2)}</span>` : ''}<br>
        매출 ${E.won(rp.revenue)}${rp.tipRate ? ` <span class="up">(팁 +${rp.tipRate * 100}%)</span>` : ''} − 재료비 ${E.won(rp.cost)} = <b class="${rp.profit >= 0 ? 'up' : 'down'}">${E.won(rp.profit)}</b><br>
        평판 <b>${ec.biz.rep.toFixed(0)}</b> <span class="${rp.repDelta >= 0 ? 'up' : 'down'}">(${rp.repDelta >= 0 ? '▲' : '▼'}${Math.abs(rp.repDelta).toFixed(1)})</span>
      </div><p style="font-size:13.5px">${verdict}</p>`;
      buttons = `<button class="btn secondary" data-act="shop">가게로</button><button class="btn" data-act="again">다음 영업 ▶</button>`;
    } else {
      const rp = ec.report;
      const entries = [...ec.rivals.map((sc, i) => ({ name: `참가자 ${String.fromCharCode(65 + i)}`, sc })), { name: '나', sc: r.total, me: true }]
        .sort((a, b) => b.sc - a.sc || (a.me ? -1 : 1));
      const rank = entries.map((e, i) => `<div class="${e.me ? 'me' : ''}"><span>${['🥇', '🥈', '🥉'][i] || `${i + 1}위`} ${e.name}</span><span>${e.sc}점</span></div>`).join('');
      econHtml = `<div class="rank">${rank}</div><div class="settle">${rp.medal
        ? `<b>${rp.place}위 입상!</b> 상금 <b class="up">${E.won(rp.prize)}</b><br>🔥 소문이 퍼져 5일간 손님 <b>×${rp.fameMult}</b> · 평판 <span class="up">+${rp.repGain}</span>`
        : `<b>${rp.place}위</b> — 아쉽게 입상하지 못했어요. 참가비 ${E.won(rp.fee)} 손실 · 평판 <span class="down">${rp.repGain}</span>`}</div>`;
      buttons = `<button class="btn" data-act="shop">가게로</button>`;
    }
    const card = this.game.ui.showCard(`
      <div class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
      <div class="total">${r.total}<span style="font-size:18px;color:var(--muted)"> 점</span></div>
      <div class="bubble">${c.face} “${r.comments[0]}”${r.comments.slice(1).map((x) => `<br>· ${x}`).join('')}</div>
      ${econHtml}
      <div class="row">${buttons}</div>
      <div class="score-rows">${rows}</div>
      <div class="notes">${notes}</div>`, {
      shop: () => this.game.toShop(),
      hall: () => this.game.toHall(),
      again: () => { this.game.toShop(); this.game.scene.chooseDish?.(); },
    }, { bottom: true });
    requestAnimationFrame(() => card.querySelectorAll('.fill').forEach((f) => { f.style.width = `${f.dataset.w}%`; }));
  }

  buildNotes() {
    const st = this.game.state;
    const out = [];
    if (st.trim) out.push(`${{ steak: '근막 제거', shrimp: '내장 제거', lobster: '절개' }[st.trim.subject || 'steak']} ${Math.round(st.trim.removed * 100)}% · 살 손상 ${Math.round(st.trim.damage)}mm`);
    if (st.cabbage) out.push(`양배추 ${st.cabbage.pieces}조각 · 가늘기 ${Math.round(st.cabbage.fineness * 100)}%`);
    if (st.season) out.push(`소금 ${st.season.salt.toFixed(1)}g · 후추 ${st.season.pepper.toFixed(1)}g · 오일 ${st.season.oil.toFixed(1)}ml · 고르기 ${Math.round(st.season.coverage * 100)}%`);
    if (st.cook) out.push(`중심 온도 ${st.cook.core.toFixed(1)}℃ (${this.res.doneness.name}) · 크러스트 ${st.cook.brown.map((b) => b.toFixed(2)).join(' / ')} · 뒤집기 ${st.cook.goodFlips}/${st.cook.flips}회, 접힘 ${st.cook.folds}회`);
    if (st.boil) out.push(`${st.boil.item === 'spaghetti' ? '면' : '랍스터'} ${st.boil.minutes.toFixed(1)}분 삶음 (포장지 ${st.boil.pkgMin}분) · 소금 ${st.boil.salt.toFixed(0)}g${st.boil.item === 'spaghetti' ? ` · 면수 ${st.boil.reserved ? '✓' : '✗'}` : ''}`);
    if (st.whisk) out.push(`페코리노 ${st.whisk.cheese.toFixed(0)}g · 후추 ${st.whisk.pepper.toFixed(1)}g · 섞임 ${Math.round(st.whisk.mix * 100)}%`);
    if (st.saute) out.push(`팬: ${Object.entries(st.saute.items).map(([k, v]) => `${{ garlic: '마늘', shrimp: '새우', guanciale: '관찰레', lobster: '랍스터', shallot: '샬롯', sauce: '소스', tomato: '토마토' }[k] || k} ${v.toFixed(2)}`).join(' · ')}${st.saute.tossTarget ? ` · 유화 ${Math.round(st.saute.emulsion * 100)}%` : ''}${st.saute.scrambled ? ' · 계란 익음' : ''}`);
    if (st.oven) out.push(`치즈 갈변 ${st.oven.brown.toFixed(2)}`);
    if (st.mode !== 'order') out.push(`남은 시간 ${Math.max(0, Math.ceil(st.timeLeft))}초`);
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
      drawDish(g, tex, st, { ...this.plate, main: this.plate.main || this.plate.steak, selected: null, steakScale: this.plate.steakScale || 0.52 });
      g.restore();
      if (this.steak && (ph === 'cut' || ph === 'chew')) { const c0 = this.quick || !this.steak ? 0.5 : 1.0, c1 = this.quick ? 2.0 : 3.4; this.drawCutPanel(g, ph === 'cut' ? clamp((this.t - c0) / 0.4, 0, 1) : clamp(1 - (this.t - c1) / 0.4, 0, 1)); }
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
    const reveal = clamp((this.t - (this.quick ? 0.7 : 1.3)) / (this.quick ? 0.6 : 0.8), 0, 1);
    g.beginPath(); g.rect(0, -2, L * reveal, T + 4); g.clip();
    drawBigCrossSection(g, ck, L, T);
    g.restore();
    g.fillStyle = '#fff'; g.font = `800 ${16 * S}px sans-serif`;
    if (reveal >= 1) g.fillText(`${this.res.doneness.name} · ${ck.core.toFixed(1)}℃`, W / 2, y + T + 22 * S);
    g.restore();
  }
}
