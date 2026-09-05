package kz.dentvision.crm.ui.marketing

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.ViewCarousel
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kz.dentvision.crm.data.model.StoredIdea
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvBadge
import kz.dentvision.crm.ui.theme.DvBadgeVariant
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

private val FORMAT_LABEL = mapOf(
    "post" to "Пост",
    "reels" to "Reels",
    "story" to "Сторис",
    "carousel" to "Карусель",
)

/** Открытый план: идеи, правка на месте, генерация обложки/слайдов. */
@Composable
fun MarketingPlanScreen(planId: String, viewModel: MarketingPlanViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(planId) { viewModel.ensureLoaded(planId) }

    val quota = state.quota
    val canGenerateImages = quota != null && quota.configured && quota.remaining > 0

    when (val plan = state.plan) {
        is UiState.Loading -> LoadingSkeleton()
        is UiState.Error -> ErrorState(message = plan.message, onRetry = { viewModel.load(planId) })
        is UiState.Data -> Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(plan.value.title, style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)

            if (plan.value.deterministic) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
                    border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
                ) {
                    Text(
                        "План собран без языковой модели — только из фактов клиники. Формулировки суше, но ничего не выдумано.",
                        style = MaterialTheme.typography.bodySmall,
                        color = DvTheme.colors.textSecondary,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }

            quota?.let {
                Text(
                    if (it.configured) "Картинок сегодня: ${it.remaining} из ${it.limit}" else "Генерация картинок не настроена",
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                )
            }

            state.message?.let { msg ->
                LaunchedEffect(msg) { delay(3000); viewModel.consumeMessage() }
                Text(msg, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.warning)
            }

            plan.value.ideas.forEach { idea ->
                IdeaCard(
                    idea = idea,
                    canGenerateImages = canGenerateImages,
                    busy = state.busyIdeaId == idea.id,
                    onSave = { title, hook, caption, cta, tags -> viewModel.saveIdea(idea.id, title, hook, caption, cta, tags) },
                    onCover = { viewModel.generateCover(idea.id) },
                    onCarousel = { viewModel.generateCarousel(idea.id) },
                )
            }
        }
    }
}

@Composable
private fun IdeaCard(
    idea: StoredIdea,
    canGenerateImages: Boolean,
    busy: Boolean,
    onSave: (String, String, String, String, List<String>) -> Unit,
    onCover: () -> Unit,
    onCarousel: () -> Unit,
) {
    var editing by remember(idea.id) { mutableStateOf(false) }
    var title by remember(idea.id, editing) { mutableStateOf(idea.title) }
    var hook by remember(idea.id, editing) { mutableStateOf(idea.hook) }
    var caption by remember(idea.id, editing) { mutableStateOf(idea.caption) }
    var hashtags by remember(idea.id, editing) { mutableStateOf(idea.hashtags.joinToString(" ")) }
    var cta by remember(idea.id, editing) { mutableStateOf(idea.callToAction) }
    val clipboard = LocalClipboardManager.current

    val dirty = editing && (
        title != idea.title || hook != idea.hook || caption != idea.caption ||
            hashtags != idea.hashtags.joinToString(" ") || cta != idea.callToAction
        )

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(idea.title, style = MaterialTheme.typography.titleSmall, color = DvTheme.colors.textPrimary, modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                DvBadge(text = FORMAT_LABEL[idea.format] ?: idea.format, variant = DvBadgeVariant.INFO)
                if (idea.edited) DvBadge(text = "отредактировано", variant = DvBadgeVariant.DEFAULT)
            }

            if (editing) {
                OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Заголовок") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = hook, onValueChange = { hook = it }, label = { Text("Хук") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = caption, onValueChange = { caption = it }, label = { Text("Подпись") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = hashtags, onValueChange = { hashtags = it }, label = { Text("Хештеги через пробел") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = cta, onValueChange = { cta = it }, label = { Text("Призыв к действию") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    DvPrimaryButton(
                        onClick = {
                            onSave(title, hook, caption, cta, hashtags.split(Regex("\\s+")).map { it.trim() }.filter { it.isNotBlank() })
                            editing = false
                        },
                        enabled = dirty,
                    ) { Text("Сохранить") }
                    TextButton(onClick = { editing = false }) { Text("Отмена") }
                }
            } else {
                Text(idea.hook, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.gold)
                Text(idea.caption, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textSecondary)
                if (idea.hashtags.isNotEmpty()) {
                    Text(
                        idea.hashtags.joinToString(" ") { if (it.startsWith("#")) it else "#$it" },
                        style = MaterialTheme.typography.labelSmall,
                        color = DvTheme.colors.textMuted,
                    )
                }

                val images = listOfNotNull(idea.coverUrl) + idea.slideUrls
                if (busy) {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(3),
                        modifier = Modifier.fillMaxWidth().aspectRatio(if (idea.format == "carousel") 3f else 1f),
                    ) {
                        items(if (idea.format == "carousel") 3 else 1) {
                            CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.gold, modifier = Modifier.padding(8.dp))
                        }
                    }
                } else if (images.isNotEmpty()) {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(3),
                        modifier = Modifier.fillMaxWidth().aspectRatio(images.size.coerceAtMost(3) / 1f),
                    ) {
                        items(images) { url ->
                            AsyncImage(
                                model = url,
                                contentDescription = null,
                                modifier = Modifier.aspectRatio(1f).clip(RoundedCornerShape(8.dp)),
                            )
                        }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = onCover, enabled = canGenerateImages && !busy) {
                        Icon(Icons.Filled.Image, contentDescription = null, modifier = Modifier.padding(end = 4.dp))
                        Text(if (idea.coverUrl != null) "Другая обложка" else "Обложка")
                    }
                    if (idea.format == "carousel") {
                        TextButton(onClick = onCarousel, enabled = canGenerateImages && !busy) {
                            Icon(Icons.Filled.ViewCarousel, contentDescription = null, modifier = Modifier.padding(end = 4.dp))
                            Text("Слайды")
                        }
                    }
                    TextButton(onClick = {
                        val text = listOf(idea.hook, "", idea.caption, "", idea.hashtags.joinToString(" "), "", idea.callToAction).joinToString("\n")
                        clipboard.setText(AnnotatedString(text))
                    }) {
                        Icon(Icons.Filled.ContentCopy, contentDescription = null, modifier = Modifier.padding(end = 4.dp))
                        Text("Копировать")
                    }
                    TextButton(onClick = { editing = true }) { Text("Править") }
                }

                Card(
                    colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface0),
                    border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text("Призыв: ${idea.callToAction}", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
                        Text("Опирается на: ${idea.basedOn}", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
                    }
                }
            }
        }
    }
}
