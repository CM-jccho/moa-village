# 🏡 MOA Village

작은 마을을 모으고, 오너먼트로 꾸미고, 친구와 나누는 정적 웹앱(PWA).
외부 라이브러리·CDN·서버가 없습니다. 폴더를 그대로 열면 동작합니다.

- 4개 국어: 한국어 · English · 中文 · 日本語
- 모바일 390px 기준 반응형 + 홈 화면 설치(PWA)
- 모든 상태는 브라우저 `localStorage` 에만 저장 (계정·서버 없음)
- 라이브 데모: <https://cm-jccho.github.io/moa-village/>

---

## 바로 실행

```bash
cd moa-village
python3 -m http.server 8080
# http://localhost:8080
```

`index.html` 을 파일로 직접 열어도 대부분 동작하지만, `data/trending-items.json` 조회와
PWA 서비스워커는 http(s)에서만 동작합니다. 로컬 서버 사용을 권장합니다.

## 기능

### 1. 마을 수집 · 공간 꾸미기
- 테마 마을 4종: **설강 마을**(눈) · **해바람 언덕**(꽃) · **모찌 항구**(노을) · **별빛 골목**(밤)
- 코인으로 마을을 열고 전환. 마을마다 장식을 따로 보관
- 오너먼트 25종 · 등급 **일반 / 레어 / 한정판**
- 바닥을 눌러 배치, 끌어서 이동, 메뉴에서 이동·회수·선물
- 마을당 최대 24개 배치

### 2. 살아있는 마을 (2D 캔버스)
- **날씨 5종**: 맑음 · 비 · 눈 · 노을 · 밤 · 자동(현지 시각 기준)
  - 빗줄기, 눈송이, 별·달, 창문 불빛, 랜턴 빛 번짐이 날씨에 따라 바뀝니다
- **탈것 5종**: 자전거 · 스쿠터 · 열기구 · 미니 트램 · 별빛 썰매
- **반려동물 4종**: 몽이(강아지) · 나비(고양이) · 모찌(크리터) · 달토끼
- 펫·탈것·오너먼트를 누르면 말풍선 반응

### 3. 게이미피케이션 · 바이럴 · 공구 · 선물
- **친구 추천**: 내 코드 `MOA-XXXXXX`, 링크 복사, 친구 1명당 +60 코인(시뮬레이션 포함)
- **친구 공구**: 5명 모이면 **40% 할인** 언락, 게이지 표시, 초대 URL `?coop=CODE`
- **희귀템 선물**: 선물 카드 이미지 저장 + `?gift=...` 링크, 수령 시 도착 연출 후 내 마을에 추가

### 4. 래피드(Rapid) 희귀 세트
- 래피드 상품 링크 + 시리얼 코드 입력으로 즉시 잠금 해제
- 세트 3종: 설강 리미티드(₩9,900) · 해바람 레어(₩12,900) · 별빛 나이트(₩14,900)
- 체험 코드: **`MOA-TRIAL-2026`** → 한정판 `달빛 문` 해제

> ⚠️ 세트의 `buyUrl` 은 아직 예시 주소입니다. 실제 래피드 상품을 만든 뒤
> `assets/js/catalog.js` 상단 `RAPID.sets[].buyUrl` 을 실제 상품 URL로 바꾸세요.
> 코드도 같은 파일의 `code` 값이며, 실제 판매에서는 코드 발급 규칙(주문번호 해시 등)을
> 백엔드나 수동 발급으로 운영해야 합니다.

### 5. 매시간 유행 아이템 파이프라인
```
data/trending-items.json     ← 앱이 읽는 결과 파일
scripts/update_trends.py     ← Google Trends RSS(KR/US) 조회 → 오너먼트 매칭 → 실패 시 시간 시드 로테이션
.github/workflows/hourly-trends.yml  ← cron '15 * * * *' (매시 15분), 변경 시 자동 커밋
```
- 앱은 로드할 때 JSON을 읽어 상단 `LIVE 지금 유행` 띠와 상점 정렬에 사용합니다
- 파일이 없거나 실패하면 내장 기본 목록으로 자동 대체
- Actions에서 바로 실행하려면 저장소 → Settings → Actions → General → **Workflow permissions: Read and write** 로 설정하세요

---

## 파일 구조

```
moa-village/
├─ index.html
├─ manifest.webmanifest        PWA 매니페스트
├─ sw.js                       앱 셸 캐시
├─ assets/
│  ├─ css/style.css            디자인 시스템 + 반응형
│  └─ js/
│     ├─ i18n.js               4개 국어 문자열
│     ├─ catalog.js            마을·오너먼트·펫·탈것·SVG 스프라이트·래피드 설정
│     ├─ store.js              상태·경제·저장(localStorage)
│     ├─ scene.js              캔버스 렌더러(마을·날씨·펫·탈것·터치)
│     ├─ ui.js                 HUD·시트·상점·친구·선물·래피드
│     └─ app.js                부트스트랩·딥링크
├─ data/trending-items.json
├─ scripts/update_trends.py
├─ .github/workflows/hourly-trends.yml
├─ icons/                      SVG + PNG 192/512
├─ promo/                      홍보 카피(한·영·중·일) + 라이브 캡처
└─ README.md
```

## 딥링크

| 파라미터 | 동작 |
|---|---|
| `?ref=CODE` | 초대 링크. 최초 방문 시 +75 코인 |
| `?coop=CODE` | 친구 공구 참여 안내 → 참여 시 게이지 +1 |
| `?gift=<payload>` | 선물 도착 연출 → 받으면 내 보관함에 추가 |

## 배포

### A. GitHub Pages (권장)
1. 저장소 생성: <https://github.com/new?name=moa-village&visibility=public>
2. 이 폴더를 push
   ```bash
   git init && git add . && git commit -m "feat: MOA Village prototype"
   git branch -M main
   git remote add origin git@github.com:<계정>/moa-village.git
   git push -u origin main
   ```
3. Settings → Pages → Source: **GitHub Actions** (또는 `main` / root)
   - 포함된 `.github/workflows/deploy-pages.yml` 이 자동 배포합니다

위 1~3단계는 스크립트 한 줄로도 됩니다(공개 저장소가 만들어집니다):

```bash
bash scripts/deploy_github.sh        # CM-jccho/moa-village
```
4. 주소: <https://cm-jccho.github.io/moa-village/>

### B. Netlify Drop
`moa-village` 폴더를 <https://app.netlify.com/drop> 에 끌어다 놓으면 끝.
(비밀번호 보호는 Site settings → Access control)

### C. 로컬 확인
`python3 -m http.server 8080`

## 개인정보 · 저장

- 서버 없음, 계정 없음, 결제 없음
- 닉네임·코인·배치·초대 코드는 브라우저 `localStorage` (`moa.village.v1`)에만 저장
- 초기화: 브라우저 콘솔에서 `MOA.Store.reset()` 또는 사이트 데이터 삭제

## 프로토타입의 한계 (정직한 범위)

- 친구 초대·공구 참여·경쟁은 **시뮬레이션**입니다. 실제 친구의 참여는 링크를 연 그 브라우저에서만 반영됩니다(서버 없음).
- 래피드 구매 링크는 예시 URL이고, 시리얼 코드는 파일에 정의된 값입니다.
- 유행 아이템은 공개 RSS + 로테이션 방식이며, 매출·재고와 연동되지 않습니다.
- 결제·배송·계정 기능은 없습니다.

## 검증 결과 (2026-11-19)

- Playwright: 데스크톱 1440×900 / 모바일 390×844 전 기능 통과
- 콘솔 에러 0, 가로 오버플로 0
- 4개 국어 전 시트에서 미번역 키 0
- 배치·이동·회수·선물 수령·공구 40%·시리얼 해제·마을 전환·날씨 5종 확인
