const fallbackBrandName = 'The Thai'

export const DEFAULT_BRAND_NAME =
  process.env.NEXT_PUBLIC_APP_BRAND?.trim() || fallbackBrandName

export const DEFAULT_PRODUCT_LABEL = `${DEFAULT_BRAND_NAME} Management System`

export function resolveBrandName(storeName?: string | null) {
  return storeName?.trim() || DEFAULT_BRAND_NAME
}
