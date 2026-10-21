import hashlib
import json
import logging
import math
import statistics
import threading
from collections import Counter, defaultdict, deque
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

AI_EVENTS = frozenset(
    {
        "ai.request.started",
        "ai.route.selected",
        "ai.provider.started",
        "ai.provider.completed",
        "ai.provider.failed",
        "ai.tool.started",
        "ai.tool.completed",
        "ai.tool.failed",
        "ai.response.validated",
        "ai.response.rejected",
        "ai.request.completed",
    }
)

SAFE_FIELDS = frozenset(
    {
        "request_id",
        "conversation_digest",
        "route",
        "provider",
        "model",
        "duration_ms",
        "tool",
        "tool_count",
        "model_request_count",
        "input_tokens",
        "output_tokens",
        "response_status",
        "error_code",
    }
)


@dataclass
class AiMetrics:
    """Provider-neutral in-process metrics hook.

    This is intentionally not an alerting or durable metrics backend. A bounded sample
    window prevents unbounded memory growth until a staging monitoring sink is selected.
    """

    sample_limit: int = 2_048
    _counts: Counter[str] = field(default_factory=Counter)
    _durations: dict[str, deque[float]] = field(default_factory=lambda: defaultdict(deque))
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def observe(self, event: str, fields: Mapping[str, Any]) -> None:
        with self._lock:
            self._counts[event] += 1
            error_code = fields.get("error_code")
            if isinstance(error_code, str) and error_code:
                self._counts[f"error.{error_code}"] += 1
            duration = fields.get("duration_ms")
            if isinstance(duration, (int, float)) and duration >= 0:
                samples = self._durations[event]
                samples.append(float(duration))
                while len(samples) > self.sample_limit:
                    samples.popleft()

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            counts = dict(self._counts)
            durations = {
                event: {
                    "samples": len(values),
                    "p50_ms": _percentile(values, 0.50),
                    "p95_ms": _percentile(values, 0.95),
                }
                for event, values in self._durations.items()
                if values
            }
        return {"counts": counts, "durations": durations}


class AiObservability:
    def __init__(self, logger: logging.Logger | None = None, metrics: AiMetrics | None = None):
        self._logger = logger or logging.getLogger("farta.ai")
        self.metrics = metrics or AiMetrics()

    def emit(self, event: str, **fields: Any) -> None:
        if event not in AI_EVENTS:
            raise ValueError(f"Unsupported AI observability event: {event}")
        safe = {
            key: value for key, value in fields.items() if key in SAFE_FIELDS and value is not None
        }
        self.metrics.observe(event, safe)
        self._logger.info(json.dumps({"event": event, **safe}, ensure_ascii=False, sort_keys=True))

    @staticmethod
    def conversation_digest(conversation_id: str) -> str:
        return hashlib.sha256(conversation_id.encode()).hexdigest()[:16]


def _percentile(values: deque[float], percentile: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    if percentile == 0.50:
        return round(statistics.median(ordered), 3)
    index = max(0, min(len(ordered) - 1, math.ceil(len(ordered) * percentile) - 1))
    return round(ordered[index], 3)


DEFAULT_LOGGER = logging.getLogger("farta.ai")
DEFAULT_LOGGER.setLevel(logging.INFO)
DEFAULT_OBSERVABILITY = AiObservability(DEFAULT_LOGGER)
