# План: ИИ-сотрудник по ролям + дизайн «как у Apple» + сверка с репозиторием

Документ рассчитан на исполнение **дешёвой моделью по шагам**. Каждый этап
самостоятельный: свой файл, своя проверка, свой коммит. Не нужно держать в
голове весь документ — берите один этап и делайте ровно то, что в нём написано.

**Ветка:** `claude/business-logic-functions-review-xck4wl` (PR #233).
**Правило:** после каждого этапа — проверка (команды в этапе) и коммит.
**Правило:** веб (`src/`) — источник истины. Android повторяет веб, а не наоборот.

---

## Что уже есть (проверено, не переделывать)

| Что | Где | Состояние |
|---|---|---|
| Реестр навыков ИИ, 11 штук, с правами по ролям | `dentvision-backend/src/modules/ai/os/skills.ts` | Готов, но **мёртв**: `skillsFor()` вызывается только из `skills.test.ts` |
| Ядро ИИ: права, скоуп, аудит, подтверждения | `dentvision-backend/src/modules/ai/os/kernel.ts` | Работает |
| Права пользователя на Android + проверка `has()` | `android/.../data/session/Session.kt:23,45` | Работает |
| Чат ИИ на Android | `android/.../ui/intelligence/IntelligenceScreen.kt` (585 строк) | Работает, но «немой»: не показывает, что умеет |
| Токены цвета/формы/шрифта Android | `android/.../ui/theme/{DvColors,Shape,Type}.kt` | Есть цвета и радиусы, **нет токенов отступов** |
| Подсказки ИИ на экранах | `android/.../ui/insights/AiInsightSection.kt` | Работает |

**Главный вывод:** «ИИ как сотрудник» не нужно изобретать — нужно подключить
то, что уже лежит в репозитории мёртвым грузом (`skillsFor`).

---

# ПРИНЦИПЫ ДИЗАЙНА «КАК У APPLE»

Это не вкусовщина, а 7 механических правил. Применяйте буквально.

**П1. Один акцент на экран.**
Золото (`DvTheme.colors.gold`, `goldFrom/goldTo`) — только для **одного**
главного действия на экране. Всё остальное — `surface2` + `borderSubtle`.
Сейчас золото на чипах, пузырях, кнопках и герое одновременно — это шум.

**П2. Никаких декоративных анимаций.**
Убрать: вращающиеся кольца, «дышащее» свечение, sweep-градиенты, пульсацию.
Оставить: индикатор загрузки, точки «печатает», плавное появление.
Анимация допустима, только если сообщает состояние.

**П3. Отступы — по шкале 4.**
Разрешены: `4, 8, 12, 16, 20, 24, 32`. Никаких `11.dp`, `14.dp`, `22.dp`.

**П4. Радиусы — только из `DvShapes`.**
`6 / 8 / 12 / 16 / 24`. Никаких `RoundedCornerShape(20.dp)` по месту.
Пилюли (чипы) — `RoundedCornerShape(50)`, это исключение и оно одно.

**П5. Границы вместо теней, один вес границы.**
`1.dp, DvTheme.colors.borderSubtle`. Не мешать `border` и `elevation`.

**П6. Типографика — 3 уровня на экран, не больше.**
Заголовок (`titleMedium`) → текст (`bodyMedium`) → подпись (`labelSmall`).
`headlineMedium` — только на пустых состояниях и главном экране.

**П7. Воздух.**
Между смысловыми блоками — `16.dp`. Внутри блока — `8.dp`.
Карточка: внутренний отступ `16.dp` (сейчас в разных местах 12/13/14).

---

# БЛОК A. Сверка с репозиторием

## Этап A1. Токены отступов (фундамент для всего блока «Дизайн»)

**Зачем:** без токенов правило П3 невозможно проверить.

**Создать файл** `android/app/src/main/java/kz/dentvision/crm/ui/theme/DvSpacing.kt`:

```kotlin
package kz.dentvision.crm.ui.theme

import androidx.compose.ui.unit.dp

/**
 * Шкала отступов, кратная 4. Веб живёт на шкале Tailwind (`p-1`=4px,
 * `p-2`=8px, `p-3`=12px, `p-4`=16px, `p-6`=24px, `p-8`=32px) — это она же.
 * Произвольные значения (11.dp, 14.dp, 22.dp) в экранах запрещены:
 * из-за них одинаковые по смыслу карточки на разных экранах выглядят
 * по-разному.
 */
object DvSpacing {
    val xs = 4.dp
    val sm = 8.dp
    val md = 12.dp
    val lg = 16.dp
    val xl = 20.dp
    val xxl = 24.dp
    val xxxl = 32.dp
}
```

**Готово когда:** файл создан, `./gradlew compileDebugKotlin` — успех.
**Проверка:** `cd android && ./gradlew compileDebugKotlin`
**Коммит:** `Add DvSpacing scale tokens for Android`

---

## Этап A2. Формат телефона — как в вебе

**Проблема (проверено):** веб форматирует телефон
`src/utils/formatters.ts:78-85` → `+7 (777) 123-45-67`.
На Android форматтера для показа **нет вообще** — телефон печатается сырым.

**Создать** `android/app/src/main/java/kz/dentvision/crm/lib/Phone.kt`:

```kotlin
package kz.dentvision.crm.lib

/**
 * Телефон для показа: «+7 (777) 123-45-67» — тот же вид, что даёт
 * `formatPhone` в `src/utils/formatters.ts`. Нераспознанный формат
 * возвращается как есть: лучше показать сырую строку, чем потерять номер.
 */
fun formatPhone(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    val digits = raw.filter { it.isDigit() }
    val normalized = when {
        digits.length == 11 && (digits.startsWith("7") || digits.startsWith("8")) -> "7" + digits.drop(1)
        digits.length == 10 -> "7$digits"
        else -> return raw
    }
    return "+7 (${normalized.substring(1, 4)}) ${normalized.substring(4, 7)}-" +
        "${normalized.substring(7, 9)}-${normalized.substring(9, 11)}"
}
```

**Затем:** найти места показа телефона и применить:
```
grep -rn "\.phone" android/app/src/main/java/kz/dentvision/crm/ui/ --include="*.kt" | grep -i "Text(\|text ="
```
В каждом найденном месте показа обернуть: `formatPhone(patient.phone) ?: ""`.
**Не трогать** места, где телефон уходит в `tel:`/`wa.me` ссылку или в тело
запроса — там нужен сырой/нормализованный номер (`Reminders.kt:normalizePhone`).

**Готово когда:** телефон везде на экранах показывается как `+7 (777) 123-45-67`.
**Проверка:** `cd android && ./gradlew compileDebugKotlin testDebugUnitTest`
**Коммит:** `Format phone numbers on Android like the web does`

---

## Этап A3. Тест-страж на форматтеры

**Создать** `android/app/src/test/java/kz/dentvision/crm/lib/FormattersTest.kt`:

```kotlin
package kz.dentvision.crm.lib

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Форматтеры обязаны совпадать с вебом посимвольно — расхождение здесь
 * означает, что одна и та же сумма/дата/телефон выглядят на телефоне
 * иначе, чем в браузере у того же сотрудника.
 */
class FormattersTest {
    @Test fun `дата день-первый, как fd() в src-lib-utils`() {
        assertEquals("17.08.2026", formatDate("2026-08-17T09:10:00Z"))
        assertEquals("17.08.2026", formatDate("2026-08-17"))
        assertNull(formatDate(null))
        assertNull(formatDate(""))
        assertNull(formatDate("мусор"))
    }

    @Test fun `телефон как formatPhone в src-utils-formatters`() {
        assertEquals("+7 (777) 123-45-67", formatPhone("77771234567"))
        assertEquals("+7 (777) 123-45-67", formatPhone("87771234567"))
        assertEquals("+7 (777) 123-45-67", formatPhone("7771234567"))
        assertEquals("+7 (777) 123-45-67", formatPhone("+7 777 123 45 67"))
        assertNull(formatPhone(null))
    }

    @Test fun `тенге с пробелом-разрядом и символом в конце`() {
        assertEquals("12 500 ₸", formatTenge(12500))
        assertEquals("0 ₸", formatTenge(0))
        assertEquals("0 ₸", formatTenge(null))
    }
}
```

**Внимание:** в `formatTenge` разделитель — неразрывный пробел (см. `Money.kt`).
Если тест падает на пробеле — скопируйте символ из вывода теста, не заменяйте
на обычный пробел.

**Готово когда:** 3 теста зелёные.
**Проверка:** `cd android && ./gradlew testDebugUnitTest`
**Коммит:** `Add formatter parity tests against web behaviour`

---

# БЛОК B. Дизайн «как у Apple»

## Этап B1. Пустой экран ИИ — вместо анимации польза

**Проблема:** `IntelligenceScreen.kt:217-314` (`EmptyHero`) — вращающееся
кольцо + пульсирующее свечение + мозг + расплывчатый текст
«AI-операционка клиники». Пользователь не понимает, что спросить.
Нарушены П1, П2, П6.

**Что сделать:** заменить тело `EmptyHero` на спокойный блок.
Удалить целиком: `rememberInfiniteTransition`, `pulse`, `glowAlpha`,
`ringRotation`, три вложенных `Box` со свечением/кольцом.

Новый `EmptyHero` (полная замена функции, строки 216-314):

```kotlin
@Composable
private fun EmptyHero(isGuest: Boolean, greeting: String?) {
    val colors = DvTheme.colors
    Column(
        modifier = Modifier.fillMaxSize().padding(DvSpacing.xxxl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        // Один спокойный знак вместо трёхслойной анимации: П2.
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(colors.surface2)
                .border(1.dp, colors.borderSubtle, RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.AutoAwesome,
                contentDescription = null,
                tint = colors.gold,
                modifier = Modifier.size(24.dp),
            )
        }
        Text(
            text = greeting ?: if (isGuest) "Чем помочь?" else "Чем помочь сегодня?",
            style = MaterialTheme.typography.titleMedium,
            color = colors.textPrimary,
            modifier = Modifier.padding(top = DvSpacing.lg),
        )
        Text(
            text = if (isGuest) {
                "Расскажу о платформе, покажу демо и Academy."
            } else {
                "Выберите, с чего начать — или просто спросите."
            },
            style = MaterialTheme.typography.bodyMedium,
            color = colors.textMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = DvSpacing.sm).widthIn(max = 300.dp),
        )
    }
}
```

Вызов на строке 130 поменять на `EmptyHero(isGuest = state.isGuest, greeting = state.greeting)`.
Поле `greeting: String? = null` добавить в `IntelligenceUiState`
(`IntelligenceViewModel.kt`), пока просто `null` — заполним в этапе C4.

**Готово когда:** на пустом чате нет вращений и свечений, текст спокойный.
**Проверка:** `cd android && ./gradlew compileDebugKotlin lintVitalPreview`
**Коммит:** `Calm the AI empty state: remove decorative animation`

---

## Этап B2. Пузыри и чипы чата — на токены

**Файл:** `IntelligenceScreen.kt`.

Заменить механически:

| Было | Стало | Строки (ориентир) |
|---|---|---|
| `RoundedCornerShape(topStart = 20.dp, ...)` | `16.dp` вместо `20.dp`, `4.dp` вместо `6.dp` | 328-332, 381 |
| `.padding(horizontal = 16.dp, vertical = 11.dp)` | `horizontal = DvSpacing.lg, vertical = DvSpacing.md` | 346 |
| `RoundedCornerShape(14.dp)` (аватар) | `RoundedCornerShape(12.dp)` | 360 |
| `RoundedCornerShape(12.dp)` у `GoldPillChip` | `RoundedCornerShape(50)` — это чип, П4 | 497 |
| `verticalArrangement = Arrangement.spacedBy(14.dp)` | `spacedBy(DvSpacing.md)` | 134 |
| `padding(horizontal = 14.dp, vertical = 8.dp)` в чипах | `horizontal = DvSpacing.md, vertical = DvSpacing.sm` | 472, 503 |

**Отдельно, по П1 (один акцент):** `GoldPillChip` — единственное, что остаётся
золотым в нижней панели. `SuggestionRow` уже нейтральный — не трогать.
`AlertChip` оставить цветным по приоритету: цвет там несёт смысл (тревога), не украшение.

**Готово когда:** в файле нет литералов `11.dp`, `14.dp`, `20.dp`, `22.dp`.
**Проверка:**
```
cd android && grep -n "11\.dp\|14\.dp\|20\.dp\|22\.dp" app/src/main/java/kz/dentvision/crm/ui/intelligence/IntelligenceScreen.kt
```
(должно быть пусто) и `./gradlew compileDebugKotlin`
**Коммит:** `Move AI chat spacing and radii onto design tokens`

---

## Этап B3. Тот же проход по 5 самым посещаемым экранам

Порядок (по частоте использования):
1. `ui/home/` (главный экран)
2. `ui/schedule/ScheduleScreen.kt`
3. `ui/patients/PatientsScreen.kt`
4. `ui/finance/FinanceScreen.kt`
5. `ui/shell/AppShell.kt`

Для **каждого** файла:
- внутренний отступ карточки → `DvSpacing.lg` (16.dp);
- расстояние между карточками → `DvSpacing.md` (12.dp);
- радиусы → из `DvShapes` (`MaterialTheme.shapes.medium` = 12.dp для карточек);
- убрать второй и третий золотой элемент, если их больше одного (П1);
- ничего не удалять функционально — только отступы, радиусы, цвет.

**Готово когда:** каждый файл компилируется, экран визуально не сломан.
**Проверка после каждого файла:** `cd android && ./gradlew compileDebugKotlin`
**Коммит:** по одному на файл, `Harmonise spacing on <ScreenName>`

---

# БЛОК C. ИИ как полноценный сотрудник по ролям

Это ядро задачи. Делать строго по порядку: C1 → C2 → C3 → C4.

## Этап C1. Бэкенд: отдать навыки по роли (маршрут `GET /api/ai/skills`)

**Проблема (проверено):** `skillsFor()` в
`dentvision-backend/src/modules/ai/os/skills.ts` не вызывается ни одним
маршрутом — реестр навыков мёртв, клиент не может узнать, что ИИ умеет
именно для этой роли.

**1. Открыть** `dentvision-backend/src/modules/ai/os/skills.ts`, посмотреть
точные сигнатуры `SkillDefinition` и `skillsFor(agentId, access)`.
**Не менять** этот файл.

**2. Открыть** `dentvision-backend/src/modules/ai/ai.routes.ts`.
Найти, как устроен любой существующий `GET` с `authenticate`
(например `/insights`, строка ~1110) — скопировать его форму: тот же способ
получить `req.user`, тот же `res.json({ ok: true, data })`.

**3. Добавить маршрут** (рядом с `/insights`):

```ts
/**
 * Каталог того, что ассистент умеет для ЭТОГО пользователя: реестр
 * `SKILLS` уже фильтруется по правам через `skillsFor`, но до сих пор
 * никем не вызывался — клиент не мог показать роли её собственный
 * список возможностей и выглядел «немым».
 */
aiRouter.get('/skills', authenticate, async (req: AuthRequest, res) => {
  try {
    const access = await resolveAiToolAccess(req.user!.id, req.user?.clinicId ?? null);
    const skills = skillsFor('agent.clinical.general', access)
      .filter((s) => s.surfaces.includes('staff'))
      .map((s) => ({
        id: s.id,
        domain: s.domain,
        title: s.title,
        prompt: s.examplePrompt ?? s.title,
      }));
    res.json({ ok: true, data: skills });
  } catch (error) {
    console.error('[ai] skills', error);
    res.status(500).json({ ok: false, error: 'Не удалось получить список возможностей' });
  }
});
```

**Важно:**
- `agentId` подставьте реальный из `registry.ts` — откройте
  `dentvision-backend/src/modules/ai/os/registry.ts`, возьмите id агента
  для персонала. Если агентов несколько — соберите навыки по всем и
  уберите дубли по `id`.
- Если у `SkillDefinition` **нет** поля `examplePrompt` — не выдумывайте его
  в маршруте. Вместо этого добавьте это поле в `skills.ts` каждому навыку
  (короткая фраза от первого лица пользователя, например для
  «Контроль оплат» → `«Покажи должников»`). Это единственное допустимое
  изменение `skills.ts`.
- Импорты `skillsFor`, `resolveAiToolAccess` добавить сверху файла рядом
  с остальными.

**4. Тест** — создать
`dentvision-backend/src/modules/ai/os/skillsRoute.test.ts` по образцу
соседнего теста (возьмите любой `*.test.ts` в этой папке и повторите его
способ мокать `lib/prisma.js` через `vi.hoisted`):
- у роли с `billing.read` в списке есть «Контроль оплат»;
- у роли без `billing.read` его в списке нет;
- у каждого возвращённого навыка непустые `id`, `title`, `prompt`.

**Готово когда:** тесты зелёные, `tsc` чистый.
**Проверка (из КОРНЯ репозитория, не из dentvision-backend!):**
```
cd /home/user/DentVision1/dentvision-backend && npx tsc --noEmit
cd /home/user/DentVision1 && npx vitest run dentvision-backend/src/modules/ai --reporter=dot
```
**Коммит:** `Expose role-aware AI skill catalogue via GET /api/ai/skills`

---

## Этап C2. Android: получить навыки

**1.** `android/.../data/model/Ai.kt` — добавить модель:

```kotlin
/**
 * Что ассистент умеет для текущей роли — приходит из `GET /api/ai/skills`
 * (реестр `SKILLS` на сервере, отфильтрованный по правам вызывающего).
 */
@Serializable
data class AiSkill(
    val id: String,
    val domain: String = "",
    val title: String,
    val prompt: String = "",
)
```

**2.** `android/.../data/api/AiApi.kt` — рядом с `@GET("api/ai/insights")`:

```kotlin
@GET("api/ai/skills")
suspend fun skills(): ApiEnvelope<List<AiSkill>>
```

**3.** `android/.../data/AiRepository.kt` — по образцу соседнего метода:

```kotlin
suspend fun skills(): List<AiSkill> = apiCall { api.skills() }
```
(точную форму `apiCall` скопируйте у соседнего метода в этом же файле).

**Готово когда:** компилируется.
**Проверка:** `cd android && ./gradlew compileDebugKotlin`
**Коммит:** `Add AI skills model, API and repository on Android`

---

## Этап C3. Android: экран «что я умею» — сердце задачи

**Цель:** вместо немой анимации пользователь при открытии чата видит
**свой** список возможностей и может начать одним касанием.

**1.** `IntelligenceViewModel.kt`:
- в `IntelligenceUiState` добавить `val skills: List<AiSkill> = emptyList()`;
- в `ensureLoaded()` рядом с загрузкой `proactive`/`briefing` добавить:

```kotlin
launch {
    runCatching { repository.skills() }
        .onSuccess { list -> _state.update { it.copy(skills = list) } }
    // Ошибку глотаем молча: каталог возможностей — украшение пустого
    // экрана, из-за него нельзя ронять сам чат.
}
```
(если в `ensureLoaded` нет `launch` — повторите тот способ, которым
загружается `proactive` в этом же файле).

**2.** `IntelligenceScreen.kt` — новый компонент под `EmptyHero`:

```kotlin
/**
 * Каталог возможностей роли. Не «подсказки модели», а список навыков,
 * которые сервер уже разрешил этому пользователю (`GET /api/ai/skills`) —
 * ровно то, что отличает ассистента-сотрудника от чат-окна: видно, что
 * он умеет, ещё до первого вопроса.
 */
@Composable
private fun SkillGrid(skills: List<AiSkill>, onPick: (AiSkill) -> Unit) {
    val colors = DvTheme.colors
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = DvSpacing.lg),
        verticalArrangement = Arrangement.spacedBy(DvSpacing.sm),
    ) {
        Text(
            text = "Чем могу помочь",
            style = MaterialTheme.typography.labelSmall,
            color = colors.textMuted,
            modifier = Modifier.padding(bottom = DvSpacing.xs),
        )
        skills.take(6).forEach { skill ->
            Surface(
                color = colors.surface1,
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, colors.borderSubtle),
                onClick = { onPick(skill) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    modifier = Modifier.padding(DvSpacing.lg),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = skill.title,
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.textPrimary,
                        modifier = Modifier.weight(1f),
                    )
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = null,
                        tint = colors.textGhost,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}
```

**3.** Показать его в пустом состоянии. Заменить строку 130:

```kotlin
state.messages.isEmpty() -> Column(
    modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
) {
    EmptyHero(isGuest = state.isGuest, greeting = state.greeting)
    if (state.skills.isNotEmpty()) {
        SkillGrid(skills = state.skills, onPick = { viewModel.send(it.prompt) })
        Spacer(modifier = Modifier.padding(bottom = DvSpacing.xxl))
    }
}
```
(`EmptyHero` при этом перестаёт занимать весь экран: поменяйте в нём
`fillMaxSize()` на `fillMaxWidth()` и уберите `verticalArrangement = Arrangement.Center`,
добавив сверху `padding(top = DvSpacing.xxxl)`).

**Готово когда:** на пустом чате врач видит «Карта пациента», «История
визитов», «Запись на приём»; кассир — «Контроль оплат»; и нажатие
отправляет готовый вопрос.

**Проверка:** `cd android && ./gradlew compileDebugKotlin lintVitalPreview assemblePreview`
**Коммит:** `Show role-aware AI capabilities instead of a mute empty state`

---

## Этап C4. Понятное подтверждение действия

**Проблема:** `IntelligenceScreen.kt:178-186` — диалог показывает
`action.type` (машинный код вроде `createInvoice`), если нет `label`.
Пользователь не понимает, что подтверждает.

**Заменить** блок `state.pendingConfirmation?.let { ... }` на `DvConfirmDialog`
(тот же компонент, что уже используется по всему приложению —
`ui/theme/DvConfirmDialog.kt`):

```kotlin
state.pendingConfirmation?.let { action ->
    DvConfirmDialog(
        title = "Выполнить действие?",
        message = buildString {
            append(action.label.ifBlank { humanAction(action.type) })
            val params = action.params?.entries?.take(4).orEmpty()
            if (params.isNotEmpty()) {
                append("\n\n")
                params.forEach { (key, value) ->
                    append("• $key: ${value.toString().trim('"')}\n")
                }
            }
        }.trim(),
        confirmLabel = "Выполнить",
        variant = DvConfirmVariant.WARNING,
        onConfirm = { viewModel.confirmPending(true) },
        onDismiss = { viewModel.confirmPending(false) },
    )
}

/** Машинный код действия — в человеческую фразу, если сервер не прислал `label`. */
private fun humanAction(type: String): String = when (type) {
    "createAppointment" -> "Записать пациента на приём"
    "cancelAppointment" -> "Отменить приём"
    "createInvoice" -> "Выставить счёт"
    "createTreatmentPlan" -> "Создать план лечения"
    else -> "Выполнить «$type»"
}
```

**Внимание:** точные имена действий возьмите из
`dentvision-backend/src/modules/ai/os/tools.ts` (там список инструментов с
флагом `mutating`) — переводите только те, что реально требуют подтверждения.

**Готово когда:** диалог показывает человеческую фразу и параметры.
**Проверка:** `cd android && ./gradlew compileDebugKotlin testDebugUnitTest`
**Коммит:** `Explain AI actions in plain language before confirming`

---

## Этап C5 (по желанию). Приветствие по роли

`GET /api/ai/greeting` уже есть на бэкенде (`ai.routes.ts:823`), но Android
его не вызывает. Подключить так же, как `skills` в C2-C3, и положить
результат в `state.greeting` (поле уже добавлено в B1).

**Коммит:** `Greet the user by role on the AI screen`

---

# Финальная проверка (после всех этапов)

```
# 1. Бэкенд
cd /home/user/DentVision1/dentvision-backend && npx tsc --noEmit

# 2. Тесты бэкенда — ИЗ КОРНЯ репозитория (конфиг vitest лежит там)
cd /home/user/DentVision1 && npx vitest run dentvision-backend/src --reporter=dot
# Ожидание: не меньше 1427 проходящих, ноль падающих.

# 3. Android
cd /home/user/DentVision1/android
./gradlew compileDebugKotlin compilePreviewKotlin compileReleaseKotlin
./gradlew testDebugUnitTest lintVitalPreview assemblePreview

# 4. Отправить APK пользователю
# android/app/build/outputs/apk/preview/app-preview.apk
```

**Частые ошибки, на которых спотыкаются:**
- Запуск `npx vitest` из папки `dentvision-backend` → ошибка
  `Cannot find module '.../src/test/setup.ts'`. Запускать **из корня**.
- `@OptIn(ExperimentalLayoutApi::class)` нужно ставить на ту функцию, где
  реально стоит `FlowRow`, а не на внешнюю.
- Проект собирает предупреждения как ошибки: неиспользованный импорт
  уронит сборку. После удаления кода убирайте его импорты.

---

# Порядок и цена

| Этап | Размер | Что даёт |
|---|---|---|
| A1 | 15 мин | Фундамент для дизайна |
| A2, A3 | 40 мин | Телефон как в вебе + страж от расхождений |
| B1, B2 | 40 мин | Чат перестаёт быть шумным |
| B3 | 1.5 ч | 5 главных экранов гармоничны |
| **C1** | **40 мин** | **Оживает мёртвый реестр навыков** |
| **C2, C3** | **1 ч** | **ИИ показывает, что умеет для роли — главный эффект** |
| C4 | 30 мин | Понятные подтверждения |
| C5 | 20 мин | Приветствие по роли |

**Если времени мало — делать C1 → C2 → C3.** Это то, из-за чего ИИ
ощущается «немым помощником», и это чинится подключением уже написанного
в репозитории кода.
