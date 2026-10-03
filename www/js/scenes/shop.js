// 가게 허브: 영업·메뉴판(가격)·요리대회·확장
import { drawCounter, rr } from '../art.js';
import * as E from '../economy.js';
import { motion } from '../motion.js';
import { PREP } from '../recipes.js';
import { prepMenuHtml, prepActions } from './hall.js';
import { sfx } from '../audio.js';

const LOOK = [
  { wall: '#3a2a20', sign: '#ff9f43', awning: ['#e8553d', '#f6e3c3'], light: 'rgba(255,170,80,0.35)' },
  { wall: '#5a3d2a', sign: '#ffd27a', awning: ['#2f6b4f', '#f3ead8'], light: 'rgba(255,200,120,0.35)' },
  { wall: '#5b2a22', sign: '#ff6a4d', awning: ['#7a1f1f', '#2b1a14'], light: 'rgba(255,120,80,0.4)' },
  { wall: '#151312', sign: '#e8c070', awning: ['#111', '#c9a54a'], light: 'rgba(255,220,150,0.3)' },
];

export class ShopScene {
  constructor(game) { this.game = game; this.t = 0; this.people = []; }

  get biz() { return this.game.save.biz; }
  set biz(b) { this.game.saveBiz(b); }

  enter() { this.showMain(); }

  // ---------------- 메인 ----------------
  showMain() {
    const b = this.biz, shop = E.shopInfo(b), ui = this.game.ui;
    const up = E.upgradeStatus(b);
    const fame = b.fame.mult > 1 ? `<span class="pill hot">🔥 명성 ×${b.fame.mult.toFixed(2)} · ${b.fame.days}일</span>` : '';
    const medals = b.medals.length ? `<span class="pill">🏅 ${b.medals.length}</span>` : '';
    const inv = b.inventory || {};
    const invTxt = Object.keys(PREP).filter((k) => inv[k] > 0).map((k) => `${PREP[k].icon}${inv[k]}`).join(' ') || '없음 — 영업 전에 손질해 두세요!';
    const hist = b.history.slice(-3).reverse().map((h) => `<div>${h.day}일차 · 손님 ${h.served ?? h.vis ?? 0}명${h.lost ? ` (놓침 ${h.lost})` : ''} · 만족 ${h.sat} · ${h.profit >= 0 ? '+' : ''}${E.won(h.profit)}</div>`).join('');
    ui.showCard(`
      <div class="shop-head"><div><div class="shop-name">${shop.name}</div><div class="shop-sub">${b.day}일차 아침 · 좌석 ${shop.seats} · 직원 ${b.staff.length}/${shop.staffSlots}</div></div>${medals}</div>
      <div class="stat-grid">
        <div class="stat"><div class="k">자금</div><div class="v">${E.won(b.money)}</div></div>
        <div class="stat"><div class="k">평판 (고객 만족도)</div><div class="v">${b.rep.toFixed(0)}<small>/100</small></div><div class="mini"><i style="width:${b.rep}%"></i></div></div>
      </div>
      ${fame}
      <div class="inv-line">📦 손질 재료: ${invTxt}</div>
      <div class="menu-grid">
        <button class="btn big" data-act="open">🏮 ${b.day}일차 영업 시작</button>
        <button class="btn secondary" data-act="prep">🔪 준비대</button>
        <button class="btn secondary" data-act="staff">👥 직원</button>
        <button class="btn secondary" data-act="menu">📋 메뉴판·가격</button>
        <button class="btn secondary" data-act="contest">🏆 요리대회</button>
        <button class="btn secondary" data-act="upgrade">🏗️ 가게 확장${up.ok ? ' <span class="dot"></span>' : ''}</button>
        <button class="btn secondary" data-act="settings">⚙️ 설정</button>
      </div>
      ${hist ? `<div class="notes">${hist}</div>` : '<p class="tagline">영업 전에 준비대에서 재료를 손질해 두면 바쁜 시간에 덜 허둥대요!</p>'}`, {
      open: () => this.openDay(),
      prep: () => this.showPrep(),
      staff: () => this.showStaff(),
      menu: () => this.showMenu(),
      contest: () => this.showContests(),
      upgrade: () => this.showUpgrade(),
      settings: () => this.game.showSettings(() => this.showMain()),
    }, { bottom: true });
  }

  onBack() { this.game.toTitle(); return true; }

  async openDay() {
    await this.game.enableMotion();
    sfx.ding();
    this.game.ui.toast(`${this.biz.day}일차 영업 시작!`, { sub: '🏮 OPEN', ms: 1200 });
    this.game.openDay();
  }

  showPrep() {
    this.game.ui.showCard(prepMenuHtml(this.game), { ...prepActions(this.game, () => { this.game.toShop(); this.game.scene.showPrep(); }), back: () => this.showMain() }, { bottom: true });
  }

  // ---------------- 직원 ----------------
  showStaff() {
    const b = this.biz;
    const actions = { back: () => this.showMain() };
    const hired = b.staff.map((st, i) => {
      const t = E.staffTier(st.tier);
      actions[`f${i}`] = () => { this.biz = E.fire(this.biz, st.id); sfx.pop(); this.showStaff(); };
      return `<div class="price-row"><div class="pinfo"><div class="name">${t.icon} ${t.name}</div><div class="desc">솜씨 ${t.skill} · 주문당 ${t.time}초 · 일당 ${E.won(t.wage)}</div></div><button class="btn secondary small" data-act="f${i}">내보내기</button></div>`;
    }).join('') || '<p>아직 직원이 없어요. 혼자서는 손님을 다 받기 힘들어요!</p>';
    const tiers = E.STAFF_TIERS.map((t, i) => {
      const st = E.canHire(b, t.key);
      actions[`h${i}`] = () => { this.biz = E.hire(this.biz, t.key); sfx.fanfare(); this.game.ui.toast(`${t.name} 채용!`); this.showStaff(); };
      return `<button class="cust" data-act="h${i}" ${st.ok ? '' : 'disabled'}><span class="face">${t.icon}</span><span class="info"><div class="name">${t.name}</div><div class="desc">${st.ok ? `솜씨 ${t.skill} · 주문당 ${t.time}초 · 일당 ${E.won(t.wage)}` : st.why}</div></span><span class="best">채용<br>${E.won(t.hire)}</span></button>`;
    }).join('');
    this.game.ui.showCard(`<h2>👥 직원</h2><p>직원은 사장님이 안 맡은 <b>일반 주문</b>을 자동으로 요리해요. 솜씨는 사장님보다 낮고, <b>VIP는 못 맡아요</b>. 손질 재료가 없으면 직원도 요리할 수 없어요.</p>${hired}<h2 style="margin-top:14px">채용하기</h2><div class="customers">${tiers}</div><div class="row"><button class="btn" data-act="back">완료</button></div>`, actions, { bottom: true });
  }

  // ---------------- 메뉴판 ----------------
  showMenu() {
    const b = this.biz;
    const actions = { back: () => this.showMain() };
    const rows = E.unlockedDishes(b).map((d, i) => {
      const price = b.prices[d.key] ?? d.base;
      const fair = E.fairPrice(b, d);
      const eff = Math.round(E.priceEffect(price, fair));
      const mood = eff <= -15 ? ['😡', '너무 비싸요!'] : eff <= -4 ? ['😟', '좀 비싼데…'] : eff >= 4 ? ['🤑', '완전 싸다!'] : ['🙂', '적당해요'];
      const step = d.base >= 100000 ? 5000 : 1000;
      actions[`m${i}`] = () => this.setPrice(d, price - step);
      actions[`p${i}`] = () => this.setPrice(d, price + step);
      return `<div class="price-row">
        <div class="pinfo"><div class="name">${d.icon} ${d.name}</div><div class="desc">손님 반응 ${mood[0]} ${mood[1]} · 만족도 ${eff >= 0 ? '+' : ''}${eff} · 예상 ${E.visitors(b, price, fair)}명</div></div>
        <div class="stepper"><button data-act="m${i}">−</button><span>${E.won(price)}</span><button data-act="p${i}">+</button></div>
      </div>`;
    }).join('');
    this.game.ui.showCard(`<h2>📋 메뉴판</h2><p>평판이 높을수록 손님이 기꺼이 내는 금액이 올라가요.<br>비싸면 손님이 줄고 만족도가 떨어져 평판이 깎여요.</p>${rows}<div class="row"><button class="btn" data-act="back">완료</button></div>`, actions, { bottom: true });
  }

  setPrice(d, p) {
    const b = this.biz;
    this.biz = { ...b, prices: { ...b.prices, [d.key]: Math.max(Math.round(d.base * 0.5), Math.min(d.base * 3, p)) } };
    sfx.pop();
    this.showMenu();
  }

  // ---------------- 대회 ----------------
  showContests() {
    const b = this.biz;
    const actions = { back: () => this.showMain() };
    const list = E.CONTESTS.map((c, i) => {
      const st = E.contestStatus(b, c);
      const best = b.medals.filter((m) => m.contest === c.key).reduce((a, m) => Math.min(a, m.place), 9);
      actions[`c${i}`] = () => this.contestIntro(c);
      return `<button class="cust" data-act="c${i}" ${st.ok ? '' : 'disabled'}><span class="face">${['🥉', '🥈', '🥇', '🏆'][i]}</span>
        <span class="info"><div class="name">${c.name}</div><div class="desc">${st.ok ? `참가비 ${E.won(c.fee)} · 우승 상금 ${E.won(c.prizes[0])}` : st.why}</div></span>
        <span class="best">${best < 9 ? `최고 ${best}위` : ''}</span></button>`;
    }).join('');
    this.game.ui.showCard(`<h2>🏆 요리대회</h2><p>입상하면 상금과 함께 <b style="color:var(--cream)">명성</b>이 올라 며칠간 손님이 몰려와요. 대회 날은 가게가 쉬어요.</p><div class="customers">${list}</div><div class="row"><button class="btn secondary" data-act="back">뒤로</button></div>`, actions, { bottom: true });
  }

  contestIntro(c) {
    const judge = E.contestJudge(c);
    const dish = E.dishByKey(c.dish);
    this.game.ui.showCard(`
      <div class="icon">🏆</div><h2>${c.name}</h2>
      <div class="bubble">🧑‍⚖️ “${judge.line}”</div>
      <ul>
        <li>과제 요리: <b>${dish.icon} ${dish.name}</b></li>
        <li>제한 시간 <b>${Math.floor(c.time / 60)}분 ${c.time % 60 ? `${c.time % 60}초` : ''}</b> · 힌트 없음 · 심사 엄격도 ×${c.strict}</li>
        <li>필요한 손질 재료: ${Object.keys(dish.needs || {}).map((k) => `${PREP[k].icon}${PREP[k].name}`).join(', ') || '없음'} (가게 재고에서 사용)</li>
        <li>경쟁자 5명과 점수로 순위를 겨뤄요. 3위 안에 들면 입상!</li>
        <li>상금 🥇${E.won(c.prizes[0])} 🥈${E.won(c.prizes[1])} 🥉${E.won(c.prizes[2])}</li>
        <li>우승 시 ${5}일간 손님 ×${c.fame[0]}</li>
      </ul>
      <div class="row"><button class="btn secondary" data-act="back">뒤로</button><button class="btn" data-act="go">참가 (${E.won(c.fee)})</button></div>`, {
      back: () => this.showContests(),
      go: async () => {
        await this.game.enableMotion(); this.game.ui.hideOverlay();
        this.game.startOrder({ mode: 'contest', dishKey: c.dish, customer: judge, contest: c });
      },
    }, { bottom: true });
  }

  // ---------------- 확장 ----------------
  showUpgrade() {
    const b = this.biz;
    const st = E.upgradeStatus(b);
    if (st.max) {
      this.game.ui.showCard(`<div class="icon">👑</div><h2>최고 단계 달성!</h2><p>이제 월드 그릴 마스터즈 우승과 평판 100에 도전해보세요.</p><div class="row"><button class="btn" data-act="back">뒤로</button></div>`, { back: () => this.showMain() }, { bottom: true });
      return;
    }
    const n = st.next;
    const dish = E.DISHES.find((d) => d.level === n.level);
    const medalNeed = n.needMedal ? E.CONTESTS.find((c) => c.key === n.needMedal).name : null;
    const check = (ok, txt) => `<li>${ok ? '✅' : '⬜'} ${txt}</li>`;
    const hasMedal = !n.needMedal || !st.lacks.some((l) => l.includes('입상'));
    this.game.ui.showCard(`
      <div class="icon">🏗️</div><h2>${n.name}(으)로 확장</h2>
      <ul>
        ${check(b.money >= n.cost, `자금 ${E.won(n.cost)} (보유 ${E.won(b.money)})`)}
        ${check(b.rep >= n.needRep, `평판 ${n.needRep} 이상 (현재 ${b.rep.toFixed(0)})`)}
        ${medalNeed ? check(hasMedal, `${medalNeed} 3위 이내 입상`) : ''}
      </ul>
      <p>확장하면 🍽️ <b style="color:var(--cream)">${dish.icon} ${dish.name}</b> 해금 (기본가 ${E.won(dish.base)}), 하루 손님 수와 적정 단가가 올라가요.</p>
      <div class="row"><button class="btn secondary" data-act="back">뒤로</button><button class="btn" data-act="go" ${st.ok ? '' : 'disabled'}>확장하기</button></div>`, {
      back: () => this.showMain(),
      go: () => {
        this.biz = E.upgrade(b);
        sfx.fanfare();
        this.game.ui.toast(`${n.name} 오픈!`, { sub: `${dish.name} 메뉴 추가`, ms: 1800 });
        this.showMain();
      },
    }, { bottom: true });
  }

  update(dt) {
    this.t += dt;
    const b = this.biz;
    const want = Math.min(9, Math.round(2 + b.rep / 20 + (b.fame.mult - 1) * 8));
    if (this.people.length < want && Math.random() < dt * 1.5) this.people.push({ x: -0.1, speed: 0.06 + Math.random() * 0.05, hue: Math.random() * 360, bob: Math.random() * 6 });
    for (const p of this.people) p.x += p.speed * dt;
    this.people = this.people.filter((p) => p.x < 1.1);
  }

  draw(g) {
    const { W, H, S, dpr } = this.game;
    drawCounter(g, W, H, dpr);
    const b = this.biz, lv = b.level, L = LOOK[lv - 1];
    const cx = W / 2, top = H * 0.06, w = Math.min(W * 0.9, 380 * S), h = H * 0.34;
    const x0 = cx - w / 2;
    // 밤하늘 + 가로등 빛
    const sky = g.createLinearGradient(0, 0, 0, top + h);
    sky.addColorStop(0, '#120c18'); sky.addColorStop(1, '#2a1a14');
    g.fillStyle = sky; g.fillRect(0, 0, W, top + h + 30 * S);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + ((i * 37) % 10) / 20})`; g.fillRect((i * 97) % W, (i * 53) % (top + h * 0.3), 1.5, 1.5); }
    // 건물
    g.fillStyle = L.wall; g.fillRect(x0, top + h * 0.12, w, h * 0.88);
    if (lv >= 3) { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (let y = top + h * 0.15; y < top + h; y += 9 * S) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w, y); g.stroke(); } }
    // 간판
    const signW = w * (0.5 + lv * 0.08), signH = h * 0.16;
    rr(g, cx - signW / 2, top, signW, signH, 10 * S);
    g.fillStyle = '#1b1210'; g.fill();
    g.shadowColor = L.sign; g.shadowBlur = 16 + Math.sin(this.t * 3) * 4;
    g.fillStyle = L.sign; g.font = `900 ${signH * 0.5}px -apple-system, "Noto Sans KR", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`${['🏮', '🍷', '🔥', '✨'][lv - 1]} ${E.shopInfo(b).name}`, cx, top + signH / 2 + 1);
    g.shadowBlur = 0; g.textBaseline = 'alphabetic';
    // 차양
    const aw = top + h * 0.3, stripes = 8 + lv * 2;
    for (let i = 0; i < stripes; i++) {
      g.fillStyle = L.awning[i % 2];
      g.beginPath();
      const sx = x0 + (w / stripes) * i;
      g.moveTo(sx, aw); g.lineTo(sx + w / stripes, aw); g.lineTo(sx + w / stripes, aw + h * 0.1);
      g.quadraticCurveTo(sx + w / stripes / 2, aw + h * 0.16, sx, aw + h * 0.1); g.fill();
    }
    // 창문 (안쪽 따뜻한 빛 + 테이블)
    const winY = aw + h * 0.2, winH = h * 0.42;
    const glow = g.createLinearGradient(0, winY, 0, winY + winH);
    glow.addColorStop(0, '#ffcf8a'); glow.addColorStop(1, '#d9823e');
    rr(g, x0 + w * 0.06, winY, w * 0.88, winH, 6 * S); g.fillStyle = glow; g.fill();
    const tables = 1 + lv;
    for (let i = 0; i < tables; i++) {
      const tx = x0 + w * 0.12 + (w * 0.76 / tables) * (i + 0.5);
      g.fillStyle = 'rgba(70,35,15,0.75)'; g.fillRect(tx - 14 * S, winY + winH * 0.62, 28 * S, 5 * S);
      g.fillRect(tx - 2 * S, winY + winH * 0.62, 4 * S, winH * 0.38);
      // 손님 실루엣 (평판이 높을수록 붐빔)
      if (i < Math.ceil((b.rep / 100) * tables + (b.fame.mult - 1) * 2)) {
        g.fillStyle = 'rgba(60,30,15,0.7)';
        g.beginPath(); g.arc(tx - 10 * S, winY + winH * 0.4, 6 * S, 0, Math.PI * 2); g.fill();
        g.fillRect(tx - 16 * S, winY + winH * 0.47, 12 * S, winH * 0.18);
      }
    }
    g.strokeStyle = 'rgba(30,15,8,0.8)'; g.lineWidth = 3 * S;
    g.beginPath(); g.moveTo(cx, winY); g.lineTo(cx, winY + winH); g.stroke();
    // 문 앞 빛
    const lg = g.createRadialGradient(cx, top + h, 5, cx, top + h, w * 0.7);
    lg.addColorStop(0, L.light); lg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = lg; g.fillRect(0, top + h * 0.5, W, h);
    // 지나가는 손님
    for (const p of this.people) {
      const px = p.x * W, py = top + h + 6 * S + Math.sin(this.t * 8 + p.bob) * 1.5;
      g.fillStyle = `hsl(${p.hue},35%,45%)`;
      rr(g, px - 6 * S, py - 22 * S, 12 * S, 18 * S, 4 * S); g.fill();
      g.fillStyle = '#e8c09a'; g.beginPath(); g.arc(px, py - 27 * S, 5 * S, 0, Math.PI * 2); g.fill();
    }
    // 메달 진열
    b.medals.slice(-6).forEach((m, i) => {
      g.font = `${16 * S}px sans-serif`; g.textAlign = 'center';
      g.fillText(['🥇', '🥈', '🥉'][m.place - 1], x0 + 16 * S + i * 20 * S, top + h * 0.24);
    });
  }
}
