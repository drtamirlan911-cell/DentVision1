/** Client-side image → data URL for profile/staff avatars (no object storage yet). */

import i18n from '@/lib/i18n';
const t = (key: string, fallback: string) => {
  try { const v = i18n.t(key); return v && v !== key ? v : fallback; } catch { return fallback; }
};

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

export const PROFILE_PHOTO_ACCEPT = ACCEPT

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error(t('upload.read_error', 'Не удалось прочитать файл')))
    reader.readAsDataURL(file)
  })
}

export async function readImageAsDataUrl(file: File | null | undefined): Promise<string> {
  if (!file) throw new Error(t('upload.no_file', 'Файл не выбран'))
  if (!file.type.startsWith('image/')) {
    throw new Error(t('upload.invalid_type', 'Выберите изображение (JPG, PNG, WEBP)'))
  }
  if (file.size > MAX_BYTES) {
    throw new Error(t('upload.too_large', 'Файл больше 5 МБ — сожмите фото и попробуйте снова'))
  }
  return fileToDataUrl(file)
}
