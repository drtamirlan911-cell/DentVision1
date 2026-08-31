package kz.dentvision.crm.data

import android.content.Context
import kz.dentvision.crm.BuildConfig
import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.session.SessionStore

/**
 * Один живой граф зависимостей на процесс. Библиотеки внедрения зависимостей
 * сюда не тянутся: их нет в проекте, а граф — три объекта.
 */
object ServiceLocator {
    lateinit var session: SessionStore
        private set
    lateinit var api: ApiClient
        private set

    fun init(context: Context) {
        if (::api.isInitialized) return
        session = SessionStore(context.applicationContext)
        api = ApiClient(baseUrl = BuildConfig.API_BASE_URL, session = session)
    }
}
