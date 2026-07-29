# DentVision V2 — AI System Report

**Date:** 2026-07-17

---

## OVERVIEW

Two AI implementations exist:
1. **Legacy (`server/ai/`)** — 13 JS files, fully functional, rule-based, deployed
2. **New (`dentvision-backend/src/modules/ai/`)** — 18 TS files, multi-agent architecture, not deployed

---

## LEGACY AI SYSTEM (`server/ai/`)

### Architecture
```
User Message → Intent Engine → Skill Router → Command Bus → Actions
                                ↓
                     Knowledge Orchestrator (4 sources)
                                ↓
                     Personality (system prompt)
                                ↓
                     Response + Actions + Suggestions + Proactive Alerts
```

### Components

| File | Lines | Purpose |
|---|---|---|
| `core/intentEngine.js` | 412 | Central brain. Regex-based intent classification (ACTION, SEARCH, RECOMMENDATION, NAVIGATION, QUERY, CONVERSATION). Orchestrates full pipeline. |
| `core/commandBus.js` | 184 | Command dispatcher. Permission checks, middleware chain, action execution. |
| `core/permissions.js` | 44 | RBAC for AI actions. Superadmin bypass. |
| `skills.js` | 116 | 8 skill domains: clinical, practice, analytics, shopping, learning, research, automation, patient. Regex pattern matching. |
| `actions.js` | 627 | 30 registered actions. Navigation (14), CRM Data (6), Shop (2), School (2), Create/Modify (4), Reporting (1). |
| `chat.js` | 175 | REST API: /chat, /greeting, /proactive, /action, /digital-twin, /context |
| `personality.js` | 150 | System prompt builder. Role-based behavior. Time-aware greetings. |
| `context.js` | 202 | Real-time clinic context: 9 parallel DB queries for metrics. |
| `proactive.js` | 181 | Role-filtered alert generation. 12 roles, 7 alert types. |
| `knowledge.js` | 145 | Static dental knowledge: 8 specialties, 6 equipment categories, 4 material categories, 4 Q&A pairs. |
| `knowledge/orchestrator.js` | 338 | Multi-source retrieval: DB → Knowledge Base → School → Shop. Priority merging. |
| `memory/conversation.js` | 136 | In-memory conversation store. 30min TTL. Entity extraction. Max 50 messages. |
| `memory/digitalTwin.js` | 217 | Professional profile builder. 5 parallel queries. Specialty analysis, equipment inference, learning path. |

### What Works
- Full intent classification pipeline
- 30 executable actions with role-based permissions
- Multi-source knowledge retrieval
- Personalized digital twin
- Proactive alert system with role filtering
- Conversation context with entity extraction

### What's Missing
- **No LLM integration** — purely rule-based (regex). Cannot handle complex queries.
- **No tool/function calling** — actions are hardcoded, not dynamically invoked
- **No planning engine** — no multi-step reasoning
- **No reasoning layer** — no chain-of-thought
- **No context graph** — no relationship mapping between entities
- **No conversation persistence** — in-memory only, lost on restart
- **No streaming** — synchronous request/response only
- **No multi-modal** — text only, no image/voice processing

---

## NEW AI SYSTEM (`dentvision-backend/src/modules/ai/`)

### Architecture
```
User Message → Intent Engine → Agent Router → Agent (doctor/owner/admin)
                                ↓
                     Functions (tool definitions)
                                ↓
                     Memory Engine (persistent)
                                ↓
                     Prompts (templated)
                                ↓
                     Response + Actions + Suggestions + Proactive Alerts
```

### Components

| File | Lines | Purpose |
|---|---|---|
| `types/ai.types.ts` | 74 | Type definitions: AIResponse, AIMessage, AIMemory, AgentType, IntentType, AIAction |
| `core/intentEngine.ts` | 350 | Enhanced intent classification with Zod validation. 8 intents. Entity extraction. |
| `core/agentRouter.ts` | 200 | Routes to specialist agents based on intent + role. 3 agents. |
| `agents/doctor.agent.ts` | 250 | Doctor-specific responses. Clinical focus. |
| `agents/owner.agent.ts` | 250 | Owner-specific responses. Analytics + management focus. |
| `agents/admin.agent.ts` | 250 | Admin-specific responses. Operations focus. |
| `memory/memoryEngine.ts` | 300 | Persistent memory with Prisma. Short/long term. Semantic search. |
| `memory/contextManager.ts` | 200 | Session context tracking. Entity resolution. |
| `functions/functions.ts` | 400 | Tool definitions with Zod schemas. 15+ functions. |
| `prompts/promptBuilder.ts` | 200 | Template-based prompt construction. Role-aware. |
| `prompts/templates/` | ~500 | Handlebars-style prompt templates per agent |
| `routes/ai.routes.ts` | 150 | Express routes with validate middleware fix |

### What's Better Than Legacy
- TypeScript with strict types
- Multi-agent architecture (doctor/owner/admin)
- Persistent memory (Prisma-backed)
- Zod validation on all inputs
- Function calling with typed parameters
- Modular agent system (extensible)

### What's Missing
- **Not deployed** — compiles clean but not running
- **No LLM integration** — still rule-based under the hood
- **No planning engine** — mentioned in types but not implemented
- **No reasoning layer** — no chain-of-thought
- **No context graph** — entity relationships not tracked
- **No streaming** — synchronous only
- **No tool execution loop** — functions defined but no execution orchestrator

---

## COMPARISON

| Feature | Legacy | New |
|---|---|---|
| Language | JavaScript | TypeScript |
| Intent classification | Regex | Enhanced regex + validation |
| Agent system | Single (role-agnostic) | Multi-agent (doctor/owner/admin) |
| Memory | In-memory Map (30min) | Prisma-backed (persistent) |
| Knowledge | Static + DB + Shop + School | Similar but modular |
| Actions | 30 hardcoded | 15+ typed functions |
| Prompts | String concatenation | Template-based |
| Deployed | YES | NO |
| LLM integration | NO | NO |
| Planning | NO | NO |
| Reasoning | NO | NO |
| Streaming | NO | NO |

---

## RECOMMENDATIONS

### Immediate (P0)
1. Deploy the new AI backend
2. Wire frontend to new AI endpoints
3. Implement conversation persistence (migrate from in-memory to DB)

### Short-term (P1)
4. Add LLM integration (OpenAI/Claude API) for natural language understanding
5. Implement tool/function calling loop (LLM decides which functions to call)
6. Add streaming support (SSE or WebSocket)

### Medium-term (P2)
7. Implement planning engine for multi-step tasks
8. Add reasoning layer (chain-of-thought prompting)
9. Build context graph for entity relationships
10. Add multi-modal support (image analysis for X-rays)

### Long-term (P3)
11. Implement RAG (Retrieval-Augmented Generation) with vector search
12. Add voice processing
13. Build AI workflow builder (visual tool)
14. Implement AI learning from user feedback
