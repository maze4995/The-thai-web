'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface StoreContextValue {
  storeId: string | null
  storeName: string | null
  userEmail: string | null
  signOut: () => Promise<void>
}

const StoreContext = createContext<StoreContextValue>({
  storeId: null,
  storeName: null,
  userEmail: null,
  signOut: async () => {},
})

export function useStore() {
  return useContext(StoreContext)
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const loadStore = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserEmail(user.email ?? null)

      const { data } = await supabase
        .from('store_members')
        .select('store_id, stores(name)')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setStoreId(data.store_id)
        const stores = data.stores as unknown as { name: string } | null
        setStoreName(stores?.name ?? null)
      }
    }

    loadStore()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setStoreId(null)
        setStoreName(null)
        setUserEmail(null)
      } else if (event === 'SIGNED_IN') {
        loadStore()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <StoreContext.Provider value={{ storeId, storeName, userEmail, signOut }}>
      {children}
    </StoreContext.Provider>
  )
}
