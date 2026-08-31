package kz.dentvision.crm.data.session

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json

private val Context.sessionDataStore: DataStore<Preferences> by preferencesDataStore(name = "dv_session")

/**
 * Сессия на диске и в памяти одновременно.
 *
 * В памяти она нужна потому, что перехватчик OkHttp синхронный: он не может
 * ждать корутину ради заголовка. Это тот же приём, что и в вебе, где токен
 * лежит в модульной переменной `_accessToken`, а не читается из хранилища на
 * каждый запрос.
 *
 * Выход стирает всё: и запись на диске, и копию в памяти.
 */
class SessionStore(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _session = MutableStateFlow<Session?>(null)
    val session: StateFlow<Session?> = _session

    /** true, пока первое чтение с диска не закончилось: до него нельзя решать, вошёл пользователь или нет. */
    private val _restored = MutableStateFlow(false)
    val restored: StateFlow<Boolean> = _restored

    init {
        scope.launch {
            val stored = context.sessionDataStore.data.first()[KEY_SESSION]
            _session.value = stored?.let {
                runCatching { json.decodeFromString<Session>(it) }.getOrNull()
            }
            _restored.value = true
        }
    }

    val accessToken: String? get() = _session.value?.accessToken
    val refreshToken: String? get() = _session.value?.refreshToken

    fun save(session: Session) {
        _session.value = session
        scope.launch { persist(session) }
    }

    /**
     * Обновление токенов после `POST /api/auth/refresh`. Вызывается из
     * авторизатора OkHttp, который работает в собственном потоке и не может
     * дождаться корутины, — поэтому запись на диск здесь синхронная.
     */
    fun updateTokens(accessToken: String, refreshToken: String?) {
        val current = _session.value ?: return
        val updated = current.copy(
            accessToken = accessToken,
            refreshToken = refreshToken ?: current.refreshToken,
        )
        _session.value = updated
        runBlocking { persist(updated) }
    }

    fun clear() {
        _session.value = null
        scope.launch {
            context.sessionDataStore.edit { it.remove(KEY_SESSION) }
        }
    }

    private suspend fun persist(session: Session) {
        context.sessionDataStore.edit { prefs ->
            prefs[KEY_SESSION] = json.encodeToString(Session.serializer(), session)
        }
    }

    private companion object {
        val KEY_SESSION = stringPreferencesKey("session")
    }
}
