import { DoctorAgent } from './doctor.agent.js';
import { OwnerAgent } from './owner.agent.js';
import { AdminAgent } from './admin.agent.js';
import { AIContext } from '../types/ai.types.js';

export class AgentRouter {
  private doctor = new DoctorAgent();
  private owner = new OwnerAgent();
  private admin = new AdminAgent();

  async route(intent: string, text: string, context: AIContext) {
    const role = context.role.toLowerCase();

    if (role === 'owner' || role === 'director') {
      return this.owner.handle(context, intent, { text });
    }
    if (role === 'admin' || role === 'superadmin') {
      return this.admin.handle(context, intent, { text });
    }

    return this.doctor.handle(context, intent, { text });
  }
}