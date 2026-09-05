package kz.dentvision.crm.ui.jobs

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.data.model.CreateJobRequest
import kz.dentvision.crm.data.model.JobVacancy
import kz.dentvision.crm.data.session.PendingAiQuery
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvBadge
import kz.dentvision.crm.ui.theme.DvBadgeVariant
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

/** Города из подборки `KZ_POPULAR_CITIES` (`src/lib/kz-cities.ts`) — быстрые фильтры, без полного каталога всех городов Казахстана. */
private val POPULAR_CITIES = listOf(
    "Алматы", "Астана", "Шымкент", "Караганда", "Актобе",
    "Тараз", "Павлодар", "Усть-Каменогорск", "Атырау", "Костанай",
)

/**
 * Перенос `Jobs.tsx` — кадровый рынок стоматологии: поиск + фильтр по городу
 * видны всем (`GET /api/jobs` под `optionalAuth`), отклик и публикация —
 * только вошедшим по-настоящему (`authenticate`, гостевой JWT сюда
 * намеренно не считается — та же граница, что и на вебе, `isAuthenticated`
 * там означает вход по логину/паролю, а не гостевую сессию).
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun JobsScreen(
    isAuthenticated: Boolean,
    onRequireLogin: () -> Unit,
    onAskAi: () -> Unit,
    viewModel: JobsViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val filters by viewModel.filters.collectAsStateWithLifecycle()
    val appliedIds by viewModel.appliedIds.collectAsStateWithLifecycle()
    var showForm by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(Unit) { viewModel.start(isAuthenticated) }

    Scaffold(
        containerColor = DvTheme.colors.surface0,
        floatingActionButton = {
            FloatingActionButton(
                onClick = { if (isAuthenticated) showForm = true else onRequireLogin() },
                containerColor = DvTheme.colors.gold,
                contentColor = DvTheme.colors.goldOn,
            ) {
                Icon(Icons.Filled.Add, contentDescription = "Разместить объявление")
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.End,
            ) {
                // Перенос кнопки «Спросить AI» из `Jobs.tsx:157-158` — ведёт
                // на домашний экран Intelligence с уже заданным вопросом,
                // тем же приёмом, что и `navigate('/', { state: { aiQuery } })`
                // на вебе, только через общий держатель [PendingAiQuery]
                // вместо React Router state.
                DvOutlineButton(
                    onClick = {
                        PendingAiQuery.set("Найди вакансии ортодонта")
                        onAskAi()
                    },
                ) {
                    Icon(Icons.Filled.AutoAwesome, contentDescription = null, modifier = Modifier.size(16.dp))
                    Text(text = "Спросить AI", modifier = Modifier.padding(start = 6.dp))
                }
            }
            OutlinedTextField(
                value = filters.query,
                onValueChange = viewModel::onQueryChange,
                singleLine = true,
                label = { Text("Должность, клиника…") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            )
            // FlowRow вместо LazyRow — на вебе `CityFilter` тоже `flex flex-wrap`
            // (`src/components/ui/CityFilter.tsx:43`): все города видны сразу,
            // а не обрезаны за краем экрана в ожидании свайпа.
            FlowRow(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FilterChip(
                    selected = filters.city.isBlank(),
                    onClick = { viewModel.onCityChange("") },
                    label = { Text("Весь Казахстан") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = DvTheme.colors.gold.copy(alpha = 0.18f),
                        selectedLabelColor = DvTheme.colors.gold,
                    ),
                )
                POPULAR_CITIES.forEach { city ->
                    FilterChip(
                        selected = filters.city == city,
                        onClick = { viewModel.onCityChange(if (filters.city == city) "" else city) },
                        label = { Text(city) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = DvTheme.colors.gold.copy(alpha = 0.18f),
                            selectedLabelColor = DvTheme.colors.gold,
                        ),
                    )
                }
            }

            when (val list = state) {
                is UiState.Loading -> LoadingSkeleton(modifier = Modifier.padding(top = 8.dp))
                is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::retry)
                is UiState.Data -> if (list.value.isEmpty()) {
                    val filtered = filters.query.isNotBlank() || filters.city.isNotBlank()
                    EmptyStateView(
                        title = if (filtered) "По вашему запросу ничего нет" else "Вакансий пока нет",
                        description = if (filtered) {
                            "Попробуйте другой город или снимите поиск."
                        } else {
                            "Будьте первым — разместите объявление."
                        },
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(list.value, key = { it.id }) { vacancy ->
                            VacancyCard(
                                vacancy = vacancy,
                                applied = appliedIds.contains(vacancy.id),
                                onApply = {
                                    if (isAuthenticated) {
                                        viewModel.apply(vacancy.id) { _, _ -> }
                                    } else {
                                        onRequireLogin()
                                    }
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    if (showForm) {
        ModalBottomSheet(
            onDismissRequest = { showForm = false },
            sheetState = sheetState,
            containerColor = DvTheme.colors.surface1,
        ) {
            PostJobForm(
                defaultCity = filters.city,
                onSubmit = { request, onResult ->
                    viewModel.post(request) { success, error ->
                        onResult(success, error)
                        if (success) showForm = false
                    }
                },
            )
        }
    }
}

@Composable
private fun VacancyCard(vacancy: JobVacancy, applied: Boolean, onApply: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = vacancy.title,
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.textPrimary,
                    modifier = Modifier.weight(1f).padding(end = 8.dp),
                )
                DvBadge(
                    text = if (vacancy.kind == "resume") "Ищу работу" else vacancy.employmentType.ifBlank { "Вакансия" },
                    variant = DvBadgeVariant.DEFAULT,
                )
            }
            val meta = listOfNotNull(
                vacancy.clinicName.ifBlank { null },
                vacancy.city.ifBlank { null },
                vacancy.salary.ifBlank { null },
                vacancy.createdAt?.take(10),
            ).joinToString(" · ")
            if (meta.isNotBlank()) {
                Text(
                    text = meta,
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            if (vacancy.description.isNotBlank()) {
                Text(
                    text = vacancy.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textSecondary,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            if (vacancy.tags.isNotEmpty()) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.padding(top = 8.dp),
                ) {
                    vacancy.tags.take(4).forEach { DvBadge(text = it, variant = DvBadgeVariant.GOLD) }
                }
            }
            if (vacancy.kind != "resume") {
                Row(modifier = Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.End) {
                    if (applied) {
                        DvOutlineButton(onClick = {}, enabled = false) { Text("Отклик отправлен") }
                    } else {
                        DvPrimaryButton(onClick = onApply) { Text("Откликнуться") }
                    }
                }
            }
        }
    }
}

private val EMPLOYMENT_TYPES = listOf("Полная занятость", "Частичная занятость", "Подработка", "Ищу работу")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PostJobForm(defaultCity: String, onSubmit: (CreateJobRequest, (Boolean, String?) -> Unit) -> Unit) {
    var isResume by remember { mutableStateOf(false) }
    var title by remember { mutableStateOf("") }
    var clinicName by remember { mutableStateOf("") }
    var city by remember { mutableStateOf(defaultCity) }
    var salary by remember { mutableStateOf("") }
    var employmentType by remember { mutableStateOf(EMPLOYMENT_TYPES.first()) }
    var description by remember { mutableStateOf("") }
    var tags by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .imePadding()
            .padding(20.dp),
    ) {
        Text(
            text = if (isResume) "Объявление о поиске работы" else "Разместить вакансию",
            style = MaterialTheme.typography.titleMedium,
            color = DvTheme.colors.textPrimary,
        )
        Row(modifier = Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = !isResume, onClick = { isResume = false }, label = { Text("Вакансия") })
            FilterChip(selected = isResume, onClick = { isResume = true }, label = { Text("Ищу работу") })
        }
        OutlinedTextField(
            value = title,
            onValueChange = { title = it; error = null },
            label = { Text(if (isResume) "Желаемая должность" else "Должность") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        )
        OutlinedTextField(
            value = clinicName,
            onValueChange = { clinicName = it },
            label = { Text(if (isResume) "Ваше имя" else "Клиника / компания") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        )
        OutlinedTextField(
            value = city,
            onValueChange = { city = it; error = null },
            label = { Text("Город") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        )
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
            items(POPULAR_CITIES) { c ->
                FilterChip(selected = city == c, onClick = { city = c }, label = { Text(c) })
            }
        }
        OutlinedTextField(
            value = salary,
            onValueChange = { salary = it },
            label = { Text("Зарплата") },
            placeholder = { Text("450 000 — 700 000 ₸") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        )
        if (!isResume) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                items(EMPLOYMENT_TYPES) { type ->
                    FilterChip(selected = employmentType == type, onClick = { employmentType = type }, label = { Text(type) })
                }
            }
        }
        OutlinedTextField(
            value = description,
            onValueChange = { description = it },
            label = { Text("Описание") },
            placeholder = { Text(if (isResume) "Опыт, специализация, что ищете…" else "Требования, условия, оборудование…") },
            minLines = 3,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        )
        OutlinedTextField(
            value = tags,
            onValueChange = { tags = it },
            label = { Text("Теги через запятую") },
            placeholder = { Text("Терапия, Эндодонтия") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        )
        if (error != null) {
            Text(
                text = error!!,
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.error,
                modifier = Modifier.padding(top = 10.dp),
            )
        }
        DvPrimaryButton(
            enabled = !saving,
            onClick = {
                if (title.isBlank()) {
                    error = "Укажите должность / заголовок"
                    return@DvPrimaryButton
                }
                if (city.isBlank()) {
                    error = "Укажите город"
                    return@DvPrimaryButton
                }
                saving = true
                onSubmit(
                    CreateJobRequest(
                        title = title.trim(),
                        clinicName = clinicName.trim().ifBlank { null },
                        city = city.trim(),
                        salary = salary.trim().ifBlank { null },
                        employmentType = if (isResume) "Ищу работу" else employmentType,
                        description = description.trim().ifBlank { null },
                        tags = tags.split(",").map { it.trim() }.filter { it.isNotEmpty() },
                        kind = if (isResume) "resume" else "vacancy",
                    ),
                ) { success, submitError ->
                    saving = false
                    if (!success) error = submitError ?: "Не удалось разместить"
                }
            },
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 8.dp),
        ) {
            Text(if (saving) "Публикация…" else "Опубликовать")
        }
    }
}
