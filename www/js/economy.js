// 가게 경영: 만족도·평판·가격 탄력성·확장·요리대회 (순수 함수 — 단위 테스트 대상)
import { RECIPES, missingFor, PREP } from './recipes.js';
import { diff } from './difficulty.js';
export const DISHES = RECIPES;

// 하루 영업은 실시간(약 5분). baseVisitors = 하루 기본 주문 수, seats = 동시 착석, staffSlots = 고용 가능 인원
export const SHOP_LEVELS = [
  { level: 1, name: '골목 포장마차', baseVisitors: 8, seats: 3, staffSlots: 1, priceMul: 1.0, cost: 0, needRep: 0, needMedal: null },
  { level: 2, name: '동네 비스트로', baseVisitors: 12, seats: 5, staffSlots: 2, priceMul: 1.15, cost: 450000, needRep: 65, needMedal: null },
  { level: 3, name: '스테이크 하우스', baseVisitors: 16, seats: 7, staffSlots: 3, priceMul: 1.3, cost: 1600000, needRep: 72, needMedal: 'city' },
  { level: 4, name: '파인다이닝', baseVisitors: 21, seats: 9, staffSlots: 4, priceMul: 1.5, cost: 8000000, needRep: 78, needMedal: 'national' },
];

// 직원: 주문을 자동으로 맡아 조리. 사장(플레이어)보다 품질이 낮고, VIP 주문은 못 맡는다
export const STAFF_TIERS = [
  { key: 'junior', name: '견습 요리사', icon: '🧑‍🍳', skill: 66, time: 70, wage: 30000, hire: 60000 },
  { key: 'cook', name: '숙련 요리사', icon: '👨‍🍳', skill: 76, time: 55, wage: 70000, hire: 200000, minLevel: 2 },
  { key: 'chef', name: '수셰프', icon: '👩‍🍳', skill: 85, time: 45, wage: 160000, hire: 700000, minLevel: 3 },
];

export const CONTESTS = [
  { key: 'local', name: '동네 요리대회', level: 1, fee: 30000, prizes: [300000, 150000, 60000], fame: [1.5, 1.3, 1.15], rep: [6, 4, 2], rivals: [62, 9], strict: 1.3, time: 240, dish: 'strip' },
  { key: 'city', name: '시 요리대회', level: 2, fee: 100000, prizes: [1000000, 500000, 200000], fame: [1.6, 1.35, 1.15], rep: [7, 4, 2], rivals: [70, 8], strict: 1.45, time: 230, dish: 'carbonara' },
  { key: 'national', name: '전국 스테이크 챔피언십', level: 3, fee: 300000, prizes: [3500000, 1700000, 600000], fame: [1.8, 1.45, 1.2], rep: [8, 5, 2], rivals: [78, 6], strict: 1.6, time: 220, dish: 'lobsterbutter' },
  { key: 'world', name: '월드 그릴 마스터즈', level: 4, fee: 1000000, prizes: [15000000, 6000000, 2000000], fame: [2.0, 1.6, 1.25], rep: [10, 6, 3], rivals: [85, 5], strict: 1.8, time: 210, dish: 'wagyu' },
];
export const CONTEST_COOLDOWN = 3; // 대회는 3일에 한 번
const FAME_DAYS = 5;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const won = (n) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

export function newBusiness() {
  return {
    day: 1, money: 100000, rep: 50, level: 1,
    staff: [],              // [{ id, tier }]
    prices: {},             // 요리별 단가 (없으면 기본가)
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

/** 한 주문의 고객 만족도: 요리 점수 − 대기 패널티 ± 가격 효과 */
export function orderSatisfaction(score, price, fair, waitFrac = 0) {
  return satisfaction(score - Math.max(0, waitFrac - 0.35) * 25 * diff.waitPenalty, price, fair);
}

/** 하루 영업 마감 정산. stats: floor.js의 day.stats */
export function endOfDay(biz, stats, inv = null) {
  const wages = biz.staff.reduce((a, s) => a + staffTier(s.tier).wage, 0);
  const profit = stats.revenue - stats.cost - wages;
  // 평판: 주문한 손님(놓친 손님은 만족도 0, VIP는 2배 가중)의 평균 만족도 쪽으로 이동
  const w = stats.sats.reduce((a, x) => a + x.w, 0);
  const avgSat = w ? stats.sats.reduce((a, x) => a + x.sat * x.w, 0) / w : biz.rep;
  let repDelta = w ? (avgSat - biz.rep) * 0.3 : 0;
  if (repDelta < 0) repDelta *= diff.repLoss;
  const next = {
    ...biz,
    day: biz.day + 1,
    money: biz.money + profit,
    rep: clamp(biz.rep + repDelta, 0, 100),
    fame: biz.fame.days > 1 ? { mult: biz.fame.mult, days: biz.fame.days - 1 } : { mult: 1, days: 0 },
    totalServed: biz.totalServed + stats.served,
    totalRevenue: biz.totalRevenue + stats.revenue,
    history: [...biz.history, { day: biz.day, served: stats.served, lost: stats.lost, sat: Math.round(avgSat), profit }].slice(-14),
  };
  // 남은 손질 재료는 신선도 때문에 절반만 다음 날로 (내림)
  let spoiled = 0;
  if (inv) {
    const kept = {};
    for (const [k, n] of Object.entries(inv)) { kept[k] = Math.floor(n / 2); spoiled += n - kept[k]; }
    next.inventory = kept;
  }
  return { biz: next, report: { ...stats, wages, profit, avgSat, repDelta, spoiled } };
}

export function staffTier(key) { return STAFF_TIERS.find((t) => t.key === key) || STAFF_TIERS[0]; }
export function canHire(biz, tierKey) {
  const t = staffTier(tierKey);
  if ((t.minLevel || 1) > biz.level) return { ok: false, why: `${SHOP_LEVELS[t.minLevel - 1].name} 이상` };
  if (biz.staff.length >= shopInfo(biz).staffSlots) return { ok: false, why: '자리가 없어요 (가게 확장 필요)' };
  if (biz.money < t.hire) return { ok: false, why: `채용비 ${won(t.hire)} 부족` };
  return { ok: true };
}
export function hire(biz, tierKey) {
  if (!canHire(biz, tierKey).ok) return biz;
  const t = staffTier(tierKey);
  return { ...biz, money: biz.money - t.hire, staff: [...biz.staff, { id: `s${Date.now().toString(36)}${biz.staff.length}`, tier: tierKey }] };
}
export function fire(biz, id) { return { ...biz, staff: biz.staff.filter((s) => s.id !== id) }; }

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
  const prices = { ...biz.prices };
  for (const d of DISHES.filter((x) => x.level === st.next.level)) prices[d.key] = d.base;
  return { ...biz, money: biz.money - st.next.cost, level: st.next.level, prices };
}

export function contestStatus(biz, c) {
  if (c.level > biz.level) return { ok: false, why: `${SHOP_LEVELS[c.level - 1].name} 이상` };
  const wait = biz.lastContestDay + CONTEST_COOLDOWN - biz.day;
  if (wait > 0) return { ok: false, why: `${wait}일 후 참가 가능` };
  if (biz.money < c.fee) return { ok: false, why: `참가비 ${won(c.fee)} 부족` };
  const miss = missingFor(dishByKey(c.dish), biz.inventory || {});
  if (miss.length) return { ok: false, why: `손질 재료 필요: ${miss.join(', ')}` };
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
const DISH_LINES = {
  aglio: ['알리오 올리오 하나요! 마늘 향 가득하게요.', '오일 파스타 주세요. 면은 꼬들하게!'],
  gambas: ['감바스 주세요! 바게트 찍어 먹을래요.', '감바스 알 아히요 하나요. 새우 탱글하게!'],
  carbonara: ['까르보나라요. 크림 말고 진짜 로마식으로!', '까르보나라 주세요. 후추 듬뿍!'],
  shrimppasta: ['새우 토마토 파스타 하나요!', '토마토 파스타요. 새우는 통통하게!'],
  lobsterbutter: ['랍스터 버터구이 부탁해요. 오늘은 특별한 날이라서요!', '랍스터 주세요. 버터 향 가득히!'],
  thermidor: ['랍스터 테르미도르로 할게요. 치즈 노릇하게!', '테르미도르 하나요. 기념일이에요!'],
};
const NAMES = ['김민준', '이서연', '박지호', '최수아', '정도윤', '강하은', '조시우', '윤지유', '장예준', '임서윤', '한지민', '오태양', '서하린', '신우진', '권나연'];
const FACES = ['🧑‍💼', '👩‍🎨', '👨‍🔧', '👩‍💻', '🧑‍🍳', '👵', '👨‍🎓', '👩‍⚕️', '🧔', '👱‍♀️'];
const ORDERS = ['rare', 'medium-rare', 'medium-rare', 'medium', 'medium-well'];
const SKIN = ['#f2c9a0', '#f5d0b0', '#e8b98e', '#d9a679', '#f7d9c0'];
const HAIR = ['#2b1d14', '#6b3a1e', '#111', '#d8d8d8', '#8a5a2c', '#c9a14a'];
const SHIRT = ['#3d6fb6', '#c2456b', '#2a2a2a', '#3f8a5a', '#8a4fb0', '#d07a2c'];

export function makeCustomer(biz, rand = Math.random, { tutorial = false, dish = null } = {}) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const steak = !dish || dish.doneness;
  const order = !steak ? null : tutorial ? 'medium-rare' : pick(ORDERS);
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
    line: (steak ? lines[order] : (DISH_LINES[dish.key] || [`${dish.name} 주세요!`])[Math.floor(rand() * (DISH_LINES[dish.key]?.length || 1))]) + saltLine,
    skin: pick(SKIN), hair: pick(HAIR), shirt: pick(SHIRT),
  };
}

export function contestJudge(c, rand = Math.random) {
  const dish = dishByKey(c.dish);
  const orders = ['rare', 'medium-rare', 'medium'];
  const order = dish.doneness ? orders[Math.floor(rand() * orders.length)] : null;
  const dn = order ? `, ${{ rare: '레어', 'medium-rare': '미디엄 레어', medium: '미디엄' }[order]}` : '';
  return {
    id: `judge-${c.key}`, face: '🧑‍⚖️', name: `${c.name} 심사위원단`, title: '심사위원',
    order, saltPref: 1, time: c.time, hints: false, strict: c.strict,
    line: `과제: ${dish.name}${dn}. 정통 레시피 그대로, 실수는 용납하지 않습니다.`,
    skin: '#e8b98e', hair: '#d8d8d8', shirt: '#2a2a2a', contest: c.key,
  };
}
