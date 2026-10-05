// 실사 음식 사진 텍스처 로더 (www/assets/food, 출처는 assets/CREDITS.json)
export const PHOTOS = {};
const LIST = {
  steakRaw: 'assets/food/steak_raw.jpg',
  steakCrust: 'assets/food/steak_crust.jpg',
  steakGrain: 'assets/food/steak_grain.png',
  pastaAglio: 'assets/food/pasta_aglio.webp',
  pastaCarbonara: 'assets/food/pasta_carbonara.webp',
  pastaTomato: 'assets/food/pasta_tomato.webp',
  gambas: 'assets/food/gambas.webp',
  gambasPlain: 'assets/food/gambas_plain.webp',
  shrimpFlesh: 'assets/food/shrimp_flesh.jpg',
  shrimpRaw: 'assets/food/shrimp_raw.jpg',
  shrimpCooked: 'assets/food/shrimp_cooked.webp',
  shrimpWhole: 'assets/food/shrimp_whole.webp',
  shrimpRawSprite: 'assets/food/shrimp_rawsprite.webp',
  lobsterShell: 'assets/food/lobster_shell.jpg',
  lobsterShellRaw: 'assets/food/lobster_shell_raw.jpg',
  lobsterMeat: 'assets/food/lobster_meat.jpg',
  gratin: 'assets/food/gratin.jpg',
  cabbageHalf: 'assets/food/cabbage_half.webp',
  shallot: 'assets/food/shallot.webp',
  guanciale: 'assets/food/guanciale.jpg',
  baguetteLoaf: 'assets/food/baguette_loaf.webp',
  lemonHalf: 'assets/food/lemon_half.webp',
  tomatoWhole: 'assets/food/tomato_whole.webp',
  mushroomSkin: 'assets/food/mushroom_skin.jpg',
  lobsterTailRaw: 'assets/food/lobster_tail_raw.jpg',
  lobsterTailCooked: 'assets/food/lobster_tail_cooked.jpg',
  tomatoHalf: 'assets/food/tomato_half.webp',
  asparagus: 'assets/food/asparagus_strip.jpg',
  garlicRoast: 'assets/food/garlic_roast.webp',
  garlicClove: 'assets/food/garlic_clove.webp',
  mushroom: 'assets/food/mushroom_slice.webp',
  rosemary: 'assets/food/rosemary.webp',
  lemon: 'assets/food/lemon_wedge.webp',
  parsleySprig: 'assets/food/parsley_sprig.webp',
  parsleyLeaf: 'assets/food/parsley_leaf.webp',
  baguette: 'assets/food/baguette_crumb.jpg',
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

/** 사진을 원점 중심으로 폭 w(로컬 단위)에 맞춰 그림 — 사진이 없으면 false */
export function drawPhoto(g, k, w, { alpha = 1, dx = 0, dy = 0 } = {}) {
  const im = PHOTOS[k];
  if (!im) return false;
  const h = w * im.height / im.width;
  const a = g.globalAlpha;
  g.globalAlpha = a * alpha;
  g.drawImage(im, dx - w / 2, dy - h / 2, w, h);
  g.globalAlpha = a;
  return true;
}

/** 현재 클립 영역에 질감 사진을 덮어 그림 (합성 모드·투명도 지정) */
export function texFill(g, k, x, y, w, h, { mode = 'overlay', alpha = 1 } = {}) {
  const im = PHOTOS[k];
  if (!im || alpha <= 0) return false;
  g.save();
  g.globalCompositeOperation = mode; g.globalAlpha *= alpha;
  g.drawImage(im, x, y, w, h);
  g.restore();
  return true;
}
