'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'
import { useStore } from '@/components/StoreProvider'

interface CalendarEvent {
  id: string
  event_date: string
  title: string
  category: string
  therapist_id: string | null
  therapist_name?: string
}

interface Therapist {
  id: string
  name: string
}

const CATEGORY_COLORS: Record<string, { chip: string; dot: string }> = {
  '휴무': {
    chip: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700/60',
    dot: 'bg-red-400',
  },
  '급여': {
    chip: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/60',
    dot: 'bg-emerald-400',
  },
  '기타': {
    chip: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/60',
    dot: 'bg-blue-400',
  },
}

const CATEGORIES = ['휴무', '급여', '기타']
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [loading, setLoading] = useState(true)

  // modal state
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [modalTitle, setModalTitle] = useState('')
  const [modalCategory, setModalCategory] = useState('기타')
  const [modalTherapistId, setModalTherapistId] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { theme, toggle } = useTheme()
  const { storeId } = useStore()

  const fetchEvents = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data } = await supabase
      .from('calendar_events')
      .select('*, therapists(name)')
      .eq('store_id', storeId)
      .gte('event_date', from)
      .lte('event_date', to)
      .order('created_at')

    setEvents(
      (data ?? []).map((e: Record<string, unknown>) => ({
        id: e.id as string,
        event_date: e.event_date as string,
        title: e.title as string,
        category: e.category as string,
        therapist_id: e.therapist_id as string | null,
        therapist_name: (e.therapists as { name: string } | null)?.name,
      }))
    )
    setLoading(false)
  }, [storeId, year, month])

  useEffect(() => {
    supabase
      .from('therapists')
      .select('id, name')
      .order('display_order')
      .order('name')
      .then(({ data }) => setTherapists(data ?? []))
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const openModal = (dateStr: string) => {
    setSelectedDate(dateStr)
    setModalTitle('')
    setModalCategory('기타')
    setModalTherapistId('')
  }

  const closeModal = () => setSelectedDate(null)

  const handleAdd = async () => {
    if (!storeId || !selectedDate || !modalTitle.trim()) return
    setSaving(true)
    await supabase.from('calendar_events').insert({
      store_id: storeId,
      event_date: selectedDate,
      title: modalTitle.trim(),
      category: modalCategory,
      therapist_id: modalCategory === '휴무' && modalTherapistId ? modalTherapistId : null,
    })
    setModalTitle('')
    setModalCategory('기타')
    setModalTherapistId('')
    setSaving(false)
    fetchEvents()
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await supabase.from('calendar_events').delete().eq('id', id)
    setDeletingId(null)
    fetchEvents()
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const eventsByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    acc[e.event_date] = acc[e.event_date] ?? []
    acc[e.event_date].push(e)
    return acc
  }, {})

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : []

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1117] text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-[#161b27] border-b border-slate-200 dark:border-slate-700/40 px-3 sm:px-5 py-2.5 flex items-center gap-2">
        <a
          href="/"
          className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 transition-colors"
        >
          ← 홈
        </a>
        <h1 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 ml-1">일정 관리</h1>
        <div className="ml-auto">
          <button
            onClick={toggle}
            className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-xs sm:text-sm transition-colors"
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 sm:px-5 py-5">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors text-sm font-bold"
          >
            ‹
          </button>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
            {year}년 {month + 1}월
          </h2>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors text-sm font-bold"
          >
            ›
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {CATEGORIES.map(cat => (
            <span key={cat} className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[cat]?.chip}`}>
              {cat}
            </span>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700/40 overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700/40">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={`py-2 text-center text-xs font-semibold ${
                  i === 0 ? 'text-red-500 dark:text-red-400' :
                  i === 6 ? 'text-blue-500 dark:text-blue-400' :
                  'text-slate-500 dark:text-slate-400'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="min-h-[70px] sm:min-h-[90px] border-b border-r border-slate-100 dark:border-slate-700/30 last:border-r-0" />
              }
              const dateStr = toDateStr(year, month, day)
              const dayEvents = eventsByDate[dateStr] ?? []
              const isToday = dateStr === todayStr
              const dow = (firstDay + day - 1) % 7
              const isSelected = dateStr === selectedDate

              return (
                <button
                  key={dateStr}
                  onClick={() => openModal(dateStr)}
                  className={`min-h-[70px] sm:min-h-[90px] p-1 sm:p-1.5 text-left border-b border-r border-slate-100 dark:border-slate-700/30 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                    isSelected ? 'bg-slate-100 dark:bg-slate-800' : ''
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold mb-0.5 ${
                    isToday
                      ? 'bg-emerald-600 text-white'
                      : dow === 0 ? 'text-red-500 dark:text-red-400'
                      : dow === 6 ? 'text-blue-500 dark:text-blue-400'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}>
                    {day}
                  </span>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map(e => (
                      <span
                        key={e.id}
                        className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${CATEGORY_COLORS[e.category]?.chip ?? CATEGORY_COLORS['기타'].chip}`}
                      >
                        {e.category === '휴무' && e.therapist_name ? `${e.therapist_name} 휴무` : e.title}
                      </span>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1">+{dayEvents.length - 3}개</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </main>

      {/* Day Modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={closeModal}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full sm:max-w-sm bg-white dark:bg-[#1a2035] rounded-t-2xl sm:rounded-2xl shadow-xl p-4 sm:p-5 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Date title */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                {selectedDate.replace(/-/g, '.')}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none">✕</button>
            </div>

            {/* Existing events */}
            {selectedEvents.length > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                {selectedEvents.map(e => (
                  <div key={e.id} className={`flex items-center justify-between px-3 py-2 rounded-lg ${CATEGORY_COLORS[e.category]?.chip ?? CATEGORY_COLORS['기타'].chip}`}>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs font-semibold truncate">
                        [{e.category}] {e.title}
                      </span>
                      {e.therapist_name && (
                        <span className="text-[11px] opacity-75">{e.therapist_name}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(e.id)}
                      disabled={deletingId === e.id}
                      className="ml-2 text-[11px] px-2 py-0.5 rounded bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/40 transition-colors shrink-0 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add event form */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 flex flex-col gap-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">새 일정 추가</p>

              {/* Category */}
              <div className="flex gap-1.5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setModalCategory(cat)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                      modalCategory === cat
                        ? CATEGORY_COLORS[cat]?.chip
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-transparent'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Therapist select (휴무 only) */}
              {modalCategory === '휴무' && (
                <select
                  value={modalTherapistId}
                  onChange={e => {
                    setModalTherapistId(e.target.value)
                    if (e.target.value) {
                      const t = therapists.find(t => t.id === e.target.value)
                      if (t) setModalTitle(`${t.name} 휴무`)
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">관리사 선택 (선택사항)</option>
                  {therapists.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}

              {/* Title */}
              <input
                type="text"
                value={modalTitle}
                onChange={e => setModalTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="일정 내용"
                className="w-full bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />

              <div className="flex gap-2">
                <button
                  onClick={closeModal}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
                >
                  닫기
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !modalTitle.trim()}
                  className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '저장 중...' : '추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
