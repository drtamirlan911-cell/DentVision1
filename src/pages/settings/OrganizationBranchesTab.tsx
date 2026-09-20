import { useEffect, useMemo, useState } from 'react'
import { Building2, Check, Edit3, MailPlus, Plus, RefreshCw, Save, Users, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import * as api from '@/utils/api'

type Branch = {
  id: string
  code: string
  name: string
  city?: string | null
  address?: string | null
  phone?: string | null
  active: boolean
  isDefault?: boolean
}

type Person = {
  id: string
  userId?: string | null
  fullName?: string
  email?: string | null
  personType?: string
}

export default function OrganizationBranchesTab() {
  const [organization, setOrganization] = useState<any>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [selected, setSelected] = useState<string>('')
  const [editing, setEditing] = useState<Branch | null>(null)
  const [creating, setCreating] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('operator')
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selectedBranch = useMemo(() => branches.find(b => b.id === selected) || null, [branches, selected])

  const load = async () => {
    setBusy(true)
    setError('')
    try {
      const me = await api.getMyOrganization()
      setOrganization(me.organization)
      const nextBranches = (me.branches || []).map((b: any) => ({ ...b, isDefault: Boolean(b.is_default ?? b.isDefault) }))
      setBranches(nextBranches)
      setSelected(prev => prev && nextBranches.some((b: Branch) => b.id === prev) ? prev : nextBranches[0]?.id || '')
      const orgId = me.organization?.id
      if (orgId) {
        const [nextPeople, nextInvites] = await Promise.all([
          api.getOrganizationPersons(orgId),
          api.getOrganizationInvitations(orgId),
        ])
        setPeople(nextPeople)
        setInvitations(nextInvites || [])
      }
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить организацию')
    } finally {
      setBusy(false)
    }
  }

  const loadMembers = async (branchId: string) => {
    if (!branchId) { setMembers([]); return }
    try {
      setMembers(await api.getBranchMembers(branchId))
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить сотрудников филиала')
    }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => { void loadMembers(selected) }, [selected])

  const saveBranch = async () => {
    if (!editing?.name.trim()) return
    setBusy(true); setError('')
    try {
      const result = editing.id
        ? await api.updateBranch(editing.id, { name: editing.name, code: editing.code, city: editing.city || '', address: editing.address || '', phone: editing.phone || '' })
        : await api.createBranch({ organizationId: organization.id, name: editing.name, code: editing.code, city: editing.city || '', address: editing.address || '', phone: editing.phone || '' })
      const branch = result?.data || result
      setEditing(null); setCreating(false)
      await load()
      if (branch?.id) setSelected(branch.id)
    } catch (e: any) {
      setError(e?.message || 'Не удалось сохранить филиал')
    } finally { setBusy(false) }
  }

  const switchBranch = async (branch: Branch) => {
    setBusy(true); setError('')
    try {
      const result = await api.switchContext('organization', organization.id, branch.id)
      if (result?.accessToken) api.setTokens(result.accessToken, result.refreshToken || null)
      setSelected(branch.id)
      await api.openBranchWorkspace(branch.id)
      await loadMembers(branch.id)
    } catch (e: any) {
      setError(e?.message || 'Не удалось переключить филиал')
    } finally { setBusy(false) }
  }

  const makeDefault = async () => {
    if (!selectedBranch) return
    setBusy(true); setError('')
    try { await api.setDefaultBranch(selectedBranch.id); await load() }
    catch (e: any) { setError(e?.message || 'Не удалось изменить основной филиал') }
    finally { setBusy(false) }
  }

  const archive = async () => {
    if (!selectedBranch || !selectedBranch.active) return
    setBusy(true); setError('')
    try { await api.updateBranch(selectedBranch.id, { active: false }); await load() }
    catch (e: any) { setError(e?.message || 'Не удалось архивировать филиал') }
    finally { setBusy(false) }
  }

  const assign = async (userId: string) => {
    if (!selectedBranch || !userId) return
    setBusy(true); setError('')
    try { await api.assignBranchMember(selectedBranch.id, userId); await loadMembers(selectedBranch.id) }
    catch (e: any) { setError(e?.message || 'Не удалось назначить сотрудника') }
    finally { setBusy(false) }
  }

  const toggleMember = async (userId: string, active: boolean) => {
    if (!selectedBranch || !userId) return
    setBusy(true); setError('')
    try { await api.setBranchMemberActive(selectedBranch.id, userId, active); await loadMembers(selectedBranch.id) }
    catch (e: any) { setError(e?.message || 'Не удалось изменить доступ сотрудника') }
    finally { setBusy(false) }
  }

  const unassign = async (userId: string) => {
    if (!selectedBranch || !userId) return
    setBusy(true); setError('')
    try { await api.unassignBranchMember(selectedBranch.id, userId); await loadMembers(selectedBranch.id) }
    catch (e: any) { setError(e?.message || 'Не удалось убрать сотрудника') }
    finally { setBusy(false) }
  }

  const createInvite = async () => {
    if (!organization?.id) return
    setBusy(true); setError(''); setInviteCode('')
    try {
      const result = await api.createOrganizationInvitation({ organizationId: organization.id, email: inviteEmail || undefined, role: inviteRole, expiresInDays: 7 })
      const invitation = result?.data || result
      setInviteCode(invitation?.code || '')
      setInviteEmail('')
      setInvitations(await api.getOrganizationInvitations(organization.id))
    } catch (e: any) { setError(e?.message || 'Не удалось создать приглашение') }
    finally { setBusy(false) }
  }

  const memberUserIds = new Set(members.map(m => m.userId || m.user_id).filter(Boolean))
  const assignable = people.filter(p => p.userId && !memberUserIds.has(p.userId))

  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">{error}</div>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Building2 size={16} className="text-dv-gold" />Организация и филиалы</CardTitle>
            <p className="text-xs text-txt-muted mt-1">{organization?.name || 'Загрузка…'} · {organization?.type || '—'}</p>
          </div>
          <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} onClick={() => void load()} disabled={busy}>Обновить</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            {branches.map(branch => (
              <button key={branch.id} onClick={() => setSelected(branch.id)}
                className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${selected === branch.id ? 'border-dv-gold/40 bg-dv-gold/5' : 'border-bdr-subtle hover:border-dv-gold/20'} ${!branch.active ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-txt-primary">
                      {branch.name}
                      {branch.isDefault && <span className="text-[10px] rounded-full bg-dv-gold/15 text-dv-gold px-2 py-0.5">Основной</span>}
                      {!branch.active && <span className="text-[10px] rounded-full bg-surface-2 text-txt-muted px-2 py-0.5">Архив</span>}
                    </div>
                    <div className="text-xs text-txt-muted mt-1">{branch.code}{branch.city ? ` · ${branch.city}` : ''}{branch.address ? ` · ${branch.address}` : ''}</div>
                  </div>
                  {selected === branch.id && <Check size={16} className="text-dv-gold shrink-0" />}
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<Plus size={14} />} onClick={() => { setCreating(true); setEditing({ id: '', name: '', code: '', city: '', address: '', phone: '', active: true }) }}>Новый филиал</Button>
            {selectedBranch && <Button size="sm" variant="secondary" icon={<Edit3 size={14} />} onClick={() => setEditing({ ...selectedBranch })}>Редактировать</Button>}
            {selectedBranch && selectedBranch.active && <Button size="sm" variant="ghost" onClick={() => void archive()}>Архивировать</Button>}
            {selectedBranch && selectedBranch.active && !selectedBranch.isDefault && <Button size="sm" variant="ghost" onClick={() => void makeDefault()}>Сделать основным</Button>}
            {selectedBranch && selectedBranch.active && <Button size="sm" variant="ghost" onClick={() => void switchBranch(selectedBranch)}>Открыть филиал</Button>}
          </div>
        </CardContent>
      </Card>

      {(editing || creating) && (
        <Card>
          <CardHeader><CardTitle>{creating ? 'Создание филиала' : 'Редактирование филиала'}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(['name','code','city','address','phone'] as const).map(field => (
              <label key={field} className="text-xs text-txt-muted">
                {field === 'name' ? 'Название *' : field === 'code' ? 'Код' : field === 'city' ? 'Город' : field === 'address' ? 'Адрес' : 'Телефон'}
                <input value={String(editing?.[field] || '')} onChange={e => setEditing(prev => prev ? { ...prev, [field]: e.target.value } : prev)}
                  className="mt-1 w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary min-h-11 focus:outline-none focus:ring-1 focus:ring-dv-gold" />
              </label>
            ))}
            <div className="sm:col-span-2 flex gap-2">
              <Button size="sm" icon={<Save size={14} />} onClick={() => void saveBranch()} disabled={busy || !editing?.name.trim()}>Сохранить</Button>
              <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={() => { setEditing(null); setCreating(false) }}>Отмена</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedBranch && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users size={16} />Команда филиала</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {members.length ? members.map(member => (
              <div key={member.id} className="flex items-center justify-between gap-3 py-2 border-b border-bdr-subtle last:border-0">
                <div><p className="text-sm text-txt-primary">{member.name}</p><p className="text-xs text-txt-muted">{member.email || member.role}</p></div>
                {member.userId && <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => void toggleMember(member.userId, false)}>Отключить</Button>
                  <Button size="sm" variant="ghost" onClick={() => void unassign(member.userId)}>Убрать</Button>
                </div>}
              </div>
            )) : <p className="text-sm text-txt-muted">В филиале пока нет сотрудников.</p>}
            {assignable.length > 0 && (
              <div>
                <p className="text-xs text-txt-muted mb-2">Назначить сотрудника</p>
                <div className="flex flex-wrap gap-2">
                  {assignable.slice(0, 12).map(person => <Button key={person.id} size="sm" variant="secondary" onClick={() => void assign(person.userId!)}>{person.fullName || person.email || 'Сотрудник'}</Button>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MailPlus size={16} />Приглашения</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email сотрудника (необязательно)"
              className="bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary min-h-11" />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary min-h-11">
              <option value="operator">Оператор</option><option value="manager">Менеджер</option><option value="admin">Администратор</option><option value="radiologist">Радиолог</option>
            </select>
            <Button size="sm" onClick={() => void createInvite()} disabled={busy} icon={<MailPlus size={14} />}>Создать</Button>
          </div>
          {inviteCode && <div className="rounded-lg border border-dv-gold/30 bg-dv-gold/5 px-3 py-2 text-sm text-txt-primary">Код приглашения: <strong>{inviteCode}</strong></div>}
          {invitations.length > 0 && (
            <div className="space-y-1">
              {invitations.slice(0, 10).map(inv => <div key={inv.id} className="flex justify-between gap-3 text-xs py-2 border-b border-bdr-subtle"><span className="text-txt-primary">{inv.email || 'Без ограничения email'} · {inv.role}</span><span className="flex items-center gap-2 text-txt-muted">{inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : 'без срока'}<Button size="sm" variant="ghost" onClick={async () => { try { await api.revokeOrganizationInvitation(inv.id); setInvitations(await api.getOrganizationInvitations(organization.id)) } catch (e:any) { setError(e?.message || 'Не удалось отозвать приглашение') } }}>Отозвать</Button></span></div>)}
            </div>
          )}
          <p className="text-[11px] text-txt-muted">Приглашение действительно 7 дней. Для адресного приглашения email проверяется сервером.</p>
        </CardContent>
      </Card>
    </div>
  )
}
