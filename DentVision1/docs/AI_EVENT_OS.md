# DentVision AI Event OS — Architecture & Reference

## Overview

DentVision AI Event OS is a proactive AI operating system for dental clinics.
Unlike traditional reactive AI (user asks → AI answers), Event OS automatically
reacts to CRM events and triggers appropriate AI agent actions.

## Architecture

```
CRM Events → Event Bus → Event Orchestrator → Rules Engine → AI Agents → Actions
                                ↓
                          Event Store (audit)
                                ↓
                          SSE Notifications → Frontend
```

## Components

### 1. Event Bus (`src/modules/events/`)
- **EventBus.ts** — Redis Streams with in-memory fallback
- **EventStore.ts** — Prisma persistence for audit trail
- **EventTypes.ts** — 20+ CRM event types

### 2. Event Orchestrator (`src/modules/ai/os/eventOrchestrator.ts`)
- Subscribes to all events via EventBus
- Matches events against rules
- Executes actions with concurrency control
- Emits 'processed' events for timeline

### 3. Rules Engine (`src/modules/ai/os/eventRules.ts`)
- 18 rules mapping CRM events → agent actions
- Priority-based execution (critical > high > medium > low)
- Parallel and sequential action support
- Conditional filtering

### 4. Event Actions (`src/modules/ai/os/eventActions.ts`)
- 18 concrete action handlers
- Direct Prisma DB queries for real-time data
- Error handling and timeout management

### 5. AI Agents (`src/modules/ai/agents/`)

| Agent | Domain | Events |
|-------|--------|--------|
| Clinical | clinical | PatientCreated, ComplaintUpdated |
| Radiology | radiology | XrayUploaded |
| Doctor | doctor | DiagnosisSaved, TreatmentCompleted |
| Documentation | documentation | TreatmentCompleted |
| Shop | shop | InventoryLow, DiagnosisSaved |
| Finance | finance | PaymentReceived, PaymentOverdue, InvoiceCreated |
| Admin | admin | PatientNoShow, AppointmentCancelled |
| FollowUp | followup | TreatmentCompleted, FollowUpDue |
| Patient | patient | AppointmentBooked, FollowUpDue |
| CEO | ceo | DailySummary |
| Reception | reception | AppointmentBooked, AppointmentCancelled |

### 6. LLM Client (`src/modules/ai/llm/client.ts`)
- General-purpose OpenAI client
- Reuses existing modelRouter (cheap-first, budget management)
- Tool calling support

### 7. AI Memory (`src/modules/ai/memory/`)
- 3 scopes: short (15min), session (4h), long (persistent)
- Redis-backed with PostgreSQL persistence
- Used by agents for context retention

### 8. Knowledge Base (`src/modules/ai/knowledge/`)
- RAG system for dental knowledge
- 7 seed articles (пульпит, периодонтит, имплантация, etc.)
- Cosine similarity search + LLM answer generation

### 9. SSE Notifications (`src/modules/ai/ai.notifications.routes.ts`)
- Real-time event streaming to frontend
- Per-clinic broadcast
- Auto-reconnect on disconnect

### 10. AI Timeline (`src/modules/ai/ai.timeline.routes.ts`)
- GET /api/ai/timeline — event history
- GET /api/ai/timeline/stats — aggregated stats
- Frontend: AITimeline.tsx component

### 11. Digital Twin (`src/modules/ai/core/digitalTwinEventOS.ts`)
- Enriches digital twin with Event OS data
- Recent actions, agent status, pending alerts

## Event Flow Example

1. Patient arrives → CRM fires `PatientArrived` event
2. Event Bus publishes to Redis Stream
3. Event Orchestrator receives event
4. Rules Engine matches: `rule-patient-arrived`
5. Action: `notifyDoctorPatientArrived` executes
6. Result: Doctor receives notification via SSE
7. Timeline entry created for audit

## Database Tables

- `AIEvent` — event processing audit trail
- `ai_memory` — persistent agent memories
- `knowledge_articles` — RAG knowledge base

## Environment Variables

```
OPENAI_API_KEY=sk-...           # OpenAI API key
REDIS_URL=redis://...           # Redis (optional, falls back to in-memory)
OPENAI_MODEL=gpt-5.4            # Full model
OPENAI_MODEL_MINI=gpt-5.4-mini  # Mini model
OPENAI_MODEL_MODE=auto          # auto/mini/full
```

## Adding New Agents

1. Create directory: `src/modules/ai/agents/<name>/`
2. Create files: `agent.ts`, `tools.ts`, `prompt.md`, `index.ts`
3. Extend `AbstractAgent` from `interfaces.ts`
4. Implement `canHandle()`, `handle()`, `getEventActions()`, `handleEvent()`
5. Add event rules in `eventRules.ts`
6. Register in `agents/index.ts`

## Adding New Events

1. Add event type to `EventTypes.ts`
2. Add payload type to `EventTypes.ts`
3. Add rules in `eventRules.ts`
4. Add action handlers in `eventActions.ts`
