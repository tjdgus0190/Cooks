# 🥩 쿠킹 시뮬레이터

손질부터 플레이팅까지, **손으로 요리하는** 스테이크 모바일 게임 (Android / iOS).

<img src="docs/img/icon.png" width="120" alt="아이콘">

| 단계 | 조작 |
|---|---|
| 1. 근막 손질 | 드래그한 궤적대로 칼질. 칼은 가로로만 들어가니 고기를 **돌려가며** 근막만 잘라낸다 |
| 2. 양배추 채썰기 | 그은 궤적(곡선 포함) 그대로 잘린다. 가늘수록 고득점 |
| 3. 시즈닝 | 휴대폰을 **흔들어** 소금·후추. 세게 흔들수록 많이. 오일은 흔들거나 **휘휘 돌려서** |
| 4. 굽기 | 휴대폰을 **위로 휙** 튕겨 뒤집기. 너무 약하거나 세면 고기가 접힌다. 불 조절·온도계·잔열 |
| 5. 플레이팅 | 가니쉬 드래그 앤 드롭, 두 손가락 회전, 소스 그리기 |
| 평가 | 손님이 썰어 단면 공개 → 시식 → 양·타이밍 기반 100점 평가 |

- 기획서: [docs/GDD.md](docs/GDD.md) · 아트 가이드: [docs/ART.md](docs/ART.md) · QA 보고서: [docs/QA.md](docs/QA.md)

## 구조
```
www/                 게임 본체 (빌드 도구 없는 순수 ES 모듈 + Canvas)
  js/sim.js          스테이크 열전달·마이야르 시뮬레이션
  js/geom.js         자유 곡선 다각형 분할(칼질) 등 기하
  js/motion.js       흔들기/휘젓기/플릭 감지 (+ 터치 대체 입력)
  js/meat.js, art.js, dish.js   절차적 그래픽
  js/score.js        평가
  js/scenes/*.js     타이틀·5단계·결과
android/, ios/       Capacitor 네이티브 프로젝트 (세로 고정, 전체화면)
tests/               단위 테스트 (node --test)
tools/               개발 서버, 자동 플레이 QA, 아이콘 생성
```

## 실행 / 테스트
```bash
npm install
npm run serve        # http://localhost:8080 (PC 브라우저에서는 마우스로 문지르기/쓸어올리기로 대체)
npm test             # 단위 테스트
npm run qa           # Chromium으로 게임 전체 자동 플레이 + 스크린샷(qa-output/)
```

## 앱 빌드
GitHub Actions(`.github/workflows/build.yml`)가 푸시마다 자동 빌드한다. Actions 탭의 실행 결과 → **Artifacts**에서 받는다.
- `cooking-simulator-android-apk` → `cooking-simulator-debug.apk` (휴대폰에 바로 설치 가능)
- `cooking-simulator-ios` → 시뮬레이터용 `.app`(zip), 서명 안 된 `.ipa`
  - 실기기 설치/배포에는 Apple 개발자 계정 서명이 필요하다. 로컬 Mac에서: `npm install && npx cap sync ios && npx cap open ios` → Xcode에서 Team 선택 후 실행.

로컬 빌드:
```bash
npx cap sync android && cd android && ./gradlew assembleDebug   # JDK 21 + Android SDK 필요
npx cap sync ios && npx cap open ios                            # macOS + Xcode 필요
```
