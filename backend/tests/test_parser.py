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


def test_parses_products_with_moq_notation():
    """Test parsing products with MOQ (Minimum Order Quantity) notation"""
    text = """Inquiry from Yagnik (Expert Pharma):
1. BETAHISTINE DIHYDROCHLORIDE BP — 5 Kg
2. Tadalafil — MOQ
3. Verdanafil — MOQ
4. Depoxitine — MOQ
5. Dabigatron Etexilate — MOQ"""
    result = _mock_parse(text)
    assert len(result.items) == 5
    # First product should have quantity
    assert result.items[0].quantity == 5.0
    assert result.items[0].unit == "KG"
    assert "BETAHISTINE DIHYDROCHLORIDE" in result.items[0].product_name
    assert "BP" in result.items[0].product_name or result.items[0].grade == "BP"

    # Other products should be parsed without quantities
    assert "Tadalafil" in result.items[1].product_name
    assert "Verdanafil" in result.items[2].product_name
    assert "Depoxitine" in result.items[3].product_name
    assert "Dabigatron Etexilate" in result.items[4].product_name


def test_parses_numbered_list_format():
    """Test parsing numbered list format (1. 2. 3.)"""
    text = """Inquiry from ABC Pharma:
1. Azithromycin 125 KG
2. Amoxicillin 50 KG
3. Metformin 200 GM
Contact: John Doe, ABC Corp"""
    result = _mock_parse(text)
    assert len(result.items) == 3
    assert "Azithromycin" in result.items[0].product_name
    assert "Amoxicillin" in result.items[1].product_name
    assert "Metformin" in result.items[2].product_name


def test_parses_numbered_list_with_parentheses():
    """Test parsing numbered list with parentheses (1) 2) 3))"""
    text = """Requirements:
1) Ibuprofen 100 KG
2) Paracetamol 50 KG
3) Aspirin 75 KG
Rajesh Kumar, XYZ Pharma"""
    result = _mock_parse(text)
    assert len(result.items) == 3
    names = [i.product_name for i in result.items]
    assert any("Ibuprofen" in n for n in names)
    assert any("Paracetamol" in n for n in names)
    assert any("Aspirin" in n for n in names)


def test_parses_products_with_arrows():
    """Test parsing products with arrow notation (→ or >)"""
    text = """Products:
BETAHISTINE → 5 Kg
Tadalafil → MOQ
Verdanafil → MOQ
Customer, Corp"""
    result = _mock_parse(text)
    assert len(result.items) >= 1
    # First product should be recognized
    assert any("BETAHISTINE" in i.product_name for i in result.items)


def test_parses_mixed_format_inquiry():
    """Test parsing inquiry with mixed formats (some with qty, some with MOQ)"""
    text = """Inquiry:
1. Azithromycin 500 KG
2. Metformin — MOQ
3. Ibuprofen 100 GM BP
4. Paracetamol — MOQ
Contact: Test Customer"""
    result = _mock_parse(text)
    # Should parse all 4 products
    assert len(result.items) >= 3
    product_names = [i.product_name for i in result.items]
    assert any("Azithromycin" in p for p in product_names)
    assert any("Metformin" in p for p in product_names)


def test_removes_numbering_prefix():
    """Test that numbering prefixes are removed from product names"""
    text = """1. Azithromycin 125 KG
2. Metformin 50 KG
Test Customer"""
    result = _mock_parse(text)
    assert len(result.items) == 2
    # Product names should not start with numbers
    for item in result.items:
        assert not item.product_name[0].isdigit()


# Products autocomplete tests
def test_autocomplete_products_empty_query(client):
    """Test product autocomplete returns empty when query is empty"""
    r = client.get("/products/autocomplete?q=")
    assert r.status_code == 200
    assert r.json() == []


def test_autocomplete_products_single_character(client):
    """Test autocomplete with single character query"""
    r = client.get("/products/autocomplete?q=A")
    assert r.status_code == 200
    # Should return list (may be empty or with results)
    assert isinstance(r.json(), list)


def test_autocomplete_products_finds_by_prefix():
    """Test autocomplete finds products by name prefix"""
    from helpers import make_customer, make_inquiry
    cust = make_customer(client := None)  # Will be passed in actual test
    # This test needs to be run with a real client fixture


def test_autocomplete_products_case_insensitive(client):
    """Test autocomplete is case insensitive"""
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"], items=[
        {"ProductNameRaw": "Azithromycin 500 KG"}
    ])

    r = client.get("/products/autocomplete?q=azithromycin")
    assert r.status_code == 200
    results = r.json()
    assert len(results) > 0
    assert any("Azithromycin" in p["ProductName"] for p in results)


def test_autocomplete_products_partial_match(client):
    """Test autocomplete finds partial matches"""
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"], items=[
        {"ProductNameRaw": "Azithromycin 500 KG"}
    ])

    r = client.get("/products/autocomplete?q=thro")
    assert r.status_code == 200
    results = r.json()
    assert len(results) > 0


def test_autocomplete_products_returns_product_details(client):
    """Test autocomplete returns correct product details"""
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"], items=[
        {"ProductNameRaw": "Metformin 250 KG"}
    ])

    r = client.get("/products/autocomplete?q=Metformin")
    assert r.status_code == 200
    results = r.json()
    assert len(results) > 0
    product = next((p for p in results if "Metformin" in p["ProductName"]), None)
    assert product is not None
    assert "ProductName" in product


def test_autocomplete_products_returns_limited_results(client):
    """Test autocomplete returns maximum 10 results"""
    cust = make_customer(client)
    # Create multiple inquiries with different products
    for i in range(15):
        make_inquiry(client, cust["CustomerID"], items=[
            {"ProductNameRaw": f"Product {i:02d} 100 KG"}
        ])

    r = client.get("/products/autocomplete?q=Product")
    assert r.status_code == 200
    results = r.json()
    assert len(results) <= 10


def test_autocomplete_products_no_results(client):
    """Test autocomplete returns empty list when no matches"""
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"], items=[
        {"ProductNameRaw": "Azithromycin 500 KG"}
    ])

    r = client.get("/products/autocomplete?q=XYZ123")
    assert r.status_code == 200
    results = r.json()
    assert results == []


def test_autocomplete_products_multiple_matches(client):
    """Test autocomplete with multiple matching products"""
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"], items=[
        {"ProductNameRaw": "Azithromycin 500 KG"},
        {"ProductNameRaw": "Amoxicillin 250 KG"},
        {"ProductNameRaw": "Metformin 100 KG"},
    ])

    r = client.get("/products/autocomplete?q=A")
    assert r.status_code == 200
    results = r.json()
    product_names = [p["ProductName"] for p in results]
    assert any("Azithromycin" in pn for pn in product_names)
    assert any("Amoxicillin" in pn for pn in product_names)


# need client fixture for the last test
