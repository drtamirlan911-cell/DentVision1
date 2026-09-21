import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, Building2, FileText, Download, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGuestStore } from '@/store/guest.store';
import { getPublicCommercialTerms, getPublicCommercialDocuments } from '@/utils/api';

const money=(value:number|null|undefined)=>value==null?'—':new Intl.NumberFormat('ru-RU').format(value)+' ₸';
const docTypeFor=(type:string)=>type==='diagnostic_center'?'DIAGNOSTICS_AGREEMENT':type==='medical_lab'||type==='dental_lab'?'LABORATORY':type==='supplier'?'SUPPLIER_AGREEMENT':type==='academy'?'ACADEMY_AGREEMENT':type==='lecturer'?'LECTURER_AGREEMENT':'CLINIC_AGREEMENT';

export default function Pricing(){
  const navigate=useNavigate();
  const {setRegistrationModal}=useGuestStore();
  const [terms,setTerms]=useState<any>(null);
  const [selectedType,setSelectedType]=useState('clinic');
  const [documents,setDocuments]=useState<any[]>([]);
  const [openDoc,setOpenDoc]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{let alive=true;getPublicCommercialTerms().then(v=>{if(alive)setTerms(v)}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[]);
  const selected=useMemo(()=>terms?.terms?.find((x:any)=>x.type===selectedType),[terms,selectedType]);
  useEffect(()=>{if(!selected)return;getPublicCommercialDocuments(docTypeFor(selectedType)).then(setDocuments).catch(()=>setDocuments([]))},[selected,selectedType]);
  const download=(doc:any)=>{const blob=new Blob([doc.content||''],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=(doc.name||doc.type||'dentvision-document').replace(/[^a-z0-9а-яё_-]+/gi,'_')+'.html';a.click();URL.revokeObjectURL(url)};
  return <div className="min-h-screen bg-surface-0 max-w-full overflow-x-hidden">
    <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-dv-gold/10 border border-dv-gold/20 mb-4"><Crown size={14} className="text-dv-gold"/><span className="text-xs font-semibold text-dv-gold">Тарифы и условия</span></div>
        <h1 className="text-3xl md:text-4xl font-bold text-txt-primary mb-3">Стоимость до регистрации</h1>
        <p className="text-base text-txt-secondary max-w-2xl mx-auto">Подписки, комиссии, минимальные и максимальные сборы и модели распределения видны до создания аккаунта.</p>
      </motion.div>
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-bold text-txt-primary">Тарифы клиники</h2>
        {(() => {
          const clinic = terms?.terms?.find((item: any) => item.type === 'clinic');
          const subscriptions = clinic?.subscriptions ?? [];
          return subscriptions.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {subscriptions.map((plan: any) => (
                <div key={plan.name} className="rounded-2xl border border-bdr-subtle bg-surface-1 p-5">
                  {plan.name === 'NETWORK' ? (
                    <Crown size={20} className="mb-3 text-dv-gold" />
                  ) : (
                    <Building2 size={20} className="mb-3 text-dv-gold" />
                  )}
                  <h3 className="font-bold text-txt-primary">{plan.name}</h3>
                  <div className="mt-1 text-2xl font-bold text-txt-primary">{money(plan.priceKzt)}</div>
                  <div className="text-xs text-txt-muted">
                    {plan.period === 'month_per_branch' ? '₸ / месяц / филиал' : '₸ / месяц'}
                  </div>
                  {plan.note && <p className="mt-3 text-sm text-txt-secondary">{plan.note}</p>}
                  {plan.features?.length ? (
                    <ul className="mt-4 space-y-2">
                      {plan.features.map((feature: string) => (
                        <li key={feature} className="flex gap-2 text-sm text-txt-secondary">
                          <Check size={14} className="mt-0.5 shrink-0 text-success" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-bdr-subtle bg-surface-1 p-5 text-sm text-txt-muted">
              Тарифы временно недоступны.
            </div>
          );
        })()}
        <p className="mt-3 text-xs text-txt-muted">
          Цены синхронизированы с действующей экономической политикой DentVision. Комиссия с общей клинической выручки по умолчанию 0%.
        </p>
      </section>
      <section className="rounded-2xl border border-bdr-subtle bg-surface-1 p-5 md:p-7">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5"><div><h2 className="text-xl font-bold text-txt-primary">Комиссии и подписки всех участников</h2><p className="text-sm text-txt-secondary mt-1">Здесь отображаются все опубликованные экономические условия до регистрации.</p></div><select aria-label="Тип участника" value={selectedType} onChange={e=>setSelectedType(e.target.value)} className="min-h-11 rounded-lg border border-bdr-subtle bg-surface-0 px-3 text-sm text-txt-primary">{(terms?.terms||[]).map((x:any)=><option key={x.type} value={x.type}>{x.label}</option>)}</select></div>
        {loading?<div className="py-10 flex justify-center"><Loader2 className="animate-spin text-txt-muted"/></div>:selected?<div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-bdr-subtle p-4"><h3 className="font-semibold text-txt-primary">Подписка</h3>{selected.subscriptions.length?selected.subscriptions.map((s:any)=><div key={s.name} className="mt-3 flex justify-between gap-4 text-sm"><span className="text-txt-secondary">{s.name}{s.note?' — '+s.note:''}</span><strong>{money(s.priceKzt)} <span className="font-normal text-txt-muted">/ {s.period.replaceAll('_',' ')}</span></strong></div>):<p className="mt-3 text-sm text-txt-muted">Фиксированная подписка не установлена.</p>}</div>
            <div className="rounded-xl border border-bdr-subtle p-4"><h3 className="font-semibold text-txt-primary">Комиссия DentVision</h3><p className="mt-3 text-sm text-txt-secondary">Ставка: <strong>{selected.transaction.ratePercent==null?'зависит от модели':selected.transaction.ratePercent+'%'}</strong></p><p className="mt-2 text-sm text-txt-secondary">Минимум: <strong>{money(selected.transaction.minKzt)}</strong></p><p className="mt-2 text-sm text-txt-secondary">Максимум: <strong>{money(selected.transaction.capKzt)}</strong></p><p className="mt-2 text-sm text-txt-secondary">Основание: {selected.transaction.basis}</p>{selected.transaction.note&&<p className="mt-2 text-xs text-txt-muted">{selected.transaction.note}</p>}</div>
          </div>
          {selected.transaction.volumeTiers?.length?<div><h3 className="font-semibold text-txt-primary mb-3">Объёмные уровни</h3><div className="grid gap-2">{selected.transaction.volumeTiers.map((t:any,i:number)=><div key={i} className="flex justify-between rounded-lg bg-surface-0 border border-bdr-subtle px-3 py-2 text-sm"><span className="text-txt-secondary">{t.gmvFromKzt!=null?'GMV от '+money(t.gmvFromKzt):t.label}</span><strong>{t.ratePercent}%{t.negotiatedRangePercent?' (договорной диапазон '+t.negotiatedRangePercent[0]+'–'+t.negotiatedRangePercent[1]+'%)':''}</strong></div>)}</div></div>:null}
          {selected.acquisitionModels?.length?<div><h3 className="font-semibold text-txt-primary mb-3">Модели привлечения студентов</h3><div className="grid gap-2">{selected.acquisitionModels.map((m:any)=><div key={m.name} className="rounded-lg border border-bdr-subtle p-3 text-sm"><div className="text-txt-primary">{m.name}</div><div className="text-txt-secondary mt-1">DentVision {m.dentVisionPercent}% · Лектор {m.lecturerPercent}%</div></div>)}</div></div>:null}
          <div className="rounded-xl bg-surface-0 border border-bdr-subtle p-4 text-sm text-txt-secondary"><strong className="text-txt-primary">Прозрачность:</strong> комиссия считается по коммерческому settlement-событию. Эквайринг/платёжные расходы, возвраты, chargeback и налоги не скрываются внутри комиссии DentVision.</div>
        </div>:null}
      </section>
      <section className="mt-8 rounded-2xl border border-bdr-subtle bg-surface-1 p-5 md:p-7">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-txt-primary">Документы до регистрации</h2><p className="text-sm text-txt-secondary mt-1">Опубликованные версии можно открыть и скачать без аккаунта.</p></div><FileText size={20} className="text-txt-muted"/></div>
        {documents.length?<div className="mt-5 grid gap-3">{documents.map(doc=><div key={doc.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl border border-bdr-subtle p-4"><div><div className="font-semibold text-txt-primary">{doc.name}</div><div className="text-xs text-txt-muted mt-1">Версия {doc.version}</div></div><div className="flex gap-2"><button className="min-h-10 px-3 rounded-lg border border-bdr-subtle text-sm" onClick={()=>setOpenDoc(doc)}>Открыть</button><button className="min-h-10 px-3 rounded-lg border border-bdr-subtle text-sm inline-flex items-center gap-2" onClick={()=>download(doc)}><Download size={14}/>Скачать</button></div></div>)}</div>:<p className="mt-5 text-sm text-txt-muted">Для выбранного типа пока нет опубликованной версии документа.</p>}
      </section>
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"><button onClick={()=>setRegistrationModal(true)} className="min-h-11 px-5 rounded-lg bg-dv-gold text-dv-gold-on font-semibold">Начать самостоятельно</button><button onClick={()=>navigate('/login')} className="min-h-11 px-5 rounded-lg border border-bdr-subtle text-txt-primary">Войти / зарегистрироваться</button></div>
      {openDoc&&<div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center" onClick={()=>setOpenDoc(null)}><div className="w-full max-w-4xl max-h-[90vh] overflow-auto rounded-2xl bg-surface-1 border border-bdr-subtle p-5" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between mb-4"><h2 className="font-bold text-txt-primary">{openDoc.name}</h2><button aria-label="Закрыть" className="min-h-10 min-w-10 rounded-lg border border-bdr-subtle" onClick={()=>setOpenDoc(null)}>×</button></div><pre className="whitespace-pre-wrap text-sm leading-6 text-txt-secondary">{openDoc.content}</pre></div></div>}
    </div>
  </div>;
}