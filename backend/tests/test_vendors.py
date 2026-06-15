"""
Tests for vendor CRUD and vendor-product management.
"""
from helpers import make_vendor, make_vendor_product


def test_create_vendor(client):
    r = client.post("/vendors", json={"VendorName": "New Vendor", "City": "Mumbai"})
    assert r.status_code == 200
    data = r.json()
    assert data["VendorName"] == "New Vendor"
    assert data["City"] == "Mumbai"
    assert data["VendorID"] is not None


def test_list_vendors(client):
    make_vendor(client, "Vendor Alpha")
    make_vendor(client, "Vendor Beta")

    r = client.get("/vendors")
    assert r.status_code == 200
    names = [v["VendorName"] for v in r.json()]
    assert "Vendor Alpha" in names
    assert "Vendor Beta" in names


def test_vendor_product_count_in_list(client):
    vendor = make_vendor(client, "Count Vendor")
    make_vendor_product(client, vendor["VendorID"], "Product A")
    make_vendor_product(client, vendor["VendorID"], "Product B")

    r = client.get("/vendors")
    v = next(v for v in r.json() if v["VendorID"] == vendor["VendorID"])
    assert v["ProductCount"] == 2


def test_update_vendor(client):
    vendor = make_vendor(client, "Old Name")
    r = client.put(f"/vendors/{vendor['VendorID']}", json={
        "VendorName": "New Name",
        "ContactPerson": "Ravi",
    })
    assert r.status_code == 200
    assert r.json()["VendorName"] == "New Name"


def test_delete_vendor_deactivates(client):
    vendor = make_vendor(client, "To Delete")
    r = client.delete(f"/vendors/{vendor['VendorID']}")
    assert r.status_code == 200

    vendors = client.get("/vendors").json()
    assert not any(v["VendorID"] == vendor["VendorID"] for v in vendors)


def test_add_vendor_product(client):
    vendor = make_vendor(client, "Product Vendor")
    r = client.post("/vendor-products", json={
        "VendorID": vendor["VendorID"],
        "ProductName": "Metformin",
        "Grade": "IP",
        "LeadTimeDays": 7,
    })
    assert r.status_code == 200
    p = r.json()
    assert p["ProductName"] == "Metformin"
    assert p["Grade"] == "IP"


def test_get_vendor_products(client):
    vendor = make_vendor(client, "Multi Product Vendor")
    make_vendor_product(client, vendor["VendorID"], "Aspirin")
    make_vendor_product(client, vendor["VendorID"], "Ibuprofen")

    r = client.get(f"/vendors/{vendor['VendorID']}/products")
    assert r.status_code == 200
    names = [p["ProductName"] for p in r.json()]
    assert "Aspirin" in names
    assert "Ibuprofen" in names


def test_delete_vendor_product(client):
    vendor = make_vendor(client, "Delete Product Vendor")
    product = make_vendor_product(client, vendor["VendorID"], "Temporary Product")

    r = client.delete(f"/vendor-products/{product['VendorProductID']}")
    assert r.status_code == 200

    products = client.get(f"/vendors/{vendor['VendorID']}/products").json()
    assert not any(p["VendorProductID"] == product["VendorProductID"] for p in products)


def test_vendor_product_with_reference_price(client):
    vendor = make_vendor(client, "Priced Vendor")
    r = client.post("/vendor-products", json={
        "VendorID": vendor["VendorID"],
        "ProductName": "Azithromycin",
        "ReferencePrice": 1200.50,
        "ReferenceCurrency": "INR",
        "ReferencePriceUnit": "per KG",
    })
    assert r.status_code == 200
    p = r.json()
    assert float(p["ReferencePrice"]) == 1200.50
