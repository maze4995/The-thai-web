import { ScheduleBoard } from '@/components/ScheduleBoard'

// 이 페이지는 의도적으로 서버에서 데이터를 가져오지 않는다.
// 서버 컴포넌트로 두면 전환할 때마다 인증·소속·데이터 조회가 모두 끝나야
// HTML이 나가기 때문에 페이지 이동이 눈에 띄게 지연됐다.
// ScheduleBoard 가 마운트 직후 어차피 같은 데이터를 다시 가져오므로
// 정적으로 내보내고 데이터는 클라이언트에서 채운다.
// 로그인 확인은 proxy.ts, 매장 소속 확인은 StoreProvider 가 담당한다.
export default function HomePage() {
  return <ScheduleBoard />
}
