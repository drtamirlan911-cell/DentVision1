package kz.dentvision.crm.ui.lecturer

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kz.dentvision.crm.data.model.LecturerCourse
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

/** Русские подписи форматов — перенос `formatLabel` (`schoolFormats.ts`). */
private val FORMAT_LABELS = listOf(
    "course" to "Курс",
    "webinar" to "Вебинар",
    "textbook" to "Учебник",
    "office" to "Офис-курс",
)

private fun money(minorString: String): String = formatTenge((minorString.toLongOrNull() ?: 0L) / 100)

/**
 * Кабинет лектора — три вкладки по контракту `lecturer.routes.ts`: обзор
 * (баланс и заявка на выплату), продукты (курсы/вебинары/учебники/офис-курсы)
 * и профиль. Пока уровень — `new`, создание продуктов и выплата закрыты
 * сервером (`requireVerifiedLecturer`), поэтому баннер и отключённые кнопки
 * здесь — не UX-полировка, а честный ответ на реальный гейт.
 */
@Composable
fun LecturerWorkspaceScreen(viewModel: LecturerViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    when {
        state.loading -> LoadingSkeleton(rows = 3)
        state.loadError != null -> ErrorState(message = state.loadError!!, onRetry = viewModel::load)
        else -> LecturerContent(state = state, viewModel = viewModel)
    }
}

@Composable
private fun LecturerContent(state: LecturerUiState, viewModel: LecturerViewModel) {
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            LecturerTab.entries.forEach { tab ->
                FilterChip(
                    selected = state.tab == tab,
                    onClick = { viewModel.selectTab(tab) },
                    label = { Text(tabLabel(tab)) },
                )
            }
        }

        if (!state.isVerified) {
            Card(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface2),
                border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
            ) {
                Text(
                    text = "Профиль ожидает подтверждения администрацией — добавление продуктов и вывод средств станут доступны после проверки.",
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(12.dp),
                )
            }
        }

        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            when (state.tab) {
                LecturerTab.OVERVIEW -> OverviewTab(state, viewModel)
                LecturerTab.COURSES -> CoursesTab(state, viewModel)
                LecturerTab.PROFILE -> ProfileTab(state, viewModel)
            }
        }
    }

    if (state.addCourseOpen) {
        AddCourseSheet(viewModel = viewModel, state = state)
    }
}

private fun tabLabel(tab: LecturerTab): String = when (tab) {
    LecturerTab.OVERVIEW -> "Обзор"
    LecturerTab.COURSES -> "Продукты"
    LecturerTab.PROFILE -> "Профиль"
}

@Composable
private fun OverviewTab(state: LecturerUiState, viewModel: LecturerViewModel) {
    val a = state.analytics
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        StatCard(title = "Баланс", value = a?.balanceMinor?.let { money(it) } ?: "—", modifier = Modifier.weight(1f))
        StatCard(title = "Заработано", value = a?.earnedMinor?.let { money(it) } ?: "—", modifier = Modifier.weight(1f))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        StatCard(title = "Продажи", value = (a?.salesCount ?: 0).toString(), modifier = Modifier.weight(1f))
        StatCard(title = "Продуктов", value = (a?.courseCount ?: 0).toString(), modifier = Modifier.weight(1f))
        StatCard(title = "Студентов", value = (a?.studentCount ?: 0).toString(), modifier = Modifier.weight(1f))
    }

    state.message?.let {
        Text(it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.gold)
    }

    DvPrimaryButton(
        onClick = viewModel::requestPayout,
        enabled = state.isVerified && !state.requestingPayout && (a?.balanceMinor?.toLongOrNull() ?: 0L) > 0,
        modifier = Modifier.fillMaxWidth(),
    ) {
        if (state.requestingPayout) {
            CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.goldOn, modifier = Modifier.size(18.dp))
        } else {
            Text("Запросить выплату (${a?.balanceMinor?.let { money(it) } ?: "0 ₸"})")
        }
    }
}

@Composable
private fun StatCard(title: String, value: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(title, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
            Text(value, style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

@Composable
private fun CoursesTab(state: LecturerUiState, viewModel: LecturerViewModel) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text("Ваши продукты", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)
        DvOutlineButton(onClick = viewModel::openAddCourse, enabled = state.isVerified) {
            Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(16.dp))
            Text("Добавить", modifier = Modifier.padding(start = 4.dp))
        }
    }

    state.message?.let {
        Text(it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.gold)
    }

    if (state.courses.isEmpty()) {
        Text("Пока нет продуктов", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textMuted)
    } else {
        LazyColumn(modifier = Modifier.height(420.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.courses, key = { it.id }) { course -> CourseRow(course, onDelete = { viewModel.deleteCourse(course.id) }) }
        }
    }
}

@Composable
private fun CourseRow(course: LecturerCourse, onDelete: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(48.dp).clip(RoundedCornerShape(10.dp)).background(DvTheme.colors.surface2),
                contentAlignment = Alignment.Center,
            ) {
                if (course.imageUrl != null) {
                    AsyncImage(model = course.imageUrl, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                } else {
                    Icon(Icons.Filled.Image, contentDescription = null, tint = DvTheme.colors.textGhost)
                }
            }
            Column(modifier = Modifier.padding(start = 12.dp).weight(1f)) {
                Text(course.title, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                Text(
                    text = listOfNotNull(course.formatLabel, course.price?.let { formatTenge(it.toInt()) }).joinToString(" · "),
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                )
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Filled.Delete, contentDescription = "Удалить", tint = DvTheme.colors.error)
            }
        }
    }
}

@Composable
private fun ProfileTab(state: LecturerUiState, viewModel: LecturerViewModel) {
    Text("Профиль лектора", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)
    OutlinedTextField(
        value = state.profileForm.bio,
        onValueChange = { bio -> viewModel.updateProfileForm { it.copy(bio = bio) } },
        label = { Text("О себе") },
        minLines = 3,
        modifier = Modifier.fillMaxWidth(),
    )
    state.message?.let {
        Text(it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.gold)
    }
    DvPrimaryButton(onClick = viewModel::saveProfile, enabled = !state.savingProfile, modifier = Modifier.fillMaxWidth()) {
        if (state.savingProfile) {
            CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.goldOn, modifier = Modifier.size(18.dp))
        } else {
            Text("Сохранить")
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddCourseSheet(viewModel: LecturerViewModel, state: LecturerUiState) {
    val form = state.courseForm
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val context = LocalContext.current
    val pickPhoto = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let { viewModel.setCoursePhotoFromUri(context, it) }
    }

    ModalBottomSheet(onDismissRequest = viewModel::dismissAddCourse, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        Column(
            modifier = Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Новый продукт", style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FORMAT_LABELS.forEach { (value, label) ->
                    FilterChip(
                        selected = form.format == value,
                        onClick = { viewModel.updateCourseForm { it.copy(format = value) } },
                        label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                    )
                }
            }

            OutlinedTextField(
                value = form.title,
                onValueChange = { v -> viewModel.updateCourseForm { it.copy(title = v) } },
                label = { Text("Название *") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = form.description,
                onValueChange = { v -> viewModel.updateCourseForm { it.copy(description = v) } },
                label = { Text("Описание") },
                minLines = 2,
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = form.category,
                    onValueChange = { v -> viewModel.updateCourseForm { it.copy(category = v) } },
                    label = { Text("Категория") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = form.price,
                    onValueChange = { v -> viewModel.updateCourseForm { it.copy(price = v) } },
                    label = { Text("Цена, ₸") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
            }
            OutlinedTextField(
                value = form.seats,
                onValueChange = { v -> viewModel.updateCourseForm { it.copy(seats = v) } },
                label = { Text("Мест (необязательно)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            DvOutlineButton(onClick = { pickPhoto.launch("image/*") }, enabled = !state.uploadingPhoto, modifier = Modifier.fillMaxWidth()) {
                if (state.uploadingPhoto) {
                    CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.gold, modifier = Modifier.size(16.dp))
                } else {
                    Icon(Icons.Filled.Image, contentDescription = null, modifier = Modifier.size(16.dp))
                    Text(if (form.imageUrl != null) "Фото выбрано" else "Добавить фото", modifier = Modifier.padding(start = 6.dp))
                }
            }

            state.message?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error) }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
                DvPrimaryButton(onClick = viewModel::saveCourse, enabled = !state.savingCourse && form.title.isNotBlank(), modifier = Modifier.weight(1f)) {
                    if (state.savingCourse) {
                        CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.goldOn, modifier = Modifier.size(18.dp))
                    } else {
                        Text("Добавить")
                    }
                }
                TextButton(onClick = viewModel::dismissAddCourse) { Text("Отмена") }
            }
        }
    }
}
