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

  // Load saved preferences and check auto-login session
  useEffect(() => {
    const savedRemember = localStorage.getItem(STORAGE_REMEMBER_KEY) === 'true'
    const savedAuto = localStorage.getItem(STORAGE_AUTO_KEY) === 'true'
    setRememberEmail(savedRemember)
    setAutoLogin(savedAuto)
    if (savedRemember) {
      setEmail(localStorage.getItem(STORAGE_EMAIL_KEY) ?? '')
    }

    // Auto-login: if preference is set and session exists, redirect
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

    // Save preferences
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-sm">자동 로그인 확인 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#161b27] border border-slate-700 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-xl font-bold text-emerald-400 text-center mb-1">조판지</h1>
        <p className="text-xs text-slate-500 text-center mb-8">매장 관리 시스템</p>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="example@email.com"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={e => setRememberEmail(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500"
              />
              <span className="text-xs text-slate-400">아이디 저장</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoLogin}
                onChange={e => setAutoLogin(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500"
              />
              <span className="text-xs text-slate-400">자동 로그인</span>
            </label>
          </div>

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
