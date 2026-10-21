import json
import logging

from app.observability import DEFAULT_LOGGER, AiMetrics, AiObservability


def test_observability_emits_only_allowlisted_safe_fields(caplog) -> None:
    telemetry = AiObservability(logging.getLogger("farta.ai.test"), AiMetrics())
    with caplog.at_level(logging.INFO, logger="farta.ai.test"):
        telemetry.emit(
            "ai.request.completed",
            request_id="request-12345678",
            conversation_digest="deadbeefdeadbeef",
            duration_ms=12.5,
            response_status="completed",
            raw_prompt="do not log this",
            authorization="do not log this either",
        )
    payload = json.loads(caplog.records[-1].message)
    assert payload["event"] == "ai.request.completed"
    assert payload["request_id"] == "request-12345678"
    assert "raw_prompt" not in payload
    assert "authorization" not in payload
    assert "do not log" not in caplog.text


def test_metrics_snapshot_has_bounded_latency_percentiles() -> None:
    metrics = AiMetrics(sample_limit=2)
    telemetry = AiObservability(logging.getLogger("farta.ai.metrics-test"), metrics)
    for duration in (10, 20, 30):
        telemetry.emit("ai.provider.completed", duration_ms=duration)
    snapshot = metrics.snapshot()
    assert snapshot["counts"]["ai.provider.completed"] == 3
    assert snapshot["durations"]["ai.provider.completed"]["samples"] == 2
    assert snapshot["durations"]["ai.provider.completed"]["p95_ms"] == 30.0


def test_default_runtime_logger_emits_safe_info_events() -> None:
    assert DEFAULT_LOGGER.isEnabledFor(logging.INFO)
    assert any(handler.name == "farta-ai-json" for handler in DEFAULT_LOGGER.handlers)
    assert DEFAULT_LOGGER.propagate is False
