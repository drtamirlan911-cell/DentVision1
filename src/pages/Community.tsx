import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users, MessageSquare, Heart, Share2, Bookmark, Plus, Loader2,
  MessageCircle, Send, X, GraduationCap,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { Avatar } from '@/components/ui/ds/Avatar'
import { Textarea, Input } from '@/components/ui/ds/Input'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { useAuth } from '@/store/auth.store'
import {
  addCommunityComment,
  createCommunityPost,
  getCommunityComments,
  getCommunityPosts,
  getDmUnreadCount,
  likeCommunityPost,
  openDm,
  saveCommunityPost,
} from '@/utils/api'
import { useToast } from '@/components/ui/ds/Toast'
import { MessagesPanel } from '@/components/community/MessagesPanel'
import { cn } from '@/lib/utils'

const TOPICS = ['Все', 'Имплантация', 'Терапия', 'Ортодонтия', 'Хирургия', 'Лаборатория', 'Обучение']

type Tab = 'feed' | 'messages' | 'saved'

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
  const [params, setParams] = useSearchParams()
  const { isAuthenticated, user } = useAuth()
  const { showToast } = useToast()

  const tabParam = params.get('tab')
  const tab: Tab = tabParam === 'messages' || tabParam === 'saved' ? tabParam : 'feed'
  const peerParam = params.get('dm')

  const [topic, setTopic] = useState('Все')
  const [draft, setDraft] = useState('')
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [unread, setUnread] = useState(0)
  const [commentPostId, setCommentPostId] = useState<string | null>(null)
  const [comments, setComments] = useState<any[]>([])
  const [commentDraft, setCommentDraft] = useState('')
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [dmPeer, setDmPeer] = useState<string | null>(peerParam)

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params)
    if (t === 'feed') next.delete('tab')
    else next.set('tab', t)
    if (t !== 'messages') next.delete('dm')
    setParams(next, { replace: true })
  }

  const load = async () => {
    setLoading(true)
    try {
      const list = await getCommunityPosts(topic, { saved: tab === 'saved' })
      setPosts(Array.isArray(list) ? list : [])
    } catch {
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'feed' || tab === 'saved') void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, tab])

  useEffect(() => {
    if (!isAuthenticated) {
      setUnread(0)
      return
    }
    void getDmUnreadCount()
      .then((d) => setUnread(Number(d?.unread || 0)))
      .catch(() => setUnread(0))
  }, [isAuthenticated, tab])

  useEffect(() => {
    setDmPeer(peerParam)
  }, [peerParam])

  const publish = async () => {
    if (!draft.trim()) return
    if (!isAuthenticated) {
      showToast('Войдите, чтобы публиковать', 'info')
      navigate('/login')
      return
    }
    setPublishing(true)
    try {
      const post = await createCommunityPost({ content: draft.trim(), tags: topic !== 'Все' ? [topic] : ['Тред'], kind: 'thread' })
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
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)))
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error')
    }
  }

  const toggleSave = async (id: string) => {
    if (!isAuthenticated) {
      showToast('Войдите, чтобы сохранить', 'info')
      return
    }
    try {
      const r = await saveCommunityPost(id)
      setPosts((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, saved: r.saved } : p))
        if (tab === 'saved' && !r.saved) return next.filter((p) => p.id !== id)
        return next
      })
      showToast(r.saved ? 'Сохранено' : 'Убрано из сохранённых', 'success')
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error')
    }
  }

  const sharePost = async (post: any) => {
    const url = `${window.location.origin}/community?post=${post.id}`
    try {
      await navigator.clipboard.writeText(url)
      showToast('Ссылка скопирована', 'success')
    } catch {
      showToast(url, 'info')
    }
  }

  const openComments = async (postId: string) => {
    setCommentPostId(postId)
    setCommentsLoading(true)
    setCommentDraft('')
    try {
      const list = await getCommunityComments(postId)
      setComments(Array.isArray(list) ? list : [])
    } catch {
      setComments([])
    } finally {
      setCommentsLoading(false)
    }
  }

  const sendComment = async () => {
    if (!commentPostId || !commentDraft.trim()) return
    if (!isAuthenticated) {
      showToast('Войдите, чтобы комментировать', 'info')
      return
    }
    try {
      const c = await addCommunityComment(commentPostId, commentDraft.trim())
      setComments((prev) => [...prev, c])
      setCommentDraft('')
      setPosts((prev) =>
        prev.map((p) =>
          p.id === commentPostId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p,
        ),
      )
    } catch (e: any) {
      showToast(e?.message || 'Не удалось отправить', 'error')
    }
  }

  const messageAuthor = async (authorId?: string | null) => {
    if (!authorId) {
      showToast('Автор без аккаунта — напишите через поиск в Сообщениях', 'info')
      setTab('messages')
      return
    }
    if (!isAuthenticated) {
      showToast('Войдите для личных сообщений', 'info')
      navigate('/login')
      return
    }
    if (authorId === user?.id) {
      showToast('Это ваш пост', 'info')
      return
    }
    try {
      await openDm(authorId)
      const next = new URLSearchParams(params)
      next.set('tab', 'messages')
      next.set('dm', authorId)
      setParams(next)
      setDmPeer(authorId)
    } catch (e: any) {
      showToast(e?.message || 'Не удалось открыть чат', 'error')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="dv-page max-w-3xl mx-auto space-y-4 sm:space-y-5 py-4 md:py-6 overflow-x-hidden"
    >
      <PageHeader
        title="Сообщество"
        subtitle="Лента · комментарии · личные сообщения"
        icon={<Users size={20} />}
        actions={
          <Button size="sm" variant="secondary" icon={<GraduationCap size={14} />} onClick={() => navigate('/school')}>
            Курсы
          </Button>
        }
      />

      {/* Tabs — IG/Telegram essentials */}
      <div className="flex rounded-xl border border-bdr-subtle p-1 bg-surface-1/50">
        {([
          { id: 'feed' as const, label: 'Лента' },
          { id: 'messages' as const, label: 'Сообщения', badge: unread },
          { id: 'saved' as const, label: 'Сохранённые' },
        ]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 relative py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors',
              tab === t.id ? 'bg-dv-gold/15 text-dv-gold' : 'text-txt-muted hover:text-txt-primary',
            )}
          >
            {t.label}
            {!!t.badge && t.badge > 0 && (
              <span className="absolute top-1 right-2 min-w-[1rem] h-4 px-1 rounded-full bg-dv-gold text-[9px] font-bold text-surface-0 flex items-center justify-center">
                {t.badge > 9 ? '9+' : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'messages' ? (
        <MessagesPanel
          initialPeerId={dmPeer}
          onConsumedPeer={() => {
            setDmPeer(null)
            const next = new URLSearchParams(params)
            next.delete('dm')
            setParams(next, { replace: true })
          }}
        />
      ) : (
        <>
          {tab === 'feed' && (
            <Card>
              <CardContent className="p-3 sm:p-4 space-y-3">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Поделитесь кейсом, вопросом или протоколом…"
                  rows={3}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" onClick={publish} disabled={!draft.trim() || publishing}>
                    {publishing ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Plus size={14} className="mr-1.5" />}
                    Опубликовать
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === 'feed' && (
            <div className="flex gap-2 overflow-x-auto pb-1 overscroll-x-contain max-w-full">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  className={cn(
                    'shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors',
                    topic === t ? 'bg-dv-gold/15 border-dv-gold/30 text-dv-gold' : 'border-bdr-subtle text-txt-muted',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16 text-txt-muted"><Loader2 className="animate-spin" size={22} /></div>
          ) : posts.length === 0 ? (
            <EmptyState
              title={tab === 'saved' ? 'Нет сохранённых' : 'Лента пуста'}
              description={tab === 'saved' ? 'Нажмите закладку на посте, чтобы сохранить.' : 'Опубликуйте первый тред.'}
            />
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {posts.map((post) => (
                <Card key={post.id} className="overflow-hidden">
                  <CardContent className="p-3 sm:p-4 space-y-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={post.authorName || 'User'} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-txt-primary truncate">{post.authorName}</p>
                        <p className="text-[11px] text-txt-muted truncate">
                          {post.authorRole} · {timeAgo(post.createdAt)}
                        </p>
                      </div>
                      {post.authorId && post.authorId !== user?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0"
                          icon={<MessageCircle size={14} />}
                          onClick={() => void messageAuthor(post.authorId)}
                        >
                          <span className="hidden sm:inline">Написать</span>
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-txt-secondary whitespace-pre-wrap break-words">{post.content}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(post.tags || []).map((t: string) => (
                        <Badge key={t} variant="gold" size="xs">#{t}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 pt-1 text-txt-muted">
                      <button
                        type="button"
                        className={cn('inline-flex items-center gap-1.5 text-xs', post.liked ? 'text-error' : 'hover:text-txt-primary')}
                        onClick={() => void toggleLike(post.id)}
                      >
                        <Heart size={14} fill={post.liked ? 'currentColor' : 'none'} />
                        {post.likesCount || 0}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-xs hover:text-txt-primary"
                        onClick={() => void openComments(post.id)}
                      >
                        <MessageSquare size={14} />
                        {post.commentsCount || 0}
                      </button>
                      <button
                        type="button"
                        className={cn('inline-flex items-center gap-1.5 text-xs', post.saved ? 'text-dv-gold' : 'hover:text-txt-primary')}
                        onClick={() => void toggleSave(post.id)}
                      >
                        <Bookmark size={14} fill={post.saved ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-xs hover:text-txt-primary ml-auto"
                        onClick={() => void sharePost(post)}
                      >
                        <Share2 size={14} />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Comments sheet */}
      {commentPostId && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Закрыть" onClick={() => setCommentPostId(null)} />
          <div className="relative w-full sm:max-w-md max-h-[80dvh] rounded-t-2xl sm:rounded-2xl border border-bdr-subtle bg-surface-1 shadow-modal flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-bdr-subtle shrink-0">
              <p className="text-sm font-semibold text-txt-primary">Комментарии</p>
              <button type="button" onClick={() => setCommentPostId(null)} className="p-1.5 rounded-lg text-txt-muted hover:bg-white/5">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[12rem]">
              {commentsLoading ? (
                <div className="flex justify-center py-8 text-txt-muted"><Loader2 className="animate-spin" size={20} /></div>
              ) : comments.length === 0 ? (
                <p className="text-center text-xs text-txt-muted py-8">Пока тихо — напишите первым</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <Avatar name={c.authorName || '?'} size="sm" />
                    <div className="min-w-0 flex-1 rounded-xl bg-white/[0.04] border border-bdr-subtle px-3 py-2">
                      <p className="text-xs font-semibold text-txt-primary">{c.authorName}</p>
                      <p className="text-sm text-txt-secondary whitespace-pre-wrap break-words mt-0.5">{c.content}</p>
                      <p className="text-[10px] text-txt-muted mt-1">{timeAgo(c.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center gap-2 p-3 border-t border-bdr-subtle shrink-0">
              <Input
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Комментарий…"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void sendComment()
                  }
                }}
              />
              <Button size="sm" icon={<Send size={14} />} onClick={() => void sendComment()} disabled={!commentDraft.trim()} />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
