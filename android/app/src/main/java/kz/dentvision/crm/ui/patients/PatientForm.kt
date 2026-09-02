package kz.dentvision.crm.ui.patients

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kz.dentvision.crm.data.model.NO_IIN_REASONS
import kz.dentvision.crm.lib.normalizeIin
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Новая карта пациента.
 *
 * ИИН — первое поле, и это не вопрос вёрстки: в Казахстане он главный
 * идентификатор человека, поэтому с него начинается разговор у стойки. Кнопка
 * «Проверить» отвечает тем, что система уже знает, вместо того чтобы
 * переспрашивать.
 *
 * Если ИИН назвать нельзя — иностранец, нет документа — нужна явная причина.
 * Это требование бэкенда, и обходить его молча нельзя: иначе справочник ИИН
 * перестанет достраиваться, ради чего он и заводился.
 */
@Composable
fun PatientForm(viewModel: PatientsViewModel, onSaved: () -> Unit) {
    val form by viewModel.form.collectAsStateWithLifecycle()

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
            text = "Новый пациент",
            style = MaterialTheme.typography.titleLarge,
            color = DvTheme.colors.textPrimary,
            modifier = Modifier.padding(bottom = 4.dp),
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = form.iin,
                onValueChange = { value -> viewModel.updateForm { it.copy(iin = normalizeIin(value).take(12)) } },
                label = { Text("ИИН") },
                singleLine = true,
                isError = form.iinLooksWrong,
                supportingText = if (form.iinLooksWrong) {
                    { Text("Контрольная цифра не сходится") }
                } else {
                    null
                },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f),
            )
            OutlinedButton(
                onClick = viewModel::checkIin,
                enabled = form.iinDigits.length == 12 && !form.checking,
            ) {
                if (form.checking) {
                    CircularProgressIndicator(
                        strokeWidth = 2.dp,
                        color = DvTheme.colors.gold,
                        modifier = Modifier.size(16.dp),
                    )
                } else {
                    Text("Проверить")
                }
            }
        }

        form.lookupNote?.let { note ->
            Text(
                text = note,
                style = MaterialTheme.typography.bodySmall,
                color = if (form.lookup?.existing != null) DvTheme.colors.warning else DvTheme.colors.info,
            )
        }

        Text(
            text = "Если ИИН назвать нельзя — укажите причину",
            style = MaterialTheme.typography.labelMedium,
            color = DvTheme.colors.textGhost,
            modifier = Modifier.padding(top = 4.dp),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            NO_IIN_REASONS.forEach { (value, label) ->
                FilterChip(
                    selected = form.noIinReason == value,
                    onClick = {
                        viewModel.updateForm {
                            it.copy(noIinReason = if (it.noIinReason == value) "" else value)
                        }
                    },
                    label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                )
            }
        }

        OutlinedTextField(
            value = form.name,
            onValueChange = { value -> viewModel.updateForm { it.copy(name = value) } },
            label = { Text("ФИО") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.phone,
            onValueChange = { value -> viewModel.updateForm { it.copy(phone = value) } },
            label = { Text("Телефон") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.email,
            onValueChange = { value -> viewModel.updateForm { it.copy(email = value) } },
            label = { Text("Почта") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedTextField(
                value = form.dob,
                onValueChange = { value -> viewModel.updateForm { it.copy(dob = value) } },
                label = { Text("Дата рождения") },
                placeholder = { Text("ГГГГ-ММ-ДД") },
                singleLine = true,
                modifier = Modifier.weight(1f),
            )
            AssistChip(
                onClick = {
                    viewModel.updateForm {
                        it.copy(gender = if (it.gender == "male") "female" else "male")
                    }
                },
                label = {
                    Text(
                        when (form.gender) {
                            "male" -> "Мужской"
                            "female" -> "Женский"
                            else -> "Пол"
                        },
                    )
                },
                colors = AssistChipDefaults.assistChipColors(labelColor = DvTheme.colors.textSecondary),
                modifier = Modifier.padding(top = 8.dp),
            )
        }

        OutlinedTextField(
            value = form.notes,
            onValueChange = { value -> viewModel.updateForm { it.copy(notes = value) } },
            label = { Text("Заметки") },
            minLines = 2,
            modifier = Modifier.fillMaxWidth(),
        )

        form.error?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.error,
            )
        }

        Button(
            onClick = { viewModel.save(onSaved) },
            enabled = form.canSave,
            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
        ) {
            if (form.saving) {
                CircularProgressIndicator(
                    strokeWidth = 2.dp,
                    color = DvTheme.colors.goldOn,
                    modifier = Modifier.size(18.dp),
                )
            } else {
                Text("Сохранить")
            }
        }
    }
}
