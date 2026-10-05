// 난이도: 손님 인내심·채점 관대함·뒤집기 허용 범위·조리 도우미를 한 곳에서 조절
export const DIFFS = {
  easy: {
    key: 'easy', name: '쉬움', icon: '🌱',
    patience: 1.7,      // 손님 인내심 배수 (= 주문 제한 시간)
    strict: 0.6,        // 손님 깐깐함 배수 (낮을수록 오차 허용 범위가 넓음)
    lenient: 0.35,      // 단계 점수의 부족분을 이만큼 메워 줌
    capBonus: 15,       // 큰 실수 시 점수 상한 완화
    flip: { min: 8, perfectLo: 13, perfectHi: 25, max: 38 },
    guide: true,        // 굽기 중심 온도 게이지·내릴 타이밍 안내, 힌트 항상 표시
    arrivals: 0.8,      // 하루 손님 수 배수
  },
  normal: {
    key: 'normal', name: '보통', icon: '🍳',
    patience: 1.25, strict: 0.8, lenient: 0.15, capBonus: 7,
    flip: { min: 11, perfectLo: 15, perfectHi: 23, max: 31 },
    guide: true, arrivals: 0.9,
  },
  hard: {
    key: 'hard', name: '어려움', icon: '🔥',
    patience: 1, strict: 1, lenient: 0, capBonus: 0,
    flip: { min: 13, perfectLo: 16, perfectHi: 22, max: 26 },
    guide: false, arrivals: 1,
  },
};
export const DIFF_ORDER = ['easy', 'normal', 'hard'];

export let diff = DIFFS.easy;
export function setDifficulty(k) { diff = DIFFS[k] || DIFFS.easy; return diff; }
