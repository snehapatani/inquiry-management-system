"""
Tests for inquiry CRUD, status updates, search, and work-queue selection.
"""
from helpers import make_customer, make_inquiry


def test_create_and_get_inquiry(client):
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"],
                       items=[{"ProductNameRaw": "Azithromycin 500 KG"}])

    r = client.get(f"/inquiries/{inq['InquiryID']}")
    assert r.status_code == 200
    data = r.json()
    assert data["InquiryID"] == inq["InquiryID"]
    assert len(data["Items"]) == 1
    assert data["Items"][0]["ProductNameRaw"] == "Azithromycin 500 KG"


def test_inquiry_list_returns_item_count(client):
    cust = make_customer(client)
    make_inquiry(client, cust["CustomerID"], items=[
        {"ProductNameRaw": "Metformin 100 KG"},
        {"ProductNameRaw": "Amoxicillin 50 KG"},
    ])

    r = client.get("/inquiries")
    assert r.status_code == 200
    inquiries = r.json()
    assert any(i["ItemCount"] == 2 for i in inquiries)


def test_search_by_customer_name(client):
    cust_a = make_customer(client, name="Rajesh Kumar", company="Alpha Pharma")
    cust_b = make_customer(client, name="Sneha Patel", company="Beta Labs")
    make_inquiry(client, cust_a["CustomerID"])
    make_inquiry(client, cust_b["CustomerID"])

    r = client.get("/inquiries?customer_name=Rajesh")
    assert r.status_code == 200
    results = r.json()
    assert all("Rajesh" in i["CustomerName"] for i in results)
    assert not any("Sneha" in i["CustomerName"] for i in results)


def test_search_by_product_name_returns_matching_item_ids(client):
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"], items=[
        {"ProductNameRaw": "Azithromycin 500 KG"},
        {"ProductNameRaw": "Metformin 250 KG"},
    ])

    r = client.get("/inquiries?product_name=Azithromycin")
    assert r.status_code == 200
    results = r.json()
    match = next((i for i in results if i["InquiryID"] == inq["InquiryID"]), None)
    assert match is not None
    assert len(match["MatchingItemIDs"]) == 1

    detail = client.get(f"/inquiries/{inq['InquiryID']}").json()
    azithro_item = next(i for i in detail["Items"] if "Azithromycin" in i["ProductNameRaw"])
    assert azithro_item["ItemID"] in match["MatchingItemIDs"]


def test_update_inquiry_status(client):
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"])

    r = client.patch(f"/inquiries/{inq['InquiryID']}/status?status=Quoted")
    assert r.status_code == 200

    detail = client.get(f"/inquiries/{inq['InquiryID']}").json()
    assert detail["Status"] == "Quoted"


def test_toggle_select_item(client):
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"])
    item_id = client.get(f"/inquiries/{inq['InquiryID']}").json()["Items"][0]["ItemID"]

    r = client.patch(f"/items/{item_id}/toggle-select")
    assert r.status_code == 200
    assert r.json()["IsSelected"] is True

    r = client.patch(f"/items/{item_id}/toggle-select")
    assert r.json()["IsSelected"] is False


def test_bulk_select_items(client):
    cust = make_customer(client)
    inq = make_inquiry(client, cust["CustomerID"], items=[
        {"ProductNameRaw": "Azithromycin"},
        {"ProductNameRaw": "Metformin"},
    ])
    items = client.get(f"/inquiries/{inq['InquiryID']}").json()["Items"]
    ids = [i["ItemID"] for i in items]

    r = client.post("/items/bulk-select", json=ids)
    assert r.status_code == 200
    assert r.json()["count"] == 2

    work = client.get("/work-items").json()
    work_ids = [w["ItemID"] for w in work]
    for iid in ids:
        assert iid in work_ids


def test_work_items_includes_customer_info(client):
    cust = make_customer(client, name="Work Customer", company="Work Co")
    inq = make_inquiry(client, cust["CustomerID"])
    item_id = client.get(f"/inquiries/{inq['InquiryID']}").json()["Items"][0]["ItemID"]

    client.patch(f"/items/{item_id}/toggle-select")

    work = client.get("/work-items").json()
    item = next(w for w in work if w["ItemID"] == item_id)
    assert item["CustomerName"] == "Work Customer"
    assert item["CustomerCompany"] == "Work Co"
