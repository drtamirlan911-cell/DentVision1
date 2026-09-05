package kz.dentvision.crm.ui.community

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.School
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
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.lib.formatDate
import kz.dentvision.crm.data.model.CommunityComment
import kz.dentvision.crm.data.model.CommunityPost
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Перенос `Community.tsx`, урезанный до ленты (`Лента`/`Сохранённые`),
 * лайков, сохранений и комментариев — вкладка «Сообщения» (личные чаты,
 * `MessagesPanel`) намеренно не перенесена, это отдельная подсистема со
 * своим API (маршруты `api/community/dm`). Лента и комментарии видны гостю
 * (`optionalAuth` на сервере), публикация/лайк/сохранение/комментарий —
 * только вошедшим по-настоящему, как в `Jobs.tsx`.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun CommunityScreen(
    isAuthenticated: Boolean,
    onRequireLogin: () -> Unit,
    onOpenSchool: () -> Unit,
    viewModel: CommunityViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var openCommentsFor by remember { mutableStateOf<String?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { viewModel.start() }

    LaunchedEffect(state.error) {
        val message = state.error ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        viewModel.consumeError()
    }

    Scaffold(
        containerColor = DvTheme.colors.surface0,
        snackbarHost = {
            SnackbarHost(snackbarHostState) { data -> Snackbar(snackbarData = data, containerColor = DvTheme.colors.surface3) }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // Перенос кнопки «Курсы» из `Community.tsx:246-247` — ведёт в
            // Academy (здесь: витрину «Магазин и школа» на вкладке «Школа»).
            Row(modifier = Modifier.fillMaxWidth().padding(start = 16.dp, top = 8.dp, end = 16.dp), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onOpenSchool) {
                    Icon(Icons.Filled.School, contentDescription = null, modifier = Modifier.size(16.dp))
                    Text(text = "Курсы", modifier = Modifier.padding(start = 6.dp))
                }
            }
            if (isAuthenticated) {
                TabRow(
                    selectedTabIndex = if (state.tab == CommunityTab.FEED) 0 else 1,
                    containerColor = DvTheme.colors.surface1,
                    contentColor = DvTheme.colors.gold,
                ) {
                    Tab(
                        selected = state.tab == CommunityTab.FEED,
                        onClick = { viewModel.setTab(CommunityTab.FEED) },
                        text = { Text("Лента", style = MaterialTheme.typography.labelLarge) },
                    )
                    Tab(
                        selected = state.tab == CommunityTab.SAVED,
                        onClick = { viewModel.setTab(CommunityTab.SAVED) },
                        text = { Text("Сохранённые", style = MaterialTheme.typography.labelLarge) },
                    )
                }
            }

            if (state.tab == CommunityTab.FEED) {
                if (isAuthenticated) {
                    PublishBox(
                        draft = state.draft,
                        publishing = state.publishing,
                        onDraftChange = viewModel::onDraftChange,
                        onPublish = viewModel::publish,
                    )
                } else {
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(16.dp, 12.dp, 16.dp, 0.dp),
                        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
                        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = "Войдите, чтобы публиковать, лайкать и сохранять",
                                style = MaterialTheme.typography.bodySmall,
                                color = DvTheme.colors.textMuted,
                                modifier = Modifier.weight(1f).padding(end = 8.dp),
                            )
                            DvPrimaryButton(onClick = onRequireLogin) { Text("Войти") }
                        }
                    }
                }
                // FlowRow, а не горизонтальный скролл: на телефоне обрезанный
                // край без явного намёка на свайп выглядит как поломка, а все
                // 7 тем на 2 строках видно сразу.
                FlowRow(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    COMMUNITY_TOPICS.forEach { topic ->
                        FilterChip(
                            selected = state.topic == topic,
                            onClick = { viewModel.setTopic(topic) },
                            label = { Text(topic) },
                        )
                    }
                }
            }

            when (val posts = state.posts) {
                is UiState.Loading -> LoadingSkeleton(modifier = Modifier.padding(top = 8.dp))
                is UiState.Error -> ErrorState(message = posts.message, onRetry = viewModel::retry)
                is UiState.Data -> if (posts.value.isEmpty()) {
                    EmptyStateView(
                        title = if (state.tab == CommunityTab.SAVED) "Нет сохранённых" else "Лента пуста",
                        description = if (state.tab == CommunityTab.SAVED) "Нажмите закладку на посте, чтобы сохранить." else "Опубликуйте первый тред.",
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(posts.value, key = { it.id }) { post ->
                            PostCard(
                                post = post,
                                onLike = { if (isAuthenticated) viewModel.toggleLike(post.id) else onRequireLogin() },
                                onSave = { if (isAuthenticated) viewModel.toggleSave(post.id) else onRequireLogin() },
                                onComments = {
                                    openCommentsFor = post.id
                                    viewModel.openComments(post.id)
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    val commentsPostId = openCommentsFor
    if (commentsPostId != null) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { openCommentsFor = null },
            sheetState = sheetState,
            containerColor = DvTheme.colors.surface1,
        ) {
            CommentsSheet(
                viewModel = viewModel,
                isAuthenticated = isAuthenticated,
                onRequireLogin = onRequireLogin,
            )
        }
    }
}

@Composable
private fun PublishBox(draft: String, publishing: Boolean, onDraftChange: (String) -> Unit, onPublish: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(16.dp, 12.dp, 16.dp, 0.dp),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            OutlinedTextField(
                value = draft,
                onValueChange = onDraftChange,
                placeholder = { Text("Поделитесь кейсом, вопросом или протоколом…") },
                minLines = 3,
                modifier = Modifier.fillMaxWidth(),
            )
            Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.End) {
                DvPrimaryButton(onClick = onPublish, enabled = draft.isNotBlank() && !publishing) {
                    Text(if (publishing) "Публикация…" else "Опубликовать")
                }
            }
        }
    }
}

@Composable
private fun PostCard(post: CommunityPost, onLike: () -> Unit, onSave: () -> Unit, onComments: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                text = post.authorName.ifBlank { "Пользователь" },
                style = MaterialTheme.typography.titleSmall,
                color = DvTheme.colors.textPrimary,
            )
            val meta = listOfNotNull(post.authorRole.ifBlank { null }, formatDate(post.createdAt)).joinToString(" · ")
            if (meta.isNotBlank()) {
                Text(text = meta, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
            }
            Text(
                text = post.content,
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.textSecondary,
                modifier = Modifier.padding(top = 8.dp),
            )
            if (post.tags.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 8.dp)) {
                    post.tags.take(4).forEach {
                        Text(text = "#$it", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.gold)
                    }
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickableRow(onLike)) {
                    Icon(
                        imageVector = if (post.liked) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                        contentDescription = "Нравится",
                        tint = if (post.liked) DvTheme.colors.error else DvTheme.colors.textMuted,
                        modifier = Modifier.height(16.dp),
                    )
                    Text(
                        text = "${post.likesCount}",
                        style = MaterialTheme.typography.labelSmall,
                        color = DvTheme.colors.textMuted,
                        modifier = Modifier.padding(start = 4.dp),
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickableRow(onComments)) {
                    Icon(
                        Icons.Filled.ChatBubbleOutline,
                        contentDescription = "Комментарии",
                        tint = DvTheme.colors.textMuted,
                        modifier = Modifier.height(16.dp),
                    )
                    Text(
                        text = "${post.commentsCount}",
                        style = MaterialTheme.typography.labelSmall,
                        color = DvTheme.colors.textMuted,
                        modifier = Modifier.padding(start = 4.dp),
                    )
                }
                androidx.compose.foundation.layout.Spacer(modifier = Modifier.weight(1f))
                IconButton(onClick = onSave) {
                    Icon(
                        imageVector = if (post.saved) Icons.Filled.Bookmark else Icons.Filled.BookmarkBorder,
                        contentDescription = "Сохранить",
                        tint = if (post.saved) DvTheme.colors.gold else DvTheme.colors.textMuted,
                    )
                }
            }
        }
    }
}

@Composable
private fun CommentsSheet(viewModel: CommunityViewModel, isAuthenticated: Boolean, onRequireLogin: () -> Unit) {
    val comments by viewModel.comments.collectAsStateWithLifecycle()
    val state by viewModel.state.collectAsStateWithLifecycle()
    var draft by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxWidth().heightIn(min = 240.dp, max = 480.dp).imePadding().padding(16.dp)) {
        Text(text = "Комментарии", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)
        Column(modifier = Modifier.weight(1f).padding(top = 12.dp)) {
            when (val list = comments) {
                is UiState.Loading -> LoadingSkeleton(rows = 3)
                is UiState.Error -> ErrorState(message = list.message)
                is UiState.Data -> if (list.value.isEmpty()) {
                    Text(
                        text = "Пока тихо — напишите первым",
                        style = MaterialTheme.typography.bodySmall,
                        color = DvTheme.colors.textMuted,
                        modifier = Modifier.padding(vertical = 24.dp),
                    )
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        items(list.value, key = { it.id }) { CommentRow(it) }
                    }
                }
            }
        }
        Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = draft,
                onValueChange = { draft = it },
                placeholder = { Text("Комментарий…") },
                singleLine = true,
                modifier = Modifier.weight(1f),
            )
            IconButton(
                enabled = !state.sendingComment,
                onClick = {
                    if (!isAuthenticated) {
                        onRequireLogin()
                    } else if (draft.isNotBlank()) {
                        viewModel.sendComment(draft) { success -> if (success) draft = "" }
                    }
                },
            ) {
                if (state.sendingComment) {
                    CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(20.dp), color = DvTheme.colors.gold)
                } else {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Отправить", tint = DvTheme.colors.gold)
                }
            }
        }
    }
}

@Composable
private fun CommentRow(comment: CommunityComment) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(0.dp),
    ) {
        Text(text = comment.authorName.ifBlank { "Пользователь" }, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textPrimary)
        Text(text = comment.content, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textSecondary)
    }
}

private fun Modifier.clickableRow(onClick: () -> Unit): Modifier =
    this.clickable(onClick = onClick)
