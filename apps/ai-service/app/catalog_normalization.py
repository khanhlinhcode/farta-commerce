import unicodedata

from pydantic import BaseModel


def normalize_catalog_text(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def normalize_catalog_optional(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = normalize_catalog_text(value)
    return normalized or None


def normalize_catalog_size(value: str | None) -> str | None:
    normalized = normalize_catalog_optional(value)
    if normalized is None:
        return None
    if normalized.startswith("size "):
        normalized = normalized[5:].strip()
    return normalized or None


def canonical_tool_arguments(request: BaseModel) -> dict[str, object]:
    arguments = request.model_dump(exclude_none=True)
    if "keyword" in arguments:
        arguments["keyword"] = normalize_catalog_text(str(arguments["keyword"]))
    if "category" in arguments:
        arguments["category"] = normalize_catalog_text(str(arguments["category"]))
    if "color" in arguments:
        arguments["color"] = normalize_catalog_optional(str(arguments["color"]))
    if "size" in arguments:
        arguments["size"] = normalize_catalog_size(str(arguments["size"]))
    if "query" in arguments:
        arguments["query"] = normalize_catalog_text(str(arguments["query"]))
    if "source_types" in arguments:
        arguments["source_types"] = sorted(str(value) for value in arguments["source_types"])
    if "category_ids" in arguments:
        arguments["category_ids"] = sorted(
            {str(value).strip() for value in arguments["category_ids"] if str(value).strip()}
        )
    if "tags" in arguments:
        arguments["tags"] = sorted(
            {
                normalize_catalog_text(str(value))
                for value in arguments["tags"]
                if str(value).strip()
            }
        )
    return arguments
