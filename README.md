# 던프 | 던파 경매장 시세 검색 — 아이템 최저가 한눈에

던전앤파이터 Neople Open API를 활용한 경매장 시세 알림 및 아이템 검색 서비스입니다.

## 핵심 기능

### 시세 알림
- 이메일 입력만으로 알림 등록 (로그인 불필요)
- 목표 가격 도달 시 이메일 발송 (Resend)
- **1회 발송 후 자동 종료**
- 이메일당 최대 3개, 중복 등록 방지, 스팸 방지 레이트 리밋

### 경매장
- 경매장 등록 아이템 검색 (API #16)
- 경매장 등록 아이템 조회 (API #17)
- 경매장 시세 검색 (API #18)

### 아바타 마켓
- 아바타 마켓 상품 검색 (API #19)
- 아바타 마켓 상품 조회 (API #20)
- 아바타 마켓 시세 검색 (API #21)
- 아바타 마켓 시세 조회 (API #22)
- 아바타 마켓 해시태그 (API #23)

### 아이템 DB
- 아이템 검색 (API #24)
- 아이템 상세 정보 (API #25)
- 아이템 상점 판매 정보 (API #26)
- 다중 아이템 조회 (API #27)
- 아이템 해시태그 (API #28)
- 세트 아이템 검색 (API #29)

### 인기 아이템
- 조회수 기반 인기 검색 아이템 표시
- 홈 화면에서 바로 알림 등록 가능

## 기술 스택

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Neople Open API**
- **Resend** (이메일 발송)
- **AWS Lambda** (시세 수집 + 알림 체크, 선택사항)

## 실행 방법

### 1. API 키 발급

- [Neople Developers](https://developers.neople.co.kr) — 던파 API 키
- [Resend](https://resend.com) — 이메일 API 키 (이메일 알림 사용 시)

### 2. 프로젝트 설정

```bash
npm install

cp .env.local .env.local
```

`.env.local` 파일에 키를 입력하세요:

```
NEOPLE_API_KEY=발급받은_키
RESEND_API_KEY=발급받은_키
FROM_EMAIL=alerts@yourdomain.com
```

### 3. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 확인하세요.

## 프로젝트 구조

```
dnf-auction/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auction/              # 16. 경매장 등록 아이템 검색
│   │   │   ├── auction-detail/       # 17. 경매장 등록 아이템 조회
│   │   │   ├── auction-sold/         # 18. 경매장 시세 검색
│   │   │   ├── avatar-market/        # 19. 아바타 마켓 상품 검색
│   │   │   ├── avatar-market-detail/ # 20. 아바타 마켓 상품 조회
│   │   │   ├── avatar-market-sold/   # 21. 아바타 마켓 시세 검색
│   │   │   ├── avatar-market-sold-detail/ # 22. 시세 조회
│   │   │   ├── avatar-market-hashtag/# 23. 해시태그
│   │   │   ├── items/                # 24. 아이템 검색
│   │   │   ├── item-detail/          # 25. 아이템 상세
│   │   │   ├── item-shop/            # 26. 상점 판매 정보
│   │   │   ├── multi-items/          # 27. 다중 아이템 조회
│   │   │   ├── item-hashtag/         # 28. 아이템 해시태그
│   │   │   ├── setitems/             # 29. 세트 아이템 검색
│   │   │   ├── alert-register/       # 알림 등록 API
│   │   │   ├── alert/                # 알림 조회/삭제 API
│   │   │   └── popular-items/        # 인기 아이템 API
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                  # 메인 UI
│   └── lib/
│       ├── types.ts                  # 전체 API 타입 정의
│       ├── utils.ts                  # 유틸리티 함수
│       ├── neople.ts                 # Neople API 호출 모듈
│       ├── alert-store.ts            # 알림 저장소 (JSON file)
│       └── rate-limit.ts             # 스팸 방지 레이트 리미터
├── lambda/
│   ├── price-collector/
│   │   └── index.mjs                # 시세 수집 Lambda
│   └── alert-checker/
│       └── index.mjs                # 알림 체크 + Resend 발송 Lambda
├── data/                             # 런타임 데이터 (자동 생성)
├── .env.local.example
├── next.config.js
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## API 프록시 구조

브라우저에서 직접 Neople API를 호출하면 API 키가 노출되므로 Next.js API Route를 프록시로 사용합니다:

```
브라우저 → /api/auction → api.neople.co.kr/df/auction?apikey=***
```

## AWS Lambda 배포 (선택사항)

시세 알림 자동 체크를 위한 Lambda 배포입니다. 웹 UI만 사용할 경우 배포하지 않아도 됩니다.

### 필요 AWS 서비스

- **EventBridge Scheduler** — 5분 주기 트리거
- **Lambda** — price-collector, alert-checker
- **DynamoDB** — price_history, alert_rules 테이블

### DynamoDB 테이블

**price_history**
| 키 | 설명 |
|----|------|
| PK (Partition Key) | `ITEM#아이템명` |
| SK (Sort Key) | `TS#2026-03-26T14:30:00` |
| avgPrice, minPrice, maxPrice | Number |
| volume | Number (등록 건수) |
| TTL | Number (90일 후 자동 삭제) |

**alert_rules**
| 키 | 설명 |
|----|------|
| PK | `USER#이메일` |
| SK | `RULE#아이템명#조건#목표가` |
| itemName (GSI) | String |
| condition | `below` / `above` |
| targetPrice | Number |
| email | String |
| fulfilled | Boolean |

### Lambda 배포

```bash
cd lambda/price-collector
zip -r price-collector.zip index.mjs
aws lambda update-function-code \
  --function-name price-collector \
  --zip-file fileb://price-collector.zip

cd ../alert-checker
zip -r alert-checker.zip index.mjs
aws lambda update-function-code \
  --function-name alert-checker \
  --zip-file fileb://alert-checker.zip
```

### EventBridge 스케줄 설정

```bash
aws scheduler create-schedule \
  --name dnf-price-collector \
  --schedule-expression "rate(5 minutes)" \
  --target '{"Arn":"arn:aws:lambda:REGION:ACCOUNT:function:price-collector","RoleArn":"arn:aws:iam::ACCOUNT:role/scheduler-role"}' \
  --flexible-time-window '{"Mode":"OFF"}'
```

## 스팸 방지

- 이메일당 시간 5회 요청 제한
- IP당 시간 5회 요청 제한
- 이메일당 최대 3개 알림 등록
- 동일 조건 중복 등록 방지
- 1회 발송 후 자동 종료 (무한 알림 방지)

## 비용

- **Next.js 웹앱**: Vercel 무료 플랜으로 운영 가능
- **Resend**: 월 3,000건 무료
- **AWS Lambda**: 프리티어 월 100만 건 (5분 간격 ≈ 월 8,640건)
- **DynamoDB**: 프리티어 25GB 저장 + 25 WCU/RCU

## 참고

- 경매장 시세는 최근 100건 또는 최대 1개월 전까지의 거래 내역만 제공됩니다.
- Neople API 호출 제한을 확인하고 적절한 주기를 설정하세요.
- 이 프로젝트는 Neople/Nexon과 관련이 없는 비공식 프로젝트입니다.
