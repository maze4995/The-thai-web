'use client'

import { supabase } from '@/lib/supabase'

export interface EditableServiceSetting {
  code: string
  label: string
  duration: number
  appPrice: number
  roadPrice: number
  commission: number
}

interface ServiceCatalogRecord {
  id: string
  code: string
}

interface LookupItemRecord {
  id: string
  code: string
}

export async function syncStoreServices(
  storeId: string,
  services: EditableServiceSetting[]
) {
  const sanitizedServices = services
    .map(service => ({
      code: service.code.trim().toUpperCase(),
      label: service.label.trim(),
      duration: Math.max(5, service.duration),
      appPrice: Math.max(0, service.appPrice),
      roadPrice: Math.max(0, service.roadPrice),
      commission: Math.max(0, service.commission),
    }))
    .filter(service => service.code && service.label)

  if (sanitizedServices.length === 0) {
    throw new Error('최소 1개 이상의 서비스를 입력해 주세요.')
  }

  const { data: existingCatalog, error: existingCatalogError } = await supabase
    .from('service_catalog')
    .select('id, code')
    .eq('store_id', storeId)

  if (existingCatalogError) {
    throw existingCatalogError
  }

  const existingCodes = new Set((existingCatalog ?? []).map(item => item.code))
  const nextCodes = new Set(sanitizedServices.map(item => item.code))
  const codesToDeactivate = [...existingCodes].filter(code => !nextCodes.has(code))

  if (codesToDeactivate.length > 0) {
    const { error: deactivateError } = await supabase
      .from('service_catalog')
      .update({ is_active: false })
      .eq('store_id', storeId)
      .in('code', codesToDeactivate)

    if (deactivateError) {
      throw deactivateError
    }
  }

  const catalogPayload = sanitizedServices.map((service, index) => ({
    store_id: storeId,
    code: service.code,
    name: service.label,
    duration_min: service.duration,
    sort_order: index * 10,
    is_active: true,
    metadata: { commission: service.commission },
  }))

  const { error: catalogError } = await supabase
    .from('service_catalog')
    .upsert(catalogPayload, { onConflict: 'store_id,code' })

  if (catalogError) {
    throw catalogError
  }

  const { data: catalogRows, error: catalogFetchError } = await supabase
    .from('service_catalog')
    .select('id, code')
    .eq('store_id', storeId)
    .in('code', sanitizedServices.map(service => service.code))

  if (catalogFetchError) {
    throw catalogFetchError
  }

  const serviceIdByCode = new Map(
    ((catalogRows ?? []) as ServiceCatalogRecord[]).map(item => [item.code, item.id])
  )

  const { data: memberTypeGroup, error: memberTypeGroupError } = await supabase
    .from('lookup_groups')
    .select('id')
    .eq('store_id', storeId)
    .eq('code', 'member_type')
    .maybeSingle()

  if (memberTypeGroupError) {
    throw memberTypeGroupError
  }

  const memberTypeGroupId = memberTypeGroup?.id
  if (!memberTypeGroupId) {
    throw new Error('member_type lookup group을 찾지 못했습니다.')
  }

  const { data: memberTypeItems, error: memberTypeItemsError } = await supabase
    .from('lookup_items')
    .select('id, code')
    .eq('store_id', storeId)
    .eq('group_id', memberTypeGroupId)
    .in('code', ['app_member', 'road_member'])

  if (memberTypeItemsError) {
    throw memberTypeItemsError
  }

  const memberTypeIdByCode = new Map(
    ((memberTypeItems ?? []) as LookupItemRecord[]).map(item => [item.code, item.id])
  )

  const serviceIds = [...serviceIdByCode.values()]
  if (serviceIds.length > 0) {
    const { error: deletePricesError } = await supabase
      .from('service_prices')
      .delete()
      .eq('store_id', storeId)
      .eq('price_type', 'member_type')
      .in('service_id', serviceIds)

    if (deletePricesError) {
      throw deletePricesError
    }
  }

  const appMemberId = memberTypeIdByCode.get('app_member')
  const roadMemberId = memberTypeIdByCode.get('road_member')

  if (!appMemberId || !roadMemberId) {
    throw new Error('회원 유형 lookup item을 찾지 못했습니다.')
  }

  const pricePayload = sanitizedServices.flatMap((service, index) => {
    const serviceId = serviceIdByCode.get(service.code)
    if (!serviceId) return []

    return [
      {
        store_id: storeId,
        service_id: serviceId,
        lookup_item_id: appMemberId,
        price_type: 'member_type',
        amount: service.appPrice,
        currency_code: 'KRW',
        display_order: index * 10 + 1,
        is_active: true,
      },
      {
        store_id: storeId,
        service_id: serviceId,
        lookup_item_id: roadMemberId,
        price_type: 'member_type',
        amount: service.roadPrice,
        currency_code: 'KRW',
        display_order: index * 10 + 2,
        is_active: true,
      },
    ]
  })

  const { error: priceInsertError } = await supabase
    .from('service_prices')
    .insert(pricePayload)

  if (priceInsertError) {
    throw priceInsertError
  }
}
