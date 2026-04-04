'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const STORAGE_EMAIL_KEY = 'login_saved_email'
const STORAGE_REMEMBER_KEY = 'login_remember_email'
const STORAGE_AUTO_KEY = 'login_auto_login'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberEmail, setRememberEmail] = useState(false)
  const [autoLogin, setAutoLogin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const savedRemember = localStorage.getItem(STORAGE_REMEMBER_KEY) === 'true'
    const savedAuto = localStorage.getItem(STORAGE_AUTO_KEY) === 'true'
    setRememberEmail(savedRemember)
    setAutoLogin(savedAuto)
    if (savedRemember) {
      setEmail(localStorage.getItem(STORAGE_EMAIL_KEY) ?? '')
    }

    if (savedAuto) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          router.replace('/')
        } else {
          setChecking(false)
        }
      })
    } else {
      setChecking(false)
    }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }

    localStorage.setItem(STORAGE_REMEMBER_KEY, String(rememberEmail))
    localStorage.setItem(STORAGE_AUTO_KEY, String(autoLogin))
    if (rememberEmail) {
      localStorage.setItem(STORAGE_EMAIL_KEY, email)
    } else {
      localStorage.removeItem(STORAGE_EMAIL_KEY)
    }

    router.push('/')
    router.refresh()
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#111125] flex items-center justify-center">
        <div className="text-slate-500 text-sm">자동 로그인 확인 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#111125] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#0c0c1f] via-transparent to-[#8b4513]/10 pointer-events-none" />
      <div className="fixed top-20 -left-20 w-96 h-96 opacity-20 blur-3xl rounded-full bg-[#8b4513]/20 pointer-events-none" />
      <div className="fixed -bottom-20 -right-20 w-96 h-96 opacity-20 blur-3xl rounded-full bg-[#D4A574]/10 pointer-events-none" />

      {/* Top brand */}
      <header className="absolute top-0 w-full flex justify-center py-6 z-10">
        <span className="text-2xl text-[#D4A574] tracking-[0.2em] uppercase font-bold">The Thai</span>
      </header>

      {/* Login Card */}
      <main className="relative z-10 w-full max-w-md px-6">
        <div className="bg-[#333348]/40 backdrop-blur-2xl p-8 md:p-12 rounded-xl shadow-2xl border border-[#54433a]/10 flex flex-col gap-8">
          {/* Branding */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-normal text-[#D4A574] tracking-tight" style={{ fontFamily: "'Noto Serif', serif" }}>
              더 타이
            </h1>
            <p className="text-[#a28c81] font-light tracking-widest text-xs uppercase">Management Portal</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email */}
            <div className="group">
              <label className="block text-xs font-semibold uppercase tracking-widest text-[#a28c81] mb-2 group-focus-within:text-[#D4A574] transition-colors">
                이메일
              </label>
              <div className="relative">
                <svg className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#54433a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="example@email.com"
                  className="w-full bg-transparent border-0 border-b border-[#54433a] py-3 pl-8 text-[#e2e0fc] focus:ring-0 focus:border-[#D4A574] placeholder:text-[#54433a]/60 transition-all outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div className="group">
              <label className="block text-xs font-semibold uppercase tracking-widest text-[#a28c81] mb-2 group-focus-within:text-[#D4A574] transition-colors">
                비밀번호
              </label>
              <div className="relative">
                <svg className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#54433a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-transparent border-0 border-b border-[#54433a] py-3 pl-8 text-[#e2e0fc] focus:ring-0 focus:border-[#D4A574] placeholder:text-[#54433a]/60 transition-all outline-none"
                />
              </div>
            </div>

            {/* Remember & Auto-login */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={e => setRememberEmail(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-[#1e1e32] rounded-full peer-checked:bg-[#D4A574]/20 transition-colors" />
                  <div className="absolute left-1 top-1 w-3 h-3 bg-[#a28c81] rounded-full peer-checked:translate-x-5 peer-checked:bg-[#D4A574] transition-transform" />
                </div>
                <span className="text-[#a28c81] group-hover:text-[#e2e0fc] transition-colors text-xs">아이디 저장</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={autoLogin}
                    onChange={e => setAutoLogin(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-[#1e1e32] rounded-full peer-checked:bg-[#D4A574]/20 transition-colors" />
                  <div className="absolute left-1 top-1 w-3 h-3 bg-[#a28c81] rounded-full peer-checked:translate-x-5 peer-checked:bg-[#D4A574] transition-transform" />
                </div>
                <span className="text-[#a28c81] group-hover:text-[#e2e0fc] transition-colors text-xs">자동 로그인</span>
              </label>
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-400 text-center bg-red-900/20 border border-red-800/30 rounded-lg py-2">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 rounded-lg bg-gradient-to-br from-[#8b4513] to-[#532200] text-[#ffc29f] font-semibold tracking-wide flex items-center justify-center gap-3 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <span className="text-lg" style={{ fontFamily: "'Noto Serif', serif" }}>
                {loading ? '로그인 중...' : '로그인'}
              </span>
              {!loading && (
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </button>
          </form>
        </div>

        {/* Status indicator */}
        <div className="mt-8 flex items-center justify-center gap-4 text-[10px] uppercase tracking-[0.2em] text-[#a28c81]/40">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>System Online</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-0 w-full flex flex-col items-center gap-2 pb-6 px-4">
        <p className="text-[10px] text-[#D4A574]/30 tracking-widest uppercase">The Thai Management System</p>
      </footer>
    </div>
  )
}
