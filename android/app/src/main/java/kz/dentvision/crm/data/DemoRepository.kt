package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.ApiException
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.DemoClinicRequest
import kz.dentvision.crm.data.model.GuestConvertRequest
import kz.dentvision.crm.data.session.GuestIdentity
import kz.dentvision.crm.data.session.GuestSessionStore
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.data.session.SessionStore

/**
 * Демо-клиника гостя — перенос `handleDemo()`/`autoStartDemo` из
 * `GuestCRMModal.tsx`: `POST /api/auth/demo-clinic` создаёт настоящую
 * клинику с засеянными данными для только что зарегистрированного
 * владельца (не мок и не отдельная демо-сессия — сам эндпоинт уже
 * существует на сервере, `auth.routes.ts:782-1030`).
 */
class DemoRepository(
    private val api: ApiClient = ServiceLocator.api,
    private val guestStore: GuestSessionStore = ServiceLocator.guest,
    private val sessionStore: SessionStore = ServiceLocator.session,
) {
    /**
     * Регистрирует гостя как обычный аккаунт и сразу создаёт для него
     * демо-клинику — одним вызовом, а не в два отдельных экрана, как на
     * вебе (там сначала войти/зарегистрироваться в модалке, потом отдельно
     * `handleDemo()`).
     *
     * `SessionStore.updateTokens()` — no-op, пока в нём нет сессии
     * (`val current = _session.value ?: return`), поэтому между
     * конвертацией гостя и созданием клиники сессия туда ещё не пишется —
     * иначе `MainActivity` переключил бы экран на `AppShell` раньше, чем
     * клиника готова, и показал бы пустой кабинет. Токен на этом
     * промежуточном шаге снова временно едет в гостевом слоте — тем же
     * приёмом, что `GuestRepository.convertToAccount` использует для
     * первого шага; здесь он применяется дважды подряд.
     */
    suspend fun registerAndCreateDemoClinic(
        login: String,
        password: String,
        name: String,
        clinicName: String,
        city: String,
        address: String,
        phone: String,
    ): Session {
        val guestId = guestStore.identity.value?.guestId
            ?: throw ApiException(status = 0, message = "Гостевая сессия не найдена — попробуйте ещё раз")
        val converted = apiCall {
            api.guest.convert(GuestConvertRequest(guestId = guestId, login = login, email = login, password = password, name = name))
        }
        guestStore.save(GuestIdentity(guestId = guestId, guestToken = converted.accessToken))
        val demo = apiCall {
            api.auth.demoClinic(
                DemoClinicRequest(
                    name = clinicName.ifBlank { null },
                    city = city.ifBlank { null },
                    address = address.ifBlank { null },
                    phone = phone.ifBlank { null },
                ),
            )
        }
        // Настоящей сессии в SessionStore всё ещё нет — снова гостевой слот,
        // на этот раз с clinic-scoped токеном, до сборки полной Session.
        guestStore.save(GuestIdentity(guestId = guestId, guestToken = demo.tokens.accessToken))
        val me = apiCall { api.auth.me() }
        val session = Session.from(me, demo.tokens.accessToken, demo.tokens.refreshToken)
        sessionStore.save(session)
        guestStore.clear()
        return session
    }
}
