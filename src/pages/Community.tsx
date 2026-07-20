import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users, MessageSquare, Heart, Share2, Bookmark, Plus, Image as ImageIcon, Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { Avatar } from '@/components/ui/ds/Avatar'
import { Textarea } from '@/components/ui/ds/Input'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { useAuth } from '@/store/auth.store'
import { createCommunityPost, getCommunityPosts, likeCommunityPost } from '@/utils/api'
import { useToast } from '@/components/ui/ds/Toast'

const TOPICS = ['Все', 'Имплантация', 'Терапия', 'Ортодонтия', 'Хирургия', 'Лаборатория', 'Обучение']

function timeAgo(iso?: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'только что'
  if (h < 24) return `${h} ч назад`
  return `${Math.floor(h / 24)} дн назад`
}

export default function CommunityPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const [topic, setTopic] = useState('Все')
  const [draft, setDraft] = useState('')
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const list = await getCommunityPosts(topic)
      setPosts(Array.isArray(list) ? list : [])
    } catch {
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [topic])

  const publish = async () => {
    if (!draft.trim()) return
    if (!isAuthenticated) {
      showToast('Войдите, чтобы публиковать', 'info')
      navigate('/login')
      return
    }
    setPublishing(true)
    try {
      const post = await createCommunityPost({ content: draft.trim(), tags: ['Тред'], kind: 'thread' })
      setPosts((prev) => [post, ...prev])
      setDraft('')
      showToast('Опубликовано', 'success')
    } catch (e: any) {
      showToast(e?.message || 'Не удалось опубликовать', 'error')
    } finally {
      setPublishing(false)
    }
  }

  const toggleLike = async (id: string) => {
    if (!isAuthenticated) {
      showToast('Войдите, чтобы поставить like', 'info')
      return
    }
    try {
      const updated = await likeCommunityPost(id)
      setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)))
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error')
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6 p-4 md:p-6">
      <PageHeader
        title="Community"
        subtitle="Instagram + Threads · live feed API"
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
            <Button size="sm" onClick={publish} disabled={!draft.trim() || publishing}>
              {publishing ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Plus size={14} className="mr-1.5" />}
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

      {loading ? (
        <div className="flex justify-center py-16 text-txt-muted"><Loader2 className="animate-spin" size={22} /></div>
      ) : posts.length === 0 ? (
        <EmptyState title="Лента пуста" description="Смените тему или опубликуйте первый тред." />
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar name={post.authorName || 'User'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-txt-primary truncate">{post.authorName}</p>
                    <p className="text-[11px] text-txt-muted">{post.authorRole} · {timeAgo(post.createdAt)}</p>
                  </div>
                  <Badge variant="outline" size="xs">{post.kind === 'thread' ? 'Thread' : 'Post'}</Badge>
                </div>
                <p className="text-sm text-txt-secondary whitespace-pre-wrap">{post.content}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(post.tags || []).map((t: string) => <Badge key={t} variant="gold" size="xs">#{t}</Badge>)}
                </div>
                <div className="flex items-center gap-4 pt-1 text-txt-muted">
                  <button
                    className={`inline-flex items-center gap-1.5 text-xs ${post.liked ? 'text-error' : 'hover:text-txt-primary'}`}
                    onClick={() => toggleLike(post.id)}
                  >
                    <Heart size={14} fill={post.liked ? 'currentColor' : 'none'} />
                    {post.likesCount || 0}
                  </button>
                  <span className="inline-flex items-center gap-1.5 text-xs"><MessageSquare size={14} />{post.commentsCount || 0}</span>
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
