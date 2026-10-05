// 실사 음식 사진 텍스처 로더 (www/assets/food, 출처는 assets/CREDITS.json)
export const PHOTOS = {};
const LIST = {
  steakRaw: 'assets/food/steak_raw.jpg',
  steakCrust: 'assets/food/steak_crust.jpg',
  steakGrain: 'assets/food/steak_grain.png',
};
let ready = null;

/** 모든 사진을 불러온다 — 실패한 항목은 절차적 텍스처로 대체되도록 비워 둔다 */
export function loadPhotos(extra = {}) {
  if (ready) return ready;
  const all = { ...LIST, ...extra };
  ready = Promise.all(Object.entries(all).map(([k, src]) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { PHOTOS[k] = im; res(); };
    im.onerror = () => res();
    im.src = src;
  })));
  return ready;
}

export function hasPhoto(k) { return !!PHOTOS[k]; }
