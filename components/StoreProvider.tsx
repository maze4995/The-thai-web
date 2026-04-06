'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  StoreFeatures,
  StoreSettings,
  getDefaultStoreFeatures,
  getDefaultStoreSettings,
  normalizeStoreFeatures,
  normalizeStoreSettings,
} from '@/lib/store-config'

interface StoreContextValue {
  storeId: string | null
  storeName: string | null
  brandName: string
  userEmail: string | null
  isLoading: boolean
  authNotice: 'expired' | null
  settings: StoreSettings
  features: StoreFeatures
  signOut: () => Promise<void>
}

interface StoreMemberRow {
  store_id: string
  stores: { name: string } | null
}

const StoreContext = createContext<StoreContextValue>({
  storeId: null,
  storeName: null,
  brandName: getDefaultStoreSettings().brandName,
  userEmail: null,
  isLoading: true,
  authNotice: null,
  settings: getDefaultStoreSettings(),
  features: getDefaultStoreFeatures(),
  signOut: async () => {},
})

export function useStore() {
  return useContext(StoreContext)
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authNotice, setAuthNotice] = useState<'expired' | null>(null)
  const [settings, setSettings] = useState<StoreSettings>(getDefaultStoreSettings())
  const [features, setFeatures] = useState<StoreFeatures>(getDefaultStoreFeatures())
  const loadingRef = useRef(false)
  const lastUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    const loadStore = async () => {
      if (loadingRef.current) return
      loadingRef.current = true
      setIsLoading(true)

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const user = session?.user ?? null

        if (!user) {
          if (lastUserIdRef.current) {
            setAuthNotice('expired')
          }
          setStoreId(null)
          setStoreName(null)
          setUserEmail(null)
          setSettings(getDefaultStoreSettings())
          setFeatures(getDefaultStoreFeatures())
          setIsLoading(false)
          return
        }

        lastUserIdRef.current = user.id
        setUserEmail(user.email ?? null)
        setAuthNotice(null)

        const { data } = await supabase
          .from('store_members')
          .select('store_id, stores(name)')
          .eq('user_id', user.id)
          .limit(1)
        const membership = (data?.[0] ?? null) as StoreMemberRow | null

        if (membership) {
          const stores = membership.stores
          const nextStoreName = stores?.name ?? null
          const nextStoreId = membership.store_id

          setStoreId(nextStoreId)
          setStoreName(nextStoreName)

          const [settingsRes, featuresRes] = await Promise.allSettled([
            supabase
              .from('store_settings')
              .select(`
                brand_name,
                app_display_name,
                contact_prefix,
                locale,
                timezone,
                currency_code,
                staff_label,
                customer_label_template,
                reservation_time_interval,
                visit_day_starts_at_hour,
                visit_day_ends_at_hour
              `)
              .eq('store_id', nextStoreId)
              .maybeSingle(),
            supabase
              .from('store_features')
              .select(`
                legacy_mode,
                settings_enabled,
                wallet_enabled,
                onboarding_enabled,
                phone_integration_enabled,
                contact_sync_enabled,
                schedule_board_enabled,
                worklog_enabled
              `)
              .eq('store_id', nextStoreId)
              .maybeSingle(),
          ])

          const settingsRow =
            settingsRes.status === 'fulfilled' ? settingsRes.value.data : null
          const featuresRow =
            featuresRes.status === 'fulfilled' ? featuresRes.value.data : null

          setSettings(normalizeStoreSettings(settingsRow, nextStoreName))
          setFeatures(normalizeStoreFeatures(featuresRow))
        } else {
          setStoreId(null)
          setStoreName(null)
          setUserEmail(user.email ?? null)
          setSettings(getDefaultStoreSettings())
          setFeatures(getDefaultStoreFeatures())
        }
      } finally {
        setIsLoading(false)
        loadingRef.current = false
      }
    }

    loadStore()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setStoreId(null)
        setStoreName(null)
        setUserEmail(null)
        setAuthNotice(null)
        setSettings(getDefaultStoreSettings())
        setFeatures(getDefaultStoreFeatures())
        setIsLoading(false)
        lastUserIdRef.current = null
      } else if (event === 'SIGNED_IN') {
        setAuthNotice(null)
        loadStore()
      } else if (event === 'TOKEN_REFRESHED') {
        const nextUserId = session?.user?.id ?? null
        if (nextUserId && nextUserId !== lastUserIdRef.current) {
          setAuthNotice(null)
          loadStore()
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <StoreContext.Provider
      value={{
        storeId,
        storeName,
        brandName: settings.brandName,
        userEmail,
        isLoading,
        authNotice,
        settings,
        features,
        signOut,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}
