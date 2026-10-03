// 네이티브 연동: 뒤로가기 버튼, 앱 백그라운드 전환, 진동 (웹에서는 조용히 무시)
import { Capacitor, registerPlugin } from '../vendor/capacitor-core.js';

const App = registerPlugin('App');
const Haptics = registerPlugin('Haptics');
export const isNative = () => Capacitor.isNativePlatform();

export const prefs = { sound: true, haptics: true };

export function onBackButton(fn) {
  if (isNative()) App.addListener('backButton', fn).catch(() => {});
  // 웹/PC: Esc 키
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') fn(); });
}

export function onAppPause(fn) {
  if (isNative()) App.addListener('appStateChange', ({ isActive }) => { if (!isActive) fn(); }).catch(() => {});
  document.addEventListener('visibilitychange', () => { if (document.hidden) fn(); });
}

export function exitApp() { if (isNative()) App.exitApp().catch(() => {}); }

export function vibrate(kind = 'light') {
  if (!prefs.haptics) return;
  if (isNative()) {
    Haptics.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' }).catch(() => {});
  } else if (navigator.vibrate) navigator.vibrate(kind === 'heavy' ? 40 : kind === 'medium' ? 20 : 8);
}
