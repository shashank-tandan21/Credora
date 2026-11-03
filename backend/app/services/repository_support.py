import inspect
from typing import Any


async def repository_call(method: Any, *args: Any) -> Any:
    result = method(*args)
    if inspect.isawaitable(result):
        return await result
    return result
