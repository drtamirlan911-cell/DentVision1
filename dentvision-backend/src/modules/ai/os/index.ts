export { orchestratorEnabled, type OrchestratorInput, type OrchestratorResult } from './orchestrator.js';
export { listAgents, agentsForRole, agentsForPersona, toolsForRole, type AgentDefinition, type AgentStatus, type AgentDomain } from './registry.js';
export { PERSONA_LABELS, defaultPersonaForRole, resolveActivePersona, type PersonaId } from './persona.js';
export { TOOLS, toolSchemasFor, type ToolContext, type ToolResult } from './tools.js';
export {
  EventOrchestrator,
  getEventOrchestrator,
  resetEventOrchestrator,
} from './eventOrchestrator.js';
export {
  EVENT_RULES,
  matchEventRules,
  getRuleById,
} from './eventRules.js';
export {
  getActionHandler,
  listActions,
} from './eventActions.js';

// Load the durable AI Employee work-memory subscriber wherever the AI OS is
// loaded (the backend startup imports this module before starting Event OS).
import { registerAiEmployeeTaskSubscriber } from './aiEmployeeTaskSubscriber.js';
registerAiEmployeeTaskSubscriber();

export {
  createAiEmployeeTask,
  listAiEmployeeTasks,
  transitionAiEmployeeTask,
  type AiEmployeeTask,
  type AiTaskStatus,
  type AiTaskRisk,
} from './aiEmployeeTasks.js';
