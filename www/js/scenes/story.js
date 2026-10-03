// 프롤로그 / 도움말 슬라이드
import { drawTable, drawPlate, drawCustomer, drawKnife, drawShaker, drawStoveAndPan, drawCounter, rr } from '../art.js';
import { drawSlicedSteak, idealCook } from '../dish.js';
import { drawPastaNest, drawCazuela, drawLobster } from '../food.js';
import { TAU } from '../geom.js';
import { sfx } from '../audio.js';

const OLD = { id: 'grandpa', skin: '#e8b98e', hair: '#e0e0e0', shirt: '#7a3a20' };
const ME = { id: 'me', skin: '#f2c9a0', hair: '#2b1d14', shirt: '#ff9f43' };

const PROLOGUE = [
  { text: '서울의 어느 오래된 골목.\n주황 등 하나가 밤을 밝히는 작은 포장마차가 있었다.', art: 'alley' },
  { text: '"좋은 재료를, 정직하게 손질해서, 정성껏 익혀라."\n평생 그 말만 지켜온 할아버지의 가게.', art: 'grandpa' },
  { text: '그리고 오늘, 낡은 칼 한 자루와 함께\n그 가게가 내게로 왔다.', art: 'knife' },
  { text: '길 건너엔 번쩍이는 레스토랑들.\n단골은 줄고, 가게는 조용하다.', art: 'rival' },
  { text: '이제 내 손으로 이 가게를 다시 살릴 차례.\n목표는 — 월드 그릴 마스터즈 우승!', art: 'trophy' },
];
const HELP = [
  { title: '1. 영업은 실시간!', text: '손님이 앉으면 주문표가 생겨요. 🔪 직접 조리를 누르면 요리 시작.\n요리하는 동안에도 가게 시간과 손님 인내심은 흘러가요.', art: 'hall' },
  { title: '2. 손으로 요리해요', text: '칼질은 드래그, 소금·후추는 휴대폰 흔들기,\n팬은 위로 휙! 튕겨서 뒤집기·유화.', art: 'cook' },
  { title: '3. 준비대에서 손질', text: '마늘·파슬리·토마토·바게트… 손질한 만큼만 쓸 수 있어요.\n재료가 떨어지면 직원도 요리를 못 해요.', art: 'prep' },
  { title: '4. 실제 레시피 그대로', text: '알리오 올리오는 면수로 유화, 까르보나라는 불 끄고 노른자!\n스테이크·파스타·감바스·랍스터, 정통 방식으로 요리해요.', art: 'menu' },
  { title: '5. 가게를 키워요', text: '직원 고용 · 가격 조절 · 요리대회 · 가게 확장.\n평판이 오르면 단가를 올릴 수 있지만, 비싸면 손님이 실망해요.', art: 'grow' },
];

export class StoryScene {
  constructor(game, kind = 'prologue', next = null) {
    this.game = game; this.kind = kind; this.next = next;
    this.slides = kind === 'help' ? HELP : PROLOGUE;
    this.i = 0; this.t = 0; this.tex = game.tex;
  }
  enter() {
    const ui = this.game.ui;
    ui.addButton('건너뛰기', () => this.finish(), 'secondary small');
    this.nextBtn = ui.addButton('다음 ▶', () => this.advance());
    this.el = document.createElement('div');
    this.el.className = 'story-text';
    document.getElementById('app').appendChild(this.el);
    this.render();
  }
  exit() { this.el?.remove(); }
  onBack() { this.finish(); return true; }
  down() { this.advance(); }
  advance() {
    sfx.pop();
    if (this.i < this.slides.length - 1) { this.i++; this.t = 0; this.render(); } else this.finish();
  }
  finish() {
    if (this.done) return; this.done = true;
    this.game.setFlag(this.kind === 'help' ? 'helpSeen' : 'prologueSeen');
    (this.next || (() => this.game.toShop()))();
  }
  render() {
    const s = this.slides[this.i];
    this.el.innerHTML = `${s.title ? `<h2>${s.title}</h2>` : ''}<p>${s.text.replace(/\n/g, '<br>')}</p><div class="dots">${this.slides.map((_, j) => `<i class="${j === this.i ? 'on' : ''}"></i>`).join('')}</div>`;
    this.el.classList.remove('in'); void this.el.offsetWidth; this.el.classList.add('in');
    this.nextBtn.innerHTML = this.i === this.slides.length - 1 ? (this.kind === 'help' ? '시작하기 ▶' : '다음 ▶') : '다음 ▶';
  }
  update(dt) { this.t += dt; }

  draw(g) {
    const { W, H, S, dpr, time } = this.game;
    const art = this.slides[this.i].art;
    const cx = W / 2, cy = H * 0.36;
    const fade = Math.min(1, this.t / 0.5);
    if (['alley', 'rival', 'trophy'].includes(art)) {
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0e0a18'); sky.addColorStop(1, '#2a1810');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,255,255,${0.2 + (k % 5) / 10})`; g.fillRect((k * 97) % W, (k * 61) % (H * 0.4), 1.5, 1.5); }
    } else if (art === 'hall' || art === 'grow') drawTable(g, W, H, dpr);
    else drawCounter(g, W, H, dpr);
    g.save(); g.globalAlpha = fade;
    if (art === 'alley') this.stall(g, cx, cy, S, time);
    if (art === 'grandpa') { this.stall(g, cx, cy + 40 * S, S * 0.8, time); drawCustomer(g, OLD, cx, cy - 10 * S, S * 0.9, 'happy', 0, time); }
    if (art === 'knife') { drawKnife(g, cx + 90 * S, cy, -0.2, S * 1.4, true); drawCustomer(g, ME, cx - 60 * S, cy + 30 * S, S * 0.8, 'neutral', 0, time); }
    if (art === 'rival') {
      this.stall(g, cx - 90 * S, cy + 40 * S, S * 0.6, time);
      g.fillStyle = '#1a1a2a'; g.fillRect(cx + 10 * S, cy - 120 * S, 160 * S, 220 * S);
      g.shadowColor = '#ff3ca0'; g.shadowBlur = 20; g.fillStyle = '#ff6ac0'; g.font = `900 ${20 * S}px sans-serif`; g.textAlign = 'center';
      g.fillText('LUXE GRILL', cx + 90 * S, cy - 90 * S); g.shadowBlur = 0;
      for (let k = 0; k < 8; k++) { g.fillStyle = `rgba(255,220,150,${0.4 + Math.sin(time * 3 + k) * 0.2})`; g.fillRect(cx + 25 * S + (k % 4) * 36 * S, cy - 60 * S + Math.floor(k / 4) * 50 * S, 24 * S, 34 * S); }
    }
    if (art === 'trophy') {
      g.translate(cx, cy);
      const tg = g.createLinearGradient(-50 * S, 0, 50 * S, 0); tg.addColorStop(0, '#b8862a'); tg.addColorStop(0.5, '#ffe28a'); tg.addColorStop(1, '#9a6a1a');
      g.fillStyle = tg;
      g.beginPath(); g.moveTo(-50 * S, -80 * S); g.lineTo(50 * S, -80 * S); g.quadraticCurveTo(48 * S, 10 * S, 0, 20 * S); g.quadraticCurveTo(-48 * S, 10 * S, -50 * S, -80 * S); g.fill();
      g.fillRect(-8 * S, 20 * S, 16 * S, 40 * S); g.fillRect(-40 * S, 60 * S, 80 * S, 16 * S);
      g.strokeStyle = tg; g.lineWidth = 8 * S; g.beginPath(); g.arc(-52 * S, -50 * S, 22 * S, 1.2, 4.6); g.stroke(); g.beginPath(); g.arc(52 * S, -50 * S, 22 * S, -1.5, 1.9); g.stroke();
      for (let k = 0; k < 12; k++) { const a = time + k * 0.52; g.fillStyle = 'rgba(255,230,150,0.8)'; g.beginPath(); g.arc(Math.cos(a) * 110 * S, Math.sin(a) * 70 * S - 30 * S, 2.5 * S, 0, TAU); g.fill(); }
    }
    if (art === 'hall') {
      for (let k = 0; k < 3; k++) {
        const x = W * (0.2 + k * 0.3), y = cy;
        g.fillStyle = '#a8724a'; g.beginPath(); g.ellipse(x, y + 26 * S, 40 * S, 13 * S, 0, 0, TAU); g.fill();
        drawCustomer(g, { id: `c${k}`, skin: '#f2c9a0', hair: ['#2b1d14', '#6b3a1e', '#111'][k], shirt: ['#3d6fb6', '#c2456b', '#3f8a5a'][k] }, x, y - 10 * S, S * 0.38, k === 1 ? 'happy' : 'neutral', 0, time);
        g.fillStyle = '#fff4e2'; rr(g, x + 14 * S, y - 64 * S, 30 * S, 24 * S, 8 * S); g.fill();
        g.font = `${14 * S}px sans-serif`; g.textAlign = 'center'; g.fillText(['🥩', '🍝', '🦐'][k], x + 29 * S, y - 46 * S);
      }
    }
    if (art === 'cook') { drawStoveAndPan(g, cx, cy, 100 * S, 0.8, time, dpr, 200); drawShaker(g, 'salt', cx + 110 * S, cy - 110 * S + Math.sin(time * 20) * 6, S * 0.7, 0.3); }
    if (art === 'prep') { drawKnife(g, cx - 20 * S + Math.sin(time * 4) * 20 * S, cy, 0.3, S, true); g.font = `${44 * S}px sans-serif`; g.textAlign = 'center'; g.fillText('🧄🍅🌿🥖', cx, cy + 90 * S); }
    if (art === 'menu') {
      drawPlate(g, cx - 80 * S, cy - 20 * S, 70 * S, dpr); drawPlate(g, cx + 80 * S, cy + 40 * S, 70 * S, dpr);
      g.save(); g.translate(cx - 80 * S, cy - 20 * S); g.scale(S * 0.9, S * 0.9); drawPastaNest(g, { sauce: 'carbonara', toppings: { guanciale: 0.9, pepper: 1, cheese: true } }); g.restore();
      g.save(); g.translate(cx + 80 * S, cy + 40 * S); g.scale(S * 0.55, S * 0.55); drawCazuela(g, {}); g.restore();
    }
    if (art === 'grow') {
      ['🏮', '🍷', '🔥', '✨'].forEach((e, k) => { g.font = `${(26 + k * 8) * S}px sans-serif`; g.textAlign = 'center'; g.fillText(e, W * (0.15 + k * 0.23), cy + 40 * S - k * 26 * S); });
      g.strokeStyle = '#ffd25a'; g.lineWidth = 3 * S; g.beginPath(); g.moveTo(W * 0.1, cy + 70 * S); g.lineTo(W * 0.9, cy - 60 * S); g.stroke();
    }
    g.restore();
  }

  stall(g, x, y, s, time) {
    g.save(); g.translate(x, y);
    const glow = g.createRadialGradient(0, 10 * s, 10 * s, 0, 10 * s, 220 * s);
    glow.addColorStop(0, 'rgba(255,150,60,0.45)'); glow.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(0, 10 * s, 220 * s, 0, TAU); g.fill();
    // 천막 (주황 비닐, 줄무늬)
    g.fillStyle = '#d8462e';
    g.beginPath(); g.moveTo(-130 * s, -30 * s); g.quadraticCurveTo(0, -120 * s, 130 * s, -30 * s); g.lineTo(120 * s, -10 * s); g.quadraticCurveTo(0, -90 * s, -120 * s, -10 * s); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,220,180,0.25)';
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 34 * s, -10 * s - (1 - Math.abs(k) / 4) * 70 * s); g.lineTo(k * 34 * s + 12 * s, -10 * s - (1 - Math.abs(k) / 4) * 70 * s); g.lineTo(k * 36 * s + 12 * s, -10 * s); g.lineTo(k * 36 * s, -10 * s); g.fill(); }
    // 기둥
    g.fillStyle = '#3a2618'; g.fillRect(-118 * s, -14 * s, 6 * s, 110 * s); g.fillRect(112 * s, -14 * s, 6 * s, 110 * s);
    // 안쪽 따뜻한 빛
    const inside = g.createLinearGradient(0, -10 * s, 0, 60 * s);
    inside.addColorStop(0, 'rgba(255,200,130,0.55)'); inside.addColorStop(1, 'rgba(255,160,80,0.25)');
    g.fillStyle = inside; g.fillRect(-112 * s, -12 * s, 224 * s, 70 * s);
    // 철판 + 연기
    g.fillStyle = '#222'; g.fillRect(-60 * s, 34 * s, 70 * s, 8 * s);
    for (let k = 0; k < 3; k++) { const yy = 20 * s - ((time * 18 + k * 20) % 60) * s; g.fillStyle = `rgba(255,255,255,${0.12})`; g.beginPath(); g.arc(-25 * s + Math.sin(time + k) * 6 * s, yy, (8 + k * 3) * s, 0, TAU); g.fill(); }
    // 카운터 + 의자
    g.fillStyle = '#6a4128'; g.fillRect(-120 * s, 50 * s, 240 * s, 14 * s);
    g.fillStyle = '#8a5a34'; g.fillRect(-120 * s, 46 * s, 240 * s, 6 * s);
    g.fillStyle = '#2e6fb0';
    for (const sx of [-80, -20, 40, 95]) { g.beginPath(); g.ellipse(sx * s, 84 * s, 13 * s, 5 * s, 0, 0, TAU); g.fill(); g.fillRect((sx - 2) * s, 84 * s, 4 * s, 18 * s); }
    // 간판
    g.fillStyle = '#f6e3c3'; g.fillRect(-56 * s, -56 * s, 112 * s, 24 * s);
    g.fillStyle = '#a3311e'; g.font = `900 ${14 * s}px sans-serif`; g.textAlign = 'center'; g.fillText('할아버지 스테이크', 0, -39 * s);
    // 등
    const lx = 92 * s, ly = 2 * s;
    g.strokeStyle = '#222'; g.lineWidth = 1.5 * s; g.beginPath(); g.moveTo(lx, -20 * s); g.lineTo(lx, ly - 14 * s); g.stroke();
    const lg = g.createRadialGradient(lx, ly, 2 * s, lx, ly, 40 * s);
    lg.addColorStop(0, 'rgba(255,190,90,0.7)'); lg.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = lg; g.beginPath(); g.arc(lx, ly, 40 * s, 0, TAU); g.fill();
    g.fillStyle = `rgb(255,${130 + Math.sin(time * 3) * 20},50)`; g.beginPath(); g.ellipse(lx, ly, 11 * s, 15 * s, 0, 0, TAU); g.fill();
    g.restore();
  }
}
