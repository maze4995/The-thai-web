import { DEFAULT_BRAND_NAME } from '@/lib/branding'

export interface StoreSettings {
  brandName: string
  appDisplayName: string
  contactPrefix: string
  locale: string
  timezone: string
  currencyCode: string
  staffLabel: string
  customerLabelTemplate: string
  reservationTimeInterval: number
  visitDayStartsAtHour: number
  visitDayEndsAtHour: number
}

export interface StoreFeatures {
  legacyMode: boolean
  settingsEnabled: boolean
  walletEnabled: boolean
  onboardingEnabled: boolean
  phoneIntegrationEnabled: boolean
  contactSyncEnabled: boolean
  scheduleBoardEnabled: boolean
  worklogEnabled: boolean
}

type StoreSettingsRow = {
  brand_name?: string | null
  app_display_name?: string | null
  contact_prefix?: string | null
  locale?: string | null
  timezone?: string | null
  currency_code?: string | null
  staff_label?: string | null
  customer_label_template?: string | null
  reservation_time_interval?: number | null
  visit_day_starts_at_hour?: number | null
  visit_day_ends_at_hour?: number | null
}

type StoreFeaturesRow = {
  legacy_mode?: boolean | null
  settings_enabled?: boolean | null
  wallet_enabled?: boolean | null
  onboarding_enabled?: boolean | null
  phone_integration_enabled?: boolean | null
  contact_sync_enabled?: boolean | null
  schedule_board_enabled?: boolean | null
  worklog_enabled?: boolean | null
}

export function getDefaultStoreSettings(storeName?: string | null): StoreSettings {
  const fallbackName = storeName?.trim() || DEFAULT_BRAND_NAME

  return {
    brandName: fallbackName,
    appDisplayName: fallbackName,
    contactPrefix: storeName?.trim() || '매장',
    locale: 'ko-KR',
    timezone: 'Asia/Seoul',
    currencyCode: 'KRW',
    staffLabel: '관리사',
    customerLabelTemplate:
      '{prefix}-{grade}-{source}{special}{memo}({day})({night}){phone_last4}',
    reservationTimeInterval: 30,
    visitDayStartsAtHour: 6,
    visitDayEndsAtHour: 18,
  }
}

export function getDefaultStoreFeatures(): StoreFeatures {
  return {
    legacyMode: true,
    settingsEnabled: false,
    walletEnabled: false,
    onboardingEnabled: false,
    phoneIntegrationEnabled: true,
    contactSyncEnabled: true,
    scheduleBoardEnabled: true,
    worklogEnabled: true,
  }
}

export function normalizeStoreSettings(
  row: StoreSettingsRow | null | undefined,
  storeName?: string | null
): StoreSettings {
  const defaults = getDefaultStoreSettings(storeName)

  return {
    brandName: row?.brand_name?.trim() || defaults.brandName,
    appDisplayName: row?.app_display_name?.trim() || defaults.appDisplayName,
    contactPrefix: row?.contact_prefix?.trim() || defaults.contactPrefix,
    locale: row?.locale?.trim() || defaults.locale,
    timezone: row?.timezone?.trim() || defaults.timezone,
    currencyCode: row?.currency_code?.trim() || defaults.currencyCode,
    staffLabel: row?.staff_label?.trim() || defaults.staffLabel,
    customerLabelTemplate:
      row?.customer_label_template?.trim() || defaults.customerLabelTemplate,
    reservationTimeInterval:
      row?.reservation_time_interval ?? defaults.reservationTimeInterval,
    visitDayStartsAtHour:
      row?.visit_day_starts_at_hour ?? defaults.visitDayStartsAtHour,
    visitDayEndsAtHour:
      row?.visit_day_ends_at_hour ?? defaults.visitDayEndsAtHour,
  }
}

export function normalizeStoreFeatures(
  row: StoreFeaturesRow | null | undefined
): StoreFeatures {
  const defaults = getDefaultStoreFeatures()

  return {
    legacyMode: row?.legacy_mode ?? defaults.legacyMode,
    settingsEnabled: row?.settings_enabled ?? defaults.settingsEnabled,
    walletEnabled: row?.wallet_enabled ?? defaults.walletEnabled,
    onboardingEnabled: row?.onboarding_enabled ?? defaults.onboardingEnabled,
    phoneIntegrationEnabled:
      row?.phone_integration_enabled ?? defaults.phoneIntegrationEnabled,
    contactSyncEnabled:
      row?.contact_sync_enabled ?? defaults.contactSyncEnabled,
    scheduleBoardEnabled:
      row?.schedule_board_enabled ?? defaults.scheduleBoardEnabled,
    worklogEnabled: row?.worklog_enabled ?? defaults.worklogEnabled,
  }
}
