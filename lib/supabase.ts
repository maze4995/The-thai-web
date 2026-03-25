import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 클라이언트 컴포넌트용 (세션을 쿠키에 저장 → 미들웨어와 동기화)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
