import json
import statistics
import time
from dataclasses import dataclass

from app.routing.intent_router import IntentRouter


@dataclass(frozen=True)
class RoutingCase:
    message: str
    selected_slugs: tuple[str, ...]
    expected_mode: str
    expected_tool: str | None


CASES = (
    RoutingCase("Tìm áo màu đen size M dưới 500k", (), "deterministic", "search_products"),
    RoutingCase("Cho xem váy dưới 1 triệu", (), "deterministic", "search_products"),
    RoutingCase("Tìm sản phẩm màu kem", (), "deterministic", "search_products"),
    RoutingCase("Còn size M không?", (), "clarification", None),
    RoutingCase(
        "Mẫu này còn size M không?",
        ("farta-essential-tee",),
        "deterministic",
        "get_product_availability",
    ),
    RoutingCase("Kiểm tra đơn hàng của tôi", (), "unsupported", None),
    RoutingCase("Hoàn tiền giúp tôi", (), "unsupported", None),
    RoutingCase("áo", (), "deterministic", "search_products"),
    RoutingCase("Tư vấn đồ đi triển lãm", (), "agent", None),
    RoutingCase("hello", (), "clarification", None),
)


def evaluate(iterations: int = 200) -> dict[str, float | int]:
    router = IntentRouter()
    correct = 0
    latencies: list[float] = []
    for index in range(iterations):
        case = CASES[index % len(CASES)]
        started = time.perf_counter()
        decision = router.route(case.message, list(case.selected_slugs))
        latencies.append((time.perf_counter() - started) * 1_000)
        if decision.mode == case.expected_mode and decision.tool == case.expected_tool:
            correct += 1
    ordered = sorted(latencies)
    return {
        "cases": iterations,
        "routing_accuracy": correct / iterations,
        "latency_p50_ms": statistics.median(ordered),
        "latency_p95_ms": ordered[max(0, int(len(ordered) * 0.95) - 1)],
        "provider_calls": 0,
    }


if __name__ == "__main__":
    print(json.dumps(evaluate(), ensure_ascii=False, indent=2))
