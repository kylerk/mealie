import pytest

from mealie.lang.providers import _load_factory, get_locale_config, get_locale_provider, resolve_locale


@pytest.mark.parametrize(
    ("accept_language", "expected"),
    [
        (None, "en-US"),
        ("", "en-US"),
        ("en-US", "en-US"),
        ("en-us", "en-US"),
        ("en_US", "en-US"),
        ("de-DE", "de-DE"),
        ("de", "de-DE"),
        ("en", "en-US"),
        ("en-GB,en;q=0.9,de;q=0.8", "en-GB"),
        ("xx-YY,de;q=0.5", "de-DE"),
        ("xx-YY", "en-US"),
        ("*", "en-US"),
        ("  fr-FR ; q=0.7 , en", "fr-FR"),
    ],
)
def test_resolve_locale(accept_language: str | None, expected: str):
    assert resolve_locale(accept_language) == expected


def test_locale_provider_cache_is_bounded():
    """
    Distinct Accept-Language headers must not add new entries to the translation cache;
    only supported locale tags may be cached.
    """
    factory = _load_factory()
    supported = set(factory.supported_locales)

    for header in ["en-US,en;q=0.9", "en-GB,en;q=0.8,de;q=0.7", "xx-YY", "zz", "en-us"]:
        get_locale_provider(header)
        get_locale_config(header)

    assert set(factory._store.keys()) <= supported


def test_locale_config_matches_resolved_locale():
    assert get_locale_config("de").key == "de-DE"
    assert get_locale_config("nonsense").key == "en-US"
