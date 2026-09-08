from abc import abstractmethod
from contextvars import ContextVar
from functools import lru_cache
from pathlib import Path
from typing import Protocol

from fastapi import Header

from mealie.lang.locale_config import LOCALE_CONFIG, LocaleConfig
from mealie.pkgs import i18n

CWD = Path(__file__).parent
TRANSLATIONS = CWD / "messages"
FALLBACK_LOCALE = "en-US"


class Translator(Protocol):
    @abstractmethod
    def t(self, key, default=None, **kwargs) -> str:
        pass


_locale_context: ContextVar[tuple[Translator, LocaleConfig] | None] = ContextVar("locale_context", default=None)


def set_locale_context(translator: Translator, locale_config: LocaleConfig) -> None:
    """Set the locale context for the current request"""
    _locale_context.set((translator, locale_config))


def get_locale_context() -> tuple[Translator, LocaleConfig] | None:
    """Get the current locale context"""
    return _locale_context.get()


@lru_cache
def _load_factory() -> i18n.ProviderFactory:
    return i18n.ProviderFactory(
        directory=TRANSLATIONS,
        fallback_locale=FALLBACK_LOCALE,
    )


@lru_cache
def _supported_locales_lookup() -> dict[str, str]:
    """
    Maps lowercase locale tags and bare language codes to the supported locale tag, e.g.
    {"en-us": "en-US", "en": "en-US", "de-de": "de-DE", "de": "de-DE", ...}
    """
    factory = _load_factory()
    lookup: dict[str, str] = {}
    for locale in sorted(factory.supported_locales):
        lookup.setdefault(locale.lower(), locale)
        lookup.setdefault(locale.split("-")[0].lower(), locale)

    # prefer the fallback locale for its bare language code
    lookup[FALLBACK_LOCALE.split("-")[0].lower()] = FALLBACK_LOCALE
    return lookup


@lru_cache(maxsize=512)
def resolve_locale(accept_language: str | None) -> str:
    """
    Resolves an Accept-Language header (or a plain locale tag) to one of the supported locale tags.

    The frontend sends a plain tag such as "en-US", but any HTTP client may send a full header such as
    "en-GB,en;q=0.9,de;q=0.8". Only supported tags are ever returned, which keeps the translation cache
    bounded to the set of shipped locales instead of one entry per distinct header string.
    """

    # callers outside a request may pass nothing (or FastAPI's Header default object) here
    if not isinstance(accept_language, str) or not accept_language:
        return FALLBACK_LOCALE

    lookup = _supported_locales_lookup()
    for part in accept_language.split(","):
        tag = part.split(";", 1)[0].strip()
        if not tag:
            continue

        if match := lookup.get(tag.lower().replace("_", "-")):
            return match

        if match := lookup.get(tag.split("-")[0].split("_")[0].lower()):
            return match

    return FALLBACK_LOCALE


def get_locale_provider(accept_language: str | None = Header(None)) -> Translator:
    factory = _load_factory()
    return factory.get(resolve_locale(accept_language))


def get_locale_config(accept_language: str | None = Header(None)) -> LocaleConfig:
    return LOCALE_CONFIG.get(resolve_locale(accept_language), LOCALE_CONFIG[FALLBACK_LOCALE])


@lru_cache
def get_all_translations(key: str) -> dict[str, str]:
    factory = _load_factory()
    return {locale: factory.get(locale).t(key) for locale in factory.supported_locales}
