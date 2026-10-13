This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 조판지 성능 개선과 로컬 검증

화면과 업무 흐름은 유지하고, 조판지 조회와 표시 계산을 분리했습니다.

- `lib/use-schedule.ts`: 날짜별 병렬 조회, 지난 날짜의 요청 취소, 실시간 변경/재접속/탭 복귀 시 갱신.
- `lib/schedule-cache.ts`: 매장별 메모리 캐시(최근 7일, 15초 유효), 중복 요청 병합, 늦은 응답 차단. 브라우저 저장소에는 고객 데이터를 보관하지 않습니다.
- `lib/schedule-view.ts`: 관리사별 슬롯을 한 번에 묶고 기존 출근/표시 순서와 과거 관리사 이름을 유지합니다.
- `lib/schedule-clock.ts`: 카드와 관리사 열이 30초 타이머 하나를 공유하고 상태가 바뀔 때만 다시 그립니다.
- 같은 계정의 반복 로그인 이벤트로 조판지가 사라지거나 날짜가 초기화되지 않도록 했습니다.

검증 명령:

```bash
npm run test
npm run typecheck
npm run test:browser
npm run build
```

브라우저 테스트는 Windows의 Edge를 사용하며, 3317 포트의 로컬 개발 서버와 가짜 Supabase HTTP/WebSocket 응답으로 실행합니다. 실제 매장 데이터나 운영 DB를 수정하지 않습니다. 날짜 재방문, 빠른 날짜 전환, 오류 복구, 실시간 이벤트 묶음, 인증 재알림, 예약 저장/취소를 검증합니다.

700ms 응답 지연을 넣은 로컬 테스트에서 최근 날짜 재방문은 23ms, 추가 슬롯 조회는 0건이었습니다. 이 수치는 개발 환경의 모의 측정이며 운영 환경의 최초 로딩 시간을 의미하지 않습니다.

`supabase/migration_schedule_performance.sql`에는 매장/날짜 조회용 인덱스를 준비했습니다. **로컬 파일만 추가했으며 DB에 적용하지 않았습니다.** 배포 시 기존 인덱스를 확인하고, 각 `CREATE INDEX CONCURRENTLY` 문을 트랜잭션 밖에서 개별 실행해야 합니다. 테이블 구조와 RLS는 바꾸지 않습니다.

전체 `npm run lint`에는 변경 전부터 존재한 `app/therapists/page.tsx`와 `components/ThemeProvider.tsx`의 `react-hooks/set-state-in-effect` 오류 2건이 있습니다. 이번 변경 파일의 린트와 타입 검사는 통과했습니다.

업무일지는 입력 후 3초 대기를 제거하고 첫 변경부터 즉시 저장을 시작합니다. 저장 중 추가 입력은 문서별 최신 내용으로 합쳐 순서대로 저장하며, 화면에 저장 중/완료/실패를 표시합니다. 수동 저장도 같은 경로를 사용합니다. 관련 회귀 테스트는 `tests/latest-save-queue.test.ts`와 `tests/browser/worklog.spec.ts`입니다.
