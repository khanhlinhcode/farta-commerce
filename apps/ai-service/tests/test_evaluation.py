from app.evaluation.agent_eval import FORBIDDEN_MUTATION_TOOLS, evaluate, load_cases


def test_versioned_vietnamese_dataset_is_unique_and_policy_complete() -> None:
    cases = load_cases()
    assert len(cases) == 62
    assert len({case.case_id for case in cases}) == len(cases)
    assert len({case.user_message.casefold() for case in cases}) == len(cases)
    assert all(case.forbidden_tools == FORBIDDEN_MUTATION_TOOLS for case in cases)
    assert len({case.category for case in cases}) == 14
    assert all(
        (case.required_behavior == "answer" and case.expected_response_status == "completed")
        or (
            case.required_behavior == "clarify" and case.expected_response_status == "clarification"
        )
        or (
            case.required_behavior in {"refuse", "fail_closed"}
            and case.expected_response_status == "unavailable"
        )
        for case in cases
    )


def test_provider_independent_evaluation_passes_predeclared_structural_gates() -> None:
    result = evaluate()
    assert result["provider_calls"] == 0
    assert result["route_accuracy"] == 1.0
    assert result["tool_selection_accuracy"] == 1.0
    assert result["failures"] == []
    assert all(result["structural_gates"].values())
