'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { DEFAULT_PRODUCT_LABEL } from '@/lib/branding';

interface SidebarProps {
  storeName: string;
  staffLabel: string;
  worklogEnabled: boolean;
  onSignOut: () => void;
}

export default function Sidebar({
  storeName,
  staffLabel,
  worklogEnabled,
  onSignOut,
}: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = useMemo(
    () =>
      [
        {
          href: '/',
          label: '조판지',
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          ),
        },
        {
          href: '/therapists',
          label: staffLabel,
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          ),
        },
        {
          href: '/stats',
          label: '통계',
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          ),
        },
        worklogEnabled
          ? {
              href: '/worklog',
              label: '업무일지',
              icon: (
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              ),
            }
          : null,
        {
          href: '/guide',
          label: '가이드',
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
        },
        {
          href: '/onboarding',
          label: '매장 설정',
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          ),
        },
      ].filter(Boolean) as Array<{ href: string; label: string; icon: React.ReactNode }>,
    [staffLabel, worklogEnabled]
  );

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="min-h-screen flex flex-col transition-all duration-300 relative shrink-0"
      style={{ backgroundColor: '#1a1a2e', width: collapsed ? 60 : 200 }}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-5 w-6 h-6 rounded-full bg-[#2a2a4e] border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#3a3a5e] transition-colors z-20"
      >
        <svg
          className={`w-3 h-3 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className={`py-6 ${collapsed ? 'px-0 flex justify-center' : 'px-5'}`}>
        {collapsed ? (
          <span className="text-[#D4A574] text-lg font-bold">
            {storeName.charAt(0).toUpperCase()}
          </span>
        ) : (
          <>
            <h1 className="text-white text-xl font-bold tracking-wide truncate">{storeName}</h1>
            <p className="text-gray-400 text-xs mt-1">{DEFAULT_PRODUCT_LABEL}</p>
          </>
        )}
      </div>

      <nav className="flex-1 mt-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 py-3 text-sm transition-colors relative ${
                    collapsed ? 'justify-center px-0' : 'px-5'
                  } ${
                    active
                      ? 'text-[#D4A574] font-medium'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#D4A574] rounded-r" />
                  )}
                  {item.icon}
                  {!collapsed && item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={`py-4 border-t border-white/10 ${
          collapsed ? 'px-0 flex flex-col items-center gap-2' : 'px-5'
        }`}
      >
        {!collapsed && storeName && (
          <p className="text-gray-400 text-xs mb-3 truncate">{storeName}</p>
        )}
        <button
          onClick={onSignOut}
          title={collapsed ? '로그아웃' : undefined}
          className={`flex items-center gap-2 text-gray-400 hover:text-gray-200 text-sm transition-colors ${
            collapsed ? 'justify-center w-full' : 'w-full'
          }`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          {!collapsed && '로그아웃'}
        </button>
      </div>
    </aside>
  );
}
