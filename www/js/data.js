// 저장 데이터 (가게 경영 상태 포함)
import { newBusiness } from './economy.js';

const KEY = 'cooking-sim-save-v3';
export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    const biz = s.biz ? { ...newBusiness(), ...s.biz } : newBusiness();
    return { best: s.best || {}, biz, flags: s.flags || {}, prefs: { sound: true, haptics: true, ...(s.prefs || {}) } };
  } catch (e) { return { best: {}, biz: newBusiness(), flags: {}, prefs: { sound: true, haptics: true } }; }
}
export function writeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* 저장 불가 환경 무시 */ }
  return save;
}
export function saveBest(save, id, score) {
  const best = { ...save.best };
  if (!(best[id] >= score)) best[id] = score;
  return writeSave({ ...save, best });
}
