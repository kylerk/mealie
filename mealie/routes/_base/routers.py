import contextlib
import json
from collections.abc import Callable
from enum import Enum
from json.decoder import JSONDecodeError

from fastapi import APIRouter, Depends, Request, Response
from fastapi.routing import APIRoute

from mealie.core.dependencies import get_admin_user, get_current_user


class AdminAPIRouter(APIRouter):
    """Router for functions to be protected behind admin authentication"""

    def __init__(self, tags: list[str | Enum] | None = None, prefix: str = "", **kwargs):
        super().__init__(tags=tags, prefix=prefix, dependencies=[Depends(get_admin_user)], **kwargs)


class UserAPIRouter(APIRouter):
    """Router for functions to be protected behind user authentication"""

    def __init__(self, tags: list[str | Enum] | None = None, prefix: str = "", **kwargs):
        super().__init__(tags=tags, prefix=prefix, dependencies=[Depends(get_current_user)], **kwargs)


class MealieCrudRoute(APIRoute):
    """Route class to include the last-modified header when returning a MealieModel, when available"""

    def get_route_handler(self) -> Callable:
        original_route_handler = super().get_route_handler()

        async def custom_route_handler(request: Request) -> Response:
            with contextlib.suppress(JSONDecodeError):
                response = await original_route_handler(request)

                # StreamingResponse from starlette doesn't have a body attribute, even though it inherits from Response,
                # so we may get an attribute error here even though our type hinting suggests otherwise.
                try:
                    response_body_bytes = response.body
                except AttributeError:
                    return response

                # cheap pre-check: skip parsing (potentially large) bodies that can't carry the header we're after
                if b'"updatedAt"' not in response_body_bytes:
                    return response

                response_body = json.loads(response_body_bytes)

                if isinstance(response_body, dict):
                    if last_modified := response_body.get("updatedAt"):
                        response.headers["last-modified"] = last_modified

                        # Force no-cache for all responses to prevent browser from caching API calls
                        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            return response

        return custom_route_handler
