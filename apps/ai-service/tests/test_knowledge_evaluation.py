from app.evaluation.knowledge_eval import evaluate_knowledge_routing, load_knowledge_cases


def test_knowledge_dataset_is_versioned_unique_and_multilingual() -> None:
    cases = load_knowledge_cases()
    assert len(cases) == 15
    assert len({case.case_id for case in cases}) == len(cases)
    assert {case.category for case in cases} == {
        "knowledge_routing",
        "english_knowledge",
        "adversarial_refusal",
        "private_scope_refusal",
    }


def test_knowledge_routing_passes_local_security_gates_without_provider_calls() -> None:
    report = evaluate_knowledge_routing()
    assert report["provider_calls"] == 0
    assert report["route_accuracy"] == 1.0
    assert report["tool_selection_accuracy"] == 1.0
    assert report["source_filter_accuracy"] == 1.0
    assert report["query_shaping_accuracy"] == 1.0
    assert report["failures"] == []
    assert report["passed"] is True
    assert all(report["structural_gates"].values())
