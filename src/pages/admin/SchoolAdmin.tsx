import { useEffect, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/store/auth.store'
import {
  GraduationCap, BookOpen, Lightbulb, Library, Plus, Pencil, Trash2, Search,
  GripVertical, X,
} from 'lucide-react'
import {
  Card, CardHeader, CardTitle, CardContent,
  Input, Textarea, Select, Button, Modal, ConfirmModal,
  EmptyState, Tabs, useToast, Badge, PageHeader, Switch,
} from '../../components/ui/ds'
import {
  getSchoolCourses, createSchoolCourse, updateSchoolCourse, deleteSchoolCourse,
  getSchoolClinicalCases, createSchoolClinicalCase, deleteSchoolClinicalCase,
  getSchoolLibrary, createSchoolLibraryItem, deleteSchoolLibraryItem,
} from '../../utils/api'

function useMakeToast() {
  const api = useToast()
  return {
    success: (m: string) => api.toast({ type: 'success', title: m }),
    error: (m: string) => api.toast({ type: 'error', title: m }),
  }
}

export default function SchoolAdmin() {
  const { user } = useAuth()
  const [tab, setTab] = useState('courses')

  if (user?.role !== 'superadmin') return <Navigate to="/school" replace />

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <PageHeader
        title="Кабинет методиста"
        subtitle="Управляйте курсами, клиническими кейсами и библиотекой Академии"
        icon={<GraduationCap size={16} />}
      />
      <Tabs
        tabs={[
          { id: 'courses', label: 'Курсы', icon: <BookOpen size={16} /> },
          { id: 'cases', label: 'Кейсы', icon: <Lightbulb size={16} /> },
          { id: 'library', label: 'Библиотека', icon: <Library size={16} /> },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'courses' && <CoursesManager />}
      {tab === 'cases' && <CasesManager />}
      {tab === 'library' && <LibraryManager />}
    </div>
  )
}

function CoursesManager() {
  const toast = useMakeToast()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [toDelete, setToDelete] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const load = useCallback(async () => { setLoading(true); setItems(await getSchoolCourses()); setLoading(false) }, [])
  useEffect(() => { load() }, [load])

  function blankCourse() {
    return {
      title: '', category: '', subtitle: '', description: '', instructor: '', instructorTitle: '',
      difficulty: 'beginner', durationHours: '', lessonCount: '', price: '', rating: '',
      tags: '', imageUrl: '', certificateEnabled: true, modules: [],
    }
  }
  function openCreate() { setEditing(null); setForm(blankCourse()); setOpen(true) }
  function openEdit(c: any) {
    setEditing(c)
    setForm({
      title: c.title, category: c.category, subtitle: c.subtitle || '', description: c.description || '',
      instructor: c.instructor || '', instructorTitle: c.instructorTitle || '', difficulty: c.difficulty || 'beginner',
      durationHours: String(c.durationHours ?? ''), lessonCount: String(c.lessonCount ?? ''),
      price: String(c.price ?? ''), rating: String(c.rating ?? ''), tags: (c.tags || []).join(', '),
      imageUrl: c.imageUrl || '', certificateEnabled: c.certificateEnabled !== false,
      modules: (c.modules || []).map((m: any) => ({
        id: m.id, title: m.title,
        lessons: (m.lessons || []).map((l: any) => ({ id: l.id, title: l.title, duration: String(l.duration || 0), type: l.type || 'video', contentUrl: l.contentUrl || '' })),
      })),
    })
    setOpen(true)
  }

  function addModule() { setForm({ ...form, modules: [...form.modules, { title: '', lessons: [] }] }) }
  function updateModule(idx: number, patch: any) {
    const modules = [...form.modules]; modules[idx] = { ...modules[idx], ...patch }; setForm({ ...form, modules })
  }
  function removeModule(idx: number) { const modules = [...form.modules]; modules.splice(idx, 1); setForm({ ...form, modules }) }
  function addLesson(mIdx: number) {
    const modules = [...form.modules]
    modules[mIdx].lessons = [...(modules[mIdx].lessons || []), { title: '', duration: '', type: 'video', contentUrl: '' }]
    setForm({ ...form, modules })
  }
  function updateLesson(mIdx: number, lIdx: number, patch: any) {
    const modules = [...form.modules]
    modules[mIdx].lessons[lIdx] = { ...modules[mIdx].lessons[lIdx], ...patch }
    setForm({ ...form, modules })
  }
  function removeLesson(mIdx: number, lIdx: number) {
    const modules = [...form.modules]; modules[mIdx].lessons.splice(lIdx, 1); setForm({ ...form, modules })
  }

  async function save() {
    if (!form.title?.trim()) { toast.error('Введите название курса'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        durationHours: Number(form.durationHours) || 0, lessonCount: Number(form.lessonCount) || 0,
        price: Number(form.price) || 0, rating: Number(form.rating) || 0,
        tags: (form.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
        modules: (form.modules || []).map((m: any) => ({
          id: m.id, title: m.title,
          lessons: (m.lessons || []).map((l: any) => ({ id: l.id, title: l.title, duration: Number(l.duration) || 0, type: l.type, contentUrl: l.contentUrl || null })),
        })),
      }
      if (editing) await updateSchoolCourse(editing.id, payload)
      else await createSchoolCourse(payload)
      toast.success(editing ? 'Курс обновлён' : 'Курс создан')
      setOpen(false); await load()
    } catch (e: any) { toast.error(e?.message || 'Ошибка сохранения') }
    finally { setSaving(false) }
  }
  async function confirmDelete() {
    if (!toDelete) return
    try { await deleteSchoolCourse(toDelete.id); toast.success('Курс удалён'); await load() } catch (e: any) { toast.error(e?.message || 'Ошибка') } finally { setToDelete(null) }
  }

  const filtered = items.filter(i => (i.title + ' ' + (i.category || '')).toLowerCase().includes(query.toLowerCase()))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Курсы ({items.length})</CardTitle>
        <div className="flex gap-2">
          <Input placeholder="Поиск..." value={query} onChange={e => setQuery(e.target.value)} icon={<Search size={16} />} className="w-48" />
          <Button onClick={openCreate} icon={<Plus size={16} />}>Добавить</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Загрузка...</p>
          : filtered.length === 0 ? <EmptyState icon={<BookOpen size={16} />} title="Нет курсов" description="Создайте первый курс Академии" />
            : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filtered.map(c => (
                  <div key={c.id} className="border rounded-lg p-3 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.title}</p>
                        <p className="text-xs text-muted-foreground">{c.category}{c.instructor ? ' · ' + c.instructor : ''}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil size={16} /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setToDelete(c)}><Trash2 size={16} /></Button>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{c.difficulty}</Badge>
                      <span>{c.durationHours} ч</span>
                      <span>· {c.lessonCount} ур.</span>
                      {c.price > 0 ? <span>· {c.price.toLocaleString()} ₸</span> : <Badge variant="success">Бесплатно</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
      </CardContent>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Редактировать курс' : 'Новый курс'} size="xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Название *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Input label="Категория" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Имплантология" />
          <Input label="Подзаголовок" value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} className="md:col-span-2" />
          <Textarea label="Описание" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="md:col-span-2" />
          <Input label="Преподаватель" value={form.instructor} onChange={e => setForm({ ...form, instructor: e.target.value })} />
          <Input label="Должность преподавателя" value={form.instructorTitle} onChange={e => setForm({ ...form, instructorTitle: e.target.value })} />
          <Select label="Сложность" value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}
            options={[{ value: 'beginner', label: 'Начальный' }, { value: 'intermediate', label: 'Средний' }, { value: 'advanced', label: 'Продвинутый' }]} />
          <Input label="Часов" type="number" value={form.durationHours} onChange={e => setForm({ ...form, durationHours: e.target.value })} />
          <Input label="Уроков" type="number" value={form.lessonCount} onChange={e => setForm({ ...form, lessonCount: e.target.value })} />
          <Input label="Цена (₸, 0 = бесплатно)" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
          <Input label="Рейтинг" type="number" step="0.1" value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })} />
          <Input label="Теги (через запятую)" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className="md:col-span-2" />
          <Input label="Картинка (URL)" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} className="md:col-span-2" />
          <label className="flex items-center gap-2 md:col-span-2 cursor-pointer">
            <Switch checked={!!form.certificateEnabled} onCheckedChange={v => setForm({ ...form, certificateEnabled: v })} />
            <span className="text-sm">Выдавать сертификат после прохождения</span>
          </label>
        </div>

        <div className="mt-4 border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium">Модули и уроки</p>
            <Button variant="outline" size="sm" onClick={addModule} icon={<Plus size={16} />}>Модуль</Button>
          </div>
          <div className="space-y-2">
              {(form.modules || []).map((m: any, mi: number) => (
              <div key={mi} className="border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <GripVertical size={16} className="text-muted-foreground" />
                  <Input placeholder="Название модуля" value={m.title} onChange={e => updateModule(mi, { title: e.target.value })} className="flex-1" />
                  <Button variant="ghost" size="icon" onClick={() => removeModule(mi)}><Trash2 size={16} /></Button>
                </div>
                <div className="ml-6 mt-2 space-y-2">
                  {(m.lessons || []).map((l: any, li: number) => (
                    <div key={li} className="flex items-center gap-2">
                      <Input placeholder="Название урока" value={l.title} onChange={e => updateLesson(mi, li, { title: e.target.value })} className="flex-1" />
                      <Input type="number" placeholder="мин" value={l.duration} onChange={e => updateLesson(mi, li, { duration: e.target.value })} className="w-20" />
                      <Select value={l.type} onChange={e => updateLesson(mi, li, { type: e.target.value })}
                        options={[{ value: 'video', label: 'Видео' }, { value: 'text', label: 'Текст' }, { value: 'quiz', label: 'Тест' }]} className="w-28" />
                      <Button variant="ghost" size="icon" onClick={() => removeLesson(mi, li)}><X size={16} /></Button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => addLesson(mi)} icon={<Plus size={16} />}>Урок</Button>
                </div>
              </div>
            ))}
            {(form.modules || []).length === 0 && <p className="text-xs text-muted-foreground">Модули не добавлены — курс без уроков</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
          <Button onClick={save} loading={saving}>{editing ? 'Сохранить' : 'Создать'}</Button>
        </div>
      </Modal>

      <ConfirmModal open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete}
        title="Удалить курс?" description={toDelete ? `«${toDelete.title}» будет удалён вместе с модулями.` : ''} />
    </Card>
  )
}

function CasesManager() {
  const toast = useMakeToast()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [toDelete, setToDelete] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const load = useCallback(async () => { setLoading(true); setItems(await getSchoolClinicalCases()); setLoading(false) }, [])
  useEffect(() => { load() }, [load])

  function openCreate() { setEditing(null); setForm({ category: '', title: '', description: '', difficulty: 'beginner', author: '', imageUrl: '' }); setOpen(true) }
  function openEdit(c: any) { setEditing(c); setForm({ category: c.category, title: c.title, description: c.description || '', difficulty: c.difficulty || 'beginner', author: c.author || '', imageUrl: c.imageUrl || '' }); setOpen(true) }

  async function save() {
    if (!form.title?.trim()) { toast.error('Введите название кейса'); return }
    setSaving(true)
    try { await createSchoolClinicalCase(form); toast.success('Кейс сохранён'); setOpen(false); await load() }
    catch (e: any) { toast.error(e?.message || 'Ошибка') } finally { setSaving(false) }
  }
  async function confirmDelete() {
    if (!toDelete) return
    try { await deleteSchoolClinicalCase(toDelete.id); toast.success('Кейс удалён'); await load() } catch (e: any) { toast.error(e?.message || 'Ошибка') } finally { setToDelete(null) }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Клинические кейсы ({items.length})</CardTitle>
        <Button onClick={openCreate} icon={<Plus size={16} />}>Добавить</Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Загрузка...</p>
          : items.length === 0 ? <EmptyState icon={<Lightbulb size={16} />} title="Нет кейсов" description="Добавьте разбор клинического случая" />
            : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map(c => (
                  <div key={c.id} className="border rounded-lg p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.category}{c.author ? ' · ' + c.author : ''}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil size={16} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setToDelete(c)}><Trash2 size={16} /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
      </CardContent>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Редактировать кейс' : 'Новый кейс'} size="lg">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Название *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="col-span-2" />
          <Input label="Категория" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          <Select label="Сложность" value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}
            options={[{ value: 'beginner', label: 'Начальный' }, { value: 'intermediate', label: 'Средний' }, { value: 'advanced', label: 'Продвинутый' }]} />
          <Input label="Автор" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} />
          <Input label="Картинка (URL)" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} />
          <Textarea label="Описание" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="col-span-2" />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
          <Button onClick={save} loading={saving}>{editing ? 'Сохранить' : 'Добавить'}</Button>
        </div>
      </Modal>
      <ConfirmModal open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete}
        title="Удалить кейс?" description={toDelete ? `«${toDelete.title}» будет удалён.` : ''} />
    </Card>
  )
}

function LibraryManager() {
  const toast = useMakeToast()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [toDelete, setToDelete] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const load = useCallback(async () => { setLoading(true); setItems(await getSchoolLibrary()); setLoading(false) }, [])
  useEffect(() => { load() }, [load])

  function openCreate() { setEditing(null); setForm({ category: '', title: '', type: 'article', content: '', fileUrl: '', author: '', tags: '' }); setOpen(true) }
  function openEdit(l: any) { setEditing(l); setForm({ category: l.category, title: l.title, type: l.type || 'article', content: l.content || '', fileUrl: l.fileUrl || '', author: l.author || '', tags: (l.tags || []).join(', ') }); setOpen(true) }

  async function save() {
    if (!form.title?.trim()) { toast.error('Введите название'); return }
    setSaving(true)
    try {
      await createSchoolLibraryItem({ ...form, tags: (form.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean) })
      toast.success('Материал сохранён'); setOpen(false); await load()
    } catch (e: any) { toast.error(e?.message || 'Ошибка') } finally { setSaving(false) }
  }
  async function confirmDelete() {
    if (!toDelete) return
    try { await deleteSchoolLibraryItem(toDelete.id); toast.success('Материал удалён'); await load() } catch (e: any) { toast.error(e?.message || 'Ошибка') } finally { setToDelete(null) }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Библиотека ({items.length})</CardTitle>
        <Button onClick={openCreate} icon={<Plus size={16} />}>Добавить</Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Загрузка...</p>
          : items.length === 0 ? <EmptyState icon={<Library size={16} />} title="Пусто" description="Добавьте статьи, видео и файлы" />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-2">Название</th><th className="pr-2">Тип</th><th className="pr-2">Категория</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(l => (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="py-2 pr-2 font-medium">{l.title}</td>
                        <td className="pr-2"><Badge variant="secondary">{l.type}</Badge></td>
                        <td className="pr-2">{l.category || '—'}</td>
                        <td className="text-right whitespace-nowrap">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(l)}><Pencil size={16} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setToDelete(l)}><Trash2 size={16} /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </CardContent>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Редактировать материал' : 'Новый материал'} size="lg">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Название *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="col-span-2" />
          <Input label="Категория" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          <Select label="Тип" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
            options={[{ value: 'article', label: 'Статья' }, { value: 'video', label: 'Видео' }, { value: 'pdf', label: 'PDF' }]} />
          <Input label="Автор" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} />
          <Input label="Файл/ссылка (URL)" value={form.fileUrl} onChange={e => setForm({ ...form, fileUrl: e.target.value })} />
          <Input label="Теги (через запятую)" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className="col-span-2" />
          <Textarea label="Содержимое" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="col-span-2" />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
          <Button onClick={save} loading={saving}>{editing ? 'Сохранить' : 'Добавить'}</Button>
        </div>
      </Modal>
      <ConfirmModal open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete}
        title="Удалить материал?" description={toDelete ? `«${toDelete.title}» будет удалён.` : ''} />
    </Card>
  )
}

