/** True when pay method is online Kaspi / QR (not installment). */
export function isOnlineQrMethod(method?: string | null): boolean {
  if (!method) return false
  const v = String(method).toLowerCase()
  return (v.includes('qr') || v.includes('kaspi')) && !v.includes('рассроч')
}
