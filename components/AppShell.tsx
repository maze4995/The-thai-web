'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import { useStore } from './StoreProvider'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { brandName, settings, features, signOut, userEmail, storeId, isLoading } = useStore()
  const isAuthPage = pathname === '/login' || pathname === '/signup'
  const isOnboardingPage = pathname === '/onboarding'

  useEffect(() => {
    if (isLoading) return

    if (!userEmail && !isAuthPage) {
      router.replace('/login')
      return
    }

    if (userEmail && !storeId && !isOnboardingPage) {
      router.replace('/onboarding')
      return
    }

    if (userEmail && storeId && isAuthPage) {
      router.replace('/')
    }
  }, [isAuthPage, isLoading, isOnboardingPage, router, storeId, userEmail])

  if (isAuthPage || isOnboardingPage) {
    return <>{children}</>
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f1117] text-slate-400">
        <div className="text-sm">계정 정보를 확인하는 중입니다...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#0f1117] text-slate-200">
      <Sidebar
        storeName={brandName}
        staffLabel={settings.staffLabel}
        worklogEnabled={features.worklogEnabled}
        onSignOut={signOut}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
