// 타이틀: 로고 + GAME START + 설정/도움말
import { drawTable, drawPlate, drawGarnish, drawSauce } from '../art.js';
import { drawSlicedSteak, idealCook } from '../dish.js';
import { shopInfo, won } from '../economy.js';
import { exitApp, isNative } from '../native.js';

export class TitleScene {
  constructor(game) { this.game = game; this.cook = idealCook(); this.t = 0; this.steam = []; }

  enter() {
    this.game.useTex(1);
    const ui = this.game.ui;
    const b = this.game.save.biz;
    const fresh = b.day === 1 && b.totalServed === 0;
    this.logo = document.createElement('div');
    this.logo.className = 'title-logo';
    this.logo.innerHTML = `<div class="t1">COOKING</div><div class="t2">쿠킹 시뮬레이터</div><div class="t3">${fresh ? '포장마차에서 월드 챔피언까지' : `${shopInfo(b).name} · ${b.day}일차 · ${won(b.money)}`}</div>`;
    document.getElementById('app').appendChild(this.logo);
    const start = ui.addButton('GAME START', () => this.start(), 'start');
    start.id = 'start-btn';
    ui.addButton('❓ 도움말', () => this.game.toStory('help', () => this.game.toTitle()), 'secondary small');
    ui.addButton('⚙️ 설정', () => this.game.showSettings(), 'secondary small');
  }
  exit() { this.logo?.remove(); }
  onBack() {
    if (isNative()) this.game.ui.showCard('<h2>게임을 종료할까요?</h2><div class="row"><button class="btn secondary" data-act="no">취소</button><button class="btn" data-act="yes">종료</button></div>', { no: () => this.game.ui.hideOverlay(), yes: () => exitApp() });
    return true;
  }

  async start() {
    await this.game.enableMotion();
    const f = this.game.save.flags;
    const toGame = () => this.game.toShop();
    const afterPrologue = () => (f.helpSeen ? toGame() : this.game.toStory('help', toGame));
    if (!f.prologueSeen) this.game.toStory('prologue', afterPrologue);
    else afterPrologue();
  }

  update(dt) {
    this.t += dt;
    if (Math.random() < dt * 6) this.steam.push({ x: (Math.random() - 0.5) * 120, y: -10, r: 20 + Math.random() * 20, life: 1, vy: -20 - Math.random() * 20 });
    for (const p of this.steam) { p.y += p.vy * dt; p.life -= dt * 0.5; p.r += dt * 12; }
    this.steam = this.steam.filter((p) => p.life > 0);
  }

  draw(g) {
    const { W, H, dpr, tex } = this.game;
    drawTable(g, W, H, dpr);
    const cx = W / 2, cy = H * 0.5;
    const pr = Math.min(W * 0.44, H * 0.23);
    drawPlate(g, cx, cy, pr, dpr);
    const k = pr / 150;
    g.save();
    g.translate(cx, cy + Math.sin(this.t * 1.2) * 2);
    g.scale(k, k);
    drawSauce(g, Array.from({ length: 30 }, (_, i) => [-95 + i * 6.4, 70 + Math.sin(i / 4) * 8]));
    g.save(); g.translate(-22, -12); g.scale(0.62, 0.62); g.rotate(-0.12); drawSlicedSteak(g, tex, this.cook, { slices: 7 }); g.restore();
    g.save(); g.translate(78, 52); drawGarnish(g, 'slaw', { amount: 1, seed: 4 }); g.restore();
    g.save(); g.translate(-82, 48); g.rotate(0.3); drawGarnish(g, 'asparagus'); g.restore();
    for (const [x, y] of [[96, 22], [70, 82], [100, 70]]) { g.save(); g.translate(x, y); drawGarnish(g, 'tomato'); g.restore(); }
    g.save(); g.translate(30, -70); g.rotate(-0.4); drawGarnish(g, 'rosemary', { seed: 2 }); g.restore();
    for (const p of this.steam) {
      const gr = g.createRadialGradient(p.x, p.y - 40, 0, p.x, p.y - 40, p.r);
      gr.addColorStop(0, `rgba(255,255,255,${0.10 * p.life})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y - 40, p.r, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
}
