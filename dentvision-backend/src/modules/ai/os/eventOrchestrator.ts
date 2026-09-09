import { EventEmitter } from 'node:events';
import { eventBus } from '../../events/index.js';
import { CRMEvent } from '../../events/EventTypes.js';
import { matchEventRules, EventRule, EventRuleAction } from './eventRules.js';
import { getActionHandler, EventActionResult } from './eventActions.js';
import { sseManager } from '../ai.notifications.routes.js';
import prisma from '../../../lib/prisma.js';
import { uid } from '../../../lib/helpers.js';

export interface ProcessedEvent { event: CRMEvent; rules: EventRule[]; results: EventActionResult[]; durationMs: number }
export interface EventOrchestratorConfig { enabled: boolean; concurrency: number; logLevel: 'silent'|'info'|'debug' }
const DEFAULT_CONFIG: EventOrchestratorConfig = { enabled:true, concurrency:5, logLevel:'info' };
const AGENT_ROLES: Record<string,string[]> = {
  doctor:['DOCTOR','ASSISTANT'], reception:['ADMIN','ASSISTANT'], finance:['CASHIER','OWNER','MANAGER'],
  ceo:['OWNER','SUPERADMIN'], supply:['MANAGER','OWNER','ADMIN'], lab:['LAB','MANAGER'],
};

export class EventOrchestrator extends EventEmitter {
  private unsubscribe:(()=>void)|null=null; private config:EventOrchestratorConfig; private activeCount=0; private queue:Array<{event:CRMEvent;resolve:()=>void}>=[];
  constructor(config?:Partial<EventOrchestratorConfig>){super();this.config={...DEFAULT_CONFIG,...config}}
  start(){if(this.unsubscribe)return;this.unsubscribe=eventBus.subscribe('*',this.handleEvent.bind(this));if(this.config.logLevel!=='silent')console.log('[EventOrchestrator] Subscribed to EventBus')}
  stop(){if(this.unsubscribe){this.unsubscribe();this.unsubscribe=null}this.queue=[];if(this.config.logLevel!=='silent')console.log('[EventOrchestrator] Stopped')}
  async processEvent(event:CRMEvent){return this.processEventInternal(event)}
  private async handleEvent(event:CRMEvent){if(!this.config.enabled)return;if(this.activeCount>=this.config.concurrency)return new Promise<void>(resolve=>this.queue.push({event,resolve}));this.activeCount++;try{await this.processEventInternal(event)}finally{this.activeCount--;this.processQueue()}}
  private processQueue(){while(this.queue.length&&this.activeCount<this.config.concurrency){const item=this.queue.shift()!;this.activeCount++;this.processEventInternal(item.event).finally(()=>{this.activeCount--;item.resolve();this.processQueue()})}}
  private async processEventInternal(event:CRMEvent):Promise<ProcessedEvent>{const start=Date.now(),rules=matchEventRules(event.type,event.payload as Record<string,unknown>),results:EventActionResult[]=[];for(const rule of rules){const parallel=rule.actions.filter(a=>a.parallel),sequential=rule.actions.filter(a=>!a.parallel);if(parallel.length){const settled=await Promise.allSettled(parallel.map(a=>this.executeAction(event,a)));for(const r of settled)if(r.status==='fulfilled')results.push(r.value)}for(const action of sequential)results.push(await this.executeAction(event,action))}const processed={event,rules,results,durationMs:Date.now()-start} satisfies ProcessedEvent;await this.publishRealtimeResults(processed);this.emit('processed',processed);if(this.config.logLevel!=='silent')console.log(`[EventOrchestrator] ${event.type} processed: ${results.length} actions, ${processed.durationMs}ms`);return processed}
  private async resolveRecipients(event:CRMEvent,action:EventRuleAction,result:EventActionResult):Promise<string[]>{if(result.notifyUserIds?.length)return [...new Set(result.notifyUserIds)];const roles=AGENT_ROLES[action.agent]||[];if(!roles.length||!event.clinicId)return[];const members=await prisma.clinicMember.findMany({where:{clinicId:event.clinicId,role:{in:roles as any}},select:{userId:true},take:50});return[...new Set(members.map(m=>m.userId))]}
  private async publishRealtimeResults(processed:ProcessedEvent){for(let i=0;i<processed.results.length;i++){const result=processed.results[i];if(!result.success||!result.message)continue;const rule=processed.rules.find(r=>r.actions.some(a=>a.action===result.action));const action=rule?.actions.find(a=>a.action===result.action);if(!action)continue;try{const targets=await this.resolveRecipients(processed.event,action,result);if(!targets.length)continue;const title=result.critical?'DentVision AI — требует внимания':`DentVision AI — ${result.agent}`;const notificationData={eventId:processed.event.id,eventType:processed.event.type,agent:result.agent,action:result.action,message:result.message,critical:Boolean(result.critical),data:result.data||{},timelineEntry:result.timelineEntry||null};await Promise.all(targets.map(userId=>prisma.notification.create({data:{id:uid(),userId,type:result.critical?'error':'workflow',title,message:result.message,link:typeof result.data?.patientId==='string'?`/crm/patients/${result.data.patientId}`:null}}).catch(error=>{console.warn('[EventOrchestrator] notification persistence failed',error);return null})));sseManager.broadcast(processed.event.clinicId,{id:`ai-event-${processed.event.id}-${i}`,type:result.critical?'alert':'ai_event',data:notificationData,timestamp:new Date().toISOString(),clinicId:processed.event.clinicId,targetUserIds:targets})}catch(error){console.warn('[EventOrchestrator] proactive delivery failed',error)}}}
  private async executeAction(event:CRMEvent,action:EventRuleAction):Promise<EventActionResult>{const handler=getActionHandler(action.action);if(!handler)return{success:false,action:action.action,agent:action.agent,message:`Unknown action: ${action.action}`};try{const timeout=action.timeout||15000;return await Promise.race([handler(event),new Promise<EventActionResult>((_,reject)=>setTimeout(()=>reject(new Error(`Action ${action.action} timed out after ${timeout}ms`)),timeout))])}catch(err){console.error(`[EventOrchestrator] Action ${action.action} failed:`,err);return{success:false,action:action.action,agent:action.agent,message:err instanceof Error?err.message:String(err)}}}
}
let instance:EventOrchestrator|null=null;
export function getEventOrchestrator(config?:Partial<EventOrchestratorConfig>):EventOrchestrator{if(!instance)instance=new EventOrchestrator(config);return instance}
export function resetEventOrchestrator(){if(instance)instance.stop();instance=null}
