import React, { useState } from 'react'
import { Copy, Image as ImageIcon, Layers, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/ds/Button'
import { Card } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Input, Textarea } from '@/components/ui/ds/Input'
import { Skeleton } from '@/components/ui/ds/Skeleton'
import type { StoredIdea } from '@/utils/api'

const FORMAT_LABEL: Record<string, string> = {
  post: 'Пост',
  reels: 'Reels',
  story: 'Сторис',
  carousel: 'Карусель',
}

interface Props {
  idea: StoredIdea
  /** Генерация картинок настроена и остаток на сегодня не исчерпан. */
  canGenerateImages: boolean
  busyImage: boolean
  onSave: (patch: { title: string; hook: string; caption: string; hashtags: string[]; callToAction: string }) => void
  onCopy: () => void
  onCover: () => void
  onCarousel: () => void
}

/**
 * Карточка идеи: чтение, правка на месте, картинки.
 *
 * Кнопка сохранения появляется только при изменениях — тот же приём, что в
 * карточке правила списания: она не мозолит глаза, пока правки нет.
 */
export function ContentIdeaCard({
  idea, canGenerateImages, busyImage, onSave, onCopy, onCover, onCarousel,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    title: idea.title,
    hook: idea.hook,
    caption: idea.caption,
    hashtags: idea.hashtags.join(' '),
    callToAction: idea.callToAction,
  })

  const original = JSON.stringify({
    title: idea.title,
    hook: idea.hook,
    caption: idea.caption,
    hashtags: idea.hashtags.join(' '),
    callToAction: idea.callToAction,
  })
  const dirty = JSON.stringify(draft) !== original

  const startEdit = () => {
    setDraft({
      title: idea.title,
      hook: idea.hook,
      caption: idea.caption,
      hashtags: idea.hashtags.join(' '),
      callToAction: idea.callToAction,
    })
    setEditing(true)
  }

  const save = () => {
    onSave({
      title: draft.title,
      hook: draft.hook,
      caption: draft.caption,
      callToAction: draft.callToAction,
      hashtags: draft.hashtags.split(/\s+/).map((h) => h.trim()).filter(Boolean),
    })
    setEditing(false)
  }

  return (
    <Card padding="md">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h3 className="text-sm font-bold text-txt-primary m-0">{idea.title}</h3>
          <Badge variant="info" size="sm">{FORMAT_LABEL[idea.format] || idea.format}</Badge>
          {idea.edited && <Badge variant="default" size="sm">отредактировано</Badge>}
        </div>
        <div className="flex flex-wrap gap-1">
          {!editing && (
            <Button variant="ghost" size="sm" className="min-h-11" icon={<Pencil size={14} />} onClick={startEdit}>
              Править
            </Button>
          )}
          <Button variant="ghost" size="sm" className="min-h-11" icon={<Copy size={14} />} onClick={onCopy}>
            Копировать
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <Input label="Заголовок" value={draft.title} className="min-h-11"
            onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <Input label="Хук" value={draft.hook} className="min-h-11"
            onChange={(e) => setDraft({ ...draft, hook: e.target.value })} />
          <Textarea label="Подпись" rows={6} value={draft.caption}
            onChange={(e) => setDraft({ ...draft, caption: e.target.value })} />
          <Input label="Хештеги через пробел" value={draft.hashtags} className="min-h-11"
            onChange={(e) => setDraft({ ...draft, hashtags: e.target.value })} />
          <Input label="Призыв к действию" value={draft.callToAction} className="min-h-11"
            onChange={(e) => setDraft({ ...draft, callToAction: e.target.value })} />
          <div className="flex gap-2">
            <Button className="min-h-11" icon={<Check size={14} />} disabled={!dirty} onClick={save}>
              Сохранить
            </Button>
            <Button variant="ghost" className="min-h-11" icon={<X size={14} />} onClick={() => setEditing(false)}>
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold text-dv-gold m-0 mb-2">{idea.hook}</p>
          <p className="text-sm text-txt-secondary whitespace-pre-wrap m-0 mb-3">{idea.caption}</p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {idea.hashtags.map((h) => (
              <span key={h} className="text-2xs text-txt-muted">{h.startsWith('#') ? h : `#${h}`}</span>
            ))}
          </div>

          {/* Картинки. Пока их нет — заглушка нужной формы, а не пустота. */}
          {busyImage ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {Array.from({ length: idea.format === 'carousel' ? 3 : 1 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : (idea.coverUrl || idea.slideUrls.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {idea.coverUrl && (
                <img src={idea.coverUrl} alt={`Обложка: ${idea.title}`}
                  className="w-full aspect-square object-cover rounded-lg border border-bdr-subtle" />
              )}
              {idea.slideUrls.map((url, i) => (
                <img key={url} src={url} alt={`Слайд ${i + 1}: ${idea.title}`}
                  className="w-full aspect-square object-cover rounded-lg border border-bdr-subtle" />
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-3">
            <Button variant="secondary" size="sm" className="min-h-11" icon={<ImageIcon size={14} />}
              disabled={!canGenerateImages} loading={busyImage} onClick={onCover}>
              {idea.coverUrl ? 'Другая обложка' : 'Обложка'}
            </Button>
            {idea.format === 'carousel' && (
              <Button variant="secondary" size="sm" className="min-h-11" icon={<Layers size={14} />}
                disabled={!canGenerateImages} loading={busyImage} onClick={onCarousel}>
                Слайды
              </Button>
            )}
          </div>

          <div className="rounded-lg bg-surface-1 border border-bdr-subtle p-3 space-y-1">
            <p className="text-2xs text-txt-muted m-0">
              <span className="font-bold">Призыв: </span>{idea.callToAction}
            </p>
            {/* Правке не подлежит: это происхождение идеи, а не копирайт. */}
            <p className="text-2xs text-txt-muted m-0">
              <span className="font-bold">Опирается на: </span>{idea.basedOn}
            </p>
          </div>
        </>
      )}
    </Card>
  )
}
