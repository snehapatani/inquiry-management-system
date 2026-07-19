"""Shared helper functions for building test fixtures via the API."""


def make_vendor(client, name="Test Vendor", **kwargs):
    r = client.post("/vendors", json={"VendorName": name, **kwargs})
    assert r.status_code == 200, r.text
    return r.json()


def make_customer(client, name="Test Customer", company="Test Co", email=None, phone=None, **kwargs):
    payload = {"Name": name, "Company": company}
    if email:
        payload["Email"] = email
    if phone:
        payload["Phone"] = phone
    payload.update(kwargs)
    r = client.post("/customers", json=payload)
    assert r.status_code == 200, r.text
    return r.json()


def make_inquiry(client, customer_id, items=None):
    payload = {
        "CustomerID": customer_id,
        "Source": "WhatsApp",
        "Items": items or [{"ProductNameRaw": "Azithromycin 500 MG"}],
    }
    r = client.post("/inquiries", json=payload)
    assert r.status_code == 200, r.text
    return r.json()


def make_vendor_product(client, vendor_id, product_name="Azithromycin", grade=None):
    r = client.post("/vendor-products", json={
        "VendorID": vendor_id,
        "ProductName": product_name,
        "Grade": grade,
        "IsAvailable": True,
    })
    assert r.status_code == 200, r.text
    return r.json()


def get_first_item_id(client, inq_id):
    return client.get(f"/inquiries/{inq_id}").json()["Items"][0]["ItemID"]
