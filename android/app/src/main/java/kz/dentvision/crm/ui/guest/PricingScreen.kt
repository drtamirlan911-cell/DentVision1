package kz.dentvision.crm.ui.guest

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kz.dentvision.crm.ui.theme.DvTheme

private data class PricingFeature(val text: String, val included: Boolean)

private data class PricingPlan(
    val name: String,
    val price: String,
    val period: String,
    val popular: Boolean,
    val ctaLabel: String,
    val features: List<PricingFeature>,
)

/** Перенос `PLANS` в `src/pages/Pricing.tsx` — статика, никаких вызовов сервера. */
private val PLANS = listOf(
    PricingPlan(
        name = "Starter", price = "0", period = "навсегда", popular = false,
        ctaLabel = "Начать бесплатно",
        features = listOf(
            PricingFeature("До 100 пациентов", true),
            PricingFeature("Базовое расписание", true),
            PricingFeature("1 пользователь", true),
            PricingFeature("Маркетплейс + Академия", true),
            PricingFeature("AI-ассистент", false),
            PricingFeature("Аналитика", false),
        ),
    ),
    PricingPlan(
        name = "Professional", price = "49 900", period = "/месяц", popular = true,
        ctaLabel = "Попробовать 30 дней бесплатно",
        features = listOf(
            PricingFeature("Безлимит пациентов", true),
            PricingFeature("До 10 пользователей", true),
            PricingFeature("AI-ассистент (100 запросов/мес)", true),
            PricingFeature("Аналитика + отчёты", true),
            PricingFeature("Маркетплейс + Академия", true),
            PricingFeature("Мульти-клиника", false),
        ),
    ),
    PricingPlan(
        name = "Enterprise", price = "149 900", period = "/месяц", popular = false,
        ctaLabel = "Обсудить с нами",
        features = listOf(
            PricingFeature("Всё из Professional", true),
            PricingFeature("Безлимит пользователей и AI", true),
            PricingFeature("Мульти-клиника", true),
            PricingFeature("Приоритетная поддержка", true),
            PricingFeature("Кастомная интеграция", true),
            PricingFeature("SLA 99.9%", true),
        ),
    ),
)

@Composable
fun PricingScreen(onRegister: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(text = "Выберите свой план", style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)
        Text(
            text = "Все планы включают 30-дневный бесплатный период Enterprise",
            style = MaterialTheme.typography.bodyMedium,
            color = DvTheme.colors.textSecondary,
        )
        PLANS.forEach { plan -> PlanCard(plan = plan, onRegister = onRegister) }
    }
}

@Composable
private fun PlanCard(plan: PricingPlan, onRegister: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = if (plan.popular) DvTheme.colors.surface1 else DvTheme.colors.surface1.copy(alpha = 0.6f)),
        border = BorderStroke(1.dp, if (plan.popular) DvTheme.colors.gold.copy(alpha = 0.3f) else DvTheme.colors.borderSubtle),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(text = plan.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = DvTheme.colors.textPrimary)
                if (plan.popular) {
                    Text(
                        text = "  · рекомендуем",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = DvTheme.colors.gold,
                    )
                }
            }
            Row(modifier = Modifier.padding(top = 6.dp)) {
                Text(text = plan.price, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = DvTheme.colors.textPrimary)
                Text(text = " ₸${plan.period}", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
            }

            Column(modifier = Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                plan.features.forEach { feature ->
                    Row(verticalAlignment = Alignment.Top) {
                        Icon(
                            imageVector = if (feature.included) Icons.Filled.Check else Icons.Filled.Close,
                            contentDescription = null,
                            tint = if (feature.included) DvTheme.colors.success else DvTheme.colors.textGhost,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                        Text(
                            text = feature.text,
                            style = MaterialTheme.typography.bodySmall,
                            color = if (feature.included) DvTheme.colors.textSecondary else DvTheme.colors.textGhost,
                            modifier = Modifier.padding(start = 8.dp),
                        )
                    }
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (plan.popular) DvTheme.colors.gold else DvTheme.colors.surface2)
                    .clickable(onClick = onRegister)
                    .padding(vertical = 12.dp),
                horizontalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = plan.ctaLabel,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = if (plan.popular) DvTheme.colors.goldOn else DvTheme.colors.textPrimary,
                )
            }
        }
    }
}
