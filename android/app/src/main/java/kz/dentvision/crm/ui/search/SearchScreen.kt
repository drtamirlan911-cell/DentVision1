package kz.dentvision.crm.ui.search

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.runtime.remember
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.data.session.SelectedPatient
import kz.dentvision.crm.lib.formatPhone
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.theme.DvSpacing
import kz.dentvision.crm.ui.theme.DvTheme

data class SearchUiState(
    val query: String = "",
    val results: List<Patient> = emptyList(),
    val searching: Boolean = false,
    val error: String? = null,
    /** Запрос был, ответ пришёл — чтобы отличить «ничего не нашли» от «ещё не искали». */
    val searched: Boolean = false,
)

/**
 * Поиск пациента, доступный из шапки на любом экране.
 *
 * Ищет на сервере (`GET /api/patients?search=`), а не в том, что успело
 * попасть на устройство: имя, телефон и ИИН целиком. Клиентский фильтр по
 * загруженной странице находил бы только первых, и на большой клинике это
 * тихо превращалось бы в «пациента нет».
 *
 * Назван честно — «Поиск пациента», а не «глобальный поиск»: своей ручки для
 * сквозного поиска по документам, планам и платежам на сервере нет, и обещать
 * её экраном значило бы имитировать функцию.
 */
class SearchViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(SearchUiState())
    val state: StateFlow<SearchUiState> = _state

    private var job: Job? = null

    fun setQuery(value: String) {
        _state.update { it.copy(query = value) }
        job?.cancel()
        val trimmed = value.trim()
        if (trimmed.length < MIN_QUERY) {
            _state.update { it.copy(results = emptyList(), searching = false, searched = false, error = null) }
            return
        }
        _state.update { it.copy(searching = true, error = null) }
        job = viewModelScope.launch {
            // Пауза перед запросом: без неё каждая набранная буква уходила бы
            // на сервер, и ответ на «Ив» мог перекрыть ответ на «Иванов».
            delay(DEBOUNCE_MS)
            runCatching { repository.searchPatients(trimmed) }
                .onSuccess { found ->
                    _state.update { it.copy(results = found, searching = false, searched = true) }
                }
                .onFailure { e ->
                    _state.update {
                        it.copy(searching = false, searched = true, error = e.message ?: "Не удалось выполнить поиск")
                    }
                }
        }
    }

    /** Кладём пациента в держатель — карточка читает его оттуда, а не грузит заново. */
    fun open(patient: Patient, onReady: (String) -> Unit) {
        SelectedPatient.set(patient)
        onReady(patient.id)
    }

    private companion object {
        /** Одна буква находит пол-клиники — это не результат, а шум. */
        const val MIN_QUERY = 2
        const val DEBOUNCE_MS = 300L
    }
}

@Composable
fun SearchScreen(
    onOpenPatient: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: SearchViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val focusRequester = remember { FocusRequester() }

    // Экран открывают ради ввода — клавиатура должна быть готова сразу,
    // без лишнего касания по полю.
    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    Column(modifier = modifier.fillMaxSize()) {
        OutlinedTextField(
            value = state.query,
            onValueChange = viewModel::setQuery,
            singleLine = true,
            label = { Text("Имя, телефон или ИИН") },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = DvSpacing.lg, vertical = DvSpacing.sm)
                .focusRequester(focusRequester),
        )

        when {
            state.searching -> LoadingSkeleton(rows = 3, contentPadding = PaddingValues(DvSpacing.lg))
            state.error != null -> ErrorState(
                message = state.error!!,
                onRetry = { viewModel.setQuery(state.query) },
            )
            !state.searched -> EmptyStateView(
                title = "Кого ищем?",
                description = "Введите имя, телефон или ИИН целиком — поиск идёт по всей клинике.",
            )
            state.results.isEmpty() -> EmptyStateView(
                title = "Никого не нашли",
                // ИИН ищется только целиком: в базе лежит его хеш, а не сам
                // номер, и по части хеша искать нечего. Человеку нужно об
                // этом сказать, иначе «не нашли» выглядит как ошибка.
                description = "Проверьте написание. ИИН ищется только полностью, 12 цифр.",
            )
            else -> LazyColumn(
                contentPadding = PaddingValues(DvSpacing.lg),
                verticalArrangement = Arrangement.spacedBy(DvSpacing.sm),
            ) {
                items(state.results, key = { it.id }) { patient ->
                    PatientResultRow(
                        patient = patient,
                        onOpen = { viewModel.open(patient, onOpenPatient) },
                    )
                }
            }
        }
    }
}

@Composable
private fun PatientResultRow(patient: Patient, onOpen: () -> Unit) {
    val colors = DvTheme.colors
    Surface(
        color = colors.surface1,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, colors.borderSubtle),
        onClick = onOpen,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(DvSpacing.lg)) {
            Text(
                text = patient.name.ifBlank { "Без имени" },
                style = MaterialTheme.typography.bodyLarge,
                color = colors.textPrimary,
            )
            val sub = listOfNotNull(
                formatPhone(patient.phone.ifBlank { null }),
                patient.iin.ifBlank { null }?.let { "ИИН $it" },
            ).joinToString(" · ")
            if (sub.isNotBlank()) {
                Text(
                    text = sub,
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                    modifier = Modifier.padding(top = DvSpacing.xs),
                )
            }
        }
    }
}
