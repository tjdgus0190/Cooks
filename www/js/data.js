// 손님(레벨) 정의와 저장 데이터
export const CUSTOMERS = [
  {
    id: 'minjun', face: '🧑‍💼', name: '김민준', title: '첫 손님 · 튜토리얼',
    order: 'medium-rare', time: 300, saltPref: 1.0, hints: true, strict: 1.0,
    line: '미디엄 레어로 부탁드려요! 간은 적당히요.',
    skin: '#f2c9a0', hair: '#2b1d14', shirt: '#3d6fb6',
  },
  {
    id: 'seoyeon', face: '👩‍🎨', name: '이서연', title: '단골 손님',
    order: 'medium', time: 270, saltPref: 1.35, hints: false, strict: 1.15,
    line: '미디엄으로 주세요. 저는 간을 좀 세게 먹어요!',
    skin: '#f5d0b0', hair: '#6b3a1e', shirt: '#c2456b',
  },
  {
    id: 'critic', face: '🧐', name: '미식 평론가 B', title: '최종 보스',
    order: 'rare', time: 230, saltPref: 0.9, hints: false, strict: 1.4,
    line: '레어. 소금은 절제해서. 그리고… 완벽하게.',
    skin: '#e8b98e', hair: '#d8d8d8', shirt: '#2a2a2a',
  },
];

const KEY = 'cooking-sim-save-v1';
export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return { best: s.best || {} }; } catch (e) { return { best: {} }; }
}
export function saveBest(save, id, score) {
  const best = { ...save.best };
  if (!(best[id] >= score)) best[id] = score;
  const next = { ...save, best };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { /* 저장 불가 환경 무시 */ }
  return next;
}
export function isUnlocked(save, idx) {
  if (idx === 0) return true;
  return (save.best[CUSTOMERS[idx - 1].id] || 0) >= 60;
}
