package kz.dentvision.crm.ui.profile

import android.content.Context
import android.net.Uri
import android.util.Base64
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kz.dentvision.crm.data.ProfileRepository
import kz.dentvision.crm.data.model.ProfileResponse
import kz.dentvision.crm.data.model.ProfileUpdate
import kz.dentvision.crm.ui.common.UiState

/** Максимум — тот же, что веб (`image-upload.ts::MAX_BYTES`): без сжатия, просто отказ выше порога. */
private const val MAX_PHOTO_BYTES = 5 * 1024 * 1024

data class ProfileEditForm(
    val firstName: String = "",
    val lastName: String = "",
    val username: String = "",
    val headline: String = "",
    val bio: String = "",
    val city: String = "",
    val country: String = "",
    val spec: String = "",
    val experienceYears: String = "",
    val phone: String = "",
    val email: String = "",
    val photoUrl: String = "",
    val visibility: String = "public",
    val saving: Boolean = false,
    val error: String? = null,
)

data class ProfileUiState(
    val profile: UiState<ProfileResponse> = UiState.Loading,
    val message: String? = null,
)

class ProfileViewModel(
    private val repository: ProfileRepository = ProfileRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(ProfileUiState())
    val state: StateFlow<ProfileUiState> = _state

    private val _editForm = MutableStateFlow<ProfileEditForm?>(null)
    val editForm: StateFlow<ProfileEditForm?> = _editForm

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(profile = UiState.Loading) }
        viewModelScope.launch {
            runCatching { repository.get() }
                .onSuccess { data -> _state.update { it.copy(profile = UiState.Data(data)) } }
                .onFailure { _state.update { s -> s.copy(profile = UiState.Error(it.message ?: "Не удалось загрузить профиль")) } }
        }
    }

    fun openEdit() {
        val user = ((_state.value.profile as? UiState.Data)?.value)?.user ?: return
        _editForm.value = ProfileEditForm(
            firstName = user.firstName,
            lastName = user.lastName,
            username = user.username,
            headline = user.headline,
            bio = user.bio,
            city = user.city,
            country = user.country,
            spec = user.spec.orEmpty(),
            experienceYears = user.experienceYears.takeIf { it > 0 }?.toString() ?: "",
            phone = user.phone.orEmpty(),
            email = user.email,
            photoUrl = user.photoUrl,
            visibility = user.visibility,
        )
    }

    fun dismissEdit() {
        _editForm.value = null
    }

    fun updateEdit(transform: (ProfileEditForm) -> ProfileEditForm) {
        _editForm.update { it?.let(transform) }
    }

    /** Как `readImageAsDataUrl` на вебе: без сжатия, просто отказ файлам больше 5 МБ. */
    fun setPhotoFromUri(context: Context, uri: Uri) {
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                        ?: error("Не удалось прочитать файл")
                    if (bytes.size > MAX_PHOTO_BYTES) {
                        error("Файл больше 5 МБ — сожмите фото и попробуйте снова")
                    }
                    val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                    "data:$mime;base64,${Base64.encodeToString(bytes, Base64.NO_WRAP)}"
                }
            }
            result
                .onSuccess { dataUrl -> _editForm.update { it?.copy(photoUrl = dataUrl, error = null) } }
                .onFailure { e -> _editForm.update { it?.copy(error = e.message ?: "Не удалось загрузить фото") } }
        }
    }

    fun saveEdit(onDone: () -> Unit) {
        val form = _editForm.value ?: return
        _editForm.update { it?.copy(saving = true, error = null) }
        viewModelScope.launch {
            runCatching {
                repository.update(
                    ProfileUpdate(
                        firstName = form.firstName,
                        lastName = form.lastName,
                        username = form.username,
                        headline = form.headline,
                        bio = form.bio,
                        city = form.city,
                        country = form.country,
                        spec = form.spec,
                        experienceYears = form.experienceYears.toIntOrNull() ?: 0,
                        phone = form.phone,
                        email = form.email,
                        photoUrl = form.photoUrl,
                        visibility = form.visibility,
                    ),
                )
            }
                .onSuccess {
                    load()
                    _editForm.value = null
                    onDone()
                }
                .onFailure { e -> _editForm.update { it?.copy(saving = false, error = e.message ?: "Не удалось сохранить") } }
        }
    }

    fun addSkill(name: String, level: String?, onDone: () -> Unit) = mutate(onDone) { repository.addSkill(name, level) }
    fun deleteSkill(id: String) = mutateDelete { repository.deleteSkill(id) }

    fun addCertificate(title: String, issuer: String?, year: Int?, fileUrl: String?, onDone: () -> Unit) =
        mutate(onDone) { repository.addCertificate(title, issuer, year, fileUrl) }
    fun deleteCertificate(id: String) = mutateDelete { repository.deleteCertificate(id) }

    fun addAchievement(title: String, description: String?, date: String?, onDone: () -> Unit) =
        mutate(onDone) { repository.addAchievement(title, description, date) }
    fun deleteAchievement(id: String) = mutateDelete { repository.deleteAchievement(id) }

    fun addPortfolioItem(title: String, description: String?, imageUrl: String?, link: String?, onDone: () -> Unit) =
        mutate(onDone) { repository.addPortfolioItem(title, description, imageUrl, link) }
    fun deletePortfolioItem(id: String) = mutateDelete { repository.deletePortfolioItem(id) }

    fun addCase(title: String, description: String?, beforeImage: String?, afterImage: String?, tags: List<String>, onDone: () -> Unit) =
        mutate(onDone) { repository.addCase(title, description, beforeImage, afterImage, tags) }
    fun deleteCase(id: String) = mutateDelete { repository.deleteCase(id) }

    fun consumeMessage() = _state.update { it.copy(message = null) }

    private fun mutate(onDone: () -> Unit, block: suspend () -> Unit) {
        viewModelScope.launch {
            runCatching { block() }
                .onSuccess { load(); onDone() }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "Не удалось добавить") } }
        }
    }

    private fun mutateDelete(block: suspend () -> Unit) {
        viewModelScope.launch {
            runCatching { block() }
                .onSuccess { load() }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "Не удалось удалить") } }
        }
    }
}
