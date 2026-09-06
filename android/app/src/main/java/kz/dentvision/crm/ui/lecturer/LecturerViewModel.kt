package kz.dentvision.crm.ui.lecturer

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
import kz.dentvision.crm.data.LecturerRepository
import kz.dentvision.crm.data.model.CreateLecturerCourseRequest
import kz.dentvision.crm.data.model.Lecturer
import kz.dentvision.crm.data.model.LecturerAnalytics
import kz.dentvision.crm.data.model.LecturerCourse

enum class LecturerTab { OVERVIEW, COURSES, PROFILE }

data class LecturerCourseForm(
    val title: String = "",
    val format: String = "course",
    val description: String = "",
    val category: String = "",
    val price: String = "",
    val seats: String = "",
    val imageUrl: String? = null,
)

data class LecturerProfileForm(val bio: String = "")

data class LecturerUiState(
    val loading: Boolean = true,
    val loadError: String? = null,
    val lecturer: Lecturer? = null,
    val analytics: LecturerAnalytics? = null,
    val courses: List<LecturerCourse> = emptyList(),
    val tab: LecturerTab = LecturerTab.OVERVIEW,
    val message: String? = null,

    val profileForm: LecturerProfileForm = LecturerProfileForm(),
    val savingProfile: Boolean = false,

    val addCourseOpen: Boolean = false,
    val courseForm: LecturerCourseForm = LecturerCourseForm(),
    val savingCourse: Boolean = false,
    val uploadingPhoto: Boolean = false,

    val requestingPayout: Boolean = false,
) {
    /**
     * `requireVerifiedLecturer` на бэкенде (`lecturer.routes.ts:69`) закрывает
     * `POST /courses` и `POST /payouts` целиком, пока уровень — `new` (значение
     * по умолчанию у любого самостоятельно зарегистрированного лектора).
     * Чтение и правка профиля доступны сразу.
     */
    val isVerified: Boolean get() = lecturer != null && lecturer.level != "new"
}

private const val MAX_PHOTO_BYTES = 5 * 1024 * 1024

/**
 * Кабинет лектора — в отличие от кабинета продавца, у веба нет готовой
 * страницы для сверки (см. докстринг `data/model/Lecturer.kt`), поэтому три
 * вкладки собраны прямо по контракту `lecturer.routes.ts`, а не перенесены.
 */
class LecturerViewModel(
    private val repository: LecturerRepository = LecturerRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(LecturerUiState())
    val state: StateFlow<LecturerUiState> = _state

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, loadError = null) }
        viewModelScope.launch {
            runCatching {
                val me = repository.me()
                val analytics = runCatching { repository.analytics() }.getOrNull()
                val courses = runCatching { repository.courses() }.getOrDefault(emptyList())
                Triple(me, analytics, courses)
            }.onSuccess { (me, analytics, courses) ->
                _state.update {
                    it.copy(
                        loading = false,
                        lecturer = me,
                        analytics = analytics,
                        courses = courses,
                        profileForm = LecturerProfileForm(bio = me.bio.orEmpty()),
                    )
                }
            }.onFailure { e ->
                _state.update { it.copy(loading = false, loadError = e.message ?: "Не удалось загрузить кабинет лектора") }
            }
        }
    }

    fun selectTab(tab: LecturerTab) {
        _state.update { it.copy(tab = tab) }
    }

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
    }

    // ─────────────────────────── Продукт (курс/вебинар/учебник/офис) ───────────────────────────

    fun openAddCourse() {
        _state.update { it.copy(addCourseOpen = true, courseForm = LecturerCourseForm()) }
    }

    fun dismissAddCourse() {
        _state.update { it.copy(addCourseOpen = false) }
    }

    fun updateCourseForm(transform: (LecturerCourseForm) -> LecturerCourseForm) {
        _state.update { it.copy(courseForm = transform(it.courseForm)) }
    }

    /** Как `readImageAsDataUrl` на вебе — без сжатия, тот же лимит, что уже принят в `SupplierViewModel`. */
    fun setCoursePhotoFromUri(context: Context, uri: Uri) {
        _state.update { it.copy(uploadingPhoto = true) }
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                        ?: error("Не удалось прочитать файл")
                    if (bytes.size > MAX_PHOTO_BYTES) error("Файл больше 5 МБ — сожмите фото и попробуйте снова")
                    val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                    "data:$mime;base64,${Base64.encodeToString(bytes, Base64.NO_WRAP)}"
                }
            }
            result
                .onSuccess { dataUrl -> _state.update { it.copy(uploadingPhoto = false, courseForm = it.courseForm.copy(imageUrl = dataUrl)) } }
                .onFailure { e -> _state.update { it.copy(uploadingPhoto = false, message = e.message ?: "Не удалось загрузить фото") } }
        }
    }

    fun saveCourse() {
        val form = _state.value.courseForm
        if (form.title.isBlank()) {
            _state.update { it.copy(message = "Введите название") }
            return
        }
        _state.update { it.copy(savingCourse = true) }
        viewModelScope.launch {
            runCatching {
                repository.createCourse(
                    CreateLecturerCourseRequest(
                        title = form.title.trim(),
                        format = form.format,
                        description = form.description.trim().ifBlank { null },
                        category = form.category.trim().ifBlank { null },
                        price = form.price.toDoubleOrNull(),
                        seats = form.seats.toIntOrNull(),
                        imageUrl = form.imageUrl,
                    ),
                )
            }.onSuccess {
                _state.update { it.copy(savingCourse = false, addCourseOpen = false, message = "Продукт добавлен") }
                load()
            }.onFailure { e ->
                _state.update { it.copy(savingCourse = false, message = e.message ?: "Ошибка при добавлении") }
            }
        }
    }

    fun deleteCourse(id: String) {
        viewModelScope.launch {
            runCatching { repository.deleteCourse(id) }
                .onSuccess { _state.update { it.copy(message = "Продукт удалён") }; load() }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "Ошибка при удалении") } }
        }
    }

    // ─────────────────────────── Выплата ───────────────────────────

    fun requestPayout() {
        val balance = _state.value.analytics?.balanceMinor?.toLongOrNull() ?: 0L
        if (balance <= 0) {
            _state.update { it.copy(message = "Нет средств для вывода") }
            return
        }
        _state.update { it.copy(requestingPayout = true) }
        viewModelScope.launch {
            runCatching { repository.requestPayout(balance.toString()) }
                .onSuccess { _state.update { it.copy(requestingPayout = false, message = "Заявка на выплату создана") }; load() }
                .onFailure { e -> _state.update { it.copy(requestingPayout = false, message = e.message ?: "Ошибка при запросе выплаты") } }
        }
    }

    // ─────────────────────────── Профиль ───────────────────────────

    fun updateProfileForm(transform: (LecturerProfileForm) -> LecturerProfileForm) {
        _state.update { it.copy(profileForm = transform(it.profileForm)) }
    }

    fun saveProfile() {
        val form = _state.value.profileForm
        _state.update { it.copy(savingProfile = true) }
        viewModelScope.launch {
            runCatching { repository.updateProfile(form.bio.trim().ifBlank { null }) }
                .onSuccess {
                    _state.update { it.copy(savingProfile = false, message = "Профиль сохранён") }
                    load()
                }
                .onFailure { e -> _state.update { it.copy(savingProfile = false, message = e.message ?: "Ошибка") } }
        }
    }
}
