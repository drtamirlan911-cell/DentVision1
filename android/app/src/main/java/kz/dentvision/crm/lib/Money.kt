package kz.dentvision.crm.lib

import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

/**
 * Тенге для показа: «12 500 ₸», с неразрывным пробелом между разрядами, чтобы
 * сумма не переносилась посреди числа.
 *
 * Дробной части здесь нет намеренно — касса клиники хранит суммы целыми тенге
 * (`Invoice.amount` объявлен как `Int`), и рисовать «,00» значило бы обещать
 * точность, которой в данных нет.
 */
private val TENGE_FORMAT = DecimalFormat(
    "#,###",
    DecimalFormatSymbols(Locale("ru")).apply { groupingSeparator = ' ' },
)

fun formatTenge(amount: Int): String = "${TENGE_FORMAT.format(amount)} ₸"

fun formatTenge(amount: Int?): String = formatTenge(amount ?: 0)

/**
 * Отдельная перегрузка для сумм-агрегатов (выручка за месяц и год).
 *
 * `Int` кончается на 2,1 млрд тенге — для одного счёта запас огромный, для
 * годовой выручки сети уже нет, а переполнение здесь было бы тихим: число
 * просто стало бы отрицательным.
 */
fun formatTenge(amount: Long): String = "${TENGE_FORMAT.format(amount)} ₸"
