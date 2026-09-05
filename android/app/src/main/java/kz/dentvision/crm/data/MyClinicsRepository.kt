package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.ApiException
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.CreateClinicRequest
import kz.dentvision.crm.data.model.DemoClinicRequest
import kz.dentvision.crm.data.model.JoinClinicRequest
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.data.session.SessionStore

/**
 * Создание клиники / присоединение по коду / демо — перенос `MyClinics.tsx`.
 * Раньше на Android этого не было вовсе: вошедший пользователь без единой
 * клиники (только что зарегистрированный, ждущий приглашения или ушедший из
 * последней) упирался в пустой кабинет без единого выхода — ни кнопки
 * «Создать», ни поля для кода.
 *
 * `createClinic`/`createDemoClinic` — бэкенд сразу выдаёт токены, скоупленные
 * на новую клинику (`auth.routes.ts:743-751`, `.../demo-clinic`), поэтому
 * применяются напрямую, тем же приёмом, что уже использует `DemoRepository`
 * для гостя. `joinByCode` токенов не получает (`join-clinic` отдаёт только
 * членство) — там обычный `switch-context` через уже готовый
 * `WorkspaceRepository.switchTo`.
 */
class MyClinicsRepository(
    private val api: ApiClient = ServiceLocator.api,
    private val session: SessionStore = ServiceLocator.session,
    private val workspaceRepository: WorkspaceRepository = WorkspaceRepository(api, session),
) {
    suspend fun createClinic(name: String, city: String?, address: String?, phone: String?): Session {
        val result = apiCall { api.auth.createClinic(CreateClinicRequest(name, city, address, phone)) }
        return applyTokens(result.tokens.accessToken, result.tokens.refreshToken)
    }

    suspend fun createDemoClinic(): Session {
        val result = apiCall { api.auth.demoClinic(DemoClinicRequest()) }
        return applyTokens(result.tokens.accessToken, result.tokens.refreshToken)
    }

    suspend fun joinByCode(code: String): Session {
        val joined = apiCall { api.auth.joinClinic(JoinClinicRequest(code)) }
        val contexts = workspaceRepository.contexts()
        val target = contexts.find { it.scopeType == "CLINIC" && it.scopeId == joined.clinicId }
            ?: throw ApiException(
                status = 200,
                message = "Присоединились, но рабочее пространство ещё не появилось в списке — попробуйте выйти и войти снова",
            )
        return workspaceRepository.switchTo(target)
    }

    /** Тот же порядок, что `WorkspaceRepository.switchTo`: токены — в сессию раньше, чем `/me`. */
    private suspend fun applyTokens(accessToken: String, refreshToken: String): Session {
        session.updateTokens(accessToken, refreshToken)
        val me = apiCall { api.auth.me() }
        val next = Session.from(me, accessToken, refreshToken)
        session.save(next)
        return next
    }
}
