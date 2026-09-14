import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const AUTH_ROUTES = new Set(['/login', '/signup'])

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const user = session?.user ?? null
  const pathname = request.nextUrl.pathname
  const isAuthRoute = AUTH_ROUTES.has(pathname)

  if (!user) {
    if (isAuthRoute) {
      return supabaseResponse
    }

    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 매장 소속 확인은 여기서 하지 않는다.
  // 요청마다 store_members를 조회하면 페이지 전환할 때마다 DB 왕복이 한 번씩 더 생긴다.
  // 소속이 없는 사용자는 각 페이지(app/page.tsx, app/stats/page.tsx)에서
  // /onboarding 으로 보내므로 로그인 직후 경로에서 동일하게 처리된다.
  if (isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    {
      // 정적 자산(.svg, 폰트 등)은 인증 검사가 필요 없고,
      // <Link> 프리페치는 사용자가 실제로 이동하지 않아도 발생하므로 둘 다 제외한다.
      source:
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf|css|js|map)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
