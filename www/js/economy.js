// 가게 경영: 만족도·평판·가격 탄력성·확장·요리대회 (순수 함수 — 단위 테스트 대상)
export const DISHES = [
  { key: 'strip', name: '채끝 스테이크', icon: '🥩', level: 1, base: 18000, thick: 28, marbling: 1, extraMembrane: false, saltMul: 1, desc: '기본에 충실한 한 접시' },
  { key: 'tenderloin', name: '안심 스테이크', icon: '🍖', level: 2, base: 32000, thick: 38, marbling: 0.45, extraMembrane: true, saltMul: 1, desc: '두툼해서 속까지 익히기 어렵고 근막이 많다' },
  { key: 'ribeye', name: '꽃등심 스테이크', icon: '🔥', level: 3, base: 45000, thick: 32, marbling: 2.2, extraMembrane: false, saltMul: 1.1, desc: '마블링이 풍부해 겉이 빨리 탄다' },
  { key: 'wagyu', name: 'A5 와규 스테이크', icon: '👑', level: 4, base: 120000, thick: 22, marbling: 4, extraMembrane: false, saltMul: 0.7, desc: '얇고 기름져 몇 초 차이로 승부가 갈린다' },
];

export const SHOP_LEVELS = [
  { level: 1, name: '골목 포장마차', baseVisitors: 40, priceMul: 1.0, cost: 0, needRep: 0, needMedal: null },
  { level: 2, name: '동네 비스트로', baseVisitors: 70, priceMul: 1.15, cost: 2500000, needRep: 65, needMedal: null },
  { level: 3, name: '스테이크 하우스', baseVisitors: 110, priceMul: 1.3, cost: 10000000, needRep: 75, needMedal: 'city' },
  { level: 4, name: '파인다이닝', baseVisitors: 160, priceMul: 1.5, cost: 32000000, needRep: 85, needMedal: 'national' },
];

export const CONTESTS = [
  { key: 'local', name: '동네 요리대회', level: 1, fee: 100000, prizes: [1000000, 500000, 200000], fame: [1.5, 1.3, 1.15], rep: [6, 4, 2], rivals: [62, 9], strict: 1.3, time: 240, dish: 'strip' },
  { key: 'city', name: '시 요리대회', level: 2, fee: 500000, prizes: [6000000, 3000000, 1000000], fame: [1.6, 1.35, 1.15], rep: [7, 4, 2], rivals: [70, 8], strict: 1.45, time: 230, dish: 'tenderloin' },
  { key: 'national', name: '전국 스테이크 챔피언십', level: 3, fee: 2000000, prizes: [25000000, 12000000, 4000000], fame: [1.8, 1.45, 1.2], rep: [8, 5, 2], rivals: [78, 6], strict: 1.6, time: 220, dish: 'ribeye' },
  { key: 'world', name: '월드 그릴 마스터즈', level: 4, fee: 10000000, prizes: [120000000, 50000000, 15000000], fame: [2.0, 1.6, 1.25], rep: [10, 6, 3], rivals: [85, 5], strict: 1.8, time: 210, dish: 'wagyu' },
];
export const CONTEST_COOLDOWN = 3; // 대회는 3일에 한 번
const FAME_DAYS = 5;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const won = (n) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

export function newBusiness() {
  return {
    day: 1, money: 300000, rep: 50, level: 1,
    prices: { strip: 18000 },
    fame: { mult: 1, days: 0 },
    medals: [],             // { contest, place, day }
    lastContestDay: -99,
    history: [],            // 최근 영업 기록
    totalServed: 0, totalRevenue: 0,
  };
}

export function shopInfo(biz) { return SHOP_LEVELS[biz.level - 1]; }
export function unlockedDishes(biz) { return DISHES.filter((d) => d.level <= biz.level); }
export function dishByKey(k) { return DISHES.find((d) => d.key === k) || DISHES[0]; }

/** 손님이 '이 정도면 낼 만하다'고 느끼는 적정가: 평판이 오를수록 올라간다 */
export function fairPrice(biz, dish) {
  return dish.base * (0.7 + 0.6 * clamp(biz.rep, 0, 100) / 100) * shopInfo(biz).priceMul;
}

/** 가격이 적정가보다 높으면 만족도 급락, 낮으면 약간 상승 */
export function priceEffect(price, fair) {
  const r = price / fair;
  if (r > 1) return -(r - 1) * 120;
  return Math.min(8, (1 - r) * 25);
}

export function satisfaction(score, price, fair) {
  return clamp(Math.round(score + priceEffect(price, fair)), 0, 100);
}

/** 오늘 방문객 수: 가게 규모 × 평판 × 대회 명성 × 가격 탄력성 */
export function visitors(biz, price, fair) {
  const base = shopInfo(biz).baseVisitors;
  // 싸게 팔면 손님은 조금 늘지만(포화), 비싸면 급격히 줄어든다 → 이익은 적정가 근처에서 최대
  const r = price / fair;
  const elastic = r <= 1 ? Math.min(1.3, Math.pow(1 / r, 0.5)) : Math.max(0.15, Math.pow(r, -2.5));
  return Math.max(1, Math.round(base * (0.4 + biz.rep / 100) * biz.fame.mult * elastic));
}

/** 하루 영업 정산. 원본을 바꾸지 않고 새 상태와 리포트를 돌려준다 */
export function settleDay(biz, dishKey, score) {
  const dish = dishByKey(dishKey);
  const price = biz.prices[dishKey] ?? dish.base;
  const fair = fairPrice(biz, dish);
  const sat = satisfaction(score, price, fair);
  const vis = visitors(biz, price, fair);
  const tipRate = sat >= 90 ? 0.1 : sat >= 80 ? 0.05 : 0;
  const revenue = vis * price * (1 + tipRate);
  const cost = vis * dish.base * 0.35;
  const profit = revenue - cost;
  const repDelta = (sat - biz.rep) * 0.25;
  const next = {
    ...biz,
    day: biz.day + 1,
    money: biz.money + profit,
    rep: clamp(biz.rep + repDelta, 0, 100),
    fame: biz.fame.days > 1 ? { mult: biz.fame.mult, days: biz.fame.days - 1 } : { mult: 1, days: 0 },
    totalServed: biz.totalServed + vis,
    totalRevenue: biz.totalRevenue + revenue,
    history: [...biz.history, { day: biz.day, dish: dishKey, score, sat, vis, price, profit }].slice(-14),
  };
  const priceVerdict = price / fair > 1.12 ? 'expensive' : price / fair < 0.85 ? 'cheap' : 'fair';
  return { biz: next, report: { dish, price, fair, sat, vis, revenue, cost, profit, tipRate, repDelta, priceVerdict, fameMult: biz.fame.mult } };
}

/** 확장 가능 여부 */
export function upgradeStatus(biz) {
  const next = SHOP_LEVELS[biz.level];
  if (!next) return { max: true };
  const lacks = [];
  if (biz.money < next.cost) lacks.push(`자금 ${won(next.cost)}`);
  if (biz.rep < next.needRep) lacks.push(`평판 ${next.needRep}`);
  if (next.needMedal && !biz.medals.some((m) => contestTier(m.contest) >= contestTier(next.needMedal) && m.place <= 3)) {
    lacks.push(`${CONTESTS.find((c) => c.key === next.needMedal).name} 입상`);
  }
  return { next, ok: lacks.length === 0, lacks };
}
const contestTier = (k) => CONTESTS.findIndex((c) => c.key === k);

export function upgrade(biz) {
  const st = upgradeStatus(biz);
  if (!st.ok) return biz;
  const dish = DISHES.find((d) => d.level === st.next.level);
  return { ...biz, money: biz.money - st.next.cost, level: st.next.level, prices: { ...biz.prices, [dish.key]: dish.base } };
}

export function contestStatus(biz, c) {
  if (c.level > biz.level) return { ok: false, why: `${SHOP_LEVELS[c.level - 1].name} 이상` };
  const wait = biz.lastContestDay + CONTEST_COOLDOWN - biz.day;
  if (wait > 0) return { ok: false, why: `${wait}일 후 참가 가능` };
  if (biz.money < c.fee) return { ok: false, why: `참가비 ${won(c.fee)} 부족` };
  return { ok: true };
}

/** 경쟁자 점수 (시드 고정 가능) */
export function rivalScores(c, rand = Math.random) {
  const [mean, sd] = c.rivals;
  return Array.from({ length: 5 }, () => {
    const g = (rand() + rand() + rand() - 1.5) * 2 * sd; // 근사 정규분포
    return clamp(Math.round(mean + g), 20, 99);
  }).sort((a, b) => b - a);
}

/** 대회 정산: 순위 → 상금·명성(손님 증가)·평판 */
export function settleContest(biz, c, score, rivals) {
  const place = 1 + rivals.filter((r) => r > score).length;
  const medal = place <= 3;
  const prize = medal ? c.prizes[place - 1] : 0;
  const fameMult = medal ? c.fame[place - 1] : 1;
  const repGain = medal ? c.rep[place - 1] : -1;
  const next = {
    ...biz,
    day: biz.day + 1,
    money: biz.money - c.fee + prize,
    rep: clamp(biz.rep + repGain, 0, 100),
    fame: medal && fameMult >= biz.fame.mult ? { mult: fameMult, days: FAME_DAYS } : biz.fame,
    lastContestDay: biz.day,
    medals: medal ? [...biz.medals, { contest: c.key, place, day: biz.day }] : biz.medals,
  };
  return { biz: next, report: { place, medal, prize, fameMult, repGain, fee: c.fee, total: rivals.length + 1 } };
}

// ---------------- 손님 생성 ----------------
const NAMES = ['김민준', '이서연', '박지호', '최수아', '정도윤', '강하은', '조시우', '윤지유', '장예준', '임서윤', '한지민', '오태양', '서하린', '신우진', '권나연'];
const FACES = ['🧑‍💼', '👩‍🎨', '👨‍🔧', '👩‍💻', '🧑‍🍳', '👵', '👨‍🎓', '👩‍⚕️', '🧔', '👱‍♀️'];
const ORDERS = ['rare', 'medium-rare', 'medium-rare', 'medium', 'medium-well'];
const SKIN = ['#f2c9a0', '#f5d0b0', '#e8b98e', '#d9a679', '#f7d9c0'];
const HAIR = ['#2b1d14', '#6b3a1e', '#111', '#d8d8d8', '#8a5a2c', '#c9a14a'];
const SHIRT = ['#3d6fb6', '#c2456b', '#2a2a2a', '#3f8a5a', '#8a4fb0', '#d07a2c'];

export function makeCustomer(biz, rand = Math.random, { tutorial = false } = {}) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const order = tutorial ? 'medium-rare' : pick(ORDERS);
  const saltRoll = rand();
  const saltPref = tutorial ? 1 : saltRoll < 0.2 ? 0.8 : saltRoll > 0.8 ? 1.3 : 1;
  const lines = {
    rare: '레어로 부탁해요. 속은 촉촉하게!', 'medium-rare': '미디엄 레어로 주세요!', medium: '미디엄으로요. 핏기는 조금만.', 'medium-well': '미디엄 웰이요. 너무 질기지 않게요!',
  };
  const saltLine = saltPref > 1 ? ' 저 짜게 먹어요.' : saltPref < 1 ? ' 싱겁게 해주세요.' : '';
  return {
    id: `guest-${Math.floor(rand() * 1e9)}`,
    face: pick(FACES), name: pick(NAMES), title: '손님',
    order, saltPref,
    time: Math.max(210, 300 - (biz.level - 1) * 20),
    hints: tutorial,
    strict: 1 + (biz.level - 1) * 0.12,
    line: lines[order] + saltLine,
    skin: pick(SKIN), hair: pick(HAIR), shirt: pick(SHIRT),
  };
}

export function contestJudge(c, rand = Math.random) {
  const orders = ['rare', 'medium-rare', 'medium'];
  const order = orders[Math.floor(rand() * orders.length)];
  return {
    id: `judge-${c.key}`, face: '🧑‍⚖️', name: `${c.name} 심사위원단`, title: '심사위원',
    order, saltPref: 1, time: c.time, hints: false, strict: c.strict,
    line: `과제: ${dishByKey(c.dish).name}, ${{ rare: '레어', 'medium-rare': '미디엄 레어', medium: '미디엄' }[order]}. 실수는 용납하지 않습니다.`,
    skin: '#e8b98e', hair: '#d8d8d8', shirt: '#2a2a2a', contest: c.key,
  };
}
