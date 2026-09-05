package kz.dentvision.crm.ui.diagnostics

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.DiagnosticsRepository
import kz.dentvision.crm.data.model.AnatomicalSites
import kz.dentvision.crm.data.model.CreateReferralRequest
import kz.dentvision.crm.data.model.DiagnosticOrg
import kz.dentvision.crm.data.model.PricingItem
import kz.dentvision.crm.data.model.UploadFileRequest
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme
import java.util.UUID

/** Локальный тумблер «3D / лабораторные» — только выбирает пикер и статический список, на проводе не появляется как есть. */
enum class DiagCategory { THREE_D, LABORATORY }

/** Перенос `STUDY_TYPES` (`ReferralForm.tsx:24`) — дословно, оба подмножества `DiagnosticCategory`. */
private val STUDY_TYPES_3D = listOf(
    "CBCT" to "CBCT (КЛКТ)",
    "OPG" to "ОПГ (Панорамный)",
    "TRG" to "ТРГ (Телерентгенограмма)",
    "TMJ" to "ВНЧС",
    "STL" to "STL-скан",
    "FACE_SCAN" to "Face Scan",
    "DICOM" to "DICOM-загрузка",
)
private val STUDY_TYPES_LAB = listOf(
    "ALLERGY" to "Аллергопробы",
    "HISTOLOGY" to "Гистология",
    "PCR" to "ПЦР",
    "MICROBIOLOGY" to "Микробиология",
    "BLOOD" to "Анализ крови",
    "GENETICS" to "Генетика",
    "BIOPSY" to "Биопсия",
    "SALIVA" to "Анализ слюны",
    "PATHOLOGY" to "Патология",
    "OTHER" to "Другое",
)

private const val MAX_FILE_BYTES = 10 * 1024 * 1024

data class PendingFile(
    val id: String,
    val fileName: String,
    val fileType: String,
    val fileSize: Long,
    val dataUri: String,
)

data class ReferralFormState(
    val category: DiagCategory = DiagCategory.THREE_D,
    val org: DiagnosticOrg? = null,
    val pricing: List<PricingItem> = emptyList(),
    val loadingPricing: Boolean = false,
    val studyType: String = "",
    val studyCategory: String = "",
    val priority: String = "NORMAL",
    val teeth: List<Int> = emptyList(),
    val patientName: String = "",
    val patientIin: String = "",
    val patientBirth: String = "",
    val patientGender: String = "",
    val patientPhone: String = "",
    val patientEmail: String = "",
    val pregnancy: Boolean = false,
    val allergies: String = "",
    val specialNotes: String = "",
    val complaints: String = "",
    val preliminaryDx: String = "",
    val studyGoal: String = "",
    val commentForLab: String = "",
    val files: List<PendingFile> = emptyList(),
    val saving: Boolean = false,
    val error: String? = null,
    val message: String? = null,
) {
    val canSave: Boolean get() = patientName.isNotBlank() && studyType.isNotBlank() && !saving
}

/**
 * Перенос `ReferralForm.tsx` + `FileUploader.tsx`/`image-upload.ts` +
 * `ToothSelector.tsx`. Файлы буферизуются в памяти как полный
 * `data:<mime>;base64,...` URI и грузятся уже после успешного создания
 * направления, тем же порядком, что `createMutation.onSuccess` веба —
 * `POST /files/upload` требует существующий `referralId`.
 */
class ReferralFormViewModel(
    private val repository: DiagnosticsRepository = DiagnosticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(ReferralFormState())
    val state: StateFlow<ReferralFormState> = _state

    fun setCategory(category: DiagCategory) {
        _state.update { it.copy(category = category, org = null, pricing = emptyList(), studyType = "", studyCategory = "") }
    }

    fun selectOrg(org: DiagnosticOrg) {
        _state.update { it.copy(org = org, studyType = "", studyCategory = "", loadingPricing = true) }
        viewModelScope.launch {
            val category = _state.value.category
            runCatching {
                if (category == DiagCategory.THREE_D) repository.centerPricing(org.id) else repository.labPricing(org.id)
            }
                .onSuccess { list -> _state.update { it.copy(pricing = list.filter { p -> p.active }, loadingPricing = false) } }
                .onFailure { _state.update { it.copy(pricing = emptyList(), loadingPricing = false) } }
        }
    }

    fun pickStudy(studyType: String, studyCategory: String) {
        _state.update { it.copy(studyType = studyType, studyCategory = studyCategory) }
    }

    fun update(block: (ReferralFormState) -> ReferralFormState) {
        _state.update(block)
    }

    fun addFile(resolver: ContentResolver, uri: Uri) {
        viewModelScope.launch(Dispatchers.IO) {
            runCatching {
                val bytes = resolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: error("Не удалось прочитать файл")
                if (bytes.size > MAX_FILE_BYTES) error("Файл больше 10 МБ")
                val mime = resolver.getType(uri) ?: "application/octet-stream"
                val name = displayName(resolver, uri) ?: uri.lastPathSegment ?: "файл"
                val dataUri = "data:$mime;base64,${Base64.encodeToString(bytes, Base64.NO_WRAP)}"
                PendingFile(id = UUID.randomUUID().toString(), fileName = name, fileType = mime, fileSize = bytes.size.toLong(), dataUri = dataUri)
            }
                .onSuccess { file -> _state.update { it.copy(files = it.files + file) } }
                .onFailure { e -> _state.update { it.copy(error = e.message ?: "Не удалось добавить файл") } }
        }
    }

    fun removeFile(id: String) {
        _state.update { it.copy(files = it.files.filterNot { f -> f.id == id }) }
    }

    private fun displayName(resolver: ContentResolver, uri: Uri): String? =
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (!cursor.moveToFirst()) return@use null
            val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (idx >= 0) cursor.getString(idx) else null
        }

    fun save(clinicId: String?, onSaved: (String) -> Unit) {
        val f = _state.value
        if (!f.canSave) return
        if (clinicId == null) {
            _state.update { it.copy(error = "Нет привязанной клиники") }
            return
        }
        _state.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            val request = CreateReferralRequest(
                patientName = f.patientName.trim(),
                patientIin = f.patientIin.trim().ifBlank { null },
                patientBirth = f.patientBirth.trim().ifBlank { null },
                patientGender = f.patientGender.ifBlank { null },
                patientPhone = f.patientPhone.trim().ifBlank { null },
                patientEmail = f.patientEmail.trim().ifBlank { null },
                pregnancy = f.pregnancy,
                allergies = f.allergies.trim().ifBlank { null },
                specialNotes = f.specialNotes.trim().ifBlank { null },
                clinicId = clinicId,
                category = f.studyCategory.ifBlank { f.studyType },
                studyType = f.studyType,
                anatomicalSites = if (f.teeth.isNotEmpty()) AnatomicalSites(f.teeth) else null,
                complaints = f.complaints.trim().ifBlank { null },
                preliminaryDx = f.preliminaryDx.trim().ifBlank { null },
                studyGoal = f.studyGoal.trim().ifBlank { null },
                commentForLab = f.commentForLab.trim().ifBlank { null },
                priority = f.priority,
                centerId = if (f.category == DiagCategory.THREE_D) f.org?.id else null,
                labId = if (f.category == DiagCategory.LABORATORY) f.org?.id else null,
            )
            runCatching { repository.createReferral(request) }
                .onSuccess { referral ->
                    for (file in f.files) {
                        runCatching {
                            repository.uploadFile(
                                UploadFileRequest(
                                    referralId = referral.id,
                                    fileName = file.fileName,
                                    fileData = file.dataUri,
                                    fileType = file.fileType,
                                    fileSize = file.fileSize,
                                ),
                            )
                        }.onFailure {
                            _state.update { s -> s.copy(message = "Направление создано, но файл «${file.fileName}» не загрузился") }
                        }
                    }
                    _state.update { it.copy(saving = false) }
                    onSaved(referral.id)
                }
                .onFailure { e ->
                    _state.update { it.copy(saving = false, error = e.message ?: "Не удалось создать направление") }
                }
        }
    }
}

@Composable
fun ReferralFormScreen(
    session: Session,
    onSaved: (String) -> Unit,
    viewModel: ReferralFormViewModel = viewModel(),
) {
    val form by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var pickingOrg by remember { mutableStateOf(false) }

    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { viewModel.addFile(context.contentResolver, it) }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .imePadding()
            .navigationBarsPadding()
            .padding(horizontal = 20.dp)
            .padding(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = "Новое направление",
            style = MaterialTheme.typography.titleLarge,
            color = DvTheme.colors.textPrimary,
            modifier = Modifier.padding(bottom = 4.dp),
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = form.category == DiagCategory.THREE_D,
                onClick = { viewModel.setCategory(DiagCategory.THREE_D) },
                label = { Text("3D-диагностика") },
            )
            FilterChip(
                selected = form.category == DiagCategory.LABORATORY,
                onClick = { viewModel.setCategory(DiagCategory.LABORATORY) },
                label = { Text("Лабораторные исследования") },
            )
        }

        DvOutlineButton(onClick = { pickingOrg = true }, modifier = Modifier.fillMaxWidth()) {
            Text(
                form.org?.name?.ifBlank { null }
                    ?: if (form.category == DiagCategory.THREE_D) "Выбрать диагностический центр" else "Выбрать лабораторию",
            )
        }

        StudyPicker(form, onPick = viewModel::pickStudy)

        Text("Приоритет", style = MaterialTheme.typography.labelMedium, color = DvTheme.colors.textGhost)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("NORMAL" to "Обычный", "URGENT" to "Срочно", "EMERGENCY" to "Экстренно").forEach { (value, label) ->
                FilterChip(
                    selected = form.priority == value,
                    onClick = { viewModel.update { it.copy(priority = value) } },
                    label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                )
            }
        }

        OutlinedTextField(
            value = form.patientName,
            onValueChange = { v -> viewModel.update { it.copy(patientName = v) } },
            label = { Text("ФИО пациента") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.patientIin,
            onValueChange = { v -> viewModel.update { it.copy(patientIin = v.filter { c -> c.isDigit() }.take(12)) } },
            label = { Text("ИИН") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = form.patientBirth,
                onValueChange = { v -> viewModel.update { it.copy(patientBirth = v) } },
                label = { Text("Дата рождения") },
                placeholder = { Text("ГГГГ-ММ-ДД") },
                singleLine = true,
                modifier = Modifier.weight(1f),
            )
            FilterChip(
                selected = form.patientGender.isNotBlank(),
                onClick = {
                    viewModel.update { it.copy(patientGender = if (it.patientGender == "male") "female" else "male") }
                },
                label = {
                    Text(
                        when (form.patientGender) {
                            "male" -> "Мужской"
                            "female" -> "Женский"
                            else -> "Пол"
                        },
                    )
                },
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        OutlinedTextField(
            value = form.patientPhone,
            onValueChange = { v -> viewModel.update { it.copy(patientPhone = v) } },
            label = { Text("Телефон") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.patientEmail,
            onValueChange = { v -> viewModel.update { it.copy(patientEmail = v) } },
            label = { Text("Почта") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = form.pregnancy, onCheckedChange = { v -> viewModel.update { it.copy(pregnancy = v) } })
            Text("Беременность", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textSecondary)
        }
        OutlinedTextField(
            value = form.allergies,
            onValueChange = { v -> viewModel.update { it.copy(allergies = v) } },
            label = { Text("Аллергии") },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.complaints,
            onValueChange = { v -> viewModel.update { it.copy(complaints = v) } },
            label = { Text("Жалобы") },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.preliminaryDx,
            onValueChange = { v -> viewModel.update { it.copy(preliminaryDx = v) } },
            label = { Text("Предварительный диагноз") },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.commentForLab,
            onValueChange = { v -> viewModel.update { it.copy(commentForLab = v) } },
            label = { Text("Комментарий для лаборатории/центра") },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.specialNotes,
            onValueChange = { v -> viewModel.update { it.copy(specialNotes = v) } },
            label = { Text("Особые заметки") },
            modifier = Modifier.fillMaxWidth(),
        )

        Text("Зубы (необязательно)", style = MaterialTheme.typography.labelMedium, color = DvTheme.colors.textGhost)
        ToothSelector(selected = form.teeth, onChange = { teeth -> viewModel.update { it.copy(teeth = teeth) } })

        Text("Файлы", style = MaterialTheme.typography.labelMedium, color = DvTheme.colors.textGhost)
        form.files.forEach { file ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = file.fileName,
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textPrimary,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = { viewModel.removeFile(file.id) }) {
                    Icon(Icons.Filled.Close, contentDescription = "Убрать файл", tint = DvTheme.colors.textMuted)
                }
            }
        }
        DvOutlineButton(onClick = { filePicker.launch("*/*") }, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Filled.AttachFile, contentDescription = null, modifier = Modifier.padding(end = 6.dp))
            Text("Добавить файл")
        }

        form.message?.let {
            Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.warning)
        }
        form.error?.let {
            Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error)
        }

        DvPrimaryButton(
            onClick = { viewModel.save(session.clinic?.id, onSaved) },
            enabled = form.canSave,
            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
        ) {
            if (form.saving) {
                CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.goldOn, modifier = Modifier.padding(2.dp))
            } else {
                Text("Отправить направление")
            }
        }
    }

    if (pickingOrg) {
        DiagnosticOrgPickerSheet(
            kind = if (form.category == DiagCategory.THREE_D) DiagnosticOrgKind.CENTER else DiagnosticOrgKind.LABORATORY,
            onDismiss = { pickingOrg = false },
            onSelect = { org ->
                viewModel.selectOrg(org)
                pickingOrg = false
            },
        )
    }
}

@Composable
private fun StudyPicker(form: ReferralFormState, onPick: (String, String) -> Unit) {
    val fromPricing = form.pricing.isNotEmpty()
    val staticList = if (form.category == DiagCategory.THREE_D) STUDY_TYPES_3D else STUDY_TYPES_LAB

    Text("Услуга", style = MaterialTheme.typography.labelMedium, color = DvTheme.colors.textGhost)
    if (fromPricing) {
        Column {
            form.pricing.forEach { item ->
                val price = item.price?.toDoubleOrNull()
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onPick(item.name, item.category) }
                        .padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = item.name,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (form.studyType == item.name) DvTheme.colors.gold else DvTheme.colors.textPrimary,
                    )
                    if (price != null && price > 0) {
                        Text(text = "${price.toInt()} ₸", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
                    }
                }
            }
        }
    } else {
        if (form.org != null && !form.loadingPricing) {
            Text(
                text = "У выбранного учреждения пока нет прайс-листа — центр установит цену при принятии",
                style = MaterialTheme.typography.labelSmall,
                color = DvTheme.colors.textGhost,
            )
        }
        Column {
            staticList.forEach { (value, label) ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onPick(value, value) }
                        .padding(vertical = 8.dp),
                ) {
                    Text(
                        text = label,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (form.studyType == value) DvTheme.colors.gold else DvTheme.colors.textPrimary,
                    )
                }
            }
        }
    }
}
