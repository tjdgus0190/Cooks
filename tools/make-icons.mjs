// 앱 아이콘/스플래시 PNG 생성: 게임과 같은 절차적 그래픽으로 렌더링해 네이티브 프로젝트에 덮어쓴다
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pngSize = (f) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

const srv = await startServer(8611);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.goto('http://localhost:8611/icon.html');
await page.waitForFunction(() => window.ready);
async function write(file, kind) {
  const [w, h] = pngSize(file);
  const url = await page.evaluate(([k, w, h]) => window.render(k, w, h), [kind, w, h]);
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(kind.padEnd(10), `${w}x${h}`, path.relative(root, file));
}
const res = path.join(root, 'android/app/src/main/res');
for (const f of walk(res).filter((f) => f.endsWith('.png'))) {
  const b = path.basename(f);
  await write(f, b === 'ic_launcher.png' ? 'icon' : b === 'ic_launcher_round.png' ? 'round' : b === 'ic_launcher_foreground.png' ? 'foreground' : 'splash');
}
const ios = path.join(root, 'ios/App/App/Assets.xcassets');
for (const f of walk(ios).filter((f) => f.endsWith('.png'))) await write(f, f.includes('AppIcon') ? 'icon' : 'splash');
// 웹/문서용 아이콘
fs.mkdirSync(path.join(root, 'docs/img'), { recursive: true });
const url = await page.evaluate(() => window.render('icon', 512, 512));
fs.writeFileSync(path.join(root, 'docs/img/icon.png'), Buffer.from(url.split(',')[1], 'base64'));
await browser.close(); srv.close();
