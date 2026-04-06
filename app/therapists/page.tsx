'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Therapist, DailyAttendance } from '@/lib/types'
import { toDateString } from '@/lib/utils'
import { useStore } from '@/components/StoreProvider'

interface TherapistForm {
  name: string
  is_active: boolean
}

const defaultForm: TherapistForm = { name: '', is_active: true }

export default function TherapistsPage() {
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()))
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [attendance, setAttendance] = useState<DailyAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TherapistForm>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const { storeId, settings } = useStore()

  const staffLabel = settings.staffLabel
  const staffPluralLabel = `${staffLabel} 관리`

  const fetchData = useCallback(async () => {
    const [tRes, aRes] = await Promise.all([
      supabase.from('therapists').select('*').order('display_order').order('name'),
      supabase.from('daily_attendance').select('*').eq('work_date', selectedDate),
    ])
    setTherapists(tRes.data ?? [])
    setAttendance(aRes.data ?? [])
    setLoading(false)
  }, [selectedDate])

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
      const maxOrder = attendance
        .filter(a => a.is_present)
        .reduce((max, a) => Math.max(max, a.display_order ?? 0), -1)
      await supabase.from('daily_attendance').insert({
        store_id: storeId,
        therapist_id: therapist.id,
        work_date: selectedDate,
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

  const handleDelete = async (therapist: Therapist) => {
    if (!confirm(`"${therapist.name}" ${staffLabel}를 영구 삭제하시겠습니까?`)) return
    setDeleting(therapist.id)
    await supabase.from('therapists').delete().eq('id', therapist.id)
    setDeleting(null)
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
    const reordered = [...therapists]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    const updated = reordered.map((t, i) => ({ ...t, display_order: i }))
    setTherapists(updated)
    const changes = updated.filter((t, i) => therapists.find(s => s.id === t.id)?.display_order !== i)
    await Promise.all(
      changes.map(t => supabase.from('therapists').update({ display_order: t.display_order }).eq('id', t.id))
    )
  }

  const isPresent = (therapistId: string) => {
    const att = attendance.find(a => a.therapist_id === therapistId)
    return att?.is_present ?? false
  }

  const goToday = () => setSelectedDate(toDateString(new Date()))
  const goDay = (offset: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    setSelectedDate(toDateString(d))
  }

  const isToday = selectedDate === toDateString(new Date())

  const activeTherapists = therapists.filter(t => t.is_active)
  const presentCount = activeTherapists.filter(t => isPresent(t.id)).length
  const totalCount = therapists.length
  const activeCount = activeTherapists.length

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0f1117]">
      <div className="px-8 pt-8 pb-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="mb-1 text-2xl font-bold text-white">{staffPluralLabel}</h2>
            <p className="text-sm text-slate-400">{staffLabel} 출근과 기본 정보를 관리합니다.</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 rounded-lg bg-[#D4A574] px-5 py-2.5 font-bold text-white shadow-lg shadow-[#D4A574]/20 transition-all active:scale-95 hover:bg-[#c4955a]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {staffLabel} 추가
          </button>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="group relative overflow-hidden rounded-xl border border-slate-700/30 bg-[#1a2035] p-5">
            <div className="absolute -bottom-3 -right-3 opacity-5 transition-opacity group-hover:opacity-10">
              <svg className="h-20 w-20 text-[#D4A574]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="mb-1 text-xs uppercase tracking-widest text-slate-400">전체 {staffLabel}</p>
            <p className="text-3xl font-bold text-[#D4A574]">{String(totalCount).padStart(2, '0')}</p>
            <p className="mt-2 text-xs text-slate-500">활성 {activeCount}명</p>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-slate-700/30 bg-[#1a2035] p-5">
            <p className="mb-1 text-xs uppercase tracking-widest text-slate-400">오늘 출근</p>
            <p className="text-3xl font-bold text-emerald-400">{String(presentCount).padStart(2, '0')}</p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-700/40">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: activeCount > 0 ? `${(presentCount / activeCount) * 100}%` : '0%' }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-700/30 border-l-4 border-l-[#D4A574] bg-[#1a2035] p-5">
            <div>
              <p className="text-sm font-bold text-slate-200">출근 관리</p>
              <p className="mt-1 text-xs text-slate-400">날짜를 선택하여 {staffLabel} 출근을 관리합니다.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goDay(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700/50 text-slate-400 transition-colors hover:bg-slate-600 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="whitespace-nowrap text-sm font-bold text-[#D4A574]">{formatDisplayDate(selectedDate)}</span>
              <button
                onClick={() => goDay(1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700/50 text-slate-400 transition-colors hover:bg-slate-600 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              {!isToday && (
                <button
                  onClick={goToday}
                  className="rounded-lg bg-[#D4A574] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#c4955a]"
                >
                  오늘
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-700/20 bg-[#0c0e18] shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-slate-700/20 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-[#D4A574]">{staffLabel} 목록</span>
              <div className="h-4 w-px bg-slate-700/40" />
              <span className="text-xs text-slate-500">표시 순서대로 정렬</span>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">불러오는 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-700/10 text-[10px] uppercase tracking-widest text-slate-500">
                    <th className="w-20 px-6 py-4 font-semibold">순서</th>
                    <th className="px-6 py-4 font-semibold">{staffLabel}</th>
                    <th className="w-32 px-6 py-4 font-semibold">상태</th>
                    <th className="w-32 px-6 py-4 text-center font-semibold">출근</th>
                    <th className="w-48 px-6 py-4 text-right font-semibold">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/10">
                  {therapists.map((t, index) => {
                    const present = isPresent(t.id)
                    return (
                      <tr
                        key={t.id}
                        className={`group transition-colors hover:bg-[#1a2035] ${!t.is_active ? 'opacity-50' : ''}`}
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <button
                                onClick={() => moveTherapist(index, -1)}
                                disabled={index === 0}
                                className="text-slate-600 transition-colors hover:text-[#D4A574] disabled:cursor-not-allowed disabled:opacity-20"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                              </button>
                              <button
                                onClick={() => moveTherapist(index, 1)}
                                disabled={index === therapists.length - 1}
                                className="text-slate-600 transition-colors hover:text-[#D4A574] disabled:cursor-not-allowed disabled:opacity-20"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </button>
                            </div>
                            <span className="font-mono text-sm text-slate-500">{String(index + 1).padStart(2, '0')}</span>
                          </div>
                        </td>

                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                                t.is_active ? 'bg-[#8B4513] text-white' : 'bg-slate-700 text-slate-400'
                              }`}>
                                {t.name.charAt(0)}
                              </div>
                              {t.is_active && (
                                <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0c0e18] ${
                                  present ? 'bg-emerald-500' : 'bg-slate-600'
                                }`} />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-100">{t.name}</p>
                              {!t.is_active && (
                                <p className="text-[10px] text-slate-600">비활성화됨</p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-3">
                          <button onClick={() => toggleActive(t)} className="flex items-center gap-2">
                            <div className={`relative h-5 w-10 rounded-full transition-colors ${
                              t.is_active ? 'bg-[#D4A574]' : 'bg-slate-700'
                            }`}>
                              <span
                                className={`absolute top-[2px] h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${
                                  t.is_active ? 'left-[22px]' : 'left-[2px]'
                                }`}
                              />
                            </div>
                            <span className={`text-xs font-medium ${t.is_active ? 'text-slate-300' : 'text-slate-600'}`}>
                              {t.is_active ? '활성' : '비활성'}
                            </span>
                          </button>
                        </td>

                        <td className="px-6 py-3">
                          <div className="flex justify-center">
                            {t.is_active ? (
                              <button
                                onClick={() => toggleAttendance(t)}
                                className={`rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                                  present
                                    ? 'border border-emerald-700/30 bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60'
                                    : 'border border-slate-700/30 bg-slate-800 text-slate-500 hover:bg-slate-700'
                                }`}
                              >
                                {present ? '출근' : '미출근'}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-600">-</span>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => openEdit(t)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-all hover:bg-slate-700/50 hover:text-amber-400"
                              title="수정"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(t)}
                              disabled={deleting === t.id}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-all hover:bg-red-900/20 hover:text-red-400 disabled:opacity-50"
                              title="삭제"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700/50 bg-[#1a2035] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700/40 px-5 py-4">
              <h2 className="font-bold text-white">
                {editingId ? `${staffLabel} 수정` : `${staffLabel} 추가`}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-500 transition-colors hover:text-slate-200">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">이름 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={`${staffLabel} 이름`}
                  className="w-full rounded-lg border border-slate-700/50 bg-[#0f1117] px-3 py-2.5 text-sm text-slate-100 transition-colors focus:border-[#D4A574] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">활성 여부</label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-block h-6 w-12 shrink-0 rounded-full transition-colors ${
                    form.is_active ? 'bg-[#D4A574]' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
                      form.is_active ? 'left-[26px]' : 'left-[2px]'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-700/40 px-5 py-4">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg bg-slate-700/50 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-600"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 rounded-lg bg-[#D4A574] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#c4955a] disabled:opacity-50"
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
