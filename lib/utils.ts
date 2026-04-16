export function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatPrice(price: number): string {
  if (price === 0) return '0'
  if (price % 10000 === 0) return `${price / 10000}만`
  return `${(price / 10000).toFixed(1)}만`
}

export function formatTime(time: string | null): string {
  if (!time) return '--:--'
  return time.slice(0, 5)
}

export function getPhoneLastFour(phone: string | null | undefined): string {
  if (!phone) return '번호X'
  const digits = phone.replace(/\D/g, '')
  if (!digits) return '번호X'
  return digits.slice(-4)
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return phone
}

export function addMinutesToTime(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

export const PAYMENT_LABELS: Record<string, string> = {
  cash: '현금',
  card: '카드',
  transfer: '이체',
  coupon: '쿠폰',
  mixed: '복합',
}

export const PAYMENT_COLORS: Record<string, string> = {
  cash: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
  card: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
  transfer: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700',
  coupon: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
  mixed: 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700',
}

export interface MixedPaymentEntry {
  label: string
  amount: number
}

export function parseMixedEntries(memo: string): MixedPaymentEntry[] {
  const matched = memo.match(/^복합\[([^\]]+)\]/)
  if (!matched) return []

  return matched[1].split('+').map((part) => {
    const colonIdx = part.lastIndexOf(':')
    if (colonIdx === -1) return { label: part, amount: 0 }
    return {
      label: part.slice(0, colonIdx),
      amount: parseInt(part.slice(colonIdx + 1), 10) || 0,
    }
  })
}

export function parseMixedCombo(memo: string): string {
  return parseMixedEntries(memo).map((entry) => entry.label).join('+')
}

export function buildMixedComboMemo(entries: MixedPaymentEntry[], existingMemo: string): string {
  const cleaned = existingMemo.replace(/^복합\[[^\]]*\]\s*/, '').trim()
  const combo = entries.map((entry) => `${entry.label}:${entry.amount}`).join('+')
  return combo ? `복합[${combo}] ${cleaned}`.trim() : cleaned
}

export interface ServiceOption {
  name: string
  label: string
  price: number
  duration: number
  commission: number
}

export const SERVICES: ServiceOption[] = [
  { name: 'T60', label: '타이 60분', price: 40000, duration: 60, commission: 5000 },
  { name: 'T90', label: '타이 90분', price: 60000, duration: 90, commission: 7000 },
  { name: 'A60', label: '아로마 60분', price: 50000, duration: 60, commission: 6000 },
  { name: 'A90', label: '아로마 90분', price: 70000, duration: 90, commission: 8000 },
  { name: 'C60', label: '크림 60분', price: 60000, duration: 60, commission: 6000 },
  { name: 'C90', label: '크림 90분', price: 80000, duration: 90, commission: 8000 },
  { name: 'S60', label: '스웨디시 60분', price: 70000, duration: 60, commission: 7000 },
  { name: 'S90', label: '스웨디시 90분', price: 90000, duration: 90, commission: 9000 },
]

const SERVICE_NAME_MAP: Record<string, string> = {
  '타이 60분': 'T60',
  '타이 90분': 'T90',
  '아로마 60분': 'A60',
  '아로마 90분': 'A90',
  '크림 60분': 'C60',
  '크림 90분': 'C90',
  '스웨디시 60분': 'S60',
  '스웨디시 90분': 'S90',
}

export function mapServiceName(name: string): string {
  return SERVICE_NAME_MAP[name] ?? name
}

const ROAD_PRICES: Record<string, number> = {
  T60: 60000,
  T90: 80000,
  A60: 70000,
  A90: 90000,
  C60: 80000,
  C90: 100000,
  S60: 80000,
  S90: 100000,
}

export function getServicePrice(serviceName: string, customerName: string): number {
  if (customerName.includes('로드')) {
    const roadPrice = ROAD_PRICES[serviceName]
    if (roadPrice) return roadPrice
  }
  return SERVICES.find((service) => service.name === serviceName)?.price ?? 0
}

export function getServiceCommission(serviceName: string): number {
  return SERVICES.find((service) => service.name === serviceName)?.commission ?? 0
}

const SERVICE_ROOM_PRIORITY: Record<string, number[]> = {
  T60: [7, 3, 6],
  T90: [7, 3, 6],
  S60: [5, 2, 1],
  S90: [5, 2, 1],
}

export function getAvailableRoom(serviceName: string, usedRooms: number[]): number {
  const priority = SERVICE_ROOM_PRIORITY[serviceName]
  if (priority) {
    const available = priority.find((room) => !usedRooms.includes(room))
    if (available) return available
  }

  const allRooms = [1, 2, 3, 5, 6, 7]
  return allRooms.find((room) => !usedRooms.includes(room)) ?? 1
}

export function getServiceDuration(serviceName: string): number {
  const service = SERVICES.find((item) => item.name === serviceName)
  if (service) return service.duration
  const matched = serviceName.match(/(\d+)/)
  return matched ? parseInt(matched[1], 10) : 60
}

export function getBusinessDate(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const hour = kst.getUTCHours()
  if (hour < 6) {
    kst.setUTCDate(kst.getUTCDate() - 1)
  }
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isReservationInBusinessDay(
  reservedDate: string,
  reservedTime: string | null,
  businessDate: string
): boolean {
  if (!reservedTime) {
    return reservedDate === businessDate
  }

  const timeStr = reservedTime.slice(0, 5)
  const [h, m] = timeStr.split(':').map(Number)
  const dt = new Date(`${reservedDate}T00:00:00`)
  dt.setHours(h, m, 0, 0)
  return getBusinessDate(dt) === businessDate
}

function isTrulyNew(customerName: string): boolean {
  if (!customerName.includes('New')) return false
  if (!/\(\d+\)/.test(customerName)) return true
  return /\(0\)\s*\(0\)/.test(customerName)
}

export function getAutoMemo(customerName: string): string {
  const parts: string[] = []
  const hasNewGrade = customerName.toLowerCase().includes('new')

  if (hasNewGrade && customerName.includes('로드')) parts.push('신규로드')
  else if (hasNewGrade && customerName.includes('마통')) parts.push('마통신규')
  else if (hasNewGrade && (customerName.includes('하이') || customerName.includes('하이타이'))) parts.push('하이신규')
  else if (hasNewGrade && customerName.includes('마맵')) parts.push('마맵신규')
  else if (hasNewGrade) parts.push('신규')
  else if (customerName.includes('로드')) parts.push('기존로드')

  if (customerName.includes('CM')) parts.push('CM')
  return parts.join(' ')
}

export function getCustomerType(customerName: string): '신규로드' | '기존로드' | '신규' | null {
  const isRoad = customerName.includes('로드')
  const hasNewGrade = customerName.includes('New')   // New 등급 여부 (방문횟수 무관)
  const isNew = isTrulyNew(customerName)             // 순수 신규 (방문횟수 0)
  if (isRoad && hasNewGrade) return '신규로드'        // New 등급 + 로드 → 무조건 신규로드
  if (isRoad && !hasNewGrade) return '기존로드'
  if (isNew && !isRoad) return '신규'
  return null
}

/**
 * 슬롯의 고객 유형을 결정합니다.
 * - 전화번호 없음 → 신규로드
 * - 이름 기반 파싱 (New + 로드 여부)
 * - 비고란에 '신규' 포함 (단 '신규로드' 제외) → 신규
 */
export function resolveCustomerType(
  customerName: string,
  customerPhone: string | null,
  memo: string,
): '신규로드' | '기존로드' | '신규' | null {
  if (!customerPhone) return '신규로드'
  const nameType = getCustomerType(customerName)
  if (nameType) return nameType
  if (memo.includes('신규') && !memo.includes('신규로드')) return '신규'
  return null
}
