'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/components/StoreProvider'
import { getBusinessDate } from '@/lib/utils'

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
  program_feedback: string
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
    program_feedback: '',
  }
}

function SectionTitle({
  index,
  title,
}: {
  index: string
  title: string
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
        {index}
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
    </div>
  )
}

function TextareaField({
  value,
  onChange,
  placeholder,
  minRows = 4,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minRows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={minRows}
      className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] leading-7 text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:bg-slate-800"
    />
  )
}

export default function WorkLogPage() {
  const today = getBusinessDate(new Date())
  const [dateStr, setDateStr] = useState(today)
  const [log, setLog] = useState<WorkLog>(defaultLog(today))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [autoSaved, setAutoSaved] = useState(false)
  const { storeId, storeName } = useStore()
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstLoad = useRef(true)
  const customerItemsRef = useRef<HTMLDivElement>(null)

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
          program_feedback: data.program_feedback ?? '',
        })
      } else {
        setLog(defaultLog(dateStr))
      }

      isFirstLoad.current = true
      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [dateStr, storeId])

  // Recalculate textarea heights after log loads (content may be multi-line)
  useEffect(() => {
    if (loading) return
    const el = customerItemsRef.current
    if (!el) return
    el.querySelectorAll('textarea').forEach(ta => {
      ta.style.height = 'auto'
      ta.style.height = ta.scrollHeight + 'px'
    })
  }, [loading, log.customer_items])

  // Auto-save: 300ms debounce (Notion-style — feels instant)
  useEffect(() => {
    if (loading) return
    if (isFirstLoad.current) {
      isFirstLoad.current = false
      return
    }
    if (!storeId) return

    setAutoSaved(false)
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
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
        program_feedback: log.program_feedback,
        updated_at: new Date().toISOString(),
      }
      const { data } = await supabase
        .from('work_logs')
        .upsert(payload, { onConflict: 'store_id,log_date' })
        .select('id')
        .single()
      if (data) {
        setLog(prev => ({ ...prev, id: data.id }))
        setAutoSaved(true)
        setTimeout(() => setAutoSaved(false), 1500)
      }
    }, 300)

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log])

  const changeDate = (delta: number) => {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + delta)
    setDateStr(toDateStr(d))
  }

  const updateField = <K extends keyof WorkLog>(key: K, value: WorkLog[K]) => {
    setLog(prev => ({ ...prev, [key]: value }))
  }

  const updateCustomerItem = (index: number, value: string) => {
    const next = [...log.customer_items]
    next[index] = value
    updateField('customer_items', next)
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

    const { data } = await supabase
      .from('work_logs')
      .upsert(payload, { onConflict: 'store_id,log_date' })
      .select('id')
      .single()

    if (data) setLog(prev => ({ ...prev, id: data.id }))

    setSaving(false)
  }

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-[#0f1117] text-slate-900 dark:text-slate-100">
      <header className="shrink-0 border-b border-slate-200 dark:border-slate-700/60 bg-white dark:bg-[#161b27]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 sm:text-xl">
            근무일지
          </h1>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-1 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/60">
              <button
                onClick={() => changeDate(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ‹
              </button>
              <input
                type="date"
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                onClick={() => changeDate(1)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ›
              </button>
            </div>

            {dateStr !== today && (
              <button
                onClick={() => setDateStr(today)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                오늘
              </button>
            )}

            {autoSaved && (
              <span className="text-xs text-emerald-500 font-medium">자동저장됨</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto mx-auto max-w-6xl w-full px-4 py-6 sm:px-6 sm:py-8">
        {loading ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700/50 dark:bg-[#161b27] dark:text-slate-400">
            불러오는 중...
          </div>
        ) : (
          <div className="rounded-[32px] border border-slate-200 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#161b27]">
            <div className="border-b border-slate-200 px-6 py-6 sm:px-8 dark:border-slate-700/50">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {formatDisplayDate(dateStr)}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                    {storeName ? `${storeName} 근무일지` : '근무일지'}
                  </h2>
                </div>
              </div>
            </div>

            <div className="space-y-8 px-6 py-6 sm:px-8 sm:py-8">
              <section>
                <SectionTitle index="01" title="매장 위생 및 청결 상태" />
                <TextareaField
                  value={log.hygiene}
                  onChange={value => updateField('hygiene', value)}
                  placeholder="청소, 정리, 소모품 상태 등을 기록하세요."
                  minRows={4}
                />
              </section>

              <section>
                <SectionTitle index="02" title="관리사 특이사항" />
                <TextareaField
                  value={log.therapist_notes}
                  onChange={value => updateField('therapist_notes', value)}
                  placeholder="관리사 관련 내용을 기록하세요."
                  minRows={5}
                />
              </section>

              <section>
                <SectionTitle index="03" title="고객 특이사항" />
                <div ref={customerItemsRef} className="grid gap-3">
                  {log.customer_items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70"
                    >
                      <span className="w-7 shrink-0 text-right text-sm font-semibold text-slate-400 dark:text-slate-500 pt-0.5">
                        {index + 1}.
                      </span>
                      <textarea
                        value={item}
                        onChange={e => {
                          updateCustomerItem(index, e.target.value)
                          e.target.style.height = 'auto'
                          e.target.style.height = e.target.scrollHeight + 'px'
                        }}
                        onInput={e => {
                          const el = e.currentTarget
                          el.style.height = 'auto'
                          el.style.height = el.scrollHeight + 'px'
                        }}
                        rows={1}
                        className="w-full bg-transparent text-[15px] text-slate-800 outline-none placeholder:text-slate-300 dark:text-slate-100 dark:placeholder:text-slate-500 resize-none overflow-hidden leading-7"
                        placeholder="고객 메모를 입력하세요"
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => updateField('customer_items', [...log.customer_items, ''])}
                  className="mt-3 flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 px-4 py-2 text-sm text-slate-400 dark:text-slate-500 hover:border-emerald-500 hover:text-emerald-500 transition-colors"
                >
                  + 항목 추가
                </button>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {[
                    { key: 'customer_over' as const, label: '오버 고객' },
                    { key: 'customer_handoff' as const, label: '타점 인계' },
                    { key: 'customer_receive' as const, label: '타점 인수' },
                  ].map(item => (
                    <label
                      key={item.key}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70"
                    >
                      <span className="mb-2 block text-sm font-semibold text-slate-600 dark:text-slate-300">
                        {item.label}
                      </span>
                      <input
                        type="text"
                        value={log[item.key]}
                        onChange={e => updateField(item.key, e.target.value)}
                        className="w-full bg-transparent text-[15px] text-slate-800 outline-none placeholder:text-slate-300 dark:text-slate-100 dark:placeholder:text-slate-500"
                        placeholder={`${item.label} 입력`}
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section>
                <SectionTitle index="04" title="관리자 특이사항" />
                <TextareaField
                  value={log.manager_notes}
                  onChange={value => updateField('manager_notes', value)}
                  placeholder="관리자 확인 사항을 기록하세요."
                  minRows={5}
                />
              </section>

              <section>
                <SectionTitle index="05" title="기타 보고사항" />
                <TextareaField
                  value={log.other_notes}
                  onChange={value => updateField('other_notes', value)}
                  placeholder="기타 보고사항을 기록하세요."
                  minRows={4}
                />
              </section>

              <section>
                <SectionTitle index="06" title="메모" />
                <TextareaField
                  value={log.memo}
                  onChange={value => updateField('memo', value)}
                  placeholder="공용 메모를 남겨주세요."
                  minRows={4}
                />
              </section>

              <section>
                <SectionTitle index="07" title="내일 계획" />
                <TextareaField
                  value={log.tomorrow_plans}
                  onChange={value => updateField('tomorrow_plans', value)}
                  placeholder="다음 날 계획을 기록하세요."
                  minRows={4}
                />
              </section>

              <section>
                <SectionTitle index="08" title="프로그램 건의사항" />
                <TextareaField
                  value={log.program_feedback}
                  onChange={value => updateField('program_feedback', value)}
                  placeholder="프로그램 사용 중 불편한 점, 개선 요청, 버그 등을 자유롭게 작성해주세요."
                  minRows={4}
                />
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
