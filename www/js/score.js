// 평가: 요리 과정의 양·타이밍을 점수로 환산하고 손님 코멘트를 만든다
import { TARGETS, donenessOf } from './sim.js';

export const SEASON_TARGET = { salt: 2.4, pepper: 0.8, oil: 10 };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const bell = (x, sigma) => Math.exp(-(x * x) / (2 * sigma * sigma));

export function crustQuality(b) {
  if (b >= 0.85 && b <= 1.35) return 1;
  if (b < 0.85) return Math.pow(clamp(b / 0.85, 0, 1), 1.6);
  return clamp(1 - (b - 1.35) / 0.6, 0, 1);
}

export function plateScore(plate) {
  if (!plate) return { score: 0, notes: ['접시가 비어 있어요'] };
  const R = plate.plateR || 150;
  const notes = [];
  let s = 0;
  const st = plate.steak;
  const sd = Math.hypot(st.x, st.y);
  s += 3 * clamp(1 - (sd - 50) / 60, 0, 1);
  if (sd > 90) notes.push('스테이크가 접시 한쪽으로 쏠렸어요');
  const items = plate.items || [];
  const types = new Map();
  for (const it of items) types.set(it.key, (types.get(it.key) || 0) + 1);
  const t = types.size;
  s += t === 0 ? 0 : t === 1 ? 1 : t === 2 ? 2 : t <= 5 ? 3 : 2.5;
  const n = items.length;
  s += n === 0 ? 0 : n <= 3 ? 1 : n <= 14 ? 2 : n <= 20 ? 1.5 : 0.5;
  if (n === 0) notes.push('가니쉬가 하나도 없어 허전해요');
  if (n > 20) notes.push('재료가 너무 많아 어수선해요');
  const onRim = items.filter((it) => Math.hypot(it.x, it.y) > R * 0.86).length;
  s -= Math.min(2, onRim * 0.5);
  if (onRim >= 2) notes.push('접시 테두리까지 재료가 넘쳤어요');
  // 균형: 스테이크(가중치 4)와 가니쉬의 무게중심
  let wx = st.x * 4, wy = st.y * 4, w = 4;
  for (const it of items) { wx += it.x; wy += it.y; w += 1; }
  const bd = Math.hypot(wx / w, wy / w);
  s += 2 * clamp(1 - (bd - 22) / 50, 0, 1);
  const sauceLen = (plate.sauce || []).reduce((a, st2) => {
    let L = 0;
    for (let i = 1; i < st2.length; i++) L += Math.hypot(st2[i][0] - st2[i - 1][0], st2[i][1] - st2[i - 1][1]);
    return a + L;
  }, 0);
  s += sauceLen === 0 ? 0 : sauceLen <= 520 ? 1.5 : 0.8;
  let odd = 0;
  for (const [k, c] of types) if (c % 2 === 1 && c > 1 && k !== 'slaw') odd++;
  s += Math.min(1, odd * 0.5);
  if (n > 0) s += 0.5;
  return { score: clamp(s, 0, 13), notes, types: t, count: n, sauceLen };
}

/**
 * state: game.state 전체. 반환: { total, stars, parts, comments, mood, doneness }
 */
export function computeScore(state) {
  const c = state.customer;
  const strict = c.strict || 1;
  const parts = [];
  const issues = []; // {sev, text}
  let cap = 100; // 치명적 실수는 다른 걸 잘해도 점수 상한을 건다
  const praises = [];

  // 1. 손질 (15)
  const trim = state.trim;
  let trimS = 0;
  if (trim) {
    const dmgF = 1 - Math.min(0.6, trim.damage / 150);
    trimS = 15 * clamp(trim.removed, 0, 1) * dmgF;
    if (trim.removed < 0.7) issues.push({ sev: 3, text: '질긴 근막이 씹혀요…' });
    else if (trim.removed > 0.95 && trim.damage < 20) praises.push('손질이 깔끔해서 식감이 부드러워요');
    if (trim.damage > 60) issues.push({ sev: 2, text: '칼질이 거칠어서 고기가 너덜너덜해요' });
  }
  parts.push({ key: 'trim', label: '손질', score: trimS, max: 15 });

  // 2. 양배추 (10)
  const cab = state.cabbage;
  let cabS = 0;
  const slawOnPlate = state.plate && state.plate.items.some((i) => i.key === 'slaw');
  if (cab) {
    cabS = 10 * clamp(cab.fineness, 0, 1);
    if (!slawOnPlate) cabS *= 0.5;
    if (cab.fineness < 0.35) issues.push({ sev: 1, text: '양배추가 너무 굵어서 질겨요' });
    else if (cab.fineness > 0.8 && slawOnPlate) praises.push('샐러드가 아삭아삭해요');
    if (!slawOnPlate && state.plate) issues.push({ sev: 1, text: '열심히 썬 양배추는 어디 갔죠?' });
  }
  parts.push({ key: 'cabbage', label: '채썰기', score: cabS, max: 10 });

  // 3. 간 (20)
  const se = state.season;
  let seS = 0;
  let saltRatio = 0;
  if (se) {
    const tgt = SEASON_TARGET.salt * (c.saltPref || 1) * (state.dish?.saltMul || 1);
    saltRatio = se.salt / tgt;
    const lr = Math.log(Math.max(saltRatio, 0.02));
    seS += 11 * bell(lr, 0.33 / strict);
    seS += 4 * bell(Math.log(Math.max(se.pepper / SEASON_TARGET.pepper, 0.02)), 0.55 / strict);
    seS += 2 * bell(Math.log(Math.max(se.oil / SEASON_TARGET.oil, 0.02)), 0.7);
    seS += 3 * clamp(se.coverage / 0.8, 0, 1);
    if (saltRatio < 0.35) issues.push({ sev: 3, text: '간이 하나도 안 돼서 밍밍해요' });
    else if (saltRatio < 0.7) issues.push({ sev: 2, text: '좀 싱거워요' });
    else if (saltRatio > 2) { issues.push({ sev: 3, text: '으악, 너무 짜요!' }); cap = Math.min(cap, 62); }
    else if (saltRatio > 1.4) issues.push({ sev: 2, text: '조금 짜네요' });
    else praises.push('간이 딱 맞아요');
    if (se.pepper < SEASON_TARGET.pepper * 0.3) issues.push({ sev: 1, text: '후추 향이 아쉬워요' });
    if (se.coverage < 0.45 && se.salt > 0) issues.push({ sev: 1, text: '간이 한쪽에만 몰려 있어요' });
  } else issues.push({ sev: 3, text: '간을 안 했어요?' });
  parts.push({ key: 'season', label: '간', score: seS, max: 20 });

  // 4. 굽기 (37)
  const ck = state.cook;
  let ckS = 0;
  let doneness = null;
  if (ck) {
    const tgt = TARGETS[c.order];
    const diff = ck.core - tgt.ideal;
    doneness = donenessOf(ck.core);
    const dS = 20 * bell(diff, 3.4 / strict);
    const top = ck.brown[ck.up], bot = ck.brown[1 - ck.up];
    const crust = 10 * (0.6 * crustQuality(top) + 0.4 * crustQuality(bot));
    const even = 3 * (1 - Math.min(1, Math.abs(top - bot) / 0.8));
    const skill = ck.flips === 0 ? 0 : 4 * Math.max(0, 1 - ck.folds * 0.34) * (ck.foldTime > 6 ? 0.6 : 1);
    ckS = dS + crust + even + skill;
    if (diff < -9) { issues.push({ sev: 4, text: `속이 거의 날것이에요… ${tgt.name}을 시켰는데!` }); cap = Math.min(cap, 58); }
    else if (diff < -3.5) issues.push({ sev: 3, text: `덜 익었어요. 이건 ${doneness.name}에 가까워요` });
    else if (diff > 9) { issues.push({ sev: 4, text: `너무 익어서 퍽퍽해요. 완전 ${doneness.name}이네요` }); cap = Math.min(cap, 62); }
    else if (diff > 3.5) issues.push({ sev: 3, text: `조금 더 익었어요. ${doneness.name}이에요` });
    else praises.push(`완벽한 ${tgt.name}! 육즙이 살아 있어요`);
    if (Math.max(top, bot) > 1.75) { issues.push({ sev: 3, text: '탄 맛이 나요…' }); cap = Math.min(cap, 70); }
    else if (Math.min(top, bot) < 0.45) issues.push({ sev: 2, text: '겉면이 허옇고 바삭함이 없어요' });
    else if (crust > 8.5) praises.push('겉바속촉! 크러스트가 예술이에요');
    if (ck.folds >= 2) issues.push({ sev: 1, text: '모양이 좀 일그러졌네요' });
  } else issues.push({ sev: 5, text: '스테이크가… 없어요?' });
  parts.push({ key: 'cook', label: '굽기', score: ckS, max: 37 });

  // 5. 플레이팅 (13)
  const ps = plateScore(state.plate);
  if (state.plate) {
    for (const n of ps.notes) issues.push({ sev: 1, text: n });
    if (ps.score >= 10.5) praises.push('플레이팅이 레스토랑 같아요');
  }
  parts.push({ key: 'plate', label: '플레이팅', score: state.plate ? ps.score : 0, max: 13 });

  // 6. 시간 보너스 (5)
  const tS = state.timedOut ? 0 : 5 * clamp(state.timeLeft / (state.timeTotal * 0.25), 0, 1);
  parts.push({ key: 'time', label: '시간', score: tS, max: 5 });

  let total = parts.reduce((a, p) => a + p.score, 0);
  total = Math.min(total, cap);
  if (state.timedOut && !state.cook) total = Math.min(total, 10);
  total = Math.round(clamp(total, 0, 100));
  const stars = total >= 90 ? 5 : total >= 75 ? 4 : total >= 60 ? 3 : total >= 40 ? 2 : 1;
  const mood = state.timedOut && !state.cook ? 'angry' : total >= 85 ? 'love' : total >= 70 ? 'happy' : total >= 52 ? 'neutral' : total >= 35 ? 'meh' : 'bad';
  issues.sort((a, b) => b.sev - a.sev);
  const headline = state.timedOut && !state.cook ? '너무 오래 기다렸어요. 다음에 올게요!'
    : total >= 90 ? '인생 스테이크예요! 또 올게요!'
    : total >= 75 ? '정말 맛있어요!'
    : total >= 60 ? '괜찮네요. 다음엔 더 기대할게요.'
    : total >= 40 ? '음… 먹을 만은 해요.'
    : '이건 좀… 아닌 것 같아요.';
  const comments = [headline, ...issues.slice(0, 3).map((i) => i.text), ...praises.slice(0, issues.length ? 1 : 2)];
  return { total, stars, parts, comments, mood, doneness, saltRatio, plate: ps };
}
