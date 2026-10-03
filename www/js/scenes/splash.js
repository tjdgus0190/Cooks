// 스플래시: 스튜디오 로고 → 타이틀
import { TAU } from '../geom.js';

export class SplashScene {
  constructor(game) { this.game = game; this.t = 0; this.left = false; }
  enter() { this.game.ui.showHud(false); this.game.ui.hideOverlay(); }
  down() { this.go(); }
  go() { if (this.left) return; this.left = true; this.game.toTitle(); }
  onBack() { return true; }
  update(dt) { this.t += dt; if (this.t > 2.6) this.go(); }
  draw(g) {
    const { W, H, S } = this.game;
    g.fillStyle = '#0d0806'; g.fillRect(0, 0, W, H);
    const a = Math.min(1, this.t / 0.6) * Math.min(1, Math.max(0, (2.6 - this.t) / 0.5));
    g.save(); g.globalAlpha = a; g.translate(W / 2, H * 0.45);
    // 불꽃 아이콘
    const r = 40 * S;
    const fl = g.createRadialGradient(0, 0, 4, 0, 0, r * 2.2);
    fl.addColorStop(0, 'rgba(255,170,60,0.55)'); fl.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = fl; g.beginPath(); g.arc(0, 0, r * 2.2, 0, TAU); g.fill();
    g.fillStyle = '#ff9f43';
    g.beginPath(); g.moveTo(0, -r * 1.2); g.bezierCurveTo(r * 0.9, -r * 0.3, r * 0.8, r * 0.8, 0, r); g.bezierCurveTo(-r * 0.8, r * 0.8, -r * 0.9, -r * 0.3, 0, -r * 1.2); g.fill();
    g.fillStyle = '#ffd27a';
    g.beginPath(); g.moveTo(0, -r * 0.3); g.bezierCurveTo(r * 0.45, r * 0.1, r * 0.4, r * 0.75, 0, r * 0.8); g.bezierCurveTo(-r * 0.4, r * 0.75, -r * 0.45, r * 0.1, 0, -r * 0.3); g.fill();
    g.fillStyle = '#fff4e2'; g.textAlign = 'center';
    g.font = `900 ${26 * S}px -apple-system, "Noto Sans KR", sans-serif`;
    g.fillText('STUDIO COOKS', 0, r * 2.1);
    g.font = `600 ${12 * S}px -apple-system, sans-serif`; g.fillStyle = '#d9c2a5';
    g.fillText('presents', 0, r * 2.6);
    g.restore();
  }
}
