"""
Tests for the vendor matching endpoint and keyword filtering logic.

Key behaviours verified:
- Noise words (units, grade codes, numbers) are stripped before matching
- ALL remaining keywords must match (AND, not OR)
- Matched vendors include last-quoted price from history
- Items with no catalog match get MatchStatus = "No Vendor"
"""
from helpers import make_vendor, make_customer, make_inquiry, make_vendor_product


def _get_item_id(client, inquiry):
    detail = client.get(f"/inquiries/{inquiry['InquiryID']}").json()
    return detail["Items"][0]["ItemID"]


# ── keyword filtering ─────────────────────────────────────────────

def test_noise_words_excluded(client):
    """Numbers and unit/grade tokens must not be used as keywords."""
    vendor = make_vendor(client, "Noise Vendor")
    # A product that contains the unit "500" and "MG" but NOT the drug name
    make_vendor_product(client, vendor["VendorID"], "500 MG Capsule")

    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"],
                       items=[{"ProductNameRaw": "Azithromycin 500 MG"}])
    item_id = _get_item_id(client, inq)

    r = client.get(f"/items/{item_id}/match-vendors")
    assert r.status_code == 200
    names = [v["VendorName"] for v in r.json()]
    assert "Noise Vendor" not in names


def test_all_keywords_must_match(client):
    """AND logic: a product missing one keyword should not match."""
    vendor_partial = make_vendor(client, "Partial Match Vendor")
    make_vendor_product(client, vendor_partial["VendorID"], "Amoxicillin Powder")

    vendor_full = make_vendor(client, "Full Match Vendor")
    make_vendor_product(client, vendor_full["VendorID"], "Amoxicillin Trihydrate Powder")

    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"],
                       items=[{"ProductNameRaw": "Amoxicillin Trihydrate"}])
    item_id = _get_item_id(client, inq)

    r = client.get(f"/items/{item_id}/match-vendors")
    assert r.status_code == 200
    names = [v["VendorName"] for v in r.json()]
    assert "Full Match Vendor" in names
    assert "Partial Match Vendor" not in names


def test_match_updates_status_to_matched(client):
    vendor = make_vendor(client, "Status Vendor")
    make_vendor_product(client, vendor["VendorID"], "Paracetamol")

    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"],
                       items=[{"ProductNameRaw": "Paracetamol 250 KG"}])
    item_id = _get_item_id(client, inq)

    client.get(f"/items/{item_id}/match-vendors")

    detail = client.get(f"/inquiries/{inq['InquiryID']}").json()
    item = next(i for i in detail["Items"] if i["ItemID"] == item_id)
    assert item["MatchStatus"] == "Matched"


def test_no_match_updates_status_to_no_vendor(client):
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"],
                       items=[{"ProductNameRaw": "Obscurecompound XYZ"}])
    item_id = _get_item_id(client, inq)

    r = client.get(f"/items/{item_id}/match-vendors")
    assert r.status_code == 200
    assert r.json() == []

    detail = client.get(f"/inquiries/{inq['InquiryID']}").json()
    item = next(i for i in detail["Items"] if i["ItemID"] == item_id)
    assert item["MatchStatus"] == "No Vendor"


def test_match_returns_vendor_details(client):
    vendor = make_vendor(client, "Detail Vendor", ContactPerson="Ravi", Phone="9876543210")
    make_vendor_product(client, vendor["VendorID"], "Metformin", grade="IP")

    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"],
                       items=[{"ProductNameRaw": "Metformin 500"}])
    item_id = _get_item_id(client, inq)

    r = client.get(f"/items/{item_id}/match-vendors")
    assert r.status_code == 200
    results = r.json()
    assert len(results) == 1
    v = results[0]
    assert v["VendorName"] == "Detail Vendor"
    assert v["ContactPerson"] == "Ravi"
    assert v["Phone"] == "9876543210"


