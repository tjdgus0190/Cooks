// 평가: 요리 과정의 양·타이밍을 점수로 환산하고 손님 코멘트를 만든다
import { TARGETS, donenessOf } from './sim.js';
import { diff } from './difficulty.js';

export const SEASON_TARGET = { salt: 2.4, pepper: 0.8, oil: 10 };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** 한국어 조사: josa('마늘', '이', '가') → '마늘이' */
export function josa(word, withB, withoutB) {
  const c = word.charCodeAt(word.length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return word + (has ? withB : withoutB);
}
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
  const st = plate.main || plate.steak;
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

// ---------------- 단계별 평가 ----------------
// 각 평가 함수: (data, ctx) → { score(0~1), issues:[{sev,text,cap?}], praises:[] }

function evalTrim(trim, ctx) {
  const out = { score: 0, issues: [], praises: [] };
  if (!trim) return out;
  const dmgF = 1 - Math.min(0.6, trim.damage / 150);
  out.score = clamp(trim.removed, 0, 1) * dmgF;
  const what = { steak: '질긴 근막이 씹혀요…', shrimp: '새우 내장이 씹혀요… 쓴맛이 나요', lobster: '껍질 손질이 엉망이에요' }[trim.subject || 'steak'];
  if (trim.removed < 0.7) out.issues.push({ sev: 3, text: what });
  else if (trim.removed > 0.95 && trim.damage < 20) out.praises.push(trim.subject === 'shrimp' ? '새우 손질이 깔끔해요' : '손질이 깔끔해서 식감이 부드러워요');
  if (trim.damage > 60) out.issues.push({ sev: 2, text: '칼질이 거칠어서 살이 너덜너덜해요' });
  return out;
}

function evalCabbage(cab, ctx) {
  const out = { score: 0, issues: [], praises: [] };
  if (!cab) return out;
  out.score = clamp(cab.fineness, 0, 1) * (ctx.slawOnPlate ? 1 : 0.5);
  if (cab.fineness < 0.35) out.issues.push({ sev: 1, text: '양배추가 너무 굵어서 질겨요' });
  else if (cab.fineness > 0.8 && ctx.slawOnPlate) out.praises.push('샐러드가 아삭아삭해요');
  if (!ctx.slawOnPlate && ctx.plate) out.issues.push({ sev: 1, text: '열심히 썬 양배추는 어디 갔죠?' });
  return out;
}

function evalSeason(se, ctx) {
  const out = { score: 0, issues: [], praises: [] };
  if (!se) { out.issues.push({ sev: 3, text: '간을 안 했어요?' }); return out; }
  const { c, strict, dish } = ctx;
  const tools = se.tools || ['salt', 'pepper', 'oil'];
  const tgtSalt = SEASON_TARGET.salt * (c.saltPref || 1) * (dish?.saltMul || 1) * (se.saltScale || 1);
  const saltRatio = se.salt / tgtSalt;
  let pts = 0, max = 0;
  const lr = Math.log(Math.max(saltRatio, 0.02));
  pts += 11 * bell(lr, 0.33 / strict); max += 11;
  if (tools.includes('pepper')) { pts += 4 * bell(Math.log(Math.max(se.pepper / SEASON_TARGET.pepper, 0.02)), 0.55 / strict); max += 4; }
  if (tools.includes('oil')) { pts += 2 * bell(Math.log(Math.max(se.oil / SEASON_TARGET.oil, 0.02)), 0.7); max += 2; }
  pts += 3 * clamp(se.coverage / 0.8, 0, 1); max += 3;
  out.score = pts / max;
  out.saltRatio = saltRatio;
  if (saltRatio < 0.35) out.issues.push({ sev: 3, text: '간이 하나도 안 돼서 밍밍해요' });
  else if (saltRatio < 0.7) out.issues.push({ sev: 2, text: '좀 싱거워요' });
  else if (saltRatio > 2) out.issues.push({ sev: 3, text: '으악, 너무 짜요!', cap: 62 });
  else if (saltRatio > 1.4) out.issues.push({ sev: 2, text: '조금 짜네요' });
  else out.praises.push('간이 딱 맞아요');
  if (tools.includes('pepper') && se.pepper < SEASON_TARGET.pepper * 0.3) out.issues.push({ sev: 1, text: '후추 향이 아쉬워요' });
  if (se.coverage < 0.45 && se.salt > 0) out.issues.push({ sev: 1, text: '간이 한쪽에만 몰려 있어요' });
  return out;
}

function evalSear(ck, ctx) {
  const out = { score: 0, issues: [], praises: [] };
  if (!ck) { out.issues.push({ sev: 5, text: '요리가… 없어요?' }); return out; }
  const { c, strict } = ctx;
  const tgt = TARGETS[c.order] || TARGETS['medium-rare'];
  const diff = ck.core - tgt.ideal;
  const doneness = donenessOf(ck.core);
  out.doneness = doneness;
  const dS = 20 * bell(diff, 3.4 / strict);
  const top = ck.brown[ck.up], bot = ck.brown[1 - ck.up];
  const crust = 10 * (0.6 * crustQuality(top) + 0.4 * crustQuality(bot));
  const even = 3 * (1 - Math.min(1, Math.abs(top - bot) / 0.8));
  const skill = ck.flips === 0 ? 0 : 4 * Math.max(0, 1 - ck.folds * 0.34) * (ck.foldTime > 6 ? 0.6 : 1);
  out.score = (dS + crust + even + skill) / 37;
  if (diff < -9) out.issues.push({ sev: 4, text: `속이 거의 날것이에요… ${josa(tgt.name, '을', '를')} 시켰는데!`, cap: 58 });
  else if (diff < -3.5) out.issues.push({ sev: 3, text: `덜 익었어요. 이건 ${doneness.name}에 가까워요` });
  else if (diff > 9) out.issues.push({ sev: 4, text: `너무 익어서 퍽퍽해요. 완전 ${doneness.name}이네요`, cap: 62 });
  else if (diff > 3.5) out.issues.push({ sev: 3, text: `조금 더 익었어요. ${doneness.name}이에요` });
  else out.praises.push(`완벽한 ${tgt.name}! 육즙이 살아 있어요`);
  if (Math.max(top, bot) > 1.75) out.issues.push({ sev: 3, text: '탄 맛이 나요…', cap: 70 });
  else if (Math.min(top, bot) < 0.45) out.issues.push({ sev: 2, text: '겉면이 허옇고 바삭함이 없어요' });
  else if (crust > 8.5) out.praises.push('겉바속촉! 크러스트가 예술이에요');
  if (ck.folds >= 2) out.issues.push({ sev: 1, text: '모양이 좀 일그러졌네요' });
  return out;
}

/** 면 삶기/데치기: 소금물 농도, 익힘 시간, 면수 */
export function evalBoil(b, ctx) {
  const out = { score: 0, issues: [], praises: [] };
  if (!b) { out.issues.push({ sev: 4, text: '면이… 안 삶겼어요', cap: 50 }); return out; }
  const pasta = b.item === 'spaghetti';
  const saltR = b.salt / b.saltTarget;
  const saltS = bell(Math.log(Math.max(saltR, 0.05)), 0.45 / ctx.strict);
  // 알 덴테 = 포장 시간 1분 전 (팬에서 마저 익힘). 랍스터는 데치기 목표 시간
  const ideal = pasta ? b.pkgMin - 1 : b.pkgMin;
  const diff = b.minutes - ideal;
  const timeS = bell(diff, 1.1 / ctx.strict);
  out.score = pasta ? 0.3 * saltS + 0.55 * timeS + 0.15 * (b.reserved ? 1 : 0) : 0.25 * saltS + 0.75 * timeS;
  if (pasta) {
    if (diff < -2.5) out.issues.push({ sev: 3, text: '면이 딱딱하게 덜 익었어요', cap: 65 });
    else if (diff > 2.5) out.issues.push({ sev: 3, text: '면이 퍼졌어요…', cap: 68 });
    else if (Math.abs(diff) <= 0.8) out.praises.push('면이 완벽한 알 덴테예요');
    if (!b.reserved) out.issues.push({ sev: 1, text: '면수가 없어서 소스가 겉돌아요' });
    if (saltR < 0.4) out.issues.push({ sev: 2, text: '면이 싱거워요 (면수에 소금!)' });
    else if (saltR > 2.2) out.issues.push({ sev: 2, text: '면이 너무 짜요' });
  } else {
    if (diff > 2) out.issues.push({ sev: 3, text: '랍스터가 질겨요 (너무 오래 데침)' });
    else if (diff < -2) out.issues.push({ sev: 2, text: '랍스터 속이 덜 익었어요' });
  }
  return out;
}

/** 팬 요리(소테): 재료별 익힘 구간, 오일 양, 유화, 스크램블 실패 등 */
export function evalSaute(sa, ctx) {
  const out = { score: 0, issues: [], praises: [] };
  if (!sa) { out.issues.push({ sev: 4, text: '소스를 안 만들었어요', cap: 55 }); return out; }
  let pts = 0, max = 0;
  const win = (k, lo, hi, name, burnAt) => {
    const v = sa.items[k];
    if (v == null) return;
    max += 1;
    const q = v < lo ? Math.pow(v / lo, 1.4) : v > hi ? Math.max(0, 1 - (v - hi) / ((burnAt || hi * 1.6) - hi)) : 1;
    pts += q;
    if (v > (burnAt || 99)) out.issues.push({ sev: 3, text: `${josa(name, '이', '가')} 타서 쓴맛이 나요`, cap: 66 });
    else if (q < 0.5) out.issues.push({ sev: 2, text: `${josa(name, '이', '가')} ${v < lo ? (k === 'sauce' ? '덜 졸았어요' : '덜 익었어요') : '너무 익었어요'}` });
  };
  win('garlic', 0.55, 1.05, '마늘', 1.4);
  win('shrimp', 0.85, 1.2, '새우', 1.7);
  win('guanciale', 0.7, 1.15, '관찰레', 1.6);
  win('lobster', 0.85, 1.2, '랍스터', 1.7);
  win('shallot', 0.4, 1.0, '샬롯', 1.4);
  win('sauce', 0.5, 1.1, '소스', 1.8);
  if (sa.oilTarget) {
    max += 1;
    pts += bell(Math.log(Math.max(sa.oil / sa.oilTarget, 0.05)), 0.5);
    if (sa.oil < sa.oilTarget * 0.5) out.issues.push({ sev: 2, text: '오일이 부족해서 퍽퍽해요' });
    else if (sa.oil > sa.oilTarget * 2) out.issues.push({ sev: 2, text: '기름이 너무 많아 느끼해요' });
  }
  if (sa.tossTarget) {
    max += 1.5;
    pts += 1.5 * clamp(sa.emulsion, 0, 1);
    if (sa.emulsion < 0.5) out.issues.push({ sev: 2, text: '소스가 면에 안 붙고 겉돌아요' });
    else if (sa.emulsion > 0.9) out.praises.push('소스가 면에 착 감겨요');
  }
  if (sa.spill > 0.15) out.issues.push({ sev: 1, text: '팬을 너무 세게 흔들어 재료가 흘렀어요' });
  if (sa.baste != null) {
    max += 1;
    pts += clamp(sa.baste, 0, 1);
    if (sa.baste < 0.5) out.issues.push({ sev: 1, text: '버터 향이 덜 뱄어요' });
  }
  if (sa.scrambled) { out.issues.push({ sev: 4, text: '계란이 익어서 스크램블이 됐어요…', cap: 55 }); pts -= 1; }
  if (sa.missing?.length) out.issues.push({ sev: 3, text: `${josa(sa.missing.join(', '), '이', '가')} 빠졌어요`, cap: 70 });
  out.score = max ? clamp(pts / max, 0, 1) : 0.5;
  if (out.score > 0.85 && !out.issues.length) out.praises.push('불 조절이 완벽해요');
  return out;
}

export function evalWhisk(w, ctx) {
  const out = { score: 0, issues: [], praises: [] };
  if (!w) return out;
  const cheese = bell(Math.log(Math.max(w.cheese / w.cheeseTarget, 0.05)), 0.45);
  const pepper = bell(Math.log(Math.max(w.pepper / w.pepperTarget, 0.05)), 0.6);
  out.score = 0.5 * clamp(w.mix, 0, 1) + 0.35 * cheese + 0.15 * pepper;
  if (w.mix < 0.6) out.issues.push({ sev: 2, text: '소스가 덜 섞여 노른자 덩어리가 있어요' });
  if (w.cheese < w.cheeseTarget * 0.5) out.issues.push({ sev: 2, text: '치즈 맛이 약해요' });
  if (w.pepper < w.pepperTarget * 0.4) out.issues.push({ sev: 1, text: '까르보나라엔 후추가 듬뿍 들어가야죠' });
  return out;
}

export function evalOven(o, ctx) {
  const out = { score: 0, issues: [], praises: [] };
  if (!o) return out;
  out.score = crustQuality(o.brown * 1.1);
  if (o.brown > 1.6) out.issues.push({ sev: 3, text: '치즈가 탔어요', cap: 70 });
  else if (o.brown < 0.4) out.issues.push({ sev: 2, text: '치즈가 녹기만 하고 노릇하지 않아요' });
  else if (out.score > 0.9) out.praises.push('치즈 크러스트가 노릇노릇해요');
  return out;
}

function evalPlate(plate, ctx) {
  const out = { score: 0, issues: [], praises: [] };
  if (!plate) return out;
  const ps = plateScore(plate);
  out.score = ps.score / 13;
  for (const n of ps.notes) out.issues.push({ sev: 1, text: n });
  const want = ctx.dish?.wantGarnish || [];
  for (const k of want) {
    if (!plate.items.some((i) => i.key === k) && k !== 'slaw') {
      out.issues.push({ sev: 1, text: { baguette: '오일을 찍어 먹을 바게트가 없어요', lemon: '레몬이 빠져서 느끼해요' }[k] || `${josa(k, '이', '가')} 빠졌어요` });
      out.score *= 0.8;
    }
  }
  if (plate.twirl != null && plate.twirl < 0.5) { out.issues.push({ sev: 1, text: '면이 흐트러지게 담겼어요' }); out.score *= 0.85; }
  if (ps.score >= 10.5) out.praises.push('플레이팅이 레스토랑 같아요');
  return out;
}

const STEP_INFO = {
  trim: { label: '손질', max: 15, data: 'trim', fn: evalTrim },
  cabbage: { label: '채썰기', max: 10, data: 'cabbage', fn: evalCabbage },
  season: { label: '간', max: 20, data: 'season', fn: evalSeason },
  sear: { label: '굽기', max: 37, data: 'cook', fn: evalSear },
  boil: { label: '삶기', max: 20, data: 'boil', fn: evalBoil },
  whisk: { label: '소스', max: 12, data: 'whisk', fn: evalWhisk },
  saute: { label: '팬 요리', max: 35, data: 'saute', fn: evalSaute },
  oven: { label: '오븐', max: 12, data: 'oven', fn: evalOven },
  plate: { label: '플레이팅', max: 13, data: 'plate', fn: evalPlate },
};

/**
 * state: game.state 전체. 반환: { total, stars, parts, comments, mood, doneness }
 * 단계 목록은 state.steps(레시피 단계 타입) — 없으면 기존 스테이크 5단계
 */
export function computeScore(state) {
  const c = state.customer;
  const strict = (c.strict || 1) * diff.strict;
  const steps = state.steps || ['trim', 'cabbage', 'season', 'sear', 'plate'];
  const ctx = { c, strict, dish: state.dish, plate: state.plate, slawOnPlate: !!state.plate?.items?.some((i) => i.key === 'slaw') };
  const parts = [];
  const issues = [];
  const praises = [];
  let cap = 100;
  let doneness = null, saltRatio = 0;
  const raw = [];
  for (const type of steps) {
    const info = STEP_INFO[type];
    if (!info) continue;
    const r = info.fn(state[info.data], ctx);
    raw.push({ type, info, r });
    if (r.doneness) doneness = r.doneness;
    if (r.saltRatio != null) saltRatio = r.saltRatio;
    r.score = r.score + (1 - clamp(r.score, 0, 1)) * diff.lenient * (r.score > 0 ? 1 : 0);
    for (const i of r.issues) { issues.push(i); if (i.cap) cap = Math.min(cap, i.cap + diff.capBonus); }
    praises.push(...r.praises);
  }
  // 배점 정규화: 단계 배점 합 + 시간 5점 = 100
  const sumMax = raw.reduce((a, x) => a + x.info.max, 0) || 1;
  const k = 95 / sumMax;
  for (const { type, info, r } of raw) {
    const max = Math.round(info.max * k);
    parts.push({ key: type, label: info.label, score: clamp(r.score, 0, 1) * max, max });
  }
  const tS = state.timedOut ? 0 : 5 * clamp(state.timeLeft / (state.timeTotal * 0.25), 0, 1);
  parts.push({ key: 'time', label: '시간', score: tS, max: 5 });

  let total = parts.reduce((a, p) => a + p.score, 0);
  total = Math.min(total, cap);
  const noDish = !state.cook && !state.saute && !state.boil;
  if (state.timedOut && noDish) total = Math.min(total, 10);
  total = Math.round(clamp(total, 0, 100));
  const stars = total >= 90 ? 5 : total >= 75 ? 4 : total >= 60 ? 3 : total >= 40 ? 2 : 1;
  const mood = state.timedOut && noDish ? 'angry' : total >= 85 ? 'love' : total >= 70 ? 'happy' : total >= 52 ? 'neutral' : total >= 35 ? 'meh' : 'bad';
  issues.sort((a, b) => b.sev - a.sev);
  const headline = state.timedOut && noDish ? '너무 오래 기다렸어요. 다음에 올게요!'
    : total >= 90 ? '인생 요리예요! 또 올게요!'
    : total >= 75 ? '정말 맛있어요!'
    : total >= 60 ? '괜찮네요. 다음엔 더 기대할게요.'
    : total >= 40 ? '음… 먹을 만은 해요.'
    : '이건 좀… 아닌 것 같아요.';
  const comments = [headline, ...issues.slice(0, 3).map((i) => i.text), ...praises.slice(0, issues.length ? 1 : 2)];
  return { total, stars, parts, comments, mood, doneness, saltRatio, plate: plateScore(state.plate) };
}
