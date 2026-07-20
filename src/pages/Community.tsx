import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users, MessageSquare, Heart, Share2, Bookmark, Plus, Image as ImageIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { Avatar } from '@/components/ui/ds/Avatar'
import { Textarea } from '@/components/ui/ds/Input'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { useAuth } from '@/store/auth.store'

type Post = {
  id: string
  author: string
  role: string
  time: string
  content: string
  likes: number
  comments: number
  tags: string[]
  kind: 'media' | 'thread'
}

const SEED_POSTS: Post[] = [
  {
    id: '1', author: 'Доктор Айдар К.', role: 'Ортопед', time: '2 часа назад',
    content: 'Цифровое планирование имплантации с CBCT и CAD/CAM заметно повышает точность. Делюсь протоколом в треде.',
    likes: 24, comments: 8, tags: ['Имплантация', 'Цифровая стоматология'], kind: 'thread',
  },
  {
    id: '2', author: 'Клиника Smile', role: 'Клиника', time: '5 часов назад',
    content: 'Открыли новый филиал. Ищем специалистов — вакансии в Jobs.',
    likes: 42, comments: 15, tags: ['Вакансии'], kind: 'media',
  },
  {
    id: '3', author: 'Доктор Елена М.', role: 'Терапевт', time: '1 день назад',
    content: 'Клинический кейс: реставрация 11. До/после — в портфолио профиля.',
    likes: 31, comments: 6, tags: ['Терапия', 'Кейс'], kind: 'media',
  },
  {
    id: '4', author: 'DentVision Academy', role: 'Платформа', time: '2 дня назад',
    content: 'Новый курс: «Основы лазерной стоматологии» — 12 модулей, сертификат.',
    likes: 56, comments: 22, tags: ['Обучение', 'Курс'], kind: 'thread',
  },
]

const TOPICS = ['Все', 'Имплантация', 'Терапия', 'Ортодонтия', 'Хирургия', 'Лаборатория', 'Обучение']

export default function CommunityPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [topic, setTopic] = useState('Все')
  const [draft, setDraft] = useState('')
  const [posts, setPosts] = useState(SEED_POSTS)
  const [liked, setLiked] = useState<Record<string, boolean>>({})

  const filtered = useMemo(() => {
    if (topic === 'Все') return posts
    return posts.filter((p) => p.tags.some((t) => t.includes(topic)))
  }, [posts, topic])

  const publish = () => {
    if (!draft.trim()) return
    setPosts((prev) => [{
      id: `local-${Date.now()}`,
      author: user?.name || 'Вы',
      role: user?.role || 'Специалист',
      time: 'только что',
      content: draft.trim(),
      likes: 0,
      comments: 0,
      tags: ['Тред'],
      kind: 'thread',
    }, ...prev])
    setDraft('')
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6 p-4 md:p-6">
      <PageHeader
        title="Community"
        subtitle="Instagram + Threads для стоматологов · визуал и дискуссии"
        icon={<Users size={20} />}
        actions={
          <Button size="sm" variant="secondary" onClick={() => navigate('/school')}>
            К курсам
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 space-y-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Напишите тред или подпись к кейсу…"
            rows={3}
          />
          <div className="flex items-center justify-between">
            <button className="inline-flex items-center gap-1.5 text-xs text-txt-muted hover:text-txt-primary">
              <ImageIcon size={14} /> Медиа
            </button>
            <Button size="sm" onClick={publish} disabled={!draft.trim()}>
              <Plus size={14} className="mr-1.5" />
              Опубликовать
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TOPICS.map((t) => (
          <button
            key={t}
            onClick={() => setTopic(t)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors ${
              topic === t ? 'bg-dv-gold/15 border-dv-gold/30 text-dv-gold' : 'border-bdr-subtle text-txt-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Лента пуста" description="Смените тему или опубликуйте первый тред." />
      ) : (
        <div className="space-y-4">
          {filtered.map((post) => (
            <Card key={post.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar name={post.author} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-txt-primary truncate">{post.author}</p>
                    <p className="text-[11px] text-txt-muted">{post.role} · {post.time}</p>
                  </div>
                  <Badge variant="outline" size="xs">{post.kind === 'thread' ? 'Thread' : 'Post'}</Badge>
                </div>
                <p className="text-sm text-txt-secondary whitespace-pre-wrap">{post.content}</p>
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.map((t) => <Badge key={t} variant="gold" size="xs">#{t}</Badge>)}
                </div>
                <div className="flex items-center gap-4 pt-1 text-txt-muted">
                  <button
                    className={`inline-flex items-center gap-1.5 text-xs ${liked[post.id] ? 'text-error' : 'hover:text-txt-primary'}`}
                    onClick={() => setLiked((l) => ({ ...l, [post.id]: !l[post.id] }))}
                  >
                    <Heart size={14} fill={liked[post.id] ? 'currentColor' : 'none'} />
                    {post.likes + (liked[post.id] ? 1 : 0)}
                  </button>
                  <span className="inline-flex items-center gap-1.5 text-xs"><MessageSquare size={14} />{post.comments}</span>
                  <button className="inline-flex items-center gap-1.5 text-xs hover:text-txt-primary"><Bookmark size={14} /></button>
                  <button className="inline-flex items-center gap-1.5 text-xs hover:text-txt-primary ml-auto"><Share2 size={14} /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  )
}
