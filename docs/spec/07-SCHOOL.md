# 07 — School (Academy)

## 7.1 Positioning

School — **P2 pillar**.  
Это не «раздел с видео». Это профессиональная академия стоматологии внутри ОС клиники: обучение → практика → сертификат → применение в CRM.

AI Tutor связывает обучение с реальными кейсами врача.

---

## 7.2 What’s Inside (canonical inventory)

Обязательный состав School:

| Format | Description |
|--------|-------------|
| **Видео** | Уроки, лекции, записи live |
| **PDF** | Конспекты, протоколы, handouts |
| **Тесты** | Проверка по модулям |
| **Экзамены** | Финальная аттестация курса/трека |
| **Сертификаты** | Verifiable credentials после экзамена |
| **Live** | Живые эфиры / вебинары с Q&A |
| **AI Tutor** | Персональный наставник в стиле ChatGPT по курсу и клинике |
| **Практические задания** | Case tasks, photo uploads, protocol drills |
| **Офис-курсы** | Hands-on / offsite / in-clinic workshops |
| **Лекторы** | **Местные и зарубежные** |

---

## 7.3 Learner Experience

```text
Discover → Enroll → Learn (video/PDF) → Practice → Test
        → Live (optional) → Exam → Certificate → Apply in clinic
```

**AI Tutor duties**
- Составить learning path по специализации
- Объяснить материал простыми словами
- Разобрать ошибку в тесте
- Связать урок с пациентским кейсом (без утечки PHI в public course context)
- Напомнить закончить модуль

---

## 7.4 Content Creators

### Local lecturers
- Быстрый onboarding
- Локальный язык / кейсы рынка
- Офис-курсы в городе

### International lecturers
- Мультиязычность / субтитры
- Premium tracks
- Timezone-aware Live scheduling

Creator cabinet:
- Upload video/PDF
- Quiz builder
- Exam rules
- Assignment rubrics
- Live schedule
- Revenue / cohort analytics (phased)

---

## 7.5 Course Object Model

```text
Track / Program
  └── Course
        ├── Modules
        │     ├── Lessons (Video / PDF / Text)
        │     ├── Practical Assignment
        │     └── Live Session refs
        ├── Exam
        ├── Certificate Template
        └── Office Course Session (optional cohort)
```

---

## 7.6 Certification Rules

1. Certificate выдаётся только после прохождения exam policy курса
2. Certificate содержит: learner, course, date, unique ID, issuer
3. Профиль пользователя показывает verifiable badges
4. Клиника (owner) может видеть completion команды (org learning dashboard)

---

## 7.7 Office Courses (очные)

- Каталог ближайших офис-курсов
- Регистрация, оплата, места
- Check-in
- Post-course digital materials + certificate
- Связка с лектором (local/international guest)

---

## 7.8 Integration Points

| From | To School |
|------|-----------|
| AI Digital Twin | Personalized course recommendations |
| CRM specialty patterns | «Вы часто делаете эндо → курс X» |
| Community | Обсуждение урока / клипа лектора |
| Jobs | Skill signals from certificates |
| Marketplace | Recommended materials for practiced protocol |

---

## 7.9 Acceptance Criteria

- [ ] Курс поддерживает Video + PDF + Test + Exam + Certificate в одном flow
- [ ] Есть Live sessions и Practical assignments
- [ ] AI Tutor отвечает в контексте текущего урока
- [ ] Можно опубликовать локального и зарубежного лектора
- [ ] Офис-курс имеет регистрацию и сертификацию
- [ ] Owner видит прогресс сотрудников
