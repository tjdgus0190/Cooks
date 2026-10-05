// 난이도: 손님 인내심·채점 관대함·조작 허용 범위·조리 도우미·경영 패널티를 한 곳에서 조절
export const DIFFS = {
  easy: {
    key: 'easy', name: '쉬움', icon: '🌱',
    patience: 2.0,      // 손님 인내심 배수 (= 주문 제한 시간)
    playerDrain: 0.15,  // 사장이 직접 조리 중인 손님의 인내심 감소 속도 (거의 안 줄어듦)
    waitDrain: 0.6,     // 그 밖에 기다리는 손님의 인내심 감소 속도
    strict: 0.45,       // 손님 깐깐함 배수 (낮을수록 오차 허용 범위가 넓음)
    lenient: 0.5,       // 단계 점수 부족분을 이만큼 메워 줌
    capBonus: 25,       // 큰 실수 시 점수 상한 완화
    flip: { min: 3, perfectLo: 10, perfectHi: 45, max: 999 }, // 어떤 세기로 튕겨도 뒤집힘 (접히지 않음)
    cutReach: 1.3,      // 손질 칼이 근막·내장을 잘라내는 판정 폭 (배수)
    cutDamage: 0.3,     // 살코기를 벤 손상 배수
    angleLimit: false,  // 칼질 각도 제한 해제
    guide: true,        // 굽기 속 온도 게이지·꺼낼 타이밍·삶기 건질 타이밍 안내, 계량 목표 구간 표시
    autoPlate: true,    // 플레이팅 '⚡ 자동' 버튼 항상
    burn: 0.65,         // 겉면 갈변(탐) 속도 배수
    arrivals: 0.75,     // 하루 손님 수 배수
    lostWeight: 0.3,    // 놓친 손님이 평판에 주는 영향 배수
    repLoss: 0.4,       // 평판 하락 폭 배수
    waitPenalty: 0.3,   // 오래 기다린 손님 만족도 감점 배수
  },
  normal: {
    key: 'normal', name: '보통', icon: '🍳',
    patience: 1.4, playerDrain: 0.35, waitDrain: 0.85, strict: 0.7, lenient: 0.25, capBonus: 12,
    flip: { min: 8, perfectLo: 13, perfectHi: 27, max: 40 },
    cutReach: 0.95, cutDamage: 0.6, angleLimit: true, guide: true, autoPlate: true, burn: 0.85,
    arrivals: 0.9, lostWeight: 0.7, repLoss: 0.75, waitPenalty: 0.7,
  },
  hard: {
    key: 'hard', name: '어려움', icon: '🔥',
    patience: 1, playerDrain: 0.6, waitDrain: 1, strict: 1, lenient: 0, capBonus: 0,
    flip: { min: 13, perfectLo: 16, perfectHi: 22, max: 26 },
    cutReach: 0.62, cutDamage: 1, angleLimit: true, guide: false, autoPlate: false, burn: 1,
    arrivals: 1, lostWeight: 1, repLoss: 1, waitPenalty: 1,
  },
};
export const DIFF_ORDER = ['easy', 'normal', 'hard'];

export let diff = DIFFS.easy;
export function setDifficulty(k) { diff = DIFFS[k] || DIFFS.easy; return diff; }
