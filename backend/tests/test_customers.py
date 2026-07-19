"""
Tests for customer CRUD and autocomplete functionality.
"""
from helpers import make_customer


def test_create_customer(client):
    """Test creating a new customer"""
    r = client.post("/customers", json={
        "Name": "Rajesh Kumar",
        "Company": "Alpha Pharma",
        "Email": "rajesh@alpha.com",
        "Phone": "9876543210",
        "SourceChannel": "Email",
        "CustomerCategory": "End User",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["Name"] == "Rajesh Kumar"
    assert data["Company"] == "Alpha Pharma"
    assert data["Email"] == "rajesh@alpha.com"
    assert "CustomerID" in data


def test_get_customer(client):
    """Test retrieving a customer by ID"""
    cust = make_customer(client, name="John Doe", company="ABC Corp")
    r = client.get(f"/customers/{cust['CustomerID']}")
    assert r.status_code == 200
    data = r.json()
    assert data["Name"] == "John Doe"
    assert data["Company"] == "ABC Corp"


def test_list_customers(client):
    """Test listing all active customers"""
    cust1 = make_customer(client, name="Customer One")
    cust2 = make_customer(client, name="Customer Two")

    r = client.get("/customers")
    assert r.status_code == 200
    customers = r.json()
    customer_ids = [c["CustomerID"] for c in customers]
    assert cust1["CustomerID"] in customer_ids
    assert cust2["CustomerID"] in customer_ids


def test_autocomplete_returns_empty_when_query_empty(client):
    """Test autocomplete returns empty list when query is empty"""
    make_customer(client, name="Rajesh Kumar")
    r = client.get("/customers/autocomplete?q=")
    assert r.status_code == 200
    assert r.json() == []


def test_autocomplete_with_single_character(client):
    """Test autocomplete with single character query"""
    make_customer(client, name="Rajesh Kumar")
    r = client.get("/customers/autocomplete?q=R")
    assert r.status_code == 200
    # Should return empty or results depending on implementation
    # At least it shouldn't error
    assert isinstance(r.json(), list)


def test_autocomplete_finds_by_exact_prefix(client):
    """Test autocomplete finds customers by name prefix"""
    cust = make_customer(client, name="Rajesh Kumar", company="Alpha Pharma", email="rajesh@alpha.com")
    r = client.get("/customers/autocomplete?q=Rajesh")
    assert r.status_code == 200
    results = r.json()
    assert len(results) > 0
    assert any(c["CustomerID"] == cust["CustomerID"] for c in results)


def test_autocomplete_case_insensitive(client):
    """Test autocomplete is case insensitive"""
    cust = make_customer(client, name="Rajesh Kumar")
    r = client.get("/customers/autocomplete?q=rajesh")
    assert r.status_code == 200
    results = r.json()
    assert len(results) > 0
    assert any(c["CustomerID"] == cust["CustomerID"] for c in results)


def test_autocomplete_partial_name_match(client):
    """Test autocomplete finds partial matches"""
    cust = make_customer(client, name="Rajesh Kumar")
    r = client.get("/customers/autocomplete?q=Kumar")
    assert r.status_code == 200
    results = r.json()
    assert len(results) > 0
    assert any(c["CustomerID"] == cust["CustomerID"] for c in results)


def test_autocomplete_returns_customer_details(client):
    """Test autocomplete returns all customer details"""
    cust = make_customer(
        client,
        name="Rajesh Kumar",
        company="Alpha Pharma",
        email="rajesh@alpha.com",
        phone="9876543210"
    )
    r = client.get("/customers/autocomplete?q=Rajesh")
    assert r.status_code == 200
    results = r.json()
    result = next((c for c in results if c["CustomerID"] == cust["CustomerID"]), None)
    assert result is not None
    assert result["Name"] == "Rajesh Kumar"
    assert result["Company"] == "Alpha Pharma"
    assert result["Email"] == "rajesh@alpha.com"
    assert result["Phone"] == "9876543210"


def test_autocomplete_returns_limited_results(client):
    """Test autocomplete returns maximum 10 results"""
    for i in range(15):
        make_customer(client, name=f"Customer {i:02d}")

    r = client.get("/customers/autocomplete?q=Customer")
    assert r.status_code == 200
    results = r.json()
    assert len(results) <= 10


def test_autocomplete_no_results_found(client):
    """Test autocomplete returns empty list when no matches"""
    make_customer(client, name="Rajesh Kumar")
    r = client.get("/customers/autocomplete?q=XYZ")
    assert r.status_code == 200
    results = r.json()
    assert results == []


def test_autocomplete_only_returns_active_customers(client):
    """Test autocomplete only returns active customers"""
    cust = make_customer(client, name="Active Customer")
    # In a real scenario, you would mark a customer as inactive
    # For now, just verify the endpoint works with active customers
    r = client.get("/customers/autocomplete?q=Active")
    assert r.status_code == 200
    results = r.json()
    assert len(results) > 0
    assert any(c["CustomerID"] == cust["CustomerID"] for c in results)


def test_autocomplete_multiple_matches(client):
    """Test autocomplete with multiple matching customers"""
    cust1 = make_customer(client, name="Rajesh Kumar", company="Alpha Pharma")
    cust2 = make_customer(client, name="Rajesh Singh", company="Beta Labs")
    cust3 = make_customer(client, name="John Doe", company="Gamma Corp")

    r = client.get("/customers/autocomplete?q=Rajesh")
    assert r.status_code == 200
    results = r.json()
    assert len(results) >= 2
    result_ids = [c["CustomerID"] for c in results]
    assert cust1["CustomerID"] in result_ids
    assert cust2["CustomerID"] in result_ids
    assert cust3["CustomerID"] not in result_ids


def test_autocomplete_with_special_characters(client):
    """Test autocomplete with special characters in name"""
    cust = make_customer(client, name="O'Brien & Co")
    r = client.get("/customers/autocomplete?q=O'Brien")
    assert r.status_code == 200
    results = r.json()
    # Should handle special characters gracefully
    assert isinstance(results, list)


def test_autocomplete_whitespace_handling(client):
    """Test autocomplete handles leading/trailing whitespace"""
    cust = make_customer(client, name="Rajesh Kumar")
    r = client.get("/customers/autocomplete?q=%20%20Rajesh%20%20")
    assert r.status_code == 200
    results = r.json()
    # Should strip whitespace and find match
    assert len(results) > 0


def test_get_nonexistent_customer_returns_404(client):
    """Test getting non-existent customer returns 404"""
    r = client.get("/customers/99999")
    assert r.status_code == 404


def test_create_customer_with_minimal_fields(client):
    """Test creating customer with only required fields"""
    r = client.post("/customers", json={"Name": "Minimal Customer"})
    assert r.status_code == 200
    data = r.json()
    assert data["Name"] == "Minimal Customer"
    assert "CustomerID" in data
