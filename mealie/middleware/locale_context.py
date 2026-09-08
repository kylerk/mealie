from starlette.datastructures import Headers
from starlette.types import ASGIApp, Receive, Scope, Send

from mealie.lang.providers import get_locale_config, get_locale_provider, set_locale_context


class LocaleContextMiddleware:
    """
    Inject translator and locale config into context var.
    This allows any part of the app to call get_locale_context, as long as it's within an HTTP request context.

    Implemented as a plain ASGI middleware rather than Starlette's BaseHTTPMiddleware: the latter wraps every
    request in a task group and a streaming bridge, which adds measurable latency to each request (including
    static files and images) and interferes with streaming responses. All this middleware needs to do is set a
    context variable, so it simply delegates to the next app.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] in ("http", "websocket"):
            accept_language = Headers(scope=scope).get("accept-language")
            translator = get_locale_provider(accept_language)
            locale_config = get_locale_config(accept_language)
            set_locale_context(translator, locale_config)

        await self.app(scope, receive, send)
