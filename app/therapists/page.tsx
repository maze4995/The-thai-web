'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Therapist, DailyAttendance } from '@/lib/types'
import { toDateString } from '@/lib/utils'
import { useTheme } from '@/components/ThemeProvider'
import { useStore } from '@/components/StoreProvider'

interface TherapistForm {
  name: string
  is_active: boolean
}

const defaultForm: TherapistForm = { name: '', is_active: true }

export default function TherapistsPage() {
  const today = toDateString(new Date())
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [attendance, setAttendance] = useState<DailyAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TherapistForm>(defaultForm)
  const [saving, setSaving] = useState(false)
  const { theme, toggle } = useTheme()
  const { storeId } = useStore()

  const fetchData = useCallback(async () => {
    const [tRes, aRes] = await Promise.all([
      supabase.from('therapists').select('*').order('display_order').order('name'),
      supabase.from('daily_attendance').select('*').eq('work_date', today),
    ])
    setTherapists(tRes.data ?? [])
    setAttendance(aRes.data ?? [])
    setLoading(false)
  }, [today])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleAttendance = async (therapist: Therapist) => {
    const att = attendance.find(a => a.therapist_id === therapist.id)
    if (att) {
      await supabase
        .from('daily_attendance')
        .update({ is_present: !att.is_present })
        .eq('id', att.id)
    } else {
      // New attendance: assign display_order at end of present list
      const maxOrder = attendance
        .filter(a => a.is_present)
        .reduce((max, a) => Math.max(max, a.display_order ?? 0), -1)
      await supabase.from('daily_attendance').insert({
        store_id: storeId,
        therapist_id: therapist.id,
        work_date: today,
        is_present: true,
        display_order: maxOrder + 1,
      })
    }
    fetchData()
  }

  const openEdit = (therapist: Therapist) => {
    setEditingId(therapist.id)
    setForm({
      name: therapist.name,
      is_active: therapist.is_active,
    })
    setShowForm(true)
  }

  const openNew = () => {
    setEditingId(null)
    setForm(defaultForm)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)

    if (editingId) {
      await supabase.from('therapists').update(form).eq('id', editingId)
    } else {
      await supabase.from('therapists').insert({ ...form, store_id: storeId })
    }

    setSaving(false)
    setShowForm(false)
    fetchData()
  }

  const toggleActive = async (therapist: Therapist) => {
    await supabase
      .from('therapists')
      .update({ is_active: !therapist.is_active })
      .eq('id', therapist.id)
    fetchData()
  }

  const moveTherapist = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= therapists.length) return
    // Remove and re-insert
    const reordered = [...therapists]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    // Assign sequential display_order
    const updated = reordered.map((t, i) => ({ ...t, display_order: i }))
    setTherapists(updated)
    // Persist changed ones
    const changes = updated.filter((t, i) => therapists.find(s => s.id === t.id)?.display_order !== i)
    await Promise.all(
      changes.map(t => supabase.from('therapists').update({ display_order: t.display_order }).eq('id', t.id))
    )
  }

  const isPresent = (therapistId: string) => {
    const att = attendance.find(a => a.therapist_id === therapistId)
    return att?.is_present ?? false
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0f1117] text-slate-800 dark:text-slate-200">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 bg-white dark:bg-[#161b27] border-b border-slate-200 dark:border-slate-700/60">
        <div className="flex items-center gap-3">
          <a href="/" className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm transition-colors">← 조판지</a>
          <h1 className="font-bold text-slate-900 dark:text-slate-100">관리사 관리</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="px-3 py-2 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-sm transition-colors"
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            onClick={openNew}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            + 관리사 추가
          </button>
        </div>
      </header>

      <div className="p-5 max-w-3xl mx-auto">
        {/* Today's attendance section */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">
            오늘 출근 · {today}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {therapists.filter(t => t.is_active).map(t => {
              const present = isPresent(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => toggleAttendance(t)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    present
                      ? 'bg-emerald-900/30 border-emerald-600/60 text-emerald-300'
                      : 'bg-white dark:bg-[#1a2035] border-slate-200 dark:border-slate-700/40 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                    present ? 'bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}>
                    {t.name.charAt(0)}
                  </div>
                  <span className="text-sm font-semibold">{t.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    present ? 'bg-emerald-800 text-emerald-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {present ? '출근' : '미출근'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* All therapists */}
        <div>
          <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">
            전체 관리사
          </h2>
          {loading ? (
            <div className="text-slate-400 dark:text-slate-500 text-sm">불러오는 중...</div>
          ) : (
            <div className="flex flex-col gap-2">
              {therapists.map((t, index) => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    t.is_active
                      ? 'bg-white dark:bg-[#1a2035] border-slate-200 dark:border-slate-700/40'
                      : 'bg-slate-50 dark:bg-[#161b27] border-slate-200 dark:border-slate-800/40 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Order arrows */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveTherapist(index, -1)}
                        disabled={index === 0}
                        className="px-1 py-0.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveTherapist(index, 1)}
                        disabled={index === therapists.length - 1}
                        className="px-1 py-0.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      >
                        ▼
                      </button>
                    </div>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                      t.is_active ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                    }`}>
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{t.name}</div>
                      {!t.is_active && (
                        <div className="text-xs text-slate-400 dark:text-slate-600">비활성</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(t)}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-xs transition-colors"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => toggleActive(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                        t.is_active
                          ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/30'
                          : 'bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-800/30'
                      }`}
                    >
                      {t.is_active ? '비활성화' : '활성화'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a2035] border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-bold text-slate-900 dark:text-slate-100">
                {editingId ? '관리사 수정' : '관리사 추가'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl px-2">
                ✕
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">이름 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="관리사 이름"
                  className="w-full bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-500 dark:text-slate-400">활성 여부</label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  style={{ minWidth: '48px' }}
                  className={`relative inline-block w-12 h-6 rounded-full transition-colors shrink-0 ${
                    form.is_active ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    style={{ left: form.is_active ? '26px' : '2px' }}
                    className="absolute top-[2px] w-5 h-5 bg-white rounded-full shadow transition-all duration-200"
                  />
                </button>
              </div>
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
