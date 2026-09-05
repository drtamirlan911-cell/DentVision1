package kz.dentvision.crm.lib

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import java.io.File

/**
 * Отчёт в CSV — тот же формат, что и веб (`src/lib/financePeriod.ts::downloadCsv`):
 * BOM, `;`-разделитель, кавычки экранируются удвоением. Так экспорт с телефона
 * и из браузера открывается в Excel одинаково.
 *
 * Прямого «скачивания» на телефоне нет — файл кладётся в кэш приложения и
 * передаётся системным шитом «Поделиться», чтобы пользователь сам выбрал,
 * куда его сохранить (Диск, файлы, WhatsApp и т.д.).
 */
fun exportCsv(
    context: Context,
    filename: String,
    headers: List<String>,
    rows: List<List<Any?>>,
) {
    fun escape(v: Any?): String {
        val s = v?.toString() ?: ""
        return if (s.any { it == '"' || it == ';' || it == ',' || it == '\n' }) {
            "\"${s.replace("\"", "\"\"")}\""
        } else {
            s
        }
    }

    val lines = buildList {
        add(headers.joinToString(";") { escape(it) })
        rows.forEach { row -> add(row.joinToString(";") { escape(it) }) }
    }
    val content = "﻿" + lines.joinToString("\n")

    val dir = File(context.cacheDir, "exports").apply { mkdirs() }
    val file = File(dir, filename)
    file.writeText(content, Charsets.UTF_8)

    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/csv"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, "Отчёт CSV"))
}
