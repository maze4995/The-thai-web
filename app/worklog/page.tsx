'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/components/StoreProvider'

interface WorkLog {
  id?: string
  log_date: string
  hygiene: string
  therapist_notes: string
  customer_items: string[]
  customer_over: string
  customer_handoff: string
  customer_receive: string
  manager_notes: string
  other_notes: string
  memo: string
  tomorrow_plans: string
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDisplayDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = WEEKDAY_KO[new Date(y, m - 1, d).getDay()]
  return `${y}년 ${m}월 ${d}일 ${dow}요일`
}

function defaultLog(date: string): WorkLog {
  return {
    log_date: date,
    hygiene: '',
    therapist_notes: '',
    customer_items: Array(10).fill(''),
    customer_over: '',
    customer_handoff: '',
    customer_receive: '',
    manager_notes: '',
    other_notes: '',
    memo: '',
    tomorrow_plans: '',
  }
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
  minRows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minRows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={minRows}
      className="w-full resize-none rounded-2xl border border-[#e7dccd] bg-[#fffdfa] px-4 py-3 text-[15px] leading-7 text-slate-800 outline-none transition focus:border-[#d6b792] focus:ring-4 focus:ring-[#f4e3cc] print:border-none print:bg-transparent print:px-0 print:py-0"
    />
  )
}

function SectionCard({
  index,
  title,
  subtitle,
  children,
}: {
  index: string
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-[#eadfce] bg-white/95 shadow-[0_16px_50px_rgba(148,121,90,0.10)] print:rounded-none print:border print:shadow-none">
      <div className="border-b border-[#f0e4d5] bg-[linear-gradient(135deg,#fff7ee_0%,#fffdf9_100%)] px-5 py-4 sm:px-7">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#a66d3b] text-sm font-bold text-white">
            {index}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#51331c]">{title}</h3>
            {subtitle && (
              <p className="mt-1 text-sm text-[#9a7b5d]">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      <div className="px-5 py-5 sm:px-7 sm:py-6">{children}</div>
    </section>
  )
}

export default function WorkLogPage() {
  const today = toDateStr(new Date())
  const [dateStr, setDateStr] = useState(today)
  const [log, setLog] = useState<WorkLog>(defaultLog(today))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { storeId, storeName } = useStore()

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!storeId) {
        if (!active) return
        setLog(defaultLog(dateStr))
        setLoading(false)
        return
      }

      setLoading(true)
      const { data } = await supabase
        .from('work_logs')
        .select('*')
        .eq('store_id', storeId)
        .eq('log_date', dateStr)
        .maybeSingle()

      if (!active) return

      if (data) {
        setLog({
          id: data.id,
          log_date: data.log_date,
          hygiene: data.hygiene ?? '',
          therapist_notes: data.therapist_notes ?? '',
          customer_items: Array.isArray(data.customer_items)
            ? data.customer_items
            : Array(10).fill(''),
          customer_over: data.customer_over ?? '',
          customer_handoff: data.customer_handoff ?? '',
          customer_receive: data.customer_receive ?? '',
          manager_notes: data.manager_notes ?? '',
          other_notes: data.other_notes ?? '',
          memo: data.memo ?? '',
          tomorrow_plans: data.tomorrow_plans ?? '',
        })
      } else {
        setLog(defaultLog(dateStr))
      }

      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [dateStr, storeId])

  const changeDate = (delta: number) => {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + delta)
    setDateStr(toDateStr(d))
  }

  const updateField = <K extends keyof WorkLog>(key: K, value: WorkLog[K]) => {
    setLog(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const updateCustomerItem = (idx: number, value: string) => {
    const items = [...log.customer_items]
    items[idx] = value
    updateField('customer_items', items)
  }

  const handleSave = async () => {
    if (!storeId) return

    setSaving(true)
    const payload = {
      store_id: storeId,
      log_date: dateStr,
      hygiene: log.hygiene,
      therapist_notes: log.therapist_notes,
      customer_items: log.customer_items,
      customer_over: log.customer_over,
      customer_handoff: log.customer_handoff,
      customer_receive: log.customer_receive,
      manager_notes: log.manager_notes,
      other_notes: log.other_notes,
      memo: log.memo,
      tomorrow_plans: log.tomorrow_plans,
      updated_at: new Date().toISOString(),
    }

    if (log.id) {
      await supabase.from('work_logs').update(payload).eq('id', log.id)
    } else {
      const { data } = await supabase
        .from('work_logs')
        .insert(payload)
        .select()
        .single()

      if (data) {
        setLog(prev => ({ ...prev, id: data.id }))
      }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const statusText = saved
    ? '저장 완료'
    : saving
      ? '저장 중...'
      : '작성 중'

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6efe6_0%,#f9f6f1_22%,#fbfaf8_100%)] text-slate-900">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          textarea, input[type="text"], input[type="date"] {
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            color: black !important;
          }
        }
      `}</style>

      <header className="no-print sticky top-0 z-20 border-b border-[#eadcc8] bg-[rgba(251,247,241,0.92)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-[#e6d3bb] bg-white px-3 py-1.5 text-sm font-medium text-[#6f4a29] transition hover:border-[#d5b18a] hover:bg-[#fff7ee]"
          >
            홈으로
          </Link>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b99169]">
              Work Log
            </p>
            <h1 className="text-lg font-semibold text-[#4c301a] sm:text-xl">
              근무일지
            </h1>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full border border-[#ead7c0] bg-white px-1 py-1 shadow-sm">
              <button
                onClick={() => changeDate(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#835634] transition hover:bg-[#f9efe2]"
              >
                ‹
              </button>
              <input
                type="date"
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
                className="rounded-full border border-[#efe2d2] bg-[#fffdf9] px-3 py-2 text-sm text-[#5c3b22] outline-none focus:border-[#d5b18a]"
              />
              <button
                onClick={() => changeDate(1)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#835634] transition hover:bg-[#f9efe2]"
              >
                ›
              </button>
            </div>

            {dateStr !== today && (
              <button
                onClick={() => setDateStr(today)}
                className="rounded-full border border-[#ead7c0] bg-white px-3 py-2 text-sm font-medium text-[#7a5230] transition hover:bg-[#fff6eb]"
              >
                오늘
              </button>
            )}

            <button
              onClick={() => window.print()}
              className="rounded-full border border-[#ead7c0] bg-white px-3 py-2 text-sm font-medium text-[#7a5230] transition hover:bg-[#fff6eb]"
            >
              인쇄
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-[#9b6336] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(155,99,54,0.22)] transition hover:bg-[#88532a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="mb-6 overflow-hidden rounded-[30px] border border-[#e7dccd] bg-[linear-gradient(135deg,#fff9f2_0%,#fffefc_100%)] shadow-[0_24px_60px_rgba(126,96,63,0.10)]">
          <div className="grid gap-5 px-5 py-6 sm:grid-cols-[1.3fr_0.7fr] sm:px-8 sm:py-7">
            <div>
              <p className="text-sm font-medium text-[#b28a64]">Daily Record</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#4a2f1b] sm:text-3xl">
                {storeName ? `${storeName} 근무일지` : '근무일지'}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#86684c]">
                운영 메모, 고객 전달사항, 다음 날 계획까지 한 장에서 정리할 수 있도록 밝고 읽기 쉬운 서식으로 다듬었습니다.
              </p>
            </div>

            <div className="grid gap-3 sm:justify-items-end">
              <div className="rounded-2xl border border-[#eadbc8] bg-white px-4 py-3 text-right shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-[#b08a67]">
                  Date
                </p>
                <p className="mt-1 text-lg font-semibold text-[#57361e]">
                  {formatDisplayDate(dateStr)}
                </p>
              </div>
              <div className="rounded-2xl border border-[#eadbc8] bg-white px-4 py-3 text-right shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-[#b08a67]">
                  Status
                </p>
                <p className="mt-1 text-sm font-semibold text-[#57361e]">
                  {statusText}
                </p>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-[28px] border border-[#eee2d3] bg-white/80"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-5">
            <SectionCard
              index="01"
              title="매장 위생 및 청결 상태"
              subtitle="청소 완료 여부, 소모품 보충, 점검 사항을 간단히 남겨주세요."
            >
              <AutoTextarea
                value={log.hygiene}
                onChange={v => updateField('hygiene', v)}
                placeholder="예: 오픈 전 청소 완료, 수건/가운 보충, 샤워실 점검 이상 없음"
                minRows={4}
              />
            </SectionCard>

            <SectionCard
              index="02"
              title="관리사 특이사항"
              subtitle="출근 상태, 컨디션, 일정 조정, 전달이 필요한 이슈를 적어주세요."
            >
              <AutoTextarea
                value={log.therapist_notes}
                onChange={v => updateField('therapist_notes', v)}
                placeholder={'1.\n2.\n3.'}
                minRows={5}
              />
            </SectionCard>

            <SectionCard
              index="03"
              title="고객 특이사항"
              subtitle="고객별 메모와 오버, 인수인계 내용을 한 번에 정리합니다."
            >
              <div className="grid gap-3">
                {log.customer_items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-2xl border border-[#efe3d4] bg-[#fffdfa] px-4 py-3"
                  >
                    <span className="w-7 shrink-0 text-right text-sm font-semibold text-[#b58b63]">
                      {i + 1}.
                    </span>
                    <input
                      type="text"
                      value={item}
                      onChange={e => updateCustomerItem(i, e.target.value)}
                      className="w-full bg-transparent text-[15px] text-slate-800 outline-none placeholder:text-slate-300"
                      placeholder="고객 메모를 입력하세요"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { label: '오버 고객', key: 'customer_over' as const },
                  { label: '타점 인계', key: 'customer_handoff' as const },
                  { label: '타점 인수', key: 'customer_receive' as const },
                ].map(({ label, key }) => (
                  <label
                    key={key}
                    className="rounded-2xl border border-[#efe3d4] bg-[#fffdfa] px-4 py-3"
                  >
                    <span className="mb-2 block text-sm font-semibold text-[#876345]">
                      {label}
                    </span>
                    <input
                      type="text"
                      value={log[key]}
                      onChange={e => updateField(key, e.target.value)}
                      className="w-full bg-transparent text-[15px] text-slate-800 outline-none placeholder:text-slate-300"
                      placeholder={`${label} 내용을 입력하세요`}
                    />
                  </label>
                ))}
              </div>
            </SectionCard>

            <div className="grid gap-5 lg:grid-cols-2">
              <SectionCard
                index="04"
                title="관리자 특이사항"
                subtitle="운영 이슈, 체크 포인트, 다음 근무자를 위한 메모"
              >
                <AutoTextarea
                  value={log.manager_notes}
                  onChange={v => updateField('manager_notes', v)}
                  placeholder={'1.\n2.\n3.'}
                  minRows={6}
                />
              </SectionCard>

              <SectionCard
                index="05"
                title="기타 보고사항"
                subtitle="따로 분리해서 남길 내용이 있으면 적어주세요."
              >
                <AutoTextarea
                  value={log.other_notes}
                  onChange={v => updateField('other_notes', v)}
                  placeholder="기타 보고사항"
                  minRows={6}
                />
              </SectionCard>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <SectionCard
                index="06"
                title="메모"
                subtitle="짧은 운영 메모나 참고사항을 자유롭게 남깁니다."
              >
                <AutoTextarea
                  value={log.memo}
                  onChange={v => updateField('memo', v)}
                  placeholder="공용 메모"
                  minRows={5}
                />
              </SectionCard>

              <SectionCard
                index="07"
                title="내일 계획"
                subtitle="예약, 인력, 준비물, 확인할 사항을 정리해두세요."
              >
                <AutoTextarea
                  value={log.tomorrow_plans}
                  onChange={v => updateField('tomorrow_plans', v)}
                  placeholder={'예: 오전 예약 확인\n세탁물 수량 체크\n신규 고객 응대 메모'}
                  minRows={5}
                />
              </SectionCard>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
