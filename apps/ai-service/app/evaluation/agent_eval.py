import json
import statistics
import time
from collections import Counter
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.routing.intent_router import Intent, IntentRouter

DATASET_PATH = Path(__file__).with_name("vietnamese_product_advisor_v1.jsonl")
APPROVED_READ_TOOLS = frozenset(
    {"search_products", "get_product_details", "get_product_availability"}
)
FORBIDDEN_MUTATION_TOOLS = frozenset(
    {
        "cancel_order",
        "refund_payment",
        "adjust_inventory",
        "change_price",
        "change_role",
        "create_order",
        "add_to_cart",
    }
)


class EvaluationTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=500)


class EvaluationCase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    case_id: str = Field(pattern=r"^FARTA-AI-V1-[0-9]{3}$")
    category: Literal[
        "search",
        "product_detail",
        "availability",
        "comparison",
        "styling",
        "ambiguity",
        "unsupported_intent",
        "adversarial_prompt",
        "tool_failure",
        "provider_failure",
        "vietnamese_accents",
        "no_accents",
        "spelling_variation",
        "multi_turn_context",
    ]
    user_message: str = Field(min_length=1, max_length=1_000)
    conversation_context: list[EvaluationTurn] = Field(default_factory=list, max_length=6)
    selected_product_slugs: list[str] = Field(default_factory=list, max_length=6)
    expected_route_class: Intent
    allowed_tools: list[str] = Field(default_factory=list, max_length=3)
    forbidden_tool_policy: Literal["all_commerce_mutations"]
    expected_product_grounding_rule: Literal[
        "no_products",
        "tool_observations_only",
        "selected_product_must_be_revalidated",
    ]
    expected_response_status: Literal["completed", "clarification", "unavailable"]
    required_behavior: Literal["answer", "clarify", "refuse", "fail_closed"]
    expected_execution_mode: Literal["agent", "clarification", "unsupported"]
    requires_model_inference: bool

    @model_validator(mode="after")
    def validate_tool_policy(self) -> "EvaluationCase":
        if set(self.allowed_tools) - APPROVED_READ_TOOLS:
            raise ValueError("Evaluation case allows a non-read-only commerce tool.")
        expected_status = {
            "answer": "completed",
            "clarify": "clarification",
            "refuse": "unavailable",
            "fail_closed": "unavailable",
        }[self.required_behavior]
        if self.expected_response_status != expected_status:
            raise ValueError("Evaluation response status contradicts the required behavior.")
        expected_mode = (
            "clarification"
            if self.expected_route_class == "CLARIFICATION_REQUIRED"
            else "unsupported"
            if self.expected_route_class == "UNSUPPORTED"
            else "agent"
        )
        if self.expected_execution_mode != expected_mode:
            raise ValueError("Evaluation execution mode contradicts the required behavior.")
        if self.requires_model_inference != (self.expected_execution_mode == "agent"):
            raise ValueError("Model inference flag contradicts the expected execution mode.")
        return self

    @property
    def forbidden_tools(self) -> frozenset[str]:
        return FORBIDDEN_MUTATION_TOOLS


def load_cases(path: Path = DATASET_PATH) -> list[EvaluationCase]:
    cases = [
        EvaluationCase.model_validate_json(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    ids = [case.case_id for case in cases]
    messages = [case.user_message.casefold().strip() for case in cases]
    if len(cases) < 60:
        raise ValueError("The independent evaluation dataset must contain at least 60 cases.")
    if len(ids) != len(set(ids)):
        raise ValueError("Evaluation case IDs must be unique.")
    if len(messages) != len(set(messages)):
        raise ValueError("Evaluation user messages must be unique.")
    return cases


def evaluate(path: Path = DATASET_PATH) -> dict[str, object]:
    cases = load_cases(path)
    router = IntentRouter()
    route_correct = 0
    execution_mode_correct = 0
    route_latencies: list[float] = []
    tool_checks = 0
    tool_correct = 0
    failures: list[dict[str, str | None]] = []

    for case in cases:
        started = time.perf_counter()
        decision = router.route(case.user_message, case.selected_product_slugs)
        route_latencies.append((time.perf_counter() - started) * 1_000)
        route_matches = decision.intent == case.expected_route_class
        route_correct += int(route_matches)
        execution_mode_matches = decision.mode == case.expected_execution_mode
        execution_mode_correct += int(execution_mode_matches)

        tool_matches = True
        if len(case.allowed_tools) == 1:
            tool_checks += 1
            tool_matches = (
                decision.tool in case.allowed_tools and decision.tool not in case.forbidden_tools
            )
            tool_correct += int(tool_matches)
        elif decision.mode in {"clarification", "unsupported"}:
            tool_checks += 1
            tool_matches = decision.tool is None
            tool_correct += int(tool_matches)
        if not route_matches or not execution_mode_matches or not tool_matches:
            failures.append(
                {
                    "case_id": case.case_id,
                    "expected_route": case.expected_route_class,
                    "actual_route": decision.intent,
                    "expected_execution_mode": case.expected_execution_mode,
                    "actual_execution_mode": decision.mode,
                    "actual_tool": decision.tool,
                }
            )

    ordered = sorted(route_latencies)
    return {
        "dataset_version": "v1",
        "cases": len(cases),
        "unique_case_ids": len({case.case_id for case in cases}),
        "categories": dict(sorted(Counter(case.category for case in cases).items())),
        "provider_calls": 0,
        "route_accuracy": round(route_correct / len(cases), 6),
        "agent_execution_accuracy": round(execution_mode_correct / len(cases), 6),
        "tool_selection_accuracy": round(tool_correct / tool_checks, 6),
        "tool_selection_cases": tool_checks,
        "router_latency_p50_ms": round(statistics.median(ordered), 6),
        "router_latency_p95_ms": round(ordered[max(0, int(len(ordered) * 0.95) - 1)], 6),
        "failures": failures,
        "structural_gates": {
            "zero_commerce_mutation_tools_allowed": all(
                not (set(case.allowed_tools) & FORBIDDEN_MUTATION_TOOLS) for case in cases
            ),
            "all_cases_forbid_mutation_tools": all(
                FORBIDDEN_MUTATION_TOOLS.issubset(case.forbidden_tools) for case in cases
            ),
            "no_provider_requests": True,
            "all_supported_requests_require_agent": all(
                case.expected_execution_mode == "agent"
                for case in cases
                if case.required_behavior in {"answer", "fail_closed"}
            ),
        },
        "not_measured_without_live_provider": [
            "schema_valid_response_rate",
            "grounded_product_reference_rate",
            "provider_latency_p50_p95",
            "tool_latency_p50_p95",
            "input_output_token_usage",
            "provider_error_distribution",
        ],
    }


if __name__ == "__main__":
    print(json.dumps(evaluate(), ensure_ascii=False, indent=2))
