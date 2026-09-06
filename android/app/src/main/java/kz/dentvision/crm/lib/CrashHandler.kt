package kz.dentvision.crm.lib

import android.content.Context
import android.util.Log
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * До этой правки необработанное исключение просто убивало процесс — Android
 * печатает трассировку в logcat перед смертью, но logcat никто с реального
 * телефона в проде не читает, так что крэш был не виден вообще никому.
 *
 * Полноценный удалённый крэш-репортинг (Crashlytics/Sentry) требует своего
 * DSN/google-services.json — то, что нельзя выдумать. Это временный пол:
 * последний крэш кладётся в приватный файл приложения, чтобы его можно было
 * забрать через `adb shell run-as kz.dentvision.crm cat files/crashes/…` при
 * разборе жалобы на внутренней/бета-сборке — лучше, чем ничего, до того как
 * появится реальный DSN.
 */
object CrashHandler {
    fun install(context: Context) {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                writeCrashFile(context, throwable)
            } catch (writeError: Throwable) {
                Log.e("CrashHandler", "Не удалось записать отчёт о крэше", writeError)
            }
            Log.e("CrashHandler", "Необработанное исключение в потоке ${thread.name}", throwable)
            previous?.uncaughtException(thread, throwable)
        }
    }

    private fun writeCrashFile(context: Context, throwable: Throwable) {
        val dir = File(context.filesDir, "crashes").apply { mkdirs() }
        val stamp = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.US).format(Date())
        val stackTrace = StringWriter().also { throwable.printStackTrace(PrintWriter(it)) }.toString()
        File(dir, "crash_$stamp.txt").writeText(
            "versionName=${context.packageManager.getPackageInfo(context.packageName, 0).versionName}\n" +
                "time=$stamp\n\n$stackTrace",
        )
        // Не копим отчёты бесконечно на устройстве пользователя.
        dir.listFiles()?.sortedByDescending { it.lastModified() }?.drop(20)?.forEach { it.delete() }
    }
}
