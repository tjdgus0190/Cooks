// @capacitor/core(ESM 단일 파일)를 www/vendor로 복사 — 번들러 없이 네이티브 플러그인(App 등)을 쓰기 위함
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules/@capacitor/core/dist/index.js');
const dst = path.join(root, 'www/vendor/capacitor-core.js');
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log('vendored', path.relative(root, dst));
