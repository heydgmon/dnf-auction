# 던프 (dnfprice) — 던전앤파이터 경매장 시세 검색

던전앤파이터 Neople Open API를 활용한 경매장 시세 알림, 아이템 검색, 시장 분석 서비스입니다.

> **https://dnfprice.link**

---

## 핵심 기능

### 경매장 인기 아이템 (메인)
- 현재 경매장에 등록된 매물이 많은 아이템 TOP 20
- 실시간 Neople API 데이터 기반 랭킹
- 서버 워밍업 + stale-while-revalidate 캐싱으로 즉시 로딩

### 종결템 시세
- 칭호, 크리쳐, 오라, 마법부여(카드) 카테고리별 Top 3
- 종결템 목록 + 실거래 데이터 기반 평균 체결가
- 경매장 현재 최저가와 비교
- 이상치(outlier) 제거 후 평균 산출

### 경매장 인사이트
- 주요 아이템 거래 규모, 시세 추이, 가격 변동률
- DynamoDB 일별 스냅샷 기반 7일간 시세 히스토리
- 거래 규모순 / 변동률순 정렬
- 아이템별 미니 차트 + 상세 차트

### 시세 검색
- 최근 거래 완료된 아이템의 실제 거래 가격 조회
- 카드 뷰 (SVG 스파크라인 + 통계) / 리스트 뷰 전환
- 개별 아이템 클릭 시 Chart.js 기반 상세 차트 (평균가 + 거래량)
- 인사이트 데이터 연동 대시보드

### 경매장 아이템 검색
- 현재 경매장 등록 아이템 검색 (최대 800건 수집)
- 개당 가격 낮은 순 정렬
- 강화/증폭/제련/업그레이드 상세 정보
- 패키지 구매 가이드 (경매장 vs 세라샵 가격 비교)

### 시세 알림
- 이메일 입력만으로 알림 등록 (로그인 불필요)
- 목표 가격 도달 시 이메일 발송 (Resend)
- 1회 발송 후 자동 종료
- 이메일당 최대 3개, 중복 등록 방지, 스팸 방지 레이트 리밋
- API Gateway + Lambda + DynamoDB 기반

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router, standalone output) |
| 언어 | TypeScript |
| 스타일링 | Tailwind CSS + CSS Variables (디자인 토큰) |
| 차트 | Chart.js 4 (CDN, 검색 상세) + SVG 스파크라인 (대시보드) |
| 외부 API | Neople Open API (던파 경매장/아이템) |
| 이메일 | Resend API |
| DB | AWS DynamoDB (알림 규칙, 일별 시세 히스토리) |
| 알림 체크 | AWS Lambda + EventBridge Scheduler |
| 배포 | Docker → AWS ECR → ECS (Fargate) |
| CDN | AWS CloudFront |
| CI/CD | GitHub Actions (OIDC 인증) |
| 폰트 | Pretendard Variable (CDN) |

---

## 프로젝트 구조

```
dnf-auction/
├── src/
│   ├── app/
│   │   ├── page.tsx                     # 메인 (인기 아이템 TOP 20)
│   │   ├── HomeClient.tsx               # 메인 클라이언트 (인메모리 캐시)
│   │   ├── layout.tsx                   # 공통 레이아웃 + 메타데이터
│   │   ├── globals.css                  # 디자인 토큰 + 전역 스타일
│   │   │
│   │   ├── bis/                         # 종결템 시세
│   │   │   ├── page.tsx
│   │   │   └── BisClient.tsx
│   │   ├── insight/                     # 경매장 인사이트
│   │   │   ├── page.tsx
│   │   │   └── InsightClient.tsx
│   │   ├── auction/                     # 경매장 아이템 검색
│   │   │   ├── page.tsx
│   │   │   └── AuctionClient.tsx
│   │   ├── sold/                        # 시세 검색
│   │   │   ├── page.tsx
│   │   │   └── SoldClient.tsx
│   │   ├── alerts/                      # 시세 알림
│   │   │   ├── page.tsx
│   │   │   └── AlertClient.tsx
│   │   ├── setitems/                    # 세트 아이템
│   │   │   ├── page.tsx
│   │   │   └── SetItemsClient.tsx
│   │   ├── guide/page.tsx               # 던린이 가이드
│   │   ├── about/page.tsx               # 소개
│   │   ├── privacy/page.tsx             # 개인정보 처리방침
│   │   ├── terms/page.tsx               # 이용약관
│   │   ├── contact/page.tsx             # 문의
│   │   │
│   │   └── api/
│   │       ├── trending/route.ts        # 인기 아이템 (공유 캐시)
│   │       ├── bis/route.ts             # 종결템 시세 (SWR 캐시)
│   │       ├── market-insight/route.ts  # 인사이트 (SWR 캐시)
│   │       ├── auction/route.ts         # 경매장 검색 (페이지네이션)
│   │       ├── auction-detail/route.ts  # 경매장 상세
│   │       ├── auction-sold/route.ts    # 시세 검색
│   │       ├── auction-sold-history/    # 시세 히스토리 (DB + API)
│   │       ├── alert-register/route.ts  # 알림 등록 (레이트 리밋)
│   │       ├── alert/route.ts           # 알림 조회/삭제
│   │       ├── item-detail/route.ts     # 아이템 상세
│   │       ├── item-shop/route.ts       # 상점 판매 정보
│   │       ├── item-hashtag/route.ts    # 아이템 해시태그
│   │       ├── multi-items/route.ts     # 다중 아이템 조회
│   │       ├── setitems/route.ts        # 세트 아이템 검색
│   │       ├── setitems-all/route.ts    # 연도별 세트 (캐싱)
│   │       ├── popular-items/route.ts   # 인기 아이템 (auction-sold)
│   │       └── price-snapshot/route.ts  # 시세 스냅샷 트리거
│   │
│   ├── components/
│   │   ├── Nav.tsx                      # 네비게이션 + 푸터
│   │   └── shared.tsx                   # 공통 컴포넌트 (검색, 카드, 자동완성 등)
│   │
│   └── lib/
│       ├── neople.ts                    # Neople API 호출 모듈
│       ├── auction-shared-cache.ts      # 경매장 공유 캐시 (SWR 패턴)
│       ├── price-history.ts             # DynamoDB 시세 히스토리
│       ├── snapshot-collector.ts        # 일별 시세 스냅샷 수집
│       ├── alert-store.ts              # 알림 저장소 (DynamoDB)
│       ├── rate-limit.ts               # 인메모리 레이트 리미터
│       ├── types.ts                     # 전체 타입 정의
│       └── utils.ts                     # 유틸리티 (포맷, 색상 등)
│
├── lambda/
│   ├── price-collector/index.mjs        # 시세 수집 Lambda
│   ├── price-checker/index.mjs          # 알림 체크 + 이메일 발송 Lambda
│   └── alert-checker/index.mjs          # 알림 체크 Lambda (대체)
│
├── public/
│   ├── sitemap.xml                      # SEO 사이트맵
│   └── ads.txt                          # AdSense 인증
│
├── Dockerfile                           # 멀티스테이지 빌드
├── .github/workflows/deploy.yml         # CI/CD (ECR → ECS)
├── next.config.js                       # standalone output
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 성능 최적화

### 서버 캐싱 (Stale-While-Revalidate)

모든 주요 API에 3단계 캐시 전략을 적용합니다:

| 상태 | 동작 | 사용자 체감 |
|------|------|------------|
| FRESH (TTL 이내) | 캐시 즉시 반환 | 즉시 로딩 |
| STALE (TTL ~ 30분) | 캐시 즉시 반환 + 백그라운드 갱신 | 즉시 로딩 |
| EXPIRED (30분+) | 새로 빌드 후 반환 | 초기 로딩만 대기 |

서버 시작 시 워밍업으로 EXPIRED 상태를 최소화합니다.

### 클라이언트 캐싱

각 페이지 컴포넌트에 모듈 스코프 인메모리 캐시를 두어 탭 전환 시 API 호출 없이 즉시 렌더링합니다.

### 차트 성능

대시보드 개요에서는 SVG 스파크라인(경량, 즉시 렌더링)을 사용하고, 상세 검색에서만 Chart.js를 CDN으로 지연 로드합니다.

---

## API 프록시 구조

브라우저에서 직접 Neople API를 호출하면 API 키가 노출되므로 Next.js API Route를 프록시로 사용합니다:

```
브라우저 → /api/auction → api.neople.co.kr/df/auction?apikey=***
```

---

## 환경변수

```env
# 필수
NEOPLE_API_KEY=                    # Neople Open API 키

# 알림 기능 (선택)
ALERT_API_URL=                     # API Gateway 엔드포인트
AWS_REGION=ap-northeast-2

# 시세 히스토리 (선택)
PRICE_HISTORY_TABLE=dnf-price-history

# 이메일 (Lambda에서 사용)
RESEND_API_KEY=
FROM_EMAIL=
```

---

## 실행 방법

## 배포

GitHub Actions가 `master` 브랜치 push 시 자동 배포합니다:

1. Docker 이미지 빌드
2. AWS ECR에 push
3. ECS 서비스 강제 재배포
4. CloudFront 캐시 무효화

---

## AWS 인프라 (선택사항)

### DynamoDB 테이블

**dnf-auction-alerts** (알림 규칙)
- PK: `alertId` (String)
- 속성: email, itemName, targetPrice, priceCondition, isActive, createdAt

**dnf-price-history** (일별 시세)
- PK: `itemName` (String), SK: `date` (String, "2026-04-07")
- 속성: avgPrice, minPrice, maxPrice, totalVolume, totalValue, itemId, itemRarity
- TTL: 90일 자동 삭제

### Lambda

- **price-collector**: EventBridge 5분 주기, 감시 아이템 시세 수집 → DynamoDB
- **price-checker (alert-checker)**: 알림 조건 매칭 → Resend 이메일 발송

---

## 스팸 방지

- 이메일당 시간 5회 요청 제한
- IP당 시간 5회 요청 제한
- 이메일당 최대 3개 알림 등록
- 동일 조건 중복 등록 방지
- 1회 발송 후 자동 종료

---

## 참고

- 경매장 시세는 최근 100건 또는 최대 1개월 전까지의 거래 내역만 제공됩니다.
- 등록 매물이 많은 아이템은 API 한계로 일부만 표시될 수 있습니다.
- 이 프로젝트는 Neople/Nexon과 관련이 없는 비공식 프로젝트입니다.
- 데이터 출처: [Neople Open API](https://developers.neople.co.kr)
