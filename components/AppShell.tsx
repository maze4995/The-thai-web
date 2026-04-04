'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import { useStore } from './StoreProvider'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { storeName, signOut } = useStore()

  // 로그인 페이지는 사이드바 없이 표시
  if (pathname === '/login') {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-[#0f1117] text-slate-200">
      <Sidebar storeName={storeName ?? 'The Thai'} onSignOut={signOut} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
