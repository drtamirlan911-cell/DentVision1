# 09 — Jobs

## 9.1 Positioning

Jobs — **P4 pillar**.

Это **не список вакансий внутри CRM**.  
Это кадровый рынок стоматологии уровня **HH.kz**:

- Работодатели публикуют вакансии
- Соискатели ведут резюме и откликаются
- Есть поиск, фильтры, отклики, статусы, коммуникация
- Есть компании (клиники), отклики, избранное, отклик в 1 клик
- Есть прозрачный pipeline найма

---

## 9.2 Two-Sided Market

| Side | Actor | Goals |
|------|-------|-------|
| Demand | Клиника / сеть / lab / supplier | Найти врача, ассистента, админа, техника |
| Supply | Специалист / студент / менеджер | Найти работу / подработку / релокацию |

Roles: `recruiter` (employer side), candidate (any user with Jobs profile).

---

## 9.3 HH-class Feature Set

### For Candidates
- Резюме / professional profile sync
- Поиск вакансий (город, ставка, график, специализация, тип занятости)
- Отклик + сопроводительное
- Статусы откликов
- Избранные вакансии
- Рекомендации AI по скиллам и сертификатам School
- Алерты по новым вакансиям

### For Employers
- Публикация вакансий (шаблоны ролей dental)
- Бренд клиники / company page
- Inbox откликов
- Статусы: new → review → interview → offer → hired / rejected
- Мультифилиальность
- Бусты/продвижение вакансий (phased)
- AI: shortlist candidates, draft job description

### Marketplace Hygiene
- Антиспам откликов
- Проверка employer org
- Жалобы на вакансии
- Закрытые/архивные вакансии

---

## 9.4 Job Object

```text
Vacancy
  title, specialty, employment_type, salary_range, city, clinic
  requirements, responsibilities, benefits
  status: draft|published|paused|closed
  applicant_pipeline[]
```

```text
Candidate Profile
  experience, specialties, certificates, portfolio
  preferred cities, salary expectations
  privacy controls
```

---

## 9.5 Integrations

| Module | Integration |
|--------|-------------|
| Profile | Единый professional profile |
| School | Certificates as skill proof |
| Community | Thought leadership signal |
| CRM Staff | Hired → invite to organization |
| AI | Matching + JD generation + interview prep |

---

## 9.6 What Jobs is NOT

- Не внутренний HR-only модуль без публичного рынка
- Не доска «оставьте телефон»
- Не только RSS вакансий без откликов и статусов

---

## 9.7 Acceptance Criteria

- [ ] Кандидат создает резюме и откликается
- [ ] Работодатель ведет pipeline статусов
- [ ] Поиск/фильтры уровня HH.kz для dental domain
- [ ] Вакансия связана с clinic/org
- [ ] AI рекомендует вакансии и кандидатов
- [ ] После hire возможен invite в Workspace
