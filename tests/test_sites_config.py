# Simple sanity checks for site URL normalization

from backend.sites_config import get_site_url


def test_strip_and_normalize():
    # trailing slash should be removed
    assert get_site_url("tpl") == "https://rbg.iitm.ac.in/tpl"
    # fps has a hash-based app; the checksum remains but trailing slash is stripped
    assert get_site_url("fps") == "https://rbg.iitm.ac.in/fps/#"


def test_none_for_unknown():
    assert get_site_url("does_not_exist") is None


if __name__ == "__main__":
    # run simple assertions when executed directly
    test_strip_and_normalize()
    test_none_for_unknown()
    print("sites_config tests passed")
