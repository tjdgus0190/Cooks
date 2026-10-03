// 실시간 영업 홀: 손님·좌석·주방·주문표. 주문표를 눌러 직접 조리, 직원은 자동으로 일한다
import { drawCustomer, rr } from '../art.js';
import * as F from '../floor.js';
import * as E from '../economy.js';
import { PREP, orderName } from '../recipes.js';
import { sfx, haptic } from '../audio.js';
import { clamp, TAU } from '../geom.js';

export class HallScene {
  constructor(game) {
    this.game = game;
    this.day = game.day;
    this.floats = [];
    this.t = 0;
    this.sig = '';
    this.summaryShown = false;
  }
  get pausable() { return !this.summaryShown; }

  enter() {
    const ui = this.game.ui;
    ui.showHud(true);
    ui.setStage('', '', '');
    ui.addButton('🔪 준비대', () => this.openPrep(), 'secondary');
    ui.addButton('📦 재고', () => this.showInv(), 'secondary small');
    this.rail = document.createElement('div');
    this.rail.id = 'tickets';
    document.getElementById('hud').appendChild(this.rail);
    this.rail.addEventListener('click', (e) => {
      const b = e.target.closest('[data-uid]');
      if (b) this.take(Number(b.dataset.uid));
    });
    if (!this.game.save.flags.tut_hall) {
      this.game.timer.paused = true;
      ui.showCard(`<div class="icon">🏮</div><h2>영업 시작!</h2><ul>
        <li>손님이 앉으면 아래에 <b>주문표</b>가 생겨요. 막대는 손님의 <b>인내심</b>이에요.</li>
        <li><b>🔪 직접 조리</b>를 누르면 요리 시작! 요리하는 동안에도 가게 시간은 흘러요.</li>
        <li>고용한 직원은 일반 주문을 <b>자동으로</b> 맡아요. <b>⭐VIP</b>는 사장님만 상대해요.</li>
        <li>재료가 떨어지면 <b>🔪 준비대</b>에서 손질하세요. 손질한 만큼만 쓸 수 있어요.</li>
      </ul><div class="row"><button class="btn" data-act="go">알겠어요</button></div>`, { go: () => { ui.hideOverlay(); this.game.timer.paused = false; this.game.setFlag('tut_hall'); } });
    }
    this.syncDay();
  }
  exit() { this.rail?.remove(); }

  openPrep() {
    const ui = this.game.ui;
    this.game.timer.paused = false;
    ui.showCard(prepMenuHtml(this.game), {
      ...prepActions(this.game, () => this.game.toHall()),
      back: () => ui.hideOverlay(),
    }, { bottom: true });
  }

  showInv() {
    const inv = this.day.inv;
    const rows = Object.keys(PREP).filter((k) => inv[k] > 0).map((k) => `<div>${PREP[k].icon} ${PREP[k].name} <b>${inv[k]}</b>${PREP[k].unit}</div>`).join('') || '<div>손질해 둔 재료가 없어요</div>';
    this.game.ui.showCard(`<h2>📦 오늘의 재고</h2><div class="notes inv">${rows}</div><div class="row"><button class="btn" data-act="ok">닫기</button></div>`, { ok: () => this.game.ui.hideOverlay() }, { bottom: true });
  }

  take(uid) {
    const d = this.day;
    const c = d.customers.find((x) => x.uid === uid);
    if (!c) return;
    const miss = F.canCook(d, c);
    if (miss.length && !(c.assigned && c.assigned !== 'player')) { this.game.ui.toast('재료가 없어요', { bad: true, sub: `${miss.join(', ')} — 준비대에서 손질!` }); return; }
    if (!F.playerTake(d, uid)) return;
    sfx.pop(); haptic('light');
    this.game.startOrder({ mode: 'order', dishKey: c.dish.key, customer: c });
  }

  syncDay() { this.day = this.game.day; }

  update(dt) {
    this.t += dt;
    const d = this.day;
    if (!d) return;
    // 이벤트 → 떠다니는 글씨/알림
    for (const e of d.events.splice(0)) {
      const c = d.customers.find((x) => x.uid === e.uid);
      const seat = c ? this.seatPos(c.seat) : null;
      if (e.type === 'paid' && seat) { this.floats.push({ x: seat.x, y: seat.y - 40, text: `+${E.won(e.pay)}`, color: '#ffd25a', life: 1.6 }); sfx.pop(); }
      if (e.type === 'lost') { if (seat) this.floats.push({ x: seat.x, y: seat.y - 40, text: '😠', color: '#ff6b5b', life: 1.6 }); this.game.ui.notify(`😠 ${e.name}님이 기다리다 나갔어요`, 'bad'); sfx.fail(); }
      if (e.type === 'order' && c?.vip) this.game.ui.notify(`⭐ VIP ${c.name}님 — 사장님이 직접!`, 'vip');
      if (e.type === 'served' && e.by === 'staff' && seat) this.floats.push({ x: seat.x, y: seat.y - 30, text: `✨${e.score}`, color: '#bfe8a0', life: 1.2 });
      if (e.type === 'balk') this.game.ui.notify('🚶 자리가 없어 손님이 돌아갔어요');
    }
    for (const f of this.floats) { f.y -= dt * 28; f.life -= dt; }
    this.floats = this.floats.filter((f) => f.life > 0);
    // HUD
    const ui = this.game.ui;
    ui.setStage('🕐', '', F.clockText(d));
    ui.setOrder(`💰 ${E.won(d.stats.revenue)} · 손님 ${d.stats.served}명${d.stats.lost ? ` · 😠${d.stats.lost}` : ''}`);
    ui.setTimer(Math.max(0, d.length - d.t), d.length);
    this.renderTickets();
    if (d.done && !this.summaryShown) this.showSummary();
  }

  renderTickets() {
    const d = this.day;
    const ws = d.customers.filter((c) => c.state === 'waiting' || c.state === 'ordering');
    const sig = ws.map((c) => `${c.uid}:${c.state}:${c.assigned}:${F.canCook(d, c).length}:${d.playerJob}`).join('|');
    if (sig !== this.sig) {
      this.sig = sig;
      this.rail.innerHTML = ws.length ? ws.map((c) => {
        const staff = c.assigned && c.assigned !== 'player' ? d.staff.find((s) => s.id === c.assigned) : null;
        const miss = F.canCook(d, c);
        const btn = c.state === 'ordering' ? '<span class="tk-st">주문 중…</span>'
          : d.playerJob ? '<span class="tk-st">조리 대기</span>'
          : staff ? `<button class="tk-btn alt" data-uid="${c.uid}">🔪 가져오기</button>`
          : miss.length ? `<span class="tk-st warn">재료 부족: ${miss.join(', ')}</span>`
          : `<button class="tk-btn" data-uid="${c.uid}">🔪 직접 조리</button>`;
        return `<div class="ticket ${c.vip ? 'vip' : ''}" id="tk${c.uid}">
          <div class="tk-top"><span>${c.vip ? '⭐' : c.face}</span><b>${c.name}</b>${c.vip ? '<i>VIP</i>' : ''}</div>
          <div class="tk-dish">${c.dish.icon} ${c.dish.name}${c.order ? `<small>${orderName(c.order)}</small>` : ''}</div>
          <div class="tk-bar"><i></i></div>
          <div class="tk-staff">${staff ? `${staff.icon} ${staff.name} <span class="pct"></span>` : ''}</div>
          ${btn}
        </div>`;
      }).join('') : `<div class="ticket empty">${d.open ? '손님을 기다리는 중…' : '영업 종료 — 마지막 손님 응대 중'}</div>`;
    }
    for (const c of ws) {
      const el = document.getElementById(`tk${c.uid}`);
      if (!el) continue;
      const f = clamp(c.patience / c.patienceMax, 0, 1);
      const bar = el.querySelector('.tk-bar i');
      bar.style.width = `${f * 100}%`;
      bar.style.background = f > 0.5 ? 'var(--good)' : f > 0.25 ? 'var(--accent-2)' : 'var(--bad)';
      const staff = c.assigned && c.assigned !== 'player' ? d.staff.find((s) => s.id === c.assigned) : null;
      if (staff) { const p = el.querySelector('.pct'); if (p) p.textContent = `${Math.round((staff.jt / staff.time) * 100)}%`; }
    }
  }

  showSummary() {
    this.summaryShown = true;
    const d = this.day;
    const { biz, report } = E.endOfDay(this.game.save.biz, d.stats, d.inv);
    this.game.saveBiz(biz);
    this.game.day = null;
    this.game.ui.showHud(false);
    this.game.ui.clearControls();
    this.rail?.remove();
    const r = report;
    sfx[r.avgSat >= 70 ? 'fanfare' : 'ding']();
    this.game.ui.showCard(`
      <div class="icon">🌙</div><h2>${biz.day - 1}일차 영업 종료</h2>
      <div class="settle">
        손님 <b>${r.served}명</b> 응대 (사장님 ${r.byPlayer} · 직원 ${r.byStaff})${r.lost ? ` · <span class="down">놓친 손님 ${r.lost}명</span>` : ''}${r.balked ? ` · 자리 없어 돌아감 ${r.balked}` : ''}<br>
        평균 만족도 <b>${Math.round(r.avgSat)}</b> → 평판 <b>${biz.rep.toFixed(0)}</b> <span class="${r.repDelta >= 0 ? 'up' : 'down'}">(${r.repDelta >= 0 ? '▲' : '▼'}${Math.abs(r.repDelta).toFixed(1)})</span><br>
        매출 ${E.won(r.revenue)}${r.tips ? ` <span class="up">(팁 ${E.won(r.tips)})</span>` : ''}<br>
        재료비 −${E.won(r.cost)} · 인건비 −${E.won(r.wages)}<br>
        순이익 <b class="${r.profit >= 0 ? 'up' : 'down'}">${E.won(r.profit)}</b><br>
        ${r.spoiled ? `<span style="color:var(--muted)">남은 손질 재료 ${r.spoiled}개 폐기 (신선도)</span>` : ''}
      </div>
      ${r.lost >= 2 ? '<p class="tagline">손님을 많이 놓쳤어요. 직원을 고용하거나 준비대에서 재료를 넉넉히 손질해 두세요!</p>' : ''}
      <div class="row"><button class="btn" data-act="ok">가게 정비하기 ▶</button></div>`, { ok: () => this.game.toShop() });
  }

  // ---------------- 그리기 ----------------
  layoutSeats() {
    const { W, H } = this.game;
    const n = this.day?.seats || 3;
    const cols = n <= 3 ? 3 : n <= 6 ? 3 : 3;
    const rows = Math.ceil(n / cols);
    const top = H * 0.36, bottom = H * 0.66;
    return { n, cols, rows, top, bottom, cw: W / cols, rh: (bottom - top) / Math.max(1, rows) };
  }
  seatPos(i) {
    const L = this.layoutSeats();
    const col = i % L.cols, row = Math.floor(i / L.cols);
    return { x: L.cw * (col + 0.5), y: L.top + L.rh * (row + 0.55) };
  }

  draw(g) {
    const { W, H, S, time } = this.game;
    const d = this.day;
    // 바닥/벽
    const wall = g.createLinearGradient(0, 0, 0, H * 0.3);
    wall.addColorStop(0, '#3b2418'); wall.addColorStop(1, '#2a180f');
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    const fl = g.createLinearGradient(0, H * 0.3, 0, H);
    fl.addColorStop(0, '#6a4128'); fl.addColorStop(1, '#4a2b18');
    g.fillStyle = fl; g.fillRect(0, H * 0.3, W, H);
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
    for (let y = H * 0.3; y < H; y += 26 * S) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // 조명
    for (let i = 0; i < 3; i++) {
      const x = W * (0.2 + i * 0.3);
      const lg = g.createRadialGradient(x, H * 0.33, 5, x, H * 0.45, W * 0.4);
      lg.addColorStop(0, 'rgba(255,190,110,0.22)'); lg.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = lg; g.fillRect(0, H * 0.25, W, H * 0.6);
    }
    // 주방 카운터
    const ky = H * 0.16, kh = H * 0.12;
    g.fillStyle = '#20140e'; g.fillRect(0, ky - kh * 0.4, W, kh * 1.1);
    const ct = g.createLinearGradient(0, ky + kh * 0.5, 0, ky + kh * 0.75);
    ct.addColorStop(0, '#c9a27a'); ct.addColorStop(1, '#8a6040');
    g.fillStyle = ct; g.fillRect(0, ky + kh * 0.5, W, kh * 0.25);
    // 화구 불빛
    for (let i = 0; i < 4; i++) { const x = W * (0.15 + i * 0.23); g.fillStyle = `rgba(90,150,255,${0.25 + Math.sin(time * 9 + i) * 0.08})`; g.beginPath(); g.ellipse(x, ky + kh * 0.38, 22 * S, 6 * S, 0, 0, TAU); g.fill(); }
    // 직원 + 사장
    const staff = d?.staff || [];
    const people = [{ me: true }, ...staff];
    people.forEach((s, i) => {
      const x = W * ((i + 0.5) / Math.max(4, people.length));
      const y = ky + kh * 0.3;
      const busy = s.me ? !!d?.playerJob : !!s.job;
      g.save(); g.translate(x, y);
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, -10 * S, 12 * S, 6 * S, 0, 0, TAU); g.fill(); // 모자
      g.fillRect(-8 * S, -16 * S, 16 * S, 8 * S);
      g.fillStyle = '#f2c9a0'; g.beginPath(); g.arc(0, 0, 9 * S, 0, TAU); g.fill();
      g.fillStyle = s.me ? '#ff9f43' : '#e8e8e8'; rr(g, -12 * S, 9 * S, 24 * S, 16 * S, 6 * S); g.fill();
      if (busy && !s.me) {
        g.strokeStyle = '#7ed67a'; g.lineWidth = 3 * S;
        g.beginPath(); g.arc(0, 0, 15 * S, -Math.PI / 2, -Math.PI / 2 + TAU * (s.jt / s.time)); g.stroke();
      }
      g.fillStyle = '#fff'; g.font = `700 ${9 * S}px sans-serif`; g.textAlign = 'center';
      g.fillText(s.me ? '사장님' : s.name, 0, 36 * S);
      if (busy && Math.sin(time * 6 + i) > 0) { g.fillText('🔥', 14 * S, -12 * S); }
      g.restore();
    });
    // 좌석 + 손님
    if (d) {
      const L = this.layoutSeats();
      for (let i = 0; i < L.n; i++) {
        const p = this.seatPos(i);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(p.x + 3, p.y + 26 * S, 38 * S, 12 * S, 0, 0, TAU); g.fill();
        g.fillStyle = '#8a5a34'; g.beginPath(); g.ellipse(p.x, p.y + 20 * S, 36 * S, 13 * S, 0, 0, TAU); g.fill();
        g.fillStyle = '#a8724a'; g.beginPath(); g.ellipse(p.x, p.y + 17 * S, 36 * S, 12 * S, 0, 0, TAU); g.fill();
      }
      for (const c of d.customers) {
        if (c.seat < 0) continue;
        const p = this.seatPos(c.seat);
        const mood = c.state === 'leaving' && c.sat === 0 ? 'angry' : c.state === 'eating' ? (c.sat >= 85 ? 'love' : c.sat >= 65 ? 'happy' : c.sat >= 45 ? 'neutral' : 'bad') : c.state === 'waiting' && c.patience / c.patienceMax < 0.3 ? 'meh' : 'neutral';
        const walk = c.state === 'walking' ? (1 - c.st / 1.5) * 60 * S : 0;
        const leave = c.state === 'leaving' ? c.st * 50 * S : 0;
        g.save(); g.globalAlpha = c.state === 'leaving' ? clamp(1 - c.st / 1.5, 0, 1) : 1;
        drawCustomer(g, c, p.x, p.y - 22 * S + walk + leave, S * 0.28, mood, c.state === 'eating' ? this.t : 0, time);
        g.restore();
        if (c.state === 'eating') { g.fillStyle = '#f4f1ec'; g.beginPath(); g.ellipse(p.x, p.y + 15 * S, 14 * S, 5 * S, 0, 0, TAU); g.fill(); g.font = `${12 * S}px sans-serif`; g.textAlign = 'center'; g.fillText(c.dish.icon, p.x, p.y + 19 * S); }
        // 말풍선
        if (c.state === 'ordering' || c.state === 'waiting') {
          const bx = p.x + 26 * S, by = p.y - 52 * S;
          g.fillStyle = c.vip ? '#ffe28a' : '#fff4e2'; rr(g, bx - 16 * S, by - 14 * S, 32 * S, 26 * S, 8 * S); g.fill();
          g.font = `${15 * S}px sans-serif`; g.textAlign = 'center';
          g.fillText(c.state === 'ordering' ? '💬' : c.dish.icon, bx, by + 5 * S);
          if (c.state === 'waiting') {
            const f = clamp(c.patience / c.patienceMax, 0, 1);
            g.strokeStyle = f > 0.5 ? '#7ed67a' : f > 0.25 ? '#ffc35a' : '#ff6b5b'; g.lineWidth = 3 * S;
            g.beginPath(); g.arc(bx, by - 1 * S, 19 * S, -Math.PI / 2, -Math.PI / 2 + TAU * f); g.stroke();
            if (c.assigned === 'player') { g.fillText('🔪', bx + 20 * S, by - 14 * S); }
          }
        }
      }
      // 문 앞 대기
      d.door.forEach((c, i) => {
        g.save(); g.globalAlpha = 0.85;
        drawCustomer(g, c, 26 * S + i * 30 * S, H * 0.7, S * 0.22, 'meh', 0, time);
        g.restore();
      });
      g.fillStyle = '#d9c2a5'; g.font = `700 ${10 * S}px sans-serif`; g.textAlign = 'left';
      if (d.door.length) g.fillText('입구 대기', 10 * S, H * 0.7 - 34 * S);
    }
    for (const f of this.floats) {
      g.globalAlpha = clamp(f.life, 0, 1);
      g.fillStyle = f.color; g.font = `900 ${16 * S}px sans-serif`; g.textAlign = 'center';
      g.fillText(f.text, f.x, f.y);
      g.globalAlpha = 1;
    }
  }
}

/** 준비대 메뉴 (가게·홀 공용) */
export function relevantPrep(biz) {
  const set = new Set();
  for (const r of E.unlockedDishes(biz)) {
    for (const k of Object.keys(r.needs || {})) set.add(k);
    for (const k of (r.wantGarnish || [])) set.add(k);
  }
  if (E.unlockedDishes(biz).some((r) => r.cat === 'steak')) ['slaw', 'asparagus', 'rosemary', 'mushroom', 'tomato'].forEach((k) => set.add(k));
  return Object.keys(PREP).filter((k) => set.has(k));
}
export function prepMenuHtml(game) {
  const inv = game.getInv();
  const biz = game.save.biz;
  const users = (k) => E.unlockedDishes(biz).filter((r) => r.needs?.[k] || r.wantGarnish?.includes(k) || (r.cat === 'steak' && ['slaw', 'asparagus', 'rosemary', 'mushroom', 'tomato'].includes(k))).map((r) => r.icon).join('');
  const list = relevantPrep(biz).map((k, i) => `<button class="cust" data-act="p_${k}"><span class="face">${PREP[k].icon}</span><span class="info"><div class="name">${PREP[k].task}</div><div class="desc">쓰는 요리 ${users(k)}</div></span><span class="best">${inv[k] || 0}${PREP[k].unit}</span></button>`).join('');
  return `<h2>🔪 준비대</h2><p>여기서 손질한 만큼만 요리와 플레이팅에 쓸 수 있어요. ${game.day ? '<b style="color:var(--accent-2)">영업 중에도 시간은 흘러요!</b>' : ''}</p><div class="customers">${list}</div><div class="row"><button class="btn secondary" data-act="back">닫기</button></div>`;
}
export function prepActions(game, back) {
  const acts = {};
  for (const k of Object.keys(PREP)) acts[`p_${k}`] = () => game.prep(k, back);
  return acts;
}
