// 메뉴·실제 레시피·손질 재료(가니쉬) 정의
// 레시피 단계는 실제 조리 순서를 따른다. 가니쉬/손질 재료는 '준비대'에서 직접 손질한 만큼만 생긴다.

/** 손질 재료(인벤토리) — 준비대에서 만든다. portion = 한 번 쓰는 양 */
export const PREP = {
  slaw: { name: '양배추 채', icon: '🥬', task: '양배추 채썰기', subject: 'cabbage', unit: '접시분' },
  garlic: { name: '마늘 슬라이스', icon: '🧄', task: '마늘 얇게 썰기', subject: 'garlic', unit: '인분' },
  tomato: { name: '방울토마토 반쪽', icon: '🍅', task: '방울토마토 반 자르기', subject: 'tomato', unit: '개' },
  parsley: { name: '다진 파슬리', icon: '🌿', task: '파슬리 다지기', subject: 'parsley', unit: '꼬집' },
  baguette: { name: '바게트 슬라이스', icon: '🥖', task: '바게트 썰기', subject: 'baguette', unit: '조각' },
  lemon: { name: '레몬 웨지', icon: '🍋', task: '레몬 웨지 썰기', subject: 'lemon', unit: '조각' },
  asparagus: { name: '아스파라거스', icon: '🌱', task: '아스파라거스 밑동 자르기', subject: 'asparagus', unit: '대' },
  mushroom: { name: '양송이 슬라이스', icon: '🍄', task: '양송이 썰기', subject: 'mushroom', unit: '조각' },
  shallot: { name: '다진 샬롯', icon: '🧅', task: '샬롯 다지기', subject: 'shallot', unit: '인분' },
  guanciale: { name: '관찰레 스트립', icon: '🥓', task: '관찰레 썰기', subject: 'guanciale', unit: '인분' },
  rosemary: { name: '로즈마리 줄기', icon: '🌿', task: '로즈마리 손질', subject: 'rosemary', unit: '줄기' },
};

/** 접시에 올릴 수 있는 가니쉬 (요리 종류별) */
export const PLATE_GARNISH = {
  steak: ['slaw', 'tomato', 'asparagus', 'rosemary', 'garlic', 'mushroom'],
  pasta: ['parsley', 'tomato', 'baguette'],
  gambas: ['baguette', 'parsley', 'lemon'],
  lobster: ['lemon', 'parsley', 'asparagus', 'tomato'],
};

const steak = (o) => ({
  cat: 'steak', doneness: true,
  steps: [
    { type: 'trim', subject: 'steak', name: '근막 손질' },
    { type: 'season', subject: 'steak', name: '시즈닝', tools: ['salt', 'pepper', 'oil'] },
    { type: 'sear', name: '굽기' },
    { type: 'plate', name: '플레이팅' },
  ],
  needs: {},
  wantGarnish: ['slaw'],
  ...o,
});

export const RECIPES = [
  steak({ key: 'strip', name: '채끝 스테이크', icon: '🥩', level: 1, base: 18000, thick: 28, marbling: 1, extraMembrane: false, saltMul: 1, desc: '기본에 충실한 한 접시' }),
  {
    key: 'aglio', name: '알리오 올리오', icon: '🍝', level: 1, base: 12000, cat: 'pasta',
    desc: '마늘·올리브오일·페페론치노. 면수로 유화하는 게 핵심',
    needs: { garlic: 1, parsley: 1 },
    steps: [
      { type: 'boil', name: '면 삶기', item: 'spaghetti', pkgMin: 9 },
      { type: 'saute', name: '마늘 오일 & 유화', script: [
        { k: 'oil', act: 'pour', label: '올리브오일 두르기', target: 40 },
        { k: 'garlic', act: 'add', label: '마늘 슬라이스 넣기 (약불 권장)', uses: 'garlic' },
        { k: 'chili', act: 'add', label: '페페론치노 넣기' },
        { k: 'pasta', act: 'add', label: '삶은 면 넣기' },
        { k: 'water', act: 'add', label: '면수 한 국자' },
        { k: 'toss', act: 'toss', label: '팬을 튕겨 유화하기', count: 4 },
        { k: 'parsley', act: 'add', label: '파슬리 뿌리기', uses: 'parsley' },
      ] },
      { type: 'plate', name: '플레이팅', twirl: true },
    ],
    wantGarnish: [],
  },
  {
    key: 'gambas', name: '감바스 알 아히요', icon: '🦐', level: 1, base: 15000, cat: 'gambas',
    desc: '마늘 향 올리브오일에 새우를 익히는 스페인 타파스',
    needs: { garlic: 1, parsley: 1 },
    steps: [
      { type: 'trim', subject: 'shrimp', name: '새우 내장 제거' },
      { type: 'season', subject: 'shrimp', name: '소금 간', tools: ['salt'] },
      { type: 'saute', name: '아히요', script: [
        { k: 'oil', act: 'pour', label: '올리브오일 넉넉히', target: 120 },
        { k: 'garlic', act: 'add', label: '마늘 넣기 (약불에서 천천히)', uses: 'garlic' },
        { k: 'chili', act: 'add', label: '페페론치노 넣기' },
        { k: 'shrimp', act: 'add', label: '새우 넣기' },
        { k: 'flip', act: 'toss', label: '새우 뒤집기', count: 2 },
        { k: 'parsley', act: 'add', label: '파슬리 뿌리기', uses: 'parsley' },
      ] },
      { type: 'plate', name: '플레이팅' },
    ],
    wantGarnish: ['baguette'],
  },
  steak({ key: 'tenderloin', name: '안심 스테이크', icon: '🍖', level: 2, base: 32000, thick: 38, marbling: 0.45, extraMembrane: true, saltMul: 1, desc: '두툼해서 속까지 익히기 어렵고 근막이 많다' }),
  {
    key: 'carbonara', name: '까르보나라', icon: '🥚', level: 2, base: 16000, cat: 'pasta',
    desc: '로마식: 관찰레·노른자·페코리노·후추. 크림 없음. 불을 끄고 섞어야 한다',
    needs: { guanciale: 1 },
    steps: [
      { type: 'boil', name: '면 삶기', item: 'spaghetti', pkgMin: 9 },
      { type: 'whisk', name: '노른자 소스' },
      { type: 'saute', name: '관찰레 & 소스 버무리기', script: [
        { k: 'guanciale', act: 'add', label: '관찰레 넣고 기름 내기 (기름 없이)', uses: 'guanciale' },
        { k: 'pasta', act: 'add', label: '삶은 면 넣기' },
        { k: 'water', act: 'add', label: '면수 한 국자' },
        { k: 'off', act: 'off', label: '불 끄기 (팬을 식혀야 계란이 안 익어요)' },
        { k: 'egg', act: 'add', label: '노른자 소스 붓기' },
        { k: 'toss', act: 'toss', label: '빠르게 버무리기', count: 3 },
      ] },
      { type: 'plate', name: '플레이팅', twirl: true },
    ],
    wantGarnish: [],
  },
  {
    key: 'shrimppasta', name: '새우 토마토 파스타', icon: '🍤', level: 2, base: 18000, cat: 'pasta',
    desc: '마늘·새우·방울토마토를 볶아 면수로 소스를 만든다',
    needs: { garlic: 1, tomato: 4, parsley: 1 },
    steps: [
      { type: 'trim', subject: 'shrimp', name: '새우 내장 제거' },
      { type: 'boil', name: '면 삶기', item: 'spaghetti', pkgMin: 9 },
      { type: 'saute', name: '새우 토마토 소스', script: [
        { k: 'oil', act: 'pour', label: '올리브오일 두르기', target: 30 },
        { k: 'garlic', act: 'add', label: '마늘 넣기', uses: 'garlic' },
        { k: 'shrimp', act: 'add', label: '새우 넣기' },
        { k: 'tomato', act: 'add', label: '방울토마토 넣기', uses: 'tomato' },
        { k: 'pasta', act: 'add', label: '삶은 면 넣기' },
        { k: 'water', act: 'add', label: '면수 한 국자' },
        { k: 'toss', act: 'toss', label: '팬을 튕겨 소스 입히기', count: 4 },
        { k: 'parsley', act: 'add', label: '파슬리 뿌리기', uses: 'parsley' },
      ] },
      { type: 'plate', name: '플레이팅', twirl: true },
    ],
    wantGarnish: [],
  },
  steak({ key: 'ribeye', name: '꽃등심 스테이크', icon: '🔥', level: 3, base: 45000, thick: 32, marbling: 2.2, extraMembrane: false, saltMul: 1.1, desc: '마블링이 풍부해 겉이 빨리 탄다' }),
  {
    key: 'lobsterbutter', name: '랍스터 버터구이', icon: '🦞', level: 3, base: 58000, cat: 'lobster',
    desc: '꼬리를 반 갈라 시어링 후 마늘 버터를 끼얹어 익힌다',
    needs: { garlic: 1, lemon: 1 },
    steps: [
      { type: 'trim', subject: 'lobster', name: '랍스터 꼬리 반 가르기' },
      { type: 'season', subject: 'lobster', name: '시즈닝', tools: ['salt', 'pepper'] },
      { type: 'saute', name: '시어링 & 버터 베이스팅', script: [
        { k: 'oil', act: 'pour', label: '오일 살짝', target: 15 },
        { k: 'lobster', act: 'add', label: '살 쪽부터 굽기' },
        { k: 'butter', act: 'add', label: '버터 넣기' },
        { k: 'garlic', act: 'add', label: '마늘 넣기', uses: 'garlic' },
        { k: 'baste', act: 'baste', label: '버터 끼얹기 (탭 연타)', count: 8 },
      ] },
      { type: 'plate', name: '플레이팅' },
    ],
    wantGarnish: ['lemon'],
  },
  steak({ key: 'wagyu', name: 'A5 와규 스테이크', icon: '👑', level: 4, base: 120000, thick: 22, marbling: 4, extraMembrane: false, saltMul: 0.7, desc: '얇고 기름져 몇 초 차이로 승부가 갈린다' }),
  {
    key: 'thermidor', name: '랍스터 테르미도르', icon: '🧀', level: 4, base: 95000, cat: 'lobster',
    desc: '데친 랍스터 살을 샬롯·화이트와인·크림·머스터드 소스에 버무려 껍질에 담고 치즈를 올려 굽는다',
    needs: { shallot: 1, parsley: 1 },
    steps: [
      { type: 'boil', name: '랍스터 데치기', item: 'lobster', pkgMin: 4 },
      { type: 'trim', subject: 'lobster', name: '반 갈라 살 발라내기' },
      { type: 'saute', name: '테르미도르 소스', script: [
        { k: 'butter', act: 'add', label: '버터 녹이기' },
        { k: 'shallot', act: 'add', label: '샬롯 볶기', uses: 'shallot' },
        { k: 'wine', act: 'add', label: '화이트와인 붓고 졸이기' },
        { k: 'cream', act: 'add', label: '생크림 넣기' },
        { k: 'mustard', act: 'add', label: '디종 머스터드' },
        { k: 'meat', act: 'add', label: '랍스터 살 넣고 버무리기' },
        { k: 'parsley', act: 'add', label: '파슬리', uses: 'parsley' },
      ] },
      { type: 'oven', name: '치즈 올려 굽기' },
      { type: 'plate', name: '플레이팅' },
    ],
    wantGarnish: ['lemon'],
  },
];

export const recipeByKey = (k) => RECIPES.find((r) => r.key === k) || RECIPES[0];

/** 인벤토리로 이 요리를 만들 수 있는지 */
export function missingFor(recipe, inv) {
  const out = [];
  for (const [k, n] of Object.entries(recipe.needs || {})) if ((inv[k] || 0) < n) out.push(PREP[k].name);
  return out;
}
export function consume(recipe, inv) {
  for (const [k, n] of Object.entries(recipe.needs || {})) inv[k] = Math.max(0, (inv[k] || 0) - n);
}

export function orderName(key) {
  return { rare: '레어', 'medium-rare': '미디엄 레어', medium: '미디엄', 'medium-well': '미디엄 웰', 'well-done': '웰던' }[key];
}
