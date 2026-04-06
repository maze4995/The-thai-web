'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SERVICES, type ServiceOption } from '@/lib/utils'

export interface StoreServiceOption {
  id?: string
  code: string
  label: string
  duration: number
  commission: number
  defaultPrice: number
  memberPrices: Record<string, number>
  sortOrder: number
}

interface ServiceCatalogRow {
  id: string
  code: string
  name: string
  duration_min: number | null
  sort_order: number | null
  metadata: Record<string, unknown> | null
}

interface ServicePriceRow {
  service_id: string
  lookup_item_id: string | null
  amount: number
}

interface LookupItemRow {
  id: string
  code: string
}

const FALLBACK_SERVICE_MAP = new Map(SERVICES.map(service => [service.name, service]))

function toFallbackOption(service: ServiceOption, index: number): StoreServiceOption {
  return {
    code: service.name,
    label: service.label,
    duration: service.duration,
    commission: service.commission,
    defaultPrice: service.price,
    memberPrices: {
      app_member: service.price,
    },
    sortOrder: index,
  }
}

export function getFallbackServices(): StoreServiceOption[] {
  return SERVICES.map(toFallbackOption)
}

function getFallbackService(code: string): StoreServiceOption | null {
  const service = FALLBACK_SERVICE_MAP.get(code)
  if (!service) return null
  return toFallbackOption(service, 0)
}

function normalizeServiceOptions(
  catalogRows: ServiceCatalogRow[],
  priceRows: ServicePriceRow[],
  lookupItems: LookupItemRow[]
): StoreServiceOption[] {
  const lookupCodeById = new Map(lookupItems.map(item => [item.id, item.code]))

  return catalogRows.map((row, index) => {
    const fallback = getFallbackService(row.code)
    const rawCommission = row.metadata && typeof row.metadata.commission === 'number'
      ? row.metadata.commission
      : fallback?.commission

    const memberPrices = priceRows
      .filter(price => price.service_id === row.id)
      .reduce<Record<string, number>>((acc, price) => {
        const lookupCode = price.lookup_item_id ? lookupCodeById.get(price.lookup_item_id) : null
        if (lookupCode) {
          acc[lookupCode] = price.amount
        }
        return acc
      }, {})

    const defaultPrice =
      memberPrices.app_member ??
      memberPrices.default ??
      fallback?.defaultPrice ??
      0

    return {
      id: row.id,
      code: row.code,
      label: row.name,
      duration: row.duration_min ?? fallback?.duration ?? 60,
      commission: rawCommission ?? 0,
      defaultPrice,
      memberPrices,
      sortOrder: row.sort_order ?? index,
    }
  })
}

export function resolveServicePrice(
  serviceCode: string,
  customerName: string,
  serviceOptions: StoreServiceOption[]
): number {
  const matched = serviceOptions.find(option => option.code === serviceCode)
  if (!matched) {
    return getFallbackService(serviceCode)?.defaultPrice ?? 0
  }

  if (customerName.includes('로드')) {
    return matched.memberPrices.road_member ?? matched.defaultPrice
  }

  return matched.memberPrices.app_member ?? matched.defaultPrice
}

export function resolveServiceDuration(
  serviceCode: string,
  serviceOptions: StoreServiceOption[]
): number {
  const matched = serviceOptions.find(option => option.code === serviceCode)
  if (matched) return matched.duration
  return getFallbackService(serviceCode)?.duration ?? 60
}

export function resolveServiceCommission(
  serviceCode: string,
  serviceOptions: StoreServiceOption[]
): number {
  const matched = serviceOptions.find(option => option.code === serviceCode)
  if (matched) return matched.commission
  return getFallbackService(serviceCode)?.commission ?? 0
}

export function useStoreServices(storeId: string | null) {
  const [serviceOptions, setServiceOptions] = useState<StoreServiceOption[]>(getFallbackServices())
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const loadServices = async () => {
      if (!storeId) {
        setServiceOptions(getFallbackServices())
        return
      }

      setIsLoading(true)

      const [catalogRes, priceRes, lookupRes] = await Promise.allSettled([
        supabase
          .from('service_catalog')
          .select('id, code, name, duration_min, sort_order, metadata')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('sort_order')
          .order('name'),
        supabase
          .from('service_prices')
          .select('service_id, lookup_item_id, amount')
          .eq('store_id', storeId)
          .eq('is_active', true),
        supabase
          .from('lookup_items')
          .select('id, code')
          .eq('store_id', storeId),
      ])

      const catalogRows = catalogRes.status === 'fulfilled' ? (catalogRes.value.data as ServiceCatalogRow[] | null) : null
      const priceRows = priceRes.status === 'fulfilled' ? (priceRes.value.data as ServicePriceRow[] | null) : null
      const lookupRows = lookupRes.status === 'fulfilled' ? (lookupRes.value.data as LookupItemRow[] | null) : null

      if (!catalogRows || catalogRows.length === 0) {
        setServiceOptions(getFallbackServices())
        setIsLoading(false)
        return
      }

      setServiceOptions(normalizeServiceOptions(catalogRows, priceRows ?? [], lookupRows ?? []))
      setIsLoading(false)
    }

    loadServices()
  }, [storeId])

  const servicesByCode = useMemo(
    () => new Map(serviceOptions.map(service => [service.code, service])),
    [serviceOptions]
  )

  return {
    serviceOptions,
    servicesByCode,
    isLoading,
  }
}
