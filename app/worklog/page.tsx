'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'
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
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minRows?: number
  className?: string
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={minRows}
      className={`w-full bg-transparent resize-none focus:outline-none text-sm leading-relaxed placeholder:text-slate-300 dark:placeholder:text-slate-600 print:placeholder:text-transparent ${className}`}
    />
  )
}

export default function WorkLogPage() {
  const today = toDateStr(new Date())
  const [dateStr, setDateStr] = useState(today)
  const [log, setLog] = useState<WorkLog>(defaultLog(today))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { theme, toggle } = useTheme()
  const { storeId, storeName } = useStore()

  const fetchLog = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const { data } = await supabase
      .from('work_logs')
      .select('*')
      .eq('store_id', storeId)
      .eq('log_date', dateStr)
      .single()

    if (data) {
      setLog({
        id: data.id,
        log_date: data.log_date,
        hygiene: data.hygiene ?? '',
        therapist_notes: data.therapist_notes ?? '',
        customer_items: Array.isArray(data.customer_items) ? data.customer_items : Array(10).fill(''),
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
  }, [storeId, dateStr])

  useEffect(() => { fetchLog() }, [fetchLog])

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
      const { data } = await supabase.from('work_logs').insert(payload).select().single()
      if (data) setLog(prev => ({ ...prev, id: data.id }))
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const cellBase = 'border border-slate-300 dark:border-slate-600 print:border-black align-top'
  const headerCell = `${cellBase} bg-slate-100 dark:bg-slate-800 print:bg-white text-center font-semibold text-sm p-2`
  const numCell = `${cellBase} text-center text-sm font-semibold p-2 text-slate-700 dark:text-slate-300 print:text-black w-12`
  const labelCell = `${cellBase} text-center text-sm font-semibold p-3 text-slate-700 dark:text-slate-300 print:text-black w-32`
  const contentCell = `${cellBase} p-2 text-slate-900 dark:text-slate-100 print:text-black`

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1117] text-slate-900 dark:text-slate-100">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          textarea, input[type="text"] {
            border: none !important;
            background: transparent !important;
            color: black !important;
            resize: none !important;
          }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid black !important; }
        }
        textarea { min-height: 1.5rem; }
      `}</style>

      {/* Header */}
      <header className="no-print sticky top-0 z-10 bg-white dark:bg-[#161b27] border-b border-slate-200 dark:border-slate-700/40 px-3 sm:px-5 py-2.5 flex items-center gap-2 flex-wrap">
        <a
          href="/"
          className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 transition-colors"
        >
          ← 홈
        </a>
        <h1 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100">근무일지</h1>

        {/* Date navigation */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => changeDate(-1)}
            className="w-7 h-7 flex items-center justify-center rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-bold transition-colors"
          >‹</button>
          <input
            type="date"
            value={dateStr}
            onChange={e => setDateStr(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={() => changeDate(1)}
            className="w-7 h-7 flex items-center justify-center rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-bold transition-colors"
          >›</button>
          {dateStr !== today && (
            <button
              onClick={() => setDateStr(today)}
              className="px-2 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded text-[10px] text-slate-600 dark:text-slate-300 transition-colors"
            >오늘</button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggle}
            className="px-2 py-1 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-xs transition-colors"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded text-xs text-slate-600 dark:text-slate-300 font-medium transition-colors"
          >
            인쇄
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {saved ? '저장됨 ✓' : saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-5">
        {loading ? (
          <div className="text-center py-20 text-slate-400 text-sm">불러오는 중...</div>
        ) : (
          <div className="bg-white dark:bg-[#161b27] rounded-xl shadow-sm overflow-hidden print:rounded-none print:shadow-none">
            {/* Print header */}
            <div className="px-6 pt-5 pb-3 print:pt-2">
              <p className="text-right text-sm text-slate-500 dark:text-slate-400 print:text-black mb-1">
                {formatDisplayDate(dateStr)}
              </p>
              <h2 className="text-center text-lg font-bold text-slate-800 dark:text-slate-100 print:text-black mb-1">
                {storeName ? `< ${storeName} 일일 근무 일지 >` : '< 일일 근무 일지 >'}
              </h2>
            </div>

            {/* Table */}
            <div className="px-4 sm:px-6 pb-6 overflow-x-auto">
              <table className="w-full border-collapse text-sm" style={{ minWidth: 500 }}>
                <thead>
                  <tr>
                    <th className={`${headerCell} w-12`}>순번</th>
                    <th className={`${headerCell} w-32`}>내 용</th>
                    <th className={headerCell}>파 악 현 황</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: 매장 위생 */}
                  <tr>
                    <td className={numCell}>1</td>
                    <td className={labelCell}>매장 위생 및<br />청결 상태</td>
                    <td className={contentCell}>
                      <AutoTextarea
                        value={log.hygiene}
                        onChange={v => updateField('hygiene', v)}
                        placeholder="청소 완료 항목을 입력하세요"
                        minRows={3}
                      />
                    </td>
                  </tr>

                  {/* Row 2: 관리사 득이사항 */}
                  <tr>
                    <td className={numCell}>2</td>
                    <td className={labelCell}>관리사<br />득이사항</td>
                    <td className={contentCell}>
                      <AutoTextarea
                        value={log.therapist_notes}
                        onChange={v => updateField('therapist_notes', v)}
                        placeholder="1.&#10;2.&#10;3.&#10;4."
                        minRows={4}
                      />
                    </td>
                  </tr>

                  {/* Row 3: 고객 득이사항 */}
                  <tr>
                    <td className={numCell}>3</td>
                    <td className={labelCell}>고객<br />득이사항</td>
                    <td className={contentCell}>
                      <div className="flex flex-col gap-0.5">
                        {log.customer_items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-slate-400 dark:text-slate-500 print:text-black w-5 shrink-0 text-right">{i + 1}.</span>
                            <input
                              type="text"
                              value={item}
                              onChange={e => updateCustomerItem(i, e.target.value)}
                              className="flex-1 bg-transparent focus:outline-none text-sm leading-relaxed border-b border-transparent focus:border-slate-300 dark:focus:border-slate-600 print:border-none transition-colors"
                            />
                          </div>
                        ))}
                        <div className="mt-2 flex flex-col gap-1 border-t border-slate-100 dark:border-slate-700 print:border-black pt-2">
                          {[
                            { label: '오버고객', key: 'customer_over' as const },
                            { label: '덕타이 인계', key: 'customer_handoff' as const },
                            { label: '덕타이 인수', key: 'customer_receive' as const },
                          ].map(({ label, key }) => (
                            <div key={key} className="flex items-center gap-2">
                              <span className="text-slate-500 dark:text-slate-400 print:text-black text-sm shrink-0">☞ {label} :</span>
                              <input
                                type="text"
                                value={log[key]}
                                onChange={e => updateField(key, e.target.value)}
                                className="flex-1 bg-transparent focus:outline-none text-sm border-b border-transparent focus:border-slate-300 dark:focus:border-slate-600 print:border-none transition-colors"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Row 4: 관리자(실장) 득이사항 */}
                  <tr>
                    <td className={numCell}>4</td>
                    <td className={labelCell}>관리자(실장)<br />득이사항</td>
                    <td className={contentCell}>
                      <AutoTextarea
                        value={log.manager_notes}
                        onChange={v => updateField('manager_notes', v)}
                        placeholder="1.&#10;2.&#10;3."
                        minRows={4}
                      />
                    </td>
                  </tr>

                  {/* Row 5: 기타 보고사항 */}
                  <tr>
                    <td className={numCell}>5</td>
                    <td className={labelCell}>기타<br />보고사항</td>
                    <td className={contentCell}>
                      <AutoTextarea
                        value={log.other_notes}
                        onChange={v => updateField('other_notes', v)}
                        placeholder="1.&#10;2."
                        minRows={2}
                      />
                    </td>
                  </tr>

                  {/* Memo / motivational row */}
                  <tr>
                    <td className={numCell}></td>
                    <td className={labelCell}></td>
                    <td className={contentCell}>
                      <AutoTextarea
                        value={log.memo}
                        onChange={v => updateField('memo', v)}
                        placeholder="특이사항 또는 메모"
                        minRows={2}
                      />
                    </td>
                  </tr>

                  {/* Row 6: 명일 계획사항 */}
                  <tr>
                    <td className={numCell}>6</td>
                    <td className={labelCell}>명일<br />계획사항</td>
                    <td className={contentCell}>
                      <AutoTextarea
                        value={log.tomorrow_plans}
                        onChange={v => updateField('tomorrow_plans', v)}
                        placeholder="1.&#10;2.&#10;3."
                        minRows={3}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
