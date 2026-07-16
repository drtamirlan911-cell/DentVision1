import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, MessageSquare, Heart, Share2, Bookmark,
  Award, TrendingUp, Search, Plus, Image as ImageIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { Avatar } from '@/components/ui/ds/Avatar'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { useAuth } from '@/context/AuthContext'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

const MOCK_POSTS = [
  {
    id: '1',
    author: 'Доктор Айдар К.',
    role: 'Ортопед',
    avatar: 'AK',
    time: '2 часа назад',
    content: 'Поделюсь опытом: цифровое планирование имплантации с использованием CBCT и CAD/CAM значительно повышает точность. Рекомендую ознакомиться с новым протоколом.',
    likes: 24,
    comments: 8,
    tags: ['Имплантация', 'Цифровая стоматология'],
  },
  {
    id: '2',
    author: 'Клиника Smile',
    role: 'Клиника',
    avatar: 'SC',
    time: '5 часов назад',
    content: 'Открыли новый филиал в Астане! Приглашаем специалистов. Современное оборудование, комфортные условия, достойная оплата.',
    likes: 42,
    comments: 15,
    tags: ['Вакансии', 'Астана'],
  },
  {
    id: '3',
    author: 'Доктор Елена М.',
    role: 'Терапевт',
    avatar: 'EM',
    time: '1 день назад',
    content: 'Интересный клинический кейс: реставрация зуба 11 с использованием композита Filtek Supreme. До/после в портфолио.',
    likes: 31,
    comments: 6,
    tags: ['Терапия', 'Эстетика', 'Кейс'],
  },
  {
    id: '4',
    author: 'DentVision Academy',
    role: 'Платформа',
    avatar: 'DV',
    time: '2 дня назад',
    content: 'Новый курс: "Основы лазерной стоматологии" — 12 модулей, сертификат. Запись открыта!',
    likes: 56,
    comments: 22,
    tags: ['Обучение', 'Лазер', 'Курс'],
  },
]

const TOPICS = ['Имплантация', 'Терапия', 'Ортодонтия', 'Хирургия', 'Лаборатория', 'Маркетинг']

export default function CommunityPage() {
  const { user } = useAuth()
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)

  const filtered = selectedTopic
    ? MOCK_POSTS.filter(p => p.tags.some(t => t.includes(selectedTopic)))
    : MOCK_POSTS

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-4xl mx-auto space-y-6">
      <motion.div variants={item}>
        <PageHeader
          title="Сообщество"
          subtitle="Профессиональная сеть стоматологов"
          icon={<Users size={20} className="text-dv-gold" />}
          action={
            <Button variant="primary" size="sm" icon={<Plus size={14} />}>Написать</Button>
          }
        />
      </motion.div>

      {/* Topics */}
      <motion.div variants={item} className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedTopic(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !selectedTopic
              ? 'bg-dv-gold/15 border-dv-gold/30 text-dv-gold'
              : 'border-bdr-subtle text-txt-secondary hover:border-dv-gold/20 hover:text-dv-gold'
          }`}
        >
          Все
        </button>
        {TOPICS.map(topic => (
          <button
            key={topic}
            onClick={() => setSelectedTopic(topic)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selectedTopic === topic
                ? 'bg-dv-gold/15 border-dv-gold/30 text-dv-gold'
                : 'border-bdr-subtle text-txt-secondary hover:border-dv-gold/20 hover:text-dv-gold'
            }`}
          >
            {topic}
          </button>
        ))}
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        {[
          { label: 'Участников', value: '1 247', icon: <Users size={16} /> },
          { label: 'Публикаций', value: '89', icon: <MessageSquare size={16} /> },
          { label: 'Онлайн', value: '12', icon: <TrendingUp size={16} /> },
        ].map(stat => (
          <Card key={stat.label} className="p-3">
            <div className="flex items-center gap-2">
              <span className="text-dv-gold">{stat.icon}</span>
              <div>
                <p className="text-lg font-bold text-txt-primary">{stat.value}</p>
                <p className="text-2xs text-txt-muted">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* Posts */}
      <div className="space-y-4">
        {filtered.map((post, i) => (
          <motion.div key={post.id} variants={item}>
            <Card className="hover:border-dv-gold/10 transition-colors">
              <CardContent className="p-4">
                {/* Author */}
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={post.avatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-txt-primary">{post.author}</p>
                    <p className="text-2xs text-txt-muted">{post.role} · {post.time}</p>
                  </div>
                  <button className="text-txt-muted hover:text-dv-gold transition-colors">
                    <Bookmark size={16} />
                  </button>
                </div>

                {/* Content */}
                <p className="text-sm text-txt-secondary leading-relaxed mb-3">{post.content}</p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {post.tags.map(tag => (
                    <Badge key={tag} variant="outline" size="xs">{tag}</Badge>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4 pt-2 border-t border-bdr-subtle">
                  <button className="flex items-center gap-1.5 text-xs text-txt-muted hover:text-error transition-colors">
                    <Heart size={14} /> {post.likes}
                  </button>
                  <button className="flex items-center gap-1.5 text-xs text-txt-muted hover:text-dv-gold transition-colors">
                    <MessageSquare size={14} /> {post.comments}
                  </button>
                  <button className="flex items-center gap-1.5 text-xs text-txt-muted hover:text-info transition-colors">
                    <Share2 size={14} /> Поделиться
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-txt-muted text-sm">Нет публикаций по выбранной теме</p>
        </Card>
      )}
    </motion.div>
  )
}
