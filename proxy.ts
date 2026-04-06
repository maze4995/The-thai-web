import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const AUTH_ROUTES = new Set(['/login', '/signup'])
const ONBOARDING_ROUTE = '/onboarding'

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
  const isOnboardingRoute = pathname === ONBOARDING_ROUTE

  if (!user) {
    if (isAuthRoute) {
      return supabaseResponse
    }

    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: membership } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const hasStoreMembership = Boolean(membership?.store_id)

  if (!hasStoreMembership && !isOnboardingRoute) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  if (hasStoreMembership && isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
