# DentVision AI Model Routing and Capability Contract

**Status:** candidate implementation in PR #351; exact-head verification required  
**Normative architecture:** Master Spec v5.0 §15  
**Implementation:** `dentvision-backend/src/modules/ai/lib/modelCatalog.ts`, `modelRouter.ts`, `llm/client.ts`

## 1. Objective

Route each request to the least expensive model that can satisfy its actual capability and reasoning requirements. Do not route by global “best model” alone, and never infer a model capability from an ID prefix.

The model catalog contains candidate IDs, but a candidate is usable only when the current API account exposes it through `GET /v1/models`. This separates the platform's published model family from the account's actual entitlement.

## 2. Routing tiers

| Tier | Primary model candidate | Purpose | Budget |
|---|---|---|---|
| Mini | `gpt-6-luna` | Short, high-volume, low-risk Q&A and routine operations | Shared mini daily token budget |
| Full / standard | `gpt-6.2-sol`, then `gpt-6.1-sol` | Normal complex agent workflows and multi-tool work | Shared full daily token budget |
| Deep | `gpt-6.2-astra`, then `gpt-6-astra` | Differential diagnosis support, complex treatment planning, high-stakes reasoning and deep audits | Same full budget; no extra budget bypass |
| Vision | `gpt-6.1-terra` first, then other verified vision-capable candidates | Any request with an image, including radiographs | Counts against the selected mini/full tier |

Legacy models remain as compatibility fallbacks only when the current API account exposes them. The candidate `gpt-6.2-sol` is not assumed to exist: it is selected only if the live account catalogue returns that exact ID.

## 3. Mandatory modality routing

- `llm/client.ts` detects an image in the request before model selection and passes `requiresVision=true`.
- The model router resolves the catalogued vision model before the normal mini/full/deep decision.
- An image is never sent to a text-only model as a fallback.
- If no vision-capable model is selected, the router throws `VisionModelUnavailableError`; the radiograph tool returns a clear, non-diagnostic message that AI analysis is unavailable. It explicitly warns that absence of an AI result does not mean a normal radiograph.
- The model response remains advisory. Clinical findings are not silently written to the odontogram; existing validation and clinician confirmation remain mandatory.

## 4. Capability metadata

Every model candidate declares `vision` and `reasoning` booleans. Model selection uses these fields from the discovered catalog. The separate exact-ID `supportsReasoning()` helper exists only as a conservative fallback for isolated unit tests and unknown caller paths; production selection passes the resolved metadata.

The Responses API `reasoning` field is omitted whenever the selected model is not marked reasoning-capable. New model families must add an explicit capability entry and corresponding tests; a name such as `gpt-6-...` is not sufficient evidence.

## 5. Reasoning effort

- `OPENAI_REASONING_EFFORT` controls ordinary full-tier reasoning and defaults to `low`.
- `OPENAI_DEEP_REASONING_EFFORT` controls deep and vision reasoning, accepts `medium` or `high`, and defaults to `high`.
- Deep requests are recognized through high-stakes clinical/strategic intents, long or multi-question requests, sustained history, escalation after an empty/weak mini pass, and sufficiently deep tool loops.
- Deep model usage is recorded against the existing full budget. There is no hidden separate Astra budget and no bypass of token accounting.

## 6. Product and privacy boundaries

- Model selection never grants tool permissions. The DB-backed IAM resolver determines the current tool set; the governance kernel still enforces identity, scope, permission, confirmation, execution verification and audit.
- Product documentation is reference knowledge only. It does not authorize actions.
- Conversational query text is not sent to a second embedding provider for product-guide retrieval because it may contain PHI. The approved guide is retrieved locally with bounded heading-aware lexical ranking.
- Images are sent only through the existing consent-checked radiograph tool and current clinic context.
- Provider request/response errors must not log API keys, patient data, provider bodies or raw clinical exception text.
- A missing provider key/model or unavailable visual model must never produce a confident-looking clinical result.

## 7. Responses API and agent framework choice

DentVision continues to use the Responses API and its explicit tool loop. This is intentional: the current governance kernel is the authority for tenant context, role checks, confirmation, audit and post-action verification. A framework migration must not bypass that kernel or duplicate the approval state machine.

The OpenAI Agents SDK is a potential future integration for tracing, handoffs and evaluation orchestration, but is not a prerequisite for using current models and is not introduced by this change. Any future adoption must wrap existing governed tools rather than creating direct side-effecting tools outside the kernel.

## 8. Verification matrix

The candidate tests must prove:

1. Live account discovery chooses only exposed model IDs.
2. Chat pins do not suppress discovery of separate vision, embedding and transcription capabilities.
3. Standard complex prompts select Sol; deep clinical/strategic prompts select Astra when the account exposes it.
4. If Astra is unavailable, deep falls back to the verified standard full model, not an unlisted model ID.
5. A model marked non-reasoning receives no `reasoning` parameter.
6. A message with an image forces a vision candidate even when the normal mini choice is text-only.
7. No available vision model causes a fail-closed error; it never silently uses a text model.
8. Deep and vision-capable reasoning models receive the configured elevated reasoning effort.
9. Deep usage remains on the shared full token budget.
10. Existing approval, tenant isolation, action verification and PHI minimization tests remain green.

## 9. External model references

- [OpenAI API overview and Responses API quickstart](https://platform.openai.com/overview)
- [OpenAI API model pricing and catalogue](https://platform.openai.com/pricing)

These pages describe the available model families and capabilities. The runtime account catalogue remains the final authority for the model IDs DentVision can actually call.
