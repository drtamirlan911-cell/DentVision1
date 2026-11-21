-- Canonical partner roles for diagnostics specialists.
-- Legacy DiagnosticCenterMember remains the operational membership mirror, but
-- invited operators/radiologists must also have a scoped PersonRole so context
-- switching, route authorization and the active-workspace UI agree.
INSERT INTO "roles" ("id", "key", "name", "description", "isSystem", "createdAt")
VALUES
  (gen_random_uuid()::text, 'diagnostic_operator', 'Оператор диагностического центра', 'Приём пациента, регистрация прибытия и запуск назначенного исследования в активном центре.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'diagnostic_radiologist', 'Рентгенолог диагностического центра', 'Интерпретация исследования, подписание заключения и контролируемая передача результата клинике.', true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
