import { Router } from 'express';
import { Prisma, SupportTicketCategory, SupportTicketPriority, SupportTicketStatus } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { uid } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { canTransitionSupportTicket, isSupportTicketStatus } from './supportState.js';
import { canReadSupportTicket, isSupportStaffRole } from './supportPolicy.js';

export const supportRouter = Router();
supportRouter.use(authenticate);
const CATEGORIES = new Set<string>(Object.values(SupportTicketCategory));
const PRIORITIES = new Set<string>(Object.values(SupportTicketPriority));
const SUPPORT_ROLE = 'SUPPORT' as const;

class SupportRequestError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}
function isStaff(req: AuthRequest) { return Boolean(req.user && isSupportStaffRole(req.user.role)); }
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  // Strip ASCII control characters without a control-character regex (ESLint no-control-regex).
  const clean = Array.from(value).filter((char) => {
    const code = char.charCodeAt(0);
    return code >= 0x20 && code !== 0x7f;
  }).join('').trim();
  return clean.length > 0 && clean.length <= max ? clean : null;
}
function pagination(query: Record<string, unknown>) {
  const p = Number.parseInt(String(query.page ?? '1'), 10), l = Number.parseInt(String(query.limit ?? '30'), 10);
  const page = Number.isFinite(p) ? Math.max(1,p) : 1, limit = Number.isFinite(l) ? Math.min(100,Math.max(1,l)) : 30;
  return { page, limit, skip: (page-1)*limit };
}
async function audit(tx: Prisma.TransactionClient, req: AuthRequest, action: string, ticketId: string, details: Record<string,string|null>) {
  await tx.auditLog.create({ data: {
    id: uid(), userId: req.user!.id, clinicId: null, action, entity: 'support_ticket', entityId: ticketId,
    details: details as Prisma.InputJsonValue, ip: req.ip || req.socket?.remoteAddress || null,
  }});
}
async function notifyStaff(tx: Prisma.TransactionClient, ticketId: string, actorId: string, title: string, message: string) {
  const users = await tx.user.findMany({ where: { role: SUPPORT_ROLE }, select: { id: true } });
  const recipients = users.filter(u => u.id !== actorId);
  if (recipients.length) await tx.notification.createMany({ data: recipients.map(u => ({
    id: uid(), userId: u.id, type: 'support', title, message,
    link: '/help?view=queue&ticketId=' + encodeURIComponent(ticketId),
  }))});
}
async function notifyRequester(tx: Prisma.TransactionClient, requesterId: string|null, actorId: string, ticketId: string, title: string, message: string) {
  if (!requesterId || requesterId === actorId) return;
  await tx.notification.create({ data: { id: uid(), userId: requesterId, type: 'support', title, message, link: '/help?ticketId=' + encodeURIComponent(ticketId) }});
}
const summaryInclude = {
  requester: { select: { id:true, firstName:true, lastName:true, email:true } },
  assignee: { select: { id:true, firstName:true, lastName:true, email:true } },
  _count: { select: { messages:true } },
} satisfies Prisma.SupportTicketInclude;
const detailInclude = {
  ...summaryInclude,
  messages: { orderBy: { createdAt:'asc' as const }, take:100, include:{ author:{select:{id:true,firstName:true,lastName:true,role:true}} } },
} satisfies Prisma.SupportTicketInclude;
function canRead(req: AuthRequest, requesterUserId: string|null) { return canReadSupportTicket(req.user ? { id: req.user.id, role: req.user.role } : null, requesterUserId); }

supportRouter.get('/mine', async (req: AuthRequest,res) => {
  try {
    const { page,limit,skip } = pagination(req.query as Record<string,unknown>);
    const where = { requesterUserId:req.user!.id };
    const [data,total] = await Promise.all([
      prisma.supportTicket.findMany({ where, orderBy:{updatedAt:'desc'}, skip,take:limit,include:summaryInclude }),
      prisma.supportTicket.count({ where }),
    ]);
    return res.json({ok:true,data,pagination:{page,limit,total}});
  } catch (e) { console.error('[support/mine]',e); return res.status(500).json({ok:false,error:'Не удалось загрузить обращения'} satisfies ApiResponse); }
});

supportRouter.get('/queue', async (req: AuthRequest,res) => {
  if (!isStaff(req)) return res.status(403).json({ok:false,error:'Недостаточно прав'} satisfies ApiResponse);
  const {page,limit,skip} = pagination(req.query as Record<string,unknown>);
  const raw = req.query.status;
  const status = raw === undefined || raw === '' || raw === 'ALL' ? undefined : isSupportTicketStatus(raw) ? raw : null;
  if (status === null) return res.status(400).json({ok:false,error:'Некорректный статус'} satisfies ApiResponse);
  const where: Prisma.SupportTicketWhereInput = status ? {status} : {};
  try {
    const [data,total] = await Promise.all([
      prisma.supportTicket.findMany({where,orderBy:[{priority:'desc'},{updatedAt:'asc'}],skip,take:limit,include:summaryInclude}),
      prisma.supportTicket.count({where}),
    ]);
    return res.json({ok:true,data,pagination:{page,limit,total}});
  } catch(e) { console.error('[support/queue]',e); return res.status(500).json({ok:false,error:'Не удалось загрузить очередь'} satisfies ApiResponse); }
});

supportRouter.post('/tickets', async (req: AuthRequest,res) => {
  const subject=cleanText(req.body?.subject,160), description=cleanText(req.body?.description,4000);
  const category=req.body?.category, sourcePath=cleanText(req.body?.sourcePath,240);
  if (!subject || subject.length<3) return res.status(400).json({ok:false,error:'Тема обязательна (3–160 символов)'} satisfies ApiResponse);
  if (!description) return res.status(400).json({ok:false,error:'Описание обязательно (до 4000 символов)'} satisfies ApiResponse);
  if (typeof category!=='string' || !CATEGORIES.has(category)) return res.status(400).json({ok:false,error:'Выберите категорию'} satisfies ApiResponse);
  try {
    const ticket=await prisma.$transaction(async tx=>{
      const created=await tx.supportTicket.create({data:{
        id:uid(),requesterUserId:req.user!.id,category:category as SupportTicketCategory,subject,description,sourcePath,
        status:SupportTicketStatus.OPEN,priority:SupportTicketPriority.NORMAL,
      },include:summaryInclude});
      await audit(tx,req,'support.ticket.created',created.id,{category:created.category,status:created.status,priority:created.priority});
      await notifyStaff(tx,created.id,req.user!.id,'Новое обращение DentVision','В очереди поддержки появилось новое обращение.');
      return created;
    });
    return res.status(201).json({ok:true,data:ticket} satisfies ApiResponse);
  } catch(e) { console.error('[support/create]',e); return res.status(500).json({ok:false,error:'Не удалось создать обращение'} satisfies ApiResponse); }
});

supportRouter.get('/tickets/:id', async (req: AuthRequest,res) => {
  try {
    const ticket=await prisma.supportTicket.findUnique({where:{id:req.params.id},include:detailInclude});
    if(!ticket) return res.status(404).json({ok:false,error:'Обращение не найдено'} satisfies ApiResponse);
    if(!canRead(req,ticket.requesterUserId)) return res.status(403).json({ok:false,error:'Нет доступа к этому обращению'} satisfies ApiResponse);
    // Return the latest 100 messages in chronological order.
    return res.json({ok:true,data:{...ticket,messages:[...ticket.messages].slice(-100)}} satisfies ApiResponse);
  } catch(e) { console.error('[support/detail]',e); return res.status(500).json({ok:false,error:'Не удалось загрузить обращение'} satisfies ApiResponse); }
});

supportRouter.post('/tickets/:id/messages', async (req: AuthRequest,res) => {
  const body=cleanText(req.body?.body,4000);
  if(!body) return res.status(400).json({ok:false,error:'Сообщение обязательно (до 4000 символов)'} satisfies ApiResponse);
  try {
    const result=await prisma.$transaction(async tx=>{
      const ticket=await tx.supportTicket.findUnique({where:{id:req.params.id}});
      if(!ticket) throw new SupportRequestError(404,'Обращение не найдено');
      if(!canRead(req,ticket.requesterUserId)) throw new SupportRequestError(403,'Нет доступа к этому обращению');
      if(ticket.status===SupportTicketStatus.CLOSED) throw new SupportRequestError(409,'Сотрудник поддержки должен возобновить закрытое обращение');
      const staff=isStaff(req);
      let next: SupportTicketStatus|null=null;
      if(staff && ticket.status!==SupportTicketStatus.IN_PROGRESS) next=SupportTicketStatus.IN_PROGRESS;
      if(!staff && (ticket.status===SupportTicketStatus.WAITING_FOR_USER || ticket.status===SupportTicketStatus.RESOLVED)) next=SupportTicketStatus.IN_PROGRESS;
      if(next && !canTransitionSupportTicket(ticket.status,next,staff?'SUPPORT':'REQUESTER')) throw new SupportRequestError(409,'Недопустимый переход статуса');
      if(next) {
        const changed=await tx.supportTicket.updateMany({where:{id:ticket.id,status:ticket.status},data:{
          status:next,resolvedAt:null,closedAt:null,...(staff&&!ticket.firstResponseAt?{firstResponseAt:new Date()}:{}),
        }});
        if(changed.count!==1) throw new SupportRequestError(409,'Обращение уже изменено другим сотрудником');
        await audit(tx,req,'support.ticket.status_changed',ticket.id,{from:ticket.status,to:next,reason:'message'});
      }
      const message=await tx.supportTicketMessage.create({data:{id:uid(),ticketId:ticket.id,authorUserId:req.user!.id,body},include:{author:{select:{id:true,firstName:true,lastName:true,role:true}}}});
      await audit(tx,req,'support.ticket.message_added',ticket.id,{authorRole:staff?'SUPPORT':'REQUESTER',status:next||ticket.status});
      if(staff) await notifyRequester(tx,ticket.requesterUserId,req.user!.id,ticket.id,'Ответ поддержки DentVision','По вашему обращению есть новый ответ.');
      else {
        const assignee=ticket.assigneeUserId?await tx.user.findFirst({where:{id:ticket.assigneeUserId,role:SUPPORT_ROLE},select:{id:true}}):null;
        if(assignee) await tx.notification.create({data:{id:uid(),userId:assignee.id,type:'support',title:'Ответ пользователя DentVision',message:'Пользователь добавил сообщение к обращению.',link:'/help?view=queue&ticketId='+encodeURIComponent(ticket.id)}});
        else await notifyStaff(tx,ticket.id,req.user!.id,'Ответ пользователя DentVision','Пользователь добавил сообщение к обращению.');
      }
      return {message,status:next||ticket.status};
    });
    return res.status(201).json({ok:true,data:result} satisfies ApiResponse);
  } catch(e) {
    if(e instanceof SupportRequestError) return res.status(e.statusCode).json({ok:false,error:e.message} satisfies ApiResponse);
    console.error('[support/message]',e); return res.status(500).json({ok:false,error:'Не удалось отправить сообщение'} satisfies ApiResponse);
  }
});

supportRouter.patch('/tickets/:id', async (req: AuthRequest,res) => {
  if(!isStaff(req)) return res.status(403).json({ok:false,error:'Недостаточно прав'} satisfies ApiResponse);
  const sv=req.body?.status,pv=req.body?.priority,av=req.body?.assigneeUserId;
  if(sv===undefined&&pv===undefined&&av===undefined) return res.status(400).json({ok:false,error:'Нет изменений'} satisfies ApiResponse);
  if(sv!==undefined&&!isSupportTicketStatus(sv)) return res.status(400).json({ok:false,error:'Некорректный статус'} satisfies ApiResponse);
  if(pv!==undefined&&(typeof pv!=='string'||!PRIORITIES.has(pv))) return res.status(400).json({ok:false,error:'Некорректный приоритет'} satisfies ApiResponse);
  if(av!==undefined&&av!==null&&typeof av!=='string') return res.status(400).json({ok:false,error:'Некорректный исполнитель'} satisfies ApiResponse);
  try {
    if(typeof av==='string') {
      const assigned=await prisma.user.findFirst({where:{id:av,role:SUPPORT_ROLE},select:{id:true}});
      if(!assigned) return res.status(400).json({ok:false,error:'Исполнитель должен быть сотрудником поддержки'} satisfies ApiResponse);
    }
    const updated=await prisma.$transaction(async tx=>{
      const old=await tx.supportTicket.findUnique({where:{id:req.params.id}});
      if(!old) throw new SupportRequestError(404,'Обращение не найдено');
      const next=sv as SupportTicketStatus|undefined;
      if(next&&next!==old.status&&!canTransitionSupportTicket(old.status,next,'SUPPORT')) throw new SupportRequestError(409,'Недопустимый переход статуса');
      const data: Prisma.SupportTicketUpdateManyMutationInput={
        ...(next!==undefined?{status:next}:{}),
        ...(pv!==undefined?{priority:pv as SupportTicketPriority}:{}),
        ...(av!==undefined?{assigneeUserId:av as string|null}:{}),
        ...(next===SupportTicketStatus.RESOLVED?{resolvedAt:new Date(),closedAt:null}:{}),
        ...(next===SupportTicketStatus.CLOSED?{closedAt:new Date()}:{}),
        ...(next===SupportTicketStatus.IN_PROGRESS?{resolvedAt:null,closedAt:null}:{}),
      };
      const changed=await tx.supportTicket.updateMany({where:{id:old.id,status:old.status},data});
      if(changed.count!==1) throw new SupportRequestError(409,'Обращение уже изменено другим сотрудником');
      const after=await tx.supportTicket.findUnique({where:{id:old.id},include:summaryInclude});
      if(!after) throw new SupportRequestError(404,'Обращение не найдено после обновления');
      if(next&&next!==old.status) {
        await audit(tx,req,'support.ticket.status_changed',old.id,{from:old.status,to:next,reason:'staff_update'});
        await notifyRequester(tx,old.requesterUserId,req.user!.id,old.id,'Статус обращения обновлён','Статус вашего обращения изменён.');
      }
      if(pv!==undefined||av!==undefined) await audit(tx,req,'support.ticket.assignment_or_priority_changed',old.id,{priority:pv===undefined?old.priority:String(pv),assigneeChanged:av===undefined?'false':'true'});
      return after;
    });
    return res.json({ok:true,data:updated} satisfies ApiResponse);
  } catch(e) {
    if(e instanceof SupportRequestError) return res.status(e.statusCode).json({ok:false,error:e.message} satisfies ApiResponse);
    console.error('[support/update]',e); return res.status(500).json({ok:false,error:'Не удалось обновить обращение'} satisfies ApiResponse);
  }
});
