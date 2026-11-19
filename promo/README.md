# MOA Village — 홍보 패키지

## 들어 있는 것

| 파일 | 내용 |
|---|---|
| `ko.md` | Threads A/B안, X 단일·스레드, 댓글 응대, 해시태그 |
| `en.md` | English versions |
| `zh.md` | 中文版本 |
| `ja.md` | 日本語版 |
| `captures/` | 실제 앱 라이브 캡처 (아래) |

## 캡처 목록 (실제 렌더링, 2026-11-19)

| 파일 | 화면 |
|---|---|
| `captures/ko-winter-village.png` | 데스크톱 — 한국어 UI, 눈 내리는 설강 마을 + 오너먼트 8종 배치 (대표 이미지) |
| `captures/korean-winter-village.png` | 데스크톱 — 영문 UI 버전 (해외 채널용) |
| `captures/ko-shop.png` / `ko-rapid.png` / `ko-friends.png` | 한국어 상점·래피드 세트·친구(추천/공구) 화면 |
| `captures/first-run.png` | 모바일 첫 실행(닉네임) 화면 |
| `captures/mobile-shop.png` | 모바일 상점 |
| `captures/lumen-night.png` | 데스크톱 2880×1800 — 별빛 골목 밤, 랜턴·달빛 문·별사슴 |
| `captures/shop-panel.png` | 데스크톱 — 상점(유행 정렬·등급·공구 할인) |
| `captures/rapid-sets.png` | 데스크톱 — 래피드 희귀 세트 3종 |
| `captures/mobile-snowbell.png` | 모바일 390×844 (3x) — 설강 마을 |
| `captures/mobile-decorate.png` | 모바일 — 꾸미기 시트 |

추가로 찍고 싶을 때: 앱을 연 뒤 `?ref=`, `?coop=`, `?gift=` 딥링크 화면을 캡처하면 바이럴 루프 설명이 쉬워집니다.

## 발행 순서 제안

1. **스레드(한국어 A안)** — 캡처 1~2장 + 링크. 첫 30분에 댓글 응대.
2. **X(영문)** — 같은 이미지, 영문 카피. 링크에 `?utm_source=x&utm_medium=social&utm_campaign=moa_village` 붙이기.
3. **스레드(중문·일문)** — 3~4시간 뒤, 각 언어 캡처로 교체.
4. 다음 날: 공구 링크(`?coop=`)로 "5명 모이면 40%" 후속 글.

## 링크 규칙

- 기본: `https://cm-jccho.github.io/moa-village/`
- 추천: `https://cm-jccho.github.io/moa-village/?ref=THREADS-KR` 처럼 채널별 ref 코드를 붙이면 앱 안에서 초대 유입이 구분됩니다(현재는 로컬 시뮬레이션이라 숫자 집계는 없음).
- 위 4개 언어 초안(`ko/en/zh/ja.md`)은 이미 실제 배포 주소로 치환되어 있습니다.

## 주의

- "수익", "대박", "무조건" 같은 보장 표현은 쓰지 않았습니다. 프로토타입이며 무료라는 사실을 그대로 적었습니다.
- 래피드 판매 링크는 아직 실제 상품이 아니므로 "정식 버전에서 판매 예정"으로만 적었습니다. 상품을 만든 뒤 `assets/js/catalog.js` 의 `RAPID.sets[].buyUrl` 을 실제 상품 URL로 바꾸면 홍보 문구도 "지금 구매"로 바꿀 수 있습니다.
