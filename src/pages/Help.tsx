import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, CircleHelp, MessageSquare, Search } from 'lucide-react'

const topics = [
  { title: 'Начало работы', text: 'Настройте клинику, команду, расписание и рабочие процессы.', path: '/settings', icon: BookOpen },
  { title: 'Поиск и AI', text: 'Используйте глобальный поиск или AI Workspace для быстрых действий.', path: '/', icon: Search },
  { title: 'Поддержка', text: 'Опишите проблему или задачу — контекст приложения поможет быстрее разобраться.', path: '/community', icon: MessageSquare },
]

export default function HelpPage() {
  const navigate = useNavigate()

  return (
    <main className="dv-page mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <section className="dv-panel overflow-hidden p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-dv-gold/10 p-3 text-dv-gold">
            <CircleHelp size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dv-muted">DentVision Support</p>
            <h1 className="mt-1 text-2xl font-semibold text-dv-text md:text-3xl">Помощь и поддержка</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-dv-muted">
              Быстрый доступ к основным разделам и рабочим сценариям DentVision.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {topics.map(({ title, text, path, icon: Icon }) => (
          <button
            key={title}
            type="button"
            onClick={() => navigate(path)}
            className="dv-panel group text-left p-5 transition hover:-translate-y-0.5 hover:border-dv-gold/40"
          >
            <Icon size={20} className="text-dv-gold" />
            <h2 className="mt-4 font-semibold text-dv-text">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-dv-muted">{text}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-dv-gold">
              Открыть <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </section>
    </main>
  )
}
