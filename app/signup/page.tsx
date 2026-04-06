'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DEFAULT_BRAND_NAME, DEFAULT_PRODUCT_LABEL } from '@/lib/branding'

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const emailError = useMemo(() => {
    if (!email) return ''
    if (!isValidEmail(email)) return '올바른 이메일 형식으로 입력해주세요.'
    return ''
  }, [email])

  const passwordError = useMemo(() => {
    if (!password) return ''
    if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.'
    return ''
  }, [password])

  const confirmError = useMemo(() => {
    if (!confirmPassword) return ''
    if (password !== confirmPassword) return '비밀번호 확인이 일치하지 않습니다.'
    return ''
  }, [confirmPassword, password])

  const canSubmit =
    isValidEmail(email) &&
    password.length >= 8 &&
    confirmPassword.length >= 8 &&
    password === confirmPassword &&
    !loading

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    if (!isValidEmail(email)) {
      setError('이메일 형식을 다시 확인해주세요.')
      return
    }

    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }

    if (password !== confirmPassword) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      return
    }

    setLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/onboarding` : undefined,
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      if (data.session?.user) {
        router.replace('/onboarding')
        return
      }

      setSuccessMessage('가입 확인 메일을 보냈습니다. 메일 인증 후 로그인하면 온보딩을 진행할 수 있습니다.')
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : '회원가입 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#111125]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#0c0c1f] via-transparent to-[#8b4513]/10" />
      <div className="pointer-events-none fixed -left-20 top-20 h-96 w-96 rounded-full bg-[#8b4513]/20 opacity-20 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-20 -right-20 h-96 w-96 rounded-full bg-[#D4A574]/10 opacity-20 blur-3xl" />

      <header className="absolute top-0 z-10 flex w-full justify-center py-6">
        <span className="text-2xl font-bold uppercase tracking-[0.2em] text-[#D4A574]">{DEFAULT_BRAND_NAME}</span>
      </header>

      <main className="relative z-10 w-full max-w-md px-6">
        <div className="flex flex-col gap-8 rounded-xl border border-[#54433a]/10 bg-[#333348]/40 p-8 shadow-2xl backdrop-blur-2xl md:p-12">
          <div className="space-y-2 text-center">
            <h1 className="text-4xl tracking-tight text-[#D4A574]" style={{ fontFamily: "'Noto Serif', serif" }}>
              회원가입
            </h1>
            <p className="text-xs font-light uppercase tracking-widest text-[#a28c81]">New Store Onboarding</p>
          </div>

          <form onSubmit={handleSignup} noValidate className="space-y-6">
            <div className="group">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#a28c81] transition-colors group-focus-within:text-[#D4A574]">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value.trim())}
                autoComplete="email"
                placeholder="example@email.com"
                className="w-full border-0 border-b border-[#54433a] bg-transparent py-3 text-[#e2e0fc] outline-none transition-all placeholder:text-[#54433a]/60 focus:border-[#D4A574]"
              />
              {emailError && <p className="mt-2 text-xs text-amber-300">{emailError}</p>}
            </div>

            <div className="group">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#a28c81] transition-colors group-focus-within:text-[#D4A574]">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="8자 이상 입력"
                className="w-full border-0 border-b border-[#54433a] bg-transparent py-3 text-[#e2e0fc] outline-none transition-all placeholder:text-[#54433a]/60 focus:border-[#D4A574]"
              />
              {passwordError && <p className="mt-2 text-xs text-amber-300">{passwordError}</p>}
            </div>

            <div className="group">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#a28c81] transition-colors group-focus-within:text-[#D4A574]">
                비밀번호 확인
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="비밀번호 다시 입력"
                className="w-full border-0 border-b border-[#54433a] bg-transparent py-3 text-[#e2e0fc] outline-none transition-all placeholder:text-[#54433a]/60 focus:border-[#D4A574]"
              />
              {confirmError && <p className="mt-2 text-xs text-amber-300">{confirmError}</p>}
            </div>

            {error && (
              <p className="rounded-lg border border-red-800/30 bg-red-900/20 py-2 text-center text-xs text-red-400">
                {error}
              </p>
            )}

            {successMessage && (
              <p className="rounded-lg border border-emerald-800/30 bg-emerald-900/20 py-2 text-center text-xs text-emerald-300">
                {successMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-3 rounded-lg bg-gradient-to-br from-[#8b4513] to-[#532200] px-6 py-4 font-semibold tracking-wide text-[#ffc29f] shadow-lg transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-lg" style={{ fontFamily: "'Noto Serif', serif" }}>
                {loading ? '가입 중...' : '가입하고 시작하기'}
              </span>
            </button>

            {!canSubmit && !loading && (
              <p className="text-center text-xs text-slate-400">
                이메일, 비밀번호 8자 이상, 비밀번호 확인까지 입력하면 버튼이 활성화됩니다.
              </p>
            )}
          </form>

          <div className="text-center text-xs text-[#a28c81]">
            이미 계정이 있다면{' '}
            <Link href="/login" className="font-semibold text-[#D4A574] transition-colors hover:text-[#f1c28d]">
              로그인
            </Link>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4 text-[10px] uppercase tracking-[0.2em] text-[#a28c81]/40">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Onboarding Ready</span>
          </div>
        </div>
      </main>

      <footer className="absolute bottom-0 flex w-full flex-col items-center gap-2 px-4 pb-6">
        <p className="text-[10px] uppercase tracking-widest text-[#D4A574]/30">{DEFAULT_PRODUCT_LABEL}</p>
      </footer>
    </div>
  )
}
