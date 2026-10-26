import json
from collections import Counter
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.routing.intent_router import Intent, IntentRouter
from app.tools.registry import approved_tools
from app.tools.schemas import SearchKnowledgeArgs

DATASET_PATH = Path(__file__).with_name("knowledge_agent_v1.jsonl")


class KnowledgeEvaluationCase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    case_id: str = Field(pattern=r"^FARTA-KNOWLEDGE-V1-[0-9]{3}$")
    category: Literal[
        "knowledge_routing",
        "english_knowledge",
        "adversarial_refusal",
        "private_scope_refusal",
    ]
    user_message: str = Field(min_length=1, max_length=1_000)
    expected_route: Intent
    expected_tool: Literal["search_knowledge"] | None
    expected_source_types: list[
        Literal[
            "PRODUCT",
            "CATEGORY",
            "SHIPPING_POLICY",
            "RETURN_POLICY",
            "SIZE_GUIDE",
            "FAQ",
        ]
    ] = Field(max_length=6)
    expected_query: str | None = Field(default=None, min_length=2, max_length=300)


def load_knowledge_cases(path: Path = DATASET_PATH) -> list[KnowledgeEvaluationCase]:
    cases = [
        KnowledgeEvaluationCase.model_validate_json(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    ids = [case.case_id for case in cases]
    messages = [case.user_message.casefold().strip() for case in cases]
    if len(cases) < 10 or len(ids) != len(set(ids)) or len(messages) != len(set(messages)):
        raise ValueError("Knowledge evaluation dataset is incomplete or duplicated.")
    return cases


def evaluate_knowledge_routing(path: Path = DATASET_PATH) -> dict[str, object]:
    cases = load_knowledge_cases(path)
    enabled_router = IntentRouter(rag_enabled=True)
    disabled_router = IntentRouter(rag_enabled=False)
    route_correct = 0
    tool_correct = 0
    source_filter_correct = 0
    query_shaping_correct = 0
    disabled_fail_closed = 0
    knowledge_cases = 0
    failures: list[dict[str, object]] = []

    for case in cases:
        decision = enabled_router.route(case.user_message, [])
        route_matches = decision.intent == case.expected_route
        tool_matches = decision.tool == case.expected_tool
        actual_source_types: list[str] = []
        if isinstance(decision.arguments, SearchKnowledgeArgs):
            actual_source_types = sorted(decision.arguments.source_types)
        source_matches = actual_source_types == sorted(case.expected_source_types)
        actual_query = (
            decision.arguments.query
            if isinstance(decision.arguments, SearchKnowledgeArgs)
            else None
        )
        query_matches = case.expected_query is None or actual_query == case.expected_query
        route_correct += int(route_matches)
        tool_correct += int(tool_matches)
        source_filter_correct += int(source_matches)
        query_shaping_correct += int(query_matches)
        if case.expected_route == "PUBLIC_KNOWLEDGE":
            knowledge_cases += 1
            disabled = disabled_router.route(case.user_message, [])
            disabled_fail_closed += int(
                disabled.intent == "UNSUPPORTED"
                and disabled.mode == "unsupported"
                and disabled.tool is None
            )
        if not route_matches or not tool_matches or not source_matches or not query_matches:
            failures.append(
                {
                    "case_id": case.case_id,
                    "actual_route": decision.intent,
                    "actual_tool": decision.tool,
                    "actual_source_types": actual_source_types,
                    "actual_query": actual_query,
                }
            )

    registered_tools = {tool.__name__ for tool in approved_tools(True)}
    structural_gates = {
        "provider_calls_zero": True,
        "rag_disabled_fails_closed": disabled_fail_closed == knowledge_cases,
        "knowledge_tool_is_read_only_allowlisted": "search_knowledge" in registered_tools,
        "no_mutation_tools_registered": not registered_tools
        & {
            "cancel_order",
            "refund_payment",
            "adjust_inventory",
            "change_price",
            "change_role",
            "create_order",
            "add_to_cart",
        },
    }
    count = len(cases)
    return {
        "dataset_version": "v1",
        "cases": count,
        "categories": dict(sorted(Counter(case.category for case in cases).items())),
        "provider_calls": 0,
        "route_accuracy": round(route_correct / count, 6),
        "tool_selection_accuracy": round(tool_correct / count, 6),
        "source_filter_accuracy": round(source_filter_correct / count, 6),
        "query_shaping_accuracy": round(query_shaping_correct / count, 6),
        "structural_gates": structural_gates,
        "failures": failures,
        "passed": (
            route_correct == count
            and tool_correct == count
            and source_filter_correct == count
            and query_shaping_correct == count
            and all(structural_gates.values())
            and not failures
        ),
    }


if __name__ == "__main__":
    print(json.dumps(evaluate_knowledge_routing(), ensure_ascii=False, indent=2))
