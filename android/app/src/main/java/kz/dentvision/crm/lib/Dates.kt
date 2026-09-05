package kz.dentvision.crm.lib

/**
 * Дата для показа: «17.08.2026» — тот же день-первый формат, что веб строит
 * в `src/lib/utils.ts`'s `fd()` (`${day}.${m}.${y}` из ISO-строки). Раньше
 * экраны резали ISO-строку через `.take(10)`, получая «2026-08-17» —
 * год-первый формат, которого нигде на вебе нет.
 */
fun formatDate(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    val datePart = iso.substringBefore('T')
    val parts = datePart.split('-')
    if (parts.size != 3) return null
    val (year, month, day) = parts
    return "$day.$month.$year"
}
