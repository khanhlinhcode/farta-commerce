from typing import Protocol

from pydantic_ai.models import Model


class ModelFactory(Protocol):
    def create(self) -> Model: ...
