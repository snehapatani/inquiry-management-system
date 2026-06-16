from fastapi import FastAPI, Depends, HTTPException, APIRouter, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text, func, and_, or_
from typing import List, Optional
import models, schemas
from database import engine, get_db, Base
from parser import parse_inquiry, normalize_product_name
from auth import get_current_user, require_admin, hash_password, verify_password, create_access_token

# Request models
class DeleteInquiryRequest(BaseModel):
    inquiry_id: int

Base.metadata.create_all(bind=engine)

# Add new columns to existing tables if they don't exist yet
_MIGRATIONS = [
    ("VendorProducts", "ReferencePrice",     "NUMERIC(18,4)"),
    ("VendorProducts", "ReferenceCurrency",  "VARCHAR(10)"),
    ("VendorProducts", "ReferencePriceUnit", "VARCHAR(30)"),
    ("VendorProducts", "ReferencePriceDate", "DATETIME"),
    ("VendorProducts", "CreatedBy",          "VARCHAR(100)"),
    ("Vendors",        "CreatedBy",          "VARCHAR(100)"),
    ("InquiryItems",   "IsSelected",         "BOOLEAN DEFAULT 0"),
]
with engine.connect() as _conn:
    for _table, _col, _typ in _MIGRATIONS:
        try:
            _conn.execute(text(f"ALTER TABLE {_table} ADD COLUMN {_col} {_typ}"))
            _conn.commit()
        except Exception:
            pass  # column already exists

app = FastAPI(title="Inquiry MS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Protected router — every route here requires a valid JWT
priv = APIRouter()


# ── Seed default admin if Users table is empty ────────────────
def _seed_default_admin():
    from database import SessionLocal
    db = SessionLocal()
    try:
        if db.query(models.User).count() == 0:
            db.add(models.User(
                Username="admin",
                FullName="Administrator",
                HashedPassword=hash_password("admin123"),
                Role="admin",
            ))
            db.commit()
    finally:
        db.close()

_seed_default_admin()


# ── Public endpoints (no auth required) ───────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/parse/mode")
def parse_mode():
    from parser import ai_available
    return {"ai": ai_available()}

@app.post("/auth/login", response_model=schemas.Token)
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.Username == req.username,
        models.User.IsActive == True,
    ).first()
    if not user or not verify_password(req.password, user.HashedPassword):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    token = create_access_token({"sub": str(user.UserID), "username": user.Username, "role": user.Role})
    return schemas.Token(access_token=token)


# ── Protected: Auth management ────────────────────────────────
@priv.get("/auth/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user

@priv.get("/auth/users", response_model=List[schemas.UserOut])
def list_users(_: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(models.User).all()

@priv.post("/auth/users", response_model=schemas.UserOut)
def create_user(data: schemas.UserCreate, _: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.Username == data.Username).first():
        raise HTTPException(400, "Username already exists")
    user = models.User(
        Username=data.Username,
        FullName=data.FullName,
        HashedPassword=hash_password(data.Password),
        Role=data.Role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@priv.delete("/auth/users/{user_id}")
def delete_user(user_id: int, current_user: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    if user_id == current_user.UserID:
        raise HTTPException(400, "Cannot deactivate your own account")
    user = db.query(models.User).filter(models.User.UserID == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.IsActive = False
    db.commit()
    return {"ok": True}


# ── Protected: LLM Parser ─────────────────────────────────────
@priv.post("/parse", response_model=schemas.ParsedInquiry)
def parse(req: schemas.ParseRequest):
    try:
        return parse_inquiry(req.raw_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Protected: Customers ──────────────────────────────────────
@priv.get("/customers", response_model=List[schemas.CustomerOut])
def list_customers(db: Session = Depends(get_db)):
    return db.query(models.Customer).filter(models.Customer.IsActive == 1).all()

@priv.post("/customers", response_model=schemas.CustomerOut)
def create_customer(data: schemas.CustomerCreate, db: Session = Depends(get_db)):
    customer = models.Customer(**data.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer

@priv.get("/customers/{customer_id}", response_model=schemas.CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Customer).filter(models.Customer.CustomerID == customer_id).first()
    if not c:
        raise HTTPException(404, "Customer not found")
    return c


# ── Protected: Inquiries ──────────────────────────────────────
@priv.get("/inquiries", response_model=List[schemas.InquiryOut])
def list_inquiries(
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    customer_name: Optional[str] = None,
    product_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    rows = (
        db.query(
            models.Inquiry,
            models.Customer.Name.label("CustomerName"),
            models.Customer.Company.label("CustomerCompany"),
            func.count(models.InquiryItem.ItemID).label("ItemCount"),
        )
        .join(models.Customer, models.Inquiry.CustomerID == models.Customer.CustomerID)
        .outerjoin(models.InquiryItem, models.Inquiry.InquiryID == models.InquiryItem.InquiryID)
        .group_by(models.Inquiry.InquiryID, models.Customer.Name, models.Customer.Company)
        .order_by(models.Inquiry.ReceivedDate.desc())
    )
    if status:
        rows = rows.filter(models.Inquiry.Status == status)
    if customer_id:
        rows = rows.filter(models.Inquiry.CustomerID == customer_id)
    if customer_name:
        rows = rows.filter(models.Customer.Name.ilike(f"%{customer_name}%"))
    if product_name:
        rows = rows.filter(
            models.InquiryItem.ProductNameNorm.ilike(f"%{product_name}%") |
            models.InquiryItem.ProductNameRaw.ilike(f"%{product_name}%")
        )

    all_rows = rows.all()
    inquiry_ids = [inq.InquiryID for inq, _, _, _ in all_rows]

    matching_items_map: dict = {}
    if product_name and inquiry_ids:
        matched = (
            db.query(models.InquiryItem.InquiryID, models.InquiryItem.ItemID)
            .filter(
                models.InquiryItem.InquiryID.in_(inquiry_ids),
                or_(
                    models.InquiryItem.ProductNameNorm.ilike(f"%{product_name}%"),
                    models.InquiryItem.ProductNameRaw.ilike(f"%{product_name}%"),
                )
            )
            .all()
        )
        for inq_id, item_id in matched:
            matching_items_map.setdefault(inq_id, []).append(item_id)

    result = []
    for inq, cname, ccompany, item_count in all_rows:
        out = schemas.InquiryOut.model_validate(inq)
        out.CustomerName = cname
        out.CustomerCompany = ccompany
        out.ItemCount = item_count
        out.MatchingItemIDs = matching_items_map.get(inq.InquiryID, [])
        result.append(out)
    return result

@priv.post("/inquiries", response_model=schemas.InquiryOut)
def create_inquiry(data: schemas.InquiryCreate, db: Session = Depends(get_db)):
    items = data.Items
    inquiry_data = data.model_dump(exclude={"Items"})
    inquiry = models.Inquiry(**inquiry_data)
    db.add(inquiry)
    db.flush()
    for item in items:
        norm = item.ProductNameNorm or normalize_product_name(item.ProductNameRaw)
        db_item = models.InquiryItem(
            InquiryID=inquiry.InquiryID,
            ProductNameRaw=item.ProductNameRaw,
            ProductNameNorm=norm,
            Quantity=item.Quantity,
            Unit=item.Unit,
            Grade=item.Grade,
            ManufacturerPref=item.ManufacturerPref,
            Remarks=item.Remarks,
        )
        db.add(db_item)
    db.commit()
    db.refresh(inquiry)
    return inquiry

@priv.get("/inquiries/{inquiry_id}", response_model=schemas.InquiryDetail)
def get_inquiry(inquiry_id: int, db: Session = Depends(get_db)):
    inq = db.query(models.Inquiry).filter(models.Inquiry.InquiryID == inquiry_id).first()
    if not inq:
        raise HTTPException(404, "Inquiry not found")
    items = db.query(models.InquiryItem).filter(models.InquiryItem.InquiryID == inquiry_id).all()
    customer = db.query(models.Customer).filter(models.Customer.CustomerID == inq.CustomerID).first()
    return schemas.InquiryDetail(
        **schemas.InquiryOut.model_validate(inq).model_dump(),
        Items=[schemas.InquiryItemOut.model_validate(i) for i in items],
        Customer=schemas.CustomerOut.model_validate(customer) if customer else None,
    )

@priv.patch("/inquiries/{inquiry_id}/status")
def update_inquiry_status(inquiry_id: int, status: str, db: Session = Depends(get_db)):
    inq = db.query(models.Inquiry).filter(models.Inquiry.InquiryID == inquiry_id).first()
    if not inq:
        raise HTTPException(404, "Inquiry not found")
    inq.Status = status
    db.commit()
    return {"ok": True}

# ── Protected: InquiryItems ───────────────────────────────────
@priv.patch("/items/{item_id}/toggle-select")
def toggle_select(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.InquiryItem).filter(models.InquiryItem.ItemID == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    item.IsSelected = not bool(item.IsSelected)
    db.commit()
    return {"IsSelected": item.IsSelected}

@priv.post("/items/bulk-select")
def bulk_select_items(item_ids: List[int], db: Session = Depends(get_db)):
    db.query(models.InquiryItem).filter(models.InquiryItem.ItemID.in_(item_ids)).update(
        {"IsSelected": True}, synchronize_session=False
    )
    db.commit()
    return {"ok": True, "count": len(item_ids)}

@priv.get("/work-items", response_model=List[schemas.WorkItemOut])
def get_work_items(db: Session = Depends(get_db)):
    rows = (
        db.query(models.InquiryItem, models.Customer.Name, models.Customer.Company)
        .join(models.Inquiry, models.InquiryItem.InquiryID == models.Inquiry.InquiryID)
        .join(models.Customer, models.Inquiry.CustomerID == models.Customer.CustomerID)
        .filter(models.InquiryItem.IsSelected == True)
        .order_by(models.InquiryItem.CreatedAt.desc())
        .all()
    )
    result = []
    for item, cname, ccompany in rows:
        out = schemas.WorkItemOut.model_validate(item)
        out.CustomerName = cname
        out.CustomerCompany = ccompany
        result.append(out)
    return result

@priv.get("/inquiries/{inquiry_id}/items", response_model=List[schemas.InquiryItemOut])
def get_items(inquiry_id: int, db: Session = Depends(get_db)):
    return db.query(models.InquiryItem).filter(models.InquiryItem.InquiryID == inquiry_id).all()

@priv.patch("/items/{item_id}/best-quote")
def set_best_quote(item_id: int, quote_id: int, db: Session = Depends(get_db)):
    item = db.query(models.InquiryItem).filter(models.InquiryItem.ItemID == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    db.query(models.VendorQuote).filter(models.VendorQuote.ItemID == item_id).update({"IsBestPrice": 0})
    item.BestQuoteID = quote_id
    db.query(models.VendorQuote).filter(models.VendorQuote.QuoteID == quote_id).update({"IsBestPrice": 1})
    db.commit()
    return {"ok": True}


# ── Protected: Vendors ────────────────────────────────────────
@priv.get("/vendors", response_model=List[schemas.VendorOut])
def list_vendors(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Vendor, func.count(models.VendorProduct.VendorProductID).label("ProductCount"))
        .outerjoin(models.VendorProduct, (models.VendorProduct.VendorID == models.Vendor.VendorID) & (models.VendorProduct.IsAvailable == 1))
        .filter(models.Vendor.IsActive == 1)
        .group_by(models.Vendor.VendorID)
        .all()
    )
    result = []
    for vendor, count in rows:
        out = schemas.VendorOut.model_validate(vendor)
        out.ProductCount = count
        result.append(out)
    return result

@priv.post("/vendors", response_model=schemas.VendorOut)
def create_vendor(data: schemas.VendorCreate, db: Session = Depends(get_db)):
    vendor = models.Vendor(**data.model_dump())
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor

@priv.put("/vendors/{vendor_id}", response_model=schemas.VendorOut)
def update_vendor(vendor_id: int, data: schemas.VendorCreate, db: Session = Depends(get_db)):
    vendor = db.query(models.Vendor).filter(models.Vendor.VendorID == vendor_id).first()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    for k, v in data.model_dump().items():
        setattr(vendor, k, v)
    db.commit()
    db.refresh(vendor)
    return vendor

@priv.delete("/vendors/{vendor_id}")
def delete_vendor(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.query(models.Vendor).filter(models.Vendor.VendorID == vendor_id).first()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    vendor.IsActive = 0
    db.commit()
    return {"ok": True}


# ── Protected: VendorProducts ─────────────────────────────────
@priv.get("/vendors/{vendor_id}/products", response_model=List[schemas.VendorProductOut])
def get_vendor_products(vendor_id: int, db: Session = Depends(get_db)):
    products = db.query(models.VendorProduct).filter(models.VendorProduct.VendorID == vendor_id).all()
    sq = (
        db.query(
            models.InquiryItem.ProductNameNorm.label("pname"),
            func.max(models.VendorQuote.QuotedDate).label("max_date"),
        )
        .join(models.VendorQuote, models.VendorQuote.ItemID == models.InquiryItem.ItemID)
        .filter(models.VendorQuote.VendorID == vendor_id)
        .group_by(models.InquiryItem.ProductNameNorm)
        .subquery()
    )
    recent = (
        db.query(models.VendorQuote, models.InquiryItem.ProductNameNorm.label("pname"))
        .join(models.InquiryItem, models.VendorQuote.ItemID == models.InquiryItem.ItemID)
        .join(sq, and_(
            models.InquiryItem.ProductNameNorm == sq.c.pname,
            models.VendorQuote.QuotedDate == sq.c.max_date,
        ))
        .filter(models.VendorQuote.VendorID == vendor_id)
        .all()
    )
    quote_map = {pname: q for q, pname in recent}
    result = []
    for p in products:
        out = schemas.VendorProductOut.model_validate(p)
        q = quote_map.get(p.ProductName)
        if q:
            out.LastQuotedPrice = q.QuotedPrice
            out.LastQuotedDate = q.QuotedDate
            out.LastPriceUnit = q.PriceUnit
            out.LastCurrency = q.Currency
        elif p.ReferencePrice:
            out.LastQuotedPrice = p.ReferencePrice
            out.LastQuotedDate = p.ReferencePriceDate
            out.LastPriceUnit = p.ReferencePriceUnit
            out.LastCurrency = p.ReferenceCurrency
        result.append(out)
    return result

@priv.post("/vendor-products", response_model=schemas.VendorProductOut)
def create_vendor_product(data: schemas.VendorProductCreate, db: Session = Depends(get_db)):
    vp = models.VendorProduct(**data.model_dump())
    db.add(vp)
    db.commit()
    db.refresh(vp)
    return vp

@priv.delete("/vendor-products/{vp_id}")
def delete_vendor_product(vp_id: int, db: Session = Depends(get_db)):
    vp = db.query(models.VendorProduct).filter(models.VendorProduct.VendorProductID == vp_id).first()
    if not vp:
        raise HTTPException(404, "Not found")
    db.delete(vp)
    db.commit()
    return {"ok": True}


# ── Protected: Vendor Matching ────────────────────────────────
@priv.get("/items/{item_id}/match-vendors", response_model=List[schemas.VendorMatch])
def match_vendors(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.InquiryItem).filter(models.InquiryItem.ItemID == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    search_name = item.ProductNameNorm or item.ProductNameRaw
    _NOISE = {
        "kg", "kgs", "mg", "ml", "mt", "mts", "gm", "gms", "lt", "lit",
        "usp", "bp", "ip", "ep", "ar", "lr", "nf", "jp", "per", "and", "for", "the",
    }
    keywords = [
        w for w in search_name.split()
        if len(w) >= 4
        and not w.replace(".", "").replace(",", "").isdigit()
        and w.lower() not in _NOISE
    ]
    vp_query = db.query(models.VendorProduct, models.Vendor).join(
        models.Vendor, models.VendorProduct.VendorID == models.Vendor.VendorID
    ).filter(models.Vendor.IsActive == 1, models.VendorProduct.IsAvailable == 1)
    if keywords:
        conditions = [models.VendorProduct.ProductName.ilike(f"%{w}%") for w in keywords]
        vp_query = vp_query.filter(and_(*conditions))
    results = vp_query.all()
    if results:
        item.MatchStatus = "Matched"
    else:
        item.MatchStatus = "No Vendor"
    db.commit()
    matched_vendor_ids = list({vendor.VendorID for _, vendor in results})
    quote_by_vendor: dict = {}
    if matched_vendor_ids and keywords:
        sq = (
            db.query(
                models.VendorQuote.VendorID.label("vid"),
                func.max(models.VendorQuote.QuotedDate).label("max_date"),
            )
            .join(models.InquiryItem, models.VendorQuote.ItemID == models.InquiryItem.ItemID)
            .filter(
                models.VendorQuote.VendorID.in_(matched_vendor_ids),
                or_(*[
                    models.InquiryItem.ProductNameNorm.ilike(f"%{w}%") |
                    models.InquiryItem.ProductNameRaw.ilike(f"%{w}%")
                    for w in keywords
                ])
            )
            .group_by(models.VendorQuote.VendorID)
            .subquery()
        )
        recent = (
            db.query(models.VendorQuote)
            .join(sq, and_(
                models.VendorQuote.VendorID == sq.c.vid,
                models.VendorQuote.QuotedDate == sq.c.max_date,
            ))
            .all()
        )
        quote_by_vendor = {q.VendorID: q for q in recent}
    return [
        schemas.VendorMatch(
            VendorProductID=vp.VendorProductID,
            VendorID=vp.VendorID,
            VendorName=vendor.VendorName,
            ContactPerson=vendor.ContactPerson,
            Email=vendor.Email,
            Phone=vendor.Phone,
            ProductName=vp.ProductName,
            Grade=vp.Grade,
            Manufacturer=vp.Manufacturer,
            LeadTimeDays=vp.LeadTimeDays,
            LastQuotedPrice=quote_by_vendor[vendor.VendorID].QuotedPrice if vendor.VendorID in quote_by_vendor else None,
            LastQuotedDate=quote_by_vendor[vendor.VendorID].QuotedDate if vendor.VendorID in quote_by_vendor else None,
            LastPriceUnit=quote_by_vendor[vendor.VendorID].PriceUnit if vendor.VendorID in quote_by_vendor else None,
            LastCurrency=quote_by_vendor[vendor.VendorID].Currency if vendor.VendorID in quote_by_vendor else None,
        )
        for vp, vendor in results
    ]


# ── Protected: VendorQuotes ───────────────────────────────────
@priv.get("/quotes", response_model=List[schemas.VendorQuoteOut])
def get_all_quotes(db: Session = Depends(get_db)):
    return db.query(models.VendorQuote).all()

@priv.get("/items/{item_id}/quotes", response_model=List[schemas.VendorQuoteOut])
def get_quotes(item_id: int, db: Session = Depends(get_db)):
    return db.query(models.VendorQuote).filter(models.VendorQuote.ItemID == item_id).all()

@priv.post("/quotes", response_model=schemas.VendorQuoteOut)
def create_quote(data: schemas.VendorQuoteCreate, db: Session = Depends(get_db)):
    quote = models.VendorQuote(**data.model_dump())
    db.add(quote)
    db.commit()
    db.refresh(quote)
    return quote

@priv.put("/quotes/{quote_id}", response_model=schemas.VendorQuoteOut)
def update_quote(quote_id: int, data: schemas.VendorQuoteCreate, db: Session = Depends(get_db)):
    quote = db.query(models.VendorQuote).filter(models.VendorQuote.QuoteID == quote_id).first()
    if not quote:
        raise HTTPException(404, "Quote not found")
    for k, v in data.model_dump().items():
        setattr(quote, k, v)
    db.commit()
    db.refresh(quote)
    return quote


# ── Protected: SentResponses ──────────────────────────────────
@priv.post("/responses", response_model=schemas.SentResponseOut)
def send_response(data: schemas.SentResponseCreate, db: Session = Depends(get_db)):
    resp = models.SentResponse(**data.model_dump())
    db.add(resp)
    db.query(models.Inquiry).filter(
        models.Inquiry.InquiryID == data.InquiryID
    ).update({"Status": "Quoted"})
    db.commit()
    db.refresh(resp)
    return resp

@priv.get("/inquiries/{inquiry_id}/responses", response_model=List[schemas.SentResponseOut])
def get_responses(inquiry_id: int, db: Session = Depends(get_db)):
    return db.query(models.SentResponse).filter(
        models.SentResponse.InquiryID == inquiry_id
    ).all()

@priv.get("/responses", response_model=List[schemas.SentResponseLog])
def get_all_responses(db: Session = Depends(get_db)):
    rows = (
        db.query(models.SentResponse, models.Customer.Name, models.Customer.Company)
        .join(models.Inquiry, models.SentResponse.InquiryID == models.Inquiry.InquiryID)
        .join(models.Customer, models.Inquiry.CustomerID == models.Customer.CustomerID)
        .order_by(models.SentResponse.SentDate.desc())
        .all()
    )
    result = []
    for resp, cname, ccompany in rows:
        out = schemas.SentResponseLog.model_validate(resp)
        out.CustomerName = cname
        out.CustomerCompany = ccompany
        result.append(out)
    return result


# Register protected router
app.include_router(priv)

# Delete inquiry endpoint
@app.post("/delete-inquiry")
def delete_inquiry_endpoint(req: DeleteInquiryRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    inquiry_id = req.inquiry_id
    inq = db.query(models.Inquiry).filter(models.Inquiry.InquiryID == inquiry_id).first()
    if not inq:
        raise HTTPException(404, "Inquiry not found")
    db.query(models.SentResponse).filter(models.SentResponse.InquiryID == inquiry_id).delete(synchronize_session=False)
    items = db.query(models.InquiryItem.ItemID).filter(models.InquiryItem.InquiryID == inquiry_id).all()
    item_ids = [item[0] for item in items]
    if item_ids:
        db.query(models.VendorQuote).filter(models.VendorQuote.ItemID.in_(item_ids)).delete(synchronize_session=False)
    db.query(models.InquiryItem).filter(models.InquiryItem.InquiryID == inquiry_id).delete(synchronize_session=False)
    db.delete(inq)
    db.commit()
    return {"ok": True}
