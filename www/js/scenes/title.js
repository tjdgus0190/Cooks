// 타이틀 + 손님 선택
import { drawTable, drawPlate, drawGarnish, drawSauce } from '../art.js';
import { drawSlicedSteak, idealCook } from '../dish.js';
import { CUSTOMERS, isUnlocked } from '../data.js';
import { motion } from '../motion.js';

export class TitleScene {
  constructor(game) { this.game = game; this.cook = idealCook(); this.t = 0; this.steam = []; }

  enter() { this.showMenu(); }

  showMenu() {
    const { ui, save } = this.game;
    const list = CUSTOMERS.map((c, i) => {
      const unlocked = isUnlocked(save, i);
      const best = save.best[c.id];
      return `<button class="cust" data-act="c${i}" ${unlocked ? '' : 'disabled'}>
        <span class="face">${unlocked ? c.face : '🔒'}</span>
        <span class="info"><div class="name">${c.name}</div><div class="desc">${unlocked ? `${c.title} · ${Math.floor(c.time / 60)}분 ${c.time % 60 ? `${c.time % 60}초` : ''}` : '이전 손님에게 60점 이상 받으면 열려요'}</div></span>
        <span class="best">${best != null ? `최고<br>${best}점` : ''}</span>
      </button>`;
    }).join('');
    const actions = {};
    CUSTOMERS.forEach((c, i) => { actions[`c${i}`] = () => this.pick(c); });
    actions.how = () => this.showHowTo();
    ui.showCard(`
      <h1 class="title">🥩 쿠킹 시뮬레이터</h1>
      <p class="tagline">손질부터 플레이팅까지, 단 한 접시의 완벽한 스테이크</p>
      <div class="customers">${list}</div>
      <div class="row"><button class="btn secondary small" data-act="how">조작 방법</button></div>`, actions, { bottom: true });
  }

  showHowTo() {
    this.game.ui.showCard(`
      <div class="icon">📱</div>
      <h2>이렇게 요리해요</h2>
      <ul>
        <li><b>손질</b> — 손가락으로 드래그한 대로 칼이 지나가요. 두 손가락으로 돌리거나 회전 버튼으로 고기를 돌리세요.</li>
        <li><b>시즈닝</b> — 휴대폰을 <b>흔들면</b> 소금·후추가 뿌려져요. 세게 흔들수록 많이! 오일은 흔들거나 <b>휘휘 돌려서</b>.</li>
        <li><b>굽기</b> — 팬을 튕기듯 휴대폰을 <b>위로 휙</b> 올려 뒤집어요. 너무 약하거나 세면 고기가 접혀요.</li>
        <li><b>플레이팅</b> — 가니쉬를 끌어다 접시를 꾸며요.</li>
        <li>센서가 없는 기기에서는 화면을 빠르게 문지르거나 위로 휙 쓸어올려도 돼요.</li>
      </ul>
      <div class="row"><button class="btn" data-act="back">알겠어요</button></div>`, { back: () => this.showMenu() });
  }

  async pick(c) {
    await this.game.enableMotion();
    const { ui } = this.game;
    ui.showCard(`
      <div class="icon">${c.face}</div>
      <h2>${c.name}</h2>
      <div class="bubble">“${c.line}”</div>
      <p>제한 시간 <b style="color:var(--cream)">${Math.floor(c.time / 60)}분 ${c.time % 60 ? `${c.time % 60}초` : ''}</b> 안에 손질 → 채썰기 → 시즈닝 → 굽기 → 플레이팅을 끝내세요.</p>
      ${motion.permission === 'denied' ? '<p style="color:var(--bad)">모션 센서 권한이 없어 터치 조작으로 대체돼요.</p>' : ''}
      <div class="row"><button class="btn secondary" data-act="back">뒤로</button><button class="btn" data-act="go">주문 받기</button></div>`, {
      back: () => this.showMenu(),
      go: () => { ui.hideOverlay(); this.game.newRun(c.id); },
    });
  }

  update(dt) {
    this.t += dt;
    if (Math.random() < dt * 6) this.steam.push({ x: (Math.random() - 0.5) * 120, y: -10, r: 20 + Math.random() * 20, life: 1, vy: -20 - Math.random() * 20 });
    for (const p of this.steam) { p.y += p.vy * dt; p.life -= dt * 0.5; p.r += dt * 12; }
    this.steam = this.steam.filter((p) => p.life > 0);
  }

  draw(g) {
    const { W, H, S, dpr, tex } = this.game;
    drawTable(g, W, H, dpr);
    const cx = W / 2, cy = H * 0.27;
    const pr = Math.min(W * 0.46, H * 0.24);
    drawPlate(g, cx, cy, pr, dpr);
    const k = pr / 150;
    g.save();
    g.translate(cx, cy);
    g.scale(k, k);
    drawSauce(g, Array.from({ length: 30 }, (_, i) => [-95 + i * 6.4, 70 + Math.sin(i / 4) * 8]));
    g.save(); g.translate(-22, -12); g.scale(0.62, 0.62); g.rotate(-0.12);
    drawSlicedSteak(g, tex, this.cook, { slices: 7 });
    g.restore();
    g.save(); g.translate(78, 52); drawGarnish(g, 'slaw', { amount: 1, seed: 4 }); g.restore();
    g.save(); g.translate(-82, 48); g.rotate(0.3); drawGarnish(g, 'asparagus'); g.restore();
    g.save(); g.translate(-74, 60); g.rotate(0.2); drawGarnish(g, 'asparagus', { seed: 8 }); g.restore();
    for (const [x, y] of [[96, 22], [70, 82], [100, 70]]) { g.save(); g.translate(x, y); drawGarnish(g, 'tomato'); g.restore(); }
    g.save(); g.translate(30, -70); g.rotate(-0.4); drawGarnish(g, 'rosemary', { seed: 2 }); g.restore();
    g.save(); g.translate(8, 58); drawGarnish(g, 'garlic'); g.restore();
    g.save(); g.translate(-30, -20); g.globalAlpha = 0.9; drawGarnish(g, 'flake', { seed: 9 }); g.restore();
    for (const p of this.steam) {
      const gr = g.createRadialGradient(p.x, p.y - 40, 0, p.x, p.y - 40, p.r);
      gr.addColorStop(0, `rgba(255,255,255,${0.10 * p.life})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y - 40, p.r, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
}
