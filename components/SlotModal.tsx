'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ScheduleSlot, Reservation, PaymentType } from '@/lib/types'
import { SERVICES, PAYMENT_LABELS, addMinutesToTime, getServiceDuration, mapServiceName, getServicePrice, getAutoMemo, formatPhone } from '@/lib/utils'

interface Props {
  therapistId: string
  therapistName: string
  workDate: string
  editingSlot: ScheduleSlot | null
  onClose: () => void
}

type TabType = 'reservation' | 'manual'

const ROOMS = [1, 2, 3, 5, 6, 7]
const PAYMENT_TYPES: PaymentType[] = ['cash', 'card', 'transfer', 'coupon']

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
  const [reservationId, setReservationId] = useState<string | null>(editingSlot?.reservation_id ?? null)
  const [memo, setMemo] = useState(editingSlot?.memo ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const fetchReservations = async () => {
      setLoadingRes(true)
      // Business day: workDate 06:00 ~ next day 05:59
      // Fetch same-date (time >= 06:00) + next-date (time < 06:00)
      const nextDay = new Date(workDate + 'T00:00:00')
      nextDay.setDate(nextDay.getDate() + 1)
      const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`

      const [sameDayRes, nextDayRes] = await Promise.all([
        supabase.from('reservations').select('*')
          .eq('reserved_date', workDate)
          .gte('reserved_time', '06:00')
          .eq('status', '예약확정')
          .order('reserved_time'),
        supabase.from('reservations').select('*')
          .eq('reserved_date', nextDayStr)
          .lt('reserved_time', '06:00')
          .eq('status', '예약확정')
          .order('reserved_time'),
      ])
      setReservations([...(sameDayRes.data ?? []), ...(nextDayRes.data ?? [])])
      setLoadingRes(false)
    }
    fetchReservations()
  }, [workDate])

  // Auto-calculate check-out when check-in or service changes
  useEffect(() => {
    if (checkIn && serviceName) {
      const duration = getServiceDuration(serviceName)
      setCheckOut(addMinutesToTime(checkIn, duration))
    }
  }, [checkIn, serviceName])

  // Auto-set price when service changes (respects road pricing)
  const handleServiceChange = (name: string) => {
    setServiceName(name)
    setServicePrice(getServicePrice(name, customerName))
  }

  // Re-calculate price and auto-memo when customer name changes
  const handleCustomerNameChange = (name: string) => {
    setCustomerName(name)
    setServicePrice(getServicePrice(serviceName, name))
    const auto = getAutoMemo(name)
    if (auto) setMemo(auto)
  }

  const handleSelectReservation = (res: Reservation) => {
    setReservationId(res.id)
    setCustomerName(res.customer_name)
    setCustomerPhone(res.customer_phone)
    const mapped = mapServiceName(res.service_name)
    setServiceName(mapped)
    setServicePrice(getServicePrice(mapped, res.customer_name))
    if (res.reserved_time) {
      setReservedTime(res.reserved_time.slice(0, 5))
    }
    // Auto-memo from customer name + reservation memo
    const autoMemo = getAutoMemo(res.customer_name)
    const resMemo = res.memo ?? ''
    setMemo([autoMemo, resMemo].filter(Boolean).join(' '))
    setTab('manual')
  }

  const handleSave = async () => {
    if (!customerPhone) return
    setSaving(true)

    const payload = {
      therapist_id: therapistId,
      work_date: workDate,
      reservation_id: reservationId,
      customer_name: customerName,
      customer_phone: customerPhone,
      service_name: serviceName,
      service_price: servicePrice,
      room_number: roomNumber,
      reserved_time: reservedTime || null,
      check_in_time: checkIn || null,
      check_out_time: checkOut || null,
      payment_type: paymentType,
      memo,
    }

    if (editingSlot) {
      await supabase.from('schedule_slots').update(payload).eq('id', editingSlot.id)
    } else {
      await supabase.from('schedule_slots').insert(payload)
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
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">전화번호 *</label>
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
                  {SERVICES.map(svc => (
                    <button
                      key={svc.name}
                      onClick={() => handleServiceChange(svc.name)}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        serviceName === svc.name
                          ? 'bg-emerald-700 text-emerald-100 border border-emerald-500'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                      }`}
                    >
                      {svc.name}
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
                  <div className="grid grid-cols-2 gap-1.5">
                    {PAYMENT_TYPES.map(pt => (
                      <button
                        key={pt}
                        onClick={() => {
                          setPaymentType(pt)
                          if (pt === 'coupon') setServicePrice(0)
                        }}
                        className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          paymentType === pt
                            ? pt === 'cash' ? 'bg-emerald-800 text-emerald-200 border border-emerald-600'
                              : pt === 'card' ? 'bg-blue-800 text-blue-200 border border-blue-600'
                              : pt === 'transfer' ? 'bg-purple-800 text-purple-200 border border-purple-600'
                              : 'bg-amber-800 text-amber-200 border border-amber-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                        }`}
                      >
                        {PAYMENT_LABELS[pt]}
                      </button>
                    ))}
                  </div>
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
                    onChange={e => setCheckIn(e.target.value)}
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
              disabled={saving || !customerPhone}
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
