from pydantic_ai.models.google import GoogleModel
from pydantic_ai.models.groq import GroqModel
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.providers.groq import GroqProvider


def test_locked_pydantic_ai_profiles_support_configured_model_ids_and_tools() -> None:
    google = GoogleModel(
        "gemini-3.5-flash-lite",
        provider=GoogleProvider(api_key="local-test-placeholder"),
    )
    groq = GroqModel(
        "openai/gpt-oss-120b",
        provider=GroqProvider(api_key="local-test-placeholder"),
    )

    assert google.model_name == "gemini-3.5-flash-lite"
    assert google.profile.get("supports_tools") is True
    assert google.profile.get("supports_tool_return_schema") is True
    assert google.profile.get("supports_json_schema_output") is True
    assert google.profile.get("google_supports_tool_combination") is True
    assert google.profile.get("google_supports_minimal_thinking_level") is True

    assert groq.model_name == "openai/gpt-oss-120b"
    assert groq.profile.get("supports_tools") is True
    assert groq.profile.get("supports_json_schema_output") is True
    assert groq.profile.get("groq_supports_graded_reasoning_effort") is True
