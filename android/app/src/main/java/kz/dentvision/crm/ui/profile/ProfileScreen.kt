package kz.dentvision.crm.ui.profile

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kz.dentvision.crm.data.model.Achievement
import kz.dentvision.crm.data.model.CaseItem
import kz.dentvision.crm.data.model.Certificate
import kz.dentvision.crm.data.model.PortfolioItem
import kz.dentvision.crm.data.model.ProfileResponse
import kz.dentvision.crm.data.model.Review
import kz.dentvision.crm.data.model.Skill
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvBadge
import kz.dentvision.crm.ui.theme.DvBadgeVariant
import kz.dentvision.crm.ui.theme.DvConfirmDialog
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Мой профиль — перенос `Profile.tsx`. Визитка специалиста: те же разделы —
 * навыки, достижения, сертификаты, портфолио, кейсы, — плюс отзывы и лента
 * активности только на чтение (у них нет ручки записи и на вебе — это
 * агрегаты из других действий).
 *
 * Кошелёк DentCash и карточка зарплаты врача, которые веб встраивает на ту
 * же страницу, сюда сознательно не включены — см. докстринг
 * `ProfileRepository`.
 */
@Composable
fun ProfileScreen(viewModel: ProfileViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val editForm by viewModel.editForm.collectAsStateWithLifecycle()
    var toDelete by remember { mutableStateOf<Pair<String, String>?>(null) } // (kind, id)

    when (val profile = state.profile) {
        is UiState.Loading -> LoadingSkeleton()
        is UiState.Error -> ErrorState(message = profile.message, onRetry = viewModel::load)
        is UiState.Data -> {
            val data = profile.value
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                HeaderCard(data = data, onEdit = viewModel::openEdit)

                SectionCard(title = "О себе", icon = Icons.Filled.Person) {
                    if (data.user.bio.isNotBlank()) {
                        Text(data.user.bio, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textSecondary)
                    } else {
                        Text(
                            "Добавьте информацию о себе — нажмите «Редактировать»",
                            style = MaterialTheme.typography.bodySmall,
                            color = DvTheme.colors.textMuted,
                        )
                    }
                }

                SkillsSection(
                    skills = data.skills,
                    onAdd = { name, level -> viewModel.addSkill(name, level) {} },
                    onDelete = { toDelete = "skill" to it },
                )

                AchievementsSection(
                    achievements = data.achievements,
                    onAdd = { title, desc, date -> viewModel.addAchievement(title, desc, date) {} },
                    onDelete = { toDelete = "ach" to it },
                )

                CertificatesSection(
                    certificates = data.certificates,
                    onAdd = { title, issuer, year -> viewModel.addCertificate(title, issuer, year, null) {} },
                    onDelete = { toDelete = "cert" to it },
                )

                PortfolioSection(
                    items = data.portfolio,
                    onAdd = { title, desc, link -> viewModel.addPortfolioItem(title, desc, null, link) {} },
                    onDelete = { toDelete = "port" to it },
                )

                CasesSection(
                    cases = data.cases,
                    onAdd = { title, desc, tags -> viewModel.addCase(title, desc, null, null, tags) {} },
                    onDelete = { toDelete = "case" to it },
                )

                if (data.reviews.isNotEmpty()) ReviewsSection(reviews = data.reviews)
                if (data.activities.isNotEmpty()) {
                    SectionCard(title = "Активность", icon = Icons.Filled.Star) {
                        Column {
                            data.activities.take(10).forEach { a ->
                                Text(
                                    "${a.title} · ${a.createdAt.replace('T', ' ').take(16)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = DvTheme.colors.textSecondary,
                                    modifier = Modifier.padding(vertical = 3.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (editForm != null) {
        EditProfileSheet(viewModel = viewModel)
    }

    toDelete?.let { (kind, id) ->
        DvConfirmDialog(
            title = "Удалить?",
            message = "Это действие нельзя отменить.",
            confirmLabel = "Удалить",
            onConfirm = {
                when (kind) {
                    "skill" -> viewModel.deleteSkill(id)
                    "ach" -> viewModel.deleteAchievement(id)
                    "cert" -> viewModel.deleteCertificate(id)
                    "port" -> viewModel.deletePortfolioItem(id)
                    "case" -> viewModel.deleteCase(id)
                }
                toDelete = null
            },
            onDismiss = { toDelete = null },
        )
    }
}

@Composable
private fun HeaderCard(data: ProfileResponse, onEdit: () -> Unit) {
    val user = data.user
    val fullName = listOf(user.firstName, user.lastName).filter { it.isNotBlank() }.joinToString(" ").ifBlank { user.name }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                ProfileAvatar(name = fullName, photoUrl = user.photoUrl, size = 64.dp)
                Column(modifier = Modifier.padding(start = 14.dp).weight(1f)) {
                    Text(fullName.ifBlank { "Без имени" }, style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)
                    if (user.headline.isNotBlank()) {
                        Text(user.headline, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.gold)
                    }
                    val meta = listOfNotNull(
                        user.spec?.takeIf { it.isNotBlank() },
                        listOf(user.city, user.country).filter { it.isNotBlank() }.joinToString(", ").ifBlank { null },
                        user.experienceYears.takeIf { it > 0 }?.let { "$it лет опыта" },
                    ).joinToString(" · ")
                    if (meta.isNotBlank()) {
                        Text(meta, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted, modifier = Modifier.padding(top = 2.dp))
                    }
                }
            }
            Row(modifier = Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (user.visibility == "private") DvBadge(text = "Профиль скрыт", variant = DvBadgeVariant.WARNING)
                if (user.username.isNotBlank()) DvBadge(text = "@${user.username}", variant = DvBadgeVariant.DEFAULT)
            }
            TextButton(onClick = onEdit, modifier = Modifier.padding(top = 8.dp)) {
                Icon(Icons.Filled.Edit, contentDescription = null, modifier = Modifier.padding(end = 4.dp))
                Text("Редактировать")
            }
        }
    }
}

@Composable
private fun ProfileAvatar(name: String, photoUrl: String, size: Dp) {
    val bitmap by produceState<ImageBitmap?>(initialValue = null, photoUrl) {
        value = if (photoUrl.startsWith("data:")) {
            withContext(Dispatchers.Default) {
                runCatching {
                    val b64 = photoUrl.substringAfter("base64,", "")
                    if (b64.isBlank()) return@runCatching null
                    val bytes = Base64.decode(b64, Base64.DEFAULT)
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
                }.getOrNull()
            }
        } else {
            null
        }
    }

    Box(
        modifier = Modifier.size(size).clip(CircleShape).background(DvTheme.colors.gold.copy(alpha = 0.15f)),
        contentAlignment = Alignment.Center,
    ) {
        when {
            bitmap != null -> androidx.compose.foundation.Image(
                bitmap = bitmap!!,
                contentDescription = null,
                modifier = Modifier.fillMaxSize().clip(CircleShape),
                contentScale = ContentScale.Crop,
            )
            photoUrl.isNotBlank() -> AsyncImage(
                model = photoUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize().clip(CircleShape),
                contentScale = ContentScale.Crop,
            )
            else -> Text(
                text = name.trim().split(" ").filter { it.isNotBlank() }.take(2).mapNotNull { it.firstOrNull()?.uppercaseChar() }.joinToString("").ifBlank { "?" },
                style = MaterialTheme.typography.titleLarge,
                color = DvTheme.colors.gold,
            )
        }
    }
}

@Composable
private fun SectionCard(title: String, icon: androidx.compose.ui.graphics.vector.ImageVector, onAdd: (() -> Unit)? = null, content: @Composable () -> Unit) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null, tint = DvTheme.colors.gold, modifier = Modifier.size(18.dp))
                Text(title, style = MaterialTheme.typography.titleSmall, color = DvTheme.colors.textPrimary, modifier = Modifier.padding(start = 8.dp))
            }
            if (onAdd != null) {
                TextButton(onClick = onAdd) {
                    Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.padding(end = 4.dp))
                    Text("Добавить")
                }
            }
        }
        Card(
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
            border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
        ) {
            Column(modifier = Modifier.padding(14.dp)) { content() }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SkillsSection(skills: List<Skill>, onAdd: (String, String?) -> Unit, onDelete: (String) -> Unit) {
    var showAdd by remember { mutableStateOf(false) }
    SectionCard(title = "Навыки", icon = Icons.Filled.Star, onAdd = { showAdd = true }) {
        if (skills.isEmpty()) {
            Text("Пока нет навыков", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
        } else {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                skills.forEach { skill ->
                    Row(
                        modifier = Modifier
                            .background(DvTheme.colors.surface2, CircleShape)
                            .clickable { onDelete(skill.id) }
                            .padding(start = 12.dp, end = 6.dp, top = 6.dp, bottom = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            skill.name + (skill.level?.takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""),
                            style = MaterialTheme.typography.bodySmall,
                            color = DvTheme.colors.textSecondary,
                        )
                        // Явная иконка «×» — без неё чип выглядел как обычная
                        // нередактируемая метка, и тап по нему удалял навык
                        // без единого визуального намёка, что так можно.
                        Icon(
                            imageVector = Icons.Filled.Close,
                            contentDescription = "Удалить навык",
                            tint = DvTheme.colors.textMuted,
                            modifier = Modifier.padding(start = 4.dp).size(14.dp),
                        )
                    }
                }
            }
        }
    }
    if (showAdd) {
        TwoFieldAddSheet(
            title = "Новый навык",
            label1 = "Название",
            label2 = "Уровень (необязательно)",
            onDismiss = { showAdd = false },
            onSave = { name, level -> onAdd(name, level.ifBlank { null }); showAdd = false },
        )
    }
}

@Composable
private fun AchievementsSection(achievements: List<Achievement>, onAdd: (String, String?, String?) -> Unit, onDelete: (String) -> Unit) {
    var showAdd by remember { mutableStateOf(false) }
    SectionCard(title = "Достижения", icon = Icons.Filled.EmojiEvents, onAdd = { showAdd = true }) {
        if (achievements.isEmpty()) {
            Text("Добавьте свои достижения", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
        } else {
            achievements.forEach { a ->
                ListRow(
                    title = a.title,
                    subtitle = listOfNotNull(a.description?.takeIf { it.isNotBlank() }, a.date?.takeIf { it.isNotBlank() }).joinToString(" · "),
                    onDelete = { onDelete(a.id) },
                )
            }
        }
    }
    if (showAdd) {
        ThreeFieldAddSheet(
            title = "Новое достижение",
            label1 = "Название",
            label2 = "Описание (необязательно)",
            label3 = "Дата, ГГГГ-ММ-ДД (необязательно)",
            onDismiss = { showAdd = false },
            onSave = { title, desc, date -> onAdd(title, desc.ifBlank { null }, date.ifBlank { null }); showAdd = false },
        )
    }
}

@Composable
private fun CertificatesSection(certificates: List<Certificate>, onAdd: (String, String?, Int?) -> Unit, onDelete: (String) -> Unit) {
    var showAdd by remember { mutableStateOf(false) }
    SectionCard(title = "Сертификаты", icon = Icons.Filled.WorkspacePremium, onAdd = { showAdd = true }) {
        if (certificates.isEmpty()) {
            Text("Пока нет сертификатов", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
        } else {
            certificates.forEach { c ->
                ListRow(
                    title = c.title,
                    subtitle = listOfNotNull(c.issuer?.takeIf { it.isNotBlank() }, c.year?.toString()).joinToString(" · "),
                    onDelete = { onDelete(c.id) },
                )
            }
        }
    }
    if (showAdd) {
        ThreeFieldAddSheet(
            title = "Новый сертификат",
            label1 = "Название",
            label2 = "Кем выдан (необязательно)",
            label3 = "Год (необязательно)",
            field3Numeric = true,
            onDismiss = { showAdd = false },
            onSave = { title, issuer, year -> onAdd(title, issuer.ifBlank { null }, year.toIntOrNull()); showAdd = false },
        )
    }
}

@Composable
private fun PortfolioSection(items: List<PortfolioItem>, onAdd: (String, String?, String?) -> Unit, onDelete: (String) -> Unit) {
    var showAdd by remember { mutableStateOf(false) }
    SectionCard(title = "Портфолио", icon = Icons.Filled.Star, onAdd = { showAdd = true }) {
        if (items.isEmpty()) {
            Text("Пока пусто", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
        } else {
            items.forEach { p ->
                ListRow(title = p.title, subtitle = p.description.orEmpty(), onDelete = { onDelete(p.id) })
            }
        }
    }
    if (showAdd) {
        ThreeFieldAddSheet(
            title = "Работа в портфолио",
            label1 = "Название",
            label2 = "Описание (необязательно)",
            label3 = "Ссылка (необязательно)",
            onDismiss = { showAdd = false },
            onSave = { title, desc, link -> onAdd(title, desc.ifBlank { null }, link.ifBlank { null }); showAdd = false },
        )
    }
}

@Composable
private fun CasesSection(cases: List<CaseItem>, onAdd: (String, String?, List<String>) -> Unit, onDelete: (String) -> Unit) {
    var showAdd by remember { mutableStateOf(false) }
    SectionCard(title = "Клинические случаи", icon = Icons.Filled.Star, onAdd = { showAdd = true }) {
        if (cases.isEmpty()) {
            Text("Пока нет случаев", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
        } else {
            cases.forEach { c ->
                ListRow(
                    title = c.title,
                    subtitle = listOfNotNull(c.description?.takeIf { it.isNotBlank() }, c.tags.takeIf { it.isNotEmpty() }?.joinToString(", ")).joinToString(" · "),
                    onDelete = { onDelete(c.id) },
                )
            }
        }
    }
    if (showAdd) {
        ThreeFieldAddSheet(
            title = "Новый случай",
            label1 = "Название",
            label2 = "Описание (необязательно)",
            label3 = "Теги через запятую (необязательно)",
            onDismiss = { showAdd = false },
            onSave = { title, desc, tags ->
                onAdd(title, desc.ifBlank { null }, tags.split(",").map { it.trim() }.filter { it.isNotBlank() })
                showAdd = false
            },
        )
    }
}

@Composable
private fun ReviewsSection(reviews: List<Review>) {
    SectionCard(title = "Отзывы", icon = Icons.Filled.Star) {
        reviews.forEach { r ->
            Column(modifier = Modifier.padding(vertical = 6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(r.authorName?.takeIf { it.isNotBlank() } ?: "Аноним", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                    r.rating?.let {
                        Text(" · ${it}★", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.gold, modifier = Modifier.padding(start = 4.dp))
                    }
                }
                r.comment?.takeIf { it.isNotBlank() }?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textSecondary, modifier = Modifier.padding(top = 2.dp))
                }
            }
        }
    }
}

@Composable
private fun ListRow(title: String, subtitle: String, onDelete: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
            if (subtitle.isNotBlank()) {
                Text(subtitle, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted, modifier = Modifier.padding(top = 2.dp))
            }
        }
        IconButton(onClick = onDelete) {
            Icon(Icons.Filled.Delete, contentDescription = "Удалить", tint = DvTheme.colors.error.copy(alpha = 0.7f))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TwoFieldAddSheet(
    title: String,
    label1: String,
    label2: String,
    onDismiss: () -> Unit,
    onSave: (String, String) -> Unit,
) {
    var f1 by remember { mutableStateOf("") }
    var f2 by remember { mutableStateOf("") }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        Column(modifier = Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)
            OutlinedTextField(value = f1, onValueChange = { f1 = it }, label = { Text(label1) }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = f2, onValueChange = { f2 = it }, label = { Text(label2) }, singleLine = true, modifier = Modifier.fillMaxWidth())
            DvPrimaryButton(onClick = { onSave(f1, f2) }, enabled = f1.isNotBlank(), modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) {
                Text("Добавить")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ThreeFieldAddSheet(
    title: String,
    label1: String,
    label2: String,
    label3: String,
    field3Numeric: Boolean = false,
    onDismiss: () -> Unit,
    onSave: (String, String, String) -> Unit,
) {
    var f1 by remember { mutableStateOf("") }
    var f2 by remember { mutableStateOf("") }
    var f3 by remember { mutableStateOf("") }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        Column(modifier = Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)
            OutlinedTextField(value = f1, onValueChange = { f1 = it }, label = { Text(label1) }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = f2, onValueChange = { f2 = it }, label = { Text(label2) }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(
                value = f3,
                onValueChange = { v -> f3 = if (field3Numeric) v.filter { it.isDigit() } else v },
                label = { Text(label3) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            DvPrimaryButton(onClick = { onSave(f1, f2, f3) }, enabled = f1.isNotBlank(), modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) {
                Text("Добавить")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditProfileSheet(viewModel: ProfileViewModel) {
    val form by viewModel.editForm.collectAsStateWithLifecycle()
    val current = form ?: return
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val context = LocalContext.current
    val pickPhoto = androidx.activity.compose.rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) viewModel.setPhotoFromUri(context, uri)
    }

    ModalBottomSheet(onDismissRequest = viewModel::dismissEdit, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Редактировать профиль", style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)

            Box(modifier = Modifier.padding(vertical = 4.dp)) {
                ProfileAvatar(name = current.firstName + " " + current.lastName, photoUrl = current.photoUrl, size = 72.dp)
                IconButton(
                    onClick = { pickPhoto.launch("image/*") },
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .size(28.dp)
                        .background(DvTheme.colors.gold, CircleShape),
                ) {
                    Icon(Icons.Filled.CameraAlt, contentDescription = "Загрузить фото", tint = DvTheme.colors.goldOn, modifier = Modifier.size(16.dp))
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = current.firstName, onValueChange = { v -> viewModel.updateEdit { it.copy(firstName = v) } }, label = { Text("Имя") }, singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(value = current.lastName, onValueChange = { v -> viewModel.updateEdit { it.copy(lastName = v) } }, label = { Text("Фамилия") }, singleLine = true, modifier = Modifier.weight(1f))
            }
            OutlinedTextField(value = current.username, onValueChange = { v -> viewModel.updateEdit { it.copy(username = v) } }, label = { Text("Юзернейм") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = current.headline, onValueChange = { v -> viewModel.updateEdit { it.copy(headline = v) } }, label = { Text("Заголовок визитки") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = current.bio, onValueChange = { v -> viewModel.updateEdit { it.copy(bio = v) } }, label = { Text("О себе") }, modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = current.city, onValueChange = { v -> viewModel.updateEdit { it.copy(city = v) } }, label = { Text("Город") }, singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(value = current.country, onValueChange = { v -> viewModel.updateEdit { it.copy(country = v) } }, label = { Text("Страна") }, singleLine = true, modifier = Modifier.weight(1f))
            }
            OutlinedTextField(value = current.spec, onValueChange = { v -> viewModel.updateEdit { it.copy(spec = v) } }, label = { Text("Специализация") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(
                value = current.experienceYears,
                onValueChange = { v -> viewModel.updateEdit { it.copy(experienceYears = v.filter { c -> c.isDigit() }) } },
                label = { Text("Лет опыта") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = current.phone, onValueChange = { v -> viewModel.updateEdit { it.copy(phone = v) } }, label = { Text("Телефон") }, singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(value = current.email, onValueChange = { v -> viewModel.updateEdit { it.copy(email = v) } }, label = { Text("Email") }, singleLine = true, modifier = Modifier.weight(1f))
            }

            current.error?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error)
            }

            DvPrimaryButton(
                onClick = { viewModel.saveEdit {} },
                enabled = !current.saving,
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            ) {
                if (current.saving) {
                    CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.goldOn, modifier = Modifier.size(18.dp))
                } else {
                    Text("Сохранить")
                }
            }
        }
    }
}
