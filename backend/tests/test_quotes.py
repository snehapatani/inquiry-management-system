"""
Tests for vendor quotes: creation, set-best, and the duplicate-detection
behaviour (same vendor + same price → backend allows it; frontend validates).
"""
from helpers import make_customer, make_inquiry, make_vendor


def _item_id(client, inq_id):
    return client.get(f"/inquiries/{inq_id}").json()["Items"][0]["ItemID"]


def _add_quote(client, item_id, vendor_id, price, unit="per KG"):
    r = client.post("/quotes", json={
        "ItemID": item_id,
        "VendorID": vendor_id,
        "QuotedPrice": price,
        "Currency": "INR",
        "PriceUnit": unit,
    })
    assert r.status_code == 200, r.text
    return r.json()


def test_create_quote(client):
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"])
    vendor = make_vendor(client, "Quote Vendor")
    item_id = _item_id(client, inq["InquiryID"])

    q = _add_quote(client, item_id, vendor["VendorID"], 1500)
    assert float(q["QuotedPrice"]) == 1500.0
    assert q["VendorID"] == vendor["VendorID"]


def test_get_quotes_for_item(client):
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"])
    v1 = make_vendor(client, "Vendor A")
    v2 = make_vendor(client, "Vendor B")
    item_id = _item_id(client, inq["InquiryID"])

    _add_quote(client, item_id, v1["VendorID"], 1000)
    _add_quote(client, item_id, v2["VendorID"], 1200)

    r = client.get(f"/items/{item_id}/quotes")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_set_best_quote(client):
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"])
    vendor = make_vendor(client, "Best Vendor")
    item_id = _item_id(client, inq["InquiryID"])

    q1 = _add_quote(client, item_id, vendor["VendorID"], 900)
    q2 = _add_quote(client, item_id, make_vendor(client, "Other Vendor")["VendorID"], 1100)

    r = client.patch(f"/items/{item_id}/best-quote?quote_id={q1['QuoteID']}")
    assert r.status_code == 200

    quotes = client.get(f"/items/{item_id}/quotes").json()
    best = next(q for q in quotes if q["QuoteID"] == q1["QuoteID"])
    other = next(q for q in quotes if q["QuoteID"] == q2["QuoteID"])
    assert best["IsBestPrice"] is True
    assert other["IsBestPrice"] is False


def test_same_vendor_different_price_allowed_by_backend(client):
    """Backend allows multiple quotes from same vendor (duplicate check is frontend-only)."""
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"])
    vendor = make_vendor(client, "Repeat Vendor")
    item_id = _item_id(client, inq["InquiryID"])

    _add_quote(client, item_id, vendor["VendorID"], 1000)
    q2 = _add_quote(client, item_id, vendor["VendorID"], 1200)  # different price — allowed

    quotes = client.get(f"/items/{item_id}/quotes").json()
    vendor_quotes = [q for q in quotes if q["VendorID"] == vendor["VendorID"]]
    assert len(vendor_quotes) == 2


def test_quote_without_date_accepted(client):
    """QuotedDate is optional — omitting it must not cause a 422."""
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"])
    vendor = make_vendor(client, "Dateless Vendor")
    item_id = _item_id(client, inq["InquiryID"])

    r = client.post("/quotes", json={
        "ItemID": item_id,
        "VendorID": vendor["VendorID"],
        "QuotedPrice": 500,
    })
    assert r.status_code == 200
    # QuotedDate defaults to now() server-side when omitted — just verify the field exists
    assert "QuotedDate" in r.json()


def test_quote_with_empty_string_date_rejected(client):
    """Sending an empty string for QuotedDate must return 422 (not silently fail)."""
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"])
    vendor = make_vendor(client, "Bad Date Vendor")
    item_id = _item_id(client, inq["InquiryID"])

    r = client.post("/quotes", json={
        "ItemID": item_id,
        "VendorID": vendor["VendorID"],
        "QuotedPrice": 500,
        "QuotedDate": "",   # invalid — should not be accepted
    })
    assert r.status_code == 422
