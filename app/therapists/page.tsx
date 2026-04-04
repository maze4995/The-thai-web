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
  const { storeId } = useStore()

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
    if (!confirm(`"${therapist.name}" 관리사를 영구 삭제하시겠습니까?`)) return
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

  // Format date for display
  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0f1117]">
      {/* Page Header */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">관리사 관리</h2>
            <p className="text-slate-400 text-sm">관리사 출퇴근 및 정보를 관리합니다.</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#D4A574] hover:bg-[#c4955a] text-white font-bold rounded-lg shadow-lg shadow-[#D4A574]/20 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            관리사 추가
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-[#1a2035] p-5 rounded-xl border border-slate-700/30 relative overflow-hidden group">
            <div className="absolute -right-3 -bottom-3 opacity-5 group-hover:opacity-10 transition-opacity">
              <svg className="w-20 h-20 text-[#D4A574]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">전체 관리사</p>
            <p className="text-3xl font-bold text-[#D4A574]">{String(totalCount).padStart(2, '0')}</p>
            <p className="text-xs text-slate-500 mt-2">활성 {activeCount}명</p>
          </div>

          <div className="bg-[#1a2035] p-5 rounded-xl border border-slate-700/30 relative overflow-hidden">
            <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">오늘 출근</p>
            <p className="text-3xl font-bold text-emerald-400">{String(presentCount).padStart(2, '0')}</p>
            <div className="mt-3 w-full bg-slate-700/40 h-1 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: activeCount > 0 ? `${(presentCount / activeCount) * 100}%` : '0%' }}
              />
            </div>
          </div>

          <div className="bg-[#1a2035] p-5 rounded-xl border border-slate-700/30 flex items-center justify-between border-l-4 border-l-[#D4A574]">
            <div>
              <p className="text-slate-200 font-bold text-sm">출근 관리</p>
              <p className="text-slate-400 text-xs mt-1">날짜를 선택하여 출퇴근을 관리하세요</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goDay(-1)}
                className="w-8 h-8 rounded-lg bg-slate-700/50 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-[#D4A574] font-bold text-sm whitespace-nowrap">{formatDisplayDate(selectedDate)}</span>
              <button
                onClick={() => goDay(1)}
                className="w-8 h-8 rounded-lg bg-slate-700/50 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              {!isToday && (
                <button
                  onClick={goToday}
                  className="px-3 py-1.5 bg-[#D4A574] hover:bg-[#c4955a] text-white rounded-lg text-xs font-bold transition-colors"
                >
                  오늘
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Therapist Table */}
        <div className="bg-[#0c0e18] rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-slate-700/20">
          {/* Table Header Bar */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-slate-700/20">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-[#D4A574]">관리사 목록</span>
              <div className="h-4 w-px bg-slate-700/40" />
              <span className="text-xs text-slate-500">표시 순서대로 정렬</span>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">불러오는 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-slate-500 uppercase text-[10px] tracking-widest border-b border-slate-700/10">
                    <th className="px-6 py-4 font-semibold w-20">순서</th>
                    <th className="px-6 py-4 font-semibold">관리사</th>
                    <th className="px-6 py-4 font-semibold w-32">상태</th>
                    <th className="px-6 py-4 font-semibold text-center w-32">출퇴근</th>
                    <th className="px-6 py-4 font-semibold text-right w-48">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/10">
                  {therapists.map((t, index) => {
                    const present = isPresent(t.id)
                    return (
                      <tr
                        key={t.id}
                        className={`hover:bg-[#1a2035] transition-colors group ${!t.is_active ? 'opacity-50' : ''}`}
                      >
                        {/* Order */}
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <button
                                onClick={() => moveTherapist(index, -1)}
                                disabled={index === 0}
                                className="text-slate-600 hover:text-[#D4A574] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                              </button>
                              <button
                                onClick={() => moveTherapist(index, 1)}
                                disabled={index === therapists.length - 1}
                                className="text-slate-600 hover:text-[#D4A574] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </button>
                            </div>
                            <span className="text-slate-500 font-mono text-sm">{String(index + 1).padStart(2, '0')}</span>
                          </div>
                        </td>

                        {/* Therapist Name */}
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                                t.is_active
                                  ? 'bg-[#8B4513] text-white'
                                  : 'bg-slate-700 text-slate-400'
                              }`}>
                                {t.name.charAt(0)}
                              </div>
                              {t.is_active && (
                                <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0c0e18] ${
                                  present ? 'bg-emerald-500' : 'bg-slate-600'
                                }`} />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-slate-100 text-sm">{t.name}</p>
                              {!t.is_active && (
                                <p className="text-[10px] text-slate-600">비활성화됨</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Active Status Toggle */}
                        <td className="px-6 py-3">
                          <button
                            onClick={() => toggleActive(t)}
                            className="flex items-center gap-2"
                          >
                            <div className={`relative w-10 h-5 rounded-full transition-colors ${
                              t.is_active ? 'bg-[#D4A574]' : 'bg-slate-700'
                            }`}>
                              <span
                                className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                                  t.is_active ? 'left-[22px]' : 'left-[2px]'
                                }`}
                              />
                            </div>
                            <span className={`text-xs font-medium ${t.is_active ? 'text-slate-300' : 'text-slate-600'}`}>
                              {t.is_active ? '활성' : '비활성'}
                            </span>
                          </button>
                        </td>

                        {/* Attendance */}
                        <td className="px-6 py-3">
                          <div className="flex justify-center">
                            {t.is_active ? (
                              <button
                                onClick={() => toggleAttendance(t)}
                                className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                                  present
                                    ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/30 hover:bg-emerald-900/60'
                                    : 'bg-slate-800 text-slate-500 border border-slate-700/30 hover:bg-slate-700'
                                }`}
                              >
                                {present ? '출근' : '미출근'}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-600">-</span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => openEdit(t)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-700/50 text-slate-600 hover:text-amber-400 transition-all"
                              title="수정"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(t)}
                              disabled={deleting === t.id}
                              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-900/20 text-slate-600 hover:text-red-400 transition-all disabled:opacity-50"
                              title="삭제"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a2035] border border-slate-700/50 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/40">
              <h2 className="font-bold text-white">
                {editingId ? '관리사 수정' : '관리사 추가'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-200 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">이름 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="관리사 이름"
                  className="w-full bg-[#0f1117] border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-[#D4A574] transition-colors"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">활성 여부</label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-block w-12 h-6 rounded-full transition-colors shrink-0 ${
                    form.is_active ? 'bg-[#D4A574]' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-[2px] w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${
                      form.is_active ? 'left-[26px]' : 'left-[2px]'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-slate-700/40">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 bg-slate-700/50 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-2.5 bg-[#D4A574] hover:bg-[#c4955a] text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
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
