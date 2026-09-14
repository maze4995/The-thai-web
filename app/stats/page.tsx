import { WeeklyStats } from '@/components/WeeklyStats'

// app/page.tsx 와 같은 이유로 서버에서 데이터를 가져오지 않는다.
// 전환 지연의 원인이던 서버 왕복을 없애고 데이터는 클라이언트에서 채운다.
export default function StatsPage() {
  return <WeeklyStats />
}
