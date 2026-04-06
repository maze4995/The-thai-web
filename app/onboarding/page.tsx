'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DEFAULT_BRAND_NAME, DEFAULT_PRODUCT_LABEL } from '@/lib/branding'
import { useStore } from '@/components/StoreProvider'
import { getFallbackServices, useStoreServices } from '@/lib/service-config'
import { EditableServiceSetting, syncStoreServices } from '@/lib/service-admin'

interface OnboardingResult {
  store_id?: string
  created_store_id?: string
  updated_store_id?: string
}

interface StoreSettingsRow {
  brand_name: string | null
  contact_prefix: string | null
  staff_label: string | null
  reservation_time_interval: number | null
  visit_day_starts_at_hour: number | null
  visit_day_ends_at_hour: number | null
}

interface StoreRow {
  name: string
}

const RESERVATION_INTERVAL_OPTIONS = [15, 30, 60]
const START_HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => index)
const END_HOUR_OPTIONS = Array.from({ length: 25 }, (_, index) => index)

function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

function createDefaultServiceDraft(index: number): EditableServiceSetting {
  return {
    code: `S${index + 1}`,
    label: '',
    duration: 60,
    appPrice: 0,
    roadPrice: 0,
    commission: 0,
  }
}

function toServiceDraft(service: ReturnType<typeof getFallbackServices>[number]): EditableServiceSetting {
  return {
    code: service.code,
    label: service.label,
    duration: service.duration,
    appPrice: service.memberPrices.app_member ?? service.defaultPrice,
    roadPrice: service.memberPrices.road_member ?? service.defaultPrice,
    commission: service.commission,
  }
}

export default function OnboardingPage() {
  const router = useRouter()
  const { userEmail, storeId, storeName, settings, isLoading } = useStore()
  const { serviceOptions } = useStoreServices(storeId)

  const [formReady, setFormReady] = useState(false)
  const [storeNameInput, setStoreNameInput] = useState('')
  const [brandName, setBrandName] = useState('')
  const [contactPrefix, setContactPrefix] = useState('')
  const [staffLabel, setStaffLabel] = useState('직원')
  const [reservationTimeInterval, setReservationTimeInterval] = useState(30)
  const [visitDayStartsAtHour, setVisitDayStartsAtHour] = useState(6)
  const [visitDayEndsAtHour, setVisitDayEndsAtHour] = useState(18)
  const [serviceDrafts, setServiceDrafts] = useState<EditableServiceSetting[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const initializedServiceStoreIdRef = useRef<string | null | 'new'>(null)
  const isEditMode = Boolean(storeId)

  const pageTitle = isEditMode ? '매장 설정을 수정해 주세요' : '첫 매장 정보를 설정해 주세요'
  const submitLabel = isEditMode ? '설정 저장하기' : '온보딩 완료하고 시작하기'
  const backHref = isEditMode ? '/' : '/login'
  const backLabel = isEditMode ? '메인페이지로 돌아가기' : '로그인으로 돌아가기'
  const helperText = isEditMode
    ? '브랜드 정보, 운영 시간, 직원 명칭, 서비스 가격표를 한 화면에서 수정할 수 있습니다.'
    : '매장 기본 정보와 서비스 가격표를 먼저 설정하면, 이후 화면들이 매장 설정을 기준으로 동작합니다.'

  const normalizedServices = useMemo(() => {
    if (serviceOptions.length > 0) {
      return serviceOptions
    }
    return getFallbackServices()
  }, [serviceOptions])

  useEffect(() => {
    if (isLoading) return

    if (!userEmail) {
      router.replace('/login')
      return
    }

    if (!storeId) {
      const timeoutId = window.setTimeout(() => {
        setStoreNameInput('')
        setBrandName('')
        setContactPrefix('')
        setStaffLabel('직원')
        setReservationTimeInterval(30)
        setVisitDayStartsAtHour(6)
        setVisitDayEndsAtHour(18)
        setFormReady(true)
      }, 0)

      return () => window.clearTimeout(timeoutId)
    }
  }, [isLoading, router, storeId, userEmail])

  useEffect(() => {
    if (isLoading || !storeId) return

    let active = true

    const loadStoreDetails = async () => {
      const [{ data: storeData }, { data: settingsData }] = await Promise.all([
        supabase.from('stores').select('name').eq('id', storeId).maybeSingle(),
        supabase
          .from('store_settings')
          .select(
            'brand_name, contact_prefix, staff_label, reservation_time_interval, visit_day_starts_at_hour, visit_day_ends_at_hour'
          )
          .eq('store_id', storeId)
          .maybeSingle(),
      ])

      if (!active) return

      const nextStore = storeData as StoreRow | null
      const nextSettings = settingsData as StoreSettingsRow | null
      const nextStoreName = nextStore?.name ?? storeName ?? ''

      setStoreNameInput(nextStoreName)
      setBrandName(nextSettings?.brand_name ?? settings.brandName ?? nextStoreName)
      setContactPrefix(nextSettings?.contact_prefix ?? settings.contactPrefix ?? nextStoreName)
      setStaffLabel(nextSettings?.staff_label ?? settings.staffLabel ?? '직원')
      setReservationTimeInterval(nextSettings?.reservation_time_interval ?? settings.reservationTimeInterval ?? 30)
      setVisitDayStartsAtHour(nextSettings?.visit_day_starts_at_hour ?? settings.visitDayStartsAtHour ?? 6)
      setVisitDayEndsAtHour(nextSettings?.visit_day_ends_at_hour ?? settings.visitDayEndsAtHour ?? 18)
      setFormReady(true)
    }

    loadStoreDetails()

    return () => {
      active = false
    }
  }, [
    isLoading,
    settings.brandName,
    settings.contactPrefix,
    settings.reservationTimeInterval,
    settings.staffLabel,
    settings.visitDayEndsAtHour,
    settings.visitDayStartsAtHour,
    storeId,
    storeName,
  ])

  useEffect(() => {
    const currentKey = storeId ?? 'new'
    if (initializedServiceStoreIdRef.current === currentKey) {
      return
    }

    const drafts = normalizedServices.map(toServiceDraft)
    const timeoutId = window.setTimeout(() => {
      setServiceDrafts(drafts.length > 0 ? drafts : [createDefaultServiceDraft(0)])
      initializedServiceStoreIdRef.current = currentKey
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [normalizedServices, storeId])

  const updateServiceDraft = (
    index: number,
    key: keyof EditableServiceSetting,
    value: string | number
  ) => {
    setServiceDrafts(prev =>
      prev.map((draft, currentIndex) =>
        currentIndex === index ? { ...draft, [key]: value } : draft
      )
    )
  }

  const addServiceDraft = () => {
    setServiceDrafts(prev => [...prev, createDefaultServiceDraft(prev.length)])
  }

  const removeServiceDraft = (index: number) => {
    setServiceDrafts(prev => {
      if (prev.length === 1) return prev
      return prev.filter((_, currentIndex) => currentIndex !== index)
    })
  }

  const validateServiceDrafts = () => {
    if (serviceDrafts.length === 0) {
      return '최소 1개 이상의 서비스를 입력해 주세요.'
    }

    const codes = new Set<string>()

    for (const service of serviceDrafts) {
      const code = service.code.trim().toUpperCase()
      const label = service.label.trim()

      if (!code) {
        return '모든 서비스에 코드를 입력해 주세요.'
      }

      if (!label) {
        return '모든 서비스에 이름을 입력해 주세요.'
      }

      if (codes.has(code)) {
        return '서비스 코드는 중복될 수 없습니다.'
      }

      codes.add(code)
    }

    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccessMessage('')

    const serviceValidationError = validateServiceDrafts()
    if (serviceValidationError) {
      setError(serviceValidationError)
      setSubmitting(false)
      return
    }

    const payload = {
      p_store_name: storeNameInput.trim(),
      p_brand_name: brandName.trim() || null,
      p_contact_prefix: contactPrefix.trim() || null,
      p_staff_label: staffLabel.trim() || '직원',
      p_reservation_time_interval: reservationTimeInterval,
      p_visit_day_starts_at_hour: visitDayStartsAtHour,
      p_visit_day_ends_at_hour: visitDayEndsAtHour,
    }

    const rpcName = isEditMode ? 'update_store_onboarding' : 'create_store_onboarding'
    const { data, error: rpcError } = await supabase.rpc(rpcName, payload)

    if (rpcError) {
      if (rpcError.message.includes(rpcName)) {
        setError(
          isEditMode
            ? '온보딩 수정 SQL이 아직 적용되지 않았습니다. `migration_onboarding_update.sql`을 먼저 적용해 주세요.'
            : '온보딩 생성 SQL이 아직 적용되지 않았습니다. `migration_onboarding.sql`을 먼저 적용해 주세요.'
        )
      } else {
        setError(rpcError.message)
      }
      setSubmitting(false)
      return
    }

    const result = data as OnboardingResult[] | null
    const resolvedStoreId =
      result?.[0]?.store_id ??
      result?.[0]?.created_store_id ??
      result?.[0]?.updated_store_id

    if (!resolvedStoreId) {
      setError('매장 저장 결과를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setSubmitting(false)
      return
    }

    try {
      await syncStoreServices(resolvedStoreId, serviceDrafts)
    } catch (serviceError) {
      setError(
        serviceError instanceof Error
          ? `매장 기본 정보는 저장됐지만 서비스 설정 저장 중 오류가 발생했습니다: ${serviceError.message}`
          : '매장 기본 정보는 저장됐지만 서비스 설정 저장 중 오류가 발생했습니다.'
      )
      setSubmitting(false)
      return
    }

    if (isEditMode) {
      setSuccessMessage('매장 설정과 서비스 가격표가 저장되었습니다.')
      setSubmitting(false)
      router.refresh()
      return
    }

    router.replace('/')
    router.refresh()
  }

  if (isLoading || !formReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111125] text-slate-400">
        <div className="text-sm">매장 설정 정보를 불러오는 중입니다...</div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#111125] px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#0c0c1f] via-transparent to-[#8b4513]/10" />
      <div className="pointer-events-none fixed -left-20 top-20 h-96 w-96 rounded-full bg-[#8b4513]/20 opacity-20 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-20 -right-20 h-96 w-96 rounded-full bg-[#D4A574]/10 opacity-20 blur-3xl" />

      <header className="absolute top-0 z-10 flex w-full justify-center py-6">
        <span className="text-2xl font-bold uppercase tracking-[0.2em] text-[#D4A574]">{DEFAULT_BRAND_NAME}</span>
      </header>

      <main className="relative z-10 w-full max-w-6xl">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
          <section className="rounded-2xl border border-[#54433a]/10 bg-[#333348]/40 p-8 shadow-2xl backdrop-blur-2xl md:p-10">
            <div className="mb-8">
              <div className="mb-5">
                <Link
                  href={backHref}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700/40 bg-[#1a2035] px-4 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-[#D4A574]/40 hover:text-[#D4A574]"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  {backLabel}
                </Link>
              </div>

              <p className="mb-2 text-xs uppercase tracking-[0.35em] text-[#a28c81]">
                {isEditMode ? 'Store Settings' : 'Onboarding'}
              </p>
              <h1 className="text-3xl font-bold text-white">{pageTitle}</h1>
              <p className="mt-3 text-sm leading-7 text-slate-300">{helperText}</p>
              {userEmail && (
                <div className="mt-4 inline-flex rounded-full border border-[#D4A574]/30 bg-[#1a2035] px-4 py-2 text-xs text-[#D4A574]">
                  사용 계정: {userEmail}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-5">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#a28c81]">브랜드 기본값</p>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#a28c81]">
                        매장 이름
                      </label>
                      <input
                        type="text"
                        value={storeNameInput}
                        onChange={e => setStoreNameInput(e.target.value)}
                        required
                        placeholder="예: 강남 1호점"
                        className="w-full rounded-xl border border-slate-700/50 bg-[#0f1117] px-4 py-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-[#D4A574]"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#a28c81]">
                        브랜드명
                      </label>
                      <input
                        type="text"
                        value={brandName}
                        onChange={e => setBrandName(e.target.value)}
                        placeholder="비워두면 매장 이름을 사용합니다"
                        className="w-full rounded-xl border border-slate-700/50 bg-[#0f1117] px-4 py-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-[#D4A574]"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#a28c81]">
                        연락처 접두어
                      </label>
                      <input
                        type="text"
                        value={contactPrefix}
                        onChange={e => setContactPrefix(e.target.value)}
                        placeholder="비워두면 매장 이름을 사용합니다"
                        className="w-full rounded-xl border border-slate-700/50 bg-[#0f1117] px-4 py-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-[#D4A574]"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#a28c81]">
                        직원 명칭
                      </label>
                      <input
                        type="text"
                        value={staffLabel}
                        onChange={e => setStaffLabel(e.target.value)}
                        placeholder="예: 직원, 관리사, 테라피스트"
                        className="w-full rounded-xl border border-slate-700/50 bg-[#0f1117] px-4 py-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-[#D4A574]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#a28c81]">운영 설정</p>
                  <div className="grid gap-5 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#a28c81]">
                        예약 간격
                      </label>
                      <select
                        value={reservationTimeInterval}
                        onChange={e => setReservationTimeInterval(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-700/50 bg-[#0f1117] px-4 py-3 text-sm text-slate-100 outline-none transition-colors focus:border-[#D4A574]"
                      >
                        {RESERVATION_INTERVAL_OPTIONS.map(option => (
                          <option key={option} value={option}>
                            {option}분
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#a28c81]">
                        영업 시작 시간
                      </label>
                      <select
                        value={visitDayStartsAtHour}
                        onChange={e => setVisitDayStartsAtHour(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-700/50 bg-[#0f1117] px-4 py-3 text-sm text-slate-100 outline-none transition-colors focus:border-[#D4A574]"
                      >
                        {START_HOUR_OPTIONS.map(option => (
                          <option key={option} value={option}>
                            {formatHourLabel(option)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#a28c81]">
                        영업 종료 시간
                      </label>
                      <select
                        value={visitDayEndsAtHour}
                        onChange={e => setVisitDayEndsAtHour(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-700/50 bg-[#0f1117] px-4 py-3 text-sm text-slate-100 outline-none transition-colors focus:border-[#D4A574]"
                      >
                        {END_HOUR_OPTIONS.map(option => (
                          <option key={option} value={option}>
                            {formatHourLabel(option)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-800/30 bg-red-900/20 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="rounded-xl border border-emerald-800/30 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-300">
                  {successMessage}
                </div>
              )}

              <div className="flex items-center justify-between gap-4 border-t border-slate-700/30 pt-4">
                <p className="text-xs leading-6 text-slate-500">
                  {isEditMode
                    ? '저장하면 매장 기본 정보와 서비스 가격표가 현재 매장 설정으로 업데이트됩니다.'
                    : '매장 생성과 함께 기본 서비스 가격표까지 한 번에 저장됩니다.'}
                </p>
                <button
                  type="submit"
                  disabled={submitting || !storeNameInput.trim()}
                  className="rounded-xl bg-gradient-to-br from-[#8b4513] to-[#532200] px-6 py-3 text-sm font-semibold text-[#ffc29f] shadow-lg transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (isEditMode ? '설정 저장 중...' : '매장 생성 중...') : submitLabel}
                </button>
              </div>
            </form>
          </section>

          <aside className="rounded-2xl border border-[#54433a]/10 bg-[#1b2030]/70 p-6 shadow-2xl backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#a28c81]">서비스 설정</p>
                <h2 className="text-xl font-bold text-white">직접 수정 가능한 가격표</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  서비스명, 코드, 시간, 앱 가격, 로드 가격, 커미션을 온보딩 화면에서 바로 수정할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={addServiceDraft}
                className="rounded-xl border border-[#D4A574]/40 bg-[#1a2035] px-4 py-2 text-xs font-semibold text-[#D4A574] transition-colors hover:bg-[#222944]"
              >
                서비스 추가
              </button>
            </div>

            <div className="space-y-4">
              {serviceDrafts.map((service, index) => (
                <div key={`${service.code}-${index}`} className="rounded-xl border border-slate-700/30 bg-[#101521] p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{service.label || `서비스 ${index + 1}`}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{service.code || 'CODE'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeServiceDraft(index)}
                      disabled={serviceDrafts.length === 1}
                      className="rounded-lg border border-red-900/30 bg-red-950/30 px-3 py-1.5 text-[11px] font-semibold text-red-300 transition-colors hover:bg-red-900/40 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      삭제
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">서비스명</span>
                      <input
                        type="text"
                        value={service.label}
                        onChange={e => updateServiceDraft(index, 'label', e.target.value)}
                        placeholder="예: 타이 60분"
                        className="w-full rounded-lg border border-slate-700/40 bg-[#171c2a] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-[#D4A574]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">코드</span>
                      <input
                        type="text"
                        value={service.code}
                        onChange={e => updateServiceDraft(index, 'code', e.target.value.toUpperCase())}
                        placeholder="예: T60"
                        className="w-full rounded-lg border border-slate-700/40 bg-[#171c2a] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-[#D4A574]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">소요시간(분)</span>
                      <input
                        type="number"
                        min={5}
                        step={5}
                        value={service.duration}
                        onChange={e => updateServiceDraft(index, 'duration', Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-700/40 bg-[#171c2a] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-[#D4A574]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">커미션</span>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={service.commission}
                        onChange={e => updateServiceDraft(index, 'commission', Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-700/40 bg-[#171c2a] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-[#D4A574]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">앱 기본 가격</span>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={service.appPrice}
                        onChange={e => updateServiceDraft(index, 'appPrice', Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-700/40 bg-[#171c2a] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-[#D4A574]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">로드 가격</span>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={service.roadPrice}
                        onChange={e => updateServiceDraft(index, 'roadPrice', Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-700/40 bg-[#171c2a] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-[#D4A574]"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>

      <footer className="absolute bottom-0 flex w-full flex-col items-center gap-2 px-4 pb-6">
        <p className="text-[10px] uppercase tracking-widest text-[#D4A574]/30">{DEFAULT_PRODUCT_LABEL}</p>
      </footer>
    </div>
  )
}
