# ADR-010: AI security boundary

Status: Accepted, amended 2026-10-19

The FastAPI service has no direct commerce database or privileged provider access. It requests allowlisted, typed NestJS tools using service identity and delegated user context. NestJS revalidates authorization, idempotency and domain rules and audits every sensitive tool result.

## V4.1 amendment

Pydantic AI `2.57.0` is the sole Agent orchestration framework for the read-only
Product Advisor. Execution follows:

`Deterministic Intent Router → bounded Pydantic AI Agent → typed tools → signed NestJS Tool Gateway`.

The Agent is limited to three model requests, three tool calls, 768 output tokens,
a 25-second request budget and at most one explicitly enabled provider fallback.
Provider SDK retries are disabled for the configured Google/Groq adapters. Live
providers remain disabled until the actual account is verified as free-tier.

The first release exposes only `search_products`, `get_product_details` and
`get_product_availability`. NestJS hydrates final Product Cards again from its
authoritative services. Pydantic AI does not authorize requests and never receives
customer cookies, access tokens, addresses, payment data or direct database access.

LangGraph, LlamaIndex, LangChain and OpenAI Agents SDK are not installed. Hybrid RAG
remains a separately approved phase after corpus and resource review.
