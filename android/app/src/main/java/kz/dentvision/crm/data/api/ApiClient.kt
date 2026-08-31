package kz.dentvision.crm.data.api

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.serialization.json.Json
import kz.dentvision.crm.BuildConfig
import kz.dentvision.crm.data.session.SessionStore
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Единственная точка сборки HTTP-слоя. Адрес берётся из `BuildConfig.API_BASE_URL`,
 * куда его кладёт `app/build.gradle.kts`: те же два значения, что и в
 * `src/utils/api.ts` — продакшн-хост и локальная разработка.
 */
class ApiClient(
    baseUrl: String,
    session: SessionStore,
) {
    /** Сигнал «сессия умерла»: оболочка на него уводит на экран входа. */
    val sessionLost = MutableSharedFlow<Unit>(extraBufferCapacity = 1)

    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
    }

    private val client: OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(AuthInterceptor(session))
        .apply {
            if (BuildConfig.DEBUG) {
                addInterceptor(
                    HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC },
                )
            }
        }
        .authenticator(
            TokenAuthenticator(
                baseUrl = baseUrl.trimEnd('/'),
                session = session,
                onSessionLost = { sessionLost.tryEmit(Unit) },
            ),
        )
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val retrofit: Retrofit = Retrofit.Builder()
        .baseUrl(baseUrl.trimEnd('/') + "/")
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    val auth: AuthApi = retrofit.create(AuthApi::class.java)
    val crm: CrmApi = retrofit.create(CrmApi::class.java)
}
