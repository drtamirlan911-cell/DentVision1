/**
 * Enhanced Agent Interface for Event OS.
 *
 * Each agent implements this interface to participate in both:
 *  1. Reactive mode (user messages → agent responses)
 *  2. Proactive mode (CRM events → agent actions)
 *
 * Directory structure per agent:
 *   agents/<name>/
 *     ├── agent.ts       — Agent implementation
 *     ├── tools.ts       — Tool definitions
 *     ├── prompt.md      — System prompt (plain markdown)
 *     └── index.ts       — Barrel export
 */

import { AIContext, AIResponse } from '../types/ai.types.js';
import { CRMEvent } from '../../events/EventTypes.js';

// ─── Core Types ───

export type AgentDomain =
  | 'clinical'
  | 'radiology'
  | 'doctor'
  | 'documentation'
  | 'shop'
  | 'finance'
  | 'admin'
  | 'followup'
  | 'patient'
  | 'ceo'
  | 'reception'
  | 'education'
  | 'marketing';

export type AgentStatus = 'active' | 'beta' | 'disabled';

export interface AgentMetadata {
  id: string;
  name: string;
  domain: AgentDomain;
  description: string;
  version: string;
  status: AgentStatus;
  /** Roles that can use this agent. */
  allowedRoles: string[];
  /** Maximum concurrent event actions. */
  maxConcurrency: number;
}

// ─── Tool Types ───

export interface AgentToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  enum?: string[];
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, AgentToolParameter>;
  /** Whether this tool mutates data. Requires confirmation. */
  destructive: boolean;
}

// ─── Memory Types ───

export type MemoryScope = 'short' | 'session' | 'long';

export interface MemoryEntry {
  key: string;
  value: unknown;
  scope: MemoryScope;
  ttlMs?: number;
  createdAt: Date;
}

// ─── Event Action Types ───

export interface EventActionDefinition {
  /** CRM event type this action listens to. */
  eventType: string;
  /** Additional filter predicate. */
  filter?: (event: CRMEvent) => boolean;
  /** Priority: higher = processed first. */
  priority: number;
  /** Timeout in ms. */
  timeout: number;
}

export interface EventActionResult {
  success: boolean;
  action: string;
  message?: string;
  data?: Record<string, unknown>;
  critical?: boolean;
  notifyUserIds?: string[];
  timelineEntry?: {
    action: string;
    result: string;
  };
}

// ─── Agent Interface ───

export interface BaseAgent {
  /** Agent metadata. */
  readonly metadata: AgentMetadata;

  /** Initialize agent (load prompt, connect to services). */
  init(): Promise<void>;

  /** Shutdown agent (cleanup resources). */
  shutdown(): Promise<void>;

  /** Health check. */
  isHealthy(): Promise<boolean>;

  // ─── Reactive Mode (user messages) ───

  /** Whether this agent can handle the given intent. */
  canHandle(intent: string): boolean;

  /** Handle a user message. */
  handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse>;

  // ─── Proactive Mode (CRM events) ───

  /** List of event actions this agent can perform. */
  getEventActions(): EventActionDefinition[];

  /** Execute a proactive action triggered by a CRM event. */
  handleEvent(event: CRMEvent, actionName: string): Promise<EventActionResult>;

  // ─── Tools ───

  /** List tools available to this agent. */
  getTools(): AgentTool[];

  /** Execute a tool call. */
  executeTool(toolName: string, params: Record<string, unknown>, context: AIContext): Promise<unknown>;

  // ─── Memory ───

  /** Store a memory entry. */
  remember(key: string, value: unknown, scope: MemoryScope, ttlMs?: number): Promise<void>;

  /** Recall a memory entry. */
  recall(key: string, scope: MemoryScope): Promise<MemoryEntry | null>;

  /** List all memories for a scope. */
  recallAll(scope: MemoryScope): Promise<MemoryEntry[]>;
}

// ─── Base Agent Implementation ───

export abstract class AbstractAgent implements BaseAgent {
  abstract readonly metadata: AgentMetadata;
  protected memories = new Map<string, MemoryEntry>();
  protected tools = new Map<string, AgentTool>();

  async init(): Promise<void> {
    // Default: no-op
  }

  async shutdown(): Promise<void> {
    this.memories.clear();
    this.tools.clear();
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  abstract canHandle(intent: string): boolean;
  abstract handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse>;

  getEventActions(): EventActionDefinition[] {
    return [];
  }

  async handleEvent(_event: CRMEvent, _actionName: string): Promise<EventActionResult> {
    return {
      success: false,
      action: _actionName,
      message: `Agent ${this.metadata.id} does not handle proactive events`,
    };
  }

  getTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  async executeTool(toolName: string, params: Record<string, unknown>, _context: AIContext): Promise<unknown> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool "${toolName}" not found in agent ${this.metadata.id}`);
    }
    // Subclasses override this to implement actual tool execution
    throw new Error(`Tool "${toolName}" execution not implemented in agent ${this.metadata.id}`);
  }

  // ─── Memory ───

  async remember(key: string, value: unknown, scope: MemoryScope, ttlMs?: number): Promise<void> {
    const entryKey = `${scope}:${key}`;
    this.memories.set(entryKey, {
      key,
      value,
      scope,
      ttlMs,
      createdAt: new Date(),
    });
  }

  async recall(key: string, scope: MemoryScope): Promise<MemoryEntry | null> {
    const entryKey = `${scope}:${key}`;
    const entry = this.memories.get(entryKey);
    if (!entry) return null;

    if (entry.ttlMs) {
      const age = Date.now() - entry.createdAt.getTime();
      if (age > entry.ttlMs) {
        this.memories.delete(entryKey);
        return null;
      }
    }

    return entry;
  }

  async recallAll(scope: MemoryScope): Promise<MemoryEntry[]> {
    const prefix = `${scope}:`;
    const entries: MemoryEntry[] = [];
    const now = Date.now();

    for (const [key, entry] of this.memories) {
      if (key.startsWith(prefix)) {
        if (entry.ttlMs && now - entry.createdAt.getTime() > entry.ttlMs) {
          this.memories.delete(key);
          continue;
        }
        entries.push(entry);
      }
    }

    return entries;
  }
}

// ─── Agent Registry ───

const agentRegistry = new Map<string, BaseAgent>();

export function registerAgent(agent: BaseAgent): void {
  agentRegistry.set(agent.metadata.id, agent);
}

export function getAgent(id: string): BaseAgent | undefined {
  return agentRegistry.get(id);
}

export function getAllAgents(): BaseAgent[] {
  return Array.from(agentRegistry.values());
}

export function getAgentsByDomain(domain: AgentDomain): BaseAgent[] {
  return Array.from(agentRegistry.values()).filter((a) => a.metadata.domain === domain);
}

export function getAgentsForRole(role: string): BaseAgent[] {
  return Array.from(agentRegistry.values()).filter(
    (a) => a.metadata.allowedRoles.includes(role) || a.metadata.allowedRoles.includes('*')
  );
}
