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
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

private val Context.guestDataStore: DataStore<Preferences> by preferencesDataStore(name = "dv_guest")

/** Что хранится на диске — тот же набор полей, что веб держит в `localStorage['dv_guest']`. */
@Serializable
data class GuestIdentity(
    val guestId: String,
    val guestToken: String,
    val aiRequestsLeft: Int = 20,
)

/**
 * Гостевая личность на диске и в памяти — по образцу `SessionStore.kt`.
 * Отдельно от неё, а не полем внутри: гость и вошедший пользователь — разные,
 * не вложенные друг в друга состояния (`session == null` для гостя, как и
 * раньше), а `guestToken` нужен `AuthInterceptor` синхронно, тем же приёмом.
 */
class GuestSessionStore(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _identity = MutableStateFlow<GuestIdentity?>(null)
    val identity: StateFlow<GuestIdentity?> = _identity

    private val _restored = MutableStateFlow(false)
    val restored: StateFlow<Boolean> = _restored

    init {
        scope.launch {
            val stored = context.guestDataStore.data.first()[KEY_GUEST]
            _identity.value = stored?.let {
                runCatching { json.decodeFromString<GuestIdentity>(it) }.getOrNull()
            }
            _restored.value = true
        }
    }

    val guestToken: String? get() = _identity.value?.guestToken

    fun save(identity: GuestIdentity) {
        _identity.value = identity
        scope.launch { persist(identity) }
    }

    fun setAiRequestsLeft(n: Int) {
        val current = _identity.value ?: return
        val updated = current.copy(aiRequestsLeft = n.coerceAtLeast(0))
        _identity.value = updated
        scope.launch { persist(updated) }
    }

    fun clear() {
        _identity.value = null
        scope.launch {
            context.guestDataStore.edit { it.remove(KEY_GUEST) }
        }
    }

    private suspend fun persist(identity: GuestIdentity) {
        context.guestDataStore.edit { prefs ->
            prefs[KEY_GUEST] = json.encodeToString(GuestIdentity.serializer(), identity)
        }
    }

    private companion object {
        val KEY_GUEST = stringPreferencesKey("guest")
    }
}
