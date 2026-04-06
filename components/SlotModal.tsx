'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ScheduleSlot, Reservation, PaymentType } from '@/lib/types'
import { PAYMENT_LABELS, addMinutesToTime, getServiceDuration, mapServiceName, getServicePrice, getAutoMemo, formatPhone, isReservationInBusinessDay, parseMixedEntries, buildMixedComboMemo, MixedPaymentEntry } from '@/lib/utils'
import { useStore } from '@/components/StoreProvider'
import { resolveServiceDuration, resolveServicePrice, useStoreServices } from '@/lib/service-config'

interface Props {
  therapistId: string
  therapistName: string
  workDate: string
  editingSlot: ScheduleSlot | null
  onClose: () => void
}

type TabType = 'reservation' | 'manual'

const ROOMS = [1, 2, 3, 4, 5, 6, 7]
const PAYMENT_TYPES: PaymentType[] = ['cash', 'card', 'transfer', 'coupon', 'mixed']
const BASE_PAYMENT_TYPES: PaymentType[] = ['cash', 'card', 'transfer', 'coupon']

const METHOD_TO_LABEL: Record<string, string> = { cash: '현금', card: '카드', transfer: '이체', coupon: '쿠폰' }
const LABEL_TO_METHOD: Record<string, PaymentType> = { '현금': 'cash', '카드': 'card', '이체': 'transfer', '쿠폰': 'coupon' }

function parseMixedMethods(memo: string): PaymentType[] {
  return parseMixedEntries(memo).map(e => LABEL_TO_METHOD[e.label]).filter(Boolean) as PaymentType[]
}

export function SlotModal({ therapistId, therapistName, workDate, editingSlot, onClose }: Props) {
  const [tab, setTab] = useState<TabType>(editingSlot ? 'manual' : 'reservation')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loadingRes, setLoadingRes] = useState(true)

  // Form state
  const [customerName, setCustomerName] = useState(editingSlot?.customer_name ?? '')
  const [customerPhone, setCustomerPhone] = useState(editingSlot?.customer_phone ?? '')
  const [serviceName, setServiceName] = useState(editingSlot?.service_name ?? 'T60')
  const [servicePrice, setServicePrice] = useState(editingSlot?.service_price ?? 50000)
  const [roomNumber, setRoomNumber] = useState(editingSlot?.room_number ?? 1)
  const [reservedTime, setReservedTime] = useState(editingSlot?.reserved_time ? editingSlot.reserved_time.slice(0, 5) : '')
  const [checkIn, setCheckIn] = useState(editingSlot?.check_in_time ? editingSlot.check_in_time.slice(0, 5) : '')
  const [checkOut, setCheckOut] = useState(editingSlot?.check_out_time ? editingSlot.check_out_time.slice(0, 5) : '')
  const [paymentType, setPaymentType] = useState<PaymentType>(editingSlot?.payment_type ?? 'cash')
  const [mixedMethods, setMixedMethods] = useState<PaymentType[]>(
    editingSlot?.payment_type === 'mixed' ? parseMixedMethods(editingSlot.memo ?? '') : []
  )
  const [mixedAmounts, setMixedAmounts] = useState<Record<string, number>>(() => {
    if (editingSlot?.payment_type === 'mixed') {
      const entries = parseMixedEntries(editingSlot.memo ?? '')
      return Object.fromEntries(entries.map(e => [e.label, e.amount]))
    }
    return {}
  })
  const [reservationId, setReservationId] = useState<string | null>(editingSlot?.reservation_id ?? null)
  const [memo, setMemo] = useState((editingSlot?.memo ?? '').replace(/^복합\[[^\]]*\]\s*/, ''))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { storeId } = useStore()
  const { serviceOptions } = useStoreServices(storeId)

  useEffect(() => {
    const fetchReservations = async () => {
      if (!storeId) {
        setReservations([])
        setLoadingRes(false)
        return
      }

      setLoadingRes(true)
      // Fetch both workDate and next day, then filter client-side using isReservationInBusinessDay
      const nextDay = new Date(workDate + 'T00:00:00')
      nextDay.setDate(nextDay.getDate() + 1)
      const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`

      const [sameDayRes, nextDayRes] = await Promise.all([
        supabase.from('reservations').select('*')
          .eq('store_id', storeId)
          .eq('reserved_date', workDate)
          .eq('status', '예약확정')
          .order('reserved_time'),
        supabase.from('reservations').select('*')
          .eq('store_id', storeId)
          .eq('reserved_date', nextDayStr)
          .eq('status', '예약확정')
          .order('reserved_time'),
      ])
      const all = [...(sameDayRes.data ?? []), ...(nextDayRes.data ?? [])]
      setReservations(all.filter(r => isReservationInBusinessDay(r.reserved_date, r.reserved_time, workDate)))
      setLoadingRes(false)
    }
    fetchReservations()
  }, [storeId, workDate])

  // Auto-set price when service changes (respects road pricing)
  const handleServiceChange = (name: string) => {
    setServiceName(name)
    setServicePrice(resolveServicePrice(name, customerName, serviceOptions) || getServicePrice(name, customerName))
    if (checkIn) {
      const duration = resolveServiceDuration(name, serviceOptions) || getServiceDuration(name)
      setCheckOut(addMinutesToTime(checkIn, duration))
    }
  }

  // Re-calculate price and auto-memo when customer name changes
  const handleCustomerNameChange = (name: string) => {
    setCustomerName(name)
    setServicePrice(resolveServicePrice(serviceName, name, serviceOptions) || getServicePrice(serviceName, name))
    const auto = getAutoMemo(name)
    if (auto) setMemo(auto)
  }

  const handleSelectReservation = (res: Reservation) => {
    setReservationId(res.id)
    setCustomerName(res.customer_name)
    setCustomerPhone(res.customer_phone)
    const mapped = mapServiceName(res.service_name)
    setServiceName(mapped)
    setServicePrice(resolveServicePrice(mapped, res.customer_name, serviceOptions) || getServicePrice(mapped, res.customer_name))
    if (res.reserved_time) {
      setReservedTime(res.reserved_time.slice(0, 5))
    }
    // Auto-memo from customer name + reservation memo
    const autoMemo = getAutoMemo(res.customer_name)
    const resMemo = res.memo ?? ''
    setMemo([autoMemo, resMemo].filter(Boolean).join(' '))
    setTab('manual')
  }

  const toggleMixedMethod = (method: PaymentType) => {
    const label = METHOD_TO_LABEL[method]
    setMixedMethods(prev => {
      if (prev.includes(method)) {
        setMixedAmounts(a => { const next = { ...a }; delete next[label]; return next })
        return prev.filter(m => m !== method)
      } else {
        setMixedAmounts(a => ({ ...a, [label]: 0 }))
        return [...prev, method]
      }
    })
  }

  const handleSave = async () => {
    setSaving(true)

    let finalMemo = memo
    if (paymentType === 'mixed') {
      const entries: MixedPaymentEntry[] = mixedMethods.map(m => ({
        label: METHOD_TO_LABEL[m],
        amount: mixedAmounts[METHOD_TO_LABEL[m]] ?? 0,
      }))
      finalMemo = buildMixedComboMemo(entries, memo)
    }

    const payload = {
      store_id: storeId,
      therapist_id: therapistId,
      therapist_name: therapistName,
      work_date: workDate,
      reservation_id: reservationId,
      customer_name: customerName,
      customer_phone: customerPhone || null,
      service_name: serviceName,
      service_price: servicePrice,
      room_number: roomNumber,
      reserved_time: reservedTime || null,
      check_in_time: checkIn || null,
      check_out_time: checkOut || null,
      payment_type: paymentType,
      memo: finalMemo,
    }

    if (editingSlot) {
      await supabase.from('schedule_slots').update(payload).eq('id', editingSlot.id)
    } else {
      // If this reservation already exists in another slot, move/update that slot instead of failing.
      if (storeId && reservationId) {
        const { data: existingReservationSlots } = await supabase
          .from('schedule_slots')
          .select('id, therapist_id, slot_order')
          .eq('store_id', storeId)
          .eq('reservation_id', reservationId)
          .limit(1)

        const existingReservationSlot = existingReservationSlots?.[0] ?? null

        if (existingReservationSlot) {
          const { data: therapistSlots } = await supabase
            .from('schedule_slots')
            .select('slot_order')
            .eq('store_id', storeId)
            .eq('therapist_id', therapistId)
            .eq('work_date', workDate)

          const maxOrder = (therapistSlots ?? []).reduce((max, s) => Math.max(max, s.slot_order ?? 0), 0)

          await supabase
            .from('schedule_slots')
            .update({ ...payload, slot_order: maxOrder + 1 })
            .eq('id', existingReservationSlot.id)

          setSaving(false)
          onClose()
          return
        }
      }

      // Get next slot_order for this therapist on this date
      const { data: existing } = await supabase
        .from('schedule_slots')
        .select('slot_order')
        .eq('therapist_id', therapistId)
        .eq('work_date', workDate)
      const maxOrder = (existing ?? []).reduce((max, s) => Math.max(max, s.slot_order ?? 0), 0)
      await supabase.from('schedule_slots').insert({ ...payload, slot_order: maxOrder + 1 })
    }

    setSaving(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!editingSlot) return
    if (!confirm('이 슬롯을 삭제하시겠습니까?')) return
    setDeleting(true)
    await supabase.from('schedule_slots').delete().eq('id', editingSlot.id)
    setDeleting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a2035] border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              {editingSlot ? '슬롯 수정' : '슬롯 추가'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{therapistName} · {workDate}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl px-2 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs (only for new slot) */}
        {!editingSlot && (
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setTab('reservation')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === 'reservation'
                  ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              예약에서 선택
            </button>
            <button
              onClick={() => setTab('manual')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === 'manual'
                  ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              직접 입력
            </button>
          </div>
        )}

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {/* Reservation list tab */}
          {tab === 'reservation' && !editingSlot && (
            <div>
              {loadingRes ? (
                <div className="text-center text-slate-500 dark:text-slate-400 py-8 text-sm">불러오는 중...</div>
              ) : reservations.length === 0 ? (
                <div className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm">
                  오늘 확정된 예약이 없습니다
                  <button
                    onClick={() => setTab('manual')}
                    className="block mx-auto mt-3 text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 text-sm underline"
                  >
                    직접 입력하기
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {reservations.map(res => (
                    <button
                      key={res.id}
                      onClick={() => handleSelectReservation(res)}
                      className="w-full text-left p-3 bg-slate-50 dark:bg-[#1e2535] hover:bg-slate-100 dark:hover:bg-[#252d40] border border-slate-200 dark:border-slate-700 hover:border-emerald-600/50 rounded-lg transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{res.customer_name}</span>
                        <span className="text-slate-500 dark:text-slate-400 text-xs">{res.reserved_time?.slice(0, 5)}</span>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <span className="text-slate-500 dark:text-slate-400 text-xs">{formatPhone(res.customer_phone)}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">{res.service_name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Manual input tab */}
          {(tab === 'manual' || editingSlot) && (
            <div className="flex flex-col gap-4">
              {/* Customer info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">고객명</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => handleCustomerNameChange(e.target.value)}
                    placeholder="이름"
                    className="w-full bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">전화번호</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Service */}
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">서비스</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {serviceOptions.map(svc => (
                    <button
                      key={svc.code}
                      onClick={() => handleServiceChange(svc.code)}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        serviceName === svc.code
                          ? 'bg-emerald-700 text-emerald-100 border border-emerald-500'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                      }`}
                      title={svc.label}
                    >
                      {svc.code}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">금액 (원)</label>
                <input
                  type="number"
                  value={servicePrice}
                  onChange={e => setServicePrice(Number(e.target.value))}
                  step={5000}
                  className="w-full bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Room + Payment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">방번호</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {ROOMS.map(r => (
                      <button
                        key={r}
                        onClick={() => setRoomNumber(r)}
                        className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${
                          roomNumber === r
                            ? 'bg-slate-600 dark:bg-slate-400 text-white dark:text-slate-900'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">결제방식</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PAYMENT_TYPES.map(pt => (
                      <button
                        key={pt}
                        onClick={() => {
                          setPaymentType(pt)
                          if (pt === 'coupon') setServicePrice(0)
                          if (pt !== 'mixed') setMixedMethods([])
                        }}
                        className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          paymentType === pt
                            ? pt === 'cash' ? 'bg-emerald-800 text-emerald-200 border border-emerald-600'
                              : pt === 'card' ? 'bg-blue-800 text-blue-200 border border-blue-600'
                              : pt === 'transfer' ? 'bg-purple-800 text-purple-200 border border-purple-600'
                              : pt === 'mixed' ? 'bg-violet-700 text-violet-200 border border-violet-500'
                              : 'bg-amber-800 text-amber-200 border border-amber-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                        }`}
                      >
                        {PAYMENT_LABELS[pt]}
                      </button>
                    ))}
                  </div>
                  {paymentType === 'mixed' && (
                    <div className="mt-2 space-y-2">
                      <div>
                        <label className="block text-xs text-orange-400 mb-1">결제수단 선택 (2개 이상)</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {BASE_PAYMENT_TYPES.map(pt => (
                            <button
                              key={pt}
                              onClick={() => toggleMixedMethod(pt)}
                              className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                mixedMethods.includes(pt)
                                  ? pt === 'cash' ? 'bg-emerald-800 text-emerald-200 border border-emerald-600'
                                    : pt === 'card' ? 'bg-blue-800 text-blue-200 border border-blue-600'
                                    : pt === 'transfer' ? 'bg-purple-800 text-purple-200 border border-purple-600'
                                    : 'bg-amber-800 text-amber-200 border border-amber-600'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {PAYMENT_LABELS[pt]}
                            </button>
                          ))}
                        </div>
                      </div>
                      {mixedMethods.length > 0 && (
                        <div className="space-y-1.5">
                          {mixedMethods.map(m => {
                            const label = METHOD_TO_LABEL[m]
                            return (
                              <div key={m} className="flex items-center gap-2">
                                <span className={`text-xs font-semibold w-8 shrink-0 ${
                                  m === 'cash' ? 'text-emerald-400' : m === 'card' ? 'text-blue-400' : m === 'transfer' ? 'text-purple-400' : 'text-amber-400'
                                }`}>{label}</span>
                                <input
                                  type="number"
                                  value={mixedAmounts[label] ?? 0}
                                  onChange={e => setMixedAmounts(a => ({ ...a, [label]: Number(e.target.value) }))}
                                  step={5000}
                                  className="flex-1 bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500"
                                />
                                <span className="text-xs text-slate-400 shrink-0">원</span>
                              </div>
                            )
                          })}
                          {(() => {
                            const total = mixedMethods.reduce((s, m) => s + (mixedAmounts[METHOD_TO_LABEL[m]] ?? 0), 0)
                            const diff = servicePrice - total
                            return (
                              <div className={`text-xs text-right ${diff === 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                                합계 {total.toLocaleString()}원 {diff !== 0 && `(${diff > 0 ? '+' : ''}${diff.toLocaleString()}원 차이)`}
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Time */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-amber-500 dark:text-amber-400 mb-1">예약시간</label>
                  <input
                    type="time"
                    value={reservedTime}
                    onChange={e => setReservedTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">입실시간</label>
                <input
                  type="time"
                  value={checkIn}
                  onChange={e => {
                    const nextCheckIn = e.target.value
                    setCheckIn(nextCheckIn)
                    if (nextCheckIn && serviceName) {
                      const duration = resolveServiceDuration(serviceName, serviceOptions) || getServiceDuration(serviceName)
                      setCheckOut(addMinutesToTime(nextCheckIn, duration))
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">퇴실시간</label>
                  <input
                    type="time"
                    value={checkOut}
                    onChange={e => setCheckOut(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Memo */}
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">비고</label>
                <textarea
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  placeholder="메모 입력"
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {(tab === 'manual' || editingSlot) && (
          <div className="flex gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
            {editingSlot && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-900/40 hover:bg-red-900/70 text-red-400 hover:text-red-300 border border-red-800/40 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors ml-auto"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '저장 중...' : editingSlot ? '수정' : '저장'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
