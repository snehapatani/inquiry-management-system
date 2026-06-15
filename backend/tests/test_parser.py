"""
Tests for the mock parser (_mock_parse).
The real Claude parser is bypassed because no API key is set in tests.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from parser import _mock_parse


def test_parses_single_product_with_quantity():
    result = _mock_parse("Azithromycin 125 KG\nNaveen Khaitan, Apple Formulations")
    assert len(result.items) == 1
    item = result.items[0]
    assert "Azithromycin" in item.product_name
    assert item.quantity == 125.0
    assert item.unit == "KG"


def test_parses_multiple_products():
    text = "Amoxicillin 50 KG\nMetformin 200 GM\nRajesh, Beta Pharma"
    result = _mock_parse(text)
    assert len(result.items) == 2
    names = [i.product_name for i in result.items]
    assert any("Amoxicillin" in n for n in names)
    assert any("Metformin" in n for n in names)


def test_extracts_customer_name_and_company():
    result = _mock_parse("Paracetamol 100 KG\nSunita Sharma, Modern Labs")
    assert result.customer_name == "Sunita Sharma"
    assert result.customer_company == "Modern Labs"


def test_extracts_email():
    result = _mock_parse("Azithromycin 10 MT\nRavi, contact@pharma.com")
    assert result.customer_email == "contact@pharma.com"


def test_extracts_grade():
    result = _mock_parse("Metformin USP 100 KG\nTest Customer")
    assert len(result.items) >= 1
    assert result.items[0].grade == "USP"


def test_unit_normalisation():
    result = _mock_parse("Aspirin 500 KGS\nCustomer Name")
    assert result.items[0].unit == "KG"

    result = _mock_parse("Ibuprofen 10 MT\nCustomer Name")
    assert result.items[0].unit == "MT"


def test_parse_mode_endpoint_returns_false_without_key(client):
    r = client.get("/parse/mode")
    assert r.status_code == 200
    # In tests there is no API key, so mock mode should be active
    assert r.json()["ai"] is False


# need client fixture for the last test
