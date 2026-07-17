import { useEffect, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/store/auth.store'
import {
  ShoppingCart, Package, Tag, Truck, Plus, Pencil, Trash2, Search,
} from 'lucide-react'
import {
  Card, CardHeader, CardTitle, CardContent,
  Input, Textarea, Select, Button, Modal, ConfirmModal,
  EmptyState, Tabs, useToast, Badge, PageHeader,
} from '../../components/ui/ds'
import {
  getShopProducts, createShopProduct, updateShopProduct, deleteShopProduct,
  getShopCategories, createShopCategory, deleteShopCategory,
  getShopSuppliers, createShopSupplier, deleteShopSupplier,
} from '../../utils/api'

type Product = any
type Category = any
type Supplier = any

function useMakeToast() {
  const api = useToast()
  return {
    success: (m: string) => api.toast({ type: 'success', title: m }),
    error: (m: string) => api.toast({ type: 'error', title: m }),
  }
}

export default function ShopAdmin() {
  const { user } = useAuth()
  const [tab, setTab] = useState('products')

  if (user?.role !== 'superadmin') return <Navigate to="/shop" replace />

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <PageHeader
        title="Кабинет продавца"
        subtitle="Управляйте товарами, категориями и поставщиками Магазина"
        icon={<ShoppingCart size={16} />}
      />
      <Tabs
        tabs={[
          { id: 'products', label: 'Товары', icon: <Package size={16} /> },
          { id: 'categories', label: 'Категории', icon: <Tag size={16} /> },
          { id: 'suppliers', label: 'Поставщики', icon: <Truck size={16} /> },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'products' && <ProductsManager />}
      {tab === 'categories' && <CategoriesManager />}
      {tab === 'suppliers' && <SuppliersManager />}
    </div>
  )
}

function ProductsManager() {
  const toast = useMakeToast()
  const [items, setItems] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)
  const [open, setOpen] = useState(false)
  const [toDelete, setToDelete] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const load = useCallback(async () => {
    setLoading(true)
    const [p, c, s] = await Promise.all([getShopProducts(), getShopCategories(), getShopSuppliers()])
    setItems(p); setCategories(c); setSuppliers(s); setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', brand: '', model: '', price: '', oldPrice: '', categoryId: '', supplierId: '', stock: '', minStock: '', description: '', tags: '', imageUrl: '' })
    setOpen(true)
  }
  function openEdit(item: Product) {
    setEditing(item)
    setForm({
      name: item.name || '', brand: item.brand || '', model: item.model || '',
      price: String(item.price ?? ''), oldPrice: item.oldPrice ? String(item.oldPrice) : '',
      categoryId: item.categoryId || '', supplierId: item.supplierId || '',
      stock: String(item.stock ?? ''), minStock: String(item.minStock ?? ''),
      description: item.description || '', tags: (item.tags || []).join(', '), imageUrl: item.imageUrl || '',
    })
    setOpen(true)
  }

  async function save() {
    if (!form.name?.trim()) { toast.error('Введите название товара'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        price: Number(form.price) || 0,
        oldPrice: form.oldPrice ? Number(form.oldPrice) : null,
        stock: Number(form.stock) || 0,
        minStock: Number(form.minStock) || 0,
        tags: (form.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
      }
      if (editing) await updateShopProduct(editing.id, payload)
      else await createShopProduct(payload)
      toast.success(editing ? 'Товар обновлён' : 'Товар добавлен')
      setOpen(false); await load()
    } catch (e: any) { toast.error(e?.message || 'Ошибка сохранения') }
    finally { setSaving(false) }
  }

  async function confirmDelete() {
    if (!toDelete) return
    try { await deleteShopProduct(toDelete.id); toast.success('Товар удалён'); await load() }
    catch (e: any) { toast.error(e?.message || 'Ошибка удаления') }
    finally { setToDelete(null) }
  }

  const filtered = items.filter(i => (i.name + ' ' + (i.brand || '')).toLowerCase().includes(query.toLowerCase()))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Товары ({items.length})</CardTitle>
        <div className="flex gap-2">
          <Input placeholder="Поиск..." value={query} onChange={e => setQuery(e.target.value)} icon={<Search size={16} />} className="w-48" />
          <Button onClick={openCreate} icon={<Plus size={16} />}>Добавить</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Загрузка...</p>
          : filtered.length === 0 ? <EmptyState icon={<Package size={16} />} title="Нет товаров" description="Добавьте первый товар в Магазин" />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-2">Название</th><th className="pr-2">Бренд</th>
                      <th className="pr-2">Категория</th><th className="pr-2">Цена</th>
                      <th className="pr-2">Остаток</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(i => (
                      <tr key={i.id} className="border-b last:border-0">
                        <td className="py-2 pr-2 font-medium">{i.name}</td>
                        <td className="pr-2">{i.brand || '—'}</td>
                        <td className="pr-2">{i.category_name || '—'}</td>
                        <td className="pr-2">{i.price?.toLocaleString()} ₸</td>
                        <td className="pr-2">
                          <Badge variant={i.stock > i.minStock ? 'success' : 'danger'}>{i.stock}</Badge>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(i)}><Pencil size={16} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setToDelete(i)}><Trash2 size={16} /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </CardContent>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Редактировать товар' : 'Новый товар'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Название *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input label="Бренд" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
          <Input label="Модель" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
          <Select label="Категория" value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}
            options={categories.map(c => ({ value: c.id, label: c.name }))} placeholder="Выберите" />
          <Select label="Поставщик" value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })}
            options={suppliers.map(s => ({ value: s.id, label: s.name }))} placeholder="Выберите" />
          <Input label="Цена (₸) *" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
          <Input label="Старая цена (₸)" type="number" value={form.oldPrice} onChange={e => setForm({ ...form, oldPrice: e.target.value })} />
          <Input label="Остаток" type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
          <Input label="Мин. остаток" type="number" value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })} />
          <Input label="Теги (через запятую)" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className="md:col-span-2" />
          <Input label="Картинка (URL)" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} className="md:col-span-2" />
          <Textarea label="Описание" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="md:col-span-2" />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
          <Button onClick={save} loading={saving}>{editing ? 'Сохранить' : 'Добавить'}</Button>
        </div>
      </Modal>

      <ConfirmModal open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete}
        title="Удалить товар?" description={toDelete ? `«${toDelete.name}» будет удалён безвозвратно.` : ''} />
    </Card>
  )
}

function CategoriesManager() {
  const toast = useMakeToast()
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Category | null>(null)
  const [open, setOpen] = useState(false)
  const [toDelete, setToDelete] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const load = useCallback(async () => { setLoading(true); setItems(await getShopCategories()); setLoading(false) }, [])
  useEffect(() => { load() }, [load])

  function openCreate() { setEditing(null); setForm({ name: '', slug: '', icon: '', description: '', sortOrder: '' }); setOpen(true) }
  function openEdit(c: Category) { setEditing(c); setForm({ name: c.name, slug: c.slug, icon: c.icon || '', description: c.description || '', sortOrder: String(c.sortOrder ?? 0) }); setOpen(true) }

  async function save() {
    if (!form.name?.trim() || !form.slug?.trim()) { toast.error('Введите название и slug'); return }
    setSaving(true)
    try {
      await createShopCategory({ ...form, sortOrder: Number(form.sortOrder) || 0 })
      toast.success('Категория сохранена'); setOpen(false); await load()
    } catch (e: any) { toast.error(e?.message || 'Ошибка') } finally { setSaving(false) }
  }
  async function confirmDelete() {
    if (!toDelete) return
    try { await deleteShopCategory(toDelete.id); toast.success('Категория удалена'); await load() } catch (e: any) { toast.error(e?.message || 'Ошибка') } finally { setToDelete(null) }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Категории ({items.length})</CardTitle>
        <Button onClick={openCreate} icon={<Plus size={16} />}>Добавить</Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Загрузка...</p>
          : items.length === 0 ? <EmptyState icon={<Tag size={16} />} title="Нет категорий" description="Сгруппируйте товары по категориям" />
            : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(c => (
                  <div key={c.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.slug} {c.icon ? '· ' + c.icon : ''}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil size={16} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setToDelete(c)}><Trash2 size={16} /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
      </CardContent>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Редактировать категорию' : 'Новая категория'}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Название *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input label="Slug *" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="naprimer-instrument" />
          <Input label="Иконка (emoji/символ)" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} />
          <Input label="Порядок" type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: e.target.value })} />
          <Textarea label="Описание" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="col-span-2" />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
          <Button onClick={save} loading={saving}>{editing ? 'Сохранить' : 'Добавить'}</Button>
        </div>
      </Modal>
      <ConfirmModal open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete}
        title="Удалить категорию?" description={toDelete ? `«${toDelete.name}» будет удалена.` : ''} />
    </Card>
  )
}

function SuppliersManager() {
  const toast = useMakeToast()
  const [items, setItems] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [open, setOpen] = useState(false)
  const [toDelete, setToDelete] = useState<Supplier | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const load = useCallback(async () => { setLoading(true); setItems(await getShopSuppliers()); setLoading(false) }, [])
  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', country: 'Казахстан', city: 'Алматы', phone: '', email: '', website: '', rating: '', deliveryDays: '', deliveryCost: '', freeDeliveryFrom: '' })
    setOpen(true)
  }
  function openEdit(s: Supplier) {
    setEditing(s)
    setForm({
      name: s.name, country: s.country || '', city: s.city || '', phone: s.phone || '', email: s.email || '',
      website: s.website || '', rating: String(s.rating ?? ''), deliveryDays: String(s.deliveryDays ?? ''),
      deliveryCost: String(s.deliveryCost ?? ''), freeDeliveryFrom: String(s.freeDeliveryFrom ?? ''),
    })
    setOpen(true)
  }

  async function save() {
    if (!form.name?.trim()) { toast.error('Введите название поставщика'); return }
    setSaving(true)
    try {
      await createShopSupplier({
        ...form,
        rating: Number(form.rating) || 0, deliveryDays: Number(form.deliveryDays) || 0,
        deliveryCost: Number(form.deliveryCost) || 0, freeDeliveryFrom: Number(form.freeDeliveryFrom) || 0,
      })
      toast.success('Поставщик сохранён'); setOpen(false); await load()
    } catch (e: any) { toast.error(e?.message || 'Ошибка') } finally { setSaving(false) }
  }
  async function confirmDelete() {
    if (!toDelete) return
    try { await deleteShopSupplier(toDelete.id); toast.success('Поставщик удалён'); await load() } catch (e: any) { toast.error(e?.message || 'Ошибка') } finally { setToDelete(null) }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Поставщики ({items.length})</CardTitle>
        <Button onClick={openCreate} icon={<Plus size={16} />}>Добавить</Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Загрузка...</p>
          : items.length === 0 ? <EmptyState icon={<Truck size={16} />} title="Нет поставщиков" description="Добавьте поставщиков оборудования" />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-2">Название</th><th className="pr-2">Город</th>
                      <th className="pr-2">Телефон</th><th className="pr-2">Рейтинг</th><th className="pr-2">Доставка, дн.</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(s => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2 pr-2 font-medium">{s.name}</td>
                        <td className="pr-2">{s.city || '—'}</td>
                        <td className="pr-2">{s.phone || '—'}</td>
                        <td className="pr-2">{s.rating ? '★ ' + s.rating : '—'}</td>
                        <td className="pr-2">{s.deliveryDays || '—'}</td>
                        <td className="text-right whitespace-nowrap">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil size={16} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setToDelete(s)}><Trash2 size={16} /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </CardContent>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Редактировать поставщика' : 'Новый поставщик'} size="lg">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Название *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input label="Страна" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          <Input label="Город" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          <Input label="Телефон" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input label="Сайт" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
          <Input label="Рейтинг" type="number" step="0.1" value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })} />
          <Input label="Доставка, дней" type="number" value={form.deliveryDays} onChange={e => setForm({ ...form, deliveryDays: e.target.value })} />
          <Input label="Стоимость доставки (₸)" type="number" value={form.deliveryCost} onChange={e => setForm({ ...form, deliveryCost: e.target.value })} />
          <Input label="Бесплатно от (₸)" type="number" value={form.freeDeliveryFrom} onChange={e => setForm({ ...form, freeDeliveryFrom: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
          <Button onClick={save} loading={saving}>{editing ? 'Сохранить' : 'Добавить'}</Button>
        </div>
      </Modal>
      <ConfirmModal open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete}
        title="Удалить поставщика?" description={toDelete ? `«${toDelete.name}» будет удалён.` : ''} />
    </Card>
  )
}

